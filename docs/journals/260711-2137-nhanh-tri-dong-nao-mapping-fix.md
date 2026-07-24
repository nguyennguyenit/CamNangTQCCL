---
date: 2026-07-11
session: nhanh-tri-dong-nao-mapping-fix
---

# Journal: 2026-07-11 — Sửa mapping Nhanh Trí Động Não

## Context

Ảnh client Việt xác nhận **Nhanh Trí Động Não** là chiến pháp `灵机一动`: chủ động cấp S, dùng cho Kỵ/Khí giới, tăng Trí Lực–Thống Soái–Mị Lực cho 2–3 đồng minh, có thể cộng dồn và đạt tỷ lệ phát động 55%. Dữ liệu trước đó lại gắn tên này cho `才辩机捷`, khiến tra cứu và OCR trả sai chiến pháp.

## What Happened

- Viết regression test trước; test đỏ chứng minh mapping `才辩机捷` và alias OCR `灵机 → 临机` đều sai.
- Xóa override sai của `才辩机捷`; thêm record đầy đủ `灵机一动 → Nhanh Trí Động Não`, gồm Hán-Việt, mô tả Việt, mục tiêu và binh chủng.
- Sửa pipeline để giữ `hanViet`, `effectViet`, `targetViet` đã duyệt khi merge dữ liệu generic.
- Bỏ alias OCR gây nhập nhằng để `灵机` khớp trực tiếp `灵机一动`; cập nhật artifact runtime và test map ảnh.
- Test xanh sau sửa: 82 Python và 83 JavaScript đều đạt.

## Reflection

Tên gần nghĩa không đủ để xác lập mapping đa ngôn ngữ. Ảnh client với loại hình, binh chủng, mục tiêu và dải chỉ số là bằng chứng mạnh hơn suy đoán từ tên. Regression test ở cả pipeline, artifact và OCR giúp khóa cùng một sự thật qua toàn luồng dữ liệu.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Mapping Nhanh Trí Động Não sang `灵机一动` | Khớp toàn bộ mô tả trong ảnh client | Tra cứu và phân tích ảnh trả đúng chiến pháp |
| Trả `才辩机捷` về Tài Biện Cơ Tiệp | Override cũ không có bằng chứng và chiếm sai tên Việt | Loại mapping trùng/sai |
| Xóa alias `灵机 → 临机` | Alias biến một tiền tố hợp lệ thành chiến pháp khác | OCR `灵机` ưu tiên đúng `灵机一动` |
| Giữ trường Việt/Hán-Việt đã duyệt khi build | Tránh pipeline làm mất dữ liệu thủ công có nguồn | Rebuild tái lập chính xác record Nhanh Trí Động Não |

## Next Steps

- Dùng cùng tiêu chuẩn bằng chứng khi duyệt các mapping tên Việt còn độ tin cậy thấp.
- Giữ regression test cho các tiền tố OCR gần nhau, nhất là `灵机` và `临机`.

## Unresolved Questions

- Đường rebuild toàn bộ vẫn có drift cũ: cache + generic tạo 238 record, còn artifact runtime có 239 vì `蓄势待发` chưa nằm trong nguồn bền vững. README đã cảnh báo không rebuild máy móc; xử lý trong task data riêng.
