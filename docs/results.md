# Phase 7 — Result ingestion, history and correction lifecycle

**Status:** Draft implementation in [PR #14](https://github.com/A13Xg/Daydle/pull/14). No live migration or deployment has been performed.

## User workflow

1. Sign in; copy exactly one publisher share result; use Paste Results to paste manually or activate the clipboard reader with a real button tap.
2. Select Submit result. The Worker verifies the current Supabase session through Auth, then runs the deterministic parser server-side. The browser cannot submit invented scores or bypass parser validation.
3. Valid shares use canonical (game_id,puzzle_key) and one (user_id,puzzle_id) result. An exact semantic replay returns duplicate without storing additional raw text; a conflicting result requires an explicit Replace click referencing the existing result ID. A correction is appended to the private corrections table.
4. On ambiguous parser matches, the user explicitly selects one of the detected games; the Worker revalidates that parser's actual output. Unrecognized text is NOT automatically saved or retained. Optional retention requires both user consent checkbox and an explicit action; a retained sample is never a completed game.
5. Open Result history from Today or Account. Filter and paginate owner results, inspect metrics/provenance, correct by pasting a newer share for that same puzzle, or permanently delete with confirmation.

## Same-origin Worker endpoints

| Endpoint | Response | Limit |
|---|---|---|
| POST /api/v1/results | saved / duplicate / conflict / replaced / unknown / invalid / ambiguous | One share, 10,000 chars |
| POST /api/v1/results/unknown | retained | Explicit user opt-in only |
| GET /api/v1/results?game=wordle&limit=20&offset=0 | Owner-only structured history | Max 50 per page |
| GET /api/v1/results/:uuid | One owner-only structured result | No raw input |
| DELETE /api/v1/results/:uuid | deleted or not_found | Explicit UI confirmation |

Do not retry unknown-outcome writes automatically after a transport failure; refresh history to reconcile. Owner APIs are no-store and are not public profile or leaderboard endpoints.

## Canonical identity, corrections, security

- Five supported parsers: Wordle, Connections, Strands, NYT Mini, and Daily Quordle. Other catalog entries remain launchable but cannot claim parser support.
- Do not infer publisher puzzle dates from numbers or from submission time. Postgres creates or locks the stable publisher puzzle identity. A unique (user_id,puzzle_id) constraint arbitrates competing submissions.
- Transactionally insert accepted raw and parsed result; insert accepted raw only once per newly saved result or explicit replacement. Replacement requires matching existing result ID, with old/new typed parsed payload in result_corrections. Deletion cascades raw/correction rows and leaves a private opaque audit event.
- All new write/history RPCs are service_role-only. Direct browser table writes remain prohibited, including column-level grants. The Worker authenticates the Bearer token through Supabase Auth and obtains the authoritative owner UUID from that response, never a client-provided ID. Queries filter by verified owner.
- Raw content is not logged, reflected in error bodies, cached in service workers, or persisted by the browser. Request size is streamed and bounded to 48 KB JSON; the parser independently enforces a 10,000 UTF-16 character/64-line share limit. SQL enforces an atomic per-owner 60-write-attempts/hour limit.
- Accepted and explicitly retained unknown raw text carries an expires_at field <=90 days after receipt. **Metadata is not automatic cleanup**: scheduled purge is a Phase 12 follow-up. No public API or cached HTML may reveal private result data.
- Existing viewer-specific spoiler-safe database RLS remains unchanged. New result history/detail endpoints are owner-only. Public profiles, achievements, rankings and stats are separate later phases.

## Deployment gate — requires separate explicit authorization

1. Approve/apply the additive Phase 7 SQL migration to the target Supabase database. Verify the five catalog parser-status updates and all server-only RPC grants.
2. Configure protected Cloudflare Worker secrets SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY (legacy service-role JWT for PostgREST service-only calls). The service secret must NEVER be prefixed VITE_, committed, printed, or sent to browsers. Existing frontend public Vite Supabase variables remain unchanged.
3. Approve and deploy Worker/frontend only after the migration is live and the server secret is configured. Test replay, replace, delete, cross-account denial and external auth callbacks with real identities. Physical iPhone testing is an independent pre-release requirement.
4. Roll back application code first if necessary. Do not remove additive schema or recorded result data without a separate backup/migration plan.

**Live secrets and hosted integration tests are NOT VERIFIED.** Isolated test DB/CI checks do not imply production availability or deployment permission.
