# Daydle — Credentials and environment configuration

This is a reference manifest, **not a request to paste credentials into a chat or commit them to Git**. Phase 2's SQL integration tests use a disposable local PostgreSQL 17 server; no real Supabase or Cloudflare credentials are necessary to complete PR checks.

## GitHub Actions secrets and variables

In [GitHub repository Actions settings](https://github.com/A13Xg/Daydle/settings/secrets/actions), prefer environment-scoped secrets for `preview` and `production`. Production deployment jobs must require explicit approval and never run on PR CI.

| Name | Store | Purpose |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | GitHub Environment **secret** | Scoped Supabase personal token for CLI project operations |
| `SUPABASE_DB_PASSWORD` | GitHub Environment **secret** | Database password for approved migration deployments only |
| `SUPABASE_PROJECT_ID` | GitHub Environment **variable** | Supabase project reference used by `supabase link` |
| `CLOUDFLARE_API_TOKEN` | GitHub Environment **secret** | Worker deployment permission, scoped to the target account |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub Environment **variable** | Cloudflare account identifier |
| `VITE_SUPABASE_URL` | GitHub Environment **variable** | Public project URL `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub Environment **variable** | Public `sb_publishable_...` key for browser RLS client |

Use separate hosted projects or isolated staging resources for preview and production. GitHub deployment env secrets are distinct from runtime Worker secrets.

## Cloudflare runtime secrets

When authorized server routes need privileged Supabase access in later phases, store `SUPABASE_SECRET_KEY` (value `sb_secret_...`) as a **Cloudflare Worker secret**. This key bypasses RLS and must never be prefixed `VITE_`, committed, logged, included in an untrusted PR job, or sent to browsers. Nonsecret runtime `SUPABASE_URL` can be a Worker environment variable.

Cloudflare `wrangler secret put` normally produces and deploys a new Worker version; **do not run it as a setup step without deployment authorization**. Use the dashboard's Variables and Secrets controls or authorized versioned setup during the deployment phase.

## Future backups

Phase 12 will specify the encrypted backup destination, R2 access policy, key management, retention schedule, and restore tests. Do not create backup credentials before the destination and threat model are finalized.

## Policy

PR CI does not use Supabase/Cloudflare secrets, does not run `supabase db push`, and does not deploy application code. Storing a secret is not authorization to use it.

Sources: [Supabase environment deployment](https://supabase.com/docs/guides/deployment/managing-environments), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Cloudflare GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/).
