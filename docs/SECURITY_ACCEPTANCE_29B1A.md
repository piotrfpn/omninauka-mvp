# Sprint 29B.1A — security acceptance matrix

Implementation artifact, not production acceptance. No migration or deployment
was executed. Run database and browser scenarios only in an explicitly authorized
environment after resolving migration-history drift and coordinating rollout.
Never record real raw tokens, hashes, service keys or personal data in test logs.

Local tests: `node --test tests/account-security.test.mjs` (Node 24; existing
TypeScript dependency). They run the actual AI entrypoint denial paths with
provider/database doubles and the public approval handler. They do not execute SQL
and cannot prove database locking, production ACLs or a deployed Edge gateway.

| # | Scenario / procedure | Expected result | Current evidence |
|---|---|---|---|
| 1 | Signup student with `16_17` and `18_plus`; load profile and use own AI session | `student`, correct age, `active`, `free`; normal flow works | SQL reviewed; allowed-status helper tested; live NOT TESTED |
| 2 | Signup with role `parent`, age `parent` | Parent profile remains `active`; parent dashboard and preapproval work | SQL reviewed; live NOT TESTED |
| 3 | Direct Auth signup for both `under_13` and `13_15` with `accountStatus='active'` | Derived pending status; supplied status ignored; under-13 pending timestamp set | SQL reviewed; live NOT TESTED |
| 4 | Auth signup `user_role='admin'` or another unsupported role; invalid/mismatched/missing age | Signup rejected; no privileged/active profile is created | SQL reviewed; live NOT TESTED |
| 5 | Under-13 pending user calls all three AI endpoints directly, including forged active body metadata | 403 before Vision/OpenAI calls or usage reservation | Local entrypoint tests PASS; deployed NOT TESTED |
| 6 | 13–15 pending consent user calls all three AI endpoints | 403 before provider call | Local entrypoint tests PASS; deployed NOT TESTED |
| 7 | Valid approved 13–15 account; active older student/linked child | AI guard allows; existing ownership and usage checks still apply | Allowed-status helper tests PASS; provider/live NOT TESTED |
| 8 | Child SELECT `token_hash`, sensitive columns and `*`; direct hash RPC; submit hash as raw token to new endpoint | SELECT/EXECUTE denied for anon/authenticated; hash-as-token fails | Local hash-as-token test PASS; DB ACL NOT TESTED |
| 9 | Parent uses raw email token; run two simultaneous approvals | Exactly one true/200; consent and profile change atomically; second false/409, no further change | Handler tests PASS; SQL reviewed; DB concurrency NOT TESTED |
| 10 | Token expires, including expiration while approval waits for a row lock | Approval false/409; profile and consent remain unchanged | SQL uses `clock_timestamp()` after lock waits; DB NOT TESTED |
| 11 | Replay approved token; also test token rotated/withdrawn before approval | No repeated state change; verify reports already approved or invalid; approval false/409 | Backend false response tested; DB NOT TESTED |
| 12 | Already-linked child in `suspended`, `parent_withdrawn`, expired, unknown, NULL or other blocking state calls linking | `linked=false`, safe reason; no transition to active; no relationship changes | SQL reviewed; DB NOT TESTED |
| 13 | Genuine pending preapproval, different parent, acknowledged consent, matching normalized email | Links and activates only pending under-13; active already-linked replay changes nothing | SQL reviewed; parent UI insert contract checked; DB NOT TESTED |
| 14 | Suspend child concurrently with link/approval; claim the same pending relationship concurrently | Locking and conditional updates prevent reactivation of a blocked state and duplicate claiming | SQL reviewed; DB concurrency NOT TESTED |
| 15 | Missing profile, query error, transport exception, unknown status across all AI endpoints | 403; no provider call; errors contain no profile details | Local helper and entrypoint tests PASS |
| 16 | Public approval method/body abuse, forged JSON IP/agent, oversize body, database exception | Reject malformed input; only request UA stored, IP NULL; no secrets/errors disclosed | Local handler tests PASS |

## Rollout prerequisites (not performed by this sprint)

1. Read-only inventory exact production function bodies, owners, ACLs, column grants,
   triggers and required columns. Reconcile registry 00066 versus actual effects
   00067–00073 by a separately approved procedure; do not blindly replay history.
2. Review current profiles for roles/statuses previously accepted from metadata.
   This migration changes future signup, not existing identities or evidence of
   their consent. Any remediation requires a separate authorized data plan.
3. Stage and validate migration 00074, new approval Edge Function, AI guards and
   frontend as a coordinated change. The old handle_new_user needs accountStatus
   metadata; the new frontend deliberately stops sending it. The new browser
   approval needs the new Edge Function; old browser approval loses RPC permission.
   Define a release/maintenance window and reject unsafe partial rollout.
4. Verify effective ACLs, including inherited roles/column grants and any views
   exposing consent secrets. Browser retains own profile status; parent data comes
   through the existing minimal get_parent_children RPC. Service-role admin/email
   operations retain their table access. Public verify exposes only valid token
   status and child display name; no sensitive columns.
5. Test pending signup, email confirmation, resend/token rotation, public parent
   verification/approval, dashboard and linking. Manual routes: `/register`,
   `/login`, `/pending-consent`, `/consent/:token`, `/app/parent`, and the existing
   upload/tutor/regeneration flows.
6. Existing child_profiles write policies, profile INSERT recovery paths, legacy
   identities and all other SECURITY DEFINER operations require separate review.
   This sprint restricts link_child_account transitions; it does not establish
   legal guardian identity or redesign all relationship creation/edit permissions.
