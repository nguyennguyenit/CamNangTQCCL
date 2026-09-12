# Red-team review — cross-boundary failure contracts

Date: 2026-09-12. Role: Failure Mode Analyst + Standard Fact Checker/Contract Verifier.
Scope: PLAN ONLY; full plan and four phases, controller-scout and research-consumers read, relevant current code traced. No runtime edits, tests, builds, deployment, or season-WIP changes. Findings describe missing execution contracts, not claims that the planned implementation already exists. Paths below are repository-relative. Current season code is live WIP and was inspected read-only.

Accepted scope remains all six Vietnamese groups, internal provenance, SGSDeck meaningful-field priority after reviewed identity, old IDs/names, MCP compatibility only, no new teams/scores/season selector.

## 1. High — CLI/stdio MCP bypass the planned generation gate entirely

**Plan:** `phase-03-unified-lookup-interface.md:53-58,118-120`; `phase-04-compatibility-and-handoff.md:49-51,71-78`.

**Actual caller evidence:** `mcp-worker/src/cli.ts:166-170` and `mcp-worker/src/stdio.ts:37-44` instantiate `FilesystemDataSource` directly against the data root. `mcp-worker/src/data/filesystem-data-source.ts:34-52` concurrently reads only `ARTIFACT_NAMES`, creates its own release manifest from whatever bytes were read, then validates that self-created manifest. It never traverses the worker asset builder or Astro loader. `mcp-worker/src/data/data-source.ts:54-67` caches the accepted snapshot for the process lifetime.

**Failure:** Start a local MCP call after promotion replaces heroes but before it replaces tactics/manifest, or after a crash at that point. Both arrays can remain individually valid. The filesystem source mints a valid new MCP releaseId for the mixed pair and can retain it in stdio indefinitely. Adding checks only to worker packaging cannot reject this input. This is not a request to expose four more catalogs in MCP.

**Fix:** Explicitly include the filesystem source and its CLI/stdio callers in Phase 3 ownership/tests. When loading an activated unified source root, validate the lookup manifest, all three payloads and incomplete-transaction state, then use the exact verified hero/tactic bytes to create the MCP snapshot. Define the pre-unified historical-fixture branch explicitly so v1 fixtures remain valid. If the helper becomes a runtime import here, update the actual runtime closure instead of retaining the build-only assertion. Add an interrupted-promotion local CLI/stdio case whose individually valid dictionaries must produce DATA_UNAVAILABLE, plus successful historical/unified cases.

## 2. High — legacy-writer guard has a first-activation race

**Plan:** `phase-03-unified-lookup-interface.md:98-109,144-145,173`.

**Actual writer evidence:** `pipeline/build_dict.py:118-133` calls `load_raw`, parses and links before any public write; `load_raw` can crawl (`:95-108`). The writes happen later and separately at `:137-138`, through truncating file opens (`:112-115`).

**Failure:** A legacy build starts while no unified manifest exists and passes the proposed entry guard. While it is crawling/processing, first activation successfully promotes four files. The already-running legacy build then overwrites the two new arrays, leaving the accepted manifest/catalog behind. The promotion lock only serializes promotion; the plan does not require the legacy writer to participate or recheck at its write boundary. A manifest check before network protects a new invocation after activation, but cannot protect this in-flight invocation. Readers reject the broken result, yet the successful public generation has still been overwritten.

**Fix:** Keep the early no-network guard, and add a shared writer-exclusion contract: legacy writes acquire the same ownership lock and recheck unified activation plus active/incomplete journals immediately before writing. Promotion must not interleave those writes. A crawl need not hold the lock; after it finishes, the guarded write must abort if activation happened in the meantime. Add a deterministic interleaving test: legacy build passes initial guard → promote → resume legacy write → abort with all four promoted bytes unchanged. Coordinate this change within the already-owned `build_dict.py` path.

## 3. High — first-activation rollback promises a code checkpoint that the transaction does not record

**Plan:** `phase-03-unified-lookup-interface.md:93-116,138-140,149,193-194`; `phase-04-compatibility-and-handoff.md:176-178`.

**Actual coupling evidence:** `src/lib/root-static-artifacts.ts:63-70` requires an exact source/allowlist set. `src/lib/public-artifact-manifest.mjs:17-57` already contains current season-owned entries, including `season-context` and five season JSON files. `js/app.js:77-109` owns dictionary initialization and dependent sections; `src/pages/data/[file].json.ts:6-10` invokes the same manifest-based loader. Thus the loader/shell/allowlist edits are required for activation and cannot remain arbitrarily paired with the pre-unified data.

**Failure:** After first promotion, Phase 4 fails. The journal can restore old dictionaries and recorded absence of catalog/manifest, but its schema records only the four data files. It has no durable code checkpoint, code postimage hashes, or removal records for the three newly allowlisted JS modules. Leaving the new allowlist/loader in place produces missing-file/build/runtime errors; resetting whole shared files to an old Git version risks removing pre-existing or subsequent season edits. “Restore matching loader/manifest code checkpoint” is named but is not executable from the promised recovery record.

**Fix:** Before first activation, capture a separate explicit activation-code manifest covering exact owned paths, before/post hashes, byte backups or owned patch and recorded absences, based on current dirty preimages. Link it from the transaction. Revert only matching owned postimages and stop on third-party changes; preserve the season entries already present. Specify recovery ordering and the safe intermediate unavailable state. Extend rollback rehearsal to restore the old UI/allowlist/loader and remove only newly created owned files, not merely check four JSON preimages. Test a season-edit sentinel inside a shared file as well as an unrelated file.

## 4. High — rollback can remove identities that an independently promoted season configuration now requires

**Plan:** `plan.md:57-60`; `phase-03-unified-lookup-interface.md:98-116`; `phase-04-compatibility-and-handoff.md:104-105,176-178`.

**Actual dependency evidence:** `pipeline/build_season_data.py:232-240` loads current hero/tactic dictionaries and validates seasonal evidence/configurations against them. `pipeline/season_validation.py:86-91` rejects an evidence canonicalRef absent from those dictionaries; `:117-120,138-147` rejects absent hero/tactic slot refs. The seasonal publisher writes its separate files at `pipeline/build_season_data.py:241-245,253-275`; these files are outside the four lookup rollback paths.

**Failure:** Lookup generation G1 adds a reviewed entity. The season owner serially promotes a configuration/evidence row using that entity—so there is no simultaneous-file edit and all current checks pass. Phase 4 subsequently rejects G1 and restores G0. Four lookup paths have no third-party byte changes, so the proposed recovery allows it, but the untouched season files now contain dangling references. Serialization alone does not cover this dependency over time. The current plan permits configs once mapping is available, while generation acceptance is a later gate.

**Fix:** Define a cross-owner activation gate: seasonal data may consume new IDs only from a certified lookup generation, and record the required generation/identity set in the handoff. Before every later rollback, validate the currently published seasonal references against the intended previous dictionaries. If incompatible, stop before restoring any path and arrange the dependent season rollback with its owner, or fix forward; do not add season files to lookup's ownership. Include the sequential G1 → dependent season config → G0 rollback case. This preserves concurrent season work and does not block its baseline-only corpus.

## 5. Medium — a successful bundle preflight is not bound to the bytes subsequently served or packaged

**Plan:** `phase-03-unified-lookup-interface.md:36-45,53-58`.

**Actual split-read evidence:** Astro currently returns a fresh `readFile` result at `src/lib/root-static-artifacts.ts:104-107`. The worker validates its source root at `mcp-worker/scripts/build-worker-assets.ts:201`, then separately reads `ARTIFACT_NAMES` at `:221-225` and builds a release from those later reads at `:235-254`. Its per-file stat guard at `:75-93` detects mutation during one read, not a generation switch between different reads. The current source clean checks at `:227-234` do not turn a newly added bundle-preflight function into an immutable byte snapshot.

**Failure:** An implementation can follow “validate bundle before selecting heroes/tactics” by adding a preflight and then leaving these existing reads intact. A replacement between validation and use makes the emitted/served bytes different from the verified bytes. Root manifest/journal checks must bracket the actual returned bytes; bracketing only the extra preflight read is insufficient. The plan currently specifies a validator returning parsed objects, not a verified raw-byte handle for these existing raw-byte consumers.

**Fix:** Require root routes and worker packaging to consume the exact buffers from one bounded verified read, with manifest/journal observations enclosing that read. The route response must return the verified file buffer and the MCP entries must reuse verified hero/tactic buffers; do not reopen those files after preflight. Alternatively specify a final verification over the actual buffers to be emitted with the same generation/journal observations. Add an interleaving case between preflight and the original read sites. Do not rely on stringify to reconstruct hashed bytes.

## Confirmed non-findings

- No demand for crash-atomic multi-file publication: the plan already explicitly promises fail-closed readers plus recoverable promotion.
- Source `inputHashes` do not themselves imply source validation must fail against merged dictionaries; existing explicit frozen dictionary overrides cover original references.
- Website-only supplemental files do not require new MCP artifact kinds or tools. The issue is validating the shared arrays at all source-entry boundaries.
- The current season builder/inventory implementation is changing. Findings above do not request modifying its files in this review or overwriting its WIP.
- No runtime tests or release checks were run; verification here consists of full plan reads and direct source/caller inspection.

Status: DONE_WITH_CONCERNS
Summary: Five actionable cross-boundary plan findings: filesystem MCP coherence, legacy-writer race, executable code rollback, seasonal dependency rollback, and verified-byte consumption.
Concerns/Blockers: These execution contracts should be closed before first public promotion. No unresolved product questions.

## Follow-up review — Phase 3 contract corrections

Re-read only the revised `phase-03-unified-lookup-interface.md`, as requested. All five findings are substantively resolved **at plan level**:

| Finding | Revised Phase 3 evidence | Disposition |
|---|---|---|
| Filesystem MCP bypass | Lines 46–48, 63–72, 177–178, 223 add the actual runtime ingress, closure ownership, fail-closed activation markers, verified buffers and CLI/stdio cases. Legacy roots without activation evidence explicitly retain the historical branch. Cached process snapshots and restart behavior are now explicit. | Closed |
| Legacy-writer race | Lines 190–194 require both the early guard and the same write lock with a final activation recheck; the exact promotion interleaving is a required case. | Closed |
| Missing activation-code rollback | Lines 117–120, 144–153 bind a code manifest to the transaction, record before/post images and absences, preflight all paths, preserve existing season WIP and stop before mutation on subsequent shared-file edits. Recovery ordering and complete-tree validation are explicit. | Closed |
| Seasonal dependency rollback | Lines 134–135 and 155–158 restrict new-ID publication to certified generations and reject an orphan-producing rollback before mutation, with coordinated dependency rollback or fix-forward. No ownership of season files is assumed. | Closed |
| Preflight/use byte mismatch | Lines 36–41 and 68–72 require raw verified buffers to be consumed directly and an interleaving case at Astro/worker/MCP boundaries. | Closed |

The known command typo at line 232 (`test/stdio.integration.test.ts`) is assigned to the controller for correction to `test/transport/stdio.integration.test.ts`; it does not change the substantive resolution above. Propagation into Phases 1/2/4 and the index is controller-owned and was not reviewed in this follow-up. No tests, builds, or runtime changes were performed; this is not implementation/Green evidence.

Status: DONE
Summary: All five failure-contract findings are closed in the revised Phase 3 design.
Concerns/Blockers: No remaining blocker in this bounded re-review; execution evidence remains pending by design.
