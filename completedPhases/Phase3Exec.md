# Phase 3 Execution Plan — Authentication, onboarding, and account identity

**Status:** VERIFIED WITH OWNER-APPROVED SCOPE CHANGES / IN REVIEW (see [Owner scope changes](#owner-scope-changes-and-deviations-from-the-plan))  
**Base:** main `87b2a71d98f74268ad930a0c31d73e51f737bc6e`, following merged Phase 2 PR #2 (`b4a1140`).  
**Branch:** `phase/03-auth-onboarding` · **PR:** [#3](https://github.com/A13Xg/Daydle/pull/3).  
**Sources:** [IDEA.md](../IDEA.md), [roadmap.md](../roadmap.md#phase-3--authentication-onboarding-and-account-identity), [AGENTS.md](../AGENTS.md), [Phase 2 archive](Phase2Exec.md).

## Preflight and identity design

Verified Phase 2 schema, migration, owner-only profile RLS, server-only friend-code writes, CI with two disposable PostgreSQL 17 databases, frontend shell and lazy Supabase browser adapter; no hosted credentials or database deployment yet. No existing auth UI/API implementation.

Use **Supabase Auth** exclusively for password hashing, email confirmation, refresh/session management, Google and Apple OAuth, and recovery. User email, provider identities, and credentials remain in `auth.users` and are never copied into `public.profiles`.

On every new auth user, a narrowly scoped `SECURITY DEFINER` PostgreSQL trigger atomically creates a public profile and privately stored friend code. Use secure native UUID bytes, rejection sampling for an unbiased 31-symbol alphabet, a unique code constraint, `INSERT .. ON CONFLICT (code) DO NOTHING` and bounded retries. Race safety must rely on database uniqueness rather than read-before-write. Display name comes from valid `raw_user_meta_data.display_name`, `full_name`, or `name`; if absent, use `Player` with `onboarding_completed=false`, and prompt user to set their chosen name. Apple web OAuth frequently provides no full name; do not assume it does. Email/password signup requires display name. No password is required for OAuth-only accounts.

Client-only Vite app uses PKCE Supabase auth; OAuth redirects same browser tab to `/auth/callback`, and a client callback exchanges the code and removes it from the URL via navigation. Use an idempotent in-flight callback handler to avoid React StrictMode double exchange; treat provider errors safely. Password reset uses Supabase recovery email and authenticated `updateUser({password})`. Invalid/missing provider configuration shows actionable errors but does not crash the app shell. Ensure email-confirmation pending is not shown as authenticated.

## File plan

- `supabase/migrations/20261114060000_phase3_auth_identity.sql`: add onboarding state, crypto friend-code functions and auth-user trigger, revoke all public execution of privileged functions; minimal owner-only profile grant.
- `tests/sql/bootstrap.sql`, `tests/sql/fixtures.sql`, `tests/sql/assertions.sql`: local-only auth metadata stub and Phase 2 fixture adjustments for automatic trigger, revised checks using generated codes.
- `tests/sql/auth-assertions.sql`: generated identity, uniqueness, fallback profile, collision pressure, role/column access and onboarding update tests.
- `scripts/test-db.sh`: run all ordered `supabase/migrations/*.sql` on both clean test databases; execute both assertion suites.
- `src/lib/auth-actions.ts`: typed sign-up/sign-in/recovery/OAuth and validation logic, redirect construction.
- `src/lib/supabase.ts`, `src/lib/browser-auth.ts`, `src/lib/use-auth.ts`: PKCE browser config, singleton client, session state and unsubscribe/race handling.
- `src/components/AuthPage.tsx`, `src/components/AuthCallback.tsx`, `src/components/AccountPage.tsx`: accessible user-facing signup/login/recovery/OAuth, callback status and account/onboarding/password reset.
- `src/App.tsx` and `src/styles.css`: preserve Phase 1 API health display while introducing minimal route-based navigation; defer final styling.
- `tests/auth.test.ts`, `tests/domain.test.ts` (if needed): mocked auth service calls and redirects/validation, security-oriented negative cases. CI runs real PostgreSQL schema tests and existing TypeScript/Worker smoke.
- `docs/auth.md`, `docs/secrets.md`, `README.md`, `AGENTS.md`: configuration/redirect/Apple renewal and user-flow runbook; explicit credential gate.

## Auth and ownership boundaries

| Action | Permission | Enforcement |
|---|---|---|
| Register email/password | Public | Supabase Auth signUp, server-side constraints, confirmation policy |
| Social login | Public | Supabase-managed provider OAuth; configured allowlisted redirect |
| Session refresh and sign-out | User/browser | Supabase Auth; no hand-rolled token storage |
| Profile creation | Trigger only | Definer owned by database owner, no public EXECUTE |
| Friend-code allocation | Trigger only (the two code functions are also executable by `service_role`) | Cryptographic 31-symbol generator and unique constraint/retry |
| Profile read / friend-code read | Public safe profile / owner-only private code | Phase 2 RLS, no email exposure |
| Change display name / onboarding | Authenticated owner only | RLS and column-specific UPDATE grants |
| Password reset | Authenticated recovery token | Supabase email recovery and updateUser, no password in custom DB |

No friend-code lookup/link/QR friendship or player discovery screens here; those are Phase 9. Do not create a service-role Worker endpoint in Phase 3: authentication and profile edit can be performed safely via Supabase's public client and RLS, avoiding cumbersome extra secrets.

## Phase implementation order

1. Commit and review this plan before code. Keep PR draft.
2. Write forward-only SQL migration, adapt test auth bootstrap/fixtures and assertions; verify migration through PostgreSQL 17 CI and fix any trigger/RLS issues.
3. Implement typed auth operations and PKCE client session restoration/OAuth callback, with input validation and minimal safe route handling.
4. Implement sign-up, login, recovery, callback, account profile/onboarding edit and logout interfaces with pending/error/loading/validation states.
5. Add auth-unit regression tests, documentation and operational guardrails, preserving baseline npm lock unless a real dependency is necessary.
6. Run all automated checks, inspect SQL functions, auth routing and changed files for IDOR, accidental email/raw-data leakage, open redirects, handling of concurrent registrations, missing config, and password/token logging.
7. If any material gate fails, keep draft and active plan. Once all locally testable gates pass, record actual outcomes and archived plan; if hosted OAuth/device testing is still a required launch gate, mark it explicitly `NOT VERIFIED` and keep the PR draft until owner config enables verification (or explicitly scopes an offline-only review).

## Tests and exit gates

- [x] Both fresh PG17 databases replay Phase 2+3 migrations in order. (CI `database-security`)
- [x] Trigger creates exactly one profile+unique code for email and provider metadata, including missing-name fallback; 200+ registrations generate unique 5-character codes.
- [x] Unprivileged users cannot call privileged code generators, edit others' profiles or read other's friend code; profile update owner-only; the email address never reaches `profiles`. Provider display names do (profiles are publicly readable by design), which the review found was undisclosed and is now disclosed in the UI.
- [x] Email signup/login/recovery and OAuth provider call adapters have realistic success, pending and error tests, including validated redirect paths. (Mocked SDK tests; the email flows are disabled in the hosted environment, see scope changes.)
- [x] Callback duplicate-exchange avoidance, session restoration and recovery flow behave under React StrictMode and URL errors.
- [x] All `npm ci`, typecheck, lint, format, unit, build, Worker smoke and PostgreSQL security jobs pass.
- [~] Explicit external integration gate: **partially verified.** Google and Apple callbacks and signup-to-profile were exercised on an iOS device (owner-reported; browser not recorded) with hosted database evidence. Email link, password recovery and installed-PWA checks are **NOT VERIFIED**: email/password was disabled by owner decision and the PWA test was deferred by the owner.
- [x] No remote database deploy or production change without authorization. (Remote migrations and each deployment were explicitly authorized by the owner.)

## Risks / choices

- Supabase auth triggers can block signups if they throw; ensure bounded collision retries, safe default names, and tests.
- Apple web OAuth may not supply a full name and requires a web Services ID, developer signing key and periodic secret renewal. Do not store provider credentials in this repository.
- A five-character public friend code is a discovery token, not a password; server throttling and instant friendship belong to Phase 9.
- Password recovery and OAuth callback URLs must be explicitly allowlisted on Supabase; avoid accepting arbitrary external `next` URLs.
- Dynamic auth email confirmation behavior depends on provider configuration; the UI must distinguish pending confirmation from an active session.
- Browser auth should not introduce Worker service-role secret usage; direct Supabase client + owner RLS is preferable.
- No separate auth framework, native app, custom JWT parsing, or provider credential management.

## Pre-implementation self-review

Scoped to Phase 3; no credentials required for CI and migration testing; trigger is a necessary DB-owned invariant and avoids privileged API setup, while owner-only client profile editing relies on preverified RLS. Treat actual provider callbacks as an external integration checkpoint, not evidence from mocks. No final design styling introduced.

## Actual execution and verification

### Delivered

- **Database (`supabase/migrations/20261114060000_phase3_auth_identity.sql`):** `profiles.onboarding_completed`; `SECURITY DEFINER` functions `random_friend_code`, `allocate_friend_code` and trigger `on_auth_user_created` (`search_path` empty, fully qualified names); unbiased five-character friend codes (UUID bytes, rejection sampling, 31-symbol alphabet) inserted with `ON CONFLICT (code) DO NOTHING` and up to 32 attempts; the trigger creates one profile and one friend code per new auth user, and a failure aborts the signup so no auth user can exist without them; `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`.
- **Frontend:** Supabase PKCE client and session hook; typed auth actions (OAuth, plus email sign-up, sign-in and recovery with CAPTCHA token pass-through retained and tested); fixed same-origin `/auth/callback` with single-use code exchange that survives React StrictMode; account page with display-name onboarding, owner-only friend-code display and sign-out; a focused **Apple and Google** sign-in page.
- **Tests:** 37 Vitest tests (auth actions, redirect validation, callback race handling, UI semantics, CAPTCHA token pass-through, config validation, existing domain/API tests) and SQL assertions on two disposable PostgreSQL 17 databases including 250 additional registrations, a forced friend-code collision that must be retried, an allocation failure that must abort the whole signup, anon and service_role function grants, and display-name edge cases.
- **Operations:** PowerShell helpers in [scripts/ops](../scripts/ops/README.md) for provisioning, secrets, provider configuration, deployment and test-account purging; a scheduled Supabase keep-alive workflow (`.github/workflows/keepalive.yml`); [docs/auth.md](../docs/auth.md), [docs/secrets.md](../docs/secrets.md), [docs/deployment.md](../docs/deployment.md) and [docs/database.md](../docs/database.md) updated.

### Owner scope changes and deviations from the plan

1. **Single production environment.** The plan assumed separate preview and production. By owner decision there is one free-tier Supabase project (us-east-2) treated as production and one protected GitHub `production` environment (required reviewer, `main` only). The custom domain is `daydle.agoodman.io`; `workers.dev` and preview URLs are disabled.
2. **Email/password is disabled; Google and Apple only.** The owner first asked for email signup without confirmation. An automated security review showed that this allows **account pre-hijacking** through Supabase's automatic identity linking (an attacker registers a victim's email with a password; if the victim later signs in with Google or Apple using that email, the identities link and the attacker's password keeps working), and hosted Supabase cannot turn linking off. The owner chose Google and Apple only. Email sign-up, sign-in and password recovery are therefore **out of the hosted Phase 3 acceptance scope**, although their code and mocked tests remain. The roadmap's Phase 3 exit text still mentions recovery; this archive records the scope change.
3. **Installed-PWA verification deferred.** The owner deferred sign-out and session-restore testing on the installed PWA to a later time (tracked under Circle-Back in the roadmap). It is **NOT VERIFIED**.
4. **Auth page rework.** The plan's email/password page was replaced by a provider-only page. The Turnstile widget component was removed; CAPTCHA token pass-through and `scripts/ops/configure-turnstile.ps1` were kept for a future email return.
5. **Added beyond the plan:** ops scripts, keep-alive workflow and purge script, because hosted provisioning became part of the phase's verification gate.

### Automated verification

| Check | Result |
|---|---|
| `npm ci` | Pass (CI) |
| `npm run typecheck` | Pass (local and CI) |
| `npm run lint` | Pass (local and CI) |
| `npm run format:check` | Pass in CI. On a Windows checkout with `core.autocrlf=true` it reports CRLF differences; `prettier --check --end-of-line auto` passes. |
| `npm test` | **37 tests pass** (local and CI) |
| `npm run build` | Pass; the bundle contains no secret or service-role key patterns |
| `npm run smoke` | Pass against a local preview (CI) |
| PostgreSQL 17 SQL security suite (`bash scripts/test-db.sh`) | Pass in CI job `database-security` on two clean databases. **Not run locally** (no PostgreSQL 17 server was set up). |
| CI on the last code change | Success, jobs `validate` and `database-security`: https://github.com/A13Xg/Daydle/actions/runs/43575493346 (commit `a096e4b`). Later commits are documentation, review fixes and ops-script hardening; see the Copilot review below. |
| CI after the Copilot review fixes | Success, jobs `validate` and `database-security`: https://github.com/A13Xg/Daydle/actions/runs/43643095862 (commit `22e2df1`). |

### Hosted verification (production project, 2026-11-14)

- **Migrations:** both applied after a `supabase db push --dry-run` that listed exactly those two files. Read-only checks afterwards: 16 public and 2 `app_private` tables with row-level security enabled on all, 18 policies, trigger and `onboarding_completed` present, privileged friend-code functions not executable by `anon` or `authenticated`.
- **Hosting:** `https://daydle.agoodman.io` serves `/api/v1/health` (200, JSON, `no-store`) and the SPA routes over valid TLS; `workers.dev` returns 404.
- **Sign-in on an iOS device (owner-reported; browser not recorded):** Google and Apple both completed. Database evidence: two users (one Google identity, one Apple identity), each with exactly one `profiles` row and one `friend_codes` row, none missing and none duplicated; `profiles` has no email column and no display name equals an auth email; both accounts are onboarded with a display name and a five-character friend code. Apple used a private-relay address and supplied a name on first authorization.
- **Auth settings (read back from Supabase):** Site URL and redirect allowlist set to the production domain plus the local callback; Google and Apple enabled; email disabled.
- **Not verified here:** installed PWA behaviour, Safari-specific behaviour, email deliverability, password recovery, and whether the Google consent screen has been published (an owner action).

### Roadmap exit gates

| Gate | Result |
|---|---|
| Signup-to-profile flow passes on the primary target | **Verified** for Google and Apple on an iOS device (owner-reported) with hosted database evidence. Email/password not applicable (disabled). Installed PWA deferred. |
| Identity rules verified | **Verified:** SQL suite (250 registrations, uniqueness, fallback name, forced-collision retry, allocation failure aborting the signup with no partial registration, name truncation and blank-name fallback, function grants) and hosted privilege check. |
| Unauthorized access rejected | **Verified:** SQL suite (cross-user profile edits, friend-code reads, privileged function calls) and hosted function-grant check. |
| Recovery and callback handling validated | **Callback: verified** (mocked race and error tests plus live Google and Apple round trips). **Recovery: not verified,** out of scope by owner decision (no custom SMTP; Supabase's built-in sender only reaches team members). |

### Audit and review

- **Automated security review of the signup change** flagged unconfirmed email signup as an account pre-hijacking risk (see scope change 2). Resolved by keeping email/password disabled; `configure-turnstile.ps1` now defaults to leaving email unchanged and refuses unconfirmed signup without `-AcceptUnconfirmedEmailRisk`.
- **Earlier SQL repair:** schema-qualifying the special `COALESCE`/`NULLIF` expressions failed in CI and was fixed; code sampling skips UUID version and variant bytes.
- **Secret hygiene:** the repository, ops scripts, build output and docs were scanned for project references, account identifiers, provider identifiers and key patterns; none are committed. Secrets exist only in GitHub environment secrets, Supabase Auth settings and Windows Credential Manager.
- **Independent review** (a read-only Claude Opus subagent reviewed the whole branch diff against `origin/main`; verdict **ready after minor fixes**, no blockers). Findings and what was done:
  1. *Medium, verified:* the sign-up trigger copies the provider's real name into `profiles.display_name`, which anyone holding the public key can read, and marks onboarding complete. This matches IDEA.md ("accept a provider-supplied display name") but was undisclosed, and this archive wrongly said "full-name data not leaked". **Fixed:** the sign-in page and account page now say the name is public and can be changed, and the archive wording is corrected. **Owner decision still open:** whether provider names should instead require confirmation (a new forward migration setting `onboarding_completed` to false); tracked in the roadmap's Circle-Back section.
  2. *Medium:* `deploy-worker.ps1` deployed any branch, so the "main only" environment rule did not govern real deployments. **Fixed:** it now refuses anything except the tip of `origin/main` unless `-AllowNonMain` is passed, and the docs say the GitHub rules apply to Actions jobs only.
  3. *Low:* the "set a new password" form was reachable at `/account?reset=1` by any signed-in session. **Fixed:** removed.
  4. *Low:* the SQL tests did not exercise the retry or failure paths and one message was misleading. **Fixed:** added a forced-collision retry test, an allocation-failure test (the signup must abort with no user, profile or code left), anon and service_role grant checks, name truncation and blank-name checks; CI passes.
  5. *Low:* raw provider or Supabase error text could reach the sign-in page. **Fixed:** fixed copy. The account page still shows validation and Supabase messages; accepted as low risk.
  6. *Nits, accepted:* `random_friend_code` does not need `SECURITY DEFINER`, `btrim` strips only spaces, and `onboarding_completed` is user-writable. These are harmless, and the migration is already applied and forward-only. The credential name default `Daydle-Preview-Supabase-DB` is kept because it names the existing Credential Manager entry. Sign-out ends sessions on all devices (Supabase's default) and is now documented.
  7. *Documentation discrepancies* (about a dozen stale or wrong statements about the CAPTCHA widget, a preview environment, the password form, email sign-in, grants and CI references): all corrected.
  - **Not verifiable by the reviewer:** anything in the hosted environment, and PowerShell runtime behaviour. Hosted facts are recorded above from direct read-only checks and owner-reported device testing.

- **Copilot pull-request review** (GitHub's automated reviewer; six inline findings, three rated high). Five were fixed by Copilot Autofix commits made through the GitHub web interface and reviewed here; the sixth was fixed separately:
  1. *High:* `init-github-environment.ps1` continued after a failed environment-protection call and could write the database password into an unprotected environment. **Fixed:** it throws before any credential is written.
  2. *High:* rerunning with `-Branches main` left older branch, wildcard and tag policies in place. **Fixed:** it reads every policy and fails closed on anything outside the requested allowlist before writing credentials.
  3. *High:* `AccountPage` kept the previous user's profile, name draft and friend code when another tab changed the signed-in user. **Fixed:** the page is keyed by user ID so state resets on an identity change. Typecheck, lint and tests pass; **not exercised in a real two-tab browser session**.
  4. *Medium:* a failed `git fetch` left a stale `origin/main` for the deploy guard. **Fixed:** the script aborts on a fetch failure.
  5. *Medium:* unchecked `gh variable get` reads. **Fixed:** each read and value is checked, and the Supabase URL must be an https origin.
  6. *Medium:* `new-supabase-project.ps1` matched an existing project by name across all organizations. **Fixed in this branch** (not by Copilot): it matches name and organization and refuses on multiple matches.
  - The five Autofix commits carry a `Co-authored-by` trailer for the review tool. The owner reviewed this and accepted it. The PowerShell changes were checked by parsing and by testing the filter logic, **not by running the scripts against GitHub or Supabase**.
  - Dependabot reports a moderate `minimatch` advisory in the development-only lint toolchain (already open on `main`); it does not ship in the app or Worker and is tracked in the roadmap's Circle-Back section.

### Known limitations

- Email/password sign-up, email confirmation and password recovery are not available (disabled); no custom SMTP.
- Provider-supplied names (often real names) become public display names automatically and mark onboarding complete; users are told and can change them. Whether to require confirmation instead is an open owner decision.
- No public friend-code lookup exists yet, so lookup and enumeration rate limiting belong to Phase 9.
- Sign-out ends the session on every device (Supabase's default global scope).
- Apple's client secret **expires 2027-05-15**; re-run `scripts/ops/configure-apple-auth.ps1` before then or Apple sign-in fails.
- The keep-alive schedule runs only from the default branch, so it starts after this PR is merged; GitHub disables schedules in public repositories after 60 days without repository activity.
- The free Supabase tier has no automated backups. One project serves as production, so schema changes carry real risk once real users exist.
- The live Worker was deployed from this branch. After merging, redeploy from `main` so the deployed commit matches the merged one.

### Migration, deployment and rollback notes

- Migrations are forward-only and already applied to the hosted project; merging does not re-run them. Do not rewrite deployed migration history.
- Deployment is manual through `scripts/ops/deploy-worker.ps1` (clean tree required, hidden token prompt); CI never deploys. A bad web deploy is rolled back with Cloudflare's version rollback; database rollback is not assumed safe.
- Test accounts can be removed with `scripts/ops/purge-test-users.ps1` (dry run by default, destructive with `-Execute`).

### Deferred follow-ups

Tracked in the roadmap's Circle-Back section: installed-PWA authentication verification, email/password with confirmation and custom SMTP, Google branding and publishing, retiring or reworking dormant email-era code, and automated Apple secret rotation.

### Review and recovery

The branch can be reverted or closed without database rollback because the applied migrations are additive and forward-only. Hosted configuration changes were made through documented scripts and Supabase settings and are reversible there.
