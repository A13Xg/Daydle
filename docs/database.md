# Database foundation — Phase 2

## Sources and migration

- Canonical migration: `supabase/migrations/20261114050000_phase2_domain_security.sql`.
- Apply only in an explicitly authorized Supabase environment using the Supabase CLI migration workflow; do not run the test bootstrap on hosted Supabase.
- Local integration tests use real PostgreSQL 17, an isolated `auth.users` stand-in, `auth.uid()` JWT claim stub, and simulated `anon`, `authenticated`, and `service_role` roles. They do not claim to reproduce all Supabase infrastructure or OAuth behavior.
- Run `PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres PGPASSWORD=<test-only-password> bash scripts/test-db.sh` with PostgreSQL 17 and the `psql`/createdb/dropdb client binaries. The script creates and removes two uniquely named disposable test databases. Never point it at your production database server.
- CI uses a dedicated PostgreSQL service and performs two independent clean schema replays with role-based negative/positive assertions.

## Domain identity

- `auth.users` contains email/credential identity. `public.profiles` is safe public metadata only. `public.friend_codes` is a separate owner-readable identity lookup, resolved by a future rate-limited service endpoint.
- `public.games` and `public.game_categories` define catalog metadata independent of parser implementations. `public.user_games` records optional personal selections.
- `public.puzzles` has a stable, game-scoped `puzzle_key`, optional puzzle date, publication timestamp, and nullable **verified** next-reset timestamp. A puzzle may have no date; a game may have multiple puzzles on the same day.
- `public.game_results` has a database unique constraint on (user,puzzle), composite puzzle/game FK, validated common metrics, and opaque per-game metrics. Unsupported games have no canonical results until verified parsing support.
- `public.raw_submissions` preserves private share text and diagnostics with expiration bounded by the 90-day constraint. `public.result_corrections` is private provenance and never a public source of unrestricted manual scores.
- Friendships are unordered (lower UUID first); blocking is directional. Neither relationship changes public profile/result visibility.
- Achievements have a source puzzle and explicit publication timestamp so public awards cannot bypass spoiler rules. Suggestions are moderated; votes are unique per person.

## Role and RLS threat model

- Anonymous and signed-in users can read public profiles, games/categories, selected games, puzzles and nonrejected suggestions.
- Users can update only their own display name/avatar and their own game selections. These grants are column-limited and backed by RLS.
- Friend codes are readable only by their owner. Friends and blocks are readable only by participants/owners; server mutation endpoints are deferred.
- Canonical results are **server-only writable**. A viewer can read a user's score only if the viewer is that user, the viewer has a saved result for the same puzzle, or the publisher's NEXT reset has been explicitly verified and passed.
- Anonymous visitors never qualify via result submission; prior verified-reset results are visible to them. Unverified resets remain hidden even after a calendar change.
- Achievements cannot expose a source-puzzle award to others before the result itself is revealable and the award's own visible_after timestamp has passed.
- Raw share data, corrections, and administrative membership/events have no user SELECT grant or RLS policy and must never appear in public API projections.
- The spoiler helper is `SECURITY DEFINER` owned by the database migration owner, with fully qualified names, no ambient `search_path`, and a narrowly scoped boolean return. This avoids RLS recursion while retaining server-enforced visibility. Audit it when changing result or puzzle semantics.
- The `service_role` can bypass RLS. Never place a Supabase secret key into `VITE_*`, source code, a browser bundle or unsecured client request. Future Worker APIs must authenticate and authorize before privileged queries.

## Retention, migrations and recovery

- `raw_submissions.expires_at` cannot exceed `received_at + 90 days`. `app_private.purge_expired_raw_submissions()` removes expired raw rows but leaves canonical results. Only server/service roles may execute it.
- **Scheduling is not yet implemented**. Phase 12 must install and verify a periodic cleanup job before any production raw-share retention is enabled.
- Account deletion cascades via foreign keys; result deletion removes linked raw text and corrections. Backups must apply retention/deletion cleanup when restored.
- Database migrations are immutable after merge. Use a new forward migration for schema evolution; never rewrite previously deployed SQL. For an erroneous migration, use audited follow-up correction, not an unsafe blind down migration.
- There are no Phase 2 hosted database changes, Supabase project provisions, deployed secrets or production writes. External environments require separate authorization.
