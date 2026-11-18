# Phase 12 — Privacy lifecycle, encrypted backups, and recovery

**Post-merge reconciliation (November 17, 2026):** Source [PR #23](https://github.com/A13Xg/Daydle/pull/23) **MERGED** into main at `52d9d4c58b1ac10b13e1c59f625296b4b73f507e`; [main CI #44172190894](https://github.com/A13Xg/Daydle/actions/runs/44172190894) PASS. The draft/unmerged statements below are historical. **Operational acceptance remains BLOCKED**: no verified offsite scheduled backups, restore/deletion replay, live Worker cron, or account-deletion E2E. **Phase 12 SQL was applied and service-only grants checked as hosted version `20261118013526_phase12_privacy` on November 18 UTC**. Retain this root plan pending actual evidence; do not archive it as completed merely because source merged.

**Status:** SOURCE CI VERIFIED; operational backup/recovery acceptance BLOCKED (draft PR, no production actions).  
**PR:** [#23](https://github.com/A13Xg/Daydle/pull/23) (draft), targeting `phase/11-admin-requests-diagnostics`; parent [PR #22](https://github.com/A13Xg/Daydle/pull/22) ready for owner review.  
**Verified stacked base:** `6a0f80c23f24bd0fd3869e53f15faf78d091d57f` (Phase11 final [CI #44050163041](https://github.com/A13Xg/Daydle/actions/runs/44050163041) PASS).  
**Authority:** [IDEA.md](IDEA.md) §11, [roadmap.md](roadmap.md) Phase12, [AGENTS.md](AGENTS.md).  
**Production actions:** NOT AUTHORIZED. No staged or live deletion, secret change, hosted SQL, Worker deploy, schedule activation, or backup service modification.

## Preflight evidence
- Phase2 created `public.raw_submissions` with `expires_at <= received_at + 90 days`, but this is only metadata. An `app_private.purge_expired_raw_submissions()` function exists but no verified scheduled execution.
- Phase7 result deletion is already live as `DELETE /api/v1/results/:id` with owner-scoped SQL, and `result_corrections` reference results with cascade.
- `auth.users` -> `public.profiles` -> result/social/suggestion data use on-delete cascades. `app_private.admin_events.actor_id` becomes NULL, but `subject_id` can retain a deleted player's UUID without a cleanup trigger.
- Existing Worker verifies OAuth via Supabase Auth `/auth/v1/user` and uses service-role-key RPC with `redirect: "manual"`. Do not repurpose a generic user-supplied UUID to delete/export another account.
- Cloudflare Workers support `triggers.crons` in `wrangler.jsonc` and a `scheduled()` event. The existing protected `Deploy Worker` workflow must preserve exactly-applied migration history and encrypted Worker secret preflight.
- Supabase Auth `deleteUser` is service-role-only; JWT tokens can remain syntactically valid until expiry after deletion. Owner deletion must cascade and subsequent API access must fail closed.
- Supabase Free does not include managed automatic backups. The repo has no verified separate encrypted backup destination, credential scope, restoration or deletion-tombstone replay.

## User-visible privacy lifecycle

1. Account page offers **Export my data**. Authenticated, owner-only paged export includes public profile + friend code, selected games, results with canonical puzzle IDs and provenance, corrections, own retained unexpired raw shares including failed samples, friendships/blocks, achievements, suggestions/votes and result events. It explicitly excludes expired raw material, other users' private data and operational credentials. User knows that the file can contain their raw copied shares.
2. Exports have deterministic keyset pagination. The frontend iterates to completion before constructing a single JSON download; fail the entire export on an interrupted page/identity change or schema mismatch instead of returning a mislabeled incomplete archive.
3. **Delete account** is deliberately separate from result deletion and requires unambiguous typed confirmation. Server checks a verified OAuth bearer; targets only verified current user via Supabase Admin API; on success all user-owned records cascade and client signs out. A meaningful inability to complete must be reported without falsely claiming deletion. Do not put delete capability behind client-only authorization.
4. Anonymize admin audit user subject identifiers within the same database transaction that deletes user profile, retaining safe security event counts without their identity. Keep a separate restoration/deletion reapplication plan for old backups; do not claim a restored backup automatically honors later deletion.
5. Raw texts are never cached in shared client caches or public service worker storage, never printed in logs, and never included in public/admin aggregate diagnostics.

## Scheduled retention

- Add `public.privacy_purge_expired_raw()` service-role-only RPC that calls the existing private purge and returns a bounded count; no caller-provided user ID.
- Add Cloudflare `scheduled()` handler and one UTC daily cron to the *proposed source config*. Invocations use only existing Worker service-role key and a sanitized count/failure code; no public HTTP route to invoke the purge. Unsupported/missing bindings fail closed. Scheduled check is tested with fake RPC; real production cron outcome remains NOT VERIFIED until owner-authorized deploy.
- Include expired unparsed, accepted and orphaned raw rows; deletion must be bounded/retry-safe and protected under RLS. The 90-day maximum includes persisted samples; expiration means no user/admin display even before cleanup.

## Backup/restore architecture

- Backup source: PostgreSQL custom-format `pg_dump` using a *dedicated read-only backup credential* where possible and TLS `sslmode=verify-full`. A transient plaintext dump exists only on an ephemeral protected backup runner and is securely removed in all exit paths. No plaintext dump or DB URL enters GitHub artifacts/logs.
- Encrypt every archive before offsite upload using authenticated AES-256-GCM with Node built-in `crypto`, random nonce and versioned archive header, key held only as a protected secret in a separate backup environment. Decryption authenticates the entire archive before restoration. No dependence on any additional npm crypto library.
- Offsite storage is a dedicated private S3-compatible object bucket (Cloudflare R2 plausible but unprovisioned). Encrypted object upload is through a narrowly scoped, non-public object-storage credential. Server-side bucket retention, lifecycle expiration, audit/alerts and key recovery must be separately configured and verified.
- Verification: isolated PG17 restore from decrypted backup into a **new non-production database**, integrity manifest and expected table row/catalog probes; never restore directly into production. A deletion journal/replay or restore cutover procedure must prevent expired/deleted user data from being reactivated by older backup snapshots.
- Existing GitHub Environment and secret models must not be repurposed to expose backups to PR workflows. Protected manual run preflight, then schedule activation only after owner authorizes storage/encryption settings and a successful restore drill. No automatic production backup execution in this PR.

## Planned implementation sequence

1. Implement and test SQL privacy export projections, deletion audit anonymization, and purge wrapper in one forward-only migration. Extend exact local/hosted migration-history allowlist with the **proposed version** only; reconcile actual hosted record separately.
2. Add Worker scheduled purge and owner-authenticated privacy export/account deletion API handlers with strict request validation and fail-closed no-store responses.
3. Add account page export/delete UX and client wrapper; avoid leaking private data via SW caches, remote assets, logs or stale client state.
4. Implement independent encrypted-file tool and test vectors; backup/restore scripting and private offsite transfer contract. Add protected manual workflow only (no automatic production activation) and full restore runbook.
5. Add PG17 fixtures and security tests, Worker tests, browser smoke and documentation. Verify source CI completely; audit idempotency, privacy, auth, compatibility, clock boundaries, rollback and concurrency.
6. Keep PR draft/BLOCKED if required offsite encrypted backup, restore or deletion reconciliation evidence is unavailable, even if CI is green. Do not merge/deploy/advance dependencies as verified when production protection is absent.

## Verification gates

`npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, `npm run db:test` on two clean PG17 databases, and Chromium route/viewport checks.

Source tests are necessary but insufficient for claims about: hosted OAuth deletion, live worker Cron, external backup encryption key availability, non-public object-storage retention, tested restore/replay of deleted accounts, actual iPhone Safari behavior and protected production release. All these remain NOT VERIFIED pending explicit operator authorization.


## Source validation and audit — November 17, 2026

- [Passing full source CI #44144669011](https://github.com/A13Xg/Daydle/actions/runs/44144669011) at `63a7369a36d10e4fd19c45d581a3e098bb11f177`: validation job (strict TypeScript, ESLint, Prettier, 308 Vitest tests across 38 suites, production build, PWA/API/Chromium smoke) PASS; database-security job (two isolated PG17 migrations and RLS assertions) PASS.
- Corrected 8 Prettier failures using the pinned toolchain; temporary formatting-export workflow was removed before final CI.
- Fixed **critical backup crypto cleanup bug**: a failed exclusive output open could delete a pre-existing destination. Cleanup now unlinks output only if the operation itself created the file. Added a separate existing-content assertion to prevent regression; new CI passed.
- Source includes authenticated owner-scoped JSON export, recent-OAuth-confirmed account deletion, 90-day raw purge scheduling code, private SQL/RPC, and independently tested AES-256-GCM archive encryption/decryption. No production DB migration or live cron was applied.
- **Unmet Phase 12 acceptance**: no verified offsite object bucket/key retention, scheduled encrypted export, independently tested PostgreSQL restore, external deletion-tombstone/reconciliation mechanism or real hosted account-deletion E2E. Do not mark COMPLETE or mark PR ready while these remain. Real iPhone Safari testing is also owner-deferred.
- If a downstream source-only phase is explicitly authorized on this stacked branch, that is not proof that these external recovery gates are satisfied. Keep this plan at the root and this PR draft until verified or explicitly re-scoped.
