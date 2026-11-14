# Phase 3 Execution Plan — Authentication, onboarding, and account identity

**Status:** IMPLEMENTED; HOSTED ENVIRONMENT PROVISIONED / BLOCKED ON REAL-DEVICE AUTH VERIFICATION (draft PR; not ready for review)  
**Base:** main `87b2a71d98f74268ad930a0c31d73e51f737bc6e`, following merged Phase 2 PR #2 (`b4a1140`).  
**Branch:** `phase/03-auth-onboarding`; **Draft PR:** [#3](https://github.com/A13Xg/Daydle/pull/3).  
**Sources:** [IDEA.md](IDEA.md), [roadmap.md](roadmap.md#phase-3--authentication-onboarding-and-account-identity), [AGENTS.md](AGENTS.md), [Phase 2 archive](completedPhases/Phase2Exec.md).

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
| Friend-code allocation | Trigger only | Cryptographic 31-symbol generator and unique constraint/retry |
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

- [ ] Both fresh PG17 databases replay Phase 2+3 migrations in order.
- [ ] Trigger creates exactly one profile+unique code for email and provider metadata, including missing-name fallback; 200+ registrations generate unique 5-character codes.
- [ ] Unprivileged users cannot call privileged code generators, edit others' profiles or read other's friend code; profile update owner-only and full-name data not leaked.
- [ ] Email signup/login/recovery and OAuth provider call adapters have realistic success, pending and error tests, including validated redirect paths.
- [ ] Callback duplicate-exchange avoidance, session restoration and recovery flow behave under React StrictMode and URL errors.
- [ ] All `npm ci`, typecheck, lint, format, unit, build, Worker smoke and PostgreSQL security jobs pass.
- [ ] Explicit external integration gate: actual Google/Apple callback, email link, and iOS Safari login cannot be called verified without a configured preview Supabase project/provider. Credentials **do not block source or isolated tests**; surface them once they actually gate review.
- [ ] No remote database deploy or production change without authorization.

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

### Implementation completed on phase branch

- `supabase/migrations/20261114060000_phase3_auth_identity.sql`: forward migration for onboarding flag, privileged account-registration trigger, secure unbiased five-character friend-code creation, unique collision retry and restricted EXECUTE grants.
- Local SQL bootstrap/fixtures and `scripts/test-db.sh` updated to replay **Phase 2 + Phase 3** against two fresh PostgreSQL 17 databases. Added `tests/sql/auth-assertions.sql` with 250 additional registrations, owner-only profile update, code uniqueness, forbidden privileged calls and profile fallback checks.
- Browser Supabase client configured for PKCE, persisted sessions and explicit callback handling. Email/password signup/login/verification pending, password recovery, Apple/Google OAuth request, callback exchange/StrictMode de-duplication, session restoration, signout, account profile/onboarding state and owner-only friend-code display are implemented.
- Functional account/login/recovery/error/loading states were added without fixing the final visual styling.
- `docs/auth.md` documents required provider setup, migrations, callback allowlisting and Apple signing-key renewal. `AGENTS.md` now requires alerting the user only when credentials actually block an essential gate.
- App smoke checks include `/auth`, `/auth/callback`, `/account` and homepage SPA navigation.

### Executed tests and review

- **Final nonmutating source CI:** https://github.com/A13Xg/Daydle/actions/runs/43563613098 — both `validate` and `database-security` succeeded.
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` and preview `npm run smoke` passed.
- **27 Vitest tests** pass, including auth action validation, SDK call contracts, OAuth unsafe URL rejection, callback single-use race handling and rendered account form semantics.
- Both isolated PostgreSQL databases replay both migrations and pass Phase 2 security plus Phase 3 registration/identity assertions. No hosted credentials or privileged API were used.
- PR code-review scan found no embedded secrets, unsafe HTML injection, arbitrary dynamic evaluation or contributor metadata. All source commits use authenticated repository identity and remain isolated to Phase 3.
- Early SQL failure due to schema-qualifying special `COALESCE/NULLIF` expressions was repaired and rerun; cryptographic code sampling skips UUID metadata bytes. Temporary formatting job was removed; the current workflow is nonmutating.
- No hosted Supabase migration, real email delivery, Apple/Google browser callback, or iOS device/PWA end-to-end test has been run.

### Hosted environment provisioning (record)

After the isolated source work above, the hosted environment was provisioned with the PowerShell helpers in [scripts/ops](scripts/ops/README.md). No credentials are committed.

- **Project and database:** one free-tier Supabase project (region us-east-2), treated as production by owner decision; no separate preview project. Both ordered migrations were applied after a dry run. Read-only checks afterwards showed 16 public and 2 `app_private` tables with row-level security on every one, 18 policies, the auth-user trigger present, the `onboarding_completed` column present, privileged friend-code functions not executable by `anon` or `authenticated`, and zero rows in `profiles`, `friend_codes` and `auth.users`.
- **Hosting:** the Worker is deployed with the custom domain `daydle.agoodman.io` (health endpoint and SPA routes return 200 over valid TLS). `workers.dev` and preview URLs are disabled in `wrangler.jsonc`.
- **GitHub:** a single protected `production` environment (required reviewer, `main` only) holds the public Supabase and Cloudflare values and the deployment secrets. Fork-PR workflow approval is required for all external contributors. A scheduled keep-alive workflow (`.github/workflows/keepalive.yml`) prevents free-tier inactivity pausing once it is on `main`.
- **Auth settings:** Site URL and redirect allowlist set to the production domain (plus the local callback); Google and Apple providers configured; email/password is currently **disabled**. The owner asked for signup without email confirmation behind a Turnstile CAPTCHA, but an automated security review identified account pre-hijacking through automatic identity linking, so the owner decided on Google and Apple sign-in only and email/password stays disabled (see [docs/auth.md](docs/auth.md)). Custom SMTP is not configured.
- **Code added for that request:** an optional Turnstile widget on the auth form (dormant until a site key is configured), token pass-through on sign-up, sign-in and recovery, and tests (35 Vitest tests now pass; typecheck and lint pass). `configure-turnstile.ps1` defaults to leaving email sign-in unchanged and refuses unconfirmed signup without `-AcceptUnconfirmedEmailRisk`.
- **Owner decisions recorded:** Apple client secret expires 2027-05-15 and must be regenerated before then. **Decided:** Google and Apple sign-in only for Phase 3; email/password stays disabled. Email sign-up, login and password recovery are therefore out of the hosted Phase 3 acceptance scope. This is a recorded owner scope change: the roadmap exit text still mentions recovery. Revisit with custom SMTP and email confirmation required.

### Remaining Phase 3 gate

**Source implementation, isolated CI and hosted provisioning are complete.** Not yet done, and therefore **NOT VERIFIED**:

1. Email sign-up, login and logout on iPhone Safari and the installed PWA, **only if email/password is enabled** (currently it is not).
2. Google and Apple sign-in callbacks on the same devices (Google test users must include the tester).
3. A real signup producing exactly one `public.profiles` and one `public.friend_codes` row, with the email absent from `public.profiles`.
4. Password recovery: not applicable while email/password is disabled; recorded as out of scope for Phase 3 by the owner's decision above.

Until these are verified (or the acceptance scope is explicitly changed by the owner), the PR must remain **draft** and this plan must remain active at the repository root. Do not archive it, mark Phase 3 IN REVIEW or COMPLETE, merge, or start Phase 4.

### Review and recovery

No remote services, database or production environments were modified. A branch can be reverted/closed without data migration rollback. Once hosted migration is explicitly authorized and performed, changes must be forward-only; do not rewrite deployed migration history.

