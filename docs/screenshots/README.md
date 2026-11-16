# Obsidian Arcade browser screenshots

Captured from the real built React application on the Phase 6.5 feature branch, using GitHub Actions CI run [#43942504930](https://github.com/A13Xg/Daydle/actions/runs/43942504930) and headless Chromium CDP with a 393 × 852 CSS-pixel mobile viewport (device scale factor 2; 786 × 1704 PNG output). The screenshots are neither generated mockups nor a deployed production capture.

- **arcade-today-guest.png** — unauthenticated Today view. No user data or saved games are shown.
- **arcade-statistics-placeholder.png** — Statistics tab future-state placeholder. Statistics are not yet implemented or calculated.

Environment: CI build does not inject Supabase project credentials, so these demonstrate public/guest presentation, not authenticated features. The browser emulates iOS safe-area insets; this does **not** constitute real iPhone Safari or installed-PWA testing. The owner has deferred that testing for the Phase 6.5 review, to be performed before the relevant release.

Screenshots are documentation-only assets and are not part of the PWA precache or production bundle.
