# Phase 3 Execution Plan — Authentication, onboarding, and account identity

**Status:** PLANNING
**Base:** `main` at `87b2a71d98f74268ad930a0c31d73e51f737bc6e`
**Branch:** `phase/03-auth-onboarding`
**Source:** [roadmap.md](roadmap.md#phase-3--authentication-onboarding-and-account-identity), [IDEA.md](IDEA.md), [AGENTS.md](AGENTS.md)

## Initial scope and acceptance gates
- Implement email/password signup, confirmation, login, recovery and logout; Apple/Google OAuth with secure browser callbacks and sessions.
- Create a profile and cryptographically random five-character friend code automatically on auth-user creation, using a unique index and bounded atomic retry.
- Support display-name onboarding and owner-only profile editing; do not require a password for OAuth-only accounts.
- Run isolated PostgreSQL migration/role/trigger tests plus frontend authentication tests and existing CI.
- Verify hosted OAuth and iOS behavior when a preview Supabase project and provider configuration become available. Do not invent results.

**Next:** Open the draft PR, expand and self-review this plan, then implement. Hosted credentials are not yet required for schema and source work.
