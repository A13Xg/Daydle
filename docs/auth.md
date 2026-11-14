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

When a real Supabase project is available, set these **public** values on the preview site or in the developer's gitignored `.env.local`:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` key from the project |

These are *not* privileged secrets. Never put the `sb_secret_` key or a legacy service-role JWT into `VITE_*` variables.

The app supports build, placeholder startup, and mock/SQL tests with **neither value configured**; sign-in controls remain disabled and describe missing configuration.

## Hosted Supabase setup needed for live verification

Only when an actual preview environment is authorized:

1. Create the Supabase project and obtain the project reference, URL and publishable key.
2. Apply **both ordered migrations** from `supabase/migrations/` to the preview database (through an approved migration job or explicit CLI invocation). Do not run `tests/sql/bootstrap.sql` or fixture data against hosted Supabase.
3. In Auth settings, allow email/password registration, enable email confirmation for the target policy, and set the Site URL to the preview domain. Add `https://PREVIEW_HOST/auth/callback` and local `http://localhost:5173/auth/callback` to the redirect allowlist where applicable.
4. Configure Google provider using an OAuth client ID/secret in the **Supabase Auth provider configuration**, with the Supabase-hosted `/auth/v1/callback` as the Google OAuth redirect. These secrets belong in the provider console/Supabase, not the Vite frontend.
5. Configure Apple web OAuth using an Apple Developer web Services ID, signing key and required identifiers in the **Apple/Supabase provider consoles**. Apple web OAuth often does not include the user's full name; Daydle requests name onboarding when absent. The Apple generated client secret requires periodic renewal (normally every six months).
6. Test email registration + confirmation, login, password recovery, OAuth callbacks and logout on a real iPhone Safari session and an installed PWA. Check private relay emails if using Apple.
7. Confirm `public.profiles` and `public.friend_codes` are inserted by the auth-user trigger, and the email never appears in public profiles.

Hosted provider setup and an actual domain are currently **not available**. Tests based on SQL/stand-in auth and mocked SDK calls establish source correctness but are **not proof** of a real hosted Apple/Google callback or email deliverability.

## GitHub secret requirements and timing

See [secrets.md](secrets.md). To run future **automated** hosted migrations, use `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as GitHub Environment secrets and `SUPABASE_PROJECT_ID` as a variable. These are **not required for the current PR's isolated tests**, and setting them does not authorize deployment.

Do not create a custom OAuth proxy, copy passwords into the application database, or add a privileged Worker key merely to bypass normal Supabase account provisioning.

## Local and CI checks

`npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, `npm run smoke`, and `bash scripts/test-db.sh` on disposable PostgreSQL 17 as described in [database.md](database.md).

CI tests actual SQL trigger and role constraints on two clean databases; frontend auth adapter tests mock SDK network calls. Live provider/device integration requires real preview configuration and explicit authorization.

References: [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data), [password signup](https://supabase.com/docs/guides/auth/passwords), [OAuth](https://supabase.com/docs/reference/javascript/auth-signinwithoauth), [Sign in with Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).
