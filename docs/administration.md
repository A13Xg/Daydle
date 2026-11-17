# Daydle administration and game requests (Phase 11)

## Scope and release boundary

This feature is implemented in [Phase 11 PR #22](https://github.com/A13Xg/Daydle/pull/22), not in the currently deployed Worker. The migration is forward-only and **must not be applied to the hosted database or deployed until the owner explicitly authorizes that release**. After applying it, reconcile the *exact* hosted migration version/name with `scripts/ops/check-hosted-migrations.mjs` before protected production deployment. Do not run the draft migration twice under different names.

- Community requests: `/requests`, accessible from Discover. Users can browse suggestions without signing in. Sign-in is required to submit/vote.
- Operator console: `/admin`, linked from Account **only after a verified admin status lookup**. Admin authorization is always enforced server-side.
- API: `GET/POST /api/v1/requests` and `GET/POST /api/v1/admin`. Requests are bounded, marked `private, no-store` with `Vary: Authorization`, and require an explicit same-origin POST.
- DB: `public.game_suggestions`, `public.suggestion_votes`, `app_private.admin_members`, `app_private.admin_events`, and `public.raw_submissions` are reused. New Phase 11 objects hold request quotas and restrictions, and service-role-only RPCs implement operations.

## Authorization model

A user is never an administrator merely because of an OAuth provider, account email, display name, friend code or editable user metadata. An operator must be enrolled using a controlled, separately authorized database administration action that inserts their **verified Auth UUID** into `app_private.admin_members`. Do not grant browser roles direct access to this table. There is deliberately no self-enrollment endpoint.

The Cloudflare Worker validates the OAuth bearer with Supabase's `/auth/v1/user` and passes the verified UUID as `p_actor`. Every privileged PostgreSQL RPC checks membership in `app_private.admin_members` independently. All new privileged functions have an empty search path, schema-qualified references, and revoked `anon`/`authenticated` execution privileges; the server-held `service_role` key alone is authorized. Never expose it in a client bundle or log.

The legacy Phase 4 `admin_save_game` functions check `auth.uid()` because they were designed for browser-JWT calls. Phase 11 does **not** route service-role calls through those functions; it provides a separately guarded operator entry point so no client or user-supplied actor can bypass membership.

## Workflow and data policy

- Request URL/name are validated and duplicate normalized publisher URLs are prevented by a unique index. Each account is limited to five new requests per hour and 50 vote/unvote actions per hour (atomic database counters). Votes are unique per user/request. A user restriction affects only requests/votes, never authentication, results or friendships.
- Public requests expose game name, URL, bounded notes, status, vote count, and viewer-specific vote state. Rejected submissions are hidden; approval does not automatically publish a catalog game or enable a parser.
- Operators can approve/reject requests, add/edit/retire catalog games, inspect retained invalid/unknown parser samples, classify/ignore samples, view aggregate diagnostics and apply/remove request restrictions. Catalog IDs and historical results survive retirement. Parser support is source-controlled rather than a generic admin form field.
- General diagnostics and sample queues contain only category, date and review metadata. To read raw text, an authorized operator must explicitly inspect a single unexpired sample. Phase 7's 90-day raw-share limit still applies. Phase 12 will enforce the scheduled purge; expiry metadata is *not* proof of physical deletion.
- Administrator mutations append `app_private.admin_events` rows containing actor, action, subject and safe metadata. Raw clipboard text, credentials and private account emails are excluded.

## API outline

| Endpoint | Auth | Description |
|---|---|---|
| `GET /api/v1/requests?limit=20&offset=0` | Optional | Pending/approved list, count and own vote |
| `POST /api/v1/requests` | User | `{ "action": "create", "name": "...", "url": "https://...", "notes": "..." }` |
| `POST /api/v1/requests` | User | `{ "action": "vote" | "unvote", "id": "<uuid>" }` |
| `GET /api/v1/admin?view=overview` | Admin | Restricted counts and operator status |
| `GET /api/v1/admin?view=requests|games|samples|diagnostics|restrictions` | Admin | Bounded role-gated lists |
| `GET /api/v1/admin?view=sample&id=<uuid>` | Admin | Explicit raw text for one unexpired sample |
| `POST /api/v1/admin` | Admin | `{ "action": "moderate" | "save_game" | "retire_game" | "review_sample" | "restrict" | "unrestrict", "data": { ... } }` |

Expected responses always use explicit allowlisted fields; no raw request/response upstream bodies are logged. Validation failures return 4xx, service/config failures fail closed. SQL authorization and quota tests run in two clean PG17 environments.

## Deployment and manual acceptance

1. Owner reviews PR and migrates the exact tested SQL only by a separately authorized protected action, after backup/rollback planning.
2. Check production migration history (strict exact-version allowlist), encrypted Worker secret binding and release jobs before permitting the protected Worker deployment on merged `main`.
3. Enroll the intended administrator in `app_private.admin_members` only with explicit approval; verify access under one admin and one non-admin account.
4. Exercise create/duplicate/vote/unvote, moderation, catalog retirement, one raw-sample review, restriction, and audit record. Verify non-admin cannot fetch the raw endpoint, and verify no expired raw content appears.
5. Record actual hosted authenticated E2E and iPhone PWA behavior independently; CI/source tests cannot substitute for hosted authorization acceptance.

**Security limitation:** Phase 11's user restrictions intentionally cover only request/vote abuse. A full-account suspension model affecting every endpoint is not defined or implemented.
