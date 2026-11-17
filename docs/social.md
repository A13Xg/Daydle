# Friends and public profiles — Phase 9

## Available source behavior

- Each verified Apple/Google account already receives a cryptographically random uppercase five-character invitation code from the Phase 3 signup trigger. Allowed alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. No email/name-derived tokens and no user-controlled code edits.
- `/friends`: signed-in self code, canonical `/friends?code=ABCDE` link, locally rendered QR (no external QR service), optional on-device camera QR scanning when BarcodeDetector is available, manual code entry, friend list, remove/block/unblock, regenerate with confirmation. A guest opening a code link can sign in first and resume the single bounded pending code from sessionStorage. Repeated connect is idempotent. Block removes the friendship from both users and blocks reconnect in either direction.
- `/players/:uuid`: public display name, join month and **selected active games only**. Not an email, phone, authentication or score lookup. Public game profiles do not require friendship.
- Compare with Friends is a **nonfictional shell** only. The approved image examples contain fake ranked podiums, point totals, acceptance requests and feed content; these are expressly not implemented in Phase 9. Phase 10 will supply viewer/puzzle-aware spoiler masking and coherent game-specific comparison metrics. No universal cross-game score is published.
- Own account links to Friends and its public profile; guest /friends login route stores the code for the verified OAuth callback to resume. Current Safari/PWA hardware testing is deferred, not passed.

## Server API

All JSON responses use `Cache-Control: private, no-store`, `Vary: Authorization`, fixed error codes and restrictive content-type. Service-role keys are read only from Worker runtime secrets, never from the browser. The Worker validates bearer sessions through Supabase Auth before delegating owner-only functions.

| Method | Endpoint | Behavior |
|---|---|---|
| GET | `/api/v1/players/:uuid` | Public allowlisted identity + selected active games, no raw/share or current puzzle metrics |
| GET | `/api/v1/social` | Verified owner's code, list of 200 friend profiles, blocked profiles, has_more_friends |
| POST | `/api/v1/social` | JSON `{"action":"connect","code":"K7M4P"}` or `regenerate`, `unfriend`, `block`, `unblock` with `targetId` for relation changes |

The Worker rejects cross-origin POST and unrecognized actions, enforces bounded JSON, derives the owner UUID from Supabase Auth, validates public-result shape before returning it, and never proxies arbitrary DB functions. `social_connect_by_code` applies 15 attempts/hour **per verified account** before returning a target, including unknown codes. Code lookups serialize with regeneration, relationship mutations serialize by ordered UUID pair advisory lock, and friendship uniqueness is enforced by the existing sorted-pair primary key. Browser roles have no EXECUTE access to the new SECURITY DEFINER RPCs or private quota table. RLS remains on for all tables.

Codes are discovery identifiers, not credentials. Friend groups confer no additional entitlement to private or spoiler-sensitive data. Blocks prevent mutual connections, not otherwise-public profile access. Individual results and personal statistics remain separately owner-scoped.

## Privacy, retention and limits

- 200 entries per friend or blocked list are shown (friends carry a `has_more_friends` indicator); paging of exceptionally large lists can be added as a separate quality-of-life refinement. Private network state is never written into offline snapshots or the PWA cache.
- Public profiles are addressable by UUID, *not* by enumerating friend codes. No public code-to-profile lookup endpoint exists. Any sharing happens through a verified owner account.
- Raw clipboard/share text, private email, auth metadata, unknown samples and puzzle results never enter these social endpoints.
- QR generation is offline from pinned, MIT licensed `qrcode-generator@2.0.4`. Camera QR scanning is optional; device permission is requested only after tapping the Scan control, streams are stopped on unmount, manual entry always remains available.
- The public profile keeps current-puzzle result and derived-stat fields **absent** until Phase 10 implements the universal spoiler policy. This is deliberate narrower exposure than the Phase 9 mockup suggests.

## Test and rollout status

Source CI covers typecheck, lint, Prettier, unit/API tests, 20 Chromium guest route/viewport checks, and two isolated PostgreSQL 17 databases with role grants, two-account symmetric relations, anti-self, block/unblock, regeneration, quotas and transaction concurrency.

**No Phase 9 SQL has been applied to hosted Supabase, and no Phase 9 Worker/frontend has been deployed.** Source completion is independent of the previously authorized Phase 7/8 deployment; hosted Phase 9 migration and runtime rollout need their own owner authorization. Real OAuth, QR scanning on an iPhone and social actions against hosted production remain **NOT VERIFIED**.
