---
date: 2026-07-28
session: phase-03-research-tools-data-loaders-cli
---

# Nhật ký: 2026-07-28 — Phase 3 research tools, data loaders và CLI

## Bối cảnh

Phase 3 xây boundary TypeScript dùng chung cho sáu artifact dữ liệu, hai nguồn filesystem/R2, tám research handler và JSON CLI. Phạm vi dừng trước MCP transport; toàn kế hoạch vẫn đang thực hiện.

## Diễn tiến

1. **TDD RED:** bổ sung fixture release và test cho manifest/snapshot, FS/R2 parity, cache cạnh tranh, tám handler, workflow/binding, bounds, CLI subprocess và CPU proxy. Các test ban đầu làm lộ những khoảng trống về collision canonical, giới hạn kích thước không đồng nhất, stale deadline, request/result quá lớn và phân trang toàn corpus.
2. **GREEN nền dữ liệu:** triển khai canonical manifest với full `releaseId`, validate hash/kích thước/cross-reference trước activation, filesystem loader độc lập CWD và R2 loader chỉ đọc key đã khai báo. FS và R2 cùng áp dụng `MAX_ARTIFACT_BYTES`, đồng thời kiểm exact `byteLength`/hash từ manifest.
3. **GREEN cache và index:** cache chỉ kích hoạt snapshot hoàn chỉnh, single-flight refresh và compare-and-swap ngăn refresh cũ ghi đè bản mới. `serveStaleUntil` neo vào lần activation thành công gần nhất; refresh lỗi không được gia hạn deadline.
4. **GREEN contract và CLI:** `research-contracts.ts` trở thành schema authority cho tám request/result; handler trả version, provenance, warning và trạng thái truncation/cursor. CLI ánh xạ một-một vào shared dispatch, chạy ngoài repository CWD và chỉ xuất một JSON document.
5. **Debugger/reviewer fixes:** chặn canonical dictionary collision trước activation; cân bằng giới hạn kích thước FS/R2; siết byte/node/depth/collection bounds cho request và trần kết quả `64 KiB`; sửa stale deadline tuyệt đối; giữ offset theo toàn bộ index để phân trang hết `631` search entries, vượt mốc `500`, không lặp trang. Reviewer cuối **PASS**.
6. **Xác nhận cuối:** Node `22.16`; MCP `131/131`, root Node `133/133`, Python `82/82`, Vision Worker `53/53`. `check:workflow-build`, typecheck, build và smoke CLI đều **PASS**.

## Ghi nhận

CPU proxy trên `693` artifact records và `60` observations ghi nhận cold load `11.56ms`, index `21.87ms`, warm normalize/recommend `25.92ms`. Đây là phép đo proxy quan sát trước transport, không phải SLA.

## Quyết định

| Quyết định | Lý do | Tác động |
|---|---|---|
| Dùng full `releaseId` trong `workflowVersion`; `dataVersion` chỉ hiển thị | Tránh collision của nhãn rút gọn | Cursor và confirmation binding fail closed khi workflow đổi |
| Chỉ activate snapshot sau mọi kiểm tra | Không phục vụ release thiếu, trộn hoặc hỏng | Cache không làm thay đổi tính đúng đắn |
| Dùng chung runtime schema và dispatch | Tránh drift giữa CLI và MCP transport tương lai | Phase 4 có thể đăng ký nguyên tám handler |
| Giữ Python utility và transport ngoài Phase 3 | Giữ scope và boundary đã chấp nhận | Không có stdio/HTTP hay MCP SDK trong thay đổi này |

## Bước tiếp theo

- Phase 4 vẫn **Pending**: thêm stdio và Streamable HTTP trên cùng handler/schema, không đổi tên hay nhân đôi contract.

## Câu hỏi chưa giải quyết

- Không có blocker còn lại cho Phase 3.
