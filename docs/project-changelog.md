# Project Changelog

## 2026-06-26

### Added

- Tab `Đô Úy (ss18)`: tách team `do-uy` (37 team) khỏi Team PK, filter bar inline (loại binh / phe / tier / khuyến nghị), badge khuyến nghị, gán quốc gia, sắp xếp tier T0→T1.
- Section `Tra cứu tướng`: 112 tướng, chip lọc (thích tính binh chủng / vai trò / phe / sao) + search fuzzy (Việt bỏ dấu / Hán-Việt / Hán), modal chi tiết tướng (`js/hero-list.js`, `js/hero-detail.js`).
- Engine tier theo team: `pipeline/team-tier-map.json` → `data/team-tier.json` (`build_team_tier`), badge hiện bậc tốt nhất + tooltip multi-source; `suggest_team_tier` parse offline gợi ý curate đầu mùa.
- Từ điển binh thư Hán→Việt (`data/books-dict.json` qua `build_books_dict`).

### Changed

- Team PK chỉ render team-intro + moi-phe (160 team); team `do-uy` ẩn khỏi Team PK.
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
