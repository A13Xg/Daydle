# Phase 7 Execution Plan — Result ingestion, history, and correction lifecycle

**Status:** IN PROGRESS / HOSTED ACCEPTANCE BLOCKED — implementation and isolated tests are committed; no hosted migration, secrets or deployment.
**Base:** `main` at `520ca5be730bc9ea45a7ffd00fbe85e6525625f3`. [PR #13](https://github.com/A13Xg/Daydle/pull/13) merged on 2026-11-16; [post-merge CI](https://github.com/A13Xg/Daydle/actions/runs/43970518949) PASS.
**Branch/PR:** `phase/07-results-history-corrections` / [#14](https://github.com/A13Xg/Daydle/pull/14) (draft).
**Authority:** [IDEA.md](IDEA.md) §§5,7,8,11; [roadmap.md](roadmap.md) Phase 7; [AGENTS.md](AGENTS.md); [Phase 6](completedPhases/Phase6Exec.md) and [6.5](completedPhases/Phase6.5Exec.md) archives.

## Preflight and reconciliation

- Latest merge is on main; commit `520ca5b`, automated main CI PASS. No open PRs before this branch; main roadmap's Phase 6.5 row still says IN REVIEW, now stale. Correct it to COMPLETE with merge/CI evidence **on this PR branch only**, never push application changes directly to main.
- Current Worker serves only `/api/v1/health`; pure parser registry supports five slugs but none are yet marked supported in the catalog. Existing database has `puzzles`, unique `game_results(user_id,puzzle_id)`, `raw_submissions` (90-day metadata), and `result_corrections`. Browser cannot insert results; select RLS is viewer/puzzle gated. Worker has no existing secret dependency.
- Existing global Paste dialog captures clipboard only on user tap and stores share text in React memory. No result persistence, history or correction UI yet. Service worker must never store API/private responses.
- No changes to current OAuth, public friend semantics, spoiler release policy, native iOS packaging, Phase 8 statistics or Phase 9+ social scopes.

## Security and deployment architecture (reviewed)

- Worker validates each Bearer JWT by calling Supabase `/auth/v1/user` with the server-configured **public publishable key**; obtain the authoritative user UUID from the response, not from any submitted body field. No trust in browser-supplied `userId`.
- Worker runs the existing deterministic `parseShare` with 10,000-char/64-line bounds; small streamed JSON body limit and explicit JSON/content-type validation. Parse only one result. `parsed`/unambiguous canonical share keys may save immediately; under the **2026-11-16 owner revision**, explicit Submit result actions also capture bounded unknown/ambiguous/invalid raw shares privately for later parser analysis. Invalid/ambiguous responses contain only safe codes/candidates, never raw text.
- Worker invokes **service-role-only Supabase PostgREST RPC** using a secret Worker binding, not a browser key. Define a narrow, purpose-built SQL API with transactional puzzle upsert, result insertion, exact-duplicate idempotency, explicit target-ID replacement, owner-only detail/list/delete and categorized automatic retention after explicit Submit. Revoke execution on all new exposed RPCs from `PUBLIC`, `anon`, `authenticated`; grant to `service_role` only. Worker sends the server-validated user ID. All SQL functions qualify object names and use fixed `search_path=''`.
- Supabase Worker secret bindings: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. **Never expose** the service key via `VITE_` variables or PR CI, source, logs, or source maps. Production secret setup, migrations and deployment need separate environment-specific authorization and are not performed in this PR.
- Update only the five real catalog slugs to `parser_status='supported'` in the forward-only migration. Unknown catalog entries remain launchable but unsupported. Publisher number keys are authoritative puzzle identity while dates remain NULL unless explicitly supplied by the parser; do not derive dates from submit time.
- User-keyed, service-only SQL rate limits (bounded per hour) and direct API no-store headers. New append-only private audit events persist deletion metadata after `game_results` cascade deletes `result_corrections`; no direct public raw text. Corrections invalidate future derived statistics by creating versioned result mutations; Phase 8 aggregation is query-derived and not yet cached.

## User-visible behavior and exact contracts

- `POST /api/v1/results` with `{ text, replaceResultId? }`: require auth, normalize/detect/validate, persist one canonical result. Responses `saved`, `duplicate`, `replaced`, `conflict`, `unsupported`, `invalid`, `ambiguous`; conflict always requires explicit replacement of one result ID.
- `GET /api/v1/results?game=<slug>&limit=<1..50>`: owner history, newest first. `GET /api/v1/results/:uuid` detail. `DELETE /api/v1/results/:uuid`: explicit user confirmation in UI and owner-only atomic deletion.
- `POST /api/v1/results` also invokes the service-only `capture_unparsed_share` RPC on bounded unknown, ambiguous and malformed formats after an authenticated Submit; the old standalone `/unknown` opt-in endpoint is removed. Response shows status and `captured` only after a successful database write. Empty/oversized/unsafe shares are not saved.
- Paste dialog: loading/submitting, supported/unknown/ambiguous/invalid, authenticated and unavailable states, single-result success/duplicate, conflict prompt and explicit Replace. Never show unsupported result "saved" by guessing, never send share text until the user selects Submit.
- `/history` stack page: authenticated paginated recent list with optional game filter, accessible detail, safe empty/loading/offline/error states; individual deletion with confirmation. No spoofed game scores, spoiler-sensitive public endpoint, cross-user data or private cache.
- Mobile: no automatic clipboard reads or multi-popup launch; future WKWebView compatibility remains an architectural constraint only.

## Proposed files

1. `supabase/migrations/20261117010000_phase7_results.sql`: server-only RPCs, deterministic atomic duplicate/replace/delete and audit, rate limiting, parser support.
2. `worker/results.ts`, `worker/index.ts`, `shared/results.ts`: authenticated bounded API, shared result response contracts; health route unchanged.
3. `src/lib/results-api.ts`, `src/components/PasteDialog.tsx`, `src/components/HistoryPage.tsx`, `src/App.tsx`, `src/components/ArcadeShell.tsx`, selected styles: real API wiring and owner history.
4. `tests/results-worker.test.ts`, `tests/results-ui.test.ts`, `tests/sql/results-assertions.sql`, update `scripts/test-db.sh`: auth/denial/parser/duplicate/replacement/ownership/retention/privacy verification.
5. `docs/results.md`, `roadmap.md`, `Phase7Exec.md`, PR body: actual contracts, operational authorization requirements and outcomes.

## Sequencing and acceptance checklist

1. Create branch/draft PR, review plan and phase dependencies.
2. Introduce DB migration and test its RLS/grants and atomic invariants on **two isolated PG17 databases** (no hosted mutation).
3. Add Worker authentication, parsing, bounded inputs, API error taxonomy, safe external service calls, tests.
4. Connect Paste and History UX with honest state management, explicit confirmation and accessible controls; add UI tests.
5. Run `npm ci`, typecheck, lint, Prettier, 196+ unit/API tests, production build, PWA smoke, 16 viewport smoke checks, two PG17 security databases and diff/security review.
6. Archive plan and mark Phase 7 IN REVIEW **only** after gates pass. Otherwise leave root plan, draft PR and report blocker. Do not merge/deploy.

## Risks and decisions

- **Token and service key boundary:** service role must never reach browser. All POST/DELETE require verified user session; server-only RPC grants and negative SQL tests.
- **Raw retention:** accepted raw samples are private and expire at <=90 days; Phase 12 owns an independent scheduled cleanup/backup mechanism. Until then expiration metadata exists but automatic purge may not be scheduled: do not claim actual cleanup running.
- **Concurrency:** enforce unique user/puzzle and lock existing result row before replace. A network failure after commit can yield an uncertain response; authoritative history read is required instead of claiming rollback.
- **Spoilers:** no public history API added, only owner data. Existing browser RLS remains restrictive; UI/API and service worker do not cache private results.
- **User date confirmation:** use exact publisher share puzzle number/date only. If unresolved or detected ambiguously, require explicit choice; don't map sequential numbers to arbitrary UTC or local dates.
- **Hosted dependency:** a live Worker needs provider URL/publishable/service secret and an approved Phase 7 migration; no environment configuration assumed, so hosted tests remain NOT VERIFIED until authorized.

## Review verdict

The architecture preserves existing pure parsers and protects transaction ownership inside server-only SQL RPCs. Limiting this phase to owner result APIs avoids premature Phase 8+ public stats/spoiler paths. Implement as above; new risk discoveries must be documented before expanding scope.

## Phase 7 implementation and verification record — November 16, 2026

### Implemented in draft PR #14

- Forward-only Phase 7 migration: five supported parser-backed catalog slugs, service-only RPCs for canonical save, replay/replace, owner history/detail/delete, explicit unknown-sample retention, quota and private audit events. No browser mutation grants.
- Worker verifies Supabase Bearer sessions using the public project key, runs Phase 6 parser server-side, enforces request limits, sanitizes response errors, and calls server-only RPCs with the verified owner ID. No service-role key is checked into Git.
- Owner-only result browser client, Paste form with explicit submit/duplicate/conflict/replace/unknown-sample consent, History page with filter/pagination/detail/delete, navigation and PWA offline-safe exclusions. Today/help copy updated to distinguish manual marks and verified saves.
- Security tests exercise RPC grant denials, cross-account isolation, publisher puzzle identity, duplicate idempotency, corrections, private audit, raw expiry metadata and deletes. The independent real two-process PG17 concurrency script verifies two parallel writes converge to one saved row, raw record and audit event.
- HTTP and UI tests verify authentication, body bounds, parser decisions, unknown opt-in, response minimization and private route navigation; browser smoke now includes the History stack at 320, 393 and 1024 widths.

### Automated evidence

- [CI #43977903592](https://github.com/A13Xg/Daydle/actions/runs/43977903592): 215 tests / 28 suites, TypeScript, lint, formatted source, build, PWA/API smoke, 17 Chromium route/viewport checks and two isolated PostgreSQL security databases PASS. This run used temporary canonical formatting; source was then committed and the diagnostic removed.
- [Final clean-source CI #43978176350](https://github.com/A13Xg/Daydle/actions/runs/43978176350): verify actual conclusion at the link; do not treat a pending run as passed.
- No production migration, Worker/PWA deployment, or account-secret changes were performed.

### Acceptance limitations — NOT VERIFIED

- Hosted Supabase/Cloudflare end-to-end tests require separately approved Phase 7 migration, protected Worker bindings SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY, and real OAuth/test-user submissions. These are NOT VERIFIED; do not infer permission from earlier phase approvals.
- Real iPhone Safari/PWA behavior after Phase 7 is NOT VERIFIED; the older owner-deferred UI acceptance is not automatically a pass for this new flow.
- 90-day raw retention is enforced by expiry metadata and a private purge function exists; running scheduled physical deletion is NOT VERIFIED and remains a later operations obligation.
- PR #14 remains draft and Phase7Exec.md remains active. Do not merge, deploy, archive as COMPLETE or start Phase 8 before essential hosted acceptance is resolved under the repository process.


## Owner change request — sample receiver and parser-review queue (November 16, 2026)

The owner approved retaining all **bounded, eligible parser failures after an explicit Submit result action**. This supersedes the original opt-in-after-failure approach documented above and in older Phase 7 commits. It does **not** authorize clipboard polling, uploading on paste/read, retention of empty/oversized/unsafe inputs, a public sample feed, hosted migration/deployment, or automatic trust in unknown text. The current feature uses the existing `public.raw_submissions` storage and `parser_diagnostics` JSONB, a service-only capture RPC with owner-specific hash deduplication, pending review classifications (unknown header, ambiguous match, invalid format, control characters, excessive lines), rate limiting and 90-day expiry metadata. The initial live project inspection found no stored past samples; no retrospective recovery is possible from that table. Add schema/Worker/UX tests and keep PR #14 draft until acceptance gates pass. Automated cleanup remains a later operational gate.
