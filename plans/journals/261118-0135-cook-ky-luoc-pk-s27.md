---
title: "Cook kỳ lược PK-S27: Tra cứu, ô đội chuẩn, MCP, #119"
date: 2026-11-17
summary: "Thực hiện plan 261117-0555 qua 6 phase, PR #132"
---

# Cook kỳ lược PK-S27: Tra cứu, ô đội chuẩn, MCP, #119

## What happened
- Làm plan `plans/261117-0555-ky-luoc-tra-cuu-va-o-doi-chuan/` theo TDD, ra PR #132 gồm 11 commit cùng một merge với `main`.
- Phase 2 và Phase 4 chạy song song bằng agent, chia theo nhóm file: pipeline, web và MCP. Hai đợt reviewer độc lập duyệt bản dịch (#119).
- Reviewer vòng 1 từ chối 17 trong 70 vị trí. Lý do: bảng đổi tên thiếu phiên âm của các biến thể chữ Hán sai, và 久戰 bị dịch thành "Cửu Chiến". Vòng 2 chấp nhận 1201/1201.

## Lỗi phát hiện khi publish thật
- Hàng `details` trong source pack không có `safeScopeKey`, nên khóa `qilue` phải lấy từ scope của nhóm. Fixture test cũ không bắt được lỗi này vì hàng detail chép nguyên từ index.
- Sau khi merge `main` (#124) thì conflict ở generation, policy và route handles. Cách xử lý: lấy bản `main` cho các file sinh ra, tính lại hash nguồn và baseline inventory, rồi publish lại.
- Fixture catalog e2e của `season-lookup` thiếu khóa mới, làm trang công cụ không khởi động.

## Next steps
- Review Astra → Fable rồi merge (merge là deploy production), sau đó smoke.
- Theo sau: Cùng Tồn hiện "Thẻ Kỳ Lược" bằng chữ sheet chưa link sang Tra cứu; "Trấn Giữ Quân Diên" khác tên client.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
