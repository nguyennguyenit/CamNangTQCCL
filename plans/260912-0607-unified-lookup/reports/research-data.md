# Data research — unified Vietnamese lookup

Date: 2026-09-12. Scope: `--deep --tdd`, PLAN ONLY. Work context: `/Users/plateau/Project/CamNangTQCCL`. No implementation, crawl, installation, build, tests, or mapping promotion performed. Existing main-tree WIP was inspected and preserved. Recommendations below are proposed contracts, not delivered behavior.

## 1. Confirmed evidence and product authority

The accepted brainstorm owns behavior: identify the exact entity/variant; keep existing Vietnamese names and IDs; valid SGSDeck values win per field; missing/placeholder source fields fall back to real local values; six Vietnamese lookup groups; no provider UI. The reconciliation JSON remains useful evidence, but its `resolution: unreviewed-preserve-local` values are superseded, not actionable rules (`plans/reports/brainstorm-260912-1203-unified-lookup.md:17`; `plans/reports/analysis-260912-1142-unified-lookup.json:923`).

Read-only SHA-256 comparison during this research: every `inputHashes` entry in the reconciliation JSON still matches its current file. Therefore its counts/differences remain applicable to this snapshot. No inference of future freshness.

| Inventory | Current count | Meaning |
|---|---:|---|
| Legacy heroes / tactics | 112 / 240 | Existing ID/name retention baseline |
| Reviewed source links | 39 heroes + 40 tactics | 79 existing reviewed links |
| New normalized-name candidates | 73 heroes + 186 tactics | 259 decisions to review, not automatic links |
| Source without name match | 90 heroes + 167 tactics | Not yet a verified new-entity count |
| Local unmatched | 14 tactics | Preserve every local record during review |
| Equipment / specials | 114 / 90 | 57 known parents; 33 unresolved parents remain null |
| Advisors | 39 | Skill entities, not duplicate hero profiles |
| Troop modifications / options | 16 / 192 | Retain all options and conditions |
| Buildings / levels | 41 / 426 | Retain costs, duration, effect and ordering |

Evidence: `analysis-260912-1142-unified-lookup.json:883`, `docs/sgsdeck-catalog.md:16`. Additional read-only inspection: source heroes are 166 base, 27 SP, 8 CO, 1 40Y; only 176/202 have detail attributes. All 170 non-null `innateTacticId` references and 36 non-null `advisorSkillId` references resolve in this snapshot; every advisor `generals[].id` resolves. Legacy tactics have only 8 `effectViet` and 8 `targetViet` values. These are corpus observations, not translation/review completion.

## 2. Owners and an acyclic data path

### Existing ownership constraints

- `pipeline/build_dict.py:95-108` may crawl if cache is absent, despite its opening offline wording. `build():118-138` derives both dictionaries and writes them sequentially. Do not call this as a unified-lookup rebuild shortcut.
- `pipeline/sgsdeck_identity.py:24-35` derives canonical owners from dictionary `viet`; only heroes/tactics have canonicalRef ownership (`:49-64`). Additional four groups must not be forced into hero/tactic namespaces.
- `pipeline/build_sgsdeck_catalog.py:234-255` currently reads the current public dictionaries as identity inputs; `:317-320` records their hashes in the normalized manifest.
- Crucial distinction: `pipeline/query_sgsdeck_catalog.py:305-314` currently validates references against current dictionary contents but **does not check manifest inputHashes against those files**. Changing hero stats alone currently does not cause hash rejection; renaming/removing owners can fail. The current manifest hashes record build inputs, not an enforced freshness gate. Do not claim otherwise in the plan.

### Recommended one-way DAG

```text
frozen local baseline + immutable accepted private SGSDeck snapshot
  + separate reviewed unified identity/translation/relations
  -> field merge
  -> validated generation: compatibility dictionaries + public lookup + private ledger
  -> promotion
```

| Proposed path | Owner and rule |
|---|---|
| `pipeline/lookup-inputs/heroes-dict.json`, `pipeline/lookup-inputs/tactics.json` | One-time byte-identical freeze of the accepted 112/240 baseline, with recorded hashes. Full local fallback content; never read merged runtime outputs back as fallback. Intentional later local corrections are explicit reviewed input changes. |
| `data/sgsdeck/` | Immutable accepted private source snapshot for this plan. Preserve its 79 source mappings and manifest. The unified builder calls existing `validate_snapshot(..., hero_path=frozen_heroes, tactic_path=frozen_tactics)` explicitly; no source remap/rebuild is needed to review unified identities. |
| `pipeline/lookup-identity.json` | Versioned private inventory, all additional identity decisions and allocated names/IDs. Existing source mappings are imported as evidence, not modified. Owns unified refs for new or newly reviewed entities and unresolved dispositions. |
| `pipeline/sgsdeck-name-map.json` | Remains the existing source-catalog mapping owner. No changes required for unified lookup; do not duplicate automatic updates back into this file. |
| `pipeline/lookup-translations.json` | Reviewed field translations plus semantic input fingerprints and review metadata. All six groups and children. |
| `pipeline/lookup-relations.json` | Only relationships needing explicit reviewed resolution beyond validated upstream IDs; exact target IDs and evidence. Do not duplicate direct source ID links. |
| `pipeline/build_unified_lookup.py` | Offline deterministic composition/validation owner; reject missing inputs; no network fallback. Existing Python module naming convention justifies underscores. |
| `data/heroes-dict.json`, `data/tactics.json` | Compatibility projections generated from merged result, retaining schema/value types/IDs/names. Existing MCP consumes these; no four new MCP kinds. |
| `data/lookup-catalog.json` | Public allowlisted six-group lookup projection, source metadata removed by whitelist serialization. |
| Private generation manifest/ledger under `pipeline/lookup-output/` | Input/output hashes, per-field decisions, inventories, warnings, source provenance and translation review evidence; never under public `data/` root. |

The unified registry resolves refs against the **candidate merged corpus**, separately from the original source snapshot's canonicalRef validation against its frozen baseline. Record both baseline hashes and immutable source manifest/file hashes in the unified generation manifest. This cuts the cycle without manufacturing an intermediate identity seed or changing source importer defaults. New unified entities do not require rebinding the original source snapshot.

Source query CLI still validates existing refs against current runtime dictionaries (`query_sgsdeck_catalog.py:305-314`); its 79 original refs continue resolving because the merged output retains all old names/IDs. Prove that compatibility explicitly. A subsequent source rebuild is a separate source-catalog operation; its current default dictionaries may contain more entities and its recorded input hashes will legitimately differ. Do not present that rebuild as part of unified generation. For deterministic repeat of the original source build, use its explicit dictionary paths and pinned baseline. Existing inputHashes describe original build inputs and are not rewritten to claim merged dictionaries produced the old snapshot.

On source updates, require an explicitly accepted candidate snapshot and matching identity-validation inputs; stage its own baseline binding, review changed unified identities/translations, then merge. Never overwrite the frozen fallback baseline with the previous merged output. Same accepted inputs, mapping/translation rules and builder version must produce identical bytes; exclude wall-clock build timestamps and include reviewed timestamps as inputs.

## 3. Identity review and complete inventory

Review all 259 candidates once, with a durable row per source entity: source category/ID/name, normalized candidate name, explicit variant, existing canonical ID/name, disposition (`matched`, `new`, `unresolved`), reason/evidence, reviewer, review date and identity input fingerprint. Agent performs this review; no request for the user to read 259 Chinese pairs.

Review hierarchy: stable source identity + exact variant + original/normalized written names + entity facts/relationships where necessary. Traditional/Simplified conversion proposes candidates only. Current helper rejects duplicate source mapping, changed source name, orphan refs and cross-variant names, but does not reject two different source IDs both targeting one canonical owner (`pipeline/sgsdeck_identity.py:81-126`). Add reverse uniqueness or an explicit reviewed alias disposition; never silently duplicate profiles.

Existing slug IDs depend on Vietnamese names (`pipeline/sgsdeck_identity.py:15-21`; `mcp-worker/src/data/entity-identity.ts:15-22`). Preserve all existing `viet` spellings even where transliteration alternatives appear more standard. Existing regressions already pin `Đồng Lòng Hợp Sức` versus `Lục Lực Thượng Quốc` and `Nhanh Trí Động Não` (`tests/test_build_dict.py:13-22`, `:123-141`).

Variant gap: Python recognizes 40Y (`pipeline/sgsdeck_identity.py:38-46`), but JS `variantOf` only recognizes SP/CO (`js/hero-identity.js:5`, `:29-43`). Plan must specify a compatible 40Y identity change with consumer tests; prefix-preserved ID alone does not make family/variant classification correct. Source CO also appears as `無雙...`, with both `isCO` and `isMusou` true. Validate name prefix against source attributes rather than relying on one boolean.

All 14 local-unmatched names must survive: Khắc Tuân Họa Nhất; Thương Lẫm Nhi Thực; Vô Song Thượng Tướng; Gió Táp Mưa Sa; Lấy Ít Đánh Nhiều; Lửa Cháy Ngùn Ngụt; Lửa Lan Khắp Chốn; Nhanh Chân Tranh Đất; Phi Hùng Quân; Phá Phong Đoạn Nhẫn; Thâm Mưu Viễn Lược; Tử Sĩ Tiên Phong; Vô Địch Can Trường; Vạn Quân Đoạt Sư (`analysis-260912-1142-unified-lookup.json:6370-6495`). Some lack Chinese names. Candidate similarities such as `克遵画一`/`克遵畫一` or `仓廪而实`/`倉廩豐實` need semantic review, not fuzzy auto-linking. Process these alongside the 90/167 source unmatched list before allocating new names, to prevent duplicate profiles.

Acceptance is 100% input accounting, not 100% forced matching. Every source/local row belongs to a recorded disposition; unresolved records retain evidence and truthful updating state. Unresolved identity must not become a duplicate public profile guessed from translation. Identity review should exhaust available snapshot evidence; only real unavailable game evidence can justify escalation. New IDs are allocated once, checked for normalized collisions, and never re-slugged on later translation edits. Use source-independent namespaces for new groups: `equipment:`, `equipment-special:`, `advisor:`, `troop-mod:`, `building:`; child options/levels are parent-scoped stable identifiers. Source IDs remain private mapping keys.

## 4. Exact field projection and merge behavior

Public lookup envelope proposal: `{schemaVersion:1, generationId, groups:{generals:[],tactics:[],equipment:[],advisors:[],troopMods:[],buildings:[]}}`. Each public record: `{id,nameVi,aliasesVi,variant?,descriptionVi:null|string,missingFields:string[],conditions:[],...typedGroupFields}`. Missing UI text derives from null/field state as “Đang cập nhật”; do not store that phrase as real source content. Public conditions contain reviewed gameplay season/scenario restrictions, never raw `sourceSeason`, provider or URL. Search can support reviewed Chinese aliases through a separately explicit field if desired; this is a product search choice, not provenance leakage.

| Group | Required typed projection and field mapping |
|---|---|
| Heroes | Existing `viet,chinese,isSP,faction,stars,cost,stats,troopApt,selfTacticCn,inheritTacticCn,roleTag,roleTagViet,iconUrl` contract remains in legacy projection. `baseForce→stats.luc`, `baseWisdom→tri`, `baseCommand→thong`, `baseSpeed→toc`, `basePolitics→chinh`, `baseCharm→mi`; `adaptCavalry→ky`, `adaptShield→thuan`, `adaptBow→cung`, `adaptSpear→thuong`, `adaptSiege→khiGioi`. Keep old numeric-string representation in legacy `cost/stats`; lookup may expose numbers. Additional growth, infantry/navy aptitudes, civil bonuses, collectible/red rules retain distinct lookup fields and Vietnamese labels. |
| Tactics | `quality`, translated `kind→type`, `effectText→effect` plus reviewed `effectViet`, `effectTarget→target/targetViet`, `troopLimit→troopFit`, acquisition `source/sources` translated as gameplay acquisition, activation rate/cooldown/max users/point cost, conflict/hero references. Never confuse `attributes.source = INHERITANCE` with provenance provider. |
| Equipment | Vietnamese name, quality, slot; separate specials with Vietnamese tier/effect/acquisition and `equipmentId:null|string`, `exclusiveHeroId:null|string`. Keep all 90 specials, including 33 unassigned. |
| Advisors | Vietnamese name/element/effect/usage description, numeric tacticPoints, `heroIds[]`, gameplay conditions. Skill entity linked to hero IDs. |
| Troop mods | Vietnamese effect/applies-to/suggested-build, translated troop labels, all `options[{id,tier,nameVi,descriptionVi,convertsTo:null|string}]`; preserve grouping/choice semantics, no Cartesian combinations. |
| Buildings | Vietnamese name/summary, `mainCityOnly:boolean`, `maxLevel:number`, all `levels[{level,costs:{wood,iron,stone},durationVi,effectVi}]`. Costs preserve null versus 0; optional numeric duration only after unit-aware parsing. |

Value precedence must be field-aware, not `sourceValue or localValue`: validate shape/type/domain; normalize a known whole-field placeholder to missing; choose valid non-placeholder SGSDeck; else real local; else null/missing state. Valid 0 and false survive. An empty array may mean unrestricted (e.g. troopLimit), not missing—define per-field semantics explicitly. Invalid nonempty source values fail validation; they do not silently become local fallback. Arrays/relations need reviewed identity, not blind concatenation. Avoid copying an old translated effect/target onto a new Chinese effect because the name still matches.

All 11 accepted differences must assert precise IDs and legacy output values: Hạ Hầu Đôn shield S; Vương Nguyên Cơ charm 80; Nhạc Tiến speed 58; Trương Xuân Hoa charm 75; Quan Ngân Bình charm 79; Mã Vân Lộc charm 75; Lỗ Túc bow S; Lữ Mông bow S; Lữ Linh Ỷ charm 74; SP Lữ Mông bow S; Đổng Bạch charm 77. Source evidence: reconciliation JSON `:923-1011`. Pair these assertions with all unchanged IDs/names, so correctly chosen numbers cannot accidentally land on the wrong variant.

## 5. Vietnamese review, semantics and freshness

`hanviet.py` is name transliteration, not prose translation (`:116-166`); its mappings primarily cover Simplified Chinese and a few compound readings. It can preserve unknown Chinese characters when a missing-set is passed (`:148-151`), so a nonempty generated name is not a reviewed Vietnamese name. New names need character coverage, compound-name/variant review and collision checks. Reuse old Vietnamese names exactly.

Translation entries should use `{entityId,fieldPath,inputFingerprint,textVi,status,review:{reviewer,reviewedAt,evidence,semanticChecks}}`; valid status is reviewed against the current semantic input. Fingerprint canonical JSON of the exact chosen source text plus relevant context (variant, target, restriction, revision section, parent/option identity). Include translation-rule/glossary version when it changes meaning. Preserve source snapshot hash separately for provenance; a metadata-only refetch should not stale every translation. Changes to effect text, quantities, target, troop/season restrictions or selected revision invalidate dependent translation; unrelated fields do not.

Source descriptions frequently combine dated updates with “原始版本”, not one simultaneous effect (`data/sgsdeck/tactics.json:744`, `:788`; `data/sgsdeck/troop-mods.json:10`). Translate into explicit sections preserving which numbers belong to each revision. Never merge old/new clauses or treat `18%→36%` as a date or unconditional single value. Agent must verify numbers/ranges, units, recipient/count, trigger, duration, stacking/caps, damage/healing types and conditional exceptions. Automated token checks flag omissions; they do not replace semantic reading.

Source `待補充` and equivalent observed whole-field placeholders are missing-content markers, not descriptions to translate. The reconciliation's 37 count is specifically **source-only placeholder tactics**, not necessarily every placeholder in all 393 tactics. Recompute all placeholder classes at implementation from actual text; test matched-placeholder fallback separately. If valid source mechanics changed and translation is stale, block full candidate promotion pending agent translation/review; do not ship old Vietnamese mechanics under new source values. If both sources genuinely lack content, allow null/updating state. Initial acceptance requires all obtainable six-group names/labels/descriptions reviewed, not a mass “Đang cập nhật” substitution to evade translation scope.

## 6. Public boundary, deterministic promotion and recovery

Private per-field ledger: `{entityId,fieldPath,chosenInput,sourceRecordId,sourceFieldPath,sourceValueHash,localValueHash,reason,translationInputFingerprint,reviewEvidence}`. Add baseline/source/identity/map/translation/schema/builder hashes, inventory reconciliation and output hashes to the generation manifest. Provenance/URLs/source timestamps and upstream IDs stay here and in private source snapshot, not lookup DTO or browser HTML. Whitelist serialization is required; deleting a couple of known keys from source objects is insufficient. Current artifact tree only excludes `data/sgsdeck`, and permits only allowlisted flat regular files (`src/lib/root-static-artifacts.ts:18-43`, `:94-101`; manifest `:42-52`). Put review files in pipeline, and add only `lookup-catalog` to the public artifact manifest with consumer ownership coordination.

Do not overclaim current atomicity: `_promote` first renames existing directory to `.previous`, then renames staging to output, then removes backup (`pipeline/build_sgsdeck_catalog.py:165-181`). Its test covers a caught second-rename error and cleanup error (`tests/test_build_sgsdeck_catalog.py:208-242`), not process death/power loss, reader gaps or multi-file public promotion. Never swap the entire shared `data/` directory; it includes unrelated curated/WIP data.

Minimum practical delivery contract: build a private candidate generation containing every owned public projection and ledger, validate it fully, and use an explicit transaction journal plus a shared build/promote lock. Recheck original input and destination hashes under lock (fail on concurrent edits), copy rollback bytes for only owned paths, promote each owned file with same-filesystem temporary file + replace, verify final hashes, then mark transaction committed. Readers/builds must fail closed on an incomplete transaction; startup recovery rolls back or completes according to the journal before serving/building. Keep a previous accepted generation until post-integration verification. Call this **recoverable transactional offline promotion**, not strict crash-atomic multi-file replacement.

If acceptance literally requires readers to see either the whole old generation or whole new generation without a lock/fail-closed interval, select a single active-manifest-pointer architecture: immutable generation directory + atomic pointer-file replace, every build/consumer resolves the pointer once and reads all three projections from that pinned generation. Existing public URL basenames remain compatibility routes; artifact source resolution must explicitly change to generation-aware reading and its traversal/allowlist tests. This is a real public-artifact contract change, not a feature the current helper already supplies. Parent plan must select one contract and its tests; sequential writes alone are not sufficient.

## 7. Red → Green → Refactor matrix

These are planned failing checks; none were run in this research. Reuse local unittest fixtures and actual representative snapshot excerpts. Failure injection may mock IO failure only; no production fake data or fabricated identity evidence.

| Boundary / planned narrow test | Red proof | Green behavior | Refactor invariant |
|---|---|---|---|
| Identity census (`tests/test_unified_lookup_identity.py`) | Candidate silently linked; source/local row dropped; two IDs target one owner | All 259 review dispositions and complete local/source inventory; unresolved recorded; reverse mapping collisions rejected | Same inventory totals/decisions after helper extraction |
| Variant/name compatibility (`tests/test_sgsdeck_identity.py`, JS identity tests) | SP/base/CO/40Y collapse; unknown char passes as reviewed; 40Y classified base | Original 112/240 names/IDs fixed; all four variants distinct; unknown/colliding new names fail | Python/JS/MCP ID parity and stored roster/tracker ID canaries |
| Acyclic ownership (`tests/test_build_unified_lookup.py`) | Second build reads first output; unified builder validates source against mutable public dict; wrong baseline hash accepted | Original source refs validate against frozen baseline; unified refs validate against candidate corpus; same inputs twice same bytes; runtime outputs never become fallback | Remove shared duplication only while DAG and hash checks remain |
| Per-field precedence | Each of 11 deltas retains old value; 0/false disappears; blank source erases local | 11 exact expected fields at correct IDs; schema-specific missing policy | Table-driven merge keeps the same 11 goldens and untouched ID/name list |
| Description fallback | Matched source placeholder loses real local effect; both missing invent description | Local real effect chosen+translated; truly absent content null/updating | Placeholder helper recognizes whole-field sentinels only |
| Translation freshness (`tests/test_lookup_translations.py`) | Source effect/target/restriction changed but old VI text remains reviewed | Relevant fingerprint changes block promotion; unrelated metadata change does not | Same review validity with normalized stable hashing |
| Semantic preservation | One range/unit/target/duration/negation/revision section missing | Agent-reviewed source/VI fixture; checker flags change; snapshot sections kept distinct | Do not replace semantic fixtures with implementation-derived expectations |
| Relations/children | Orphan invented, option reassigned, lost child hidden by stable count | Direct source IDs resolve; 33 equipment parent nulls retained unless reviewed; 90/192/426 children conserved by identity | Deterministic ordering preserves semantic groupings |
| Public serialization | Provider, URL, raw attributes or private ledger leaked into public JSON/HTML | Exact allowlist DTO; typed VI fields; conditions only when gameplay relevant | New source keys cannot leak by default |
| Promotion rollback | Validation error or each write-failure leaves mixed files; input WIP changed between staging/promote | Full candidate validates first; conflict rejects; journal/lock recovers every interrupted state (or pointer switches a whole generation) | Failure matrix remains after factoring IO |
| Consumer compatibility | Legacy string stats become unexpected numbers; names/IDs change; expanded lookup becomes recommendation team corpus | Dictionary schemas stable; existing scan/roster/tracker/MCP scenarios pass; teams/tier/score untouched | Keep only narrow reusable adapters |

Existing reusable evidence: `tests/test_sgsdeck_identity.py:17-111`; `tests/test_build_sgsdeck_catalog.py:42-126` (shrink/identity), `:244-304` (offline, invalid staging, determinism); `tests/test_query_sgsdeck_catalog.py:119-183` (manifest/ref/shape); `tests/test_build_dict.py:13-22`, `:93-141`; `tests/test_hanviet.py:31-41`. Narrow intended command: `python3 -m unittest tests.test_unified_lookup_identity tests.test_lookup_translations tests.test_build_unified_lookup`; broaden to existing identity/catalog/dictionary tests and owner-selected JS/MCP contract tests, then build/check at integration. A green structural plan validator is not Red/Green evidence.

## 8. Coordination and unresolved decisions

Shared owners requiring serial integration with season WIP: public artifact manifest/tree tests, hero/tactic identity helpers and dictionary outputs. Keep `build_season_data.py`, season registry/evidence, team data/tier/Recommended scores outside this task's ownership. This report introduces no four-group MCP API expansion.

No product question blocks planning. Controller must choose promotion semantics explicitly (recoverable transaction versus strict generation-pointer switch), and record the explicit frozen-baseline source validation rather than retaining a cyclic dependency on runtime output. Agent implementation still owes actual 259-pair/unmatched review, translations and TDD results; this report must not mark those delivered.

Status: DONE_WITH_CONCERNS
Summary: Verified current snapshot evidence and proposed concrete identity, field, translation, provenance and acyclic pipeline contracts with a Red → Green → Refactor matrix.
Concerns: Promotion atomicity requires an explicit architecture decision; 40Y JS classification, explicit baseline binding and separate unified identity validation need scoped work before integration. No implementation or tests were executed.
