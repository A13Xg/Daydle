# Phase 13 — UX completeness, security, accessibility, and QA hardening

**Post-merge reconciliation (November 17, 2026):** Source [PR #24](https://github.com/A13Xg/Daydle/pull/24) **MERGED** into main at `20422881f774a0c5992cc52e8ad1035dfae64458`; [main CI #44172784193](https://github.com/A13Xg/Daydle/actions/runs/44172784193) PASS. The draft/unmerged remarks below are historical. **Operational acceptance is still BLOCKED** on hosted two-account/administrator integration, real iOS Safari/VoiceOver, live monitoring and inherited Phase 12 independent backup/restore. Retain the root plan until those gates actually pass.

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


## Source audit outcome — November 17, 2026

**SOURCE CI VERIFIED; PHASE ACCEPTANCE NOT YET COMPLETE.** [Full CI #44146281277](https://github.com/A13Xg/Daydle/actions/runs/44146281277) passed at `d8528f80d162c69e0e6ccf388d1ec88e0879671a`:
- TypeScript, ESLint, Prettier, 309/309 Vitest tests across 38 suites, production build and API/PWA smoke PASS.
- 28/28 Chromium route/viewport checks PASS with computed accessibility names, exact single main/H1 semantics, image-alt and aria-hidden focusability assertions.
- Two independent PostgreSQL 17 migration/RLS/security jobs PASS.
- Bug found/fixed: guest/unconfigured Administration route lacked an H1. The route now provides an accessible heading and service status text, with real Chromium verification.
- Defense in depth: Worker now rejects expired raw parser samples returned by the privileged admin RPC even if upstream SQL misbehaves. Dedicated unit regression passes; raw share text is not included in generic error output.
- [Source test/QA matrix](docs/quality-matrix.md) distinguishes each automated fixture gate from provider/mobile/restore acceptance.

**Remaining Phase 13 and inherited gaps:** physical Safari/installed PWA and VoiceOver (owner-deferred); screenshot-to-reference human parity for new authenticated screens; full hosted two-account/admin/privacy integration; production telemetry/performance baselines; Phase 12 offsite encrypted backup and isolated restoration/deletion journal. Those are NOT VERIFIED, and this PR remains a draft rather than claiming full phase completion. No migration, secret, OAuth provider, cloud deployment or production change was made in Phase 13. Active root plan is not archived while these gates remain.

**Stack integrity:** PR #24 targets Phase 12 PR #23 branch; latest Phase 12 head was incorporated by an explicit merge commit. Compare shows Phase 13 is zero commits behind Phase 12, with only the seven intended Phase 13 QA/docs files differing. Do not merge before prerequisite source PRs and their acceptance are resolved.
