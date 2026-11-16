# Phase 4 Execution Plan — Game catalog, selection, and discovery

**State:** PLANNING · **Base:** `main` at `d4644ceb4a5bc8e41258d40eefd30f118c2e425d` · **Branch:** `phase/04-game-catalog`.

## Scope and acceptance
Catalog SQL seed and admin-authorized mutations; public browse/search/categories/detail; signed-in add/remove/reorder with persisted owner selections; active/retired and supported/unsupported states; sanitized outbound publisher links; accessible error/empty/loading/disabled/retry. Test RLS/constraints, admin gate, UI/model and selection races, existing CI.

No parsing, result submission, Today/PWA, automatic external remote migration, deployment or changes to production. Full visual design deferred. The catalog is launchable, not yet result-parseable.

**Next:** Open draft PR, expand and review this plan before implementing source files.
