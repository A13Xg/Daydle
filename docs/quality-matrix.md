# Daydle — Source quality and public beta acceptance matrix

**Post-merge status (November 17, 2026):** Phase 11 [PR #22](https://github.com/A13Xg/Daydle/pull/22), Phase 12 [PR #23](https://github.com/A13Xg/Daydle/pull/23) and Phase 13 [PR #24](https://github.com/A13Xg/Daydle/pull/24) are source merged. The last confirmed protected Worker release remains Phase 10. Offsite backup/restore, hosted auth/admin integration and real Safari acceptance remain NOT VERIFIED. Phase 14 [release go/no-go](beta-release.md) is blocked pending those gates.

This matrix distinguishes **automated source evidence**, **hosted production evidence**, and **manual device/operator acceptance**. A passing CI job is not proof that a provider-backed or physical-device flow works. Obsidian Arcade is the existing approved visual system.

| Surface / invariant | Reproducible source evidence | Known external or manual gap |
|---|---|---|
| Today / game launch / Paste entry | `tests/today.test.ts`, `tests/launch-return.test.ts`, `tests/clipboard.test.ts`, `tests/paste-ui.test.ts`, `scripts/ui-smoke.mjs` checks guest Paste dialog, Escape/focus restore | Actual iOS Safari/installed PWA clipboard permission, external-tab return |
| Discovery, selections | `tests/catalog.test.ts`, `tests/catalog-api.test.ts`, `tests/catalog-ui.test.ts`, `tests/sql/catalog-assertions.sql` | Signed-in live provider E2E; publisher link lifecycle monitoring |
| Submission, history, corrections | `tests/parsers.test.ts`, `tests/results-worker.test.ts`, `tests/sql/results-assertions.sql` | Real hosted user result lifecycle and paste from publisher sites |
| Personal statistics | `tests/statistics.test.ts`, `tests/statistics-worker.test.ts`, `tests/sql/statistics-assertions.sql` | Hosted authenticated statistics history UI |
| Friend codes, blocks, public profiles | `tests/social-worker.test.ts`, `tests/sql/social-assertions.sql`, guest Chrome routes | Real two-account OAuth relationship tests, camera QR on iOS |
| Spoiler-safe comparisons | `tests/comparisons-worker.test.ts`, `tests/sql/comparisons-assertions.sql`, guest Chrome shield checks | Real two-account same-puzzle unlock and verified-reset timing |
| Game suggestions and admin | `tests/administration-worker.test.ts`, `tests/administration-ui.test.ts`, `tests/sql/administration-assertions.sql` where present; guest Chrome route | Admin membership provisioning and real hosted operator/nonoperator E2E; Phase 11 source merged; hosted release not verified |
| Privacy export and deletion | `tests/privacy-worker.test.ts`, `tests/sql/privacy-assertions.sql` where present; private no-store responses | Hosted deletion and export including session restoration; Phase 12 source merged; hosted release not verified |
| Raw retention and recovery | `tests/backup-crypto.test.ts`, `scripts/ops/backup-crypto.mjs`, SQL TTL/RLS assertions | Independently scheduled offsite encrypted backup, retention, real isolated restore, tombstone replay |
| Install/offline/cache | `tests/pwa.test.ts`, `tests/offline-snapshot.test.ts`, `tests/live-release.test.ts` | Safari PWA installation and offline authenticated account isolation on device |
| Theme/responsiveness | `scripts/ui-smoke.mjs`: 320px/393px/1024px, 31 responsive route checks in Phase 14, locally bundled font, 5-tab navigation, 44px buttons, no horizontal overflow/CDN | Human screenshot-to-reference parity; dynamic authenticated content |
| Accessibility semantics | `scripts/ui-smoke.mjs`: computed Chromium accessibility names, page landmarks, H1, image alt, hidden-focusable checks (Phase 13), keyboard Escape focus test | Full WCAG 2.2 AA audit with screen readers/VoiceOver and mobile Safari |

## Security acceptance boundaries

- **Authentication:** Worker uses verified Supabase identity, not request-provided user IDs; server holds privileged keys. `redirect: "manual"` must remain on outbound privileged fetches.
- **Authorization:** PostgreSQL RLS and service-role-only functions protect private data; admin actor membership is checked server-side. Browser-only gates are never sufficient.
- **Spoilers:** Only an already-saved same-puzzle result or a publisher-reset verification permits visibility; hide before aggregation, count, rank or pagination. Friend status alone never authorizes results.
- **Raw text:** Unknown/invalid bounded submissions retain private raw text only on explicit user Submit; no clipboard read, typing or dialog open triggers upload. Raw material has at most a 90-day expiry and must be physically purged by an operational job.
- **Cache and logging:** Spoiler-sensitive or owner data remains `private, no-store` with authorization variation. Never log raw shares, upstream response bodies, credentials, account IDs or private export content.
- **Release:** Pull-request CI must not apply hosted migrations or publish Workers. Exact hosted migration version/name verification and protected production approval remain mandatory.

## Running the source gates

```bash
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run smoke
# In parallel, on two isolated PostgreSQL 17 test DBs:
npm run db:test
# With a local preview server on port 4173 and Chrome/Chromium installed:
node scripts/ui-smoke.mjs
```

A passing source run verifies the listed code paths and fixtures only. **Do not mark provider-side, real-user, offsite recovery, iOS or visual-human gates complete** unless separately executed with evidence. Physical iPhone checks remain owner-deferred.

## Release sequencing

Phase 11 PR #22 must merge before Phase 12 PR #23, which must merge before Phase 13 PR #24. The stacked source branches can be inspected without merging; deployed migrations and credentials need separate authorized release actions. Phase 12's unresolved offsite restoration gate remains a blocker to claiming a fully recovered production service.
