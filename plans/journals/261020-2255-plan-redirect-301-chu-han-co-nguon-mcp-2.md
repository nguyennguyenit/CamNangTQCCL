---
title: "Plan redirect 301, chữ Hán có nguồn, MCP #2"
date: 2026-10-20
summary: "Plan --hard 7 phase sau red-team: 63 mục zhEffects, kind capture, ref riêng tư, đóng băng main khi phát hành"
---

# Plan redirect 301, chữ Hán có nguồn, MCP #2

## Đã làm
- Lập plan --hard `plans/261020-1112-redirect-chu-han-mcp/` (7 phase) cho: redirect 301 cho link cũ, chữ Hán có nguồn, cờ bản dịch, deploy Pages + MCP #2. MCP #1 nằm ngoài plan và là điều kiện tiên quyết.
- Bằng chứng gom ở `reports/bang-chung.md` từ session cũ 01a14098, phần rà của Astra (gpt-6-astra) và 2 scout.

## Phát hiện chính
- File gốc chữ Hán trong `%TEMP%\tqccl-cap\tx\` đã mất (chỉ còn unmatched.json); script WSL mirror *-w.sh cũng mất; `~/w` đang ở nhánh cũ và có sửa dở, nên plan dùng clone mới `~/w2`.
- Red-team 4 góc phát hiện 3 chiến pháp lấy chữ Hán giản thể từ baseline cũ (nhanh-tri-dong-nao, luc-luc-thuong-quoc, vo-song-thuong-tuong), số liệu lệch tiếng Việt. Tổng số mục cần nguồn tăng lên 63, và builder phải tự tính nguồn gốc của từng hiệu ứng.
- `ref` công khai vi phạm docs/unified-lookup.md:14, nên chỉ xuất bản `{kind}`. Promote phải dùng `paths: []`. Bỏ bước build_recommended_reference tay.

## Quyết định của người dùng
- Thêm kind `capture` (không gắn cờ) cho 16 TROOP chụp từ client TW.
- Cờ hiện ở bảng nhóm zh; meta/JSON-LD zh bỏ đoạn hiệu ứng với mục dịch.
- Deploy Pages ngay sau PR-A; câu cờ vi/zh như đề xuất; host nguồn: sanzhan.slgsim.com, forum.gamer.com.tw.

## Tiếp theo
- Chạy MCP #1, rồi `/ak:cook plans/261020-1112-redirect-chu-han-mcp/plan.md`.
- Model scout (opencode-go/deepseek) hết hạn API key, cần thay key.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
