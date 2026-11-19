# Daydle deterministic share parsers (Phase 6)

Pure, server-safe TypeScript modules under `shared/parsers/` decode **one** publisher share-text result per call. They do not make network calls, store raw clipboard text, resolve authentication, write to Supabase, or expose a Worker endpoint. The [Phase 7 implementation](results.md) adds server-authoritative authorization, canonical game/puzzle mapping, result persistence, duplicate/correction behavior, and retention metadata. It is not deployed until explicitly authorized.

## Versioned coverage

| Catalog slug     | Expected share signature                                        | Puzzle identity from share         | Result metrics                                                |
| ---------------- | --------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `wordle`         | `Wordle 1,406 4/6*` and five-wide tile grid                     | Number only                        | Attempts, outcome, hard-mode _claim_                          |
| `connections`    | `Connections`, `Puzzle #687`, four-tile row groups              | Number only                        | Solved groups and mistakes                                    |
| `strands`        | `Strands #985`, blue/yellow/hint sequence                       | Number only                        | Theme words, hints, spangram position                         |
| `mini-crossword` | `I solved the 4/28/2025 New York Times Mini Crossword in 0:22!` | Share-provided date                | Completion time                                               |
| `quordle`        | `Daily Quordle 1190`, two-by-two keycap/red results             | Number only                        | Four board attempts/failed boards                             |
| `worldle`        | `#Worldle #1701 (DD.MM.YYYY) X/6 (81%)`, square/direction grid  | Publisher-provided number and date | Attempts, reported percentage, clue counts; no invented score |
| `flagle`         | `#Flagle #1700 (DD.MM.YYYY) 2/6`, three-tile rows               | Publisher-provided number and date | Attempts, green clues; no invented score                      |

All have `parserVersion=1.0.0`; per-format `formatVersion` is stored in parsed output. The registry is independent of catalog records: game slugs are stable join keys; a valid parsed result is **not** proof of actual publisher gameplay. In particular, Wordle's asterisk means publisher-share _claimed_ hard mode, not verified gameplay.

### Interface

`parseShare(input)` returns `parsed`, `invalid` (safe code and optional slug), `unknown`, or `ambiguous` (recognized slugs, never raw text). Parsed results contain a namespaced puzzle key, nullable number/date, game-aware outcome, nullable attempts/score/time, and bounded typed metrics. Headers without valid bodies are rejected. Mixed game shares are not silently split or ingested.

Normalization accepts at most **10,000 UTF-16 code units** and **64 raw lines**, preserving line structure while normalizing CRLF, nonbreaking spaces, a leading BOM, and emoji variation selectors. Invalid controls are rejected before regex processing; there is no dynamic evaluation, parsing of URLs as game identity, raw-text diagnostic logging, or persistence.

### Fixture provenance

- [WordleBot game-share documentation](https://www.wordlebot.gg/docs) records actual Wordle, Connections, Daily Quordle and NYT Mini share-text layouts. Test fixtures here are small independently constructed examples consistent with those layouts and are not claims about real user performance.
- [November 2026 NYT Strands guide](https://tech.yahoo.com/puzzles/strands/articles/todays-nyt-strands-hints-answer-050020580.html) identifies the meaning of blue theme-word circles, yellow spangram circles, and lightbulb hint symbols. Its fixture is a syntactic representative, not copied private gameplay.
- The Phase 15 additions derive from **two privately submitted raw formats** (one Worldle loss, one Flagle win), plus three already parsed Wordle/Connections/Strands samples. Only synthetic, altered puzzle-number fixtures reproducing the publisher layout are committed; no raw user sample or identifier appears in source. Variants with missing clues, impossible dates, extra lines or unexpected URLs fail closed.
- Automated tests cover both success/failure and historical white-square/variation-selector behavior. Unknown publisher format revisions fail closed until independently validated fixtures and a versioned parser update are reviewed.

### Operational limitations

- A puzzle **number does not establish its publisher date**. Results with numbers only retain `puzzleDate=null`; Phase 7 resolves publisher release identities and may need the user to confirm a game/date.
- Only classic **Daily Quordle** is supported; Extreme and Sequence intentionally return unknown. Mini parsing currently covers publisher `I solved ... Mini Crossword in ...!` text, not image-only shares. Wordle requires its grid rather than trusting a header alone.
- Phase 7 originally marked five parsers supported. Phase 15 adds strict Worldle and Flagle parsers with a **separate metadata-only migration (hosted version `20261119021325`, applied on 2026-11-18 Pacific)**. The existing server SQL only accepts games tagged `parser_status='supported'`, so the new source parsers cannot ingest results in production until the newer Worker is deployed after the merge through the protected release workflow. The migration is already applied and verified on the Daydle Supabase project. Strands markers demonstrate claimed completion, not a validated puzzle solution. No global score conversions exist.
- No actual iOS native wrapper is included. This library is platform-independent and uses no DOM or Node-specific APIs, preserving future packaging options.

### Verified source checks

[Committed-source PR CI #43836926617](https://github.com/A13Xg/Daydle/actions/runs/43836926617) passed TypeScript, ESLint, Prettier, 164 tests/24 suites (46 parser-specific cases), production build, PWA HTTP smoke and the two isolated PostgreSQL 17 database-security jobs. This validates the source library but **does not** prove live publisher formats or hosted result ingestion. Details are in [the Phase 6 execution archive](../completedPhases/Phase6Exec.md).
