import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const VALID_CATEGORIES = ['payment_premium', 'technical_problem', 'ai_tutor_analysis', 'account_login', 'parent_consent', 'other'];
const VALID_STATUSES = ['new', 'in_progress', 'resolved', 'closed'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[support-inbox] Missing env variables');
      return jsonResponse({ error: 'Internal config error' }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: requestingUser }, error: authError } = await userClient.auth.getUser();
    if (authError || !requestingUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const requestingEmail = requestingUser.email?.toLowerCase().trim() ?? '';
    const requestingUserId = requestingUser.id;

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (!action || typeof action !== 'string') {
      return jsonResponse({ error: 'Missing or invalid action' }, 400);
    }

    // Initialize adminClient early, but DO NOT USE for admin tasks without checking ADMIN_EMAILS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const adminEmailsEnv = Deno.env.get('ADMIN_EMAILS') ?? '';
    const adminEmails = adminEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminEmails.includes(requestingEmail);

    // ── 1. submit_ticket (User action) ──────────────────────────────────────────
    if (action === 'submit_ticket') {
      const { category, subject, message } = body;

      if (!VALID_CATEGORIES.includes(category)) {
        return jsonResponse({ error: 'Nieprawidłowa kategoria zgłoszenia' }, 400);
      }

      const safeSubject = typeof subject === 'string' ? subject.trim() : '';
      const safeMessage = typeof message === 'string' ? message.trim() : '';

      if (safeSubject.length < 5 || safeSubject.length > 120) {
        return jsonResponse({ error: 'Temat musi mieć od 5 do 120 znaków' }, 400);
      }
      if (safeMessage.length < 10 || safeMessage.length > 2000) {
        return jsonResponse({ error: 'Wiadomość musi mieć od 10 do 2000 znaków' }, 400);
      }

      // Check rate limit: max 3 tickets in last 24h
      const { count, error: countErr } = await adminClient
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', requestingUserId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (countErr) {
        return jsonResponse({ error: 'Błąd walidacji limitów.' }, 500);
      }

      if (count !== null && count >= 3) {
        return jsonResponse({ error: 'Osiągnięto dzienny limit zgłoszeń. Spróbuj ponownie później.' }, 429);
      }

      // Fetch snapshot using service role
      const { data: profile } = await adminClient
        .from('profiles')
        .select('plan, plan_expires_at, user_role')
        .eq('id', requestingUserId)
        .maybeSingle();

      const insertData = {
        user_id: requestingUserId,
        user_email_snapshot: requestingEmail,
        user_role_snapshot: profile?.user_role || null,
        plan_snapshot: profile?.plan || null,
        plan_expires_at_snapshot: profile?.plan_expires_at || null,
        category,
        subject: safeSubject,
        message: safeMessage,
        status: 'new'
      };

      const { data: ticket, error: insertErr } = await adminClient
        .from('support_tickets')
        .insert(insertData)
        .select('id')
        .single();

      if (insertErr) {
        console.error('[support-inbox] insert error:', insertErr.message);
        return jsonResponse({ error: 'Nie udało się zapisać zgłoszenia' }, 500);
      }

      // Send email via Resend
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');
      
      // Use SUPPORT_ADMIN_EMAILS if defined, fallback to ADMIN_EMAILS array (using first email or comma separated)
      const notifyEmailsEnv = Deno.env.get('SUPPORT_ADMIN_EMAILS') ?? adminEmailsEnv;
      const notifyEmails = notifyEmailsEnv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

      if (resendApiKey && resendFromEmail && notifyEmails.length > 0) {
        const today = new Date().toLocaleDateString('pl-PL');
        const emailContent = `
          <p><strong>Nowe zgłoszenie w OmniNauka</strong></p>
          <ul>
            <li><strong>ID Zgłoszenia:</strong> ${ticket.id}</li>
            <li><strong>Kategoria:</strong> ${category}</li>
            <li><strong>Data:</strong> ${today}</li>
          </ul>
          <p>Zaloguj się do panelu administratora, aby zobaczyć szczegóły (nie przesyłamy treści ze względów bezpieczeństwa).</p>
        `;

        // We do a best-effort send
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: notifyEmails,
            subject: `[OmniNauka Support] Nowe zgłoszenie: ${category}`,
            html: emailContent,
          }),
        }).catch(err => {
          console.log('[support-inbox] Resend notification failed (non-fatal):', err.message);
        });
      }

      return jsonResponse({ success: true, ticketId: ticket.id });
    }

    // ── Admin Actions ──────────────────────────────────────────────────────────
    if (!isAdmin) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    if (action === 'count_new_tickets') {
      const { count, error } = await adminClient
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');

      if (error) {
        console.error('[support-inbox] count_new_tickets error:', error.message);
        return jsonResponse({ error: 'Błąd pobierania liczby nowych zgłoszeń' }, 500);
      }

      return jsonResponse({ count: count ?? 0 });
    }

    if (action === 'list_tickets') {
      const { status } = body;
      
      let query = adminClient
        .from('support_tickets')
        .select('id, created_at, user_email_snapshot, plan_snapshot, category, subject, status, handled_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (status && VALID_STATUSES.includes(status)) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('[support-inbox] list_tickets error:', error.message);
        return jsonResponse({ error: 'Błąd pobierania listy' }, 500);
      }

      return jsonResponse({ tickets: data ?? [] });
    }

    if (action === 'get_ticket_details') {
      const { ticketId } = body;
      if (!ticketId || typeof ticketId !== 'string') {
        return jsonResponse({ error: 'Brak ticketId' }, 400);
      }

      const { data, error } = await adminClient
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (error || !data) {
        return jsonResponse({ error: 'Nie znaleziono zgłoszenia' }, 404);
      }

      return jsonResponse({ ticket: data });
    }

    if (action === 'update_ticket') {
      const { ticketId, status, admin_note } = body;
      if (!ticketId || typeof ticketId !== 'string') {
        return jsonResponse({ error: 'Brak ticketId' }, 400);
      }
      if (status && !VALID_STATUSES.includes(status)) {
        return jsonResponse({ error: 'Nieprawidłowy status' }, 400);
      }
      
      const safeAdminNote = typeof admin_note === 'string' ? admin_note.trim().substring(0, 1000) : undefined;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (safeAdminNote !== undefined) updateData.admin_note = safeAdminNote;

      if (status === 'resolved' || status === 'closed') {
        updateData.handled_at = new Date().toISOString();
        updateData.handled_by = requestingEmail;
      } else if (status === 'new' || status === 'in_progress') {
        // Option chosen for MVP: clear handled_at if reverted, keep handled_by as last actor
        updateData.handled_at = null;
        updateData.handled_by = requestingEmail; 
      }

      const { data, error } = await adminClient
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('[support-inbox] update_ticket error:', error.message);
        return jsonResponse({ error: 'Błąd aktualizacji' }, 500);
      }

      return jsonResponse({ success: true, ticket: data });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[support-inbox] Unhandled error:', message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
