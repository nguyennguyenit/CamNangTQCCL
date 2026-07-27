---
date: 2026-07-25
session: "Astro Phase 3 browser parity and legacy cutover"
status: completed
plan: "../260723-2127-migrate-static-spa-to-astro/plan.md"
---

# Journal: 2026-07-25 — Astro Phase 3 cutover

## Context

Phase 3 chuyển quyền sở hữu document shell từ root HTML sang Astro static output, với điều kiện các hợp đồng browser, data, storage và local UI không đổi. Đây là bản ghi lịch sử công việc; plan, phase files, tests và tài liệu hiện hành mới là nguồn thẩm quyền.

## What happened

- Cùng một Playwright parity spec vượt qua cả legacy và Astro trước cutover: `22/22`.
- Root `index.html` được xóa sau parity proof; Astro trở thành document authority duy nhất và bộ Chromium cuối vượt qua `11/11`.
- Synthetic `https://astro.local/` chỉ phục vụ nội dung từ `dist/`, stub icon bên thứ ba, ghi nhận Chromium nâng HTTP icon request lên HTTPS, và từ chối path thoát khỏi `dist/`.
- Các gate root Node, Python và Worker vượt qua; Node 22.16.0 cũng được kiểm tra riêng.
- Các build Node 24 liên tiếp và build Node 22 tạo cùng digest cho `dist/`: `5c91f2798bbf2fa1e6172ad492a5eb1d140e1560515107ce14befd7fc80dd987`.

## Reflection

Cutover diễn ra sau bằng chứng dual-target thay vì dựa vào hình thức tương đồng của shell. Việc tăng cường synthetic HTTPS containment giúp phép thử mixed-content vừa hermetic vừa không mở rộng phạm vi sang self-host icon hoặc gọi dịch vụ ngoài. Phần còn thiếu thuộc release readiness và tài liệu, không phải browser parity.

## Decisions

| Decision | Rationale | Impact |
|---|---|---|
| Xóa root `index.html` sau khi dual-target đạt `22/22` | Tránh hai document authority sau khi compatibility đã được chứng minh | Astro là shell duy nhất; contract test yêu cầu legacy entry tiếp tục vắng mặt |
| Giữ synthetic HTTPS hoàn toàn trong `dist/` | Characterize mixed-content mà không dùng certificate hay live third-party traffic | E2E mặc định hermetic và có kiểm tra containment |
| Hoãn release/docs sang Phase 4 | Phase 3 chỉ sở hữu browser parity và legacy cutover | `_headers`, Pages runbook và evergreen docs vẫn pending |

## Next

- Chờ phê duyệt để thực hiện Phase 4.
- Thêm `_headers`, mở rộng shared artifact policy và cập nhật tài liệu sở hữu workflow deploy.
- Giữ Pages inspection/deployment và Vision canary ngoài phạm vi cho đến khi có ủy quyền riêng.
