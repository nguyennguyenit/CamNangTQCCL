---
title: "Phase 4: Tương thích, chứng nhận và bàn giao"
status: completed
---

# Phase 4: Tương thích, chứng nhận và bàn giao

## Overview

Trạng thái **completed**; [Phase 3](phase-03-unified-lookup-interface.md) đã
hoàn tất. Phase này đã kiểm toàn bộ consumer/release contracts, cập nhật docs
đúng owner, đóng evidence và rollback rehearsal. Không thêm MCP tools/kinds,
không deploy.
[Plan](plan.md), [consumer research](reports/research-consumers.md),
[data research](reports/research-data.md), [plan mùa](../260907-0233-season-team-lookup/plan.md).

<!-- Updated: Audit Session 2 - combined publication and dependent evidence gates -->

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
| 13 | completed Team browser worktree `src/lib/recommended-reference-artifacts.ts`, `src/pages/index.astro`, `scripts/verify-astro-dist.mjs` | Scoped selected generation, HTML pin and source attribution are existing release contracts. |
| 14 | completed worktree `pipeline/recommended-identity-map.json:7409–7414` | Bridge pins exact hero/tactic evidence hashes; dictionary promotion requires impact disposition. |

## Requirements và consumer closure

MCP compatibility-only: tám tools, kinds hero/tactic/team/book, observation
hero/tactic/team, existing bounded search/result/transport contracts giữ nguyên.
Bốn nhóm mới website-only không vào ownedHeroes/ownedTactics, không thành
team/tier/recommendation. Existing search trả identity không tự được hứa trả
merged stats/detail. New IDs searchable khi thuộc two dictionary arrays; lookup
availability không tự bypass season/config applicability hoặc suy đội hợp lệ.
Filesystem ingress phải accept both coherent raw lookup roots and exact packaged
MCP release roots; website sidecars never become MCP search kinds/artifacts.

| Consumer owner/current files | Acceptance và change khi cần |
|---|---|
| `js/analyze-map.js`, `js/analyze.js`, `tests-js/analyze-map.test.mjs` | Legacy scan map cùng IDs; CJK aliases cải thiện đúng entity, ambiguity vẫn yêu cầu review; không đổi provider/upload scope. |
| `js/roster-scan-map.js`, `js/roster-scan-state.js`, `js/roster-recommend-ui.js` | Old import/state/manual names usable; new variants không auto-confirm runner-up; không storage migration chỉ để lookup. |
| `js/recruit-tracker.js`, `js/recruit-tracker-store.js` | Options có new names; lịch sử/export/import cũ nguyên nghĩa, không rename stored events. |
| `js/derive-team-faction.js`, `js/team-pk.js` | Mọi old hero name còn resolve phe; intentional source faction delta có evidence và regression, không cập nhật tiers. |
| `js/team-recommend-engine.js`, `js/filters.js`, `js/render.js`, `js/meta-cu.js` | Cùng old roster/team corpus giữ candidates/selection; new catalog-only entries không tạo teams/scores. |
| `mcp-worker/src/data/{artifact-contracts,entity-identity,snapshot-index}.ts` | JSON id = actual canonical helper, duplicate namespace reject, aliases bounded and display IDs stable. |
| `mcp-worker/src/data/filesystem-data-source.ts` → `src/cli.ts`, `src/stdio.ts` | Exact raw lookup roots and packaged MCP manifests both verify; partial/mixed roots fail DATA_UNAVAILABLE, genuine legacy roots still load; cached process snapshot stays immutable. |
| `mcp-worker/src/domain/{legacy-domain-adapter,normalization-service,recommendation-service,canonical-state}.ts` | Browser/MCP parity, base/SP/CO unchanged, 40Y shared other đúng ID/family; stale confirmation invalidated per actual workflow/release version. |
| `mcp-worker/src/research/{research-contracts,research-handlers}.ts`, MCP registry/transports | Same tool schemas/kinds; no detailed four-catalog API; stale cursors/releases rejected under existing contract. |
| `pipeline/build_dict.py`, `pipeline/query_sgsdeck_catalog.py`, `pipeline/suggest_team_tier.py` | Guard old writer; original 79 refs still resolve current dictionaries; source query unchanged. Tier script input compatibility only, không run/promote new tiers. |
| Completed Team browser (`recommended-reference-*`, scoped routes, `app.js`, `index.astro`) | Team chuẩn default, old aliases, source links, selected generation/pin, scoped bytes and per-surface history remain exact after lookup integration. |
| Recommended identity bridge | Compare promoted identity/display/faction semantics to pinned evidence; bind unchanged decisions to frozen evidence or owner re-reviews and rebuilds dependent dedup/generation. |
| Season publisher owner | Shared exclusion spans dictionary validation through seasonal replace; paused G1 publisher aborts after G0 rollback. |

Bảng là validation closure, không mặc định sửa mọi file. Chỉ sửa adapter/helper
khi test chứng minh regression thuộc catalog; shared season behavior coordinate
owner trước edit. Không nới test threshold hoặc silently undo user source priority.

## Release/publication closure

- Phase 3 added `lookup-data`, `unified-lookup`, `lookup-detail`,
  `lookup-catalog`, `lookup-manifest` to the root public manifest while retaining
  Recommended JS entries. Root routes/tree and `scripts/verify-astro-dist.mjs`
  must see exact root generation **plus** completed scoped Recommended generation.
- Build proof compares emitted hero/tactic bytes to both lookup manifest and
  embedded `#season-artifact-hashes`; preserve `#recommended-publication`, selected
  current bytes, scoped manifest/payload hashes and source links. Inject
  HTML(G0) → promotion(G1) → routes(G1); build must reject it.
- Source-hidden checks scope to unified catalog projections/UI, not every public
  feature. For catalog arrays/lookup-catalog, forbid provider/sourceUrl/provenance/
  sourceRecordId/sourceSnapshot/raw source attribute objects. Existing vetted
  `iconUrl` remains asset contract. Approved Team chuẩn/Team khác `sourceUrl`,
  source label/score/region and gameplay acquisition `source` remain under their
  own validated contracts; do not remove or relabel them.
- Dev route, built dist and preview do not serve `data/sgsdeck`, `pipeline/lookup-*`,
  ledger/review/baseline/journal. Phase 1 already installed present-file deny;
  rerun direct URL, `/@fs`, raw/module query, symlink and traversal regressions
  while positive-testing root and scoped Recommended routes.
- Worker raw source root accepts exact website-only basenames + checked private
  subtree, but emitted inventory stays active MCP version. Packaged MCP
  `manifest.json` + six/eleven artifacts is an explicit FilesystemDataSource
  format accepted by CLI/stdio even when dictionary records have lookup fields.
  Preserve v1 fixture bytes.
- `mcp-worker/workflow-source-manifest.json` covers actual runtime semantic imports.
  Add `filesystem-data-source.ts` as entrypoint and `js/lookup-data.js` only through
  exact transitive closure; no orphan semanticFile/duplicate buildInput.
- Regenerate `mcp-worker/src/generated/workflow-build.ts` when semantic files
  change, then check. Hero/tactic byte changes create a new data releaseId; never
  fake old release hash or overwrite historical fixtures.
- Before certification, compare completed Recommended bridge evidenceInputs with
  promoted dictionaries. If alias/identity/display/faction semantics changed,
  owner re-reviews affected entries and rebuilds mapping-dependent ledger/
  generation; otherwise record immutable historical evidence binding. A map/ledger
  hash pair alone is not proof against current dictionary evidence.

## Related Code Files

**Read/current:** full consumer closure, `README.md`, `docs/system-architecture.md`,
`docs/design-guidelines.md`, `docs/sgsdeck-catalog.md`, `docs/mcp-research-server.md`;
completed Team browser `js/{app,recommended-reference-state,recommended-reference-render}.js`,
`src/lib/recommended-reference-artifacts.ts`, scoped routes/generation, validation
report and identity bridge; active season owner changes before shared edits.

**Modify/planned:** tests/commands; minimal proven consumer fixes;
`mcp-worker/workflow-source-manifest.json` if actual import closure changes,
generated workflow build; owning README/architecture/design/catalog docs and MCP
docs only when their real contract changed. Shared app/publication fixes apply on
the integrated completed baseline, not stale main.

**Create/planned:** `docs/unified-lookup.md` giải thích input/review/build/validate/
promote/recover, ID/translation/generation contracts và source-private boundary;
`reports/compatibility-validation.md` và `reports/lookup-handoff.md` trong plan này
khi execution tạo evidence. **Delete:** none. Không chạm historical fixtures,
season plan files, scores hoặc project changelog chỉ để ghi phase complete.

## Implementation Steps

1. [ ] Pin integrated completed Team baseline, actual manifests, lookup generation,
   Recommended selected generation/map hashes, code/data preimages and known WIP.
2. [ ] Add missing consumer, packaged-MCP, stale-binding, combined-publication,
   paused-season-publisher and public-leak Reds; fix narrow owner seams.
3. [ ] Before changing tactic expectations, split historical screenshot assertions
   onto Phase 1 frozen tactics input; current assertions read promoted data and
   change only with exact selected-source/translation evidence.
4. [ ] Run focused closure then full root/Python/MCP checks. Capture commands,
   counts and failures; environmental block is not Red or validation pass.
5. [ ] Rehearse interrupted activation/promotion/recovery with old-code writer
   already running; verify data + code/config/tests restored and unrelated WIP
   untouched. Exercise lock-without-journal explicit recovery.
6. [ ] Rehearse certified G1 → season publisher validates G1 and pauses → lookup
   rollback G0 → publisher resumes; final generation check must abort before write.
7. [ ] Compare Recommended bridge semantics/hashes. Preserve frozen evidence or
   coordinate re-review/rebuild; prove selected scoped bytes/pin/source links and
   Team khác membership do not silently drift.
8. [ ] Build with injected HTML(G0) → complete promotion(G1) → data routes(G1);
   verifier rejects. Build stable generation and prove root + scoped exact inventory.
9. [ ] Inspect real six-group UI plus Team chuẩn/Team khác desktop/mobile/light/dark,
   last children, keyboard, aliases, Back/Forward and source links.
10. [ ] Update owning docs, add compatibility/handoff evidence and baseline→candidate
    semantic diff; link machine-owned validators/manifests instead of duplicating.
11. [ ] After all gates, mark generation accepted locally, retain rollback artifacts
    per policy and hand season/Recommended owners certified generation/ID/evidence
    disposition. No deployment/commit performed implicitly.

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
| Completed Team browser | Lookup drops router state, source link or scoped pin | Combined router/publication exact | Selected Recommended bytes unchanged or explicitly rebuilt |
| Recommended bridge | Old dictionary hashes treated current | Frozen evidence or reviewed rebuild | No stale attestation accepted by map+ledger alone |
| Season publisher race | G1 validation publishes after G0 rollback | Shared exclusion + final generation check | Abort before seasonal mutation |
| Astro build generation | HTML hashes G0, routes G1 | One publication snapshot or fail | Season + lookup + Recommended pins exact |
| MCP package ingress | Valid `.worker-assets` becomes DATA_UNAVAILABLE | Exact package-manifest branch | Raw mixed roots still reject |

Narrow regression commands (root CWD):

```bash
node --test tests-js/roster-scan-state.test.mjs tests-js/roster-scan-map.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/recruit-tracker-ui.test.mjs tests-js/derive-team-faction.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/tactics-data.test.mjs
npm --prefix mcp-worker test -- test/data test/domain test/research/research-handlers.test.ts test/mcp/registry.contract.test.ts test/transport/all-tools-parity.test.ts test/e2e/team-research-workflow.test.ts test/release/build-worker-assets.test.ts test/release/docs-static-assets-contract.test.ts test/release/workflow-release-contract.test.ts test/release/verify-release.test.ts
npm --prefix mcp-worker test -- test/cli.integration.test.ts test/transport/stdio.integration.test.ts
python3 -m unittest tests.test_unified_lookup_identity tests.test_lookup_translations tests.test_build_unified_lookup tests.test_promote_unified_lookup
node --test tests-js/recommended-reference-state.test.mjs tests-js/recommended-reference-artifacts.test.mjs
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
- [ ] Completed Team browser selected generation, source attribution, aliases and history preserved.
- [ ] Recommended bridge evidence disposition and season publisher exclusion recorded.
- [ ] Stable Astro build pins season/lookup/Recommended generations; interleaving build rejects.
- [ ] CLI/stdio load a valid packaged MCP release and reject mixed raw lookup roots.

Unexpected broad regression after promotion: stop acceptance, restore previous
generation/code checkpoint **chỉ sau full WIP/dependent-ref preflight**; conflict
thì stop và phối hợp owner hoặc fix forward trước mọi restore. Fix private candidate and repeat affected
gates. Do not claim complete while required behavioral checks remain unresolved.
Clean-source release blocks are reported separately from feature test evidence.
No open product decision; genuine unavailable game evidence explained in Vietnamese.
Stop all task-owned servers/runners; preserve user/other-session processes and WIP.

## Completion evidence — 2026-09-13

- Accepted local generation `lookup:de73c4ca235de9b4ba6dbc5679573a3bab623a93ea6b061f0d30ad5f12c101e8`;
  exact hashes, counts, bridge disposition and rollback location are in
  [compatibility validation](reports/compatibility-validation.md) and
  [handoff](reports/lookup-handoff.md).
- Broad results: Python 283 passed/12 skipped; Node 261 passed; Astro
  check/build/dist/verify/dev contract Green; Chromium E2E 102 passed; MCP check
  373 passed plus coverage/typecheck/build/control-plane; Worker suites 2 + 1 passed.
- Phase 4 Reds found and closed Worker sidecar allowlists, strict MCP filesystem
  ingress, prewrite season generation ordering, first-activation exclusion and
  first-activation dependent-reference recovery. Website sidecars remain excluded
  from emitted MCP inventory.
- Actual preview inspection confirmed 908 searchable parent records at desktop;
  the 320px building view had 41 results, no horizontal overflow and a usable
  level-detail dialog. Automated matrix covers both themes and four viewports.
- Concurrent initial broad runs hit process contention; isolated reruns passed
  without timeout changes. Debugger and docs-manager agent invocations were blocked
  before execution by provider HTTP 429; direct reproductions, code review, tester
  and advisory gates supply the recorded evidence.
- No deploy, Worker release or production promotion was performed or authorized.
