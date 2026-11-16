# Daydle — End-to-End Implementation Roadmap

**Authority:** [IDEA.md](IDEA.md) defines product requirements; [AGENTS.md](AGENTS.md) defines execution behavior. This file is the canonical phase sequence and **main-branch status ledger**. No application coding begins merely because this document exists.

## Operating rules

1. User commands **“complete next phase”** or **“complete phase X”** initiate only the requested phase. Before planning, inspect the actual main-branch repository, compare previous completed deliverables against this ledger, and report or reconcile material discrepancies. Never infer completion solely from a checkbox.
2. For implementation phases 1–14, follow [AGENTS.md](AGENTS.md): create branch; commit a minimal Phase#Exec.md scaffold so GitHub permits opening a draft PR; create the draft PR; expand the phase plan and self-review; implement within the branch; run tests, inspect the diff, verify acceptance criteria; move the plan into completedPhases/Phase#Exec.md only after validation; set phase status to IN REVIEW on the branch; push and mark the PR ready for review. Do not merge or start the next phase automatically.
3. Mark a phase **COMPLETE on main only after its reviewed PR is merged and the main-branch result is verified**. A ready-for-review PR is not equivalent to a merged/completed phase. If a prior required phase is still unmerged, pause before starting dependent work unless the user explicitly requests a different base or parallel branch.
4. Preserve each phase's scope and gates, but use the repository's actual state and current documentation to derive implementation details in the phase execution plan. Do not write all plans up front: on-demand expansion avoids stale instructions.
5. Phase 0 is a one-time **bootstrap exception**, committed directly on main per the initial setup request; no bootstrap PR is required. Every later phase uses a branch and draft PR.
6. Acceptance gates include tests, security/authorization checks where relevant, implementation self-review, and documentation updates. A blocked phase retains its active plan and draft PR; it must not be archived or represented as complete.
7. Do not add attribution or contributor metadata to assistant/automation tools, model providers, or agents. Git author identity must come from the repository owner's authenticated GitHub integration (A13Xg) or be left to the legitimate configured Git identity.

## Status legend and dependencies

- **NOT STARTED** — no approved phase execution.
- **IN PROGRESS** — phase branch/draft PR exists, planning or development underway.
- **BLOCKED** — documented unsatisfied dependency or failure.
- **IN REVIEW** — tests and audit passed on branch; PR ready for human review, not merged.
- **COMPLETE** — merged to main and verified against deliverables.

The statuses below represent the **main branch**. Each in-progress PR maintains its live state; avoid claiming it is already on main. Phase 0 is complete after foundational documentation lands on main.

| Phase | Name | Depends on | Main status |
|---|---|---|---|
| 0 | Repository foundation and delivery contract | — | COMPLETE |
| 1 | Application skeleton, tooling, and deploy baselines | 0 | COMPLETE — [PR #1](https://github.com/A13Xg/Daydle/pull/1), merge `b91a6e8` |
| 2 | Domain model, persistence, and security foundations | 1 | COMPLETE — [PR #2](https://github.com/A13Xg/Daydle/pull/2), merge `b4a1140` |
| 3 | Authentication, onboarding, and account identity | 2 | COMPLETE with owner-approved scope changes — [PR #3](https://github.com/A13Xg/Daydle/pull/3), merge `bff7b89`, evidence in [completedPhases/Phase3Exec.md](completedPhases/Phase3Exec.md) |
| 4 | Game catalog, selection, and discovery | 3 | COMPLETE — [PR #5](https://github.com/A13Xg/Daydle/pull/5), merge `e0fcb2b` |
| 5 | Today experience, PWA, and external-game navigation | 4 | BLOCKED — source [PR #7](https://github.com/A13Xg/Daydle/pull/7) merged; production rollout [run #43810002170](https://github.com/A13Xg/Daydle/actions/runs/43810002170) failed before SQL/deploy; [fix PR #8](https://github.com/A13Xg/Daydle/pull/8) in review; iPhone acceptance pending |
| 6 | Deterministic parser registry and initial game coverage | 5 | NOT STARTED |
| 7 | Result ingestion, history, and correction lifecycle | 6 | NOT STARTED |
| 8 | Personal statistics, streaks, and achievements | 7 | NOT STARTED |
| 9 | Public profiles and instant friendship | 8 | NOT STARTED |
| 10 | Spoiler-safe comparisons, scoreboards, and rankings | 9 | NOT STARTED |
| 11 | Administration, game requests/voting, and diagnostics | 10 | NOT STARTED |
| 12 | Privacy lifecycle, encrypted backups, and recovery | 11 | NOT STARTED |
| 13 | UX completeness, security, accessibility, and QA hardening | 12 | NOT STARTED |
| 14 | Public beta release and operational handoff | 13 | NOT STARTED |

## Phase 0 — Repository foundation and delivery contract
**Status:** COMPLETE (bootstrap; direct-main exception). **Dependencies:** none.

**Purpose:** Establish a single source of truth for product behavior and a repeatable, reviewable execution loop before application development.

**Scope and implementation guidance:**
- Initialize the repository on main; add README.md with navigation and scope.
- Add IDEA.md containing product specification, confirmed constraints, public social model, ingestion and date/spoiler semantics, privacy, and deferred visual styling.
- Add this roadmap.md with high-level, start-to-finish phases, dependencies, concrete outcomes, and status semantics.
- Add AGENTS.md prescribing state reconciliation, branch/draft PR lifecycle, phase plan, audit, archive, and ready-for-review transition.
- Add completedPhases/README.md explaining the archive convention. Do not invent a Phase0Exec.md or retroactively open a PR for bootstrap.

**Exit/verification:** All files exist and link correctly on main; roadmap statuses are coherent; no app implementation is claimed; initial commit history reflects the repository owner only.

## Phase 1 — Application skeleton, tooling, and deploy baselines
**Status:** COMPLETE — [PR #1](https://github.com/A13Xg/Daydle/pull/1) merged at `b91a6e859ee345c132cb27380bbff4c9aa4ee56a`, archived plan [completedPhases/Phase1Exec.md](completedPhases/Phase1Exec.md), and successful [main CI](https://github.com/A13Xg/Daydle/actions/runs/43560166887). **Dependencies:** 0.

**Purpose:** Produce a deployable, tested, minimal React/TypeScript/Vite app with a Cloudflare Worker API and reproducible local development.

**Scope and implementation guidance:**
- Establish frontend and server boundaries (monorepo or simple workspace justified in Phase1Exec.md), TypeScript strictness, formatting/linting, environment schema, package lock, and typed shared contracts.
- Configure Cloudflare Worker serving the Vite build plus versioned API route(s); keep secrets server-side.
- Establish Supabase project/client wiring for local development and environment-specific configuration without committing secrets.
- Provide runnable development, build, typecheck, lint, and test commands; add a minimal nontrivial unit/API smoke test and reproducible CI checks.
- Define preview/staging and production deployment paths, including secrets handling, migrations policy, and rollback baseline.
- Provide an accessible placeholder app shell and health endpoint, not polished page layouts or domain features.

**Exit/verification:** Clean checkout installs and passes checks; Worker API and frontend build locally; deployment configuration documented; preview deployment demonstrated where credentials exist; no secrets in Git.

## Phase 2 — Domain model, persistence, and security foundations
**Status:** COMPLETE — [PR #2](https://github.com/A13Xg/Daydle/pull/2) merged at `b4a114008680da77f5c897ab70527742443462f6`; archived [completedPhases/Phase2Exec.md](completedPhases/Phase2Exec.md); [main CI passed](https://github.com/A13Xg/Daydle/actions/runs/43562286254). **Dependencies:** 1.

**Purpose:** Establish migration-controlled PostgreSQL schema, row security, and stable application types before feature logic.

**Scope and implementation guidance:**
- Define canonical schemas and constraints for profiles, game/catalog categories, user-game selections, puzzle identity, raw submissions, results, corrections, friendships/blocks, achievements, suggestions/votes, and minimal audit state. Defer optional tables until justified.
- Separate public profile projections from private authentication, email, raw results, and administrative data. Plan RLS and server authorization for public, owner, friend-irrelevant, and administrator reads/writes.
- Establish puzzle identity independent from local calendar days; use one canonical user/game/puzzle result constraint with MVP single-per-day handling at service layer.
- Add migrations, rollback/recovery conventions, seed fixtures, constraint/index tests, and explicit data ownership.
- Define how timestamps, game reset information, parser versions, score metadata, corrections, and 90-day retention are represented.
- Avoid exposing Supabase service-role credentials to the browser; verify data isolation and spoiler-aware read boundaries before making sensitive endpoints public.

**Exit/verification:** Fresh database migrates reproducibly; integrity/RLS tests pass; key concurrency constraints enforced by database; schema contracts documented and queryable.

## Phase 3 — Authentication, onboarding, and account identity
**Main status:** COMPLETE — [PR #3](https://github.com/A13Xg/Daydle/pull/3), merge `bff7b89`; verified with owner-approved scope changes (Apple and Google only; installed-PWA test deferred), see [completedPhases/Phase3Exec.md](completedPhases/Phase3Exec.md). **Dependencies:** 2.

**Purpose:** Enable open signup and account lifecycle with unique public identity and private credentials.

**Scope and implementation guidance:**
- Implement email/password registration/login and Apple/Google OAuth using Supabase Auth; provider-only accounts must not require a password. Handle callbacks and Apple relay addresses correctly.
- Create profile with display name and secure random 5-character friend code from ABCDEFGHJKMNPQRSTUVWXYZ23456789; enforce uniqueness via DB constraint plus bounded insert retry, not lookup-only checks.
- Build onboarding, session restoration/logout, password recovery, field validation, auth error/empty/loading states, and profile editing.
- Ensure protected actions authorize on server, public lookups cannot disclose email, and account/code enumeration is rate-limited.
- Document auth provider configuration and test account creation for concurrent code generation and OAuth/password variants.

**Exit/verification:** Signup-to-profile flow passes tests on primary target, identity rules verified, unauthorized access rejected, recovery/callback handling validated.

## Phase 4 — Game catalog, selection, and discovery
**Status:** COMPLETE — [PR #5](https://github.com/A13Xg/Daydle/pull/5) merged at `e0fcb2b825b6298570c94580b928afd59a0c24f9` with [passing main CI](https://github.com/A13Xg/Daydle/actions/runs/43801213149). Plan: [completedPhases/Phase4Exec.md](completedPhases/Phase4Exec.md). **Dependencies:** 3.

**Purpose:** Make a broad external-game catalog browseable while supporting only a smaller initial set of parsers.

**Scope and implementation guidance:**
- Implement canonical game registry with stable IDs, publishers/URLs, categories, cadence/timezone/reset metadata, active/retired status, icon usage, and parser-support labels.
- Seed a curated representative set of playable game links, distinguish “launchable but not parseable,” and validate outbound URLs.
- Implement search/filter, game detail, category discovery, personal add/remove/reorder, and persisted selection preferences.
- Provide admin-authorized catalog mutations at the API/domain level (full admin UI later); do not silently reassign IDs or delete historical results when games are retired.
- Define disabled, stale-link, unsupported, empty, loading, and search error behavior.

**Exit/verification:** Public discovery works, selections survive login, inactive games handled, permissions enforced, tests cover metadata/URL logic and selection races.

**PR #5 review hardening — IMPLEMENTED / CI VERIFIED:**
- [x] Revoke the inherited `UPDATE(sort_order)` column grant as well as table-level write grants; SQL tests check `has_any_column_privilege` and reject direct owner reordering.
- [x] Treat failed favorite-save acknowledgements as **unconfirmed**, reread the authoritative ordered selection and block editing if reconciliation fails.
- [x] Display saved-game loading/error states and a retry action on both catalog and direct detail routes.
- [x] Serialize concurrent category replacements with a locked parent row; test two overlapping sessions against an initially empty category list on both clean PostgreSQL databases.
- [x] Retain the validated operational keep-alive improvements and correct the false diagnosis from PR #6.
- **Evidence:** [Phase 4 PR #5](https://github.com/A13Xg/Daydle/pull/5) and [CI run](https://github.com/A13Xg/Daydle/actions/runs/43785315498), 60 unit/API tests plus two clean PG17 databases. Post-merge live database workflow dispatch remains unverified.


## Phase 5 — Today experience, PWA, and external-game navigation
**Main status:** BLOCKED — [PR #7](https://github.com/A13Xg/Daydle/pull/7) merged at `75039ac1`, [main CI passed](https://github.com/A13Xg/Daydle/actions/runs/43809997908); authorized production [run 43810002170](https://github.com/A13Xg/Daydle/actions/runs/43810002170) failed at migration history preflight before any hosted SQL or Worker deployment. [Fix PR #8](https://github.com/A13Xg/Daydle/pull/8) adds guarded read-only verification and conditional metadata reconciliation. Physical iPhone acceptance remains a post-release phase gate — [merged PR #7](https://github.com/A13Xg/Daydle/pull/7), active [Phase5Exec.md](Phase5Exec.md) and [passing CI](https://github.com/A13Xg/Daydle/actions/runs/43803934602). **Dependencies:** 4.

**Automated gates completed on PR #7:**
- [x] Today from selected games in order with private manual played markers distinct from verified results.
- [x] Global user-tap clipboard entry, manual/denied/empty/oversized paths, publisher return hint, responsive fixed mobile action.
- [x] Installable manifest, generated 180/192/512/maskable PNG icons, build-versioned service worker and public-only app-shell caching.
- [x] Offline public catalog/Today snapshots and owner-keyed selected IDs without caching private game marks, raw input or spoiler-sensitive data.
- [x] 84 frontend/security tests, two clean PostgreSQL 17 replay/authorization suites, build, lint, format and HTTP PWA smoke.
- [x] Owner authorization for schema-first Phase 4/5 migration and Cloudflare Worker release received; no remote action was performed during preparation.
- [x] Main-only, protected-environment, manual [release workflow](.github/workflows/release-phase5.yml) and migration-history allowlist/preflight tests committed; no new project credentials requested.
- [x] Owner reviewed/merged PR #7; `main` CI passed. Protected production job was dispatched, credentials validated and Supabase project linked successfully.
- [x] Release failure isolated: the migration-history guard rejected Phase 2/3 tracking; **no migrations or Worker deployment ran**.
- [x] Fix source in [PR #8](https://github.com/A13Xg/Daydle/pull/8): version-only diagnostics, strict baseline SQL/RLS/trigger read-only check, metadata-only repair of verified missing Phase 2/3 versions and fail-closed regression tests.
- [ ] Merge fix PR #8, re-dispatch the production release workflow on `main`, approve the reviewer gate and confirm **actual** SQL migration and Worker deploy success. Scope failures or mismatched remote schema are blockers, not permission to bypass checks.
- [ ] Physical iPhone Safari/home-screen install, Google/Apple sign-in, publisher return, clipboard permissions, offline restoration, and account switching. All remain NOT VERIFIED. Keep Phase 5's final acceptance open. The owner-directed release-first sequence permits reviewed merge before iPhone verification without declaring the phase complete.


**Purpose:** Close the mobile game-launch-return loop without inventing iOS clipboard/browser capabilities.

**Scope and implementation guidance:**
- Implement Today from user-selected games with launch links, record/played state, and a persistent global Paste entry. Optional rotation does not impose missed-day failures.
- Configure installable PWA manifest/icons, application shell caching, and offline read-only access to previously fetched safe catalog/Today/history content; keep sensitive/stale spoilers out of reusable public caches.
- Prefer new tab/external context for source games, but detect actual iOS Safari/installed-PWA behavior and provide visible fallback/resume affordances.
- On app focus/return, expose user-triggered Paste Results. Do not rely on silent clipboard reads; support manual paste and denied/empty clipboard paths.
- Add responsive accessibility/focus behavior and iOS Safari/PWA integration tests; visual palette/layout composition remain deferred.

**Exit/verification:** Selected game -> publisher -> Daydle return -> user-triggered Paste shell is usable on iOS; offline read-only experience documented and tested.

## Phase 6 — Deterministic parser registry and initial game coverage
**Status:** NOT STARTED. **Dependencies:** 5.

**Purpose:** Build an isolated, versioned, testable server-side parsing engine and the first 5–10 reliable game parsers.

**Scope and implementation guidance:**
- Define typed parser interface (detect confidence and diagnostics, parse, validate, puzzle/date resolution, parser+format versions, normalized core fields, structured per-game metrics).
- Define normalization and bounded input handling, ambiguous-match behavior, error taxonomy, Unicode/emoji considerations, and false-positive avoidance.
- Implement 5–10 distinct parser modules, with real representative current and historical samples where legitimately available, malformed fixtures, win/loss variants, whitespace/Unicode edges, and format regression tests.
- Keep game registry data separate from parser code; bind through stable IDs and explicit support metadata.
- Record parser versions and diagnostics; do not use LLM inference as the production parser and do not execute user-supplied code.
- Establish a fixture-based acceptance gate for adding future parser plugins.

**Exit/verification:** Fixture suite verifies all supported games, false-positive and malformed-input handling, confidence routing, puzzle resolution, and bounded execution.

## Phase 7 — Result ingestion, history, and correction lifecycle
**Status:** NOT STARTED. **Dependencies:** 6.

**Purpose:** Make pasted results reliably owned, deduplicated, persisted, corrected, and retrievable.

**Scope and implementation guidance:**
- Wire global Paste to authenticated API: normalize/detect/parse/validate/resolve; automatically save high-confidence results; prompt on ambiguous game/date; single result per request.
- Transactionally save raw (90-day expiry) and parsed result with provenance/version. Use unique user/game/puzzle key, idempotent duplicates, and explicit replace/delete flows.
- Unknown input is not automatically retained; offer explicit opt-in sample retention and game selection. Build user history, game filtering, result details, and correction explanation.
- Record correction lineage and ensure derived scores/streaks/achievements/caches can be invalidated; do not allow arbitrary manual leaderboard score edits.
- Implement secure text rendering, input/rate/size limits, ownership checks, and duplicate/concurrency scenarios.

**Exit/verification:** Paste-to-history and correction E2E pass; duplicate replay is idempotent; malformed/unknown handling safe; raw expiry metadata present and tested.

## Phase 8 — Personal statistics, streaks, and achievements
**Status:** NOT STARTED. **Dependencies:** 7.

**Purpose:** Turn canonical results into trustworthy, game-aware historical insights.

**Scope and implementation guidance:**
- Compute universal activity counts, days active, active-day streak, and longest streak with user timezone semantics; the activity-based “full completion” requirement is not a separate all-games-complete streak.
- Compute per-game success/attempt/score/time distributions, trend series, personal bests, and release-based play streaks only when game identity/cadence permits.
- Add a small rule-driven achievements framework with invalidation on result replacement/deletion; expose public-ready structured metric summaries.
- Define missing data, unknown score direction, ties, incompatible score metrics, historical backfill, timezone travel, skipped release, and performance fallback cases.
- Add deterministic aggregate tests and E2E presentation of historical and empty states.

**Exit/verification:** Statistics agree with result fixtures, recalc correctly after corrections, avoid unsupported cross-game comparisons, and meet reasonable latency targets.

## Phase 9 — Public profiles and instant friendship
**Status:** NOT STARTED. **Dependencies:** 8.

**Purpose:** Publish permitted performance and implement mutual friends as an optional comparison filter.

**Scope and implementation guidance:**
- Publish accessible, shareable user profiles with display name, games, scores/results, statistics, ranks where defined, and achievements; exclude email/raw data/private operational metadata.
- Create friend code entry, canonical share URL and QR display, camera QR scan where supported, and login-then-resume link acceptance. Codes resolve to public identities but are not authentication tokens.
- Friend connection occurs instantly, symmetrically, and idempotently; support unfriend, regenerate code, self-friend rejection, blocking, and rate limiting. No friend requests or acceptance flow.
- Build Compare with Friends selection/list shell. Friendship must never be used to authorize otherwise-public stats.
- Ensure spoiler-sensitive result access remains behind the later unified rules; do not expose unfinished raw public score endpoints in this phase.

**Exit/verification:** Code/link/QR flows and two-account mutual relation tests pass; no private field disclosure; block/unfriend behavior and race/idempotency covered.

## Phase 10 — Spoiler-safe comparisons, scoreboards, and rankings
**Status:** NOT STARTED. **Dependencies:** 9.

**Purpose:** Provide meaningful public and friend-filtered competition without leaking current puzzle answers/results.

**Scope and implementation guidance:**
- Implement a single viewer-and-puzzle-aware spoiler policy at server query/service boundary: unlock when viewer submitted their own valid puzzle result OR publisher reset is verified.
- Protect profiles, direct result APIs, public/friend leaderboards, rankings, cache responses, pagination, and any aggregate that could reveal hidden performance; anonymous viewers see spoiler-safe content.
- Support daily same-game scoreboards, shared-game friend comparisons, history head-to-head, and compatible per-game rankings; define ties, metric direction, and low-participation policies.
- Handle reset metadata absent/uncertain conservatively, timezone boundaries, result deletion/replacement, and public profile read without friendship.
- Add two-user and anonymous regression suites, cache isolation tests, and ranking fixture tests.

**Exit/verification:** No current-puzzle score leakage pre-unlock through any listed endpoint; game rankings are internally consistent and corrections reflected.

## Phase 11 — Administration, game requests/voting, and diagnostics
**Status:** NOT STARTED. **Dependencies:** 10.

**Purpose:** Equip owner-operators to maintain the expanding catalog and parsers without unsafe direct database edits.

**Scope and implementation guidance:**
- Build role-gated admin views for catalog CRUD/deprecation, user restrictions, parser status and errors, retained unknown/failed sample inspection, and request/voting moderation.
- Implement user-facing game suggestions and votes with duplicate controls, moderation states, visibility/ownership constraints, and abuse/rate limits.
- Add operational parser diagnostics (game, parser version, error category, trend, sample reference) without exposing clipboard contents in general logs.
- Add audit logging for sensitive admin mutations, robust pagination and search, and disabled/no-result/permission/error states.
- Test admin role boundaries and data exposure for ordinary user vs admin across both API and UI.

**Exit/verification:** Authorized workflows work, unauthorized users cannot invoke admin endpoints, requests/votes are consistent, and failures are diagnosable.

## Phase 12 — Privacy lifecycle, encrypted backups, and recovery
**Status:** NOT STARTED. **Dependencies:** 11.

**Purpose:** Finish data privacy obligations and real recovery capability on a free managed-database plan.

**Scope and implementation guidance:**
- Enforce rolling 90-day deletion for raw accepted/unknown samples (including administratively accessible samples); verify orphan and historical correction handling.
- Implement self-service export, result deletion end-to-end, and permanent account deletion with relationships, public stats/rank cleanup, retention documentation, and clear completion feedback.
- Implement scheduled offsite encrypted PostgreSQL exports, integrity verification, retention and restore procedure outside the Supabase Free backup feature set; never commit secrets or plaintext dumps.
- Test restoration in isolated environment, verify expired/deleted data do not become active after restore, and document recovery point/time objectives appropriate for beta.
- Complete privacy/data map and ensure caches, logs, object storage, and backups use documented deletion/expiry rules.

**Exit/verification:** Controlled test export/delete/restore succeeds; raw expiry works; backup recovery documented and observable, no secret/public raw leaks.

## Phase 13 — UX completeness, security, accessibility, and QA hardening
**Status:** NOT STARTED. **Dependencies:** 12.

**Purpose:** Deliver polished workflows without choosing the final visual identity.

**Scope and implementation guidance:**
- Audit every core surface for loading, offline, empty, denied, error, conflict, retry, success, and save-confirmation states and consistent interaction feedback.
- Test iOS Safari plus installed PWA game opening/return, user-activated clipboard, login restoration, QR scanning/share, spoiler reveal, editing, and unexpected interruptions.
- Run accessibility audit targeting WCAG 2.2 AA, performance checks, responsiveness/touch target verification, navigation/focus/screen reader flows, and browser baseline.
- Review security: auth/session, public/private authorization, IDOR, anti-enumeration/rate limits, CSP/XSS, parser DOS, storage/backup secrets, correction races, RLS and spoiler caches.
- Run thorough unit/integration/E2E and database tests; fix all critical/high regressions, document accepted lower-priority issues.
- Visual style details (palette, exact layout, typography) remain deferred; not functional/information architecture quality.

**Exit/verification:** Quality checklist and security/accessibility matrix pass, known-critical-defect count zero, regression suite green, primary iOS workflows demonstrated.

## Phase 14 — Public beta release and operational handoff
**Status:** NOT STARTED. **Dependencies:** 13.

**Purpose:** Release Daydle safely to open registration with a maintainable operating model.

**Scope and implementation guidance:**
- Finalize production environment, domain/DNS/TLS, Supabase provider callbacks, signing/cookies, Workers secrets, production migrations and seed data.
- Verify production observability, admin access, scheduled 90-day cleanup, encrypted backups, backup alerting, restoration runbook, and support/incident procedures.
- Perform pre-release smoke tests for signup, game selection, PWA installation, external launch/return, paste, profiles, spoilers, friend link/QR, stats, and admin workflows.
- Publish necessary user-facing legal/privacy explanations for public profile visibility, raw text retention, authentication, external site links, and account deletion.
- Document release checklist, known limitations, safe rollback, and post-release incident response. Keep application free and registration open.
- Release only after verified acceptance evidence and explicit user authorization to deploy or change production settings.

**Exit/verification:** Production smoke pass, rollback and recovery plans documented, monitoring active, beta deploy approved, final release note and version recorded.

## After the roadmap

Future possibilities (not automatic phases or MVP blockers): additional parser coverage, multiple share blocks per paste, deeper percentile analytics with sample-size rules, more achievements, optional custom schedules, new device targets, and a dedicated visual identity redesign. Each requires a new decision and explicit roadmap update before work begins.

## Phase execution artifacts

- **Active:** root-level Phase1Exec.md, Phase2Exec.md, … exactly one active plan for the requested phase, created on its phase branch.
- **Archived after passing tests/review:** completedPhases/Phase1Exec.md, etc. The archive contains the final plan plus verified outcome summary, commit/PR reference, tests run, deviations, risks, and follow-ups.
- **PR:** created as draft at phase start, marked ready for review only after validation; never auto-merge. Main ledger changes to COMPLETE only after merge verification.
- **Status reconciliation:** record actual commit hashes and PR state; if a checked “COMPLETE” phase is missing evidence or expected artifacts, stop and diagnose rather than cascading unreliable assumptions.

## Operational follow-up — Supabase keep-alive reliability

**Status:** IMPLEMENTED / CI VERIFIED on branch in [Phase 4 PR #5](https://github.com/A13Xg/Daydle/pull/5). **Priority:** operational resilience, independent of Phase 4 catalog delivery.

**Assessment of [PR #6](https://github.com/A13Xg/Daydle/pull/6):** Its claimed `apikey: ***` failure is unsupported. The actual `main` workflow already uses the configured `${SUPABASE_PUBLISHABLE_KEY}` header. A request made with a literal redaction placeholder is not a valid reproduction. Its six-day `*/6` cron also had no seven-day boundary gap. Neither is a demonstrated production defect.

**Accepted and implemented improvements:**
- Increase the cheap, row-limited read-only cron to **daily** for missed/delayed-run resilience, not to fix a nonexistent month-boundary defect.
- Extract the HTTP check into `scripts/ops/keepalive.mjs`; validate the public Supabase origin/key, preserve the real API key header, fail on HTTP errors, and avoid logging secrets/response bodies.
- Add isolated local-HTTP-server regression tests for request method, header, row-limited endpoint, 200 success, 401 denial and schedule.
- Update operations runbooks, clearly separating local CI evidence from hosted success.

**Pending post-merge verification:** After owner review/merge, manually dispatch `Supabase keep-alive` on `main`; verify HTTP 200 with configured repository variables and monitor workflow notifications/last success. PR CI cannot verify an actual scheduled run and performs no production dispatch, schema migration or deployment.

## Circle-Back

Deferred operational items that are not numbered phases and do not block any phase's acceptance gates. Each needs explicit user authorization before work begins.

### Automated Apple client-secret rotation
**Status:** NOT STARTED. **Depends on:** Sign in with Apple configured in Supabase Auth; production environment secrets; Phase 14 production readiness (or earlier if rotation reminders prove unreliable).

**Why:** Apple's OAuth client secret is a signed token that expires after at most about six months. When it lapses, Apple sign-in fails while Google sign-in keeps working. The current process is manual: re-run the local setup script before the printed expiry date.

**Proposed approach:**
- Add a scheduled GitHub Actions workflow (monthly cron plus `workflow_dispatch`) in the `production` environment. A required-reviewer rule is acceptable, since each run then prompts a human.
- Generate the ES256 client-secret token with Node's built-in `crypto`; no new dependencies.
- Update only `external_apple_secret` through the Supabase Management API using `SUPABASE_ACCESS_TOKEN`. Do not push a whole configuration file or touch other auth settings.
- Re-mint only when the stored expiry is within about 30 days, or on manual dispatch. Record the new expiry and fail or open an issue if rotation fails.
- Verify afterwards by checking that the provider is still enabled and the authorize endpoint redirects to Apple with the expected Services ID.
- Never print the key or token, never upload them as artifacts, and mask all values in logs.

**New production-environment entries:** secret `APPLE_P8_KEY`; variables `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_SERVICES_ID`. Existing `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` are reused.

**Tradeoff to decide first:** storing the `.p8` signing key in GitHub widens its blast radius. If that is unacceptable, use a reminder-only workflow that opens an issue 30 days before expiry and leave the secret regeneration manual.

**Exit/verification:** A dispatch run rotates the secret end to end; Apple sign-in succeeds afterwards on the production domain; the new expiry is recorded; no secret appears in logs; rollback and key-revocation steps are documented in `docs/auth.md`.

### Installed-PWA authentication verification
**Status:** NOT STARTED (deferred from Phase 3 by the owner). **Depends on:** the PWA experience in Phase 5.

Verify on an iPhone, in the installed PWA rather than Safari tabs: Google and Apple sign-in and return to the app, sign-out, and session restoration after the app is closed and reopened. Record results in the Phase 5 archive.

### Email/password sign-in with confirmation and custom SMTP
**Status:** NOT STARTED. **Depends on:** a verified sending domain and SMTP provider.

Email/password is disabled because unconfirmed email signup allows account pre-hijacking through automatic identity linking (see [docs/auth.md](docs/auth.md)). To re-enable: configure custom SMTP on an owned domain, require email confirmation, restore a form (the removed form and widget are in git history, commit `d534cfd`), verify confirmation and password recovery on a real device, then run `scripts/ops/configure-turnstile.ps1 -EmailSignup Confirmed` if a CAPTCHA is wanted.

### Google OAuth consent-screen branding and publishing
**Status:** NOT STARTED (owner action). Publish the Google app from Testing to production and add branding: app name, support email, homepage and authorized domain. Basic scopes (`openid`, `email`, `profile`) are expected not to need Google verification; confirm in the console.

### Retire or rework dormant email-era code
**Status:** NOT STARTED. The auth actions still contain email sign-up, sign-in, recovery and CAPTCHA token pass-through, and `configure-turnstile.ps1` remains. The account page's password-reset form was removed during the Phase 3 review because any signed-in session could open it by URL. Decide whether to delete or restore them when the email decision is made, so unused paths do not rot.

### Development-dependency advisories
**Status:** NOT STARTED. Dependabot reports a moderate `minimatch` denial-of-service advisory (and `npm audit` reports moderate findings in the lint toolchain). They are development-only and do not ship in the app or Worker. Upgrade the lint tooling in a dedicated change.

### Provider-supplied display names
**Status:** NOT STARTED (owner decision needed). New users from Apple or Google get their provider name as a **public** display name and are marked as onboarded, so they are never asked to confirm it. The sign-in and account pages now disclose this. To require confirmation instead, add a forward-only migration that sets `onboarding_completed` to false for provider-supplied names (and update the trigger test), or add an explicit "choose your public name" step.
