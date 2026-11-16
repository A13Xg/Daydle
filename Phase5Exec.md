# Phase 5 Execution Plan — Today experience, PWA, and external-game navigation

**Status:** REVIEWED / IMPLEMENTATION IN PROGRESS (verification pending)  
**Base:** reconciled `main` at `e076ccb3cfba8c3173442eb8ad77780727d8e309`; [Phase 4 PR #5](https://github.com/A13Xg/Daydle/pull/5) merged at `e0fcb2b`; main CI successful.  
**Branch:** `phase/05-today-pwa` · **Draft PR:** [#7](https://github.com/A13Xg/Daydle/pull/7).  
**Sources:** [IDEA.md](IDEA.md) sections 5–8, [roadmap.md](roadmap.md#phase-5--today-experience-pwa-and-external-game-navigation), [AGENTS.md](AGENTS.md), [Phase 4 archive](completedPhases/Phase4Exec.md).

## Preflight and constraints

Main contains OAuth-only Supabase authentication and a 12-game curated catalog with user selections, plus canonical result schema but **no working parsers or ingestion API**. Existing Cloudflare Worker serves `/api/v1/health` and SPA assets; production is a single reviewed environment, with NO preview/staging. The user requests development without an intervention unless truly necessary; **no credentials required for source work or CI**, and none will be read by PR tests. Phase 4 migration must be deployed before any future production catalog UI/Today code release, but that is a separate manual operator action.

iOS home-screen apps do **not** guarantee external-tab return handling and use a separate browser context/isolated storage. Clipboard reads require an explicit user gesture; no automatic reads on `focus`/`pageshow`/visibility. Authentication may be unavailable offline, and real installed-PWA OAuth verification has been explicitly deferred by owner. Never claim that simulator tests prove device behavior.

## Domain and privacy decisions

- `public.user_game_day_marks` records **owner-private, manually marked "Played" status** for a particular user's local calendar day (unique user+game+day). It does not create/alter canonical results or imply gameplay verification, score completion, streaks or leaderboard statistics. UI differentiates `Marked played` from `Result saved` (not supported until later phases).
- RLS owner SELECT/INSERT/DELETE, explicit role grants, FK to stable game IDs/profile; check selected game before allowing a mark, prevent direct updates and public exposure; add date validation and server-side ownership checks. No access via service worker. The browser sends an ISO local day from the device; it is a user-supplied label, not publisher reset time.
- A conservative **safe public catalog** snapshot may be stored locally for offline display, with TTL/version/bounds and revalidation before acceptance. Saved game ID ordering may be cached per-user on the current device **only while the session identifies that user**, but never exposed while signed out/another signed-in account; purge/switch isolation is enforced by account key. Do not persist raw share text, email, OAuth tokens, spoiler-sensitive results or private marks in PWA caches. Offline Today may show game list and `Played status unavailable offline`, not a fabricated completion.
- Service worker intercepts same-origin **navigation and generated static assets only**. It explicitly bypasses `/api/*`, `/auth*`, Supabase URL / any cross-origin requests, non-GET requests and requests with authorization headers. Navigate offline via generic SPA-shell fallback, never cache auth responses or personalized JSON.
- PWA icon assets need actual PNG dimensions 192/512 plus Apple 180px and a maskable 512px icon. Include web manifest `display=standalone`, `start_url=/today`, `scope=/`, descriptions, colors, `apple-touch-icon`, iOS meta and app name. Register SW only in production builds (no dev/HMR interference). Generate/cache hashed Vite shell assets at build time, version cache on rebuild, prune old cache names; no external PWA npm dependency.
- Global `Paste results` entry from all routes: dialog-like accessible modal with focus restoration, Escape/close behavior, labeled textarea, manual paste, explicit clipboard read on click, permission/empty/oversized/errors, one 10,000-character result limit, no autosave, no parse/submission until Phase 7. Clear input on closing/signing out; never log/store/share copied text.
- Launch anchors are validated external HTTPS, `target=_blank` with `rel=noopener noreferrer`. Record a short-lived *tab-session* launch hint, not authoritative gameplay. On focus/pageshow/visibility restoration reveal a return/resume CTA that user can activate to open Paste; no automatic clipboard or double focus events.

## Planned implementation files

1. `supabase/migrations/20261115050000_phase5_today_marks.sql` — owner-private marker table/RLS; no remote deploy. `tests/sql/today-assertions.sql` and `scripts/test-db.sh` two-clean-PG17 role tests.
2. `shared/today.ts`, `src/lib/today-api.ts` — local-day helpers, normalized status, owner-only mark/unmark, source catalog and selected games.
3. `src/lib/offline-snapshot.ts` — safe public catalog and per-user selected-ID snapshot with size, date, version, shape checks; never store private marks/results.
4. `src/components/TodayPage.tsx` — signed-in Today, public guest guidance, selected games, safe links, manually marked played/read-only offline/empty/loading/error/retry, optional rotation never obligatory, no fabricated scores.
5. `src/components/PasteDialog.tsx`, `src/lib/clipboard.ts`, `src/lib/launch-return.ts` — user-initiated Paste shell, short-lived launch resume and accessible return UI.
6. `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `index.html` — Today navigation, global Paste access, app-shell PWA initialization and iOS affordances.
7. `public/app.webmanifest`, `public/icons/*.png` and `scripts/build-pwa.mjs` plus service-worker template, emitted `dist/client/sw.js`. Update `package.json` build script; no third-party dependency needed. Build output must contain versioned precache assets and a custom `/sw.js` suitable for the Cloudflare assets Worker.
8. `tests/today.test.ts`, `tests/today-api.test.ts`, `tests/offline-snapshot.test.ts`, `tests/clipboard.test.ts`, `tests/pwa.test.ts`, `tests/paste-ui.test.ts` and `scripts/smoke.mjs` — realistic adapter failures, local date/DST, cross-account isolation, clipboard permissions, cache bypass, app shell.
9. `docs/pwa.md`, `README.md`, `AGENTS.md` — PWA offline boundaries, on-device Safari/install checklist, navigation behaviors, true release gates, schema-before-code compatibility.

## Implementation order

1. Commit this reviewed plan before implementation. Keep draft PR.
2. Owner-private SQL marker schema and positive/negative PostgreSQL role tests. Clarify no result assertion.
3. Shared types, server API and safe local snapshot data, harden user-switch and error/race cases.
4. Today route/UI and manual mark/unmark; launch/return hint and Paste dialog with focus handling and safe failure messages.
5. PWA build assets, generated versioned SW/precache, manifest/Apple icons; test static HTTP and offline cache bypass policies in simulated worker.
6. Write regression/unit/rendered UI tests and docs; run `npm ci`, typecheck/lint/format, Vitest, production build, preview HTTP smoke, and both clean PostgreSQL instances.
7. Audit changed diff for leaks, service worker cache scope, XSS, session switching, stale data, browser API permissions, input retention, PWA update strategy, static/deep link failures, and deployment incompatibility; repair and rerun.
8. Explicitly label real iPhone installed-PWA OAuth/return test **NOT VERIFIED** unless real device evidence exists. If that is a *material* acceptance gate (roadmap says yes), **keep draft and root-level plan**; otherwise archive after documented scope decision. No silent claim of iOS compatibility.
9. No auto-merge, remote migration, deploy, token access or Phase 6.

## Acceptance criteria

- [ ] Real database: 2 clean PG17 migrations and owner-private played markers; anon/other-user denial, only selected games markable, mark/unmark tested.
- [ ] Today accounts: selected list in correct order, manual played state and unambiguous no-result-yet labels, empty/loading/error/retry/offline flows; signed-out visitor guidance.
- [ ] External games: safe publisher links, cross-browser return/help CTA, no invented guaranteed PWA-to-Safari link capture.
- [ ] Paste shell: user-gesture clipboard only, manual fallback, denied, empty, oversize, interrupted, closing-clears, never submit/log/store before Phase 7.
- [ ] Manifest/valid PNG icons (192, 512, Apple 180), generated service worker, installability/HTTPS support, app shell direct-deep-link offline fallback.
- [ ] Offline: previously cached **safe** catalog and selected IDs only; no authenticated Supabase/API/puzzle results or raw content intercepted/cached; user-scoped snapshot does not show when signed out/other account.
- [ ] All frontend/Worker/unit/build/smoke/db CI pass; regression for service worker controls tested.
- [ ] Source/diff/security and docs review, no attribution or unapproved production mutation.
- [ ] Real iPhone Safari and installed PWA: install, external link, return, clipboard permission and offline/online restoration, Google/Apple installed-PWA authentication documented as **VERIFIED** only with actual device evidence; otherwise keep draft, flag blocked only at exit.

## Risks and explicit caveats

- Web Clipboard API permission and focus semantics differ across iOS Safari and home-screen web app. Manual textarea is always available and not dependent on automation.
- Browsers may evict SW Cache Storage and localStorage. No offline write promise; locally cached data never becomes authoritative.
- iPhone Safari does not support a generic JavaScript install prompt. Show Share → Add to Home Screen guidance, no fake `beforeinstallprompt` success.
- Don't cache `GET /rest/v1/*` in SW even for public data, as row-level security can depend on JWT and viewer context. Only own carefully curated safe metadata goes into local per-device snapshot.
- Game `puzzle_date` and publisher reset date are not interchangeable with the device local date; manual played is not a result. Later Phase 7 connects real verified result dates.
- Device-installed PWA sign-in behavior is an existing owner-deferred item; record as open, not silently mark done.

## Actual results, evidence and review disposition

**Pending**. Record execution evidence and CI links; keep phase plan active until material verification gates are satisfied.
