# Obsidian Arcade — screenshot evidence

Captured from the **compiled Daydle React/Vite application**, not from reference mockups or production, in [UI comparison CI #43948359080](https://github.com/A13Xg/Daydle/actions/runs/43948359080). Captures use Chromium's DevTools Protocol at **393 × 852 CSS pixels**, device-scale factor 2 (786 × 1704 image), with 59px top/34px bottom safe-area emulation.

| File | Verified state | Design reference |
|---|---|---|
| [arcade-today-guest.png](arcade-today-guest.png) | Signed-out Today, zero fictional game results; overview hero and real catalog/auth actions | `today/screen.png` (authenticated reference, not directly comparable for result metrics) |
| [arcade-statistics-placeholder.png](arcade-statistics-placeholder.png) | Four honest unavailable metric cards plus unpopulated distribution panel | `statistics/screen.png` (mockup uses illustrative statistics) |
| [arcade-auth-unconfigured.png](arcade-auth-unconfigured.png) | Blank-shell authentication hero and icon-branded Apple/Google buttons, disabled because Supabase configuration is absent from CI | `welcome_auth/screen.png` (mockup's live counts and email form are not available here) |

## Comparison and corrections

- Preserved the approved Obsidian Arcade dark palette, Plus Jakarta Sans, rounded tiles/card hierarchy, five-tab frosted shell, and explicit stack/blank navigation.
- Rebuilt the authentication hero to match the reference's emblem + wordmark + primary headline + provider button order/brand marks; no sample live-count or unsupported email action was fabricated.
- Rebuilt the Statistics future state using the mockup's **Master Metrics** 2×2 card hierarchy and **Guess Distribution** section while showing dashes and explicit unavailable descriptions instead of fabricated percentages, streaks, or win data.
- Refined guest Today to echo the reference's status strip, feature panel, two-column secondary cards and prominent primary CTA. Authenticated Today retains its actual selected-game rotation; it is **not** visually covered by these credential-free screenshots.
- Corrected mobile nav/brand labels to be at least 11px and restored minimum 44×44px header icon targets; browser checks assert geometry and typography at 320/393/1024px.

**Limitations:** CI has no Supabase project configuration, so these screenshots cannot demonstrate signed-in games, provider callback, or private user data. Physical iPhone Safari/home-screen PWA acceptance is **owner-deferred and NOT VERIFIED**; real-device testing remains required before release. Images are source-only documentation, excluded from the production/PWA bundle and precache.
