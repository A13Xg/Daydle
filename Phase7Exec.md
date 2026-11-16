# Phase 7 Execution Plan — Result ingestion, history, and correction lifecycle

**Status:** PLANNING — no application changes implemented, tested, or deployed.
**Base:** `main` at `520ca5be730bc9ea45a7ffd00fbe85e6525625f3`, verified [Phase 6.5 PR #13](https://github.com/A13Xg/Daydle/pull/13) merged with [post-merge passing CI](https://github.com/A13Xg/Daydle/actions/runs/43970518949).
**Branch:** `phase/07-results-history-corrections`; **PR:** to be linked after opening.
**Sources:** [IDEA.md](IDEA.md) §§7–8, 11–12; [roadmap.md](roadmap.md) Phase 7; [AGENTS.md](AGENTS.md); [Phase 6 archive](completedPhases/Phase6Exec.md); [Phase 6.5 archive](completedPhases/Phase6.5Exec.md).

## Scope

Connect the existing five deterministic share parsers to a secure authenticated single-result API, transactional canonical persistence, duplicate detection, explicit correction/deletion, owner history and result details, and safe ambiguous/unknown input flows. Retain raw accepted text for no more than 90 days; never cache or log raw input.

## Planned acceptance gates

- Verify auth and server-only execution rights, user/game/puzzle ownership, replay idempotency, race safety, correction lineage, and retention metadata against isolated PostgreSQL security tests.
- Exercise Worker result endpoints with bounded inputs, invalid/unknown/ambiguous cases, unauthorized and cross-account access, and API contracts.
- Verify Paste→history interactions and accessibility without exposing private result content through cache or logs.
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, browser smoke, and two clean PostgreSQL 17 databases via CI.
- No production deployment, live migration, or privileged secret upload until separately authorized.

**No passing gates claimed at planning time.**
