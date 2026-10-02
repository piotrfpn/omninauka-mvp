import { supabase } from './supabase';

/** Send the email's raw bearer token; hashing and approval stay on the backend. */
export async function approveParentalConsent(token: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('approve-parental-consent', {
    body: { token },
  });
  if (error) throw new Error('Consent approval unavailable');
  return data?.status === 'approved';
}
