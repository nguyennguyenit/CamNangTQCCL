---
phase: 10
title: "Giao diện tối, a11y, responsive, docs, full test"
status: pending
priority: P1
effort: "2d"
dependencies: [1, 2, 3, 4, 5, 6, 7, 8, 9]
---

# Phase 10: Giao diện tối, a11y, responsive, docs, full test

## Goal
Toàn site đạt acceptance A1–A7 của plan ở cả sáng và tối, docs mô tả đúng mô hình mới, toàn bộ bộ test và gate xanh.

## Contract
Brainstorm §4 (toàn bộ), §5 #5 (bảng tối, vẽ thêm chỗ xấu), §11.5 (tương phản), plan "Bằng chứng hiện trạng" (theme theo OS khi chưa lưu).

## Files to Create / Modify
- Modify: `css/styles.css` (chỉnh token/override tối; **xóa hẳn khối `legacy`** còn lại, `ceiling` = 0), `docs/design/so-binh-phap/tokens.json` (chỉ khi rà tối cần token màu mới — ghi nguồn).
- Modify: `scripts/design-compare.mjs` (chỉ nếu cờ `--theme dark` của Phase 1 cần sửa).
- Modify docs (A7): `docs/design-guidelines.md` (`:7-9,26-44,89-127,161-169` — gồm tablist/phím mũi tên/alias `#heroes` ở `:40-44`), `docs/code-standards.md` (`:9-20,22-35,39-47`), `docs/system-architecture.md` (`:111,114` mô tả `/#khaihoang` và root một trang), `README.md` (`:9-14` deep link hash, "9/8 section", `:10` lọc điểm), `docs/deployment-guide.md` (`:103-113` "đúng mười rule" `_headers` → số rule mới gồm `/fonts/*` + 5 trang mục; `:136,240` checklist smoke còn lọc điểm/hash; thêm quy trình publish lại bản dịch), `docs/unified-lookup.md` (`:80` "`#lookup` là route canonical" → `/tra-cuu/?group=&id=`), `docs/project-changelog.md` (mục redesign).
- Create: `plans/260923-1949-so-binh-phap-redesign/reports/phase-10-final.md`.

## Tasks & Steps
1. **Rà tối:** chạy `design-compare` mọi phase ở theme tối (cờ `--theme dark`) — cả so ảnh lẫn `--tokens`. Không có artboard tối → soát theo bảng tối StyleGuide (`tokens.json` nhóm `color.dark`); chỗ xấu ghi vào báo cáo, sửa bằng token/override, chỗ cần thiết kế mới → dừng hỏi người dùng (brainstorm §5 #5).
2. **Tương phản:** script tạm duyệt mọi phần tử có chữ trên 10 trang đại diện × 2 theme, tính tương phản với nền thực (`getComputedStyle`) → 0 vi phạm A4. Màu phe/binh/trạng thái luôn có chữ.
3. **A11y + responsive:** mọi trang ở 320, 390, 768, 1440: không cuộn ngang (`document.documentElement.scrollWidth <= innerWidth`), vùng bấm ≥ 44px trên mobile (script đo `getBoundingClientRect` các `a, button, input, select, [role=button]`), focus-visible nhìn thấy, thứ tự Tab hợp lý, `prefers-reduced-motion` tắt chuyển động.
4. **Docs:** design-guidelines trỏ `docs/design/so-binh-phap/tokens.json` (token + danh mục component) làm nguồn duy nhất và mô tả cách dùng: tầng golden master (plan.md quyết định #15), quy tắc thêm token/component, `design-tokens.mjs`/`design-compare.mjs --tokens`; cùng header/footer/menu, Thẻ/Bảng, quy tắc 44px, theme theo OS + script chặn nháy, bộ chọn phạm vi mùa + chi tiết cấu hình (không có artboard, theo StyleGuide), quy tắc render an toàn (plan.md quyết định #14); code-standards mô tả mô hình trang mục + `data-page-section`, `SiteLayout` duy nhất, bảng payload mỗi trang mục (Phase 2 bước 2), fetch dữ liệu bằng đường dẫn tuyệt đối `/data/…`, `js/legacy-routes.js`, khóa được giữ theo trang của `safeReturnUrl`, font trong `public/fonts/`, `site-nav.js`, quy trình bản dịch (plan.md "Quy trình bắt buộc mỗi phase" bước 2), cấm giá trị thô ngoài khối token; system-architecture bỏ mô tả `/#khaihoang` và root một trang; README, deployment-guide, unified-lookup, changelog theo danh sách file ở trên.
5. **Full test + gate:** chạy đủ bộ A2 + A3; kiểm quy tắc render an toàn bằng grep `innerHTML|insertAdjacentHTML|outerHTML` trong `js/` — mỗi kết quả còn lại phải là chuỗi tĩnh, liệt kê trong báo cáo; ghi số obligation `authored-vi`/`translate` đã thêm/đổi/bỏ, receipt đã nhận, chuỗi generation qua các phase, vào báo cáo cuối.
6. **Đóng tầng vi mô + tổng hợp:** xóa phần còn lại của khối `legacy` (CSS cũ không còn trang nào dùng thì xóa, còn dùng thì token hóa); `design-tokens.mjs --check` với `ceiling` = 0; `design-compare.mjs --tokens` trên mọi trang × 2 theme; rà `tokens.json`: token không còn selector nào dùng → xóa, ngoại lệ còn lại liệt kê có nguồn. Tổng hợp báo cáo so ảnh 24 artboard trang + báo cáo StyleGuide của Phase 1 (link `visual-phase-*.md`), liệt kê chỗ lệch giữ lại có lý do. docs/design-guidelines trỏ `tokens.json` (token + danh mục component) làm nguồn duy nhất, không chép bảng giá trị.

## Verification
- Gate đầy đủ (plan.md "Quy trình bắt buộc mỗi phase" bước 3) + `python3 -m pipeline.team_route_handles --check`.
- `node scripts/design-tokens.mjs --check` (không còn khối legacy) + `node scripts/design-compare.mjs --tokens` mọi trang, `--theme light` và `--theme dark` → 0 lệch chưa giải thích (A1).
- `python3 -m pipeline.site_localization check --root . --stage public` → không problem.
- Script tương phản / vùng bấm / cuộn ngang: 0 vi phạm (đầu ra dán vào `reports/phase-10-final.md`).
- Người dùng xem báo cáo so ảnh và duyệt trước khi xin quyền deploy (deploy không thuộc plan).
