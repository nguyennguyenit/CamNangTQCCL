---
title: "Phase 1: Danh tính và baseline bất biến"
status: completed
---

# Phase 1: Danh tính và baseline bất biến

## Overview

Trạng thái **completed**; dependency: không; effort 2–3 ngày công. Đóng contract
input/danh tính và review corpus trước merge. Output là baseline/review riêng
cùng helper tương thích đã kiểm; chưa thay public data hoặc snapshot SGSDeck.

Context: [plan](plan.md), [brainstorm](../reports/brainstorm-260912-1203-unified-lookup.md),
[data research](reports/research-data.md), [controller scout](reports/controller-scout.md).

<!-- Updated: Audit Session 2 - privacy boundary precedes private artifacts -->

## Bằng chứng scout đã đọc

Đường dẫn tính từ repository root; claim là hiện trạng, không phải feature đã làm.

| # | Source đã đọc/rg | Fact và hệ quả |
|---|---|---|
| 1 | `data/heroes-dict.json`, `data/tactics.json` | 112/240 records; `viet` là tên canonical cũ phải giữ. |
| 2 | `pipeline/sgsdeck_identity.py:15–35` | Python slug từ `viet`, reject duplicate ID; additive JSON id chưa đổi helper. |
| 3 | `pipeline/sgsdeck_identity.py:38–46` | Python có base/SP/CO/40Y, nhận 無雙 là CO. |
| 4 | `js/hero-identity.js:5–43` | JS chỉ nhận SP/CO, bỏ annotation cuối; không encode 40Y bằng ngoặc. |
| 5 | `mcp-worker/src/data/entity-identity.ts:15–22` | MCP hero ID dùng shared JS; tactic ID slug riêng. |
| 6 | `mcp-worker/src/domain/contracts.ts:20,323` | Enum hiện base/sp/co/other; không cần thêm MCP enum. |
| 7 | `pipeline/query_sgsdeck_catalog.py:305–314,339–345` | Có explicit hero/tactic paths; không so inputHashes với dictionary hiện tại. |
| 8 | `pipeline/sgsdeck_identity.py:81–126` | Reject duplicate source mapping, chưa reject hai source→một owner. |
| 9 | `pipeline/build_dict.py:95–108,137–138` | Thiếu cache có thể crawl; writer ghi hai root arrays. |
| 10 | `pipeline/sgsdeck-name-map.json`; reconciliation JSON | 79 reviewed links, 259 candidate mới; normalized match chưa phải review. |
| 11 | `data/sgsdeck/generals.json`; data research | 166 base, 27 SP, 8 CO, 1 40Y; 176/202 có detail. |
| 12 | `src/lib/root-static-artifacts.ts:18–42` | Chỉ `data/sgsdeck` private subtree; registry/baseline đặt trong pipeline. |

## Requirements và input contract

- Freeze byte-identical hai dictionary đã đối chiếu, giữ cả local unmatched.
  `pipeline/lookup-inputs/manifest.json` schema 1:
  `{schemaVersion,files:{"heroes-dict.json":sha256,"tactics.json":sha256},counts:{heroes:112,tactics:240}}`.
- Source nguyên `data/sgsdeck/{manifest,generals,tactics,equipment,advisors,troop-mods,buildings}.json`;
  source manifest và `pipeline/sgsdeck-name-map.json` không đổi bytes. Builder
  gọi `validate_snapshot(catalog_dir,hero_path=frozen_heroes,tactic_path=frozen_tactics)`.
- Không identity-seed, remapped source hoặc sửa importer/query defaults.
  Original 79 refs validate với baseline; new refs validate với candidate corpus.
- Hash khác reconciliation: dừng freeze, đọc diff với owner WIP, tái đối chiếu;
  không tự “refresh” evidence hoặc lấy output hợp nhất làm fallback mới.

### Private artifact boundary trước materialization

Trước khi tạo `pipeline/lookup-inputs`, identity registry hoặc review report,
thêm dev-server deny contract cho `pipeline/lookup-*`, `pipeline/lookup-inputs/**`
và `pipeline/lookup-output/**`. Fixture phải tạo sentinel thật rồi chứng minh
direct path, `/@fs`, raw/module query và traversal không trả bytes; public root
artifacts và scoped Recommended routes vẫn hoạt động. Không dựa vào root artifact
allowlist vì Vite filesystem serving là đường khác. Gate này thuộc Phase 1 và
phải Green trước private bytes đầu tiên; Phase 3 chỉ rerun regression.

### Registry private duy nhất

Tạo `pipeline/lookup-identity.json`; strict schema, không copy 79 writable rows:

```text
{
 schemaVersion:1, baselineManifestHash:sha256, sourceManifestHash:sha256,
 existingMap:{path:"pipeline/sgsdeck-name-map.json",sha256},
 decisions:[{
  category:"generals"|"tactics"|"equipment"|"equipment-special"|"advisors"|"troop-mods"|"buildings",
  sourceId:string,sourceName:string,inputFingerprint:sha256,
  disposition:"matched"|"new"|"unresolved",
  canonicalId:string|null,nameVi:string|null,
  variant:"base"|"sp"|"co"|"40y"|null,
  aliasesVi:string[],aliasesZh:string[],reasonVi:string,
  evidence:string[],reviewer:string,reviewedAt:ISO8601
 }],
 childIds:[{parentId:string,kind:"troop-option"|"building-level",
            inputKey:string,inputFingerprint:sha256,id:string}],
 relationDecisions:[{ownerId:string,fieldPath:string,inputFingerprint:sha256,
                    targetId:string|null,reasonVi:string,evidence:string[]}]
}
```

`decisions` chỉ chứa source ngoài 79 reviewed rows; import existing map on read
vào inventory tạm với origin riêng `legacy-reviewed-map`. Adapter giữ actual
`{category,sourceId,sourceName,canonicalName,evidence}`, bind exact map/source/
baseline hashes; không invent reviewer/date/fingerprint vốn không có trong 79 rows.
Reviewer/date/fingerprint bắt buộc cho **new decisions**, không áp sai schema này
lên legacy import. Nếu review mới một legacy link, lưu attestation riêng tham
chiếu key/hash, không shadow/change immutable mapping. Reject duplicate source key,
registry shadow existing mapping,
two distinct source entities→one owner, orphan, wrong namespace/variant, missing
evidence/reviewer, obsolete fingerprint. Source duplicate thật được unresolved
có chứng cứ; không tự thêm many-to-one exception hoặc ép matched để đủ số.

`childIds` cấp một lần, không lấy array index. Building key parent+integer level;
troop option key tier+tên nguồn+convertsTo, review collision nếu trùng. Reorder
không đổi ID; semantic edit chỉ rebind fingerprint sau review cùng option.
`relationDecisions` chỉ cho relation mơ hồ/name-only; upstream ID đã validate
resolve trực tiếp qua registry, không copy duplicate ledger.

Public namespaces: `hero:`, `tactic:`, `equipment:`, `equipment-special:`,
`advisor:`, `troop-mod:`, `building:`. Children:
`troop-option:<parent-slug>:<allocated-slug>`, `building-level:<parent-slug>:<level>`.
ID mới source-independent, cấp một lần rồi freeze trong registry. Existing
hero/tactic IDs phải bằng actual helpers; tên Việt cũ bất biến. Tên mới có
prefix `SP `, `CO `, `40Y ` đúng biến thể; chữ Hán cũ giữ, aliases giản/phồn
review riêng. Không re-slug ID khi chỉnh nhãn của bốn nhóm mới.

### Variant bridge tương thích

- JS prefix thêm `40Y`, strip khỏi family nhưng giữ canonical slug;
  `variantOf` trả `other` cho 40Y theo existing shared/MCP contract.
  Dictionary `lookup.variant="40y"` phục vụ label; không mở MCP enum/API.
- `primaryDisplayName` nhận prefix 40Y trước flags; hỗ trợ `is40Y` additive cho
  object mới. Old string/object IDs, family, base/SP/CO outputs giữ nguyên.
- Python unified validator semantic `40y`; parity table so ID/family và mapping
  `40y→other` qua JS/MCP. Không coi `other` là base hay dùng family để merge.
- Giữ matcher threshold/ambiguity/reviewRequired; CJK aliases ở Phase 3.

## Related Code Files

**Read/current:** bảng scout; `tests/test_sgsdeck_identity.py`,
`tests/test_build_dict.py`, `tests-js/hero-identity.test.mjs`,
`mcp-worker/test/domain/legacy-domain-adapter.test.ts`,
`mcp-worker/workflow-source-manifest.json`.

**Create/planned:** `pipeline/lookup-inputs/{manifest,heroes-dict,tactics}.json`,
`pipeline/lookup-identity.json`, `pipeline/unified_lookup_identity.py`,
`tests/test_unified_lookup_identity.py`.

**Modify/planned:** `astro.config.mjs`, `tests-js/astro-dev-contract.test.mjs`
cho private filesystem deny gate; `js/hero-identity.js`,
`tests-js/hero-identity.test.mjs`,
`mcp-worker/test/domain/legacy-domain-adapter.test.ts`; regenerate
`mcp-worker/src/generated/workflow-build.ts` after shared semantic change.
Existing Python/source mapping remain read-only. No root JSON/JS file added,
so public manifest inventory does not grow. **Delete:** none.
Preserve completed Recommended scoped routes while denying internal evidence.
Serialize shared helper edits with owner mùa; không chỉnh `build_season_data.py`.

## Implementation Steps

1. [x] Inspect branch/worktree/diff, pin approved hashes, coordinate owner mùa;
   current tests là baseline, không phải Red của feature mới.
2. [x] Create present private sentinels and add dev filesystem privacy Red; implement
   exact deny boundary and reach Green before any registry/baseline materialization.
3. [x] Add actual-inventory identity tests and minimal API scaffolding; Red phải
   là assertion hành vi, không phải import/setup failure.
4. [x] Freeze baseline exclusive-create; refuse overwrite khi hash khác.
   Không invoke `build_dict`, `build_json`, crawler hoặc source rebuild.
5. [x] Review 259 candidates, 90/167 source unmatched, all 14 local unmatched;
   đối chiếu variants/relations/Chinese facts trước cấp tên mới. Agent làm review.
6. [x] Review extra-category/child identities; account 805 parents +708 children,
   không lấy unmatched counts làm confirmed-new totals.
7. [x] Implement strict validation/import of 79 refs, reverse uniqueness và
   fingerprints; mỗi source/local row có disposition trong inventory riêng.
8. [x] Implement 40Y bridge, golden parity, workflow fingerprint regeneration;
   kiểm old team/family corpus canaries không đổi behavior.
9. [x] Save private inventory/evidence report; Green và Refactor trước bàn giao
   exact baseline/registry hashes cùng unresolved list sang Phase 2.

## TDD Red → Green → Refactor

| Slice/test owner | Red assertion | Green | Refactor invariant |
|---|---|---|---|
| `test_unified_lookup_identity`, census | Missing row/reverse duplicate được accept | Full accounting/collision reject | Same inventory/IDs |
| Baseline binding | Wrong baseline hoặc mutable output được dùng | Explicit frozen paths/hash | Output tamper không thành input |
| Name validation | CJK-only name/collision được review | VI name có evidence, collision reject | 112/240 old IDs exact |
| JS identity + MCP adapter | 40Y family còn prefix/classified base | Distinct ID, shared variant other | Base/SP/CO unchanged |
| Child registry | Reorder cấp lại IDs | Stable reviewed keys | Children conserved by identity |
| Source compatibility | Original refs không resolve | Unchanged source + frozen inputs | Không remap snapshot |
| Legacy review adapter | Actual 79 rows bị reject vì thiếu new metadata | Hash-bound legacy origin, new decisions vẫn strict | Không bịa reviewer/date |
| Dev private boundary | Present registry/sentinel served qua `/@fs`/raw query | Exact deny trước materialization | Public root + Recommended scoped routes unchanged |

Narrow commands (root CWD trừ `--prefix`):

```bash
python3 -m unittest tests.test_unified_lookup_identity
node --test tests-js/hero-identity.test.mjs
npm --prefix mcp-worker test -- test/domain/legacy-domain-adapter.test.ts
python3 -m unittest tests.test_sgsdeck_identity tests.test_query_sgsdeck_catalog tests.test_build_dict
npm --prefix mcp-worker run generate:workflow-build
npm --prefix mcp-worker run check:workflow-build
npm run test:dev-contract
```

Lưu command/failing assertion, Green và rerun sau Refactor. New tests chưa chạy;
baseline controller là 13 Python +26 JS narrow tests, không broad release proof.

## Success Criteria, risks và rollback

- [x] Inventory đầy đủ với unresolved trung thực, không silent drop/forced link.
- [x] 79 source/map bytes unchanged, old IDs/names exact, bốn variants tách đúng.
- [x] Fingerprints/child IDs stable; helper và MCP parity Green.
- [x] Phase 2 có exact hashes/evidence, không fabricated links.
- [x] Private registry/baseline/review bytes không thể đọc qua ordinary Astro dev routes.

Fact game chưa biết: exhaust snapshot trước, giữ unresolved tiếng Việt; chỉ hỏi
nếu bằng chứng game cần thiết thật sự không thể tìm được. Concurrent input
mutation: fail validation, coordinate owner, review lại evidence bị ảnh hưởng.
Rollback chỉ helper edits thuộc phase sau diff review; giữ review/baseline riêng
để sửa tiếp, không replace source/root data hoặc xóa unrelated WIP.
