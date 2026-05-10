import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^14.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), { status: 400 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    console.error(`[stripe-webhook] Signature verification failed: ${err.message}`);
    return new Response(JSON.stringify({ error: `Webhook Error: ${err.message}` }), { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const eventId = event.id;

  // 1. Idempotency Check
  const { data: existingEvent, error: fetchEventError } = await adminClient
    .from("payment_events")
    .select("status")
    .eq("stripe_event_id", eventId)
    .maybeSingle();

  if (fetchEventError) {
    console.error(`[stripe-webhook] Error fetching event: ${fetchEventError.message}`);
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
  }

  if (existingEvent?.status === "processed" || existingEvent?.status === "processing") {
    return new Response(JSON.stringify({ message: "Event already being processed or processed" }), { status: 200 });
  }

  // 2. Handle specific events
  if (event.type !== "checkout.session.completed") {
    await adminClient.from("payment_events").upsert({
      stripe_event_id: eventId,
      event_type: event.type,
      status: "ignored",
      error_message: "unsupported_event_type",
      updated_at: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ message: `Ignored event type: ${event.type}` }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Initial log of the processing
  await adminClient.from("payment_events").upsert({
    stripe_event_id: eventId,
    stripe_session_id: session.id,
    stripe_payment_link_id: session.payment_link as string,
    user_id: session.client_reference_id,
    event_type: event.type,
    status: "processing",
    amount_total: session.amount_total,
    currency: session.currency,
    payment_status: session.payment_status,
    payload: {
      id: event.id,
      type: event.type,
      session_id: session.id,
      payment_link: session.payment_link,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      currency: session.currency,
      client_reference_id: session.client_reference_id,
    },
    updated_at: new Date().toISOString(),
  });

  try {
    // 3. Validations
    if (session.payment_status !== "paid") {
      await updateEventStatus(adminClient, eventId, "ignored", "payment_not_paid");
      return new Response(JSON.stringify({ message: "Payment not paid" }), { status: 200 });
    }

    const userId = session.client_reference_id;
    if (!userId) {
      await updateEventStatus(adminClient, eventId, "error", "missing_client_reference_id");
      return new Response(JSON.stringify({ message: "Missing client_reference_id" }), { status: 200 });
    }

    // Verify user exists and check current plan
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, plan, plan_expires_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      await updateEventStatus(adminClient, eventId, "error", profileError ? profileError.message : "user_not_found");
      return new Response(JSON.stringify({ message: "User not found" }), { status: 200 });
    }

    // Check Payment Link ID if restricted
    const expectedPaymentLink = Deno.env.get("STRIPE_PREMIUM_PAYMENT_LINK_ID");
    if (expectedPaymentLink && session.payment_link && session.payment_link !== expectedPaymentLink) {
      await updateEventStatus(adminClient, eventId, "ignored", "wrong_payment_link");
      return new Response(JSON.stringify({ message: "Payment link mismatch" }), { status: 200 });
    }

    // Amount and Currency validations (optional)
    const expectedAmount = Deno.env.get("STRIPE_PREMIUM_AMOUNT_TOTAL");
    const expectedCurrency = Deno.env.get("STRIPE_PREMIUM_CURRENCY");
    if (expectedAmount && session.amount_total !== parseInt(expectedAmount)) {
      await updateEventStatus(adminClient, eventId, "ignored", "amount_mismatch");
      return new Response(JSON.stringify({ message: "Amount mismatch" }), { status: 200 });
    }
    if (expectedCurrency && session.currency !== expectedCurrency.toLowerCase()) {
      await updateEventStatus(adminClient, eventId, "ignored", "currency_mismatch");
      return new Response(JSON.stringify({ message: "Currency mismatch" }), { status: 200 });
    }

    // Edge case: User has active Family plan
    const now = new Date();
    const isFamilyActive = profile.plan === "family" && (profile.plan_expires_at ? new Date(profile.plan_expires_at) > now : true);
    if (isFamilyActive) {
      await updateEventStatus(adminClient, eventId, "ignored", "active_family_plan");
      return new Response(JSON.stringify({ message: "User has active Family plan" }), { status: 200 });
    }

    // 4. Activate Plan via RPC
    const { data: rpcResult, error: rpcError } = await adminClient.rpc("admin_extend_plan_30_days", {
      target_user_id: userId,
      target_plan: "premium",
    });

    if (rpcError || !rpcResult?.success) {
      console.error(`[stripe-webhook] RPC Error: ${rpcError?.message}`);
      await updateEventStatus(adminClient, eventId, "error", rpcError?.message || "rpc_failed");
      return new Response(JSON.stringify({ error: "Failed to extend plan via RPC" }), { status: 500 });
    }

    // 5. Fetch updated profile for audit log
    const { data: updatedProfile } = await adminClient
      .from("profiles")
      .select("plan, plan_expires_at")
      .eq("id", userId)
      .single();

    // 6. Write Audit Log
    try {
      await adminClient.from("admin_plan_actions").insert({
        admin_user_id: null,
        admin_email: "stripe-webhook",
        target_user_id: userId,
        target_email: profile.email,
        action_type: "extend_premium_30",
        old_plan: profile.plan,
        new_plan: updatedProfile?.plan || "premium",
        old_plan_expires_at: profile.plan_expires_at,
        new_plan_expires_at: updatedProfile?.plan_expires_at,
        reason: `Stripe Payment Link auto activation: ${eventId}`,
      });
    } catch (auditError) {
      console.error(`[stripe-webhook] Audit log failed: ${auditError.message}`);
      // Don't fail the whole request if only audit log failed, but record it
      await adminClient.from("payment_events").update({
        error_message: `Audit log failed: ${auditError.message}`,
        updated_at: new Date().toISOString(),
      }).eq("stripe_event_id", eventId);
    }

    // 7. Success
    await adminClient.from("payment_events").update({
      status: "processed",
      target_plan: "premium",
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("stripe_event_id", eventId);

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err) {
    console.error(`[stripe-webhook] Unexpected error: ${err.message}`);
    await updateEventStatus(adminClient, eventId, "error", err.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
});

async function updateEventStatus(client: any, eventId: string, status: string, errorMessage: string | null = null) {
  await client.from("payment_events").update({
    status,
    error_message: errorMessage,
    updated_at: new Date().toISOString(),
  }).eq("stripe_event_id", eventId);
}
