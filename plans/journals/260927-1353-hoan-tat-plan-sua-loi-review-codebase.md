---
title: Hoàn tất plan sửa lỗi review toàn codebase
date: 2026-09-27
summary: "7 phase, 109 finding, 22 commit; gate A2 xanh"
---

# Hoàn tất plan sửa lỗi review toàn codebase

## What happened
- Thực thi plan `plans/260926-1648-sua-loi-review-codebase` qua 7 phase, 22 commit từ `a244e66` tới `7623a7e`; gate A2 xanh ở cuối mỗi phase.
- Lỗi nặng: regex cờ `v`, tìm "đ", ID `hero:` trong gợi ý, nút Soi đội kẹt, import Chiêu mộ, khoá đội trùng, tên hỏng trong `data/teams.json`.
- UI/UX (3 phần), xoá code chết (JS/Astro/CSS/MCP/Worker/pipeline), hiệu năng (`/khai-hoang/` 11 → 2 request, trang chi tiết 10 → 2), Worker (HMAC IP, KV best-effort, CORS mọi lỗi), MCP (NEXT hết hạn chỉ bỏ slot NEXT, 403/413), pipeline (ID ổn định khi rebuild, lệnh `prune`).
- Người dùng đổi route công cụ giữa chừng (`158e919`); Phase 2 dừng chờ commit rồi tiếp.

## Decision
- Handle đóng băng thắng slug sinh lại (test route handles sửa theo thiết kế ledger).
- Giữ byte `data/books-dict.json` (drift 3 `hanViet` ghi ở báo cáo phase 7).
- Không gộp helper nằm trong `executionHashes` của Lookup (đổi byte generation).

## Next steps
- Deploy cần `wrangler secret put IP_HASH_SECRET` trước; thiếu secret Worker trả 503.
- Rebuild `teams.json` từ HTML vẫn chưa làm được (thiếu 6 Team PK nguồn).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
