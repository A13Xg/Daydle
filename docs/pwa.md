# Daydle — Today and PWA (Phase 5)

## What is usable

- **Today**: open `/today` (also the home screen), sign in with Google or Apple and see selected games in the saved order. Use a safe publisher link or visit `/games` to add/reorder games. Participation is optional, not a streak obligation.
- **Manual play**: `Mark played` changes an owner-private `user_game_day_marks` record for the current **device-local calendar date**. It is not a canonical puzzle result, verified win, statistic or proof of playing on the publisher. Remove marks with `Unmark played`. Unselecting a game cascades its manual markers. Future Phase 7 adds result ingestion.
- **Return**: publisher links are HTTPS only, open in a new tab/context when the browser permits and can leave an installed iOS PWA. On returning to Daydle, a contextual banner offers `Paste Results`; it never silently reads the clipboard. A fallback is to reopen Daydle from the home screen or tab switcher.
- **Paste Results**: global entry available from every page, opens a labeled accessible manual textarea and an explicit `Paste from clipboard` control. Permission denial, empty data, unavailable browser API and overlong text (>10,000 chars) have distinct messages. Dismissal discards text. **Nothing is submitted, parsed or uploaded until the parser/ingestion phases.**
- **Install**: Safari on iPhone → Share → Add to Home Screen. Daydle ships manifest with `standalone` mode, a 180px Apple touch icon, 192/512px icons and a maskable icon. Safari has no universal in-app install prompt.

## Offline design

The service worker is generated from `scripts/sw-template.js` by `scripts/build-pwa.mjs` after Vite finishes. Each build uses a SHA-256-derived cache name based on emitted HTML/static assets; old `daydle-shell-*` caches are removed on activation. The install step precaches only static app shell HTML, JS, CSS, icons, and manifest.

- Same-origin `/today`, `/games` and safe game-detail navigation may fall back to the generic index page while offline.
- Only same-origin `/assets/*`, `/icons/*`, `/app.webmanifest` and `/favicon.svg` static requests are cacheable. API, Supabase, account, auth callback, non-GET, cross-origin, signed/authenticated and query-bearing requests are intentionally bypassed.
- The app stores a bounded, expiring **public catalog projection** and the current signed-in user's **ordered saved game IDs** locally, segregated by authenticated user ID and never rendered to another account or to signed-out visitors. A snapshot expires after seven days and can be evicted by browser storage pressure. No private played flags, results, auth tokens, email or clipboard contents are written to that cache.
- Offline Today is explicitly **read-only** and displays `Played status unavailable offline` when it cannot access private live rows. Do not infer `not played`. The `history` view is planned for Phase 7; there is no history cache to implement yet.
- The browser network state is advisory. If a request fails despite `navigator.onLine`, Today may fall back to previously saved data. If the browser cannot restore an offline authenticated session, Today may instead show a login requirement; this does not expose another user's cached game selection.

## Security and schema

Apply `supabase/migrations/20261115050000_phase5_today_marks.sql` **after** Phase 4 migrations and before deploying the associated frontend, only with explicit release authorization. The unique (user,game,local_date) constraint, (user,game) selection FK, owner-only SELECT/INSERT/DELETE RLS and absence of UPDATE grant are tested in two disposable PostgreSQL 17 databases by CI. The manual status has no link to result scoring, statistics or public profiles.

Testing without credentials: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run preview -- --port 4173`, `npm run smoke`, and `bash scripts/test-db.sh` on disposable PG17.

## Manual iPhone acceptance matrix — NOT VERIFIED

These checks **cannot be marked passed from CI alone** and remain outstanding until observed on a real device and a properly migrated, authorized environment:

| # | Scenario | Expected result | Status |
|---|---|---|---|
| 1 | Open Daydle in iPhone Safari and add to home screen | Standalone app opens with Daydle icon and Today page | NOT VERIFIED |
| 2 | Google OAuth from installed PWA | Provider completes and app resumes authenticated session without browser-storage confusion | NOT VERIFIED |
| 3 | Apple OAuth from installed PWA | Provider completes and app resumes authenticated session (private relay accepted) | NOT VERIFIED |
| 4 | Open a selected publisher game, play and return | External context opened if supported; app return/resume/Paste control visible | NOT VERIFIED |
| 5 | Tap Paste from clipboard | Explicit tap reads supported clipboard or shows permission/manual fallback; no automatic read | NOT VERIFIED |
| 6 | Turn on airplane mode after visiting Today/catalog and reopen | Generic app shell loads with previously viewed safe game list; no fabricated result state | NOT VERIFIED |
| 7 | Switch between two accounts on one device | No other account's game list, manual markers or copied text is displayed | NOT VERIFIED |
| 8 | Reconnect and retry Today | Private status reloaded; no queued offline writes replayed | NOT VERIFIED |

iOS installed PWAs may have isolated browser storage distinct from Safari tabs and do not capture arbitrary Safari URLs. No guarantee of automatic return is made. References: [web.dev PWA installation](https://web.dev/learn/pwa/installation/), [MDN service worker caching](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching).

## Operational notes

PR CI never deploys the PWA automatically. The owner **has explicitly authorized** a Phase 4-then-Phase 5 migration and Worker rollout, but no such hosted changes have yet occurred. Because the environment is restricted to `main`, Phase 5 must first be reviewed and merged by the owner; the separate merge prohibition remains in force. Then manually run [Release Phase 5 — schema-first production rollout](../.github/workflows/release-phase5.yml) from GitHub Actions on `main` (or `gh workflow run release-phase5.yml --ref main`), and approve the protected `production` job. The workflow verifies the exact migration history, dry-runs, applies pending approved migrations, verifies their presence, deploys the Worker and checks live URLs. Do not test as a completed release unless the workflow succeeds. Do not claim Phase 5 passed its real-device gate without observed iPhone evidence.
