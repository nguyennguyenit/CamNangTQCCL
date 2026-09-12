# Local guard scope extension — 2026-09-08

Authorization: user replied “Tiếp tục” to the controller request to add a local test guard. This supersedes the original prohibition on adding a runner only for plan-local test infrastructure. Runtime, dependencies, global configuration/memory, publishing and Git remain out of scope.

## Outcome and acceptance

Build a plan-local, dependency-free test harness using an existing authenticated CLI. No native model tools or ambient instructions; agent actions go through a deny-by-default dispatcher. Immutable exact-path source snapshots are the only readable/searchable content. Each persistence branch may create one exact absent report via exclusive creation; all overwrites, alternate paths, shell/connector/delegation requests denied and logged before dispatch. Tests must exercise real harmless filesystem effects and their denials, not fake game sources.

Model emits actions and report bytes; dispatcher executes the create request and returns its actual result. Controller must never manufacture a behavioral answer or persistence report. CLI failures are environment results, not behavioral Red. Keep native discovery separate from instruction replay.

## Files and steps

1. Add `reports/harness/` modules for guard, tests and CLI loop; execution artifacts remain under plan reports. Persistence files remain new owned files under `plans/reports/`.
2. Write failing guard tests first; implement exact source-map reads/search, exclusive create, bounded action schema and attempt ledger; run the same tests green.
3. Verify actual tool-less CLI inventory, ambient instruction isolation and model-driven allowed/denied probes. Review before baseline.
4. Lock per-case prompts/context/source hashes from genuine dossiers; run baseline and candidate with identical access/inputs, changing candidate instructions only. No rubric or other-run outputs in model context.
5. Continue original Phase 2/3 only after the complete preflight and baseline gates pass.

## Boundaries and rollback

No API-key/provider fallback or new packages. Existing OAuth CLI only. No daemon; terminate owned subprocesses on timeout. Remove only task-created guard artifacts for rollback. New guard does not relax any original assertion or authorize fabricated Red/Green evidence.

Advisory review pending in `guard-design-advice.json`. Whole-plan gate remains active until probes pass.
