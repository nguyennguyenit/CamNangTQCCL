---
title: Cook đội cộng đồng (phase 1–7 local)
date: 2026-10-21
summary: Triển khai đầy đủ Đội cộng đồng trong worktree feat/doi-cong-dong; gate xanh; bước remote chờ duyệt
---

# Cook đội cộng đồng (phase 1–7 local)

## What happened
- Worktree `../worktrees/CamNangTQCCL-doi-cong-dong` (branch `feat/doi-cong-dong`), plan copy vào worktree.
- Phase 1–6 theo `--tdd` (test đỏ trước); phase 7 docs + full gate + smoke API cục bộ.
- Local workerd D1 cấm `log10` → `hot_rank` dùng `log()` (SQLite base 10).
- Hai subagent (phase 5 + review đầu) bị abort giữa chừng; chạy lại tiếp từ trạng thái trên đĩa.

## Decision
- Sửa sau review backend: `/api/me/community-teams` trả cả đội xoá dở (`deleting: true`), admin `status=deleting`; `teamsPending` bỏ đội đang xoá; gọi lại reject trả lý do đã lưu; id mùa `all` bị cấm; mở mùa dùng optimistic check → 409 `season_conflict`.
- Sửa sau review frontend: không xoá chữ người dùng gõ sai (aria-invalid), nạp books-dict thật cho form AI (ca 三军之众), lỗi trường từ server có thông điệp + focus, đếm độ dài theo code point.

## Evidence
worker 537 test + typecheck; test:node 614; build; verify 5406; test:dist 49; test:e2e 533. Smoke wrangler dev + D1/R2 cục bộ đi đủ vòng mùa → đăng → duyệt → vote → chiến báo → đổi mùa → xoá.

## Next steps
- Remote (cần duyệt): kiểm `sqlite_version()` + hỗ trợ `log()` trên D1 production, bookmark Time Travel, migrate remote, deploy Worker, push main, `gh workflow run pages-deploy.yml`, mở mùa đầu, smoke production vi/zh.
- books-dict tải ở form không kiểm hash pin như app.js (cần sửa SiteLayout bị pin).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
