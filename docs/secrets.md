# Daydle — Credentials and environment configuration

This is a reference manifest, **not a request to paste credentials into a chat or commit them to Git**. Phase 2's SQL integration tests use a disposable local PostgreSQL 17 server; no real Supabase or Cloudflare credentials are necessary to complete PR checks.

## GitHub Actions secrets and variables

In [GitHub repository Actions settings](https://github.com/A13Xg/Daydle/settings/secrets/actions), use environment-scoped secrets. The repository currently has a single protected **`production`** environment (required reviewer, deployments limited to `main`; these rules govern GitHub Actions jobs, and the local `deploy-worker.ps1` enforces `main` itself); there is no separate preview environment. Production deployment jobs must require explicit approval and never run on PR CI. The helper scripts in [scripts/ops](../scripts/ops/README.md) create and populate it.

| Name | Store | Purpose |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | GitHub Environment **secret** | Scoped Supabase personal token for CLI project operations |
| `SUPABASE_DB_PASSWORD` | GitHub Environment **secret** | Database password for approved migration deployments only |
| `SUPABASE_PROJECT_ID` | GitHub Environment **variable** | Supabase project reference used by `supabase link` |
| `CLOUDFLARE_API_TOKEN` | GitHub Environment **secret** | Worker deployment permission, scoped to the target account; used only by the manual Deploy Worker workflow |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Environment **variable** | Cloudflare account identifier |
| `VITE_SUPABASE_URL` | GitHub Environment **variable** | Public project URL `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub Environment **variable** | Public `sb_publishable_...` key for browser RLS client |
| `VITE_TURNSTILE_SITE_KEY` | GitHub Environment **variable** | Reserved and not read by the current UI (the CAPTCHA widget was removed); set only if an email form returns |
| `KEEPALIVE_SUPABASE_URL` | GitHub **repository variable** | Same public project URL, read by the scheduled keep-alive workflow (repository scope so it needs no environment approval) |
| `KEEPALIVE_SUPABASE_PUBLISHABLE_KEY` | GitHub **repository variable** | Same public publishable key, for the keep-alive workflow only |

Owner decision: the single hosted Supabase project is treated as production and no separate preview or staging project exists. If real user data later makes schema changes risky, add an isolated staging project first. GitHub deployment env secrets are distinct from runtime Worker secrets.

Notes:

- The Supabase access token is a personal token and **cannot be restricted to one project**. Use the shortest expiry that is practical and rotate it.
- The **Turnstile secret key** is not stored in GitHub. It exists only in Supabase Auth settings (set by `scripts/ops/configure-turnstile.ps1`). Google and Apple provider credentials likewise live only in Supabase; the Apple `.p8` key stays in the owner's password manager.
- The database password is kept in Windows Credential Manager (and as the `SUPABASE_DB_PASSWORD` secret). Nothing here authorizes running migrations; see the policy below.

## Cloudflare runtime secrets

Phase 7/8's current Worker code requires `SUPABASE_SERVICE_ROLE_KEY` (the **legacy service-role JWT**, not a `sb_secret_` API key) as an encrypted **Cloudflare Worker runtime secret**, not a GitHub Actions build variable or `VITE_*` setting. That key bypasses RLS and must never be committed, logged, included in untrusted PR CI, or sent to browsers. The protected deploy workflow checks the binding name without reading its value and fails if it is missing. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are public runtime bindings injected from the existing protected GitHub environment variables into the generated Worker configuration during deployment (not checked into Git).

Cloudflare `wrangler secret put` normally produces and deploys a new Worker version; **do not run it as a setup step without deployment authorization**. Use the dashboard's Variables and Secrets controls or authorized versioned setup during the deployment phase.

## Future backups

Phase 12 merged **source-only** AES-256-GCM archive encryption and SQL retention handling, but no verified protected backup environment, scheduled PostgreSQL export, private R2/S3 destination, retention/key escrow, alerting or independent restore exists. These are **public beta blockers** in [the release runbook](beta-release.md), not tasks that completed by merging PR #23. Do not create backup credentials without explicit owner approval and a reviewed destination/threat model.

## Policy

PR CI does not use Supabase/Cloudflare secrets, does not run `supabase db push`, and does not deploy application code. The only workflow that uses the Cloudflare token is the manual, reviewer-approved **Deploy Worker** workflow, which runs from `main` only. Storing a secret is not authorization to use it.

Sources: [Supabase environment deployment](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

## Phase 9 runtime secret deployment recovery (November 17, 2026)

Deployment [run #44031239925](https://github.com/A13Xg/Daydle/actions/runs/44031239925) **uploaded and activated Worker version 1571ad6b-7c19-43a0-9d97-cfec1927065b**, but the job failed its public profile check (HTTP 503, expected 404). All seven hosted schema migrations, the pre-deploy encrypted-secret metadata lookup, the build and Worker upload passed. Wrangler's upload summary listed only the public Supabase bindings; whether the active version retained the encrypted binding was not independently confirmed. The local Vite build warned about a required secret missing from the runner environment, which does **not** by itself prove the production secret was lost.

- Before retrying, inspect Cloudflare Worker `daydle-app`'s **currently deployed version** and encrypted `SUPABASE_SERVICE_ROLE_KEY` binding (not merely whether a secret existed before deployment). If missing, restore it directly in Cloudflare with the Supabase **legacy service-role JWT**. If already present, inspect the public JSON error on the unknown-player route: `service_unavailable` indicates incomplete/invalid runtime configuration, `result_service_unavailable` indicates the privileged Supabase RPC request was rejected/unavailable. Never paste or log the JWT.
- The Vite-generated `dist/worker/wrangler.json` is the actual deployment configuration. `prepare-worker-runtime.mjs` now explicitly carries forward the **required secret name** from the reviewed source declaration without reading its value, and rejects any attempt to put that secret in public `vars` or an unexpected required-secret declaration. This causes Wrangler to fail closed when Cloudflare cannot provide the required encrypted binding.
- The protected deploy also checks secret **metadata after deployment**, before the live smoke. The live probe categorizes three HTTP 503 classes without logging sensitive payloads. The manual production reviewer, main-only gate, strict seven-migration check and current build-version smoke remain unchanged.
- These changes affect only Phase 9 release machinery, not Phase 10 schema or application logic. The hotfix is intentionally isolated so it can be merged and deployed without accepting the unapplied Phase 10 migration.
