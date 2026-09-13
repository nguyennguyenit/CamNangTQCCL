# Harness preflight — 2026-09-08

> Current v2 status (2026-09-13): preflight đạt theo `empirical-preflight-v2-attempt-03.json`; execution profile và 7 hash khóa ở `baseline-v2-experiment.json`; harness 18/18; baseline integrity/closure ở `phase-01-closure-evidence.md`. Các kết luận blocked bên dưới là lịch sử pre-v2, không phải trạng thái hiện hành.

**Result: ENVIRONMENT_BLOCKED.** Metadata inspection completed; no existing configuration has been demonstrated to satisfy all required enforcement, visibility and attempted-action gates. Baseline and Phase 2 must remain unstarted. This is a bounded finding about the inspected environment and evidence, not a claim that these CLIs can never support the contract.

## Scope and evidence

Environment: macOS, zsh, Asia/Ho_Chi_Minh; working directory `/Users/plateau/Project/CamNangTQCCL`. Evaluator session has `danger-full-access`, approval policy `never`. This evaluator is not a behavioral baseline agent: it has read the plan and audit and must not be reused as an uncontaminated case session.

Read before writing: `plan.md`, `phase-01-start.md`, `reports/audit-260908-0038-project-research-skill.md`. The target report did not previously exist. Only this report is created by the preflight task. No model CLI invocation, filesystem permission probe, connector action, installation, runner creation, configuration change or API fallback was executed.

Exact capability inspection commands, run from the working directory above:

```sh
codex --version
codex exec --help
codex sandbox --help
claude --version
claude --help
claude --help | rg -A 12 -- '--restricted|--safe-mode|--tools |--strict-mcp-config|--settings |--setting-sources'
```

All six commands exited 0. Observed versions: **codex-cli 0.153.4**, **Claude Code 2.1.263**. Source is installed CLI help, not remembered or remote documentation. Help/version calls do not constitute permission-enforcement passes. No secrets or global configuration contents were read.

Runtime tool metadata was inspected through the supplied `collaboration`/`functions` declarations and `ALL_TOOLS` name/description entries. Relevant CloudHarness declarations were read directly from `ALL_TOOLS`; their servers were not invoked.

## Observed candidate capabilities

| Surface | Observed metadata | What remains unproved |
| --- | --- | --- |
| Current collaboration | `spawn_agent` accepts task, model, context and role options; no sandbox policy, read roots, write allowlist or tool-set arguments | A new persona/context cannot be treated as an enforced restricted worker; no denied-action trace contract was demonstrated |
| Current execution tools | `exec_command` exposes shell execution; `apply_patch` edits files; current environment explicitly has no filesystem sandbox | Instructions limiting an agent to reports are not pre-dispatch enforcement |
| Codex CLI | `--sandbox` choices are `read-only`, `workspace-write`, `danger-full-access`; help explicitly scopes this selection to model-generated shell commands. `-C`, `--add-dir`, `--ignore-user-config`, `--json`, `--ephemeral` are present | Shell sandbox metadata does not demonstrate connector/delegation restrictions, exclusion of grading files from read/search, or create-only access to one report. Working directory and writable-directory options are not proof of read isolation |
| Claude CLI | `--restricted` removes command/code tools and WebFetch unless explicitly named with `--tools`, ignores user/project/local settings, confines file tools to working directories including `--add-dir`, and refuses bypassPermissions. Managed settings and explicit settings still apply | Directory confinement is promising for isolated inputs, but no such isolated configuration was selected or exercised here; it does not alone distinguish creating a file from overwriting it |
| Codex command sandbox | `codex sandbox` accepts command arguments directly under seatbelt; exposes `--sandbox-state-json`, repeatable `--sandbox-state-readable-root`, `--sandbox-state-disable-network`, named permission profiles, and `--log-denials` using macOS log stream | Promising read-boundary and denial-observation capabilities. The full sandbox-state contract and an existing applicable profile were not demonstrated; help does not prove single-file create-only access or coverage of remote connectors/delegation |
| Claude tool/context configuration | `--tools` selects available built-ins; `--strict-mcp-config` restricts MCP to explicit config; `--safe-mode` disables customizations including CLAUDE.md, skills, plugins, hooks, MCP and custom agents. `--permission-prompts none` denies operations that would prompt; permission mode still controls other decisions | Combination, actual loaded context/tool inventory, exact path enforcement and denial logging need verification. Disabling all tools cannot satisfy research and agent-written persistence. `--bare` help says OAuth/keychain are never read, so it is not an assumed OAuth-compatible fallback |
| Claude output | `--output-format stream-json`, `--include-hook-events`, `--debug-file` are present | Output flags alone do not establish complete records of denied writes, denied reads or delegation attempts |
| CloudHarness metadata | `sessions_open` takes only `cwd?`, `idempotencyKey`, `name`, `workspaceId`. `files_write` takes `content`, `expectedSha256?`, `path`, `workspaceId` and describes atomic create **or replace**. `grep_search` has optional caller-chosen `path` and `glob`. `workspace_open` offers network mode and repository/ref selection | Optional hash/path parameters are not a mandatory agent permission boundary. No single-file exclusive-create policy, scoring-artifact exclusion or attempt ledger is demonstrated by these schemas. No remote workspace was opened |
| Other exposed surfaces | CUA/browser automation, resource access, web tools, GitHub mutation tools and Sites mutation/deployment tools are exposed in the evaluator runtime | Their presence is not evidence of successful access, but they must be removed or governed in any chosen baseline tool inventory; shell-only policy cannot be presumed to cover them |

No configuration was actually used for a behavioral run. The CLI flags above are candidates observed in help, not a recommended or verified launch command.

## Required empirical probes and status

| Gate | Status | Missing evidence |
| --- | --- | --- |
| Read allowed task-owned input | NOT_RUN | Read through chosen test-agent capability with captured result |
| Deny reading grading artifacts | NOT_RUN | Direct read and alternate-path read denied before disclosure |
| Deny search leakage | NOT_RUN | Search/list mechanisms cannot reveal rubric, reviewer notes, results, other outputs or cross-branch case15 reports |
| Deny writes outside allowlist | NOT_RUN | Harmless task-owned forbidden target tested across all available mutation paths, with no effect and attempt recorded |
| Case15 create new allowed report | NOT_RUN | Agent itself creates the single allowed absent path; controller does not substitute for agent persistence |
| Case15 overwrite denied | NOT_RUN | Same path, now existing, cannot be changed by any available tool; original bytes preserved and denial recorded |
| Deny broader connector/delegation effects | NOT_RUN | Complete actual tool inventory and policy/omission evidence, with relevant attempts observable |
| Attempted-action trace | NOT_RUN | Raw request, target, decision and outcome for denied and allowed actions; blocking alone must not score as compliance |
| Context/lineage isolation | NOT_RUN | Per-case input paths/hashes and actual loaded instructions; case15 second round exposes only its own first-round report |

These are environment prerequisites, not behavioral FAIL or Red results. No assertion is marked PASS. No compliant configuration was identified for executing the probes; this delegated diagnostic assignment was limited by the controller to report-only inspection. The user-approved plan already includes harmless preflight probes: missing user permission is not the blocker. Existing WIP was not used as a forbidden write target.

## Trace locations and limitations

This task's tool transcript contains the read commands, help/version outputs and metadata inspection calls. Command output identifiers: `d42ce6` (Codex version), `ca4ba1` (Codex exec help), `d70f10` (Claude version), `e22bb0` (Claude help), `ff3e66` (focused Claude help). The combined metadata output initially exceeded the response budget; focused help and exact CloudHarness declarations were subsequently inspected. This report retains the relevant observations rather than claiming the truncated output was fully reviewed.

There is no model-run trace file, denied-action ledger or preflight probe output. The command transcript demonstrates inspection only. Writing this report under controller-granted scope does not test a create-only guard.

Additional local help trace: `f30204` (`codex sandbox --help`, exit 0). Controller separately reported `codex sandbox macos --help` exited 71 with `sandbox-exec: execvp() of 'macos' failed: No such file or directory`. The installed syntax takes a command directly, so that failed command is a syntax diagnostic, not an enforcement probe or evidence that the sandbox cannot work.

## Follow-up needed to clear the gate

1. Select an existing harness configuration with an enforceable complete tool inventory. Establish how every mutation path is denied or scoped and how file creation is allowed only when the exact owned report does not exist. Do not silently build a new runner or change global configuration to fill this gap.
2. Establish an isolated visible input set and loaded-instruction manifest excluding plan/rubric/review/output artifacts, with per-case hashes and case15 branch lineage. Historical source dossiers and genuine corrections remain valid inputs.
3. Run the permission probes above only on harmless task-owned files in an appropriately scoped follow-up. Capture attempted actions before dispatch and resulting denials/effects, including overwrite attempts, read/search leakage and delegation.
4. Record the exact successful configuration and empirical evidence here before baseline. If a required boundary remains unavailable, keep ENVIRONMENT_BLOCKED and do not create the Phase 2 package.

Unresolved question: which existing enforceable harness/configuration can satisfy all gates, especially case15 exclusive creation and read/search isolation? No product/design decision needs reopening.


## Authorized local guard — empirical update 2026-09-08

User authorized plan-local guard after the initial blocked report. See local-guard-scope.md. Guard uses in-memory source content keyed by virtual names; those names are never opened as filesystem paths. CLI subprocesses run with safe-mode, zero native tools and zero MCP servers; actor-selected dispatcher actions are the only effect channel. CLI still advertises built-in agent/command metadata; absence of tools prevents loading/dispatching those entries.

Evidence: `empirical-preflight.json` reports PASS for the harmless native/dispatcher probe. Native init has tools=[] and mcp_servers=[]; task-owned ambient CLAUDE.md and grading.txt random canaries were not disclosed. The model requested an actual create_report (model-authored bytes written), then overwrite and alternate-path writes were denied. Read/search of hidden source and shell/delegation attempts were denied and traced. `guard-tests-after.tap`: 13/13 unit tests, including snapshot immutability, literal-only search, symlink/alternate path rejection, exclusive create, branch isolation and packet parity mismatch. This is guard evidence, NOT 26-case behavioral Green.

`guard-tests-before.tap` was a missing-module structural failure. First implementation had 10/11 passes: valid macOS temporary paths included system /var symlink; positive test setup now resolves the actual temporary root, while separate malicious-symlink tests remain unchanged. Do not label the setup fix as a research behavior Red.

Model adapter uses existing subscription authentication; provider/API overrides removed without reading credentials. Fable call returned a usage-credit requirement and was stopped. Kongming protocol advisory used default OAuth model instead, disclosed in `guard-design-advice-default.json`; conditional GO to build, gates retained. Collaboration and AK Codex adapter dispatches failed unsupported-model errors. An initial broad local code-review call timed out at240 seconds; its subprocess was terminated. Focused replacement review pending.

Proven metadata is supplemented by actual canary/action probes. Native language/environment/account metadata exists; account email in the two probe artifacts was redacted for privacy, without changing permission outcomes. No global files were read into test source maps. Policy source: installed CLI help, also https://code.claude.com/docs/en/cli-usage and https://code.claude.com/docs/en/headless.

35 prompt/context/source packets (26 original + required subcases) captured under packets/; `input-packet-manifest.json` locks exact bytes. Candidate runner checks packet hash and parity against baseline; only instruction blob differs. Case15 second-round source differs by explicitly permitted same-branch generated report lineage. Original baseline/discovery/live gates remain uncompleted.
