# Node 24.20.0 review

Date: 2026-09-09
Status: DONE_WITH_CONCERNS

## Verdict

No blocking defects found in the scoped runtime change. Static scope and consistency checks pass. Broad compatibility acceptance remains dependent on the independent tester's results; this review does not claim those suites passed.

## Scope and spec compliance

Reviewed the accepted plan, `.node-version`, root and MCP package manifests/locks, README runtime prerequisite, deployment-guide runtime requirements, existing exact-pin smoke, setup-node workflows, the generated MCP workflow build ID and its generator/manifest, and the new fish runtime selector. The pre-existing README research link and unrelated Khai hoang code/data/docs WIP were excluded from the change assessment.

| Requirement | Evidence | Result |
|---|---|---|
| Exact runtime 24.20.0 | Root `.node-version`; explicit installed binary | PASS |
| Bounded engines and lock agreement | Both packages and both lock roots contain `>=24.20.0 <25` | PASS |
| No dependency upgrades or manifest drift | Parsed JSON compared against HEAD after restoring only the old `engines.node`; all four objects equal | PASS |
| Shared CI pin | All three setup-node steps use `node-version-file: .node-version`; MCP PR/push filters include that file | PASS |
| Current setup docs agree | README and deployment guide use 24.20.0; research-server docs defer to `.node-version`; current docs/workflows scan found no stale Node 22 setup instruction | PASS |
| New user shells select the runtime | `zsh -lic` and `fish -lc` both report Node 24.20.0 and npm 11.19.0 from nvm | PASS |
| Retain prior runtime | Installed version directory list includes v22.16.0, v24.14.0 and v24.20.0 | PASS |
| Existing smoke still enforces exact pin | Explicit 24.20.0 binary passes; inherited 24.14.0 shell fails the expected exact-pin assertion | PASS |
| No business/schema/API shape changes | Scoped diff is runtime metadata, two current documentation prerequisites/build examples and required generated build identity | PASS |
| Generated workflow identity matches runtime inputs | Manifest includes `.node-version` and MCP package/lock; only `WORKFLOW_BUILD_ID` changed; generator freshness check passes on 24.20.0 | PASS |

Historical completed Khai hoang plan references to Node 22 describe their original verification environment. Retaining them preserves evidence and is consistent with the controller's clarified scope.

## Verification performed

- Explicit Node 24.20.0 ran `mcp-worker/test/node-min-smoke.mjs`, exit 0; this also exercised the compiled legacy adapter normalization.
- Independent parsed-JSON assertions checked the exact pin, engine ranges, and absence of other package/lock changes, exit 0.
- Scoped `git diff --check` passed.
- `npm --prefix mcp-worker run check:workflow-build` passed with Node 24.20.0 prepended to PATH after the controller regenerated the fingerprint.
- Shell selection checks confirmed both user shell entry points; their Node executable paths agree.

## Concerns and practical limits

1. The review tool's inherited noninteractive shell still resolves Node 24.14.0/npm 11.9.0. Interactive zsh and fish resolve the requested runtime correctly. Agents and existing terminal processes must explicitly select/prepend the installed 24.20.0 binary before validation; do not infer their runtime from the default nvm alias alone.
2. The new fish selector pins 24.20.0 directly. Future upgrades or rollback must update/remove that selector as well as changing the nvm default; changing the alias alone does not switch fish. This is acceptable for the explicit selected-version requirement.
3. Full frontend, MCP, Vision Worker, E2E and repository gate results belong to the independent tester. Runtime-major compatibility cannot be concluded from the narrow smoke alone.
4. zsh launched without a PTY reports a gitstatus/prompt initialization warning but continues and selects the correct runtime. No evidence links that existing prompt behavior to the runtime diff.
5. The build ID change will produce a different public `workflowVersion` when this build is deployed. Existing in-flight callers will use the existing `WORKFLOW_VERSION_CHANGED` recovery behavior. This follows the existing manifest and protocol; no handler or schema changes were introduced, and no deployment occurred. Unrelated `js/render.js` and Khai hoang data WIP are outside this fingerprint's inputs.

No npm configuration contents or secret values were inspected. No code changes were made by this review.
