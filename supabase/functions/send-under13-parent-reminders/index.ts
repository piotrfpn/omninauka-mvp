import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createUnder13ParentReminderHandler, type ReminderWork } from '../_shared/under13-parent-reminder-core.ts';

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error('Server configuration unavailable');
  return value;
};

serve(createUnder13ParentReminderHandler({
  schedulerSecret: () => Deno.env.get('UNDER13_REMINDER_SCHEDULER_SECRET'),
  providerConfig: () => ({ apiKey: required('RESEND_API_KEY'), from: required('RESEND_FROM_EMAIL'),
    appBaseUrl: required('APP_BASE_URL') }),
  createBackend: () => {
    const client = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rpc = async (name: string, parameters: Record<string, unknown>) => {
      const { data, error } = await client.rpc(name, parameters);
      if (error) throw new Error('Reminder database operation unavailable');
      return data;
    };
    const fence = (work: ReminderWork) => ({ p_event_id: work.event_id, p_claim_token: work.claim_token });
    return {
      claim: batch => rpc('claim_due_under13_parent_reminders', { p_batch_size: batch }),
      parent: async id => {
        const { data, error } = await client.auth.admin.getUserById(id);
        if (error) throw new Error('Parent lookup unavailable');
        return data.user;
      },
      prepare: (work, recipientHash, payloadHash) => rpc('prepare_under13_parent_reminder', {
        ...fence(work), p_recipient_hash: recipientHash, p_payload_hash: payloadHash,
      }),
      finish: (work, result, retryAfterSeconds) => rpc('finish_under13_parent_reminder', {
        ...fence(work), p_result: result, p_retry_after_seconds: retryAfterSeconds,
      }),
    };
  },
  fetch,
  log: counts => console.log(JSON.stringify(counts)),
}));
