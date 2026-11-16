# Phase 4 Execution Plan — Game catalog, selection, and discovery

**State:** REVIEWED / IMPLEMENTATION IN PROGRESS · **Base:** `main` at `d4644ceb4a5bc8e41258d40eefd30f118c2e425d` · **Branch:** `phase/04-game-catalog` · **Draft PR:** [#5](https://github.com/A13Xg/Daydle/pull/5).

## Preflight

Verified latest main at `d4644ce`, Phases 0–3 COMPLETE, prior PR #3 merged, passing main CI, no open PRs, the deployed production Worker remains untouched. Existing PostgreSQL tables: `games`, `game_categories`, `game_category_links`, `user_games`; profiles and Google/Apple-only auth are in place. Existing RLS allows catalog public SELECT and direct owner selection DML. No catalog seed or UI. Future parser work is Phase 6, Today/PWA is Phase 5. No new credentials or user inputs required for implementation and isolated tests; remote production migration/deploy must remain manual and approved.

## Product and scope

- Curated **12 distinct external daily games** spanning word, connections, geography, numbers, movies, and crosswords. Store publisher URLs/attribution in canonical tables (never embed games, scrape accounts, or assume universal share support). Sources referenced in [docs/catalog.md](docs/catalog.md).
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

- [ ] 12 linkable catalog entries and categories seeded in both clean databases with stable IDs/slugs, without claiming parser support.
- [ ] URLs validated at DB and browser; new-tab links use `rel=noopener noreferrer`; broken/retired games cannot be newly selected or launched.
- [ ] Public browse/detail, search/category/filter, signed-in add/remove/reorder with honest loading/error/empty states.
- [ ] Selection updates persist through mock and transactional DB API tests, no stale cross-user display on auth change.
- [ ] Anon/nonadmin cannot mutate catalog and cannot alter other users' games; authenticated admin's scoped RPC and own selected games work.
- [ ] Existing auth flows, Worker health, RLS, PostgreSQL fixture and frontend CI remain green.
- [ ] No real production preview/deployment or secret use; no code attribution or unreviewed rollout.

## Risks and self-review

- Existing production is live without a separate preview; **do not use it as the testing database**. Postgres CI and mock SDK tests are sufficient to request a code review; *live post-merge* verification requires an authorized migration/deploy and owner-controlled production release job.
- Outbound link freshness cannot be promised without an external link-monitoring service. Store verified/unverified/broken states as manually maintained metadata; do not automatically claim `open now` or live validity.
- User favorites are publicly visible by product decision; do not display private auth email or friend code here.
- Protect all SECURITY DEFINER functions by `SET search_path=''`, fully qualified names, `REVOKE EXECUTE FROM PUBLIC`, explicit grants, and a signed-in admin roster check. Keep catalog/admin schema migration separate from future admin UI.
- A successful save response must mean the DB accepted the **entire ordered list**; do not mutate UI state prematurely or silently lose selections after fast repeated actions.
- Preserve existing provider OAuth-only decision; do not accidentally reopen password/signup.
- Source citations and publisher link verification are catalog *metadata provenance*, not vendor attribution or endorsements.

## Executed results

**Pending.** Record actual commands, CI links, audit fixes, remaining external verification, and branch/PR state before archival.
