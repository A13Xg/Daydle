# Daydle

**All your daily games. One place.**

Daydle is a mobile-first, iPhone-oriented React/PWA companion for external daily games: discover publisher games, customize your rotation, launch externally, submit publisher share text, review personal history/statistics, and compare permitted scores with friends. Games themselves remain on publisher websites.

## Project status

**Source:** Phases 1–13 merged; latest [main CI](https://github.com/A13Xg/Daydle/actions/runs/44172784193) passed on `2042288` (November 17, 2026).

**Hosted release:** The last confirmed protected Worker deploy is [run #44045005321](https://github.com/A13Xg/Daydle/actions/runs/44045005321) at `9098fdc` (Phase 10). Phase 11/12 migrations have now been applied and checked in Supabase; later source merges remain **not** proof that Worker APIs are deployed. [Phase 14 beta readiness](Phase14Exec.md) is in progress.

**Public beta: NOT YET APPROVED.** Before release: reconcile the applied Phase 11/12 migration versions (verified in Supabase), perform protected Worker deployment, scheduled raw-data purge, genuinely independent encrypted offsite backups and isolated recovery/deletion reconciliation, two-account/admin authenticated flows, and iOS Safari/installed-PWA accessibility/device acceptance. See [beta go/no-go](docs/beta-release.md) and [quality matrix](docs/quality-matrix.md).

## Development

Requires Node 22+ and npm:

```sh
npm ci
npm run dev
```

| Check | Command |
|---|---|
| TypeScript | `npm run typecheck` |
| Lint and format | `npm run lint && npm run format:check` |
| Unit/contract tests | `npm test` |
| Build | `npm run build` |
| Local HTTP/PWA smoke | `npm run preview -- --port 4173` then `npm run smoke` |
| Chromium accessibility/viewport | `node scripts/ui-smoke.mjs` against local preview |
| Dual disposable PostgreSQL 17 RLS | `npm run db:test` with test DB configured |
| Public beta read-only probes | `node scripts/ops/beta-preflight.mjs --live` (explicit network opt-in; not a deploy) |

No real credentials are required for the source CI jobs; never put Supabase service-role keys in `VITE_*` values. Production GitHub Actions are protected and main-only.

## Product and engineering documentation

- [Product scope](IDEA.md), [roadmap/status ledger](roadmap.md), [repository execution protocol](AGENTS.md)
- [Approved Obsidian Arcade UI system](referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md) and [UI architecture](docs/ui-architecture.md)
- [Parsers](docs/parsers.md), [results/history](docs/results.md), [scoreboard spoiler rules](docs/comparisons.md)
- [OAuth](docs/auth.md), [catalog](docs/catalog.md), [administration](docs/administration.md)
- [Deployment/release](docs/deployment.md), [secrets](docs/secrets.md), [beta operations](docs/beta-release.md), [privacy data map](docs/privacy-data-map.md)
- [Phase 12 recovery blockers](Phase12Exec.md), [Phase 13 device/QA blockers](Phase13Exec.md), [source acceptance matrix](docs/quality-matrix.md)

**Release controls:** Merging a PR never authorizes migration, production deployment, user-data deletion, or public launch. Each requires independent explicit approval and verification.
