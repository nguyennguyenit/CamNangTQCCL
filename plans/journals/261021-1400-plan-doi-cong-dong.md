---
title: "Plan Đội cộng đồng: kho đội theo mùa, duyệt, vote, chiến báo"
date: 2026-10-21
summary: "Advise + plan --hard --tdd 7 phase; red team 36 → 15 đã áp; validation 4 quyết định"
---

# Plan Đội cộng đồng: kho đội theo mùa, duyệt, vote, chiến báo

Plan: `plans/261021-0628-doi-cong-dong/`. Chưa sửa code, chưa commit.

## Kiểm chứng đã chạy (đọc code, không build)
- `uploads.kind` có CHECK `('report','post')`; chưa migration nào rebuild bảng → ảnh đội đi qua `kind='report'` với khoá `pending/team-`, không rebuild.
- AI: community-worker chỉ đọc tướng (không CP); `worker/src/model.ts` `callModel(…,'analyzeTeamImage')` đọc cả CP và chỉ phụ thuộc `shared/` → import thẳng.
- Không có danh sách mùa có nhãn zh; `battle_reports.season` luôn NULL → bảng `community_seasons` riêng.
- Generated column STORED + `log10` + trigger chạy với `ON DELETE CASCADE` (thử trên SQLite 3.53.4); D1 production chưa kiểm phiên bản.

## Red team (4 lens, 36 → 15)
Bẫy lớn: sửa `SiteLayout.astro` (bị pin) kéo theo sinh lại cả thế hệ bản dịch; `mountComments`/`mountReports` lọc `lang` ở client, phá kho chung vi/zh; `update uploads` không guard (reports.ts:174) làm mất dấu ảnh khi double submit; xoá D1 trước R2 để lại object mồ côi; regex uuid loại id harness; allow-list id lỗi thời vì `data/` đổi nhanh hơn Worker; push `main` không deploy Pages.

## Quyết định
Chặn chủ tự xoá đội khi có chiến báo duyệt của người khác; khoá tài khoản xoá vote; cập nhật Chính sách bảo mật + xoá ảnh đội bị từ chối; hằng số theo đề xuất (×2 chiến báo, τ 2 ngày, AI 20/user + 300/ngày toàn site).

## Tiếp theo
`/ak:cook plans/261021-0628-doi-cong-dong/plan.md --tdd`. Bước remote (migrate, deploy, Pages workflow) cần hỏi trước.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
