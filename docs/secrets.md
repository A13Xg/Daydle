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

Phase 7/8's current Worker code requires `SUPABASE_SERVICE_ROLE_KEY` (the **legacy service-role JWT**, not a `sb_secret_` API key) as an encrypted **Cloudflare Worker runtime secret**, not a GitHub Actions build variable or `VITE_*` setting. That key bypasses RLS and must never be committed, logged, included in untrusted PR CI, or sent to browsers. The protected deploy workflow checks the binding metadata directly through Cloudflare's read-only Worker secret API. It never retrieves or prints the secret value. It fails closed and distinguishes a missing binding, a missing Worker, insufficient token permission, and a transient Cloudflare/API error. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are public runtime bindings injected from the existing protected GitHub environment variables into the generated Worker configuration during deployment (not checked into Git).

Cloudflare `wrangler secret put` normally produces and deploys a new Worker version; **do not run it as a setup step without deployment authorization**. Use the dashboard's Variables and Secrets controls or authorized versioned setup during the deployment phase.

## Future backups

Phase 12 will specify the encrypted backup destination, R2 access policy, key management, retention schedule, and restore tests. Do not create backup credentials before the destination and threat model are finalized.

## Policy

PR CI does not use Supabase/Cloudflare secrets, does not run `supabase db push`, and does not deploy application code. The only workflow that uses the Cloudflare token is the manual, reviewer-approved **Deploy Worker** workflow, which runs from `main` only. Storing a secret is not authorization to use it.

Sources: [Supabase environment deployment](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

### If the protected Worker secret preflight fails

The production Deploy Worker workflow checks the **existing** Cloudflare Worker named `daydle-app` under the protected `CLOUDFLARE_ACCOUNT_ID`. A successfully configured `CLOUDFLARE_API_TOKEN` for code deployment does **not** imply `SUPABASE_SERVICE_ROLE_KEY` has been provisioned on the Worker. These are different secrets in different systems.

- `missing_binding`: Worker exists but its encrypted `SUPABASE_SERVICE_ROLE_KEY` binding is absent. Create that **Cloudflare Worker secret**, not a public variable or `VITE_*` key. Its value must be the Supabase project's **legacy service-role JWT**, handled directly in the Cloudflare dashboard or an approved secure secret injection workflow. Do not copy it to code, PR discussions, CI logs or this chat.
- `worker_not_found`: Check the Worker name/account. On initial provisioning, set up the Worker and its encrypted secret together; `wrangler secret put` may create/deploy a stub Worker version, so perform it only in the approved release window. Do **not** bypass the preflight merely because the Worker is new.
- `permission_denied`: Adjust the scope/account of the **production-scoped** Cloudflare API token (Workers Scripts Read/Write as required) without using a user-global token.
- `lookup_failed`/`invalid_response`: Check Cloudflare API connectivity or response format and retry when healthy. Do not interpret this as confirmation of a missing binding.

The preflight uses the documented Cloudflare **GET /accounts/:account_id/workers/scripts/:script_name/secrets** endpoint. Only public metadata (`name`, `type`) is examined; no arbitrary Cloudflare response content is logged. The existing `wrangler.jsonc` `secrets.required` declaration remains in force and the protected main-only manual deploy still must pass schema verification, production reviewer approval and post-deploy smoke checks.
