# Personal statistics — Phase 8 (source implementation)

## Invariants

The pure calculator in `shared/statistics.ts` operates on the **complete canonical result set**, never an offset-capped subset of Phase 7 History. The read API/DB aggregation must guarantee completeness before the UI displays lifetime counts. It uses an explicit IANA timezone and `submitted_at` for activity days, not the publisher puzzle date or puzzle number.

`currentStreak` counts consecutive local activity days ending today or yesterday. `longestStreak` counts the longest run in stored results. No metric requires completing every selected game. A result is unique per canonical puzzle and may be corrected; recalculating from authoritative current rows revokes obsolete achievements automatically.

Game completion rate equals `(win + complete) / (win + complete + loss)`; incomplete results are excluded and the rate is null when no decided results exist. Guess distributions and minimum attempts use only solved/completed rows with a meaningful positive attempts value. Minimum time uses completed rows only. Numeric scores are **not** compared until the game registry defines score direction, range and metric. Activity-based achievements are deterministic and do not imply a publisher-verified play.

## Unresolved before serving live data

- Implement a **complete-dataset** private DB aggregation or a proven bounded query contract; `my_result_history` is limited to offset <=5000 and is NOT sufficient for an authoritative lifetime rollup.
- Choose a durable timezone policy: current selected preference versus original submission-zone attribution. The current calculator makes the explicit-timezone behavior testable, but timezone travel can regroup historic days.
- Add authenticated Worker API and Statistics UI with privacy-preserving no-store responses, loading/offline/error states and correction/delete freshness. Validate against hosted OAuth only after separate deployment authorization.
- Daily publisher streaks require verified release metadata. Do not synthesize them from numbering or arbitrary timezone midnight.


## Hosted schema status

The Phase 8 statistics RPC exists in Daydle Preview (owner-authorized November 16, 2026); its `service_role` grant and both browser-role denials were verified. The React/Worker changes remain in unmerged draft PR #15, and the live UI has **not** been updated. The application and protected Worker-secret rollout remain separate from this database-only verification.
