---
title: Lập plan sửa lỗi sau review toàn codebase
date: 2026-09-27
summary: "Plan 7 phase xử lý 109 finding review, test-first theo phase, 8 quyết định đã chốt"
---

# Lập plan sửa lỗi sau review toàn codebase

## What happened
- Review toàn codebase bằng 6 reviewer song song (JS lõi, JS công cụ, Astro/CSS, UI live 52 trạng thái trang, pipeline, Worker/MCP) → 109 finding, lưu ở `plans/260926-1648-sua-loi-review-codebase/reports/review-*.json`.
- Lỗi nặng nhất: tìm không dấu không khớp "đ" (`js/unified-lookup.js normalized()`), regex cờ `v` (ES2024) trong `js/season-context.js:36` có thể làm trắng mọi trang trên Safari < 17, Gợi ý đội hiện ID `hero:…`, nút Soi đội kẹt `busy`, import tracker hỏng ghi thẳng localStorage, khóa đội trùng bị loại cả hai, dấu kết hợp thừa trong `data/teams.json`.
- Code chết: 5 module `js/` (team-pk, meta-cu, tactics, hero-list, hero-detail) vẫn publish qua `public-artifact-manifest.mjs`; ~240 dòng factory chết trong `team-filter-section.js`.
- Kiểm lại khi lập plan sửa 3 chẩn đoán: 6 thẻ yxms là slot `source-empty` (lỗi renderer, không phải thiếu dịch); chỉ `missingHeroes` là ID thô; ngoặc （） đến từ `recommended-identity-map.json`.

## Decision
- Mode `--fast` (research = 6 báo cáo review), test-first cho lỗi hành vi, miễn cho xoá code chết/docs/hygiene.
- Mọi phase sửa file bị ghim phải theo quy trình gate bản dịch G0–G8 (hash `sourceFiles`, `UI_LITERAL_OBLIGATIONS`, baseline inventory, publish generation, re-pin route handles, MCP workflow build).
- Quyết định người dùng: Q1 tagline từ `SECTION_DESCRIPTIONS`; Q2 "Nhiều hột" xếp sao đỏ trước bậc; Q3 MCP chỉ bỏ slot NEXT hết hạn; Q4 sửa `teams.json` bằng script + alias, duyệt diff trước publish; Q4b "Bái Sư" là biến thể đệ tử, giữ nguyên; Q5 `git rm` + ignore, không viết lại lịch sử; Q6 HMAC IP với secret `IP_HASH_SECRET`; Q7 nhãn "Thẻ / Thẻ gọn / Bảng".

## Next steps
- Chạy `/ak:cook plans/260926-1648-sua-loi-review-codebase/plan.md`, bắt đầu Phase 1 (chốt 35 file đang sửa dở + generation `f93a51ea…`).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
