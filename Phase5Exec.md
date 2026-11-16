# Phase 5 Execution Plan — Today experience, PWA, and external-game navigation

**Status:** RELEASE CANDIDATE / READY FOR HUMAN REVIEW — automated checks passed; production and physical iPhone acceptance pending  
**Base:** reconciled `main` at `e076ccb3cfba8c3173442eb8ad77780727d8e309`; [Phase 4 PR #5](https://github.com/A13Xg/Daydle/pull/5) merged at `e0fcb2b`; main CI successful.  
**Branch:** `phase/05-today-pwa` · **Release-candidate PR:** [#7](https://github.com/A13Xg/Daydle/pull/7).  
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
8. Explicitly label real iPhone installed-PWA OAuth/return test **NOT VERIFIED** unless real device evidence exists. If that is a *material* acceptance gate (roadmap says yes), **keep the root-level plan active and Phase 5 unverified**; the owner's subsequent release-first authorization permits human PR review/merge before the physical-iPhone gate. No silent claim of iOS compatibility.
9. No auto-merge, remote migration, deploy, token access or Phase 6.

## Acceptance criteria

- [x] Real database: 2 clean PG17 migrations and owner-private played markers; anon/other-user denial, only selected games markable, mark/unmark tested.
- [x] Today accounts: selected list in correct order, manual played state and unambiguous no-result-yet labels, empty/loading/error/retry/offline flows; signed-out visitor guidance.
- [x] External games: safe publisher links, cross-browser return/help CTA, no invented guaranteed PWA-to-Safari link capture.
- [x] Paste shell: user-gesture clipboard only, manual fallback, denied, empty, oversize, interrupted, closing-clears, never submit/log/store before Phase 7.
- [x] Manifest/valid PNG icons (192, 512, Apple 180), generated service worker, installability/HTTPS support, app shell direct-deep-link offline fallback.
- [x] Offline: previously cached **safe** catalog and selected IDs only; no authenticated Supabase/API/puzzle results or raw content intercepted/cached; user-scoped snapshot does not show when signed out/other account.
- [x] All frontend/Worker/unit/build/smoke/db CI pass; regression for service worker controls tested.
- [x] Source/diff/security and docs review, no attribution or unapproved production mutation.
- [ ] Real iPhone Safari and installed PWA: install, external link, return, clipboard permission and offline/online restoration, Google/Apple installed-PWA authentication documented as **VERIFIED** only with actual device evidence; otherwise leave phase acceptance open and record the unverified device gate; the owner-authorized release-first PR review exception applies.

## Risks and explicit caveats

- Web Clipboard API permission and focus semantics differ across iOS Safari and home-screen web app. Manual textarea is always available and not dependent on automation.
- Browsers may evict SW Cache Storage and localStorage. No offline write promise; locally cached data never becomes authoritative.
- iPhone Safari does not support a generic JavaScript install prompt. Show Share → Add to Home Screen guidance, no fake `beforeinstallprompt` success.
- Don't cache `GET /rest/v1/*` in SW even for public data, as row-level security can depend on JWT and viewer context. Only own carefully curated safe metadata goes into local per-device snapshot.
- Game `puzzle_date` and publisher reset date are not interchangeable with the device local date; manual played is not a result. Later Phase 7 connects real verified result dates.
- Device-installed PWA sign-in behavior is an existing owner-deferred item; record as open, not silently mark done.

## Actual results, evidence and review disposition

**Phase branch:** `phase/05-today-pwa`; [release-candidate PR #7](https://github.com/A13Xg/Daydle/pull/7). **Source implementation is complete and automated gates pass.** Full Phase 5 acceptance remains **BLOCKED** on execution of the owner-authorized hosted release and real iPhone Safari/installed-PWA observation.

### Delivered source

- Forward-only `supabase/migrations/20261115050000_phase5_today_marks.sql` with a private RLS-protected, owner-owned `user_game_day_marks` table. Manual status is unique per user/game/device-local-day; existing selected-game FK cascade maintains integrity and it creates no verified result.
- `/today` (also home) loads owner selections in order, shows external game launch links, an explicit manual played/unplayed toggle, no-result-yet status, optional participation, loading/empty/error/retry and safe read-only offline fallback.
- Catalog browser and game details show bounded offline **public metadata**, with account-specific ordered selections only when the current authenticated identity matches. Offline editor actions are disabled, never silently queued.
- Global `Paste Results` on all routes, including a fixed mobile action while scrolling, short-lived publisher return hint, explicit-gesture Clipboard API access, manual paste/denied/empty/oversize fallbacks, labeled accessible dialog, Escape/cancel/clear, no clipboard persistence/upload.
- Reproducible standard PNG 180/192/512 + maskable icons, `app.webmanifest`, Apple installation metadata and root service worker generated with a SHA-256-derived cache identifier after Vite build.
- Service worker intercepts only public same-origin app-shell routes/static assets. It excludes auth/callback/account, `/api/*`, Supabase/cross-origin, credential-bearing requests and non-GET/query-bearing requests; offline shell and snapshot explicitly contain no private results, raw share text or sensitive tokens.
- Operations documentation `docs/pwa.md`, README and AGENTS.md updated for genuine Safari limitations, schema-before-app rollout and documented manual iOS matrix.

### Executed verification

**Final immutable-source CI:** https://github.com/A13Xg/Daydle/actions/runs/43803934602 — both `validate` and `database-security` SUCCESS on final audited source.

| Gate | Observed |
|---|---|
| Locked install / strict TypeScript | PASS |
| ESLint and immutable Prettier check | PASS |
| Unit, API, UI, SW and privacy tests | **84 passed, 19 suites** |
| Vite/Cloudflare Worker production build | PASS; SW generated for **9 hashed/static shell assets** under `daydle-shell-c7e1764097457c64` |
| HTTP smoke | PASS; API/health, root + Today deep link, manifest/PNG dimensions, emitted service worker |
| PostgreSQL 17 isolated replay | PASS on **two fresh databases** across all versioned migrations |
| Manual marker authorization and integrity | PASS; owner read/mark/unmark, anonymous/other-user denial, selected-game FK, duplicate prevention, cascade, no fabricated results |
| Source patch audit | PASS; no hardcoded keys, eval, unsafe HTML injection, automatic deployment commands or nonowner contributor attribution |

### Security / UX audit and corrections

- Rendered the user's Today activity only after the current account's identity is known; stateful route keys separate account sessions. Read-only public snapshots are projected to a strict list of catalog properties and user-selected IDs, bounded by size, age and owner key.
- Corrected service-worker ESLint global declarations and committed canonical Prettier formatting rather than leaving a CI mutating step. Final CI is non-mutating.
- Added read-only offline support in existing `CatalogPage` as well as Today. Saving and reordering are prohibited when only cached data or no network is available.
- Made the mobile Paste control persist in the viewport while the page scrolls. Clipboard text stays only in React memory until dialog closes; no network API is connected.
- Cleared the in-memory Paste component when the authenticated user changes, preventing clipboard preview text from surviving an account switch. Also corrected wording for an unconfirmed manual-marker write. Reviewed PR file list and patch for credential/log/authorization leaks. No hosted account, project configuration, migration or Worker deployment was modified.

### Unverified material gates (post-release acceptance; not phase completion)

- **Release authorization is now granted by the owner**, but no hosted migration or deployment has run. The protected, main-only release workflow has been prepared on PR #7; execution requires the source to be merged into `main` and the existing production environment reviewer approval. The existing production site must still be treated as running the old schema/frontend until a successful live release job.
- No physical iPhone Safari or installed home-screen PWA was available to exercise OAuth, installation, real external publisher handoff/return, clipboard gesture/permission handling, offline reload or account-switch isolation. All eight device scenarios in [docs/pwa.md](docs/pwa.md) are **NOT VERIFIED**, not implicitly satisfied by browser API mocks or SW simulation.
- Signed-in hosted marker changes, OAuth and saved-game persistence could not be verified end-to-end without the authorized schema-first deployment.
- There is no history UI or canonical parser/ingestion yet; those belong to Phase 7 and Phase 6 respectively. History cannot be pre-cached until such a view exists.
- No guarantee that Safari routes external pages back to installed PWAs; UI provides explicit home-screen/tab switcher guidance.

### Disposition and next action

**Release-first acceptance exception:** The owner authorized a production rollout before performing physical-iPhone tests. The only production environment requires main-only deployment, so PR #7 may become **READY FOR HUMAN REVIEW** as a release candidate with green CI, while `Phase5Exec.md` stays active and Phase 5 remains NOT COMPLETE until real-device evidence. **No automatic merge, deployment, protected-review bypass, plan archival or Phase 6 start is authorized.** Owner must review/merge PR #7, then dispatch/approve the protected release, then test the iPhone.

To unblock the **approved release**, first complete review and merge of PR #7 (required by the main-only production environment), then manually dispatch the new [Release Phase 5 — schema-first production rollout](.github/workflows/release-phase5.yml) on `main` and approve the protected production job. It fail-closes if remote migration history differs from exactly the reviewed Phase 2–5 chain, applies pending SQL before deploying, and verifies live PWA endpoints. Finally run the [eight real-iPhone acceptance scenarios](docs/pwa.md#manual-iphone-acceptance-matrix--not-verified) and record actual results. The Supabase integration was installed, but no direct database actions were exposed in this chat when the release was prepared.


### Release preparation performed after explicit authorization

- Added `scripts/ops/verify-migration-plan.mjs` and `tests/release-plan.test.ts`, using an exact allowlist of the four existing migrations and refusing unknown remote SQL history or missing Phase 2/3 baseline.
- Added `.github/workflows/release-phase5.yml` as a manual `main`-only GitHub Actions workflow using the existing reviewer-protected `production` environment and its GitHub secrets/variables. It runs the full frontend suite, confirms project identity, links Supabase CLI v2.117.0, checks and dry-runs remote migrations, applies pending reviewed SQL with explicit confirmation, verifies all four are deployed, builds with production public configuration, deploys Cloudflare, and smoke-tests live PWA URLs.
- **No live execution yet:** The connected Supabase app has no callable SQL tools exposed in this session; the GitHub integration cannot dispatch workflows, and PR #7 is unmerged. No bypass of branch policy or privileged credentials was attempted.
- Local release-plan checks passed with the rest of the test suite in GitHub Actions. The release run itself, hosted migration state and final iPhone scenarios remain NOT VERIFIED.

### Production attempt and guarded recovery (Nov 16, 2026)

- Owner merged [PR #7](https://github.com/A13Xg/Daydle/pull/7) into `main` at `75039ac1`; main CI succeeded.
- Owner dispatched [production run 43810002170](https://github.com/A13Xg/Daydle/actions/runs/43810002170). Environment credentials and `supabase link` succeeded; strict Phase 2/3 migration-history preflight failed. **No remote SQL migration, Worker deployment or PWA smoke test ran.**
- [Fix PR #8](https://github.com/A13Xg/Daydle/pull/8) implements version-only history diagnostics and conditional `migration repair` **only after** a read-only verification of existing Phase 2/3 RLS tables, policies, functions, and signup trigger. Missing/invalid schema, extra versions, later untracked objects or insufficient token scope halt before writes. See `ReleaseFixPlan.md`.
- After the fix is reviewed/merged, owner reruns the protected main release. Real hosted checks and all iOS installed-PWA acceptance remain NOT VERIFIED until successful evidence exists.

### Recovery patch independently verified

[Fix PR #8](https://github.com/A13Xg/Daydle/pull/8) has [passing CI](https://github.com/A13Xg/Daydle/actions/runs/43811905266): 98 tests/21 suites, two clean PostgreSQL databases and the exact read-only remote-schema probe exercised after Phase 3 and after Phase 5. This is verified **local** proof of the probe query and version guard behavior, **not** evidence that hosted migration history was repaired. The failed production release made no data changes. A new protected deployment run remains required before iPhone PWA testing.
