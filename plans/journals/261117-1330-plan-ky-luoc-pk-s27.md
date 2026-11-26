---
title: "Plan kỳ lược PK-S27: Tra cứu, ô đội chuẩn, #119"
date: 2026-11-17
summary: "Lập plan hard/tdd cho nhóm Tra cứu Kỳ lược, ô kỳ lược trang Đội chuẩn và đổi tên ghi chú (#119); red-team sửa đường publish"
---

# Plan kỳ lược PK-S27: Tra cứu, ô đội chuẩn, #119

## What happened
- Lập plan `plans/261117-0555-ky-luoc-tra-cuu-va-o-doi-chuan/` (6 phase): dữ liệu client kỳ lược, nhóm Tra cứu `ky-luoc` có MCP, tính `qilue` đội lúc publish, ô kỳ lược trên trang Đội chuẩn và MCP đội, đổi tên trong ghi chú (#119), publish.
- Nguồn dữ liệu: client Global 24.547 (`plans/reports/261117-client-ky-luoc-pk-s27.md`, PR #120).
- Ba reviewer red-team ra 15 phát hiện (1 Critical, 9 High, 5 Medium). Áp hết, một phát hiện chỉ áp một phần.

## Bài học
- Recommended được publish qua `site_localization.compile_candidate` → `hydrate_inputs` → `build_generation`. `attach_display_notes` chỉ chạy lúc capture pack. Corpus hash được tính ở 4 chỗ, và có 2 danh sách trường dẫn xuất (`display_fields`, `ROW_DERIVED`).
- Thêm nhóm Tra cứu thứ 8 thì phải:
  - phát entity cho MCP, vì ledger dùng `exactKeySet`;
  - migrate ledger route, vì `--write` từ chối ledger 7 nhóm;
  - thêm nhánh `describe()` cho meta.
- `aliasesZh` là khóa công khai và đứng trước `nameZh`. Biến thể chữ Hán sai không được đặt ở đó.
- Merge vào `main` sẽ tự deploy Pages và MCP. Gate duyệt nằm ở lúc merge.

## Decision
Chốt với anh ở Validation Session 1:
- Tên phương lược theo thẻ chọn của client.
- Bản zh của hiệu ứng là dịch từ tiếng Việt, không mở allowlist sgsdeck.
- Ẩn block ghi chú trùng trên trang chi tiết.
- MCP đội nằm trong phạm vi.
- #119 gộp chung một PR.

## Next steps
- Anh duyệt plan rồi chạy `/ak-cook plans/261117-0555-ky-luoc-tra-cuu-va-o-doi-chuan/plan.md --tdd` trên branch `feat/ky-luoc-tra-cuu-o-doi-chuan`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
