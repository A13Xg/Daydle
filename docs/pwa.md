# Daydle — Today and PWA (Phase 5)

## What is usable

- **Today**: open `/today` (also the home screen), sign in with Google or Apple and see selected games in the saved order. Use a safe publisher link or visit `/games` to add/reorder games. Participation is optional, not a streak obligation.
- **Manual play**: `Mark played` changes an owner-private `user_game_day_marks` record for the current **device-local calendar date**. It is not a canonical puzzle result, verified win, statistic or proof of playing on the publisher. Remove marks with `Unmark played`. Unselecting a game cascades its manual markers. Phase 7 adds separate, private, authenticated canonical result ingestion without changing manual play markers.
- **Return**: publisher links are HTTPS only, open in a new tab/context when the browser permits and can leave an installed iOS PWA. On returning to Daydle, a contextual banner offers `Paste Results`; it never silently reads the clipboard. A fallback is to reopen Daydle from the home screen or tab switcher.
- **Paste Results**: global entry available from every page, opens a labeled accessible manual textarea and an explicit `Paste from clipboard` control. Permission denial, empty data, unavailable browser API and overlong text (>10,000 chars) have distinct messages. Dismissal discards text. **No text is uploaded on open, manual paste, or clipboard read. An explicit authenticated Submit result uploads the text for parser validation; bounded unparsed input is retained privately with a categorized failure reason and 90-day expiry metadata.**
- **Install**: Safari on iPhone → Share → Add to Home Screen. Daydle ships manifest with `standalone` mode, a 180px Apple touch icon, 192/512px icons and a maskable icon. Safari has no universal in-app install prompt.

## Offline design

The service worker is generated from `scripts/sw-template.js` by `scripts/build-pwa.mjs` after Vite finishes. Each build uses a SHA-256-derived cache name based on emitted HTML/static assets; old `daydle-shell-*` caches are removed on activation. The install step precaches only static app shell HTML, JS, CSS, icons, and manifest.

- Same-origin `/today`, `/games`, `/lineup`, `/statistics`, `/friends`, `/notifications`, `/how-it-works`, and safe game-detail navigation may fall back to the generic index page while offline. The service worker still excludes `/account` and `/auth`, and only caches generic HTML/static assets, never private data.
- Only same-origin `/assets/*`, `/icons/*`, `/fonts/*`, `/arcade-emblem.svg`, `/app.webmanifest` and `/favicon.svg` static requests are cacheable. API, Supabase, account, auth callback, non-GET, cross-origin, signed/authenticated and query-bearing requests are intentionally bypassed.
- The app stores a bounded, expiring **public catalog projection** and the current signed-in user's **ordered saved game IDs** locally, segregated by authenticated user ID and never rendered to another account or to signed-out visitors. A snapshot expires after seven days and can be evicted by browser storage pressure. No private played flags, results, auth tokens, email or clipboard contents are written to that cache.
- Offline Today is explicitly **read-only** and displays `Played status unavailable offline` when it cannot access private live rows. Do not infer `not played`. The `history` view is planned for Phase 7; there is no history cache to implement yet.
- The browser network state is advisory. If a request fails despite `navigator.onLine`, Today may fall back to previously saved data. If the browser cannot restore an offline authenticated session, Today may instead show a login requirement; this does not expose another user's cached game selection.

## Security and schema

Apply `supabase/migrations/20261115050000_phase5_today_marks.sql` **after** Phase 4 migrations and before deploying the associated frontend, only with explicit release authorization. The unique (user,game,local_date) constraint, (user,game) selection FK, owner-only SELECT/INSERT/DELETE RLS and absence of UPDATE grant are tested in two disposable PostgreSQL 17 databases by CI. The manual status has no link to result scoring, statistics or public profiles.

Testing without credentials: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run preview -- --port 4173`, `npm run smoke`, and `bash scripts/test-db.sh` on disposable PG17.

## Manual iPhone acceptance matrix — OWNER-ATTESTED PASS

On November 16, 2026 the owner reported all eight scenarios **passed on a physical iPhone** following the authorized release. This is owner-attested manual verification, not an independently collected device log or CI simulation:

| # | Scenario | Expected result | Status |
|---|---|---|---|
| 1 | Open Daydle in iPhone Safari and add to home screen | Standalone app opens with Daydle icon and Today page | PASS — owner-reported |
| 2 | Google OAuth from installed PWA | Provider completes and app resumes authenticated session without browser-storage confusion | PASS — owner-reported |
| 3 | Apple OAuth from installed PWA | Provider completes and app resumes authenticated session (private relay accepted) | PASS — owner-reported |
| 4 | Open a selected publisher game, play and return | External context opened if supported; app return/resume/Paste control visible | PASS — owner-reported |
| 5 | Tap Paste from clipboard | Explicit tap reads supported clipboard or shows permission/manual fallback; no automatic read | PASS — owner-reported |
| 6 | Turn on airplane mode after visiting Today/catalog and reopen | Generic app shell loads with previously viewed safe game list; no fabricated result state | PASS — owner-reported |
| 7 | Switch between two accounts on one device | No other account's game list, manual markers or copied text is displayed | PASS — owner-reported |
| 8 | Reconnect and retry Today | Private status reloaded; no queued offline writes replayed | PASS — owner-reported |

iOS installed PWAs may have isolated browser storage distinct from Safari tabs and do not capture arbitrary Safari URLs. No guarantee of automatic return is made. References: [web.dev PWA installation](https://web.dev/learn/pwa/installation/), [MDN service worker caching](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching).

## Operational notes and completed release

- The owner merged [PR #7](https://github.com/A13Xg/Daydle/pull/7) and [PR #10](https://github.com/A13Xg/Daydle/pull/10); [main CI](https://github.com/A13Xg/Daydle/actions/runs/43833255126) later passed following reference PR #11.
- The authorized [release 43814332227](https://github.com/A13Xg/Daydle/actions/runs/43814332227) applied Phase 4/5 migrations and deployed Cloudflare Worker `daydle-app`. The final immediate smoke false negative occurred after deployment; later public probes passed and PR #10 hardened the validator.
- The owner reported the eight physical-device checks above passed. Earlier interim notes are retained in [completedPhases/Phase5Exec.md](../completedPhases/Phase5Exec.md) for traceability.
- This documentation closure does not authorize any further migration, production deployment or provider changes.
