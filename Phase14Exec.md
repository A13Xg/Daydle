# Phase 14 — Public beta release and operational handoff

**Status:** IN PROGRESS — **PUBLIC RELEASE BLOCKED**.  
**PR:** [#25](https://github.com/A13Xg/Daydle/pull/25), draft, targeting `main`. **Base:** `20422881f774a0c5992cc52e8ad1035dfae64458` (Phase 13 merge).  
**Source evidence:** [main CI #44172784193](https://github.com/A13Xg/Daydle/actions/runs/44172784193) PASS. PRs [#22](https://github.com/A13Xg/Daydle/pull/22), [#23](https://github.com/A13Xg/Daydle/pull/23), [#24](https://github.com/A13Xg/Daydle/pull/24) source-merged November 17, 2026.  
**Production evidence:** Latest successful protected Deploy Worker in reviewed GitHub Actions history remains [#44045005321](https://github.com/A13Xg/Daydle/actions/runs/44045005321), commit `9098fdc` (Phase 10). This is not proof of current Cloudflare dashboard deployment state outside the GitHub release path, but no newer protected job was observed.  
**Authority:** [IDEA.md](IDEA.md) §§11–13; [roadmap.md](roadmap.md) Phase 14; [AGENTS.md](AGENTS.md); source-only QA [docs/quality-matrix.md](docs/quality-matrix.md).

## Preflight assessment / discrepancy ledger

- Phase 11 is **source merged, source CI green**, NOT VERIFIED in hosted Supabase/Worker. Original archive exists in `completedPhases/Phase11Exec.md`.
- Phase 12 is **source merged, source CI green**, yet `Phase12Exec.md` remains root-active and truthfully says scheduled encrypted offsite backups, a real isolated restore, and deletion-replay safety are missing. No backup workflow/source runner or verified object store exists. Merged != fully accepted.
- Phase 13 is **source merged, source CI green**, but `Phase13Exec.md` remains root-active and confirms physical Safari/VoiceOver and hosted E2E are not verified. Both plans **must stay active** until actual operational acceptance; do not invent archives.
- `roadmap.md` still claims Phase 11 IN REVIEW and Phases 12/13 IN PROGRESS or NOT STARTED. `README.md` describes earlier deploys as pending. These are editorial drift, not evidence that GitHub merges failed.
- No standalone public privacy notice/legal contact, and no independently verifiable beta release gate. Existing `scripts/ops/verify-live-release.mjs` validates public health/PWA but not new Phase 11–12 APIs or operator evidence.
- `docs/deployment.md` describes main-only protected release and immutable migration-name checks. Do not weaken those guards to green-light beta.

## Implementation scope (no production changes)

1. **Reconcile source status** in branch `roadmap.md` and `README.md`: mark Phases 11–13 `SOURCE MERGED / OPERATIONAL ACCEPTANCE OPEN`, link exact merge SHAs and CI; keep Phase 14 blocked. Do not rewrite Phase 12/13 root plans as archived/completed.
2. **Data and privacy disclosure:** implement accessible standalone `/privacy` route using approved Obsidian Arcade styling and shell; link from site footer and Account. Explain public profiles, OAuth email separation, explicit share upload/failed sample retention, canonical history, deletion/export, external publishers and backups without inventing a support email or a verified operational retention guarantee.
3. **Release readiness scanner:** new non-destructive CLI `scripts/ops/beta-preflight.mjs` for public health, missing API, auth boundary of private endpoints, PWA identity/assets and rendered routes; all fetches GET/HEAD without credentials and no private data. Distinguish public smoke from hosted migration, job/backup and authenticated-user manual checks. Require opt-in to any live network requests.
4. **Release gates and evidence:** `docs/beta-release.md` with operator checklist, exact required signed-off evidence, dependency-order SQL + protected deploy, backup restore drill, deletion replay, monitoring/alerts, rollback, RPO/RTO objectives and incident response; `docs/privacy-data-map.md` with field-by-field public/owner/admin scope, retention/deletion and backup risks.
5. **Tests:** Vitest contract tests for public privacy screen/route and non-destructive scanner; update Chromium smoke for 320/393/1024 guest privacy route and footer. Reuse established source CI gates, no new dependency or external service. Record exact commit/run results.

## External/owner-only gates (BLOCK RELEASE)

- Explicit owner approval for Phase 11/12 hosted SQL and Cloudflare Worker/PWA deployment; read-only exact migration-history check first, no blind `supabase db push`.
- Create privately scoped independent **scheduled** encrypted offsite backups, retention/key recovery and failure alert; restore an actual backup into an isolated PG17 database; verify deletion replay, expired raw share filtering and recovery procedures before beta.
- Verify server-enrolled operator and ordinary account, real two-account OAuth friend/scoreboard, result correction/privacy export/account delete, scheduled purge observation, rate limits and no spoiler leaks on hosted current schema.
- iPhone Safari + installed PWA authorizations, clipboard, tab return, OAuth, offline/safe area, QR camera, VoiceOver; owner deferred physical device tests are **NOT VERIFIED**.
- Production telemetry, HTTPS/domain/provid­er callbacks, privacy/legal/support contact, external publisher license/links, and explicit beta go/no-go. No live release or real user destruction is authorized in this PR.

## CI / security / rollback

- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, local preview + `npm run smoke`, `node scripts/ui-smoke.mjs`, dual isolated PostgreSQL 17 `npm run db:test`.
- New preflight tests use stubbed HTTP responses and assert authentication-free GET, no secrets, safe errors and optional live use only. No direct run of PR branch against production.
- Respect strict release-secret preflight and no auto merge. If source passes and operational gates fail, **keep draft PR/root plan and label beta BLOCKED**, not ready/complete. Roll back Worker by version; do not presume SQL reversal. Data restoration must not resurrect erased accounts.

## Work log

Source changes/test results to be added as verified. Do not claim hosted backup, migration, live auth, device or beta acceptance based on CI alone.
