# Daydle UI architecture — Obsidian Arcade

**Status:** Phase 6.5 implementation in [PR #13](https://github.com/A13Xg/Daydle/pull/13). Visual authority: the owner-approved [DESIGN.md](../referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md) and 13 screenshot/HTML examples. Functional authority remains [IDEA.md](../IDEA.md).

## Chosen architecture

A single React/Vite SPA and existing Cloudflare Worker/Supabase backend are preserved. No additional backend, route library, remote stylesheet service, OAuth provider, native Xcode target or Capacitor dependency was added.

Styling is compiled, semantic CSS in src/styles.css with named custom-property tokens mirroring Obsidian Arcade's design source. This intentionally avoids adding Tailwind into an application that previously had no CSS framework and already maintains a reproducible lockfile. **Visual values and architecture are adopted; the demo's Tailwind implementation technique is not.** The Plus Jakarta Sans variable TTF is bundled at public/fonts/PlusJakartaSans.ttf with its SIL OFL license; the emblem, SVG icon primitives and favicon are bundled. No Google Fonts, Material Symbols or Tailwind Play CDN is shipped.

The PWA build precaches the font and icon along with its versioned static assets; service-worker routing continues to bypass API, Supabase, auth, account, private marks and user-specific content. Only generic offline-safe HTML is cached for newly added public shell routes.

## Route matrix

| Route | Shell | Current behavior |
|---|---|---|
| /, /today | Tab | Existing user-selected games, manual played marks, publisher links and offline snapshot |
| /games | Tab | Catalog discover/search/category filters, selected-game editing |
| /statistics | Tab | Clearly unavailable pending Phase 8, **no fabricated scores** |
| /friends | Tab | Clearly unavailable pending Phases 9–10, **no friend requests/leaderboard data** |
| /account | Tab | Existing Supabase-authenticated profile display/edit and friend code; email stays private |
| /lineup | Stack | Existing atomic saved-selection reorder path, Up/Down buttons and offline read-only safeguards |
| /games/:slug | Stack | Catalog detail, HTTPS publisher link and selected-game toggle |
| /how-it-works | Stack | Three steps: selection, publisher launch, explicit Paste submission |
| /history | Stack | Phase 7 authenticated private result list, filter, detail and confirmed deletion; never cached offline |
| /notifications | Stack | Honest unavailable state; no push/alert service |
| /auth, /auth/callback | Blank | Existing Apple/Google OAuth and callback handling, no tab chrome |
| Paste dialog | Modal stack overlay | Explicit clipboard gesture/manual fallback; Phase 7 submits only after user action with authenticated API, optional unknown retention requires separate consent |

The top bar uses bundled branding, search and account shortcuts. The notification icon links to an explicit unavailable state, with **no fake unread counter**. Mobile has a fixed frosted 5-tab bar; stack routes and the Paste overlay hide it. Desktop keeps the same navigable hierarchy in a centered responsive layout.

## Design invariants

- Dark-only tokens, 44px minimum touch targets, 16px inputs, large rounded surfaces, visible focus, working keyboard navigation and reduced-motion preferences.
- iOS Safari: viewport-fit=cover; explicit top/bottom/side safe areas; dynamic dvh sizing and pinch zoom enabled; no runtime CDN dependencies. User-visible flows preserve explicit best-effort external publisher handoff and the focus/return Paste suggestion.
- Wordle/Connections and all catalog cards use namespaced game initials rather than publisher trademarks or external image hotlinks. No automatic game launch, notifications, fake global ranks or unverified achievements.
- Reordering is backed by the existing authenticated, atomic set_my_games RPC with authoritative reconciliation and lockouts on offline/uncertain writes. Up/Down controls are keyboard and touch accessible; HTML5 drag-and-drop is not used.
- A future iOS WKWebView wrapper remains a compatibility consideration only. Native packaging, custom auth adapters and App Store publication are separate future decisions.

## Required verification

GitHub CI executes TypeScript typecheck, ESLint, immutable Prettier, the existing API/UX/clipboard/privacy/PWA unit tests, production build, PWA smoke and two isolated PostgreSQL 17 RLS databases. Chromium's real layout engine should additionally validate 320×740, 393×852 and 1024×768 route/shell rendering with no horizontal overflow or unsafe mobile buttons. These are browser-emulation checks, **not** a substitute for actual post-redesign Safari or installed-PWA device acceptance.

Manual review on a real iPhone is still needed after a separately authorized preview/production deployment: install/launch, Apple and Google OAuth, publisher tab handoff/return, Paste permission/denied flow, safe-area header/nav/keyboard, offline restore, account isolation and selected-game edits. An older Phase 5 physical-device pass does **not** certify redesigned Phase 6.5 behavior. No hosted deployment is authorized merely by merging this PR.

## Implemented UI screenshots and device validation status

- [Today, guest-state mobile screenshot](screenshots/arcade-today-guest.png) — genuine CI-built app; no signed-in account or saved data.
- [Statistics placeholder screenshot](screenshots/arcade-statistics-placeholder.png) — genuine CI-built app; does not imply statistics are operational.
- Screenshots: Chromium 393×852, scale 2, safe-area emulation, recaptured after design audit in [CI #43948359080](https://github.com/A13Xg/Daydle/actions/runs/43948359080). They are documentation assets, not reference mockups.
- Owner explicitly deferred physical iPhone Safari/installed-PWA tests for Phase 6.5 PR review. They remain NOT VERIFIED and are required before a subsequent release; existing Phase 5 device evidence cannot be reused as proof of redesigned UI behavior.


## Approved screenshot parity audit

- Current [auth reference comparison](screenshots/arcade-auth-unconfigured.png) matches the emblem/wordmark, action hierarchy and provider marks. The environment's disabled OAuth buttons indicate missing CI credentials, not a production OAuth regression.
- [Guest Today](screenshots/arcade-today-guest.png) now uses a dashboard status strip, hero panel and secondary card grid instead of the previous oversized generic welcome. It does not imitate authenticated scores.
- [Statistics](screenshots/arcade-statistics-placeholder.png) carries the approved 2×2 metric-card and distribution-section structure; values remain explicitly unavailable until the relevant feature phases.
- All mobile nav labels use at least 11px; top-bar icon targets are >=44×44px. The Chromium viewport script now asserts these computed dimensions, and reduced-motion/increased-contrast CSS remains supported.
