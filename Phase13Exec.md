# Phase 13 — UX completeness, security, accessibility, and QA hardening

**State:** REVIEWED IMPLEMENTATION PLAN; source-only draft.
**PR:** [#24](https://github.com/A13Xg/Daydle/pull/24) on `phase/13-ux-security-qa`; stacked from Phase 12 `d638f26836cf6b6eefc7c5d5f26fc2d156af5e50`.
**Authority:** [IDEA.md](IDEA.md) §8–12, [roadmap.md](roadmap.md) Phase 13, [AGENTS.md](AGENTS.md), Obsidian Arcade design.
**Dependency caution:** Phase 12 source CI #44144669011 passed, but independently verified encrypted offsite backups, real restore/deletion reconciliation and iPhone Safari acceptance are NOT VERIFIED.

## Source assessment
- Existing `scripts/ui-smoke.mjs` runs Chromium CDP over 28 routes/viewport pairs (320, 393, 1024) and checks shell layout, 44px controls, font/theme, guest private-data boundaries, Paste Escape/focus recovery.
- No computed accessibility-tree check yet exists for unnamed actionable controls, nor systematic H1/main landmark and image alt coverage.
- Existing Worker tests and two isolated PG17 databases cover much auth/spoiler/RLS logic; authenticated hosted-admin, deletion, device and backup acceptance remain separately unverified.

## Reviewed ordered implementation
1. Extend `scripts/ui-smoke.mjs` to use native CDP Accessibility.getFullAXTree. Fail on visible, unignored unnamed button/link/textbox/combobox/checkbox/radio/switch/slider controls without dumping raw page/private text. Assert one accessible main landmark, one H1 and explicit alt on rendered images. Continue using the existing smoke runner and pinned dependencies.
2. Repair demonstrated UI semantic/focus defects without changing the Obsidian Arcade visual design or introducing new features. Check mobile 320/393 and desktop 1024; retain 44px shell targets and locally bundled assets.
3. Review auth/session identity, SQL/RLS privileged RPCs, spoiler no-store paths, rate limits, raw share retention, owner export/delete, admin gating and release safeguards. Add targeted regression tests only for evidenced gaps.
4. Write a QA matrix for Today/Paste, discovery, history/stats, friendships/scoreboards/public profiles, suggestions/admin and account/privacy; include loading/empty/offline/denial/retry and keyboard states; label each VERIFIED or NOT VERIFIED.
5. Run full CI, inspect failures and fix them; audit final diff for IDOR, secret exposure, XSS, stale cache and iOS portability. Archive plan and mark ready only with actual source evidence.

## Acceptance gates
`npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, Chromium CDP viewport/route smoke and `npm run db:test` on two clean PostgreSQL 17 environments.

## Risks / boundaries
- CDP nodes may include hidden or generic roles; check ignored and a strict actionable-role list. Don't mask genuine missing names to get green CI.
- No production migration, role grant, Worker deployment, OAuth provider change or native packaging is authorized.
- A source-passing Phase 13 PR cannot close Phase 12's independent offsite recovery gate or owner-deferred real Safari checks.

## Recorded verification
Not yet executed on Phase 13 feature changes.
