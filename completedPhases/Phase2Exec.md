# Phase 2 Execution Plan — Domain model, persistence, and security foundations

**Status:** VERIFIED / IN REVIEW  
**Base:** main `76557c649aac2a54543b40db555cfbab226922c9` (Phase 1 PR #1 merged as `b91a6e8` and reconciled).  
**Branch:** `phase/02-domain-security` · **Draft PR:** [#2](https://github.com/A13Xg/Daydle/pull/2)  
**Authority:** [IDEA.md](../IDEA.md), [roadmap.md](../roadmap.md#phase-2--domain-model-persistence-and-security-foundations), [AGENTS.md](../AGENTS.md).

## Preflight evidence

Main contains the Phase 1 React/Vite/Cloudflare Worker shell, a dependency lock, isolated `src/`, `worker/`, `shared/`, and PR CI. Phase 1 PR #1 is merged, archived plan exists, and successful main CI is recorded. There are no application database migrations, providers, or production deployments to preserve. This phase does not require a real Supabase account to test schema behavior.

## Core decisions

1. Use **versioned imperative Supabase SQL migrations** under `supabase/migrations/`. Avoid maintaining a competing declarative schema source. Execute against isolated PostgreSQL 17 in GitHub Actions; deploy no migration to any remote database without separate authorization.
2. Use `public` for PostgREST-facing tables with explicitly limited column/table grants and RLS. Use an unexposed `app_private` schema only for service-only administration/audit and `SECURITY DEFINER` authorization helpers. Do not grant application roles SELECT on raw/diagnostic/audit tables.
3. Model profile information separately from generated friend-code tokens. Public profiles contain only non-secret profile metadata; friend codes are owner-visible and server-looked-up only, not enumerable through generic public profile queries. Email/password stay in Supabase Auth and never in app-facing tables.
4. **Puzzle identity is canonical**: unique game + stable opaque puzzle key, optional date, explicit release/reset metadata; separate database identity from calendar assumptions. Allow multiple puzzles per day in persistence, with MVP one-per-day enforcement in later application services.
5. One canonical result per user/puzzle (unique database constraint) with game/puzzle composite FK consistency, typed result metrics and parser versions, server-only writes, explicit replacement history. Retain bounded raw text for <=90 days with a purge function that will be scheduled in Phase 12.
6. Public SELECT of result rows is **viewer-specific**: owner, or viewers who have submitted their own valid result for the same puzzle, or verified publisher reset. Enforce in the database with a constrained, read-only, SECURITY DEFINER function to avoid RLS self-recursion; direct queries, counts, and future APIs inherit RLS. Anon can only read post-reset results. Unknown/unverified resets never expire spoilers automatically.
7. Public game registry, categories, selections, earned achievements, suggestions/votes, friend-pair, blocks and admin roster follow approved domain semantics. Friendship is a comparison-list grouping, not a data-access privilege.
8. PostgreSQL grants and RLS are distinct: deny direct client mutations of authoritative result, raw, puzzle and admin tables, even when row policies exist. Future Workers backend will authorize and validate mutations; `service_role` bypass is strictly server-only.

## Tables and constraints

- `public.profiles` (auth user FK, display name, optional image, public creation timestamp); `public.friend_codes` (1:1 owner, uppercase five-character regex, unique).
- `public.games`, `public.game_categories`, `public.game_category_links`, `public.user_games` (stable ID/slug, catalog metadata, schedule/reset hints, parser status; public selection).
- `public.puzzles` (canonical puzzle key, optional date, release time, verified reset time, unique per game/key).
- `public.game_results` (canonical user/puzzle, game/puzzle FK, outcome, score/attempts/time/JSON metrics, parser provenance; unique user+puzzle); `public.raw_submissions` and `public.result_corrections` (private raw payload and correction history).
- `public.friendships` (unordered pair, no self-friend), `public.blocks` (directed, no self-block).
- `public.achievement_definitions`, `public.user_achievements` (source-puzzle and spoiler-safe publish time); `public.game_suggestions`, `public.suggestion_votes` (one vote/user/suggestion, moderated status).
- `app_private.admin_members`, `app_private.admin_events` for admin authorization and audited operations, not exposed by PostgREST.

Avoid table proliferation beyond actual requirements; no materialized stats or separate parser registry table in this phase.

## Expected files

- `supabase/migrations/20261114050000_phase2_domain_security.sql` — transactional schema, checks, FKs, grants, indexes, RLS, admin/spoiler functions, retention primitives.
- `tests/sql/bootstrap.sql` — local-only Supabase-compatible test roles and `auth.uid()` stub, never deployed.
- `tests/sql/fixtures.sql` — owner, viewer and anonymous fixture setup, active and expired puzzles, multiple results.
- `tests/sql/assertions.sql` — schema, constraint, grant, RLS, spoiler and authorization assertions.
- `scripts/test-db.sh` — repeatable clean two-database SQL migration/fixture testing, with `psql -v ON_ERROR_STOP=1`.
- `shared/domain.ts` and `tests/domain.test.ts` — canonical domain TS contracts and friend-code format validation.
- `.github/workflows/ci.yml` — independent PostgreSQL 17 service job (no real Supabase credentials), CI continues existing frontend tests.
- `docs/database.md` — entity boundaries, RLS threat model, test usage, migration, environment separation, retention, rollback.
- `README.md`, `AGENTS.md`, `package.json` — commands, security invariants, phase runner guidance. No live credential files.

## Security matrix and failure cases

| Surface | Anonymous | Authenticated | Service/admin |
|---|---|---|---|
| Public profiles, active games, categories | SELECT | SELECT | Manage via server |
| Profile updates | None | Own safe display fields only | Moderation via server |
| Friend codes | None | Only own lookup | Server lookup/reissue |
| User game selections | SELECT | SELECT; owner writes | Server as authorized |
| Current-puzzle results | Hidden until verified reset | Owner + viewers with same-puzzle submitted result | Privileged backend only |
| Previous verified-reset results | SELECT | SELECT | SELECT |
| Raw submissions, corrections, admin audit | Denied | Denied | Service only |
| Friendships and blocks | Denied | Own list only | Server writes |
| Achievement awards | Spoiler-aware | Owner/spoiler-aware | Server writes |
| Suggestions/votes | Public nonrejected suggestions | Public and own, no privileged moderation | Moderation via server |

Test malformed friend codes, duplicate result/key insertion, mismatched game-puzzle FK, duplicate unordered friends, raw-retention bounds, JSON metrics object type, negative/invalid score fields, user access denial, before/after reset, authenticated viewer unsubmitted vs submitted, owner visibility and anonymous access. RLS helpers must use immutable path lookup and restricted `search_path`. Supabase roles must never receive implicit raw grants.

## Implementation order

1. Review official Supabase RLS/migrations conventions and actual current repo. Approve schema ownership and conservative spoil/unverified reset design.
2. Implement SQL migration and read-only security helpers, FK/index/unique/role permissions; avoid service-credential dependency.
3. Implement test bootstrap, fixtures, role-aware positive/negative SQL assertions and two clean database replay.
4. Integrate PostgreSQL CI service job and canonical TS types, ensure no accidental client-side privileged writes.
5. Document migration, environment, retention, and rollback; update baseline instructions for policy and test discipline.
6. Run full Phase 1 CI plus database role/constraint tests. Inspect full diff and SQL objects for security-definer bugs, table grant leakage, concurrency and retention gaps; fix and rerun.
7. Record observed evidence; archive plan and mark PR ready **only after passing all material gates**. No merge, database provisioning or production deployment.

## Acceptance checks

- [ ] PostgreSQL migration applies cleanly on two independent fresh PG17 databases.
- [ ] Constraints, indexes and foreign keys enforce identities and duplicate prevention.
- [ ] SQL role tests demonstrate row-level/public/private boundaries and spoiler policy; no exposed raw or email table.
- [ ] RLS enabled on all exposed app tables; admin audit private.
- [ ] Raw submission TTL <=90 days with a tested purge primitive; scheduling deferred Phase 12.
- [ ] TypeScript and SQL domain contracts correspond.
- [ ] Existing `npm ci`, build, lint, format, typecheck and unit/API/preview smoke tests continue passing.
- [ ] Docs show exact migration/test commands, no secrets, no remote deployment claims.
- [ ] Source diff reviewed, no unapproved production changes or non-owner contributor metadata.

## Review notes before implementation

- Use a stand-alone PostgreSQL service for fast deterministic tests and explicit auth stubs; this tests actual SQL semantics without claiming Supabase hosted-runtime deployment.
- A public result row cannot be made universally visible without losing same-day spoiler constraints. Keep RLS on the base table, avoid SECURITY DEFINER public views that bypass it.
- Privileged service routines are allowed only from a secure Worker/server context in future phases; Phase 2 creates schema and access foundation only.
- A cleanup function does not constitute a scheduled retention job. Until Phase 12 a remote system has **not** been configured to perform automatic 90-day deletion; no production data should be admitted without that schedule.
- Define one canonical result per user/puzzle, not per user/day, to prevent future multiple-edition migration risk.
- Public achievements without an explicit reveal policy must not leak current-puzzle results.
- No user-facing UI changes in this phase; iOS checks remain unchanged from Phase 1.

## Actual implementation, tests and audit

**Verified 2026-11-14 (UTC) on** `phase/02-domain-security`; PR [#2](https://github.com/A13Xg/Daydle/pull/2). This phase is **IN REVIEW**, not COMPLETE on main until the user reviews/merges this PR and main status is reconciled.

### Delivered

- Added transactional, versioned Supabase SQL migration `20261114050000_phase2_domain_security.sql` with **16 public domain tables** and **two private admin tables**. Separates profiles from private friend codes, canonical puzzles from dates, result metrics from private raw share text, and symmetric friendships from blocking.
- Added unique constraints for owner+puzzle results, game+puzzle keys, friend codes and unordered friendship pairs; composite foreign key prevents assigning a puzzle result to a different game.
- Enabled RLS for all exposed and private tables, explicit role/column grants, public profile/catalog reads, private friend-code reads, owner-only personal selection mutation, and server-only authoritative result writes.
- Implemented `SECURITY DEFINER` spoiler-visibility helpers with fully qualified names and restricted execution; anonymous users see only verified-reset results, authenticated users additionally see their own results and same-puzzle scores after submitting.
- Added a bounded 90-day raw-text expiration constraint and privileged deletion primitive; raw cleanup scheduling is explicitly deferred to Phase 12.
- Added typed shared domain contracts, test-only mock Supabase auth roles, fixtures, constraint/security assertions, and a two-clean-database runner under PostgreSQL 17.
- Added a distinct GitHub Actions database-security job, database documentation and provider credential manifest [docs/secrets.md](../docs/secrets.md); strengthened AGENTS.md's no-unapproved-deploy and role-validation requirements.

### Actual automated verification

**Final passing CI:** https://github.com/A13Xg/Daydle/actions/runs/43561573074 (both jobs successful).

| Gate | Execution | Result |
|---|---|---|
| Locked install | `npm ci --no-audit --no-fund` | PASS |
| Strict TS | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Format | `npm run format:check` | PASS |
| App/contract tests | `npm test` | PASS — 4 suites, 14 tests |
| Worker/client production bundle | `npm run build` | PASS |
| HTTP preview smoke | `npm run preview -- --port 4173` and `npm run smoke` | PASS |
| PostgreSQL 17 migrations | `bash scripts/test-db.sh` in isolated GitHub service | PASS — two independent fresh databases |
| SQL authorization/constraints | `tests/sql/assertions.sql`, real PostgreSQL roles | PASS — anon, owners, other users, service role, raw denial, spoiler reset/unlock, uniqueness, mismatched FK, 90-day purge and destructive game-delete prevention |
| Security/source audit | Code and changed-file inspection | PASS — no credentials, user-writable authoritative results, service-role keys in browser, or unapproved deployment workflow |

### Repairs and audit findings

- Initial new TypeScript files required Prettier normalization; temporary CI formatting step was removed once source was corrected.
- Expanded negative tests revealed a transcription error in a new SQL `DO` block delimiter. Corrected and reran database suite successfully.
- Narrowed permission changes to **Daydle-owned public tables**, avoiding modifying unrelated Supabase/public schema tables.
- Changed puzzle/result/achievement game references to `ON DELETE RESTRICT` to protect canonical historical results from accidental catalog deletion; a corresponding negative SQL test passes.
- Verified `friend_code` alphabet excludes O/I/L/0/1 and contains 31 unique symbols, with 31^5 possible codes.

### Explicit limitations

- This is a local PostgreSQL integration test against a mocked `auth.uid()` and Supabase-style roles. It **does not** demonstrate the migration deployed successfully to hosted Supabase or real OAuth flow.
- A hosted database project/connection is not provisioned and no `supabase db push` was run. No production/preview Cloudflare Worker deployment, secrets mutation, or real-user data access occurred.
- The database has a raw TTL constraint plus purge function, **not a running scheduled retention job**. Phase 12 must implement/verify scheduled deletion before real raw inputs are collected in production.
- Admin UI, parser implementation, full app APIs, achievements computation and code-generation logic are out of Phase 2 scope; schema only.
- Future public aggregate statistics, profile APIs, admin functions, and caching must apply the same viewer-specific spoiler rules; schema-only RLS does not automatically secure arbitrary future server-side materializations.

### Review and recovery

- Review PR #2 and CI evidence; do not automatically merge. Phase 2 becomes COMPLETE on main only after confirmed merge and verification.
- No remote database was modified. To roll back this branch before merge, decline PR #2. After a migration deploy in a later phase, change via versioned forward migration and reviewed data-recovery plan rather than editing an already-applied migration.

