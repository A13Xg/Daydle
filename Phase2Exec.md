# Phase 2 Execution Plan — Domain model, persistence, and security foundations

**Status:** REVIEWED / IMPLEMENTATION AUTHORIZED (verification pending)  
**Base:** main `76557c649aac2a54543b40db555cfbab226922c9` (Phase 1 PR #1 merged as `b91a6e8` and reconciled).  
**Branch:** `phase/02-domain-security` · **Draft PR:** [#2](https://github.com/A13Xg/Daydle/pull/2)  
**Authority:** [IDEA.md](IDEA.md), [roadmap.md](roadmap.md#phase-2--domain-model-persistence-and-security-foundations), [AGENTS.md](AGENTS.md).

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

**Pending**. Add real commands, CI links, failures, fixes, final scope, review issues and archive evidence after verification.
