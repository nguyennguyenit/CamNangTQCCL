# Duyệt độc lập chữ UI máy tính nâng cấp công trình (#60)

Ngày 18/11/2026. Người duyệt: subagent độc lập (chỉ đọc `js/building-upgrade-calculator.js`, `js/lookup-master.js`,
`pipeline/site_localization.py`, `data/lookup-catalog.json`; không thấy lập luận của người viết). Phạm vi: 27 obligation
`ui:building-calc/*` (lớp `authored-vi`), cặp vi/zh.

## Kết quả

23 chấp nhận, 4 đề nghị sửa.

| Khóa | Đề nghị | Quyết định |
|---|---|---|
| `lead` | Bỏ "cùng lúc" (dễ hiểu thành nâng song song; bản zh không có ý này) | Nhận: "Cộng gỗ, đá, sắt và thời gian cần để nâng cấp nhiều công trình" |
| `totals-note` | vi thiếu chữ "thời gian" sau "tổng"; zh 加速 dễ hiểu thành vật phẩm tăng tốc, nguồn gọi hiệu quả này là 升級時間降低 | Nhận cả hai: "Thời gian là tổng thời gian nâng lần lượt từng cấp, chưa trừ hiệu quả giảm thời gian nâng cấp." / "耗时为逐级升级的总和，未扣除升级时间降低效果。" |
| `field-to` | "Cấp đích" → "Cấp mục tiêu" (sửa nhẹ) | Giữ "Cấp đích": đúng chữ của issue #60, người duyệt ghi là vẫn hiểu được |
| `range-invalid` | Đi theo `field-to` | Giữ theo `field-to` |

Các điểm đã kiểm: Gỗ/Đá/Sắt ↔ 木材/石料/铁矿 khớp `COST_KEYS`; "Thời gian"/"耗时" khớp cột bảng theo cấp; `Lv N`/`N 级`
khớp danh sách công trình; nhiều cấp ghép bằng "、" ở bản zh, ", " ở bản Việt; bản zh không có chữ Việt, chữ UI zh là giản thể.
