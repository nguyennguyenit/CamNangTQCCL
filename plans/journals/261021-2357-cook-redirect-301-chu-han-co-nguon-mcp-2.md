---
title: "Redirect 301, chữ Hán có nguồn, MCP #2"
date: 2026-10-21
summary: "Plan 261020-1112 thực thi xong: PR #19 + PR #22, Pages và MCP cùng SHA 1fa81ab"
---

# Redirect 301, chữ Hán có nguồn, MCP #2

## What happened
- PR #19: `public/_redirects` sinh bởi `lookup_route_handles --write` (36 rule = 2 × 18 `formerIds`); `wrangler pages dev` và production đều `fail=0`; Pages `f9bffd66` (`6b17d23`).
- PR #22: `zhEffects` là đầu vào duy nhất cho chữ Hán ngoài SGSDeck; builder ghi nguồn gốc sgsdeck/baseline/missing và dừng khi thiếu; công khai `lookup.effectZhSource {kind}`. 63 mục: 31 source (bài Bahamut 戰法一覽【S1-S9】), 16 capture, 16 translation; 0 pending. Cờ bản dịch trên hồ sơ vi+zh, thẻ zh, bảng zh; meta zh bỏ hiệu ứng.
- Phát hành: Pages `cb91471a` + Research MCP `62cba122…` cùng `1fa81ab`; MCP #1 `5dc07761…` (`af3bc41`) chạy trước.

## Sự cố
- WSL không có credential GitHub: đồng bộ qua remote `win` (/mnt/c) và `git fetch \\wsl.localhost\…`.
- `mcp-worker check` ghim Node 24.20.0; WSL có 24.14.1 → cài `~/node-v24.20.0`.
- `report-zh-gaps` phải chạy sau `site_localization publish` (đọc pin `website-display.json`).
- Test e2e bảng zh có JavaScript chỉ có trang đầu trong DOM → tách test không JS + test tìm kiếm.
- Test ghim baseline: fixture không gộp mã nên có 5 mã, dữ liệu thật có 3.
- CI MCP: hai lần Playwright timeout trên runner (một lần trước deploy, một lần ở job gate song song); rerun một lần đều xanh.
- `main` đổi hai lần trong lúc chờ (PR #24, docs) → bỏ commit sinh, rebase, sinh lại (`-r2`, `-r3`), force-push đã duyệt.

## Decision
- 三略庫 chỉ có số đầy cấp → không đủ làm `source` khi hiệu ứng có dải cấp.
- Sửa `design-tokens` trong PR #22 theo quyết định người dùng.

## Next steps
- Thêm dải tỉ lệ phát động theo cấp cho `dam-tam`, `tinh-hoa`, `truy-thuong`.
- Test bấm nút phiên bản trên record `translation` nhiều phiên bản.
- Gọi `tqccl_get_entity` production có bearer để xác nhận trực tiếp.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
