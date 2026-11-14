# Phase 1 Execution Plan — Application skeleton, tooling, and deploy baselines

**Status:** PLANNING
**Base:** `main` @ `839498fa09e9ff2cabd7f4487f21165a8e0bed6a`
**Branch:** `phase/01-application-skeleton`
**Source:** [roadmap.md](roadmap.md#phase-1--application-skeleton-tooling-and-deploy-baselines), [IDEA.md](IDEA.md), [AGENTS.md](AGENTS.md)

## Phase scope
React + TypeScript + Vite application, Cloudflare Worker API and static assets, strict tooling, safe Supabase configuration boundary, documented deployment/rollback process, basic application shell, and automated checks. No product features or production deployment.

## Proposed acceptance gates
- Clean reproducible installation and locked dependencies.
- Successful build, typecheck, lint, format check, meaningful unit and API smoke tests.
- Health endpoint serves JSON; frontend fallback operates without SPA routing errors.
- CI executes checks; config contains no credentials.
- Preview and production deployment paths documented and verified locally; external preview only if provisioned.

**Next:** expand/review and commit this execution plan before creating application code. Do not archive until verified.
