# Spoiler-safe comparisons and rankings — Phase 10

## Privacy and release rule

Daydle shares only the results the current viewer is entitled to see. An ordinary player may see all results for a **specific puzzle** after they have themselves saved a valid result for that exact puzzle, or after Daydle records the publisher's **verified next puzzle reset**. A friend connection does not unlock otherwise hidden scores. Anonymous viewers see reset-verified editions only.

This policy is evaluated in PostgreSQL, **before** result queries, aggregate counts, ranks, direct-result reads and pagination. There is no calendar-based automatic unlock: release cadence and player timezones must never be used as a substitute for verified publisher metadata.

The canonical helper is `app_private.comparison_can_view(viewer_id,puzzle_id)`, used by all privileged comparison RPCs. Phase 2 direct table RLS `can_view_result` is updated to delegate to that rule. The own-result read remains permitted. Deletion of the viewer's matching saved result immediately revokes early access, and corrections immediately recompute ranks. No result/private aggregate/authorization data is stored in browser offline snapshots or shared caches. The Cloudflare Worker responds with `Cache-Control: private, no-store`, `Vary: Authorization`.

## Compatible ranking systems

Daydle has **no universal point total**. Every leaderboard is scoped to one game and a single canonical puzzle edition. Only successful results with a validated comparable metric receive a rank. Lower values are better, competition ties are `1,1,3`, and alphabetical display-name plus UUID ordering breaks display-order ties without changing rank.

| Game | Comparable metric | Winning condition |
|---|---|---|
| Wordle | Attempts 1–6 | `win` |
| Connections | Mistakes 0–3 | `win` |
| Strands | Hints 0–30 | `complete` |
| Mini Crossword | Completion time in milliseconds | `complete` |
| Daily Quordle | Sum of four successful board attempts | `win` |

Lost, incomplete, or unsupported metrics are **unranked** (still visible only after the viewer/publisher unlocks the puzzle). Head-to-head results compare metrics for the same puzzle and game; an unranked matchup is *not* falsely counted as a tie.

## Source API routes

| GET endpoint | Public vs private behavior |
|---|---|
| `/api/v1/comparisons/puzzles?game=wordle` | Up to 40 canonical puzzle editions from public puzzle metadata; no participation counts |
| `/api/v1/comparisons/board?game=wordle&puzzle=wordle%3Anumber%3A1406&scope=global&limit=20&offset=0` | Locked: only public puzzle identity/locked status; unlocked: allowlisted result rows, same-edition ranks, bounded count and page |
| `/api/v1/comparisons/result/:resultId` | 404 if missing or locked; explicit allowlisted game/puzzle/outcome/metric otherwise; never raw share/guess pattern/email |
| `/api/v1/comparisons/profile/:profileId` | Counts and game-specific summaries computed **only from results visible to this viewer**, not the player's private all-time totals |
| `/api/v1/comparisons/head-to-head?left=:playerId&right=:playerId&game=wordle&limit=20&offset=0` | Only shared puzzle editions whose results are visible to this viewer, never friendship-dependent permission |

Adding `scope=friends` to board requires a valid authenticated viewer, includes the viewer and their current symmetric friend edges, but adds no entitlement to locked results. A supplied bearer token is verified; invalid tokens receive 401 rather than anonymous fallback. The backend derives the viewer ID from verified Supabase auth, never from a query string. Protected SQL functions only allow the Worker service role. All JSON fields are re-validated and re-projected in the Worker to guard accidental schema expansion.

## UI behavior

The approved Obsidian Arcade styling is reused for the scoreboard's game and puzzle selectors, segmented friend/global view, locked-state spoiler shield, mobile-safe ranking list, pagination, player cards, and accessible loading/retry/empty states. Players may view **visible** performance on public profile pages and compare head-to-head from Friends. Fake mockup podiums, an all-game score, and friend-approval requests are intentionally omitted; public profile source attributes (email, raw shares, latest private activity, unreleased achievements) stay private.

## Testing, limits and rollout

The dedicated Phase 10 source PR covers anonymous and two/three-player SQL checks on two isolated PostgreSQL 17 databases; Worker DTO/invalid-token/IDOR/no-store tests; TypeScript, ESLint, Prettier, build, API/PWA smoke; and Chromium viewport checks (320/393/1024). **Real device Safari/QR permission and authenticated production tests remain unverified** until the relevant hosted deployment is approved and performed.

Phase 10's forward-only schema migration was authorized during release reconciliation and applied to hosted Daydle Preview at the exact Supabase version `20261117075359_phase10_comparisons`. Post-apply read-only checks confirmed five public comparison RPCs with service-role-only execution grants and unchanged existing security-advisor findings. Phase 9's protected production release [#44040112648](https://github.com/A13Xg/Daydle/actions/runs/44040112648) is verified. Source PR #18 is still unmerged; Phase 10 Worker/UI code is not deployed. Hosted authenticated comparison E2E remains unverified, and physical iPhone testing remains owner-deferred. The 90-day raw-submission purge and backups remain separately scheduled.
