---
title: "Phase 4: Tương thích, chứng nhận và bàn giao"
status: todo
---

# Phase 4: Tương thích, chứng nhận và bàn giao

## Overview

Trạng thái **pending**; sau [Phase 3](phase-03-unified-lookup-interface.md);
effort 1–2 ngày. Kiểm toàn bộ consumer/release contracts, cập nhật docs đúng owner,
đóng evidence và rollback rehearsal. Không thêm MCP tools/kinds, không deploy.
[Plan](plan.md), [consumer research](reports/research-consumers.md),
[data research](reports/research-data.md), [plan mùa](../260907-0233-season-team-lookup/plan.md).

## Bằng chứng scout đã đọc

| # | Current source (repository root) | Fact/hệ quả |
|---|---|---|
| 1 | `mcp-worker/src/data/artifact-contracts.ts:205–209` | Dictionary cần viet, optional chinese/hanViet; additive fields không tự thành tool output. |
| 2 | `mcp-worker/src/data/entity-identity.ts:15–22` | MCP canonical ID vẫn từ displayName, không tự dùng JSON id. |
| 3 | `mcp-worker/src/data/snapshot-index.ts`; consumer report | Four search kinds hero/tactic/team/book, duplicate IDs reject. |
| 4 | `mcp-worker/src/domain/contracts.ts:20,323` | Variant other đã hợp lệ, dùng cho 40Y shared identity. |
| 5 | `mcp-worker/workflow-source-manifest.json` | Shared matcher/identity/maps/engine nằm semantic closure; data version riêng. |
| 6 | `mcp-worker/package.json` | `check` gồm workflow hash, coverage, typechecks, build, node-min, control-plane. |
| 7 | `mcp-worker/scripts/build-worker-assets.ts`; consumer report | Clean-source gate tồn tại; WIP không được bypass bằng fake assets. |
| 8 | `mcp-worker/test/fixtures/release-snapshot/` | Historical v1 fixture có six artifacts, không overwrite bằng corpus mới. |
| 9 | `README.md:9–27` | Counts/9 sections là historical snapshot; cập nhật owning feature docs có evidence mới. |
| 10 | `package.json` | Root check/build/test:dist/verify/test:node/E2E là actual scripts. |
| 11 | `playwright.config.mjs` | Deterministic preview 4174, reuseExistingServer false; không tăng port tránh conflict. |
| 12 | `js/app.js:77–109` | Shared dictionaries tác động tracker/soi/kho/faction; regression phải đủ closure. |

## Requirements và consumer closure

MCP compatibility-only: tám tools, kinds hero/tactic/team/book, observation
hero/tactic/team, existing bounded search/result/transport contracts giữ nguyên.
Bốn nhóm mới website-only không vào ownedHeroes/ownedTactics, không thành
team/tier/recommendation. Existing search trả identity không tự được hứa trả
merged stats/detail. New IDs searchable khi thuộc two dictionary arrays; lookup
availability không tự bypass season/config applicability hoặc suy đội hợp lệ.

| Consumer owner/current files | Acceptance và change khi cần |
|---|---|
| `js/analyze-map.js`, `js/analyze.js`, `tests-js/analyze-map.test.mjs` | Legacy scan map cùng IDs; CJK aliases cải thiện đúng entity, ambiguity vẫn yêu cầu review; không đổi provider/upload scope. |
| `js/roster-scan-map.js`, `js/roster-scan-state.js`, `js/roster-recommend-ui.js` | Old import/state/manual names usable; new variants không auto-confirm runner-up; không storage migration chỉ để lookup. |
| `js/recruit-tracker.js`, `js/recruit-tracker-store.js` | Options có new names; lịch sử/export/import cũ nguyên nghĩa, không rename stored events. |
| `js/derive-team-faction.js`, `js/team-pk.js` | Mọi old hero name còn resolve phe; intentional source faction delta có evidence và regression, không cập nhật tiers. |
| `js/team-recommend-engine.js`, `js/filters.js`, `js/render.js`, `js/meta-cu.js` | Cùng old roster/team corpus giữ candidates/selection; new catalog-only entries không tạo teams/scores. |
| `mcp-worker/src/data/{artifact-contracts,entity-identity,snapshot-index}.ts` | JSON id = actual canonical helper, duplicate namespace reject, aliases bounded and display IDs stable. |
| `mcp-worker/src/data/filesystem-data-source.ts` → `src/cli.ts`, `src/stdio.ts` | Phase 3 verifies exact raw bundle at ingress; interrupted/partial lookup roots fail DATA_UNAVAILABLE, genuine legacy roots still load. Cached process snapshot stays immutable until restart. |
| `mcp-worker/src/domain/{legacy-domain-adapter,normalization-service,recommendation-service,canonical-state}.ts` | Browser/MCP parity, base/SP/CO unchanged, 40Y shared other đúng ID/family; stale confirmation invalidated per actual workflow/release version. |
| `mcp-worker/src/research/{research-contracts,research-handlers}.ts`, MCP registry/transports | Same tool schemas/kinds; no detailed four-catalog API; stale cursors/releases rejected under existing contract. |
| `pipeline/build_dict.py`, `pipeline/query_sgsdeck_catalog.py`, `pipeline/suggest_team_tier.py` | Guard old writer; original 79 refs still resolve current dictionaries; source query unchanged. Tier script input compatibility only, không run/promote new tiers. |

Bảng là validation closure, không mặc định sửa mọi file. Chỉ sửa adapter/helper
khi test chứng minh regression thuộc catalog; shared season behavior coordinate
owner trước edit. Không nới test threshold hoặc silently undo user source priority.

## Release/publication closure

- Phase 3 đã thêm `lookup-data`, `unified-lookup`, `lookup-detail`,
  `lookup-catalog`, `lookup-manifest` vào `src/lib/public-artifact-manifest.mjs`.
  Root route/tree và `scripts/verify-astro-dist.mjs` phải thấy exact same generation.
- Source-hidden kiểm semantic keys/UI, không regex cấm mọi URL: existing vetted
  `iconUrl` là asset contract. Cấm provider/sourceUrl/provenance/sourceRecordId/
  sourceSnapshot/raw source attribute objects trong public projections. Gameplay
  acquisition `source` và `conditions` khác provenance. Không cấm reviewed CJK
  aliases hoặc team “Điểm SGSDeck” ngoài catalog.
- Dev route, built dist và preview không serve `data/sgsdeck`, `pipeline/lookup-*`,
  ledger/review/baseline/journal. Test direct attempted private URLs, exact inventory,
  symlink and traversal cases; không chỉ assert source selector absent.
- Worker source root chấp nhận exact website-only input basenames + checked
  private subtree, nhưng emitted inventory vẫn theo active MCP version. Plan mùa
  owns v1 six/v2 eleven schema; compose version implementation đã tồn tại, không
  hardcode catalog expansion thành artifact counts mới. Preserve v1 fixture bytes.
- `mcp-worker/workflow-source-manifest.json` phải bao phủ actual runtime semantic
  imports. Phase 3 thêm runtime `js/lookup-data.js` qua FilesystemDataSource nên
  thêm `mcp-worker/src/data/filesystem-data-source.ts` làm entrypoint và cả hai
  paths trong exact transitive semanticFiles (`generate-workflow-build.ts:151–164`).
  Không chỉ thêm orphan semanticFile hoặc duplicate buildInputs. `unified-lookup/lookup-detail`
  vẫn frontend-only. Build-input dependency theo actual owner, không nhầm mọi
  frontend module đều là MCP runtime hoặc gọi lookup-data là build-only nữa.
- Regenerate `mcp-worker/src/generated/workflow-build.ts` khi semantic files
  changed, rồi check. Hero/tactic byte changes tạo data releaseId mới; không
  fake old release hash hoặc overwrite historical fixtures để qua validation.

## Related Code Files

**Read/current:** toàn consumer closure, `README.md`, `docs/system-architecture.md`,
`docs/design-guidelines.md`, `docs/sgsdeck-catalog.md`, docs navigation của README,
`docs/mcp-research-server.md`, active season owner changes trước shared edits.

**Modify/planned:** tests trong TDD/commands; minimal proven consumer fixes;
`mcp-worker/workflow-source-manifest.json` nếu actual import closure đổi,
`mcp-worker/src/generated/workflow-build.ts`; `README.md`,
`docs/system-architecture.md`, `docs/design-guidelines.md`, `docs/sgsdeck-catalog.md`
cho links/changed source-validation workflow; `docs/mcp-research-server.md` nếu builder
input inventory workflow đổi. Đọc từng doc trước sửa, chỉ owning sections.

**Create/planned:** `docs/unified-lookup.md` giải thích input/review/build/validate/
promote/recover, ID/translation/generation contracts và source-private boundary;
`reports/compatibility-validation.md` và `reports/lookup-handoff.md` trong plan này
khi execution tạo evidence. **Delete:** none. Không chạm historical fixtures,
season plan files, scores hoặc project changelog chỉ để ghi phase complete.

## Implementation Steps

1. [ ] Read current owner mùa diff và actual manifests, reconcile phase contracts
   trước broad run; pin tested code/data/generation hashes and known WIP.
2. [ ] Add missing consumer/stale binding/public leak regression cases, run Red
   đúng assertion; fix cause in narrow owner, rerun Green then Refactor.
3. [ ] Trước đổi expectation, split `tests-js/tactics-data.test.mjs`: historical
   screenshot assertions đọc byte-pinned `pipeline/lookup-inputs/tactics.json`
   của Phase 1, giữ nguyên literal expected values; current-generation assertions
   vẫn đọc `data/tactics.json`. Historical input này là planned baseline, chưa có
   separate fixture ở current tests. Với current artifacts, update only SGSDeck-winning expectations
   được exact source/translation evidence xác nhận; archive why each changed,
   giữ numeric/identity assertions mạnh, không blanket rewrite or weaken tests.
4. [ ] Run focused closure rồi full root/Python/MCP checks. Capture actual counts,
   commands, failures; environmental block không tính Red hoặc validation pass.
5. [ ] Rehearse interrupted promotion, recovery and generation mismatch on temporary
   exact owned paths; verify data **và activation code/config/tests** bytes/absences
   restored, existing WIP sentinel untouched, later shared-file edits conflict.
   Validate current season refs against rollback target before mutation; test
   certified G1 → dependent season config → G0 rollback must stop if orphaning.
6. [ ] Inspect real six-group UI desktop/mobile/light/dark, last children and
   keyboard; compare public output to all reviewed source-field dispositions.
7. [ ] Update owning docs, verify links/commands against implemented help, add
   handoff evidence and baseline→candidate semantic diff. Không duplicate schema
   detail vào mọi doc; link machine-owned validators/manifests.
8. [ ] After all gates, mark generation accepted locally and retain rollback
   artifacts per documented policy; hand season owner certified generation/ID set.
   Provisional Phase 3 IDs chưa được dùng để publish dependent configurations;
   baseline-only season work không bị chặn. No deployment/commit performed implicitly.

## TDD Red → Green → Refactor

| Slice/test owner | Red assertion | Green | Refactor invariant |
|---|---|---|---|
| Scan/roster state | Old IDs/import lost; ambiguous aliases auto-confirm | Old storage works/review preserved | Same old candidates |
| Tracker/faction | New name overwrites history or old name loses faction | Additive options/history preserved | No storage schema drift |
| Engine/MCP adapter | Catalog-only entity creates team/score | Corpus/config remains authority | Browser/MCP parity |
| MCP data/research | Duplicate ID accepted or stale cursor works | Strict IDs/release binding | Same 8 tools/four kinds |
| Filesystem CLI/stdio | Partial generation minted thành release | Same verified buffers, legacy branch explicit | Restart adopts new release; no hot reload |
| Source graph/workflow | Semantic helper unversioned | Exact closure/regeneration | Generator --check clean |
| Worker/public artifacts | Private path emitted, wrong version count accepted | Exact composed inventory | Historical v1 bytes fixed |
| Recovery | WIP/code/dependent refs damaged | Bound code+data checkpoint, dependency preflight | Before/after bytes exact, fail before partial restore |
| Current VN artifact tests | Old translation masks new selected mechanics | Evidence-backed expectations | Immutable old fixtures intact |

Narrow regression commands (root CWD):

```bash
node --test tests-js/roster-scan-state.test.mjs tests-js/roster-scan-map.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/recruit-tracker-ui.test.mjs tests-js/derive-team-faction.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/tactics-data.test.mjs
npm --prefix mcp-worker test -- test/data test/domain test/research/research-handlers.test.ts test/mcp/registry.contract.test.ts test/transport/all-tools-parity.test.ts test/e2e/team-research-workflow.test.ts test/release/build-worker-assets.test.ts test/release/docs-static-assets-contract.test.ts test/release/workflow-release-contract.test.ts test/release/verify-release.test.ts
npm --prefix mcp-worker test -- test/cli.integration.test.ts test/transport/stdio.integration.test.ts
python3 -m unittest tests.test_unified_lookup_identity tests.test_lookup_translations tests.test_build_unified_lookup tests.test_promote_unified_lookup
```

Broaden once focused Green because dictionaries/shared contracts changed:

```bash
python3 -m unittest discover -s tests
npm run test:node
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:dev-contract
npm run test:e2e:astro
npm --prefix mcp-worker run generate:workflow-build
npm --prefix mcp-worker run check
npm --prefix mcp-worker run test:worker
```

Worker packaging/verify/dry-run chỉ khi đúng approved source sạch và prerequisites
thật: inspect live script help rồi dùng `build:worker-assets`, `verify:worker-assets`,
`verify:release`, `deploy:dry-run` actual flags. Dirty main hiện chưa đủ; ghi
`environment blocked/not run` nếu vẫn thiếu, không create fake assets/bypass guard.
Không `release:worker`/deploy; publication cần scope/authorization riêng.

## Success Criteria and handoff

- [ ] All six groups + reviewed children complete, no misleading pending/links.
- [ ] ID/name/storage/engine/MCP canaries and broad tests pass with saved evidence.
- [ ] No source leakage, generation recovery and exact inventories verified.
- [ ] Docs cover real commands, regeneration triggers, baseline/source ownership.
- [ ] Handoff lists tested hashes, intentional deltas, unresolved identity reasons,
  translation coverage, rollback location, season-owner dependency and any release block.

Unexpected broad regression after promotion: stop acceptance, restore previous
generation/code checkpoint **chỉ sau full WIP/dependent-ref preflight**; conflict
thì stop và phối hợp owner hoặc fix forward trước mọi restore. Fix private candidate and repeat affected
gates. Do not claim complete while required behavioral checks remain unresolved.
Clean-source release blocks are reported separately from feature test evidence.
No open product decision; genuine unavailable game evidence explained in Vietnamese.
Stop all task-owned servers/runners; preserve user/other-session processes and WIP.
