---
phase: 5
title: "Hiệu năng runtime"
status: pending
priority: P2
effort: "1.5d"
dependencies: [4]
---

# Phase 5: Hiệu năng runtime

## Goal
Trang mục và trang chi tiết chỉ tải và xác minh nguồn dữ liệu mà chính trang dùng, các nguồn được băm song song, không tải một file hai lần; boot của `app.js` dựng hàng/render một lần; tracker Chiêu mộ không clone toàn bộ state nhiều lần mỗi lần render.

## Contract
- ReviewJsCore#4 — `js/website-display.js:86-91` tải + băm tuần tự cả 8 nguồn `sourceHashes`; `js/team-detail.js:89-92` tải `/data/teams.json` lần hai (không có bộ nạp dùng chung); `/khai-hoang/` tải 11 file dữ liệu.
- ReviewJsCore#7 (phần hiệu năng; phần chết đã xoá ở Phase 4) — `renderTeams` (`js/app.js:233-261`) dựng mọi hàng rồi chỉ `find` một `configId`; boot gọi `refresh()` (→ `renderScope`) rồi `renderScope()` lần nữa (`:472-473`).
- ReviewJsTools#25 — `getRecruitTrackerSummary` → `normalizeRecruitTrackerState` clone, `getPity`/`getFiveStarHistory` normalize + clone lại (`js/recruit-tracker-store.js:65,125-127,275-276,294-295`).
- Ràng buộc từ plan `260923-1949` quyết định #1: `loadWebsiteDisplay` giữ vai trò xác minh hash trước khi render; plan này chỉ thu hẹp tập nguồn về đúng nguồn trang dùng, không bỏ xác minh.

## Files to Create / Modify
- Modify: `js/website-display.js` (băm song song; tham số `paths`; `localizeData` từ chối nguồn chưa xác minh; `createByteLoader` dùng chung), `js/app.js` (tập nguồn theo mục; nạp `teams.json` khi cần; `renderTeams` chỉ dựng hàng khi có `configId`; bỏ `renderScope()` thừa), `js/team-detail.js`, `js/khaihoang-detail.js` (dùng `createByteLoader`, bỏ `byteLoader` riêng `:28-`), `js/recruit-tracker-store.js`.
- Modify tests: `tests-js/website-display.test.mjs`, `tests-e2e/spa-parity.spec.mjs` (đếm request theo trang), `tests-e2e/team-detail-pages.spec.mjs`, `tests-e2e/khaihoang-options.spec.mjs`.
- Modify gate: policy (4 file bị ghim), generation mới, `data/website-display.json`, `pipeline/team-route-handles.json`.
- Modify docs: `docs/code-standards.md` (bảng payload/nguồn theo trang, `:16-23`), `docs/system-architecture.md`, `docs/project-changelog.md`.

## Tasks & Steps

### A. Bảng nguồn theo trang (làm trước, ghi vào báo cáo phase)
- [ ] Lập bảng từ code, mỗi ô có trích dòng: nguồn nào mỗi mục thật sự đọc — `teams` (migrate `legacyTeam` `app.js:194-197`, công cụ `:503-504`, model mùa), `coexist` (`:423`, chỉ Cùng Tồn), `khaihoang` (`:150-153,453`), `books-dict` (Soi đội `:503`), bộ Tra cứu `heroes-dict/tactics/lookup-catalog/lookup-manifest` (`:156`; Tra cứu, công cụ, model mùa qua `loadSeasonModel`), `team-tier` (Gợi ý đội `:504`), và nguồn mà trang **dựa vào hash đã xác minh** (Tra cứu dùng `websiteDisplay.sourceHashes["data/heroes-dict.json"]` làm `catalogSha256`, `:490` → phải xác minh `data/heroes-dict.json`). Trang chi tiết: Đội chuẩn/Đội khác cần `data/teams.json`; Khai hoang cần `data/khaihoang.json`.

### B. Xác minh song song và theo danh sách (ReviewJsCore#4)
- [ ] **Test trước.** `tests-js/website-display.test.mjs`: (1) bộ nạp giả trả promise hoãn → `loadWebsiteDisplay(pin, loadBytes, recommendedPin, {paths})` đã yêu cầu **mọi** nguồn trong `paths` trước khi nguồn đầu tiên được trả (đỏ: tuần tự, chỉ 1 yêu cầu đang chờ); (2) chỉ nguồn trong `paths` được tải (đỏ: tải đủ 8); (3) `paths` có đường không nằm trong `sourceHashes` → ném lỗi; (4) `localizeData(publication, "data/teams.json", …)` khi `data/teams.json` chưa được xác minh → ném lỗi (đỏ: hiện áp giá trị không kiểm). Ca hash sai vẫn ném "Nguồn dữ liệu đã thay đổi: …" (ca hiện có).
- [ ] **Sửa.** `loadWebsiteDisplay` nhận `{paths}` (mặc định: mọi nguồn — giữ hành vi cho caller chưa truyền), băm bằng `Promise.all`, gắn tập đã xác minh vào đối tượng trả về (không lộ ra `values`); `localizeData` kiểm tập đó.
- [ ] **Xác nhận.** Test xanh.

### C. Tải theo trang (ReviewJsCore#4)
- [ ] **Test trước.** `tests-e2e/spa-parity.spec.mjs`: ghi mọi request `/data/` khi mở từng trang mục (cache trống) và so với bảng bước A: `/khai-hoang/` không yêu cầu `teams.json`, `coexist.json`, `books-dict.json`, `lookup-*`, `tactics.json`; `/tra-cuu/` không yêu cầu `khaihoang.json`, `coexist.json`, `teams.json`; không file nào bị yêu cầu hai lần. `tests-e2e/team-detail-pages.spec.mjs`: trang `/doi-chuan/<đội>/` và `/doi-khac/<đội>/` yêu cầu `/data/teams.json` đúng 1 lần; `tests-e2e/khaihoang-options.spec.mjs`: `/khai-hoang/<đội>/` không yêu cầu `teams.json`. Đỏ: `/khai-hoang/` 11 request, `teams.json` 2 lần ở trang chi tiết.
- [ ] **Sửa.** `createByteLoader()` trong `js/website-display.js` (memo theo đường dẫn, bỏ promise lỗi để "Thử lại" tải lại — đúng hành vi `khaihoang-detail.js` hiện có); `app.js` dùng nó và truyền `paths` theo `data-page-section`; nạp `teams.json` chỉ ở trang cần (và lười khi URL có `legacyTeam` ở trang khác); `team-detail.js`, `khaihoang-detail.js` dùng cùng loader và truyền `paths` của mình. Giữ nguyên thông điệp lỗi và biểu thức binding `displayValue(websiteDisplay, "ui:app/load-error", "errorTemplate")`.
- [ ] **Xác nhận.** Test xanh; e2e hiện có (migrate `?detail=`/`?legacyTeam=`, Tra cứu "Trong cẩm nang", công cụ) xanh.

### D. Boot `app.js` render một lần (ReviewJsCore#7)
- [ ] Không có test đỏ tự nhiên (không đổi output). **Test bảo toàn:** các ca `tests-e2e/season-lookup.spec.mjs` mở `/cung-ton/?config=…`, Escape/đóng chi tiết, Back phải xanh trước và sau. **Sửa:** `renderTeams` chỉ dựng đúng một hàng khi `state.configId` có (tìm theo `configId` trong `projection`, không map toàn bộ); bỏ `renderScope()` ở `app.js:473` (đã gọi trong `refresh()` `:446`). **Đo** bằng script tạm (Playwright, CPU ×4): thời gian tới `body[data-boot=ready]` trên `/cung-ton/` trước/sau, ghi vào báo cáo, xoá script.

### E. Clone state Chiêu mộ (ReviewJsTools#25)
- [ ] Không có test đỏ tự nhiên. **Test bảo toàn:** toàn bộ `tests-js/recruit-tracker-store.test.mjs` và `recruit-tracker-ui.test.mjs` xanh trước và sau. **Sửa:** `getRecruitTrackerSummary` normalize một lần, gọi helper nội bộ tính pity/lịch sử trên state đã normalize (không normalize lại); export `getPity`/`getFiveStarHistory` giữ hành vi cho caller ngoài. **Đo** bằng script tạm: thời gian `getRecruitTrackerSummary` với 5 banner × 2000 sự kiện trước/sau, ghi báo cáo, xoá script.

### F. Kết phase
- [ ] G0–G5, G7 (file bị ghim: `js/website-display.js`, `js/app.js`, `js/team-detail.js`, `js/khaihoang-detail.js`, `js/recruit-tracker-store.js`); `policyVersion` `site-vi-2609xx-hieu-nang`; docs bảng nguồn theo trang; changelog; `reports/phase-05.md` (bảng nguồn, số request trước/sau mỗi trang, số đo boot và tracker).

## Verification
- `node --experimental-strip-types --test tests-js/website-display.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/recruit-tracker-ui.test.mjs` → pass.
- `npx playwright test tests-e2e/spa-parity.spec.mjs tests-e2e/team-detail-pages.spec.mjs tests-e2e/khaihoang-options.spec.mjs tests-e2e/season-lookup.spec.mjs` → pass.
- `python3 -m pipeline.site_localization check --root . --stage public` → exit 0; gate A2 exit 0.
