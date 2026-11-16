---
name: Obsidian Arcade
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#c0c1ff'
  on-secondary: '#1000a9'
  secondary-container: '#3131c0'
  on-secondary-container: '#b0b2ff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00a572'
  on-tertiary-container: '#00311f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
  streak: '#f59e0b'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
  display-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.025em
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.5rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

# Daydle Design System: Obsidian Arcade

> **Status: reference only.** Nothing here is a requirement until the owner explicitly asks for a screen or style to be built. See `../readme.md`. When this file and `IDEA.md`, `roadmap.md` or `AGENTS.md` disagree, those documents win.

This is the **only** design system in the reference set. The tokens above are the single source of truth: every mockup in this folder uses these tokens ($1). A few deliberate exceptions remain: game-brand tints (for example the Wordle green and Connections orange badges), a handful of translucent status tints, and some inline `style` colors on `account`. Prefer tokens for anything new. Do not introduce a second palette or typeface.

## Platform targets: one codebase, web and iOS

Daydle ships as a **web app first** (React, TypeScript, Vite, Cloudflare) and is planned to also **build into an iOS app with Xcode** for eventual App Store release (`IDEA.md` currently lists native apps as an initial-release non-goal, so this needs a roadmap decision before work starts). The design is written so both come from the same code:

- **Web:** installable PWA, iOS Safari and desktop and Android browsers degrade gracefully.
- **iOS:** the same built web bundle runs inside a `WKWebView` shell (for example Capacitor) that is opened and archived in Xcode. Native capabilities (Sign in with Apple, push notifications, haptics, share sheet, opening publisher sites) are reached through thin plugins behind a small platform adapter, never by forking screens.

Rules that follow from supporting both:

1. **Ship nothing from a runtime CDN.** Mockups load Tailwind (Play CDN), Plus Jakarta Sans and Material Symbols from the network for convenience only. The real app compiles Tailwind at build time and bundles the font files and an icon subset, so the iOS build works offline, loads instantly and passes App Store review. The Tailwind Play CDN must never ship.
2. **Relative, bundled assets only.** No hotlinked images. Mockups use `assets/` (emblem, placeholder avatars).
3. **Feature-detect, never user-agent sniff.** Clipboard, share, vibration and notifications behave differently in Safari, a home-screen PWA and a `WKWebView`. Every such feature needs a graceful fallback (see Interaction).
4. **No hover-only affordances.** Hover styles are enhancements; Tailwind is configured with `future.hoverOnlyWhenSupported` so touch devices never get sticky hover.
5. **Dark only for now.** `color-scheme: dark`, `theme-color` and the status bar style are all set for the dark canvas. A light theme is a separate decision.

## Brand & Style

A nocturnal, high-focus home for daily puzzles: tactile arcade clarity inside calm dark-mode minimalism. Dark depth makes the electric blue, indigo, emerald and amber state colors read clearly, and completing a puzzle should feel rewarding.

- **Luminous energy on obsidian:** deep midnight surfaces, vivid accents.
- **Micro-reward feedback:** solved states, streaks and celebrations are high-contrast and punchy.
- **Ergonomic softness:** pill and large-radius shapes balance the rigid geometry of puzzle grids.

## Colors

Use the token names, not raw hex, in code. Elevation is expressed mainly by stepping through surface tokens; the mockups also use soft shadows and colored glows.

| Role | Token | Value | Use |
|---|---|---|---|
| Canvas | `background`, `surface` | `#051424` | Page background |
| Recessed | `surface-container-lowest` | `#010f1f` | Inset wells, inactive tiles |
| Card | `surface-container-low` | `#0d1c2d` | Cards, trays, inputs |
| Raised | `surface-container` | `#122131` | Nested panels |
| Interactive | `surface-container-high` | `#1c2b3c` | Secondary buttons, chips, active rows |
| Highest | `surface-container-highest` / `surface-variant` | `#273647` | Toggle tracks, inactive controls |
| Text | `on-surface` | `#d4e4fa` | Headings, primary text |
| Secondary text | `on-surface-variant` | `#c2c6d6` | Metadata, descriptions |
| Subtle | `outline` | `#8c909f` | Placeholders, inactive icons, hairlines on text |
| Hairline | `outline-variant` | `#424754` | Dividers, borders (never for text) |
| Primary (light) | `primary` / `on-primary` | `#adc6ff` / `#002e6a` | Links, active nav, tonal buttons |
| Primary (fill) | `primary-container` / `on-primary-container` | `#4d8eff` / `#00285d` | Main call-to-action fill |
| Secondary | `secondary` / `secondary-container` | `#c0c1ff` / `#3131c0` | Selection, game-mode accents |
| Success | `tertiary` / `tertiary-container` | `#4edea3` / `#00a572` | Solved, verified, positive delta |
| Streak | `streak` | `#f59e0b` | Streak counters and momentum only |
| Error | `error` / `error-container` | `#ffb4ab` / `#93000a` | Destructive actions, failures |

Contrast, measured (WCAG 2.2 AA needs 4.5 for body text, 3 for large text and UI):

| Pair | Ratio |
|---|---|
| `on-surface` on `surface` | 14.4 |
| `on-surface-variant` on `surface` / `surface-container-low` | 10.9 / 10.1 |
| `outline` on `surface` / `surface-container-low` / `surface-container-high` | 5.8 / 5.4 / 4.5 |
| `primary` on `surface` | 10.9 |
| `on-primary` on `primary` | 7.7 |
| `on-primary-container` on `primary-container` | 4.5 |
| `on-tertiary-container` on `tertiary-container` | 4.5 |
| `streak` on `surface` | 8.6 |
| **White on `primary-container`** | **3.2, fails: never use** |
| `outline-variant` as text | below 3 on `surface`: borders only |

Rules: put text on `primary-container` only in `on-primary-container`. Never place `outline` text on anything lighter than `surface-container-high`. Never rely on color alone for state; pair it with an icon or label.

## Typography

One family, **Plus Jakarta Sans** (400 to 800), bundled with the app. Icons use **Material Symbols Outlined**, bundled as a subset. Use the named scale (`text-headline-md`, `font-headline-md`); do not invent sizes.

- Scores, streaks, headers: `display-*` and `headline-*`, weight 700 to 800, tight tracking.
- Micro-labels and badges: uppercase `label-sm`, 0.05em tracking.
- **Never smaller than 11px.** Prefer 12px (`label-md`) or larger for anything that carries meaning.
- Support Dynamic Type: WebKit does not follow the iOS text-size setting from `rem` alone. Opt in explicitly (for example `html { font: -apple-system-body; }` with `rem`-based sizes, or a native text-zoom bridge in the iOS shell), avoid fixed-height text containers, and test at the largest accessibility sizes. The mockups’ type scale is in `px` and does not yet scale this way. Truncate only with a way to read the full text.
- Use `font-variant-numeric: tabular-nums` for scores, timers and tables.

## Layout & Spacing

- **Mobile first, single column** (`<640px`, margin `1rem`). Tablet (`640 to 1023px`) is a centered fluid column; desktop (`1024px+`) caps content at 680px for boards and 1120px for dashboards.
- Design for an **iPhone 16 class viewport (393 x 852)** and verify from 320px wide to iPad.
- **Safe areas are mandatory.** Every page uses `viewport-fit=cover` and insets chrome with `env(safe-area-inset-*)`:
  - Fixed header: `pt-safe`, with the page content offset by `calc(<header height> + env(safe-area-inset-top))`.
  - Fixed bottom bars and tab bar: `pb-safe`, with content offset by `calc(<bar height> + env(safe-area-inset-bottom))`.
  - If landscape is supported, also inset `left`/`right`; the mockups are portrait-only and do not implement this.
- Use **`dvh`** (`min-h-dvh`), never `100vh` or `100vw`, which are wrong under iOS dynamic toolbars and cause horizontal scroll.
- Keep primary actions in the lower half of the screen, within thumb reach, and above the home indicator.
- Shell types: **tab** (header plus five-tab bottom bar: Today, Discover, Stats, Friends, Account), **stack** (back or close header, no tab bar), **blank** (no chrome: welcome and onboarding).

## Elevation, Shape, Motion

- Depth by tonal stepping plus a 1px low-contrast stroke (`rgba(148,163,184,0.10)`); colored glows only for focus and state (`0 0 16px rgba(78,222,163,0.35)` solved, amber for streaks).
- Buttons, chips, badges, inputs: full pill. Cards: `rounded-lg` (2rem) on mobile, `rounded-xl` (3rem) on large screens. Puzzle tiles: 0.75 to 1rem.
- Motion is short and purposeful. **Honor `prefers-reduced-motion`** (the shared base CSS already collapses animation and transition durations). Never rely on animation to convey state.

## Components

- **Primary button:** `bg-primary-container text-on-primary-container`, pill, 48px or taller. **Secondary:** `surface-container-high` with hairline stroke. **Success/share:** `tertiary-container`. **Destructive:** `error` text on `error-container`, always with a confirmation step.
- **Inputs:** pill or rounded capsule on `surface-container-low`, **16px font minimum** (smaller makes iOS Safari zoom the page on focus), 44px minimum height, a label (visible, or `sr-only` for a single compact field; a placeholder is not a label), correct `type`, `inputmode`, `autocomplete`, `autocapitalize`, `autocorrect` and `enterkeyhint`.
- **Toggles:** `role="switch"` with `aria-checked`, or a labeled checkbox; always with an accessible name.
- **Chips and streak pills:** `surface-container-high`, pill, amber flame for streaks.
- **Puzzle cells:** empty `surface-container-lowest` with 1.5px `surface-container-high` border; active `primary-container` border; correct `tertiary-container`; present `streak`.
- **Bottom tab bar:** five items, 56 x 48 targets, `aria-current="page"` on the active tab, translucent blur over a dark surface token (the mockups vary slightly between `surface`, `surface-container-low` and `background`; pick one in the real app).

## Interaction & iOS behavior

- **Touch targets: 44 x 44pt minimum** (Apple HIG). The shared base CSS grows the hit area of standalone buttons and links with an invisible pseudo-element without changing their look. It does not apply to inline text links inside paragraphs, and it is clipped inside `overflow` scrollers (category and filter chip rows), so give those chips a real 44px height. Prefer genuinely large controls.
- **Zoom stays enabled.** Never set `maximum-scale` or `user-scalable=no`; it fails WCAG 1.4.4 and is a review risk.
- **No HTML5 drag-and-drop** (it does not fire from touch). Reordering uses Pointer Events (`touch-action: none` on the handle) plus a keyboard alternative (ArrowUp/ArrowDown) and a live-region announcement; see `lineup_editor`.
- **Clipboard:** `navigator.clipboard.readText()` needs a user gesture and may show the system "Paste" prompt or be denied. Always provide a visible text field that accepts a manual long-press Paste, and never substitute fake data on failure.
- **Opening publisher sites:** browsers block multiple `window.open` calls from one tap, and an installed PWA or `WKWebView` may leave the app. Launch one game per user gesture, show Back/resume guidance, and in the iOS build open links in an in-app browser (`SFSafariViewController`, which does not share Safari’s cookies, so a publisher login may look signed out) or hand off to Safari or the publisher’s app with universal links; choose per publisher and offer both where it matters. "Launch All" must be a guided sequence, not a popup burst.
- **Forms:** associate labels, use `enterkeyhint`, keep the primary action reachable above the keyboard (use the `visualViewport` API), and don't disable the submit button without saying why.
- **Haptics and sound:** optional enhancement via the native adapter; never required.
- **Offline:** read-only cached views must say they are cached and when they were fetched. In a Capacitor-style `WKWebView` shell service workers are limited (they need App-Bound Domains), so offline there comes from bundled assets and local storage, not the PWA service worker; design offline states for both.

## Accessibility

- WCAG 2.2 AA is the floor. VoiceOver is the primary screen-reader target: decorative icon ligatures are `aria-hidden="true"`, icon-only controls have `aria-label`, images have `alt` (empty when decorative), dialogs trap and restore focus.
- Visible `:focus-visible` ring on every interactive element (`2px solid primary`), for keyboard, switch control and external keyboards on iPad.
- Respect Reduce Motion (CSS `prefers-reduced-motion`, implemented in the shared base CSS) and Increased Contrast (`prefers-contrast`). WebKit does not expose **Reduce Transparency** or **Bold Text** to CSS; in the iOS shell, read them through a small native bridge and switch blur surfaces to opaque tokens. Dynamic Type is covered under Typography.
- State is never conveyed by color alone.

## App Store readiness (iOS build)

Design constraints that follow from Apple's App Review Guidelines (verify the current text before each submission):

- **Not a thin website (4.2):** reviewers expect more than a wrapped website. As a working heuristic, include native-feeling navigation, offline behavior and at least one genuinely native capability (for example push notifications or share).
- **Login services (4.8):** apps that offer third-party or social login must also offer an equivalent privacy-preserving login option; Sign in with Apple qualifies. Apple’s Human Interface Guidelines ask for equal or greater prominence and a white, black or outlined button with the Apple logo and the label "Sign in with Apple" or "Continue with Apple". The welcome mockup follows this visually; in the iOS build use the system `ASAuthorizationAppleIDButton`, and on web use Apple’s JS button. **Google sign-in cannot run inside an embedded WebView** (Google rejects it with `disallowed_useragent`): use `ASWebAuthenticationSession` or a native SDK with a custom-scheme or universal-link redirect, and route Supabase auth accordingly.
- **Account deletion (5.1.1(v)):** in-app account deletion must be reachable from Account, with a clear data-handling explanation. Data export is also in the product baseline.
- **Privacy (5.1.1, 5.1.2):** a privacy-policy link on the sign-in screen and in Account, accurate App Privacy "nutrition" labels, and no tracking without App Tracking Transparency consent. The mockups link to `#privacy` and `#terms` placeholders.
- **Permissions:** explain why before the system prompt (notifications, clipboard). Ask in context, not at launch.
- **User-generated content (1.2):** friends, handles and public profiles need reporting, blocking and moderation. The product baseline already includes blocking and reporting; the mockups do not show those controls.
- **Accurate content:** no fabricated live counts or leaderboard numbers; sample data in mockups is marked `SAMPLE DATA`. Do not present a global cross-game score (non-goal in `IDEA.md`).
- **Assets:** Xcode needs a single 1024px PNG app icon (no alpha) and a launch screen. The web build separately needs a 180px `apple-touch-icon` PNG and PWA icons (already generated by `scripts/generate-icons.mjs`). SVG is not accepted for any of these.
- **Native shell setup, when requested:** bundle identifier, signing team, `Info.plist` usage strings, Associated Domains (universal links), Push Notifications and Sign in with Apple capabilities, and ATS-compliant HTTPS endpoints.

## Using these files

Each screen is a standalone `code.html` that loads the shared tokens, so it renders in any browser; open one directly, or on a phone through any static file server. Screenshots (`screen.png`) are 393 x 852 @2x renders of the top of each screen on an emulated iPhone with a 59px top and 34px bottom safe area. To build any screen for real, re-create it in the React app with the tokens above; do not copy the HTML.
