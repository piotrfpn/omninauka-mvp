# OmniNauka canonical migration baseline 2026

Strategy C. Local repository preparation only (MIG-HIST-01D.1).

- Legacy source HEAD: `d66564fd5ea9cc12c3db2d42ce530b9e7bcc680d`; do not amend/rebase it.
- Production metadata target: `uskalizgrpjqhujzzydh`. No user data or secret values captured.
- Catalog verification date: 2026-10-10; PostgreSQL 17.6.
- B: `20261010073638_canonical_baseline.sql` (pre-PRIV02 canonical state).
- P: `20261010073843_priv02_soft_deleted_session_access.sql`.
- Runtime bootstrap, SQL execution validity, schema comparison, pgTAP C0/C1: **PENDING**.
- No history repair, migration application, commit, push or deployment in this task.

## Canonical decisions

- profiles has no last_login_at column. The live parent RPC still has a nullable return alias named last_login_at; preserve its definition.
- child_profiles: nullable email fields and child_user_id; partial unique parent/email index; current CHECK/FK and trigger-enforced new preapproval integrity.
- study_sessions: owner SELECT/INSERT/UPDATE; no permissive browser DELETE/ALL policy.
- Storage: live owner-folder, legacy owner_id SELECT/DELETE and restrictive account INSERT/UPDATE guards; preserve equivalent duplicate SELECT policies.
- The four PRIV02 active-session policies occur only in P.

## Archived legacy provenance

REPRESENTED describes a final effect, not proof that the local file was executed. SUPERSEDED describes replacement by the final canonical model. No archived file may be replayed.

| Version | Filename / purpose | Remote mapping | Classification | Archive path | SHA-256 | Canonical replacement |
|---|---|---|---|---|---|---|
| 00001 | 00001_init.sql: Initial profiles, sessions, Auth trigger and bucket | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00001_init.sql | A15D9CD0044E63DCF0E5970D20066D6EFDEF9F5AC291DB57AB888C9DC1120CC1 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00002 | 00002_sprint1.sql: Initial study-analysis columns | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00002_sprint1.sql | A8708D0002CDF8E92BA808F2D3DFD95F53A627CA363C27AAABCF2B4D18940AE0 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00003 | 00003_sprint2.sql: Additional study session state | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00003_sprint2.sql | 523A9C8B5881FCFEC5A25AE9D6614FE4042C14B80F4AD99B48DFB54A8CCA6C09 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00004 | 00004_rls_session_images.sql: Session-images schema and historical session RLS | NONE | REPLAY_PROHIBITED | supabase/migration_archive/legacy_pre_baseline/00004_rls_session_images.sql | F470784ABC29005C12E67ADD768E6AD49B27B0AD65A5AE77266962E7FC445E73 | B owner policies omit browser session DELETE |
| 00005 | 00005_sprint4_folders.sql: Folders and circularity protection | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00005_sprint4_folders.sql | 96BF0D0DE41D3D342AEFADF1FCD698115F9D466AC4814BF0EB872F52220E7D59 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00006 | 00006_sprint5_tutor_chat.sql: Tutor threads/messages and activity trigger | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00006_sprint5_tutor_chat.sql | FEB78362A3E19571F17BF5C00F636BA788614B7502C77BFBF2DF06BAB71F68BD | B final catalog definitions; historical intermediate SQL is not replayed |
| 00007 | 00007_sprint8_quiz_results.sql: Quiz result persistence | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00007_sprint8_quiz_results.sql | 0D43B8511E4741E55C68821D3C43206D56A697E9FBD5666EBAE5492BF6DB052A | B final catalog definitions; historical intermediate SQL is not replayed |
| 00008 | 00008_sprint9_flashcard_progress.sql: Flashcard progress persistence | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00008_sprint9_flashcard_progress.sql | 1D19643ADAB76FDD9374777DA8CC278CB079E1C4E03AA62FF63CD4D4F58A9C8C | B final catalog definitions; historical intermediate SQL is not replayed |
| 00009 | 00009_parental_consent.sql: Parental consent workflow | 20260427170350 | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00009_parental_consent.sql | E94311AA38C1167AB7E615445004987621C8CC8716E6BCF54D88CB646C0256AC | B final catalog definitions; historical intermediate SQL is not replayed |
| 00010 | 00010_consent_email_delivery.sql: Consent email delivery metadata | 20260427170359 | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00010_consent_email_delivery.sql | 9D04DA8BA5F864645AEB5AEDD5A3B1B65FDCF181F1E912D99460E99BC2DF48D8 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00011 | 00011_profile_metadata.sql: Profile educational metadata | 20260428183903 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00011_profile_metadata.sql | E3A92418DDCD156551670FF0DB22C465B40EF325CBDA5CCF2EFFF45A7996EDE4 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00012 | 00012_profiles_rls_metadata_upsert.sql: Profile metadata upsert policies | 20260428202546 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00012_profiles_rls_metadata_upsert.sql | 9266AD90D3810CBE9E9EC31821E38E2A58F6B4230132F4EB950AAD1C4A94AD3E | B final catalog definitions; historical intermediate SQL is not replayed |
| 00013 | 00013_profiles_last_login_at.sql: Proposed profile login timestamp | NONE | OBSOLETE | supabase/migration_archive/legacy_pre_baseline/00013_profiles_last_login_at.sql | 32C8E7E05570D1E10A4441016229CC1DE418547FEAE16FCAFEE720DEC5D9C0B0 | No replacement column; obsolete intent; REPLAY_PROHIBITED |
| 00014 | 00014_parent_panel_mvp.sql: Historical parent panel RPC | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00014_parent_panel_mvp.sql | B7D3F6929BE4D54D09061159CA029422EB360F3879BC163BED3BF8F9151F9EBD | B final catalog definitions; historical intermediate SQL is not replayed |
| 00015 | 00015_child_profiles.sql: Historical full child-profile definition | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00015_child_profiles.sql | B607D610988659B9AA2866BB71828DA4F2535048DAF5FFD47EC6014ADA774AD8 | B live nullable emails, partial unique index and final guards |
| 00016 | 00016_child_profiles_email_preapproval.sql: Incremental child-email preapproval | 20260502113939 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00016_child_profiles_email_preapproval.sql | E5059C100FBDA10674313EF84FFE726F84E6EDA642BC642E475D2241D14260CC | B live nullable emails, partial unique index and final guards |
| 00017 | 00017_link_child_account_rpc.sql: Child-account linking RPC | 20260502114959 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00017_link_child_account_rpc.sql | 5CAD50E957433F14E585354CA66E996BCA3E6421CE4531FD01EF98ABC272A1D0 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00018 | 00018_under13_preapproval_guard.sql: Under-13 preapproval guards | 20260502120308 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00018_under13_preapproval_guard.sql | F5E333185616695002F676BAF08280511CF46BF22552A456B0FA8A3483734F31 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00019 | 00019_idempotent_link_child_account.sql: Idempotent child-account linking | 20260502182210 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00019_idempotent_link_child_account.sql | 78052C294EA45648B4DE93C218F66C71F95FC7A0146706B8F74F1BE4F2CF296B | B final catalog definitions; historical intermediate SQL is not replayed |
| 00060 | 00060_plan_expiration_fields.sql: Fixed-term plan expiration | 20260509100602 | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00060_plan_expiration_fields.sql | 9B2D1A9AE7B61B060F3C25C9D343AB69ED04C54B61B2DB9717C5EA2AE7052455 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00061 | 00061_usage_events.sql: AI usage event ledger | 20260509142243 | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00061_usage_events.sql | 14CA71CF8BCE6BD14CF75626EC46DB604B7C1A9C3B40A10120324C2EDEB4C3A6 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00062 | 00062_usage_events_tutor_message.sql: Tutor usage event category | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00062_usage_events_tutor_message.sql | 963A893557DBA20F820A724852E514969A556E8589DDDEF3EC4294FB80C62CEB | B final catalog definitions; historical intermediate SQL is not replayed |
| 00063 | 00063_admin_plan_management.sql: Admin plan extension RPC | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00063_admin_plan_management.sql | 5592DDFCB0160528606506BE25D9B363855EC38A0B10B26EBDB91C2743EDE193 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00064 | 00064_admin_plan_actions.sql: Admin plan action audit log | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00064_admin_plan_actions.sql | 736ACC0C3E0C1F109C9A4CC344CEBDAE51350EB5AE62305A30CE81937C42F009 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00065 | 00065_payment_events.sql: Stripe payment event ledger | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00065_payment_events.sql | 013D0619A41D292A8BFFDE1204EBE6D7BCE128BAFF6717B9E685AFB3F00C3044 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00066 | 00066_family_effective_plan.sql: Family effective-plan RPC | 20260510183007 | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00066_family_effective_plan.sql | 0DB202329289DDF68E08D8664A34C89BB2E8C7398850B21C08A85B9FF4E0C24D | B final catalog definitions; historical intermediate SQL is not replayed |
| 00067 | 00067_family_effective_plan_hotfix.sql: Historical family-plan RPC hotfix | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00067_family_effective_plan_hotfix.sql | 78BACA9AA4B041BABF28273E3B493A26DF5870EF362369F56AE03363ACE53434 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00068 | 00068_security_parental_consents_rls.sql: Consent access hardening | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00068_security_parental_consents_rls.sql | 1749AC5B32F43DEAE7D2D745C999F94F7B8D1D8F6E2F3CBBCD70E64F8516AB05 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00069 | 00069_security_profiles_self_escalation.sql: Profile privilege escalation guard | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00069_security_profiles_self_escalation.sql | 76F048E7B1F5564BC8302A315B740B06333D5BC7DB6E2A629C741B1CD70BCB55 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00070 | 00070_security_chat_tutor_usage_rpc.sql: Trusted tutor usage reservation | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00070_security_chat_tutor_usage_rpc.sql | FCAFF38F5FE2DD6AE26E0E278D4BC034906C16C4ED5394FA511D0A9656ADA0B3 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00071 | 00071_storage_rls_study_materials.sql: Historical Storage path/reference policies | NONE | REPLAY_PROHIBITED | supabase/migration_archive/legacy_pre_baseline/00071_storage_rls_study_materials.sql | 3F423678739881D990AACC741B11DA6A708B6BB450BD3F9BB2C54D3EB31A6A23 | B uses legacy owner_id policies, never DB-reference access |
| 00072 | 00072_support_tickets_mvp.sql: Support-ticket schema and RLS | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00072_support_tickets_mvp.sql | 2621F6FA99882BA3B9D4FB07573EE56959FAD033D9994A52427CBA12D9D93B5E | B final catalog definitions; historical intermediate SQL is not replayed |
| 00073 | 00073_handle_new_user_search_path.sql: Auth-trigger search_path hardening | NONE | SUPERSEDED | supabase/migration_archive/legacy_pre_baseline/00073_handle_new_user_search_path.sql | C0E86C279A7802B9D0F95372712A09F0F4DE7B9ECDC428CBE280C9CE058A3A27 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00074 | 00074_identity_consent_account_security.sql: Identity and consent authorization hardening | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00074_identity_consent_account_security.sql | 1C8559D6DAC96D6B8B6028B3E8960B36344FF8267FA02369DD2BAE2C4543F8D1 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00075 | 00075_atomic_ai_usage_limits.sql: Atomic AI usage reservation | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00075_atomic_ai_usage_limits.sql | 28ACC0BA84F411274A64D067D0F0FA63671C4A92CA8ECEA5ED79F1CD1BB10A7A | B final catalog definitions; historical intermediate SQL is not replayed |
| 00076 | 00076_child_profiles_authorization_hardening.sql: Child preapproval authorization/integrity guards | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00076_child_profiles_authorization_hardening.sql | 1917871DE0AE95F6F242EAE3C4D2C245F6B7DA61478FBB977C4518C8040E272B | B final catalog definitions; historical intermediate SQL is not replayed |
| 00077 | 00077_profiles_insert_hardening.sql: Profile INSERT access hardening | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00077_profiles_insert_hardening.sql | 7591AB5F3CDDB50A238B72BAF86741F6F702B4C094EFF1B8433F49D5FF61BBCE | B final catalog definitions; historical intermediate SQL is not replayed |
| 00078 | 00078_storage_ownership_hardening.sql: Legacy Storage owner_id hardening | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00078_storage_ownership_hardening.sql | 5D2E6C6ABAA0FA9879F9CB75D83320EF19D228356D7C9FC9BDB1AC11AC401501 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00079 | 00079_drop_legacy_reference_policy_variants.sql: Removal of legacy-reference policy variants | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00079_drop_legacy_reference_policy_variants.sql | BC056D4367DC0B5A93CAC31967CF57395B7F05BB468178D9EE95A2B99ED785A3 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00080 | 00080_stripe_payment_fulfillment.sql: Stripe fulfillment and idempotency | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00080_stripe_payment_fulfillment.sql | F290914463751440CE4A755F289B23519D890BD8FB5FBC8636A1085D22005C38 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00081 | 00081_under13_pending_retention_cleanup.sql: Under-13 expiry, deadline and upload guards | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00081_under13_pending_retention_cleanup.sql | B64299CC4CED12A0A68525F15B1F50B17C2AEE2E5AB3EAFF526AD34E030BDF14 | B final catalog definitions; historical intermediate SQL is not replayed |
| 00082 | 00082_under13_parent_reminders.sql: Parent reminder state, claims, leases and fencing | NONE | REPRESENTED | supabase/migration_archive/legacy_pre_baseline/00082_under13_parent_reminders.sql | 00341C8305321BD8C0B2FCC4C57EEA10DCE47E3B33C260B168B95205B3E05D62 | B final catalog definitions; historical intermediate SQL is not replayed |

### 00013 disposition

```text
OBSOLETE_SCHEMA_INTENT
EXECUTION_NOT_PROVEN
LIVE_EFFECT_ABSENT
CANONICAL_REQUIREMENT_NO
REPLAY_PROHIBITED
```

## Remote-history anchors

Comments-only anchors preserve the 11 exact remote identities. Existing remote name/statements remain authoritative and unchanged; anchors do not reconstruct their SQL.

| Version | Original remote name | Mapped legacy |
|---|---|---|
| 20260427170350 | 00009_parental_consent | 00009 |
| 20260427170359 | 00010_consent_email_delivery | 00010 |
| 20260428183903 | profile_metadata | 00011 |
| 20260428202546 | 00012_profiles_rls_metadata_upsert | 00012 |
| 20260502113939 | 00016_child_profiles_email_preapproval | 00016 |
| 20260502114959 | 00017_link_child_account_rpc | 00017 |
| 20260502120308 | 00018_under13_preapproval_guard | 00018 |
| 20260502182210 | idempotent_link_child_account | 00019 |
| 20260509100602 | plan_expiration_fields | 00060 |
| 20260509142243 | usage_events | 00061 |
| 20260510183007 | 00066_family_effective_plan | 00066 |

## PRIV02 identity and runtime provenance

`00083_priv02_soft_deleted_session_access.sql` from source HEAD -> `20261010073843_priv02_soft_deleted_session_access.sql`.

Byte-identical SHA-256: `2AE56530F39DE18C6DB4543E324FA318A4D96424D96A24ECE158AEE5FFAF9AF9`. Prior rollback-only runtime verification of 00083 is provenance evidence from the approved PRIV-02 sequence, not a runtime test performed in 01D.1. Re-run on B in 01D.2. The old identity stays in Git history, not the legacy archive.

## Object inventory and ACL treatment

13 tables, 165 columns, 64 constraints, 45 total indexes (constraint-backed indexes are created by their constraints), 24 functions, 9 triggers including on_auth_user_created, 1 view, 21 public policies and 10 Storage policies. No public standalone enum/domain/range types or sequences were found in the previous approved catalog inventory.

B is assembled from reviewed final catalog definitions by dependency class, with approved canonical exceptions and explicit bootstrap preflight. It is not a legacy concatenation or an unreviewed dump. Comments are current catalog comments.

Supabase-managed Auth/Storage tables, roles, extension internals and publication are platform prerequisites; B creates no users or storage objects. B checks initialized platform roles and Storage RLS. pgcrypto and pg_cron are application extension requirements; pg_net/Vault are separate HTTP reminder dependencies.

Schema, table, column, view, function and public default ACLs are explicitly represented. Existing TRUNCATE/MAINTAIN grants and broad public default ACL matrices are PRESERVE_AND_DOCUMENT, not new hardening decisions. No GRANT ALL is used. Revoke inherited defaults before restoring each final object ACL. Supabase_admin-owned defaults require a sufficiently privileged disposable bootstrap connection; verify this in 01D.2.

### SECURITY DEFINER review

Every definer below retains owner postgres and SET search_path=public. EXECUTE is reset then restored from the captured ACL. No service credentials are embedded. INVOKER trigger functions with PUBLIC EXECUTE or no explicit search_path retain live behavior: DOCUMENT_ONLY; changing them would require a separate security task.

| Function | Mode | EXECUTE roles excluding owner | Reason / scope |
|---|---|---|---|
| admin_extend_plan_30_days | DEFINER | service_role | Trusted admin backend updates protected plan fields; no browser EXECUTE. |
| approve_parental_consent | DEFINER | service_role | Trusted consent endpoint atomically consumes a token and transitions a protected profile; no browser EXECUTE. |
| can_upload_study_materials | DEFINER | authenticated, service_role | Authenticated RLS helper reads/locks the authoritative account status. |
| check_and_reserve_ai_usage | DEFINER | service_role | Trusted AI backend reserves usage atomically under profile locks; no browser EXECUTE. |
| check_and_reserve_tutor_usage | DEFINER | service_role | Trusted tutor backend reserves usage; no browser EXECUTE. |
| check_child_limit | DEFINER | service_role | Trigger counts/locks parent relations regardless of caller visibility; no browser EXECUTE. |
| check_folder_circularity | INVOKER | PUBLIC, anon, authenticated, service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| claim_due_under13_parent_reminders | DEFINER | service_role | Trusted reminder backend claims leased work; no browser EXECUTE. |
| expire_pending_under13_accounts | DEFINER | service_role | Trusted cron/backend performs guarded account-status expiry; no browser EXECUTE. |
| finish_under13_parent_reminder | DEFINER | service_role | Trusted backend completes token-fenced work; no browser EXECUTE. |
| fulfill_stripe_premium_payment | DEFINER | service_role | Trusted Stripe backend updates protected entitlement and idempotency evidence; no browser EXECUTE. |
| get_my_effective_plan | DEFINER | authenticated, service_role | Authenticated own-account entitlement lookup includes validated guardian relationship. |
| get_parent_children | DEFINER | authenticated, service_role | Authenticated parent dashboard RPC enforces parent ownership and masks child contact. |
| handle_new_user | DEFINER | service_role | Auth trigger initializes protected application identity; no browser EXECUTE. |
| handle_thread_last_message | INVOKER | PUBLIC, anon, authenticated, service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| handle_updated_at | INVOKER | PUBLIC, anon, authenticated, service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| link_child_account | DEFINER | authenticated, service_role | Authenticated linker performs validated protected relationship/profile transitions. |
| prepare_under13_parent_reminder | DEFINER | service_role | Trusted backend checks delivery eligibility and records minimized fingerprints; no browser EXECUTE. |
| protect_child_profile_authorization | INVOKER | service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| protect_sensitive_profile_fields | INVOKER | PUBLIC, anon, authenticated, service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| protect_under13_retention_deadline | INVOKER | service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| set_updated_at_column | INVOKER | PUBLIC, anon, authenticated, service_role | Existing trigger/helper behavior; ACL/search_path preserved, DOCUMENT_ONLY where broad. |
| under13_parent_reminder_context | DEFINER | service_role | Trusted reminder eligibility lookup across profiles/relationships; no browser EXECUTE. |
| verify_consent_token | DEFINER | anon, authenticated, service_role | Existing browser-callable token lookup; preserve the exact constrained implementation and ACL (DOCUMENT_ONLY). |

## Environment setup (not baseline SQL)

B inserts/upserts only the private study-materials bucket configuration (NULL size/MIME overrides), adds only session_images to the existing supabase_realtime publication, and schedules the database-only expiry command SELECT public.expire_pending_under13_accounts(20); every 15 minutes. Scheduling SQL exists only in this local file; it was not executed in 01D.1.

Live also has the external job omninauka-under13-parent-reminder-d5 every 15 minutes. Its HTTP endpoint, Vault secret, HMAC binding and activation are environment setup, omitted from B. Existing production configuration is unchanged. Fresh tests must not send HTTP to production.

For a new environment, separately configure pg_net/Vault as needed, deploy send-under13-parent-reminders, and provision a new environment-specific UNDER13_REMINDER_SCHEDULER_SECRET in the Edge Function and corresponding Vault entry. Configure RESEND_API_KEY, RESEND_FROM_EMAIL and APP_BASE_URL outside Git. Use the current handler's x-omninauka-reminder-ts and x-omninauka-reminder-signature HMAC contract. Configure the cron endpoint for that environment only; activate only after a dedicated non-production smoke test. Never copy production Vault values, URLs, credentials or delivery rows. Local C0/C1 may keep this external integration unconfigured/disabled, as an explicit environment difference.

## 01D.2 acceptance / repair boundary

- C0: disposable initialized Supabase -> anchors+B, no seed -> compare named catalog definitions/ACL/Storage configuration with the approved pre-PRIV02 snapshot. Ignore OIDs and runtime job IDs, not security semantics.
- C1: disposable reset to full anchors+B+P -> exactly four additional restrictive policies -> authenticated/service-role pgTAP with synthetic users and rollback.
- Validate PL/pgSQL/SQL creation, function dependencies, owner/default-ACL permissions, extension setup, trigger attachment, Storage RLS and Realtime membership.
- Verify comments-only anchors are accepted by the installed CLI. Run full Node suite, TypeScript and build.
- The original 01D.2 boundary kept the source local-only until C0/C1 independently PASS. MIG-HIST-01E explicitly supersedes that prerequisite for baseline bookkeeping only; PRIV02 deployment still requires separate authorization.
- Future history target: original 11 records + B accepted without SQL replay; P remains the sole pending functional migration. Do not repair any sequential legacy identity.

## MIG-HIST-01E accepted technical debt and controlled history repair

```text
FRESH_DATABASE_BOOTSTRAP_RUNTIME=NOT_VERIFIED
```

Docker and paid disposable Supabase infrastructure are excluded. C0/C1 bootstrap, schema fingerprint comparison against a fresh database and pgTAP bootstrap runtime remain future reproducibility tests when a free isolated Supabase environment is available. Static validation does not establish bootstrap runtime validity.

The user explicitly accepts this technical debt for MIG-HIST-01E. It does not block the one authorized production bookkeeping operation: mark B (20261010073638) applied using the supported CLI, without executing its SQL. Verify the approved live canonical state first. Preserve the original 11 history entries and leave P unapplied; no application schema/data change or Git push is authorized.

Migration-directory `.gitattributes` rules disable Git text conversion for active and archived SQL. This preserves the reviewed bytes across staging/checkout, including the two archived CRLF files; no migration contents are rewritten.

The previous audit fingerprint includes migration history and therefore changes when B is recorded. For this task, verify that original fingerprint before repair and compare a separate schema-only fingerprint before/after, with original-history content checks handled independently.

## Static contract evidence

The machine-readable section records per-object local SQL checksums from the captured final definitions and the original archive bytes. It supports deterministic static checks, not SQL parser/runtime validation. Any intentional change needs new review and evidence; do not update checksums just to obtain PASS.

```json canonical-contract
{
  "baseline_file": "20261010073638_canonical_baseline.sql",
  "baseline_sha256": "79EFE5BCA95DC55DC5E07766451CED1F1043834B2E5AE745054CA1FF22838C4F",
  "priv02_file": "20261010073843_priv02_soft_deleted_session_access.sql",
  "priv02_sha256": "2AE56530F39DE18C6DB4543E324FA318A4D96424D96A24ECE158AEE5FFAF9AF9",
  "source_head": "d66564fd5ea9cc12c3db2d42ce530b9e7bcc680d",
  "expected_tables": [
    "admin_plan_actions",
    "child_profiles",
    "folders",
    "parental_consents",
    "payment_events",
    "profiles",
    "session_images",
    "study_sessions",
    "support_tickets",
    "tutor_messages",
    "tutor_threads",
    "under13_parent_notifications",
    "usage_events"
  ],
  "counts": {
    "tables": 13,
    "columns": 165,
    "constraints": 64,
    "indexes": 45,
    "functions": 24,
    "triggers": 9,
    "views": 1,
    "public_policies": 21,
    "storage_policies": 10
  },
  "archived": [
    {
      "version": "00001",
      "filename": "00001_init.sql",
      "purpose": "Initial profiles, sessions, Auth trigger and bucket",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00001_init.sql",
      "sha256": "A15D9CD0044E63DCF0E5970D20066D6EFDEF9F5AC291DB57AB888C9DC1120CC1",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00002",
      "filename": "00002_sprint1.sql",
      "purpose": "Initial study-analysis columns",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00002_sprint1.sql",
      "sha256": "A8708D0002CDF8E92BA808F2D3DFD95F53A627CA363C27AAABCF2B4D18940AE0",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00003",
      "filename": "00003_sprint2.sql",
      "purpose": "Additional study session state",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00003_sprint2.sql",
      "sha256": "523A9C8B5881FCFEC5A25AE9D6614FE4042C14B80F4AD99B48DFB54A8CCA6C09",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00004",
      "filename": "00004_rls_session_images.sql",
      "purpose": "Session-images schema and historical session RLS",
      "remote": "NONE",
      "classification": "REPLAY_PROHIBITED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00004_rls_session_images.sql",
      "sha256": "F470784ABC29005C12E67ADD768E6AD49B27B0AD65A5AE77266962E7FC445E73",
      "replacement": "B owner policies omit browser session DELETE"
    },
    {
      "version": "00005",
      "filename": "00005_sprint4_folders.sql",
      "purpose": "Folders and circularity protection",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00005_sprint4_folders.sql",
      "sha256": "96BF0D0DE41D3D342AEFADF1FCD698115F9D466AC4814BF0EB872F52220E7D59",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00006",
      "filename": "00006_sprint5_tutor_chat.sql",
      "purpose": "Tutor threads/messages and activity trigger",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00006_sprint5_tutor_chat.sql",
      "sha256": "FEB78362A3E19571F17BF5C00F636BA788614B7502C77BFBF2DF06BAB71F68BD",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00007",
      "filename": "00007_sprint8_quiz_results.sql",
      "purpose": "Quiz result persistence",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00007_sprint8_quiz_results.sql",
      "sha256": "0D43B8511E4741E55C68821D3C43206D56A697E9FBD5666EBAE5492BF6DB052A",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00008",
      "filename": "00008_sprint9_flashcard_progress.sql",
      "purpose": "Flashcard progress persistence",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00008_sprint9_flashcard_progress.sql",
      "sha256": "1D19643ADAB76FDD9374777DA8CC278CB079E1C4E03AA62FF63CD4D4F58A9C8C",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00009",
      "filename": "00009_parental_consent.sql",
      "purpose": "Parental consent workflow",
      "remote": "20260427170350",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00009_parental_consent.sql",
      "sha256": "E94311AA38C1167AB7E615445004987621C8CC8716E6BCF54D88CB646C0256AC",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00010",
      "filename": "00010_consent_email_delivery.sql",
      "purpose": "Consent email delivery metadata",
      "remote": "20260427170359",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00010_consent_email_delivery.sql",
      "sha256": "9D04DA8BA5F864645AEB5AEDD5A3B1B65FDCF181F1E912D99460E99BC2DF48D8",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00011",
      "filename": "00011_profile_metadata.sql",
      "purpose": "Profile educational metadata",
      "remote": "20260428183903",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00011_profile_metadata.sql",
      "sha256": "E3A92418DDCD156551670FF0DB22C465B40EF325CBDA5CCF2EFFF45A7996EDE4",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00012",
      "filename": "00012_profiles_rls_metadata_upsert.sql",
      "purpose": "Profile metadata upsert policies",
      "remote": "20260428202546",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00012_profiles_rls_metadata_upsert.sql",
      "sha256": "9266AD90D3810CBE9E9EC31821E38E2A58F6B4230132F4EB950AAD1C4A94AD3E",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00013",
      "filename": "00013_profiles_last_login_at.sql",
      "purpose": "Proposed profile login timestamp",
      "remote": "NONE",
      "classification": "OBSOLETE",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00013_profiles_last_login_at.sql",
      "sha256": "32C8E7E05570D1E10A4441016229CC1DE418547FEAE16FCAFEE720DEC5D9C0B0",
      "replacement": "No replacement column; obsolete intent; REPLAY_PROHIBITED"
    },
    {
      "version": "00014",
      "filename": "00014_parent_panel_mvp.sql",
      "purpose": "Historical parent panel RPC",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00014_parent_panel_mvp.sql",
      "sha256": "B7D3F6929BE4D54D09061159CA029422EB360F3879BC163BED3BF8F9151F9EBD",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00015",
      "filename": "00015_child_profiles.sql",
      "purpose": "Historical full child-profile definition",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00015_child_profiles.sql",
      "sha256": "B607D610988659B9AA2866BB71828DA4F2535048DAF5FFD47EC6014ADA774AD8",
      "replacement": "B live nullable emails, partial unique index and final guards"
    },
    {
      "version": "00016",
      "filename": "00016_child_profiles_email_preapproval.sql",
      "purpose": "Incremental child-email preapproval",
      "remote": "20260502113939",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00016_child_profiles_email_preapproval.sql",
      "sha256": "E5059C100FBDA10674313EF84FFE726F84E6EDA642BC642E475D2241D14260CC",
      "replacement": "B live nullable emails, partial unique index and final guards"
    },
    {
      "version": "00017",
      "filename": "00017_link_child_account_rpc.sql",
      "purpose": "Child-account linking RPC",
      "remote": "20260502114959",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00017_link_child_account_rpc.sql",
      "sha256": "5CAD50E957433F14E585354CA66E996BCA3E6421CE4531FD01EF98ABC272A1D0",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00018",
      "filename": "00018_under13_preapproval_guard.sql",
      "purpose": "Under-13 preapproval guards",
      "remote": "20260502120308",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00018_under13_preapproval_guard.sql",
      "sha256": "F5E333185616695002F676BAF08280511CF46BF22552A456B0FA8A3483734F31",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00019",
      "filename": "00019_idempotent_link_child_account.sql",
      "purpose": "Idempotent child-account linking",
      "remote": "20260502182210",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00019_idempotent_link_child_account.sql",
      "sha256": "78052C294EA45648B4DE93C218F66C71F95FC7A0146706B8F74F1BE4F2CF296B",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00060",
      "filename": "00060_plan_expiration_fields.sql",
      "purpose": "Fixed-term plan expiration",
      "remote": "20260509100602",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00060_plan_expiration_fields.sql",
      "sha256": "9B2D1A9AE7B61B060F3C25C9D343AB69ED04C54B61B2DB9717C5EA2AE7052455",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00061",
      "filename": "00061_usage_events.sql",
      "purpose": "AI usage event ledger",
      "remote": "20260509142243",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00061_usage_events.sql",
      "sha256": "14CA71CF8BCE6BD14CF75626EC46DB604B7C1A9C3B40A10120324C2EDEB4C3A6",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00062",
      "filename": "00062_usage_events_tutor_message.sql",
      "purpose": "Tutor usage event category",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00062_usage_events_tutor_message.sql",
      "sha256": "963A893557DBA20F820A724852E514969A556E8589DDDEF3EC4294FB80C62CEB",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00063",
      "filename": "00063_admin_plan_management.sql",
      "purpose": "Admin plan extension RPC",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00063_admin_plan_management.sql",
      "sha256": "5592DDFCB0160528606506BE25D9B363855EC38A0B10B26EBDB91C2743EDE193",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00064",
      "filename": "00064_admin_plan_actions.sql",
      "purpose": "Admin plan action audit log",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00064_admin_plan_actions.sql",
      "sha256": "736ACC0C3E0C1F109C9A4CC344CEBDAE51350EB5AE62305A30CE81937C42F009",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00065",
      "filename": "00065_payment_events.sql",
      "purpose": "Stripe payment event ledger",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00065_payment_events.sql",
      "sha256": "013D0619A41D292A8BFFDE1204EBE6D7BCE128BAFF6717B9E685AFB3F00C3044",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00066",
      "filename": "00066_family_effective_plan.sql",
      "purpose": "Family effective-plan RPC",
      "remote": "20260510183007",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00066_family_effective_plan.sql",
      "sha256": "0DB202329289DDF68E08D8664A34C89BB2E8C7398850B21C08A85B9FF4E0C24D",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00067",
      "filename": "00067_family_effective_plan_hotfix.sql",
      "purpose": "Historical family-plan RPC hotfix",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00067_family_effective_plan_hotfix.sql",
      "sha256": "78BACA9AA4B041BABF28273E3B493A26DF5870EF362369F56AE03363ACE53434",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00068",
      "filename": "00068_security_parental_consents_rls.sql",
      "purpose": "Consent access hardening",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00068_security_parental_consents_rls.sql",
      "sha256": "1749AC5B32F43DEAE7D2D745C999F94F7B8D1D8F6E2F3CBBCD70E64F8516AB05",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00069",
      "filename": "00069_security_profiles_self_escalation.sql",
      "purpose": "Profile privilege escalation guard",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00069_security_profiles_self_escalation.sql",
      "sha256": "76F048E7B1F5564BC8302A315B740B06333D5BC7DB6E2A629C741B1CD70BCB55",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00070",
      "filename": "00070_security_chat_tutor_usage_rpc.sql",
      "purpose": "Trusted tutor usage reservation",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00070_security_chat_tutor_usage_rpc.sql",
      "sha256": "FCAFF38F5FE2DD6AE26E0E278D4BC034906C16C4ED5394FA511D0A9656ADA0B3",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00071",
      "filename": "00071_storage_rls_study_materials.sql",
      "purpose": "Historical Storage path/reference policies",
      "remote": "NONE",
      "classification": "REPLAY_PROHIBITED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00071_storage_rls_study_materials.sql",
      "sha256": "3F423678739881D990AACC741B11DA6A708B6BB450BD3F9BB2C54D3EB31A6A23",
      "replacement": "B uses legacy owner_id policies, never DB-reference access"
    },
    {
      "version": "00072",
      "filename": "00072_support_tickets_mvp.sql",
      "purpose": "Support-ticket schema and RLS",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00072_support_tickets_mvp.sql",
      "sha256": "2621F6FA99882BA3B9D4FB07573EE56959FAD033D9994A52427CBA12D9D93B5E",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00073",
      "filename": "00073_handle_new_user_search_path.sql",
      "purpose": "Auth-trigger search_path hardening",
      "remote": "NONE",
      "classification": "SUPERSEDED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00073_handle_new_user_search_path.sql",
      "sha256": "C0E86C279A7802B9D0F95372712A09F0F4DE7B9ECDC428CBE280C9CE058A3A27",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00074",
      "filename": "00074_identity_consent_account_security.sql",
      "purpose": "Identity and consent authorization hardening",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00074_identity_consent_account_security.sql",
      "sha256": "1C8559D6DAC96D6B8B6028B3E8960B36344FF8267FA02369DD2BAE2C4543F8D1",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00075",
      "filename": "00075_atomic_ai_usage_limits.sql",
      "purpose": "Atomic AI usage reservation",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00075_atomic_ai_usage_limits.sql",
      "sha256": "28ACC0BA84F411274A64D067D0F0FA63671C4A92CA8ECEA5ED79F1CD1BB10A7A",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00076",
      "filename": "00076_child_profiles_authorization_hardening.sql",
      "purpose": "Child preapproval authorization/integrity guards",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00076_child_profiles_authorization_hardening.sql",
      "sha256": "1917871DE0AE95F6F242EAE3C4D2C245F6B7DA61478FBB977C4518C8040E272B",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00077",
      "filename": "00077_profiles_insert_hardening.sql",
      "purpose": "Profile INSERT access hardening",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00077_profiles_insert_hardening.sql",
      "sha256": "7591AB5F3CDDB50A238B72BAF86741F6F702B4C094EFF1B8433F49D5FF61BBCE",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00078",
      "filename": "00078_storage_ownership_hardening.sql",
      "purpose": "Legacy Storage owner_id hardening",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00078_storage_ownership_hardening.sql",
      "sha256": "5D2E6C6ABAA0FA9879F9CB75D83320EF19D228356D7C9FC9BDB1AC11AC401501",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00079",
      "filename": "00079_drop_legacy_reference_policy_variants.sql",
      "purpose": "Removal of legacy-reference policy variants",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00079_drop_legacy_reference_policy_variants.sql",
      "sha256": "BC056D4367DC0B5A93CAC31967CF57395B7F05BB468178D9EE95A2B99ED785A3",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00080",
      "filename": "00080_stripe_payment_fulfillment.sql",
      "purpose": "Stripe fulfillment and idempotency",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00080_stripe_payment_fulfillment.sql",
      "sha256": "F290914463751440CE4A755F289B23519D890BD8FB5FBC8636A1085D22005C38",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00081",
      "filename": "00081_under13_pending_retention_cleanup.sql",
      "purpose": "Under-13 expiry, deadline and upload guards",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00081_under13_pending_retention_cleanup.sql",
      "sha256": "B64299CC4CED12A0A68525F15B1F50B17C2AEE2E5AB3EAFF526AD34E030BDF14",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    },
    {
      "version": "00082",
      "filename": "00082_under13_parent_reminders.sql",
      "purpose": "Parent reminder state, claims, leases and fencing",
      "remote": "NONE",
      "classification": "REPRESENTED",
      "archive_path": "supabase/migration_archive/legacy_pre_baseline/00082_under13_parent_reminders.sql",
      "sha256": "00341C8305321BD8C0B2FCC4C57EEA10DCE47E3B33C260B168B95205B3E05D62",
      "replacement": "B final catalog definitions; historical intermediate SQL is not replayed"
    }
  ],
  "blocks": [
    {
      "kind": "SCHEMA_ACL",
      "name": "extensions",
      "sha256": "238E29FFCB91FD11A3AEC606C4407636E4505C0FBECB87A1F822B51F1B07A99F"
    },
    {
      "kind": "SCHEMA_ACL",
      "name": "public",
      "sha256": "8C963BA11DD0372FF10E4079DABD0399332B10B23443BBC39428CA238ED6B9EE"
    },
    {
      "kind": "TABLE",
      "name": "admin_plan_actions",
      "sha256": "1AF0204E1DC3730285B3C2553B7F2AF1795F5CDA5AC3B67CE8DA89D5737AA479"
    },
    {
      "kind": "TABLE",
      "name": "child_profiles",
      "sha256": "00AF50781A781814A7875DEAF7D06F612E9015DDD6591A24ADBDEC178C5573B8"
    },
    {
      "kind": "TABLE",
      "name": "folders",
      "sha256": "F7722ECB6554E099780A4B6F324E4433C6C385EB64D9AAD8EB0048F0CD2F206F"
    },
    {
      "kind": "TABLE",
      "name": "parental_consents",
      "sha256": "6B513E491699D8D7C54DB4BFCEBFA33004ABB7E31E574AFB59C9BADF66ADF615"
    },
    {
      "kind": "TABLE",
      "name": "payment_events",
      "sha256": "58DE004A8116D36BD3E55B21AE10816184EECFEA7EF7C1E1BB7CC3B9B7BEDD2B"
    },
    {
      "kind": "TABLE",
      "name": "profiles",
      "sha256": "A11E012922347CDC708C97F6D602BE351325A3EA6AEDBCEB663178DA35A841F9"
    },
    {
      "kind": "TABLE",
      "name": "session_images",
      "sha256": "E57B1B841B0BE88BD7A3F2198C247D7DBBE55661824280C75A90DB2E3110847D"
    },
    {
      "kind": "TABLE",
      "name": "study_sessions",
      "sha256": "DB83C6100DAA1AB8264079E8E37D437563452C3E9A0BFB888998D4D7BE85AB87"
    },
    {
      "kind": "TABLE",
      "name": "support_tickets",
      "sha256": "855A2349F3607B55EA376A780049E8ED049C6445058CE5FF85324809614A718F"
    },
    {
      "kind": "TABLE",
      "name": "tutor_messages",
      "sha256": "EDD9BB1E8DC775BB8A58DE6A6A64B9F73B6C62A20656AF09AF5924439ACD01C1"
    },
    {
      "kind": "TABLE",
      "name": "tutor_threads",
      "sha256": "D3CEADD3FAC37A611CD3942CBE1ED172C4DD47FE5BD3309BE072D0F558FAFFF5"
    },
    {
      "kind": "TABLE",
      "name": "under13_parent_notifications",
      "sha256": "FAF8303B6BDD82CB1726D72F08EF303C5C587E4CD3B8A5ECED1463AFF4B3BCA7"
    },
    {
      "kind": "TABLE",
      "name": "usage_events",
      "sha256": "2E4F46CAD5BFA0EEFC8C11CFD2D96DE3DCAF819D0B5BBC7CEE144F0746656C38"
    },
    {
      "kind": "CONSTRAINT",
      "name": "admin_plan_actions_pkey",
      "sha256": "131A6DC679B32D4042973ADC0B241AC3882EF338AFBF5BEF0DA97B23D4AB77DC"
    },
    {
      "kind": "CONSTRAINT",
      "name": "reason_max_length",
      "sha256": "D36F94F62AAE158044FF9A5FEC040BE5B9D8628A3C7C2B2407E7C458C47D3350"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_action_type",
      "sha256": "F8D8CCD5A09E5859229501E9A5ACC5329BD8F7CFB5610B5B9963676EBA346CB9"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_new_plan",
      "sha256": "E916D9D71BC33FBBC4963201B4CB35A6297014BB2E840DB3DD04B0C672B8C0E1"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_old_plan",
      "sha256": "0BD2DC2E541F82BE25A06EDC62C671265607DBBF7900317E4D49EE91A0938DDC"
    },
    {
      "kind": "CONSTRAINT",
      "name": "child_profiles_age_band_check",
      "sha256": "9E21F41B54D09B9ED6ACE09CA1288070218C4ECF430698FE293BAACDBC5C9571"
    },
    {
      "kind": "CONSTRAINT",
      "name": "child_profiles_integrity_version_check",
      "sha256": "117B914CD40E0A7A6E8449B7DF15BD954F4F32015C46F5F77619840B390FEDCF"
    },
    {
      "kind": "CONSTRAINT",
      "name": "child_profiles_pkey",
      "sha256": "489995B279EAAC89A7EB7684121F215143B73CC146FA55E55E546383AFC8E564"
    },
    {
      "kind": "CONSTRAINT",
      "name": "child_profiles_status_check",
      "sha256": "9E45466E39C1EEA2DD09A2DB3059DC801FB71CDA46E08526035F743A3503BE2E"
    },
    {
      "kind": "CONSTRAINT",
      "name": "folders_pkey",
      "sha256": "1781D013B770DD6E8B2C1B207DED5ED1362ADDB46FDF81AFDD72BDE834649436"
    },
    {
      "kind": "CONSTRAINT",
      "name": "parental_consents_child_user_id_key",
      "sha256": "5E517FBA5486B58C9C4EE81CECBEBA232DDCAF92D750D07D2F5D9F529B0239A2"
    },
    {
      "kind": "CONSTRAINT",
      "name": "parental_consents_pkey",
      "sha256": "D70E196EA67C3DAA13E4238654397370938493CF22130B63D079FFA0C184FF38"
    },
    {
      "kind": "CONSTRAINT",
      "name": "payment_events_pkey",
      "sha256": "92F7AEE8D0D275FB1C00326E9E59C9B2A77664F07191670066F912426DC50874"
    },
    {
      "kind": "CONSTRAINT",
      "name": "payment_events_status_check",
      "sha256": "14122F8C4714A7CC6D770CC193A69D84A76592BBFEEDDF49FC0DA198756C4268"
    },
    {
      "kind": "CONSTRAINT",
      "name": "payment_events_stripe_event_id_key",
      "sha256": "F3206770BE556397A3ECB6313D92CAEA2705510126A2F2E5130DD2152E7F7880"
    },
    {
      "kind": "CONSTRAINT",
      "name": "payment_events_target_plan_check",
      "sha256": "D857FC5793BD281258335D4E1EDE3855E5F56716E174F951808F264E290FBF30"
    },
    {
      "kind": "CONSTRAINT",
      "name": "profiles_pkey",
      "sha256": "DD4B6B91D0340BF72F314EDF446C9258DFBB662A4090B600F9DECA946BBAAB06"
    },
    {
      "kind": "CONSTRAINT",
      "name": "profiles_plan_check",
      "sha256": "134BCCAB9E92B9D4395D0CBFCD0BED351E3035EF07DE764159F6650F2EE8E197"
    },
    {
      "kind": "CONSTRAINT",
      "name": "session_images_pkey",
      "sha256": "0B78375D7B966CA25BEC051C8E8A6415DADAB8E84B6EE80C3486623BCD1254EB"
    },
    {
      "kind": "CONSTRAINT",
      "name": "study_sessions_pkey",
      "sha256": "99C5ADF0DD3DAC87D944147F34A1E770C608C521C323F5D4C547EE08FF256869"
    },
    {
      "kind": "CONSTRAINT",
      "name": "support_tickets_pkey",
      "sha256": "C62666C074F48CFCD39E2D85708AD2859814E0F6F5B61AC196A1D73DFA8F101F"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_category",
      "sha256": "A732D66EACEECF0ACB746E0CB1E3366B245250DB790D67F366632FB4D16E8D32"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_message_length",
      "sha256": "8AC6A00FE2D13880AD02AA36BFA90B390CF80C63E84E1104AF536DD402F231A6"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_status",
      "sha256": "5F750003357DC1C020B24393666F455324BC27587BE69C131F47E9E6A64EA66F"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_subject_length",
      "sha256": "B80CD1E084D8E17C22201C08901C6EBAF522E884AB11B8252FDC05130E6DECE6"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_messages_pkey",
      "sha256": "938FC2329A8BBB554BB710462CEE4BFB0FB5D7B9EABF78B87345EA1B61E45BC0"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_messages_role_check",
      "sha256": "958E0016F222CE20D61A9CAF8DE4F185BF75359168CE359FB3FBE7D124A0477A"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_threads_pkey",
      "sha256": "246DE04ED7C1ADA37D8466D67E8E807552E01BA43B0E7B4337AC1758894BAA3F"
    },
    {
      "kind": "CONSTRAINT",
      "name": "unique_session_thread",
      "sha256": "1B30E192A5C9E583358E0DFED5C994B849E3040F7314146F950A9DBF0D9BBA20"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_attempt_count_check",
      "sha256": "E0D3BC75FA42EF35B10C5BEF71B5586B166F98AC80D6E842ECDF850D844C20D0"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_check",
      "sha256": "095E651D964745E237CC7D206FD938BB449866A2F03C2E6DC356387D1DFFD2F2"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_check1",
      "sha256": "FE47887DD74D6AE702790FFBCBEF6C5148B37600EAD1E1533602811EB6A98934"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_check2",
      "sha256": "A7E0F43AF4523444E77A2FA11AB2F637D5CD7C50A41F92A13E8A684887FB3875"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_check3",
      "sha256": "34BE6109582688C6FBCE73B3D5E84913535D175FEF779DD5817805BD157A6CA7"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_check4",
      "sha256": "0932982F9AB854C77B771D366EC6C631AE063A9F5D3119E1954919571B43D52F"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_child_user_id_notification_kin_key",
      "sha256": "E242A13AE8777A63727EF852DD36EF32A137E3BD96080B6B6A64FBABC5F2592C"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_idempotency_key_key",
      "sha256": "7EEAFB368F9BBA8539B081D1146407FFF0865E3BDB7105E7E2060A8B088BE36D"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_notification_kind_check",
      "sha256": "A376ABE0132DEE00CB5B96EC14AB2BB8D3FBC2EECAC2E5F982FE2FE23BB636C1"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_payload_hash_check",
      "sha256": "02BBFA0C81B314A9D39A782A57B495AD091947E76A6C1DD4406E929EFC885C94"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_pkey",
      "sha256": "1675639E9CFDFDFB430161D6722E4755EDDF2158D60F32F884E74BB1B9AC8F65"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_recipient_email_hash_check",
      "sha256": "2795892C8426DE0A57DD2BDB692EEA54AB48B39B9A5AD7D18292492C0C204BA2"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_safe_error_category_check",
      "sha256": "BF4536D93A008F3A34DFFA8B67858D776D1BB13EFF2AB341ADADC3FFD227EFD7"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_status_check",
      "sha256": "31CB7F7A3FA4C60B6DFF040580285F531AE4D5C2663FB3FDA2D5D914906994ED"
    },
    {
      "kind": "CONSTRAINT",
      "name": "usage_events_pkey",
      "sha256": "F69E7FD03389AA65C68F625122184D613F4144F87F438C33E3355516169DC14D"
    },
    {
      "kind": "CONSTRAINT",
      "name": "valid_event_type",
      "sha256": "90FA5A6EC23723F9A55FA8A973EFA0EA8F15C79BBB1DF4F0C8FCE632B83D276D"
    },
    {
      "kind": "CONSTRAINT",
      "name": "admin_plan_actions_target_user_id_fkey",
      "sha256": "83D37DCD262BF86BA8A6A5B7CA6456A676A070E0534A358A7311ACBBACA3CB6A"
    },
    {
      "kind": "CONSTRAINT",
      "name": "child_profiles_child_user_id_fkey",
      "sha256": "BAEEE61A9FAB6A860D6C226EBBE35216966CA59A7396524436C4F339EAFC8898"
    },
    {
      "kind": "CONSTRAINT",
      "name": "child_profiles_parent_user_id_fkey",
      "sha256": "B296352C1AF431825701B294B1AD1F19E9CD3D82D72CDE56211F66DC1B7993C3"
    },
    {
      "kind": "CONSTRAINT",
      "name": "folders_parent_id_fkey",
      "sha256": "C83C00F95FB947B4FC0AD8D364D1F554B09FB6D78E409D0A4195C626A8851391"
    },
    {
      "kind": "CONSTRAINT",
      "name": "folders_user_id_fkey",
      "sha256": "0008A0430F2FF0143F748A36B97507FECE4845EA683EF61E9ACA0149C0E1E606"
    },
    {
      "kind": "CONSTRAINT",
      "name": "parental_consents_child_user_id_fkey",
      "sha256": "C454BFD57F9BE4FEB7FB1767C94544557C506EA816E6497DDFD6B1E4BA731E7A"
    },
    {
      "kind": "CONSTRAINT",
      "name": "payment_events_user_id_fkey",
      "sha256": "E58C3B05BD5C310832AFF83FB584B0787D5A28E47E49DC4A743F56956CA24166"
    },
    {
      "kind": "CONSTRAINT",
      "name": "profiles_id_fkey",
      "sha256": "909628B84967C0B8095BABF48625AB84A7BA68E8334234AFE4B5174613BD7FD3"
    },
    {
      "kind": "CONSTRAINT",
      "name": "session_images_session_id_fkey",
      "sha256": "EEE0423B472F155DB0054A87D1D69C79327699A391544AE6F5F16653383121D3"
    },
    {
      "kind": "CONSTRAINT",
      "name": "study_sessions_folder_id_fkey",
      "sha256": "9BC4D7A46B07D3836DC3E30260CF6B756F9CDFA71E57F97771A07C317B15ED67"
    },
    {
      "kind": "CONSTRAINT",
      "name": "study_sessions_user_id_fkey",
      "sha256": "D3CF4ACF945EF92A982E1F35AD25D42D77441A7277F9685DF5CEBFA6E592D071"
    },
    {
      "kind": "CONSTRAINT",
      "name": "support_tickets_user_id_fkey",
      "sha256": "0E34A515F2C5640157D380F24DB886A8088EA42E18F863C1183649C76D7F459F"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_messages_thread_id_fkey",
      "sha256": "EC95538D825957A33F610E94113AD18B5F04C94DA1F50ACF2BA2AFAEE0DFA49E"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_messages_user_id_fkey",
      "sha256": "44F51785F38FCA6CA6E08CBCD6ABE3536BD3BA7510C7A7B73C5C55B41C43BFC1"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_threads_session_id_fkey",
      "sha256": "1ECCF50C86E76BE68FA92F9F61698EF740B326887F8DCAEEF948A24D248C7946"
    },
    {
      "kind": "CONSTRAINT",
      "name": "tutor_threads_user_id_fkey",
      "sha256": "FE13BCE211CB810336E453F8D60CE5834C21C1F330A25D08E3236E82AADC8656"
    },
    {
      "kind": "CONSTRAINT",
      "name": "under13_parent_notifications_child_user_id_fkey",
      "sha256": "E1DA0153650E0A9A7F8CCB4475DFF8DCFEE65E1E3A62C8C08C8D64FEE6F78BBA"
    },
    {
      "kind": "CONSTRAINT",
      "name": "usage_events_session_id_fkey",
      "sha256": "AEEE4B5A3B047BAEFED8879B45A9C87C017C1CBCCD0B88E750EB12DFED53F8D6"
    },
    {
      "kind": "CONSTRAINT",
      "name": "usage_events_user_id_fkey",
      "sha256": "EEA697CF7BA78BE797D11029698F04BDFF576434DAF4572210C7E93133DCFD5F"
    },
    {
      "kind": "INDEX",
      "name": "admin_plan_actions_action_type_created_at_idx",
      "sha256": "FA2E44EEDC8C5578A12B30731CDC8D769E9B77FA81B97DEA8A6F838AEB78F68A"
    },
    {
      "kind": "INDEX",
      "name": "admin_plan_actions_admin_email_created_at_idx",
      "sha256": "C0D7F6C0D3A0F5CC14FE1380FC89C0370BF1FCB038DD7086ADE89F1F6AA8C3FC"
    },
    {
      "kind": "INDEX",
      "name": "admin_plan_actions_target_user_id_created_at_idx",
      "sha256": "71FE30DC8637B1088545F2012DE48F81F7A348E100F345DFCAB0408E0872820E"
    },
    {
      "kind": "INDEX",
      "name": "idx_child_profiles_child_email_normalized",
      "sha256": "F5E64D92675F7DB75B9A046341E78D0FB3FB1158D47743CA0B86FFD2F61093CF"
    },
    {
      "kind": "INDEX",
      "name": "idx_child_profiles_child_user_id",
      "sha256": "EB1A75D0894A844533A782E50A5B69573F651FD04A7846FC713FDF803CA04338"
    },
    {
      "kind": "INDEX",
      "name": "idx_child_profiles_parent_user_id",
      "sha256": "5246C2A821D33A1953FF821B40835FDC3216A2B85B22C602F37A8AC67E224C34"
    },
    {
      "kind": "INDEX",
      "name": "idx_child_profiles_unique_email_per_parent",
      "sha256": "EE4C3BD9383B8C6DD95E785AA81F8438D1E4C3AC34128F9A5036880B09509D18"
    },
    {
      "kind": "INDEX",
      "name": "idx_folders_parent_id",
      "sha256": "FE5EF7AEA0232CD60ACC0AE6B5C968C21B737B8C6455EB051058E04AEFAF80A8"
    },
    {
      "kind": "INDEX",
      "name": "idx_folders_user_id",
      "sha256": "10DC450B41E46EF9E64BDD2A87C8E985CE01A7FBDB5D94E3D3B17B30C331211B"
    },
    {
      "kind": "INDEX",
      "name": "payment_events_status_created_at_idx",
      "sha256": "5C3DA09794ACC455D1AAAFCD01B8DCDB2C1A8F815984A7B766567FE8D70EED3B"
    },
    {
      "kind": "INDEX",
      "name": "payment_events_stripe_event_id_idx",
      "sha256": "B72E6B0D0BAA20D6884DCE52A339199F04D2E25D5FC881B394822F5BC54D6694"
    },
    {
      "kind": "INDEX",
      "name": "payment_events_stripe_payment_link_id_idx",
      "sha256": "56D52C8D0790297FD7188A6C555A8C893E18B9523C25F3F477557B0BB1B0D2C7"
    },
    {
      "kind": "INDEX",
      "name": "payment_events_stripe_session_id_idx",
      "sha256": "3BA84BCB2FE8610FCB3453294453651A49381801D237DA7C83CC27CA9DD5971A"
    },
    {
      "kind": "INDEX",
      "name": "payment_events_stripe_session_id_unique",
      "sha256": "0E87423BFCDDE67DF85E8AA31E42747612DA74E486266A91FB58679089B725F2"
    },
    {
      "kind": "INDEX",
      "name": "payment_events_user_id_created_at_idx",
      "sha256": "074EEB2870551C372D79C4BDC385EDCCE3C3BBCA0229291211EA7BA2256158FF"
    },
    {
      "kind": "INDEX",
      "name": "idx_session_images_session_id",
      "sha256": "A4E513A317CE638499E8BECB1E4B33AAF4E9000F6AE5A43A86AA9D9F9C1F10FE"
    },
    {
      "kind": "INDEX",
      "name": "idx_session_images_session_id_image_url",
      "sha256": "1A344974B7CE9FFDAF0933DA9834EF4369EDC6CC76204A24BA26CE1918451207"
    },
    {
      "kind": "INDEX",
      "name": "idx_study_sessions_folder_id",
      "sha256": "FEAA61DB0880A093834C9F2F6A646B119A266E671B375E2236334E28D5C2BD13"
    },
    {
      "kind": "INDEX",
      "name": "idx_study_sessions_user_id_image_url",
      "sha256": "AFDBA54E910A09DD1D7EF0FF5C2C3630D08FF773A8757D3F4C3D3E3311C543DF"
    },
    {
      "kind": "INDEX",
      "name": "idx_support_tickets_created_at",
      "sha256": "42419B74C3F2C29531918E9908602E3CD74D278114C9A02B6030956DB3E47272"
    },
    {
      "kind": "INDEX",
      "name": "idx_support_tickets_status_created_at",
      "sha256": "2C0418045AE455DFD1315B95F9FDE8F2DFEE9CCE774115440DC9CDD91451E051"
    },
    {
      "kind": "INDEX",
      "name": "idx_support_tickets_user_id_created_at",
      "sha256": "AFED60539DFB44D3E4703CD683C358943952C26A4F3B3BE8BEEE3BCDB419733E"
    },
    {
      "kind": "INDEX",
      "name": "idx_tutor_messages_thread_date",
      "sha256": "7DA980BE15902D200FEB5EA3DDE38DD9295E197E2EEDF4162DB17514DFB57DC7"
    },
    {
      "kind": "INDEX",
      "name": "idx_tutor_threads_user",
      "sha256": "08BC571A1ADB6F9C9C63FE94D88E4EFDACB6C9CC437EFF06990EE9C0FC179A02"
    },
    {
      "kind": "INDEX",
      "name": "under13_parent_notifications_due_idx",
      "sha256": "844C5DE993005A213AD10AD0D6035271AB97AAD69B3FD8DE05474F624147FF56"
    },
    {
      "kind": "INDEX",
      "name": "usage_events_user_session_type_idx",
      "sha256": "EB7299482BE45D77AC01F93F136771AA0BFA8ACE58B88AB4D2046829376A0BE4"
    },
    {
      "kind": "INDEX",
      "name": "usage_events_user_type_created_idx",
      "sha256": "745C359785FA2171F2FB7795EC1397BF955C1B71D8E144646D3CE3524BE2C677"
    },
    {
      "kind": "FUNCTION",
      "name": "admin_extend_plan_30_days",
      "sha256": "A50C97C9E7F400296BD07AAE714D19273A8E8B27E868310805530825C1FC7639"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "admin_extend_plan_30_days",
      "sha256": "2FF88AAAF1324644D3371C3EEDF8E48761104F7658EEDAAD570AF784109531D5"
    },
    {
      "kind": "FUNCTION",
      "name": "approve_parental_consent",
      "sha256": "1E5A9D3AAF3C87485D9131C29496E116A36BA0E4B0552C78FC743014A205AD8F"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "approve_parental_consent",
      "sha256": "0AA91BAFE6DB9441D615D9279E51311759DDF6DCF50235BE6F1E88BA1BD9CBEC"
    },
    {
      "kind": "FUNCTION",
      "name": "can_upload_study_materials",
      "sha256": "DAD2CBC1DABDC41E342671722FB1C3C3853012F007F1B2AECBA1A25F99AE1B50"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "can_upload_study_materials",
      "sha256": "A2AB6A41635DA8A7B99607D4ACDFAC9A43AB8F2F5070CE7D4A5440BA6099D2A7"
    },
    {
      "kind": "FUNCTION",
      "name": "check_and_reserve_ai_usage",
      "sha256": "E68057DA0B1BA882805A093CBBCFB08D4D29C3958E38D94FA5F1E366B63DA1A5"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "check_and_reserve_ai_usage",
      "sha256": "D4062FAEB9D866011E58D65AA06C561A7155C0406F05827EDFC74CD914917E53"
    },
    {
      "kind": "FUNCTION",
      "name": "check_and_reserve_tutor_usage",
      "sha256": "4331501EC229F474746600AA4FC62D0BDC8DC992FAE16B9B57BC88EBE70454BF"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "check_and_reserve_tutor_usage",
      "sha256": "A1B2EC713043CFD7FCFAA594C18B314D905658FEC1D77030F0C287B8970F7088"
    },
    {
      "kind": "FUNCTION",
      "name": "check_child_limit",
      "sha256": "940E685DE4290F5DFE0D63747015DD6D9F98DF10FCF4058246C4F389042224DF"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "check_child_limit",
      "sha256": "0EA164D4256EDE7CA8E731F7094ECD525E3EB618E41DFB39D8899F93E9EE580D"
    },
    {
      "kind": "FUNCTION",
      "name": "check_folder_circularity",
      "sha256": "51E760F75990A2AB0FC71FD949B8600105D961055135879F7693DB79E5C1147D"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "check_folder_circularity",
      "sha256": "CBBAFDFC50617A650ABE110A9B7DD47D9F8F6D3D14BB50946F47EA3E0B6E4613"
    },
    {
      "kind": "FUNCTION",
      "name": "claim_due_under13_parent_reminders",
      "sha256": "7B0DB290D2049EFCFEE814143454609B9F06B5B87339ED9C452B08E428E24CBD"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "claim_due_under13_parent_reminders",
      "sha256": "1E55FC71690152F46B2ED8E514C694B14C57DE56EDFC7F3557848A15B19C9C3F"
    },
    {
      "kind": "FUNCTION",
      "name": "expire_pending_under13_accounts",
      "sha256": "E17097EBF45736D3904C0AFA854E734F343A087E438136DAEA2DB77D254A665B"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "expire_pending_under13_accounts",
      "sha256": "C7BCA90781DBFE18143054784FBC67190551488BA4ED9134E61E4E5ED300B9B6"
    },
    {
      "kind": "FUNCTION",
      "name": "finish_under13_parent_reminder",
      "sha256": "E172207DEDAD68EF636DD96A31305962E5BD7685DCF686513B5C2F039A67BCF1"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "finish_under13_parent_reminder",
      "sha256": "8091CC5D58F0806A981BB4C949570E128065730EA3A1F40D6EF6D6CD4FBFD06C"
    },
    {
      "kind": "FUNCTION",
      "name": "fulfill_stripe_premium_payment",
      "sha256": "C9EE8D278E8BC02980A839030E4F23C8E9933D91D7AD0F7DA492AD6964A86743"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "fulfill_stripe_premium_payment",
      "sha256": "6D8C683D35A2A406171E9C28B2377985F60691590BFFD507592C6044376339C3"
    },
    {
      "kind": "FUNCTION",
      "name": "get_my_effective_plan",
      "sha256": "6660117084D0FA7C7372CF5BCB0603798FC5E1113C766AEF91BE7FBAEA3CB00B"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "get_my_effective_plan",
      "sha256": "2BE36C15CF21631EA4ECD8C4D575D55FB518B77C3FCA40B7DF2159135049AD90"
    },
    {
      "kind": "FUNCTION",
      "name": "get_parent_children",
      "sha256": "D38CB106FB74BFFA27C981B8FC83E28CE61FAD5EC4FE9B5FA09E8A6D20B1DAD7"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "get_parent_children",
      "sha256": "DAAC672F48949CC87AA5727B04F84AD879B810D7E2C528AA498BE89DEA0BE49E"
    },
    {
      "kind": "FUNCTION",
      "name": "handle_new_user",
      "sha256": "29AFCA1C20F4B2BEE7B59481DFE8FF230D9008C99116F73159DA86308ED496AA"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "handle_new_user",
      "sha256": "447151CB22BE71CE76B9D1D17BBB74F8FE358EED103BB70DEDD4CDD5E279D629"
    },
    {
      "kind": "FUNCTION",
      "name": "handle_thread_last_message",
      "sha256": "F01925A8C43734AEB8BEA38443C5281180EFA64CA47F756006FDA320BF7604AB"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "handle_thread_last_message",
      "sha256": "D4ACF2E4752975CB33A99C8C55BC22B51246C85A28D144D1B2157905540D4D93"
    },
    {
      "kind": "FUNCTION",
      "name": "handle_updated_at",
      "sha256": "B55C0D0576F9165A365B4FD3A356E10361EB7053EF6EC7FDAFE9E26D05AAD7BF"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "handle_updated_at",
      "sha256": "8AD801A662E3487E7669825CA553AE9A3F1A7130143EDCD9B40C86EB0FB4D411"
    },
    {
      "kind": "FUNCTION",
      "name": "link_child_account",
      "sha256": "91228C47270431E00BAF4426A97307522707107752FB6A4CCFC2B7445B5BE953"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "link_child_account",
      "sha256": "85F42A46DE35C5E350A954525EC2F86F20AE0A8F1794D9264B48A647130727BE"
    },
    {
      "kind": "FUNCTION",
      "name": "prepare_under13_parent_reminder",
      "sha256": "3F7BCCBF8A3BACA5D05361597103CA4CF1F5239222EB2C38DCF55291B322A110"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "prepare_under13_parent_reminder",
      "sha256": "4CA802433B50C41574BDC27F39CC58AB0905DAC7EDA4DF304678093749AF69FB"
    },
    {
      "kind": "FUNCTION",
      "name": "protect_child_profile_authorization",
      "sha256": "7104FE84C53149A34CBDF1D1BA5F44214F9DD3AEB7E3CD120DE8305BC2BBE2E8"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "protect_child_profile_authorization",
      "sha256": "DDB6375B40DEDCE5D57838D36B89D646B2B029FAFA3DAA9CB1C177686E7E2654"
    },
    {
      "kind": "FUNCTION",
      "name": "protect_sensitive_profile_fields",
      "sha256": "3B18DF663B44714CF6408AFE46657A793679851954F0CAC295D3B97C85909C85"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "protect_sensitive_profile_fields",
      "sha256": "2D6B0108AA28BD2228122CA3BD4DDAABF975DDC09C5F21BEBC21ABE59837D85B"
    },
    {
      "kind": "FUNCTION",
      "name": "protect_under13_retention_deadline",
      "sha256": "911A10BA244E4D1C427F8837FB6581A50CDF4E11688AF4701B60332E639AE1BF"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "protect_under13_retention_deadline",
      "sha256": "A8A67B2E9E9970F9E9D30D5F1B0A94AD1ADFE95B29AC33F44D21542188E9EB01"
    },
    {
      "kind": "FUNCTION",
      "name": "set_updated_at_column",
      "sha256": "758B9EB44824F9DB251FACC64AEE4665BA9CED5A08ADDE6703FBEBB24B398140"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "set_updated_at_column",
      "sha256": "DA8376C9223F24BA847DFB189E2C2EFC10A4572B75EAB6D0AC99689BEEC1761E"
    },
    {
      "kind": "FUNCTION",
      "name": "under13_parent_reminder_context",
      "sha256": "78A65F724B638F2ECC2833BF94AB54C736624854B00E8DC2CAA7E1F78D0624A3"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "under13_parent_reminder_context",
      "sha256": "74B03DCF44A363024A50593CE90B8FBF61534F4432BE17DDBA22C54F82102AAE"
    },
    {
      "kind": "FUNCTION",
      "name": "verify_consent_token",
      "sha256": "AE5899C0452A8C62640891C810845740879BAD6C74A32F50BEDBE233E8A2CA39"
    },
    {
      "kind": "FUNCTION_ACL",
      "name": "verify_consent_token",
      "sha256": "0C59FDEE2DED3435AA58DFA1DA1B748ED835CBE3A488433F615E7EAC6F208D87"
    },
    {
      "kind": "TRIGGER",
      "name": "on_auth_user_created",
      "sha256": "67E88E11DA477D789B1287DE7261D0636FB865E772196624964BB8C762CD56E6"
    },
    {
      "kind": "TRIGGER",
      "name": "enforce_child_limit",
      "sha256": "3B6A18ECCEB47D6170236AEC8D818FCBF1063C6EF3327680AA54EF17465A484C"
    },
    {
      "kind": "TRIGGER",
      "name": "protect_child_profile_authorization_trigger",
      "sha256": "60E6A1B69B2F423501D3EF1356453992C89CCA5E2EF255C51D10956D3CA539C9"
    },
    {
      "kind": "TRIGGER",
      "name": "trg_check_folder_circularity",
      "sha256": "5CADF7BABE2746828875B52B50787A00EE27F8ED3E74B30378EC29F25E449568"
    },
    {
      "kind": "TRIGGER",
      "name": "protect_sensitive_profile_fields_trigger",
      "sha256": "1FA30AC9742A6FD44B63914F44F631483567FA12318D0B97B21F74250E977CEF"
    },
    {
      "kind": "TRIGGER",
      "name": "protect_under13_retention_deadline",
      "sha256": "894F36C70B5DE395A69513396EED577A5729C70F427E1431172CA3E101C1D606"
    },
    {
      "kind": "TRIGGER",
      "name": "trg_study_sessions_updated_at",
      "sha256": "AAFB507DBC37290AAEF69D0477CD29AE3A0FE5E96FA82EB31C84443F2FDB9EF2"
    },
    {
      "kind": "TRIGGER",
      "name": "trg_support_tickets_updated_at",
      "sha256": "C0B350BB382DF3B3216DD936837907F54426F97EFD8AA3F1787106CB0ACD8985"
    },
    {
      "kind": "TRIGGER",
      "name": "trg_tutor_messages_update_thread",
      "sha256": "3C189EC367DC84E4F57A3AEB2C5C61519D6C25058422F437A944CD0AC0491650"
    },
    {
      "kind": "VIEW",
      "name": "v_under13_pending_cleanup_candidates",
      "sha256": "E1A0AC46232E1937B26948450462C7A807DCC98F3A0A86B5A55C1E260D90BAED"
    },
    {
      "kind": "VIEW_ACL",
      "name": "v_under13_pending_cleanup_candidates",
      "sha256": "D4A61B015D678CD69A3C47F2B7447B739A44A80FAA1453E4C607481468AAB44F"
    },
    {
      "kind": "RLS",
      "name": "admin_plan_actions",
      "sha256": "26FB3D31C69649064BA88404D4FEC2658E6A217105902F4B8862BF54084E89AB"
    },
    {
      "kind": "RLS",
      "name": "child_profiles",
      "sha256": "09145673989EB70FCD3AF7229DF04291F7216208790473C067146B4437B211D3"
    },
    {
      "kind": "RLS",
      "name": "folders",
      "sha256": "92B566257A8CC8074B4B424FA9E6B68B258B45A840122D05D05B912137AD4A6E"
    },
    {
      "kind": "RLS",
      "name": "parental_consents",
      "sha256": "73A019C2615F734D5166E96B38247E07BB5435C374B7AB102FF174372B2DFFF0"
    },
    {
      "kind": "RLS",
      "name": "payment_events",
      "sha256": "0019B865431D5B1A4A43E3203D9E286BB86E3D5DA320A7CC219F7D9C0F89D3D6"
    },
    {
      "kind": "RLS",
      "name": "profiles",
      "sha256": "83967E856F70C00CF9A4914CD445DBFB16AEC09A5285DEA1A14AD09A50DEDE5F"
    },
    {
      "kind": "RLS",
      "name": "session_images",
      "sha256": "BE0417C6C68726069529DF106A912ECA66EA83C1AD9452788104CFE49ED695E5"
    },
    {
      "kind": "RLS",
      "name": "study_sessions",
      "sha256": "75A83A61B5368A4E0FDCBE46E0FE1A98BC12EE00AF0272A75FF120CC96D3283A"
    },
    {
      "kind": "RLS",
      "name": "support_tickets",
      "sha256": "F647225EB6C250136ECAA27EE1D5DAE0676777018DBBDE1E211A8D981535C927"
    },
    {
      "kind": "RLS",
      "name": "tutor_messages",
      "sha256": "178BA2AC65E9BE8E5C81F0600CC1E56A78F4E2F1F63EF2176E44402DB7F02FB7"
    },
    {
      "kind": "RLS",
      "name": "tutor_threads",
      "sha256": "89C26E03575D4DB8C5060C59BED9142892CF60EAD1BBC5BD4FBB0C27795C2682"
    },
    {
      "kind": "RLS",
      "name": "under13_parent_notifications",
      "sha256": "08C7253B6EEC0625B0EE0575169AF53DB1F1BC405A44A2A283D160B10B27BA71"
    },
    {
      "kind": "RLS",
      "name": "usage_events",
      "sha256": "8B9373B3E2350888ED0A422A36F619FFCA15DE45AF141E81A251FA3FCDA72B5C"
    },
    {
      "kind": "POLICY",
      "name": "Parents can insert their own child profiles",
      "sha256": "C60AFD5736C498ED7F48EA6003C38843F853DB78A87B7D8FF488A2825F098D99"
    },
    {
      "kind": "POLICY",
      "name": "Parents can select their own child profiles",
      "sha256": "86710183C283A6C4B819891B6AE563993C5341E4137F20FEFEE87BA7A0F5B6B1"
    },
    {
      "kind": "POLICY",
      "name": "Parents can update their own child profiles",
      "sha256": "ACD86CA092B119234EDACF8341F84DFC90069C52CB8E4F35B15C98DF2A7252AA"
    },
    {
      "kind": "POLICY",
      "name": "Users can manage their own folders",
      "sha256": "BE96FAE5D258732C228F022B6908815D47A9B44014586B02931F824E440F70E2"
    },
    {
      "kind": "POLICY",
      "name": "Users can view their own parental consent",
      "sha256": "AD64E333BFD3F42693448D87770B5725F9A13E8A9FFAC5516A88406E81EF7819"
    },
    {
      "kind": "POLICY",
      "name": "Users can update own metadata",
      "sha256": "DE507EF6FB2E202F4C848E9C99889E85BC3D2478E94F9B2789C2B9F4E9D3417F"
    },
    {
      "kind": "POLICY",
      "name": "Users can update own profile",
      "sha256": "C9B962FC3250100AF26A06E311D75EB01BF0A86C4CC2499E0172B397A3021346"
    },
    {
      "kind": "POLICY",
      "name": "Users can view own profile",
      "sha256": "D2C333BE1ABA3636EC197057F0077D5790C4F1CBAF1FBBDED7D7E4EB5149B174"
    },
    {
      "kind": "POLICY",
      "name": "Users can delete own session images",
      "sha256": "0B69CBC56241591CFC9CC559067000D8B700AB1CD98ACD9D67C6B960B4D52E68"
    },
    {
      "kind": "POLICY",
      "name": "Users can insert own session images",
      "sha256": "7666D186A97320093EF3C7E98309272BC7CF75FB01D32E3383C11A4040FD1162"
    },
    {
      "kind": "POLICY",
      "name": "Users can select own session images",
      "sha256": "F2D8B82E66BEDB3515E6012D9A1EEF94406C9DDCEA8F30F829AA10656B27B3CD"
    },
    {
      "kind": "POLICY",
      "name": "study_sessions_insert_own",
      "sha256": "5B3F4898FBF76A7443A83F437142FB6EEF4035945686B99E5349130834DF7557"
    },
    {
      "kind": "POLICY",
      "name": "study_sessions_select_own",
      "sha256": "470F956D7183F4387B0B5D72385E96AB8C28FA4C164D0F3B7719BB0F976DB1B6"
    },
    {
      "kind": "POLICY",
      "name": "study_sessions_update_own",
      "sha256": "3BF94B7DC5DF50C29EEC3ACA20E95E35CC0EF4E3582436D4A2268D7C01192D36"
    },
    {
      "kind": "POLICY",
      "name": "Users can insert their own support tickets",
      "sha256": "42F5B0DA548E64257957809622B3412B99D38252286683E823CD602EEF509743"
    },
    {
      "kind": "POLICY",
      "name": "Users can insert own tutor messages",
      "sha256": "7197AE3364468828D640FBA0AE55A02C2D23718CB72929E0D6B81199768E6F01"
    },
    {
      "kind": "POLICY",
      "name": "Users can view own tutor messages",
      "sha256": "58F43056D6358BF377B51478712E4BF1E2E0F86BC8FEEBF51F80D3F3E2D818DD"
    },
    {
      "kind": "POLICY",
      "name": "Users can create own tutor threads",
      "sha256": "ECD1023534059B6A5109CB78962A4CB24EABE8F19F721370D44E9FA83C23429F"
    },
    {
      "kind": "POLICY",
      "name": "Users can update own tutor threads",
      "sha256": "E690FD48F8CA77C027DE2538DBC35ECC54C92BE817E9D93CAADA1DECE9EC1A6A"
    },
    {
      "kind": "POLICY",
      "name": "Users can view own tutor threads",
      "sha256": "E47E04A44EBFAB300EE9923D688B44F7597CD9DB8606A117B04D5887E893B57D"
    },
    {
      "kind": "POLICY",
      "name": "Users can view own usage events",
      "sha256": "CA2727672234E2C9E08E18AAAE2238819E392348E0BD7F20E1FF575B11A60CF4"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_delete_legacy_owned",
      "sha256": "050FD89C27AAF9AC09339EAC2B010597FD88D39245F4811633025793D7C11627"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_delete_own_folder e4umg8_0",
      "sha256": "A9C2136CEAD8D56923CC4689B712E5A2D6C5D3B519A496642C7DAF44A4392F7E"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_delete_own_folder e4umg8_1",
      "sha256": "BB238DA3EEB55FC2BDE75BCFD6C4000DAB27194E4AD7E30EAC5F75861D2633F0"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_insert_account_guard",
      "sha256": "B56F2D4A94E6C4B3364E0EAF26C20BAB305316F68EE4B7D5D64D1218771DC585"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_insert_own_folder e4umg8_0",
      "sha256": "7EF3EF13F1CB226CA05F4B618BC6AAFA3332A1D17117336DA58BB3324D26B074"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_select_legacy_owned",
      "sha256": "446CDAF84A9FA5B97C1E1982220A9ADB4BF25A0AC4E393F82673893777EE8125"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_select_own_folder e4umg8_0",
      "sha256": "EAE24B7D3B14B9338D51B5D2B1B6EA7EA4A3BC58DB7EC94F120EEFF8DE872ACB"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_update_account_guard",
      "sha256": "06D7E90095B2E7C6C34A38C6C6569484B00BAA62A9C9A443D5A7EE50D5E2CD24"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_update_own_folder e4umg8_0",
      "sha256": "2297D31A86E509B2A8D21761AE4CBBA21973601442CF972BDFFA8AE57C9B5599"
    },
    {
      "kind": "POLICY",
      "name": "study_materials_update_own_folder e4umg8_1",
      "sha256": "935716762356744334A05BC40E6D766EA99E0BB340CEF38E0BA3289EFDA48CC9"
    },
    {
      "kind": "TABLE_ACL",
      "name": "admin_plan_actions",
      "sha256": "5F15F6364A66112CC02DF0F0668B9DFBD0D2DEB7F7730103F028D10CAC127D3D"
    },
    {
      "kind": "TABLE_ACL",
      "name": "child_profiles",
      "sha256": "47E404AA3378C687385D96E2AFA0F06CFF94E4AF20E512DFD5AE151795CE0C18"
    },
    {
      "kind": "TABLE_ACL",
      "name": "folders",
      "sha256": "31F8F353964DCDE92685200C50CBB34A957D2B1285B568E85136CD9B37C11433"
    },
    {
      "kind": "TABLE_ACL",
      "name": "parental_consents",
      "sha256": "FF11721CA6A0119EBD117AAED835098AB626686C2DA7CB03A8A3BCCA7499E375"
    },
    {
      "kind": "TABLE_ACL",
      "name": "payment_events",
      "sha256": "7E6FAAC2B4237F844DBB5BBC13C12FA555A84E0328C4E406E9C27F0D26EF3DD0"
    },
    {
      "kind": "TABLE_ACL",
      "name": "profiles",
      "sha256": "6C4E9B8C99A74483403D352FA6844B3BE5765D6153EB5C1386275D1814D501FE"
    },
    {
      "kind": "TABLE_ACL",
      "name": "session_images",
      "sha256": "A739D7DE9540193225517A8EDE58BCFEB13DA8ABFE9375E6C9E78BA99F8B8008"
    },
    {
      "kind": "TABLE_ACL",
      "name": "study_sessions",
      "sha256": "A5FE4F35BF71EFA4D7C71DC424749BD663F8B33BAEF2D16C37FF39BB069937F2"
    },
    {
      "kind": "TABLE_ACL",
      "name": "support_tickets",
      "sha256": "6EB25C299FB617EC87B341C805BD35E0A62139CB35A6141F0841FCA5D545084D"
    },
    {
      "kind": "TABLE_ACL",
      "name": "tutor_messages",
      "sha256": "C2617E18D3F5B199F7083F8D783F927B70428AD08B73432C85240A11F1D2381E"
    },
    {
      "kind": "TABLE_ACL",
      "name": "tutor_threads",
      "sha256": "AABCB2B1BB78E014F13B33284A8F8C87A8197A2FD23AE7F0D6B8849A397B093E"
    },
    {
      "kind": "TABLE_ACL",
      "name": "under13_parent_notifications",
      "sha256": "ED179DEFE6CF267ABB08F18D9398AB2B84034D33F644EFC4A36DC3FFC5C534C6"
    },
    {
      "kind": "TABLE_ACL",
      "name": "usage_events",
      "sha256": "09DBD101B9B508773AD380A9770F7BA6ED71A6F865BEDCBB6E748D8EDD98B0A2"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.admin_user_id",
      "sha256": "B1F1785303B73E5B1758D02F79BFC683B23842CFE194F4FEAA6DF6B18963727E"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.admin_email",
      "sha256": "1BF6B888713C359BF04708FABBF51AB3E570B9DC41AAC8FC34C17D6D494A1CBE"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.target_user_id",
      "sha256": "5B467A11CD32B4A0E1A9B0F863CE11FB893D2F32344D8BAE76F114D74B98A67B"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.target_email",
      "sha256": "9F32AC56883B759CF5FA7BCDF0D0396783AE86BAC9359C959E750B4AB76D9C2A"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.action_type",
      "sha256": "90998B7208D470B23806032E6343B9F780996439F0DE275122835A1C27D93E3B"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.old_plan",
      "sha256": "741D71B4B46C137669B63A36ED1A5D206A1484B4C8969CCEFDAF5C4ABAFA3E50"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.new_plan",
      "sha256": "E9860F74297B76E09227DDD468BA9253FF9B216C22409CD431771A916CDC5DC9"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.old_plan_expires_at",
      "sha256": "C51358F9A5E0D83D0F6E194CA7EFB69D62388D409229EB7FDA710F2F57B48B5F"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.new_plan_expires_at",
      "sha256": "2E21B9F733677DFDA7BD654DF635292D59AE63B6C3151A161806C0DE9515844D"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "admin_plan_actions.reason",
      "sha256": "08264EF208DE848983307696C92B8C59529528206C81F2F96D27E0A055C291A7"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "payment_events.stripe_event_id",
      "sha256": "366EDAA98EBE8409AEF07B4FA6145333B1FC109D57333B051ACCD5561FD1E3B5"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "payment_events.status",
      "sha256": "0C6C4098ABD56E2F4ACFE3F341BFFDE95493264B99925E57CF5046E5AAEFB181"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "payment_events.payload",
      "sha256": "9450E975B5E7A30858A19FD0AF121935E08DEE295EEC65784C5742ABEEF7529F"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "study_sessions.quiz_result",
      "sha256": "99B2328A008C7F6C6F58081D29849A3A394E4013F79C5BBEA13A3702CB3E9D69"
    },
    {
      "kind": "COLUMN_COMMENT",
      "name": "usage_events.event_type",
      "sha256": "BB88BB1FFAA1698B89479BB7BD87EE0F0EAB44A1834F088ADF220C6B4D4A8943"
    },
    {
      "kind": "TABLE_COMMENT",
      "name": "admin_plan_actions",
      "sha256": "2507B73C239479F7A8BFA5E05C6B4829C921462D5B7A16F0877078B8BC000BD5"
    },
    {
      "kind": "TABLE_COMMENT",
      "name": "payment_events",
      "sha256": "775D5CB9887F8DB9AFC45F2813CEF094E535D753177BE1FD7DF40D8682829CD1"
    },
    {
      "kind": "TABLE_COMMENT",
      "name": "usage_events",
      "sha256": "F18AC30F4C8DB17100C2ABE3C55D031F4822C1D76C55F07893B824632C1FD21F"
    },
    {
      "kind": "DEFAULT_ACL",
      "name": "supabase_admin.S",
      "sha256": "71B74BA468EF3C0BDCFB2C9C65EF728446D6E9F5255DC0ED84256159F2854C9C"
    },
    {
      "kind": "DEFAULT_ACL",
      "name": "supabase_admin.f",
      "sha256": "BD32C1ACC185FE5596F6AEBCC3ABFDFA216E8AA269664E0265129C3CBF77EFA8"
    },
    {
      "kind": "DEFAULT_ACL",
      "name": "supabase_admin.r",
      "sha256": "ED468A98DCCC0BA6F83B8B375469616A606E0462822DE21FEB6CD3F12E94ACF2"
    },
    {
      "kind": "DEFAULT_ACL",
      "name": "postgres.S",
      "sha256": "69F68F657F4FAA6ED2BF140467265A2E5A9E0DEFF3D31BC8EA5E75B0EEA4B7DE"
    },
    {
      "kind": "DEFAULT_ACL",
      "name": "postgres.f",
      "sha256": "E4CC0E3826D4147539750641CEBAC6247EF800A4A50EF91CE3738AAEC2EF63CE"
    },
    {
      "kind": "DEFAULT_ACL",
      "name": "postgres.r",
      "sha256": "B08CBC221FCD8E49E9796DBF2F9313C072971021792876D19FFE524986F7031F"
    },
    {
      "kind": "BUCKET",
      "name": "study-materials",
      "sha256": "B4F1D278A9881F167C087704A451A12030975A8187B2F3A4CA3F6B5F78FD8FC4"
    },
    {
      "kind": "REALTIME",
      "name": "session_images",
      "sha256": "630A12B306208822B33244E5BD5338B6E04BF0DBE8368D5ED10BD6640734F311"
    },
    {
      "kind": "CRON",
      "name": "omninauka-expire-under13-pending",
      "sha256": "52CB773294A88967C373099E8E59B675488C9DD890FF584D73759A4D28762792"
    }
  ],
  "functions": [
    {
      "name": "admin_extend_plan_30_days",
      "definition_sha256": "A50C97C9E7F400296BD07AAE714D19273A8E8B27E868310805530825C1FC7639",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "approve_parental_consent",
      "definition_sha256": "1E5A9D3AAF3C87485D9131C29496E116A36BA0E4B0552C78FC743014A205AD8F",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "can_upload_study_materials",
      "definition_sha256": "DAD2CBC1DABDC41E342671722FB1C3C3853012F007F1B2AECBA1A25F99AE1B50",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "check_and_reserve_ai_usage",
      "definition_sha256": "E68057DA0B1BA882805A093CBBCFB08D4D29C3958E38D94FA5F1E366B63DA1A5",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "check_and_reserve_tutor_usage",
      "definition_sha256": "4331501EC229F474746600AA4FC62D0BDC8DC992FAE16B9B57BC88EBE70454BF",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "check_child_limit",
      "definition_sha256": "940E685DE4290F5DFE0D63747015DD6D9F98DF10FCF4058246C4F389042224DF",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "check_folder_circularity",
      "definition_sha256": "51E760F75990A2AB0FC71FD949B8600105D961055135879F7693DB79E5C1147D",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": null,
      "execute_roles": [
        "PUBLIC",
        "anon",
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "claim_due_under13_parent_reminders",
      "definition_sha256": "7B0DB290D2049EFCFEE814143454609B9F06B5B87339ED9C452B08E428E24CBD",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "expire_pending_under13_accounts",
      "definition_sha256": "E17097EBF45736D3904C0AFA854E734F343A087E438136DAEA2DB77D254A665B",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "finish_under13_parent_reminder",
      "definition_sha256": "E172207DEDAD68EF636DD96A31305962E5BD7685DCF686513B5C2F039A67BCF1",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "fulfill_stripe_premium_payment",
      "definition_sha256": "C9EE8D278E8BC02980A839030E4F23C8E9933D91D7AD0F7DA492AD6964A86743",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "get_my_effective_plan",
      "definition_sha256": "6660117084D0FA7C7372CF5BCB0603798FC5E1113C766AEF91BE7FBAEA3CB00B",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "get_parent_children",
      "definition_sha256": "D38CB106FB74BFFA27C981B8FC83E28CE61FAD5EC4FE9B5FA09E8A6D20B1DAD7",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "handle_new_user",
      "definition_sha256": "29AFCA1C20F4B2BEE7B59481DFE8FF230D9008C99116F73159DA86308ED496AA",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "handle_thread_last_message",
      "definition_sha256": "F01925A8C43734AEB8BEA38443C5281180EFA64CA47F756006FDA320BF7604AB",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": null,
      "execute_roles": [
        "PUBLIC",
        "anon",
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "handle_updated_at",
      "definition_sha256": "B55C0D0576F9165A365B4FD3A356E10361EB7053EF6EC7FDAFE9E26D05AAD7BF",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": null,
      "execute_roles": [
        "PUBLIC",
        "anon",
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "link_child_account",
      "definition_sha256": "91228C47270431E00BAF4426A97307522707107752FB6A4CCFC2B7445B5BE953",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "prepare_under13_parent_reminder",
      "definition_sha256": "3F7BCCBF8A3BACA5D05361597103CA4CF1F5239222EB2C38DCF55291B322A110",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "protect_child_profile_authorization",
      "definition_sha256": "7104FE84C53149A34CBDF1D1BA5F44214F9DD3AEB7E3CD120DE8305BC2BBE2E8",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "protect_sensitive_profile_fields",
      "definition_sha256": "3B18DF663B44714CF6408AFE46657A793679851954F0CAC295D3B97C85909C85",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "PUBLIC",
        "anon",
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "protect_under13_retention_deadline",
      "definition_sha256": "911A10BA244E4D1C427F8837FB6581A50CDF4E11688AF4701B60332E639AE1BF",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "set_updated_at_column",
      "definition_sha256": "758B9EB44824F9DB251FACC64AEE4665BA9CED5A08ADDE6703FBEBB24B398140",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": false,
      "config": null,
      "execute_roles": [
        "PUBLIC",
        "anon",
        "authenticated",
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "under13_parent_reminder_context",
      "definition_sha256": "78A65F724B638F2ECC2833BF94AB54C736624854B00E8DC2CAA7E1F78D0624A3",
      "owner": "postgres",
      "language": "sql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "postgres",
        "service_role"
      ]
    },
    {
      "name": "verify_consent_token",
      "definition_sha256": "AE5899C0452A8C62640891C810845740879BAD6C74A32F50BEDBE233E8A2CA39",
      "owner": "postgres",
      "language": "plpgsql",
      "volatility": "v",
      "definer": true,
      "config": [
        "search_path=public"
      ],
      "execute_roles": [
        "anon",
        "authenticated",
        "postgres",
        "service_role"
      ]
    }
  ]
}
```
