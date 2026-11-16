# Phase 5 Execution Plan — Today experience, PWA, and external-game navigation

**Status:** PLANNING · **Base:** `main` `e076ccb3cfba8c3173442eb8ad77780727d8e309` after Phase 4 PR #5 merge and roadmap reconciliation · **Branch:** `phase/05-today-pwa`

**Authority:** [roadmap.md](roadmap.md#phase-5--today-experience-pwa-and-external-game-navigation), [IDEA.md](IDEA.md), [AGENTS.md](AGENTS.md), prior Phase 4 archive.

## Intended scope
Mobile Today from saved game selections; safe publisher launch and explicit return guidance; user-initiated paste shell including manual/denied/empty clipboard paths (parsing deferred to Phase 6–7); a distinct manually-marked-played state without fabricating verified result ingestion; PWA install manifest/icons and offline read-only cache of safe public catalog and owner-scoped navigation data; app resume handling; iOS Safari/PWA affordances, accessibility and automated tests.

## Non-goals and safeguards
No actual parsing/saving of pasted results, no fabricated scores or automatic clipboard reads, no background sync, no spoiler-bearing service-worker caches, no production schema/app deployment, no second environment, no automatic merge. Apple/Google OAuth remains unchanged.

## Initial acceptance targets
- Today shows selected games in server order, empty/error/offline states, safe external launch, mark/unmark manually played and honest recorded-result status.
- Paste modal/global entry and foreground-resume action with direct-gesture clipboard read and manual fallback; no raw text logged/persisted without explicit Phase 7 ingestion.
- Installable manifest and iOS icons, offline app shell/navigation, safe public cached catalog, no authenticated/API service-worker caching.
- PG17 DB/role tests if persistence schema changes, automated frontend/Worker tests, build, smoke and PWA service-worker checks.
- Record real-device Safari/installed-PWA checks honestly as verified or unavailable. Keep draft if a required device acceptance gate cannot be met.

**Next:** Open draft PR, expand and review this plan, then implement.
