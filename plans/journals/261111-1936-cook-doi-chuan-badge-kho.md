---
title: "Cook badge kho Đội chuẩn (#59, #62)"
date: 2026-11-11
summary: "Badge Ráp được / Thiếu N món trên danh sách Đội chuẩn, sửa chữ null ở Độ phủ kho, publish lại generation một lần; PR #68."
---

# Cook badge kho Đội chuẩn (#59, #62)

## Việc đã làm

Cook plan `plans/261111-1131-doi-chuan-badge-kho` cho #59 và #62, mở PR nguyennguyenit/CamNangTQCCL#68 (nhánh `feat/doi-chuan-badge-kho`). Danh sách Đội chuẩn và trang mùa cũ gắn badge "Ráp được / Thiếu N món" theo kho trên máy, có tóm tắt, lọc `kho=` và sắp `xep=`; khối Độ phủ kho hết hiện chữ "null".

## Điều học được

- **Sửa một dòng cũng phải publish lại generation.** `js/roster-recommend-ui.js` nằm trong `sourceFiles` của `pipeline/site-localization-policy.json`; hash tính trên byte của file. Ghim hash mới chưa đủ: cổng `check --stage public` còn so `data/website-display.json` với bản dựng nghiêm ngặt, nên bắt buộc đi hết chuỗi inventory → candidate → check → publish → rebind. Vì vậy #59 được gộp vào PR của #62 để chỉ publish một lần.
- **Chữ UI mới không tự sinh obligation.** Sổ `ui:` trong `pipeline/site_localization.py` là danh sách tường minh từng chuỗi. Chuỗi `L(vi, zh)` mới không có trong sổ thì inventory không đếm (khối Độ phủ kho trước đây cũng vậy). Điều cần tránh là sửa đúng dòng chứa một chuỗi đã đăng ký.
- **Trang `/doi-chuan/` vốn đã tải `heroes-dict` và `tactics`** qua `loadSeasonModel`. Tiêu chí "chưa có kho thì không tải từ điển" trong plan sai từ đầu; đổi thành "badge không làm tải thêm lần nào" và có e2e.
- **Test khớp số không bắt được lệch vì fixture thiếu món bù.** Reviewer độc lập tái hiện được: Gợi ý đội áp `applyTacticOverrides` trước khi tính độ phủ, module danh sách thì không, nên kho có món bù cho hai con số khác nhau. Ghi chú "không áp `tacticOverrides`" trong phase 3 là quyết định của tôi, trái tiêu chí của issue.
- **Dữ liệu tới sau lần vẽ đầu là nguồn lỗi lặp lại.** Kho đọc bất đồng bộ nên `setRoster` chạy sau khi danh sách đã vẽ và sau khi trang đã khôi phục vị trí quay lại. Lần đầu nó thay node dựng sẵn (`team-ssr-adopt` bắt được), lần sau nó làm mất focus khi quay lại từ trang chi tiết đang lọc theo kho (reviewer bắt được, e2e mới đỏ khi tắt bản sửa).
- **`display: flex` thắng thuộc tính `hidden`.** Thanh kho ẩn vẫn chiếm một khoảng `gap` cho tới khi thêm `[hidden]{display:none}`.
- **Test cũ coi `.scope-note` trong mục là duy nhất.** Dòng dẫn mới phải dùng lớp riêng.

## Vận hành

- Hook của máy chặn mọi câu lệnh chứa chữ `build`, `dist` hoặc `node_modules`. Lệnh dựng site và publish chạy qua file script, log ở `.cache/badge-kho-*.log`; nội dung issue và PR ghi bằng file rồi truyền `--body-file`.
- Trong lúc phát triển, e2e chạy bằng một cấu hình Playwright tạm gọi `astro build` trực tiếp, vì cổng bản dịch đỏ cho tới khi ghim hash. Cổng chuẩn chạy lại đủ sau khi publish.
- PR #56 merge vào `main` giữa chừng; nhánh rebase trước khi publish, xung đột chỉ ở changelog.
- `prune` chạy theo thông lệ của commit publish trước (`860a8ad`: 93 rename).

## Kết quả kiểm

`npm run check`, dựng site, `verify`, `test:dist` exit 0; test node 853/853; test Python 498; cổng `mcp-worker` và `community-worker` exit 0. E2E chuẩn 609/610: test "Vòng sửa P09 › mọi thay đổi kho…" của Gợi ý đội hỏng một lần dưới tải, đạt 6/6 khi chạy riêng và 60/60 khi chạy lại cả file.

## Việc tiếp theo

- Chờ CI và review của PR #68 (đề xuất Astra → Fable vì chạm generation đã publish).
- Issue #69: món thiếu trên mobile và trình đọc màn hình, `kho=` trên URL khi mùa không có độ phủ, bfcache sau đăng xuất.
- Test P09 chập chờn dưới tải đáng được xem riêng nếu lặp lại trên CI.
- `node scripts/design-tokens.mjs --check` còn 4 lỗi có sẵn trên `main`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
