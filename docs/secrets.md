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

When authorized server routes need privileged Supabase access in later phases, store `SUPABASE_SECRET_KEY` (value `sb_secret_...`) as a **Cloudflare Worker secret**. This key bypasses RLS and must never be prefixed `VITE_`, committed, logged, included in an untrusted PR job, or sent to browsers. Nonsecret runtime `SUPABASE_URL` can be a Worker environment variable.

Cloudflare `wrangler secret put` normally produces and deploys a new Worker version; **do not run it as a setup step without deployment authorization**. Use the dashboard's Variables and Secrets controls or authorized versioned setup during the deployment phase.

## Future backups

Phase 12 will specify the encrypted backup destination, R2 access policy, key management, retention schedule, and restore tests. Do not create backup credentials before the destination and threat model are finalized.

## Policy

PR CI does not use Supabase/Cloudflare secrets, does not run `supabase db push`, and does not deploy application code. The only workflow that uses the Cloudflare token is the manual, reviewer-approved **Deploy Worker** workflow, which runs from `main` only. Storing a secret is not authorization to use it.

Sources: [Supabase environment deployment](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
