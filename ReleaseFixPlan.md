# Phase 5 production release failure — November 16, 2026

**Branch:** `fix/phase5-migration-history` · **Base:** `main` @ `75039ac1e716cfce8b74acf30bc1c0b50673fa5d` (PR #7 merged).

## Failure evidence

- [Run 43810002170](https://github.com/A13Xg/Daydle/actions/runs/43810002170) failed in `Link and check remote migration history`.
- Repo install, tests, credentials validation, Supabase CLI setup and `supabase link` all passed.
- `supabase migration list --linked` connected, but `verify-migration-plan.mjs` returned `Production Phase 2/3 baseline is missing or migration history diverged.`
- The workflow did **not** reach dry-run migration push, SQL application, Cloudflare deployment or hosted PWA verification.

## Repair contract

1. Do not weaken the allowlist to permit unknown migration history or assume Phase 2/3 actually applied because an operator said so.
2. Report **version-only** migration state in sanitized CI logs, with explicit failure reason.
3. If Phase 2/3 have no migration-history entries, perform a **read-only** remote catalog/trigger/RLS verification first. Only if all inspected Phase 2/3 signatures exist, and later migration objects are absent, mark precisely those already-applied baseline versions as recorded using Supabase `migration repair` (history only).
4. If checks fail or API scopes are insufficient, halt with no migration-history edits, SQL changes or Worker deploy; do not guess.
5. Re-read migration list, require a consistent baseline and exact 4-version allowlist, then dry run, deploy Phase 4 then Phase 5, verify before Worker deploy.
6. Test successful and failure outcomes without touching actual production. Keep GitHub protected `production` deployment, main-only gate and user approval.
7. Do not merge this patch automatically. User merges and re-dispatches the protected workflow.

**Actual remote migration history:** NOT YET OBSERVED (the first run captured it in a temporary file but did not print sanitized version data).
