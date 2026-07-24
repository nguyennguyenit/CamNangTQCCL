# Red-team audit: assumptions and scope

Scope: implementation plan only. Fixed architectural decisions were treated as binding.

## Findings

### 1. HIGH — “Node 20” does not guarantee that the legacy browser modules can be imported

- **Plan location:** `phase-01-contracts-and-characterization.md:59,95,128-133`
- **Evidence:** The repository has no root `package.json`; the new `mcp-worker/package.json` does not set the module type for sibling files under `../js/`. The first legacy dependency uses ESM syntax at `js/match-dict.js:8`, and its transitive dependency does likewise. Empirical check: `npx --yes node@20.9.0 --input-type=module -e "await import('./js/match-dict.js')"` fails with `SyntaxError: Cannot use import statement outside a module`, while the installed Node 24 succeeds.
- **Impact:** Phase 1 can pass on the developer's current Node but fail on another valid Node 20 runtime or CI image, invalidating the promised Node 20 baseline and blocking CLI/stdio.
- **Minimal correction:** Pin and test an exact minimum Node version that enables syntax detection (rather than claiming all Node 20), or add an explicit module boundary that covers `js/*.js`. Add that exact runtime to `engines` and the clean-checkout gate.

### 2. HIGH — Observation merge and confirmation logic has two owners

- **Plan location:** `phase-02-harden-domain-recommendation-and-provenance.md:68-71,86,131-146`; `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:21,27,42,63-70,117-135`
- **Evidence:** Phase 2 assigns aggregation, `requiresConfirmation`, corrections, and recommendation gating to `normalization-service.ts`. Phase 5 separately requires the GoClaw skill/reference to merge observations deterministically, resolve winning values, retain conflicts, and implement the confirmation algorithm before calling MCP. The current skill already contains business ordering and conflict rules at `.agents/skills/tqccl-coexist-team-builder/SKILL.md:8-18,47-57`, showing that prose rules are executable behavior, not merely documentation.
- **Impact:** The same screenshot set can be normalized differently by the agent prompt and the TypeScript service. Fixes to SP/CO identity, recency, confidence margins, or conflict materiality must be duplicated, undermining the promised single deterministic core and semantic parity.
- **Minimal correction:** Keep GoClaw responsible for per-image extraction and user interaction, but make `tqccl_normalize_entities` the sole merge/materiality authority. The skill should forward ordered structured envelopes, render the returned review request, and submit explicit corrections; it should not reimplement merge precedence.

### 3. HIGH — Versioned R2 keys are described as immutable but the publication contract does not prevent overwrite

- **Plan location:** `plan.md:19,40`; `phase-03-build-research-tools-data-loaders-and-cli.md:28,47,76`; `phase-06-validate-secure-release-and-operations.md:27,56-58,76-80,137-142,175`
- **Evidence:** The plan specifies upload order and post-upload hash verification, but no no-overwrite precondition for `releases/<version>/*` or its manifest. An R2 `put` stores a value at a key and can replace an existing object; the official Workers R2 API exposes conditional `put(..., { onlyIf })` specifically to make a failed precondition return `null`. Post-write verification cannot restore a release that was already overwritten.
- **Impact:** Re-running a publisher with a reused or incorrectly computed version can mutate a supposedly immutable rollback target. `current.json` pointer-last protects activation atomicity, not release immutability or audit history.
- **Minimal correction:** Define the release ID as a digest of the exact manifest/artifact bytes and require create-only conditional writes for every versioned object and manifest. If a key exists, accept only byte/hash identity; otherwise abort before changing `current.json`. Add concurrent/repeated-publish tests.

### 4. HIGH — Browser compatibility is asserted without exercising the browser-facing integration paths

- **Plan location:** `plan.md:28,58`; `phase-02-harden-domain-recommendation-and-provenance.md:35,58-65,158-179`
- **Evidence:** Phase 2 changes every pure module used by the roster UI, including result shapes and recommendation semantics. The live UI imports these functions at `js/roster-recommend-ui.js:4-14`, maps scan output at `js/roster-recommend-ui.js:176-182`, and consumes `recommendTeams` at `js/roster-recommend-ui.js:225-250`. The proposed regression gate runs only Node unit tests, Python tests, and Worker tests (`phase-02...:160-169`); there is no browser/DOM smoke for this UI or `js/analyze.js`, which consumes `findSimilarTeams` at `js/analyze.js:7,130`.
- **Impact:** Additive exports can still break rendering, confirmation enablement, localStorage migration, or assumptions about `requiredHeroes`, `selectedTactics`, and mapper shapes while every listed gate remains green.
- **Minimal correction:** Add one focused browser-level contract/smoke covering scan mapping → persisted confirmation → recommendation rendering, plus image analysis → similar-team rendering, or explicitly narrow “browser-compatible” to tested pure-function contracts and retain exact legacy shapes with assertions.

### 5. MEDIUM — The final Markdown gate contradicts a required Phase 5 artifact

- **Plan location:** `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:54,124-135`; `phase-06-validate-secure-release-and-operations.md:148-155`
- **Evidence:** Phase 5 requires creating `.agents/skills/tqccl-coexist-team-builder/references/goclaw-multi-image-mcp-workflow.md`. Phase 6 then requires “No Markdown is added outside `docs/` or `plans/`.”
- **Impact:** A conforming Phase 5 implementation necessarily fails the Phase 6 acceptance check, so the plan cannot be completed as written.
- **Minimal correction:** Exempt the managed skill tree explicitly: no new Markdown outside `docs/`, `plans/`, and `.agents/skills/tqccl-coexist-team-builder/`.

### 6. MEDIUM — The Phase 1 diff gate is impossible in the acknowledged dirty worktree

- **Plan location:** `phase-01-contracts-and-characterization.md:118-124`; `phase-06-validate-secure-release-and-operations.md:35,135,208`
- **Evidence:** Phase 1 requires "`git diff` contains only new `mcp-worker/` Phase 1 files." The current worktree already contains many modified and untracked user files, and Phase 6 explicitly acknowledges that dirty user files must be preserved.
- **Impact:** The gate either fails for unrelated work or pressures implementation to hide/reset user changes, contrary to the preservation requirement.
- **Minimal correction:** Replace the global assertion with a path- and baseline-scoped review, such as inspecting `git diff -- mcp-worker` plus a recorded pre-implementation status snapshot; never require the whole worktree to be clean.

Status: DONE_WITH_CONCERNS
Summary: Six high-confidence plan defects were verified; three can block correctness or portability, one leaves browser regressions ungated, and two make acceptance checks internally impossible.
Concerns/Blockers: The plan should be corrected before implementation for the Node runtime boundary, single ownership of observation normalization, and enforceable R2 immutability.
