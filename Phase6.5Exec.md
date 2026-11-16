# Phase 6.5 Execution Plan — Obsidian Arcade UI/UX overhaul

**Status:** PLAN REVIEWED — implementation pending.
**Branch/PR:** `phase/06.5-obsidian-arcade-ui` · [PR #13](https://github.com/A13Xg/Daydle/pull/13) (draft).
**Base:** `main` `99401d5b31242c139f77d3700c2f2a7e3c12ada6`, verified merge of parser [PR #12](https://github.com/A13Xg/Daydle/pull/12). [Main CI 43930997408](https://github.com/A13Xg/Daydle/actions/runs/43930997408) passed.
**Product/security authority:** [IDEA.md](IDEA.md), [AGENTS.md](AGENTS.md), [roadmap.md](roadmap.md), [Phase 6 archive](completedPhases/Phase6Exec.md).
**Visual authority:** approved [Obsidian Arcade tokens](referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md) and all thirteen mockup PNG/HTML examples.

## Preflight findings and decisions

- The existing React app is a Vite/Cloudflare Worker SPA with simple pathname route dispatch in `src/App.tsx`; it currently renders a three-link top navigation, light CSS, an accessible Paste modal, and functional Today, Catalog, Game Detail, OAuth and Account flows. Offline state, publisher return and clipboard gesture are already in use and must not regress.
- The baseline has zero Tailwind or icon dependencies and uses a tracked `package-lock.json`; adding a UI framework would increase the dependency/security surface and complicate the lock. Implement **equivalent approved design tokens via semantic CSS custom properties**, not the mockup's runtime Tailwind CDN. This is an explicit build-system substitution: preserve colors, typography, spacing, component shapes and shell patterns, not arbitrary framework choice. All CSS and assets must be bundled locally and work under a future WKWebView.
- A web/PWA is the only approved target; no Capacitor, iOS build, Xcode or App Store process. Native portability is a design constraint, not a deliverable.
- A real `Plus Jakarta Sans` variable font may be bundled from the upstream open-source source with its OFL license; SVG icons/emblem are bundled locally or authored inline. No runtime font/icon services.
- UI mockup-only friend requests, global ranks, invented metrics, celebration claims, notifications, auto-launch, OCR, unsolicited clipboard reading and unsupported authentication methods are not authorized features.

## Route architecture and scope

- `mobile_tab`: `/today` (also `/`), `/games` (Discover), `/statistics` (honest future state), `/friends` (honest future state), `/account` (profile or sign-in state). Fixed frost-glass five-item nav on mobile, safe-area padded; `aria-current=page` for actual tab. Brand header with search, and account shortcut. No unread badge without real notifications.
- `mobile_stack`: `/games/:slug` detail, `/lineup` saved-game reorder editor, `/how-it-works` accurate explainer. Dedicated header with visible back action; bottom tab bar absent. Paste Results is an accessible full-screen modal/drawer layered above shells that also hides the underlying nav.
- `mobile_blank`: `/auth`, `/auth/callback`; no tab/header chrome. Use existing OAuth providers unchanged and accurate privacy disclosures.
- Unknown routes render a safe 404 navigation state, not a simulated Today game state.

## Concrete changes

1. `src/components/ArcadeIcon.tsx`, `ArcadeShell.tsx`, `FeaturePendingPage.tsx`: typed presentation primitives with accessible inline SVG icons, named nav routes, three layout shells; no new backend or navigation framework.
2. `src/App.tsx`: route resolution + shell composition; retain health status/retry, return prompt, user-gesture Paste and account-keyed remount behavior.
3. `src/styles.css`, `index.html`, `public/app.webmanifest`: approved design tokens, local Plus Jakarta Sans, dark color scheme/theme, header/tab/safe-area/pill/card/input states, CSS feature detection, reduced motion, responsive layouts 320–1280px. No runtime CDN or external images; do not disable zoom.
4. `src/components/{TodayPage,CatalogPage,GameDetailPage,AuthPage,AccountPage,PasteDialog}.tsx`: redesign rendered structure and copy while retaining existing promises/authorizations. Use an explicit `lineupOnly` catalog mode backed by the existing atomic selection RPC and Up/Down buttons, not a second data-write path. Add honest data states for unimplemented future tabs.
5. `docs/ui-architecture.md` and tests: route matrix, interaction contract, visual tokens, reference-to-production mapping, future limitations and associated regression assertions.

## Behavior, permission and offline invariants

- Preserve the user-gesture-only `Paste from clipboard` event. No input auto-upload, parser API calls, raw local storage, analytics logs or fabricated parsed results. The dialog traps focus and restores it on close. Escape works.
- Maintain signed-in identity and per-user remount keys, read-only public offline snapshots, owner-only status, no offline mutations, atomic and reconciled favorite reordering, HTTPS publisher launches with `noopener noreferrer`, and best-effort Safari return handling.
- Disabled and error states remain visible/actionable. The future Stats/Friends panels do not query non-existent APIs or show invented streaks/ranks. Responsive content remains usable with virtual keyboard, safe-area insets and `prefers-reduced-motion`.
- No schema/API migration; catalog game ids/slugs remain unchanged.

## Ordered work and acceptance

1. **Verified:** merge/release reconciliation and main CI, open dedicated branch and draft PR. Change Phase 6 row to COMPLETE on this branch only, with merge evidence; Phase 6.5 to IN PROGRESS on branch.
2. Plan review before coding; audit existing file references, tests and design examples. Commit this plan.
3. Implement shell and semantic token system; commit, then verify with GitHub CI. Implement existing screen upgrades; commit; run more complete CI.
4. Add non-trivial route/accessibility/privacy regression tests, plus headless Chrome viewport/safe-area validation if available on the GitHub runner. Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, `bash scripts/test-db.sh` (two clean databases), and source/diff audits.
5. Report browser, iOS Safari and PWA status separately. If real device/Sim cannot be run in this environment, record **NOT VERIFIED** and keep the PR draft if that is a material acceptance gate. Do not infer production deployment or Xcode testing from CI.
6. If all required gates pass, append factual measured evidence, archive `Phase6.5Exec.md` at `completedPhases/Phase6.5Exec.md`, change only the **branch** roadmap status to IN REVIEW, update PR #13 with test evidence and mark ready. Do not merge or deploy.

## Risks, review and rollback

- Full visual rework can silently break responsive layout or OAuth/PWA gestures; prioritize compositional reuse, inline semantics and explicit mobile viewport checks.
- Offline CSS/font/icon assets must be build-version cached as static public shell without leaking private data; inspect service-worker asset semantics after adding files.
- Future native packaging must not be misrepresented as implemented; web OAuth in WKWebView would need a platform adapter in a later approved phase.
- Main remains untouched; rollback by closing/reverting PR. No migration or hosted rollback needed.
