---
phase: 2
title: "7 lỗi nặng"
status: completed
priority: P1
effort: "3.5d"
dependencies: [1]
---

# Phase 2: 7 lỗi nặng

## Goal
Sửa 7 lỗi làm hỏng trang, mất dữ liệu người dùng hoặc cho kết quả sai rõ ràng: regex cờ `v`, tìm không dấu với `đ`, ID thô trong Gợi ý đội, nút Soi đội kẹt, import Chiêu mộ phá tracker, đội khoá bị nhân đôi, tên đội hỏng/không sở hữu được trong `data/teams.json`.

## Contract
- ReviewJsCore#1 — `js/season-context.js:36` dùng `/[\p{C}&&[^\n\r\t]]/v`, duy nhất trong `js/`.
- ReviewJsTools#3 — `js/unified-lookup.js:78-80` `normalized()` không đổi `đ/Đ`.
- ReviewJsTools#5 = AuditUiLive#1 — `js/team-recommend-engine.js:145-148,601-611` trả `missingHeroes` là ID canonical; `js/roster-recommend-ui.js:376` in thẳng. Đã kiểm: `selectedTactics`/`usedAlternatives` là tên (`team-recommend-engine.js:199-205,235-239`) → chỉ giữ test bảo toàn.
- ReviewJsTools#1 = ReviewWorkers#2 — `js/analyze.js:414,476-498`: `finally` thoát sớm khi `started !== generation`, `state.busy` kẹt `true`.
- ReviewJsTools#2 — `js/recruit-tracker-store.js:317-328` chỉ kiểm mảng; `js/recruit-tracker.js:586-596` `mutate(parsed)` ghi trước khi render.
- ReviewJsTools#4 — `js/roster-scan-state.js:178` nối `lockedTeams` không khử trùng; `js/team-recommend-engine.js:543-579` bỏ **cả hai** đội xung đột; `js/roster-recommend-ui.js:196-` không có nút bỏ đội/xoá kho.
- ReviewAstroCss#3 + ReviewJsTools#6 — dấu kết hợp ở 7 đội (`data/teams.json:7559,7605-7606,9252,9329-9330,12501-12513,12622-12634,12747,12791-12792,12866-12878,14939-14951,14983`), lỗi gõ và tiền tố "Bái Sư" làm slot không sở hữu được. Theo quyết định Q4 = A (script một lần + alias + publish, dừng duyệt diff ledger) và Q4b (giữ nguyên "Bái Sư", đó là tướng đệ tử bái sư).

## Files to Create / Modify
- Create: `tests-js/browser-baseline.test.mjs`, `tests-js/teams-data-integrity.test.mjs`.
- Modify tests: `tests-js/season-context.test.mjs`, `tests-js/unified-lookup.test.mjs`, `tests-js/team-recommend-engine.test.mjs`, `tests-js/roster-scan-state.test.mjs`, `tests-js/recruit-tracker-store.test.mjs`, `tests-e2e/beta-tools.spec.mjs`, `tests/test_recommended_team_dedup.py`.
- Modify code: `js/season-context.js`, `js/unified-lookup.js`, `js/team-recommend-engine.js`, `js/roster-recommend-ui.js`, `js/roster-scan-state.js`, `js/analyze.js`, `js/recruit-tracker-store.js`, `js/recruit-tracker.js`, `css/styles.css` (nút bỏ đội/xoá kho dùng component nút có sẵn, chỉ token).
- Modify data: `data/teams.json`, `data/facets.json`, `pipeline/aliases.json`, `pipeline/recommended-other-teams.json`; code `pipeline/recommended_team_dedup.py` (chế độ `--pack`).
- Modify gate: `pipeline/site_localization.py` (tuple mới), `pipeline/site-localization-policy.json`, `src/data/recommended-reference/<generation mới>/` + `current.json`, `data/website-display.json`, `pipeline/team-route-handles.json`, `tests/test_site_localization.py` (số ghim nếu đổi), `mcp-worker/src/generated/workflow-build.ts`.
- Modify docs: `docs/season-team-data.md` (`:86-90`, lệnh `recommended_team_dedup --pack`), `docs/project-changelog.md`.

## Tasks & Steps

### A. Regex cờ `v` (ReviewJsCore#1)
- [ ] **Test trước.** `tests-js/browser-baseline.test.mjs`: lấy mọi entry `js` của `src/lib/public-artifact-manifest.mjs`, dựng `ts.createProgram` (package `typescript` có sẵn) với `target: ES2022, allowJs, checkJs, noResolve, noEmit`, gom diagnostic mã 1501 ("regular expression flag only available when targeting es2024") → kỳ vọng rỗng. Đỏ trước sửa: đúng 1 diagnostic tại `js/season-context.js`. Thêm vào `tests-js/season-context.test.mjs` ca bảo toàn hành vi: trường raw nhận `\n`, `\r`, `\t`; từ chối `\u0000`, `\u0007`, `\u200b` (Cf), `\ue000` (Co) — ca này phải **xanh cả trước và sau** sửa.
- [ ] **Sửa.** `js/season-context.js:36`: `/(?![\n\r\t])\p{C}/u`.
- [ ] **Xác nhận.** Hai test xanh; G8 (file thuộc bao đóng MCP).

### B. Tìm không dấu với `đ` (ReviewJsTools#3)
- [ ] **Test trước.** `tests-js/unified-lookup.test.mjs`: corpus có tướng "Điêu Thuyền", "Đổng Trác" và chiến pháp chứa "Đ" → `searchLookupGroup(corpus, {query: "dieu thuyen"})`, `"dong trac"`, `"DIEU"` trả đúng bản ghi. Đỏ trước sửa: 0 kết quả.
- [ ] **Sửa.** `normalized()` dùng `normalizeText` của `js/filters.js` (đã đúng `đ→d`, `filters.js:5-12`); tính khoá tìm một lần mỗi entry trong `entry()` thay vì mỗi phím gõ.
- [ ] **Xác nhận.** Test xanh; chữ Hán và có dấu vẫn tìm được (ca cũ của file xanh). G0–G5 (`js/unified-lookup.js` bị ghim, 53 tuple không binding).

### C. ID thô trong Gợi ý đội (ReviewJsTools#5, AuditUiLive#1)
- [ ] **Test trước.** `tests-js/team-recommend-engine.test.mjs`: kho thiếu tướng ở hai slot (một slot có 2 lựa chọn) → mục `blockedStrongTeams` có `missingHeroSlotNames` = tên hiển thị theo slot (`[["Mã Siêu"], ["Hoàng Phủ Tung", "SP Hoàng Phủ Tung"]]`), không phần tử nào bắt đầu `hero:`. Đỏ: trường chưa có. `tests-e2e/beta-tools.spec.mjs`: seed kho (dùng helper `seed`) → Xác nhận → Gợi ý 5 đội → vùng "Đội mạnh nhưng chưa thể xây dựng" không chứa `hero:`; dòng "Chiến pháp:"/"Biến thể:" của đội gợi ý không chứa `tactic:` (ca bảo toàn). Đỏ: dòng "Thiếu tướng: hero:…".
- [ ] **Sửa.** Engine: mục bị chặn mang `missingHeroSlotNames` (lấy `candidate.heroSlots[i].alternatives[].displayName` của slot thiếu), bỏ `missingHeroes` phẳng khỏi mục hiển thị; `diagnostics.missingHeroes` giữ ID. UI `roster-recommend-ui.js:376`: slot nối bằng ", ", lựa chọn trong slot nối bằng " / "; giữ nguyên chuỗi `Thiếu tướng: ` và `Thiếu chiến pháp: ` (tuple `ui:roster/result-missing-*`).
- [ ] **Xác nhận.** Hai test xanh; `npm --prefix mcp-worker test` xanh (MCP không đọc `blockedStrongTeams`, đã grep); G8, G0–G5.

### D. Nút Soi đội kẹt (ReviewJsTools#1, ReviewWorkers#2)
- [ ] **Test trước.** `tests-e2e/beta-tools.spec.mjs`, stub Turnstile như `:21-28`: route Worker giữ response bằng promise; chọn ảnh → bấm "Soi đội" → trong lúc chờ chọn ảnh khác → trả response lần 1 → gọi `__turnstileSolve()` → nút "Soi đội" **enabled**, widget đã reset đúng 1 lần, kết quả của ảnh cũ không hiện. Đỏ: nút disabled mãi.
- [ ] **Sửa.** `js/analyze.js` `finally`: luôn `state.busy = false`, `state.token = null`, reset widget, `paint()`; điều kiện `started !== generation` chỉ còn chặn `applyResult`/`setStatus`.
- [ ] **Xác nhận.** Test mới + các ca N9-5 hiện có (`beta-tools.spec.mjs:291-367`) xanh. G0 (`js/analyze.js`: 28 tuple, giữ nguyên văn `localizeWorkerError(data?.error, res.status)`, `describeAnalyzeError(e, ANALYZE_ACTION_ERROR)`), G3–G5.

### E. Import Chiêu mộ (ReviewJsTools#2)
- [ ] **Test trước.** `tests-js/recruit-tracker-store.test.mjs`: `validateRecruitTrackerImport` trả `ok:false` với `pullEvents:[null]`, `dailyStates:[null]`, dailyState thiếu `slots`, `banners:[null]`, `pulls` không hữu hạn, `slotKey` lạ, sự kiện trỏ account/banner không tồn tại. Thêm ca tính chất: với mọi fixture hỏng ở trên, nếu `validate` trả `ok:true` thì `getRecruitTrackerSummary` không ném. Đỏ: hiện trả `ok:true` và summary ném "Cannot read properties of null". `tests-e2e/beta-tools.spec.mjs` (mục Chiêu mộ): import file hỏng → `localStorage` giữ nguyên byte cũ, hiện thông báo lỗi, bấm "Không ra" vẫn chạy.
- [ ] **Sửa.** Kiểm từng phần tử account/banner/pullEvent/dailyState (kiểu, id, `slotKey ∈ DAILY_SLOT_DEFS`, `pulls` hữu hạn ≥ 1, tham chiếu tồn tại); `importJson` chạy thử `getRecruitTrackerSummary(parsed)` trước `mutate`. Dùng lại thông điệp đã có ("Dữ liệu không hợp lệ.", tuple `ui:recruit-store/*`); không đổi chữ tuple `translate` (`Account không hợp lệ.`, `Thiếu account.`, …).
- [ ] **Xác nhận.** Test xanh; G0–G5 (`js/recruit-tracker-store.js` 6 tuple `translate`, `js/recruit-tracker.js` 44 tuple).

### F. Đội khoá bị nhân đôi (ReviewJsTools#4)
- [ ] **Test trước.** `tests-js/roster-scan-state.test.mjs`: `applyScanResult` hai lần cùng `builtTeams` → `lockedTeams.length === 1` (đỏ: 2). `tests-js/team-recommend-engine.test.mjs`: hai đội khoá chung một tướng → đội đầu vẫn trong portfolio, đội sau vào diagnostics xung đột, tướng của đội đầu không được dùng cho đội gợi ý (đỏ: cả hai bị bỏ, "addTeams use locked heroes: true"). `tests-e2e/beta-tools.spec.mjs`: mỗi đội khoá có nút bỏ; bấm → đội biến mất sau reload; nút xoá toàn bộ kho (có `confirm`) đưa về trạng thái "Chưa đọc" (đỏ: không có nút).
- [ ] **Sửa.** Khử trùng theo khoá tướng + chiến pháp đã sắp trong `applyScanResult`/`normalizeLockedTeam`; engine giữ đội khoá đầu khi xung đột; thêm `removeLockedTeam(state, index)` và `clearRosterScanState()` trong `js/roster-scan-state.js`, nút trong `teamList` và vùng điều khiển của `roster-recommend-ui.js`. Chữ mới (nhãn nút, câu confirm) → tuple `authored-vi` (G1).
- [ ] **Xác nhận.** Test xanh; G8 (`roster-scan-state.js`, `team-recommend-engine.js`), G0–G5.

### G. Tên đội hỏng và slot không sở hữu được (ReviewAstroCss#3, ReviewJsTools#6) — Q4 = A, Q4b = giữ nguyên
- [ ] **Test trước (dữ liệu).** `tests-js/teams-data-integrity.test.mjs` (đọc `data/teams.json`, `data/heroes-dict.json`, `data/tactics.json`): (1) mọi chuỗi bằng dạng NFC của nó và không chứa ký tự U+0300–U+036F; (2) khi sở hữu **mọi** tướng và chiến pháp trong từ điển, `recommendTeams({mode: "redStars", …})` không chặn đội nào vì thiếu tướng/chiến pháp, trừ tên trong `PENDING_SOURCE_NAMES`, mỗi tên kèm lý do: `SP Lô Trực`, `Tiêu Chỉ`, `Đồng Tâm Hiệp Lực` — "không có bản ghi từ điển"; `Bái Sư Pháp Chính`, `Bái Sư SP Tuân Úc` — "biến thể đệ tử bái sư, chưa có bản ghi từ điển". Test cũng khẳng định mỗi tên trong danh sách này **vẫn có mặt** trong `data/teams.json` (danh sách không thành chỗ giấu tên đã hết dùng). Đỏ: 22 dòng dấu kết hợp; đội bị chặn vì `SP Hoàng Phổ Tung`, `SP Đổng Trách`, `Thịnh Khí`, `Tinh·Phong Thi Trận`.
- [ ] **Test trước (`--pack`).** Cache crawler Recommended không có trên máy (`.cache/sgsdeck-recommended` vắng), nên `recommended_team_dedup` cần đọc source pack đã capture. `tests/test_recommended_team_dedup.py`: dựng pack từ fixture `tests/fixtures/sgsdeck-recommended` bằng `site_localization.main(["capture", "--root", <tmp repo>, "--cache", <fixture>, "--output", <tmp>/recommended.json])`, rồi chạy `recommended_team_dedup.main` hai lần — `--cache <fixture>` và `--pack <tmp>/recommended.json` — cùng `--teams/--team-tier/--identity-map` → hai file ledger bằng nhau từng byte, và ledger `--pack` qua `_validate_other_ledger` của `site_localization` (`:1148-1165`). Đỏ: tham số `--pack` không tồn tại.
- [ ] **Sửa `--pack`.** `pipeline/recommended_team_dedup.py` `main()` (`:193-223`): nhóm loại trừ `--cache | --pack`; nhánh pack dùng `load_source_pack` + `verify_pack_pins(pack, policy["baseline"]["sourcePins"])`, `recommended = pack_corpus(pack)`, `sourceInventoryHash = pack["inventory"]["inventoryHash"]`; không đi qua `hydrate_inputs` (hàm đó cần chính ledger đang được sinh lại). Ghi lệnh vào `docs/season-team-data.md:86-90`.
- [ ] **Sửa dữ liệu.** Script một lần (không commit) đọc/ghi `data/teams.json` giữ định dạng `json.dumps(indent=2, ensure_ascii=False)+"\n"` (đã kiểm khớp byte), thay theo bảng: `Lục Tốṇ→Lục Tốn`, `Giả Hụ̉→Giả Hủ`, `Lỗ Túc̣→Lỗ Túc` (cả dạng `(S)`, tên đội, nickname); `SP Hoàng Phổ Tung→SP Hoàng Phủ Tung`, `SP Đổng Trách→SP Đổng Trác`, slot `Thịnh Khí→Thịnh Khí Linh Địch`, `Tinh·Phong Thi Trận→Phong Thi Trận`. **Không** đụng `Bái Sư …` (Q4b), không thêm tiền tố vào `VARIANT_PREFIX`. Thêm đúng các cặp thay tên vào `pipeline/aliases.json` (hero alias áp lên `baseName` theo `_note`; tactic alias theo khoá `tactics`) để rebuild sau cho cùng kết quả. Sinh lại `data/facets.json` bằng `build_facets` của `pipeline/build_json.py` từ `teams.json` đã sửa (hết tách `Lục Tốn`/`Lục Tốṇ`, `Giả Hủ`/`Giả Hụ̉`).
- [ ] **Chuỗi hash.** (1) `python3 -m pipeline.recommended_team_dedup --teams data/teams.json --team-tier data/team-tier.json --pack pipeline/localization-inputs/recommended.json --identity-map pipeline/recommended-identity-map.json --output pipeline/recommended-other-teams.json`; (2) **dừng, trình người dùng duyệt** trước khi chạy bất kỳ bước publish nào: diff `decisions`/`admitted`/`counts` (đặc biệt 7 đội `moi-phe-72, 86, 113, 114, 115, 116, 133`), `git diff data/teams.json` theo từng dòng thay tên (riêng dòng `Tinh·Phong Thi Trận→Phong Thi Trận` hỏi rõ: người dùng bác thì hoàn dòng đó, bỏ alias tương ứng và chuyển tên vào `PENDING_SOURCE_NAMES` với lý do người dùng nêu); (3) sau khi được duyệt: G3 (`data/teams.json` stale) → G4 → G5 kèm `legacyTeamsSha256`.
- [ ] **Xác nhận.** Test toàn vẹn xanh; `python3 -m unittest tests.test_build_recommended_reference tests.test_recommended_team_dedup tests.test_team_route_handles` xanh; `npm run build` rồi `grep -c $'\u0323' dist/doi-khac/ton-tuc-mong-113/index.html` = 0; handle `/doi-khac/ton-tuc-mong-113/` vẫn tồn tại; tên `Bái Sư Pháp Chính`, `Bái Sư SP Tuân Úc` còn nguyên trong `data/teams.json`.

### H. Kết phase
- [ ] G0–G8 một lần cho cả phase (gộp các file bị ghim), `policyVersion` = `site-vi-2609xx-loi-nang`; changelog mục mới; báo cáo `reports/phase-02.md`.

## Verification
- `node --experimental-strip-types --test tests-js/browser-baseline.test.mjs tests-js/season-context.test.mjs tests-js/unified-lookup.test.mjs tests-js/team-recommend-engine.test.mjs tests-js/roster-scan-state.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/teams-data-integrity.test.mjs` → pass (mỗi test mới đã được thấy đỏ trước sửa, trích lỗi trong báo cáo).
- `npx playwright test tests-e2e/beta-tools.spec.mjs` → pass.
- `python3 -m pipeline.site_localization check --root . --stage public` → `exitCode: 0`; `python3 -m pipeline.team_route_handles --check` → pass.
- `npm --prefix mcp-worker run check` → pass (workflow build đã sinh lại).
- Gate A2 exit 0.
