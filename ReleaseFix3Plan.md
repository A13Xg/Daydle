# Production Phase 5 — deployed Worker health check failure

**State:** INVESTIGATING · **Branch:** `fix/phase5-live-health-routing` · **Base:** `be904ffe84d650d0b8c4efe06b2f145e7afa0085`.

Production [run 43814332227](https://github.com/A13Xg/Daydle/actions/runs/43814332227) successfully applied Phase 4/5 SQL and deployed the Cloudflare Worker version `126e8806-3cb5-4765-a164-225466531727`; failed only in live smoke at `/api/v1/health` when HTML was received instead of JSON. Direct Supabase migration read confirms all four versions.

## Plan

1. Capture safe live HTTP status, content-type, redirect, and body signature for health, missing API, manifest, and Today via GitHub CI's network; inspect generated `dist/worker/wrangler.json` assets routing, without exposing credentials.
2. Distinguish a Cloudflare asset fallback, upstream/Access login, missing Worker route, or unexpected content-type before modifying routing.
3. Fix the actual router/build config and add a regression that asserts *deployed* Worker config routes API requests worker-first; prevent HTML-as-health false success with status/content-type/body checks and useful response diagnostics.
4. Make production workflow phase-aware/idempotent: verify already applied migrations, build, deploy after owner review only, then check API, manifest, SW and asset responses. No new SQL writes or merge.
5. Test on clean CI and two PostgreSQL databases. Keep the original main-only protected release workflow. Owner merges after review; manual release action needs approval.

**Not yet verified:** iPhone installed-PWA user flow.
