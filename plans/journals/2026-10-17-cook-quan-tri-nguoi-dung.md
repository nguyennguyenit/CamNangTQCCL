---
title: "Cook quản trị người dùng (KDV, khoá, xoá, nhật ký)"
date: 2026-10-17
summary: "Thực thi plan 261016-1757 trên worktree feat/quan-ly-nguoi-dung với --tdd --advice; 6/6 phase xanh, chưa commit/deploy"
---

# Cook quản trị người dùng (KDV, khoá, xoá, nhật ký)

## What happened
- Worktree `../worktrees/CamNangTQCCL-quan-ly-nguoi-dung`, nhánh `feat/quan-ly-nguoi-dung`; plan copy vào worktree (plan chưa được track trên main).
- Phase 1–6 thực thi tuần tự qua subagent, kongming checkpoint sau mỗi phase.
- Kongming bắt được: R2 mồ côi khi trigger chặn insert `uploads` (analyze, post upload); thiếu test cookie thật; DELETE comment thiếu điều kiện root email trong SQL; scan reject trả thành công khi 0 dòng; 2 race UI (response trễ đè user khác, DELETE gửi 2 lần).
- Smoke thật (wrangler dev + pages dev, D1 local, session seed ký bằng better-call) bắt 3 lỗi UI: chữ "null" từ `replaceChildren(null)`, lệch hàng bộ lọc, nhãn target type thô.
- Review cuối: thêm audit `partial` step d1 khi batch xoá cuối lỗi; tách miền HMAC token ban-notice (`ban-notice:v1.`).

## Decision
- Policy KDV giữ theo ma trận chi tiết: chặn tự duyệt ở chiến báo/soi đội; chặn xoá comment của staff. KDV vẫn duyệt được nội dung của KDV khác/root (reviewer nêu rủi ro thông đồng) — cần người dùng chốt.
- User duyệt sửa 1 dòng ngoài phạm vi: `src/lib/public-artifact-manifest.mjs` đăng ký `js/community-admin-users.js`.
- Phase 2 bỏ bước red; bù bằng mutation pass (4 mutation đều bị bắt).

## Next steps
- Chốt policy KDV duyệt nội dung staff.
- Commit/PR khi được phép; deploy theo thứ tự migration → Worker → Pages trong `reports/phase-06.md`; thử trigger trên D1 remote không phải production trước.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Cập nhật sau review
- Người dùng chốt: KDV được duyệt/từ chối chiến báo và mẫu soi đội của chính mình. Bỏ `self_review` ở `reports.ts` `review()` và `scan.ts` approve/reject (cả điều kiện `user_id <> ?` trong UPDATE và audit exists). Test đổi trước (5 đỏ), rồi sửa → 386/386. Ghi vào Validation Session 2 của plan.
