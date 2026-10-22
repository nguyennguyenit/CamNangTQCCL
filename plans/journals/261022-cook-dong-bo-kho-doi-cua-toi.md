# Cook: Đồng bộ kho (#21) và Đội của tôi (#23)

Plan `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/`, `--tdd`, worktree `feat/dong-bo-kho-va-doi-cua-toi` (trên `origin/main` `1fa81ab`, chưa commit).

## Đã làm
- Phase 1: đo kích thước → hạ `notes` 2 400 → 2 000 B; byte tính sau JSON escape; người dùng duyệt `docs/roster-sync.md`.
- Phase 2–7: `/api/roster` + `0011_roster.sql`; client `roster-*`; bảng chọn nhanh, gỡ chặn AI; `my-teams-*`, trang `/doi-cua-toi/`, nút lưu ở 5 nguồn; docs rollout.
- Review: 2 High (xóa nhóm luôn báo conflict; pull không kiểm chủ tài khoản), 5 Medium, 8 Low — đều sửa kèm test hồi quy.

## Bài học
- `teamId` của Đội chuẩn có chữ Hán (67/1 366) → id `override` và `source.key` phải băm/ASCII; dữ liệu thật phá regex id dự tính.
- Máy chủ giả trong test client phải chạy đúng hợp đồng (thứ tự box/group, chuyển đội khi xóa nhóm); bản giả đơn giản che lỗi H1.
- Công cụ `edit` resolve đường dẫn tương đối theo checkout chính: trong worktree luôn dùng đường dẫn tuyệt đối.
- Mỗi phase sửa file bị ghim bản dịch là một lần publish lại; xóa generation trung gian ngay.

## Còn lại
- Rollout D1 `0011` → Worker → Pages và một lượt đăng nhập Google thật + lưu/đọc trên production (người dùng làm).
- Batch 200 bản ghi / 601 câu D1 mỗi request: kiểm lại với giới hạn gói D1 thật.
