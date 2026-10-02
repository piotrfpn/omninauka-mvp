import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createConsentApprovalHandler } from "../_shared/consent-approval.ts";

serve(createConsentApprovalHandler(async (parameters) => {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('Server configuration unavailable');

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await adminClient.rpc('approve_parental_consent', parameters);
  if (error) throw new Error('Consent approval unavailable');
  return data === true;
}));
