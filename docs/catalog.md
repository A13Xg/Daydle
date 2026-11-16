# Game catalog — Phase 4

## Overview

Daydle is a directory and stats layer, **not** the publisher of the external daily games. Games open on the publisher's website in a new tab or other context permitted by the browser. The catalog must not embed a third-party game in an unsupported iframe or imply that third-party result text is currently parsable.

The migration `supabase/migrations/20261115040000_phase4_catalog.sql` adds link availability metadata, 12 curated games and categories, admin-only catalog RPCs, and one transaction-safe favorites RPC.

**All seed games have `parser_status=unsupported`.** A later Phase 6 parser + fixtures is required to mark a game as supported. Link status is `unverified` by default, because web-source evidence is not a successful Daydle interactive publisher play-test.

## Seed list and source references

| Game | Publisher | Canonical URL | Categories |
|---|---|---|---|
| Wordle | The New York Times | https://www.nytimes.com/games/wordle/index.html | Words |
| Connections | The New York Times | https://www.nytimes.com/games/connections | Connections, Words |
| Strands | The New York Times | https://www.nytimes.com/games/strands | Words |
| Spelling Bee | The New York Times | https://www.nytimes.com/puzzles/spelling-bee | Words |
| The Mini | The New York Times | https://www.nytimes.com/crosswords/game/mini | Crosswords, Words |
| Quordle | Merriam-Webster | https://www.merriam-webster.com/games/quordle/ | Words |
| Worldle | Teuteuf Games | https://worldle.teuteuf.fr/ | Geography |
| Flagle | Teuteuf Games | https://www.flagle.io/ | Geography |
| Globle | Trainwreck Labs | https://globle-game.com/ | Geography |
| Nerdle | Nerdle | https://nerdlegame.com/ | Numbers |
| Waffle | Waffle Studio | https://wafflegame.net/ | Words |
| Framed | Framed | https://framed.wtf/ | Movies |

Publisher references are grounded in the [New York Times Games collection](https://www.nytco.com/games/), [Merriam-Webster Quordle](https://www.merriam-webster.com/games/quordle/), [Worldle FAQ](https://worldle.teuteuf.fr/faq/), [Flagle FAQ](https://www.flagle.io/faq), [Globle](https://globle-game.com/), [Nerdle](https://nerdlegame.com/), [Waffle](https://wafflegame.net/) and [Framed](https://framed.wtf/) publisher sites. Exact third-party URLs can change. NYT destination pages may require JS, login or subscription. Link verification/availability is separate from parser support; do not imply guaranteed publisher availability or free access.

## Catalog identity and data safety

- `games.id` and `games.slug` are immutable once assigned. Seed URLs and categories are canonical external references; duplicate slug inserts are ignored, not reassigned.
- Existing historical puzzle/result relations remain delete-restricted. Retire by changing `games.status` to `retired`, rather than deleting rows.
- `link_status` is `unverified`, `verified`, or `broken`; `link_checked_at` is required for verified/broken. Only an authorized administrator should update these via `public.admin_save_game`. There is no automated background link checker.
- Browser code parses publisher URLs with `URL`; accepts external HTTPS hostnames only, no embedded credentials, IP addresses or localhost. Database constraints independently reject malformed publisher/icon URLs.
- Every external link uses `target="_blank"` and `rel="noopener noreferrer"`; inactive, broken and retired links are disabled by the UI, including on direct detail-page visits.

## Data access and mutation

- Public: `games`, `game_categories`, `game_category_links` SELECT through Supabase RLS. No credentials required to browse a live configured catalog.
- The signed-in owner reads `user_games` in the previously configured RLS model. Selected game names are public by product requirement; auth emails and friend codes are not part of the catalog.
- All add/remove/reorder requests use `public.set_my_games(p_game_ids uuid[])`: a bounded 100-ID unique ordered array, transactionally delete/insert/update, with per-user lock and exact return order. The authenticated role no longer has direct `user_games` DML privileges.
- **Review hardening:** the Phase 2 column-level `UPDATE(sort_order)` grant is explicitly revoked, not just table-level DML. SQL role tests include a direct-update rejection and any-column privilege check. A rejected RPC response may follow a committed write, so the browser fetches the authoritative selection; if that read fails, further edits are blocked until reload succeeds.
- Admin category replacement takes a row lock on the parent game even if no categories exist yet. CI verifies two concurrent replacement calls cannot leave the union of their requested lists.
- `public.admin_save_game`, `public.admin_set_game_categories` and `public.admin_retire_game` are authenticated RPCs with private administrator membership authorization. Their grants permit callers to invoke the RPC but do not confer permission to mutate a catalog row without the admin check.
- The full admin dashboard is Phase 11; Phase 4 only establishes its domain operations. Do not add privileged service-role Worker keys to enable them.
- Supabase browser client must never act on a cached previous user's selection following auth changes. The catalog page is keyed by authenticated user identity and reloads on account transition.

## Preview/testing and future release

- `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` and `npm run smoke` are required.
- `scripts/test-db.sh` replays all migrations and fixtures against **two disposable PostgreSQL 17 databases**, tests RLS, admin authorization, uniqueness, favorites atomicity and unsafe URLs. Never point this at a live project.
- Production currently runs Phases 0–3. Completing Phase 4 code and merging its PR **does not automatically deploy the new schema**. Actual migration and manual deployment must be authorized, and schema must precede application code. Don't expose new routes on a live site before the migration is applied.
- Rollback: predeploy, close/revert branch. After a hosted schema migration, use a separately reviewed forward migration and deployment compatibility plan; do not edit previously deployed migration files.
