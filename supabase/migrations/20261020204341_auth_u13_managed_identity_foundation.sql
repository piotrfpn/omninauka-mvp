-- AUTH-U13.3A: dormant planning records only. No Auth calls, hooks or activation.
-- A later reviewed migration must explicitly unlock binding and execution.
BEGIN;

-- Deliberately fail on an existing schema rather than adopting unknown objects.
CREATE SCHEMA managed_child_private AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA managed_child_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA managed_child_private TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA managed_child_private
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA managed_child_private
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE managed_child_private.identities (
  id uuid PRIMARY KEY,
  parent_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  child_profile_id uuid NOT NULL UNIQUE REFERENCES public.child_profiles(id) ON DELETE RESTRICT,
  -- No FK for a reserved UUID: the Auth user does not exist yet.
  reserved_auth_user_id uuid NOT NULL UNIQUE,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  login_code text NOT NULL UNIQUE CHECK (login_code ~ '^[23456789abcdefghjklmnpqrstuvwxyz]{12}$'),
  namespace text NOT NULL CHECK (
    length(namespace) <= 253 AND
    namespace ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+\.[a-z]{2,63}$'
  ),
  login_identifier text GENERATED ALWAYS AS (
    'UCZEN-' || upper(substr(login_code, 1, 4)) || '-' ||
    upper(substr(login_code, 5, 4)) || '-' || upper(substr(login_code, 9, 4))
  ) STORED,
  technical_email text GENERATED ALWAYS AS ('u-' || login_code || '@' || namespace) STORED UNIQUE,
  lifecycle_state text NOT NULL DEFAULT 'reserved' CHECK (lifecycle_state IN ('reserved', 'cancelled')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  CONSTRAINT managed_child_no_auth_binding_yet CHECK (auth_user_id IS NULL),
  CONSTRAINT managed_child_auth_uuid_matches CHECK (auth_user_id IS NULL OR auth_user_id = reserved_auth_user_id),
  CONSTRAINT managed_child_parent_not_child CHECK (parent_user_id <> reserved_auth_user_id),
  CONSTRAINT managed_child_cancelled_clock CHECK ((lifecycle_state = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT managed_child_identity_owner UNIQUE (id, parent_user_id)
);

CREATE TABLE managed_child_private.operations (
  id uuid PRIMARY KEY,
  identity_id uuid NOT NULL,
  parent_user_id uuid NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('provision', 'recover', 'delete')),
  -- Backend-generated opaque UUID, never a request body or credential digest.
  idempotency_key uuid NOT NULL,
  processing_phase text NOT NULL DEFAULT 'planned' CHECK (processing_phase IN ('planned', 'cancelled')),
  execution_version bigint NOT NULL DEFAULT 0 CHECK (execution_version >= 0),
  safe_error_category text CHECK (safe_error_category IN ('cancelled_by_parent', 'reservation_expired', 'provisioning_blocked')),
  finalization_status text NOT NULL DEFAULT 'pending' CHECK (finalization_status IN ('pending', 'cancelled')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  finalized_at timestamptz,
  CONSTRAINT managed_child_operation_owner FOREIGN KEY (identity_id, parent_user_id)
    REFERENCES managed_child_private.identities(id, parent_user_id) ON DELETE RESTRICT,
  CONSTRAINT managed_child_operation_idempotency UNIQUE (parent_user_id, operation_type, idempotency_key),
  CONSTRAINT managed_child_operation_finalization CHECK (
    (processing_phase = 'planned' AND finalization_status = 'pending' AND finalized_at IS NULL AND safe_error_category IS NULL)
    OR (processing_phase = 'cancelled' AND finalization_status = 'cancelled' AND finalized_at IS NOT NULL AND safe_error_category IS NOT NULL)
  )
);
CREATE UNIQUE INDEX managed_child_one_pending_operation
  ON managed_child_private.operations(identity_id) WHERE finalization_status = 'pending';

ALTER TABLE managed_child_private.identities OWNER TO postgres;
ALTER TABLE managed_child_private.operations OWNER TO postgres;

-- No policies: ordinary roles are denied by both ACL and RLS. The trusted
-- service_role bypasses RLS, but only receives the explicit DML grants below.
ALTER TABLE managed_child_private.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_child_private.identities FORCE ROW LEVEL SECURITY;
ALTER TABLE managed_child_private.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_child_private.operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE managed_child_private.identities, managed_child_private.operations
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE managed_child_private.identities, managed_child_private.operations TO service_role;

CREATE FUNCTION managed_child_private.guard_identity_foundation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.lifecycle_state IS DISTINCT FROM 'reserved' OR NEW.auth_user_id IS NOT NULL
       OR NEW.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Managed child foundation is dormant' USING ERRCODE = '42501';
    END IF;
    -- Relation ownership is checked by UUID, never by matching emails. This is
    -- a planning precondition, not a grant of parental or educational access.
    PERFORM 1 FROM public.profiles p
      JOIN auth.users a ON a.id = p.id
      JOIN public.child_profiles cp ON cp.id = NEW.child_profile_id AND cp.parent_user_id = p.id
      WHERE p.id = NEW.parent_user_id AND p.user_role = 'parent' AND p.account_status = 'active'
        AND a.email_confirmed_at IS NOT NULL
        AND cp.status = 'pending_child_registration' AND cp.child_user_id IS NULL
        AND cp.preapproval_integrity_version = 1 AND cp.guardian_consent_acknowledged_at IS NOT NULL
        AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      FOR SHARE OF p, cp;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Managed child reservation not permitted' USING ERRCODE = '42501';
    END IF;
    -- Caller-supplied IDs and timestamps cannot select an existing Auth child.
    NEW.id := pg_catalog.gen_random_uuid();
    NEW.reserved_auth_user_id := pg_catalog.gen_random_uuid();
    NEW.created_at := pg_catalog.clock_timestamp();
    NEW.updated_at := NEW.created_at;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['login_identifier', 'technical_email', 'lifecycle_state', 'updated_at', 'cancelled_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['login_identifier', 'technical_email', 'lifecycle_state', 'updated_at', 'cancelled_at'])
       OR OLD.lifecycle_state <> 'reserved' OR NEW.lifecycle_state <> 'cancelled' THEN
      RAISE EXCEPTION 'Managed child identity is immutable' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := pg_catalog.clock_timestamp();
    NEW.cancelled_at := NEW.updated_at;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION managed_child_private.guard_operation_foundation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.processing_phase IS DISTINCT FROM 'planned' OR NEW.finalization_status IS DISTINCT FROM 'pending'
       OR NEW.execution_version IS DISTINCT FROM 0 OR NEW.safe_error_category IS NOT NULL OR NEW.finalized_at IS NOT NULL THEN
      RAISE EXCEPTION 'Managed child execution is disabled' USING ERRCODE = '42501';
    END IF;
    PERFORM 1 FROM managed_child_private.identities i
      WHERE i.id = NEW.identity_id AND i.parent_user_id = NEW.parent_user_id AND i.lifecycle_state = 'reserved'
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Managed child operation not permitted' USING ERRCODE = '42501';
    END IF;
    NEW.id := pg_catalog.gen_random_uuid();
    NEW.created_at := pg_catalog.clock_timestamp();
    NEW.updated_at := NEW.created_at;
  ELSE
    IF (to_jsonb(NEW) - ARRAY['processing_phase', 'finalization_status', 'execution_version', 'safe_error_category', 'updated_at', 'finalized_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['processing_phase', 'finalization_status', 'execution_version', 'safe_error_category', 'updated_at', 'finalized_at'])
       OR OLD.processing_phase <> 'planned' OR NEW.processing_phase <> 'cancelled' THEN
      RAISE EXCEPTION 'Managed child operation is immutable' USING ERRCODE = '42501';
    END IF;
    NEW.execution_version := OLD.execution_version + 1;
    NEW.finalization_status := 'cancelled';
    NEW.updated_at := pg_catalog.clock_timestamp();
    NEW.finalized_at := NEW.updated_at;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION managed_child_private.guard_identity_foundation() OWNER TO postgres;
ALTER FUNCTION managed_child_private.guard_operation_foundation() OWNER TO postgres;
REVOKE ALL ON FUNCTION managed_child_private.guard_identity_foundation(), managed_child_private.guard_operation_foundation()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER managed_child_identity_foundation BEFORE INSERT OR UPDATE ON managed_child_private.identities
  FOR EACH ROW EXECUTE FUNCTION managed_child_private.guard_identity_foundation();
CREATE TRIGGER managed_child_operation_foundation BEFORE INSERT OR UPDATE ON managed_child_private.operations
  FOR EACH ROW EXECUTE FUNCTION managed_child_private.guard_operation_foundation();

COMMENT ON SCHEMA managed_child_private IS 'AUTH-U13.3A: private dormant reservations. Never expose via PostgREST; not parental authorization.';
COMMENT ON TABLE managed_child_private.identities IS 'No active state or Auth binding in this foundation. UUID reservations do not grant access.';
COMMENT ON TABLE managed_child_private.operations IS 'Planning/cancellation only. No payloads or credentials. Execution, leases and recovery require a later reviewed sprint.';
COMMIT;
