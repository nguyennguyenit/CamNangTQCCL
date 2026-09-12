# Adversarial plan review — Security Adversary + Contract Verifier

Reviewed 2026-09-12 from `/Users/plateau/Project/CamNangTQCCL`. Scope is the plan and its current caller contracts; no implementation, test suite, build, lint, typecheck, crawl, or deployment was run. Read the plan index and all four phase files; used both research reports as pointers and verified the code directly. Concurrent season work remains outside ownership. Report paths and line numbers refer to the reviewed tree and can drift with that work.

Accepted decisions are preserved: six-group Vietnamese catalog, hidden catalog provider provenance, private evidence, meaningful SGSDeck field priority after identity review, unchanged old Vietnamese names/IDs, separate team score/source policy, and compatibility-only MCP. This review does not ask for Chinese review by the user or for a new product decision.

## Findings

### 1. High — Promotion/recovery lacks a physical filesystem boundary for its writable paths

- **Plan:** `phase-03-unified-lookup-interface.md:93-113`; Phase 2 rejects input aliases/symlinks at `phase-02-merge-and-vietnamese-content.md:170-172`, but that does not specify promotion destinations, transaction IDs, journal files, backup paths, or their parent directories.
- **Current evidence:** `src/lib/root-static-artifacts.ts:55-61,92-101` explicitly rejects symbolic links and checks resolved containment on the *reader* path. `mcp-worker/scripts/build-worker-assets.ts:195-215` also checks output containment before mutation. The existing Python promotion at `pipeline/build_sgsdeck_catalog.py:165-175` directly follows caller-supplied directory locations; it supplies no reusable recovery-path validation.
- **Concrete failure:** an existing `pipeline/lookup-output/transactions` or `data` parent is a symlink to another checkout. The new CLI can still use the exact four textual destination names and matching before hashes, yet write outside this checkout. Similarly, interpreting `recover --transaction ../...` or a journal `backupPath` as trusted filesystem input can escape the transaction directory. The public read guard notices only after the write, if it is called at all. This is a local mutation-safety boundary, not a claimed remote exploit.
- **Fix:** define a bounded transaction ID; derive the four destinations from an internal constant rather than journal strings; require real directories and regular non-symlink journal/backup/candidate files; resolve and confine all parents to the project/transaction root before writes or deletes. Reject duplicate/extra journal paths and verify each backup against `beforeHash` before restoration. Add traversal, symlink-parent, and tampered-backup recovery cases with an outside-WIP sentinel.

### 2. Medium — The old-writer guard misses the first activation's incomplete transaction

- **Plan:** `phase-03-unified-lookup-interface.md:107-115,144-145` writes the manifest last but guards `build_dict` using the active unified manifest alone.
- **Current evidence:** `pipeline/build_dict.py:118-125` enters `load_raw` immediately; `:95-108` may read cache or crawl; `:137-138` overwrites the same two dictionaries. It does not participate in the proposed promotion lock/journal today.
- **Concrete failure:** first activation crashes after replacing one dictionary and before creating `lookup-manifest.json`. A subsequent legacy dictionary build sees no manifest and passes the proposed guard. It can crawl and overwrite both dictionaries, after which the planned recovery rejects the third-party bytes and cannot restore automatically. This is precisely the first-activation crash interval the plan promises to recover.
- **Fix:** legacy writer must refuse when the unified manifest exists **or** a promotion lock/incomplete transaction exists, before cache/network/write. Under the shared writer protocol, it must also not start immediately before first activation and continue writing through it. Add the manifest-absent/prepared and manifest-absent/writing states to its behavioral Red cases; retain a genuine pre-unified fixture with no transaction markers.

### 3. Medium — Worker preflight must verify the bytes it actually packages

- **Plan:** `phase-03-unified-lookup-interface.md:53-58,118-120` says validate the bundle before selecting heroes/tactics and reject active transactions, but does not bind the selected byte buffers to that validation.
- **Current evidence:** `mcp-worker/scripts/build-worker-assets.ts:221-239` separately reads every artifact, then creates a fresh MCP manifest over those bytes. `:75-91` detects changes during an individual file read, not coherence across several reads. The before/after clean-source and identity checks at `:191-192,227-233` do not inspect the unified generation. `src/lib/root-static-artifacts.ts:104-108` similarly returns bytes from its own read, so any shared preflight must be bound to that exact read as well.
- **Concrete failure:** preflight validates generation A. A promotion/failed-promotion recovery occurs during the later artifact reads; the worker captures one dictionary from B and one from A. Recovery restores clean generation A before the final source check. Both files were regular and stable during their individual reads, Git state can again equal the initial state, and MCP schema validation accepts the dictionaries independently. The worker then assigns valid new MCP hashes to a combination never validated against `lookup-manifest.json`.
- **Fix:** capture the three payload byte buffers plus manifest under a single read protocol, validate that exact snapshot, and reuse its dictionary buffers for the worker entries and route response. If keeping separate reads, verify the final captured dictionary buffers against the pinned unified manifest and check transaction/manifest state across the whole capture. Add an interleaving promotion-and-rollback test; do not replace or weaken the clean-source guard.

### 4. Medium — Crash durability must include the directories containing renamed files

- **Plan:** `phase-03-unified-lookup-interface.md:103-113` promises a durable journal and crash recovery, but gives only `temp file + fsync + os.replace` for the payloads and leaves journal-state/backup ordering implicit.
- **Current evidence:** the prior `_promote` implementation at `pipeline/build_sgsdeck_catalog.py:165-181` only renames/removes paths. Its test at `tests/test_build_sgsdeck_catalog.py:208-242` injects caught rename and cleanup errors; it contains no durability ordering contract to inherit.
- **Concrete failure:** the temp file's contents are flushed and renamed, then the transaction is recorded committed without flushing the directory entries for data/backup/journal. A machine interruption can leave a committed journal with a missing or old renamed entry, or an unpersisted backup name. Hash validation can detect the damage, but detection alone does not deliver the promised usable previous generation.
- **Fix:** specify the durability sequence: flush backup contents and transaction directory before first destination mutation; flush each destination parent after replace/delete; atomically write and flush journal state plus its parent; mark committed only after payload and manifest directory entries are durable. Recovery uses the same sequence. Test the ordering with injected interruption points and explicitly distinguish simulated interruption coverage from an actual power-loss qualification.

### 5. Medium — The inherited dev privacy test proves absence, not protection of present private artifacts

- **Plan:** `phase-04-compatibility-and-handoff.md:68-70,104-107` requires direct private URL tests; Phase 3 reuses existing artifact/browser fixtures at `phase-03-unified-lookup-interface.md:135,151-152,155-160`.
- **Current evidence:** `tests-js/astro-dev-contract.test.mjs:81-90` copies only `src`, `js`, `css`, and `data` into its temporary project. Its private-path assertion at `:179-180` requests `/pipeline/build_json.py`, which was never copied there. `astro.config.mjs:3-6` has no project-specific dev private-file policy, and `src/pages/data/[file].json.ts:6-10` covers the allowlisted JSON route, not every dev-server file-serving endpoint.
- **Concrete failure:** adding `/pipeline/lookup-identity.json` or journal URL checks to the same fixture returns 404 because those files do not exist, so a green test would still not prove that a present ledger/baseline is protected. The plan could certify its dev confidentiality acceptance without exercising the sensitive payload at all. This finding does **not** assert a demonstrated running-server leak.
- **Fix:** create private fixture files with recognizable sentinel bytes under `pipeline/lookup-inputs`, `lookup-output/transactions`, identity/translations, and `data/sgsdeck`; assert they exist before issuing requests. Probe canonical private paths, `/@fs` forms, raw/module query variants, and traversal routes, checking response bodies never contain the sentinel. Add `astro.config.mjs` (or an explicit owning dev middleware module if that is what the live framework needs) to the conditional edit closure when a real failing request requires enforcement. Preserve exact public-byte requests as positive controls.

## Fact checker — 20 distinct current-code claims

Method: direct reads with `rg`/numbered source; a read-only JSON census for dictionary counts. No behavior tests were executed. VERIFIED means the **current-code statement**, not future feature delivery, is supported. No FAILED claims among this selected set; no UNVERIFIED claims among these 20.

### Phase 1 — 10 claims

| # | Plan claim location | Result and current evidence |
|---|---|---|
| 1 | `phase-01-start.md:23` — 112 heroes, 240 tactics, canonical `viet` | **VERIFIED** — read-only JSON census found 112/240 rows and 112/240 nonempty `viet`; dictionary `viet` inventory ends at `data/heroes-dict.json:3359` and `data/tactics.json:4579`. Canonical input is explicitly `record.get("viet")` at `pipeline/sgsdeck_identity.py:28-34`. |
| 2 | `phase-01-start.md:24` — Python slug from `viet`, duplicate reject, JSON id unused | **VERIFIED** — `pipeline/sgsdeck_identity.py:9-21,24-35`. No record `id` read in `canonical_corpus`. |
| 3 | `phase-01-start.md:25` — Python base/SP/CO/40Y and 無雙→CO | **VERIFIED** — `pipeline/sgsdeck_identity.py:38-46`. |
| 4 | `phase-01-start.md:26` — JS only SP/CO and removes trailing annotations | **VERIFIED** — `js/hero-identity.js:4-5,15-17,29-43`; parenthesized 40Y would be removed as annotation, rather than encoded in ID. |
| 5 | `phase-01-start.md:27` — MCP hero shared JS; tactic own slug | **VERIFIED** — `mcp-worker/src/data/entity-identity.ts:1-2,9-22`. |
| 6 | `phase-01-start.md:28` — enum includes other | **VERIFIED** — `mcp-worker/src/domain/contracts.ts:16-20,320-324`; proposed 40Y→other needs no enum addition. |
| 7 | `phase-01-start.md:29` — explicit dictionaries; no comparison to current inputHashes | **VERIFIED** — `pipeline/query_sgsdeck_catalog.py:305-314,339-346` passes explicit paths; `:33-53` validates the source manifest fields/catalog digests, not dictionary `inputHashes`. |
| 8 | `phase-01-start.md:30` — duplicate source reject but no reverse uniqueness | **VERIFIED** — `pipeline/sgsdeck_identity.py:83-96` keys only by source; `:104-123` resolves each independently and does not reserve target owners. |
| 9 | `phase-01-start.md:31` — cache miss can crawl; writer updates two arrays | **VERIFIED** — `pipeline/build_dict.py:95-108,124-138`. |
| 10 | `phase-01-start.md:34` — only named private data subtree is sgsdeck | **VERIFIED** — `src/lib/root-static-artifacts.ts:18,31-43`; means the public artifact-tree exception, not a proof that every possible dev URL is denied. |

### Phase 3 — 10 claims

| # | Plan claim location | Result and current evidence |
|---|---|---|
| 1 | `phase-03-unified-lookup-interface.md:20` — separate hero/tactic nav and sections | **VERIFIED** — `src/pages/index.astro:35-36,52-53`. |
| 2 | `phase-03-unified-lookup-interface.md:21` — whole-string hash whitelist and hashchange | **VERIFIED** — `js/app.js:47,58-69`. |
| 3 | `phase-03-unified-lookup-interface.md:22` — shared dictionaries in lookup/tracker/scan/roster | **VERIFIED** — `js/app.js:77-83,89,95-97,108-109`; tracker consumes heroes only. |
| 4 | `phase-03-unified-lookup-interface.md:23` — load catch renders in Team PK | **VERIFIED** — `js/app.js:110-112`. |
| 5 | `phase-03-unified-lookup-interface.md:24` — hero tactic relationship resolves by Chinese | **VERIFIED** — `js/hero-detail.js:22-36`; Map uses Chinese names and does not read canonical ID. |
| 6 | `phase-03-unified-lookup-interface.md:25` — stat fallback swallows zero | **VERIFIED** — `js/hero-detail.js:39-44` swallows numeric `0`. Legacy string `"0"` is truthy and survives; tests should preserve that distinction. |
| 7 | `phase-03-unified-lookup-interface.md:26` — raw Chinese effect/title can render | **VERIFIED** — `js/hero-detail.js:33,57-68`; `js/tactics.js:10-16,26-28,36-42` also emits Chinese text even alongside Vietnamese. |
| 8 | `phase-03-unified-lookup-interface.md:27` — CJK matches chinese only; default limit 60 | **VERIFIED** — `js/match-dict.js:59-70,144-155`. Limit 60 applies to nonempty search; empty search returns all records at `:146`. |
| 9 | `phase-03-unified-lookup-interface.md:28` — exact root allowlist | **VERIFIED** — `src/lib/public-artifact-manifest.mjs:17-57,59-88`; `src/lib/root-static-artifacts.ts:63-70`. Live season entries must be retained. |
| 10 | `phase-03-unified-lookup-interface.md:29` — private subtree and symlink/root guards exist | **VERIFIED** — `src/lib/root-static-artifacts.ts:34-42,92-101`; guards are read/tree checks, not implicit safety for the planned Python writer. |

## Relevant caller contracts

| Boundary / caller | Contract to retain or close |
|---|---|
| Source validator → canonical corpus | `pipeline/query_sgsdeck_catalog.py:305-314,339-346` accepts explicit baseline paths; `pipeline/sgsdeck_identity.py:24-35,49-78` requires namespace/owner/name/variant consistency. Unified review is separate from immutable source mapping. |
| Shared hero helpers → scan and recommendation | `js/analyze-map.js:6,78,116`, `js/roster-scan-map.js:3,48-52`, `js/team-recommend-engine.js:2,38,97` depend on canonical IDs and normalized alternatives/families, not the newly added JSON `id`. Preserve existing slot alternatives and variant distinctions. |
| Shared matcher → UI/scan/MCP | `js/hero-list.js:121` explicitly asks for a full hero result limit; `js/tactics.js:82` uses the default; `js/analyze-map.js:60`, `js/roster-scan-map.js:22`, `mcp-worker/src/domain/legacy-domain-adapter.ts:437-449` call the same matcher/search. Maintain confidence, ambiguity, reviewRequired, and existing caller option semantics. |
| App → dictionary consumers | `js/app.js:77-109` owns the one data load and passes dictionary objects to lookup, tracker, scan, roster and Team PK faction derivation. New failure boundaries must not substitute unverified arrays. |
| Hero detail → DOM builder | `js/hero-detail.js:22-36,73-96` currently returns flat tactic descriptors and DOM; new ID-first relation/profile rendering must not accidentally retain raw-Chinese title/effect fallback. `js/render.js:4-15` escapes child text by text-node creation, but sets supplied attributes verbatim. Preserve text-node rendering and the plan's vetted asset URL policy; no demonstrated HTML-injection finding here. |
| Astro routes → async artifact reader | `src/pages/data/[file].json.ts:6-10`, `src/pages/js/[file].js.ts:6-10`, `src/pages/css/[file].css.ts:6-10` call async `staticPathsFor`/`readPublicArtifact`. Return exact verified bytes and existing MIME types. Public allowlisting is distinct from dev raw-file request handling. |
| Worker builder → artifact snapshot | `mcp-worker/scripts/build-worker-assets.ts:188-245` owns source-root validation, byte capture, clean-source checks, and manifest generation. Unified catalogs are permitted website inputs only; emit the active MCP artifact set without adding tools/kinds. Verify the actual byte buffers as described in finding 3. |
| MCP dictionary parser/index → identity | `mcp-worker/src/data/artifact-contracts.ts:205-209,254-270` needs nonempty `viet` and rejects duplicate derived IDs. `mcp-worker/src/data/snapshot-index.ts:102-124` derives IDs from displayName and indexes `chinese`, `hanViet`, and `aliases`; new top-level ID or another alias field is not automatically consumed. |
| Dist verifier → emitted files | `scripts/verify-astro-dist.mjs:36-60,74-88` checks exact paths/bytes and private segments. Keep this closure and add coherent generation validation; copying private sentinel files into the dev fixture must never make them public artifacts. |
| Legacy writer → promotion/recovery | `pipeline/build_dict.py:118-138` remains a direct owner of both root dictionaries until explicitly guarded. Manifest-last activation means lock/journal must participate in its guard, not just manifest existence. |

## Limits and non-findings

- No remote endpoint, paid operation, credential flow, or deployment is added by this plan. Findings concern local artifact integrity/confidentiality and proposed recovery contracts.
- No claim that hashing authenticates malicious input: the accepted offline review/fingerprint workflow is the trust boundary; payload digests establish coherence. There is no need to introduce signing solely for this task.
- Explicit DTO whitelists, reviewed Vietnamese prose, text-safe DOM, validated canonical-ID hash routes, and the private provider ledger address the relevant HTML/provenance concerns as written. No concrete HTML execution bug was found to justify an additional finding.
- Access to the installed dev-server dependency source was blocked by the environment's PreToolUse ignore policy. No bypass or configuration change was attempted. The report therefore does not label any `/@fs` exposure as verified; finding 5 is supported by the fixture omission visible in project code.
- Memory was used only to locate/preserve the curated-data and source-policy context (`MEMORY.md:797-801,815`); current claims above were independently read in this turn.

Status: DONE_WITH_CONCERNS
Summary: Verified 20 current-code claims and enumerated caller contracts; identified five concrete plan gaps around filesystem boundaries, first-activation guarding, exact packaged bytes, crash durability, and present-file privacy tests.
Concerns/Blockers: No product clarification needed. Implementation should close these contracts before claiming the recovery/private-artifact acceptance gates. No tests/build were run.

## Controller revision verification — 2026-09-12

Re-read the complete revised Phase 3. All five findings are **resolved in the plan contract**; this does not establish implemented behavior or passing tests. The original findings above remain the historical review record, with their original line references.

| Finding | Resolution in revised `phase-03-unified-lookup-interface.md` | Status |
|---|---|---|
| 1 — Physical filesystem boundary | `:138-143` bounds transaction IDs, derives owned destinations, checks real parents/containment and regular journal/backup files, verifies backup hashes, and requires traversal/symlink/tamper tests with an outside sentinel. | RESOLVED IN PLAN |
| 2 — First-activation legacy writer | `:191-195` checks manifest/sidecars/lock/incomplete journals before cache/network and acquires the shared lock with a second activation check immediately before writes. Both interrupted first activation and a legacy build resuming after promotion receive explicit failure cases. | RESOLVED IN PLAN |
| 3 — Validate exact packaged bytes | `:36-41,57-73` returns/reuses the verified raw buffers, brackets manifest/transaction observations, forbids reopening files/stringifying after validation, and adds interleaving cases for Astro, worker, and filesystem MCP ingress. | RESOLVED IN PLAN |
| 4 — Directory durability | `:123-128` explicitly flushes backups, transaction/data/journal directories and state transitions in order; recovery/delete use the same ordering. `:242-243` distinguishes injected interruption tests from actual power-loss qualification. | RESOLVED IN PLAN |
| 5 — Present-private-file privacy fixtures | `:181-182,226,238-241` includes conditional `astro.config.mjs` ownership, existing-on-disk private sentinels, direct `/@fs`/raw/module/traversal probes, and public byte-exact positive controls. No empirical leak is claimed. | RESOLVED IN PLAN |

Status: DONE
Summary: Rechecked all five security revisions; each original finding is addressed by a concrete implementation contract and validation case in Phase 3.
Concerns/Blockers: No unresolved security-plan finding from this review. Execution still owes the documented behavioral tests; none were run here.
