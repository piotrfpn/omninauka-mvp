/** Account authorization is based on the database, never signup metadata. */
interface ProfileResult {
  data: unknown;
  error: unknown;
}

export async function getAiAccountDenial(
  profileQuery: PromiseLike<ProfileResult>,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  try {
    const { data, error } = await profileQuery;

    if (!error && data && typeof data === 'object' && 'account_status' in data &&
      (data.account_status === 'active' || data.account_status === 'parent_approved')) {
      return null;
    }
  } catch {
    // Missing profiles, transport failures and unknown statuses all fail closed.
  }

  return new Response(JSON.stringify({ error: 'account_access_denied' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
