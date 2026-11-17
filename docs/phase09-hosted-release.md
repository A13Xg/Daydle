# Phase 9 hosted release-preflight reconciliation

**Purpose:** Approved Daydle Preview Phase 9 migration is recorded at Supabase Management API version `20261117051824`, name `20261117050000_phase9_social`. Source migration in PR #16 uses pre-apply filename; the protected deploy workflow must match the *actual* recorded version before a main-only release.

- Rename existing forward-only migration SQL **without modifying content** to `20261117051824_20261117050000_phase9_social.sql`.
- Extend `check-hosted-migrations.mjs` strict allowlist with exactly this version/name; keep unknown/missing/out-of-order histories rejected.
- Update existing tests for seven reviewed migrations; test live routes for Phase 9 anonymous auth denial and absent public player without caching or score leakage.
- No schema write, secret read, Cloudflare deploy, bypass or automatic merge in this PR. The user authorized deploying; deployment still depends on this gate reaching `main` and the protected production environment.
- Hosted verification: migration present; private RPC grant checks and RLS passed. Authenticated live social interaction and Cloudflare release remain NOT VERIFIED.
