# Phase 6 Execution Plan — Deterministic parser registry and initial game coverage

**Status:** PLAN REVIEWED — ready to implement; automated gates not yet executed.
**Base:** `main` at `374b97f028137a51d19c47591b7aa146cf1e70f6` (PR #11 merged, main CI 43833255126 passed).
**Branch:** `phase/06-deterministic-parsers`; **PR:** [#12](https://github.com/A13Xg/Daydle/pull/12) (draft until gates pass).
**Authority:** [IDEA.md](IDEA.md) parsing, puzzle identity and data privacy; [roadmap.md](roadmap.md) Phase 6 and approved Phase 6.5; [AGENTS.md](AGENTS.md); owner-reported Phase 5 device acceptance and [archive](completedPhases/Phase5Exec.md).

## Preflight and Phase 5 acceptance

- Original Phase 5 code PR #7 and release-hardening PR #10 merged. Production Supabase Phase 4/5 migrations and Cloudflare Worker rollout already occurred under owner approval. All eight iPhone Safari/installed-PWA device tests were reported PASS by the owner, not independently reproduced in this session. Phase 5's plan is archived and the main-branch status correction is proposed in this PR; no direct `main` write.
- Obsidian Arcade design and 13 example screens from merged PR #11 are now owner-approved. Phase 6.5 is inserted between Phase 6 and Phase 7 for **actual UI implementation**. Screenshot-only mechanics do not override the product contract.
- Present app: React/TypeScript/Vite + Worker, Supabase Auth/Postgres, public catalog (12 seeded game slugs), Today/manual marks, no result parsing API or canonical result ingestion. No database migration, deployment, credential or user testing is required to build the parser library.
- A possible future iOS WKWebView/native packaging is only a portability constraint. No new native targets, Capacitor or Xcode work in this phase.

## User-visible and technical scope

- Implement a **server-safe** (Node/Workers-compatible) pure TypeScript versioned parser registry with strict normalization, candidate detection, diagnostics, per-game parsing and score validation.
- Start with **five different existing catalog formats**: Wordle, NYT Connections, NYT Strands, NYT Mini Crossword, Daily Quordle. They cover emoji grids, color-group rows, token sequences, duration/date strings and keycap result matrices.
- Return one result per invocation, canonical **game slug** and share-provided puzzle identity (number or date), outcome, nullable attempts/score/time, format/parser versions, and bounded typed metrics. Preserve puzzle number independently of publisher date. No invented cross-game numerical score.
- Diagnostic outcomes: blank, oversized, control characters, too many lines, unknown, ambiguous/multiple games, recognized-but-invalid, and valid. Distinguish game detection confidence from valid parse. Never output raw clipboard content in logs or error messages.
- Respect independent catalog IDs: parser modules expose stable **slugs**, and later ingestion maps them to catalog IDs. Do not mark catalog `parser_status=supported` until the Phase 7 API can ingest; do not expose a persistence endpoint now.
- Phase 7 owns authenticated API, ambiguous puzzle resolution UX, insert/idempotency/replacement/deletion and 90-day raw retention. No UI changes, no schema writes.

## Proposed implementation files

- `shared/parsers/types.ts`: stable typed outcome, metrics, safe diagnostics and parser interface.
- `shared/parsers/normalize.ts`: Unicode NFC, BOM/variation selectors, NBSP/CRLF, control/size/line bounds; no regex on unbounded input.
- `shared/parsers/common.ts`: strict puzzle-number, date and emoji helpers; reject partial/mismatched records.
- `shared/parsers/games/{wordle,connections,strands,mini-crossword,quordle}.ts`: isolated parser implementations, detection and format validation.
- `shared/parsers/registry.ts` and `shared/parsers/index.ts`: single-result routing, ambiguity/unknown/error taxonomy and exports without Worker or browser runtime dependencies.
- `tests/parsers.test.ts`: fixture-driven valid, loss/hard-mode/date/emoji/hint, malformed, false-positive and ambiguous/multi-result cases.
- `docs/parsers.md`: format coverage/limitations, exact fixtures provenance, versioning and acceptance rules.
- `Phase6Exec.md`: retain plan and outcomes while draft; archive only after all gates pass.

## Input, identity and validity rules

1. Accept a string of at most 10,000 UTF-16 code units, up to 64 lines. Reject null/control characters except TAB/LF, normalize CRLF, whitespace and emoji variation selectors; never evaluate HTML/scripts or retrieve external URLs.
2. Require format-specific header+body signatures, not URL-only substring matches. A recognized header with a malformed body must return a safe invalid outcome, not silently fall through to a different game.
3. Reject two different recognized shares or ambiguous candidate headers as a single result. Report only game slugs and safe diagnostic codes; never echo input.
4. Wordle grid must have 1–6 rows of exactly five supported tiles; win rows end in all green, loss rows never impersonate win. Hard mode is a share header marker, **not publisher verification**. `X/6` is loss.
5. Connections requires explicit puzzle number and consistent four-square colored rows. A solved game must have four distinct monochrome groups and respect maximum mistakes; incomplete/ambiguous rows are not credited as a win.
6. Strands requires number, exactly one yellow spangram marker, blue theme words and optional lightbulb hints; completion is a share-format claim only.
7. Mini parses an explicit US date and valid `M:SS` or `H:MM:SS` duration into milliseconds, verifies Gregorian date and reasonable duration. Its date is share-provided, not inferred from local clock.
8. Daily Quordle (not Extreme/Sequence) requires number and exactly four matrix results (1–9 keycaps or red failed tile). Four solved results = win; otherwise loss. Colored progress rows may be ignored only if clearly from the known share vocabulary.
9. Puzzle key is namespaced by game slug and share-provided number/date. Do not infer a calendar date for numbered puzzles; do not conflate submission date, publisher reset, and puzzle number.

## Source/fixture provenance and limits

- Wordle, Connections, Mini and Quordle share examples are documented at [WordleBot documentation](https://www.wordlebot.gg/docs), which includes multiple publisher-origin share-text examples. Fixtures are independently constructed short test samples using those documented syntax rules, not claims about the actual score of a user.
- Strands' blue/yellow/hint share semantics were confirmed through [NYT Strands guide](https://tech.yahoo.com/puzzles/strands/articles/todays-nyt-strands-hints-answer-050020580.html) (November 2026). Fixtures are illustrative and cannot establish exhaustive historical format support.
- Historical variants and new publisher formats may require later fixture additions. Unknown or inconsistent variants fail closed; support only validated forms.
- Copyright: do not store publisher answers, puzzle solutions or private submitted text in this repository. Test fixtures consist of neutral emoji patterns and sample headers, no personal data.

## Ordered steps and verification

1. **Done:** Reconcile approved design authority and future-iOS-only portability in IDEA/AGENTS/README/reference docs, then verify remote files.
2. **Done:** Update Phase 5 owner-attested acceptance and roadmap; archive Phase5Exec; verify all eight rows, archived file and missing root plan.
3. Review this execution plan before implementation, then implement types/normalizer/common helpers, parser modules, registry and fixtures in focused commits.
4. Run **real** GitHub PR CI: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`, `npm run smoke` and both disposable PostgreSQL 17 security suites. Do not treat static review as an executed test.
5. Audit false positives, Unicode, max input, malformed data, multi-result handling, puzzle identity and metadata boundaries, generated JS portability, secrets, attribution, changed files and phase scope. Fix and rerun.
6. Once checks pass and documentation is honest, append measured completion evidence; move this plan to `completedPhases/Phase6Exec.md`, set Phase 6 to IN REVIEW on the PR branch, update PR body and change draft to ready. Do not merge/deploy.

## Risks and rollback

- Publisher share formats can change: version each parser and reject unrecognized variants; adding fixtures is safer than guessing. No remote reliance.
- Header-only false positives or mixed messages could leak invalid stats later: restrict exact header/body pairs and reject multiple signatures.
- Numbered games have no verified puzzle date in their shares: retain share number and null date until canonical publisher-resolution logic exists.
- Unicode emoji may contain variation selectors: normalize conservatively and test white/black/colored grid differences.
- No database migration or hosted state change in this phase, so rollback is branch/PR revert only.
