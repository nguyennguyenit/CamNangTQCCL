# Red-team assumptions — unified lookup plan

Date: 2026-09-12. Lens: Assumption Destroyer + Standard Fact Checker/Contract Verifier. PLAN review only. Read `plan.md`, all four phase files in full, and both research reports as pointers, then checked actual repository code and snapshot JSON. No tests, lint, typecheck, build, implementation, source edits, dictionary edits, or network fetches were performed. Read-only Python inspection below counted existing JSON; it was not feature validation.

Accepted decisions remain unchanged: six Vietnamese website groups, hidden provider UI with internal provenance, meaningful SGSDeck field precedence after identity review, valid zero/false, preserved existing names/IDs, agent-owned Chinese review, and compatibility-only MCP. No additional teams, scores, season selector, MCP tools, or MCP kinds are proposed.

## Findings

### High — CLI/stdio can certify a mixed dictionary generation

- **Plan location:** `phase-03-unified-lookup-interface.md:43–58` protects browser/root readers and the worker asset builder; `phase-04-compatibility-and-handoff.md:42–52` claims the MCP consumer closure but omits its filesystem ingress.
- **Actual evidence:** `mcp-worker/src/data/filesystem-data-source.ts:34–52` reads all artifacts independently with `Promise.all`, creates a new manifest from those bytes, and validates against that newly created manifest. `mcp-worker/src/data/artifact-contracts.ts:337–359` hashes whichever inputs it receives; it has no knowledge of the intended lookup generation. Real callers are `mcp-worker/src/cli.ts:167–169` and `mcp-worker/src/stdio.ts:37–43`.
- **Failure:** a CLI invocation or newly started stdio process during the planned sequential promotion can read new heroes and old tactics. Both arrays can satisfy their individual schemas; creating a fresh MCP release hash then makes that mixed pair appear valid. Protecting the packaging builder does not protect this separate path.
- **Fix:** add `filesystem-data-source.ts` and its tests to the ownership/validation closure. At candidate load, detect lookup mode and validate the same raw lookup generation plus transaction state before constructing the MCP manifest. Preserve historical v1 roots with no lookup files; any partial lookup presence must reject, not silently choose legacy mode. Keep the already cached process snapshot immutable; do not introduce hot reload. Test actual legacy-root acceptance, partial activation rejection, and mixed-generation rejection.

### Medium — Event acquisition has an unplanned object branch with choice semantics

- **Plan location:** `phase-02-merge-and-vietnamese-content.md:60–64,107–126` projects `sources` to `acquiredFromVi:string[]`, exposes a separate `exchangeConditionVi`, and rejects invalid nonempty types, but does not specify the accepted `sources` union or how its nested condition relates to the sibling condition.
- **Actual evidence:** `data/sgsdeck/tactics.json:24–27` shows the list branch. `data/sgsdeck/tactics.json:8192–8203` shows the object branch for 三勢陣: sibling `exchangeCondition` ends with a six-name list and `× 4`; nested `sources.exchangeCondition` explicitly says `任選4張` (choose any four cards), alongside `sources.eventName`. Read-only corpus inspection found **283 arrays, 43 objects, and 67 nulls**. This is a substantial existing branch, not a hypothetical future schema.
- **Failure:** a list-only mapper rejects 43 valid records or loses event/choice conditions when flattening the object. Independently translating both condition fields without a semantic rule can also display an ambiguous six-name `×4` instruction alongside the precise any-four requirement. The blanket field-ledger requirement identifies coverage but does not choose the mapping.
- **Fix:** specify `sources = string[] | {eventName:string,exchangeCondition:string} | null`, with explicit projection and translation fingerprint paths for each branch. Preserve event name plus the any-N/each-N condition; reconcile duplicate sibling/nested condition representations by reviewed semantics. Add a real 三勢陣 golden requiring “chọn 4” and preserving the six alternatives, and a fixed-per-hero event golden. No new public schema is necessary if reviewed prose in the existing fields faithfully represents both.

### Medium — The stated immutable screenshot test input does not currently exist

- **Plan location:** `phase-04-compatibility-and-handoff.md:108–111` requires preserving immutable old screenshot fixture tests while updating current-artifact assertions.
- **Actual evidence:** `tests-js/tactics-data.test.mjs:7` loads current `data/tactics.json` once. The six screenshot cases are literal expected values at `:58–113`, but `:115–121` compares them with that same current artifact. They are not backed by a separate historical input. For example, the old 所向披靡 expected raw text is at `:65`; the current source has both an updated effect and an original revision at `data/sgsdeck/tactics.json:11296`.
- **Failure:** leaving this test unchanged asserts old bytes against intentionally changed current bytes. Rewriting its expected array erases the historical assertion the plan promises to retain. Merely labeling one part “immutable” does not separate the input ownership.
- **Fix:** explicitly split historical evidence validation from current-generation validation before changing expectations. Repoint historical assertions to the frozen Phase 1 baseline (or add a byte-pinned historical fixture owned by this plan), retain their original expected values, and test merged current artifacts against reviewed source-winning expectations separately. Name the input path and test owner in the phase manifest. Do not rewrite historical MCP fixtures or weaken numeric assertions.

### Medium — Imported legacy reviews need an explicit validation adapter

- **Plan location:** `phase-01-start.md:41–45,51–76` freezes the original name map, excludes its 79 rows from writable `decisions`, imports them into the inventory, and then says missing evidence/reviewer or obsolete fingerprint is rejected.
- **Actual evidence:** `pipeline/sgsdeck-name-map.json:4–10,11–17` contains legacy `{category,sourceId,sourceName,canonicalName,evidence}` rows. Read-only census found **0/79 rows with a reviewer field**. Existing validation requires four nonempty strings at `pipeline/sgsdeck_identity.py:90–96` and derives refs at `:109–123`; it does not provide the new `reviewer`, structured `reviewedAt`, or `inputFingerprint` fields.
- **Failure:** applying the new inventory requirements uniformly rejects every imported row; inventing a reviewer/date to make the objects fit manufactures review evidence. Conversely, an undocumented bypass weakens the claimed strict contract. The plan needs to distinguish the two validation shapes explicitly.
- **Fix:** define imported legacy rows as a separate read-only inventory origin bound to the exact accepted name-map/source/baseline hashes and existing evidence. Require reviewer/date/fingerprint on new decisions; do not claim absent historical metadata exists. If a legacy link requires new review, record an allowed separate attestation referencing it without shadowing or mutating the original mapping. Add tests for importing the actual unchanged map and for rejecting an invalid new decision.

Four findings retained; no additional abstract concern was added to reach a quota. No Critical finding was established.

## Phase 2 — ten distinct current-code claims checked

Numbers below refer to the phase's “Bằng chứng scout đã đọc” table. A VERIFIED claim confirms current state only, not the proposed implementation.

| Claim | Result | Direct evidence and caller consequence |
|---|---|---|
| P2-1: old builder writes public arrays | VERIFIED | `pipeline/build_dict.py:118–138`, especially `:137–138`, writes tactics and heroes after `load_raw`. It must not be invoked as the offline unified builder. |
| P2-2: hero cost/stats are strings | VERIFIED | `data/heroes-dict.json:8–15`; full read-only census: 112 string costs and 672 string stat values. Preserve legacy numeric-string projection. |
| P2-3: six base/growth stats, seven aptitudes, civil fields | VERIFIED | `data/sgsdeck/generals.json:11–40` exposes seven aptitude keys, six base keys, six growth keys, and civil fields. Some source records lack detailed keys; their existence is not completeness for every hero. |
| P2-4: tactic effect/target/rate/cooldown/acquisition are separate | VERIFIED | `data/sgsdeck/tactics.json:11–28` stores each separately. Object-valued acquisition needs the explicit branch in the finding above. |
| P2-5: only eight effectViet and eight targetViet | VERIFIED | First pair `data/tactics.json:1332–1333`, last pair `:4581–4582`; `rg` and full JSON count confirm exactly 8/8. Existing prose is not blanket corpus translation. |
| P2-6: transliteration can retain unknown Chinese | VERIFIED | `pipeline/hanviet.py:148–153` retains unknown characters when a missing set is supplied; otherwise it raises. `:164–166` only transliterates/title-cases. It cannot certify prose translation. |
| P2-7: 90 specials, 33 null parents | VERIFIED | `data/sgsdeck/equipment.json:2051–2053` declares 90 children; null example `:219`. Full census confirms 90 and 33. The public special cannot be dropped merely for lacking a parent. |
| P2-8: advisors separate effect and usage, with general ID refs | VERIFIED | `data/sgsdeck/advisors.json:11–24` has `description`, `effectText`, `generals[].id`, and tactic points. Keep usage distinct from effect; resolve IDs through reviewed identities. |
| P2-9: 192 troop options and dated/original effect revisions | VERIFIED | `data/sgsdeck/troop-mods.json:3–5,12`; full sum of `attributes.options` lengths is 192. Revision clauses must not be combined as simultaneous mechanics. |
| P2-10: 426 building levels with costs/duration/effect and max/main-city fields | VERIFIED | `data/sgsdeck/buildings.json:3–5,13–20,63–65`; full level sum is 426. Costs, duration, and effects remain distinct values. |

## Phase 4 — ten distinct current-code claims checked

| Claim | Result | Direct evidence and caller consequence |
|---|---|---|
| P4-1: dictionary requires viet; chinese/hanViet optional; additive data does not automatically expand tools | VERIFIED | `mcp-worker/src/data/artifact-contracts.ts:205–210`; `snapshot-index.ts:107–122` projects identity/search terms. Additional lookup fields remain records, not an automatic detail-tool API. |
| P4-2: canonical dictionary ID derives from display name | VERIFIED | `mcp-worker/src/data/entity-identity.ts:15–22`; `snapshot-index.ts:108–109`. A JSON `id` field cannot override these helpers. |
| P4-3: four search kinds and duplicate canonical-ID rejection | VERIFIED | `mcp-worker/src/data/snapshot-index.ts:10,86–99`; `artifact-contracts.ts:254–270` separately rejects duplicate dictionary identities. Keep the four existing kinds. |
| P4-4: other is already a valid hero variant | VERIFIED | `mcp-worker/src/domain/contracts.ts:16–20,320–324`. A shared 40Y→other bridge need not extend the public union. |
| P4-5: shared matcher/identity/maps/engine are semantic closure; data version separate | VERIFIED | `mcp-worker/workflow-source-manifest.json:8–29,49–51`. Semantic helper edits require regeneration; dictionary bytes are separately release-bound. |
| P4-6: worker check contains workflow/coverage/types/build/node-min/control-plane | VERIFIED | `mcp-worker/package.json:34`; it additionally includes the local-secret check. This was script inspection only, not executing those checks. |
| P4-7: worker packaging has a clean-source gate | VERIFIED | `mcp-worker/scripts/build-worker-assets.ts:178–192,309–315`. It rejects dirty source; a fabricated assets directory is not evidence that this gate passed. |
| P4-8: historical v1 release fixture has six artifacts | VERIFIED | `mcp-worker/test/fixtures/release-snapshot/manifest.json:2–47` lists schema 1 and six artifact descriptors. Preserve this fixture; it is distinct from the unfrozen screenshot input discussed above. |
| P4-9: README has historical counts/nine sections | VERIFIED | `README.md:9–25` lists nine sections and dates the data snapshot 2026-08-25. It reports 239 tactics, while live dictionary census is 240. Do not treat that historical count as current corpus authority. |
| P4-10: root check/build/test:dist/verify/test:node/E2E scripts exist | VERIFIED | `package.json:8–19` contains the exact scripts. Inspecting them does not provide build/test success evidence. |

Totals: **20 VERIFIED, 0 FAILED, 0 UNVERIFIED** among the twenty selected current-code claims. The findings concern missing execution contracts or additional false assumptions outside those selected scout rows.

## Additional contract checks and limits

- The frozen-path validation API is real: `pipeline/query_sgsdeck_catalog.py:335–344` forwards `hero_path`/`tactic_path`; `:305–314` loads those dictionaries and validates refs. Its manifest hashes are not compared with current dictionary hashes here. The plan's acyclic explicit-baseline approach is supportable.
- The current JS helper really lacks a 40Y family prefix: `js/hero-identity.js:5,29–43`. The plan already explicitly fixes this; it is not a new finding.
- Browser and MCP name matching share reviewed names/aliases but do not share a data-ingress consistency guarantee. `js/match-dict.js:53,59–70` and `mcp-worker/src/data/snapshot-index.ts:117–122` show the distinct search paths; the plan already owns CJK matching changes.
- Existing numeric-string values, child counts, and script existence are verified against this checkout. Translation quality, correct new identities, live activation-rate scale, future source freshness, and implementation behavior remain execution work. No claim here certifies them.
- Dirty main and season WIP were preserved. This report is the only file written by this reviewer.

Status: DONE_WITH_CONCERNS
Summary: Checked all four phases and verified twenty current-code claims against actual files. Found one High consistency gap and three Medium data/review/test-input contract gaps.
Concerns/Blockers: Resolve the four plan gaps before execution; no new product decision or permission is needed. No tests/build/implementation were run.

## Controller revision verification — 2026-09-12

Re-read the four modified contracts. The initial findings above remain the historical review record; this table supersedes their open status. Verification is of the plan text, not delivered behavior.

| Finding | Resolution | Revised plan evidence |
|---|---|---|
| CLI/stdio mixed generation | RESOLVED IN PLAN | Phase 3 `:46–49,64–73,174–180,224` adds the actual filesystem ingress, verified raw-buffer reuse, partial-activation detection, explicit historical-v1 branch, stable cached process snapshot, ownership, and regression cases. Phase 4 `:76–82` requires the filesystem entrypoint and exact transitive semantic closure rather than an orphan hash entry. |
| Acquisition object branch | RESOLVED IN PLAN | Phase 2 `:139–147` specifies all three observed shapes, nested/sibling condition selection and reconciliation, fingerprint dependencies, and any-four/fixed-per-hero goldens. |
| Screenshot historical input | RESOLVED IN PLAN | Phase 4 `:112–118` explicitly splits the existing test: historical assertions read the byte-pinned Phase 1 baseline while current assertions read current artifacts. It preserves literal historical expectations and acknowledges that the separate input is planned. |
| Legacy review adapter | RESOLVED IN PLAN | Phase 1 `:73–83,157` defines a hash-bound legacy origin, preserves actual evidence, scopes new metadata requirements to new decisions, and adds a real-map adapter regression. |

No unresolved substantive gap remains from this review's four findings. Their implementation and behavioral evidence remain required during execution. No tests/build/source edits were performed in this follow-up.

Status: DONE
Summary: All four findings are addressed in the revised execution plan, including the CLI/stdio semantic-closure and historical-v1 constraints.
Concerns/Blockers: None outstanding within this bounded re-review; execution evidence is still pending.
