# Operations scripts (PowerShell, Windows)

Helpers used to provision hosted infrastructure. They contain **no credentials, account IDs, project
references or machine paths**. Secrets come from hidden prompts or Windows Credential Manager and are
never printed, logged or written to disk. Run them from the repository root in a normal interactive
PowerShell window (hidden prompts do not work in non-interactive shells). Requires `gh` (authenticated),
`supabase` (logged in via `supabase login`), Node 22+, and `npm ci` for deploys.

| Script | Purpose |
|---|---|
| `new-supabase-project.ps1` | Create the Supabase project once (free-plan check, no duplicates); store the generated DB password in Credential Manager. |
| `init-github-environment.ps1` | Create a protected GitHub environment (required reviewer, branch policy), set public variables, copy the DB password into a secret. |
| `set-production-secrets.ps1` | Prompt for and store `SUPABASE_ACCESS_TOKEN` and `CLOUDFLARE_API_TOKEN` as environment secrets. |
| `set-cloudflare-credentials.ps1` | Validate a Cloudflare token, discover the account ID, and save the token (secret) and ID (variable). |
| `register-workers-subdomain.ps1` | Read or register the account's `workers.dev` subdomain. |
| `configure-google-auth.ps1` | Enable Google sign-in in Supabase Auth from an existing OAuth web client. |
| `configure-apple-auth.ps1` | Generate Apple's client secret from your `.p8` key and store it in Supabase Auth. **Expires about every six months.** |
| `deploy-worker.ps1` | Build with the environment's public values, deploy the Worker, attach the `wrangler.jsonc` custom domain, and verify it. |

Shared helpers live in `lib/common.ps1`.

## Notes

- The database-password Credential Manager entry defaults to `Daydle-Preview-Supabase-DB`
  (`-CredentialName` overrides it).
- Supabase personal access tokens cannot be limited to one project; keep them short-lived and rotate them.
- Apple: keep the `.p8` in a password manager. Re-run `configure-apple-auth.ps1` before the printed
  expiry date; nothing changes in Apple's portal.
- Scripts that call the Supabase Management API patch only the fields they own; none pushes a whole
  configuration file.
- No script applies database migrations. Use `supabase db push --dry-run`, then `supabase db push`
  only after explicit approval.
