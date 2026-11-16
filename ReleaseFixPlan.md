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

## Implemented on PR #8

- Reworked the migration preflight to inspect exactly the four expected version rows, report **version identifiers only** (not database rows, provider responses, credentials, or private data), and reject unknown/out-of-order versions.
- Added a fixed read-only Supabase Management API schema probe checking 18 RLS-protected Phase 2 tables, 18 named policies, private functions, the Phase 3 onboarding column, all Phase 3 identity functions and the enabled `auth.users` trigger.
- If and only if those checks pass **and neither Phase 4 nor Phase 5 schema signatures exist**, use Supabase CLI `migration repair --status applied --linked` to record only missing Phase 2/3 versions. It repairs tracking metadata, **not the SQL schema**.
- Re-list migration versions and pass the strict allowlist again before the dry-run, approved Phase 4/5 SQL, and Worker deployment.
- Read-only verification endpoint: `POST /v1/projects/{ref}/database/query/read-only` requires the existing protected Supabase access token to have `database_read` scope. If denied, the release fails closed before history repair. CLI v2.117.0 remains pinned.
- Nine isolated new tests cover parsing, exact read-only API request, successful/partial repair, idempotence, out-of-sequence/unknown history, schema mismatch, token-scope denial and repair errors. Test fixtures contain no real project reference or credentials.

**Remote history reality:** The initial failed job did not retain or print the remote version list. Until the next protected run, missing historical entries are **one supported explanation, not a confirmed fact**. The repaired workflow will show sanitized version-only evidence and refuse unexpected conditions.

**Release limitations:** No authenticated hosted SQL probe, history repair, migration push or Cloudflare deploy can run in PR CI. The user must review/merge this patch and re-dispatch the protected production workflow. Preserve the live iPhone test gate after a successful deployment.

## Final local verification and review outcome

- **[CI run 43811905266](https://github.com/A13Xg/Daydle/actions/runs/43811905266): both `validate` and `database-security` PASS.**
- Locked install, strict TypeScript, lint, formatting, Vite/Worker build, Daydle PWA HTTP smoke: PASS.
- **98 tests / 21 Vitest suites passed.**
- Two isolated PostgreSQL 17 databases replayed Phase 2–5. Each executed the exact production read-only schema probe **both after Phase 3** (expected flags: `true,true,true,true,true,true,false,false`) and after Phase 5 (all true), and passed all existing role, RLS, concurrency and manual-marker assertions.
- PR review checked for committed credentials, dynamic code execution, unauthorized release on PR and misleading production success claims; none were found.
- **Live outcome remains NOT VERIFIED:** The protected workflow cannot be dispatched through this GitHub integration and fix PR #8 is unmerged. The operator must merge the reviewed PR, re-dispatch the main-only production release and approve the protected environment. Depending on actual remote version records it may verify the existing baseline immediately or repair metadata only if the strong read-only schema preconditions pass; any discrepancy stops.
- Keep this incident plan available until the production job succeeds. Do not mark Phase 5 deployed or ready for real iPhone testing based on CI alone.
