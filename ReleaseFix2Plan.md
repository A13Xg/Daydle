# Phase 5 production release — structured migration-history correction

**Status:** PLANNING · **Branch:** `fix/phase5-structured-migration-history` · **Base:** `bd78ea03cc67ad43734bc72212667429f1605530` · **Latest failed run:** [43812374685](https://github.com/A13Xg/Daydle/actions/runs/43812374685).

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
