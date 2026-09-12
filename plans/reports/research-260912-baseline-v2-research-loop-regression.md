# Research session — cập nhật SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác

Ngày lập: 2026-09-12, Asia/Ho_Chi_Minh. Chế độ: historical replay — **không có bằng chứng web trực tiếp trong gói này**. Báo cáo tổng hợp lại từ hồ sơ research đã có trong repo để lượt sau tra cứu tiếp; không sửa dữ liệu runtime.

## 1. Kết luận cập nhật

Trạng thái trước đây (bản 2026-09-07 14:21) ghi rằng bộ ba SP Chu Tuấn / Hạ Hầu Uyên / Gia Cát Khác **chưa đủ bằng chứng cho giai đoạn sau thức tỉnh**. Kết luận đó **đã được đính chính ngay trong chính hồ sơ, mục cập nhật 2026-09-07 16:28**: video đầy đủ do người dùng cung cấp xác nhận bảng đủ sáu chiến pháp ở cấp 22, nằm ngay khung 00:10 đầu video. Lần đọc trước bỏ sót đoạn này, không phải do video thiếu dữ liệu.

Kết luận hiện hành:

- Đã xác minh **hai giai đoạn** của đội: trước cấp 20 (một chiến pháp học thêm mỗi tướng) và cấp 22 (đủ hai chiến pháp học thêm mỗi tướng).
- **Chủ tướng đổi theo giai đoạn**: SP Chu Tuấn ở các khung trước cấp 20; Gia Cát Khác trong bảng cấp 22. Không kế thừa vị trí chủ tướng xuyên giai đoạn.
- Binh chủng: **Cung** ở cả hai giai đoạn.
- Trạng thái bằng chứng: **Phương án từ nguồn** theo bảng phân loại trong `docs/research-sources.md`. Đây là một nguồn thực chiến đăng lại, chưa có xác nhận độc lập thứ hai, chưa đủ để gọi là cấu hình tối ưu hay xếp hạng meta.

## 2. Cấu hình đã xác minh

Nguồn: [bài/video chiến báo 233乐园](https://www.233leyuan.com/post-detail/1991779663393004217), đăng 2025-11-21, ghi 转载; watermark “大V爱游戏 / bilibili”. [Tệp video công khai](https://bs-community.233leyuan.com/community/post/d44d8798004a4cce81a306484b7bc1a5_12525020.mp4) — 58.513991 giây, 1280×720, 12.768.254 byte.

### 2.1 Trước cấp 20 (khung 00:20 và 00:40, cấp 6–13)

| Tướng | Vai trò | Chiến pháp học thêm |
|---|---|---|
| SP Chu Tuấn | Chủ tướng | Vô Đương Phi Quân — 无当飞军 |
| Hạ Hầu Uyên | Phó tướng | Lõa Y Huyết Chiến — 裸衣血战 |
| Gia Cát Khác | Phó tướng | Thịnh Khí Linh Địch — 盛气凌敌 |

Chiến báo hiển thị SP Chu Tuấn / Hạ Hầu Uyên 5 hột, Gia Cát Khác 4 hột. Đây là **điều kiện quan sát**, không phải mức đầu tư tối thiểu.

### 2.2 Cấp 22 / sau thức tỉnh (khung 00:10)

| Tướng | Vai trò | Chiến pháp 1 | Chiến pháp 2 |
|---|---|---|---|
| Gia Cát Khác | Chủ tướng | Thịnh Khí Linh Địch — 盛气凌敌 | Tiềm Long Trận — 潜龙阵 |
| Hạ Hầu Uyên | Phó tướng | Lõa Y Huyết Chiến — 裸衣血战 | Thôi Phong Đoạn Nhẫn — 摧锋断刃 |
| SP Chu Tuấn | Phó tướng | Vô Đương Phi Quân — 无当飞军 | Sợ Bóng Sợ Gió — 杯蛇鬼车 |

Tên Việt đối chiếu trường `viet` trong `data/tactics.json`.

## 3. Đối chiếu logic (theo `multi-source-research-and-logic-checks.md`)

- Không phát hiện lỗi loại “chiến pháp xung khắc vai trò”: đội Cung đánh thường + tăng sát thương, Vô Đương Phi Quân và Lõa Y hợp hướng đánh thường/cường hóa, Thịnh Khí + Tiềm Long là lớp buff/trận pháp trên chủ tướng.
- Quy tắc “chiến pháp ăn theo chủ tướng phải đặt đúng chủ tướng” giải thích hợp lý việc **đổi chủ tướng sang Gia Cát Khác ở cấp 22** khi Gia Cát Khác giữ Thịnh Khí + Tiềm Long. Đây là suy luận cơ chế, không phải lời khẳng định của nguồn.
- Không có nguồn nào trong gói chứng minh điểm số 7.8 trong ảnh người dùng được chấm bằng đúng bộ chiêu này.

## 4. Khác biệt so với dữ liệu runtime

Kiểm tra `runtime/current-json-projection.json` (`data/khaihoang.json` sha `7b9b77b8…`):

- **Chưa có đội nào trùng bộ ba SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác.**
- Đội gần nhất trong runtime là **Khương Duy · Hạ Hầu Uyên · Gia Cát Khác** (Cung), với Khương Duy giữ Vô Đương Phi Quân trước 20, Gia Cát Khác lên chủ tướng sau lv.20 với Tiềm Long + Thịnh Khí. Mẫu hình trùng khớp đáng chú ý: **vị trí “người mang Vô Đương” là slot thay thế được**, SP Chu Tuấn đứng đúng chỗ Khương Duy. Đây là quan sát cấu trúc, chưa phải kết luận tương đương sức mạnh.
- Hạ Hầu Uyên trong runtime: nhánh Cung thường dùng Lõa Y + Mau Giành Lợi Thế / Nhất Kỵ Đương Thiên. Bằng chứng video cho **Thôi Phong Đoạn Nhẫn**, là khác biệt cần ghi riêng, không gộp.

Không sửa `data/khaihoang.json` trong lượt này. Nếu nhập, kiểm tra lại tên tướng, thứ tự chủ/phó theo từng giai đoạn, binh chủng Cung và tên chiến pháp theo bảng mục 2.

## 5. Giới hạn của lượt này

- Gói replay **không có công cụ web**; không thực hiện được xác minh độc lập thứ hai, không kiểm tra được mốc SGSDeck làm chuẩn “Sách Giáo Khoa”. Ghi rõ: **chưa có mốc SGSDeck đã xác minh** cho bộ ba này.
- Ngày đăng lại 2025-11-21 khác ngày chiến báo 2026-04-18 đọc ở khung cuối video. Không dùng ngày trang để suy ra bản game.
- Nguồn là bài đăng lại (转载), chưa truy nguyên được bản gốc bilibili.

## 6. Việc còn lại cho lượt sau

1. Tìm xác nhận độc lập thứ hai cho bộ cấp 22, ưu tiên nguồn Nhật (Kazten, Shinsen Navi, Chousen) và mẫu SGSDeck.
2. Quyết định nhập runtime: thêm đội mới hay thêm `variants` vào đội Khương Duy · Hạ Hầu Uyên · Gia Cát Khác.
3. Chốt quy ước điểm số thuộc về roster hay thuộc từng bộ chiêu — vẫn treo từ báo cáo 2026-09-07.
4. Song song còn treo: kiểm chứng hai phương án trước cấp 20 của đội Trương Xuân Hoa / Lữ Bố / Tả Từ, đặc biệt nhánh Tam Thế Trận.

## 7. Nguồn nội bộ đã đọc

- `plans/reports/research-260907-1421-khai-hoang-missing-tactics.md` — bằng chứng gốc và bản đính chính 16:28.
- `docs/research-sources.md` — phân loại nguồn và thang trạng thái bằng chứng.
- `runtime/current-json-projection.json` — ảnh chụp JSON hiện tại để đối chiếu.
- `.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md` — bộ kiểm tra logic chiến pháp.
