---
title: Plan Đội cộng đồng công khai
date: 2026-10-22
summary: Chốt và kiểm chứng hướng đưa Đội cộng đồng ra menu/landing và trang tĩnh SEO; plan 261022-1145 --fast --tdd
---

# Plan Đội cộng đồng công khai

## What happened
- ak:advise chốt scope: menu + thẻ landing, trang tĩnh /doi-cong-dong/<id>/ (vi+zh) index được, danh sách noindex tới khi đủ 10 đội, rebuild qua repository_dispatch như Bài viết.
- Fable review và debate (Proponent/Skeptic) sửa lời khuyên: bỏ dispatch ở reject/đóng mùa; thêm unban, ban hết hạn (schedule), dispatch ở pha 1 của xoá; endpoint export vì list API thiếu analysis; alternates=false cả hai bản; đếm id duy nhất.
- Kiểm chứng thực nghiệm trong worktree tạm: route mới không bị gate localization; sửa SiteLayout.astro làm gate fail (stale hash); verifier allowlist chặn trang đội mới.
- Plan: plans/261022-1145-doi-cong-dong-cong-khai (4 phase, 3d), ak plan validate OK.

## Decision
- Đảo Red Team #1 của plan 261021-0628: sửa SiteLayout.astro + Landing.astro và chạy chuỗi publish localization, vì menu tài khoản không cho khách thấy.
- Ban/unban/xoá user luôn dispatch; smoke production được phép tạo đội thử [SMOKE] rồi xoá.

## Next steps
- /ak:cook plans/261022-1145-doi-cong-dong-cong-khai/plan.md trong worktree feat/doi-cong-dong.
- Rủi ro mở: Pages giữ deploy mới nhất khi run bị cancel chưa kiểm thực nghiệm.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
