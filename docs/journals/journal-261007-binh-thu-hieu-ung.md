# 2026-10-07 — Binh thư: hiệu ứng và link theo tên nguồn

## What happened
68 binh thư có hiệu ứng: chữ phồn thể nguồn (Bahamut 5254 bản 2021-11, Bahamut 9596/7724 bản 2024-07), bản dịch đã được người dùng duyệt và mốc số liệu. Hồ sơ Tra cứu hiện các trường này ở bản Việt lẫn bản zh. Bốn tên Hán sai trong `books-dict` được sửa. Trang Đội chuẩn tra binh thư theo tên Hán nguồn (`sourceNames`). Research ở `plans/reports/research-260928-binh-thu-hieu-ung-va-ten-chua-link.md`.

## Decisions
- Ô có tên Hán nguồn chỉ khớp theo tên Hán; tên Việt chỉ dùng khi ô không có tên nguồn. Nhờ vậy bản dịch lệch (`順天應時` → "Thuận Thiên Ứng Thời") vẫn link đúng, còn bản dịch nhầm sang binh thư khác (`以退為進` → "Dĩ Trực Báo Oán") không dựng link sai.
- `sourceNames` gồm tên nguồn trong research cộng mọi tên ô đang link đúng trong generation hiện tại. Đếm lại sau khi đổi: không ô nào mất link ngoài 6 ô `以退為進` (cố ý).
- Lấy Võ Dẹp Loạn = `以治擊亂`: người dùng gửi hiệu ứng trên client VN và nó khớp nguồn.

## Surprises
- `pipeline/recommended-identity-map.json` là nguồn glossary của gate bản dịch. Sửa một tên hiển thị trong đó làm stale toàn bộ ~5.500 receipt review, nên hướng sửa trong identity map bị bỏ, chuyển sang sửa ở resolver. Chữ trên ô Đội chuẩn vì thế vẫn giữ bản dịch cũ.
- Hồ sơ binh thư bản zh trước đây hiện `旧名` cho cả tên hiện hành; nguyên nhân là alias phồn thể khác chữ giản thể trong `chinese`.

## Left open
- 3 ô `拓濟世救貧` chưa có link, và chữ Việt sai trên ô Đội chuẩn: cả hai chờ lần duyệt lại bản dịch.
- Chưa có tên game VN của `無功而厲`, `以退為進`, `千里疾行`, `仙姿`, `謀定後動`.
- Các file liên quan SGSDeck/Tra cứu (`pipeline/lookup-identity.json`, `data/sgsdeck/*`, …) bị một luồng khác sửa trong lúc làm. Gate public đỏ vì `lookup-identity.json` và không phải do phiên này; e2e chưa chạy được.
