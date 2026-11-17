# Phase 7 — Result ingestion, history and correction lifecycle

**Status:** Source merged in [PR #14](https://github.com/A13Xg/Daydle/pull/14) at `1ff1b044` with [passing main CI](https://github.com/A13Xg/Daydle/actions/runs/44004416809). Phase 7 is **BLOCKED on hosted acceptance**: the Phase 7 migration is now applied and verified on Daydle Preview, but the owner has authorized a protected Worker/frontend deployment to `daydle.agoodman.io`, but no release or authenticated E2E has been performed. See the [active plan](../Phase7Exec.md).

## User workflow

1. Sign in; copy exactly one publisher share result; use Paste Results to paste manually or activate the clipboard reader with a real button tap.
2. Select Submit result. The Worker verifies the current Supabase session through Auth, then runs the deterministic parser server-side. The browser cannot submit invented scores or bypass parser validation.
3. Valid shares use canonical (game_id,puzzle_key) and one (user_id,puzzle_id) result. An exact semantic replay returns duplicate without storing additional raw text; a conflicting result requires an explicit Replace click referencing the existing result ID. A correction is appended to the private corrections table.
4. **Owner-approved Phase 7 revision (2026-11-16):** The explicit Submit result action uploads the share for recognition. Unknown, ambiguous and malformed-but-bounded input is automatically retained privately for later parser analysis with machine-readable reason classification. This does not create a solved result or expose samples publicly. On ambiguity, the user can also select one of the detected games; the Worker revalidates that parser's actual output. Reading a clipboard, typing, or merely opening the dialog never uploads anything.
5. Open Result history from Today or Account. Filter and paginate owner results, inspect metrics/provenance, correct by pasting a newer share for that same puzzle, or permanently delete with confirmation.

## Same-origin Worker endpoints

| Endpoint | Response | Limit |
|---|---|---|
| POST /api/v1/results | saved / duplicate / conflict / replaced / unknown / invalid / ambiguous | One share, 10,000 chars; unparsed shares return `captured: true` only after secure server persistence, otherwise fail closed. Unsafe/oversized/empty inputs return `captured: false`. |
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
- Accepted and automatically captured unparsed raw text carries an `expires_at` field <=90 days after receipt. Capture uses a server-only `capture_unparsed_share` RPC, `disposition` (`unsupported` or `invalid`) and private `parser_diagnostics` fields (`review_status: pending`, `reason_code`, `candidate_game_slugs`, `source: explicit_submit`, `parser_analysis_version`). Captures are idempotent per owner/share/disposition, rate-limited, bounded to 10,000 characters and never included in History. **Metadata is not automatic cleanup**: scheduled purge is a Phase 12 follow-up. No public API or cached HTML may reveal private result data.
- Existing viewer-specific spoiler-safe database RLS remains unchanged. New result history/detail endpoints are owner-only. Public profiles, achievements, rankings and stats are separate later phases.

## Deployment gate — requires separate explicit authorization

1. **COMPLETE on Daydle Preview (2026-11-16):** the owner authorized the additive Phase 7 SQL migration, which was applied successfully. Five catalog parser-status updates and all five service-only RPC grants were verified. Supabase recorded migration name `20261117010000_phase7_results` under generated version `20261117030322`; reconcile this difference before automated migration deployment.
2. Configure protected Cloudflare Worker secrets SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY (legacy service-role JWT for PostgREST service-only calls). The service secret must NEVER be prefixed VITE_, committed, printed, or sent to browsers. Existing frontend public Vite Supabase variables remain unchanged.
3. Approve and deploy Worker/frontend only after the migration is live and the server secret is configured. Test replay, replace, delete, cross-account denial and external auth callbacks with real identities. Physical iPhone testing is an independent pre-release requirement.
4. Roll back application code first if necessary. Do not remove additive schema or recorded result data without a separate backup/migration plan.

**Live secrets and hosted integration tests are NOT VERIFIED.** Isolated test DB/CI checks do not imply production availability or deployment permission.

## Private parser-review queue

After an authorized Phase 7 migration and Worker deployment, administrator-led analysis can inspect pending samples inside the **Supabase SQL editor** (never a public endpoint). Start with a privacy-preserving counts query:

```sql
SELECT disposition,
       parser_diagnostics->>'reason_code' AS reason_code,
       COUNT(*) AS sample_count
FROM public.raw_submissions
WHERE result_id IS NULL AND expires_at > now()
  AND parser_diagnostics->>'review_status'='pending'
GROUP BY 1,2
ORDER BY sample_count DESC;
```

To inspect private raw content, authorized project operators can filter `public.raw_submissions` by specific pending IDs in a controlled SQL session. Do not print full raw shares in CI, general logs, PRs, error responses or public issues. Convert verified examples into sanitized parser fixtures only after review. Do not silently run OCR, LLM categorization, automatic schema changes, or code generation based on untrusted user-supplied text.

The hosted Daydle Preview database initially had no raw samples or canonical results and only Phase 2–5 migrations. The owner authorized Phase 7 SQL, which is now **applied and verified** (five supported games, five RPCs restricted to service_role, two private tables protected by RLS). Previously pasted text was not persisted and cannot be recovered. The receiver becomes active only after separate Worker secret setup, deployment and authenticated E2E acceptance.

## UI visual verification

[Phase 7 guest History and Paste screenshots](screenshots/README.md#phase-7--real-guest-ui-captures-pr-14) were captured from the built app via [CI #44001940876](https://github.com/A13Xg/Daydle/actions/runs/44001940876). The approved Obsidian Arcade palette, stack routing, mobile touch targets and clipboard gesture were checked in Chromium. Authenticated results, actual private sample review and physical iOS behavior are not proven by guest screenshots.
