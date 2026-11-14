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
| 1 | Application skeleton, tooling, and deploy baselines | 0 | NOT STARTED |
| 2 | Domain model, persistence, and security foundations | 1 | NOT STARTED |
| 3 | Authentication, onboarding, and account identity | 2 | NOT STARTED |
| 4 | Game catalog, selection, and discovery | 3 | NOT STARTED |
| 5 | Today experience, PWA, and external-game navigation | 4 | NOT STARTED |
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
**Status:** NOT STARTED. **Dependencies:** 0.

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
**Status:** NOT STARTED. **Dependencies:** 1.

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
**Status:** NOT STARTED. **Dependencies:** 2.

**Purpose:** Enable open signup and account lifecycle with unique public identity and private credentials.

**Scope and implementation guidance:**
- Implement email/password registration/login and Apple/Google OAuth using Supabase Auth; provider-only accounts must not require a password. Handle callbacks and Apple relay addresses correctly.
- Create profile with display name and secure random 5-character friend code from ABCDEFGHJKMNPQRSTUVWXYZ23456789; enforce uniqueness via DB constraint plus bounded insert retry, not lookup-only checks.
- Build onboarding, session restoration/logout, password recovery, field validation, auth error/empty/loading states, and profile editing.
- Ensure protected actions authorize on server, public lookups cannot disclose email, and account/code enumeration is rate-limited.
- Document auth provider configuration and test account creation for concurrent code generation and OAuth/password variants.

**Exit/verification:** Signup-to-profile flow passes tests on primary target, identity rules verified, unauthorized access rejected, recovery/callback handling validated.

## Phase 4 — Game catalog, selection, and discovery
**Status:** NOT STARTED. **Dependencies:** 3.

**Purpose:** Make a broad external-game catalog browseable while supporting only a smaller initial set of parsers.

**Scope and implementation guidance:**
- Implement canonical game registry with stable IDs, publishers/URLs, categories, cadence/timezone/reset metadata, active/retired status, icon usage, and parser-support labels.
- Seed a curated representative set of playable game links, distinguish “launchable but not parseable,” and validate outbound URLs.
- Implement search/filter, game detail, category discovery, personal add/remove/reorder, and persisted selection preferences.
- Provide admin-authorized catalog mutations at the API/domain level (full admin UI later); do not silently reassign IDs or delete historical results when games are retired.
- Define disabled, stale-link, unsupported, empty, loading, and search error behavior.

**Exit/verification:** Public discovery works, selections survive login, inactive games handled, permissions enforced, tests cover metadata/URL logic and selection races.

## Phase 5 — Today experience, PWA, and external-game navigation
**Status:** NOT STARTED. **Dependencies:** 4.

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