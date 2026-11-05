---
title: "Plan đồng bộ kho (#21) và Đội của tôi (#23)"
date: 2026-10-21
summary: "Advise + plan --hard --tdd 7 phase; red team 39 → 15 đã áp; validation 2 quyết định"
---

# Plan đồng bộ kho (#21) và Đội của tôi (#23)

Plan: `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/`. Chưa sửa code, chưa commit. Đã comment tóm tắt lên #21 và #23.

## Kiểm chứng đã chạy (đọc code, không build)
- `recruit_records` (`0004_recruit.sql`): LWW `excluded.updated_at > …`, xoá mềm bằng `deletedAt` trong payload, quota đếm cả bản xoá.
- Kho Gợi ý (`tqccl.rosterRecommend.scanState.v1`) không lưu `canonicalId` cho món thêm tay hay đọc ảnh; engine suy ID từ tên (`team-recommend-engine.js:85-95`).
- Trang Đội chuẩn adopt HTML dựng sẵn, không tải dữ liệu đội (`team-detail.js:119`); biến thể Đội khác chỉ có lúc chạy (`other-teams.json`).
- `isAnalyzeConfigured()` luôn đúng ở production (`js/config.js` giá trị cứng).
- Module mới trong `js/` phải vào `PUBLIC_ARTIFACTS`; 18 chỗ trong `site-localization-policy.json` ghim các file sẽ sửa.
- Subagent scout/Explore lỗi khoá API hết hạn; scout làm tay, red team chạy được bằng `code-reviewer`.

## Red team (4 lens, 39 → 15)
Bẫy lớn: gộp lần đầu đẩy 0 món vì thiếu `canonicalId`; blob `tool` 4 KiB vượt trần và kẹt cả batch; bản xoá giữ payload và tính quota; lệch đồng hồ làm mất sửa mà vẫn báo "đã lưu"; gộp lần đầu hồi sinh món đã xoá; biến thể Đội khác/Khai hoang lưu nhầm bản mặc định; đội từ Gợi ý thiếu binh thư và hash không bao giờ khớp; build/check đỏ vì manifest và bản dịch ghim.

## Quyết định
Giữ xoá hộp/nhóm (server xoá hẳn con khi xoá hộp); hỏi trước khi gộp kho local. Migration `0011_roster.sql` vì plan Đội cộng đồng (`261021-0628-doi-cong-dong`) đã giữ `0008`–`0010`; hai plan sửa chung `COMMUNITY_PAGES`, `_headers`, menu tài khoản, bản dịch.

## Tiếp theo
`/ak:cook plans/261021-0632-dong-bo-kho-va-doi-cua-toi/plan.md --tdd`, dừng cuối phase 1 để duyệt schema. Migrate/deploy remote cần hỏi trước.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
