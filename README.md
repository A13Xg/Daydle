# Daydle

**All your daily games. One place.**

Daydle is an iOS-first web application for discovering daily games, launching games on publisher websites, tracking shared results, viewing public statistics and comparing performance with friends. Phase 1 currently provides only the application foundation; product functionality is implemented in later phases.

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

Deployment and environment isolation are documented in [docs/deployment.md](docs/deployment.md). No production deployment is authorized merely by running CI or completing a phase.

## Repository guidance

- [IDEA.md](IDEA.md) — approved product requirements and architectural invariants.
- [roadmap.md](roadmap.md) — numbered delivery phases and their review gates.
- [AGENTS.md](AGENTS.md) — mandatory branch, draft PR, verification, and review protocol.
- [completedPhases/Phase1Exec.md](completedPhases/Phase1Exec.md) — reviewed Phase 1 execution plan (on phase branch; on main after PR merge).
- A root-level `Phase#Exec.md` exists only while its phase is actively being implemented.
- [completedPhases/](completedPhases/) — completed and audited phase execution plans.

Visual design details remain deferred, but accessible and polished interaction behavior is required.
