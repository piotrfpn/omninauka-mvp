import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isValidAppUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bodyText = await req.text();
    if (bodyText) {
      const value = JSON.parse(bodyText);
      if (
        value === null ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        Object.keys(value).length > 0
      ) {
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const accessToken = bearerMatch?.[1]?.trim();

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    console.error("[create-checkout] config_missing");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const appUrlStr = Deno.env.get("APP_URL");
  if (!appUrlStr) {
    console.error("[create-checkout] app_url_missing");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const appOrigin = isValidAppUrl(appUrlStr);
  if (!appOrigin) {
    console.error("[create-checkout] app_url_invalid");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create a user-scoped client
  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser(accessToken);

  if (authError || !user) {
    console.error("[create-checkout] auth_failed");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  // Verify eligibility (cannot have active Family plan, must be active account)
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("plan, plan_expires_at, account_status")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[create-checkout] profile_lookup_failed");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (profile.account_status !== "active") {
    console.error("[create-checkout] inactive_account");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isFamilyActive = profile.plan === "family" && (!profile.plan_expires_at || new Date(profile.plan_expires_at) > new Date());
  if (isFamilyActive) {
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("[create-checkout] stripe_key_missing");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const priceId = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
  if (!priceId) {
    console.error("[create-checkout] price_id_missing");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      metadata: {
        omninauka_user_id: userId,
        omninauka_plan: "premium",
        omninauka_binding_version: "checkout_v1",
      },
      success_url: `${appOrigin}/app/payment-success`,
      cancel_url: `${appOrigin}/app/payments`,
    });

    if (!session.url) {
      console.error("[create-checkout] session_url_missing");
      return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (stripeError) {
    console.error("[create-checkout] stripe_session_create_failed");
    return new Response(JSON.stringify({ error: "Checkout unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
