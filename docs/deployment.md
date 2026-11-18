# Daydle — Development, preview, and deployment baseline

**Current release note (November 17, 2026):** Phases 11–13 source is merged into `main` and CI passed, but the last confirmed protected Worker deployment is [Phase 10 run #44045005321](https://github.com/A13Xg/Daydle/actions/runs/44045005321). Hosted Phase 11/12 SQL applied November 17 local / November 18 UTC with recorded versions `20261118013515` and `20261118013526` and RPC/grant checks. **New Worker deployment, real account/operator/device acceptance, and independent encrypted offsite backup/restore are NOT VERIFIED**. See [Phase 14 beta release gates](beta-release.md). Historical setup detail below remains relevant where noted. CI never deploys, and production changes require explicit owner authorization.

## Runtime

- Node.js 22 LTS or a supported newer version, npm.
- React + TypeScript + Vite 8, with Cloudflare Vite plugin 1.x.
- One Cloudflare Worker (`worker/index.ts`) serves versioned `/api/*`; its static asset bundle contains the React SPA.
- Supabase Auth (Apple and Google) and PostgreSQL are active from Phase 3; the browser uses only the public project URL and publishable key.

## Local development

1. `npm ci` (after tracked package-lock.json is available).
2. `cp .env.example .env.local` only when real public Supabase config is needed; otherwise omit it. Do not commit the file.
3. `npm run dev` then visit the Vite URL. The placeholder works without Supabase.
4. `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`.
5. `npm run preview -- --port 4173` and, in another terminal, `npm run smoke`. Smoke verifies health JSON, status codes, SPA root and a deep link.

Cloudflare local Worker-specific secrets would go in `.dev.vars` (gitignored); never in `VITE_*` variables. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public browser settings only. A Supabase service-role/secret key must never be embedded in a Vite build or committed.

## Deployment environments

| Environment | Purpose | Setup and boundary |
|---|---|---|
| Local | Development and tests | Cloudflare Vite plugin provides a local Worker runtime; no external accounts are required. |
| Production (single hosted environment) | Live site and all hosted testing | Worker `daydle-app` on the custom domain `daydle.agoodman.io` (the `workers.dev` and preview URLs are disabled) plus one free-tier Supabase project. No separate preview or staging environment exists by owner decision. The GitHub environment `production` requires a reviewer and allows only `main` for Actions jobs; the local deploy script enforces `main` on its own. |

The `wrangler.jsonc` file is the local baseline. If a second environment is ever added, use environment-specific Wrangler configurations or an audited per-environment deployment configuration; keep names, routes, and secrets isolated. The Cloudflare Vite plugin emits a deployable `dist/worker/wrangler.json`; verify it before using Wrangler in an approved release.

### Provisioning and release procedure

Provisioning was executed on 2026-11-14 with the helpers in [scripts/ops](../scripts/ops/README.md); see [docs/auth.md](auth.md) and [docs/secrets.md](secrets.md) for what is configured.

1. Provisioning: `new-supabase-project.ps1`, `init-github-environment.ps1`, `set-production-secrets.ps1` / `set-cloudflare-credentials.ps1`, `register-workers-subdomain.ps1`, then `configure-google-auth.ps1` and `configure-apple-auth.ps1`.
2. Migrations: `supabase db push --dry-run`, then `supabase db push` only with the owner's explicit approval.
3. Release: either the manual **Deploy Worker** GitHub Actions workflow (Actions tab, Run workflow on `main`; it waits for the `production` environment reviewer and uses the `CLOUDFLARE_API_TOKEN` environment secret) or, locally, `deploy-worker.ps1` from a clean working tree on the tip of `main` (it refuses anything else unless `-AllowNonMain` is passed) builds with the environment's public values, deploys the Worker, attaches the `wrangler.jsonc` custom domain and checks `/api/v1/health`. It prompts (hidden) for the Cloudflare token, which needs Workers Scripts Edit, Account Settings Read, and for the first custom-domain attach Zone DNS Edit and Workers Routes Edit on the zone.
4. After a merge, redeploy from `main` so the live commit matches the merged one.
5. Record the deployed commit, Worker version and rollback notes.
6. A scheduled workflow (`keepalive.yml`) attempts a read-only public Supabase request daily, only from `main`. It is best-effort; scheduled runs may be delayed/disabled. Following an approved merge, check a successful manual dispatch on `main`; see [scripts/ops/README.md](../scripts/ops/README.md#free-tier-keep-alive).

## Migrations and rollback policy

- Phase 1 has no database migrations. Phase 2 and Phase 3 migrations are reviewed, versioned and forward-only, and were applied to the hosted project on 2026-11-14 after a dry run.
- A failed web deployment should revert to the previous Cloudflare Worker version using Cloudflare's version/deployment rollback capabilities; do not assume database rollback is safe after a migration.
- Do not deploy a Worker build if compatibility with the current database schema has not been established.
- The free Supabase tier has no automated backups; take your own exports before risky changes once real data exists.

## Required operational checks

- `GET /api/v1/health` returns `200`, `application/json`, `no-store`, and a stable typed response.
- Unknown `/api/*` returns JSON `404`, not SPA HTML; non-GET health returns `405`.
- SPA paths return `index.html`. Static assets remain cacheable according to Cloudflare's asset routing.
- CI runs dependency install, TS, lint, formatting, tests, build and preview smoke. CI **does not deploy**.
- Never log or echo credentials, raw share text, or private user data.

## Phase 5 schema-first PWA release guardrail

Phase 5 adds `public.user_game_day_marks` (owner-private RLS) and a generated offline app shell. The current production app may still run an earlier schema. Before any owner-approved Phase 5 Worker deploy, apply the Phase 4 catalog migration if still pending, followed by the Phase 5 marks migration, and verify their RLS and catalog API compatibility. Build generates PNG icons before Vite and emits `dist/client/sw.js` after the Vite output; do not deploy a build lacking manifest/icons/service worker.

The service worker never intercepts Supabase or authenticated API traffic and cannot save results offline. The iOS installed-PWA OAuth/clipboard/return scenario is a manual evidence gate. See [docs/pwa.md](pwa.md).

### Phase 5 migration-history recovery after initial release failure

[Production run 43810002170](https://github.com/A13Xg/Daydle/actions/runs/43810002170) reached linked Supabase but failed the Phase 2/3 migration-history preflight, **before schema changes or Cloudflare deploy**. Schema may have been applied manually in Phase 2/3 without migration tracking; this is not established until version-only remote diagnostic evidence exists.

[Fix PR #8](https://github.com/A13Xg/Daydle/pull/8) preserves fail-closed behavior. The release now inspects exactly four expected versions. If the remote *history* lacks a Phase 2/3 record, the workflow first queries Supabase's **read-only** Management API for 18 RLS-protected domain tables, 18 owner/public policies, Phase 2 helpers, Phase 3 onboarding column/functions, and the enabled auth-user trigger. Only a complete match, with no unexpected Phase 4/5 objects already present, allows `supabase migration repair` of missing Phase 2/3 history entries. It then re-lists versions and runs the original strict dry-run/migrate/verify/deploy sequence.

`migration repair` **does not execute missing migrations or modify application data**; it updates the migration-tracking table. If the real schema is missing or inconsistent, *do not* mark versions applied. The read-only verification endpoint requires `database_read` authorization in the protected `SUPABASE_ACCESS_TOKEN`. If it returns HTTP 403, revise token scope rather than weakening checks. No credentials should be pasted in chat. The [deployment run](https://github.com/A13Xg/Daydle/actions/workflows/release-phase5.yml) still requires main-branch merge and protected production reviewer approval.

### Verified migration-history root cause — second failed release

The second [release run 43812374685](https://github.com/A13Xg/Daydle/actions/runs/43812374685) again failed **before** any SQL or Worker deploy. Unlike the earlier hypothesis, a direct authenticated read of the Supabase project's history confirms both `20261114050000` (Phase 2) and `20261114060000` (Phase 3) are recorded as applied. A separate SQL catalog check confirms the Phase 4 catalog function/column and Phase 5 manual-mark table are absent. **Do not run `migration repair` for Phase 2/3.**

[Fix PR #9](https://github.com/A13Xg/Daydle/pull/9) replaces the fragile CLI migration-list text parser with the documented structured Management API `GET /v1/projects/{ref}/database/migrations`. It validates the local four-file allowlist and exact returned version records before the approved `supabase db push --linked --dry-run`, then verifies all four versions after `--yes` before deploying Cloudflare. The API requires `database_migrations_read` scope on the protected `SUPABASE_ACCESS_TOKEN`. Failure to read that endpoint stops before SQL; do not widen permissions beyond the read scope needed for the version check.

Earlier [ReleaseFixPlan.md](../ReleaseFixPlan.md) and its conditional metadata-repair design are preserved as historical investigation but superseded for the release path. The production reviewer gate and main-branch-only policy are unchanged.

### Phase 5 successfully deployed — final smoke false negative

Protected [release run 43814332227](https://github.com/A13Xg/Daydle/actions/runs/43814332227) **successfully applied** Phase 4/5 migrations and verified the complete four-version Supabase history. Wrangler then **successfully deployed** Worker `daydle-app` to `daydle.agoodman.io`, version `126e8806-3cb5-4765-a164-225466531727`. The job only failed on its immediately following health check: HTTP 200 with HTML (SPA shell), causing JSON parsing to fail. Do not treat this red run as a failed migration or a rolled-back deployment.

Independent public CI later verified live JSON health, API 404, manifest, SW, Today/Games pages and PWA PNG assets. The initial HTML response is consistent with edge propagation or stale routing, but the precise cause is not proven by the logs.

[Fix PR #10](https://github.com/A13Xg/Daydle/pull/10) replaces the one-shot smoke check with `node scripts/ops/verify-live-release.mjs`. It checks response status, content-type, body contract and (for the production release) that the exact built SW is deployed. Every endpoint gets bounded retries, avoiding a false failure when a 200 response still serves stale SPA HTML. `node scripts/ops/verify-live-release.mjs --routing-only` checks the Vite-generated Worker configuration before deployment. For read-only probes without production build variables, `--public-only` validates the hosted SW without comparing an unrelated CI build hash.

**Current follow-up:** No additional database migration or Cloudflare deployment is required for basic iPhone PWA testing. Keep [the physical iPhone acceptance matrix](pwa.md#manual-iphone-acceptance-matrix--not-verified) open until actually tested. Merge PR #10 to harden subsequent protected release jobs; do not automatically rerun the deployment just to clear a historic red check.
