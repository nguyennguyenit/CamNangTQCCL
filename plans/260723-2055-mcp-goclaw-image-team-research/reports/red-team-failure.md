# Red-team review: failure modes and flow tracing

Scope: implementation plan only. Fixed decisions (TypeScript, CLI + stdio + stateless HTTP, structured observations only, eight already-prefixed tools, R2, frozen Python fallback, and Dewee staging gate) are treated as constraints.

## Findings

### 1. CRITICAL — The observation flow requires canonical merge and confirmation before the only component that can canonicalize

- **Plan location:** `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:21-30, 63-70, 115-120`; `phase-02-harden-domain-recommendation-and-provenance.md:28, 86`.
- **Repository evidence:** `js/roster-scan-map.js:4-9` derives canonical names and confidence by calling `matchDict`; `js/roster-scan-map.js:12-20` performs this mapping before producing roster items. `js/roster-scan-state.js:25-35` can only merge already-mapped names.
- **Failure trace:** `read_image` produces structured but not necessarily canonical text -> Phase 5 says merge by canonical ID and materially confirm it -> Phase 5 also says only confirmed structured data reaches MCP -> yet `tqccl_normalize_entities` is the planned dictionary-backed component that supplies candidates, margins, canonical IDs, and `reviewRequired`. GoClaw cannot correctly merge SP/base identities or know which ambiguity is material without either calling MCP first or duplicating the domain matcher in prompt text. The stated order can therefore bypass the accepted confirmation logic or deadlock before normalization.
- **Correction:** Freeze one executable sequence in the contracts and tests: per-image raw structured envelope -> `tqccl_get_data_version` -> `tqccl_normalize_entities` -> canonical evidence merge -> material confirmation/correction -> match/recommend handlers. Change “only confirmed data enters MCP” to “only structured observations enter MCP; only confirmed canonical state reaches recommendation.” Make the Phase 5 multi-image test invoke the real normalize/merge service from the array of per-image envelopes rather than starting from a precomputed aggregate.

### 2. CRITICAL — A stateless multi-call workflow can silently mix data releases

- **Plan location:** `phase-03-build-research-tools-data-loaders-and-cli.md:77-80`; `phase-04-add-stdio-and-streamable-http-transports.md:21, 33`; `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:70`; `phase-06-validate-secure-release-and-operations.md:27`.
- **Repository evidence:** the current browser loads the related artifacts as one coordinated set in `js/app.js:78-87`; tier records join teams by `teamId`, as shown in `data/team-tier.json:3-8`, while the referenced team ID is defined in `data/teams.json:3-16`.
- **Failure trace:** GoClaw reads version V1 -> normalizes and obtains candidates under V1 -> user confirms -> `current.json` switches to V2 -> the recommendation request independently loads V2 because HTTP is stateless and every handler loads its own snapshot. The V2 response can now claim V2 provenance for a decision confirmed against V1, or reject/reinterpret IDs changed between releases. Cursor version binding does not protect this non-cursor workflow.
- **Correction:** Put `expectedDataVersion` on every handler whose input depends on earlier normalization/detail/match output. The data source must load one snapshot, compare it with the expected version, and return a typed `DATA_VERSION_CHANGED` error before domain work. GoClaw must restart normalize -> review -> confirm on that error. Add CLI/stdio/HTTP tests that switch the pointer between normalize and recommend and assert fail-closed behavior.

### 3. HIGH — “Complete snapshot swap” does not prevent stale concurrent refreshes or guarantee pointer rollback visibility

- **Plan location:** `phase-03-build-research-tools-data-loaders-and-cli.md:35, 77, 102-113`; `phase-04-add-stdio-and-streamable-http-transports.md:47, 109, 130`; `phase-06-validate-secure-release-and-operations.md:111, 142-143`.
- **Repository evidence:** the platform research explicitly requires a cache “keyed by manifest version/ETag, bounded TTL” at `research/researcher-cloudflare-mcp.md:27-29` and identifies warm-cache staleness as a failure mode at `research/researcher-cloudflare-mcp.md:224-226`; the phase plan never assigns a TTL, refresh serialization, or commit rule to a symbol.
- **Failure trace:** refresh A reads pointer V1 and stalls -> pointer changes and refresh B activates V2 -> A completes later and atomically swaps the complete but stale V1 snapshot back into the cache. Separately, an isolate with no defined refresh deadline can continue serving V2 after operators repoint to V1 during rollback. Both snapshots are individually valid, so the proposed corruption tests do not catch either failure.
- **Correction:** Add an explicit `SnapshotCachePolicy` and refresh state machine to `data-source.ts`: bounded max age, single-flight refresh, pointer version/ETag captured before load, and compare-and-swap only if the pointer is still the loaded target. Provide a force-refresh path for the live verifier. Test controlled interleavings V1-slow/V2-fast and pointer sequence V1 -> V2 -> V1 under concurrent requests, asserting that cache state follows the current pointer within the declared bound.

### 4. CRITICAL — The “immutable” publisher may overwrite the release currently referenced by `current.json`, and the rollout exposes data before compatible code

- **Plan location:** `phase-06-validate-secure-release-and-operations.md:27, 40-47, 76-80, 90-94, 137-146`; `phase-03-build-research-tools-data-loaders-and-cli.md:188`.
- **Repository evidence:** the accepted object layout makes `current.json` point to `releases/<data-version>/manifest.json` at `research/researcher-cloudflare-mcp.md:178-187`. R2 publication is new—there is no existing repository guard that makes those keys immutable—and current artifacts demonstrably evolve independently (`data/teams.json:3-16`, `data/team-tier.json:3-8`).
- **Failure trace:** rerunning publication with a reused/colliding version can overwrite `releases/V/*` while `current.json` already points at V. Readers immediately see missing/hash-mismatched/mixed bytes before any pointer write, so “pointer last” does not protect the active release. In addition, the planned order switches data before deploying the Worker; a future schema change can make the still-live old Worker fail during the interval.
- **Correction:** Derive the release ID from a canonical manifest of the six exact bytes. Create each versioned key with an absence precondition; if it exists, accept only byte-for-byte/hash-identical content and never overwrite. Test collision/mismatch while that version is current. For ongoing releases, deploy a Worker proven compatible with both old and new snapshot contracts first, publish/switch data second, verify, then retire old compatibility; otherwise require a current-Worker compatibility check before pointer switch.

### 5. HIGH — The deploy/publish prerequisite omits the inherited regressions the plan says must remain green

- **Plan location:** `phase-06-validate-secure-release-and-operations.md:29, 83, 119-123, 157-169`; whole-plan acceptance at `plan.md:56-61`.
- **Repository evidence:** the repository has no root `package.json`; the existing Vision Worker owns separate `test` and `typecheck` scripts in `worker/package.json:7-11`. Browser/domain regressions are separate Node tests, and the Python fallback is a separate script (`.agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py:61-76`).
- **Failure trace:** `publish-data-release` and deploy are required to refuse only when `mcp-worker`’s `npm run check` fails. The plan runs root JS, Python, and Vision Worker checks later as manual regression commands, but they are not constituents of the blocking `check`. A shared Phase 2 JS regression or broken frozen Python fallback can therefore coexist with a green publish/deploy prerequisite and violate the acceptance criteria.
- **Correction:** Add one repository-wide release gate invoked by both publish and deploy. It must run the `mcp-worker` gate plus root Node tests, Python discovery/fallback smoke, and `worker` tests/typecheck. Keep focused red-green tests first, but make the broad inherited gate a machine-enforced prerequisite—not a parallel/manual command after the fact. Add a test that a failing constituent prevents publisher/deployer invocation.

### 6. HIGH — GoClaw revoke and bearer rotation are listed as canaries but not defined as a recoverable state transition

- **Plan location:** `phase-05-integrate-goclaw-skill-and-multi-image-workflow.md:96, 132-141, 169-176`; `phase-06-validate-secure-release-and-operations.md:47, 110, 144, 178-180`.
- **Repository evidence:** researched GoClaw behavior says updating DB `api_key` evicts the pooled connection (`research/researcher-goclaw-dewee.md:41-42`), and grant filtering is checked both at discovery and execution (`research/researcher-goclaw-dewee.md:45-46`). The current skill directly promises recommendation behavior (`.agents/skills/tqccl-coexist-team-builder/SKILL.md:47-57`), so a half-completed control-plane transition becomes a user-visible outage.
- **Failure trace:** the implementation step lumps discovery, reconnect, revoke, rotation, and pool eviction together. It does not say when to re-grant after the negative revoke test, distinguish agent grant revocation from server disablement, or order Worker dual-token acceptance relative to the DB `api_key` update. Removing the old Worker token too early strands the pooled client; failing to re-grant leaves channel canaries testing only the skill’s outage response.
- **Correction:** Make the staging/runbook sequence explicit and idempotent: grant -> discover/call -> revoke -> poll until invisible and direct execution is denied -> re-grant -> discover/call; then deploy Worker old+new -> update encrypted DB `api_key` to new and observe pool eviction/reconnect -> verify call -> remove old Worker secret -> prove old rejected/new accepted. Record each server ID, agent ID, grant state, token fingerprint (never token), and expected tool list. Repeat server-disable and skill-revoke as separate rollback drills.

## Required flow coverage

- Observation -> normalization -> confirmation -> handler -> CLI/stdio/HTTP: Findings 1–2.
- Local/R2 snapshot parity, stateless requests, concurrency/cache: Findings 2–3.
- Publication pointer, immutability, deployment, rollback: Finding 4.
- TDD and blocking release order: Finding 5.
- GoClaw exact grants, revoke, reconnect, bearer rotation: Finding 6.
- Python remains frozen and Dewee remains gated; no finding recommends changing either decision.

Status: DONE_WITH_CONCERNS
Summary: Six evidenced plan defects can cause incorrect confirmation, mixed-version recommendations, stale rollback behavior, mutation of live R2 releases, release despite inherited regressions, or a non-recoverable GoClaw control-plane canary.
Concerns/Blockers: Findings 1, 2, and 4 should block implementation until the plan freezes the executable flow, version pinning contract, and immutable/compatible publication transaction. Findings 3, 5, and 6 should be corrected before transport/release work begins.
