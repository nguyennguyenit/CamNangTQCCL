# 2026-09-28 — Theme tối rõ lớp, nút đổi giao diện theo chế độ

## What happened
Người dùng thấy theme tối "khó nhìn" và nút đổi giao diện không cho biết đang ở chế độ nào. Đo token thật cho thấy chữ đã đạt chuẩn (chữ phụ 6,43:1); vấn đề là các lớp dính nhau: thẻ ↔ nền 1,10:1, header 1,05:1, footer 1,02:1 (`--footer-bg` dùng chung hai theme). Nút là một icon mặt trăng cố định, trạng thái chỉ ở `aria-pressed`.

## Decisions
- Giữ tông mực/son ấm; chỉ sửa khối `color.dark` + `footer-bg` tối + `f-honhop` tối. Theme sáng không đổi pixel (so 4 trang: 0 pixel khác).
- Header/footer không thể tối hơn nền mà vẫn đạt 1,25:1 khi nền gần đen (thử 4 bộ: 1,06–1,08). Tách bằng tông dải `#1A1814` + vạch `--line` qua box-shadow inset (`none` ở theme sáng, không đổi bố cục).
- Ngưỡng nằm cùng token (`meta.contrast`) và được `design-tokens --check` cùng `tests-js/design-tokens.test.mjs` giữ, thay vì chỉ ghi trong tài liệu.
- Nút: icon chọn bằng CSS theo `html[data-theme]` (đúng trước khi JS chạy), tên theo hành động, bỏ `aria-pressed` vì tên đổi + trạng thái nhấn sẽ đọc ngược nghĩa.

## Surprises
- `--accent` trên `--accent-soft` (huy hiệu, nút xoá hover) đã trượt 4,5:1 từ trước (4,46:1); son nhạt đậm hơn làm nó tệ hơn nên phải nâng cả `--accent`.
- `.t-bond` dùng màu phe Hỗn hợp làm chữ trên panel-2; nâng panel-2 để hover rõ kéo nó xuống 4,40:1 → chỉnh nhẹ `--f-honhop` tối.
- `design-tokens --check` đã đỏ từ commit `72bab2b` (2 giá trị thô ở `.detail-tier`, `.detail-note-owner`), ngoài phạm vi theme nên để nguyên.

## Left open
- Generation Recommended cũ (`35657d5d…`, `85425612…`) chưa prune: xoá generation là bước phá huỷ cần chủ repo chạy `python3 -m pipeline.site_localization prune --root .`.
