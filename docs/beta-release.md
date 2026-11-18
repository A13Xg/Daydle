# Daydle public beta — release gate and operational handoff

**State: BLOCKED — hosted Phase 11/12 SQL applied, but no verified new Worker deployment or beta authorization.** Last checked against source `main` commit `20422881f774a0c5992cc52e8ad1035dfae64458` on November 17, 2026. [Phase 14 execution plan](../Phase14Exec.md) and [quality matrix](quality-matrix.md) are the audit records. This runbook is not authorization to execute a migration, deploy, delete user data, create credentials or open public beta.

## 1. Verified source baseline and open gaps

| Gate | Evidence / required outcome | State |
|---|---|---|
| Phases 11–13 source merged | PRs [#22](https://github.com/A13Xg/Daydle/pull/22), [#23](https://github.com/A13Xg/Daydle/pull/23), [#24](https://github.com/A13Xg/Daydle/pull/24); [main CI](https://github.com/A13Xg/Daydle/actions/runs/44172784193) | SOURCE VERIFIED |
| Latest protected production release | [Deploy Worker #44045005321](https://github.com/A13Xg/Daydle/actions/runs/44045005321), Phase 10 commit `9098fdc` | LAST CONFIRMED |
| Phase 11/12 hosted database migrations | Supabase lists `20261118013515_phase11_administration` and `20261118013526_phase12_privacy`; expected RPCs, table/trigger and grants checked | **APPLIED / VERIFIED** (repository filename reconciliation in PR #26) |
| Phase 11/12/13 deployed APIs and PWA | A new approved protected Deploy Worker on merged main; post-deploy source/asset and public API probes | **NOT VERIFIED** |
| Authenticated two-account / operator tests | Actual Google/Apple sign-in, result and spoiler flows, role-gated admin, export/deletion in disposable test accounts | **NOT VERIFIED** |
| Raw-share expiry | Confirm Worker cron is active and logs show successful scheduled physical purge; inspect sample after expiry | **NOT VERIFIED** |
| Independent encrypted backups | Isolated private destination, verified 24-hour schedule, retention/key recovery and failure alerts | **NOT VERIFIED** |
| Disaster restore and deleted-user privacy | Real encrypted export, decrypted restore to a NEW isolated PG17 instance, owner deletion/expiry reconciliation | **NOT VERIFIED** |
| Device/accessibility | Safari and installed iPhone PWA, OAuth, paste, external return, camera/QR, offline, VoiceOver | **NOT VERIFIED** |
| Legal/support/monitoring | Contact identity/channel, privacy-policy approval, incident alerts, telemetry and signed go/no-go | **NOT VERIFIED** |

Do not change an unverified row to PASS because a unit test or source PR passed. [Phase12Exec.md](../Phase12Exec.md) and [Phase13Exec.md](../Phase13Exec.md) remain root-active intentionally: they were **merged as source** before external acceptance was completed.

## 2. Non-destructive preflight (before any deployment approval)

1. Pin reviewed `main` SHA and require its full CI green status. Check GitHub Actions Deploy Worker history and the Cloudflare active Worker version separately; do not infer they match automatically.
2. Review `supabase/migrations/` with the exact allowlist in `scripts/ops/check-hosted-migrations.mjs`. Using a **protected read-only** Supabase Management API token, compare returned version *and name* to the committed SQL. A pending Phase 11 or 12 entry is a hard stop for the newer Worker. Different hosted versions/names require investigation and reviewed reconciliation; never forge migration history to match source.
3. Verify domain `daydle.agoodman.io`, HTTPS/TLS, provider redirect URLs (Apple, Google), public Supabase URL, environment variable scope, current Worker encrypted `SUPABASE_SERVICE_ROLE_KEY` binding **name** and no exposure of its value. Inspect the final generated `dist/worker/wrangler.json` rather than only source `wrangler.jsonc`.
4. Run `node scripts/ops/beta-preflight.mjs --live` only when a network GET against the live public site is intended. This has **no credentials, no writes**, tests health/404, guest requests, admin/private export 401 and privacy page shell. Before Phase 11/12 is deployed the new request endpoint may correctly FAIL. Follow with existing `node scripts/ops/verify-live-release.mjs --public-only` using a locally built app; it checks public PWA/asset routes. Neither validates authenticated workflows.
5. Check no unreviewed PR, branch or background workflow has changed the deployed version or credentials. Record timestamp, commit SHA, reviewer and exact evidence URLs.

## 3. Approved migration and Worker release procedure

1. Require a **separate explicit owner authorization** for the exact hosted project, numbered SQL migrations and Worker deployment. No PR CI job may receive protected deployment secrets.
2. Before changing a production database, establish a restorable encrypted offsite recovery point with tested keys and a tested restore. Without this, **STOP**. Supabase Free managed backups cannot be assumed.
3. Review forward-only Phase 11 and Phase 12 SQL in order, run SQL dry-run and independent PostgreSQL 17 security tests, check additive/backward-compatible behavior, and document the migration/rollback limitations. Take a backup, verify its integrity/retention, then apply only explicitly approved SQL to the specified hosted project.
4. Re-query the structured migration API. The protected `Deploy Worker` workflow must pass `--require-all-applied` without adjusting the checked-in allowlist to accommodate undocumented live changes.
5. Confirm the `production` environment reviewer, main-only branch rule, final built secret binding name and no public service key. Run manual `Deploy Worker` on the reviewed main commit; observe each job and verify exact deployed SW hash/version, HTTP contracts and generated static assets. Do not override release guards.
6. If release verification fails after a Worker upload, assess the currently active Cloudflare version before retry. Roll Worker back by version where safe; **do not roll SQL backward by assumption**. Stop writes/disable affected features if deployed application and schema are incompatible.

## 4. Required hosted test matrix

Use disposable authorized accounts and a recorded consented test profile, not a real player's account. Never test destructive deletion on the owner account.

- **Authentication:** Apple and Google OAuth; first-time display name and friend code; session restoration; sign-out; unauthorized bearer rejection.
- **Catalog/Today:** selection, reorder, external publisher links, manual marker, live return prompt and Paste permission-denied/manual path.
- **Results:** 5+ supported fixture formats; ambiguous/unknown/invalid submission retention only on Submit, duplicate conflict, replacement, result deletion and stats reconciliation. Confirm raw contents excluded from general logs.
- **Social:** two-account instant friend code/QR, unfriend/block, public profiles without email, viewer-specific current-puzzle score masking, verified-next-reset release and no private aggregate/rank leakage.
- **Administration:** explicit operator enrollment of verified UUID by controlled authority; non-admin 401/403 and no raw access; suggestions/votes, moderation and catalog retirement; single unexpired raw sample review; audit rows; quotas/abuse restrictions.
- **Privacy:** owner export completeness and raw TTL, account deletion with *recent provider sign-in*, deletion cleanup and revocation of subsequent API access; backup-deletion replay. Recreate/restore test accounts only within a disposable isolated environment.
- **iPhone:** Safari and installed PWA; full safe-area/touch accessibility, VoiceOver, sign-in callback, clipboard gesture, publisher launch/back/resume, QR camera and offline read-only caches. Record device/OS/browser, screenshot or observation and PASS/FAIL.
- **Monitoring:** probe after deployment and after scheduled purge; simulate non-sensitive, non-destructive alert failures; check alert delivery and runbooks.

Document an outcome and the evidence link/date for every test. An outcome with no execution evidence remains NOT VERIFIED.

## 5. Backup and disaster recovery contract (operator setup required)

**Source state:** `scripts/ops/backup-crypto.mjs` provides AES-256-GCM file encryption/decryption with Vitest tamper tests. **It does not automatically dump Postgres, upload to R2 or S3, rotate keys, retain copies, alert, or restore live data.** No storage credentials/buckets or backup schedule are verified.

**Proposed beta objective, not an achieved guarantee:** RPO at most 24 hours, RTO at most 8 hours for a single-project disaster; choose the actual objectives only after a timed real restore drill. Suggested daily encrypted full exports with at least 7 recoverable points (subject to separate bucket lifecycle/privacy retention) are **configuration proposals, not operational facts**.

The protected backup operator must verify: TLS database connection with least practical privilege; `pg_dump` consistent custom-format snapshot; temporary plaintext restricted to ephemeral runner and securely cleaned; full authenticated encryption before transmission; private bucket with limited write/read/list permissions; independent immutable/offsite recovery and key escrow; checksum/manifests; retention/lifecycle policy; failed-run alerts; alert acknowledgment; and proof the object is retrievable and decryptable with a separately protected recovery key.

**Restore test:** pull one encrypted backup into an isolated non-production environment, authenticate/decrypt before any `pg_restore`, verify schema, RLS, expected record counts and sample data. Before cutover, apply a separately durable encrypted deletion/expiry journal or equivalent privacy reconciliation: deleted account IDs and expired raw shares from after the snapshot **must not reappear**. Verify with deliberately deleted test accounts and expired shares. Never restore directly into production as an initial drill; fail closed if journal is missing.

The backup credential and encryption key must be secrets scoped to a protected **backup** operator environment, not PR CI or a Vite build. Do not add active credentials or automatic jobs merely by merging this runbook.

## 6. Observability, incident response and rollback

- Monitor HTTPS health/unknown JSON route, public profile 404 vs 503, Supabase RPC transport failures, hosted schema mismatch, expired-raw purge job, encrypted backup age/size/status, R2/S3 upload failures, restore verification and login errors. Alert on repeated errors, not raw request payloads.
- Critical incidents: authentication compromise, confidential raw-share exposure, deleted-user resurrection, unstoppable failed backup/restore, release mismatch. Immediately halt the affected feature/release and retain privacy-safe evidence; rotate affected secrets through approved provider controls, not an in-repo file.
- Maintain a named on-call/owner escalation route and an actually tested alert recipient **before public beta**. A repository-only checklist does not establish that a person will receive an alert.
- For Worker-only failures, inspect Cloudflare deployment history and roll back to a recorded compatible version; note that migration-altered schemas require compatibility checks first. For database corruption, follow isolated restore/journal reconciliation and explicit owner recovery approval.

## 7. Beta go/no-go and release record

**GO requires:** all mandatory rows in §1 actually verified; backup recovery drill completed and deletion replay proven; hosted API/device matrix passed; open registration and approved privacy/support contact; owner explicitly authorizes public launch. The source repo or passing CI alone cannot satisfy this gate.

Record in a single release note: release version and Git SHA, Worker version/deployed SW fingerprint, hosted migration versions, RPO/RTO measured, backup object age (never the object key), successful restore reference, manual operator/device signoffs, incident on-call/contact, rollback target, known limitations, owner authorization and launch timestamp. For now this information **has not been established and the release remains BLOCKED**.

## 8. Source checks for PR #25

Source changes here should pass `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, preview PWA smoke, 31 Chromium route/viewport checks and two isolated PostgreSQL 17 RLS suites. No CI job is permitted to deploy, delete real users or access production backup secrets.
