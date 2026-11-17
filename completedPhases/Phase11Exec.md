# Phase 11 — Administration, game requests/voting, and diagnostics

**Status:** SOURCE COMPLETE / CI VERIFIED — PR #22 owner review pending; no hosted migration or deployment.  
**PR:** [#22](https://github.com/A13Xg/Daydle/pull/22) (draft). **Branch:** `phase/11-admin-requests-diagnostics`.  
**Base:** `6feca5d270e0ef88c5c66b8b3e23bd5941d60296`. Phase 10 was merged in `9098fdc`, with [passing main CI](https://github.com/A13Xg/Daydle/actions/runs/44044954484) and [protected release](https://github.com/A13Xg/Daydle/actions/runs/44045005321).  
**Contract:** [IDEA.md](IDEA.md) §§5,7,10; [roadmap.md](roadmap.md) Phase 11; [AGENTS.md](AGENTS.md); Obsidian Arcade design reference.

## Source assessment

- Phase 2 already created `public.game_suggestions`, `public.suggestion_votes`, `app_private.admin_members` and `app_private.admin_events`. Reuse them; never introduce a parallel account/permission database.
- Phase 4 admin catalog RPCs authorize with `auth.uid()`. The Worker calls Supabase REST with `service_role` rather than the user's JWT: those legacy RPCs cannot safely be invoked from the new Worker as if they knew the requester. Introduce separate service-role-only admin RPCs taking the *Worker-verified actor UUID* and independently checking `app_private.admin_members`; do not grant privileged functions to browser roles or trust arbitrary IDs supplied by clients.
- Phase 7 retained bounded malformed/unknown submissions in `public.raw_submissions`, including `parser_diagnostics.review_status` and 90-day expiration. Raw contents never enter ordinary logs, public aggregates or response models.
- Shared Worker `authenticate`, `boundedJson`, `responseJson`, `rpc` use strict token checks, sanitized RPC errors, `redirect:"manual"`, no-store and server-only credentials; reuse these exact transport guarantees. Never add a browser service-role key.
- All migrations run in order in two isolated PostgreSQL 17 databases through `scripts/test-db.sh`. Live migration history is *exact*; the next migration may require hosted migration allowlist coordination before any separately authorized release.

## Approved behavior and boundaries

1. **Requests and voting:** authenticated players can submit one suggestion at a time (name, HTTPS URL and bounded notes), see public pending/approved requests, vote and unvote idempotently. Duplicate URLs and repeated requests are rejected or returned as existing, with atomic quotas. Rejected requests are hidden from ordinary users. An approved suggestion does not automatically modify the playable game catalog or imply parser support.
2. **Admin:** admin status is server-confirmed against `app_private.admin_members`. Role-gated catalog create/edit/retire; suggestion moderation; retained invalid/unknown share queues and reason/trend diagnostics; annotation/classification; suggestion/vote restrictions on abusive accounts; and immutable or append-only audit metadata for all privileged mutations. No implicit admin bootstrap from an OAuth email, display name or editable JWT metadata.
3. **Privacy:** sample list contains metadata but not clipboard text. An explicit sample-detail operation returns an unexpired raw share to an admin only, for manual triage, with no cache and no general logging. This is not a global raw clipboard search and cannot resurrect expired text.
4. **Presentation:** Obsidian Arcade responsive mobile-first UI with loading, empty, denied, error/retry, disabled, pending and success states; requests are discoverable from the catalog and admin via a gated route. Maintain future WKWebView portability.

## SQL/API design

- Forward-only `supabase/migrations/*_phase11_administration.sql`: rate windows and restrictions, unique request URL index; service-role-only public suggestion list/mutation RPCs; admin check, catalog mutation, moderation, sample list/detail/review, diagnostics/restrictions RPCs. Every definer function explicitly qualifies objects and checks actor authorization; `REVOKE ... FROM PUBLIC,anon,authenticated` and `GRANT ... TO service_role`.
- `GET /api/v1/requests` returns bounded public request DTOs, `POST /api/v1/requests` requires verified OAuth identity to submit/vote/unvote. `GET /api/v1/admin` and `POST /api/v1/admin` require identity and verified admin membership. All POST actions check same-origin, body sizes/shape and typed response contracts; RPC authorization is repeated in PostgreSQL to eliminate BOLA/IDOR.
- Validation: HTTPS canonical URL, length and allowed status fields, stable UUIDs, 50-item page cap, bounded offset, safe strings and idempotent actions. Reuse dedicated shared types and checks rather than accepting arbitrary RPC fields in the UI.
- Diagnostics group by parser reason/version/time period and avoid low-level SQL errors, raw text and account identifiers; sample detail explicitly gated.
- Catalog modifications preserve stable game IDs and parser-support metadata; retirement does not cascade-delete results.
- Restricting a user affects suggestion and voting mutations only, not unrelated gameplay or account login. Do not claim this is a platform-wide ban.

## Implementation order

1. Commit reviewed plan; create migration and SQL security/denial tests; check both fresh PostgreSQL fixtures.
2. Add shared API contracts and Worker routes; unit-test malformed auth, admin denial, no-store, rate-limiting mapping, DTO projections, and origin checks.
3. Add typed frontend client and request/admin pages; integrate routes and navigation; compare against Obsidian Arcade at 320/393/1024 viewport sizes.
4. Add docs, finish edge-case tests and audit diff; run CI and fix every failed check.
5. When source checks pass, archive this plan under `completedPhases/` and move Phase 11 to IN REVIEW **on this branch only**, mark PR ready. Never merge or deploy without owner authorization. Real authenticated hosted E2E and physical Safari checks stay separately unverified.

## Validation required

- `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke`, `npm run db:test` and Chromium route tests.
- SQL suite: no browser direct private access; non-admin cannot list or mutate private data or bypass restrictions; admin membership grants only deliberate operations; duplicate/vote concurrency; pagination; sample TTL; audit actions.
- Source audit: SQL RLS/search_path/grants, Worker fail-closed actor verification, injection/IDOR/CSRF, clipped data, spoiler exposure, secret/config regression, provider compatibility.
- Source CI and isolated PG tests do not authorize running hosted schema changes. Production deployment remains protected/manual.


## Phase 11 completion report — November 17, 2026

**Source outcome:** request and voting workflows, operator catalog CRUD and game categories, suggestion moderation, parser diagnostics and retained sample triage, request-only user restrictions, admin event auditing, strict server-owned API DTOs, and Obsidian Arcade routes have been implemented. Legacy Phase 4 browser-role admin RPCs were not repurposed; Phase 11 has separate service-role-only RPCs with explicit operator UUID membership verification. All production secret and Cloudflare redirect safeguards are preserved. No third-party dependency additions.

**Validation:** [CI #44049830796](https://github.com/A13Xg/Daydle/actions/runs/44049830796) **PASS** on exact phase source commit `ee63bcdc486356578060804ed42dc8eb7c40ce58`:
- `npm ci`, strict TypeScript, ESLint, Prettier, `npm test` (**290/290 Vitest tests, 36 suites**), production build, API/PWA preview smoke.
- Chromium screenshot-independent CDP smoke **28/28** route/viewport checks at 320, 393 and 1024, including public request discoverability and guest admin denial.
- Both isolated PostgreSQL 17 database migrations/security suites PASS, including privilege revocations, request/vote uniqueness, limits, moderation, operator-only raw access, diagnostics privacy, catalog categories, publisher link verification invalidation, sample expiry and audit events.
- A temporary read-only formatting-export GitHub workflow was used during coding and **removed before review**. No temporary workflow is present in the final PR diff.

**Issues corrected during review:** strict vote count type narrowing, guest request page offline handling, SQL unparsed test evaluation order, misquoted test fixture, migration-history test pending-name drift, catalog category preservation, publisher link verification reset, explicit allowlisted response projection, and React admin-state isolation.

**Risk and rollout limitations:** Phase 11 migration `20261117090000_phase11_administration.sql` is a **proposed migration filename**, not a hosted version claim. Do not dispatch protected production deploy until this migration is explicitly authorized/applied and the actual hosted recorded version/name is reconciled. A real admin account must be separately enrolled by verified UUID into `app_private.admin_members`; this was **not performed**. Authenticated real-user admin and two-account request/vote E2E remains **NOT VERIFIED**. Physical iPhone testing remains owner-deferred. Chromium viewport parity tests are not an actual screenshot-to-reference manual review; no new screenshot has been captured. Phase 12 scheduled purge/encrypted backup is not included.

**Disposition:** Source ready for owner review; no automatic merge, hosted database changes, or Worker/PWA deployment performed. Continue subsequent roadmap phases only as explicitly owner-authorized *stacked PRs* based on this head; production release gates remain independent.
