---
title: "Sửa lỗi theo review toàn codebase"
description: "Xử lý đủ 109 finding của 6 báo cáo review (JS lõi, công cụ, Astro/CSS, UI live, pipeline, Worker/MCP) theo 7 phase, test trước mỗi lỗi, giữ gate bản dịch xanh."
status: in-progress
priority: P1
effort: "18.5d"
branch: main
tags: [bugfix, frontend, pipeline, worker, mcp, refactor, hygiene]
blockedBy: []
blocks: []
created: 2026-09-26
---

# Sửa lỗi theo review toàn codebase

## Contract / Outcome

Nguồn chuẩn là 6 báo cáo trong [reports/](./reports/): `review-ReviewJsCore.json` (15 finding), `review-ReviewJsTools.json` (25), `review-ReviewAstroCss.json` (21), `review-AuditUiLive.json` (13), `review-ReviewPipeline.json` (20), `review-ReviewWorkers.json` (15). Tổng **109 finding**. Plan ghi finding theo dạng `<Báo cáo>#<số thứ tự trong mảng findings>`, ví dụ `AuditUiLive#3`.

- **Outcome:** mọi finding hoặc được sửa (có test đỏ trước, xanh sau với lỗi hành vi), hoặc được xoá/dọn (dead code, docs, hygiene) có kiểm bằng build + bộ test hiện có + contract dist, theo các quyết định đã chốt ngày 2026-09-27 (mục "Quyết định đã chốt"). Không finding nào bị bỏ lặng lẽ.
- **Ràng buộc:** giữ URL/handle đã đóng băng (`pipeline/team-route-handles.json`), giữ gate bản dịch `check --stage public` xanh ở mọi commit, không tự đổi chữ của obligation `translate`, không deploy.
- **Không làm:** xem mục "Không làm".

### Kiểm lại bằng chứng trên cây làm việc 2026-09-26

Mọi đường dẫn và dòng trích trong các phase đã grep lại trên cây hiện tại (35 file `M`, 3 thư mục generation chưa track). Chỗ lệch so với báo cáo, đã sửa theo trong phase:

1. **ReviewJsCore#13 sai nguyên nhân.** 6 thẻ `yxms-002/004/005/006/007/008` không thiếu bản dịch: cả 6 là đội 2 tướng ở nguồn, slot thứ ba được parser đệm `{"nameRaw": "", "slotState": "source-empty"}` (`pipeline/sgsdeck_recommended.py:246-249`); `js/` không xử lý `slotState` (grep 0 kết quả) nên `recommended-reference-render.js:6-14` in `UNAVAILABLE`. Sửa ở renderer (Phase 3), không sửa dữ liệu dịch.
2. **AuditUiLive#1 hẹp hơn báo cáo.** `selectedTactics`/`usedAlternatives` mang tên hiển thị (`slot.primary`, `choice.name`, `js/team-recommend-engine.js:199-205,235-239`); chỉ `missingHeroes` là ID canonical (`:145-148,602-610`).
3. **AuditUiLive#13:** tên có `（）` đến từ `teamDisplayNames` của `pipeline/recommended-identity-map.json` qua `resolve_team_display_name` (`pipeline/recommended_identity.py:113-128`); ledger `site-translations.json` có 0 mục chứa `（）`. Hiện có 100 lần xuất hiện (50 trong `index.json`, 50 trong `details-*.json`) của generation đang pin.
4. **ReviewAstroCss#3:** 7 đội bị dấu kết hợp là `moi-phe-72, 86, 113, 114, 115, 116, 133` (22 dòng, đúng các dòng báo cáo). Cả 7 đang `pendingIdentity / unresolved-local-primary` trong `pipeline/recommended-other-teams.json`, nên sửa tên có thể đổi phân loại và đưa đội vào danh sách Đội khác.
5. **ReviewJsTools#6:** tra từ điển thật: `SP Hoàng Phổ Tung` → có `SP Hoàng Phủ Tung`; `SP Đổng Trách` → `SP Đổng Trác`; `Thịnh Khí` → `Thịnh Khí Linh Địch`; `Tinh·Phong Thi Trận` → gần nhất `Phong Thi Trận`; `SP Lô Trực`, `Tiêu Chỉ`, `Đồng Tâm Hiệp Lực` **không có** bản ghi nào trong `data/heroes-dict.json`/`data/tactics.json` (không phải lỗi gõ); `Bái Sư …` là tiền tố `VARIANT_PREFIX` không biết (`js/hero-identity.js:5`).
6. **Dòng lệch:** `js/team-detail.js:146` (báo cáo ghi 144); `js/analyze-map.js:162,172,202` (ghi 158); `pipeline/hanviet.py:135` (ghi 131); `src/layouts/SiteLayout.astro:306,321` nút theme (ghi 312, 325), `:364` `#season-controls` (ghi ~367), `:209-212` thẻ `og:` (ghi 223-230); `js/app.js:385` select Mùa (ghi 396), `:508-512` khối catch; `css/styles.css:4087-4094` `.detail-header`.
7. **Phát hiện thêm khi kiểm gate:** (a) `mcp-worker/workflow-source-manifest.json` băm 10 file `js/` (`analyze-map, filters, hanviet, hero-identity, lookup-data, match-dict, roster-scan-map, roster-scan-state, season-context, team-recommend-engine`) — sửa file nào phải sinh lại `mcp-worker/src/generated/workflow-build.ts`; (b) `DATA_INVENTORY_OWNERS` gán `data/coexist.json` cho `js/render.js::coexistGroup` là hàm chết (`pipeline/site_localization.py:188`); (c) hai obligation `translate` `ui:season/tier-sort`, `ui:season/tier-label` thuộc hàm chết `createSeasonTeamSection` (`site_localization.py:281-282`); (d) `worker/src/schema.ts` và `src/lib/team-detail-routes.ts` nằm trong `sourceFiles`; (e) cache crawler Recommended mà `recommended_team_dedup` cần (`.cache/sgsdeck-recommended`, `docs/season-team-data.md:86-90`) **không có** trên máy — ảnh hưởng Q4; (f) `tests-e2e/spa-parity.spec.mjs:1159-1192` ghim tagline bị cắt ở 320px, phụ thuộc độ dài chữ.

**Không chạy lại được trong lúc lập plan** (cần build + trình duyệt, hoặc là suy luận của reviewer): số đo thời gian/khoảng cách/màn hình của AuditUiLive (ảnh ở `/tmp/ui-audit/` không còn), số lần trùng `<title>` của ReviewAstroCss#8, số lệch đếm của ReviewJsTools#7, thời gian CPU của ReviewWorkers#9, và ba nhận định `[INFERENCE]` (hỗ trợ `v` của Safari ReviewJsCore#1, giới hạn KV ReviewWorkers#1, spec MCP 403 ReviewWorkers#14). Phase tương ứng đo lại trước khi sửa.

## Điều kiện bắt đầu

- Cây làm việc có 35 file `M` (loạt "thẻ đội + lưới 4 cột", bỏ Danh mục, bỏ Mùa ở công cụ — `docs/project-changelog.md` mục 2026-09-26 đang sửa), 3 generation chưa track (`0ddbd034…`, `1a4fd71a…`, `f93a51ea…`), 2 báo cáo research chưa track dưới `plans/reports/`. `current.json` pin `f93a51ea…`. Phase 1 chốt cây này; mọi phase sau bắt đầu từ cây sạch.
- Gate bản dịch trên cây hiện tại: `inventory` báo 0 file stale, 0 location lạ, 2088 site obligation, 5591 tổng (chạy 2026-09-26); ReviewPipeline ghi `check --stage public` exit 0 và `team_route_handles --check` pass.
- Q1–Q7 và Q4b **đã chốt 2026-09-27** (mục "Quyết định đã chốt"). Không còn việc bị chặn bởi quyết định; điểm dừng duy nhất còn lại là người dùng duyệt diff `pipeline/recommended-other-teams.json` trước khi publish ở Phase 2 bước G.

## Bảng phase

| # | Phase | Finding | Phụ thuộc | Effort |
|---|---|---|---|---|
| 1 | [Chốt working tree](./phase-01-chot-working-tree.md) | AstroCss#4 (phần generation chưa track/orphan) | — | 0.5d |
| 2 | [7 lỗi nặng](./phase-02-loi-nang.md) | JsCore#1; JsTools#1–#6; AuditUiLive#1; Workers#2; AstroCss#3 | 1 | 3.5d |
| 3 | [UI/UX và lỗi logic giao diện](./phase-03-ui-ux.md) | AuditUiLive#2–#13; JsCore#5,#6,#8,#9,#10,#13,#14; JsTools#7–#17,#24; AstroCss#5,#6,#8,#11,#12,#13,#14,#19,#21 | 2 | 5d |
| 4 | [Xoá code chết](./phase-04-xoa-code-chet.md) | JsCore#2,#3,#11,#12,#15; JsTools#18–#23; AstroCss#1,#2,#9,#10,#15,#16; Workers#6,#7,#8; Pipeline#8–#13 | 3 | 2.5d |
| 5 | [Hiệu năng runtime](./phase-05-hieu-nang.md) | JsCore#4,#7; JsTools#25 | 4 | 1.5d |
| 6 | [Worker + MCP](./phase-06-worker-mcp.md) | Workers#1,#3,#4,#5,#9–#15 | 5 | 2.5d |
| 7 | [Pipeline, CI, hygiene, docs](./phase-07-pipeline-ci-docs.md) | Pipeline#1–#7,#12 (phần docs),#14–#20; AstroCss#4 (prune),#7,#14 (phần docs),#17,#18,#20; JsCore#15, JsTools#19 (phần docs còn lại) | 6 | 3d |

**Chạy tuần tự 1 → 7.** Không phase nào chạy song song được: Phase 2–7 đều sửa `pipeline/site-localization-policy.json` (hash `sourceFiles`) rồi publish generation mới + re-pin `pipeline/team-route-handles.json`; Phase 2, 3, 6 cùng sửa `js/roster-recommend-ui.js`, `js/analyze.js`; Phase 3, 4, 5 cùng sửa `js/app.js`, `js/team-filter-section.js`; Phase 4 và 6 cùng sửa `worker/src/guard.ts`.

### Bảng ánh xạ finding → phase (109/109)

| Báo cáo | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 |
|---|---|---|---|---|---|---|---|
| ReviewJsCore (15) | — | 1 | 5, 6, 8, 9, 10, 13, 14 | 2, 3, 11, 12, 15 (bảng module) | 4, 7 (phần dead ở P4) | — | 15 (docs còn lại) |
| ReviewJsTools (25) | — | 1, 2, 3, 4, 5, 6 | 7–17, 24 | 18–23 | 25 | — | 19 (số liệu docs) |
| ReviewAstroCss (21) | 4 (phần 1) | 3 | 5, 6, 8, 11, 12, 13, 14, 19, 21 | 1, 2, 9, 10, 15, 16 | — | — | 4 (prune), 7, 14 (docs), 17, 18, 20 |
| AuditUiLive (13) | — | 1 | 2–13 | — | — | — | — |
| ReviewPipeline (20) | — | — | — | 8, 9, 10, 11, 12 (xoá hàm), 13 | — | — | 1–7, 12 (docs CLI), 14–20 |
| ReviewWorkers (15) | — | 2 | — | 6, 7, 8 | — | 1, 3, 4, 5, 9–15 | — |

Finding trùng nhau được sửa một lần: JsTools#1 = Workers#2; JsTools#5 = AuditUiLive#1; JsTools#8 = AuditUiLive#9; AstroCss#5 = AuditUiLive#4; AstroCss#1 ⊃ JsTools#18 ⊂ JsCore#2; AstroCss#2 ⊂ JsCore#3; AstroCss#9 ≈ JsTools#19 ≈ JsCore#15.

## Chiến lược test-first

1. **Lỗi hành vi (logic, ui-ux, a11y có hành vi):** viết test trước theo convention sẵn có, chạy để thấy **đỏ đúng lý do** ghi trong phase, rồi mới sửa, chạy lại thấy xanh, commit test cùng bản sửa. Test khẳng định hành vi người dùng/consumer thấy được: nội dung hiển thị, URL/lịch sử, focus, dữ liệu lưu, request mạng, mã HTTP, output JSON.
2. **Chỗ đặt test:** logic thuần → `tests-js/<module>.test.mjs` (`node --test`); luồng trình duyệt → `tests-e2e/<mặt>.spec.mjs` (Playwright, stub Turnstile/Worker như `tests-e2e/beta-tools.spec.mjs:17-28,198-211`); Python → `tests/test_<module>.py` (`unittest`); Vision Worker → `worker/test/<module>.test.ts` (vitest); MCP → `mcp-worker/test/<vùng>/<module>.test.ts` (vitest).
3. **Miễn test-first:** xoá code chết (Phase 4), docs, dọn repo (Phase 1, phần hygiene/docs của Phase 7). Kiểm bằng `npm run check`, `npm run build`, `npm run verify`, `npm run test:dist`, bộ test hiện có và contract dist. Test chỉ phủ code bị xoá thì xoá cùng.
4. **Cấm:** test ghim chữ nguồn, wiring, danh sách tên method, việc một module không còn tồn tại, giá trị mặc định ngẫu nhiên, hoặc tautology. Test hiện có thuộc loại này (ví dụ `mcp-worker/test/domain/legacy-domain-adapter.test.ts:40-58` ghim danh sách method, test `requiresConfirmation` luôn `true`, `tests-js/team-recommend-engine.test.mjs:315-317` ghim hằng mặc định, `tests-e2e/spa-parity.spec.mjs:1182` ghim `clipped: true`) phải xoá hoặc viết lại theo hành vi, không ghim lại.
5. **Lỗi không tạo được test đỏ tự nhiên** (tối ưu hiệu năng không đổi output, bảo toàn hành vi): ghi rõ trong phase, dùng test bảo toàn hành vi có sẵn + script đo tạm (xoá sau khi ghi số vào báo cáo phase).
6. **Test tương thích trình duyệt (Phase 2):** Node 24 và Playwright (Chromium/WebKit mới) đều hỗ trợ cờ `v`, nên không có engine nào để chạy test hành vi đỏ. Test mới kiểm cam kết "mọi module JS phát hành chạy được trên engine ES2022 (Safari 16)" bằng bộ kiểm TypeScript (diagnostic 1501, đã chạy thử: `js/season-context.js` → `1501: This regular expression flag is only available when targeting 'es2024' or later.`). Đây là contract tương thích của sản phẩm, không ghim chữ nguồn.

## Gate bản dịch và các chuỗi hash

`npm run check`, `npm run build`, `npm run verify` đều chạy `python3 -m pipeline.site_localization check --root . --stage public` trước (`package.json` scripts). Cơ chế đã đọc trong `pipeline/site_localization.py`:

- **Hash file nguồn:** `policy.sourceFiles` (53 file, hex sha256 không tiền tố) so với byte trên đĩa; lệch → `stale` → problem, check đỏ (`site_localization.py:1006-1017,2263-2265`). Các file sẽ bị sửa trong plan và đang bị ghim: `js/analyze.js`, `js/analyze-map.js`, `js/app.js`, `js/detail-actions.js`, `js/khaihoang-detail.js`, `js/lookup-detail.js`, `js/recommended-reference-render.js`, `js/recommended-reference-state.js`, `js/recruit-tracker.js`, `js/recruit-tracker-store.js`, `js/render.js`, `js/roster-recommend-ui.js`, `js/roster-scan-state.js`, `js/site-chrome.js`, `js/team-detail.js`, `js/team-detail-navigation.js`, `js/team-filter-section.js`, `js/unified-lookup.js`, `js/website-display.js`, `src/layouts/SiteLayout.astro`, 8 trang `src/pages/*/index.astro`, `src/pages/doi-chuan/[team].astro`, `src/pages/doi-khac/[team].astro`, `src/lib/team-detail-routes.ts`, `worker/src/schema.ts`, `data/teams.json`.
- **Chữ UI:** mỗi tuple trong `UI_LITERAL_OBLIGATIONS` (`site_localization.py:267+`, 462 tuple) phải có mặt trong đúng file: tuple có phần tử thứ 8 (binding) phải giữ **nguyên văn** biểu thức; tuple không binding phải còn chữ gốc hoặc `textVi` đã duyệt (`:1626-1660`). Thiếu → `reviewed UI source expression is missing`.
- **Inventory:** số và digest location cụ thể (gồm owner `file::symbol` và phân loại, **không** gồm chữ) phải khớp `baseline.notes.concreteLocationCount/concreteInventorySha256` (hiện 56657 / `51d6454e…`, `:2301-2305`). Thêm/bỏ tuple, đổi owner → phải cập nhật baseline. Đổi chữ của tuple `authored-vi` không đổi inventory.
- **Receipt:** chỉ lớp `translate` cần receipt độc lập. **Đổi chữ hoặc dời file/symbol** của tuple `translate` làm fingerprint (gồm `sourceFile`, `ownerSymbol`, `:1756-1770`) mất hiệu lực → **dừng, hỏi người dùng**. **Bỏ** tuple `translate` không cần receipt mới: xoá tuple + mục ledger + item trong batch receipt (tiền lệ plan `260923-1949` Phase 2 bước 9).
- **Generation:** policy thuộc `localizationInputsHash` (`:1904-1918`) nên mọi lần đổi policy (kể cả chỉ hash) sinh generation Recommended mới + `data/website-display.json` mới; `check --stage public` dựng lại toàn bộ và so byte (`:2071-2091`). Code pipeline ảnh hưởng output (`pipeline/recommended_identity.py`, `pipeline/build_recommended_reference.py`) cũng làm public check đỏ cho tới khi publish lại.
- **Chuỗi hash dữ liệu `data/teams.json`:** `data/website-display.json.sourceHashes` (8 file `data/`), `policy.sourceFiles`, `pipeline/recommended-other-teams.json.localTeamsSha256` (builder từ chối nếu lệch, `pipeline/build_recommended_reference.py:137-139`), generation `manifest.legacyTeamsHash`, `pipeline/team-route-handles.json.legacyTeamsSha256` (`pipeline/team_route_handles.py:506-510`, `src/lib/team-detail-routes.ts:198-216`). Handle trong ledger **không sinh lại** (`--write` từ chối ledger đã có).
- **MCP workflow build:** `mcp-worker/workflow-source-manifest.json` khai `semanticFiles` = bao đóng import của 4 entrypoint; `npm run check` (mcp-worker) chạy `check:workflow-build` so `WORKFLOW_BUILD_ID` với hash nội dung (`mcp-worker/scripts/generate-workflow-build.ts:146-172,222-228`). Sửa file thuộc bao đóng → `npm --prefix mcp-worker run generate:workflow-build`; đổi import (thêm/bớt file khỏi bao đóng) → sửa `semanticFiles` trước.

### Quy trình G0–G7 (bắt buộc ở mọi phase sửa file bị ghim, tuple hoặc dữ liệu)

- **G0 — trước khi sửa một file:** liệt kê tuple của nó và ghi vào báo cáo phase:
  `python3 -c "from pipeline.site_localization import UI_LITERAL_OBLIGATIONS as U; [print(o) for o in U if o[3]=='<đường-dẫn>']"`. Tuple `translate` phải giữ nguyên văn (hoặc `textVi` đã duyệt); chữ mới đặt ngoài chuỗi đó.
- **G1 — khai chữ mới:** chữ tiếng Việt mới trong UI → thêm tuple `authored-vi` vào `UI_LITERAL_OBLIGATIONS` (owner đúng `file`, `symbol`, trạng thái); đổi chữ tuple `authored-vi` → sửa phần tử thứ 3 của tuple; bỏ chữ → xoá tuple (`translate`: xoá cả mục ledger `pipeline/site-translations.json` + item trong `pipeline/site-translation-reviews.json`, giữ nguyên file output reviewer).
- **G2 — đo:** `python3 -m pipeline.site_localization inventory --root . --report .cache/site-localization-inventory.json`; đọc `sourceFiles.stale`, `unknownLocationDetails` (chỉ được còn 2 mục `full-site-inventory` count/digest; mục "reviewed UI source expression is missing" là lỗi code phải sửa, không được né), `translation.siteLedgerEntries`, `translation.expectedObligations`.
- **G3 — cập nhật policy bằng script, không sửa tay** (định dạng file là `json.dumps(indent=2, ensure_ascii=False)` + newline, đã kiểm khớp byte):

  ```bash
  python3 - <<'EOF'
  import json
  from pathlib import Path
  from pipeline.site_localization import sha256_hex, UI_LITERAL_OBLIGATIONS
  p = Path("pipeline/site-localization-policy.json")
  policy = json.loads(p.read_text(encoding="utf-8"))
  report = json.loads(Path(".cache/site-localization-inventory.json").read_text(encoding="utf-8"))
  for path in report["sourceFiles"]["stale"]:
      policy["sourceFiles"][path] = sha256_hex(Path(path).read_bytes())
  notes = policy["baseline"]["notes"]
  for item in report["unknownLocationDetails"]:
      if item.get("location") != "full-site-inventory":
          raise SystemExit(f"sửa code trước: {item}")
      key = "concreteLocationCount" if "count" in item["reason"] else "concreteInventorySha256"
      notes[key] = item["actual"]
  notes["siteLedgerObligations"] = report["translation"]["siteLedgerEntries"]
  notes["translationObligations"] = report["translation"]["expectedObligations"]
  notes["uiTranslateObligations"] = sum(o[6] == "translate" for o in UI_LITERAL_OBLIGATIONS)
  policy["policyVersion"] = "site-vi-<yymmdd>-<slug-phase>"
  p.write_text(json.dumps(policy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
  EOF
  ```

  Chạy lại G2: `sourceFiles.stale` và `unknownLocationDetails` phải rỗng. Ghi cũ → mới vào báo cáo phase.
- **G4 — publish** (`docs/season-team-data.md:184-193`): `rm -rf .cache/site-localization-candidate` → `python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate` → `check --root . --stage all --candidate .cache/site-localization-candidate` → `publish --root . --candidate .cache/site-localization-candidate` → `check --root . --stage public` exit 0 → xoá candidate.
- **G5 — re-pin handle:** script đặt `generationId` của `pipeline/team-route-handles.json` = `generationId` mới trong `src/data/recommended-reference/current.json` (nếu `data/teams.json` hoặc `data/khaihoang.json` đổi: thêm `legacyTeamsSha256`/`khaihoangSha256` = `"sha256:" + sha256_hex(bytes)`), ghi cùng định dạng policy → `python3 -m pipeline.team_route_handles --check`.
- **G6 — dọn generation trung gian:** nếu generation vừa bị thay do chính plan này tạo ở phase trước (ghi trong báo cáo phase đó) → `git rm -r src/data/recommended-reference/<id-cũ>`; generation có từ trước plan để Phase 7 xử lý.
- **G7 — số ghim + dev server:** cập nhật số ghim nếu đổi (`tests/test_site_localization.py:71` = 2088 site obligation; số `uiPending`/`uiValues`/tổng obligation ở các test cùng file), chạy `python3 -m unittest tests.test_site_localization tests.test_team_route_handles tests.test_build_recommended_reference`; khởi động lại dev server (snapshot pin nằm trong bộ nhớ, `src/lib/root-static-artifacts.ts`).
- **G8 — MCP (khi sửa file thuộc bao đóng):** `npm --prefix mcp-worker run generate:workflow-build` → `npm --prefix mcp-worker run check`.

### Gate đầy đủ mỗi phase (A2)

```bash
npm run check && npm run build && npm run verify && npm run test:dist && npm run test:node && npm run test:e2e \
  && python3 -m unittest discover -s tests \
  && python3 -m pipeline.team_route_handles --check \
  && (cd worker && npm test && npm run typecheck) \
  && (cd mcp-worker && npm run check)
```

Xanh trước khi commit phase. Commit conventional, không nhắc AI, mỗi phase ít nhất một commit. Báo cáo `plans/260926-1648-sua-loi-review-codebase/reports/phase-NN.md`: test đỏ → xanh (lệnh + trích lỗi), tuple thêm/đổi/bỏ, `baseline.notes` cũ → mới, `policyVersion`, generation mới, workflow build id mới.

## Quyết định đã chốt (2026-09-27)

Người dùng chốt qua phiên chính ngày 2026-09-27. Các phương án không chọn đã bỏ khỏi phase.

| # | Vấn đề | Quyết định | Hệ quả trong plan |
|---|---|---|---|
| Q1 | Tagline từng trang | **A.** Layout lấy tagline trang mục từ `SECTION_DESCRIPTIONS[activeSection]` (`src/layouts/SiteLayout.astro:59-68`, 8 chuỗi đã khai `authored-vi`); bỏ prop `tagline` ở 8 `index.astro`; Landing không có tagline; trang chi tiết và 404 giữ tagline riêng. | Phase 3 bước Tagline. Không thêm chữ mới; mặc định `'Tất cả — tham khảo'` (`SiteLayout.astro:36`) bị bỏ. Test tagline 320px viết lại theo hành vi. |
| Q2 | Chế độ "Nhiều hột" | **A.** Khi `mode === "redStars"`, `compareCandidates` và `portfolioIsBetter` xếp `redCopyScore` trước bậc. | Phase 3 bước Nhiều hột. Engine dùng chung với MCP → output MCP ở chế độ này đổi và `WORKFLOW_BUILD_ID` đổi (G8); changelog ghi rõ. |
| Q3 | MCP sau `NEXT_NOT_AFTER` | **A.** NEXT hết hạn → coi slot NEXT như không có; token CURRENT vẫn 200, token NEXT 401; mọi cấu hình sai khác vẫn 503 `SERVICE_MISCONFIGURED`. | Phase 6 bước Bearer; cập nhật `docs/mcp-research-server.md` §Rotation (`:208`). |
| Q4 | Sửa tên trong `data/teams.json` | **A.** Script một lần: NFC + bảng thay tên đã duyệt; thêm cùng các cặp vào `pipeline/aliases.json`; sinh lại `data/facets.json`, `pipeline/recommended-other-teams.json`; **dừng cho người dùng duyệt diff `recommended-other-teams.json`**; publish; re-pin `legacyTeamsSha256`. Cache crawler không có trên máy → thêm chế độ `--pack pipeline/localization-inputs/recommended.json` cho `recommended_team_dedup` (có test). | Phase 2 bước G; Phase 7 bước C chỉ còn thêm test cho `facets.json`. 7 đội `pendingIdentity` có thể thành `distinct` và vào Đội khác (handle đã có trong ledger 166 legacy). |
| Q4b | Tiền tố "Bái Sư" | Người dùng: "Đây là dạng tướng đệ tử bái sư danh tướng khác, cứ giữ nguyên." → **giữ nguyên** tên slot `Bái Sư Pháp Chính`, `Bái Sư SP Tuân Úc` trong `data/teams.json`; **không** quy về tướng gốc, **không** thêm vào `VARIANT_PREFIX` (`js/hero-identity.js:5`). | Phase 2 bước G: hai tên nằm trong `PENDING_SOURCE_NAMES` với lý do "biến thể đệ tử bái sư, chưa có bản ghi từ điển"; không có trong bảng thay tên, không có alias. "Không làm" thêm mục tướng Bái Sư. |
| Q5 | File lớn đã track | **A.** `git rm` + `.gitignore`, giữ lịch sử; không `git filter-repo`, không force-push. | Phase 7 bước H, I, J. `.git` không nhỏ đi; cây làm việc giảm ~250 MB. |
| Q6 | Băm IP | **A.** HMAC-SHA256 với secret `IP_HASH_SECRET`, gom IPv6 theo /64. Thiếu secret → Worker **fail-closed**: 503 JSON có CORS, không ghi KV, không gọi siteverify/model (có test). | Phase 6 bước Băm IP; `docs/deployment-guide.md` thêm `wrangler secret put IP_HASH_SECRET` trước deploy; bộ đếm per-IP cũ (TTL 2 giờ) tự hết hạn. |
| Q7 | Nút "2 cột / 4 cột" | **A.** Nhãn "Thẻ" / "Thẻ gọn" / "Bảng" + aria tương ứng; URL giữ `view=luoi`/`view=bang`; đổi chữ 5 tuple `authored-vi` theo G1. | Phase 3 bước Chế độ xem; `README.md:11`, `docs/deployment-guide.md:269` theo nhãn mới. |

## Không làm

- **Deploy** Pages, Vision Worker, MCP; đặt secret `IP_HASH_SECRET` (Q6) là việc lúc deploy theo `docs/deployment-guide.md` (Phase 6 ghi bước này).
- **Project Playwright WebKit/Safari 16** (gợi ý phụ của JsCore#1): WebKit của Playwright là bản mới, hỗ trợ cờ `v`, không bắt được lỗi; thay bằng test baseline cú pháp (Phase 2).
- **Chuyển bộ đếm sang Durable Object / Rate Limiting binding** (gợi ý thay thế của Workers#1): đổi hạ tầng Cloudflare; `docs/code-standards.md:100` coi quota KV là best-effort. Plan làm lựa chọn còn lại của finding: ghi KV best-effort + mọi lỗi trả JSON có CORS.
- **Tự dịch hoặc đổi chữ obligation `translate`**, dời tuple `translate` sang file/symbol khác: cần receipt độc lập của người dùng; phase nào buộc phải làm thì dừng hỏi.
- **Đổi URL/handle đóng băng**, chạy `team_route_handles --write`, chạy `pipeline.build_json` ghi đè artifact production.
- **Thêm tướng/chiến pháp vào từ điển** cho `SP Lô Trực`, `Tiêu Chỉ`, `Đồng Tâm Hiệp Lực` (không có bản ghi nguồn): ngoài phạm vi sửa lỗi; test Phase 2 liệt kê chúng trong danh sách chờ nguồn có lý do.
- **Thêm tướng "Bái Sư" vào từ điển hoặc vào `VARIANT_PREFIX`** (`Bái Sư Pháp Chính`, `Bái Sư SP Tuân Úc`): theo Q4b đây là tướng đệ tử bái sư, giữ nguyên tên; chưa có bản ghi từ điển nên các đội dùng chúng vẫn bị chặn trong Gợi ý đội, test Phase 2 ghi lý do.
- **Viết lại lịch sử git** (`git filter-repo`, force-push) cho file lớn đã track: theo Q5 chỉ untrack.

## Rủi ro

| Rủi ro | Khả năng × Ảnh hưởng | Giảm thiểu |
|---|---|---|
| Mỗi phase sinh generation ~6,8 MB | Cao × Thấp | G6 xoá generation trung gian do plan tạo; Phase 7 `prune` + `git rm` 35 generation cũ (Q5 = A, lịch sử giữ nguyên) |
| Sửa `data/teams.json` đổi phân loại dedup, thêm đội vào Đội khác, lệch 5 chỗ hash | Trung bình × Cao | Q4 = A; Phase 2 bước G liệt kê đủ chuỗi hash; **dừng** cho người dùng duyệt diff `recommended-other-teams.json` trước publish |
| Không có cache Recommended để chạy `recommended_team_dedup` | Cao × Cao | Q4 = A: chế độ `--pack` đọc source pack đã capture (test đối chiếu với `--cache` trên fixture) |
| Đổi engine (tên thiếu tướng, dedupe khoá, Q2 = A xếp theo hột) đổi output MCP + `WORKFLOW_BUILD_ID` | Cao × Trung bình | G8; cập nhật test MCP theo hành vi; changelog ghi workflowVersion mới |
| Deploy Worker thiếu `IP_HASH_SECRET` → `/analyze` trả 503 | Trung bình × Trung bình | Q6 = A fail-closed có chủ đích; `docs/deployment-guide.md` đặt `wrangler secret put IP_HASH_SECRET` trước `wrangler deploy`; thông điệp 503 có ánh xạ tiếng Việt ở `js/analyze.js` |
| Test e2e ghim chi tiết ngẫu nhiên (tagline bị cắt, nhãn cột) vỡ khi sửa UI | Cao × Thấp | Viết lại theo hành vi (chiều cao một dòng, không tràn header), không ghim lại |
| Nửa đêm/reset ngày khó test | Trung bình × Thấp | `page.clock` của Playwright |
| Bỏ lớp replay KV làm lộ token dùng lại | Thấp × Trung bình | siteverify trả `timeout-or-duplicate` cho token dùng lại; test ở Phase 6 |
| Tối ưu tải theo trang làm trang thiếu nguồn đã xác minh | Trung bình × Cao | `localizeData` từ chối nguồn chưa xác minh (test Phase 5); e2e đếm request mọi trang mục |

**Rollback:** mỗi phase là một hoặc vài commit độc lập; `git revert` commit phase trả lại cả code, policy, generation và `team-route-handles.json` cùng lúc (các file này luôn đổi trong cùng commit). Không phase nào xoá dữ liệu người dùng (localStorage giữ schema v1; import lỗi không ghi đè).

## Tiêu chí hoàn thành

- [ ] 109/109 finding có trạng thái trong báo cáo phase: sửa (kèm tên test đỏ → xanh) hoặc xoá; không còn việc chờ quyết định.
- [ ] Gate A2 xanh ở commit cuối mỗi phase; `site_localization check --stage public` exit 0, `team_route_handles --check` pass.
- [ ] `js/` không còn regex cờ `v`; test baseline ES2022 xanh cho mọi module trong `src/lib/public-artifact-manifest.mjs`.
- [ ] Tra cứu `dieu thuyen`, `dong trac` trả kết quả (hiện 0).
- [ ] Gợi ý đội không hiện chuỗi `hero:` ở bất kỳ đâu trên `/goi-y-doi/`.
- [ ] `js/team-pk.js`, `meta-cu.js`, `tactics.js`, `hero-list.js`, `hero-detail.js` và `src/lib/recommended-reference-data.mjs` không còn; `dist/js/` không có 5 file này.
- [ ] Trang `/khai-hoang/` và `/doi-chuan/<đội>/` không tải nguồn dữ liệu trang không dùng; `/data/teams.json` tải tối đa 1 lần mỗi trang (e2e đếm request).
- [ ] Vision Worker: lỗi KV không làm response mất CORS; `HERO_NAMES_CN` khớp 202 tướng (test drift).
- [ ] `src/data/recommended-reference/` chỉ còn generation đang pin (Q5 = A, lịch sử giữ nguyên); `pipeline/lookup-output/site-vi-*` và media `assets/videos/` không còn được track; CI chạy khi đổi `css/**`, `public/**`, `tsconfig.json`.
- [ ] Vision Worker thiếu `IP_HASH_SECRET` trả 503 JSON có CORS và không ghi KV; MCP sau `NEXT_NOT_AFTER` vẫn nhận token CURRENT (200).
- [ ] `data/teams.json` không còn dấu kết hợp; slot không sở hữu được chỉ còn các tên trong `PENDING_SOURCE_NAMES` (3 tên không có nguồn + 2 tên Bái Sư).
- [ ] Docs (`README.md`, `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/project-overview-pdr.md`, `docs/deployment-guide.md`, `docs/season-team-data.md`, `docs/unified-lookup.md`, `docs/code-standards.md`, `docs/mcp-research-server.md`, `worker/README.md`) mô tả đúng code; `docs/project-changelog.md` có mục cho từng phase.

<!-- slug: sua-loi-review-codebase -->
