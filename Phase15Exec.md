# Phase 15 — Daily UX density, onboarding and sample-backed parsers

**Status:** IN PROGRESS / [draft PR #27](https://github.com/A13Xg/Daydle/pull/27) — branch-only, not merged, migrated or deployed.
**Baseline:** main `c0e049f6e40e1f25ed1b5cf3e25ba1d093d33fa8`; protected Worker deployed and live in preceding release.

## Scope and acceptance

- Keep the approved Obsidian Arcade palette and React/Worker/PWA architecture; condense only oversized whitespace on Today, Discover and passive panels without shrinking interactive targets under 44px or removing accessibility/safe-area protections.
- On first browser sign-in **per account**, show a compact illustrated tutorial: publisher **Share Results → Copy** text → Daydle **Paste Results → Submit**. Esc/dismiss and focus containment are required, no automatic clipboard reads or uploads. Store only a local account-scoped seen flag; server profile is unchanged.
- After verified online empty selected-game list, send Today visitors to a multi-checkbox setup route. Save selected games as one confirmed server-ordered transaction. Do not redirect if offline, the catalog fails, or account loading is uncertain. Preserve existing editor/Discover and future reorder.
- After saved/duplicate/replaced recognized result, mark the corresponding game played for the current local calendar day and reconcile the server marker. Explicit historic puzzle dates do not mark today; results and manual flags remain conceptually different. A failed separate mark must not misrepresent a confirmed saved result.
- Inspect only retained private samples with owner authorization and commit no full user share/personal metadata. Worldle/Flagle single observed formats receive strict parsers and sanitized synthetic fixtures. Existing Wordle/Connections/Strands layouts gain regression tests. No guessed scoring or game date inference.
- New forward-only metadata SQL adds these two game slugs to supported catalog parser status (required by existing `ingest_parsed_share` SQL); apply only after PR merge and separate hosted migration authorization. The exact history preflight intentionally rejects deploying a newer Worker before migration.

## Decisions and risks

- UI mark is a separate owner-scoped write after the results endpoint confirms a result; a dropped connection between those calls leaves History authoritative but Today mark potentially missing, with an explicit warning.
- An undated publisher number may refer to an older puzzle. Such shares mark the date of submission, consistent with Today manual flags; no fabricated publisher date.
- One observed format from each new publisher is not comprehensive. Reject format drift; classify as unsupported/invalid and retain private raw input on explicit Submit for future review.
- Device-only iPhone Safari, VoiceOver, provider sign-in, actual first-login walkthrough, and backup/restore acceptance require separate real-world testing. Chromium CI cannot stand in for those.

## Verification

- Strict TypeScript, ESLint, Prettier, Vitest parser/UI/adapter tests, production Vite build and 31+ Chromium viewport route smokes.
- Two isolated PostgreSQL 17 migrations/security suites (including Phase 15 metadata update).
- Read-only preflight expected pending migration; no production SQL deployment, data deletion, secrets or Worker publish in this PR.
- Final self-review: exact diff, no private sample contents, no temporary formatting workflows, accurate docs/roadmap, link source CI when green.
