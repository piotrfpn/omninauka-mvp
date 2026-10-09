-- LOCAL DISPOSABLE DATABASE ONLY, after reviewed migrations are applied there.
-- Run with the existing CLI: supabase test db --local.
-- Real PostgreSQL roles/RLS, synthetic Auth fixtures, no Storage/API calls.
-- Everything, including fixture grants and extension setup, is rolled back.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT no_plan();

SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public' AND policyname IN (
    'priv02_active_study_sessions', 'priv02_active_session_images',
    'priv02_active_tutor_threads', 'priv02_active_tutor_messages')
    AND permissive = 'RESTRICTIVE' AND cmd = 'ALL'
    AND roles = ARRAY['authenticated']::name[]), 4::bigint,
  'all four restrictive authenticated policies must be applied locally');

SELECT is((SELECT count(*) FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'study_sessions'
    AND permissive = 'PERMISSIVE' AND cmd IN ('ALL', 'DELETE')),
  0::bigint, 'study_sessions has no permissive browser DELETE policy');

CREATE TEMP TABLE priv02_ids (name text PRIMARY KEY, id uuid NOT NULL DEFAULT gen_random_uuid()) ON COMMIT DROP;
INSERT INTO priv02_ids (name) VALUES
  ('a'), ('b'), ('active'), ('deleted'), ('other'), ('foreign'),
  ('thread_active'), ('thread_deleted'), ('thread_foreign'),
  ('new_session'), ('new_thread');
GRANT SELECT ON priv02_ids TO authenticated, service_role;
CREATE FUNCTION pg_temp.fixture(text) RETURNS uuid LANGUAGE sql STABLE AS
  'SELECT id FROM pg_temp.priv02_ids WHERE name = $1';

INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT id, 'priv02-' || id::text || '@example.invalid',
  '{"user_role":"student","ageBand":"18_plus","name":"Synthetic RLS fixture"}'::jsonb
FROM priv02_ids WHERE name IN ('a', 'b');

INSERT INTO public.study_sessions (id, user_id, image_url, deleted_at)
SELECT id, pg_temp.fixture(CASE WHEN name = 'foreign' THEN 'b' ELSE 'a' END),
  'synthetic/no-physical-object/' || name,
  CASE WHEN name = 'deleted' THEN now() ELSE NULL END
FROM priv02_ids WHERE name IN ('active', 'deleted', 'other', 'foreign');
INSERT INTO public.session_images (session_id, image_url)
SELECT id, 'synthetic/no-physical-object/' || name FROM priv02_ids
WHERE name IN ('active', 'deleted', 'foreign');
INSERT INTO public.tutor_threads (id, session_id, user_id)
SELECT pg_temp.fixture('thread_' || name), id,
  pg_temp.fixture(CASE WHEN name = 'foreign' THEN 'b' ELSE 'a' END)
FROM priv02_ids WHERE name IN ('active', 'deleted', 'foreign');
INSERT INTO public.tutor_messages (thread_id, user_id, role, content)
SELECT pg_temp.fixture('thread_' || name),
  pg_temp.fixture(CASE WHEN name = 'foreign' THEN 'b' ELSE 'a' END),
  'user', 'Synthetic content'
FROM priv02_ids WHERE name IN ('active', 'deleted', 'foreign');

SELECT set_config('request.jwt.claim.sub', pg_temp.fixture('a')::text, true);
SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.fixture('a'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;

SELECT is(auth.uid(), pg_temp.fixture('a'), 'authenticated JWT resolves to user A');

SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('active')), 1::bigint, 'owner reads active session');
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('deleted')), 0::bigint, 'owner cannot read deleted session');
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('foreign')), 0::bigint, 'owner cannot read foreign active session');
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('other')), 1::bigint, 'unrelated active session remains visible');
WITH changed AS (UPDATE study_sessions SET topic = 'Synthetic update' WHERE id = pg_temp.fixture('active') RETURNING id)
SELECT is((SELECT count(*) FROM changed), 1::bigint, 'owner updates active session');
WITH changed AS (UPDATE study_sessions SET deleted_at = NULL WHERE id = pg_temp.fixture('deleted') RETURNING id)
SELECT is((SELECT count(*) FROM changed), 0::bigint, 'owner cannot restore deleted session');
WITH changed AS (UPDATE study_sessions SET topic = 'Forbidden' WHERE id = pg_temp.fixture('foreign') RETURNING id)
SELECT is((SELECT count(*) FROM changed), 0::bigint, 'owner cannot update foreign session');
SELECT throws_ok($sql$UPDATE study_sessions SET deleted_at = now() WHERE id = pg_temp.fixture('active')$sql$,
  '42501', NULL, 'WITH CHECK prevents client marking an active session deleted');
SELECT throws_ok($sql$UPDATE study_sessions SET user_id = pg_temp.fixture('b') WHERE id = pg_temp.fixture('active')$sql$,
  '42501', NULL, 'WITH CHECK prevents changing session owner');
SELECT lives_ok($sql$INSERT INTO study_sessions (id, user_id, image_url)
  VALUES (pg_temp.fixture('new_session'), pg_temp.fixture('a'), 'synthetic/new')$sql$, 'normal client session creation remains allowed');
SELECT throws_ok($sql$INSERT INTO study_sessions (user_id, image_url, deleted_at)
  VALUES (pg_temp.fixture('a'), 'synthetic/blocked', now())$sql$,
  '42501', NULL, 'client cannot insert an already deleted session');
SELECT throws_ok($sql$INSERT INTO study_sessions (user_id, image_url)
  VALUES (pg_temp.fixture('b'), 'synthetic/foreign')$sql$,
  '42501', NULL, 'client cannot insert for another user');
WITH removed AS (DELETE FROM study_sessions WHERE id = pg_temp.fixture('deleted') RETURNING id)
SELECT is((SELECT count(*) FROM removed), 0::bigint, 'browser cannot delete historical soft-deleted session');

SELECT is((SELECT count(*) FROM session_images WHERE session_id = pg_temp.fixture('active')), 1::bigint, 'owner reads active images');
SELECT is((SELECT count(*) FROM session_images WHERE session_id = pg_temp.fixture('deleted')), 0::bigint, 'deleted images hidden');
SELECT is((SELECT count(*) FROM session_images WHERE session_id = pg_temp.fixture('foreign')), 0::bigint, 'foreign images hidden');
SELECT lives_ok($sql$INSERT INTO session_images (session_id, image_url)
  VALUES (pg_temp.fixture('new_session'), 'synthetic/new-image')$sql$, 'active image insert allowed');
SELECT throws_ok($sql$INSERT INTO session_images (session_id, image_url)
  VALUES (pg_temp.fixture('deleted'), 'synthetic/blocked')$sql$, '42501', NULL, 'deleted image insert rejected');
SELECT throws_ok($sql$INSERT INTO session_images (session_id, image_url)
  VALUES (pg_temp.fixture('foreign'), 'synthetic/blocked')$sql$, '42501', NULL, 'foreign image insert rejected');
WITH removed AS (DELETE FROM session_images WHERE session_id = pg_temp.fixture('deleted') RETURNING id)
SELECT is((SELECT count(*) FROM removed), 0::bigint, 'deleted image delete denied');
WITH removed AS (DELETE FROM session_images WHERE session_id = pg_temp.fixture('new_session') RETURNING id)
SELECT is((SELECT count(*) FROM removed), 1::bigint, 'existing active image delete remains allowed');

SELECT is((SELECT count(*) FROM tutor_threads WHERE id = pg_temp.fixture('thread_active')), 1::bigint, 'active thread visible');
SELECT is((SELECT count(*) FROM tutor_threads WHERE id = pg_temp.fixture('thread_deleted')), 0::bigint, 'deleted thread hidden');
SELECT is((SELECT count(*) FROM tutor_threads WHERE id = pg_temp.fixture('thread_foreign')), 0::bigint, 'foreign thread hidden');
SELECT lives_ok($sql$INSERT INTO tutor_threads (id, session_id, user_id)
  VALUES (pg_temp.fixture('new_thread'), pg_temp.fixture('new_session'), pg_temp.fixture('a'))$sql$, 'active thread insert allowed');
SELECT throws_ok($sql$INSERT INTO tutor_threads (session_id, user_id)
  VALUES (pg_temp.fixture('deleted'), pg_temp.fixture('a'))$sql$, '42501', NULL, 'deleted thread insert rejected before conflict');
SELECT throws_ok($sql$INSERT INTO tutor_threads (session_id, user_id)
  VALUES (pg_temp.fixture('foreign'), pg_temp.fixture('a'))$sql$, '42501', NULL, 'forged owned thread on foreign session rejected');
WITH changed AS (UPDATE tutor_threads SET context_snapshot = '{"synthetic":true}' WHERE id = pg_temp.fixture('thread_active') RETURNING id)
SELECT is((SELECT count(*) FROM changed), 1::bigint, 'active thread update allowed');
WITH changed AS (UPDATE tutor_threads SET context_snapshot = '{}' WHERE id = pg_temp.fixture('thread_deleted') RETURNING id)
SELECT is((SELECT count(*) FROM changed), 0::bigint, 'deleted thread update denied');
SELECT throws_ok($sql$UPDATE tutor_threads SET session_id = pg_temp.fixture('deleted') WHERE id = pg_temp.fixture('new_thread')$sql$,
  '42501', NULL, 'thread cannot be reassigned to deleted session');
SELECT throws_ok($sql$UPDATE tutor_threads SET session_id = pg_temp.fixture('foreign') WHERE id = pg_temp.fixture('new_thread')$sql$,
  '42501', NULL, 'thread cannot be reassigned to foreign session');

SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id = pg_temp.fixture('thread_active')), 1::bigint, 'active conversation visible');
SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id = pg_temp.fixture('thread_deleted')), 0::bigint, 'deleted conversation hidden');
SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id = pg_temp.fixture('thread_foreign')), 0::bigint, 'foreign conversation hidden');
SELECT lives_ok($sql$INSERT INTO tutor_messages (thread_id, user_id, role, content)
  VALUES (pg_temp.fixture('new_thread'), pg_temp.fixture('a'), 'user', 'Synthetic new message')$sql$, 'active message insert and thread timestamp trigger allowed');
SELECT throws_ok($sql$INSERT INTO tutor_messages (thread_id, user_id, role, content)
  VALUES (pg_temp.fixture('thread_deleted'), pg_temp.fixture('a'), 'user', 'Blocked')$sql$,
  '42501', NULL, 'deleted conversation message rejected');
SELECT throws_ok($sql$INSERT INTO tutor_messages (thread_id, user_id, role, content)
  VALUES (pg_temp.fixture('thread_foreign'), pg_temp.fixture('a'), 'user', 'Blocked')$sql$,
  '42501', NULL, 'forged message on foreign thread rejected');

-- Live study_sessions has no permissive DELETE policy: even active rows survive.
WITH removed AS (DELETE FROM study_sessions WHERE id = pg_temp.fixture('new_session') RETURNING id)
SELECT is((SELECT count(*) FROM removed), 0::bigint, 'browser cannot delete active session');
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('new_session')), 1::bigint, 'active session remains after denied browser delete');
SELECT is((SELECT count(*) FROM tutor_threads WHERE id = pg_temp.fixture('new_thread')), 1::bigint, 'active thread remains after denied browser delete');
SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id = pg_temp.fixture('new_thread')), 1::bigint, 'active message remains after denied browser delete');
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('other')), 1::bigint, 'other session unaffected by writes/deletes');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', pg_temp.fixture('b')::text, true);
SELECT set_config('request.jwt.claims', json_build_object('sub', pg_temp.fixture('b'), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT is(auth.uid(), pg_temp.fixture('b'), 'authenticated JWT resolves to user B');
SELECT is((SELECT count(*) FROM study_sessions WHERE id IN (pg_temp.fixture('active'), pg_temp.fixture('deleted'))), 0::bigint, 'user B sees neither A session');
SELECT is((SELECT count(*) FROM session_images WHERE session_id IN (pg_temp.fixture('active'), pg_temp.fixture('deleted'))), 0::bigint, 'user B sees neither A image set');
SELECT is((SELECT count(*) FROM tutor_threads WHERE id IN (pg_temp.fixture('thread_active'), pg_temp.fixture('thread_deleted'))), 0::bigint, 'user B sees neither A thread');
SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id IN (pg_temp.fixture('thread_active'), pg_temp.fixture('thread_deleted'))), 0::bigint, 'user B sees neither A conversation');
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('foreign')), 1::bigint, 'user B retains own active access');

RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is((SELECT count(*) FROM study_sessions WHERE id = pg_temp.fixture('deleted')), 1::bigint, 'service cleanup reads historical session');
SELECT is((SELECT count(*) FROM session_images WHERE session_id = pg_temp.fixture('deleted')), 1::bigint, 'service cleanup reads historical image paths');
SELECT is((SELECT count(*) FROM tutor_threads WHERE id = pg_temp.fixture('thread_deleted')), 1::bigint, 'service cleanup reads historical thread');
SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id = pg_temp.fixture('thread_deleted')), 1::bigint, 'service cleanup reads historical messages');
WITH removed AS (DELETE FROM study_sessions WHERE id = pg_temp.fixture('deleted') RETURNING id)
SELECT is((SELECT count(*) FROM removed), 1::bigint, 'service cleanup can delete historical fixture');
SELECT is((SELECT count(*) FROM session_images WHERE session_id = pg_temp.fixture('deleted')), 0::bigint, 'fixture images cascade');
SELECT is((SELECT count(*) FROM tutor_threads WHERE id = pg_temp.fixture('thread_deleted')), 0::bigint, 'fixture thread cascades');
SELECT is((SELECT count(*) FROM tutor_messages WHERE thread_id = pg_temp.fixture('thread_deleted')), 0::bigint, 'fixture messages cascade');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
