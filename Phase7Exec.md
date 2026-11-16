# Phase 7 Execution Plan — Result ingestion, history, and correction lifecycle

**Status:** PLAN REVIEWED — implementation pending. No production changes.
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
- Worker runs the existing deterministic `parseShare` with 10,000-char/64-line bounds; small streamed JSON body limit and explicit JSON/content-type validation. Parse only one result. `parsed`/unambiguous canonical share keys may save immediately; unknowns are not retained without a separate explicit opt-in action. Invalid/ambiguous responses contain only safe codes/candidates, never raw text.
- Worker invokes **service-role-only Supabase PostgREST RPC** using a secret Worker binding, not a browser key. Define a narrow, purpose-built SQL API with transactional puzzle upsert, result insertion, exact-duplicate idempotency, explicit target-ID replacement, owner-only detail/list/delete and unknown opt-in. Revoke execution on all new exposed RPCs from `PUBLIC`, `anon`, `authenticated`; grant to `service_role` only. Worker sends the server-validated user ID. All SQL functions qualify object names and use fixed `search_path=''`.
- Supabase Worker secret bindings: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. **Never expose** the service key via `VITE_` variables or PR CI, source, logs, or source maps. Production secret setup, migrations and deployment need separate environment-specific authorization and are not performed in this PR.
- Update only the five real catalog slugs to `parser_status='supported'` in the forward-only migration. Unknown catalog entries remain launchable but unsupported. Publisher number keys are authoritative puzzle identity while dates remain NULL unless explicitly supplied by the parser; do not derive dates from submit time.
- User-keyed, service-only SQL rate limits (bounded per hour) and direct API no-store headers. New append-only private audit events persist deletion metadata after `game_results` cascade deletes `result_corrections`; no direct public raw text. Corrections invalidate future derived statistics by creating versioned result mutations; Phase 8 aggregation is query-derived and not yet cached.

## User-visible behavior and exact contracts

- `POST /api/v1/results` with `{ text, replaceResultId? }`: require auth, normalize/detect/validate, persist one canonical result. Responses `saved`, `duplicate`, `replaced`, `conflict`, `unsupported`, `invalid`, `ambiguous`; conflict always requires explicit replacement of one result ID.
- `GET /api/v1/results?game=<slug>&limit=<1..50>`: owner history, newest first. `GET /api/v1/results/:uuid` detail. `DELETE /api/v1/results/:uuid`: explicit user confirmation in UI and owner-only atomic deletion.
- `POST /api/v1/results/unknown` with `{ text, retain: true, gameSlug? }`: never auto-retain unknown text; stores bounded consented sample with expiry <=90 days; returns no user secrets.
- Paste dialog: loading/submitting, supported/unknown/ambiguous/invalid, authenticated and unavailable states, single-result success/duplicate, conflict prompt and explicit Replace. Never show unsupported result "saved" by guessing, never send share text until user selects Submit or explicitly retains unknown.
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
