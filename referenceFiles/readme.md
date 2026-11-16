# Daydle UI/UX Reference

> **Reference material only. Nothing in this folder is a requirement.**
> These screens and the design system are exploratory. They do **not** need to be implemented, matched or ported unless the owner explicitly asks for a specific screen or style in the current instruction.

## How to use this folder

- **Default: ignore it.** Phase work follows [IDEA.md](../IDEA.md), [roadmap.md](../roadmap.md) and [AGENTS.md](../AGENTS.md). Those always win over anything here.
- **Build from it only on explicit request**, for example "build the Today screen from the reference". Completing a phase or building a feature is not a request to copy these screens.
- **Do not treat it as approved design.** Visual design is intentionally deferred in the product baseline. Do not adopt the palette, type or layout on your own initiative.
- **Read-only snapshot.** Do not edit these files to track implementation.

## What is here

Everything lives in `Daydle UI-UX Reference/`.

| Path | Contents |
|---|---|
| `DESIGN.md` | The one design system (**Obsidian Arcade**): tokens, rules, components, and the web + iOS (Xcode) and App Store guidance. Start here. |
| `assets/` | Local emblem and placeholder avatars used by the mockups. |
| `<screen>/code.html` | A standalone mockup, built from the `DESIGN.md` tokens. |
| `<screen>/screen.png` | 393 x 852 @2x render of the top of that screen on an emulated iPhone (59px top and 34px bottom safe area). |

| Screen | Shell | Screen | Shell |
|---|---|---|---|
| `welcome_auth` | blank | `statistics` | tab |
| `profile_setup` | stack | `friends` | tab |
| `how_it_works` | stack | `account` | tab |
| `today` | tab | `paste_results` | stack |
| `discover` | tab | `lineup_editor`, `celebration`, `notifications` | stack |
| `comparisons` | tab | | |

The tab screens link to each other, so you can click through them in a browser.

## Platform: web and iOS from one codebase

The product ships as a web app and also builds for iOS through Xcode (a `WKWebView` shell, such as Capacitor, around the same bundle). The mockups are written to that constraint: viewport and safe-area handling, 16px inputs, 44pt hit areas, touch-safe reordering, accessible controls and no hotlinked assets. The rules, and the App Store requirements they come from, are in `DESIGN.md`.

Two mockup-only shortcuts must **not** ship: the Tailwind Play CDN and the Google Fonts and Material Symbols links. The real app compiles Tailwind and bundles fonts and icons.

## Where the mockups differ from the product baseline

These are visible in the mockups but are **not** in `IDEA.md` or `roadmap.md`. Treat each as a decision for the owner, not a to-do:

- **Friend requests:** `friends` shows a "Requests" tab. The baseline defines instant, mutual friendship with no acceptance step.
- **Rankings and counts:** "Global Streak", "Division" and group rank copy, and the live "14,280" counter, imply global or invented numbers. The baseline excludes a global cross-game leaderboard and forbids a fabricated universal score. Only the welcome screen’s live counter is marked `SAMPLE DATA`; other invented figures (percentile ranks such as "Top 8%", "Division") are not, and should be treated as sample copy.
- **Notifications and auto-launch:** the `notifications` screen, "Morning Drop Alert", "Launch All" and "Auto-Launch" need push notifications and multi-site launching, which the baseline does not specify. Browsers and `WKWebView` block more than one external launch per tap.
- **Blocking and reporting:** the baseline includes them; the mockups do not show them.
- **Reactions:** "Cheer" and "Salute" are not in the baseline.
- **Account screen:** it lists infrastructure, framework and monetization rows that are developer-facing, not user settings.
- **Native apps:** `IDEA.md` lists native apps as an initial-release non-goal. The iOS/Xcode target above is a later step and needs a roadmap decision before work starts.
