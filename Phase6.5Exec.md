# Phase 6.5 Execution Plan — Obsidian Arcade UI/UX overhaul

**Status:** PLANNING — execution plan scaffold. No application changes yet.
**Base:** verified `main` at `99401d5b31242c139f77d3700c2f2a7e3c12ada6`, merge of [PR #12](https://github.com/A13Xg/Daydle/pull/12), with [passing main CI](https://github.com/A13Xg/Daydle/actions/runs/43930997408).
**Branch:** `phase/06.5-obsidian-arcade-ui`.
**Dependencies:** Phases 0–6 merged. Phase 6 roadmap status requires post-merge reconciliation from IN REVIEW to COMPLETE on this branch.
**Authority:** [IDEA.md](IDEA.md), [AGENTS.md](AGENTS.md), [roadmap.md](roadmap.md), approved [Obsidian Arcade DESIGN.md](referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md), 13 reference screens.

## Planned scope

Implement approved dark-only theme, three layout archetypes, five primary tabs, mobile-first accessible navigation and shared tokens; redesign existing Today, Discover, Account, Auth, Game Detail and Paste without altering their backend/security/clipboard behavior. Future Statistics and Friends display honest not-yet-available states. Visual examples are not a feature contract; do not implement invented ranking, requests, push alerts or auto-launch.

## Planned gates

- Review actual components/styles/tests and examples before code; expand this plan and self-audit.
- Verify PWA safe areas, thumb targets, focus semantics, keyboard navigation, reduced motion, 320–1024+ responsive behavior, empty/loading/error/offline states, parser/ingestion separation, privacy.
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, both disposable PostgreSQL 17 test suites, plus browser rendering/device testing where available.
- No production deploy or hosted migration; no native iOS packaging. Record any unverified real-device gate explicitly. Archive plan and mark PR ready only after required checks pass.

**Review state:** Draft PR planning, tests for UI implementation NOT RUN.
