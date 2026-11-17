# Phase 7/8 release gate — Daydle Preview / Cloudflare Worker

**Owner authorization:** Phase 8 Supabase migration and a *Daydle Preview* Worker/frontend deployment, including required protected Worker-secret configuration (November 16, 2026). **Actual state:** database complete; Worker/frontend deployment and secret configuration NOT performed.

## Verified database state

| Migration source | Supabase recorded version | Management API name | Applied |
|---|---|---|---|
| `20261117010000_phase7_results.sql` | `20261117030322` | `20261117010000_phase7_results` | Yes |
| `20261117040000_phase8_statistics.sql` | `20261117034143` | `20261117040000_phase8_statistics` | Yes |

Both source migrations were applied through the Supabase migration service to project `xyjuriehmrkdqdmcxdso` under explicit owner authorizations. Phase 8 function `public.my_personal_statistics(uuid,text)` is executable only by `service_role`; direct `anon`/`authenticated` execution denied. Phase 7's five results RPC grants similarly verified. No result/sample data was changed during the migration.

**Do not use** the old `release-phase5.yml` or `supabase db push` unmodified. `scripts/ops/check-hosted-migrations.mjs` only permits the four old version numbers and fails closed with these newly registered generated versions. The live-schema state is already current; a second application would collide with existing functions.

## Environment and credentials

The repository currently has only **one hosted Worker**, `daydle-app`, bound by `wrangler.jsonc` to `daydle.agoodman.io`. The GitHub `production` environment requires approval and limits Actions deployments to the `main` branch. There is **no independent Cloudflare preview Worker/domain**. Do not confuse a Supabase project named `Daydle Preview` with an isolated frontend deployment.

For the existing Worker to perform Phase 7/8 actions, its **runtime** environment must have:

- `SUPABASE_URL`: Supabase HTTPS origin, matching the configured Daydle project
- `SUPABASE_PUBLISHABLE_KEY`: the public `sb_publishable_...` key
- `SUPABASE_SERVICE_ROLE_KEY`: the privileged service-role JWT required by the current Worker/PostgREST implementation, **server secret only**

Do not store `SUPABASE_SERVICE_ROLE_KEY` as a `VITE_*` browser variable; do not print it, commit it, use it in PR CI or expose it in deployment output. The repo's historical `docs/secrets.md` mentions `SUPABASE_SECRET_KEY` for a future API; that name alone does **not** configure the current Worker, which requires `SUPABASE_SERVICE_ROLE_KEY`. Resolve this naming and safe credential provision via protected Cloudflare/runtime secret management before release. Existing production GitHub secrets are for deployment control and must not be assumed to exist as runtime Worker bindings.

## Deployment decision

**Owner decision (November 16, 2026):** deploy to the existing `daydle.agoodman.io` host after PR #15 passes review, using the `main` branch and protected `production` environment workflow. No new preview Worker is required; the live host is the authorized test target. Preserve manual reviewer approval. The updated `deploy.yml` validates the six already-applied migrations read-only (no `db push`), checks the presence of the Cloudflare service-role secret binding (without reading its value), supplies the public Worker bindings from protected environment variables, and verifies the exact deployed PWA version.

The currently connected tools can read/write repository sources and apply authorized Supabase migrations, but **cannot** set Cloudflare runtime secrets, modify GitHub protected environment secrets, dispatch Actions or run Wrangler. Connecting deployment-capable tooling or executing the protected release outside this connection is necessary. Approval alone does not establish that those capabilities are available.

## Required authenticated end-to-end acceptance

1. Verify deployed source version and application assets, health JSON, unknown API JSON 404, PWA manifest/service worker and routing; do not accept stale SPA HTML at JSON URLs.
2. Verify Google/Apple login and authenticated session handling on the intended preview host; avoid redirecting to production or relaxing OAuth restrictions without review.
3. Submit a canonical supported share: saved, duplicate/idempotency, conflicting score, explicit same-result replacement, owner history and permanent deletion. Confirm other account cannot read or delete it.
4. Submit an unknown or malformed bounded share through an **explicit Submit result** action: stored privately with classified reason, not exposed through History or browser cache, never uploaded merely by clipboard inspection.
5. Check Statistics totals/streaks/distribution and achievements for the signed-in account, including replacement/delete invalidation, timezone grouping, and no cross-user data access.
6. Confirm raw submission retention expiry and *actual physical purge* policy, secrets not reflected in responses/logs, no private caching, and protected release rollback readiness.

Physical iPhone Safari/PWA verification remains **deferred**, not passed. Phase 7 and Phase 8 remain blocked on actual hosted application acceptance until evidence exists.
