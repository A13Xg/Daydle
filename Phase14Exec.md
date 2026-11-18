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

## Source implementation and verification — November 17, 2026

- Created [draft PR #25](https://github.com/A13Xg/Daydle/pull/25) from current verified `main`, kept all source changes isolated from release/migration workflows.
- Reconciled `roadmap.md`, `README.md` and stale Phase 12/13 root plans: verified exact source merge SHAs and green main CI, while preserving their **unverified operational acceptance** and active-plan status. Reconciled `docs/quality-matrix.md`, `docs/deployment.md` and `docs/secrets.md` with source versus hosted reality.
- Added read-only, publicly accessible `/privacy` page integrated with approved Obsidian Arcade stack navigation, Account link, footer and offline shell navigation. Avoids any fake support email or claim that offsite backup is active.
- Added `scripts/ops/beta-preflight.mjs` with explicit `--live` opt-in for credential-free public GET checks (health, JSON 404, private admin/export 401, bounded guest requests, privacy HTML). It makes **no** network calls without `--live`; failures never log response bodies. Added denial, privacy/host, cache, field and transport regression tests.
- Added privacy data map and operator beta runbook with explicit zero-assumption recovery/privacy controls, read-only migration-history checks, main-only protected deployment, manual hosted two-account and iPhone test matrix, incident/rollback and disaster restore/deletion-replay requirements. RPO/RTO and backup-retention proposals remain explicitly unachieved until measured.
- Temporary pinned, read-only formatting-export workflow was used only to format three new source/test files via repository Prettier and was **deleted** from the branch before review. No permanent CI workflow, dependency, schema, credential, admin enrollment or production Worker change was introduced.

**Passing executed source CI:** [#44216009813](https://github.com/A13Xg/Daydle/actions/runs/44216009813) at `b3e0803da234033c7c13c206bba256949dc342cc` — TypeScript, ESLint, Prettier, **316/316 Vitest tests across 40 suites**, Vite production build, preview API/PWA smoke, **31/31 Chromium viewport/route checks** (320/393/1024) and **two isolated PostgreSQL 17 migration/RLS security runs** all PASS. An initial assertion wrongly matched the word `private` in safe route metadata; corrected it to check an explicit secret-payload canary and re-ran all gates successfully. Post-test docs-only commits must also have final green CI before source validation is considered current.

**Audit/remaining limits:** Unit/Chromium tests do not exercise any real hosted OAuth user or trusted operator, Apple/Google callback, iPhone Safari, backup, restore, user-deletion replay or production changes. Public beta remains **BLOCKED**. The last confirmed protected Worker deployment remains Phase 10 `9098fdc`; latest merged source is Phase 13 `2042288`. No automatic migration/deploy, backup provisioning or beta release was performed. Keep this plan in root and the PR **draft**. A fully verified Phase 14 completion/archive is inappropriate until the external acceptance evidence and explicit owner go/no-go exist.
