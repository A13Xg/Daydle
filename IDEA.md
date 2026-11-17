# Daydle — Product and Architecture Brief

> All your daily games. One place.

**Status:** Approved product baseline. **Release target:** public beta. **Primary platform:** iOS Safari and installable PWA. **Visual standard:** [Obsidian Arcade](referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md), owner-approved, scheduled for Phase 6.5 implementation. **Implementation sequence:** [roadmap.md](roadmap.md). **Execution rules:** [AGENTS.md](AGENTS.md).

## 1. Vision and purpose

Daydle is an independent, mobile-first discovery, history, statistics, achievements, and comparison layer for third-party daily games. The games generally remain on their publishers' websites. A person discovers and selects games in Daydle, launches the publisher's page, plays there, copies the publisher's native share text, returns to Daydle, and submits it through one global Paste action. The service deterministically identifies the game, validates and associates the result with a puzzle, stores normalized results, and updates game-aware statistics and public comparisons.

The brand is not limited to games ending in “-dle.” Examples of categories include word, connection, geography, trivia, music, movie, numbers, logic, and other recurring games. Daydle must not impersonate publishers, scrape private game accounts, recreate their games, or embed games in unsupported iframes.

## 2. Product baseline and audience

- Intended audience: players who regularly visit multiple daily-game websites, including groups of friends comparing progress.
- Release: **public beta** with open registration, no invitation gate, and a free product.
- Primary UX: iPhone Safari and home-screen installed PWA. Desktop and Android should degrade gracefully where possible; iOS quality is the launch priority.
- MVP includes account creation, game catalog and personal selection, minimal Today view, publisher launch, single-result universal ingestion, game/date resolution, persisted result history, personal stats and activity streaks, public profiles, instant friends, spoiler-aware game-specific friend comparisons, installability, admin workflows, and operational reliability.
- Initial parser target: **5–10 working, fixture-tested games** with diverse output formats. Catalog may contain many more launchable but unsupported games.
- The application must be functionally polished and accessible at beta launch. Obsidian Arcade's tokens, mobile navigation shells, components and 13 screen examples have been approved as the visual standard. Implement them in Phase 6.5; sample UI features do not override the functional baseline.

## 3. Identity, registration, and profile data

- Support email/password registration and Apple/Google OAuth using Supabase Auth. OAuth-only users do not need a local password; never store or invent one. Account identity has a verified/auth-provider email; Apple private relay is valid.
- Each profile has a display name (not necessarily unique) and a unique generated friend code. Accept a provider-supplied display name when available; otherwise collect it in onboarding. Do not expose a public email lookup.
- Public user profiles show selected/played games, scores, results, game-specific statistics, rankings, historical trends, streaks, and achievements, subject to spoiler restrictions.
- Emails, authentication factors, private settings, raw pasted submissions, backend diagnostic data, moderation data, and other sensitive fields are never public.
- User can export their account/result data, delete individual results, regenerate a friend code, and permanently delete their account with a clear data-handling contract.

## 4. Friend discovery and comparison

- Each account receives a secure random **five-character, uppercase, unambiguous alphanumeric** code. Allowed alphabet: ABCDEFGHJKMNPQRSTUVWXYZ23456789 (31 symbols; 31^5 = 28,629,151 possibilities). Do not use I, L, O, 0, 1 or lowercase. Do not derive any code characters from email, name, or other identifying data.
- The server generates code candidates with a cryptographically secure source, attempts atomic insert under a unique database constraint, and retries boundedly upon a unique conflict. A read-before-write check alone is not sufficient for concurrent signups.
- A user can enter a code, open a shared link containing the code, scan a QR encoding the link, or display their own QR. A valid code creates a **mutual, immediate** friendship when the requester is authenticated. No request/accept step. A logged-out visitor may register/sign in, then resume the pending connection.
- Friendship is a **convenience grouping** for Compare with Friends views. It grants no additional authority to information; public profiles are equally readable by non-friends. Reusing a link or code is idempotent. Reject self-friending. Permit unfriend and block; a block stops connection actions, not otherwise-public profile viewing.
- Apply sensible lookup, scanning, and connection rate limits to limit code enumeration and spam. Friend codes are not login credentials or secrets capable of impersonating an account.

## 5. Discovery and game registry

- Maintain a canonical registry independent from parsers: stable game ID, names, description, genre/category, publisher, canonical launch URL, icon/licensing metadata, status, release cadence/reset behavior, puzzle numbering information, supported-platform hints, parser support state, and supported metric definitions.
- Users can browse/search/filter games, add/remove/reorder their chosen rotation, and launch games even if Daydle cannot parse that game's result.
- Games may publish daily, weekly, irregularly, more than once daily, or not have date-addressable puzzles. Data modeling must not assume one game maps to one puzzle per calendar date.
- MVP product behavior accepts one canonical result per user/game/day where applicable, but persistence must key results to a canonical puzzle identity to allow future multi-edition support.
- Public game suggestions and voting are supported. Catalog inclusion is moderated. A suggestion is not a promise of parser support.

## 6. Today and external game navigation

- Today highlights chosen games, play links, spoiler-safe status, saved results, completion state, and the persistent global Paste entry point. Optional participation means incomplete games are not treated as mandatory failures.
- Preferred publisher navigation opens in a new tab or external browser context and tries to preserve the Daydle screen. Browsers and installed iOS PWAs may behave differently; provide Back/reopen/resume guidance rather than promising a guaranteed return/deep link.
- When Daydle regains focus, a contextual Paste Results action may appear. Clipboard reading must be initiated through an actual user gesture when browser permissions require it; support manual paste, denied permission, empty clipboard, invalid input, and interrupted flows.
- Cache previously viewed non-sensitive catalog, Today, and history information for offline *viewing*. Do not promise offline result writes or unsafe replay of expired spoiler-sensitive content. Result submission requires a network connection.

## 7. Result submission and parsing

- One submitted result per action. Do not build multi-result paste in the initial release.
- Deterministic server-authoritative parser registry: input normalization; optional safe segmentation only if later explicitly required; per-game detection with confidence and diagnostics; parser selection; format-specific parsing; validation; puzzle/date resolution; duplicate detection; transactional persistence; statistics invalidation/recomputation.
- Each parser has a stable game ID, parser implementation/version, supported share-format versions, fixtures, detection output, validation policy, and meaningful error types. Parsing must tolerate relevant Unicode, emoji, whitespace, historical formats, and malformed/truncated text.
- Automatically save confidently identified, valid, unambiguous results. Ask the user for game or puzzle/date confirmation when unresolved. Never silently overwrite an existing result.
- Preserve one authoritative canonical result per user/game/puzzle. Exact duplicate submissions are idempotent; conflicting new values prompt explicit replacement or rejection. Deleting/replacing results refreshes all affected stats, achievements, rankings, and spoilers.
- Allow corrections by replacement with a new recognized share output or result deletion, not unrestricted manual edits to leaderboard metrics.
- Persist structured common fields (game, puzzle ID/date, outcome, attempts, score, completion time as relevant), typed game-specific metrics, provenance, parser/format versions, received timestamp, and correction metadata. Do not force all games into one numeric scoring scale.
- **Approved Phase 7 revision (2026-11-16):** Pressing **Submit result** is the explicit upload action. If authenticated parsing returns unknown, ambiguous, or invalid-but-bounded text, retain the private raw share automatically with machine-readable failure category, parser/game hints and a 90-day expiry timestamp. Do not upload on clipboard read, typing or dialog open; refuse empty, oversized or unsafe/NUL input. Disclose the retention behavior directly in Paste Results. Offer candidate-game confirmation on ambiguity; never convert an unparsed share into an invented result or expose raw samples to other players. Keep authorized administrator review and a future categorization workflow.
- Input is untrusted text: size/rate limits, strict validation, safe rendering, bounded CPU, no HTML interpretation, and no arbitrary code evaluation.

## 8. Puzzle identity, dates, and spoiler policy

- Prefer verified game-provided puzzle IDs/dates and publisher-specific reset rules. If a definitive puzzle identity cannot be resolved, require explicit user confirmation before a result affects statistics.
- Treat user local time, publisher release time, submit time, and canonical puzzle date as distinct values; never assume puzzle numbers map perfectly to consecutive dates.
- Public profile fields are visible to everyone, except **current-puzzle spoiler-sensitive results**. Hide a person's detailed score/outcome and derived position/aggregates from a viewer until that viewer submits a valid result for the same puzzle OR the next verified puzzle release/reset occurs.
- Spoiler protection is viewer-specific and applies to profile pages, direct result APIs, friend dashboards, competitive leaderboards, ranking calculations visible to viewers, and cached responses. Before reset, anonymous viewers only see spoiler-safe information.
- Games without reliable reset metadata require a documented, conservative release policy; do not expose a result merely because an arbitrary calendar date changed.

## 9. Statistics, ranking, and achievements

- Universal activity: games recorded, total results, days active, active-day streak (any valid submission on a local calendar day), longest active-day streak.
- Game-specific: attempts, wins/losses, completion time, score distribution, personal bests, trends, per-game play streaks according to that game's release schedule, and other metric-specific summaries.
- The user-selected activity-based “full completion” behavior is the same as the platform active-day streak. Avoid presenting it as completing all selected games or maintaining a redundant independently-named streak.
- Show daily friend scoreboards, shared-game performance comparisons, and competitive rankings **only within compatible games and defined metrics**. Do not invent a misleading universal cross-game score.
- Basic achievements should be explicit, reproducible rules derived from authoritative saved results. Corrections can revoke/recompute achievements.
- External share strings do not prove real gameplay. Validate format and impossible values where feasible; do not overbuild anti-cheat infrastructure or falsely label results verified against publishers.
- Use on-demand queries initially with targeted materialization/caches only for demonstrable hot paths; preserve deterministic reaggregation after corrections.

## 10. Administration and platform integrity

- Internal authenticated/admin-authorized tools must support game/catalog management, user management and restrictions, parser diagnostics, retained unsupported submission inspection, game suggestions, and voting moderation.
- Admin actions and access to private raw data require server-side authorization and auditable logs. Prevent direct-user access to raw submission tables or unrestricted service-role endpoints.
- Capture parse success/failure by game/version, unknown-format volume, result saves and duplicates, API latency/error rate, and basic launch/engagement telemetry without logging raw clipboard content or credentials.
- Model relational entities as needed: auth user/profile, friend relationship/block, game/category and user selection, puzzle/release mapping, submission and parsed result, parser/version, per-game metrics, achievements, game suggestions/votes, corrections, audit events. Favor minimal tables that enforce actual invariants.
- Never interpret external result text as HTML; defend against IDOR, injection, denial-of-service, spam, content enumeration, and authorization errors.

## 11. Data lifecycle and recovery

- **Raw submission text has a maximum 90-day retention period**, including accepted and failure-captured samples. Expiry metadata alone is not physical deletion; scheduled purge enforcement remains a later operational requirement. Parsed canonical results and permitted analytics remain until deleted. Expiry must include orphan cleanup and administrative view removal.
- Historical reparsing is possible only while the original raw text remains; after expiration, rely on versioned parsed snapshots and corrections rather than pretending reparsing is possible.
- Support self-service result deletion, data export, and account deletion. Define handling for associations, corrections, achievements, ranks, backup expiration, and restores.
- Use Cloudflare for the React/Vite frontend and Workers API; Supabase Auth and PostgreSQL for identity and data. Prefer free tiers until requirements justify an upgrade.
- Supabase Free does **not** provide included automatic managed database backups: meet the recovery requirement with scheduled independent encrypted exports, verification, bounded retention, and tested restoration (for example encrypted offsite object storage). Never claim provider backups are sufficient on Free.
- Require environment separation appropriate to beta, secrets management, migrations, observability, a recovery runbook, safe rollouts, and a realistic rollback strategy.

## 12. Functional polish and release quality

- Every user-facing workflow requires loading, empty, success, conflict, error, retry, network/offline, and permission states as appropriate.
- Set a practical WCAG 2.2 AA accessibility target: semantic controls, meaningful names, keyboard navigation, screen reader labels, focus management, motion preferences, and visible feedback.
- Thoroughly test iOS Safari and installed PWA navigation and clipboard flows; verify Android/desktop baseline without broadening primary scope.
- No known critical defects at public beta; automated unit/integration/API/parser/E2E coverage; security and data-access checks; observability and backups functioning.
- **Approved visual specification:** Obsidian Arcade in `referenceFiles/Daydle UI-UX Reference/DESIGN.md` and its 13 examples, to be implemented in Phase 6.5 after deterministic parsing. Screenshot-only social actions, artificial global rankings/counters, notifications and multi-launch behavior are not product requirements. Preserve WCAG 2.2 AA and full interaction states.
- Explicit non-goals for initial release: native app packaging/App Store submission, hosted copies of third-party games, forced daily schedules, batch/multi-result submission, LLM-driven production parsing, hard anti-cheat guarantees, a global cross-game leaderboard, subscriptions/ads, and broad public social feeds.
- **Portability constraint:** choose libraries, navigation, locally bundled assets and auth/external-launch adapter seams compatible with a potential future iOS WKWebView wrapper. Do not implement Xcode/Capacitor packaging or native integrations without later explicit approval.

## 13. Delivery governance

The [Obsidian Arcade design standard](referenceFiles/Daydle%20UI-UX%20Reference/DESIGN.md) and 13 examples are owner-approved for UI design, not as a new functional feature list. Phase 6.5 introduces the system into the React app after Phase 6; native iOS packaging remains out of scope.

The roadmap in [roadmap.md](roadmap.md) is the authoritative sequence and status ledger. [AGENTS.md](AGENTS.md) defines the required cycle for each requested phase, including baseline verification, branch and draft PR, execution-plan creation, implementation, testing, audit, and final review-ready PR. Work is requested and reported directly in the current chat. Do not begin subsequent phases without a direct instruction. No generated-content attribution, co-author lines, or separate non-owner contributors are to be introduced.