-- OmniNauka Strategy C: reviewed current canonical application state BEFORE PRIV-02.
-- Catalog source: production read-only evidence, 2026-10-10, source HEAD d66564f.
-- Fresh initialized Supabase database only. Do NOT execute on existing production.
-- No user data, historical backfills, storage objects, Vault values or HTTP schedules.
-- Runtime C0/C1 verification is mandatory and PENDING (MIG-HIST-01D.2).
BEGIN;
SET LOCAL search_path = public, extensions;

DO $bootstrap_preflight$
DECLARE missing_role text;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Canonical bootstrap requires the trusted postgres migration role';
  END IF;
  IF current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'Canonical ACLs require PostgreSQL 17 or newer';
  END IF;
  SELECT r INTO missing_role FROM unnest(ARRAY['postgres','anon','authenticated',
    'service_role','supabase_admin','dashboard_user','pg_database_owner']) r
    WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) LIMIT 1;
  IF missing_role IS NOT NULL THEN
    RAISE EXCEPTION 'Initialize the Supabase platform before application bootstrap';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regclass('storage.objects') IS NULL
    OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Supabase-managed Auth and Storage schemas are prerequisites';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'storage.objects'::regclass
    AND relrowsecurity AND NOT relforcerowsecurity) THEN
    RAISE EXCEPTION 'Storage objects must retain the platform RLS configuration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname = ANY (ARRAY['profiles','study_sessions','session_images','folders','tutor_threads','tutor_messages','parental_consents','child_profiles','usage_events','admin_plan_actions','payment_events','support_tickets','under13_parent_notifications'])) THEN
    RAISE EXCEPTION 'Existing application schema: baseline SQL MUST NOT be replayed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND NOT rolbypassrls AND NOT rolsuper)
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls) THEN
    RAISE EXCEPTION 'Unexpected Supabase role/RLS configuration';
  END IF;
END;
$bootstrap_preflight$;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- BEGIN CANONICAL SCHEMA_ACL extensions
ALTER SCHEMA "extensions" OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON SCHEMA "extensions" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "dashboard_user";
GRANT CREATE, USAGE ON SCHEMA "extensions" TO "postgres";
GRANT USAGE ON SCHEMA "extensions" TO "anon";
GRANT USAGE ON SCHEMA "extensions" TO "authenticated";
GRANT USAGE ON SCHEMA "extensions" TO "service_role";
GRANT CREATE, USAGE ON SCHEMA "extensions" TO "dashboard_user";
-- END CANONICAL SCHEMA_ACL extensions

-- BEGIN CANONICAL SCHEMA_ACL public
ALTER SCHEMA "public" OWNER TO "pg_database_owner";
REVOKE ALL PRIVILEGES ON SCHEMA "public" FROM PUBLIC, "anon", "authenticated", "service_role", "postgres", "dashboard_user", "pg_database_owner";
GRANT USAGE ON SCHEMA "public" TO PUBLIC;
GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";
GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
-- END CANONICAL SCHEMA_ACL public

-- BEGIN CANONICAL TABLE admin_plan_actions
CREATE TABLE public."admin_plan_actions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "admin_user_id" uuid,
  "admin_email" text NOT NULL,
  "target_user_id" uuid,
  "target_email" text NOT NULL,
  "action_type" text NOT NULL,
  "old_plan" text,
  "new_plan" text,
  "old_plan_expires_at" timestamp with time zone,
  "new_plan_expires_at" timestamp with time zone,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."admin_plan_actions" OWNER TO "postgres";
-- END CANONICAL TABLE admin_plan_actions

-- BEGIN CANONICAL TABLE child_profiles
CREATE TABLE public."child_profiles" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "parent_user_id" uuid NOT NULL,
  "display_name" text NOT NULL,
  "age_band" text NOT NULL,
  "school_type" text,
  "education_level" text,
  "grade_level" text,
  "status" text DEFAULT 'pending_child_registration'::text NOT NULL,
  "guardian_consent_acknowledged_at" timestamp with time zone,
  "guardian_consent_version" text DEFAULT 'child_email_preapproval_v1'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "child_user_id" uuid,
  "child_email" text,
  "child_email_normalized" text,
  "preapproval_integrity_version" integer DEFAULT 0 NOT NULL
);
ALTER TABLE public."child_profiles" OWNER TO "postgres";
-- END CANONICAL TABLE child_profiles

-- BEGIN CANONICAL TABLE folders
CREATE TABLE public."folders" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "parent_id" uuid,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."folders" OWNER TO "postgres";
-- END CANONICAL TABLE folders

-- BEGIN CANONICAL TABLE parental_consents
CREATE TABLE public."parental_consents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_user_id" uuid NOT NULL,
  "parent_email" text NOT NULL,
  "age_band" text NOT NULL,
  "consent_status" text DEFAULT 'pending'::text NOT NULL,
  "consent_scope" jsonb DEFAULT '{"ai_tutor": true, "ocr_analyze": true, "study_history": true}'::jsonb,
  "terms_version" text DEFAULT 'REGULAMIN_v01'::text,
  "privacy_version" text DEFAULT 'POLITYKA_PRYWATNOSCI_RODO_v01'::text,
  "ai_disclaimer_version" text DEFAULT 'AI_DISCLAIMER_v01'::text,
  "token_hash" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "consent_created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "consent_approved_at" timestamp with time zone,
  "consent_withdrawn_at" timestamp with time zone,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "last_email_sent_at" timestamp with time zone,
  "email_send_count" integer DEFAULT 0,
  "email_last_status" text,
  "email_last_error" text
);
ALTER TABLE public."parental_consents" OWNER TO "postgres";
-- END CANONICAL TABLE parental_consents

-- BEGIN CANONICAL TABLE payment_events
CREATE TABLE public."payment_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "stripe_event_id" text NOT NULL,
  "stripe_session_id" text,
  "stripe_payment_link_id" text,
  "user_id" uuid,
  "event_type" text NOT NULL,
  "status" text NOT NULL,
  "target_plan" text,
  "amount_total" bigint,
  "currency" text,
  "payment_status" text,
  "error_message" text,
  "payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "updated_at" timestamp with time zone
);
ALTER TABLE public."payment_events" OWNER TO "postgres";
-- END CANONICAL TABLE payment_events

-- BEGIN CANONICAL TABLE profiles
CREATE TABLE public."profiles" (
  "id" uuid NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "plan" text DEFAULT 'free'::text,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "age_band" text,
  "account_status" text DEFAULT 'active'::text,
  "user_role" text,
  "school_type" text,
  "education_level" text,
  "grade_level" text,
  "postal_code" text,
  "profile_completed" boolean DEFAULT false,
  "profile_completed_at" timestamp with time zone,
  "pending_preapproval_since" timestamp with time zone,
  "plan_expires_at" timestamp with time zone,
  "plan_updated_at" timestamp with time zone
);
ALTER TABLE public."profiles" OWNER TO "postgres";
-- END CANONICAL TABLE profiles

-- BEGIN CANONICAL TABLE session_images
CREATE TABLE public."session_images" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "image_url" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."session_images" OWNER TO "postgres";
-- END CANONICAL TABLE session_images

-- BEGIN CANONICAL TABLE study_sessions
CREATE TABLE public."study_sessions" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "image_url" text NOT NULL,
  "raw_ocr_text" text,
  "subject" text,
  "topic" text,
  "confidence" numeric,
  "summary" text,
  "key_concepts" jsonb DEFAULT '[]'::jsonb,
  "flashcards" jsonb DEFAULT '[]'::jsonb,
  "quiz_questions" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "lesson_title" text,
  "deleted_at" timestamp with time zone,
  "folder_id" uuid,
  "updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()),
  "quiz_result" jsonb,
  "flashcard_progress" jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE public."study_sessions" OWNER TO "postgres";
-- END CANONICAL TABLE study_sessions

-- BEGIN CANONICAL TABLE support_tickets
CREATE TABLE public."support_tickets" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "user_email_snapshot" text NOT NULL,
  "user_role_snapshot" text,
  "plan_snapshot" text,
  "plan_expires_at_snapshot" timestamp with time zone,
  "category" text NOT NULL,
  "subject" text NOT NULL,
  "message" text NOT NULL,
  "status" text DEFAULT 'new'::text NOT NULL,
  "admin_note" text,
  "handled_by" text,
  "handled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."support_tickets" OWNER TO "postgres";
-- END CANONICAL TABLE support_tickets

-- BEGIN CANONICAL TABLE tutor_messages
CREATE TABLE public."tutor_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public."tutor_messages" OWNER TO "postgres";
-- END CANONICAL TABLE tutor_messages

-- BEGIN CANONICAL TABLE tutor_threads
CREATE TABLE public."tutor_threads" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "context_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "snapshot_updated_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public."tutor_threads" OWNER TO "postgres";
-- END CANONICAL TABLE tutor_threads

-- BEGIN CANONICAL TABLE under13_parent_notifications
CREATE TABLE public."under13_parent_notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "child_user_id" uuid NOT NULL,
  "parent_user_id" uuid NOT NULL,
  "child_profile_id" uuid NOT NULL,
  "notification_kind" text DEFAULT 'd5_preapproval_reminder'::text NOT NULL,
  "status" text DEFAULT 'pending'::text NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "claim_token" uuid,
  "lease_expires_at" timestamp with time zone,
  "first_attempt_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "next_attempt_at" timestamp with time zone,
  "provider_accepted_at" timestamp with time zone,
  "recipient_email_hash" text,
  "payload_hash" text,
  "retention_deadline_at" timestamp with time zone NOT NULL,
  "idempotency_key" text DEFAULT (gen_random_uuid())::text NOT NULL,
  "safe_error_category" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."under13_parent_notifications" OWNER TO "postgres";
-- END CANONICAL TABLE under13_parent_notifications

-- BEGIN CANONICAL TABLE usage_events
CREATE TABLE public."usage_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "session_id" uuid,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public."usage_events" OWNER TO "postgres";
-- END CANONICAL TABLE usage_events

-- BEGIN CANONICAL CONSTRAINT admin_plan_actions_pkey
ALTER TABLE public."admin_plan_actions" ADD CONSTRAINT "admin_plan_actions_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT admin_plan_actions_pkey

-- BEGIN CANONICAL CONSTRAINT reason_max_length
ALTER TABLE public."admin_plan_actions" ADD CONSTRAINT "reason_max_length" CHECK (((reason IS NULL) OR (char_length(reason) <= 500)));
-- END CANONICAL CONSTRAINT reason_max_length

-- BEGIN CANONICAL CONSTRAINT valid_action_type
ALTER TABLE public."admin_plan_actions" ADD CONSTRAINT "valid_action_type" CHECK ((action_type = ANY (ARRAY['activate_premium_30'::text, 'extend_premium_30'::text, 'activate_family_30'::text, 'set_free'::text])));
-- END CANONICAL CONSTRAINT valid_action_type

-- BEGIN CANONICAL CONSTRAINT valid_new_plan
ALTER TABLE public."admin_plan_actions" ADD CONSTRAINT "valid_new_plan" CHECK (((new_plan IS NULL) OR (new_plan = ANY (ARRAY['free'::text, 'premium'::text, 'family'::text]))));
-- END CANONICAL CONSTRAINT valid_new_plan

-- BEGIN CANONICAL CONSTRAINT valid_old_plan
ALTER TABLE public."admin_plan_actions" ADD CONSTRAINT "valid_old_plan" CHECK (((old_plan IS NULL) OR (old_plan = ANY (ARRAY['free'::text, 'premium'::text, 'family'::text]))));
-- END CANONICAL CONSTRAINT valid_old_plan

-- BEGIN CANONICAL CONSTRAINT child_profiles_age_band_check
ALTER TABLE public."child_profiles" ADD CONSTRAINT "child_profiles_age_band_check" CHECK ((age_band = ANY (ARRAY['7_9'::text, '10_12'::text])));
-- END CANONICAL CONSTRAINT child_profiles_age_band_check

-- BEGIN CANONICAL CONSTRAINT child_profiles_integrity_version_check
ALTER TABLE public."child_profiles" ADD CONSTRAINT "child_profiles_integrity_version_check" CHECK ((preapproval_integrity_version = ANY (ARRAY[0, 1])));
-- END CANONICAL CONSTRAINT child_profiles_integrity_version_check

-- BEGIN CANONICAL CONSTRAINT child_profiles_pkey
ALTER TABLE public."child_profiles" ADD CONSTRAINT "child_profiles_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT child_profiles_pkey

-- BEGIN CANONICAL CONSTRAINT child_profiles_status_check
ALTER TABLE public."child_profiles" ADD CONSTRAINT "child_profiles_status_check" CHECK ((status = ANY (ARRAY['pending_child_registration'::text, 'linked'::text, 'active'::text, 'archived'::text])));
-- END CANONICAL CONSTRAINT child_profiles_status_check

-- BEGIN CANONICAL CONSTRAINT folders_pkey
ALTER TABLE public."folders" ADD CONSTRAINT "folders_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT folders_pkey

-- BEGIN CANONICAL CONSTRAINT parental_consents_child_user_id_key
ALTER TABLE public."parental_consents" ADD CONSTRAINT "parental_consents_child_user_id_key" UNIQUE (child_user_id);
-- END CANONICAL CONSTRAINT parental_consents_child_user_id_key

-- BEGIN CANONICAL CONSTRAINT parental_consents_pkey
ALTER TABLE public."parental_consents" ADD CONSTRAINT "parental_consents_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT parental_consents_pkey

-- BEGIN CANONICAL CONSTRAINT payment_events_pkey
ALTER TABLE public."payment_events" ADD CONSTRAINT "payment_events_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT payment_events_pkey

-- BEGIN CANONICAL CONSTRAINT payment_events_status_check
ALTER TABLE public."payment_events" ADD CONSTRAINT "payment_events_status_check" CHECK ((status = ANY (ARRAY['processing'::text, 'processed'::text, 'ignored'::text, 'error'::text])));
-- END CANONICAL CONSTRAINT payment_events_status_check

-- BEGIN CANONICAL CONSTRAINT payment_events_stripe_event_id_key
ALTER TABLE public."payment_events" ADD CONSTRAINT "payment_events_stripe_event_id_key" UNIQUE (stripe_event_id);
-- END CANONICAL CONSTRAINT payment_events_stripe_event_id_key

-- BEGIN CANONICAL CONSTRAINT payment_events_target_plan_check
ALTER TABLE public."payment_events" ADD CONSTRAINT "payment_events_target_plan_check" CHECK (((target_plan IS NULL) OR (target_plan = ANY (ARRAY['premium'::text, 'family'::text, 'free'::text]))));
-- END CANONICAL CONSTRAINT payment_events_target_plan_check

-- BEGIN CANONICAL CONSTRAINT profiles_pkey
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT profiles_pkey

-- BEGIN CANONICAL CONSTRAINT profiles_plan_check
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'premium'::text, 'family'::text])));
-- END CANONICAL CONSTRAINT profiles_plan_check

-- BEGIN CANONICAL CONSTRAINT session_images_pkey
ALTER TABLE public."session_images" ADD CONSTRAINT "session_images_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT session_images_pkey

-- BEGIN CANONICAL CONSTRAINT study_sessions_pkey
ALTER TABLE public."study_sessions" ADD CONSTRAINT "study_sessions_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT study_sessions_pkey

-- BEGIN CANONICAL CONSTRAINT support_tickets_pkey
ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT support_tickets_pkey

-- BEGIN CANONICAL CONSTRAINT valid_category
ALTER TABLE public."support_tickets" ADD CONSTRAINT "valid_category" CHECK ((category = ANY (ARRAY['payment_premium'::text, 'technical_problem'::text, 'ai_tutor_analysis'::text, 'account_login'::text, 'parent_consent'::text, 'other'::text])));
-- END CANONICAL CONSTRAINT valid_category

-- BEGIN CANONICAL CONSTRAINT valid_message_length
ALTER TABLE public."support_tickets" ADD CONSTRAINT "valid_message_length" CHECK (((char_length(TRIM(BOTH FROM message)) >= 10) AND (char_length(TRIM(BOTH FROM message)) <= 2000)));
-- END CANONICAL CONSTRAINT valid_message_length

-- BEGIN CANONICAL CONSTRAINT valid_status
ALTER TABLE public."support_tickets" ADD CONSTRAINT "valid_status" CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])));
-- END CANONICAL CONSTRAINT valid_status

-- BEGIN CANONICAL CONSTRAINT valid_subject_length
ALTER TABLE public."support_tickets" ADD CONSTRAINT "valid_subject_length" CHECK (((char_length(TRIM(BOTH FROM subject)) >= 5) AND (char_length(TRIM(BOTH FROM subject)) <= 120)));
-- END CANONICAL CONSTRAINT valid_subject_length

-- BEGIN CANONICAL CONSTRAINT tutor_messages_pkey
ALTER TABLE public."tutor_messages" ADD CONSTRAINT "tutor_messages_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT tutor_messages_pkey

-- BEGIN CANONICAL CONSTRAINT tutor_messages_role_check
ALTER TABLE public."tutor_messages" ADD CONSTRAINT "tutor_messages_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));
-- END CANONICAL CONSTRAINT tutor_messages_role_check

-- BEGIN CANONICAL CONSTRAINT tutor_threads_pkey
ALTER TABLE public."tutor_threads" ADD CONSTRAINT "tutor_threads_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT tutor_threads_pkey

-- BEGIN CANONICAL CONSTRAINT unique_session_thread
ALTER TABLE public."tutor_threads" ADD CONSTRAINT "unique_session_thread" UNIQUE (session_id);
-- END CANONICAL CONSTRAINT unique_session_thread

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_attempt_count_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_attempt_count_check" CHECK (((attempt_count >= 0) AND (attempt_count <= 3)));
-- END CANONICAL CONSTRAINT under13_parent_notifications_attempt_count_check

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_check" CHECK ((((status = 'claimed'::text) AND (claim_token IS NOT NULL) AND (lease_expires_at IS NOT NULL)) OR ((status <> 'claimed'::text) AND (claim_token IS NULL) AND (lease_expires_at IS NULL))));
-- END CANONICAL CONSTRAINT under13_parent_notifications_check

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_check1
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_check1" CHECK ((((attempt_count = 0) AND (first_attempt_at IS NULL) AND (last_attempt_at IS NULL)) OR ((attempt_count > 0) AND (first_attempt_at IS NOT NULL) AND (last_attempt_at IS NOT NULL))));
-- END CANONICAL CONSTRAINT under13_parent_notifications_check1

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_check2
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_check2" CHECK (((recipient_email_hash IS NULL) = (payload_hash IS NULL)));
-- END CANONICAL CONSTRAINT under13_parent_notifications_check2

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_check3
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_check3" CHECK (((attempt_count = 0) OR (recipient_email_hash IS NOT NULL)));
-- END CANONICAL CONSTRAINT under13_parent_notifications_check3

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_check4
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_check4" CHECK (((status <> 'accepted'::text) OR ((provider_accepted_at IS NOT NULL) AND (attempt_count > 0))));
-- END CANONICAL CONSTRAINT under13_parent_notifications_check4

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_child_user_id_notification_kin_key
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_child_user_id_notification_kin_key" UNIQUE (child_user_id, notification_kind);
-- END CANONICAL CONSTRAINT under13_parent_notifications_child_user_id_notification_kin_key

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_idempotency_key_key
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_idempotency_key_key" UNIQUE (idempotency_key);
-- END CANONICAL CONSTRAINT under13_parent_notifications_idempotency_key_key

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_notification_kind_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_notification_kind_check" CHECK ((notification_kind = 'd5_preapproval_reminder'::text));
-- END CANONICAL CONSTRAINT under13_parent_notifications_notification_kind_check

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_payload_hash_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_payload_hash_check" CHECK ((payload_hash ~ '^[0-9a-f]{64}$'::text));
-- END CANONICAL CONSTRAINT under13_parent_notifications_payload_hash_check

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_pkey
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT under13_parent_notifications_pkey

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_recipient_email_hash_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_recipient_email_hash_check" CHECK ((recipient_email_hash ~ '^[0-9a-f]{64}$'::text));
-- END CANONICAL CONSTRAINT under13_parent_notifications_recipient_email_hash_check

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_safe_error_category_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_safe_error_category_check" CHECK ((safe_error_category = ANY (ARRAY['relationship_no_longer_valid'::text, 'recipient_changed'::text, 'payload_changed'::text, 'parent_email_unconfirmed'::text, 'parent_unavailable'::text, 'parent_lookup_failed'::text, 'deadline_passed'::text, 'retry_window_exhausted'::text, 'provider_rate_limited'::text, 'provider_5xx'::text, 'provider_timeout'::text, 'provider_conflict'::text, 'invalid_recipient'::text, 'provider_auth_or_config'::text, 'provider_rejected'::text])));
-- END CANONICAL CONSTRAINT under13_parent_notifications_safe_error_category_check

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_status_check
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'claimed'::text, 'retryable'::text, 'accepted'::text, 'cancelled'::text, 'terminal_error'::text, 'delivery_unknown'::text])));
-- END CANONICAL CONSTRAINT under13_parent_notifications_status_check

-- BEGIN CANONICAL CONSTRAINT usage_events_pkey
ALTER TABLE public."usage_events" ADD CONSTRAINT "usage_events_pkey" PRIMARY KEY (id);
-- END CANONICAL CONSTRAINT usage_events_pkey

-- BEGIN CANONICAL CONSTRAINT valid_event_type
ALTER TABLE public."usage_events" ADD CONSTRAINT "valid_event_type" CHECK ((event_type = ANY (ARRAY['lesson_analysis'::text, 'flashcard_regen'::text, 'tutor_message'::text, 'quiz_regen'::text])));
-- END CANONICAL CONSTRAINT valid_event_type

-- BEGIN CANONICAL CONSTRAINT admin_plan_actions_target_user_id_fkey
ALTER TABLE public."admin_plan_actions" ADD CONSTRAINT "admin_plan_actions_target_user_id_fkey" FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- END CANONICAL CONSTRAINT admin_plan_actions_target_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT child_profiles_child_user_id_fkey
ALTER TABLE public."child_profiles" ADD CONSTRAINT "child_profiles_child_user_id_fkey" FOREIGN KEY (child_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- END CANONICAL CONSTRAINT child_profiles_child_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT child_profiles_parent_user_id_fkey
ALTER TABLE public."child_profiles" ADD CONSTRAINT "child_profiles_parent_user_id_fkey" FOREIGN KEY (parent_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT child_profiles_parent_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT folders_parent_id_fkey
ALTER TABLE public."folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT folders_parent_id_fkey

-- BEGIN CANONICAL CONSTRAINT folders_user_id_fkey
ALTER TABLE public."folders" ADD CONSTRAINT "folders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT folders_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT parental_consents_child_user_id_fkey
ALTER TABLE public."parental_consents" ADD CONSTRAINT "parental_consents_child_user_id_fkey" FOREIGN KEY (child_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT parental_consents_child_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT payment_events_user_id_fkey
ALTER TABLE public."payment_events" ADD CONSTRAINT "payment_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
-- END CANONICAL CONSTRAINT payment_events_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT profiles_id_fkey
ALTER TABLE public."profiles" ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT profiles_id_fkey

-- BEGIN CANONICAL CONSTRAINT session_images_session_id_fkey
ALTER TABLE public."session_images" ADD CONSTRAINT "session_images_session_id_fkey" FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT session_images_session_id_fkey

-- BEGIN CANONICAL CONSTRAINT study_sessions_folder_id_fkey
ALTER TABLE public."study_sessions" ADD CONSTRAINT "study_sessions_folder_id_fkey" FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL;
-- END CANONICAL CONSTRAINT study_sessions_folder_id_fkey

-- BEGIN CANONICAL CONSTRAINT study_sessions_user_id_fkey
ALTER TABLE public."study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT study_sessions_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT support_tickets_user_id_fkey
ALTER TABLE public."support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT support_tickets_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT tutor_messages_thread_id_fkey
ALTER TABLE public."tutor_messages" ADD CONSTRAINT "tutor_messages_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES tutor_threads(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT tutor_messages_thread_id_fkey

-- BEGIN CANONICAL CONSTRAINT tutor_messages_user_id_fkey
ALTER TABLE public."tutor_messages" ADD CONSTRAINT "tutor_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT tutor_messages_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT tutor_threads_session_id_fkey
ALTER TABLE public."tutor_threads" ADD CONSTRAINT "tutor_threads_session_id_fkey" FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT tutor_threads_session_id_fkey

-- BEGIN CANONICAL CONSTRAINT tutor_threads_user_id_fkey
ALTER TABLE public."tutor_threads" ADD CONSTRAINT "tutor_threads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT tutor_threads_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT under13_parent_notifications_child_user_id_fkey
ALTER TABLE public."under13_parent_notifications" ADD CONSTRAINT "under13_parent_notifications_child_user_id_fkey" FOREIGN KEY (child_user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT under13_parent_notifications_child_user_id_fkey

-- BEGIN CANONICAL CONSTRAINT usage_events_session_id_fkey
ALTER TABLE public."usage_events" ADD CONSTRAINT "usage_events_session_id_fkey" FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE SET NULL;
-- END CANONICAL CONSTRAINT usage_events_session_id_fkey

-- BEGIN CANONICAL CONSTRAINT usage_events_user_id_fkey
ALTER TABLE public."usage_events" ADD CONSTRAINT "usage_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
-- END CANONICAL CONSTRAINT usage_events_user_id_fkey

-- BEGIN CANONICAL INDEX admin_plan_actions_action_type_created_at_idx
CREATE INDEX admin_plan_actions_action_type_created_at_idx ON public.admin_plan_actions USING btree (action_type, created_at DESC);
-- END CANONICAL INDEX admin_plan_actions_action_type_created_at_idx

-- BEGIN CANONICAL INDEX admin_plan_actions_admin_email_created_at_idx
CREATE INDEX admin_plan_actions_admin_email_created_at_idx ON public.admin_plan_actions USING btree (admin_email, created_at DESC);
-- END CANONICAL INDEX admin_plan_actions_admin_email_created_at_idx

-- BEGIN CANONICAL INDEX admin_plan_actions_target_user_id_created_at_idx
CREATE INDEX admin_plan_actions_target_user_id_created_at_idx ON public.admin_plan_actions USING btree (target_user_id, created_at DESC);
-- END CANONICAL INDEX admin_plan_actions_target_user_id_created_at_idx

-- BEGIN CANONICAL INDEX idx_child_profiles_child_email_normalized
CREATE INDEX idx_child_profiles_child_email_normalized ON public.child_profiles USING btree (child_email_normalized);
-- END CANONICAL INDEX idx_child_profiles_child_email_normalized

-- BEGIN CANONICAL INDEX idx_child_profiles_child_user_id
CREATE INDEX idx_child_profiles_child_user_id ON public.child_profiles USING btree (child_user_id) WHERE (child_user_id IS NOT NULL);
-- END CANONICAL INDEX idx_child_profiles_child_user_id

-- BEGIN CANONICAL INDEX idx_child_profiles_parent_user_id
CREATE INDEX idx_child_profiles_parent_user_id ON public.child_profiles USING btree (parent_user_id);
-- END CANONICAL INDEX idx_child_profiles_parent_user_id

-- BEGIN CANONICAL INDEX idx_child_profiles_unique_email_per_parent
CREATE UNIQUE INDEX idx_child_profiles_unique_email_per_parent ON public.child_profiles USING btree (parent_user_id, child_email_normalized) WHERE (child_email_normalized IS NOT NULL);
-- END CANONICAL INDEX idx_child_profiles_unique_email_per_parent

-- BEGIN CANONICAL INDEX idx_folders_parent_id
CREATE INDEX idx_folders_parent_id ON public.folders USING btree (parent_id);
-- END CANONICAL INDEX idx_folders_parent_id

-- BEGIN CANONICAL INDEX idx_folders_user_id
CREATE INDEX idx_folders_user_id ON public.folders USING btree (user_id);
-- END CANONICAL INDEX idx_folders_user_id

-- BEGIN CANONICAL INDEX payment_events_status_created_at_idx
CREATE INDEX payment_events_status_created_at_idx ON public.payment_events USING btree (status, created_at DESC);
-- END CANONICAL INDEX payment_events_status_created_at_idx

-- BEGIN CANONICAL INDEX payment_events_stripe_event_id_idx
CREATE INDEX payment_events_stripe_event_id_idx ON public.payment_events USING btree (stripe_event_id);
-- END CANONICAL INDEX payment_events_stripe_event_id_idx

-- BEGIN CANONICAL INDEX payment_events_stripe_payment_link_id_idx
CREATE INDEX payment_events_stripe_payment_link_id_idx ON public.payment_events USING btree (stripe_payment_link_id);
-- END CANONICAL INDEX payment_events_stripe_payment_link_id_idx

-- BEGIN CANONICAL INDEX payment_events_stripe_session_id_idx
CREATE INDEX payment_events_stripe_session_id_idx ON public.payment_events USING btree (stripe_session_id);
-- END CANONICAL INDEX payment_events_stripe_session_id_idx

-- BEGIN CANONICAL INDEX payment_events_stripe_session_id_unique
CREATE UNIQUE INDEX payment_events_stripe_session_id_unique ON public.payment_events USING btree (stripe_session_id) WHERE (stripe_session_id IS NOT NULL);
-- END CANONICAL INDEX payment_events_stripe_session_id_unique

-- BEGIN CANONICAL INDEX payment_events_user_id_created_at_idx
CREATE INDEX payment_events_user_id_created_at_idx ON public.payment_events USING btree (user_id, created_at DESC);
-- END CANONICAL INDEX payment_events_user_id_created_at_idx

-- BEGIN CANONICAL INDEX idx_session_images_session_id
CREATE INDEX idx_session_images_session_id ON public.session_images USING btree (session_id);
-- END CANONICAL INDEX idx_session_images_session_id

-- BEGIN CANONICAL INDEX idx_session_images_session_id_image_url
CREATE INDEX idx_session_images_session_id_image_url ON public.session_images USING btree (session_id, image_url);
-- END CANONICAL INDEX idx_session_images_session_id_image_url

-- BEGIN CANONICAL INDEX idx_study_sessions_folder_id
CREATE INDEX idx_study_sessions_folder_id ON public.study_sessions USING btree (folder_id);
-- END CANONICAL INDEX idx_study_sessions_folder_id

-- BEGIN CANONICAL INDEX idx_study_sessions_user_id_image_url
CREATE INDEX idx_study_sessions_user_id_image_url ON public.study_sessions USING btree (user_id, image_url);
-- END CANONICAL INDEX idx_study_sessions_user_id_image_url

-- BEGIN CANONICAL INDEX idx_support_tickets_created_at
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);
-- END CANONICAL INDEX idx_support_tickets_created_at

-- BEGIN CANONICAL INDEX idx_support_tickets_status_created_at
CREATE INDEX idx_support_tickets_status_created_at ON public.support_tickets USING btree (status, created_at DESC);
-- END CANONICAL INDEX idx_support_tickets_status_created_at

-- BEGIN CANONICAL INDEX idx_support_tickets_user_id_created_at
CREATE INDEX idx_support_tickets_user_id_created_at ON public.support_tickets USING btree (user_id, created_at DESC);
-- END CANONICAL INDEX idx_support_tickets_user_id_created_at

-- BEGIN CANONICAL INDEX idx_tutor_messages_thread_date
CREATE INDEX idx_tutor_messages_thread_date ON public.tutor_messages USING btree (thread_id, created_at DESC);
-- END CANONICAL INDEX idx_tutor_messages_thread_date

-- BEGIN CANONICAL INDEX idx_tutor_threads_user
CREATE INDEX idx_tutor_threads_user ON public.tutor_threads USING btree (user_id, last_message_at DESC);
-- END CANONICAL INDEX idx_tutor_threads_user

-- BEGIN CANONICAL INDEX under13_parent_notifications_due_idx
CREATE INDEX under13_parent_notifications_due_idx ON public.under13_parent_notifications USING btree (next_attempt_at, lease_expires_at) WHERE (status = ANY (ARRAY['pending'::text, 'claimed'::text, 'retryable'::text]));
-- END CANONICAL INDEX under13_parent_notifications_due_idx

-- BEGIN CANONICAL INDEX usage_events_user_session_type_idx
CREATE INDEX usage_events_user_session_type_idx ON public.usage_events USING btree (user_id, session_id, event_type);
-- END CANONICAL INDEX usage_events_user_session_type_idx

-- BEGIN CANONICAL INDEX usage_events_user_type_created_idx
CREATE INDEX usage_events_user_type_created_idx ON public.usage_events USING btree (user_id, event_type, created_at DESC);
-- END CANONICAL INDEX usage_events_user_type_created_idx

-- BEGIN CANONICAL FUNCTION admin_extend_plan_30_days
CREATE OR REPLACE FUNCTION public.admin_extend_plan_30_days(target_user_id uuid, target_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_expires timestamptz;
  v_new_expires     timestamptz;
BEGIN
  -- Validate plan value — only premium and family are allowed
  IF target_plan NOT IN ('premium', 'family') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid plan value');
  END IF;

  -- Fetch current expiry date
  SELECT plan_expires_at
    INTO v_current_expires
    FROM public.profiles
   WHERE id = target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Calculate new expiry:
  -- Start from whichever is later: current plan_expires_at or now().
  -- This guarantees an active subscription is never shortened.
  v_new_expires := GREATEST(COALESCE(v_current_expires, now()), now()) + INTERVAL '30 days';

  -- Perform the update
  UPDATE public.profiles
     SET plan            = target_plan,
         plan_expires_at = v_new_expires,
         plan_updated_at = now()
   WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'new_expires_at', v_new_expires);
END;
$function$;
-- END CANONICAL FUNCTION admin_extend_plan_30_days

-- BEGIN CANONICAL FUNCTION_ACL admin_extend_plan_30_days
ALTER FUNCTION public."admin_extend_plan_30_days"(target_user_id uuid, target_plan text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."admin_extend_plan_30_days"(target_user_id uuid, target_plan text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."admin_extend_plan_30_days"(target_user_id uuid, target_plan text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."admin_extend_plan_30_days"(target_user_id uuid, target_plan text) TO "service_role";
COMMENT ON FUNCTION public."admin_extend_plan_30_days"(target_user_id uuid, target_plan text) IS 'Safely extends a user plan by 30 days without shortening an active subscription.
   Logic: GREATEST(COALESCE(plan_expires_at, now()), now()) + INTERVAL ''30 days''.
   Access:
     - anon, authenticated, PUBLIC: EXECUTE revoked (cannot call directly).
     - service_role: EXECUTE granted (called only by admin-plan-management Edge Function).
   The Edge Function verifies admin identity via ADMIN_EMAILS secret before calling this RPC.
   Sprint 22A — OmniNauka Admin Panel.';
-- END CANONICAL FUNCTION_ACL admin_extend_plan_30_days

-- BEGIN CANONICAL FUNCTION approve_parental_consent
CREATE OR REPLACE FUNCTION public.approve_parental_consent(p_token_hash text, p_ip text, p_user_agent text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_consent_id uuid;
  v_child_id uuid;
  v_locked_child_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  SELECT pc.id, pc.child_user_id INTO v_consent_id, v_child_id
  FROM public.parental_consents pc
  WHERE pc.token_hash = p_token_hash
    AND pc.consent_status = 'pending'
    AND pc.token_expires_at > clock_timestamp()
  LIMIT 1;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Lock profile first. A concurrent suspension or another approval must be
  -- observed before changing consent. Only the existing 13_15 pending flow qualifies.
  SELECT p.id INTO v_locked_child_id FROM public.profiles p
  WHERE p.id = v_child_id
    AND p.age_band = '13_15'
    AND p.account_status = 'pending_parent_consent'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Lock the consent explicitly before testing expiry. UPDATE's initial WHERE
  -- can otherwise be evaluated before waiting on a row held by another transaction.
  PERFORM 1 FROM public.parental_consents pc
  WHERE pc.id = v_consent_id AND pc.child_user_id = v_child_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Conditional UPDATE serializes consumption, rechecks expiry AFTER waits,
  -- and rejects token rotation, withdrawal and replay. Both updates commit together.
  UPDATE public.parental_consents
  SET consent_status = 'approved', consent_approved_at = clock_timestamp(),
      ip_address = p_ip, user_agent = left(p_user_agent, 512), updated_at = now()
  WHERE id = v_consent_id AND child_user_id = v_child_id
    AND token_hash = p_token_hash AND consent_status = 'pending'
    AND token_expires_at > clock_timestamp();
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles SET account_status = 'parent_approved'
  WHERE id = v_locked_child_id AND age_band = '13_15'
    AND account_status = 'pending_parent_consent';
  IF NOT FOUND THEN
    -- Defensive rollback: never commit an approval without its legal profile transition.
    RAISE EXCEPTION 'Consent account transition rejected';
  END IF;
  RETURN true;
END;
$function$;
-- END CANONICAL FUNCTION approve_parental_consent

-- BEGIN CANONICAL FUNCTION_ACL approve_parental_consent
ALTER FUNCTION public."approve_parental_consent"(p_token_hash text, p_ip text, p_user_agent text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."approve_parental_consent"(p_token_hash text, p_ip text, p_user_agent text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."approve_parental_consent"(p_token_hash text, p_ip text, p_user_agent text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."approve_parental_consent"(p_token_hash text, p_ip text, p_user_agent text) TO "service_role";
-- END CANONICAL FUNCTION_ACL approve_parental_consent

-- BEGIN CANONICAL FUNCTION can_upload_study_materials
CREATE OR REPLACE FUNCTION public.can_upload_study_materials()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT p.account_status INTO v_status FROM public.profiles p
  WHERE p.id = auth.uid()
  FOR SHARE OF p;
  IF NOT FOUND THEN RETURN false; END IF;
  -- These are the existing usable states (including consent-approved 13-15 users).
  -- Pending, expired, suspended, withdrawn, NULL and unknown states fail closed.
  RETURN COALESCE(v_status IN ('active', 'parent_approved'), false);
END;
$function$;
-- END CANONICAL FUNCTION can_upload_study_materials

-- BEGIN CANONICAL FUNCTION_ACL can_upload_study_materials
ALTER FUNCTION public."can_upload_study_materials"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."can_upload_study_materials"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."can_upload_study_materials"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."can_upload_study_materials"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."can_upload_study_materials"() TO "service_role";
-- END CANONICAL FUNCTION_ACL can_upload_study_materials

-- BEGIN CANONICAL FUNCTION check_and_reserve_ai_usage
CREATE OR REPLACE FUNCTION public.check_and_reserve_ai_usage(p_user_id uuid, p_session_id uuid, p_event_type text, p_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_normalized_plan text;
  v_session_owner uuid;
  v_limit int;
  v_used int;
  v_lock_key bigint;
  v_reservation_id uuid;
  v_feature text;
  v_message text;
BEGIN
  -- Strict normalization of plan
  IF p_plan = 'premium' OR p_plan = 'family' THEN
    v_normalized_plan := p_plan;
  ELSE
    v_normalized_plan := 'free';
  END IF;

  -- Validate event type
  IF p_event_type NOT IN ('lesson_analysis', 'flashcard_regen', 'quiz_regen') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unsupported_event_type');
  END IF;

  -- Session validation for session-scoped features
  IF p_event_type IN ('flashcard_regen', 'quiz_regen') THEN
    IF p_session_id IS NULL THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'missing_session_id');
    END IF;
    SELECT user_id INTO v_session_owner FROM public.study_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_not_found');
    END IF;
    IF v_session_owner <> p_user_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_ownership_mismatch');
    END IF;
  END IF;

  -- Additionally, even if lesson_analysis is daily, if a session is provided, validate ownership
  IF p_event_type = 'lesson_analysis' AND p_session_id IS NOT NULL THEN
    SELECT user_id INTO v_session_owner FROM public.study_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_not_found');
    END IF;
    IF v_session_owner <> p_user_id THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'session_ownership_mismatch');
    END IF;
  END IF;

  -- Limits determination and lock key generation
  IF p_event_type = 'lesson_analysis' THEN
    IF v_normalized_plan = 'free' THEN v_limit := 2; ELSE v_limit := 10; END IF;
    -- Daily lock per user
    v_lock_key := hashtext(p_user_id::text || p_event_type || (timezone('utc', now())::date)::text)::bigint;
    v_feature := 'ai_lessons';
    IF v_normalized_plan = 'free' THEN
      v_message := 'Osiągnąłeś dzienny limit lekcji AI w planie Darmowym. Sprawdź Premium, aby korzystać z większego limitu.';
    ELSE
      v_message := 'Osiągnąłeś dzienny limit lekcji AI dla swojego planu (fair use).';
    END IF;
  ELSIF p_event_type = 'flashcard_regen' THEN
    IF v_normalized_plan = 'free' THEN v_limit := 1; ELSE v_limit := 5; END IF;
    -- Session lock
    v_lock_key := hashtext(p_user_id::text || p_session_id::text || p_event_type)::bigint;
    v_feature := 'flashcard_regen';
    IF v_normalized_plan = 'free' THEN
      v_message := 'W planie Darmowym możesz wygenerować jedną dodatkową serię fiszek. Sprawdź Premium, aby odblokować więcej powtórek.';
    ELSE
      v_message := 'Osiągnąłeś limit regeneracji fiszek dla tej lekcji (fair use).';
    END IF;
  ELSIF p_event_type = 'quiz_regen' THEN
    IF v_normalized_plan = 'free' THEN v_limit := 1; ELSE v_limit := 5; END IF;
    -- Session lock
    v_lock_key := hashtext(p_user_id::text || p_session_id::text || p_event_type)::bigint;
    v_feature := 'quiz_regen';
    IF v_normalized_plan = 'free' THEN
      v_message := 'W planie Darmowym możesz wygenerować jeden dodatkowy sprawdzian. Sprawdź Premium, aby odblokować więcej powtórek.';
    ELSE
      v_message := 'Osiągnąłeś limit regeneracji sprawdzianów dla tej lekcji (fair use).';
    END IF;
  END IF;

  -- Acquire transaction-level advisory lock
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Count usage
  IF p_event_type = 'lesson_analysis' THEN
    SELECT count(*) INTO v_used
    FROM public.usage_events
    WHERE user_id = p_user_id
      AND event_type = p_event_type
      AND created_at >= (timezone('utc', now())::date)::timestamp AT TIME ZONE 'UTC';
  ELSE
    SELECT count(*) INTO v_used
    FROM public.usage_events
    WHERE user_id = p_user_id
      AND session_id = p_session_id
      AND event_type = p_event_type;
  END IF;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'error', 'usage_limit_reached',
      'feature', v_feature,
      'limit', v_limit,
      'used', v_used,
      'plan', v_normalized_plan,
      'message', v_message
    );
  END IF;

  -- Insert reservation
  INSERT INTO public.usage_events (user_id, session_id, event_type, metadata)
  VALUES (
    p_user_id,
    p_session_id,
    p_event_type,
    jsonb_build_object('plan', v_normalized_plan, 'status', 'reserved', 'reserved_at', now())
  ) RETURNING id INTO v_reservation_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'used', v_used + 1,
    'reservation_id', v_reservation_id,
    'feature', v_feature
  );
END;
$function$;
-- END CANONICAL FUNCTION check_and_reserve_ai_usage

-- BEGIN CANONICAL FUNCTION_ACL check_and_reserve_ai_usage
ALTER FUNCTION public."check_and_reserve_ai_usage"(p_user_id uuid, p_session_id uuid, p_event_type text, p_plan text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."check_and_reserve_ai_usage"(p_user_id uuid, p_session_id uuid, p_event_type text, p_plan text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."check_and_reserve_ai_usage"(p_user_id uuid, p_session_id uuid, p_event_type text, p_plan text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."check_and_reserve_ai_usage"(p_user_id uuid, p_session_id uuid, p_event_type text, p_plan text) TO "service_role";
-- END CANONICAL FUNCTION_ACL check_and_reserve_ai_usage

-- BEGIN CANONICAL FUNCTION check_and_reserve_tutor_usage
CREATE OR REPLACE FUNCTION public.check_and_reserve_tutor_usage(p_user_id uuid, p_session_id uuid, p_plan text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_owner uuid;
  v_session_limit int;
  v_daily_limit int;
  v_session_count int;
  v_daily_count int;
  v_normalized_plan text;
BEGIN
  -- 1. Acquire transactional advisory lock on user_id to serialize checks
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  -- 2. Defense-in-depth: Verify session existence and active status (not soft-deleted)
  SELECT user_id INTO v_session_owner
    FROM public.study_sessions
   WHERE id = p_session_id AND deleted_at IS NULL;

  IF v_session_owner IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'session_not_found'
    );
  END IF;

  IF v_session_owner <> p_user_id THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'session_not_owned'
    );
  END IF;

  -- 3. Normalize plan strictly
  IF p_plan = 'premium' OR p_plan = 'family' THEN
    v_normalized_plan := p_plan;
    v_session_limit := 50;
    v_daily_limit := 100;
  ELSE
    v_normalized_plan := 'free';
    v_session_limit := 10;
    v_daily_limit := 20;
  END IF;

  -- 4. Count session messages (event_type = 'tutor_message')
  SELECT count(*) INTO v_session_count
    FROM public.usage_events
   WHERE user_id = p_user_id
     AND session_id = p_session_id
     AND event_type = 'tutor_message';

  IF v_session_count >= v_session_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'session_limit_reached',
      'limit', v_session_limit,
      'count', v_session_count
    );
  END IF;

  -- 5. Count daily messages using explicit UTC start of day
  SELECT count(*) INTO v_daily_count
    FROM public.usage_events
   WHERE user_id = p_user_id
     AND event_type = 'tutor_message'
     AND created_at >= ((timezone('utc', now())::date)::timestamp AT TIME ZONE 'UTC');

  IF v_daily_count >= v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'limit', v_daily_limit,
      'count', v_daily_count
    );
  END IF;

  -- 6. Atomic Reservation Insert
  INSERT INTO public.usage_events (
    user_id,
    session_id,
    event_type,
    metadata
  ) VALUES (
    p_user_id,
    p_session_id,
    'tutor_message',
    jsonb_build_object(
      'effectivePlan', v_normalized_plan,
      'mode', CASE WHEN v_normalized_plan = 'free' THEN 'basic' ELSE 'advanced' END,
      'reserved_at', now()
    )
  );

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'reserved',
    'session_count', v_session_count + 1,
    'daily_count', v_daily_count + 1
  );
END;
$function$;
-- END CANONICAL FUNCTION check_and_reserve_tutor_usage

-- BEGIN CANONICAL FUNCTION_ACL check_and_reserve_tutor_usage
ALTER FUNCTION public."check_and_reserve_tutor_usage"(p_user_id uuid, p_session_id uuid, p_plan text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."check_and_reserve_tutor_usage"(p_user_id uuid, p_session_id uuid, p_plan text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."check_and_reserve_tutor_usage"(p_user_id uuid, p_session_id uuid, p_plan text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."check_and_reserve_tutor_usage"(p_user_id uuid, p_session_id uuid, p_plan text) TO "service_role";
COMMENT ON FUNCTION public."check_and_reserve_tutor_usage"(p_user_id uuid, p_session_id uuid, p_plan text) IS 'Checks and reserves usage limits for AI Tutor within a secure locked transaction (service_role only).';
-- END CANONICAL FUNCTION_ACL check_and_reserve_tutor_usage

-- BEGIN CANONICAL FUNCTION check_child_limit
CREATE OR REPLACE FUNCTION public.check_child_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count int;
  v_is_taking_slot boolean;
  v_slot_added boolean;
BEGIN
  -- 1. Determine if the new state takes a slot (only non-archived count towards the limit)
  -- Safe check using COALESCE
  v_is_taking_slot := (COALESCE(NEW.status, '') <> 'archived');

  -- 2. If it doesn't take a slot, just allow it
  IF NOT v_is_taking_slot THEN
    RETURN NEW;
  END IF;

  -- 3. Safety check for parent_user_id
  IF NEW.parent_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Check if we are *adding* or *reactivating* a slot for this parent
  v_slot_added :=
    (TG_OP = 'INSERT')
    OR (
      TG_OP = 'UPDATE'
      AND (
        NEW.parent_user_id IS DISTINCT FROM OLD.parent_user_id
        OR COALESCE(OLD.status, '') = 'archived'
      )
    );

  IF v_slot_added THEN
    -- Prevent race condition by locking the parent profile record
    PERFORM 1
       FROM public.profiles
      WHERE id = NEW.parent_user_id
        FOR UPDATE;

    -- Count existing non-archived children for this parent
    SELECT count(*)
      INTO v_count
      FROM public.child_profiles
     WHERE parent_user_id = NEW.parent_user_id
       AND parent_user_id IS NOT NULL
       AND COALESCE(status, '') <> 'archived';

    IF v_count >= 3 THEN
      RAISE EXCEPTION 'Osiągnięto limit 3 dzieci w planie rodzinnym.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION check_child_limit

-- BEGIN CANONICAL FUNCTION_ACL check_child_limit
ALTER FUNCTION public."check_child_limit"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."check_child_limit"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."check_child_limit"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."check_child_limit"() TO "service_role";
COMMENT ON FUNCTION public."check_child_limit"() IS 'Egzekwuje limit 3 aktywnych dzieci na rodzica z ochroną przed race condition (Sprint 23A Hardened).';
-- END CANONICAL FUNCTION_ACL check_child_limit

-- BEGIN CANONICAL FUNCTION check_folder_circularity
CREATE OR REPLACE FUNCTION public.check_folder_circularity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (
      WITH RECURSIVE folder_path AS (
        SELECT id, parent_id FROM public.folders WHERE id = NEW.parent_id
        UNION ALL
        SELECT f.id, f.parent_id FROM public.folders f JOIN folder_path fp ON f.id = fp.parent_id
      )
      SELECT 1 FROM folder_path WHERE id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Circular folder reference detected: Folder cannot be an ancestor of itself.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION check_folder_circularity

-- BEGIN CANONICAL FUNCTION_ACL check_folder_circularity
ALTER FUNCTION public."check_folder_circularity"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."check_folder_circularity"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."check_folder_circularity"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."check_folder_circularity"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."check_folder_circularity"() TO "anon";
GRANT EXECUTE ON FUNCTION public."check_folder_circularity"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."check_folder_circularity"() TO "service_role";
-- END CANONICAL FUNCTION_ACL check_folder_circularity

-- BEGIN CANONICAL FUNCTION claim_due_under13_parent_reminders
CREATE OR REPLACE FUNCTION public.claim_due_under13_parent_reminders(p_batch_size integer DEFAULT 20)
 RETURNS TABLE(event_id uuid, parent_user_id uuid, claim_token uuid, retention_deadline_at timestamp with time zone, idempotency_key text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_event public.under13_parent_notifications%ROWTYPE;
  v_context record;
  v_now timestamptz;
BEGIN
  -- Lock order for claim/prepare is child profile -> notification. No relation writes.
  -- The profile lock is shared with linker/expiry only during this short SQL call.
  FOR v_profile IN
    SELECT p.* FROM public.profiles p
    WHERE (
      p.age_band = 'under_13' AND p.account_status = 'pending_parent_preapproval'
      AND clock_timestamp() >= COALESCE(p.pending_preapproval_since, p.created_at) + interval '5 days'
      AND clock_timestamp() < COALESCE(p.pending_preapproval_since, p.created_at) + interval '7 days'
      AND NOT EXISTS (SELECT 1 FROM public.under13_parent_notifications n WHERE n.child_user_id = p.id)
      AND EXISTS (SELECT 1 FROM public.under13_parent_reminder_context(p.id))
    ) OR EXISTS (
      SELECT 1 FROM public.under13_parent_notifications n WHERE n.child_user_id = p.id
        AND n.status IN ('pending', 'retryable', 'claimed')
        AND (n.status <> 'claimed' OR n.lease_expires_at <= clock_timestamp())
        AND (n.next_attempt_at IS NULL OR n.next_attempt_at <= clock_timestamp()
          OR n.retention_deadline_at <= clock_timestamp()
          OR n.first_attempt_at + interval '6 hours' <= clock_timestamp())
    )
    ORDER BY p.id
    LIMIT LEAST(20, GREATEST(1, COALESCE(p_batch_size, 20)))
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    SELECT * INTO v_context FROM public.under13_parent_reminder_context(v_profile.id);
    IF FOUND THEN
      INSERT INTO public.under13_parent_notifications (child_user_id, parent_user_id, child_profile_id, retention_deadline_at)
      VALUES (v_profile.id, v_context.parent_id, v_context.relation_id, v_context.deadline_at)
      ON CONFLICT (child_user_id, notification_kind) DO NOTHING;
    END IF;
    SELECT n.* INTO v_event FROM public.under13_parent_notifications n
    WHERE n.child_user_id = v_profile.id FOR UPDATE SKIP LOCKED;
    IF NOT FOUND OR v_event.status NOT IN ('pending', 'retryable', 'claimed') THEN CONTINUE; END IF;
    v_now := clock_timestamp();
    IF v_event.status = 'claimed' AND v_event.lease_expires_at > v_now THEN CONTINUE; END IF;

    IF v_event.retention_deadline_at <= v_now THEN
      UPDATE public.under13_parent_notifications SET status = 'cancelled', safe_error_category = 'deadline_passed',
        claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = v_event.id;
      CONTINUE;
    END IF;
    IF v_context.parent_id IS NULL OR v_context.parent_id <> v_event.parent_user_id
       OR v_context.relation_id <> v_event.child_profile_id OR v_context.deadline_at <> v_event.retention_deadline_at THEN
      UPDATE public.under13_parent_notifications SET status = 'cancelled', safe_error_category = 'relationship_no_longer_valid',
        claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = v_event.id;
      CONTINUE;
    END IF;
    IF v_event.attempt_count >= 3 OR v_event.first_attempt_at + interval '6 hours' <= v_now THEN
      UPDATE public.under13_parent_notifications SET status = 'delivery_unknown', safe_error_category = 'retry_window_exhausted',
        claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = v_event.id;
      CONTINUE;
    END IF;
    IF v_event.next_attempt_at > v_now THEN CONTINUE; END IF;
    UPDATE public.under13_parent_notifications n SET status = 'claimed', claim_token = gen_random_uuid(),
      lease_expires_at = v_now + interval '10 minutes', updated_at = v_now
    WHERE n.id = v_event.id RETURNING n.* INTO v_event;
    RETURN QUERY SELECT v_event.id, v_event.parent_user_id, v_event.claim_token,
      v_event.retention_deadline_at, v_event.idempotency_key;
  END LOOP;
END;
$function$;
-- END CANONICAL FUNCTION claim_due_under13_parent_reminders

-- BEGIN CANONICAL FUNCTION_ACL claim_due_under13_parent_reminders
ALTER FUNCTION public."claim_due_under13_parent_reminders"(p_batch_size integer) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."claim_due_under13_parent_reminders"(p_batch_size integer) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."claim_due_under13_parent_reminders"(p_batch_size integer) TO "postgres";
GRANT EXECUTE ON FUNCTION public."claim_due_under13_parent_reminders"(p_batch_size integer) TO "service_role";
-- END CANONICAL FUNCTION_ACL claim_due_under13_parent_reminders

-- BEGIN CANONICAL FUNCTION expire_pending_under13_accounts
CREATE OR REPLACE FUNCTION public.expire_pending_under13_accounts(p_batch_size integer DEFAULT 20)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_expired_count integer := 0;
BEGIN
  FOR v_profile IN
    SELECT p.* FROM public.profiles p
    WHERE p.age_band = 'under_13'
      AND p.account_status = 'pending_parent_preapproval'
      AND COALESCE(p.pending_preapproval_since, p.created_at) <= now() - interval '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM public.child_profiles cp
        JOIN public.profiles parent ON parent.id = cp.parent_user_id
        WHERE cp.child_user_id = p.id
          AND cp.status IN ('linked', 'active')
          AND cp.preapproval_integrity_version = 1
          AND parent.user_role = 'parent' AND cp.parent_user_id <> p.id
          AND cp.guardian_consent_acknowledged_at IS NOT NULL
          AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      )
    ORDER BY COALESCE(p.pending_preapproval_since, p.created_at), p.id
    LIMIT LEAST(20, GREATEST(1, COALESCE(p_batch_size, 20)))
    FOR UPDATE OF p SKIP LOCKED
  LOOP
    -- Re-read all authoritative eligibility conditions under the same row lock.
    IF v_profile.age_band IS DISTINCT FROM 'under_13'
       OR v_profile.account_status IS DISTINCT FROM 'pending_parent_preapproval'
       OR COALESCE(v_profile.pending_preapproval_since, v_profile.created_at)
            > now() - interval '7 days'
       OR EXISTS (
         SELECT 1 FROM public.child_profiles cp
         JOIN public.profiles parent ON parent.id = cp.parent_user_id
         WHERE cp.child_user_id = v_profile.id
           AND cp.status IN ('linked', 'active')
           AND cp.preapproval_integrity_version = 1
           AND parent.user_role = 'parent' AND cp.parent_user_id <> v_profile.id
           AND cp.guardian_consent_acknowledged_at IS NOT NULL
           AND cp.guardian_consent_version = 'child_email_preapproval_v1'
       ) THEN CONTINUE; END IF;

    UPDATE public.profiles SET account_status = 'expired_pending_preapproval'
    WHERE id = v_profile.id AND age_band = 'under_13'
      AND account_status = 'pending_parent_preapproval';
    IF FOUND THEN v_expired_count := v_expired_count + 1; END IF;
  END LOOP;
  RETURN v_expired_count;
END;
$function$;
-- END CANONICAL FUNCTION expire_pending_under13_accounts

-- BEGIN CANONICAL FUNCTION_ACL expire_pending_under13_accounts
ALTER FUNCTION public."expire_pending_under13_accounts"(p_batch_size integer) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."expire_pending_under13_accounts"(p_batch_size integer) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."expire_pending_under13_accounts"(p_batch_size integer) TO "postgres";
GRANT EXECUTE ON FUNCTION public."expire_pending_under13_accounts"(p_batch_size integer) TO "service_role";
-- END CANONICAL FUNCTION_ACL expire_pending_under13_accounts

-- BEGIN CANONICAL FUNCTION finish_under13_parent_reminder
CREATE OR REPLACE FUNCTION public.finish_under13_parent_reminder(p_event_id uuid, p_claim_token uuid, p_result text, p_retry_after_seconds integer DEFAULT 0)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event public.under13_parent_notifications%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_next timestamptz;
BEGIN
  SELECT * INTO v_event FROM public.under13_parent_notifications WHERE id = p_event_id FOR UPDATE;
  v_now := clock_timestamp();
  IF NOT FOUND OR v_event.status <> 'claimed' OR v_event.claim_token IS DISTINCT FROM p_claim_token
    OR v_event.lease_expires_at <= v_now THEN RETURN 'stale_claim'; END IF;
  IF p_result = 'accepted' AND v_event.attempt_count > 0 THEN v_status := 'accepted';
  ELSIF p_result IN ('relationship_no_longer_valid', 'recipient_changed', 'payload_changed',
    'parent_email_unconfirmed', 'parent_unavailable', 'deadline_passed') THEN v_status := 'cancelled';
  ELSIF p_result IN ('invalid_recipient', 'provider_auth_or_config', 'provider_rejected') THEN v_status := 'terminal_error';
  ELSIF p_result IN ('provider_rate_limited', 'provider_5xx', 'provider_timeout', 'provider_conflict', 'parent_lookup_failed') THEN
    v_status := 'retryable';
    v_next := GREATEST(COALESCE(v_event.next_attempt_at, v_now + interval '15 minutes'),
      v_now + make_interval(secs => LEAST(21600, GREATEST(0, COALESCE(p_retry_after_seconds, 0)))));
    IF v_event.retention_deadline_at <= v_now THEN v_status := 'cancelled'; p_result := 'deadline_passed';
    ELSIF v_event.attempt_count >= 3 OR v_event.first_attempt_at + interval '6 hours' <= v_now
      OR v_next >= LEAST(v_event.retention_deadline_at, v_event.first_attempt_at + interval '6 hours') THEN
      v_status := 'delivery_unknown'; p_result := 'retry_window_exhausted';
    END IF;
  ELSE RETURN 'invalid_result'; END IF;
  UPDATE public.under13_parent_notifications SET status = v_status,
    provider_accepted_at = CASE WHEN v_status = 'accepted' THEN v_now ELSE provider_accepted_at END,
    safe_error_category = CASE WHEN v_status = 'accepted' THEN NULL ELSE p_result END,
    next_attempt_at = CASE WHEN v_status = 'retryable' THEN v_next ELSE NULL END,
    claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = p_event_id;
  RETURN v_status;
END;
$function$;
-- END CANONICAL FUNCTION finish_under13_parent_reminder

-- BEGIN CANONICAL FUNCTION_ACL finish_under13_parent_reminder
ALTER FUNCTION public."finish_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_result text, p_retry_after_seconds integer) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."finish_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_result text, p_retry_after_seconds integer) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."finish_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_result text, p_retry_after_seconds integer) TO "postgres";
GRANT EXECUTE ON FUNCTION public."finish_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_result text, p_retry_after_seconds integer) TO "service_role";
-- END CANONICAL FUNCTION_ACL finish_under13_parent_reminder

-- BEGIN CANONICAL FUNCTION fulfill_stripe_premium_payment
CREATE OR REPLACE FUNCTION public.fulfill_stripe_premium_payment(p_stripe_event_id text, p_stripe_session_id text, p_target_user_id uuid, p_event_type text, p_amount_total bigint, p_currency text, p_payment_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_new_expires timestamptz;
BEGIN
  -- We first verify if the event ID was already processed.
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
    RETURN jsonb_build_object('outcome', 'already_processed_event');
  END IF;

  -- Verify if session ID was already fulfilled by a DIFFERENT event.
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
    -- R6-M1: DO NOT insert a secondary duplicate row. Just return the outcome safely.
    RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
  END IF;

  -- 1. Profile Lock (M2 Lock Order)
  SELECT id, email, plan, plan_expires_at, account_status
    INTO v_profile
    FROM public.profiles
   WHERE id = p_target_user_id
     FOR UPDATE;

  -- R6-M2: atomic claim without narrow stripe_event_id conflict target.
  -- This allows DO NOTHING to absorb BOTH stripe_event_id and stripe_session_id unique conflicts safely.
  IF NOT FOUND THEN
    INSERT INTO public.payment_events (
      stripe_event_id,
      stripe_session_id,
      user_id,
      event_type,
      status,
      amount_total,
      currency,
      payment_status,
      error_message,
      payload
    ) VALUES (
      p_stripe_event_id,
      p_stripe_session_id,
      NULL,
      p_event_type,
      'error',
      p_amount_total,
      p_currency,
      p_payment_status,
      'target_profile_missing_reconciliation_required',
      NULL
    )
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
      -- Determine which conflict occurred
      IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
        RETURN jsonb_build_object('outcome', 'already_processed_event');
      ELSIF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
        RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
      ELSE
        RAISE EXCEPTION 'Unexpected conflict inserting missing profile reconciliation';
      END IF;
    END IF;

    RETURN jsonb_build_object('outcome', 'reconciliation_required');
  END IF;

  -- 2. Family Protection / Reconciliation (M3)
  IF v_profile.plan = 'family' AND (v_profile.plan_expires_at IS NULL OR v_profile.plan_expires_at > now()) THEN
    INSERT INTO public.payment_events (
      stripe_event_id,
      stripe_session_id,
      user_id,
      event_type,
      status,
      amount_total,
      currency,
      payment_status,
      error_message,
      payload
    ) VALUES (
      p_stripe_event_id,
      p_stripe_session_id,
      p_target_user_id,
      p_event_type,
      'error',
      p_amount_total,
      p_currency,
      p_payment_status,
      'active_family_reconciliation_required',
      NULL
    )
    ON CONFLICT DO NOTHING;

    IF NOT FOUND THEN
      IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
        RETURN jsonb_build_object('outcome', 'already_processed_event');
      ELSIF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
        RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
      ELSE
        RAISE EXCEPTION 'Unexpected conflict inserting family reconciliation';
      END IF;
    END IF;

    RETURN jsonb_build_object('outcome', 'reconciliation_required');
  END IF;

  -- 3. Atomic Event Claim
  INSERT INTO public.payment_events (
    stripe_event_id,
    stripe_session_id,
    user_id,
    event_type,
    status,
    target_plan,
    amount_total,
    currency,
    payment_status,
    payload,
    processed_at
  ) VALUES (
    p_stripe_event_id,
    p_stripe_session_id,
    p_target_user_id,
    p_event_type,
    'processed',
    'premium',
    p_amount_total,
    p_currency,
    p_payment_status,
    NULL,
    now()
  )
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_event_id = p_stripe_event_id) THEN
      RETURN jsonb_build_object('outcome', 'already_processed_event');
    ELSIF EXISTS (SELECT 1 FROM public.payment_events WHERE stripe_session_id = p_stripe_session_id) THEN
      RETURN jsonb_build_object('outcome', 'duplicate_checkout_session');
    ELSE
      RAISE EXCEPTION 'Unexpected conflict during atomic claim';
    END IF;
  END IF;

  -- 4. Calculate New Expiry
  v_new_expires := GREATEST(COALESCE(v_profile.plan_expires_at, now()), now()) + INTERVAL '30 days';

  -- 5. Atomic Entitlement Extension
  UPDATE public.profiles
     SET plan = 'premium',
         plan_expires_at = v_new_expires,
         plan_updated_at = now()
   WHERE id = p_target_user_id;

  -- 6. Atomic Audit Entry
  INSERT INTO public.admin_plan_actions (
    admin_email,
    target_user_id,
    target_email,
    action_type,
    old_plan,
    new_plan,
    old_plan_expires_at,
    new_plan_expires_at,
    reason
  ) VALUES (
    'stripe-webhook',
    p_target_user_id,
    v_profile.email,
    'extend_premium_30',
    v_profile.plan,
    'premium',
    v_profile.plan_expires_at,
    v_new_expires,
    'Stripe Checkout checkout_v1 automatic fulfillment: ' || p_stripe_event_id
  );

  RETURN jsonb_build_object('outcome', 'processed');
END;
$function$;
-- END CANONICAL FUNCTION fulfill_stripe_premium_payment

-- BEGIN CANONICAL FUNCTION_ACL fulfill_stripe_premium_payment
ALTER FUNCTION public."fulfill_stripe_premium_payment"(p_stripe_event_id text, p_stripe_session_id text, p_target_user_id uuid, p_event_type text, p_amount_total bigint, p_currency text, p_payment_status text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."fulfill_stripe_premium_payment"(p_stripe_event_id text, p_stripe_session_id text, p_target_user_id uuid, p_event_type text, p_amount_total bigint, p_currency text, p_payment_status text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."fulfill_stripe_premium_payment"(p_stripe_event_id text, p_stripe_session_id text, p_target_user_id uuid, p_event_type text, p_amount_total bigint, p_currency text, p_payment_status text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."fulfill_stripe_premium_payment"(p_stripe_event_id text, p_stripe_session_id text, p_target_user_id uuid, p_event_type text, p_amount_total bigint, p_currency text, p_payment_status text) TO "service_role";
COMMENT ON FUNCTION public."fulfill_stripe_premium_payment"(p_stripe_event_id text, p_stripe_session_id text, p_target_user_id uuid, p_event_type text, p_amount_total bigint, p_currency text, p_payment_status text) IS 'Securely and atomically fulfills Stripe Premium 30 days payments via Checkout checkout_v1.
   Enforces idempotency, safe concurrent distinct payments (FOR UPDATE lock), prevents Family downgrade,
   and writes atomic audit log. Callable only by service_role.';
-- END CANONICAL FUNCTION_ACL fulfill_stripe_premium_payment

-- BEGIN CANONICAL FUNCTION get_my_effective_plan
CREATE OR REPLACE FUNCTION public.get_my_effective_plan()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_own_plan text;
  v_own_expires timestamptz;
  v_parent_plan text;
  v_parent_expires timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- A. Pobierz profil własny
  SELECT plan, plan_expires_at
    INTO v_own_plan, v_own_expires
    FROM public.profiles
   WHERE id = v_user_id;

  -- B. Jeśli własny plan jest aktywnym premium/family -> zwróć go
  -- NOTE: plan_expires_at IS NULL traktujemy jako aktywny (przypadek ręcznej aktywacji przez admina bez daty).
  IF v_own_plan IN ('premium', 'family') AND (v_own_expires IS NULL OR v_own_expires > v_now) THEN
    RETURN jsonb_build_object(
      'effective_plan', v_own_plan,
      'raw_plan', v_own_plan,
      'plan_source', 'own',
      'inherited_from_parent', false,
      'plan_expires_at', v_own_expires,
      'source_plan_expires_at', v_own_expires
    );
  END IF;

  -- Family inheritance requires a trusted relation and a real parent profile.
  SELECT p.plan, p.plan_expires_at
    INTO v_parent_plan, v_parent_expires
    FROM public.child_profiles cp
    JOIN public.profiles p ON cp.parent_user_id = p.id
   WHERE cp.child_user_id = v_user_id
     AND cp.status IN ('linked', 'active')
     AND cp.preapproval_integrity_version = 1
     AND cp.parent_user_id <> v_user_id
     AND cp.guardian_consent_acknowledged_at IS NOT NULL
     AND cp.guardian_consent_version = 'child_email_preapproval_v1'
     AND p.user_role = 'parent'
     AND p.plan = 'family'
     AND (p.plan_expires_at IS NULL OR p.plan_expires_at > v_now)
   LIMIT 1;

  IF v_parent_plan IS NOT NULL THEN
    RETURN jsonb_build_object(
      'effective_plan', 'family',
      'raw_plan', v_own_plan,
      'plan_source', 'parent_family',
      'inherited_from_parent', true,
      'plan_expires_at', v_parent_expires,
      'source_plan_expires_at', v_parent_expires
    );
  END IF;

  -- D. Fallback do planu darmowego
  RETURN jsonb_build_object(
    'effective_plan', 'free',
    'raw_plan', v_own_plan,
    'plan_source', 'own',
    'inherited_from_parent', false,
    'plan_expires_at', v_own_expires,
    'source_plan_expires_at', v_own_expires
  );
END;
$function$;
-- END CANONICAL FUNCTION get_my_effective_plan

-- BEGIN CANONICAL FUNCTION_ACL get_my_effective_plan
ALTER FUNCTION public."get_my_effective_plan"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."get_my_effective_plan"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."get_my_effective_plan"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."get_my_effective_plan"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."get_my_effective_plan"() TO "service_role";
COMMENT ON FUNCTION public."get_my_effective_plan"() IS 'Zwraca efektywny plan zalogowanego użytkownika, uwzględniając dziedziczenie (Sprint 23A Hardened).';
-- END CANONICAL FUNCTION_ACL get_my_effective_plan

-- BEGIN CANONICAL FUNCTION get_parent_children
CREATE OR REPLACE FUNCTION public.get_parent_children()
 RETURNS TABLE(child_source text, child_profile_id uuid, consent_id uuid, consent_status text, consent_created_at timestamp with time zone, consent_updated_at timestamp with time zone, consent_approved_at timestamp with time zone, child_user_id uuid, safe_child_name text, child_email_masked text, education_level text, school_type text, grade_level text, profile_completed boolean, last_login_at timestamp with time zone, age_band text, status_label text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_parent_email text;
    v_parent_id uuid;
BEGIN
    v_parent_email := auth.jwt() ->> 'email';
    v_parent_id := auth.uid();

    IF v_parent_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.profiles caller
        WHERE caller.id = v_parent_id AND caller.user_role = 'parent'
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    -- Part 1: Children 13-15 via parental_consents
    SELECT
        'consent'::text AS child_source,
        NULL::uuid AS child_profile_id,
        pc.id AS consent_id,
        pc.consent_status,
        pc.consent_created_at,
        pc.updated_at AS consent_updated_at,
        pc.consent_approved_at,
        CASE WHEN pc.consent_status = 'approved' THEN pc.child_user_id ELSE NULL END AS child_user_id,
        CASE WHEN pc.consent_status = 'approved' THEN COALESCE(p.name, 'Uczeń') ELSE NULL END AS safe_child_name,
        CASE
            WHEN pc.consent_status = 'approved' AND p.email IS NOT NULL AND position('@' IN p.email) > 1 THEN
                substr(p.email, 1, 1) || '***@' || split_part(p.email, '@', 2)
            ELSE NULL
        END AS child_email_masked,
        CASE WHEN pc.consent_status = 'approved' THEN p.education_level ELSE NULL END AS education_level,
        CASE WHEN pc.consent_status = 'approved' THEN p.school_type ELSE NULL END AS school_type,
        CASE WHEN pc.consent_status = 'approved' THEN p.grade_level ELSE NULL END AS grade_level,
        CASE WHEN pc.consent_status = 'approved' THEN p.profile_completed ELSE NULL END AS profile_completed,
        NULL::timestamptz AS last_login_at,
        CASE WHEN pc.consent_status = 'approved' THEN p.age_band ELSE NULL END AS age_band,
        CASE pc.consent_status
            WHEN 'approved'  THEN 'Zgoda aktywna'
            WHEN 'pending'   THEN 'Oczekuje na potwierdzenie'
            WHEN 'withdrawn' THEN 'Zgoda cofnięta'
            ELSE pc.consent_status
        END AS status_label
    FROM public.parental_consents pc
    LEFT JOIN public.profiles p ON pc.child_user_id = p.id
    WHERE pc.parent_email IS NOT NULL
      AND lower(trim(pc.parent_email)) = lower(trim(v_parent_email))

    UNION ALL

    -- Part 2: Pre-approved children <13 via child_profiles
    SELECT
        'local_preapproved'::text AS child_source,
        cp.id AS child_profile_id,
        NULL::uuid AS consent_id,
        cp.status AS consent_status,
        cp.created_at AS consent_created_at,
        cp.updated_at AS consent_updated_at,
        cp.guardian_consent_acknowledged_at AS consent_approved_at,
        cp.child_user_id AS child_user_id,
        cp.display_name AS safe_child_name,
        CASE
            WHEN cp.child_email IS NOT NULL AND position('@' IN cp.child_email) > 1 THEN
                substr(cp.child_email, 1, 1) || '***@' || split_part(cp.child_email, '@', 2)
            ELSE NULL
        END AS child_email_masked,
        cp.education_level AS education_level,
        cp.school_type AS school_type,
        cp.grade_level AS grade_level,
        (cp.status = 'linked' OR cp.status = 'active') AS profile_completed,
        NULL::timestamptz AS last_login_at,
        cp.age_band AS age_band,
        CASE cp.status
            WHEN 'pending_child_registration' THEN 'Oczekuje na rejestrację dziecka'
            WHEN 'linked'                     THEN 'Konto dziecka połączone'
            WHEN 'active'                     THEN 'Profil dziecka aktywny'
            WHEN 'archived'                   THEN 'Profil zarchiwizowany'
            ELSE cp.status
        END AS status_label
    FROM public.child_profiles cp
    WHERE cp.parent_user_id = v_parent_id
      AND cp.preapproval_integrity_version = 1;
END;
$function$;
-- END CANONICAL FUNCTION get_parent_children

-- BEGIN CANONICAL FUNCTION_ACL get_parent_children
ALTER FUNCTION public."get_parent_children"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."get_parent_children"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."get_parent_children"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."get_parent_children"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."get_parent_children"() TO "service_role";
-- END CANONICAL FUNCTION_ACL get_parent_children

-- BEGIN CANONICAL FUNCTION handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(NEW.raw_user_meta_data->>'user_role', 'student');
  v_age_band text := NEW.raw_user_meta_data->>'ageBand';
  v_status text;
BEGIN
  -- Signup offers student and parent only. Other profile roles are not signup
  -- privileges. Invalid/mismatched metadata rejects signup instead of widening access.
  IF v_role NOT IN ('student', 'parent') THEN
    RAISE EXCEPTION 'Invalid signup role' USING ERRCODE = '22023';
  END IF;
  IF v_age_band IS NULL
     OR (v_role = 'parent' AND v_age_band <> 'parent')
     OR (v_role = 'student' AND v_age_band NOT IN ('under_13', '13_15', '16_17', '18_plus')) THEN
    RAISE EXCEPTION 'Invalid signup age band' USING ERRCODE = '22023';
  END IF;

  v_status := CASE v_age_band
    WHEN 'under_13' THEN 'pending_parent_preapproval'
    WHEN '13_15' THEN 'pending_parent_consent'
    ELSE 'active'
  END;

  -- accountStatus and plan metadata are deliberately ignored.
  INSERT INTO public.profiles
    (id, email, name, user_role, age_band, account_status, plan, pending_preapproval_since)
  VALUES
    (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', v_role, v_age_band,
     v_status, 'free', CASE WHEN v_age_band = 'under_13' THEN now() ELSE NULL END);
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION handle_new_user

-- BEGIN CANONICAL FUNCTION_ACL handle_new_user
ALTER FUNCTION public."handle_new_user"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."handle_new_user"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."handle_new_user"() TO "service_role";
-- END CANONICAL FUNCTION_ACL handle_new_user

-- BEGIN CANONICAL FUNCTION handle_thread_last_message
CREATE OR REPLACE FUNCTION public.handle_thread_last_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.tutor_threads 
  SET last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION handle_thread_last_message

-- BEGIN CANONICAL FUNCTION_ACL handle_thread_last_message
ALTER FUNCTION public."handle_thread_last_message"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."handle_thread_last_message"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."handle_thread_last_message"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."handle_thread_last_message"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."handle_thread_last_message"() TO "anon";
GRANT EXECUTE ON FUNCTION public."handle_thread_last_message"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."handle_thread_last_message"() TO "service_role";
-- END CANONICAL FUNCTION_ACL handle_thread_last_message

-- BEGIN CANONICAL FUNCTION handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION handle_updated_at

-- BEGIN CANONICAL FUNCTION_ACL handle_updated_at
ALTER FUNCTION public."handle_updated_at"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."handle_updated_at"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."handle_updated_at"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."handle_updated_at"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."handle_updated_at"() TO "anon";
GRANT EXECUTE ON FUNCTION public."handle_updated_at"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."handle_updated_at"() TO "service_role";
-- END CANONICAL FUNCTION_ACL handle_updated_at

-- BEGIN CANONICAL FUNCTION link_child_account
CREATE OR REPLACE FUNCTION public.link_child_account()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := auth.jwt()->>'email';
  v_age_band text;
  v_status text;
  v_child_role text;
  v_pending_preapproval_since timestamptz;
  v_created_at timestamptz;
  v_matched_id uuid;
BEGIN
  IF v_user_id IS NULL OR v_user_email IS NULL OR btrim(v_user_email) = '' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'unauthenticated');
  END IF;

  SELECT p.age_band, p.account_status, p.user_role, p.pending_preapproval_since, p.created_at
  INTO v_age_band, v_status, v_child_role, v_pending_preapproval_since, v_created_at
  FROM public.profiles p WHERE p.id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'profile_unavailable');
  END IF;
  IF v_age_band IS DISTINCT FROM 'under_13' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'not_under_13');
  END IF;
  IF v_child_role IS DISTINCT FROM 'student'
     OR v_status IS NULL OR v_status NOT IN ('pending_parent_preapproval', 'active') THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
  END IF;

  -- Deadline is checked after the profile lock, before any parental relation write.
  -- Wall-clock time prevents a transaction started before the deadline extending it.
  IF v_status = 'pending_parent_preapproval'
     AND COALESCE(v_pending_preapproval_since, v_created_at) IS NULL THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_clock_unavailable');
  END IF;
  IF v_status = 'pending_parent_preapproval'
     AND COALESCE(v_pending_preapproval_since, v_created_at) <= clock_timestamp() - interval '7 days' THEN
    UPDATE public.profiles SET account_status = 'expired_pending_preapproval'
    WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
      AND account_status = 'pending_parent_preapproval';
    IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_window_expired');
  END IF;

  SELECT cp.id INTO v_matched_id
  FROM public.child_profiles cp
  JOIN public.profiles parent ON parent.id = cp.parent_user_id
  WHERE cp.child_user_id = v_user_id AND cp.status IN ('linked', 'active')
    AND cp.preapproval_integrity_version = 1
    AND parent.user_role = 'parent' AND cp.parent_user_id <> v_user_id
    AND cp.guardian_consent_acknowledged_at IS NOT NULL
    AND cp.guardian_consent_version = 'child_email_preapproval_v1'
  ORDER BY cp.id LIMIT 1 FOR UPDATE OF cp;
  IF FOUND THEN
    IF v_status = 'pending_parent_preapproval' THEN
      UPDATE public.profiles
      SET account_status = CASE
        WHEN COALESCE(pending_preapproval_since, created_at) <= clock_timestamp() - interval '7 days'
          THEN 'expired_pending_preapproval'
        ELSE 'active'
      END
      WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
        AND account_status = 'pending_parent_preapproval'
      RETURNING account_status INTO v_status;
      IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
      IF v_status = 'expired_pending_preapproval' THEN
        RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_window_expired');
      END IF;
    END IF;
    RETURN jsonb_build_object('linked', true, 'reason', 'already_linked');
  END IF;

  IF v_status <> 'pending_parent_preapproval' THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'account_not_eligible');
  END IF;

  SELECT cp.id INTO v_matched_id
  FROM public.child_profiles cp
  JOIN public.profiles parent ON parent.id = cp.parent_user_id
  WHERE cp.child_email_normalized = lower(btrim(v_user_email))
    AND cp.status = 'pending_child_registration' AND cp.child_user_id IS NULL
    AND cp.preapproval_integrity_version = 1
    AND parent.user_role = 'parent' AND cp.parent_user_id <> v_user_id
    AND cp.guardian_consent_acknowledged_at IS NOT NULL
    AND cp.guardian_consent_version = 'child_email_preapproval_v1'
  ORDER BY cp.created_at, cp.id LIMIT 1 FOR UPDATE OF cp;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
  END IF;

  -- The relation lock/its triggers can wait across the deadline. The nested
  -- transaction rolls back tentative binding if the final activation is too late.
  BEGIN
    UPDATE public.child_profiles cp
    SET child_user_id = v_user_id, status = 'linked', updated_at = now()
    WHERE cp.id = v_matched_id AND cp.child_user_id IS NULL
      AND cp.status = 'pending_child_registration'
      AND cp.preapproval_integrity_version = 1
      AND cp.child_email_normalized = lower(btrim(v_user_email))
      AND cp.guardian_consent_acknowledged_at IS NOT NULL
      AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      AND EXISTS (
        SELECT 1 FROM public.profiles parent
        WHERE parent.id = cp.parent_user_id AND parent.user_role = 'parent'
          AND parent.id <> v_user_id
      );
    IF NOT FOUND THEN
      RETURN jsonb_build_object('linked', false, 'reason', 'no_preapproval');
    END IF;

    UPDATE public.profiles
    SET account_status = CASE
      WHEN COALESCE(pending_preapproval_since, created_at) <= clock_timestamp() - interval '7 days'
        THEN 'expired_pending_preapproval'
      ELSE 'active'
    END
    WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
      AND account_status = 'pending_parent_preapproval'
    RETURNING account_status INTO v_status;
    IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
    IF v_status = 'expired_pending_preapproval' THEN
      -- Roll back this block's tentative relation write before returning expiry.
      RAISE EXCEPTION 'Preapproval window expired' USING ERRCODE = 'P1307';
    END IF;
  EXCEPTION WHEN SQLSTATE 'P1307' THEN
    UPDATE public.profiles SET account_status = 'expired_pending_preapproval'
    WHERE id = v_user_id AND age_band = 'under_13' AND user_role = 'student'
      AND account_status = 'pending_parent_preapproval';
    IF NOT FOUND THEN RAISE EXCEPTION 'Child account transition rejected'; END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'preapproval_window_expired');
  END;
  RETURN jsonb_build_object('linked', true, 'reason', 'linked_now');
END;
$function$;
-- END CANONICAL FUNCTION link_child_account

-- BEGIN CANONICAL FUNCTION_ACL link_child_account
ALTER FUNCTION public."link_child_account"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."link_child_account"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."link_child_account"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."link_child_account"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."link_child_account"() TO "service_role";
-- END CANONICAL FUNCTION_ACL link_child_account

-- BEGIN CANONICAL FUNCTION prepare_under13_parent_reminder
CREATE OR REPLACE FUNCTION public.prepare_under13_parent_reminder(p_event_id uuid, p_claim_token uuid, p_recipient_hash text, p_payload_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_event public.under13_parent_notifications%ROWTYPE;
  v_child_id uuid;
  v_context record;
  v_now timestamptz;
  v_reason text;
BEGIN
  SELECT child_user_id INTO v_child_id FROM public.under13_parent_notifications WHERE id = p_event_id;
  PERFORM 1 FROM public.profiles WHERE id = v_child_id FOR UPDATE;
  SELECT * INTO v_event FROM public.under13_parent_notifications WHERE id = p_event_id FOR UPDATE;
  v_now := clock_timestamp();
  IF NOT FOUND OR v_event.status <> 'claimed' OR v_event.claim_token IS DISTINCT FROM p_claim_token
     OR v_event.lease_expires_at <= v_now THEN RETURN jsonb_build_object('allowed', false, 'status', 'stale_claim'); END IF;
  SELECT * INTO v_context FROM public.under13_parent_reminder_context(v_child_id);
  v_now := clock_timestamp();
  IF v_event.lease_expires_at <= v_now THEN RETURN jsonb_build_object('allowed', false, 'status', 'stale_claim'); END IF;
  IF v_event.retention_deadline_at <= v_now THEN v_reason := 'deadline_passed';
  ELSIF v_context.parent_id IS NULL OR v_context.parent_id <> v_event.parent_user_id
    OR v_context.relation_id <> v_event.child_profile_id OR v_context.deadline_at <> v_event.retention_deadline_at
    THEN v_reason := 'relationship_no_longer_valid';
  ELSIF p_recipient_hash IS NULL OR p_recipient_hash !~ '^[0-9a-f]{64}$'
    OR p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64}$'
    THEN RETURN jsonb_build_object('allowed', false, 'status', 'invalid_hash');
  ELSIF v_event.recipient_email_hash IS NOT NULL AND v_event.recipient_email_hash <> p_recipient_hash
    THEN v_reason := 'recipient_changed';
  ELSIF v_event.payload_hash IS NOT NULL AND v_event.payload_hash <> p_payload_hash
    THEN v_reason := 'payload_changed';
  END IF;
  IF v_reason IS NOT NULL THEN
    UPDATE public.under13_parent_notifications SET status = 'cancelled', safe_error_category = v_reason,
      claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('allowed', false, 'status', 'cancelled');
  END IF;
  IF v_event.attempt_count >= 3 OR v_event.first_attempt_at + interval '6 hours' <= v_now THEN
    UPDATE public.under13_parent_notifications SET status = 'delivery_unknown', safe_error_category = 'retry_window_exhausted',
      claim_token = NULL, lease_expires_at = NULL, updated_at = v_now WHERE id = p_event_id;
    RETURN jsonb_build_object('allowed', false, 'status', 'delivery_unknown');
  END IF;
  IF v_event.next_attempt_at > v_now THEN RETURN jsonb_build_object('allowed', false, 'status', 'not_due'); END IF;
  -- Reserve before HTTP: a crash here consumes an attempt conservatively, not an extra send.
  UPDATE public.under13_parent_notifications SET
    recipient_email_hash = COALESCE(recipient_email_hash, p_recipient_hash),
    payload_hash = COALESCE(payload_hash, p_payload_hash),
    attempt_count = attempt_count + 1, first_attempt_at = COALESCE(first_attempt_at, v_now),
    last_attempt_at = v_now,
    next_attempt_at = v_now + CASE WHEN attempt_count = 0 THEN interval '15 minutes' ELSE interval '60 minutes' END,
    updated_at = v_now WHERE id = p_event_id;
  RETURN jsonb_build_object('allowed', true, 'status', 'claimed',
    'send_before', LEAST(v_event.retention_deadline_at, COALESCE(v_event.first_attempt_at, v_now) + interval '6 hours', v_event.lease_expires_at));
END;
$function$;
-- END CANONICAL FUNCTION prepare_under13_parent_reminder

-- BEGIN CANONICAL FUNCTION_ACL prepare_under13_parent_reminder
ALTER FUNCTION public."prepare_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_recipient_hash text, p_payload_hash text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."prepare_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_recipient_hash text, p_payload_hash text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."prepare_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_recipient_hash text, p_payload_hash text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."prepare_under13_parent_reminder"(p_event_id uuid, p_claim_token uuid, p_recipient_hash text, p_payload_hash text) TO "service_role";
-- END CANONICAL FUNCTION_ACL prepare_under13_parent_reminder

-- BEGIN CANONICAL FUNCTION protect_child_profile_authorization
CREATE OR REPLACE FUNCTION public.protect_child_profile_authorization()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY DEFINER linker runs as its explicitly pinned postgres owner.
  -- Backend writes and FK referential actions must retain CASCADE/SET NULL.
  -- JWT role stays authenticated during RPC, so it is not a bypass discriminator.
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF current_user <> 'authenticated' OR auth.uid() IS NULL
     OR NEW.parent_user_id IS DISTINCT FROM auth.uid()
     OR NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_role = 'parent'
     ) THEN
    RAISE EXCEPTION 'Child profile operation not permitted' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.child_user_id IS NOT NULL
       OR NEW.status IS DISTINCT FROM 'pending_child_registration'
       OR NEW.age_band IS NULL OR NEW.age_band NOT IN ('7_9', '10_12')
       OR NEW.child_email IS NULL OR btrim(NEW.child_email) = ''
       OR NEW.guardian_consent_acknowledged_at IS NULL THEN
      RAISE EXCEPTION 'Invalid child preapproval' USING ERRCODE = '42501';
    END IF;

    -- Timestamp presence is the existing UI's declaration, not a trusted time.
    NEW.child_email_normalized := lower(btrim(NEW.child_email));
    NEW.guardian_consent_acknowledged_at := now();
    NEW.guardian_consent_version := 'child_email_preapproval_v1';
    NEW.preapproval_integrity_version := 1;
    NEW.created_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Current UI only archives a pending record; all other fields stay immutable.
  -- Comparing the entire row also protects any additional legacy columns.
  IF OLD.parent_user_id IS DISTINCT FROM auth.uid()
     OR (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
    RAISE EXCEPTION 'Child profile fields are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IS DISTINCT FROM 'pending_child_registration'
     OR OLD.child_user_id IS NOT NULL
     OR OLD.preapproval_integrity_version IS DISTINCT FROM 1
     OR NEW.status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION 'Child profile transition not permitted' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION protect_child_profile_authorization

-- BEGIN CANONICAL FUNCTION_ACL protect_child_profile_authorization
ALTER FUNCTION public."protect_child_profile_authorization"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."protect_child_profile_authorization"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."protect_child_profile_authorization"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."protect_child_profile_authorization"() TO "service_role";
-- END CANONICAL FUNCTION_ACL protect_child_profile_authorization

-- BEGIN CANONICAL FUNCTION protect_sensitive_profile_fields
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Block direct client-side updates from the anon or authenticated roles.
  -- These are the only two roles that can issue direct REST API calls to the
  -- profiles table via the Supabase client library.
  --
  -- current_user is the PostgreSQL role currently executing this code.
  -- For direct REST/client calls: 'anon' or 'authenticated'.
  -- For SECURITY DEFINER function calls: 'postgres' or 'supabase_admin' (owner).
  -- For service_role direct calls: 'service_role'.
  --
  -- We block on both 'anon' and 'authenticated' as a belt-and-suspenders measure,
  -- even though anon should not have UPDATE access to profiles in the first place.
  IF current_user IN ('anon', 'authenticated') THEN

    -- Silently revert sensitive fields to their existing values.
    -- This approach (revert rather than ERROR) is deliberately chosen:
    --   - It does not break legitimate partial updates (e.g. updating only name).
    --   - It does not leak information about which field was blocked.
    --   - It matches the pattern used in the original protect_plan_fields (00060).
    NEW.user_role      := OLD.user_role;
    NEW.account_status := OLD.account_status;
    NEW.age_band       := OLD.age_band;
    NEW.plan           := OLD.plan;
    NEW.plan_expires_at := OLD.plan_expires_at;
    NEW.plan_updated_at := OLD.plan_updated_at;

  END IF;

  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION protect_sensitive_profile_fields

-- BEGIN CANONICAL FUNCTION_ACL protect_sensitive_profile_fields
ALTER FUNCTION public."protect_sensitive_profile_fields"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."protect_sensitive_profile_fields"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."protect_sensitive_profile_fields"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."protect_sensitive_profile_fields"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."protect_sensitive_profile_fields"() TO "anon";
GRANT EXECUTE ON FUNCTION public."protect_sensitive_profile_fields"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."protect_sensitive_profile_fields"() TO "service_role";
COMMENT ON FUNCTION public."protect_sensitive_profile_fields"() IS 'Sprint 24A.1 Security P0 fix.
   Replaces protect_plan_fields() from Sprint 18C (migration 00060).
   Prevents direct client-side updates from changing sensitive profile fields:
     user_role, account_status, age_band, plan, plan_expires_at, plan_updated_at.
   Detection: current_user IN (''anon'', ''authenticated'').
   SECURITY INVOKER is intentional -- current_user must reflect the caller, not the owner.
   SECURITY DEFINER functions (approve_parental_consent, link_child_account,
   admin_extend_plan_30_days) run as ''postgres'' and are NOT blocked.
   service_role direct calls run as ''service_role'' and are NOT blocked.
   Blocked: direct REST UPDATE from anon or authenticated Supabase client calls.';
-- END CANONICAL FUNCTION_ACL protect_sensitive_profile_fields

-- BEGIN CANONICAL FUNCTION protect_under13_retention_deadline
CREATE OR REPLACE FUNCTION public.protect_under13_retention_deadline()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND OLD.age_band = 'under_13' THEN
    NEW.pending_preapproval_since := OLD.pending_preapproval_since;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION protect_under13_retention_deadline

-- BEGIN CANONICAL FUNCTION_ACL protect_under13_retention_deadline
ALTER FUNCTION public."protect_under13_retention_deadline"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."protect_under13_retention_deadline"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."protect_under13_retention_deadline"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."protect_under13_retention_deadline"() TO "service_role";
-- END CANONICAL FUNCTION_ACL protect_under13_retention_deadline

-- BEGIN CANONICAL FUNCTION set_updated_at_column
CREATE OR REPLACE FUNCTION public.set_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;
-- END CANONICAL FUNCTION set_updated_at_column

-- BEGIN CANONICAL FUNCTION_ACL set_updated_at_column
ALTER FUNCTION public."set_updated_at_column"() OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."set_updated_at_column"() FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."set_updated_at_column"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public."set_updated_at_column"() TO "postgres";
GRANT EXECUTE ON FUNCTION public."set_updated_at_column"() TO "anon";
GRANT EXECUTE ON FUNCTION public."set_updated_at_column"() TO "authenticated";
GRANT EXECUTE ON FUNCTION public."set_updated_at_column"() TO "service_role";
-- END CANONICAL FUNCTION_ACL set_updated_at_column

-- BEGIN CANONICAL FUNCTION under13_parent_reminder_context
CREATE OR REPLACE FUNCTION public.under13_parent_reminder_context(p_child_id uuid)
 RETURNS TABLE(parent_id uuid, relation_id uuid, deadline_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT q.parent_id, q.relation_id, q.deadline_at FROM (
    SELECT cp.parent_user_id AS parent_id, cp.id AS relation_id,
      COALESCE(p.pending_preapproval_since, p.created_at) + interval '7 days' AS deadline_at,
      count(*) OVER () AS qualifying_parent_count
    FROM public.profiles p
    JOIN auth.users child_auth ON child_auth.id = p.id
    JOIN public.child_profiles cp
      ON cp.child_email_normalized = lower(btrim(child_auth.email))
    JOIN public.profiles parent ON parent.id = cp.parent_user_id
    WHERE p.id = p_child_id AND p.age_band = 'under_13' AND p.user_role = 'student'
      AND p.account_status = 'pending_parent_preapproval'
      AND COALESCE(p.pending_preapproval_since, p.created_at) IS NOT NULL
      AND clock_timestamp() >= COALESCE(p.pending_preapproval_since, p.created_at) + interval '5 days'
      AND clock_timestamp() < COALESCE(p.pending_preapproval_since, p.created_at) + interval '7 days'
      AND child_auth.email IS NOT NULL AND btrim(child_auth.email) <> ''
      AND cp.status = 'pending_child_registration' AND cp.child_user_id IS NULL
      AND cp.preapproval_integrity_version = 1
      AND cp.guardian_consent_acknowledged_at IS NOT NULL
      AND cp.guardian_consent_version = 'child_email_preapproval_v1'
      AND parent.user_role = 'parent' AND parent.id <> p.id
      -- Additional sending safety: do not contact a suspended/withdrawn parent.
      AND parent.account_status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.child_profiles linked
        JOIN public.profiles linked_parent ON linked_parent.id = linked.parent_user_id
        WHERE linked.child_user_id = p.id AND linked.status IN ('linked', 'active')
          AND linked.preapproval_integrity_version = 1
          AND linked_parent.user_role = 'parent' AND linked.parent_user_id <> p.id
          AND linked.guardian_consent_acknowledged_at IS NOT NULL
          AND linked.guardian_consent_version = 'child_email_preapproval_v1'
      )
  ) q WHERE q.qualifying_parent_count = 1;
$function$;
-- END CANONICAL FUNCTION under13_parent_reminder_context

-- BEGIN CANONICAL FUNCTION_ACL under13_parent_reminder_context
ALTER FUNCTION public."under13_parent_reminder_context"(p_child_id uuid) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."under13_parent_reminder_context"(p_child_id uuid) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."under13_parent_reminder_context"(p_child_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public."under13_parent_reminder_context"(p_child_id uuid) TO "service_role";
-- END CANONICAL FUNCTION_ACL under13_parent_reminder_context

-- BEGIN CANONICAL FUNCTION verify_consent_token
CREATE OR REPLACE FUNCTION public.verify_consent_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status text;
  v_expires_at timestamptz;
  v_child_name text;
  v_account_status text;
  v_age_band text;
  v_result text := 'invalid';
BEGIN
  IF p_token IS NULL OR p_token !~ '^([0-9a-f]{64}|[0-9a-f]{72})$' THEN
    RETURN jsonb_build_object('status', 'invalid', 'can_approve', false, 'child_name', NULL);
  END IF;

  SELECT pc.consent_status, pc.token_expires_at, COALESCE(p.name, 'Uczeń'),
         p.account_status, p.age_band
  INTO v_status, v_expires_at, v_child_name, v_account_status, v_age_band
  FROM public.parental_consents pc
  JOIN public.profiles p ON p.id = pc.child_user_id
  WHERE pc.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  LIMIT 1;

  IF v_status = 'approved' THEN
    v_result := 'already_approved';
  ELSIF v_status = 'pending' THEN
    IF v_expires_at <= clock_timestamp() THEN
      v_result := 'expired';
    ELSIF v_expires_at > clock_timestamp()
          AND v_account_status = 'pending_parent_consent' AND v_age_band = '13_15' THEN
      v_result := 'valid';
    END IF;
  END IF;

  RETURN jsonb_build_object('status', v_result, 'can_approve', v_result = 'valid',
    'child_name', CASE WHEN v_result = 'valid' THEN v_child_name ELSE NULL END);
END;
$function$;
-- END CANONICAL FUNCTION verify_consent_token

-- BEGIN CANONICAL FUNCTION_ACL verify_consent_token
ALTER FUNCTION public."verify_consent_token"(p_token text) OWNER TO "postgres";
REVOKE ALL PRIVILEGES ON FUNCTION public."verify_consent_token"(p_token text) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public."verify_consent_token"(p_token text) TO "postgres";
GRANT EXECUTE ON FUNCTION public."verify_consent_token"(p_token text) TO "anon";
GRANT EXECUTE ON FUNCTION public."verify_consent_token"(p_token text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public."verify_consent_token"(p_token text) TO "service_role";
COMMENT ON FUNCTION public."verify_consent_token"(p_token text) IS 'Sprint 24A.1 Security P0 fix.
   Accepts the raw consent URL token, hashes it server-side via extensions.digest (pgcrypto SHA-256),
   and returns a minimal UI payload: status, can_approve, child_name.
   Never returns: token_hash, parent_email, ip_address, full consent record, child_user_id.
   Replaces direct SELECT on parental_consents which had a USING(true) public SELECT policy.
   Callable by: anon (public consent link), authenticated (logged-in parent), service_role.';
-- END CANONICAL FUNCTION_ACL verify_consent_token

-- BEGIN CANONICAL TRIGGER on_auth_user_created
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- END CANONICAL TRIGGER on_auth_user_created

-- BEGIN CANONICAL TRIGGER enforce_child_limit
CREATE TRIGGER enforce_child_limit BEFORE INSERT OR UPDATE OF parent_user_id, status ON public.child_profiles FOR EACH ROW EXECUTE FUNCTION check_child_limit();
-- END CANONICAL TRIGGER enforce_child_limit

-- BEGIN CANONICAL TRIGGER protect_child_profile_authorization_trigger
CREATE TRIGGER protect_child_profile_authorization_trigger BEFORE INSERT OR UPDATE ON public.child_profiles FOR EACH ROW EXECUTE FUNCTION protect_child_profile_authorization();
-- END CANONICAL TRIGGER protect_child_profile_authorization_trigger

-- BEGIN CANONICAL TRIGGER trg_check_folder_circularity
CREATE TRIGGER trg_check_folder_circularity BEFORE INSERT OR UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION check_folder_circularity();
-- END CANONICAL TRIGGER trg_check_folder_circularity

-- BEGIN CANONICAL TRIGGER protect_sensitive_profile_fields_trigger
CREATE TRIGGER protect_sensitive_profile_fields_trigger BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_sensitive_profile_fields();
-- END CANONICAL TRIGGER protect_sensitive_profile_fields_trigger

-- BEGIN CANONICAL TRIGGER protect_under13_retention_deadline
CREATE TRIGGER protect_under13_retention_deadline BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_under13_retention_deadline();
-- END CANONICAL TRIGGER protect_under13_retention_deadline

-- BEGIN CANONICAL TRIGGER trg_study_sessions_updated_at
CREATE TRIGGER trg_study_sessions_updated_at BEFORE UPDATE ON public.study_sessions FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
-- END CANONICAL TRIGGER trg_study_sessions_updated_at

-- BEGIN CANONICAL TRIGGER trg_support_tickets_updated_at
CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
-- END CANONICAL TRIGGER trg_support_tickets_updated_at

-- BEGIN CANONICAL TRIGGER trg_tutor_messages_update_thread
CREATE TRIGGER trg_tutor_messages_update_thread AFTER INSERT ON public.tutor_messages FOR EACH ROW EXECUTE FUNCTION handle_thread_last_message();
-- END CANONICAL TRIGGER trg_tutor_messages_update_thread

-- BEGIN CANONICAL VIEW v_under13_pending_cleanup_candidates
CREATE VIEW public."v_under13_pending_cleanup_candidates" AS
SELECT id AS profile_id,
    email,
    age_band,
    account_status,
    pending_preapproval_since,
    created_at,
    now() - COALESCE(pending_preapproval_since, created_at) AS time_pending
   FROM profiles p
  WHERE age_band = 'under_13'::text AND account_status = 'pending_parent_preapproval'::text AND COALESCE(pending_preapproval_since, created_at) <= (now() - '7 days'::interval) AND NOT (EXISTS ( SELECT 1
           FROM child_profiles cp
             JOIN profiles parent ON parent.id = cp.parent_user_id
          WHERE cp.child_user_id = p.id AND (cp.status = ANY (ARRAY['linked'::text, 'active'::text])) AND cp.preapproval_integrity_version = 1 AND parent.user_role = 'parent'::text AND cp.parent_user_id <> p.id AND cp.guardian_consent_acknowledged_at IS NOT NULL AND cp.guardian_consent_version = 'child_email_preapproval_v1'::text));
ALTER VIEW public."v_under13_pending_cleanup_candidates" OWNER TO "postgres";
-- END CANONICAL VIEW v_under13_pending_cleanup_candidates

-- BEGIN CANONICAL VIEW_ACL v_under13_pending_cleanup_candidates
REVOKE ALL PRIVILEGES ON TABLE public."v_under13_pending_cleanup_candidates" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."v_under13_pending_cleanup_candidates" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."v_under13_pending_cleanup_candidates" TO "service_role";
-- END CANONICAL VIEW_ACL v_under13_pending_cleanup_candidates

-- BEGIN CANONICAL RLS admin_plan_actions
ALTER TABLE public."admin_plan_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."admin_plan_actions" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS admin_plan_actions

-- BEGIN CANONICAL RLS child_profiles
ALTER TABLE public."child_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."child_profiles" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS child_profiles

-- BEGIN CANONICAL RLS folders
ALTER TABLE public."folders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."folders" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS folders

-- BEGIN CANONICAL RLS parental_consents
ALTER TABLE public."parental_consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."parental_consents" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS parental_consents

-- BEGIN CANONICAL RLS payment_events
ALTER TABLE public."payment_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_events" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS payment_events

-- BEGIN CANONICAL RLS profiles
ALTER TABLE public."profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."profiles" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS profiles

-- BEGIN CANONICAL RLS session_images
ALTER TABLE public."session_images" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."session_images" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS session_images

-- BEGIN CANONICAL RLS study_sessions
ALTER TABLE public."study_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."study_sessions" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS study_sessions

-- BEGIN CANONICAL RLS support_tickets
ALTER TABLE public."support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."support_tickets" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS support_tickets

-- BEGIN CANONICAL RLS tutor_messages
ALTER TABLE public."tutor_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tutor_messages" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS tutor_messages

-- BEGIN CANONICAL RLS tutor_threads
ALTER TABLE public."tutor_threads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."tutor_threads" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS tutor_threads

-- BEGIN CANONICAL RLS under13_parent_notifications
ALTER TABLE public."under13_parent_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."under13_parent_notifications" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS under13_parent_notifications

-- BEGIN CANONICAL RLS usage_events
ALTER TABLE public."usage_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."usage_events" NO FORCE ROW LEVEL SECURITY;
-- END CANONICAL RLS usage_events

-- BEGIN CANONICAL POLICY Parents can insert their own child profiles
CREATE POLICY "Parents can insert their own child profiles" ON "public"."child_profiles"
AS PERMISSIVE FOR INSERT TO "authenticated"
WITH CHECK (((parent_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'parent'::text))))));
-- END CANONICAL POLICY Parents can insert their own child profiles

-- BEGIN CANONICAL POLICY Parents can select their own child profiles
CREATE POLICY "Parents can select their own child profiles" ON "public"."child_profiles"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING (((parent_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'parent'::text))))));
-- END CANONICAL POLICY Parents can select their own child profiles

-- BEGIN CANONICAL POLICY Parents can update their own child profiles
CREATE POLICY "Parents can update their own child profiles" ON "public"."child_profiles"
AS PERMISSIVE FOR UPDATE TO "authenticated"
USING (((parent_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'parent'::text))))))
WITH CHECK (((parent_user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.user_role = 'parent'::text))))));
-- END CANONICAL POLICY Parents can update their own child profiles

-- BEGIN CANONICAL POLICY Users can manage their own folders
CREATE POLICY "Users can manage their own folders" ON "public"."folders"
AS PERMISSIVE FOR ALL TO PUBLIC
USING ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can manage their own folders

-- BEGIN CANONICAL POLICY Users can view their own parental consent
CREATE POLICY "Users can view their own parental consent" ON "public"."parental_consents"
AS PERMISSIVE FOR SELECT TO PUBLIC
USING ((auth.uid() = child_user_id));
-- END CANONICAL POLICY Users can view their own parental consent

-- BEGIN CANONICAL POLICY Users can update own metadata
CREATE POLICY "Users can update own metadata" ON "public"."profiles"
AS PERMISSIVE FOR UPDATE TO PUBLIC
USING ((auth.uid() = id))
WITH CHECK ((auth.uid() = id));
-- END CANONICAL POLICY Users can update own metadata

-- BEGIN CANONICAL POLICY Users can update own profile
CREATE POLICY "Users can update own profile" ON "public"."profiles"
AS PERMISSIVE FOR UPDATE TO PUBLIC
USING ((auth.uid() = id))
WITH CHECK ((auth.uid() = id));
-- END CANONICAL POLICY Users can update own profile

-- BEGIN CANONICAL POLICY Users can view own profile
CREATE POLICY "Users can view own profile" ON "public"."profiles"
AS PERMISSIVE FOR SELECT TO PUBLIC
USING ((auth.uid() = id));
-- END CANONICAL POLICY Users can view own profile

-- BEGIN CANONICAL POLICY Users can delete own session images
CREATE POLICY "Users can delete own session images" ON "public"."session_images"
AS PERMISSIVE FOR DELETE TO PUBLIC
USING ((EXISTS ( SELECT 1
   FROM study_sessions
  WHERE ((study_sessions.id = session_images.session_id) AND (study_sessions.user_id = auth.uid())))));
-- END CANONICAL POLICY Users can delete own session images

-- BEGIN CANONICAL POLICY Users can insert own session images
CREATE POLICY "Users can insert own session images" ON "public"."session_images"
AS PERMISSIVE FOR INSERT TO PUBLIC
WITH CHECK ((EXISTS ( SELECT 1
   FROM study_sessions
  WHERE ((study_sessions.id = session_images.session_id) AND (study_sessions.user_id = auth.uid())))));
-- END CANONICAL POLICY Users can insert own session images

-- BEGIN CANONICAL POLICY Users can select own session images
CREATE POLICY "Users can select own session images" ON "public"."session_images"
AS PERMISSIVE FOR SELECT TO PUBLIC
USING ((EXISTS ( SELECT 1
   FROM study_sessions
  WHERE ((study_sessions.id = session_images.session_id) AND (study_sessions.user_id = auth.uid())))));
-- END CANONICAL POLICY Users can select own session images

-- BEGIN CANONICAL POLICY study_sessions_insert_own
CREATE POLICY "study_sessions_insert_own" ON "public"."study_sessions"
AS PERMISSIVE FOR INSERT TO "authenticated"
WITH CHECK ((auth.uid() = user_id));
-- END CANONICAL POLICY study_sessions_insert_own

-- BEGIN CANONICAL POLICY study_sessions_select_own
CREATE POLICY "study_sessions_select_own" ON "public"."study_sessions"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING ((auth.uid() = user_id));
-- END CANONICAL POLICY study_sessions_select_own

-- BEGIN CANONICAL POLICY study_sessions_update_own
CREATE POLICY "study_sessions_update_own" ON "public"."study_sessions"
AS PERMISSIVE FOR UPDATE TO "authenticated"
USING ((auth.uid() = user_id))
WITH CHECK ((auth.uid() = user_id));
-- END CANONICAL POLICY study_sessions_update_own

-- BEGIN CANONICAL POLICY Users can insert their own support tickets
CREATE POLICY "Users can insert their own support tickets" ON "public"."support_tickets"
AS PERMISSIVE FOR INSERT TO "authenticated"
WITH CHECK ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can insert their own support tickets

-- BEGIN CANONICAL POLICY Users can insert own tutor messages
CREATE POLICY "Users can insert own tutor messages" ON "public"."tutor_messages"
AS PERMISSIVE FOR INSERT TO PUBLIC
WITH CHECK ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can insert own tutor messages

-- BEGIN CANONICAL POLICY Users can view own tutor messages
CREATE POLICY "Users can view own tutor messages" ON "public"."tutor_messages"
AS PERMISSIVE FOR SELECT TO PUBLIC
USING ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can view own tutor messages

-- BEGIN CANONICAL POLICY Users can create own tutor threads
CREATE POLICY "Users can create own tutor threads" ON "public"."tutor_threads"
AS PERMISSIVE FOR INSERT TO PUBLIC
WITH CHECK ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can create own tutor threads

-- BEGIN CANONICAL POLICY Users can update own tutor threads
CREATE POLICY "Users can update own tutor threads" ON "public"."tutor_threads"
AS PERMISSIVE FOR UPDATE TO PUBLIC
USING ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can update own tutor threads

-- BEGIN CANONICAL POLICY Users can view own tutor threads
CREATE POLICY "Users can view own tutor threads" ON "public"."tutor_threads"
AS PERMISSIVE FOR SELECT TO PUBLIC
USING ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can view own tutor threads

-- BEGIN CANONICAL POLICY Users can view own usage events
CREATE POLICY "Users can view own usage events" ON "public"."usage_events"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING ((auth.uid() = user_id));
-- END CANONICAL POLICY Users can view own usage events

-- BEGIN CANONICAL POLICY study_materials_delete_legacy_owned
CREATE POLICY "study_materials_delete_legacy_owned" ON "storage"."objects"
AS PERMISSIVE FOR DELETE TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND (name ~~ 'uploads/%'::text) AND (owner_id = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_delete_legacy_owned

-- BEGIN CANONICAL POLICY study_materials_delete_own_folder e4umg8_0
CREATE POLICY "study_materials_delete_own_folder e4umg8_0" ON "storage"."objects"
AS PERMISSIVE FOR DELETE TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_delete_own_folder e4umg8_0

-- BEGIN CANONICAL POLICY study_materials_delete_own_folder e4umg8_1
CREATE POLICY "study_materials_delete_own_folder e4umg8_1" ON "storage"."objects"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_delete_own_folder e4umg8_1

-- BEGIN CANONICAL POLICY study_materials_insert_account_guard
CREATE POLICY "study_materials_insert_account_guard" ON "storage"."objects"
AS RESTRICTIVE FOR INSERT TO "authenticated"
WITH CHECK (((bucket_id <> 'study-materials'::text) OR (((storage.foldername(name))[1] = (auth.uid())::text) AND can_upload_study_materials())));
-- END CANONICAL POLICY study_materials_insert_account_guard

-- BEGIN CANONICAL POLICY study_materials_insert_own_folder e4umg8_0
CREATE POLICY "study_materials_insert_own_folder e4umg8_0" ON "storage"."objects"
AS PERMISSIVE FOR INSERT TO "authenticated"
WITH CHECK (((bucket_id = 'study-materials'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_insert_own_folder e4umg8_0

-- BEGIN CANONICAL POLICY study_materials_select_legacy_owned
CREATE POLICY "study_materials_select_legacy_owned" ON "storage"."objects"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND (name ~~ 'uploads/%'::text) AND (owner_id = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_select_legacy_owned

-- BEGIN CANONICAL POLICY study_materials_select_own_folder e4umg8_0
CREATE POLICY "study_materials_select_own_folder e4umg8_0" ON "storage"."objects"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_select_own_folder e4umg8_0

-- BEGIN CANONICAL POLICY study_materials_update_account_guard
CREATE POLICY "study_materials_update_account_guard" ON "storage"."objects"
AS RESTRICTIVE FOR UPDATE TO "authenticated"
USING (((bucket_id <> 'study-materials'::text) OR (((storage.foldername(name))[1] = (auth.uid())::text) AND can_upload_study_materials())))
WITH CHECK (((bucket_id <> 'study-materials'::text) OR (((storage.foldername(name))[1] = (auth.uid())::text) AND can_upload_study_materials())));
-- END CANONICAL POLICY study_materials_update_account_guard

-- BEGIN CANONICAL POLICY study_materials_update_own_folder e4umg8_0
CREATE POLICY "study_materials_update_own_folder e4umg8_0" ON "storage"."objects"
AS PERMISSIVE FOR UPDATE TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_update_own_folder e4umg8_0

-- BEGIN CANONICAL POLICY study_materials_update_own_folder e4umg8_1
CREATE POLICY "study_materials_update_own_folder e4umg8_1" ON "storage"."objects"
AS PERMISSIVE FOR SELECT TO "authenticated"
USING (((bucket_id = 'study-materials'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
-- END CANONICAL POLICY study_materials_update_own_folder e4umg8_1

-- BEGIN CANONICAL TABLE_ACL admin_plan_actions
REVOKE ALL PRIVILEGES ON TABLE public."admin_plan_actions" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."admin_plan_actions" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."admin_plan_actions" TO "service_role";
-- END CANONICAL TABLE_ACL admin_plan_actions

-- BEGIN CANONICAL TABLE_ACL child_profiles
REVOKE ALL PRIVILEGES ON TABLE public."child_profiles" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."child_profiles" TO "postgres";
GRANT INSERT, SELECT, UPDATE ON TABLE public."child_profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."child_profiles" TO "service_role";
-- END CANONICAL TABLE_ACL child_profiles

-- BEGIN CANONICAL TABLE_ACL folders
REVOKE ALL PRIVILEGES ON TABLE public."folders" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."folders" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."folders" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."folders" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."folders" TO "service_role";
-- END CANONICAL TABLE_ACL folders

-- BEGIN CANONICAL TABLE_ACL parental_consents
REVOKE ALL PRIVILEGES ON TABLE public."parental_consents" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."parental_consents" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."parental_consents" TO "service_role";
-- END CANONICAL TABLE_ACL parental_consents

-- BEGIN CANONICAL TABLE_ACL payment_events
REVOKE ALL PRIVILEGES ON TABLE public."payment_events" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."payment_events" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."payment_events" TO "service_role";
-- END CANONICAL TABLE_ACL payment_events

-- BEGIN CANONICAL TABLE_ACL profiles
REVOKE ALL PRIVILEGES ON TABLE public."profiles" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "postgres";
GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "anon";
GRANT DELETE, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."profiles" TO "service_role";
-- END CANONICAL TABLE_ACL profiles

-- BEGIN CANONICAL TABLE_ACL session_images
REVOKE ALL PRIVILEGES ON TABLE public."session_images" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."session_images" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."session_images" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."session_images" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."session_images" TO "service_role";
-- END CANONICAL TABLE_ACL session_images

-- BEGIN CANONICAL TABLE_ACL study_sessions
REVOKE ALL PRIVILEGES ON TABLE public."study_sessions" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."study_sessions" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."study_sessions" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."study_sessions" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."study_sessions" TO "service_role";
-- END CANONICAL TABLE_ACL study_sessions

-- BEGIN CANONICAL TABLE_ACL support_tickets
REVOKE ALL PRIVILEGES ON TABLE public."support_tickets" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."support_tickets" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."support_tickets" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."support_tickets" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."support_tickets" TO "service_role";
-- END CANONICAL TABLE_ACL support_tickets

-- BEGIN CANONICAL TABLE_ACL tutor_messages
REVOKE ALL PRIVILEGES ON TABLE public."tutor_messages" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_messages" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_messages" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_messages" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_messages" TO "service_role";
-- END CANONICAL TABLE_ACL tutor_messages

-- BEGIN CANONICAL TABLE_ACL tutor_threads
REVOKE ALL PRIVILEGES ON TABLE public."tutor_threads" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_threads" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_threads" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_threads" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."tutor_threads" TO "service_role";
-- END CANONICAL TABLE_ACL tutor_threads

-- BEGIN CANONICAL TABLE_ACL under13_parent_notifications
REVOKE ALL PRIVILEGES ON TABLE public."under13_parent_notifications" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."under13_parent_notifications" TO "postgres";
-- END CANONICAL TABLE_ACL under13_parent_notifications

-- BEGIN CANONICAL TABLE_ACL usage_events
REVOKE ALL PRIVILEGES ON TABLE public."usage_events" FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."usage_events" TO "postgres";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."usage_events" TO "anon";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."usage_events" TO "authenticated";
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public."usage_events" TO "service_role";
-- END CANONICAL TABLE_ACL usage_events

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.admin_user_id
COMMENT ON COLUMN public."admin_plan_actions"."admin_user_id" IS 'UUID admina z Supabase Auth (może być NULL jeśli nie uda się pobrać).';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.admin_user_id

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.admin_email
COMMENT ON COLUMN public."admin_plan_actions"."admin_email" IS 'E-mail admina — weryfikowany przez ADMIN_EMAILS secret.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.admin_email

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.target_user_id
COMMENT ON COLUMN public."admin_plan_actions"."target_user_id" IS 'UUID użytkownika, którego plan zmieniono. ON DELETE SET NULL.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.target_user_id

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.target_email
COMMENT ON COLUMN public."admin_plan_actions"."target_email" IS 'E-mail użytkownika docelowego — archiwizowany w logu.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.target_email

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.action_type
COMMENT ON COLUMN public."admin_plan_actions"."action_type" IS 'Typ operacji: activate_premium_30 | extend_premium_30 | activate_family_30 | set_free.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.action_type

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.old_plan
COMMENT ON COLUMN public."admin_plan_actions"."old_plan" IS 'Plan przed zmianą: free | premium | family.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.old_plan

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.new_plan
COMMENT ON COLUMN public."admin_plan_actions"."new_plan" IS 'Plan po zmianie: free | premium | family.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.new_plan

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.old_plan_expires_at
COMMENT ON COLUMN public."admin_plan_actions"."old_plan_expires_at" IS 'Data ważności planu przed zmianą.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.old_plan_expires_at

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.new_plan_expires_at
COMMENT ON COLUMN public."admin_plan_actions"."new_plan_expires_at" IS 'Data ważności planu po zmianie.';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.new_plan_expires_at

-- BEGIN CANONICAL COLUMN_COMMENT admin_plan_actions.reason
COMMENT ON COLUMN public."admin_plan_actions"."reason" IS 'Opcjonalny powód zmiany podany przez admina (max 500 znaków).';
-- END CANONICAL COLUMN_COMMENT admin_plan_actions.reason

-- BEGIN CANONICAL COLUMN_COMMENT payment_events.stripe_event_id
COMMENT ON COLUMN public."payment_events"."stripe_event_id" IS 'Unikalny identyfikator zdarzenia ze Stripe (evt_...).';
-- END CANONICAL COLUMN_COMMENT payment_events.stripe_event_id

-- BEGIN CANONICAL COLUMN_COMMENT payment_events.status
COMMENT ON COLUMN public."payment_events"."status" IS 'Status przetwarzania: processing, processed, ignored, error.';
-- END CANONICAL COLUMN_COMMENT payment_events.status

-- BEGIN CANONICAL COLUMN_COMMENT payment_events.payload
COMMENT ON COLUMN public."payment_events"."payload" IS 'Ograniczony i zanonimizowany payload zdarzenia Stripe dla celów debugowania.';
-- END CANONICAL COLUMN_COMMENT payment_events.payload

-- BEGIN CANONICAL COLUMN_COMMENT study_sessions.quiz_result
COMMENT ON COLUMN public."study_sessions"."quiz_result" IS 'Stores the latest quiz result for the session: {score, total, percentage, completed_at}';
-- END CANONICAL COLUMN_COMMENT study_sessions.quiz_result

-- BEGIN CANONICAL COLUMN_COMMENT usage_events.event_type
COMMENT ON COLUMN public."usage_events"."event_type" IS 'Type of the AI usage event. Valid types: lesson_analysis, flashcard_regen, tutor_message.';
-- END CANONICAL COLUMN_COMMENT usage_events.event_type

-- BEGIN CANONICAL TABLE_COMMENT admin_plan_actions
COMMENT ON TABLE public."admin_plan_actions" IS 'Audit log operacji admina na planach użytkowników (Sprint 22A.1).
   Zabezpieczenia: RLS włączone, anon/authenticated/PUBLIC bez dostępu.
   Dostęp wyłącznie dla service_role przez Edge Function admin-plan-management.
   Każdy rekord rejestruje: kto (admin), co (action_type), komu (target),
   stary i nowy plan oraz opcjonalny powód zmiany.';
-- END CANONICAL TABLE_COMMENT admin_plan_actions

-- BEGIN CANONICAL TABLE_COMMENT payment_events
COMMENT ON TABLE public."payment_events" IS 'Tabela służąca do idempotencji webhooków Stripe i śledzenia statusu aktywacji planów. 
   Używana wyłącznie przez Edge Function stripe-webhook. Idempotencja zapewniona przez stripe_event_id.';
-- END CANONICAL TABLE_COMMENT payment_events

-- BEGIN CANONICAL TABLE_COMMENT usage_events
COMMENT ON TABLE public."usage_events" IS 'Tracks AI feature usage events to enforce backend limits across Free and Premium plans.';
-- END CANONICAL TABLE_COMMENT usage_events

-- BEGIN CANONICAL DEFAULT_ACL supabase_admin.S
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";
-- END CANONICAL DEFAULT_ACL supabase_admin.S

-- BEGIN CANONICAL DEFAULT_ACL supabase_admin.f
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";
-- END CANONICAL DEFAULT_ACL supabase_admin.f

-- BEGIN CANONICAL DEFAULT_ACL supabase_admin.r
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_admin" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";
-- END CANONICAL DEFAULT_ACL supabase_admin.r

-- BEGIN CANONICAL DEFAULT_ACL postgres.S
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT, UPDATE, USAGE ON SEQUENCES TO "service_role";
-- END CANONICAL DEFAULT_ACL postgres.S

-- BEGIN CANONICAL DEFAULT_ACL postgres.f
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT EXECUTE ON FUNCTIONS TO "service_role";
-- END CANONICAL DEFAULT_ACL postgres.f

-- BEGIN CANONICAL DEFAULT_ACL postgres.r
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role, postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLES TO "service_role";
-- END CANONICAL DEFAULT_ACL postgres.r

-- BEGIN CANONICAL BUCKET study-materials
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('study-materials', 'study-materials', false, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
-- END CANONICAL BUCKET study-materials

-- BEGIN CANONICAL REALTIME session_images
DO $realtime$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    RAISE EXCEPTION 'Supabase platform publication is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime'
    AND schemaname='public' AND tablename='session_images') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.session_images;
  END IF;
END;
$realtime$;
-- END CANONICAL REALTIME session_images

-- BEGIN CANONICAL CRON omninauka-expire-under13-pending
DO $expiry_schedule$
DECLARE existing_job bigint;
BEGIN
  FOR existing_job IN SELECT jobid FROM cron.job WHERE jobname='omninauka-expire-under13-pending'
  LOOP PERFORM cron.unschedule(existing_job); END LOOP;
  PERFORM cron.schedule('omninauka-expire-under13-pending', '*/15 * * * *', 'SELECT public.expire_pending_under13_accounts(20);');
END;
$expiry_schedule$;
-- END CANONICAL CRON omninauka-expire-under13-pending

-- External HTTP reminder activation belongs to environment setup; see manifest.
COMMIT;
