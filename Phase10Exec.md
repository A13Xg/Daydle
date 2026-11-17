# Phase 10 Execution Plan — Spoiler-safe comparisons, scoreboards and rankings

**Status:** IN PROGRESS — SOURCE ONLY / NO HOSTED PHASE 10 DEPLOYMENT
**Branch / draft PR:** `phase/10-spoiler-safe-comparisons` · [PR #18](https://github.com/A13Xg/Daydle/pull/18)
**Base:** main `9df11aa111732b69105b53c9927eb397374c9db3`; Phase 9 merged `d47d360b`, post-merge CI #44022863047 PASS.
**Release dependency:** Daydle Preview Phase 9 migration recorded `20261117051824`, read-only RLS/grant verification passed. Dedicated strict migration/release reconciliation PR #17 is open; no Cloudflare deploy or Phase 10 SQL application in this phase branch.
**Authority:** IDEA.md §§3–4,8–9,12; roadmap.md Phase 10; AGENTS.md; Obsidian Arcade DESIGN.md and `referenceFiles/.../comparisons/` example.

## Existing implementation and risk assessment
- `public.puzzles` includes canonical `game_id,puzzle_key,puzzle_date,released_at,reset_verified_at`; `reset_verified_at` is NULL unless the *next* publisher reset/release is independently verified. Never infer from calendar midnight, user timezone, share number or time elapsed.
- `public.game_results` stores a UNIQUE owner/puzzle result plus game metrics. Phase 7 owner RPCs are private. `app_private.can_view_result(owner,puzzle)` already guards direct RLS SELECT, with owner / same-puzzle completion / verified reset checks. A service role bypasses RLS, so **new privileged comparison RPCs must enforce equivalent viewer-aware policy explicitly**, not call an unrestricted results SELECT and redact in React.
- Phase 9 `social_public_profile` publishes only name, join date and selected games. `social_my_network` returns symmetric friend edges; no friendship-gated public data. Preserve those contracts; introduce filtered performance as separate RPC/API so Phase 9 never accidentally becomes unrestricted.
- Phase 8 `my_personal_statistics` includes *complete private history*, so never use it to populate public summary or ranking. Public derived counts/achievements from unverified current puzzles are spoiler-sensitive.
- The reference comparison mockup contains fictional all-game points, friend requests and a social feed. IDEA explicitly forbids universal cross-game score and friend requests. Implement **game-and-puzzle scoped rankings** and a real spoiler shield; no fake podium.

## Authoritative domain policy
- Introduce `app_private.comparison_can_view(viewer_uuid,puzzle_uuid)`, a single STABLE/SECURITY DEFINER helper: TRUE only when verified `reset_verified_at <= now()`, or the verified viewer has a persisted result for **that exact puzzle**. NULL/anonymous viewer never unlocks current puzzles.
- Rewire RLS helper `app_private.can_view_result` through the same policy (plus owner read, which is equivalent for an existing result). All Phase 10 RPCs use the same helper *before aggregating, filtering friends, ranking or paginating*. Never reveal pre-unlock row count, score, outcome, profile aggregate, rank or timing, even via pagination metadata. Distinguish `locked` status based on public puzzle metadata only.
- No owner UUID from request body trusted: Worker verifies bearer via Supabase Auth and derives `p_viewer` itself. Anonymous requests pass NULL; invalid supplied bearer receives 401 (never silently downgraded to anonymous). All new SQL result RPCs execute via `service_role` only; revoke from `PUBLIC,anon,authenticated`; maintain RLS on existing public tables and no new data grants. Response `private,no-store`, `Vary: Authorization`, no service role/raw share in response.
- Results deleted or replaced recalculate on next read, with no stale materialized caches. Publisher reset control is authoritative only when verified; unknown cadence remains locked. No manual offline writes, no client-side declassification.

## Game-specific ranking rules
- All metrics **ascending (lower is better)** for successful/complete shares only; losers/incomplete outcomes remain visible on unlocked puzzle but **unranked**.
- `wordle`: attempts 1–6. `connections`: mistakes from validated format metrics. `strands`: hint count. `mini-crossword`: completion time in milliseconds. `quordle`: total attempts over exactly four successful boards (otherwise unranked). No generic score. Ties use competition `RANK` (1,1,3), then deterministic display name/UUID ordering. No tie-breaking based on upload time. Sparse leaderboard displays counts, not invented competition.
- Puzzles list is based only on public canonical puzzle metadata, never on per-user submission totals. Board supports global or friend-filtered membership; friends scope requires authenticated viewer and includes viewer. Public profiles remain readable without friendship.

## SQL/source design
- New forward-only migration `supabase/migrations/20261117060000_phase10_comparisons.sql`: common policy, safe metric converter, `comparison_puzzles`, `comparison_board`, `comparison_public_result`, `comparison_profile_summary`, `comparison_head_to_head`. Use read-only `SECURITY DEFINER SET search_path = ''` functions, narrowly scoped grants. No new tables, storage or credentials.
- `worker/comparisons.ts` routes:
  `GET /api/v1/comparisons/puzzles?game=slug`,
  `GET /api/v1/comparisons/board?game=slug&puzzle=canonical-key&scope=global|friends&limit=20&offset=0`,
  `GET /api/v1/comparisons/result/:uuid`,
  `GET /api/v1/comparisons/profile/:uuid`,
  `GET /api/v1/comparisons/head-to-head?left=uuid&right=uuid&game=slug&limit=...`.
  Optional authenticated viewer is verified, no user-supplied ID accepted. RPC output is validated and re-projected into explicitly safe DTOs.
- `shared/comparisons.ts`: typed allowlisted payloads and strict validators for enum/status, normalized metrics and bounded arrays, direct result ID path, pagination.
- `src/lib/comparisons-api.ts`: viewer-aware safe client using OAuth session token only when available, never generic REST direct access. Network errors surfaced, no offline caching.
- `src/components/ComparisonsPage.tsx`: Game selector, recent canonical puzzle selector, friend/global scope, ranked list, unranked row state, spoiler shield, accessible loading/empty/error/navigation.
- `src/components/PlayerPerformance.tsx` and `HeadToHead.tsx`: public performance derived from **visible** saved results only and common-puzzle comparisons. Integrate into `PublicPlayerPage`, `FriendsPage`, `App.tsx` + approved ArcadeShell routing. Obsidian Arcade palette, locally bundled assets, >=44px controls, mobile 320/393/desktop 1024 layouts, focus/ARIA states.

## Tests and audit gates
- Two independent PG17 DBs apply all phase SQL, with fixtures for three distinct players, different puzzle IDs and verified-vs-unverified reset. Assert anonymous locked, viewer same-puzzle unlock, friend scope no additional entitlement, different puzzle no unlock, no unverified reset leakage, RLS browser role denial, no raw/email metadata, independent pagination after filtering, rank/tie/win/loss behavior, corrections/deletions reflected, head-to-head restricted to mutually visible puzzles.
- Worker unit/API tests: malformed game/puzzle/UUID/scope/page, missing/invalid bearer, service secret failures, cache/Vary, response DTO allowlist, anon vs verified params, direct-result 404 for locked, exhausted/paged filtering, no invalid service response disclosure. React smoke checks routes and shields at 320/393/1024; real device iOS and live authenticated E2E deferred until a separately approved hosted release.
- Execute CI `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, `npm run db:test` and Chromium route/viewport tests. Review actual PR diff for IDOR, privilege grants, reset behavior, fake ranking, SQL ambiguity, expensive unbounded scans and secret exposure.
- Do not merge Phase 10 or apply its hosted migration automatically. Source PR stays draft until mandatory source tests pass. User explicitly authorizes Phase 9 deployment/release actions, **not** deployment of unmerged Phase 10 code. Keep Phase 10 source progress independent of PR #17's release history update.

## Known risks and tradeoffs
- Baseline `can_view_result` allows only own/current-puzzle peers or verified resets; repeating that policy in privileged RPCs must stay synchronized. Centralize now.
- No verified next-reset feed currently exists. Recent puzzles are intentionally locked for anonymous/unplayed viewers; do not use arbitrary expiry as a workaround.
- Full public profile achievements based on the complete private history could leak activity. Phase 10 public summaries may show only visible per-game results, never inferred global-streak achievements. Claims should say "visible results" rather than imply complete public history.
- Relational friend list already capped at 200. Compete over a bounded list, not a client-submitted arbitrary friend filter.
