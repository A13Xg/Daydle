# Cloudflare Worker redirect compatibility hotfix

**Status:** PLANNING — no deployment
**Branch:** `hotfix/cloudflare-redirect-mode`
**Base:** `fd109095f5cdf53592ff1bf519a7a3e806ae8085`

## Evidence and root cause

Production Cloudflare Worker `daydle-app` generated `supabase_rpc_transport_failure` for `social_public_profile` while the encrypted service-role secret was present. The Worker uses `redirect: "error"` in both `authenticate()` and `rpc()`, but Cloudflare Workers does not implement `error` redirect mode and throws `TypeError` during Request construction (before a network call). Official Cloudflare source: https://developers.cloudflare.com/workers/runtime-apis/request/#constructor. This accounts for immediate transport errors without Supabase HTTP status.

## Fix scope

- Change only the two Supabase outbound fetches in `worker/results.ts` from `redirect: "error"` to `redirect: "manual"`, which Cloudflare supports.
- Keep fail-closed behavior: unexpected 3xx responses must be returned as safe 503 errors; do **not** use `follow`, which could forward privileged `apikey` and `Authorization` headers to another origin.
- Add regression tests asserting both fetches select `manual`, and that redirect responses do not trigger a second request or expose credentials.
- No changes to credential values, database schema, public API contract, Phase 10, UI, or production workflow.

## Acceptance

GitHub CI: typecheck, ESLint, Prettier, unit/API tests including redirect regression, build/preview/PWA and Chromium smoke, and two PG17 security jobs. No automatic merge or deploy. Owner can merge this isolated hotfix and run protected `Deploy Worker` on main. Current Cloudflare logs and GitHub preflight show that credentials are provisioned; their **actual validity remains to be verified after the outbound requests run**.
