# Daydle — Development, preview, and deployment baseline

**Phase:** 1. **Production deployment is not authorized by this document.** Provisioning of Cloudflare Workers, custom domains, Supabase projects, and secrets requires the repository owner's action and later phase approval.

## Runtime

- Node.js 22 LTS or a supported newer version, npm.
- React + TypeScript + Vite 8, with Cloudflare Vite plugin 1.x.
- One Cloudflare Worker (`worker/index.ts`) serves versioned `/api/*`; its static asset bundle contains the React SPA.
- Supabase Auth/PostgreSQL integration is intentionally not active in Phase 1.

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
| Local | Development and tests | Cloudflare Vite plugin provides local Worker runtime; no external accounts required for Phase 1. |
| Preview | PR QA and iOS testing | Separate Cloudflare Worker name/subdomain, separate Supabase project or schema once database exists; never point preview at production writes. Deploy only after owner provisions credentials/authorization. |
| Production | Public beta | Dedicated Cloudflare Worker + Supabase project. No deployment from PR CI; a separate gated production approval is required. |

The `wrangler.jsonc` file is the local baseline. For real preview and production, use environment-specific Wrangler configurations or an audited per-environment deployment configuration; keep names, routes, and secrets isolated. The Cloudflare Vite plugin emits a deployable `dist/wrangler.json`; verify it before using Wrangler in an approved release.

### Initial provisioning checklist (not yet executed)

1. Create Cloudflare Worker service(s) and decide the preview/production names, routes, DNS, and branch policy.
2. Create separate Supabase project(s) and configure Auth redirect URLs. Use only publishable project key in frontend; reserve secret/service-role credentials for a server-only binding.
3. Configure Cloudflare API token through GitHub repository secrets for approved release jobs only; do not enable automatic production deploy in CI.
4. Run a preview build/health/SPA smoke and an iOS Safari/PWA check when authorized.
5. Record deployed version SHA, Worker version, domain and rollback notes.

## Migrations and rollback policy

- Phase 1 has **no database migrations**. Phase 2 introduces reviewed, versioned, forward-only schema migrations and RLS tests.
- A failed web deployment should revert to the previous Cloudflare Worker version using Cloudflare's version/deployment rollback capabilities; do not assume database rollback is safe after a migration.
- Do not deploy a Worker build if compatibility with the current database schema has not been established.
- This Phase 1 baseline does not claim a live preview or production deployment.

## Required operational checks

- `GET /api/v1/health` returns `200`, `application/json`, `no-store`, and a stable typed response.
- Unknown `/api/*` returns JSON `404`, not SPA HTML; non-GET health returns `405`.
- SPA paths return `index.html`. Static assets remain cacheable according to Cloudflare's asset routing.
- CI runs dependency install, TS, lint, formatting, tests, build and preview smoke. CI **does not deploy**.
- Never log or echo credentials, raw share text, or private user data.
