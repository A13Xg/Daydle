# Production Phase 5 — deployed Worker health check failure

**State:** IMPLEMENTED / LIVE VERIFIED / CI PASS — ready for human review · **Branch:** `fix/phase5-live-health-routing` · **Base:** `be904ffe84d650d0b8c4efe06b2f145e7afa0085`.

Production [run 43814332227](https://github.com/A13Xg/Daydle/actions/runs/43814332227) successfully applied Phase 4/5 SQL and deployed the Cloudflare Worker version `126e8806-3cb5-4765-a164-225466531727`; failed only in live smoke at `/api/v1/health` when HTML was received instead of JSON. Direct Supabase migration read confirms all four versions.

## Plan

1. Capture safe live HTTP status, content-type, redirect, and body signature for health, missing API, manifest, and Today via GitHub CI's network; inspect generated `dist/worker/wrangler.json` assets routing, without exposing credentials.
2. Distinguish a Cloudflare asset fallback, upstream/Access login, missing Worker route, or unexpected content-type before modifying routing.
3. Fix the actual router/build config and add a regression that asserts *deployed* Worker config routes API requests worker-first; prevent HTML-as-health false success with status/content-type/body checks and useful response diagnostics.
4. Make production workflow phase-aware/idempotent: verify already applied migrations, build, deploy after owner review only, then check API, manifest, SW and asset responses. No new SQL writes or merge.
5. Test on clean CI and two PostgreSQL databases. Keep the original main-only protected release workflow. Owner merges after review; manual release action needs approval.

**Not yet verified:** iPhone installed-PWA user flow.

## Root cause, verified correction and safety disposition

**Observed:** Run 43814332227 completed Supabase Phase 4 and Phase 5 SQL and Cloudflare Worker deployment. The final curl received HTTP 200 with an HTML response at `/api/v1/health`, so the following JSON parser failed. The checker retried only non-2xx network responses; it did not retry incorrect response types. Precise Cloudflare edge behavior at that instant was not preserved.

**Subsequent independent public evidence:** GitHub CI fetched JSON health at `/api/v1/health`, JSON 404 for an unknown API path, a valid manifest, JavaScript service worker, Today/Games HTML and three correctly sized PNG icons. Generated `dist/worker/wrangler.json` includes `run_worker_first: ["/api/*"]`.

**Implemented:** `scripts/ops/verify-live-release.mjs` checks semantic API responses with bounded delay/retries and privacy-safe diagnostics; verifies the generated Worker-first routing before deployment; checks the deployed SW source matches the protected production build and confirms manifest/icons/pages. The protected `release-phase5.yml` now calls the verifier instead of one-shot curl/JSON. Added tests for HTTP 200 HTML fallback, transient errors, contract mismatch, stale SW, PNG headers/dimensions, and full PWA route checks.

**Public CI distinction:** An ordinary PR build has no production `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY`, yielding a different hashed JavaScript bundle and therefore a different SW cache version. Public CI can verify a correctly formed deployed SW without comparing it to its local dev build; the protected release always enforces exact production artifact equality. No credential or DB modification is needed for public checks.

**Release:** The site is already deployed. PR #10 hardens future release check reports; the owner can review/merge it without new SQL changes. Any later manual deployment continues requiring the production environment reviewer. Real iPhone validation is the only remaining material Phase 5 product gate.

## Verified execution evidence

- [Immutable-source CI run 43816919772](https://github.com/A13Xg/Daydle/actions/runs/43816919772): **both jobs passed**; **118 tests/23 suites**, strict TypeScript, lint, formatting, production Worker/Vite build, PWA HTTP preview smoke and two PostgreSQL 17 migration/RLS security databases.
- [Live read-only CI run 43816547897](https://github.com/A13Xg/Daydle/actions/runs/43816547897) performed **nine successful public checks**: JSON health, JSON 404, manifest, service worker, Today, Games and three PNG icons. This is separate from the production Worker deployment and made no hosted changes.
- The original [production release 43814332227](https://github.com/A13Xg/Daydle/actions/runs/43814332227) already applied Phases 4 and 5 and deployed Worker `126e8806-3cb5-4765-a164-225466531727`. Subsequent read-only Supabase migration inspection confirmed all four records. **No additional database migration or production Worker redeploy was performed on this branch.**
- Source/diff audit found no credential leaks, unapproved background deploy, model/assistant attribution or unsafe executable behavior.
- **Outstanding:** User's physical iPhone Safari/home-screen PWA acceptance remains NOT VERIFIED. PR #10 should be reviewed/merged only by owner; the protected production action is not automatically dispatched.
