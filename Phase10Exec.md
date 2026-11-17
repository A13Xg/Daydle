# Phase 10 Execution Plan — Spoiler-safe comparisons, scoreboards and rankings

**Status:** PLANNING
**Branch:** `phase/10-spoiler-safe-comparisons`
**Base:** main `9df11aa111732b69105b53c9927eb397374c9db3`; Phase 9 PR #16 merged at `d47d360b` and CI run #44022863047 PASS.
**Dependencies:** Phase 9 source present. Hosted Phase 9 SQL applied on Daydle Preview (recorded `20261117051824`), runtime release remains gated through PR #17 and the protected deployment workflow.

## Roadmap scope
- One server-authoritative, viewer-and-puzzle-specific spoiler policy across public profiles, result endpoints, friend-filtered rankings, pagination, aggregates and cache behavior. Unlock only upon **the same viewer's valid saved result for that exact puzzle** or the **next verified publisher release/reset**; never by arbitrary local midnight, friendship, self-reported play marker or unstable game cadence.
- Same-game/same-puzzle scoreboards and defined metric direction, ties, sparse cohorts, and head-to-head comparable game records; no universal cross-game score or fabricated sample rankings.
- Public identity and allowed game choices remain independent of friendship. Expose only an allowlisted, appropriately filtered subset of result fields; current non-unlocked result details are absent, not client-blurred. Private raw share and email never exposed.
- Obsidian Arcade Friends, Player profile and ranked/game comparison UI with loading, empty, spoiler shield, errors and accessible mobile behavior.
- SQL migration, Worker auth/service contract, frontend typed API and two-PG17 cross-account/anon/security tests plus Chromium route checks. No hosted Phase 10 deploy or Phase 10 merge without further authorization.

**Plan must be expanded and reviewed against live schema and code before application changes.**
