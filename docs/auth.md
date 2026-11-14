# Authentication and account identity — Phase 3

Phase 3 delivers Supabase Auth client flows and database-owned profile provisioning. All runtime credential setup is intentionally distinct from the migration/CI test fixture.

## Implemented flows

1. **Email/password signup:** a display name, email and password are submitted to Supabase Auth. When email confirmation is enabled, Daydle shows a verification-pending state; it does not represent the user as signed in. The auth-user trigger atomically creates one public profile and one private five-character friend code.
2. **Email/password login:** Supabase Auth establishes and refreshes the browser session; the application restores it on reload. Sign-out uses Supabase Auth, not local token manipulation.
3. **Google/Apple OAuth:** the browser starts a PKCE authorization flow and returns to `/auth/callback`; code exchange is deduplicated to tolerate React StrictMode remounts. The redirect destination is fixed and same-origin. OAuth users do not need passwords.
4. **Name onboarding:** Supabase `auth.users.raw_user_meta_data` is used when available. Missing provider name defaults to `Player` with onboarding incomplete; the signed-in owner can set a display name without privileged Worker credentials.
5. **Password recovery:** Supabase sends the recovery email; the authorized callback can open `/account?reset=1` for a new password via `auth.updateUser`.
6. **Friend code:** generated from cryptographic UUID random bytes (excluding UUID version/variant bytes), unbiased 31-character sampling, atomic unique insert with up to 32 attempts. It is read-only to the owner. Friend connections, QR and code lookup are planned for Phase 9.

## Browser configuration (not GitHub secrets)

Set these **public** values in the GitHub `production` environment (used by `scripts/ops/deploy-worker.ps1`) or in the developer's gitignored `.env.local`:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` key from the project |
| `VITE_TURNSTILE_SITE_KEY` | Optional. Public Cloudflare Turnstile site key; enables the sign-up CAPTCHA widget |

These are *not* privileged secrets. Never put the `sb_secret_` key, a legacy service-role JWT, or the Turnstile **secret** key into `VITE_*` variables.

The app supports build, placeholder startup, and mock/SQL tests with **none of these values configured**; sign-in controls remain disabled and describe missing configuration.

## Hosted configuration (production)

The app is served at `https://daydle.agoodman.io` by a Cloudflare Worker against a single free-tier Supabase project that is treated as production. There is no separate preview project or GitHub environment. Provisioning used the PowerShell helpers in [scripts/ops](../scripts/ops/README.md); no credentials are stored in the repository.

1. **Database:** both ordered migrations from `supabase/migrations/` are applied (after a dry run). Row-level security is enabled on every table and the auth-user trigger creates the profile and friend code. Never run `tests/sql/bootstrap.sql` or fixture data against the hosted project.
2. **URLs:** the Supabase Site URL is `https://daydle.agoodman.io`. The redirect allowlist holds `https://daydle.agoodman.io/auth/callback` and `http://localhost:5173/auth/callback` (local development).
3. **Email/password:** enabled, with a minimum password length of 8 and **email confirmation not required** (see the policy below).
4. **Google:** configured from an OAuth web client whose authorized redirect URI is the Supabase-hosted `https://PROJECT_REF.supabase.co/auth/v1/callback`. The consent screen is in Testing mode, so only listed test users can sign in until it is published. Client credentials live only in Supabase.
5. **Apple:** configured from an Apple Services ID, Key ID, Team ID and `.p8` signing key. Apple's client secret is a JWT generated locally by `scripts/ops/configure-apple-auth.ps1` and **expires after about six months** (the script prints the date; the current one is 2027-05-15). Re-run it before then or Apple sign-in fails while other methods keep working. Keep the `.p8` in a password manager, never in the repository. Apple web OAuth often returns no name; Daydle asks for one during onboarding.
6. **Custom SMTP:** not configured. Supabase's built-in sender only reaches project team members and is heavily rate limited.

## Email signup without confirmation, and bot protection

By the owner's decision, email/password accounts are created **without email confirmation**. Because the publishable key is public, anyone can call the Supabase Auth API directly, so a bot could otherwise create unlimited accounts. The baseline defence is **Cloudflare Turnstile**, enforced by Supabase itself (not just by the web form):

- Supabase requires a valid Turnstile token for email sign-up, sign-in and password recovery; the site sends one from the widget. Tokens are single use, so the form requests a fresh challenge after every attempt.
- The Turnstile **secret key** is stored only in Supabase Auth settings; the public **site key** is the variable `VITE_TURNSTILE_SITE_KEY`. `scripts/ops/configure-turnstile.ps1` sets both and enables email signup in a single request, so signup is never open without the check.
- Google and Apple sign-in are not CAPTCHA-gated; they already require a real provider account.
- This is basic protection, not a complete anti-abuse system. Determined or paid-solver attacks, per-IP throttling, disposable-email filtering and account clean-up are out of scope for Phase 3.

Consequences to keep in mind:

- Email addresses on email/password accounts are **unverified**. Anyone can register any address, so never use an email address as proof of identity or as a trust or discovery signal. Daydle never exposes emails publicly.
- **Password recovery email will not reach most users** until custom SMTP is configured, because the built-in sender only delivers to team members. Treat recovery as unavailable for general users for now.
- To require confirmation later, configure SMTP, then turn confirmation back on in Supabase Auth; the sign-up form already handles both outcomes.

## Verification status

Source correctness is established by SQL tests on disposable PostgreSQL and mocked SDK tests. Those are **not proof** of the hosted flows below.

| Flow | Hosted configuration | Tested on a real device |
|---|---|---|
| Email sign-up and login with CAPTCHA | Configured | NOT VERIFIED |
| Password recovery email | Built-in sender only (team members) | NOT AVAILABLE for general users until SMTP |
| Google sign-in | Configured | NOT VERIFIED |
| Apple sign-in | Configured | NOT VERIFIED |
| Profile and friend-code rows created by the trigger on the hosted database | Migrations applied | NOT VERIFIED with a real signup |

Device checklist: on iPhone Safari and the installed PWA, sign up and sign in with each method, confirm one `public.profiles` and one `public.friend_codes` row per user, confirm the email never appears in `public.profiles`, check the Apple private-relay case, then sign out and confirm the session is cleared.

## GitHub secret requirements and timing

See [secrets.md](secrets.md). To run future **automated** hosted migrations, use `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as GitHub Environment secrets and `SUPABASE_PROJECT_ID` as a variable. These are **not required for the current PR's isolated tests**, and setting them does not authorize deployment.

Do not create a custom OAuth proxy, copy passwords into the application database, or add a privileged Worker key merely to bypass normal Supabase account provisioning.

## Local and CI checks

`npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run smoke`, and `bash scripts/test-db.sh` on disposable PostgreSQL 17 as described in [database.md](database.md).

CI tests actual SQL trigger and role constraints on two clean databases; frontend auth adapter tests mock SDK network calls. Live provider/device integration requires real preview configuration and explicit authorization.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [password signup](https://supabase.com/docs/guides/auth/passwords), [OAuth](https://supabase.com/docs/reference/javascript/auth-signinwithoauth), [Sign in with Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).
