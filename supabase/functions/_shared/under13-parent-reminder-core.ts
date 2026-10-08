import { under13ParentReminderTemplate } from './under13-parent-reminder-template.ts';

export const REMINDER_BATCH_SIZE = 20;
export const RESEND_HTTP_TIMEOUT_MS = 15000;

export interface ReminderWork {
  event_id: string;
  parent_user_id: string;
  claim_token: string;
  retention_deadline_at: string;
  idempotency_key: string;
}
export interface ReminderBackend {
  claim: (batch: number) => Promise<ReminderWork[]>;
  parent: (id: string) => Promise<{ id: string; email?: string; email_confirmed_at?: string | null } | null>;
  prepare: (work: ReminderWork, recipientHash: string, payloadHash: string) => Promise<{
    allowed: boolean; status: string; send_before?: string;
  }>;
  finish: (work: ReminderWork, result: string, retryAfterSeconds: number) => Promise<string>;
}
interface Dependencies {
  schedulerSecret: () => string | undefined;
  createBackend: () => ReminderBackend;
  providerConfig: () => { apiKey: string; from: string; appBaseUrl: string };
  fetch: typeof fetch;
  now?: () => number;
  log?: (counts: Counters) => void;
}
interface Counters {
  claimed: number;
  accepted: number;
  retryable: number;
  cancelled: number;
  terminal_error: number;
  delivery_unknown: number;
  safe_failure: number;
  duration_ms: number;
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Digest comparison always examines all bytes securely; no early prefix match. */
export async function schedulerAuthorized(
  expected: string | undefined,
  timestampStr: string | null,
  signatureStr: string | null,
  now: number
) {
  if (!expected || !timestampStr || !signatureStr || signatureStr.length !== 64) return false;

  if (!/^\d+$/.test(timestampStr)) return false;
  const timestamp = Number(timestampStr);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) return false;

  const serverNowSec = Math.floor(now / 1000);
  if (Math.abs(serverNowSec - timestamp) > 300) return false;

  if (!/^[0-9a-f]{64}$/.test(signatureStr)) return false;

  const canonicalMessage = `omninauka:under13-parent-reminder:v1\n${timestampStr}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(expected),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(canonicalMessage)
  );

  const computedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  let difference = 0;
  for (let i = 0; i < 64; i++) {
    difference |= computedSignature.charCodeAt(i) ^ signatureStr.charCodeAt(i);
  }
  return difference === 0;
}
export function providerResult(status: number): string {
  if (status >= 200 && status < 300) return 'accepted';
  if (status === 429) return 'provider_rate_limited';
  if (status >= 500 && status < 600) return 'provider_5xx';
  if (status === 408) return 'provider_timeout';
  // Never change the key for a 409. Bounded retry is safe for concurrent requests;
  // payload_hash prevents locally changed payloads. Persistent conflict stops after 3.
  if (status === 409) return 'provider_conflict';
  if (status === 401 || status === 403) return 'provider_auth_or_config';
  if (status === 400 || status === 422) return 'invalid_recipient';
  return 'provider_rejected';
}
export function retryAfterSeconds(value: string | null, now: number): number {
  if (!value) return 0;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.min(21600, Math.max(0, seconds)) : 0;
}
const reply = (status: number, data: object) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** No body/query parser: only the private DB claim RPC selects work. */
export function createUnder13ParentReminderHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return reply(405, { status: 'method_not_allowed' });
    const now = deps.now ?? Date.now;
    try {
      if (!await schedulerAuthorized(
        deps.schedulerSecret(),
        request.headers.get('x-omninauka-reminder-ts'),
        request.headers.get('x-omninauka-reminder-signature'),
        now()
      )) {
        return reply(401, { status: 'unauthorized' });
      }
    } catch { return reply(503, { status: 'authentication_unavailable' }); }
    // No privileged client, configuration or work before scheduler authentication.
    const started = now();
    const counts: Counters = { claimed: 0, accepted: 0, retryable: 0, cancelled: 0,
      terminal_error: 0, delivery_unknown: 0, safe_failure: 0, duration_ms: 0 };
    try {
      const config = deps.providerConfig();
      if (!config.apiKey || !config.from || !config.appBaseUrl) throw new Error('Configuration unavailable');
      // Validate static configuration before consuming any claims.
      under13ParentReminderTemplate('2030-01-01T00:00:00Z', config.appBaseUrl);
      const backend = deps.createBackend();
      const workItems = await backend.claim(REMINDER_BATCH_SIZE);
      if (!Array.isArray(workItems) || workItems.length > REMINDER_BATCH_SIZE) throw new Error('Invalid batch');
      counts.claimed = workItems.length;
      const finish = async (work: ReminderWork, result: string, retryAfter = 0) => {
        // Never fall back to a direct UPDATE. ACK loss leaves the durable claim
        // recoverable with the SAME key/hash/payload after its lease/backoff.
        const state = await backend.finish(work, result, retryAfter);
        if (state === 'accepted' || state === 'retryable' || state === 'cancelled' ||
          state === 'terminal_error' || state === 'delivery_unknown') counts[state]++;
        else counts.safe_failure++;
      };
      for (const work of workItems) {
        try {
          if (!Number.isFinite(Date.parse(work.retention_deadline_at))) throw new Error('Invalid work');
          if (now() >= Date.parse(work.retention_deadline_at)) {
            await finish(work, 'deadline_passed'); continue;
          }
          let parent;
          try { parent = await backend.parent(work.parent_user_id); }
          catch { await finish(work, 'parent_lookup_failed'); continue; }
          if (!parent || parent.id !== work.parent_user_id || !parent.email?.trim()) {
            await finish(work, 'parent_unavailable'); continue;
          }
          // Email confirmation is distinct from phone/confirmed_at. No hash before this gate.
          if (!parent.email_confirmed_at) {
            await finish(work, 'parent_email_unconfirmed'); continue;
          }
          const email = parent.email.trim().toLowerCase();
          const template = under13ParentReminderTemplate(work.retention_deadline_at, config.appBaseUrl);
          const payload = JSON.stringify({ from: config.from, to: [email], ...template });
          const recipientHash = await sha256(email);
          const payloadHash = await sha256(payload);
          const prepared = await backend.prepare(work, recipientHash, payloadHash);
          if (!prepared.allowed) {
            if (prepared.status === 'cancelled' || prepared.status === 'delivery_unknown') counts[prepared.status]++;
            else counts.safe_failure++;
            continue;
          }
          // DB final gate supplied its current lease/retry/deadline upper bound.
          const sendBefore = Math.min(Date.parse(work.retention_deadline_at), Date.parse(prepared.send_before ?? ''));
          if (!Number.isFinite(sendBefore)) throw new Error('Invalid send bound');
          const remaining = sendBefore - now();
          if (remaining <= 0) { await finish(work, 'deadline_passed'); continue; }
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), Math.min(RESEND_HTTP_TIMEOUT_MS, remaining));
          let result: string;
          let retryAfter = 0;
          try {
            const response = await deps.fetch('https://api.resend.com/emails', {
              method: 'POST', redirect: 'error', signal: controller.signal,
              headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json',
                'Idempotency-Key': work.idempotency_key }, body: payload,
            });
            result = providerResult(response.status);
            retryAfter = retryAfterSeconds(response.headers.get('Retry-After'), now());
            // No provider body parsing, logging, persistence or unbounded download.
            void response.body?.cancel().catch(() => {});
          } catch { result = 'provider_timeout'; }
          finally { clearTimeout(timeout); }
          await finish(work, result, retryAfter);
        } catch { counts.safe_failure++; }
      }
    } catch { counts.safe_failure++; }
    counts.duration_ms = Math.max(0, now() - started);
    // SDK/provider exception messages and identifiers never cross this boundary.
    deps.log?.(counts);
    return reply(counts.safe_failure > 0 ? 503 : 200, counts);
  };
}
