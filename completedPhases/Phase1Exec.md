# Phase 1 Execution Plan — Application skeleton, tooling, and deploy baselines

**State:** VERIFIED / IN REVIEW  
**Base:** `main` at `839498fa09e9ff2cabd7f4487f21165a8e0bed6a`  
**Branch:** `phase/01-application-skeleton`  
**Draft PR:** [#1](https://github.com/A13Xg/Daydle/pull/1)  
**Sources:** [IDEA.md](../IDEA.md), [roadmap.md](../roadmap.md#phase-1--application-skeleton-tooling-and-deploy-baselines), [AGENTS.md](../AGENTS.md).

## Verified baseline

Main contains only the six documentation/bootstrap files and no application code, package manager manifest, migrations, environment configuration, or open PRs. Phase 0 is satisfied, and Phase 1 is the earliest eligible phase. No accounts, Cloudflare worker deployment, or Supabase project is assumed to exist. All work belongs to this branch. Main's Phase 1 status remains NOT STARTED until review/merge reconciliation.

## Architecture decision and scope

Use **one npm package with React + TypeScript + Vite**, instead of a workspaces monorepo. Keep `src/` (browser), `worker/` (Cloudflare Worker), and `shared/` (pure contracts) as explicit boundaries. The Cloudflare Vite plugin builds frontend static assets and Worker together. Version API endpoints from the beginning: `GET /api/v1/health`. Supabase support is configuration-only in Phase 1; auth, database migrations/RLS, credentials, and production data remain future phases.

Delivery includes a non-interactive placeholder UI communicating actual build status, loading/error/retry states for an API health probe, semantic mobile-friendly navigation/landmarks, an accessible label and proper response status; do not simulate completed Daydle features. Support SPA deep-link fallback and prevent API routes returning `index.html`.

**Out of scope:** actual login, accounts, DB schema, game catalog, parsers, results, achievements, friends, PWA service worker/offline caching, actual Cloudflare/Supabase provisioning, preview/production deployment, and final visual styling. Only documented commands/configuration for future environments are created.

## File plan

- `package.json`, lockfile, `.node-version`, `.gitignore`: reproducible Node >=22, npm install, scripts and dependency policy. Pin supported stable dependency families.
- `index.html`, `public/favicon.svg`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/vite-env.d.ts`: accessible placeholder app shell, no product-facing data.
- `src/lib/config.ts`, `src/lib/supabase.ts`, `src/lib/api.ts`: validated *public* Supabase URL/publishable key and lazily constructed browser client; typed health request; missing config is a supported setup state.
- `worker/index.ts`, `worker/health.ts`, `shared/contracts.ts`: isolated Worker router/JSON health response and shared typed contract.
- `vite.config.ts`, `wrangler.jsonc`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc.json`: Cloudflare-integrated build with strict TS, consistent lint/format; no secrets embedded.
- `tests/` (health/worker routes, config, API contract), `.github/workflows/ci.yml`: meaningful tests and on-PR build/typecheck/lint/format/test checks. Include a non-deploying local preview smoke path if feasible.
- `.env.example`, `.dev.vars.example`, `docs/deployment.md`: configuration and deployment/rollback procedure for local, preview, production.
- `README.md`, `AGENTS.md`, `roadmap.md`: development scripts and independent, factual execution guardrails.

## Contract and security

`GET /api/v1/health`: HTTP 200, `application/json; charset=utf-8`, `Cache-Control: no-store`, JSON `{ status: "ok", service: "daydle-api", version: "v1" }`. Non-GET for route returns 405 and Allow: GET; other `/api/*` paths return JSON 404. No database connection or server secrets are exposed from health. Avoid CORS wildcard and avoid logging raw inputs.

Browser config: `VITE_SUPABASE_URL` must be HTTPS (localhost only if explicitly documented as local dev), `VITE_SUPABASE_PUBLISHABLE_KEY` is safe to publish (and is **not** a service_role/secret key). Validate before client creation; absent keys show `not configured`, not an exception. No `SUPABASE_SERVICE_ROLE_KEY` under `VITE_`. Future Worker-only secrets will use Cloudflare secrets and never be published in browser build.

## Ordered execution plan

1. Create repository manifest/configuration: Node/npm, Cloudflare plugin/Worker, strict compiler configs, formatting/linting, ignore/example-env files. Review for config and SPA/API routing consistency.
2. Implement shared health contract, Worker request handling and browser health fetch with typed runtime-safe response checks.
3. Implement placeholder mobile-first accessible React shell, explicit missing-credentials/health failure states, minimal placeholder styling only.
4. Add Supabase browser config adapter with opt-in client creation and tests; do not introduce hard credential dependency for local run.
5. Add unit + Worker-route contract tests; CI pipeline runs install, typecheck, lint, format, tests and build.
6. Add deployment/environment/rollback documentation; update README and strengthen AGENTS.md for observed verification/CI constraints.
7. Run install/typecheck/lint/format/test/build and local Worker API/SPA smoke as environments permit; inspect the final diff, security, test design, docs, and CI. Record precise outcomes. If any material checks fail or cannot execute, keep draft PR and active plan.
8. Only after every relevant gate passes, append the verification report, rename to `completedPhases/Phase1Exec.md`, propose roadmap status IN REVIEW on branch, update PR evidence, and mark ready for review. **Never merge or deploy to production without authorization.**

## Verification matrix

| Gate | Command / evidence | Pass criteria |
|---|---|---|
| Install/lock | `npm ci` | Clean locked dependency installation |
| Typecheck | `npm run typecheck` | No TypeScript errors |
| Lint | `npm run lint` | No lint errors |
| Format | `npm run format:check` | No format drift |
| Tests | `npm test` | Deterministic health/config/routing/API contract tests pass |
| Build | `npm run build` | Cloudflare Worker and browser output both produced |
| Smoke | `npm run preview`, HTTP GET on `/api/v1/health`, `/`, and deep link, 404 JSON for unknown API | Correct status/content types, no app-shell answer for API routes |
| CI | GitHub Actions on PR | All required jobs green; no production deployment |
| Security | Review `.gitignore` + diff/env | No secrets, unnecessary open endpoints, unsafe HTML injection, or fake data |
| Ownership | Inspect commits | No non-owner contributor attribution or fabricated verification |

## Risk and mitigation

- Cloudflare Vite plugin / framework version compatibility: use official stable integration; verify build in CI; do not assume a compile is successful.
- Package registry inaccessible in some local execution environments: use CI runner for actual dependency installation; record inability to run locally, and **do not mark a gate passed based on static inspection**.
- Cloudflare/Supabase credentials absent: document provision steps; local build and smoke must function without them. A live preview deployment is conditional on user provisioning and separate authorization.
- PWA limitations: do not promise offline caching or background clipboard read until Phase 5.
- DB/security: no live DB operations, service keys, database schema, or public profile authorization in Phase 1.

## Pre-implementation self-review

Confirmed no existing code to conflict with, no need for monorepo, no dependency on provider credentials, health endpoint is unprivileged and non-identifying, SPA assets and API routing are separate, and future features stay out of Phase 1. Plan is accepted for implementation, subject to final measurable gates.

## Actual implementation / verification

**Implementation completed on** `phase/01-application-skeleton`, draft PR [#1](https://github.com/A13Xg/Daydle/pull/1). Phase 1 is **IN REVIEW**, not COMPLETE on main until merged and reconciled.

### Delivered

- Created a single package with strict TypeScript and Node 22, React + Vite 8, Cloudflare Vite plugin + Worker, generated deployable assets, versioned health API and shared response contract.
- Added browser-only lazy Supabase public config adapter, explicitly preserving service/secret key boundaries. Missing external credentials remain a supported non-failing startup state.
- Implemented accessible mobile-friendly placeholder UI with API status, loading, failure, and retry states; no fictitious product functionality.
- Committed resolved npm lockfile (287 package entries), CI checks using `npm ci`, contract/Worker/config tests, preview HTTP smoke, and deployment/rollback guidance.
- Extended AGENTS.md's evidence and execution-environment rules. No production deploy, schema migration, live auth, or Supabase project change.

### Verification evidence

**Passing non-mutating CI run:** https://github.com/A13Xg/Daydle/actions/runs/43558271002  
GitHub-hosted Ubuntu runner with Node 22, after formatting was committed:

| Gate | Actual command | Observed outcome |
|---|---|---|
| Dependency install | `npm ci --no-audit --no-fund` | PASS |
| Types | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| Formatting | `npm run format:check` | PASS |
| Unit and API contract tests | `npm test` | PASS — 3 suites, 11 tests |
| Bundle | `npm run build` | PASS — Cloudflare Worker and client assets generated |
| HTTP smoke | `npm run preview -- --port 4173` + `npm run smoke` | PASS — JSON health, 405 Allow, JSON API 404, root HTML, SPA deep-link fallback |
| Source/security audit | Review Worker/config/CI/ignore rules and PR file list | PASS — no embedded credentials, arbitrary evaluation, dangerous HTML injection, or automated production deployment identified |
| Contributor and scope audit | GitHub commits and 35 changed-file paths | PASS — owner-authenticated commits; scope confined to Phase 1 |

**Defects found and repaired:** Node .mjs globals omitted in ESLint; 11 source files required Prettier normalization; temporary bootstrap CI lockfile/format emitting steps removed after finalizing canonical artifacts. Clean CI subsequently passed.

**Constraints and limitations:** The isolated local tool environment could not resolve npm registry hosts; actual install, build and API preview were executed in GitHub Actions rather than locally. A public Cloudflare preview and a real iOS-device interaction smoke were **not performed** because services/domains and credentials are not provisioned; those integrations are intentionally not a Phase 1 requirement without provider access. Supabase is configuration-only, not a live connectivity proof. Do not label either external deployment as tested. No database migrations or production release occurred.

### Review and rollback

- Review PR #1; do not merge automatically.
- Because no database migrations or remote deploy occurred, rollback is the PR branch revert/decline before merge, or standard Git revert after merge. Do not manually reset main.
- Before future live deployment, provision separate preview/production Cloudflare and Supabase environments, configure authorized secrets, and perform external HTTP/iOS acceptance checks.
- Phase 1 on main remains NOT STARTED pending PR merge. Upon merge, verify main and perform a status-only COMPLETE reconciliation as documented in AGENTS.md.

