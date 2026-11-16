# Daydle — Development, preview, and deployment baseline

**Baseline from Phase 1, updated through Phase 3.** CI never deploys. A deployment happens only when the repository owner runs the deployment script, and a release needs the owner's explicit authorization.

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
