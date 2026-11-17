# Phase 9 Execution Plan — Public profiles and instant friendship

**Status:** IN PROGRESS — SOURCE ONLY / NOT DEPLOYED
**Branch / PR:** `phase/09-public-profiles-instant-friends` · [PR #16](https://github.com/A13Xg/Daydle/pull/16)
**Base:** main `db7bc2d9832bd5f60cca16e8c8ded0963255fd08`. Phase 8 PR #15 merged, main CI #44019612778 passed.
**Authority:** IDEA.md §§3–4,8–9; roadmap.md Phase 9; AGENTS.md; owner-approved Obsidian Arcade DESIGN.md and examples.

## Preflight and technical findings
- PostgreSQL Phase 2 already has `profiles`, `friend_codes`, sorted-pair `friendships`, `blocks`, ownership/RLS rules. Phase 3's auth trigger already generates five-character unbiased cryptographic friend codes with bounded uniqueness retries. Reuse it; do not invent competing code allocation.
- There is no social data mutation RPC or public profile route; `/friends` is a placeholder. Account currently exposes only self code and display name, no sharing/regeneration. Worker routes authenticate by verifying bearer tokens against Supabase Auth and privately call service-role-only RPCs.
- Phase 8 stats are **private**. Phase 10 is explicitly responsible for viewer-specific current-puzzle spoiler unlock and safe public performance. Do not expose private Phase 8 totals, awards or derived outcomes from public profile in Phase 9 just to satisfy a mockup. Phase 9 profile shows public name, games selected, and an explicit privacy notice; metrics arrive after Phase 10's policy.
- Owner approved Obsidian Arcade: #051424 backdrop, locally bundled Plus Jakarta Sans, #adc6ff primary, #4edea3 affirmative actions, #f59e0b streak, soft gradient tiles, no third-party CDNs, ≥44px controls, 320/393/1024 widths and iOS safe areas.
- Phase 7/8 Supabase migrations are applied. Phase 9 migration **not authorized** for remote application; source changes don't require the deployment gate. iPhone hardware test is deferred, not passed.

## Server architecture
- Forward-only `supabase/migrations/20261117050000_phase9_social.sql` adds a private per-user hourly attempt-counter table, RLS and indexes if required, plus purpose-specific SECURITY DEFINER functions callable by `service_role` only (all `PUBLIC`/`anon`/`authenticated` EXECUTE revoked). No new public table permissions; no raw/share access.
- Public read RPC returns only allowlisted `id,display_name,created_at,selected games`, no email, raw text, friend codes, scores, achievements or current-puzzle activity. Any visitor may view it through tightly scoped Worker GET; never cache private responses.
- Authenticated self RPC returns code, own friend profile list and block list. Connect-by-code RPC derives owner from verified Worker session; DB pair ordering `least/greatest`, immediate mutual single-row insert `ON CONFLICT DO NOTHING`, idempotency, reject self and hidden/blocked. Rate-limit failed/successful attempts atomically per user/hour (including missing codes). Use deterministic pair lock for connect/block racing. No lookup endpoint allowing unauthenticated enumeration.
- Revoke/generate new code via existing `app_private.random_friend_code()`, with bounded unique collision retry. Unfriend, block, unblock are owner-scoped; blocking removes friendship transactionally and prevents reconnect from either direction. No friend requests/pending/approval.
- Worker GET `/api/v1/players/:uuid` public-safe. `/api/v1/social` GET self, POST mutation code/link, DELETE unfriend/block via action POST (explicit origin validation), no userId body trust, bounded JSON and normalized errors. Supabase legacy service JWT stays server-side; no new credentials or providers.
- Share URL is canonical `/friends?code=ABCDE`; logged-out redirects to Auth and preserves pending code in a bounded same-origin path. QR generation/scan use locally bundled code and camera where supported; no external QR provider, analytics or privileged background camera access. A manual code entry/link is always available.

## UI and contract
- `/friends`: owner code hero, copy/share link, regenerating with confirmation, QR view, connect form, friend tiles with live profile links and unfriend/block, blocked players list and unblock, empty/loading/offline/permission/errors. Compare shell is intentionally **locked to Phase 10** for verified spoiler-aware rankings. Guest login link preserves a valid code.
- `/players/:id`: public, shareable, display-name/avatar fallback and selected games, but no score/achievement/streak metrics until Phase 10.
- Account page: link to public profile and share code flows; no stale "Phase 9 coming soon" copy. Topbar and tabs retain approved shell/active state.
- Accessibility: explicit labels, clipboard fallback, status live regions, confirmation before destructive actions, focus handling, reduced motion and no fake statistics.

## Verification
1. Unit/API cases: malformed code/ID/actions/body, missing bearer, origin/IDOR rejection, rate-limiting, public data allowlist, guest/camera fallback, route shell/navigation.
2. Two isolated PG17 DB runs: valid/repeated/self connect, symmetric record, unfriend/block/unblock, third-party denial, random code rotation and old invalidation, quotas, RLS grants and concurrency retries.
3. Typecheck, lint, formatter, 250+ tests, production build, PWA/API smoke, Chromium at 320/393/1024 including guest code route and public profile.
4. Review diff for URL/user enumeration, leaking real email/name beyond approved display name, caching/spoilers, auth and external QR calls. No hosted migration/Worker deploy/PR merge without next owner authorization.

## Known release dependency
If the Phase 7/8 Worker on `daydle.agoodman.io` hasn't been deployed from merged main, Phase 9 source may be implemented and validated independently. Do not misstate hosted availability or block source development merely because an earlier release isn't accessible. Capture the actual hosted readiness gap at completion.
