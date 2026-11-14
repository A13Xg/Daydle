# Daydle — Repository Execution Protocol

This file governs development and review in this repository. Read it alongside [IDEA.md](IDEA.md) and [roadmap.md](roadmap.md) before starting a change. Its purpose is predictable delivery, clean history, and verifiable results. When product details are ambiguous, IDEA.md and confirmed user instructions outrank assumptions; when phase state is ambiguous, the actual repository and PR history outrank the roadmap's claims.

## Non-negotiable working conventions

- Development, progress reports, phase commands, and repository changes stay **in the existing conversation** using available tools. Do not prompt the user to move to another coding product, browser environment, Work mode, or separate chat to continue the project.
- Do not start a phase without a direct request such as **“complete next phase”** or **“complete phase X.”** Avoid bundling unrelated phases.
- **No attribution to model providers, automated coding assistants, tools, or other non-owner contributors.** Do not add Co-authored-by trailers, Generated-by footers, third-party agent branding, tooling-credit badges, or contributor entries for them. Use the legitimate repository owner's configured Git identity (A13Xg) or the authenticated GitHub connection; never spoof authorship. Existing legal license/third-party dependency notices are not creator attribution and must be preserved.
- Work in a dedicated phase branch and draft PR for every implementation phase (1 onward). Do not merge a PR, bypass branch protections, push application code directly to main, or deploy production changes without specific authorization.
- Phase 0 is the authorized initial bootstrap committed to main and is exempt from the PR requirement.
- Use conventional, informative, non-promotional commit messages. Never claim tests passed unless they were actually executed. Never change roadmap status based only on intent.
- Preserve secrets, credentials, and private data. No raw clipboard contents in general logs or commits. Use realistic test fixtures that are permitted to be stored.
- Product UX must be behaviorally polished; visual design details are intentionally deferred. Do not invent a final color palette or visual system without a separate instruction.

## Sources of truth (read in this order)

1. The user's most recent explicit instruction (scope and approvals).
2. IDEA.md — approved product contract and constraints.
3. roadmap.md — dependency graph, numbered phases, deliverables, acceptance gates, status.
4. This AGENTS.md — process and quality controls.
5. completedPhases/Phase#Exec.md — historical evidence and known deviations, **not** a substitute for inspecting live code.
6. Actual files, migrations, commit history, branches, PR state, CI/build/test results, production configuration.

If sources conflict, identify the difference, cite repository evidence, and apply the higher-priority requirement. Do not rewrite history silently.

## Command protocol

### “Complete next phase”

- Read the roadmap status table **from main**, inspect open/merged PRs and completedPhases/, and find the earliest dependency-satisfied phase not complete.
- If the immediately prior phase has an unmerged PR, a failed gate, or contradictory status, stop and explain the blocker rather than starting dependent work.
- A phase marked IN REVIEW whose PR has since merged requires the post-merge reconciliation below before selecting the next phase.
- Phase 0 is already bootstrapped. The first implementation phase is Phase 1.

### “Complete phase X”

- Resolve X to the exact numbered roadmap heading. Compare its dependencies with main-branch evidence.
- If X is complete, verify and report it; do not create duplicate work. If a draft/in-review PR exists, resume it rather than starting a second branch.
- If dependencies are absent, report which specific prerequisite is missing and do not mark the phase complete or jump ahead silently.
- If parallel or out-of-order work is explicitly authorized, record branch base and integration risks, and never claim an unmerged dependency exists on main.

## Mandatory phase cycle

### Step 1 — Preflight repository reconciliation

Before editing:
1. Verify correct repository, remote, default branch, permissions, branch state, and actual main commit SHA.
2. Read full IDEA.md, roadmap.md, AGENTS.md, relevant prior archived plans, and directly related implementation/test files. Examine open draft/ready PRs, last merges, and build/CI state.
3. For completed dependencies, inspect **evidence**: relevant files, migrations, contracts, tests, commit/PR linkage; run quick health checks where feasible. Do not rely only on roadmap labels.
4. Confirm target phase is not already implemented or superseded. Record discrepancies, conflicts, and untracked/dirty-worktree concerns. Avoid destructive resets.
5. State a short scope summary and expected verification gates in the same conversation. If evidence materially contradicts the roadmap, pause or repair with explicit traceability; do not camouflage a divergence by editing status alone.

### Step 2 — Create phase branch and draft PR at the beginning

1. Branch from the verified current main HEAD, using a clear slug: **phase/NN-description** (for example phase/01-application-skeleton). Never reuse an unrelated stale branch.
2. Create an initial root-level execution-plan stub named exactly **Phase#Exec.md** with # replaced by the phase integer, such as Phase1Exec.md. The stub identifies scope, roadmap reference, branch base SHA, planned acceptance gates, and explicitly says PLANNING.
3. Commit/push this minimal plan stub to the phase branch. A draft PR requires a diff against main; opening it before the first branch commit is not supported by GitHub.
4. Open a **draft pull request** targeting main titled **Phase N — [Roadmap title]**. Describe objective, dependency, scope, current planning status, tests not yet run, and links to roadmap/active plan. If an existing PR for the phase exists, continue it instead of duplicating.
5. Record branch and PR URL in Phase#Exec.md. Do not prematurely request review.

### Step 3 — Expand and review Phase#Exec.md before writing application code

Replace the scaffold with a concrete, repo-specific implementation plan. It must cover:

- Phase number/title, scope, status, source-of-truth references, prerequisites, verified base SHA and observed repo state.
- Expected user-visible behavior, screens/actions and error/empty/loading/offline states; what is explicitly out of scope.
- Existing code assessment and precise files/modules to create/change (avoid speculative paths that conflict with the repo).
- Database migrations, data flows, invariants, authorization/RLS, input validation, retention, and concurrency concerns where relevant.
- Typed API contracts, parser interfaces/fixtures, environment variables, external dependencies, and secret management as relevant.
- Ordered implementation tasks with dependencies, incremental commits, and rollback/compatibility expectations.
- Automated tests, manual iOS/PWA checks where appropriate, security/privacy checks, and acceptance criteria with observable evidence.
- Risk register, decisions/tradeoffs, expected CI/build checks, and a review checklist.

Review the plan **before implementation** for completeness, consistency with earlier phases, minimal complexity, and deployment feasibility. Amend it when gaps appear. Commit the reviewed plan to the existing phase branch, keep the PR draft, and only then begin feature implementation. Plans are not promises that a blocked external credential/provider setup has been completed; document environment blockers honestly.

### Step 4 — Implement only the requested phase

- Follow the reviewed execution plan with small coherent changes. Use the existing stack and patterns rather than substituting frameworks unnecessarily.
- Make domain, API, security, UI, and tests agree. Add migration and compatibility handling where needed. Keep parser modules independent of game registry metadata and public profiles independent of friendship authorization.
- If material new requirements emerge, document the changed scope and risk in Phase#Exec.md and PR; do not silently extend into a future phase.
- Maintain in-progress plan at the repository root. A failure or blocked gate means it stays there, not in completedPhases/.
- Keep user-facing progress concise and factual. Do not claim background work or future delivery without a running scheduled task.

### Step 5 — Verify, audit, and validate

Run the checks applicable to the phase, at minimum:

1. Reproducible install/build, typecheck, lint/format, and unit tests where present. Report exact commands and results. If the phase is docs-only, validate links, phase references, statuses, naming, and Markdown structure.
2. Relevant integration/API/database/fixture tests, and browser/E2E tests for affected user flows. On iOS-sensitive changes verify real clipboard permission and external-browser behavior rather than assuming it works.
3. Review the entire phase diff for correctness, error paths, state transitions, authorization/IDOR, raw-input and log exposure, rate limits, async races, data migrations, and performance regressions as applicable.
4. Confirm new/modified documentation matches actual behavior, schema migrations are repeatable, secrets are excluded, and tests are meaningful rather than assertions that mirror code.
5. Compare results to **each roadmap exit gate** and every acceptance criterion in Phase#Exec.md. Record failures/limitations, fix and rerun necessary checks.
6. Validate branch/PR state, changed file list, and absence of accidental unrelated changes or agent/tool contributor credits.

If execution environment cannot run a test, document it as **NOT VERIFIED**, with reason and exact user/operator action needed. Do not mark the phase verified or ready for review if a material acceptance gate remains unverified. Never invent test outcomes.

### Step 6 — Archive, update status, and request review

Only when implementation and required verification pass:

1. Append a factual completion report to Phase#Exec.md: final scope, changed files/modules, test commands and results, manual checks, audit findings and fixes, known limitations, migration/deployment notes, and commit/PR reference.
2. Move the finished file using Git rename semantics from **Phase#Exec.md** to **completedPhases/Phase#Exec.md**; the root-level active plan must no longer exist. Retain the full reviewed plan and outcome report.
3. Update the phase row/heading in the branch's roadmap.md to **IN REVIEW**; include the associated PR number/link and a short verification reference. This branch status is a proposal; main retains its previous status until merge.
4. Commit and push all finished changes. Review final diff, ensure no missing files or CI failures, update PR body with test evidence and checklist, and change the **draft PR to ready for review**.
5. Inform the user of the ready PR, tests performed, material caveats, and whether manual review or provider setup is required. **Do not merge** or begin another phase automatically.

If review finds issues, keep or reopen the branch/PR, fix them, rerun gates, and update archived execution evidence. Do not create a new phase for normal review fixes.

### Step 7 — Post-merge reconciliation and continuing work

- A ready-for-review PR is **not** a merged phase. Wait for explicit user authorization to merge, or observe that the user merged it externally.
- When a previously IN REVIEW PR merges, verify main contains the deliverables, archived plan, and passing evidence; only then change the main roadmap phase status to **COMPLETE** with merge SHA/PR link. This may be a minimal status-only housekeeping commit on main after the merge; it is not a new feature phase. Do not use the main ledger's IN REVIEW state as proof a phase is still unmerged without checking actual PR state.
- Re-run a quick post-merge health or CI check as appropriate. Reconcile unexpected conflicts before proceeding.
- On the next “complete next phase” request, perform this verification and status finalization first; then begin the next eligible branch + draft PR loop.

## Document conventions and status evidence

- roadmap.md contains numbered phase sections, dependency chain, brief implementation guidance, exit/verification gates, and the main-branch status table.
- IDEA.md is a product baseline. Change its major approved decisions only with explicit user direction; do not redesign public social permissions or data lifecycle opportunistically.
- Phase#Exec.md is **written at phase start**, after preflight and a draft PR scaffold. Do not prepopulate future phase plans en masse, because they need to fit actual code.
- completedPhases/Phase#Exec.md is **an archive, not a scratchpad**. If tests fail, plan remains active or archive reverts to active with a traceable change.
- Pull requests must include: phase scope, base/dependency, implementation summary, tests with real outcomes, risk/rollback notes, and acceptance checklist. Mark PR ready only on passing gates; never merge automatically.
- Branch and PR states are as important as roadmap statuses. Keep cross-links stable and current.
- Commit history is meaningful and reviewer-friendly; don't force push other people's work or rewrite published main history.

## Baseline design constraints to check every phase

1. React/TypeScript/Vite, Cloudflare Workers, Supabase Auth/Postgres; don't introduce unnecessary services or a second backend.
2. Open public signup; email/password and Apple/Google OAuth; no required password for OAuth-only account.
3. All user profiles publicly expose permitted game performance, not email/raw inputs or sensitive account details. Friendship only filters the Compare with Friends view.
4. Five-character secure random friend codes with DB collision retry; instant symmetric friendship by code/link/QR; no acceptance gate.
5. Server-authoritative deterministic versioned parsers, initially 5–10 supported games and broad launchable catalog.
6. One result per submission, canonical user/game/puzzle identity, confirmation on ambiguous game/date, explicit replacement/deletion, no fabricated universal cross-game score.
7. Viewer-specific spoiler masking until valid same-puzzle submission or verified next publisher reset, across every API/query/cache.
8. Raw share text retained only 90 days; parsed history persists until deletion; use encrypted independent scheduled backups on free-tier Supabase.
9. Primary iOS Safari/PWA experience: user-gesture clipboard, best-effort external tab launch, focus/return action, read-only offline caches.
10. Polished behavior, accessibility, errors/retries/empty states required; precise aesthetics remain deferred.
11. Public beta can be deployed only after explicit user authorization. No production changes merely because a phase plan mentions them.

## Result reporting format

For each phase completion in the conversation, report:
- **Phase:** N / title; current branch and PR.
- **Implemented:** only verifiable delivered features.
- **Checks:** concise pass/fail/not-run list with meaningful commands and environment.
- **Audit:** issues found and corrected, plus material remaining limitations.
- **State:** PR ready for review or BLOCKED, plan archived or active, main status unchanged until merge.

Be clear and economical; report concrete commits and links when available. Never represent a plan, draft PR, or unexecuted test as completed work.
## Execution-environment evidence policy

- If the current local runtime cannot access package registries, execute real build/test gates through repository CI; an attempted command returning a network error is **NOT VERIFIED**, never a passing test.
- Keep `package-lock.json` in version control; CI must use `npm ci` once the lock exists. A temporary CI artifact can be used to generate an initial lockfile, but the lock must be introduced via the authenticated repository connection, never via a commit forged to look like another identity.
- For PR reviews, distinguish static/source inspection from executed automated checks and from deployed external-service integration. No Cloudflare or Supabase deployment is implied by a passing local build.
- When external credentials prevent a live preview, explicitly report the provider-side verification gap. Do not disclose or request privileged tokens in this chat, and do not bypass the user's prohibition on unapproved production deployments.

## PostgreSQL migration and deployment evidence

- New migrations must pass two isolated clean PostgreSQL databases with row-level-security checks for `anon`, `authenticated`, and privileged roles; fixture assertions must include denial paths and same-puzzle spoiler unlocking.
- Do not connect PR CI to a live Supabase project, and do not invoke `supabase db push` or run migrations against hosted databases without explicit environment-specific deployment authorization.
- Provider credentials may be stored in GitHub Environment secrets or Cloudflare Worker secrets without authorizing their use in CI or any live deployment. Restrict production credentials from pull-request workflows and prefer separately gated deployments.
- Public profile tables and client-accessible results must never expose auth email, raw copied text, admin data, or unreleased puzzle performance, including through alternate aggregate, award or ranking routes.

## Credential escalation without unnecessary deferral

- At every phase preflight and before closing review, decide explicitly whether external credentials are **currently blocking an essential implementation or verification gate**. If yes, tell the user immediately which minimum names, scope, destination and provider configuration are required. Never solicit secret values in conversation.
- If credentials are not yet on the critical path, implement and verify the standard architecture without prompting for premature setup; call out live integration as NOT VERIFIED, and surface the exact checkpoint when reached.
- Do not overengineer mocks, custom providers, or elaborate fallbacks merely to avoid asking for straightforward OAuth, preview hosting, or database credentials when the next gate genuinely requires them.
- Maintain environment separation and explicit permission for remote migrations/deployments even if GitHub secrets already exist. Production permissions must never be inferred from credential availability.
