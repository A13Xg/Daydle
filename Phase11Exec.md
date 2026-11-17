# Phase 11 — Administration, game requests/voting, and diagnostics

**Status:** PLANNING — not implemented or verified.
**Branch:** `phase/11-admin-requests-diagnostics`
**Base:** `6feca5d270e0ef88c5c66b8b3e23bd5941d60296` (Phase 10 release reconciled).
**Roadmap:** [Phase 11](roadmap.md#phase-11--administration-game-requestsvoting-and-diagnostics).
**Dependencies:** Phase 10 merged and protected release #44045005321 passed.

## Planned scope
- Role-gated catalog operations, user restrictions, retained failed submission review, diagnostics.
- Public authenticated game suggestion and voting workflows with bounded rate/duplicate controls and moderation.
- Privileged audit trail for administrative mutations; API and UI access checks.
- Apply a forward-only SQL migration only after source validation and separate production authorization.

## Acceptance gates (not yet run)
- Typecheck, ESLint, Prettier, Vitest, production build, preview smoke, Chromium viewport/route checks.
- Two isolated PostgreSQL 17 migration and RLS/security test environments.
- Review for service-role misuse, IDOR/BOLA, private clipboard exposure, and rate-limit/abuse controls.
- Compare Obsidian Arcade implementation against approved references; capture UI screenshots where relevant.
- Keep real hosted admin/two-account E2E and physical Safari checks separately marked unverified until executed.

## Planning decisions pending inspection
Review current source, migration history, existing admin authorization and catalog RPCs, user permissions, parser failure retention, and module interfaces before selecting concrete changes. No production migration or Worker deployment is authorized by this branch.
