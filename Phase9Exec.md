# Phase 9 Execution Plan — Public profiles and instant friendship

**Status:** PLANNING
**Branch:** `phase/09-public-profiles-instant-friends`
**Base:** main at `db7bc2d9832bd5f60cca16e8c8ded0963255fd08` (Phase 8 PR #15 merged, main CI #44019612778 passed)
**Dependencies:** Phase 8 source merged; hosted authenticated release acceptance is still separate. No hosted Phase 9 schema or Worker deployment authorized.

## Scope
Implement public profile routing with safe display name and game choices, existing unique five-character code sharing, instant symmetric mutual friendship by verified code, idempotent connect, unfriend, regeneration, blocking, code/link/QR flows and login-resume, friends list/Compare shell, polished Obsidian Arcade UI.

## Security gates
Never publish email/raw text/private settings; friend status grants no special public data. Phase 10 owns viewer-specific spoiler gating: **do not publish current-puzzle outcome, score or aggregate/achievement counters now** without verified policy. Codes are discovery identifiers, not authentication. SQL row ownership must derive from Supabase auth, not a supplied user ID. Require transactional insertion with unique pair ordering, rate limits, anti-self and block on either side. Do not use external QR code/analytics services.

## Plan before code
Review current Phase 2/3 friend-code tables/functions/RLS, Phase 8 Worker auth/caching, account/catalog tabs, UI spec and tests. Choose server-only RPCs with authenticated Worker boundary; public profile read should return only allowlisted fields. Ensure cancellation/stale response handling, empty/error/blocked/offline states, 320/393/1024px layouts, touch >=44px. Test mutation replay/concurrency and cross-account isolation on two isolated PostgreSQL 17 DBs. Code/QR path must not leak any secrets.

**No app release, migration or merge in this draft.**
