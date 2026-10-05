# Brainstorm — Redesign "Sổ binh pháp" (toàn site)

Ngày: 2026-09-23 · Cập nhật: 2026-09-24 (xem §10) · Trạng thái: **đã chốt, sẵn sàng làm plan** · Nguồn design: canvas <https://claude.ai/artifact/JshDEV8qspJo6VJ6rgiB71> · bản chụp trong repo: [docs/design/so-binh-phap/](../../docs/design/so-binh-phap/README.md) (phiên bản `1791139258-59c3`, 2026-09-29)

## 1. Outcome

Toàn bộ site Cẩm Nang TQCCL mang giao diện "Sổ binh pháp" đúng như canvas: nền giấy dó, dải header mực, ấn son 兵, tiêu đề serif, accent son. Áp cho mọi mục: Landing giới thiệu (§10), Đội chuẩn/Đội khác (Thẻ + Bảng), chi tiết đội, Tra cứu, Cùng Tồn, Khai hoang, 3 công cụ Beta; desktop 1440 và mobile 390; sáng + tối.

## 2. Constraints

- Canvas là chuẩn: lấy đúng giá trị (màu, cỡ chữ, spacing, radius) từ mã nguồn artboard; không copy inline style — chuyển thành class/token trong CSS.
- Giữ contract hiện có: class test đang bắt (`.reference-score`, `.nav-tab[data-section]`, `.fchip`…), ARIA, hash/URL deep-link, hành vi JS, `localStorage` tracker, luồng Worker/Turnstile, engine gợi ý cục bộ.
- Cổng bản dịch `pipeline/site_localization.py`: đổi chữ hiển thị thuộc ledger phải qua review độc lập; không tự duyệt.
- Thuật ngữ 碰瓷: Khai hoang = "Chạm Sứ", Đội chuẩn = "cảm tử"; tên VN game là chuẩn.
- Pin publication/route handle/`_headers`/dist verifier phải cập nhật hợp lệ khi đụng tới; build qua `npm run build` (gate public trước astro).
- Mỗi bước commit riêng (conventional, không nhắc AI); deploy production cần ủy quyền riêng.

## 3. Non-goals

- Không thêm tính năng ngoài canvas, trừ chế độ Thẻ/Bảng (đã duyệt).
- Không đổi dữ liệu, engine gợi ý, schema lưu trữ, Worker.
- Không self-host ảnh chân dung (vướng quyền sử dụng) — để sau.
- Không đổi 5 tên đội "…cảm tử" hay URL đã đóng băng.
- 3 artboard hướng A/B/C chỉ để tham khảo, không implement.
- Không viết lại lịch sử git (đường dẫn cục bộ cũ còn trong commit `2f1de73`).

## 4. Acceptance criteria

- Mỗi mục: ảnh chụp localhost 1440px + 390px đặt cạnh artboard tương ứng, chênh lệch được liệt kê và xử lý.
- `npm run check`, build, `npm run test:node`, `npm run test:e2e`, `python3 -m unittest discover -s tests` đều pass; test cũ chỉ được sửa khi hành vi đổi có chủ đích (vd bỏ lọc điểm), không xóa để né.
- Gate `site_localization check --stage public` 5592/5592, không problem.
- Giao diện tối: chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1; không mất nghĩa phe/binh/trạng thái (luôn có chữ đi kèm màu).
- Vùng bấm mobile ≥ 44px; không cuộn ngang; focus-visible rõ; hộp thoại khóa focus + Escape.
- `docs/design-guidelines.md` cập nhật theo hành vi mới.

## 5. Quyết định Bước 0 (đã đồng ý)

| # | Chủ đề | Quyết định | Lý do / bằng chứng |
|---|---|---|---|
| 1 | Thẻ/Bảng — mặc định | **Thẻ** mọi khổ | Người mới thấy giao diện quen; Bảng là tùy chọn so nhanh |
| 2 | Thẻ/Bảng — ghi nhớ | URL `?view=bang` (chỉ khi Bảng, ưu tiên) + `localStorage` làm mặc định khi URL không có | Bộ lọc đã giữ trên URL (`js/app.js` replaceState); theme đã dùng `localStorage` (`js/site-chrome.js`) |
| 3 | Thẻ/Bảng — phạm vi | Cả Đội chuẩn và Đội khác | Hai tab chung một factory (`js/team-filter-section.js`); legacy đủ trường cho cột bảng |
| 4 | Font | Self-host woff2: Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700 (Latin + Vietnamese, ~150–250 KB); ấn 兵 vẽ SVG, không tải font CJK | `public/_headers` chưa có CSP; tránh gửi truy cập sang Google; cần thêm rule `/fonts/*` + allowlist trong `astro-dist-contract`/`runtime-asset-contract` |
| 5 | Giao diện tối | Dùng bảng tối trong artboard StyleGuide; rà ở Bước 8, chỗ xấu mới vẽ thêm | Site đã có toggle sáng/tối, mặc định sáng — giữ hành vi |
| 6 | Chân dung tướng | Ảnh thật từ `iconUrl` như hiện tại; ô màu phe + chữ Hán làm fallback khi ảnh lỗi | Ảnh hotlink `cloud.lingxigames.com`; fallback tránh ảnh vỡ |

## 6. Hướng đã chọn & các quyết định design đã chốt trong phiên

- Hướng "Sổ binh pháp" (chọn trên 3 hướng A Chiến báo / B Bảng tra / C Thủy mặc), mượn cách xếp một dòng mỗi đội của B cho chế độ Bảng.
- Menu nhóm 3 cụm: Đội hình (Đội chuẩn, Đội khác, Cùng Tồn, Khai hoang) · Tra cứu · Công cụ (Beta).
- **Bỏ bộ lọc Điểm nguồn**; điểm chỉ hiển thị trên thẻ/chi tiết.
- Thẻ đội gọn: tên + dòng "■ phe · binh", điểm 28px; mỗi tướng: vai trò viết tắt, tên, 2 chiến pháp chữ son, dòng binh thư; binh thư trống → một dòng nghiêng "Nguồn chưa ghi" (thay 3 ô "Chưa có dữ liệu"); dòng cuối gộp "Sợ …", "Thay thế (n)", "Chi tiết →". Đội thiếu phe/binh thì bỏ phần thiếu (như site hiện tại).
- Tra cứu: lưới tướng 6 cột, bảng chiến pháp (phẩm, loại, hiệu quả, mục tiêu, tỷ lệ), hộp thoại hồ sơ; sửa lỗi lộ khóa `bonusVi:`.
- Cùng Tồn: chọn nhóm 1–5, ô tổng quan (chủ lực, gợi ý khai hoang, "5 đội · 15 tướng · không trùng" tính từ dữ liệu).
- Khai hoang: Trước → Sau, thanh điểm 6 mốc, lưới Chạm Sứ, bảng quân thủ mỏ.
- Công cụ Beta: chỉ đổi giao diện; bỏ emoji (📷, ⚠) → icon SVG; lưu trữ/Worker/engine giữ nguyên.

## 7. Lộ trình cho plan

| Bước | Nội dung | File chính | Test chính |
|---|---|---|---|
| 1 | Token sáng/tối, font self-host, component dùng chung; cân nhắc tách `tokens.css`/`components.css` | `css/styles.css`, `public/fonts/`, `public/_headers` | `tests-js/runtime-asset-contract.test.mjs`, `astro-dist-contract` |
| 2 | Header tối + ấn SVG, menu 3 nhóm, menu mobile | `src/layouts/SiteLayout.astro`, `src/pages/index.astro`, `js/site-chrome.js`, `js/mobile-section-menu.js` | `spa-parity.spec.mjs`, `team-detail-pages.spec.mjs` |
| 3 | Đội chuẩn/khác: sidebar lọc, bỏ lọc điểm, thẻ gọn, Thẻ/Bảng | `js/team-filter-section.js`, `js/recommended-reference-render.js`, `js/app.js` | `recommended-browser.spec.mjs`, `season-lookup.spec.mjs` |
| 4 | Trang chi tiết đội | `js/team-detail.js`, `recommended-reference-render.js`, `src/pages/doi-*/[team].astro` | `team-detail-pages.spec.mjs` |
| 5 | Tra cứu + hồ sơ | `js/unified-lookup.js`, `js/lookup-detail.js` | `unified-lookup.spec.mjs` |
| 6 | Cùng Tồn + Khai hoang | `js/render.js` (`coexistGroup`, `khaihoang*`) | `khaihoang-options.spec.mjs` |
| 7 | 3 công cụ Beta | `js/recruit-tracker.js`, `js/analyze.js`, `js/roster-recommend-ui.js` | `tests-js` liên quan |
| 8 | Giao diện tối, a11y, responsive, docs, full test | toàn bộ + `docs/design-guidelines.md` | toàn bộ |

Artboard tham chiếu theo bước: 1 → StyleGuide · 2 → header mọi artboard · 3 → Main, MainTable, MobileList, MobileTable, MobileFilters · 4 → TeamDetail · 5 → Lookup, LookupTactics, LookupProfile, LookupMobile · 6 → Coexist(+Mobile), Khaihoang(+Mobile) · 7 → Recruit, Analyze, Roster (+Mobile).

## 8. Rủi ro

- Chữ UI thuộc ledger (`ui:*`) — đổi câu chữ có thể cần review độc lập; chạy `npm run check` sớm mỗi bước.
- Thêm file tĩnh (font, CSS tách) chạm allowlist dist verifier + byte parity `_headers`.
- `index.astro` và `SiteLayout.astro` viết `<head>` riêng — dễ lệch nếu chỉ sửa một nơi.
- Dev server giữ snapshot pin trong bộ nhớ: sau publish dữ liệu phải restart (`root-static-artifacts.ts`).
- Ảnh chân dung hotlink có thể bị chặn → fallback phải chắc.
- Chế độ Bảng trên legacy: dữ liệu `heroes[].tactics` dạng object khác Recommended — renderer cần adapter.
- Chiều cao artboard là ước tính; canvas là chuẩn thị giác, không phải chuẩn pixel tuyệt đối về chiều dọc.

## 9. Việc tồn đọng ngoài phạm vi (ghi nhận)

- 5 tên đội "…cảm tử" nằm trong glossary source — đổi sẽ vô hiệu 5592 receipt.
- Góp ý reviewer: "Bản 2 người" → "Bản 2 tướng"; "Phụ Nữ Thương" dễ đọc nhầm; một câu dùng `|` ASCII thay `｜`.
- Đường dẫn `/Users/plateau/Downloads/…mp4` còn trong 23 file đã commit (thế hệ cũ, `plans/`, `assets/videos/…/team-list.md`) và lịch sử git.
- Production `tqccl.pages.dev` còn bản cũ đến khi deploy.

## 10. Cập nhật 2026-09-24 — thay đổi sau brainstorm

Các mục dưới đây **thay thế** chỗ mâu thuẫn ở §1–§7.

### 10.1 Phạm vi thêm

- **Landing giới thiệu** (artboard Landing, LandingMobile): hero, dải số liệu, "Bạn đang cần gì?", 2 kho đội, Giữ đất/mở đất, công cụ, mục **Tải game** (`#tai-game`: QR + App Store + Google Play + bản máy tính), CTA tối, footer đầy đủ.
- **Liên kết game chính thức** (quét từ `tqccl.vntth.com`, bỏ Chính sách bảo mật/Điều khoản): Trang chủ game, Đổi quà, Web nạp, Tra xem tư cách trở về, CSKH (mailto), cộng đồng game (Fanpage, Nhóm Facebook, YouTube), tải game (App Store, Google Play, `.exe` — giữ link trực tiếp theo yêu cầu).
- **QR tải game**: vẽ lại bằng SVG từ link gốc `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true`; nút cửa hàng dùng icon chung, không chép logo Apple/Google.

### 10.2 Quyết định design đổi so với §6

| Chủ đề | Trước | Nay |
|---|---|---|
| Header trang trong (desktop) | 2 tầng: header 68px + thanh chuyên mục 52px, nhãn nhóm viết hoa, 3 nhãn Beta | **1 hàng 72px**: Đội chuẩn · Đội khác · Cùng Tồn · Khai hoang · Tra cứu · **Công cụ [Beta] ▾** · **Game ▾**; mục đang xem gạch chân son; logo về Landing |
| Header Landing | — | Đội hình ▾ · Tra cứu ▾ · Công cụ ▾ · Game ▾ · Về cẩm nang · sáng/tối · CTA; **mỗi nút chỉ mở nhóm của mình** (dropdown neo dưới nút) |
| Menu mobile | nút ☰ không hành động | ☰ mở menu toàn màn hình (LandingMenuMobile): 3 nhóm nội bộ + Game chính thức + Cộng đồng game + Tải game |
| Footer | 1 dòng credit | Footer Landing: cột giới thiệu + 4 cột (Đội hình, Tra cứu, Công cụ · Beta, Về cẩm nang) · dải 1 dòng "Game chính thức" (6 link + 3 link cộng đồng) · dòng cuối 2 cột |
| Nút sáng/tối | header + footer | **chỉ header** |
| Chữ credit | "Được xây dựng bởi … Đội 2 bang Huynh Đệ" | "© 2026 Cẩm Nang TQCCL · Cẩm nang tra cứu build tướng dành game Tam Quốc Chí - Chiến Lược" · "Build bởi Nguyễn Nguyên · HLxThanos · Team 2 bang Huynh Đệ" |
| "Nguồn dữ liệu" | hàng ghi chú trong footer | bỏ hàng ghi chú; `#nguon-du-lieu` trỏ dải Số liệu (dòng "Tổng hợp từ SGSDeck…"); thông báo DashScope giữ ở trang Soi đội |

### 10.3 Ràng buộc thêm

- Link ra ngoài: `target="_blank" rel="noopener"` + icon ↗; không nhúng ảnh/logo từ site nhà phát hành.
- Menu thả phải dùng được bằng bàn phím: `aria-expanded`, Escape đóng, focus quay về nút; bấm ra ngoài để đóng.
- `pipeline/site-localization-policy.json` khóa sha256 của `src/pages/index.astro`, `src/layouts/SiteLayout.astro`, `js/site-chrome.js`, `js/app.js`, `js/render.js`… → mỗi lần sửa phải cập nhật hash hợp lệ; chữ UI mới thuộc `ui:*` cần review độc lập.

### 10.4 Rủi ro thêm

- Nav hiện là `.nav-tab[role=tab][data-section]` (8 tab, `spa-parity.spec.mjs` bắt). Đưa 3 công cụ vào dropdown "Công cụ ▾" đổi cấu trúc tab → test phải sửa có chủ đích, giữ deep-link theo `data-section`.
- Trang Landing mới có nhiều chữ tác giả (hero, mô tả) → có thể phải đăng ký vào policy như một route family mới; cần scout `site_localization.py` khi làm plan.
- Header trang chi tiết đội (`SiteLayout.astro`) và SPA (`index.astro`) viết `<head>`/header riêng → phải đổi cả hai.

### 10.5 Quyết định còn mở

| # | Câu hỏi | Chặn plan? |
|---|---|---|
| 1 | ~~Landing đặt ở đâu?~~ **Chốt 2026-09-24: Landing ở `/`, mỗi mục cẩm nang một đường dẫn riêng** — xem §10.7 | Đã chốt |
| 2 | ~~Footer đầy đủ dùng ở đâu?~~ **Chốt 2026-09-24: toàn site** (SPA, chi tiết đội, 404 dùng chung footer của Landing) | Đã chốt |
| 6 | ~~Tên đường dẫn mới của cẩm nang~~ **Chốt 2026-09-24: bảng đường dẫn §10.7** (không dùng `/cam-nang/`) | Đã chốt |
| 3 | `[KÊNH LIÊN HỆ]` góp ý/báo lỗi; `[NGÀY CẬP NHẬT]` lấy từ đâu (build time / `generatedAt`)? | Không — để placeholder |
| 4 | "dành game" có thiếu "cho" không? | Không |
| 5 | ~~File design lưu trong repo?~~ **Chốt 2026-09-24: đã chụp vào `docs/design/so-binh-phap/`** (28 artboard + `canvas.json` + README có bảng artboard → bước). **Cập nhật:** thêm `support.js` tự viết + script chụp + ảnh chuẩn `screens/` — xem §11.2. Plan/cook đối chiếu bản chụp này; canvas đổi thì chụp lại theo README | Đã chốt |

### 10.7 Đường dẫn: Landing ở `/`, mỗi mục một đường dẫn riêng (chốt 2026-09-24)

| Mục | Đường dẫn mới | Mã mục cũ (`#…` trên `/`) |
|---|---|---|
| Landing | `/` | — |
| Đội chuẩn | `/doi-chuan/` (nút "Mở cẩm nang" trỏ về đây) | `#team-chuan` |
| Đội khác | `/doi-khac/` | `#team-khac` |
| Cùng Tồn | `/cung-ton/` | `#coexist` |
| Khai hoang | `/khai-hoang/` | `#khaihoang` |
| Tra cứu | `/tra-cuu/` (tab tướng/chiến pháp… giữ bằng query) | `#lookup` |
| Theo dõi chiêu mộ | `/chieu-mo/` | `#recruit-tracker` |
| Soi đội từ ảnh | `/soi-doi/` | `#analyze` |
| Gợi ý đội từ kho | `/goi-y-doi/` | `#roster-recommend` |

- `/doi-chuan/` và `/doi-khac/` thành trang danh sách, cùng cây với chi tiết đội `/doi-chuan/<đội>/`, `/doi-khac/<đội>/` (**giữ nguyên**, đã đóng băng).
- Mỗi mục là một trang tĩnh riêng dùng chung khung (header, footer, `<head>`); có `<title>`/mô tả riêng. `js/app.js` lấy mục đang xem từ đường dẫn thay vì `location.hash`; bộ lọc vẫn giữ trên query (`?view=bang`…). Nav dùng link thật `<a href>` thay cho `.nav-tab[role=tab]`.
- Link cũ: hash không tới server → Landing ở `/` có script nhỏ: gặp `#<mã cũ>` (kể cả alias cũ trong `LEGACY_SECTIONS`) thì chuyển sang đường dẫn mới tương ứng, giữ nguyên query; hash lạ → ở lại Landing.
- Cập nhật mọi link nội bộ trỏ `/#…` hoặc `/` (nút "Quay lại", logo, 404, trang chi tiết đội), `sitemap.xml.ts`, `_headers`, dist verifier và test e2e (`spa-parity`, `season-lookup`, `team-detail-pages`, `recommended-browser`…).
- Policy bản dịch: `src/pages/index.astro` đổi vai (thành Landing) → `sections[].entrypoints`, `mount`, `sourceFiles` phải trỏ các trang mục mới.
- Non-goal §3 "không đổi URL đã đóng băng" vẫn giữ cho trang chi tiết đội; chuyển các mục từ `/#…` sang đường dẫn riêng là **ngoại lệ đã được duyệt**, kèm chuyển tiếp link cũ.

### 10.6 Lộ trình điều chỉnh

- Bước 2 (header) theo §10.2: header 1 hàng + 2 dropdown cho SPA/chi tiết đội; menu mobile toàn màn hình.
- **Bước 2b mới — Landing + footer + mục Tải game** (artboard Landing, LandingMobile, LandingMenu, LandingMenuMobile); Landing thay `/`, các mục chuyển sang đường dẫn riêng + chuyển tiếp link `#` cũ (§10.7), footer dùng chung toàn site.
- Artboard tham chiếu bổ sung: 2 → Landing, LandingMenu, LandingMenuMobile + header mọi artboard trang trong.

## 11. Rà file design trong repo (2026-09-24)

Nguồn: `docs/design/so-binh-phap/project/*.dc.html`. Giá trị đọc thẳng từ inline style và `renderVals()`/`baseVals()`.

### 11.1 Dùng được ngay

- Bảng màu sáng/tối + 5 màu phe nằm trong `StyleGuide.dc.html` (`renderVals`) → nguồn duy nhất cho token Bước 1.
- Kích thước artboard (`$preview` + `canvas.json`): desktop 1440, mobile 390, StyleGuide 1280.
- Prop `accent` của `Main`/`MainTable` có 4 lựa chọn → chỉ dùng mặc định `#A8202A` (= Son).
- Be Vietnam Pro 300 và Noto Serif Display 600 chỉ có trong `<helmet>` hoặc `DirC` (non-goal) → giữ quyết định §5 #4: 400–700 + Serif 700.

### 11.2 Ảnh chuẩn: `support.js` tự viết + chụp ảnh (chốt 2026-09-24)

`.dc.html` gọi `<script src="./support.js">` — runtime của canvas, không có trong bản chụp. **Không** sao chép runtime của claude.ai vào repo (mã của bên thứ ba, không rõ giấy phép, và gắn với phiên bản canvas). Thay bằng:

- **`docs/design/so-binh-phap/project/support.js` — shim tự viết**, đặt đúng tên để artboard mở trực tiếp được. Chỉ hỗ trợ đúng những cấu trúc bản chụp dùng (đếm trên 28 file): `<x-dc>`, `<helmet>` → `<head>`, `<script type="text/x-dc" data-props>` → `class Component extends DCLogic`, gộp `baseVals()` + `renderVals()`, `{{ biểu thức }}` trong chữ và thuộc tính, `<sc-if value>` (52), `<sc-for list as>` (30), `onClick="{{fn}}"` (43), `this.state`/`this.setState` (render lại). Bỏ qua `hint-placeholder-*` (chỉ dùng trong trình soạn canvas).
- **Shim phải báo lỗi rõ, không im lặng:** gặp thẻ `<sc-*>` lạ, biểu thức lỗi, hoặc sau khi render còn sót `{{` trong DOM → ném lỗi, script chụp dừng. Tránh ảnh chuẩn sai mà không ai biết.
- **Script chụp `scripts/design-capture.mjs`** (Playwright đã có sẵn cho e2e): đọc `canvas.json`, bỏ `DirA/B/C`, mở từng artboard với viewport = `w` × `h`, đợi font tải xong, chụp vào `docs/design/so-binh-phap/screens/<Artboard>.png` ở DPR 1. Chạy lại được bất cứ lúc nào (idempotent).
- **Kiểm shim một lần:** chủ canvas đặt ảnh chụp từ script cạnh canvas gốc cho cả 25 artboard, ghi kết quả vào README ("đã đối chiếu bản chụp `…` ngày …"). Artboard nào lệch → sửa shim, không sửa `.dc.html`.
- **Cập nhật README:** mục "Xem artboard" (mở trực tiếp được nhờ shim), mục "Cập nhật bản chụp" (ghi đè `project/*.dc.html` + `canvas.json` nhưng **giữ** `support.js`, rồi chạy lại script chụp và commit ảnh chung commit `docs(design): …`).
- **Dung lượng:** 25 PNG, cao tới 4420px → cỡ vài chục MB; nén không mất chất lượng (vd `oxipng`) trước khi commit. `docs/` không nằm trong `public/` nên không vào dist — phải kiểm allowlist `astro-dist-contract` không bắt nhầm.
- Làm ở **Bước 0** của plan, trước token.

### 11.3 Thiếu trong design

- **Không có artboard tối** ngoài bảng màu StyleGuide — đúng §5 #5; rà ở Bước 8.
- **Không có artboard chi tiết Khai hoang** (`/khai-hoang/<đội>/`, đang làm dở ở plan `260922-1806`) → dùng khung `TeamDetail` + thẻ trong `Khaihoang`.
- Trạng thái tương tác khác mặc định (menu mở, hộp thoại hồ sơ) chỉ có khi có artboard riêng (`LandingMenu`, `LandingMenuMobile`, `LookupProfile`); script chụp trạng thái mặc định.

### 11.4 Mâu thuẫn artboard ↔ contract — contract thắng

| Artboard | Giá trị design | Áp dụng |
|---|---|---|
| `MobileFilters`, `LookupMobile`, `KhaihoangMobile` chip lọc | `min-height: 40px` | §4 vùng bấm ≥ 44px → 44px, giữ padding/radius/cỡ chữ |
| `KhaihoangMobile` chip cấu hình | `min-height: 34px` | → 44px |
| `MobileList`/`MobileTable` nút Thẻ/Bảng | `44 × 38px` | → 44 × 44px |
| Footer mobile, link trong cột | `min-height: 40px` | → 44px |
| Ấn 兵, chữ Hán thay chân dung | font `Noto Serif TC` từ Google Fonts | §5 #4: ấn vẽ SVG; chữ Hán thay chân dung dùng serif hệ thống (`'Songti TC', serif`), không tải font CJK |
| `<helmet>` mọi artboard | Google Fonts | §5 #4: self-host |

### 11.5 Độ tương phản token (WCAG, đã tính)

- Sáng trên Giấy: Mực 14.8 · Chữ phụ 5.9 · Son 6.3 → đạt.
- Tối trên Nền: Chữ 14.8 · Chữ phụ 7.0 · Son 5.5; Son trên Thẻ đậm 4.51 → sát ngưỡng, không được tối thêm.
- Màu phe trong artboard chỉ tô ô vuông 8px `aria-hidden`, luôn kèm chữ phe → không mất nghĩa. **Không** dùng màu phe làm màu chữ thường: Quần sáng 2.9–3.3, Thục sáng trên Giấy đậm 4.16, Ngụy tối 3.4–4.2 đều dưới 4.5.
- Footer: tiêu đề cột `#8F8676` trên `#1C1A17` 4.83, chữ `#A99F8E` 6.64 → đạt.

### 11.6 Thứ tự làm và cách soát

- **Bước 0:** shim + script chụp + ảnh chuẩn (§11.2).
- **Bước 1:** bảng token (giá trị artboard → custom property, đủ sáng/tối) ghi trong `docs/design/so-binh-phap/README.md`; CSS chỉ dùng token.
- **Tách đường dẫn §10.7 trước khi làm header:** mọi trang (Landing, trang mục mới, chi tiết đội, 404) dùng chung `SiteLayout.astro` → bỏ `<head>`/header viết riêng trong `index.astro`.
- **Mỗi bước:** báo cáo so ảnh localhost 1440/390 cạnh `screens/<Artboard>.png`, liệt kê lệch và cách xử lý; script tạm đọc `getComputedStyle` đối chiếu bảng token (không giữ thành test).
- **Điều kiện trước Bước 1:** commit hoặc tách riêng phần Khai hoang đang dở (31 file sửa, trùng `css/styles.css`, `js/app.js`, `js/render.js`, `index.astro`, `SiteLayout.astro`, policy khóa hash).

## Handoff

Tiếp theo: `/ak:plan` dùng file này làm contract (outcome, constraints, non-goals, acceptance, 6 quyết định, §10, §11 — Bước 0 ảnh chuẩn và thứ tự §11.6), rồi `/ak:cook` theo từng bước.

## Câu hỏi chưa giải quyết

- Không còn câu hỏi chặn (§10.5 #1, #2 đã chốt).
- Không chặn: §10.5 #3–#4; tách `css/styles.css` thành nhiều file ở Bước 1 hay giữ một file — quyết khi làm plan sau khi đọc `runtime-asset-contract`.
