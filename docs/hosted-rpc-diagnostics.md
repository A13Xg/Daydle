# Hosted Supabase RPC failure diagnostic hotfix

**Status:** PLANNING — source only, no production change
**Branch:** `hotfix/supabase-rpc-diagnostics`
**Base:** `main` at `86e2a02d21b5b34edbcff71e03fa90e156158160`
**Incident:** Protected production deployment [#44033293206](https://github.com/A13Xg/Daydle/actions/runs/44033293206) uploaded the Cloudflare Worker but failed the public profile smoke test: `result_service_unavailable` (HTTP 503). Both pre/post deploy secret-metadata checks and all seven migrations passed; the actual upstream Supabase error is currently swallowed.

**Scope:** Instrument `worker/results.ts` privileged `rpc()` to log **only** a fixed event name, sanitized internal RPC function name, numeric upstream HTTP status, and allowlisted PostgREST/SQLSTATE error code; preserve HTTP response contracts, existing special handling of `result_rate_limited`, and fail-closed semantics. Never include request body, raw provider response, keys, authorization headers, UUIDs, or arbitrary error messages. Add no diagnostic endpoint or browser-facing metadata.

**Verification:** Add worker unit tests for safe logging, invalid/malicious upstream payload redaction, failure responses, 400 rate-limit compatibility, network failure safety, and success silent path. Run GitHub CI: typecheck, lint, formatting, Vitest, build, PWA/Chromium smoke and two isolated PG17 databases.

**Rollout:** Create PR; no automatic merge or production deployment. After owner merges it and explicitly triggers protected Deploy Worker, the deployed Worker console logs will provide `httpStatus` and `postgrestCode` when the smoke test reaches the public player RPC. The failed job's existing logs cannot retroactively reveal these fields. Cloudflare observability must be enabled to inspect logs. If deployment fails earlier, reassess rather than rotating secrets blindly.
