import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function isValidUUID(uuid: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
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
    console.error(`[stripe-webhook] signature_verification_failed`);
    return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return new Response(JSON.stringify({ message: "ignored_unsupported_event" }), { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== "paid" || session.mode !== "payment") {
    // If completed but unpaid (e.g. async pending), safely ignore without fulfillment.
    return new Response(JSON.stringify({ message: "ignored_unpaid" }), { status: 200 });
  }

  if (session.payment_link !== null) {
    return new Response(JSON.stringify({ message: "ignored_legacy_payment_link" }), { status: 200 });
  }

  const metadata = session.metadata || {};

  if (metadata.omninauka_binding_version !== "checkout_v1" || metadata.omninauka_plan !== "premium") {
    return new Response(JSON.stringify({ message: "ignored_binding_mismatch" }), { status: 200 });
  }

  const metadataUserId = metadata.omninauka_user_id;
  const clientRefId = session.client_reference_id;

  if (!metadataUserId || !clientRefId || metadataUserId !== clientRefId) {
    return new Response(JSON.stringify({ message: "ignored_id_mismatch" }), { status: 200 });
  }

  if (!isValidUUID(metadataUserId) || !isValidUUID(clientRefId)) {
    return new Response(JSON.stringify({ message: "ignored_invalid_format" }), { status: 200 });
  }

  let lineItems;
  try {
    lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  } catch (err) {
    console.error(`[stripe-webhook] line_items_lookup_failed`);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }

  const expectedPriceId = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
  if (!expectedPriceId) {
    console.error(`[stripe-webhook] price_id_missing`);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }

  if (lineItems.data.length !== 1 || lineItems.has_more) {
    return new Response(JSON.stringify({ message: "ignored_invalid_items" }), { status: 200 });
  }

  const item = lineItems.data[0];
  if (item.quantity !== 1 || item.price?.id !== expectedPriceId) {
    return new Response(JSON.stringify({ message: "ignored_price_mismatch" }), { status: 200 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  const { data: rpcResult, error: rpcError } = await adminClient.rpc("fulfill_stripe_premium_payment", {
    p_stripe_event_id: event.id,
    p_stripe_session_id: session.id,
    p_target_user_id: metadataUserId,
    p_event_type: event.type,
    p_amount_total: session.amount_total,
    p_currency: session.currency,
    p_payment_status: session.payment_status
  });

  if (rpcError) {
    console.error(`[stripe-webhook] fulfillment_rpc_failed`);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }

  const validOutcomes = [
    "processed",
    "already_processed_event",
    "duplicate_checkout_session",
    "reconciliation_required"
  ];

  if (
    !rpcResult ||
    typeof rpcResult !== 'object' ||
    Array.isArray(rpcResult) ||
    !validOutcomes.includes(rpcResult.outcome)
  ) {
    console.error(`[stripe-webhook] invalid_rpc_outcome`);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true, message: "acknowledged" }), { status: 200 });
});