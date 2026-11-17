# Phase 8 statistics RPC

The migration `20261117040000_phase8_statistics.sql` defines `my_personal_statistics(p_user uuid,p_timezone text)`, a **service_role-only** on-demand aggregate over the complete authoritative `game_results` set. It does not read or return raw share text. There are no materialized counters that can go stale following a result replacement/deletion.

The Worker must verify the real Supabase bearer session, derive the owner UUID server-side, pass the user-selected IANA timezone, and expose only the returned owner data with `Cache-Control: private, no-store`. This RPC is **not** a public stats endpoint for future social pages.

A bounded 366-day activity series is provided for rendering; lifetime totals and longest streak are computed over **all** results, never the truncated series. `activityDaysTruncated` signals the UI limitation. Publisher puzzle dates and game release-streak calculations are deliberately excluded until reliably verified. SQL validates timezones against `pg_timezone_names`; date grouping uses `submitted_at AT TIME ZONE p_timezone`. The user timezone is not yet persisted, so travel can change grouping. The UI must disclose its active timezone.

Achievements are derived from server-returned canonical counts and longest streak using the same deterministic shared rules as the pure fixture-tested calculator. They are not persisted as irreversible award rows; deletion and correction change eligibility on the next read.

**Deploy gate:** The owner approved and the connected migration action applied the Phase 8 SQL on Daydle Preview. The Cloudflare Worker/frontend deployment is separately gated by the existing main-only, reviewer-protected release workflow and its runtime-binding preflight.

## Authorized Daydle Preview migration record (November 16, 2026)

The Phase 8 SQL was applied and verified. Supabase assigned migration version `20261117034143` and name `20261117040000_phase8_statistics`; the source filename's version prefix is **not** the stored version. Existing Phase 7 SQL was recorded as version `20261117030322` and name `20261117010000_phase7_results`. Avoid automatic replay until version mapping has been reconciled. The service-role-only permissions were confirmed by read-only SQL; no Worker frontend release occurred.
