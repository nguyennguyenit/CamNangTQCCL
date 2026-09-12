# Cùng Tồn — Binh Diễn Xuân Thu: source research

Date: 2026-09-07. Scope: planning and read-only verification; no importer or runtime changes.

## Evidence and inventory

Source: https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit?gid=190730430#gid=190730430

Inspected CSV now pinned at `plans/260907-0233-season-team-lookup/research/coexist-binh-dien-xuan-thu.csv` (originally `/tmp/tqccl-new-season-coexist.csv`), SHA-256 `838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb`. It has **94 CSV records, 220 physical lines, 10 columns, 5 groups, 25 team blocks, 75 heroes**. References below use physical file lines; CSV record numbers are explicitly labeled. Scenario attribution comes from the user; the CSV does not establish a ruleset. Do not infer an S-number or a date-based ruleset.

Legacy `data/coexist.json` currently has 5 groups/25 teams; line 3 repeats the same `Cùng tồn 1` label as new CSV line 4, while summaries differ. Legacy scope remains unknown. `data/coexist.json:3-21` shows old advisor semantics and no record identity or context. Keep legacy bytes and unknown status.

## Exact source fields

Header at CSV line 5: A `Tiến cử khai hoang`, B `Tên đội`, C `Võ Tướng`, D/E `Chiến Pháp` slots, F `Thêm điểm`, G/H/I `Binh Thư` slots, J **`Hiệu Quả Cải Tạo Chiến Pháp Binh Chủng`**. Group marker/summary occupies A/B (line 4). A also carries starting-team suggestions and `Ghi chú`/`Tiến cử chủ lực` content (lines 6-20, 33-38); preserve these blocks and the global reference-only disclaimer (line 2), without deriving executable teams from prose.

J is not advisorSkill. Existing parser hardcodes J to advisorSkill (`pipeline/parse_coexist.py:94`), whereas actual advisor requirements now occur in hero labels: `Lữ Bố (Kỹ Năng Quân Sư Điêu Thuyền)` at CSV lines 198-200, `Quan Vũ (Kỹ Năng Quân Sư Quan Hưng)` at 218-219. Store J as a distinct team-source effect field, retain holder/range evidence, and leave blank J cells blank unless merge ownership has been verified. Do not globally fill J across teams.

## Variants and conditions that cannot be flattened

- Hero identity: `Lữ Bố 40th` (24-25), `SPĐổng Trác` without space (51-65), `CO Tinh Thái` (33), and `Đổng Trác/SP Đổng Trác` alternatives (112-113). Preserve exact labels; reviewed alias mapping is required. No guessed canonical IDs.
- Requirements: Hứa Du Thương S (22-23), SP Quan Vũ Khiên S (28-31), CO Đại Kiều Kỵ S (68-71), SP Pháp Chính Cung S (107-108), Trương Phi Chính Lệnh-Cung S (148-150), SP Gia Cát Lượng full-width opening parenthesis + Chính Lệnh-Khiên S (153-155), Cam Ninh Quần (160-162). Do not strip annotations as cosmetic text.
- Distinct source tactics: `Tinh·`, `Chuyển·`, `Thác·` (88, 107-108, 182). Retain decorated identity and raw spelling, including Bạch Nhị Binh versus Bạch Nhị Cung; aliases require evidence.
- Slash alternatives in hero, tactic, stat, and book slots: lines 72-76, 112-113, 156-158. Three slash-separated book cells may describe paired book builds; independent Cartesian combinations are unproven.
- Coupled mode example: Ngũ Mưu Bạch Nhị Cung/Hổ Báo Kỵ (165-177) has tactic alternatives, Cung S annotations and two entire J effect bundles separated by slash. Preserve bundles intact. Do not apply bow requirements/effects to cavalry or assume alignment solely from slash position without review.
- F contains priorities (`Võ Lực, Tốc 1`) and splits (`Nửa Trí, nửa Thống`); keep raw values, not a guessed numeric allocation.
- B retains trailing `18C` etc. Existing cleanup discards this (`pipeline/parse_coexist.py:37-38`); save raw title plus cleaned display title. Its numeric meaning is not established by this source.
- Summary order differs from detailed order (group 1 summary starts 40 Lữ; first team is Hoàng Mã). Preserve both; do not silently sort or claim summary order is definitive build order.

## Import/preservation design compatible with phase 2

Use a separate source-specific CSV adapter and pure payload builder. Keep `pipeline/grid_extractor.py` HTML span contract unchanged. It represents origin metadata (`:17-30`, `:94-114`) that CSV does not contain. CSV parsing must use `csv.reader` on a file/StringIO, not splitlines: quoted embedded newlines contain meaningful labels and boundaries.

Proposed bounded raw source payload embedded optionally in the existing `season-content-links` sidecar, discriminated as a source-owned coexist record versus a legacy locator. This preserves the plan's five-sidecar/11-MCP-resource inventory without adding a public dataset:

```text
source={id,url,sheetId,gid,snapshotHash,format,disclaimerRaw}
group={recordId,sourceId,sourceLocator,contentFingerprint,groupLabel,summaryRaw,
 openingSuggestionsRaw,notesRaw,teams:[...]}
team={recordId,sourceLocator,contentFingerprint,teamNameRaw,teamName,
 unitTacticEffectsRaw,heroes:[{nameRaw,tacticSlotsRaw:[string,string],
 statFocusRaw,bookSlotsRaw:[string,string,string]}]}
```

Source locators should carry CSV record/physical line or sheet cell range for evidence, **not serve alone as durable IDs**. Reviewed record IDs plus fingerprints protect against reorder and edited-content misattachment. Keep fixed empty slots in raw payload. Identity and condition normalization is a separate reviewed step. Import validates 3 hero rows per block and complete nonempty headers; orphan continuation rows, changed headers, partial snapshots and ambiguous blocks fail without replacing prior artifacts.

Reuse existing phase-2 `contentLink` contract `{kind:"coexist",recordId,scenarioId,rulesetId:null,configIds:[],reviewStatus,evidenceRefs}`. New source can be scenario-attributed for reference browsing while ruleset remains unknown. Old records retain null scenario/ruleset. Do not make either ruleset-eligible recommendations from this evidence alone. Reviewed `configIds` can be attached only after exact canonical holder/alternative/conditions mapping; empty refs are valid during source intake.

For normalized configs, extend the existing phase-2 model only where needed: preserve `statFocusRaw` per hero and explicit requirements/effect bundles with evidence, or split reviewed coupled variants into separate configs. Existing `bookRefs[]` is insufficient to express three ordered slots with conditional alternatives; retain ordered book slots and bundle association. Include required condition/effect selections in the existing selection fingerprint. Do not create another scenario registry or scoring system.

Do not concatenate sources through legacy `group_coexist`: it indexes label only (`pipeline/parse_coexist.py:100-110`), merging both `Cùng tồn 1` groups. Source namespace + reviewed group recordId must determine grouping. Do not use the general build command as an importer: `pipeline/build_json.py:108-123` rebuilds/writes teams, facets, coexist and khaihoang; it only checks coexist nonempty before writing. A dedicated pure candidate builder + validated scoped publish must preserve existing curated datasets on parse/fetch/identity failures and avoid sibling writes.

## TDD plan — meaningful red cases

Current focused verification: `python3 -m unittest tests.test_parse_secondary.TestCoexist -v` — **1 test passed**. That test (`tests/test_parse_secondary.py:125-146`) only verifies nonempty real groups, unique labels and nonempty names/summaries; it does not verify exact group/team/hero counts, fixtures, headers, scope, source isolation, alternatives or preservation. Existing pure-build pattern is at `pipeline/build_json.py:99-105` and test `tests/test_parse_secondary.py:113-122`.

The controller has pinned the inspected CSV under the plan research directory with the checksum above. Before implementation, use that snapshot to create a provenance/checksum fixture and write focused tests:

1. Exact 5/25/75 inventory and exactly 3 heroes per block. CSV blanks continue only an active team; next marker resets context; missing first title must reject orphan heroes.
2. Quoted multiline fields preserve all text/newlines and slot positions. Header drift/missing J, reordered columns, truncated final hero, malformed CSV and login HTML reject with no publish.
3. J remains unit-tactic effects, never advisorSkill. Advisor requirements on hero label remain present independently; empty J in next team does not inherit previous effects.
4. Preserve 40th/SP/CO, full-width parentheses, S proficiency, Chính Lệnh, faction annotation, tactic prefixes, raw title suffix, stat priorities and global/group notes. Unmapped identities report unresolved and do not get invented refs.
5. Hero/tactic/book alternatives preserve holder and ordered slot. Coupled bow/cavalry bundles do not generate unverified mixed selections; selection change invalidates sourceScore (existing phase-2 contract).
6. Both sources can contain Cùng tồn 1 and Thái Úy Khiên without collision. Group record reordering preserves identity; edited content fingerprint requires review; identical display names across groups are not deduplication keys.
7. New scenario confirmed + null ruleset is available as attributed reference, excluded from exact ruleset recommendations. Legacy remains unknown and no-context behavior retains parity. Scenario attribution never silently creates ruleset applicability.
8. Offline repeat parse is deterministic. Fetch/parse/validation failures leave previously accepted artifact bytes untouched; import does not write teams/facets/khaihoang/legacy coexist. Run these isolated publication tests against temp outputs, not live data.

Green: implement adapter/pure builder first, then reviewed link projection. Refactor: narrow Python fixture suite, relevant Node context tests, then broader suites only where shared contracts changed. Do not execute implementation in this planning task.

## Unresolved questions

Ruleset attribution, canonical 40th/decorated-tactic identities, exact semantics of C suffix, paired alternative relationships, and J merge ownership need source or domain review. None blocks retaining the raw snapshot or displaying scenario-attributed reference content. They do block promoting executable/scored configurations that depend on those claims.
