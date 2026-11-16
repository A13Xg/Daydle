# Phase 4 Execution Plan — Game catalog, selection, and discovery

**State:** VERIFIED / IN REVIEW · **Base:** `main` at `d4644ceb4a5bc8e41258d40eefd30f118c2e425d` · **Branch:** `phase/04-game-catalog` · **Draft PR:** [#5](https://github.com/A13Xg/Daydle/pull/5).

## Preflight

Verified latest main at `d4644ce`, Phases 0–3 COMPLETE, prior PR #3 merged, passing main CI, no open PRs, the deployed production Worker remains untouched. Existing PostgreSQL tables: `games`, `game_categories`, `game_category_links`, `user_games`; profiles and Google/Apple-only auth are in place. Existing RLS allows catalog public SELECT and direct owner selection DML. No catalog seed or UI. Future parser work is Phase 6, Today/PWA is Phase 5. No new credentials or user inputs required for implementation and isolated tests; remote production migration/deploy must remain manual and approved.

## Product and scope

- Curated **12 distinct external daily games** spanning word, connections, geography, numbers, movies, and crosswords. Store publisher URLs/attribution in canonical tables (never embed games, scrape accounts, or assume universal share support). Sources referenced in [docs/catalog.md](../docs/catalog.md).
- Seed stable slug + deterministic UUID identity, category associations, existing schedule/cadence fields. **All games remain `parser_status=unsupported`** until actual Phase 6 fixtures/parsers exist. An externally playable game is not a parseable Daydle game. Some games may require publisher subscriptions.
- Add explicit `link_status` (`verified`, `unverified`, `broken`) and `link_checked_at`; show broken/retired links as unavailable and display last verification status honestly. Metadata does not imply live monitoring.
- Public `/games` with search (game/publisher/description), category, parser support, active status; show sensible empty states, data-loading/error/retry; structured public `/games/:slug` detail with publisher information and safe external launch link; keyboard-accessible controls and responsive mobile behavior. Do not turn all unsupported games into fake working parser claims.
- Signed-in account: `My games` selects/unselects and reorders favorites; persisted through Supabase transaction. Signed-out visitors can browse and are prompted to sign in before saving. Retired games already selected are retained visibly as unavailable. Disallow new additions of broken/retired games.
- Admin authorization at **Supabase RPC/domain layer**, not a new privileged Worker secret: narrowly scoped definer functions check `auth.uid()` in `app_private.admin_members` for catalog upsert, categories and retirement. Never expose admin membership or allow users to mutate catalog via grants.
- Migration forward-only; preserve existing IDs/results when games retire, and do not rewrite Phase 2 or 3 migrations. No remote database write during this PR.
- Do not implement game parsers, result submission, Today, installable PWA/service worker, social features, full admin UI, or final visual styling.

## Data/authorization design

1. `supabase/migrations/20261115040000_phase4_catalog.sql` seeds 12 games and categories with deterministic UUIDs and `ON CONFLICT (slug)` updates **metadata only**, preserving canonical IDs; category links resolve existing game IDs by slug. Checks safe external HTTPS URL formatting (no credentials, private/local hosts) via a restricted `app_private.safe_publisher_url(text)` helper. Add `games.link_status`, `games.link_checked_at` metadata and DB checks for safe launch URLs. Existing historical game foreign keys remain RESTRICT.
2. `public.admin_upsert_game(...)`, `public.admin_set_game_categories(...)`, and `public.admin_retire_game(...)` are authenticated RPC calls with membership check, explicit grants and restricted `search_path`. Admin upsert cannot change stable game slug/UUID and cannot claim supported parsers without a deployed verified parser. No user-authenticated direct `games` grants.
3. `public.set_my_games(uuid[])` uses one atomic transaction and an advisory lock keyed to auth.uid. Validate <=100 unique IDs, valid active/not-broken additions; keep already-selected retired games if client submits unchanged; delete deselections and upsert zero-based positions atomically. Revoke direct `user_games` mutation grants from `authenticated`, forcing the transaction API. Tests check concurrent/invalid inputs and no access to another user's selections.
4. Expose existing public catalog tables through Supabase's RLS-protected read client; no Worker service-role secrets. Cache only nonprivate public metadata within React session, never stale sensitive data across sign-out.

## Implementation files

- SQL migration above; add `tests/sql/catalog-assertions.sql` and `scripts/test-db.sh` invocation for two fresh PG17 databases after prior fixtures. Test SQL injection-shaped metadata, invalid URL, duplicate slugs, stable UUID, RLS, admin/nonadmin RPC, atomic selection and ordering, invalid/duplicate/retired IDs.
- `shared/catalog.ts`: typed catalog contracts, filtering/search normalization, canonical HTTPS outbound validation and labels.
- `src/lib/catalog-api.ts`: server-backed Supabase queries and RPC selection mutation with exact model validation, no bypass.
- `src/components/CatalogPage.tsx`, `src/components/GameDetailPage.tsx` and any small presentational components: public catalog and detail, signed-in persistence, loading/error/disabled/retry/offline messaging.
- `src/App.tsx`, `src/styles.css` and auth route navigation: `/games` and `/games/:slug` without replacing existing working OAuth and account behavior.
- `tests/catalog.test.ts`, `tests/catalog-api.test.ts`, `tests/catalog-ui.test.ts`, `scripts/smoke.mjs`: filter, URL/mapping, API mocks, UI smoke and SPA direct-link coverage.
- `docs/catalog.md`, `README.md`, `AGENTS.md` as needed: seed sources, operator link-verification policy, RPC access rules, deployment/order, rollback and known uncertainties.

## Execution sequence

1. Commit this reviewed plan; preserve active draft PR.
2. Implement forward SQL migration, apply in PG17 CI, negative auth/admin/transaction assertions.
3. Implement shared catalog contracts, Supabase read/write adapters and tests.
4. Implement accessible mobile-first UI and detail routes with all state branches and safe link handling.
5. Update smoke tests, docs and baseline instructions; run `npm ci`, typecheck, lint, format, tests, build, preview HTTP smoke and two clean DB schema passes through CI.
6. Review entire PR diff for RLS/definer/search_path, URL validation, disclosure and account switching, unavailable links, async/race safety, responsive/a11y behavior, schema compatibility and docs consistency. Fix and rerun tests.
7. Record observed results. Archive `Phase4Exec.md` in `completedPhases/Phase4Exec.md`, update roadmap branch to IN REVIEW and convert PR ready **only** if material acceptance gates pass. Do not merge, trigger production deployment, apply remote migration or start Phase 5.

## Acceptance matrix

- [x] 12 linkable catalog entries and categories seeded in both clean databases with stable IDs/slugs, without claiming parser support.
- [x] URLs validated at DB and browser; new-tab links use `rel=noopener noreferrer`; broken/retired games cannot be newly selected or launched.
- [x] Public browse/detail, search/category/filter, signed-in add/remove/reorder with honest loading/error/empty states.
- [x] Selection updates persist through mock and transactional DB API tests, no stale cross-user display on auth change.
- [x] Anon/nonadmin cannot mutate catalog and cannot alter other users' games; authenticated admin's scoped RPC and own selected games work.
- [x] Existing auth flows, Worker health, RLS, PostgreSQL fixture and frontend CI remain green.
- [x] No real production preview/deployment or secret use; no code attribution or unreviewed rollout.

## Risks and self-review

- Existing production is live without a separate preview; **do not use it as the testing database**. Postgres CI and mock SDK tests are sufficient to request a code review; *live post-merge* verification requires an authorized migration/deploy and owner-controlled production release job.
- Outbound link freshness cannot be promised without an external link-monitoring service. Store verified/unverified/broken states as manually maintained metadata; do not automatically claim `open now` or live validity.
- User favorites are publicly visible by product decision; do not display private auth email or friend code here.
- Protect all SECURITY DEFINER functions by `SET search_path=''`, fully qualified names, `REVOKE EXECUTE FROM PUBLIC`, explicit grants, and a signed-in admin roster check. Keep catalog/admin schema migration separate from future admin UI.
- A successful save response must mean the DB accepted the **entire ordered list**; do not mutate UI state prematurely or silently lose selections after fast repeated actions.
- Preserve existing provider OAuth-only decision; do not accidentally reopen password/signup.
- Source citations and publisher link verification are catalog *metadata provenance*, not vendor attribution or endorsements.

## Executed results

**Phase branch:** `phase/04-game-catalog` · **PR:** [#5](https://github.com/A13Xg/Daydle/pull/5) · **Review state:** ready for human review, not merged or deployed.

### Implemented

- Forward SQL migration `20261115040000_phase4_catalog.sql` adds 12 curated publisher destinations, six categories, stable game IDs and slug links, explicit `link_status` metadata and no false parser-support claims.
- DB-safe HTTPS URL checks, existing historical game-ID preservation, retired/broken availability handling.
- Protected `admin_save_game`, `admin_set_game_categories` and `admin_retire_game` functions with an internal administrative-membership check and no open catalog write grants.
- Atomic `set_my_games(uuid[])` stores an owner's ordered favorites with bounded valid input, single transaction and per-account advisory lock; direct user_games DML was revoked from browser roles.
- Typed shared catalog search/filter/URL validator and Supabase API adapter. React `/games` and `/games/:slug` routes include public discovery, search, category/support/archived filters, game detail, publisher links, signed-in add/remove/reorder, no-account and error/empty/loading/disabled/retry states.
- Archived/broken favorites remain visible with honest availability labels. External links use safe new-tab `rel="noopener noreferrer"` and don't embed third-party games. Existing OAuth-only auth behavior preserved.
- Added catalog data/permission documentation, README discoverability and catalog-specific AGENTS.md baseline.

### Verification evidence

**Final nonmutating CI run:** https://github.com/A13Xg/Daydle/actions/runs/43782554508 — both jobs successful.

| Gate | Observed result |
|---|---|
| Locked install | `npm ci --no-audit --no-fund`: PASS |
| Strict TypeScript | `npm run typecheck`: PASS |
| Static lint | `npm run lint`: PASS |
| Formatting | `npm run format:check`: PASS (no source mutation) |
| Unit/contract/UI tests | `npm test`: **50 passing tests, 11 suites** |
| Production bundle | `npm run build`: PASS |
| Preview HTTP smoke | `npm run preview -- --port 4173` + `npm run smoke`: PASS, including `/games` and `/games/wordle` SPA deep links |
| PostgreSQL migration replay | `bash scripts/test-db.sh`: PASS on two independent fresh PostgreSQL 17 databases |
| SQL catalog assertions | PASS — 12 seeds, safe URL, parser unsupported, admin/nonadmin authorization, canonical slug stability, ordered favorites, invalid/duplicate atomic rejection |
| Source/security review | PR patch reviewed: no committed secrets, unsafe HTML injection, dynamic evaluation, unapproved deploy commands, non-owner contributor credit |

### Defects discovered and corrected

- Existing Phase 2 fixtures collided with newly seeded game/category rows: updated fixture identities and idempotent category linking without touching deployed migrations.
- Initial PL/pgSQL selection RPC required `COALESCE` as a SQL expression and an explicitly named primary-key conflict target; fixed and reran both databases.
- Added a pre-parse control-character block after a unit test caught WHATWG URL normalization stripping newlines.
- Normalized all new source through Prettier; removed temporary formatting-in-CI helper so final CI validates immutable committed source.
- Made retired or broken previously saved games visibly unavailable while preserving their selection.

### Boundaries and remaining verification

- Production Daydle is live on Phases 0–3, but **no Phase 4 migration was applied to hosted Supabase** and no Cloudflare deployment was performed. New schema must be reviewed and deployed *before* any corresponding app deployment, via the user's existing manual authorized release process.
- Public catalog is verified through type checks, mocked Supabase adapter tests, SSR UI assertions, HTTP SPA route smoke and true PostgreSQL authorization/selection tests. An end-to-end authenticated **hosted** add/remove/reorder flow and real iPhone browser visit were NOT VERIFIED and must be checked at the separately authorized production or staging rollout. Do not represent local CI as proof of external publisher sites' uptime or OAuth-integrated persistence.
- Publisher URLs are sourced from current game/publisher references, but all are deliberately labeled `unverified` until a real application launch/link check is performed. Games may require a subscription; **all 12 parsers remain unsupported** until Phase 6.
- Admin UI is intentionally deferred to Phase 11, Today/PWA to Phase 5, result submission/parsers to Phases 6–7.

### Review and rollback

- Review PR #5; no auto-merge. Branch roadmap says IN REVIEW while main must remain NOT STARTED until a verified reviewed merge and status reconciliation.
- No hosted schema or production data was changed. Revert/decline branch before merge; once a migration has been deployed, use an audited forward migration rather than rewriting applied migration history.


### Supplemental review: operational suggestions from PR #6

- Audited [PR #6](https://github.com/A13Xg/Daydle/pull/6) and its feedback. The original `apikey: ***` regression claim was rejected: `main` already sends the configured public key; testing a literal redaction placeholder does not prove failure.
- Rechecked `*/6` scheduling across months: maximum gap was six days, so no calendar bug. A daily cadence gives additional resilience to delayed or missed GitHub runs.
- Added and tested the isolated read-only keep-alive request, synthetic local HTTP-stub contract checks, and runbook updates on PR #5. Live default-branch dispatch remains a separately documented post-merge validation, not an implied completed run.

### Supplemental review hardening — PR #5 feedback

Four substantive review findings were accepted and corrected:

1. `UPDATE(sort_order)` column-level permission from Phase 2 survived table-level REVOKE. The Phase 4 migration now explicitly revokes the column grant; SQL tests reject any direct authenticated favorites UPDATE.
2. A rejected RPC response did not establish rollback. The client now reloads the server's canonical favorite list after an unconfirmed save; on a second read failure, selection editing is disabled until a successful retry. UI messaging no longer falsely claims previous state was preserved.
3. The direct `/games/:slug` page now exposes selected-game loading/errors and an accessible retry action when favorites cannot be loaded.
4. Administrator category replacement locks the parent game row. A real two-session concurrency test starts with no links, overlaps two admin replacements, and verifies that only the final ordered replacement survives.

**Regression evidence:** [GitHub Actions run 43785315498](https://github.com/A13Xg/Daydle/actions/runs/43785315498) — 60 Vitest tests (12 suites), typecheck/lint/format/build/smoke successful; PostgreSQL 17 schema/RLS and two-session category race passed against **both** disposable databases. No hosted migration or Worker deployment occurred.

PR #6's unsupported API-key defect claim remains rejected. Corrected operational improvements were implemented directly on PR #5; PR #6 may be closed without merging. The next manual keep-alive dispatch on `main` remains unverified pending reviewed merge.
