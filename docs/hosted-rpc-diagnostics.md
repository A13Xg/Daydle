# Hosted Supabase RPC failure diagnostic hotfix

**Status:** IMPLEMENTED — source only, awaiting CI and owner review
**Branch:** `hotfix/supabase-rpc-diagnostics`
**Base:** `main` at `86e2a02d21b5b34edbcff71e03fa90e156158160`
**Incident:** Protected production deployment [#44033293206](https://github.com/A13Xg/Daydle/actions/runs/44033293206) uploaded the Cloudflare Worker but failed the public profile smoke test: `result_service_unavailable` (HTTP 503). Both pre/post deploy secret-metadata checks and all seven migrations passed; the actual upstream Supabase error is currently swallowed.

**Scope:** Instrument `worker/results.ts` privileged `rpc()` to log **only** a fixed event name, sanitized internal RPC function name, numeric upstream HTTP status, and allowlisted PostgREST/SQLSTATE error code; preserve HTTP response contracts, existing special handling of `result_rate_limited`, and fail-closed semantics. Never include request body, raw provider response, keys, authorization headers, UUIDs, or arbitrary error messages. Add no diagnostic endpoint or browser-facing metadata.

**Verification:** Add worker unit tests for safe logging, invalid/malicious upstream payload redaction, failure responses, 400 rate-limit compatibility, network failure safety, and success silent path. Run GitHub CI: typecheck, lint, formatting, Vitest, build, PWA/Chromium smoke and two isolated PG17 databases.

**Rollout:** Create PR; no automatic merge or production deployment. After owner merges it and explicitly triggers protected Deploy Worker, the deployed Worker console logs will provide `httpStatus` and `postgrestCode` when the smoke test reaches the public player RPC. The failed job's existing logs cannot retroactively reveal these fields. Cloudflare observability must be enabled to inspect logs. If deployment fails earlier, reassess rather than rotating secrets blindly.

## Logging contract

On a non-rate-limited, non-successful privileged RPC response, emit only:

```
console.error("supabase_rpc_failure", {
  rpc: "social_public_profile",
  httpStatus: 403,
  postgrestCode: "42501",
});
```

The example numbers are illustrative and **not** observed live. Accept only SQLSTATE (five uppercase alphanumeric characters) or PostgREST `PGRST###` identifiers; anything else becomes `null`. Non-JSON errors also produce `null`. Network/JSON decoding failures use `supabase_rpc_transport_failure` and only a sanitized RPC name; no exception text.

Existing public API response contracts remain `{ "error": "result_service_unavailable" }` with HTTP 503, and the special 400 `result_rate_limited` mapping remains 429.

## After the separately approved protected deployment

1. Confirm the production Worker has observability/real-time logs enabled; enabling logging is an explicit Cloudflare configuration action and is **not** performed by this PR.
2. Request `https://daydle.agoodman.io/api/v1/players/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee` (a fixed nonexistent test UUID; no account data).
3. Inspect Cloudflare Worker `daydle-app` **Observability / Real-time Logs** for `supabase_rpc_failure` or `supabase_rpc_transport_failure`. Extract only `rpc`, `httpStatus`, `postgrestCode`. Use that to distinguish credentials, schema exposure/grants or upstream connectivity. No JWT/key/message/raw data is printed or necessary to troubleshoot.
4. Do **not** misinterpret pre/post deployment secret-metadata success as proof the encrypted service-role JWT is correct for the project.
