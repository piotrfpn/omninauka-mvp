interface ApprovalParameters {
  p_token_hash: string;
  p_ip: null;
  p_user_agent: string | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, result: string): Response {
  return new Response(JSON.stringify({ status: result }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

/** Public bearer-token flow; the injected operation must use service_role. */
export function createConsentApprovalHandler(
  approve: (parameters: ApprovalParameters) => Promise<boolean>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return reply(200, 'ok');
    if (req.method !== 'POST') return reply(405, 'invalid');

    let token: unknown;
    try {
      // Bound the body even when Content-Length is missing or dishonest.
      const reader = req.body?.getReader();
      if (!reader) return reply(400, 'invalid');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) {
          await reader.cancel();
          return reply(413, 'invalid');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || typeof body !== 'object' || !('token' in body)) {
        return reply(400, 'invalid');
      }
      token = body.token;
    } catch {
      return reply(400, 'invalid');
    }

    // Current emails use 36 bytes; retain the previous 32-byte token format.
    if (typeof token !== 'string' || !/^(?:[0-9a-f]{64}|[0-9a-f]{72})$/.test(token)) {
      return reply(400, 'invalid');
    }

    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const hash = Array.from(new Uint8Array(digest), byte =>
        byte.toString(16).padStart(2, '0')).join('');
      const approved = await approve({
        p_token_hash: hash,
        // No trusted client-IP contract is available here. Never accept body IP
        // or arbitrary forwarded headers as evidence of the parent's identity.
        p_ip: null,
        // Request metadata only, not identity proof; ignore JSON user_agent.
        p_user_agent: req.headers.get('user-agent')?.slice(0, 512) ?? null,
      });
      return approved === true ? reply(200, 'approved') : reply(409, 'invalid');
    } catch {
      // Never return tokens, hashes, profile data or provider/database errors.
      return reply(500, 'unavailable');
    }
  };
}
