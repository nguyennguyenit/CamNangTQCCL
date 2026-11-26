---
title: Plan dựng sẵn khung bộ lọc Đội chuẩn/Đội khác
date: 2026-11-26
summary: "Plan 3 phase dựng sẵn khung bộ lọc; red-team 16 phát hiện đều áp; tách 3 issue #180-#182"
---

# Plan dựng sẵn khung bộ lọc Đội chuẩn/Đội khác

## What happened
- Anh hỏi vì sao trên /doi-chuan/, /doi-khac/ danh sách đội hiện trước bộ lọc. Nguyên nhân: recommendedSectionTrees chỉ dựng sẵn header và .reference-view; khung (toolbar, sidebar lọc, ô chọn mùa) do createRecommendedSection dựng sau khi app.js tải và xác minh index.json (4,36 MB), seasons và other-teams.
- Fable (claude-fable-5-2) khuyến nghị Phương án 1: dựng sẵn cả khung, khoá điều khiển. Anh chốt.
- Tạo issue #180 (index.json chặn tương tác), #181 (thanh kho đẩy danh sách), #182 (modulepreload).
- Plan: plans/261126-0819-dung-san-khung-bo-loc-doi-chuan-doi-khac (3 phase, --hard --tdd).

## Decision
- Red-team 3 reviewer: 16 phát hiện sau gộp, 7 High, đều chấp nhận.
  - Delegation phải tránh chip kho (.fchip.roster-chip) và ô chọn mùa nằm ở header.
  - Boot lỗi phải gắn data-ssr-failed để ẩn khung.
  - Client giữ nguyên node khung tại chỗ để focus không mất.
  - ?source=__proto__ làm t() crash.
  - Collator tất định giữa Node và trình duyệt.
- Thanh kho Đội chuẩn: loại khỏi tiêu chí ≤1px, test đo đúng chiều cao thanh kho; để #181 xử lý.
- app.js không tải được: chấp nhận điều khiển bị khoá.

## Next steps
- /ak:cook plans/261126-0819-dung-san-khung-bo-loc-doi-chuan-doi-khac/plan.md --tdd trên branch feat/ssr-khung-bo-loc từ main.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
