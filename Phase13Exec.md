# Phase 13 — UX completeness, security, accessibility, and QA hardening

**Status:** PLANNING — source-only stacked development.
**Branch:** `phase/13-ux-security-qa`
**Base:** Phase 12 draft head `d638f26836cf6b6eefc7c5d5f26fc2d156af5e50` ([PR #23](https://github.com/A13Xg/Daydle/pull/23)).
**Dependency:** Phase 12 source CI #44144669011 passed, but external encrypted backup, restore and deletion reconciliation remain UNVERIFIED; PR #23 is still DRAFT.
**Scope:** [IDEA.md](IDEA.md) §12, [roadmap.md](roadmap.md) Phase 13, [AGENTS.md](AGENTS.md).

## Source audit plan
- Audit accessible navigation, keyboard operation, focus restoration and visible names/errors across anonymous/authorized views.
- Review security boundaries: auth, session, IDOR/RLS, parser inputs, private raw capture, spoiler policies, cache and route authorization.
- Expand Chromium regression checks at 320/393/1024, include semantic accessibility assertions where possible, and repair evidenced defects.
- Validate offline/read-only behavior, external navigation, clipboard gesture, request/vote and account privacy actions with reproducible tests.
- Preserve approved Obsidian Arcade design and iOS packaging-compatible patterns. No native iOS packaging.
- Review references and update quality matrix/runbook with checked evidence and exact limitations.

## Source verification gates
- Full CI: typecheck, ESLint, Prettier, Vitest, production build/API/PWA smoke and Chromium.
- Two isolated PG17 migration/RLS environments; targeted boundary/security tests.
- PR diff audit for no accidental migration deployment, secret exposure, output caching or loosening permissions.
- Physical iPhone Safari/PWA acceptance owner-deferred, not implied by Chromium CI.

## Stacking and release policy
Phase 13 PR targets `phase/12-privacy-lifecycle-recovery`, never `main` until earlier PRs are merged in order. No merge or production deployment. Do not claim Phase 13 fully COMPLETE if its dependency's offsite-recovery gate remains unresolved.

## Implementation progress
Planning only; tests not yet executed on this branch.
