# Completed Phase Execution Plans

This directory archives the reviewed execution plan and verified completion evidence for each implementation phase.

- At phase start, create **Phase#Exec.md** at the repository root on a dedicated phase branch.
- After all acceptance gates pass, move it to **completedPhases/Phase#Exec.md** in the same phase PR.
- The archived file must retain the approved implementation plan, actual changes, tests and their outcomes, audit/fixes, known limitations, and phase PR/commit reference.
- If material verification is missing, do not archive the plan or mark the draft PR ready.
- Phase 5 was archived after owner-reported 8/8 physical iPhone/PWA acceptance and review of merge/release/CI evidence. Older in-progress notes remain historical.
- Phase 6 was archived on its feature branch after parser/fixture implementation passed 164 tests/24 suites and two clean PostgreSQL 17 security jobs. It remains IN REVIEW until its PR merges.
- The archive is historical evidence; inspect live files and merged PRs before treating the roadmap as correct.
- Phase 0 is a documentation bootstrap committed on main and intentionally has no separate Phase0Exec.md.

See [roadmap.md](../roadmap.md) and [AGENTS.md](../AGENTS.md) for the complete procedure.
