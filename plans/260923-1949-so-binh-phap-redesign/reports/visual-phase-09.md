# Phase 9 — Báo cáo: 3 công cụ Beta (Chiêu mộ, Soi đội, Gợi ý đội)

Ngày: 2026-09-26 · Plan `260923-1949-so-binh-phap-redesign`, [phase-09](../phase-09-cong-cu-beta.md).
Phạm vi: `/chieu-mo/`, `/soi-doi/`, `/goi-y-doi/` mang giao diện artboard; lưu trữ, Worker/Turnstile và
engine gợi ý **giữ nguyên hành vi** (chỉ đổi phần render/DOM + CSS). Chưa commit — orchestrator commit sau go/no-go.

## 1. Việc đã làm theo bước trong phase file

| Bước | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | **Chiêu mộ:** đầu mục (kicker `Công cụ · Beta` + h1 serif + lead), thông báo lưu trình duyệt, hàng tài khoản theo artboard; **đồng hồ pity dạng `role="meter"`** đọc thẳng giá trị store (`getPity`) kèm chữ "x / y", số serif son, dòng "Còn … lượt tới mốc bảo hiểm · Hôm nay n/4", cảnh báo khi quá mốc; ô 4 lượt có `aria-pressed` theo trạng thái đã ghi (nút đã ghi nền dải, hai nút vẫn khoá sau khi ghi như hành vi cũ); lịch sử 5★ theo artboard (tên serif + badge phân loại + `ngày · gói` + `lượt n/y`); **mobile gom hành động tài khoản vào nút ⋯** dùng chung `createDropdownMenu` của `js/site-nav.js` (`aria-expanded`, Escape trả focus, bấm ngoài/Tab ra ngoài đóng, bề rộng lớn thì hàng thao tác hiện thẳng) | xong — §2, §3 |
| 2 | **Soi đội:** đầu mục + thông báo DashScope (giữ nguyên chữ), khung kéo-thả/crop với icon máy ảnh SVG, hàng ảnh đã chọn (thumbnail + tên file + "Đã nén · sẵn sàng gửi" + "Chọn ảnh khác"), danh sách bước "Nén ảnh / Xác thực chống bot / Soi đội", hai thẻ kết quả "2 · Đội đọc được" và "3 · Đội có sẵn tương tự"; **emoji `📷`, `⚠` thay bằng SVG `aria-hidden` dựng bằng `createElementNS`**; chân dung dùng `heroPortrait` của Phase 7; Turnstile mount/hết hạn/token dùng 1 lần + chốt `generation` giữ nguyên | xong — §2, §3, §6 |
| 3 | **Gợi ý đội:** đầu mục + thông báo engine cục bộ, **dải tóm tắt 1–2–3** (Đọc kho → Kiểm tra → Gợi ý) suy ra từ trạng thái UI hiện có, ba thẻ "BƯỚC n" có số đã đọc + pill Xong/Chưa đọc, khu kiểm tra kho giữ `.roster-review-panel`, **mobile nút "Sửa kho đã đọc" mở/đóng khu sửa**, **danh sách 5 đội đánh số** + pill trạng thái, `.roster-results` giữ | xong — §2, §3 |
| 3b | **Phạm vi mùa + chi tiết cấu hình** trên Soi đội và Gợi ý đội: bộ chọn Mùa/Phiên bản luật đặt trong đầu mục công cụ, dùng lại style Phase 8 (`reference-scope-controls` + select 44px + nhãn caps); `#season-config-detail` chỉ áp token (Phase 2/8 giữ bố cục); link "Mở scan / nhập kho" tới `/goi-y-doi/` **giữ `scenario`/`ruleset`**; kiểm bằng fixture test | xong — §2, §5 |
| 4 | Chữ mới → obligation `authored-vi` (82 dòng); không dời/đổi chuỗi `translate` nào ⇒ không cần receipt | xong — §4 |
| 5 | Cặp so ảnh: Recruit, RecruitMobile, Analyze, AnalyzeMobile, Roster, RosterMobile + 3 ảnh 320 + 2 ảnh phạm vi mùa (không có artboard) | xong — §3 |
| 6 | **Vòng sửa P09 (Kongming NO-GO):** (P09-1) thêm/bỏ chip và đọc ảnh thành công chạy **đúng đường huỷ** (`rerender()`: xoá kết quả, `recommended=false`, vẽ lại tiến trình, khoá "Gợi ý 5 đội") mà vẫn giữ bàn giao focus; (P09-2) hàng tài khoản bề rộng hẹp thành lưới `[select co giãn | ⋯ 44px]` + hàng thao tác xuống dòng, ô nhập JSON thành control phủ trong suốt (bỏ 253px intrinsic), ô lượt ở 320px xếp dọc — không dùng `overflow-x: hidden`; (P09-3) tên/meter/nút "Ra 5★" của gói đọc **dữ liệu sống** mỗi lần vẽ (nhập JSON cùng id đổi tên hiện ngay, không cần tải lại); (P09-4) hàng kết quả đặt cột tường minh (số ở cột 1, nội dung cột 2, "Mở đội" cột 3; hàng đội mạnh một cột) và ở mobile pill trạng thái xuống dòng dưới tên; (P09-N1) pill `.roster-status` nhận `data-status` nên rule màu chạy thật | xong — §2b, §3, §5 |

## 2. Vi mô (tự động)

- `node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`, 0 mã màu / 0 giá trị thô ngoài
  khối legacy; **ceiling legacy 470 → 329** (xoá toàn bộ rule `.rt-*`, `.ana-*`, `.roster-*` cũ: 141 giá trị thô
  trên 70 selector; còn 329 giá trị thô trên 145 selector là nợ Phase 10).
- `node scripts/design-compare.mjs --tokens --phase 09` (light + dark): **686/688 thuộc tính khớp token · 0 lệch
  chưa giải thích** ở cả hai theme, gồm trạng thái **menu tài khoản mở (390)**, **nút ⋯ đang focus**,
  **khung chọn ảnh đang focus**, **nút đã ghi trạng thái `aria-pressed=true`**, **bước đang làm/chờ**,
  **bảng bước 390**, **số mốc bảo hiểm 52px mobile**, **nút chính/chữ**, **thẻ công cụ** ở cả hai theme.
  Hai ngoại lệ khai báo (đúng `actual`): `select-nhan-caps` và `tool-head` — `line-height: normal` của form
  control trong Chrome (chiều cao đã khoá bằng `control.44`).
- Token mới: 3 vai trò chữ — `type.pity-unit` (18/1.4/400, nguồn Recruit/RecruitMobile dòng "/ 30 lượt"),
  `type.pity-value-mobile` (52/0.9/700 serif, nguồn RecruitMobile), `type.tool-step-title` (16/1.2/700, nguồn
  Roster tên bước). Danh mục component: 10 mục mới của phase (`tool-head`, `tool-notice`, `tool-text-action`,
  `menu-tai-khoan`, `thanh-tien-do`, `the-cong-cu`, `buoc-cong-cu`, `chip-bo-tuong`, `o-doc-anh`,
  `hang-doi-tuong-tu`) + cập nhật selector của `the`, `nut-phu`, `nut-chinh`.

### Tương phản (cặp token dùng thật, tính từ `tokens.json`)

| Cặp chữ thật | Sáng | Tối |
| --- | --- | --- |
| badge phân loại "Chủ lực" (`--accent-ink` trên `--accent-soft`) | 7,17:1 | 6,37:1 |
| pill "Có thể xây dựng ngay" / "Xong" (`--good` trên `--panel-3`) | 4,77:1 | 7,70:1 |
| pill "Dùng biến thể" (`--ky` trên `--panel-2`) | 4,62:1 | 6,09:1 |
| chữ phụ trong thẻ (`--muted` trên `--panel`) | 6,69:1 | 6,43:1 |
| chữ phụ trong ô lượt (`--muted` trên `--panel-3`) | 6,14:1 | 5,75:1 |
| nội dung chính (`--ink` trên `--panel`) | 16,75:1 | 13,53:1 |
| nút phụ / thông báo (`--ink-2` trên `--panel-2`) | 9,52:1 | 8,88:1 |
| nút chính, bước đang làm (`--band-ink` trên `--band`) | 15,01:1 | 15,54:1 |
| số mốc bảo hiểm, kicker (`--accent` trên `--panel`) | 7,05:1 | 5,04:1 |

Phase không thêm màu mới cho chữ. **Một chỗ phải lệch token vì ngưỡng 4,5:1:** pill lục dùng `--panel-3` +
`--good` (4,77:1) thay vì `--good-bg` + `--good` (4,47:1). Đây **không** phải nợ còn sống của Phase 1:
`.chip.good` đã được Phase 5 đổi sang chip trung tính (`css/styles.css:2726`) nên cặp đó không còn dùng ở đâu;
phase này là chỗ dùng đầu tiên cần cặp lục trên nền nhạt nên chọn cặp token đạt ngưỡng.

**Sổ nợ tương phản thật còn lại (đã rà theo selector, không theo tên cũ):**

| Chỗ còn nợ | Cặp | Ghi chú |
| --- | --- | --- |
| `.pre.sp` (`css/styles.css:572`, `background: var(--accent)`) | `--on-accent` trên `--accent` = 3,33:1 ở theme tối | Nợ kế thừa; Phase 9 không tạo và không sửa. Lưu ý `css/styles.css:4055` đã sửa một chỗ tương tự bằng `--bg` làm mực — đây là chỗ còn lại |
| `.badge.faction.f-nguy` (`:551`) | `--on-accent` trên `--f-nguy` | Nợ kế thừa; theme tối `--f-nguy: #4F74D6` (`:286`) |
| `.ana-stat` (phase này) | `--on-accent` trên `--f-nguy` | Dùng lại đúng cặp của badge phe Ngụy ở trên (không tạo cặp mới); cùng số đo với hàng trước |

`.badge.unit` (`:536-537`) **đã trung tính**: theme sáng chữ `--on-accent` trên nền `.badge.unit` không tô màu,
theme tối đã có override `color: var(--bg)`, nên nó không còn là nợ 3,33:1 như ghi ở bản báo cáo trước.

## 2b. Vòng sửa P09 (từng finding + bằng chứng)

| # | Lỗi Kongming | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| P09-1 (chặn) | Bỏ/thêm chip và đọc ảnh xong không huỷ kết quả gợi ý cũ: nút "Gợi ý 5 đội" vẫn bật, `.roster-results` còn, bước 3 vẫn `data-state=done` | `js/roster-recommend-ui.js`: cả ba đường (bỏ chip, thêm chip, đọc ảnh thành công) gọi `rerender()` — xoá `.roster-results`, `recommended=false`, vẽ lại dải bước, `refreshRecommend()`; bàn giao focus sau khi bỏ chip giữ nguyên | e2e `mọi thay đổi kho (bỏ, thêm, đọc ảnh) huỷ kết quả gợi ý cũ ngay lập tức`: mỗi chuyển tiếp → `.roster-results` 0, bước 3 **pending**, nút **disabled**, `confirmed=false` trong storage; xác nhận lại → kết quả mới; bỏ chip vẫn focus chip kế tiếp, thêm chip vẫn focus nút "Thêm" |
| P09-2 (chặn) | Trang Chiêu mộ tràn ngang ở 320px (`scrollWidth=326`) và **menu tài khoản mở tràn 445px** ở cả 320/390; input file gốc rộng 253px | `css/styles.css`: hàng tài khoản thành lưới `[minmax(0,1fr) | control.44]` + hàng thao tác `grid-column: 1 / -1`; `.rt-import`/`.rt-file` thành control phủ trong suốt trong nhãn (vẫn bấm + focus được); `@media (max-width:400px)` xếp dọc hai nút trong ô lượt. **Không** ẩn overflow | đo thật ở **320 và 390, cả hai theme, đóng và mở menu**: `document.documentElement.scrollWidth == innerWidth` (320/320, 390/390) và **không phần tử nào** có mép phải vượt `innerWidth`; ảnh chụp có dữ liệu ở §3 |
| P09-3 | Nhập JSON cùng id nhưng đổi tên gói: tên hiện vẫn là tên cũ tới khi tải lại; callback 5★ giữ tên lúc tạo nút | `js/recruit-tracker.js`: mỗi lần vẽ cập nhật `textContent` của `.rt-banner-name`; nút "Ra 5★" đọc tên từ **ảnh chụp gói mới nhất** (`latestBanners`) thay vì closure; node/nút vẫn giữ nguyên (không mất focus) | e2e `nhập JSON cùng id…`: sau khi nhập — tên "Gói hạn giờ B", `lượt 31/45`, `aria-label`/`aria-valuemax`/`aria-valuetext` theo gói mới, form 5★ mở ra hiện "Ghi 5★ · Gói hạn giờ B"; Xuất JSON khớp trạng thái; tải lại vẫn B |
| P09-4 (chặn) | Hàng kết quả có dữ liệu sai cột: "Mở đội" chiếm cột số (x=66), rank chiếm cột nội dung; tên đội "mạnh nhưng chưa xây dựng" bị nhốt vào cột 32px (28px ở mobile); 320px tên đội bị bóp | `css/styles.css`: `.roster-rank` cột 1, `.roster-result-main` cột 2, nút cột 3 (đều khai `grid-row`), hàng `.muted` một cột; ≤680px pill xuống dòng dưới tên; phục hồi vai trò chữ serif cho số thứ tự | đo thật: 1440 → rank `x=66/w=32`, main `x=112/w=1163`, "Mở đội" `x=1289/w=85`; 390 → main `w=280`, nút dưới tên; 320 → main `w=210`; tên hàng "chưa xây dựng" `w=1310/324/254`. Ảnh chụp có dữ liệu cho cả 3 bề rộng × 2 theme (mỗi ca tự đặt `localStorage.theme` rồi khẳng định `html[data-theme]` trước khi chụp) |
| P09-N1 | Pill trạng thái không có `data-status` nên rule màu không chạy | `js/roster-recommend-ui.js`: pill nhận `dataset.status = entry.status || "locked"` (nhãn dịch giữ nguyên) | e2e đọc computed: `data-status=build-now` → nền `rgb(247,242,232)` = `--panel-3`, chữ `rgb(31,122,77)` = `--good`; test khẳng định đúng cặp token chứ không chỉ "token khác rỗng" |
| P09-N2 | Kết luận trong báo cáo mạnh hơn bằng chứng (ảnh rỗng + test chỉ kiểm token) | §3 thay bằng số đo có dữ liệu + ảnh chụp populated; thêm mục ghi nhận riêng cho nợ kế thừa | §3, §7 |
| P09-R1 (Kongming P09b, do orchestrator sửa) | Ô nhập JSON phủ trong suốt làm mất **vòng focus nhìn thấy được** khi Tab vào | `css/styles.css`: thêm `:where(.rt-import):has(.rt-file:focus-visible)` vẽ vòng focus lên cả nhãn (sau rule focus nền) + ca e2e Tab từ "Xuất JSON" vào ô nhập | e2e `beta-tools` (ca nhập JSON) khẳng định vòng focus sau khi Tab; gate A2 đầy đủ xanh lại (e2e 255/255) |
| P09-N1/N2 nits | Vòng lặp ảnh chụp phải **đặt và khẳng định đúng theme** từng ca; xoá khẳng định tautology (token khác rỗng, `outputPath("unused")`) | `tests-e2e/beta-tools.spec.mjs`: thêm `ensureTheme()` ghi `localStorage.theme` trước khi nạp trang + `expect(html[data-theme])` cho từng ca chụp; bỏ các khẳng định vô nghĩa | 9/9 ca `beta-tools` xanh; ảnh chụp có dữ liệu ghi lại theo tên `{roster,analyze}-{1440,390,320}-{light,dark}.png` (đã xoá 3 ảnh cũ không có hậu tố theme) |

**Vòng sửa cũng phát hiện một lỗi trong chính bộ test mới:** helper `seed()` ghi storage **mỗi lần** nạp trang nên `reload()` trong ca nhập JSON ghi đè dữ liệu vừa nhập; đã đổi thành chỉ ghi khi khoá còn trống (đúng quy ước của `spa-parity.spec.mjs`).

## 3. Bố cục (người duyệt)

Mỗi theme: **6 ảnh ghép cạnh artboard** (Recruit @1440, RecruitMobile @390, Analyze @1440, AnalyzeMobile @390,
Roster @1440, RosterMobile @390) + **3 ảnh 320** (không có artboard: soát nhất quán) + **2 ảnh phạm vi mùa**
(`/soi-doi/`, `/goi-y-doi/` @1440 — không có artboard, theo StyleGuide) ở
`.cache/design-compare/phase-09{,-dark}/` (không commit).

| Artboard | Trang thật | Đã xem | Kết luận |
| --- | --- | --- | --- |
| Recruit | `/chieu-mo/` @1440 | sáng | **đạt**: kicker + h1 serif 48 + lead; thông báo khiên; hàng TÀI KHOẢN (select 200px + `+ Tài khoản`/`Đổi tên`/`Xóa tài khoản` + `Xuất JSON`/`Nhập JSON`); thẻ hằng ngày (số serif son 64/0.9 + "/ 30 lượt" + thanh meter + "Còn … lượt tới mốc bảo hiểm · Hôm nay n/4"); lưới 2×2 ô lượt; "Gói hạn giờ / Đột xuất" + "Thêm gói"; aside "Lịch sử 5★" |
| RecruitMobile | `/chieu-mo/` @390 | sáng | **đạt**: hàng tài khoản thu còn select + nút **⋯** (44px) cạnh nhau; thẻ hằng ngày, ô lượt, gói hạn giờ, lịch sử xếp dọc |
| Analyze | `/soi-doi/` @1440 | sáng | **đạt**: đầu mục + thông báo DashScope trong thẻ "1 · Chọn ảnh"; khung kéo-thả nét đứt + icon máy ảnh; checkbox ngoài phạm vi; nút "Soi đội"; danh sách bước; hai thẻ kết quả bên phải (trống trong ảnh chụp vì chưa gửi ảnh — xem ghi nhận) |
| AnalyzeMobile | `/soi-doi/` @390 | sáng + tối | **đạt**: đầu mục → thông báo → khung ảnh → nút → bước, không cuộn ngang |
| Roster | `/goi-y-doi/` @1440 | sáng | **đạt**: đầu mục + thông báo engine; dải bước 1–2–3 (bước đang làm nền mực); hàng điều khiển (Ưu tiên + Thử nghiệm + Xác nhận + Gợi ý 5 đội); ba thẻ "BƯỚC n" (số đã đọc + pill); ba panel kiểm tra kho; (kết quả chỉ hiện sau khi bấm "Gợi ý 5 đội" — xem ghi nhận) |
| RosterMobile | `/goi-y-doi/` @390 | sáng + tối | **đạt** (ảnh ghép): dải bước 3 ô, điều khiển xếp dọc, nút "Sửa kho đã đọc" full width, khu kiểm tra gập lại |
| — (không có artboard) | 3 trang @320 | sáng | **đạt**: `scrollWidth == innerWidth`; nút ⋯ và nút "Sửa kho đã đọc" vẫn ≥ 44px |
| — (không có artboard) | Chiêu mộ @320 + @390, **menu tài khoản đóng và mở**, cả hai theme | sáng + tối | **đạt (đo lại sau vòng sửa)**: `scrollWidth == innerWidth` ở cả 4 tổ hợp (320/320, 390/390) và không phần tử nào vượt mép phải; nút ⋯ nằm cạnh select (không xuống dòng) |
| — (không có artboard) | Gợi ý đội **có kết quả** @1440/390/320, cả hai theme | sáng + tối | **đạt**: số thứ tự ở cột đầu (x=66, w=32 @1440), tên đội cột giữa (w=1163), "Mở đội" cột cuối (x=1289); hàng "mạnh nhưng chưa xây dựng" một cột (tên w=1310 @1440); 390/320 nút "Mở đội" xuống dòng dưới tên, tên còn 280/210px; ảnh `.cache/design-compare/phase-09-populated/roster-{1440,390,320}-{light,dark}.png` |
| — (không có artboard) | Soi đội **có kết quả** @1440/390/320, cả hai theme | sáng + tối | **đạt**: thẻ đội đọc được + hàng đội tương tự (tên đội thật, số khớp), không tràn ngang; ảnh `.cache/design-compare/phase-09-populated/analyze-{1440,390,320}-{light,dark}.png` |
| — (không có artboard) | `/soi-doi/`, `/goi-y-doi/` có `?scenario` @1440 | sáng | **đạt**: bộ chọn Mùa/Phiên bản luật nằm trong đầu mục + dòng phân loại phạm vi, theo StyleGuide (Phase 8 bước 2b) |

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
| --- | --- | --- | --- |
| Ảnh ghép artboard Analyze/Roster | có sẵn kết quả đọc ảnh/đội gợi ý | ảnh ghép ở trạng thái trống (chưa gửi ảnh, chưa bấm gợi ý) | `design-compare` không gọi Worker/engine; trạng thái **có dữ liệu** được chụp riêng bằng e2e `beta-tools` vào `.cache/design-compare/phase-09-populated/` (6 tổ hợp mỗi công cụ) và đã được duyệt bằng mắt |
| Hàng "mạnh nhưng chưa xây dựng" | tên đội + lý do | tên đội + `Thiếu tướng: hero:…` | Danh sách thiếu do **engine trả về dạng id canonical** (không phải lỗi hiển thị của phase này) — ghi nhận, không sửa engine |
| Hàng kết quả "Đội tương tự" | tên đội + điểm (113) + `mùa · nguồn` + `3/3 tướng · 6/6 chiến pháp` | tên đội (`team.name`) + `x/y tướng · n chiến pháp` | `analyze-map.js` chỉ trả `team`, `heroHit`, `tacticHit`, `total` — **không có điểm/mùa** trong dữ liệu này; giữ cách hiển thị cũ (thiếu tên thì dùng mã đội) và **không bịa** |
| Hàng kết quả gợi ý | đánh số 1–5 trong một danh sách | đánh số 1..n **theo từng khối** (xây dựng được / nên thêm) | Engine trả hai danh sách riêng; giữ nguyên ngữ nghĩa hai khối thay vì trộn |
| Dải bước 1–2–3 trên desktop | artboard desktop chỉ có ba thẻ "BƯỚC n" | có thêm dải tóm tắt 1–2–3 (rộng 3 ô) | Bước 3 của phase yêu cầu "tóm tắt tiến trình 1–2–3 từ trạng thái UI hiện có" |
| Khu kiểm tra kho trên desktop | hai cột (kiểm tra kho / 5 đội gợi ý) | khu kiểm tra và kết quả xếp dọc, mỗi khu lưới riêng | Bố cục hai cột của artboard gắn với danh sách kết quả đã có; giữ thứ tự bước để không đổi luồng thao tác |
| Pill xanh | nền lục nhạt `#DDEFE4` | nền `--panel-3`, chữ `--good` | Cặp token `--good-bg`/`--good` chỉ đạt 4,47:1 (< 4,5); cặp đã dùng đạt 4,77:1 sáng / 7,70:1 tối |
| Nút ⋯ trên mobile | chữ "…" 44px | nút chữ "…" 44px + `aria-label="Tùy chọn tài khoản · <tài khoản>"` | Chữ "…" không đủ nghĩa cho trình đọc màn hình |
| Nút "Ra 5★" trong ô lượt | nút thường (chỉ nút đã ghi mới nền mực) | như artboard | Trước phase nút này là nút chính; đổi theo artboard, hành vi ghi không đổi |
| Khung chọn ảnh | cao 150px, viền nét đứt `#CFC5B1`, thumbnail 80px | `min-height: space.132` + padding, viền `--line`, thumbnail `space.88` | Không có token cho 150/80/`#CFC5B1`; dùng token gần nhất, ghi rõ trong `tokens.json` |
| Nút "Đọc Tướng/Chiến pháp/Đội đã xây dựng" | "Đọc ảnh" / "Đọc lại ảnh" | giữ nhãn cũ | Nhãn cũ nói rõ đang đọc loại nào; e2e đang bám nhãn này |
| Tiêu đề khối hằng ngày | "Danh tướng PK · Hằng ngày" | "Danh tướng PK - Hằng ngày" | Chuỗi này là dữ liệu view-model đã có test đơn vị và trùng tên gói trong store; giữ nguyên |
| Mốc "Hôm nay n/4" | "Hôm nay 3/4" | "Hôm nay n/4" (số lượt đồng bộ với dòng "Còn … lượt") | Giữ nguyên công thức đếm của store |
| Ô lượt đã ghi | hai nút vẫn bấm được | cả hai nút `disabled` sau khi ghi (focus rời nút) | Hành vi cũ trước phase; chỉ thêm `aria-pressed` để thấy nút nào đã ghi |
| Focus menu/chip | — | Escape trả focus về nút; bỏ chip thì focus sang chip kế tiếp (hết chip → ô nhập); thêm chip giữ focus ở nút "Thêm" | Giữ bài học P08: cập nhật tại chỗ, không gọi `.focus()` sau mỗi lần render |

## 4. Policy bản dịch (quy trình bước 2)

- Thêm **82 obligation `authored-vi`**: Chiêu mộ 24, Soi đội 26, Gợi ý đội 32 (đầu mục, thông báo, nhãn bước,
  nhãn nút, chuỗi rỗng/trạng thái, aria-label). Không cần receipt (lớp `authored-vi`).
  **Không dời, không đổi chữ `translate` nào** (35 obligation của 3 file vẫn nguyên văn, kể cả 4 binding
  `localizeWorkerError(data?.error, res.status)`, `describeAnalyzeError(e, ANALYZE_ACTION_ERROR)`,
  `describeAnalyzeError(err, ROSTER_PROVIDER_ERROR)`, `ROSTER_STATUS_LABELS[entry.status]`) ⇒ không cần receipt.
  `ui_source_locations` → 458/458 tìm thấy, 0 thiếu.
- `sourceFiles`: vẫn **53 file**, làm mới hash 5 file đã sửa (`js/recruit-tracker.js`, `js/analyze.js`,
  `js/roster-recommend-ui.js`, `js/app.js`, `js/site-nav.js`). `policyVersion`:
  `site-vi-260925-cung-ton-khai-hoang` → **`site-vi-260926-cong-cu-beta`**.
- `baseline.notes`: `concreteLocationCount` **56 571 → 56 653** (+82 = đúng số obligation mới),
  `concreteInventorySha256` `5135e32f…` → **`a85e2fd6e4c06397e3dd5d4fe2c4941a959265c651038038a6a2f555614a6a35`**;
  các số khác không đổi (`siteLedgerObligations` 2 088, `translationObligations` 5 591,
  `uiTranslateObligations` 68, blocks 1 967).
- Publish theo `docs/season-team-data.md`: `build --stage all` → `check --stage all --candidate` (exit 0) →
  `publish` → `check --stage public` (exit 0) → sửa `generationId` trong `pipeline/team-route-handles.json` rồi
  `--check` (1366 recommended / 166 legacy / 17 Khai hoang).
- `recommendedPin`: **`bacb5510…` (Phase 8) → final `362730e1068eaf15f50b80cc703b24b847515c168bc6a18d061639cc20ef7500`**
  (manifest `8c21bffd…`; các bước trung gian `f4f4b12a…`, `ac5d4974…`, `24855bdf…`, `3482aad3…` chỉ ghi là lịch sử và
  đã xoá — chỉ generation đang pin còn lại). Vòng sửa P09 làm lại quy trình 2b–2e sau khi sửa `js/recruit-tracker.js`
  và `js/roster-recommend-ui.js` (hash `sourceFiles` làm mới, publish lại, re-pin `team-route-handles.json`).
- `tests/test_site_localization.py`: **không phải sửa số ghim** (377 OK).

## 5. Test sửa/thêm có chủ đích + lý do

1. `tests-e2e/beta-tools.spec.mjs` (**mới, 5 ca**): (a) Chiêu mộ — đồng hồ pity đọc từ store với fixture
   `tqcclRecruitTracker` gồm 1 lần ra 5★ + 1 lượt ngày + gói hạn giờ **quá mốc 31/30** (mét `aria-valuenow`
   kẹp 30, `aria-valuetext` "31 / 30 lượt", chữ hiện số thật, cảnh báo quy tắc), lịch sử 5★, ghi một lượt mới →
   `aria-pressed` + `disabled` + store đúng 1 sự kiện + meter tăng; (b) Chiêu mộ mobile — nút ⋯
   (`aria-expanded`, Escape trả focus, focusout đóng, bề rộng lớn thì hàng thao tác hiện thẳng) + focus ô tướng
   khi mở form 5★; (c) Soi đội — các bước theo trạng thái, chọn ảnh PNG trong suốt, Worker **giả lập** trả tướng
   của một đội thật → kết quả có tên đội + số khớp, đo computed style hàng kết quả theo token, không còn emoji,
   bấm mở đội điều hướng thật; (d) Gợi ý đội — dải 1–2–3 đổi trạng thái theo xác nhận/gợi ý, danh sách đánh số
   liên tục 1..n, đo token hàng + pill; (e) Gợi ý đội mobile — nút "Sửa kho đã đọc" (ẩn/hiện + `aria-expanded` +
   giữ focus), bỏ chip chuyển focus sang chip kế tiếp, thêm chip giữ focus ở nút "Thêm" và xoá ô nhập.
2. `tests-e2e/season-lookup.spec.mjs` (**+2 ca**, dùng `controlledBundle` sẵn có của file): phạm vi mùa +
   chi tiết cấu hình trên hai trang công cụ đúng hình dạng Phase 8 (select ≥44px, radius 10px, panel
   `--radius-10`); link "Mở scan / nhập kho" → `/goi-y-doi/?scenario=scenario-a&ruleset=rules-a` và giữ phạm vi
   sau khi điều hướng. Hai khẳng định này **bổ sung**, không đổi assertion cũ nào.
3. `tests-js/recruit-tracker-ui.test.mjs` (**sửa có chủ đích**): thêm khẳng định cho các trường mới của view-model
   (`daily.pity` {value, limit, remaining, isOverLimit, percent}, `todayDone`, tổng hợp `pityText`, pity gói hạn
   giờ quá mốc 31/30 với phần trăm kẹp 100) — đây là hành vi mới của phase (đồng hồ pity), không phải đổi kỳ vọng cũ.
4. `tests-js/site-nav.test.mjs` (**sửa có chủ đích**): thêm ca cho `createDropdownMenu` dùng riêng (mở/đóng,
   Escape trả focus, không cướp focus khi đã đóng, bấm link trong menu, bấm ngoài, `focusout` khi
   `relatedTarget` null/trong/ngoài menu, và `shouldHidePanel=false` cho hàng thao tác hiện thẳng ở bề rộng lớn)
   — lý do: menu tài khoản của công cụ dùng lại chính hàm này.
5. `docs/design/so-binh-phap/tokens.json` (sửa có chủ đích): thêm 3 vai trò chữ + 10 component và probe của
   phase; cập nhật selector của `the`/`nut-phu`/`nut-chinh` cho khớp CSS mới.
6. `scripts/design-compare.mjs` (sửa có chủ đích): cặp Phase 9 đổi `ready` sang mốc nội dung thật, thêm 3 ảnh 320
   và 2 ảnh phạm vi mùa (không có artboard).
7. `tests-e2e/beta-tools.spec.mjs` (**+4 ca vòng sửa P09**): huỷ kết quả khi bỏ/thêm chip và khi đọc ảnh xong
   (kèm focus); nhập JSON cùng id đổi tên (tên/meter/count/form/Xuất đều theo dữ liệu mới, không tải lại);
   hàng kết quả có dữ liệu (thứ tự cột + `data-status` + màu pill thật + không tràn ngang) và ảnh chụp bằng chứng
   6 tổ hợp cho cả hai công cụ. Helper `seed()` đổi sang chỉ ghi khi khoá trống (lý do ghi ở §2b).
8. **Lỗi do e2e/công cụ đo bắt được trong phase này** (đã sửa, ghi lại để không lặp):
   `createSiteNav` gắn hai listener click lên nút menu (tự bật/tắt hai lần) — unit test giả DOM không bắt được vì
   harness ghi đè listener trùng loại, e2e bắt được; `replaceChildren(mảng)` biến phần tử thành chuỗi trong
   danh sách chip/lịch sử/tài khoản; `placeSeasonControls()` gọi lần hai trên trang không có `#season-controls`
   làm `main()` ném lỗi (ảnh chụp phát hiện dòng "Lỗi tải dữ liệu"); gán nhãn bước bằng node thay vì chuỗi
   (`[object HTMLSpanElement]`); nút ⋯/"Sửa kho đã đọc" bị `.rt-btn:not(.rt-primary)` thắng `display: none`.

## 6. Gate (bộ A2)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` | pass (exit 0) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass (exit 0) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **347/347 pass** |
| `npm run test:e2e` | **255/255 pass** |
| `python3 -m unittest discover -s tests` | **377 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 329 = ceiling 329) |
| `node scripts/design-compare.mjs --tokens --phase 09` (+`--theme dark`) | **686/688 · 0 lệch chưa giải thích** ở cả hai theme |
| `node scripts/design-compare.mjs --phase 09` (+`--theme dark`) | mỗi theme **6 ảnh ghép artboard + 3 ảnh 320 + 2 ảnh phạm vi mùa** ở `.cache/design-compare/phase-09{,-dark}/` |

Kiểm thêm trên Chromium thật: `/chieu-mo/` 320/390/1440 không còn dòng lỗi tải dữ liệu, 3 khối thẻ; thao tác
đọc/gỡ chip giữ focus; `state` của Turnstile/Worker và chốt `generation` không đổi (2 ca cũ của
`season-lookup` vẫn xanh: phản hồi muộn sau khi đổi Mùa không khôi phục xác nhận/kho, và
`config detail visibility follows history`).

## 7. Rủi ro còn lại / việc của phase sau

1. Trạng thái có kết quả của Soi đội/Gợi ý đội chỉ được kiểm bằng e2e với Worker/localStorage giả lập —
   `design-compare` không dựng được ảnh chụp có kết quả (đã ghi ở §3).
2. `hang-doi-tuong-tu` và trạng thái "có chip" của `chip-bo-tuong` không có probe (cần dữ liệu kết quả/kho);
   thay bằng khẳng định computed style trong `beta-tools`.
3. Dải bước 1–2–3 và khu kiểm tra kho xếp dọc trên desktop là quyết định trình bày (không theo bố cục hai cột
   của artboard) — Phase 10 nên rà lại nếu muốn bám artboard sát hơn.
4. Nợ tiếp tục: `--on-accent` trên `--accent` theme tối (3,33:1) ở `.badge.unit`/`.pre.sp`; 329 giá trị thô
   trong khối legacy (Phase 10 = 0).
5. `/chieu-mo/` không có `#season-controls` — nhánh `placeSeasonControls()` đã có guard, nhưng khi thêm trang
   mới vào `TOOL_SECTIONS` thì phải chắc công cụ đó có `.tool-head`.
6. **Nợ kế thừa, ghi nhận không sửa (theo Kongming P09):** lịch sử 5★ hiện `lượt 60/30` khi entry có `pityLimit`
   tuỳ biến — mẫu số `/30` in cứng từ trước Phase 9, không mở rộng sang store/schema trong phase này.
   Danh sách thiếu tướng/chiến pháp của engine ở dạng id canonical — cũng không sửa ở đây.
7. Ô chọn ảnh của thẻ "BƯỚC n" (Gợi ý đội) vẫn là `<input type="file">` gốc (đã áp token nhưng còn nhãn hệ thống);
   luồng hai bước "chọn tệp rồi bấm Đọc X" đang được e2e ghim nên giữ nguyên — Phase 10 cân nhắc đổi sang
   control phủ như ô nhập JSON của Chiêu mộ.

## 8. Gợi ý commit

```
feat(tools): rebuild the three Beta tools on the Recruit, Analyze and Roster artboards

- Chiêu mộ: page head, browser-storage notice, account bar with a mobile ⋯ menu reusing the
  shared dropdown behaviour (aria-expanded, Escape returns focus, outside/Tab closes), pity
  meter (role=meter) fed by getPity incl. over-limit with clamped aria-valuenow and the real
  "31 / 30" text, aria-pressed slot buttons, banner progress and the 5★ history list; rendering
  updates in place so keyboard focus survives
- Soi đội: page head, DashScope notice kept, upload frame + file row + status steps, results in
  "Đội đọc được"/"Đội có sẵn tương tự" showing only fields the mapper returns (team name and
  match counts; no invented score/season), emoji replaced by createElementNS SVG icons, shared
  portrait helper, Turnstile/generation guards untouched
- Gợi ý đội: page head, local-engine notice, 1–2–3 step summary derived from existing state,
  BƯỚC scan cards with counts and Xong/Chưa đọc pills, review panels whose chips update in place
  (remove moves focus to the next chip, add keeps focus on Thêm), mobile "Sửa kho đã đọc" toggle,
  numbered result lists with status pills
- season scope + config detail on both tool pages reuse the Phase 8 head/detail styles; the
  config-detail inventory link keeps scenario and ruleset
- legacy tool CSS deleted (ceiling 470 -> 329), 3 new type roles and 10 component entries with
  phase-9 probes; 82 authored-vi obligations added (no translate string moved) and the
  generation republished (bacb5510 -> 3482aad3), concrete locations 56571 -> 56653

Tests changed on purpose: recruit view-model pins the new pity fields; site-nav gains a case for
the shared dropdown menu used by the account menu; new beta-tools e2e (meter/steps/results/menus/
review toggles with fixtures); season-lookup gains the two tool-page scope/config-detail cases.
```

## Opus re-review round 2 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P9-B1** | Danh sách bước Soi đội hiện ✓ ở **cả ba** bước dù chưa làm gì: `step.mark.hidden` được gán lên chính **phần tử SVG** (thuộc tính chỉ có trên HTML), nên CSS `.ana-step-mark[hidden]` không bao giờ khớp (A4) | `js/analyze.js`: giữ tham chiếu `markWrap` (span bọc SVG) và `paint()` đặt `step.markWrap.hidden = !done` | e2e mới trong `tests-e2e/beta-tools.spec.mjs`: lúc mới vào, dấu của bước 1 và 3 (đang chờ) **ẩn**, dấu bước 2 hiện (Turnstile stub xác thực ngay); sau lượt chạy, bước 3 hiện ✓ còn bước 2 về `pending` và **mất dấu** (token dùng một lần). Đo trên trình duyệt: `hidden: true`, `display: none` cho cả ba bước lúc đầu; ảnh `steps-390-light.png` (không còn ✓ trên nhãn bước) |
| N9-1 | Hàng "Đội có sẵn tương tự" lặp tên đội (22 tên dùng chung cho 48/166 đội) | `similarTeamRow`: thêm nhãn nguồn `SOURCE_LABEL[team.source]` vào dòng số khớp | Hàng có dạng "3/3 tướng · 2 chiến pháp · Giới thiệu"; nguồn lấy từ `js/render.js` (một nguồn nhãn duy nhất) |
| N9-2 | Dải bước Gợi ý đội phân biệt done/chờ chỉ bằng màu + viền mảnh | Thêm dấu ✓ (vẽ bằng CSS `::before` để `textContent` không đổi) và `aria-current="step"` cho bước hiện tại | Đo: bước hiện tại có `aria-current="step"`; dấu ✓ chỉ ở bước `done`; test cũ `toHaveText("1 · Đọc kho")` vẫn xanh vì dấu không nằm trong text |
| N9-3 | Bật/tắt "Xem đội ngoài phạm vi" để lại thẻ rỗng chỉ có tiêu đề | Tách `applyResult(result, teams)` (dùng cho cả lượt chạy và khi đổi checkbox): có kết quả đã đọc thì vẽ lại, không thì dọn và ẩn thẻ | `state.result`/`state.teams` được giữ sau lượt chạy; không còn thẻ trống trong cả hai nhánh |
| N9-4 | "Phản hồi không hợp lệ, thử lại." hiện **hai lần** (thẻ kết quả + dòng trạng thái) | Bỏ đoạn trong thẻ đọc; chỉ dòng trạng thái hiện thông báo | `renderResults` trả `false` mà không ghi gì vào thẻ; nhánh lỗi chỉ `setStatus(...)` |
| N9-5, N8-1, N8-2 | Token Turnstile bị xóa khi đổi Mùa mà không `turnstile.reset` (có trước Phase 9); chip đang chọn ở theme tối dùng `--band` gần bằng nền trang; thứ tự chip kịch bản khác thứ tự ô Mùa | **Không sửa** — ngoài phạm vi vòng này | Ghi lại nguyên văn: N9-5 cần một kế hoạch riêng (đổi hành vi công cụ); N8-1 là quyết định bảng màu tối (`.fchip[aria-pressed=true]` dùng chung từ Phase 5, tương phản **chữ** vẫn đạt, chỉ phản hồi thị giác yếu: `--band #0F0E0B` trên nền `#16140F` ≈ 1,07:1 nên chip đang chọn trông như "lỗ"); N8-2 thuần thẩm mỹ |

### Gate (sau vòng sửa round 2)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` / `npm run build` / `npm run verify` | pass (0 error/warning; 1559 trang; gate bản dịch public 0 problem) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **349/349 pass** |
| `npm run test:e2e` | **276/276 pass** (khẳng định sai của vòng sửa — trạng thái dấu ✓ của bước 2 Soi đội — đã sửa trước lần chạy này) |
| `python3 -m unittest discover -s tests` | **379 OK** (chạy sau khi áp N-c: `test_hero_summaries` 11 OK, `test_site_localization` 10 OK) |
| `node scripts/design-tokens.mjs --check` | pass — legacy **0**, `font` shorthand + custom property ngoài khối token đều được soát (N4) |
| `design-compare --tokens` phase 03–10 × 2 theme | 03 **136/136**, 04 **720/720**, 05 **631/632**, 06 **400/400**, 07 **520/520**, 08 **589/590**, 09 (chỉ 2 ngoại lệ đã khai), 10 **295/295** — **0 lệch chưa giải thích** mọi phase × 2 theme |

Generation: `9e1a982a…` → `ac620801…` (sau lượt sửa 5/6/9/10) → **`27d82121c65bf5443fbe1a1745acab271e8d6f96b1747a83aefba6b282e31cac`** (sau lượt sửa
`js/roster-recommend-ui.js`), manifest `ef994027575931e2`; re-pin `pipeline/team-route-handles.json` + `team_route_handles --check` pass (1366/166/17). Policy:
`site-vi-260926-opus-round-2` → `site-vi-260926-opus-round-2b` (2 lượt làm mới hash `sourceFiles`); `baseline.notes` không đổi.

## Opus re-review round 3 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P9-R1** | Hồi quy do chính bản sửa N9-3: `clearResults()` **không** xóa `state.result`/`state.teams`, nên sau khi kết quả đã bị xóa (chọn ảnh khác, hoặc đổi Mùa) thì bật lại ô "Xem đội ngoài phạm vi" sẽ dựng lại tướng/hàng của ảnh cũ, và bước 3 hiện "Đã đọc xong" — vòng qua cả chốt phạm vi mùa | `clearResults()` thêm `state.result = null; state.teams = null;`; nhánh phản hồi không hợp lệ trong lượt chạy cũng xóa hai trường này trước khi báo lỗi | e2e mới trong `beta-tools.spec.mjs` (2 chuỗi: chạy → chọn ảnh khác → bật ô; chạy → đổi `#season-scenario` → bật ô): sau mỗi chuỗi `.ana-read .ana-hero` = **0**, `.ana-similar` ẩn, bước 3 `data-state=pending` và **không** có dấu ✓. Đo trực tiếp trước khi sửa: bật ô sau khi đổi Mùa trả lại 3 tướng + 4 hàng của lượt trước (đã xác nhận bằng ảnh) |
| Nit `/chieu-mo/` @320 | Nút ô "Không ra" xuống 2 dòng | **Không sửa** (thẩm mỹ, có trước vòng này) | Ghi nhận |

### Gate (sau vòng sửa round 3)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` / `npm run build` / `npm run verify` | pass (0 error/warning; 1559 trang; gate bản dịch public 0 problem) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **349/349 pass** |
| `npm run test:e2e` | **278/278 pass** |
| `python3 -m unittest discover -s tests` | **379 OK** |
| `node scripts/design-tokens.mjs --check` | pass — legacy 0 (đã phủ `font` shorthand + custom property ngoài khối token) |
| `design-compare --tokens --phase 07` | **526/526** · **526/526** (light · dark) — 0 lệch chưa giải thích |
| `design-compare --tokens --phase 09` | chỉ 2 ngoại lệ đã khai (`select-nhan-caps`, `tool-head` line-height) — 0 lệch chưa giải thích |
| `design-compare --tokens --phase 10` | **381/381** · **381/381** (light · dark) — 0 lệch chưa giải thích |

Generation: `27d82121…` → **`df725667d70890c15f1848c90346bb7d4db7107ab3eb57af09f76bd0732edc16`**, manifest `fbf26a73fa10bc01`;
policy `site-vi-260926-opus-round-2b` → **`site-vi-260926-opus-round-3`** (làm mới hash `js/analyze.js`); `team_route_handles --check` pass (1366/166/17);
generation trung gian `27d82121…` đã xóa (chỉ còn generation đang pin).
