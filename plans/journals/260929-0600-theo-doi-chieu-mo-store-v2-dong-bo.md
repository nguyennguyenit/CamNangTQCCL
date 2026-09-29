---
title: "Theo dõi chiêu mộ: store v2, thiết kế lại, đồng bộ tuỳ chọn"
date: 2026-09-28
summary: "Làm lại /theo-doi-chieu-mo/ trên store v2 (bản ghi LWW), UI ghi một chạm + Hoàn tác + nhật ký, đồng bộ D1 tuỳ chọn"
---

# Theo dõi chiêu mộ: store v2, thiết kế lại, đồng bộ tuỳ chọn

## What happened
- Store `js/recruit-tracker-store.js` lên schema v2: một luồng bản ghi có `id/updatedAt/deletedAt`; bảo hiểm tính từ lượt sắp theo `occurredAt` thay vì thứ tự mảng + `dailyStates`. Fixture `tests-js/fixtures/recruit-tracker-v1.json` sinh bằng chính store v1 trước khi sửa (TDD) và giữ nguyên bảo hiểm/lịch sử sau chuyển đổi.
- UI viết lại (ghi "2 miễn phí"/"Đủ 4"/"Có 5★", toast Hoàn tác, nhật ký sửa/xóa, `<dialog>` thay prompt/confirm), `js/recruit-sync.js` + `community-worker` `GET/POST /api/recruit` (bảng `recruit_records`, rev theo user).
- Review độc lập bắt được 3 lỗi: bản ghi nhập JSON giữ `updatedAt` cũ < `pushedAt` nên không bao giờ lên cloud; focus rơi về `<body>` sau khi sửa dòng nhật ký (lúc `close` bắn focus vẫn nằm trong dialog vừa đóng); khách đăng nhập lỗi bị hiện "Ngoại tuyến".

## Decision
- Đồng hồ Lamport trong store (mọi thay đổi tại chỗ > `updatedAt` lớn nhất đã thấy) thay vì tin đồng hồ máy: sửa cả lỗi bỏ sót khi đẩy theo `pushedAt` lẫn LWW khi lệch giờ.
- Bản ghi mặc định (`acc_main`, gói ngày) mang `updatedAt` = epoch để máy mới không đè tên đã đổi khi gộp.
- Nhập JSON = gộp + `schedulePush({ full: true })`.
- Policy bản dịch chỉ re-pin hash 2 file recruit; publish generation `f85b83dd…`.

## Next steps
- Deploy: `npm run db:migrate:remote` rồi deploy `community-worker`, sau đó Pages.
- Đẩy lại bản ghi vừa kéo về là thừa nhưng vô hại (server LWW); tối ưu nếu lưu lượng đáng kể.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
