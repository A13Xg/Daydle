# Phase 8 Execution Plan — Personal statistics, streaks, and achievements

**Status:** IN PROGRESS — source-only development and verification; not deployed or ready for review.
**Branch/PR:** `phase/08-personal-statistics-achievements` / [PR #15](https://github.com/A13Xg/Daydle/pull/15).
**Base:** `main` at `d0c693035f297d044a0663e6baf9d3e182b5d2e2`.
**Source authorities:** IDEA.md §§7–9, roadmap.md Phase 8, AGENTS.md, Obsidian Arcade DESIGN.md, completed Phase 7 source PR #14.

## Preflight, dependency and release decision

- Phase 7 source merged to main at `1ff1b04`; CI #44004416809 passed. Five service-role RPCs, rate tables and five supported parser catalog entries were applied and validated on Daydle Preview (project `xyjuriehmrkdqdmcxdso`) under specific owner authorization; service-only grants checked.
- Supabase registered the committed `20261117010000_phase7_results.sql` under generated version `20261117030322` and name `20261117010000_phase7_results`. Before any automated `db push`, reconcile migration history and filename; never blindly rerun.
- Phase 7 Worker service secret configuration, frontend/Worker deployment, real authenticated E2E and physical iPhone acceptance remain **NOT VERIFIED**. No deployment authority is inferred. The owner explicitly requested continued roadmap implementation: parallel source implementation is permissible while release acceptance remains gated. Roadmap's blanket dependency block should be refined to distinguish code integration from hosted release.
- Existing Statistics view is an honest placeholder; /history is owner-only and the Phase 7 API supports just 50 items/page with 5000 offset cap. **Do not** silently use it for complete statistics or present truncated data as universal totals.
- `public.game_results` has canonical (user_id,puzzle_id), `submitted_at` and `updated_at`, outcomes, score, attempts and completion time. `public.games` carries cadence, but daily reset verification is not generally populated. A user's timezone is not persisted with historical submissions.

## Product contract and decisions

1. **Universal activity** counts only persisted canonical results. One calendar day with at least one submission counts once; streak does not require completing every selected game. Local-day convention requires an explicitly selected valid IANA timezone and must handle DST, timezone travel and missing records accurately. Count today's active streak or yesterday's in-progress streak; otherwise current streak is zero.
2. **Per-game facts:** result total, solved/completed count, loss/incomplete count, win rate with an explicit defined denominator, guess-attempt distribution for supported games, completion-time statistics when supplied and supported, chronological trends. Favor publisher puzzle dates for release-based play streaks **only** with trustworthy cadence and dates; never map monotonically increasing puzzle numbers to local dates.
3. **Achievements:** few deterministic rules from canonical results, recalculated on reads so deleted/replaced results revoke eligibility automatically. No unverified persisted achievement award side effects. Distinguish activity achievements from score achievements and never treat `complete` as a universal `win`.
4. **Stats interface:** approved Obsidian Arcade, real data only, five-tab shell; authenticated, loading, offline, empty, error, retry and state-transition behavior, keyboard and 44px controls, 320/393/1024px layouts. No fake placeholders, rankings, friends or unsafely cached private stats.
5. **Security:** Worker validates Supabase Auth before a service-only read RPC; RPC takes verified owner ID, no browser service key. Same-origin, no-store, content-type and error normalization. Private stats are not public/social endpoints and are excluded from SW caches. Do not change Phase 7 write authorization.

## Implementation sequence

1. Build and test pure deterministic statistics/achievements computation, including duplicate activity days, empty data, DST, missing puzzle date, incorrect score-direction assumptions and replacement/deletion reaggregation.
2. Design an owner-only, DB-backed **complete-dataset** aggregate contract rather than loading only first 5000 history rows. Use bounded aggregate series and database indexes. Confirm query plan at expected sizes before adding a cache.
3. Implement server-authenticated read API and typed browser client; test missing/expired tokens, other-user isolation, invalid timezones, unconfigured Worker, out-of-range inputs and no private caching.
4. Integrate real Statistics/achievement UI and Obsidian Arcade style; browser tests for signed-out/unavailable and authenticated data states.
5. Verify format, typecheck, lint, unit/API tests, SQL RLS/security tests on disposable PG17, production build, PWA/API smoke and browser viewport checks.
6. Security/diff audit and PR evidence. Archive this execution plan and mark IN REVIEW only after all source gates pass. **Deployment remains separately gated** by Phase 7 hosted end-to-end acceptance.

## Risk register and roadmap disagreement

- **Release gate conflation:** delaying all source development until prior features ship reduces throughput without adding safety. Proposed interpretation: merged, tested source is an adequate *code dependency*; production exposure remains blocked until schema, secrets, real auth and privacy E2E pass. Record explicitly rather than silently relaxing release requirements.
- **Incomplete query:** paginating existing `my_result_history` and assuming it represents all history would silently undercount high-volume users. Require full-dataset SQL aggregates or an equivalent proven bound; never market a capped sample as a lifetime statistic.
- **Timezone ambiguity:** interpreting current local timezone as a permanent historical record changes streaks during travel. Choose explicit timezone preference or fixed per-submission day attribution, and document the policy before release.
- **Score semantics:** reject universal scores, arbitrary `min(score)` personal bests and game release streaks when publisher direction/reset data is undefined.
- **Data lifecycle:** a 90-day `expires_at` column is not physical deletion; Phase 12 purge still required. Fix migration-history mismatch before any schema automation.

## Verification log

- Branch and draft PR created. No Phase 8 code, tests, migrations or deployment completed at planning time.
