# Daydle — Privacy data map and retention boundary

**Status:** Source-level mapping for beta-readiness review (November 17, 2026), **not a signed legal privacy policy or evidence of production deployment**. Implementation source through Phase 13 is on `main`; the protected Worker release last verified at Phase 10. User-facing summary: [`/privacy`](../src/components/PrivacyPage.tsx). Product and security authority: [IDEA.md](../IDEA.md).

| Data | Primary storage/owner | Readers | Retention and deletion |
|---|---|---|---|
| Apple/Google identity, verified email, provider sign-in metadata | Supabase Auth `auth.users` | Auth service; user's own account view; privileged operators within approved controls | Until account deletion and provider retention requirements; never exposed through public profiles |
| Display name, public player profile, friend code | `public.profiles` / `public.friend_codes` | Public permitted profile data; authenticated owner for changes | Deleted with account; regenerated friend code invalidates old discovery code |
| Game registry, category, publisher links | `public.games`, `game_categories` | Public; operator mutation only | Registry lifecycle; retiring a game must not delete historical results |
| User game selection and ordering | `public.user_games` | Owner; permitted public subset of selected games | Until selection removed or account deleted; an offline copy of chosen IDs may remain in owner-local browser storage and be cleared on account deletion |
| Canonical puzzle/result and metrics | `public.puzzles`, `game_results`, `result_corrections` | Owner; public profile/comparison **only through viewer-aware spoiler filtering** | Persist until result deletion/account deletion; related corrections cascade; current-puzzle details hidden without same-puzzle result or verified publisher reset |
| Raw publisher share text (accepted and failed/unknown) | `public.raw_submissions` | Owner via authenticated export while unexpired; admin through explicit restricted sample-detail permission only | **Maximum 90 days;** expired data excluded by SQL/API before physical purge; Worker scheduled purge must be deployed and observed |
| Parser reason/version/diagnostics | Submission metadata and private aggregated RPCs | Operators; aggregate non-private counts where supported | Bounded, no raw text in ordinary logs; retained data follows documented schema/retention constraints |
| Friendships, blocks, code connections | `public.friendships`, `blocks` | Owner/friend public relationship as allowed by API; nonfriends never obtain additional private authority by adding friend | Remove/unfriend/block actions; account deletion cascades |
| Scores/achievements/rankings | `user_achievements` and derived SQL functions | Owner and spoiler-safe public viewers | Derived from saved results, must be recomputed after corrections/deletions and filtered per viewer |
| Game suggestions/votes | `game_suggestions`, `suggestion_votes` | Public pending/approved and vote counts; own voter state; operator moderation; rejected hidden | Until moderation/record cleanup or account deletion; public requests do not disclose private credentials |
| Operator access, restrictions, audit | `app_private.admin_members`, `request_restrictions`, `admin_events` | Server-only authorized operators | Audit entries remain for security accountability; deleting an account anonymizes its user subject identifiers per Phase 12 trigger |
| Public catalog & selected-ID offline cache | Browser local storage; PWA caches static assets/public navigation | Local user/device | Public catalog max 7-day source snapshot; selected IDs scoped by authenticated UUID, no raw text, results or access tokens in custom offline snapshots |
| API logs and monitoring | Cloudflare/Supabase operational service | Restricted operators | Never log clipboard text, OAuth bearer or service keys. Provider retention/access must be checked before beta |
| User JSON export | Local browser download after explicit click | Exporting user and anyone they subsequently share the file with | Not uploaded to Daydle by the export action. It may contain unexpired original share text; browser/device retention is user-controlled |
| Encrypted offsite database snapshots | **NOT CONFIGURED/VERIFIED** in source alone | Proposed private backup operator and owner-held recovery key | Backup creation, retention limits, key recovery and actual restore/deletion replay **MUST** be established before beta. Source AES-GCM code is not a backup service |

## Sharing / third parties

- **Apple and Google** authenticate an account through Supabase Auth. Email and authentication metadata are not published through Daydle's public player-facing APIs.
- **Supabase** hosts identity and PostgreSQL records; **Cloudflare** serves Worker API/static assets and may hold operational metrics/logs under its configured account policies. Exact provider retention, geography and subprocessors require external legal/operator review before a public privacy policy.
- **Publisher sites** open externally; their games, cookies, sign-ins, trackers and terms are separate from Daydle. No gameplay verification or account scraping is claimed.
- Browser clipboard content is read only on an explicit user gesture when allowed. **Submission** (not dialog open/read/type) sends exactly one share to Daydle.
- There is no approved paid subscription, ad targeting or native iOS build in the beta scope; do not invent claims about analytics/ad vendor collection.

## Restoration / erasure consistency

A user deletion may be immediately reflected in active PostgreSQL while an older encrypted backup still contains that user's data. **Deleting a row is not sufficient to claim a restored database remains compliant.** Before beta, establish an independent deletion journal/replay strategy or a safer restore design that irreversibly suppresses deleted accounts and expired raw-share rows before a restored service is publicly accessible. The journal itself is sensitive and needs bounded encryption, access policy, retention and deletion.

## Publication review required

The `/privacy` route is an accurate product-facing *data-handling summary*, not a substitute for a jurisdiction-appropriate signed legal/privacy policy. Before publishing beta, the owner must approve the applicable legal notice, controller identity, verified contact address/support channel, service providers and retention disclosures; validate that every promised control exists **in the deployed Worker/schema**; and record any required region-specific rights process. **No support email, physical address or legal identity is invented in this repository.**
