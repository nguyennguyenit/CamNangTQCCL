---
phase: 9
title: "3 công cụ Beta"
status: pending
priority: P2
effort: "2d"
dependencies: [3, 7, 8]
---

# Phase 9: 3 công cụ Beta

## Goal
`/chieu-mo/`, `/soi-doi/`, `/goi-y-doi/` mang giao diện artboard; lưu trữ, Worker/Turnstile và engine gợi ý giữ nguyên từng byte hành vi.

## Contract
Brainstorm §3 (không đổi Worker/engine/schema lưu trữ), §6 (Beta chỉ đổi giao diện, bỏ emoji → SVG), §10.2 (thông báo DashScope ở trang Soi đội).

## Artboard
`Recruit.dc.html:77-88`, `RecruitMobile.dc.html:39-50`, `Analyze.dc.html:42-75`, `AnalyzeMobile.dc.html:44-56`, `Roster.dc.html:41-63`, `RosterMobile.dc.html:39-69`.

## Files to Create / Modify
- Modify (chỉ phần render/DOM): `js/recruit-tracker.js` (`:114-159,206-247`), `js/analyze.js` (`:193-254,275-380`), `js/roster-recommend-ui.js` (`:73-124,284-307`), `css/styles.css` (gồm `#season-controls` và `#season-config-detail` trên `/soi-doi/`, `/goi-y-doi/`).
- **Không sửa:** `js/recruit-tracker-store.js`, `js/roster-scan-state.js`, engine gợi ý, `worker/`, `js/analyze-map.js` (trừ khi chỉ đọc dữ liệu hiển thị đã export).
- Modify: policy + obligations theo plan.md "Quy trình bắt buộc mỗi phase" bước 2 (generation mới, `data/website-display.json`, `pipeline/team-route-handles.json` là thay đổi dự kiến của quy trình, không tính là đổi dữ liệu); `scripts/design-compare.mjs`; test e2e/tests-js của 3 công cụ.

## Tasks & Steps
1. **Chiêu mộ:** đồng hồ pity dạng thanh tiến độ (`role="meter"` hoặc `<progress>` + chữ "x / y") từ giá trị store đã tính (`recruit-tracker-store.js:118-145`); lịch sử theo artboard; mobile: hàng thao tác tài khoản gom vào nút ⋯ (menu dùng lại hành vi của `site-nav.js`: `aria-expanded`, Escape, trả focus).
2. **Soi đội:** khung tải ảnh, trạng thái Turnstile/Worker, kết quả theo artboard. Hàng kết quả hiện tên đội, điểm, mùa, trạng thái khớp **chỉ khi** các giá trị đó đã có trong dữ liệu `analyze-map.js` trả về; trường không có → giữ cách hiển thị hiện tại (mã đội + số khớp) và ghi vào báo cáo. Thay `📷`, `⚠` bằng icon SVG `aria-hidden` + chữ — SVG dựng bằng `createElementNS` hoặc markup Astro tĩnh, không `innerHTML` (plan.md quyết định #14). Chân dung dùng helper chung của Phase 7. Thông báo DashScope giữ trên trang này. Worker/Turnstile không phụ thuộc đường dẫn trang (CORS so `Origin` chính xác, `worker/src/index.ts:36-39`; Turnstile render khi mount, `js/analyze.js:311-318`) nên không đổi.
3. **Gợi ý đội:** tóm tắt tiến trình 1–2–3 (đọc kho → sửa → gợi ý) từ trạng thái UI hiện có, danh sách 5 đội đánh số, mobile nút "Sửa kho đã đọc" mở/đóng khu sửa hiện có (`.roster-review-panel` giữ), `.roster-results` giữ.
3b. **Phạm vi mùa + chi tiết cấu hình** trên Soi đội và Gợi ý đội (Phase 2 giữ hành vi, không có artboard): dùng lại style đã làm ở Phase 8 bước 2b, không viết CSS thứ hai; nút/link "Mở scan / nhập kho" của chi tiết cấu hình tới `/goi-y-doi/` giữ `scenario`/`ruleset`. Cùng mức đầu tư như Phase 8 bước 2b: dữ liệu thật chưa có phiên bản luật reviewed và chưa có cấu hình → chi tiết cấu hình chỉ áp token, kiểm bằng fixture test. Ghi vào `visual-phase-09.md` là "không có artboard, theo StyleGuide".
4. Chữ mới → obligations (lưu ý `worker/src/schema.ts` và `js/roster-scan-map.js` có obligations — không đụng).
5. Cặp so ảnh: Recruit, RecruitMobile, Analyze, AnalyzeMobile, Roster, RosterMobile.

## Verification
- `git diff --stat` của phase chỉ gồm file render/CSS/test/policy đã liệt kê + đầu ra của quy trình bản dịch; không đổi store, engine, worker.
- e2e/tests-js hiện có của 3 công cụ pass không đổi assertion hành vi (chỉ đổi selector/nhãn có chủ đích); dữ liệu `localStorage` tạo trước phase (`tqcclRecruitTracker`, `tqccl.rosterRecommend.scanState.v1`) vẫn đọc được sau phase (ca e2e nạp sẵn storage cũ).
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3).
- `node scripts/design-compare.mjs --phase 09` → `reports/visual-phase-09.md`.
