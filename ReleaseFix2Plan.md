# Phase 5 production release — structured migration-history correction

**Status:** IMPLEMENTED / CI VERIFIED — REVIEW PENDING · **Branch:** `fix/phase5-structured-migration-history` · **Base:** `bd78ea03cc67ad43734bc72212667429f1605530` · **Latest failed run:** [43812374685](https://github.com/A13Xg/Daydle/actions/runs/43812374685).

## Verified root cause

The `main` release failed before any remote SQL/deploy because the CLI-table parser reported `Migration report did not contain exactly four expected local versions.` That is a **false negative**: directly querying the connected Supabase project confirms exactly `20261114050000` (Phase 2) and `20261114060000` (Phase 3) are recorded as applied. The actual database has all 18 Phase 2 tables with RLS, and none of the Phase 4 catalog objects or Phase 5 manual-marker table. Do NOT repair Phase 2/3 migration metadata or replay those migrations.

## Planned fix

1. Stop parsing the human-formatted `supabase migration list` table for production authorization; replace with structured read-only history from the officially documented Management API `GET /v1/projects/{ref}/database/migrations` (requires `database_migrations_read` scope).
2. Compare the returned migration objects against the four exact local filenames and their versions, detect unknown/duplicate/out-of-order/partial versions and refuse to deploy unless baseline 2/3 already applied. Never mutate migration history automatically.
3. Run this check both before dry run and after applying Phase 4/5; fail closed on unavailable/malformed API output, 401/403, remote mismatch, or post-apply pending migrations.
4. Retain `main`-only manual workflow, GitHub protected `production` approval, `supabase link`, `db push --linked --dry-run`, `db push --linked --yes`, Cloudflare deployment and live health/PWA smoke checks.
5. Unit tests for exact two recorded baseline entries, fully applied, duplicates, extra records, unknown/nonmatching names, network/scope failures, and security-safe logs.
6. Update `roadmap.md`, release docs and phase incident plan to reflect two failed runs and the actual remote history.
7. Run immutable frontend CI and two disposable PostgreSQL 17 databases; inspect patch, then mark PR ready. No direct production writes or unauthorized merge/dispatch.

**Current live status:** Supabase Phases 2/3 recorded. Phases 4/5 not applied. Worker has not been redeployed by either failed run.

## Direct production verification (read-only)

Connected Supabase project: `Daydle Preview`, ref `xyjuriehmrkdqdmcxdso`, the same ref the protected workflow used. `list_migrations` and read-only SQL against `supabase_migrations.schema_migrations` both returned **exactly**:
- `20261114050000` — `phase2_domain_security`
- `20261114060000` — `phase3_auth_identity`

The project exposes 18 Phase 2 RLS-enabled tables; the Phase 4 `public.set_my_games(uuid[])` function and `public.games.link_status` column, and the Phase 5 `public.user_game_day_marks` table, were confirmed **absent**. The second failed run used a parser expecting four local migration-table rows, but its CLI output was never preserved in logs. Its exact text-layout mismatch is unknown; the fact that the database is correctly migrated to Phase 3 is verified independently.

## Implementation

- Added `scripts/ops/check-hosted-migrations.mjs`, calling the documented `GET /v1/projects/{ref}/database/migrations` endpoint with the protected `SUPABASE_ACCESS_TOKEN`. It verifies four reviewed local SQL files and a contiguous, strictly versioned applied prefix, and compares names when present.
- The protected release workflow now calls the structured check **before** `supabase db push --linked --dry-run` and **after** the approved `--yes` push with `--require-all-applied`. Removed human-formatted CLI history parsing and optional migration metadata repair from the deployment path entirely.
- Authorization requirement: the production Supabase token must have **`database_migrations_read`** permission. HTTP 401/403 and malformed/unavailable structured API data fail closed with an actionable message. Do not create additional history entries or bypass scope validation.
- No production writes were made from this PR. No changes to provider authentication or stored game data.

## Verification and disposition

[Final immutable CI run 43813640712](https://github.com/A13Xg/Daydle/actions/runs/43813640712) passed **both jobs**: 108 tests / 22 suites, strict TypeScript, ESLint, Prettier, Worker/Vite build, PWA HTTP smoke and two clean PostgreSQL 17 security databases (including Phase 2/3 schema probes). The connected production Supabase baseline was read directly and contains exactly Phase 2 and Phase 3 migration records; this production read was **not** part of PR CI. No release dispatch or hosted SQL/Worker changes occurred. The live release still requires owner-reviewed merge and a fresh protected GitHub Actions dispatch from `main`; real iPhone testing remains open until that run succeeds.
