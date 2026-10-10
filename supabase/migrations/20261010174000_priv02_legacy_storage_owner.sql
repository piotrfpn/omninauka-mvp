-- PRIV-02B.2B.2C-V1.1: backend-only lookup of Storage object ownership.
-- Used by delete-session to fail closed before physically removing legacy objects.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_storage_object_owner(p_bucket_id text, p_name text)
RETURNS TABLE (owner_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.owner_id::text
  FROM storage.objects AS o
  WHERE o.bucket_id = p_bucket_id
    AND o.name = p_name;
$$;

REVOKE ALL ON FUNCTION public.get_storage_object_owner(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storage_object_owner(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.get_storage_object_owner(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_object_owner(text, text) TO service_role;

COMMIT;
