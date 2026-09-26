# Hướng dẫn thiết kế giao diện

## Tổng quan

Giao diện là dashboard dữ liệu tĩnh: nhanh, rõ, gọn. Thẻ, badge và chip giúp quét thông tin; interaction phải hoạt động trên mobile và không che dữ liệu sau nhiều lớp UI. Toàn site dùng chung một shell và một stylesheet; mọi giá trị vi mô lấy từ token, không viết tay.

## Nguồn chuẩn thiết kế

**`docs/design/so-binh-phap/tokens.json` là nguồn duy nhất** cho giá trị vi mô (màu, chữ, khoảng cách, bán kính, control, bóng, focus, z-index, chuyển động) **và cho danh mục component** (`components`). Không chép bảng giá trị vào tài liệu này; đọc thẳng JSON.

Ba tầng golden master (plan quyết định #15):

| Tầng | Golden master | Cách soát |
|---|---|---|
| Vi mô | `tokens.json` | `node scripts/design-tokens.mjs --check` (khối `:root` phải khớp token; 0 mã màu/giá trị thô ngoài khối token) và `node scripts/design-compare.mjs --tokens --phase NN [--theme light\|dark]` (đo `getComputedStyle` trên trang thật) |
| Cấu trúc | DOM thật | test trình duyệt trong `tests-e2e/` (thứ tự khối, anchor, aria, hành vi bàn phím) |
| Bố cục | ảnh `docs/design/so-binh-phap/screens/*.png` | `node scripts/design-compare.mjs --phase NN [--theme dark]` ghép ảnh cạnh tranh thật; **người duyệt ghi "đã sửa / giữ, lý do"**, không pass/fail pixel |

Artboard không phải golden master pixel: dữ liệu trong artboard là mẫu, chiều cao là ước tính và có chỗ contract cố ý thắng artboard (brainstorm §11.4). Bản chụp commit hiện dùng: `1790191281-3a81`; canvas đổi thì chụp lại có chủ đích rồi cập nhật `tokens.json` bằng `--extract`.

**Thêm token**: chỉ thêm khi giá trị chưa có token nào phù hợp; ghi `source` (artboard nào, hoặc "giữ đúng pixel từ CSS cũ" khi Phase 10 token hoá khối legacy) rồi phát lại `:root` theo đúng thứ tự trong JSON (lệnh `--check` bắt lệch). Token không còn selector nào dùng thì xoá.

**Thêm component**: khai trong `components` của `tokens.json` (selector, cấu tạo, biến thể, trạng thái, thuộc tính → token, artboard nguồn, phase sở hữu/dùng) **trước hoặc cùng commit** với CSS; mỗi component nên có `probe` để `design-compare --tokens` đo được. Không viết CSS riêng cho một trang khi đã có component dùng chung.

## Mô hình đường dẫn

- **Landing** ở `/` (`pageKind="landing"`, có `#tai-game`, `#nguon-du-lieu`, `#dau-trang`).
- **8 trang mục tĩnh**, mỗi trang một mount `#section-<id>` và `data-page-section` trên `<body>`: `/doi-chuan/` (`team-chuan`), `/doi-khac/` (`team-khac`), `/cung-ton/` (`coexist`), `/khai-hoang/` (`khaihoang`), `/tra-cuu/` (`lookup`), `/theo-doi-chieu-mo/` (`recruit-tracker`), `/soi-doi-tu-anh/` (`analyze`), `/goi-y-doi-tu-kho/` (`roster-recommend`). Trạng thái nằm trên query của đúng trang, không còn hash SPA.
- **Ba họ trang chi tiết** sinh sẵn: `/doi-chuan/<mùa>-<handle>/`, `/doi-khac/<handle>/`, `/khai-hoang/<handle>/`; URL đóng băng trong `pipeline/team-route-handles.json`. Trang 404 tĩnh ở `/404.html`.
- **Hash cũ** (`#team-pk`, `#meta-cu`, `#lookup?group=&id=`, `#heroes`, `#tactics`, `?detail=`, `?legacyTeam=`…) do Landing chuyển tiếp trước khi vẽ trang bằng bảng duy nhất `js/legacy-routes.js`; `safeReturnUrl` dùng cùng bảng để chuẩn hoá `from`/snapshot cũ.
- Link điều hướng luôn là anchor thật (`<a href>`), không `preventDefault`, không router tự viết.

## Shell dùng chung

Header, menu thả desktop, menu mobile toàn màn hình và footer do `src/layouts/SiteLayout.astro` + `js/site-nav.js` sở hữu, dùng cho Landing, 8 trang mục và cả ba họ chi tiết; chỉ trang 404 khai báo riêng (không boot `app.js`). Menu mở/đóng bằng `aria-expanded`, Escape trả focus về nút, bấm ngoài đóng, menu mobile là `role="dialog"` `aria-modal`. Nav ngang dàn một hàng chỉ hiện từ **1280px** trở lên; dưới mốc đó (kể cả tablet) header dùng nút ☰ mở lớp phủ, và `js/site-nav.js` chọn chế độ theo cùng mốc (`min-width: 1280px`). Khung trang là cột dọc `body` cao tối thiểu `100dvh` nên footer nằm ở đáy cả khi trang ngắn (404).

**Theme** theo thứ tự: `localStorage.theme` → `prefers-color-scheme`. Một script inline chặn trong `<head>` đặt `data-theme` **trước** stylesheet (không nháy sáng khi chuyển trang); `js/site-chrome.js` giữ nút đổi giao diện, áp lại theme ở `pageshow` và đồng bộ khi tab khác đổi (`storage`). **Theme theo hệ điều hành chỉ được quyết định ở mỗi lần tải trang**: trang đang mở không tự đổi khi OS đổi (không có listener `matchMedia`), muốn theo lại thì tải lại trang/cửa sổ mới — nút đổi trong UI là đường đổi tức thời. Storage lỗi (bị chặn) thì rơi về `prefers-color-scheme`, không chặn render.

## Component dùng chung

Danh mục đầy đủ ở `tokens.json` → `components`. Nhóm chính: thẻ (`.team-card`/`.kh-card`/`.lookup-card`/`.rt-section`/`.ana-card`…), thẻ đội và dòng tướng, badge (phe, loại binh, điểm nguồn, trạng thái), chip lọc, ô tìm, select + nhãn caps, nút chính/phụ/nút chữ, bảng, hộp thoại, thanh điểm, thẻ công cụ Beta và bước công cụ.

- **Thẻ / Thẻ gọn / Bảng** của danh sách đội là ba chế độ của cùng một component, chuyển bằng nút `aria-pressed` (`?view=luoi` cho Thẻ gọn — lưới tối đa 4 cột, `?view=bang` cho bảng; Thẻ là mặc định, không ghi URL); mỗi chế độ chỉ hiện một cây DOM đúng chế độ đó (desktop bảng 5 cột, mobile hàng thu gọn). Lưới gọn đổi số cột theo bề rộng vùng kết quả (container query `team-view`: 4/3/2/1), không theo viewport.
- **Nhãn biến thể** (`SP`/`CO`/`40Y`) là con dấu viền mảnh: chữ và viền cùng một màu mực đủ tương phản (SP `--accent-ink`, CO `--khien-ink`, 40Y `--ink-2`), nền trong suốt; luôn đứng cùng hàng, ngay trước tên tướng (không dùng màu phe làm nền).
- Màu phe/trạng thái **luôn đi kèm chữ**: chấm màu là `aria-hidden`, không phải tín hiệu duy nhất.
- Bảng rộng bắt buộc (bảng xem trước Landing) phải nằm trong container cuộn rõ (`.landing-table-preview`), không đẩy tràn trang.

**Ngoại lệ "control tương đương" (WCAG 2.5.8):** link tiêu đề thẻ đội (`.reference-team-card .team-name > a`) có thể thấp hơn 44px trên mobile vì mỗi thẻ luôn có link "Chi tiết" cao 44px trỏ **cùng href** — đo trên `/doi-chuan/` (5 link/trang đầu) và `/doi-khac/` (17–40 link). Chip nhóm Tra cứu và link nguồn SGSDeck trong thân chi tiết thì **không** thuộc ngoại lệ này nên đều được nâng lên 44px.

## Responsive và touch

- Mobile-first: một cột/thẻ vừa viewport, control wrap hợp lý, không cần hover.
- **Vùng bấm ≥ 44px trên mobile** cho mọi control (nút, chip, select, ô nhập, nút icon, menu item). Control bên trong nhãn bọc (ô tìm) hoặc checkbox native cũng phải đạt 44px ở phần tử bấm được.
- **Ngoại lệ có ý thức**: link nằm trong câu/dòng chữ (tên tướng trong hàng, chiến pháp, nguồn trong đoạn văn) giữ dòng chữ theo ngoại lệ "inline target" của WCAG 2.5.8; các link đứng riêng (thương hiệu header/footer, danh sách nguồn Khai hoang) vẫn phải đạt 44px.
- Không tạo cuộn ngang ở 320/390: `document.documentElement.scrollWidth` phải bằng `innerWidth` ở 320, 390, 768, 1440. Phần tử chạm mép phải phải nằm trong container `overflow-x: auto` có chủ đích (bảng xem trước, khung Turnstile 300px ở bề rộng hẹp).
- Theme sáng/tối giữ contrast và không làm mất nghĩa của phe/tier/trạng thái.

## Accessibility contract

Đã có và **phải giữ**: focus-visible token hoá (`--focus-width`, `--focus-ring`, `--focus-outline-offset`) trên mọi control kể cả input file phủ trong suốt; `aria-expanded` cho menu thả/menu mobile/panel lọc; hộp thoại hồ sơ trap focus, Escape đóng và trả focus về thẻ vừa bấm; live region cho tải/lỗi; `prefers-reduced-motion` tắt chuyển động; mọi control có tên truy cập được (kể cả ô chọn ảnh native — gắn `aria-labelledby` vào tiêu đề thẻ, không thêm chuỗi mới).

- Giữ điều hướng bàn phím theo thứ tự DOM; Tab/Shift+Tab phải thấy vòng focus ở cả hai theme.
- Nhãn nút chỉ có icon phải có `aria-label`; nhãn Beta dùng `.badge-beta`.
- Không tuyên bố accessibility hoàn chỉnh ngoài phần đã có bằng chứng ở `plans/260923-1949-so-binh-phap-redesign/reports/`.

## Bộ lọc danh sách đội

- URL sở hữu bộ lọc: `season, q, faction, unit, subcategory, source, view`; `score` và `category` đã bỏ (danh sách luôn gộp mọi danh mục nguồn). Khóa lạ của trang khác bị bỏ lặng lẽ, khóa được phép của đúng trang được giữ (bảng `safeReturnUrl` theo pathname).
- Hàng control: ô tìm + nút `Bộ lọc` (chỉ mobile) + số đếm `n / m đội` + chuyển Thẻ/Thẻ gọn/Bảng (dưới 1280px chỉ icon, tên đủ ở `aria-label`); phạm vi duy nhất là ô `Mùa nguồn` ở đầu mục, nằm ngoài vùng thu gọn: một khung (nhãn nhỏ viết hoa trên giá trị, mũi tên phải), cả khung là vùng bấm, rộng 320px desktop / đầy hàng mobile.
- Nhóm chính trong vùng lọc: Loại binh → Phe → Nhóm; Nguồn là nhóm phụ (mặc định thu gọn). Chip đếm theo mùa đang chọn.
- Sidebar desktop (>900px): hàng lọc 36px, nhóm ngăn bằng vạch `--line-2` (không dùng khoảng trắng lớn), số đếm là viên nhỏ canh phải; mục đang bật = nền `--panel-3` + ô tích và viên số nền `--select` (không tô đen cả hàng), chấm phe giữ màu thường. `Xóa lọc` ẩn (giữ chỗ) khi không có gì để xóa. Mobile giữ chip 44px, mục bật nền `--select`.
- Điểm nguồn **chỉ hiển thị** (badge số), không có chip lọc điểm và không dùng để sắp xếp: thứ tự thẻ luôn theo nguồn; khóa `?score=` đã nghỉ và bị bỏ lặng lẽ khi gặp. `Xóa lọc` reset query + facet nhưng giữ mùa, và trả focus về ô tìm.
- Thẻ Đội chuẩn và Đội khác **cùng một cấu tạo**: gáy màu phe (`data-faction-code`, trang trí — tên phe vẫn là chữ), tên đội + ô ấn điểm (thiếu điểm = ô ấn viền đứt nét "—", chữ ẩn "Chưa có điểm nguồn"), dòng phe · loại binh, ba dòng tướng, khối "Thay thế (n)", chân thẻ "Sợ …" + CTA chữ son `Chi tiết`. Dòng tướng đổi bố cục theo bề rộng thẻ (container query `team-card`, mốc 480px), không theo viewport. Không caption Tier trên thẻ.

## Tra cứu thống nhất

`/tra-cuu/` là một trang cho sáu nhóm (`heroes`, `tactics`, `equipment`, `advisors`, `troop-mods`, `buildings`); **route canonical là `/tra-cuu/?group=<nhóm>&id=<id>`** — hash cũ `#heroes`, `#tactics` và dạng query trong hash `#lookup?group=<nhóm>&id=<id>` được Landing chuyển tiếp (dạng `#lookup/<nhóm>/<id>` **không** thuộc contract và ở lại Landing). Sáu chip nhóm là button có `aria-pressed` (không phải tablist); search chạy toàn corpus, bỏ dấu tiếng Việt và đọc alias Hán đã review.

Grid phân trang và phải có `Xem thêm` để tới record cuối. Thẻ mở hộp thoại hồ sơ theo canonical ID; hộp thoại trap focus, đóng bằng Escape/nút đóng/nền và trả focus về thẻ. Hồ sơ tướng có khối "Trong cẩm nang" lấy từ artifact tính lúc build (`hero-summaries.json` trong generation Recommended đang pin), không tải kho đội chuẩn khi mở hồ sơ. Quan hệ tướng–chiến pháp và các trường catalog phải đi qua ID đã validate; trường thiếu hiển thị "Đang cập nhật", không biến `0`/`false` thành dấu gạch.

## Phạm vi mùa và chi tiết cấu hình

Không có artboard cho hai surface này; chúng theo StyleGuide và bảng token. `#season-controls` chỉ có ở 3 trang (`team-chuan`, `team-khac`, `coexist`) và luôn ẩn; Cùng Tồn không có select Mùa, hàng nút kịch bản (`.coexist-scenarios`, thứ tự registry) là điều khiển phạm vi duy nhất và ghi `?scenario=` bằng pushState. Chi tiết cấu hình `?config=` mở trong `#season-config-detail` với select 44px, nhãn caps, hàng slot theo holder và nút `Đối chiếu kho của tôi`.

Chọn kịch bản là đọc tham khảo, chưa đủ để gợi ý hoặc so đội theo luật. Phân biệt vùng áp dụng đúng luật, tham khảo cùng kịch bản và chưa rõ kịch bản; mỗi vùng có số lượng riêng.

Hai công cụ Soi đội và Gợi ý đội không có bộ chọn Mùa / Phiên bản luật: luôn chạy trên dữ liệu đội cũ (tất cả — tham khảo); `scenario`, `ruleset`, `config` trên URL cũ của hai trang bị bỏ lặng lẽ khi tải.

## Trang chi tiết đội và 404

- Mỗi đội có route tĩnh riêng; tên đội và CTA trên thẻ là cùng một anchor thật (middle-click/Cmd-click mở tab mới đúng hành vi trình duyệt).
- Trang chi tiết dùng chung shell, navigation và stylesheet với phần còn lại; nav đánh dấu mục đang thuộc.
- Luôn có link quay lại: mặc định về danh sách của đúng họ, dùng `from` khi giá trị đó hợp lệ; snapshot quay lại chỉ phục hồi khi khớp đúng URL hiện tại.
- Trạng thái tải/lỗi nằm trong live region; không có JavaScript thì trang vẫn còn tiêu đề, điểm nguồn và link quay lại.
- URL đội không tồn tại dẫn tới `/404.html` tĩnh có tiêu đề rõ và link về trang chủ/danh sách.

## Render an toàn

- Nội dung động chỉ qua `el()`/`textContent`; **không** `innerHTML`/`insertAdjacentHTML`/`outerHTML` với dữ liệu. Chuỗi HTML còn lại trong `js/` phải là hằng tĩnh (liệt kê ở báo cáo Phase 10).
- SVG tĩnh viết trong Astro hoặc dựng bằng `createElementNS`.
- `href` lấy từ dữ liệu phải qua kiểm scheme `http(s)`; link ngoài `target="_blank" rel="noopener noreferrer"`; query link dựng bằng `URLSearchParams`.
- Lỗi provider/network không đổ nguyên văn message upstream; thông báo tiếng Việt hữu hạn.

## Local-first tracker

- Giải thích dữ liệu lưu trong trình duyệt hiện tại và có thể mất nếu clear storage.
- `Xuất JSON`/`Nhập JSON` nằm gần luồng backup/restore, có validation và confirm trước ghi đè; ô chọn tệp native nằm trên nhãn nút với vòng focus nhìn thấy được khi Tab.
- Pity, lượt còn lại và lịch sử 5★ dùng nhãn số rõ, không chỉ màu.
- Không gửi tracker data ra Worker/provider nếu không có tính năng hoặc đồng ý mới.

## Soi đội từ ảnh

- Luôn hiển thị disclaimer: ảnh gửi tới Alibaba Cloud DashScope, không chủ động lưu; khuyến nghị crop tên account.
- Preview giúp người dùng xác nhận ảnh trước gửi; trạng thái nén, Turnstile, upload và lỗi tách bạch.
- Kết quả canonical Việt và icon chỉ là hỗ trợ đối chiếu; icon lỗi không được làm mất text; thiếu dữ liệu thì ghi rõ chứ không bịa điểm/mùa.

## Gợi ý đội từ kho

- Quy trình bắt buộc: scan → map canonical → người dùng review/sửa → xác nhận → recommend; mọi thay đổi kho (thêm/bỏ tướng, đọc ảnh xong) huỷ kết quả cũ ngay.
- Phân biệt rõ team đã khóa, portfolio sau build, team nên thêm, missing hero/tactic và conflict.
- Ảnh chỉ đọc để trích xuất; engine local dùng dữ liệu curate để chọn đội.
- State persist chỉ chứa dữ liệu canonical cần thiết; không ảnh, base64, blob hoặc Turnstile token.

## Content safety và error state

- Empty state nói bộ lọc không có kết quả và giữ control để người dùng reset.
- Network/provider error không lộ chi tiết upstream; KV quota là best-effort, không diễn đạt như giới hạn cứng.
- Disclaimer dữ liệu meta phải nhắc đây là nguồn tham khảo, không phải phương án duy nhất.

## Không nên làm

- Không thêm framework-looking component chỉ để đổi thẩm mỹ.
- Không chép giá trị màu/kích thước vào CSS/tài liệu khi đã có token.
- Không tạo filter UI khác nhau cho hai trang danh sách đội cùng contract.
- Không biến tên đội/CTA thành button, không chặn click có modifier, không tự viết router cho trang chi tiết.
- Không dùng `overflow: hidden` để "chữa" tràn ngang thay vì sửa bố cục.
- Không tham chiếu `data/facets.json` như runtime source hoặc module điều hướng không tồn tại.

## Tham chiếu

- Token và danh mục component: [`docs/design/so-binh-phap/tokens.json`](design/so-binh-phap/tokens.json)
- Công cụ: [`scripts/design-tokens.mjs`](../scripts/design-tokens.mjs), [`scripts/design-compare.mjs`](../scripts/design-compare.mjs)
- Báo cáo từng phase: [`plans/260923-1949-so-binh-phap-redesign/reports/`](../plans/260923-1949-so-binh-phap-redesign/reports/)
- [PDR](project-overview-pdr.md) · [System Architecture](system-architecture.md) · [Code Standards](code-standards.md)
