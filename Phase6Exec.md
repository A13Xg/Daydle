# Phase 6 Execution Plan — Deterministic parser registry and initial game coverage

**Status:** PLANNING — no parser implementation begun.
**Base:** `main` at `374b97f028137a51d19c47591b7aa146cf1e70f6` (PR #11 merged; current main CI passed).
**Branch:** `phase/06-deterministic-parsers`.
**Roadmap:** [Phase 6](roadmap.md#phase-6--deterministic-parser-registry-and-initial-game-coverage).
**Prerequisite:** Phase 5 source and production rollout merged; owner reports all eight physical-device acceptance checks passed. Reconcile/record completion evidence and archive Phase 5 before Phase 6 implementation.

## Planned scope and gates

- Review `IDEA.md`, `AGENTS.md`, `roadmap.md`, Phase 5 source and archived evidence; update approved Obsidian Arcade design authority, compatibility guidance, stale Phase 5 documentation and on-device acceptance.
- Build server-safe, deterministic, versioned parsers for 5–10 existing catalog games with typed detection, bounded normalization, parsing and validation, puzzle identity resolution and conservative ambiguity handling. Keep registry separate from catalog metadata.
- Validate each format with documented legitimate sample provenance, malformed/ambiguous/unicode/loss fixtures, false positives, and stable versions. Do not persist submissions or expose parser API until Phase 7.
- Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build` in CI; execute database regression suites where configured. Review security, parser boundedness, no raw input logging, branch delta, and no tool attribution.
- Keep changes on this branch/PR; no production migration/deployment, no `main` writes and no merging without owner action.

**Not verified yet:** all implementation and test gates.
