# Daydle

**All your daily games. One place.**

Daydle is an iOS-first web application for discovering daily games, launching games on publisher websites, tracking shared results, viewing public statistics and comparing performance with friends. Phases 1–3 provide the application foundation, the database schema with row-level security, and Apple and Google sign-in with automatic profile and friend-code creation; game features arrive in later phases.

## Local development

Requires Node.js 22+ and npm. With a tracked lockfile, use `npm ci`.

```sh
npm ci
npm run dev
```

The app shell and API health endpoint work without a Supabase project or credentials. Visit the URL printed by Vite.

| Script | Purpose |
|---|---|
| `npm run dev` | React + Worker local development |
| `npm run typecheck` | Strict TypeScript checks |
| `npm run lint` | ESLint |
| `npm run format:check` | Prettier validation |
| `npm test` | Vitest unit/API contract tests |
| `npm run build` | Production Worker + SPA bundle |
| `npm run preview -- --port 4173` | Local preview of built Worker and SPA |
| `npm run smoke` | HTTP smoke (requires running preview) |
| `npm run db:test` | PostgreSQL 17 migration/constraint/RLS tests (requires disposable test server) |

The daily return screen is at **[/today](/today)** (also the application home). It displays your selected games, manual played markers and publisher launch links, with a global user-initiated Paste shell. Read [docs/pwa.md](docs/pwa.md) for install, offline, privacy and manual iOS acceptance checks. **The Phase 5 migration must be applied before deploying this frontend**; neither deployment nor migration occurs automatically.

Public game discovery is at **[/games](/games)**, with per-game details at `/games/:slug`. Selecting favorites requires Google/Apple sign-in; the catalog is browsable anonymously. All catalog entries remain unsupported by Daydle result parsing until Phase 6. See [docs/catalog.md](docs/catalog.md) for seed data, safe URLs, owner selections, and admin RPC permissions. **The Phase 4 migration must be approved and deployed before publishing the new catalog UI to production.**

Database schema, test roles and security boundaries are documented in [docs/database.md](docs/database.md). Supabase authentication flow and provider setup are in [docs/auth.md](docs/auth.md); hosting credentials and scopes in [docs/secrets.md](docs/secrets.md). CI tests the migration on two disposable PostgreSQL 17 databases without hosted Supabase credentials. Migrations are applied to the hosted project only with the owner's explicit approval.

Deployment and environment isolation are documented in [docs/deployment.md](docs/deployment.md). No production deployment is authorized merely by running CI or completing a phase.

## Repository guidance

- [IDEA.md](IDEA.md) — approved product requirements and architectural invariants.
- [roadmap.md](roadmap.md) — numbered delivery phases and their review gates.
- [AGENTS.md](AGENTS.md) — mandatory branch, draft PR, verification, and review protocol.
- [completedPhases/](completedPhases/) — reviewed and verified execution plans for finished phases (currently Phases 1–3; Phase 3 is in review on its branch until PR #3 merges).
- [scripts/ops/](scripts/ops/README.md) — PowerShell helpers for provisioning, secrets, provider setup, deployment and test-account cleanup. They contain no credentials.
- [referenceFiles/](referenceFiles/readme.md) — optional UI/UX mockups and one reference design system (web + iOS/Xcode guidance). Reference only; nothing there needs to be implemented unless explicitly requested.
- A root-level `Phase#Exec.md` exists only while its phase is actively being implemented.

Visual design details remain deferred, but accessible and polished interaction behavior is required.
