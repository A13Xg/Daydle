# Daydle

**All your daily games. One place.**

Daydle is an iOS-first web application for discovering daily games, launching games on publisher websites, tracking shared results, viewing public statistics and comparing performance with friends. Phases 1–5 provide authentication, secure game discovery, user-selected Today, and an owner-accepted iPhone PWA. Phase 6 adds deterministic parsing; Phase 6.5's Obsidian Arcade UI is merged. [Phase 7 PR #14](https://github.com/A13Xg/Daydle/pull/14) merged result ingestion and private History source, and its hosted SQL migration was owner-authorized and applied to Daydle Preview. The owner authorized Worker deployment to `daydle.agoodman.io`; actual release and authenticated acceptance are still pending. Public statistics and comparisons remain future phases.

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

The daily return screen is at **[/today](/today)** (also the application home). It displays your selected games, manual played markers and publisher launch links, with a global user-initiated Paste shell. Read [docs/pwa.md](docs/pwa.md) for install, offline, privacy and manual iOS acceptance checks. **Phase 5 SQL was applied in the owner-approved November 16, 2026 release.** Later deployments/migrations still require authorization.

Public game discovery is at **[/games](/games)**, with per-game details at `/games/:slug`. Selecting favorites requires Google/Apple sign-in; the catalog is browsable anonymously. The current deployed catalog remains launchable without result persistence; the merged Phase 7 source adds authenticated result ingestion behind separately authorized Worker secrets/deployment and hosted integration acceptance; the Phase 7 SQL is already applied to Daydle Preview. Five deterministic share parsers from Phase 6 are merged ([PR #12](https://github.com/A13Xg/Daydle/pull/12)); see [docs/parsers.md](docs/parsers.md) for coverage and constraints. Review the Phase 7 implementation and rollout requirements in [docs/results.md](docs/results.md). See [docs/catalog.md](docs/catalog.md) for seed data, safe URLs, owner selections, and admin RPC permissions. **Phase 4 SQL was applied in the owner-approved Phase 5 release.**

Database schema, test roles and security boundaries are documented in [docs/database.md](docs/database.md). Supabase authentication flow and provider setup are in [docs/auth.md](docs/auth.md); hosting credentials and scopes in [docs/secrets.md](docs/secrets.md). CI tests the migration on two disposable PostgreSQL 17 databases without hosted Supabase credentials. Migrations are applied to the hosted project only with the owner's explicit approval.

Deployment and environment isolation are documented in [docs/deployment.md](docs/deployment.md). No production deployment is authorized merely by running CI or completing a phase.

## Interface design

Obsidian Arcade's dark palette, locally bundled Plus Jakarta Sans, three screen shells and five-tab navigation were integrated in [Phase 6.5](https://github.com/A13Xg/Daydle/pull/13). The [UI architecture and route matrix](docs/ui-architecture.md) distinguish shipped functionality from display-only future states. The mockups are design references, **not** permission to add fabricated social statistics or notifications.

## Repository guidance

- [IDEA.md](IDEA.md) — approved product requirements and architectural invariants.
- [roadmap.md](roadmap.md) — numbered delivery phases and their review gates.
- [AGENTS.md](AGENTS.md) — mandatory branch, draft PR, verification, and review protocol.
- [completedPhases/](completedPhases/) — reviewed and verified execution plans for finished phases (currently Phases 1–6.5, including owner-attested Phase 5 PWA device acceptance).
- [scripts/ops/](scripts/ops/README.md) — PowerShell helpers for provisioning, secrets, provider setup, deployment and test-account cleanup. They contain no credentials.
- [referenceFiles/](referenceFiles/readme.md) — owner-approved Obsidian Arcade visual system and 13 screen examples, implemented in Phase 6.5. Examples do not expand the feature contract.
- A root-level `Phase#Exec.md` exists only while its phase is actively being implemented.

Obsidian Arcade is the approved visual standard; its React implementation is merged in [Phase 6.5 PR #13](https://github.com/A13Xg/Daydle/pull/13). Phase 7 source is also merged but not deployed; the live PWA remains on the earlier authorized release. Web/PWA remains the shipping platform, with future iOS packaging compatibility influencing architecture only.
