# Project Changelog

## 2026-09-27 (7 lỗi nặng)

### Fixed

- Trang dùng `js/season-context.js` không còn hỏng trên Safari 16: regex cờ `v` thay bằng `/(?![\n\r\t])\p{C}/u` (cùng hành vi); test mới `tests-js/browser-baseline.test.mjs` kiểm mọi module JS phát hành chạy được trên cú pháp ES2022.
- Tra cứu: tìm không dấu coi `đ`/`Đ` là `d`/`D` ("dieu thuyen" ra Điêu Thuyền); khoá tìm tính một lần mỗi mục thay vì mỗi lần gõ.
- Gợi ý đội: dòng "Thiếu tướng:" của "Đội mạnh nhưng chưa thể xây dựng" hiện tên tướng theo từng vị trí (lựa chọn trong vị trí nối bằng " / ") thay cho mã `hero:…`.
- Soi đội: chọn ảnh khác trong lúc đang soi không còn làm nút "Soi đội" kẹt; widget Turnstile luôn reset sau lượt soi, kết quả của ảnh cũ bị bỏ.
- Chiêu mộ: nhập JSON kiểm từng tài khoản, gói, lượt quay, lượt ngày (khoá lượt, số lượt hữu hạn ≥ 1, tham chiếu tài khoản/gói có thật) và chạy thử trước khi ghi đè; file hỏng báo "Dữ liệu không hợp lệ.", dữ liệu cũ giữ nguyên.
- Gợi ý đội: đọc lại cùng ảnh đội đã xây không nhân đôi đội khóa; hai đội khóa dùng chung tướng/chiến pháp thì giữ đội đầu, đội sau vào xung đột (trước đây bỏ cả hai và tướng của chúng bị gợi ý lại). Mỗi đội khóa có nút "Bỏ đội", thêm nút "Xóa toàn bộ kho" (có hỏi xác nhận).
- `pipeline.recommended_team_dedup` nhận `--pack pipeline/localization-inputs/recommended.json` thay cho `--cache` khi máy không có cache crawler; pack phải khớp `baseline.sourcePins` (ledger sinh ra trùng byte với ledger hiện có).
- Sửa tên hỏng trong `data/teams.json` (script một lần, dữ liệu dựng sẵn NFC): bỏ dấu chấm dưới rời ở `Lục Tốn`, `Giả Hủ`, `Lỗ Túc` (cả tên tướng `(S)` và 7 tên đội moi-phe-72, 86, 113–116, 133), `SP Hoàng Phổ Tung` → `SP Hoàng Phủ Tung`, `SP Đổng Trách` → `SP Đổng Trác`, tên đội `Trách Thuyền Bố` → `Trác Thuyền Bố`, chiến pháp `Thịnh Khí` → `Thịnh Khí Linh Địch`; các đội này nay sở hữu được trong Gợi ý đội. Giữ nguyên `Bái Sư …` và `Tinh·Phong Thi Trận` (chiến pháp bản tinh). Alias tương ứng thêm vào `pipeline/aliases.json`, khoá nickname `Hoàng Phủ Tung|…` đổi theo; sinh lại `data/facets.json` và `pipeline/recommended-other-teams.json` (bằng `--pack`; counts không đổi, 40 đội Đội khác). Handle URL giữ nguyên. Test mới `tests-js/teams-data-integrity.test.mjs` (NFC + mọi đội sở hữu được, trừ danh sách chờ nguồn có lý do). Publish generation `07792857…` (bỏ generation trung gian `5c666843…`), re-pin `legacyTeamsSha256`.
- Bản dịch: thêm 4 obligation `authored-vi` (`ui:roster/locked-remove`, `locked-remove-aria`, `clear-all`, `clear-all-confirm`), policy `site-vi-260927-loi-nang`, publish lại cùng đợt sửa tên (generation cuối `07792857…`) và re-pin `pipeline/team-route-handles.json`; `WORKFLOW_BUILD_ID` MCP sinh lại (engine gợi ý đội dùng chung).

## 2026-09-27 (đường dẫn công cụ)

### Changed

- Ba trang Công cụ dùng đường dẫn ghi rõ tên: `/chieu-mo/` → `/theo-doi-chieu-mo/`, `/soi-doi/` → `/soi-doi-tu-anh/`, `/goi-y-doi/` → `/goi-y-doi-tu-kho/` (menu, Landing, sitemap, canonical, `_headers`, allowlist `safeReturnUrl`, hash cũ `#recruit-tracker`/`#analyze`/`#roster-recommend`). Đường dẫn cũ không redirect, trả trang 404 tĩnh như URL ngoài inventory. Bản dịch: đổi id obligation `ui:section-page/<đường dẫn>` + entrypoint, ghim lại hash nguồn và digest inventory trong policy; cần publish generation mới + re-pin `pipeline/team-route-handles.json`.

## 2026-09-26 (thẻ đội + lưới 4 cột)

### Changed

- Thẻ đội của `/doi-chuan/` và `/doi-khac/` dựng lại chung một bố cục: gáy thẻ tô màu phe, điểm nguồn nằm trong ô ấn son viền kép (nhãn "ĐIỂM"), đội chưa có điểm dùng cùng ô ấn viền đứt nét "—" (trình đọc màn hình đọc "Chưa có điểm nguồn") nên đầu thẻ hai trang cùng hình dạng; vai trò Chủ tướng chữ son; chân thẻ nền giấy nhạt với CTA "Chi tiết" dạng nút chữ son 44px thay cho nút mực đặc lặp lại.
- Dòng tướng co giãn theo bề rộng thẻ bằng container query: thẻ ≥ 480px giữ ba cột `vai trò | tên | chiến pháp + binh thư`, thẻ hẹp hơn (lưới gọn, tablet, mobile) xếp tên → chiến pháp → binh thư.
- Chuyển kiểu hiển thị thành ba nút `2 cột` / `4 cột` / `Bảng`: `4 cột` (`?view=luoi`) là lưới thẻ gọn, số cột theo bề rộng vùng kết quả (4 ở 1440px, 3 ở 1280px, 2 ở 1024px, 1 ở mobile); lựa chọn nhớ chung cho hai trang qua `tqccl.teamView.v1`, URL chỉ mang `view=luoi|bang`. Dưới 1280px nút chỉ còn icon.
- Bản dịch: 5 obligation `authored-vi` của nút chuyển kiểu hiển thị (`2 cột`, `4 cột`, `Bảng` + aria), policy `site-vi-260926-the-doi-luoi`, publish generation `1a4fd71a…` và re-pin `pipeline/team-route-handles.json`; probe `tokens.json` (`the-doi`, `dong-tuong`, `chuyen-the-bang`, `nut-chinh`) cập nhật theo thẻ mới.
- Dòng tướng: nhãn biến thể `40Y`/`SP`/`CO` đổi thành con dấu viền mảnh cùng màu chữ (nền trong suốt; CO dùng token mới `--khien-ink` để đạt ≥ 5,4:1) và luôn cùng hàng với tên tướng; ở thẻ rộng ô tên phủ mọi hàng nên tên nhiều dòng không còn đẩy dòng binh thư xuống. Chiến pháp thành chip son nhạt (mobile: vùng bấm 44px, chip nhìn thấy 30px), tên binh thư chuyển sang mực đậm `type.tag` để nổi hơn nhãn "Binh thư ·".
- Sidebar lọc `/doi-chuan/`, `/doi-khac/` gọn lại: hàng 36px thay cho 44px, nhóm ngăn bằng vạch mảnh, số đếm thành viên nhỏ canh phải, mục đang bật dùng dải nền nhạt + ô tích đặc thay cho cả hàng đen, `Xóa lọc` ẩn khi không có gì để xóa. Panel cao 572px → 438px ở `/doi-chuan/`. Mobile giữ chip 44px.
- Bỏ bộ chọn `Danh mục` ở `/doi-chuan/`, `/doi-khac/`: danh sách luôn gộp mọi danh mục nguồn; `?category=` cũ bị bỏ khỏi URL lúc tải trang và không lọc gì, link quay lại từ trang chi tiết chỉ còn `season`. Ô `Mùa nguồn` thành một khung gọn (nhãn nhỏ trên giá trị, mũi tên phải, cả khung là vùng bấm). Bản dịch: bỏ obligation `ui:recommended/category-label`, policy `site-vi-260926-bo-danh-muc`, publish generation `0ddbd034…` và re-pin `pipeline/team-route-handles.json`.
- Lưới `4 cột`: dòng binh thư xuống dòng hiện đủ tên thay cho cắt một dòng "…" (tên binh thư thứ ba trở đi trước đây không đọc được).
- Bỏ bộ chọn `Mùa` / `Phiên bản luật` và dòng "Tất cả — tham khảo" khỏi hai công cụ `/soi-doi/`, `/goi-y-doi/`: công cụ luôn đối chiếu/gợi ý trên dữ liệu đội cũ, bỏ ô "Xem đội ngoài phạm vi để tham khảo", thông báo phạm vi và ô "Thử nghiệm cấu hình chưa xếp hạng"; `?scenario=`, `?ruleset=`, `?config=` cũ bị bỏ khỏi URL lúc tải, link "Mở scan / nhập kho" trong chi tiết cấu hình trỏ `/goi-y-doi/`. Hai trang không còn nhận `#season-controls`/`#season-artifact-hashes`. Bản dịch: bỏ obligation `ui:analyze/outside-heading`, `ui:analyze/outside-note`, policy `site-vi-260926-bo-mua-cong-cu`, publish generation `f93a51ea…` và re-pin `pipeline/team-route-handles.json`.

## 2026-09-26 (Sổ binh pháp)

### Changed

- Redesign toàn site theo giao diện "Sổ binh pháp": Landing ở `/` và 8 trang mục tĩnh (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/`, `/tra-cuu/`, `/chieu-mo/`, `/soi-doi/`, `/goi-y-doi/`) thay cho SPA một trang dùng hash; mọi hash/URL cũ được Landing chuyển tiếp qua `js/legacy-routes.js`, `?detail=`/`?legacyTeam=` vẫn mở đúng trang chi tiết.
- Shell dùng chung một lần (`SiteLayout`): header, menu thả, menu mobile toàn màn hình, footer; theme sáng/tối theo lựa chọn đã lưu hoặc hệ điều hành, chặn nháy bằng script inline trong `<head>`.
- Token hoá toàn bộ giao diện: `docs/design/so-binh-phap/tokens.json` là nguồn duy nhất cho màu/giá trị vi mô và danh mục component; khối CSS cũ ("legacy") đã xoá hết, `node scripts/design-tokens.mjs --check` báo 0 giá trị thô.
- Font self-host (Be Vietnam Pro + Noto Serif Display, subset latin/latin-ext/vietnamese) ở `public/fonts/`, phục vụ cùng `/css/styles.css` và `public/_headers`.
- Giao diện tối được rà trên DOM thật: sửa các cặp chữ/nền không đạt 4,5:1 của nút CTA header, nút CTA Landing, nhãn biến thể SP/CO và pill phe bằng token mới `--on-fill`/`--f-nguy-strong`; thêm token vai trò chữ cho nhãn biến thể, badge loại binh nhỏ và dòng phân loại phạm vi.
- Shell: nav ngang chỉ hiện từ 1280px (dưới mốc đó header dùng ☰), panel menu thả neo trong khung nhìn, footer dùng chung nằm ở đáy trang ngắn, trang 404 có lề trang như các trang khác.
- A11y/responsive: control ≥ 44px trên mobile, không cuộn ngang ở 320/390/768/1440, focus-visible rõ, menu thả/hộp thoại có `aria-expanded`/Escape/focus trả về, ô chọn ảnh native của Gợi ý đội có tên truy cập được (`aria-labelledby`), Turnstile 300px nằm trong khung cuộn ở bề rộng hẹp.
- Tài liệu mô tả đúng mô hình mới: `design-guidelines`, `code-standards`, `system-architecture`, `deployment-guide`, `unified-lookup`, `README`.
- Vòng sửa nit của redesign: trạng thái "đang chọn" và nút chính ở theme tối dùng họ token mới `--select*`/`--f-*-select` (nền chọn `#EDE6D8` + chữ `#16140F`) thay vì mượn màu dải header — nền chọn đạt 14,82:1 với nền trang và 13,53:1 với chip chưa chọn (WCAG 1.4.11 ≥ 3:1); theme sáng giữ nguyên giá trị cũ nên không đổi pixel.
- Đổi Mùa ở Soi đội / Gợi ý đội nay gọi `turnstile.reset` khi bỏ token nên widget cấp token mới thay vì khoá nút tới lúc hết hạn; `?view=the` (mặc định) bị bỏ khỏi URL bằng `replaceState`; Escape đóng panel lọc mobile và trả focus về nút; hộp thoại hồ sơ chừa lề hai bên ở 821–1279px.
- Sửa `activationRate` sai đơn vị của `tactic:thien-uy-khieu-tran` (50 → 0,5) ngay tại bước nhận giá trị trong pipeline, kèm bảng hiệu chỉnh có lý do, ledger disposition `corrected-public` và kiểm khoảng 0–1 cho mọi tỷ lệ kích hoạt; mã trích dẫn `(Bahamut bsn=…)` chỉ bị ẩn ở lớp hiển thị, dữ liệu và ledger giữ nguyên.
- Sửa lỗi bố cục mobile: `--space-38` chưa từng được khai làm hàng tướng trên thẻ mất cột nhãn (nay là token `size.col-hero-role` 38px); bảng xem trước của Landing ở bề rộng hẹp xếp dọc nên cột điểm không còn phải cuộn ngang; dấu `·` của dòng phụ thẻ Tra cứu không còn mồ côi ở đầu dòng khi xuống hàng; nguồn gốc mã QR (lệnh sinh + phiên bản `qrcode@1.5.4`) nay nằm trong comment của chính `<svg>` nên có trong `dist/index.html`.
- Sửa theo audit ảnh ghép với artboard "Sổ binh pháp": header trang trong đặt nav sát thương hiệu, panel/footer "Tra cứu" bỏ dòng lặp (tiêu đề là link), footer mobile có pill cộng đồng + phụ đề nhà phát hành, Landing đổi bố cục "Hai kho đội" + thanh bảng dải tối + thẻ xem trước gọn theo artboard; chip lọc Đội chuẩn/Khai hoang xếp theo số đội giảm dần, nút "Chi tiết" luôn ở mép phải, bảng Đội chuẩn đúng bề rộng cột và cột Điểm căn phải; Tra cứu tách dòng vai trò, sửa khoảng cách ô tìm, ô chân dung mobile 96px, thang chỉ số /120, hồ sơ không che nav; Khai hoang mỗi tướng một hàng `tên | Trước → Sau` (mobile 3 dòng) và trang chi tiết chọn cấu hình bằng chip; Cùng Tồn tách pill cấp đội/tag tướng, mobile chọn nhóm bằng hàng số và gập ô tổng quan; Chiêu mộ/Soi đội/Gợi ý đội bỏ chữ lặp và thẻ rỗng, ô lượt 1 cột trên mobile; `color-scheme` theo theme. Lệch giữ có lý do ghi ở mục "Audit 260926" của từng báo cáo `visual-phase-0N.md`.

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
