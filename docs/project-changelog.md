# Project Changelog

## 2026-08-25

### Changed

- Retire 48 team Đô Úy khỏi artifact công khai, tab/hash/module website và toàn bộ kết quả Research MCP; website còn 9 section và dữ liệu public còn 166 team (56 Team PK, 110 Meta phe cũ) cùng 31 tier row.
- Giữ `pipeline/do-uy-ss18-source.json` làm archive nguồn thô, loại `Team Đô Úy.html` khỏi pipeline build và thêm lớp lọc MCP để snapshot cũ không tái công khai source `do-uy`.

## 2026-08-01

### Changed

- Research MCP đóng code, canonical manifest và sáu data artifact trong cùng một private Worker Static Assets version; CLI/stdio vẫn đọc filesystem và tám tool không đổi.
- Release production chuyển sang manual exact-SHA Worker Versions: candidate `0%` được xác minh bằng Version Override trước khi promote duy nhất `100%`, với reconciliation response mơ hồ và ownership-safe rollback.
- Bỏ runtime/release/control-plane R2, AWS SDK và npm release path; giữ edge rate control, managed bearer và denylist credential cũ.

## 2026-07-11

### Fixed

- Sửa mapping chính thức `Nhanh Trí Động Não`: `灵机一动`, Chủ động 30%→55%, chỉ Kỵ/Khí giới, tăng Trí–Thống–Mị theo ảnh client Việt; trả `才辩机捷` về tên fallback `Tài Biện Cơ Tiệp`.
- Bỏ alias OCR `灵机 → 临机` để ảnh không còn bị map nhầm sang `Thời Cơ Chiến Thắng`; bổ sung test hồi quy pipeline, artifact và OCR.

## 2026-07-03

### Added

- Team PK thêm 3 đội SP Quan Vũ theo meta PK-S26: Pháp Quan Lưu Bị, Pháp Quan Mã Đại, Quan Quân Thương; gắn tier T0 cho 3 đội mới và Quan Tinh Khiên hiện có.
- Team PK thêm 2 đội SP Lô Trực mùa `Anh Hùng Mệnh Thế`: Thái Sư Cung (T0) và Cự Mã Cung (T0.5).
- Team PK bổ sung nickname/tên gọi meta cho 33 đội, ví dụ Hoàng Mã Thương, Vinh Quang Thương, Hoàng Quan Thương, Kỳ Lân Cung, Thái Úy Khiên.
- Team PK bổ sung và verify tier PK-S26 `Anh Hùng Mệnh Thế` từ Zeabur; sau rà lại có 30/55 đội có badge tier và 19 đội T0 chắc hơn, bỏ T0 của Vinh Quang Thương và hạ Đô Đốc Cung bản Lỗ Túc về T0.5.

## 2026-06-26

### Added

- Tab `Đô Úy (ss18)`: tách team `do-uy` (37 team) khỏi Team PK, filter bar inline (loại binh / phe / tier / khuyến nghị), badge khuyến nghị, gán quốc gia, sắp xếp tier T0→T1.
- Section `Tra cứu tướng`: 112 tướng, chip lọc (thích tính binh chủng / vai trò / phe / sao) + search fuzzy (Việt bỏ dấu / Hán-Việt / Hán), modal chi tiết tướng (`js/hero-list.js`, `js/hero-detail.js`).
- Engine tier theo team: `pipeline/team-tier-map.json` → `data/team-tier.json` (`build_team_tier`), badge hiện bậc tốt nhất + tooltip multi-source; `suggest_team_tier` parse offline gợi ý curate đầu mùa.
- Từ điển binh thư Hán→Việt (`data/books-dict.json` qua `build_books_dict`).

### Changed

- Team PK render team-intro; Meta phe cũ render moi-phe; team `do-uy` ẩn khỏi Team PK.
- Mobile: hamburger menu section (`js/mobile-section-menu.js`) + drawer bộ lọc Team PK (`js/mobile-filter-drawer.js`).

## 2026-06-23

### Changed

- Giữ mô tả/mục tiêu tiếng Trung trong `effect`/`target`, bổ sung `effectViet`/`targetViet` cho 6 chiến pháp đã dịch.
- Thẻ tra cứu chiến pháp hiển thị tiếng Việt trước và nguyên văn tiếng Trung sau; record chưa dịch vẫn hiển thị tiếng Trung.
- Pipeline áp bản dịch thủ công từ `tactic-name-overrides.json`, tránh mất dữ liệu song ngữ khi rebuild.

### Fixed

- Đưa menu trang mobile vào nút hamburger góc trái header, bỏ logo kiếm, và tách `Bộ lọc` Team PK thành action riêng; drawer lọc có nút đóng, nút `Tìm / Xem kết quả`, overlay/Escape để thoát, và focus/accessibility state rõ hơn.
- Đồng bộ tên và mô tả tiếng Việt theo ảnh game cho `Đánh Đâu Thắng Đó`, `Khắc Địch Chế Thắng`, `Hợp Quân Tụ Chúng`, `Thịnh Khí Linh Địch`, `Phá Trận Thôi Kiên`, `Đánh Bại Quân Địch`.
- Tách đúng `Khắc Địch Chế Thắng` (`克敌制胜`) và `Đánh Bại Quân Địch` (`折冲御侮`) thành hai chiến pháp riêng.
- Thêm test hồi quy cho nội dung 6 chiến pháp và tham chiếu `Đánh Bại Quân Địch` trong artifact JSON.
