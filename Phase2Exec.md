# Phase 2 Execution Plan — Domain model, persistence, and security foundations

**Status:** PLANNING  
**Main baseline:** `76557c649aac2a54543b40db555cfbab226922c9` (Phase 1 merged and reconciled)  
**Branch:** `phase/02-domain-security`  
**Source:** [roadmap.md](roadmap.md#phase-2--domain-model-persistence-and-security-foundations), [IDEA.md](IDEA.md), [AGENTS.md](AGENTS.md).

## Scope
PostgreSQL versioned migrations, canonical game/user/puzzle/result model, uniqueness/concurrency constraints, public/private access boundaries, auth-integrated row security, retention and correction provenance, repeatable fixtures and security tests.

## Required verification
- Fresh PostgreSQL schema applies in an isolated test database.
- Repeatable migrations, constraints, FKs, indexes and uniqueness tested.
- RLS actively tested under anonymous, authenticated owner, another user and privileged/service roles (including rejection paths).
- Public APIs cannot leak private emails, raw submissions, spoiler-protected results or moderation data.
- Existing React/Worker CI passes, migrations and fixtures are documented; no credentials or production deployment.

**Next:** Create draft PR, expand plan, self-review, then implement. Do not archive or mark ready until checks pass.
