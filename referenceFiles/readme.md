# Daydle UI/UX Reference

> **Owner-approved UI/UX design standard and example collection.**
> Obsidian Arcade and these 13 screens define the intended visual direction for Phase 6.5. They do not independently authorize mockup-only features or serve as production React code.

## How to use this folder

- **Visual authority:** apply DESIGN.md tokens, three shells, screen structure and component patterns when Phase 6.5 or later UI work calls for them.
- **Functional authority:** [IDEA.md](../IDEA.md), [roadmap.md](../roadmap.md), and [AGENTS.md](../AGENTS.md) govern behavior and feature scope. Treat sample counters, rankings, friend requests, reactions and notification demos as unapproved.
- **Implementation:** rebuild in React using bundled assets, tested state and accessibility behavior. Standalone Tailwind Play HTML and screenshots are references, not shippable code.
- **Reference snapshot:** preserve the examples; change the design baseline only through a reviewed revision.

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

The product currently ships as a web/PWA. Future iOS packaging may be explored separately, but is **not scoped or authorized now**. Preserve compatibility with a possible WKWebView wrapper when choosing web technologies. The mockups are written with that portability goal: viewport and safe-area handling, 16px inputs, 44pt hit areas, touch-safe reordering, accessible controls and no hotlinked assets. The rules, and the App Store requirements they come from, are in `DESIGN.md`.

Two mockup-only shortcuts must **not** ship: the Tailwind Play CDN and the Google Fonts and Material Symbols links. The real app compiles Tailwind and bundles fonts and icons.

## Where the mockups differ from the product baseline

These are visible in the mockups but are **not** in `IDEA.md` or `roadmap.md`. Treat each as a decision for the owner, not a to-do:

- **Friend requests:** `friends` shows a "Requests" tab. The baseline defines instant, mutual friendship with no acceptance step.
- **Rankings and counts:** "Global Streak", "Division" and group rank copy, and the live "14,280" counter, imply global or invented numbers. The baseline excludes a global cross-game leaderboard and forbids a fabricated universal score. Only the welcome screen’s live counter is marked `SAMPLE DATA`; other invented figures (percentile ranks such as "Top 8%", "Division") are not, and should be treated as sample copy.
- **Notifications and auto-launch:** the `notifications` screen, "Morning Drop Alert", "Launch All" and "Auto-Launch" need push notifications and multi-site launching, which the baseline does not specify. Browsers and `WKWebView` block more than one external launch per tap.
- **Blocking and reporting:** the baseline includes them; the mockups do not show them.
- **Reactions:** "Cheer" and "Salute" are not in the baseline.
- **Account screen:** it lists infrastructure, framework and monetization rows that are developer-facing, not user settings.
- **Native apps:** not part of the current implementation roadmap. Avoid incompatible web architecture; do not begin native packaging, testing or release work until separately authorized.
