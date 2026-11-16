# Phase 6.5 Execution Plan — Obsidian Arcade UI/UX overhaul

**Status:** IN REVIEW — owner explicitly deferred the physical-iPhone gate for this PR. Device validation remains NOT VERIFIED and is required before a future release. Source, UI browser checks and security CI passed.
**Branch/PR:** `phase/06.5-obsidian-arcade-ui` · [PR #13](https://github.com/A13Xg/Daydle/pull/13) (draft).
**Base:** `main` `99401d5b31242c139f77d3700c2f2a7e3c12ada6`, verified merge of parser [PR #12](https://github.com/A13Xg/Daydle/pull/12). [Main CI 43930997408](https://github.com/A13Xg/Daydle/actions/runs/43930997408) passed.
**Product/security authority:** [IDEA.md](../IDEA.md), [AGENTS.md](../AGENTS.md), [roadmap.md](../roadmap.md), [Phase 6 archive](../completedPhases/Phase6Exec.md).
**Visual authority:** approved [Obsidian Arcade tokens](../referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md) and all thirteen mockup PNG/HTML examples.

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

## Phase 6.5 implementation and verification report — November 16, 2026

### Implemented (source branch, not deployed)

- Introduced the approved Obsidian Arcade dark design system in bundled CSS with semantic tokens, responsive tonal surfaces, rounded cards, locally bundled variable Plus Jakarta Sans under SIL Open Font License, inline SVG icon primitives, emblem and harmonized PWA icons.
- Replaced the former three-link header with fixed safe-area-aware top app bar, five-tab primary bottom navigation, separate stack-header routes, and blank authentication shell. Added dedicated saved-game lineup editor based on the existing authenticated, atomic reconciled selection RPC.
- Updated Today, Discover/catalog/detail, OAuth, Account and Paste visual composition; preserved owner-private manual played markers, publisher links, explicit clipboard gesture/manual fallback, existing backend, offline read-only snapshots, per-user remounting, and safe API caching exclusions.
- Future Statistics and Friends tabs show honest placeholder states; Notifications and How It Works are stack routes. No invented scores, counts, achievements, friend requests, auto-launch, OCR, push alerts or additional authentication options.
- Added source-level route/accessibility/PWA tests and a real headless Chromium CDP smoke with responsive width assertions at 320, 393 and 1024 px; safe-area insets emulated in Chrome. Added precise route and portability documentation in [docs/ui-architecture.md](../docs/ui-architecture.md).

### Automated verification — PASS

- [CI #43936827206](https://github.com/A13Xg/Daydle/actions/runs/43936827206) on committed branch source `e2b81e7d782378f7160ac61f53a388c9117b12ea`: both `validate` and `database-security` passed.
- `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm run lint`, `npm run format:check`: PASS.
- `npm test`: **195/195 tests across 25 suites**, including 31 added Obsidian/route/compatibility assertions and service worker safety coverage.
- `npm run build`, `npm run smoke`: PASS, including generated PWA shell and restricted caching.
- `node scripts/ui-smoke.mjs`: **16/16 Chromium route/viewport checks** passed, with no horizontal overflow, required shell/tab visibility, local fonts, >=44px buttons/nav, no runtime CDN dependencies and emulated safe-area insets.
- `bash scripts/test-db.sh`: PASS across the two CI isolated PostgreSQL 17 security databases.
- Chrome screenshots of signed-out Today, Statistics and Auth were reviewed. Visual feedback led to a more complete signed-out Today hero, friendlier Statistics copy and additional bottom-tab footer clearance. Temporary screenshot capture and formatting diagnostic code were subsequently removed. Initial intermediate CI failures were corrected; the clean committed-source final run passed.

### Security and scope audit

- No new Supabase migration, Worker API endpoint, hosted write, app deployment, OAuth provider, Xcode/Capacitor package or runtime CDN dependencies.
- Existing clipboard text is not persisted/logged; authorization and RLS remain server-defined. Service worker continues bypassing account/auth/API/secret-bearing requests.
- Third-party font retains its upstream SIL OFL licensing notice; no prohibited contributor/tool attribution was added.
- `main` remains at Phase 6 merge `99401d5` pending owner action on PR #13.

### Owner-deferred iPhone acceptance — NOT VERIFIED (required before release)

Physical **iPhone Safari and home-screen PWA** acceptance has not been rerun on the new interface. Chromium desktop emulation does not establish actual safe-area/keyboard behavior, OAuth return, publisher external-context return, clipboard permission/fallback, offline restore or account isolation under the redesigned navigation. The earlier owner-reported Phase 5 iPhone pass applied to an earlier interface and is not a Phase 6.5 pass. End-to-end authenticated UI states were not available to headless public CI without connected account credentials.

**Next operator checkpoint:** After the owner explicitly authorizes a preview/production rollout or other device-test environment, exercise the redesigned UI on a real iPhone: navigation/safe areas, Apple/Google sign-in, lineup editing, publisher handoff/return, clipboard permission and manual paste, offline restart, and account switching. Record results; do not claim those tests passed now.

**Revised disposition (owner instruction, after original report):** The owner explicitly deferred real-iPhone testing for PR #13 code review. This is a scope-specific acceptance-gate deferral, **not a PASS** and not a release/deployment authorization. Implementation and source-level browser/security checks are sufficient to request PR review; archive this plan with the unverified device gate documented. Owner merge approval is still required, and real iPhone acceptance must be revisited before any release. Phase 7 is not started as part of this change.

## Final UI screenshot and independent review evidence — November 16, 2026

- [Screenshot capture CI #43942504930](https://github.com/A13Xg/Daydle/actions/runs/43942504930) passed both validation and isolated PostgreSQL security jobs. Built React app screenshots were captured in headless Chromium at 393×852 CSS pixels with 2× device scale and iOS safe-area emulation.
- [Today guest screen](../docs/screenshots/arcade-today-guest.png) and [Statistics placeholder](../docs/screenshots/arcade-statistics-placeholder.png) were inspected for layout, accessible tab/header structure, contrast, text readability, background, spacing and action visibility; screenshots were embedded in PR #13. They are real output from the compiled app, **not the reference mockups**.
- The CI environment lacks Supabase public configuration and user login; the screenshot evidence only covers guest/pending states. The real signed-in Today rotation and OAuth callbacks were **not visually tested in these captures**.
- A temporary screenshot-enabled CI/smoke variant was removed after capturing screenshots. The **final clean source CI #43942975320** at commit b0faa725e78efac7a06d2d0135922f7a25a563f8 passed both jobs, immutable formatting, typecheck, lint, 195 tests in 25 suites, production build/PWA smoke and 16 Chromium viewport/route cases (320×740, 393×852, 1024×768).
- PR diff reviewed: no migrations, Worker route edits, native iOS packaging, third-party runtime CDN, leaked credentials, tool attribution, or unnecessary package/lockfile changes. The screenshots and font license remain source-available, with the screenshots excluded from the PWA precache.
- **Owner decision:** real-iPhone Safari and home-screen PWA acceptance is explicitly **DEFERRED for Phase 6.5 PR review**, not passed. It remains a pre-release checkpoint covering touch/focus, browser/PWA safe areas, Apple/Google sign-in, publisher handoff/return, explicit clipboard gesture, offline restore and account isolation.
- The explicit owner deferral supersedes the original plan's requirement to keep the PR draft solely for this device gate. Source completion permits an IN REVIEW status, archived plan and ready-for-review PR, **without authorizing merge or deployment**.

### Final state

- PR: [#13](https://github.com/A13Xg/Daydle/pull/13), requested human review; branch base remains merged Phase 6 main commit 99401d5.
- All required source/browser CI gates PASS; real iPhone device testing remains NOT VERIFIED and deferred until before release. No production changes or new phase begun.


## Reference-screen visual parity revision — November 16, 2026

- Compared actual guest Today, Statistics and unconfigured Auth screenshots with their owner-approved `today`, `statistics` and `welcome_auth` reference PNGs and DESIGN.md rules. The previous screenshots had a generic sign-in hierarchy, a feature-placeholder void where metric cards were expected, undersized navigation/badge labels (9–10px), and header hit areas of 40–42px on narrow screens.
- Replaced the auth layout with the reference's emblem + Daydle Arcade wordmark + ritual headline + branded Apple/Google icons; kept the real OAuth provider code and explicit unconfigured state. **Did not invent** the mockup's sample live counts, social badges, or unsupported email UI.
- Reworked guest Today with a status strip, arcade hero and two secondary cards, retaining accurate signed-out privacy statements and real links; converted Statistics to a four-card Master Metrics placeholder and empty Guess Distribution grouping without fabricated values.
- Increased mobile tab font to 12px and brand badge fonts to at least 11px; fixed mobile header icon targets to 44×44px, updated actual CDP geometry assertions, and added tests for the metric cards and provider branding. Added CSS `prefers-contrast: more` fallback.
- [Canonical formatting and visual-capture CI #43948359080](https://github.com/A13Xg/Daydle/actions/runs/43948359080) passed **196/196 tests across 25 suites**, 16 Chromium viewport/route checks and both PostgreSQL security jobs. Fresh real compiled-app images and provenance are in [screenshots README](../docs/screenshots/README.md). Temporary screenshot and formatting instrumentation was subsequently removed; a clean-source CI run is required to close this revision.
- Scope remains Phase 6.5 visual implementation. Authenticated visuals and real physical-iPhone acceptance remain **NOT VERIFIED** (owner-deferred), not success claims. PR #13 is unmerged, and no hosted deploy or migration occurred.

### Clean source verification after visual parity changes

- **Final committed-source CI [#43949077483](https://github.com/A13Xg/Daydle/actions/runs/43949077483)** at source `a29d08692a692d77d9d3a43500674a51cf3b7dc8` passed both `validate` and `database-security` jobs. Strict TypeScript, ESLint, Prettier, `npm test` (**196/196, 25 suites**), Vite/Worker build, API/PWA smoke, **16/16 Chromium viewport/shell checks**, and both isolated PostgreSQL security databases passed. Temporary screenshot and formatter CI code was absent from the committed source.
- Three refreshed evidence images are in [docs/screenshots](../docs/screenshots/README.md) (guest Today, Statistics empty metrics, unconfigured authentication). Provider behavior, live selected-game cards and the deferred real-iPhone acceptance remain unverified by the screenshots. The owner-approved reference screenshots remain unchanged.
- Source and docs review confirmed no new backend/API, migrations, native iOS packaging, remote runtime CDNs, private data, or prohibitive attribution. The approved design system uses bundled semantic CSS tokens rather than Tailwind at runtime or build time, and the design documentation now reflects the actual implementation.
