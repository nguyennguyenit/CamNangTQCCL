# Baseline capture — 2026-09-08

Status: incomplete, quota blocked. These are capture statuses, not assertion PASS totals. Four cases have complete observed output; one emitted actual terminal prose rejected by the first transport parser; thirty hit the account session limit. No baseline is accepted as complete; Phase2 remains pending.

CLI message: `You’ve hit your session limit · resets 4:30am (Asia/Saigon)`. No credit purchase, API fallback or account switching performed. Actor’s final prose from case11 is preserved unmodified in the archived attempt; it must be replayed using the corrected adapter. No output was invented or reclassified as behavioral Green.

| Case | Capture status | Dispatcher actions | Evidence | Assertions |
| --- | --- | ---: | --- | --- |
| 01 | OBSERVED | 4 | [01](baseline/01.json) | NOT_GRADED |
| 02 | OBSERVED | 9 | [02](baseline/02.json) | NOT_GRADED |
| 03 | ENVIRONMENT_BLOCKED | 4 | [03](baseline-attempt-01-unobserved/03.json) | NOT_GRADED |
| 04 | ENVIRONMENT_BLOCKED | 0 | [04](baseline-attempt-01-unobserved/04.json) | NOT_GRADED |
| 05 | ENVIRONMENT_BLOCKED | 0 | [05](baseline-attempt-01-unobserved/05.json) | NOT_GRADED |
| 06 | ENVIRONMENT_BLOCKED | 0 | [06](baseline-attempt-01-unobserved/06.json) | NOT_GRADED |
| 07 | ENVIRONMENT_BLOCKED | 0 | [07](baseline-attempt-01-unobserved/07.json) | NOT_GRADED |
| 08 | ENVIRONMENT_BLOCKED | 0 | [08](baseline-attempt-01-unobserved/08.json) | NOT_GRADED |
| 09 | ENVIRONMENT_BLOCKED | 0 | [09](baseline-attempt-01-unobserved/09.json) | NOT_GRADED |
| 10 | ENVIRONMENT_BLOCKED | 0 | [10](baseline-attempt-01-unobserved/10.json) | NOT_GRADED |
| 10-handoff | ENVIRONMENT_BLOCKED | 0 | [10-handoff](baseline-attempt-01-unobserved/10-handoff.json) | NOT_GRADED |
| 10-lower | ENVIRONMENT_BLOCKED | 0 | [10-lower](baseline-attempt-01-unobserved/10-lower.json) | NOT_GRADED |
| 11 | MALFORMED | 7 | [11](baseline-attempt-01-unobserved/11.json) | NOT_GRADED |
| 12 | OBSERVED | 7 | [12](baseline/12.json) | NOT_GRADED |
| 13 | ENVIRONMENT_BLOCKED | 0 | [13](baseline-attempt-01-unobserved/13.json) | NOT_GRADED |
| 14 | ENVIRONMENT_BLOCKED | 0 | [14](baseline-attempt-01-unobserved/14.json) | NOT_GRADED |
| 15 | ENVIRONMENT_BLOCKED | 0 | [15](baseline-attempt-01-unobserved/15.json) | NOT_GRADED |
| 16 | ENVIRONMENT_BLOCKED | 0 | [16](baseline-attempt-01-unobserved/16.json) | NOT_GRADED |
| 17 | ENVIRONMENT_BLOCKED | 0 | [17](baseline-attempt-01-unobserved/17.json) | NOT_GRADED |
| 18 | ENVIRONMENT_BLOCKED | 0 | [18](baseline-attempt-01-unobserved/18.json) | NOT_GRADED |
| 19 | ENVIRONMENT_BLOCKED | 0 | [19](baseline-attempt-01-unobserved/19.json) | NOT_GRADED |
| 20 | ENVIRONMENT_BLOCKED | 0 | [20](baseline-attempt-01-unobserved/20.json) | NOT_GRADED |
| 21 | ENVIRONMENT_BLOCKED | 0 | [21](baseline-attempt-01-unobserved/21.json) | NOT_GRADED |
| 22 | ENVIRONMENT_BLOCKED | 0 | [22](baseline-attempt-01-unobserved/22.json) | NOT_GRADED |
| 23 | OBSERVED | 10 | [23](baseline/23.json) | NOT_GRADED |
| 23a | ENVIRONMENT_BLOCKED | 10 | [23a](baseline-attempt-01-unobserved/23a.json) | NOT_GRADED |
| 23b | ENVIRONMENT_BLOCKED | 0 | [23b](baseline-attempt-01-unobserved/23b.json) | NOT_GRADED |
| 24 | ENVIRONMENT_BLOCKED | 0 | [24](baseline-attempt-01-unobserved/24.json) | NOT_GRADED |
| 25 | ENVIRONMENT_BLOCKED | 0 | [25](baseline-attempt-01-unobserved/25.json) | NOT_GRADED |
| 26 | ENVIRONMENT_BLOCKED | 0 | [26](baseline-attempt-01-unobserved/26.json) | NOT_GRADED |
| authorized-handoff | ENVIRONMENT_BLOCKED | 0 | [authorized-handoff](baseline-attempt-01-unobserved/authorized-handoff.json) | NOT_GRADED |
| negative-intent | ENVIRONMENT_BLOCKED | 0 | [negative-intent](baseline-attempt-01-unobserved/negative-intent.json) | NOT_GRADED |
| route-mechanic | ENVIRONMENT_BLOCKED | 0 | [route-mechanic](baseline-attempt-01-unobserved/route-mechanic.json) | NOT_GRADED |
| route-source | ENVIRONMENT_BLOCKED | 0 | [route-source](baseline-attempt-01-unobserved/route-source.json) | NOT_GRADED |
| route-team | ENVIRONMENT_BLOCKED | 0 | [route-team](baseline-attempt-01-unobserved/route-team.json) | NOT_GRADED |

## Resume

`baseline-resume.json` lists exactly31 retry IDs and the four observed controls. Failed/incomplete attempts were moved into `baseline-attempt-01-unobserved/`, preserving all native events and action traces. The retry uses the same locked packet bytes and same model profile; no candidate instructions exist yet. The corrected adapter accepts plain terminal prose only as an answer, never dispatches prose as an action, and still rejects malformed JSON-looking payloads.

After quota reset, run the recorded retry IDs with `harness/run-replay.mjs baseline`; case15 must still perform real report creation and fresh second-round read before the baseline gate can pass. Complete assertion review against behavioral-case-matrix.md, then Phase2. Current case15 report does not exist; never overwrite a report left by any future attempt.

## Resume attempt 02 — 2026-09-08 02:00 Asia/Ho_Chi_Minh

Resumed the 31 recorded retry IDs with the existing runner and unchanged packets. The first case (`03`) returned `ENVIRONMENT_BLOCKED` after 2.2 seconds with zero dispatcher actions: `MODEL_FAILED: You've hit your session limit · resets 4:30am (Asia/Saigon)`. The runner exited 1 immediately; the other 30 IDs were not invoked. Native init reported `claude-opus-5`, `tools: []`, `mcp_servers: []`.

Preserved the complete failed capture at [attempt 02 / case03](baseline-attempt-02-unobserved/03.json), removing only its retry-slot copy from `baseline/` so the same resume command remains usable without overwrite. The four observed captures remain intact; all 31 retry IDs still need execution. No fallback, account change, candidate package or runtime edit was made. Baseline grading and Phase2/3 remain blocked by the complete-baseline gate.
