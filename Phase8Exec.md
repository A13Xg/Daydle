# Phase 8 Execution Plan — Personal statistics, streaks, and achievements

**Status:** PLANNING — source-only development, acceptance NOT VERIFIED.
**Branch:** `phase/08-personal-statistics-achievements`
**Base:** `main` at `d0c693035f297d044a0663e6baf9d3e182b5d2e2`.
**Dependency:** Phase 7 source merged in PR #14; hosted Phase 7 SQL migration authorized, applied, and verified on Daydle Preview. Phase 7 Worker secret setup, deployment and authenticated hosted E2E remain separate release gates. Owner requested continued roadmap development without coupling source work to deployment.
**Authority:** IDEA.md §§7–9, roadmap.md Phase 8, AGENTS.md, Obsidian Arcade DESIGN.md.

## Intended scope

- Secure owner-specific read-only personal aggregate API sourced from canonical Phase 7 results.
- Universal counts, distinct local activity days, active/longest local-day streak; game-specific outcome counts, metrics distributions and personal bests only where supported by game metrics.
- Timezone correctness, correction/delete immediate recomputation, rule-driven non-fabricated achievements.
- Live Statistics UI in the approved Obsidian Arcade system with empty, loading, signed-out, error and offline states.
- Tests for privacy, timezone boundaries, deterministic metrics, API, UI, database security and correction invalidation.

## Exclusions

No Worker deployment, secret changes, new publisher parsers, public ranking, friendship, spoiler-leaking public endpoints, native packaging or physical-iPhone testing. Phase 7 hosted OAuth/E2E remains a separate acceptance gate.

## Required review before application coding

Inspect Phase 7 result schema/Worker auth, database migrations, game metrics and cadence metadata, UI tokens and current tests. Decide aggregation contract with explicit timezone semantics. Implement only using trusted canonical results; no cross-game scoring, inferred puzzle dates or fabricated achievements. Prefer on-demand aggregation with no materialized cache. Explicitly handle null puzzle dates and ambiguous publisher release metadata.

## Verification

Typecheck, lint, Prettier, tests, build, browser viewports, two isolated PostgreSQL RLS databases where available, and review of permissions/logging/corrections. Keep this plan active and PR draft until material gates pass. Post-merge hosted release verification remains separate.
