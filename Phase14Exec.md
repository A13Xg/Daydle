# Phase 14 — Public beta release and operational handoff

**Status: PLANNING / BLOCKED FOR PRODUCTION RELEASE.**  
**Branch:** `phase/14-beta-readiness-handoff` — verified base `20422881f774a0c5992cc52e8ad1035dfae64458` on `main` after [PR #24](https://github.com/A13Xg/Daydle/pull/24).  
**Roadmap:** [Phase 14](roadmap.md#phase-14--public-beta-release-and-operational-handoff).  
**Current release:** Latest confirmed protected Worker deployment is [#44045005321](https://github.com/A13Xg/Daydle/actions/runs/44045005321), `9098fdc` (Phase 10), not the Phase 13 source on main.  
**Source evidence:** [main CI #44172784193](https://github.com/A13Xg/Daydle/actions/runs/44172784193) PASS; PRs [#22](https://github.com/A13Xg/Daydle/pull/22), [#23](https://github.com/A13Xg/Daydle/pull/23), [#24](https://github.com/A13Xg/Daydle/pull/24) merged in order.

## Scope
Reconcile the stale main-branch phase ledger and root plans; implement source-side beta readiness, public privacy/legal disclosure, verifiable production smoke and release evidence checks, incident/backup/recovery runbooks and acceptance matrix. Do **not** automatically deploy, apply hosted migrations, delete accounts, install new provider credentials, or claim beta launch.

## Blocking owner/provider verification
- Phases 11/12 SQL migration history on live Supabase **NOT VERIFIED**; no post-Phase-10 Worker deploy in GitHub Actions.
- Offsite encrypted **scheduled** database backups, private object retention, independent real restore and deletion replay **NOT VERIFIED**; Phase 12 remains operationally blocked despite merged source.
- Real iOS Safari/installed PWA, Apple/Google OAuth across two accounts, public spoiler-safe compare, admin non-admin access, account export/delete **NOT VERIFIED** for latest code.
- No owner approval for beta launch/production data changes.

## Gates
- Source: npm ci, typecheck, ESLint, Prettier, Vitest, production build, Chromium smoke, two isolated PostgreSQL 17 migrations/RLS tests.
- Operational: read-only live production preflight, explicit approval for schema and Worker release, backups+restore, hosted identity/admin and two-user flows, iOS Safari manual acceptance, privacy/support/legal signoff, telemetry/monitoring, deployment evidence, documented rollback and public release note.
- Keep this root plan and draft PR while operational gates remain incomplete, even if source CI passes.
