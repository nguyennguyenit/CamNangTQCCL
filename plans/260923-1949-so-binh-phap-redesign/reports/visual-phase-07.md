# Phase 7 — Báo cáo: Tra cứu + hồ sơ

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-07](../phase-07-tra-cuu.md).
Phạm vi: dựng lại `/tra-cuu/` theo artboard `Lookup`/`LookupTactics`/`LookupProfile`/`LookupMobile` — lưới
tướng 6 cột (2 cột mobile), bảng chiến pháp, hộp thoại hồ sơ có khối **"Trong cẩm nang"**, ô chân dung dùng
chung (nâng https + fallback chữ Hán), nhãn trường tiếng Việt cho mọi khóa hiển thị (hết lỗi `bonusVi:`).
Chưa commit — orchestrator commit sau go/no-go.

> **Vòng sửa P07 (2026-09-25):** Kongming chấm **NO-GO** cho bản đầu (`agent://KongmingP07`). Kiến trúc số liệu
> lúc build và việc nạp lười generation Đội chuẩn được **giữ nguyên và chấp thuận**; 6 finding chặn + 2 việc bắt
> buộc đã sửa trong báo cáo này (§2b), kèm regression cho từng lỗi và ảnh chụp lại. Bảng dưới đây là số liệu của
> **bản đã sửa**; các kết luận bố cục cũ đã thay bằng quan sát mới (§4).

## 1. Spike bước 0 (bắt buộc) — kết quả: **TRƯỢT** ngân sách 2 s

Trang thử tạm `/tra-cuu/spike/` (Playwright, 390px, cache trống mỗi lần, CDP `Network.emulateNetworkConditions`
1,6 Mbps xuống + latency 150 ms, CPU ×4; đo `loadVerifiedRecommendedManifest` + `index.json` + `other-teams.json`
tải + hash + parse + đếm 1 tướng):

| Lần | manifest+index+other (ms) |
| --- | --- |
| 1 | 2049 |
| 2 | 2058 |
| 3 | 2082 |
| **Trung vị** | **2058 ms** |

Byte/compression (Resource Timing + header): `manifest.json` transfer 6 451 / encoded 6 151 / decoded 35 284 (gzip);
`index.json` 307 991 / 307 691 / 3 374 425 (gzip); `other-teams.json` 15 327 / 15 027 / 127 621 (gzip) —
tổng ~325 KB nén, riêng `index.json` ~307 KB nén. Phép đếm cho SP Lữ Mông ra 48 đội chuẩn / 7 đội khác > 0.

**Quyết định (Kongming P06b, uỷ quyền của người dùng — `agent://KongmingP06b.phase_7_decision`):** trung vị > 2 s
⇒ **dừng đường tính lúc chạy**, giữ nguyên ngân sách và không bỏ trường nào; chuyển sang **phương án đã được duyệt:
tính số liệu lúc build**, phát trong chính generation Recommended đang pin, cùng khóa nối chính xác theo từng
nguồn. Phase file đã ghi lại quyết định này (mục 4b + Verification).

### Số đo lại sau khi làm xong (cùng điều kiện, đường mở hồ sơ thật)

| Lần | `hero-summaries.json` + manifest (kể cả parse + dựng khối), ms |
| --- | --- |
| 1 | 990 |
| 2 | 1032 |
| 3 | 1029 |
| **Trung vị** | **1029 ms** |

(Số đo lại **sau vòng sửa P07**, khi số liệu đã đếm cả hai họ và xếp theo đúng thứ tự bản phát; bản trước sửa
là 1041 ms (lần đo lịch sử); không quy chênh lệch cho nguyên nhân cụ thể nào.)

Chỉ 2 request cho đường hồ sơ: `manifest.json` (transfer 6 570 / encoded 6 270) + `hero-summaries.json`
(15 327 / 15 027; raw 101 535 byte, gzip ~14,3 KB) ⇒ **~1,03 s < 2 s**, và **không còn request
`index.json`/`other-teams.json`** nào trên trang Tra cứu. Toàn màn hình hồ sơ dưới cùng throttle đo được
6 234 ms trung vị — phần lớn là dữ liệu khởi động sẵn có của mọi trang mục (2,1 MB `sourceHashes`, nợ đã ghi ở
finding #18, Phase 2 chỉ đo chứ không tối ưu), không thuộc ngân sách của khối này (Kongming yêu cầu tách bạch hai số: ngân sách 2 s chỉ áp cho đường số liệu,
**không** được nói "hồ sơ tải trong 1,03 s").

## 2. Việc đã làm (theo bước trong phase file)

| Bước | Nội dung | Trạng thái |
| --- | --- | --- |
| 0 | Spike + quyết định kiến trúc (trên) | xong — §1 |
| 1 | Đầu mục Tra cứu (kicker + h1 serif 48 + lead), ô tìm 56px desktop / 50px mobile, chip nhóm có số đếm, dòng "n tướng · bấm để mở hồ sơ" (`role="status"`) | xong — §3 |
| 2 | Lưới 6 cột desktop / 2 cột mobile; ô chân dung qua helper chung (`js/hero-portrait.js` + `entry()` manifest): `http:`→`https:`, `referrerpolicy=no-referrer`, `loading=lazy`, `decoding=async`, `alt` = tên; thiếu `iconUrl`/ảnh lỗi/ảnh treo → ô `--accent-soft` + chữ Hán (`--font-cjk`, `lang="zh-Hant"`, `aria-hidden`); `.lookup-card` giữ; bỏ mọi `innerHTML` trong vùng viết lại (chỉ `el()`/`textContent`, SVG qua `svgNode`) | xong — §3 |
| 3 | Bảng chiến pháp: cột Chiến pháp (tên + chữ Hán + mô tả 2 dòng), Phẩm, Loại, Hiệu quả, Mục tiêu, Tỷ lệ từ dữ liệu profile; trường thiếu → "—" | xong — §3 |
| 4 | Hộp thoại hồ sơ (`article[role=dialog]` + `.lookup-backdrop`): ảnh/fallback, eyebrow, tên serif 40 + tên Hán, badge (SP/phe/sao/Thống ngự/phẩm), bảng Vai trò · Danh hiệu độc quyền · Đặc tính, cột chỉ số có thanh + "+x / cấp", ô thích tính, thẻ chiến pháp bản thân/truyền thừa, dòng Nội chính; khóa focus, Escape, trả focus về thẻ/nút đã mở, **khóa cuộn nền** | xong — §3 |
| 4b | Khối **"Trong cẩm nang"** đọc `hero-summaries.json` (tính lúc build): số đội chuẩn/đội khác, đếm theo vị trí (Chủ tướng/Phó tướng 1/Phó tướng 2, gộp hai họ nên khớp tổng), top 3 chiến pháp + số đội, binh thư + hướng điểm kèm số đội, 3 đội tiêu biểu (tên + mùa + điểm + vị trí, link chi tiết kèm `from` = URL hồ sơ) và link "Tìm tướng này trong Đội chuẩn" → `/doi-chuan/?season=all&q=<tên>` (không ghi số n trên link) | xong — §3, §4 |
| 5 | Nhãn trường tiếng Việt cho mọi khóa hiển thị (kể cả 4 khóa `civil`: `bonusVi` → "Thưởng nội chính"…); khóa không nhãn bị bỏ + `console.warn` cho dev; enum `Loại` chiến pháp (`ACTIVE`/`COMMAND`/`PASSIVE`/`INTERNAL`/`FORMATION`/`TROOP`/`BURST`) đổi sang nhãn Việt, không bao giờ in enum thô | xong — §3, §5 |
| 6 | Cặp so ảnh Lookup, LookupTactics, LookupProfile, LookupMobile + ảnh soát nhất quán hồ sơ @390 (không có artboard) | xong — §7 |

### Kiến trúc số liệu lúc build (phương án được duyệt)

- `pipeline/hero_summaries.py`: khóa nối **chính xác theo từng nguồn** — Đội chuẩn `heroes[].nameRaw` ↔
  `chinese`/`aliases[]` (chỉ bỏ khoảng trắng), Đội khác `holders[].nameRaw` ↔ `hanViet` (bỏ khoảng trắng hai
  đầu); ô không khớp không tính, khóa khớp ≥ 2 ID bị bỏ + cảnh báo stderr (27 ô không khớp, 0 mơ hồ).
- Payload `hero-summaries.json` vào **chính generation Recommended** (`payloadHashes` của manifest), và
  descriptor thêm `heroSummaryCatalogHash` = hash kho Tra cứu ⇒ đổi kho Tra cứu là generation đổi, số liệu
  không thể cũ. Runtime chỉ nạp `manifest.json` + `hero-summaries.json` qua
  `loadVerifiedRecommendedManifest` (SHA-256 + số byte), promise giữ trong bộ nhớ và xóa khi lỗi;
  `js/hero-summaries.js` kiểm cấu trúc và **đối chiếu `provenance.catalogSha256` với hash kho Tra cứu đã xác
  minh trong `website-display.json`** trước khi render.
- Trang Tra cứu không còn nạp generation Đội chuẩn lúc boot (`js/app.js`: chuyển sang bộ nạp lười, trang
  danh sách vẫn nạp ngay, migrate URL cũ dùng bảng route handle đã phát sẵn thay vì `index.json`).

## 2b. Vòng sửa P07 (từng finding + bằng chứng)

| # | Lỗi Kongming | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| P07-1 | Bảng chiến pháp chỉ rộng 209px (1 cột của lưới 6 cột) và bị `overflow:hidden` cắt mất cột | `.lookup-grid` về `display:block`; lưới 6/2 cột chỉ áp cho `.lookup-grid-cards` (`.lookup-grid-cards`); bảng chiếm toàn chiều rộng; mobile (≤680) mỗi hàng thành khối, mỗi ô có `data-label` hiện qua `::before` để đủ cả sáu trường, không cần cuộn ngang | Khung bảng 1440: **>1300px**, 6 tiêu đề đều hiện và rộng >30px, 0 ô vượt khung (e2e); panel 390 = 356px; nhãn `::before` = Chiến pháp/Phẩm/Loại/Hiệu quả/Mục tiêu/Tỷ lệ ở cả 390 và 320 (e2e + ảnh `.cache/spike/t390.png`) |
| P07-2 | Cột facts trên mobile bị co về 0px, "Bạch y độ giang" xuống mỗi dòng một ký tự; đầu hồ sơ cao 940/1089px | `dl` facts chuyển sang 1 cột, mỗi `.lookup-fact` là lưới con `132px minmax(0,1fr)` (mobile: xếp dọc); đầu hồ sơ mobile còn 2 cột — hàng 1 ảnh + nút đóng, hàng 2 khối định danh **chiếm trọn chiều rộng**; tên hồ sơ mobile dùng `type.card-title` | Đo lại: facts rộng **338px** (390) / **268px** (320), giá trị rộng đầy cột, cao 20px một dòng; đầu hồ sơ **382px** (trước 940/1089); tiêu đề 1 dòng 112×23; ảnh crop `.cache/spike/p320-head.png` đã xem |
| P07-3 | Tab đang chọn của Tra cứu kế thừa nền `.fchip[aria-pressed=true]` (`--band`) còn chữ `--ink` → 1,012:1 | Tab Tra cứu ghi đè **cả nền lẫn viền** khi bật: `background-color: var(--bg)`, `border-color: transparent`, gạch chân `--accent`, chữ `--ink` | e2e đo tương phản computed ≥ 4,5:1 ở cả hai theme; probe `chip-loc` khóa thêm cặp `background-color: color.light.bg`; nhãn tab đo computed 14,83:1 (sáng) / 14,82:1 (tối), số đếm 5,92:1 / 7,04:1 |
| P07-4 | Thẻ chiến pháp in enum thô ("PASSIVE · Khống chế", "ACTIVE · Khống chế") | `lookup-detail.js` export `tacticTypeLabel` dùng chung cho bảng, thẻ chiến pháp và thẻ kết quả hỗn hợp; enum thô không nhãn bị bỏ + cảnh báo dev; thẻ kết quả hỗn hợp lấy nhóm từ chính mục (`item.group`) | e2e: `.lookup-relation-sub` = "Bị động · Khống chế" / "Chủ động · Khống chế", không khớp regex enum; kết quả tìm hỗn hợp không còn enum thô; unit test `tacticTypeLabel` |
| P07-5 | Refactor `pushField` biến `profile.fields.push(field(a), field(b))` thành biểu thức phẩy ⇒ mất trường (bậc đặc kỹ T0, phẩm trang bị); hồ sơ chiến pháp bỏ `type`/`effectTypeVi` mà không hiện chỗ khác | Tách thành từng câu `pushField` (đặc kỹ: mô tả/bậc/vị trí; trang bị: vị trí/phẩm chất) và chỉ bỏ "Phẩm chất" khỏi khối chung khi badge đầu hồ sơ đã hiện | e2e: hồ sơ Gian Hùng có "Bậc" + "T0"; Ỷ Thiên Kiếm có "Phẩm chất"; An Ủi Quân Dân có "Loại" + "Chỉ huy" + "Dạng hiệu ứng" + "Tăng ích" |
| P07-6 | (a) số liệu chiến pháp bỏ sót Đội khác; (b) thứ tự đội tiêu biểu lấy từ danh sách **chưa sắp**, không khớp bản phát | (a) đếm `holders[].tacticSlotsRaw` cùng chiến pháp Đội chuẩn, mỗi đội một lần; (b) số liệu dựng trong `_build_generation_locked` từ **chính `records` đã sắp theo `_rank`** (cùng thứ tự `index.json`) | SP Lữ Mông: chiến pháp **39/15/11** (khớp phép đếm độc lập của Kongming), đội tiêu biểu **s25 → s27 → s19**; `tests/test_hero_summaries.py` so **mọi trường hứa** (vị trí, chiến pháp, binh thư, hướng điểm, đội tiêu biểu kèm thứ tự) trên generation đang pin; e2e đếm cả hai họ và so cả thứ tự |
| P07-7 | Back đóng hồ sơ nhưng bỏ focus ở `BODY` | `render()` nhớ trạng thái "đang mở hồ sơ"; khi hộp thoại biến mất vì popstate thì trả focus về nút đã mở (hoặc ô tìm) | e2e: Back đóng hồ sơ + `activeElement` không phải `body`, Forward mở lại và vẫn giữ focus trong hộp thoại |
| P07-8 | Báo cáo ghi "đạt" cho bảng 6 cột/hồ sơ mobile/enum dù lỗi tái hiện được | Báo cáo viết lại theo quan sát sau sửa (§4), ghi rõ NO-GO, số liệu và generation mới | mục này + §1, §3, §4, §6, §7 |

## 3. Micro (tự động)

- `node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`, 0 mã màu / 0 giá trị thô
  ngoài khối legacy; **ceiling legacy 547 → 519** (515 giá trị thô còn lại sau khi xóa khối `.lookup-*` cũ +
  4 giá trị của rule mới) trên 242 selector.
- `node scripts/design-compare.mjs --tokens --phase 07` (light + dark): **344/344 thuộc tính khớp token ·
  0 lệch chưa giải thích** ở cả hai theme, gồm cả trạng thái **hộp thoại đang mở** (đầu hồ sơ, ảnh, tên,
  eyebrow, nút đóng, chỉ số, ô thích tính, thẻ chiến pháp, dòng nội chính, khối Trong cẩm nang, bảng chiến pháp)
  và 390 mobile. Probe mới: `o-chan-dung`, `ho-so-tuong`, `khoi-cam-nang` (phaseOwner 7) + host/probe
  `/tra-cuu/` cho `the`, `bang`, `chip-loc`, `o-tim`; `hop-thoai` (owner 7) được probe lần đầu.
- Token mới: `control.50` (ô tìm mobile), `space.132`/`space.164` (ô chân dung/hồ sơ), 5 vai trò chữ
  (`lookup-title` 40 serif, `lookup-zh` 20 cjk, `portrait-han` 64 cjk, `portrait-han-dialog` 84 cjk,
  `cam-nang-number` 34 serif) — đều ghi nguồn artboard.

### Tương phản (cặp token dùng thật, tính từ `tokens.json`)

| Cặp chữ | Sáng | Tối |
| --- | --- | --- |
| ô chân dung: mực son nhạt trên nền son nhạt (chữ Hán 64/84px) | 7.17:1 | 6.37:1 |
| thẻ kết quả: tên trên nền thẻ | 16.75:1 | 13.53:1 |
| dòng phụ thẻ: mực nhạt trên nền thẻ | 6.69:1 | 6.43:1 |
| số đội chuẩn: son trên nền thẻ | 7.05:1 | 5.04:1 |
| bảng chiến pháp: ô trên nền thẻ | 11.87:1 | 9.92:1 |
| đầu bảng: chữ trên nền giấy đậm | 9.52:1 | 8.88:1 |
| nhãn caps trong hồ sơ: mực nhạt trên nền khung | 5.92:1 | 7.04:1 |
| tên hồ sơ: mực trên nền giấy | 16.75:1 | 13.53:1 |
| phẩm chiến pháp: mực son nhạt trên nền son nhạt | 7.17:1 | 6.37:1 |
| nút tìm trong Đội chuẩn: son trên nền khung | 6.25:1 | 5.52:1 |
| tab nhóm đang chọn: nhãn trên nền tab (sau sửa P07-3, computed) | 14.83:1 | 14.82:1 |

Phase không thêm màu mới (chỉ dùng cặp token sẵn có); mọi cặp chữ mới đạt ngưỡng (chữ thường ≥ 4,5:1, chữ
≥ 24px ≥ 3:1). **Nợ kế thừa không sửa ở đây:** `--on-accent` trên `--accent` theme tối (3,33:1) vẫn còn ở
`.badge.unit`/`.pre.sp` (Phase 3/4/10) — phase này không dùng cặp đó cho chữ mới.

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
| --- | --- | --- | --- |
| Ô chân dung dự phòng | nền + chữ Hán tô theo phe (`#F3EAD3`/`#E4E8F4`/`#E0EFE6` + màu phe) | nền `--accent-soft` + chữ `--accent-ink` (7,17/6,37), phe hiện bằng chấm màu ở dòng phụ | Không có token sắc nhạt của phe (và bản tối không có trong bảng màu artboard), còn `--f-quan` trên `--accent-soft` chỉ **2,71:1** ở theme sáng (< 3:1 cho chữ 64/84px) |
| Lead đầu mục | "202 tướng, 406 chiến pháp…" (số động) | "Tướng, chiến pháp, trang bị, quân sư, cải tạo binh chủng và công trình — tìm bằng tên Việt, Hán-Việt hoặc chữ Hán." | Số đếm hiện thật ở chip nhóm; câu tĩnh không lệch khi dữ liệu đổi |
| Danh sách vị trí Trong cẩm nang | thanh riêng cho từng họ | một danh sách **gộp hai họ** (2 · 11 · 42 = 55 = 48 + 7) | Khớp đúng hai con số lớn cùng thẻ; payload vẫn giữ vị trí theo từng họ |
| Số "đội khác" | là link | chữ thường (không link) | `q` là tìm chuỗi rộng, kết quả không bằng n; chỉ link Đội chuẩn được phase chỉ định |
| Nút đóng hồ sơ | link ✕ 44px | `button` 44px có `aria-label="Đóng hồ sơ"` | Nút đóng hộp thoại phải là `button` (bàn phím) |
| Chữ trong ô chân dung khi CDN treo | — | chữ Hán nằm **dưới** ảnh, chỉ ẩn khi ảnh `load` xong | CDN treo (không lỗi, không xong) vẫn thấy ô chữ, không còn ô trống |
| Vài vai trò chữ dùng lại | 12/13/13,5/16/17px… | `type.*` gần nhất (lệch ≤ 1px hoặc ≤ 1 bậc weight) | Quy ước chung: dùng lại vai trò hiện có trước khi thêm token |
| Chip nhóm mobile | viên `13.5px/600`, số đếm mờ 0,8 | dùng vai trò mới `type.chip-pill` 13.5/1.2/600 (số đếm giữ `type.table-cell`) | Artboard không ghi line-height cho hàng chip; 1,2 là bề cao dòng cho phần tử một dòng |
| Số hàng chip nhóm ở 390/320 | 2 hàng (dữ liệu mẫu) | **3 hàng** (390) / **4 hàng** (320) | Nhãn + số đếm thật dài hơn dữ liệu mẫu ("Cải tạo binh chủng", 908 kết quả); vẫn là viên đầy, không cắt, không cuộn ngang |
| Badge đầu hồ sơ ở 320 | artboard chỉ có bản 1440 | 5 badge xuống **3 hàng** | Cùng bộ badge/độ cao 26px; đầu hồ sơ 417px < 520px (ngưỡng e2e) |
| Trạng thái mặc định `/tra-cuu/` | artboard mở sẵn "Tướng 202" | **908 kết quả hỗn hợp, không tab nào bật** | Giữ hành vi đã ghim bởi e2e Phase 2/7 (query không có `group` = tìm toàn corpus); đổi sẽ phá deep link và lịch sử — N5 của re-review Opus, ghi nhận chứ không sửa |

## 4. Bố cục (người duyệt)

Mỗi theme: **4 ảnh ghép cạnh artboard** (Lookup @1440, LookupTactics @1440, LookupProfile @1440,
LookupMobile @390) + **4 ảnh chụp trang thật** không có artboard (hồ sơ @390 và @320, bảng chiến pháp @390 và @320)
ở `.cache/design-compare/phase-07{,-dark}/` (không commit).

| Artboard | Trang thật | Đã xem | Kết luận |
| --- | --- | --- | --- |
| Lookup | `/tra-cuu/` @1440 | light | **đạt**: đầu mục kicker son + h1 serif + lead; ô tìm 56px có kính lúp; dải chip gạch chân có số đếm (Tướng 202, Chiến pháp 406…); lưới **6 cột** đúng artboard; thẻ có huy hiệu SP góc phải, tên 15/600 và dòng phe + vai trò; "Xem thêm" + "Mỗi lượt hiện 60 kết quả" |
| Lookup | `/tra-cuu/` @1440 | light (đối chiếu chéo) | Ô chân dung: CDN của môi trường này không tải được ảnh nên mọi thẻ hiện ô chữ Hán — đúng thiết kế fallback; chữ Hán nằm **dưới** ảnh nên ảnh treo cũng không còn ô trống |
| LookupTactics | `/tra-cuu/?group=tactics` @1440 | light | **đã sửa**: panel bảng chiếm **toàn chiều rộng** (>1300px), không còn bị `overflow:hidden` cắt; sáu cột hiện đủ với đúng dữ liệu ("Chỉ huy"/"Chủ động", "Tăng ích"/"Trị liệu", "Nhóm quân ta, 2 người", "100%") — khớp artboard; bề rộng cột **60/120/230/200/80** đúng artboard, đầu bảng một dòng, tỷ lệ đã bỏ số thập phân dài và giá trị vô lý ("—") |
| LookupTactics | `/tra-cuu/?group=tactics` @390 và @320 | light | **đã sửa**: mỗi hàng thành khối, nhãn cột viết hoa (Chiến pháp · Phẩm · Loại · Hiệu quả · Mục tiêu · Tỷ lệ) nằm trên từng giá trị, không cần cuộn ngang, không cột nào bị cắt (ảnh `.cache/spike/t390.png` đã xem) |
| LookupProfile | `/tra-cuu/?group=heroes&id=hero:sp-lu-mong` @1440 | light | **đạt**: hộp thoại 960px nền giấy, đầu hồ sơ 132×164 + tên serif 40 + tên Hán 20 + badge viên 26px **SP** (nền dải) · **Ngô** (viền + chấm phe) · **5 sao** · **Thống ngự 7** · **Quân sự** (nền giấy đậm); ô thích tính bậc **S** tô nền son nhạt + chữ son đậm, bảng Vai trò · Danh hiệu độc quyền · Đặc tính; hai cột chỉ số/thích tính và thẻ chiến pháp; khối **Trong cẩm nang** 3 thẻ (48 đội chuẩn / 7 đội khác · thanh vị trí; top 3 chiến pháp 39/15/11; đội tiêu biểu 113 điểm) |
| LookupMobile | `/tra-cuu/` @390 | light | **đạt**: lưới **2 cột**, ô tìm 50px, chip nhóm là **viên đầy** (đang chọn nền dải) cách ô tìm **16px**, không cuộn ngang (`scrollWidth == innerWidth`) |
| — (không có artboard) | hồ sơ @390 và @320 | light (crop 320 đã xem) | **đã sửa**: hàng 1 là ảnh 88×96 + nút đóng, khối định danh/facts **chiếm trọn chiều rộng** bên dưới; facts xếp dọc một dòng mỗi cặp (338/268px), đầu hồ sơ 382px (trước 940/1089px), tên hồ sơ một dòng; ảnh crop `.cache/spike/p320-head.png` |

Ảnh ghép theme tối đã tạo cùng bộ 4 ảnh ghép artboard + 4 ảnh trang thật (`.cache/design-compare/phase-07-dark/`) — dùng để soát nhất quán,
không phải pass/fail pixel (plan.md quyết định #15).

## 5. Policy bản dịch (quy trình bước 2)

- Thêm **57 obligation `authored-vi`**: 53 cho `js/unified-lookup.js` (đầu mục, ô tìm, dòng trạng thái, nhãn
  bảng chiến pháp, hộp thoại, khối Trong cẩm nang, nhãn vị trí) và 4 cho `js/lookup-detail.js` (nhãn Nội chính).
  Không cần receipt (lớp `authored-vi`). Không dời/đổi chữ `translate` nào ⇒ không cần receipt độc lập.
- `sourceFiles`: 51 → **53 file** (thêm `js/hero-portrait.js`, `js/hero-summaries.js`; làm mới hash các file
  đã sửa). `policyVersion`: `site-vi-260925-chi-tiet-doi` → **`site-vi-260925-tra-cuu`**.
- `baseline.notes`: `concreteLocationCount` **56 457 → 56 514** (+57 = đúng số obligation mới),
  `concreteInventorySha256` `8b720096…` → **`8d00467b…`**; các số khác không đổi
  (`siteLedgerObligations` 2 088, `translationObligations` 5 591, `uiTranslateObligations` 68, blocks 1 967).
- Publish theo `docs/season-team-data.md`: `build --stage all` → `check --stage all --candidate` (exit 0) →
  `publish` → `check --stage public` (exit 0) → `python3 -m pipeline.team_route_handles --write` bị từ chối
  đúng thiết kế (URL đóng băng không được gán lại) nên **chỉ sửa trường `generationId`** trong
  `pipeline/team-route-handles.json` rồi `--check` (1366 recommended / 166 legacy / 17 Khai hoang).
- `generationId`: `2c803111…` (Phase 6) → các generation trung gian `e2051efb…`, `19688be7…`, `64d29b48…`,
  `9c787ab3…`, `de90abad…` → **final `9e9136f359abce6d36cafcf1c70484c96b463af3e76cf0a30632836a7fbd2e1f`** (bản đã sửa P07-1…P07-7)
  (các generation trung gian và generation của spike đã xóa; chỉ generation đang pin còn lại).
- `tests/test_site_localization.py`: **không phải sửa số ghim** (377 OK toàn bộ).

## 6. Test sửa/thêm có chủ đích + lý do

1. `pipeline/hero_summaries.py` + `tests/test_hero_summaries.py` (**mới, 9 ca**): khóa nối (bỏ khoảng trắng,
   mơ hồ, không khớp, tách không gian tên Việt/Hán), đếm một lần mỗi đội, xếp đội tiêu biểu theo điểm rồi thứ tự
   nguồn, thiếu tướng thì vắng mặt, và **so chéo với phép đếm độc lập trên generation đang pin**.
2. `tests-js/unified-lookup.test.mjs` — thêm 6 ca cho hàm thuần mới (`lookupCardView`, `tacticTableRow`
   gồm ô thiếu → "—", nhãn Nội chính không lộ khóa thô + cảnh báo dev, `camNangView` gộp vị trí/trần 3 mục,
   `portraitUrl`/`portraitChar` nâng https + từ chối scheme lạ, `parseHeroSummaries` từ chối payload sai
   cấu trúc hoặc lệch kho Tra cứu).
3. `tests-e2e/unified-lookup.spec.mjs` — **thêm 12 ca** (spec 44 ca, cả suite 235/235): 4 ca đầu của phase và 8 ca
   của vòng sửa P07 (bảng toàn chiều rộng + đủ 6 cột ở desktop; bảng xếp dọc kèm nhãn cột ở 390 và 320; đầu hồ sơ
   và facts đọc được ở 390/320 × 2 theme; tương phản tab đang chọn ở 2 theme; không enum thô ở thẻ chiến pháp và
   kết quả hỗn hợp; giữ đủ trường bậc/phẩm/loại/dạng hiệu ứng; Back trả focus). Trong đó 6 ca gốc của phase: ảnh https + `no-referrer` +
   `lazy` + fallback chữ Hán; **chặn mọi host chân dung lấy từ `heroes-dict.json`** (cuộn hết lưới để ảnh lazy
   được yêu cầu) → mọi thẻ hiện chữ Hán, 0 ảnh vỡ; `index.json`/`other-teams.json` không được tải khi chưa mở
   hồ sơ và chỉ `manifest.json` + `hero-summaries.json` khi mở; số liệu SP Lữ Mông khớp phép đếm độc lập trong
   test; đội tiêu biểu → chi tiết → "Quay lại" về đúng hồ sơ; link "Tìm tướng này trong Đội chuẩn" giữ
   `season=all&q`. **Sửa các ca cũ theo cấu trúc mới**: nhóm Chiến pháp giờ là bảng (không còn thẻ), dòng trạng
   thái mới (`n tướng · bấm để mở hồ sơ`), vùng rỗng dùng `.lookup-feedback`, mở hồ sơ bằng `[data-lookup-id]`,
   tên Hán trong hộp thoại và chữ Hán dự phòng trong ô chân dung là chữ dữ liệu có chủ đích nên phép kiểm
   "không chữ Hán" chỉ áp cho phần còn lại (tên thẻ so qua `.lookup-card-name`).
4. `tests-e2e/spa-parity.spec.mjs` — ca "synthetic HTTPS…": dữ liệu vẫn còn URL `http://` (đặc tính di sản)
   nhưng **không `img` nào giữ `http://`** sau render, mọi request ảnh ngoài vẫn https.
5. Fixture generation nhỏ thêm `hero-summaries.json` (4 file test JS + 2 file Python) vì inventory của
   generation nay **bắt buộc** có file số liệu; `scripts/verify-astro-dist.mjs` và
   `src/lib/recommended-reference-artifacts.ts` cũng bắt buộc file này.
6. `scripts/design-compare.mjs` — cặp phase 7 đổi sang `ready` thật (`.lookup-card`, `.lookup-table tbody tr`,
   `.cam-nang-grid`) và hồ sơ dùng ID thật `hero:sp-lu-mong` (trước là `hero:1` không tồn tại), thêm ảnh
   soát nhất quán hồ sơ @390.

## 7. Gate (bộ A2)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` | pass (exit 0) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass (exit 0) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **344/344 pass** |
| `npm run test:e2e` | **235/235 pass** |
| `python3 -m unittest discover -s tests` | **377 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 519 = ceiling 519) |
| `node scripts/design-compare.mjs --tokens --phase 07` (+`--theme dark`) | **344/344 thuộc tính khớp token · 0 lệch chưa giải thích** ở cả hai theme |
| `node scripts/design-compare.mjs --phase 07` (+`--theme dark`) | mỗi theme **4 ảnh ghép artboard + 4 ảnh trang thật** ở `.cache/design-compare/phase-07{,-dark}/` (không commit) |

Kiểm thêm trên Chromium thật (390/1440, light/dark): 0 lỗi console/pageerror trên `/tra-cuu/` và hồ sơ sâu;
`scrollWidth == innerWidth`; Escape đóng hộp thoại và trả focus; cuộn nền khoá khi mở (`overflow: hidden`) và
mở lại sau khi đóng; không phần tử nào lộ khóa thô.

## 8. Rủi ro còn lại / việc của phase sau

1. **Ảnh CDN không tải được trong môi trường đo** (không có mạng ngoài) nên ảnh ghép cho thấy toàn ô chữ Hán;
   hành vi ảnh thật chỉ được xác nhận bằng thuộc tính (`https`, `no-referrer`, `loading`, `decoding`, `alt`) và
   bằng ca chặn mọi host chân dung. Kongming cũng chưa xác lập được CDN ngoài thật sự trả ảnh.
2. Toàn màn hình hồ sơ dưới throttle vẫn ~6,2 s vì dữ liệu khởi động chung (`sourceHashes` ~2,1 MB) — nợ
   Phase 2 (finding #18), không phải ngân sách của khối "Trong cẩm nang" (1,04 s).
3. `space.132`/`space.164`/`control.50` là chiều cao/kích thước artboard; Phase 9 (Soi đội) dùng lại
   `js/hero-portrait.js` — nếu cần kích thước khác thì thêm token, không viết px thẳng.
4. Nợ tương phản `--on-accent` trên `--accent` theme tối (3,33:1) vẫn ở `.badge.unit`/`.pre.sp` (Phase 10).
5. Phase 9 phải tự kiểm lại 2 nhóm catalog còn ít dữ liệu (Cải tạo binh chủng 16, Công trình 41) khi dựng thẻ.

## 9. Gợi ý commit

```
feat(lookup): rebuild Tra cứu and the hero profile on the Lookup artboards

- add js/hero-portrait.js: one portrait renderer for lookup, profile and team scan;
  upgrade http portraits to https, keep referrerpolicy=no-referrer/lazy/async and paint the
  Han character under the image so a hanging CDN never leaves an empty box
- rebuild /tra-cuu/ (kicker + serif title, 56/50px search, counted group tabs, 6/2-column hero
  grid, tactics table with Han name and clamped effect)
- rebuild the profile dialog (portrait, eyebrow, serif + Han name, badges, role/title/traits
  facts, stat bars with per-level growth, aptitude boxes, tactic cards, civil row) and lock
  background scroll while it is open
- compute the "Trong cẩm nang" numbers at build time inside the pinned Recommended generation
  (pipeline/hero_summaries.py, exact per-source joins, catalog hash in the descriptor) because the
  measured spike was 2058 ms > 2 s; profiles now load manifest + hero-summaries only (1029 ms)
  and /tra-cuu/ no longer fetches index.json/other-teams.json before a profile opens
- label every displayed field in Vietnamese (civil keys and tactic type enums included) and omit
  unknown keys with a dev warning instead of printing raw keys
- declare 57 authored-vi obligations, refresh the localization policy (56514 locations) and
  re-pin route handles; drop the superseded legacy lookup CSS (ceiling 547 -> 519)
```

## 10. Vòng sửa Opus (re-review độc lập, 2026-09-26)

Rà soát độc lập tại HEAD `b89b1ad` (`agent://OpusRevD`) kết luận Phase 7 **NO-GO** với 5 finding chặn (P07-D1…D5)
và 8 nit. Vòng này xử lý **hết** P07-D1…D5 + N1…N6; N7/N8 là dữ liệu thượng nguồn nên chỉ ghi nhận (bảng dưới).

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P07-D1** | Ô `bond` (duyên phận) bị đếm là "Chiến pháp hay mang" và `statFocusKind=note` (lưu ý) là "Hướng điểm hay dùng" (5 ô bond, 11 tướng note) | `pipeline/hero_summaries.py`: `_tactic_slots()` chỉ nhận ô kind `tactic`, `_stat_focus()` bỏ `kind=note` (thiếu cột ⇒ mặc định `tactic`/`stat`); phép đếm độc lập trong `tests/test_hero_summaries.py` và e2e áp cùng quy tắc | Unit `SlotKindTest` **đỏ trước khi sửa** (`['Chiến pháp Thật', 'Kết Nghĩa Vườn Đào'] != ['Chiến pháp Thật']`), xanh sau + ca cũ (thiếu cột kind) giữ nguyên cách đếm cũ. Generation mới `9e1a982a…`: SP Tào Tháo `[Nhạn Hành Trận 2, Tử Sĩ Tiên Phong 2, Cương Nhu Kết Hợp 1]` (**không còn** Kết Nghĩa Vườn Đào), SP Đổng Trác không còn bond, SP Quan Vũ `statFocus.teams` **43 → 39** và không còn "Khiên bậc S", SP Lữ Mông **không đổi** 48/7 + 39/15/11 |
| **P07-D2** | "Tỷ lệ kích hoạt" in `55.00000000000001%` (9 chiến pháp) và `5000%` (`activationRate 50`) | `js/lookup-detail.js`: `ratePercentText()` → `Number((rate * 100).toFixed(1)) + "%"`; ngoài [0, 1] hoặc không hữu hạn → `—` + `console.warn` dev | Unit **đỏ trước khi sửa** (`actual: '55.00000000000001%'`, `expected: '55%'`), xanh sau (0.55 → "55%", 0.375 → "37.5%", 50 / −1 → "—"); e2e: mọi ô `.lookup-table tbody .lookup-table-rate` khớp `/^(—|\d+(\.\d)?%)$/`, 0 chuỗi `\d\.\d{6,}`, `tactic:thien-uy-khieu-tran` hiện "—" ở bảng và hồ sơ |
| **P07-D3** | Hồ sơ công trình in `Đá: null` (30 cấp × 5 công trình) và `?? key` in khóa thô | `js/unified-lookup.js`: `costText()` bỏ ô rỗng, bỏ khóa không nhãn (cảnh báo dev), hết ô thì bỏ hẳn phần chi phí | Unit `costText` (bỏ `null`/`undefined`/rỗng, `0` vẫn hiện, khóa lạ bị bỏ + warn); e2e: `building:thai-thach-xu` cấp 1 = "Cấp 1 · **Sắt: 180, Gỗ: 180** · 1 phút…" (không có Đá), `building:quan-xa` cấp 1 không có phần chi phí; 0 `null`, 0 khóa `wood|stone|iron|food` trong hộp thoại |
| **P07-D4** | Cột giữa bị bóp: đo được th **859/62/68/83/79/191**, đầu bảng 2 dòng, hàng trung vị 102px | `table-layout: fixed` + token `size.col-60/120/230/200/80` (nguồn artboard LookupTactics) cho `thead th:nth-child(2..6)`; `white-space: nowrap` cho đầu bảng | e2e 1440 và 1024: th = **60/120/230/200/80** (±2px), **mỗi th một hộp dòng**, 0 ô tràn khung; hàng trung vị **95px**; `design-compare --tokens --phase 07` vẫn 0 lệch |
| **P07-D5a** | Ô thích tính bậc S không được tô (artboard #F6E1DC / #A8202A) | `dataset.grade` trên ô + CSS `.lookup-aptitude[data-grade="S"]` dùng `--accent-soft`/`--accent-ink` | e2e hai theme: ô S = `--accent-soft` + chữ `--accent-ink` (7,17 / 6,37:1), ô B/C giữ `--panel-3`/`--ink-2`; probe mới trong `ho-so-tuong` |
| **P07-D5b** | Badge đầu hồ sơ: "SP" viên đỏ 21×28 chữ lệch trên, "5 sao"/"Thống ngự 7" trong suốt, thiếu "Quân sự"; phẩm của hộp thoại chiến pháp trong suốt | Badge viên 26px: `.badge-band` (nền dải) cho nhãn biến thể, `.badge-fill` (panel-2/ink-2) cho sao · thống ngự · hạng mục, `type.badge-chip`; `.lookup-dialog-badges{align-items:center}`; phẩm nhóm khác dùng viên `.lookup-quality` | e2e hai theme: đúng 5 badge theo thứ tự **SP · Ngô · 5 sao · Thống ngự 7 · Quân sự**, SP = `--band`/`--band-ink`, ba badge sau = `--panel-2`/`--ink-2` cao **26px**, 0 badge trong suốt; hộp thoại chiến pháp: viên phẩm = `--accent-soft`/`--accent-ink` |
| **P07-D5c** | Chip nhóm mobile là tab gạch chân, xuống 3 hàng, cách ô tìm 4px | Viên đầy ≤680px theo `LookupMobile.dc.html`: `min-height: control.44` (artboard 40px, hợp đồng §11.4 áp 44px — xem vòng round 2), radius 999, chưa chọn `panel-3`/`line`, đang chọn `band`/`band-ink` (kể cả số đếm), cách ô tìm `space.16` | e2e 390: radius **999px**, đang chọn = `--band`/`--band-ink`, chưa chọn = `--panel-3`, cao ≥ 40px, khoảng cách **16px**; desktop: radius **0** (tab gạch chân), khoảng cách **24px** |
| N1 | Ô tìm → hàng chip chỉ 4px | `margin: var(--space-24) 0` desktop, `margin-top: var(--space-16)` mobile | Đo trên DOM: 24px (1440) / 16px (390) — artboard (`main` gap 24px desktop, 16px mobile) chứ không phải 30px như ước lượng trong review |
| N2 | Dòng phụ thẻ tướng thiếu "Thống ngự N" | `lookupCardView`: thêm `Thống ngự <cost>` sau phe | Unit: `meta` = `["Ngô", "Thống ngự 7", "Khống chế / Kiêm nhiệm"]`; e2e: thẻ SP Lữ Mông chứa "Thống ngự 7" |
| N3 | Nhãn "Danh hiệu độc quyền" xuống 2 dòng ở 1440 | Cột nhãn dùng token `size.fact-label` = **156px** (= bề rộng đo được 153px của nhãn dài nhất ở `type.body` + 3px dư; artboard dùng `auto`) | e2e: nhãn "Danh hiệu độc quyền" **1 hộp dòng** ở 1440 |
| N4 | Chỉ số mobile: "+1.96 / cấp" nằm riêng một dòng trong cột nhãn | Lưới mobile 2 hàng: hàng 1 nhãn + giá trị, hàng 2 thanh + tăng trưởng | e2e 390: tăng trưởng nằm **cạnh mép thanh** (left ≥ bar.right − 1), cùng hàng (|Δtop| ≤ 8px), thanh > ½ chiều rộng hàng; hàng chỉ số cao **46px** |
| N5 | Trạng thái mặc định 908 kết quả hỗn hợp, không tab nào bật | **giữ** — hành vi đã ghim bởi e2e Phase 2/7 (query không `group` = tìm toàn corpus) | Ghi vào bảng "Lệch có chủ đích" ở §4 |
| N6 | Nhãn "SP" nằm trên đỉnh hộp 28px | Cùng P07-D5b: badge viên 26px dùng `.badge` (`display: inline-flex; align-items: center`) | e2e: badge "SP" cao 26px, chữ căn giữa theo hộp |
| N7 | `tactic:thien-uy-khieu-tran` có `activationRate 50` (dữ liệu nguồn sai) | **không sửa dữ liệu** trong phase redesign; P07-D2 hiện "—" | `data/tactics.json` vẫn `50`; sửa ở lần đổi dữ liệu riêng |
| N8 | Chuỗi biên tập/nguồn lọt ra UI: `[Hiệu chỉnh OCR] …` (1 tướng, 3 chiến pháp), `Sự kiện liên động … (Bahamut bsn=36815)` (8 chiến pháp) | **không sửa** — là nội dung dữ liệu, không phải lỗi giao diện | Ghi nhận; dọn ở pipeline dữ liệu |

> **Cách kiểm ở vòng này:** ảnh ghép được tạo lại sau khi sửa (8 ảnh mỗi theme, `.cache/design-compare/phase-07{,-dark}/`).
> Các dòng §4 sửa ở trên dựa trên **phép đo DOM** ở 1440/390/320 × 2 theme (giá trị `getComputedStyle`, bề rộng cột,
> hộp dòng của text node, khoảng cách hình học) — người thực thi **không** duyệt lại ảnh bằng mắt trong vòng này, nên
> không có khẳng định nào chỉ dựa vào ảnh.

### Gate sau vòng sửa

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` / `npm run build` / `npm run verify` | pass (0 error/warning; 1559 trang; gate bản dịch public 0 problem) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **349/349 pass** |
| `npm run test:e2e` | **271/271 pass** |
| `python3 -m unittest discover -s tests` | **379 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy **0** = ceiling 0) |
| `design-compare --tokens --phase 07` (+dark) | **516/516** · **516/516**, 0 lệch chưa giải thích |
| `design-compare --phase 07` (+dark) | 8 ảnh ghép mỗi theme ở `.cache/design-compare/phase-07{,-dark}/` |

Generation: `d008d8be…` → **`9e1a982a16f5cd9a628ef0b891c8ac0666bbad252a4bdad6b8c380cbd1b103e9`** (re-pin
`pipeline/team-route-handles.json`, `team_route_handles --check` pass: 1366 / 166 / 17). Policy:
`site-vi-260926-toi-a11y-docs` → **`site-vi-260926-opus-recheck`** (làm mới 5 hash `sourceFiles`);
`baseline.notes` không đổi (`concreteLocationCount` 56 653, `concreteInventorySha256` `a85e2fd6…` — cột chữ đổi
không tính vào inventory, chỉ 5 hash file đổi). Obligation sửa chữ: `ui:section-page/doi-chuan` (meta description,
lớp `authored-vi`), `ui:lookup/badge-cost` (biểu thức nay là template literal) — không cần receipt độc lập.
Generation trung gian: chỉ một generation sinh trong vòng này (`9e1a982a…`) và nó đang được pin.

## 11. Opus re-review round 2 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P07-R1** (= P10-B1) | Chip nhóm mobile do chính vòng D5c tạo ra chỉ cao **40px** và chữ dính mép trên (kế thừa `align-items: baseline` của chip desktop) — sai A5 và hợp đồng §11.4 (40 → 44) | Khối ≤680: `.lookup-chip { align-items: center; min-height: var(--control-44) }`; probe `chip-loc` ở 390 đổi sang `control.44`; ghi lệch artboard 40 → hợp đồng 44 vào §4 | e2e (390/320 × 2 theme): 6/6 chip cao ≥ 44, khe chữ trên/dưới lệch ≤ 1px; đo trực tiếp: 44px, khe trên = khe dưới = 13px; ảnh `chip-390-light.png`, `chip-320-dark.png` (đã xem bằng mắt); `design-compare --tokens --phase 07` = **520/520**, 0 lệch |
| **P07-R2** | Link đội tiêu biểu trong "Trong cẩm nang" chỉ cao **21px** ở mobile (link khối đứng riêng, không thuộc ngoại lệ inline) — khẳng định "không còn target dưới 44px" ở bản D5 là **sai**, xin đính chính | Link trải khắp hàng: `.cam-nang-team { position: relative }` + `.cam-nang-team-name::after { inset: 0 }` (hàng chỉ có một phần tử tương tác) + vòng focus trên cả hàng | e2e mới (390/320): mỗi hàng cao **64–65px**, `document.elementFromPoint` ở vùng ô điểm trả về chính `a.cam-nang-team-name`; bấm vào vùng điểm điều hướng tới trang đội và `from` vẫn mở lại hồ sơ. Đo trực tiếp: `same: true` cho cả 3 hàng |
| N-a | Đầu bảng "Tỷ lệ" lấy cỡ chữ của ô (14px) thay vì 11px caps | Tách rule: `th.lookup-table-rate` chỉ còn `text-align`/`nowrap`; cỡ chữ ô chuyển sang `td.lookup-table-rate` | Đầu bảng nay đúng `type.table-head` như 5 cột còn lại |
| N-b | Cột thứ hai của lưới chỉ số mobile là `auto` nên mỗi hàng một khổ thanh (254–261px) | Đổi sang `minmax(0, 1fr) var(--space-88)` (token sẵn có) ⇒ mọi thanh cùng thang | Ảnh hồ sơ 390: các thanh thẳng nhau |
| N-c | `hero_summaries` lấy `*Vi` của Đội chuẩn nhưng lại lùi về `*Raw` (và ngược lại cho Đội khác) — nguy cơ lọt chữ Hán vào UI | `_tactic_slots(holder, name_field)` / `_stat_focus(holder, name_field)`: Đội chuẩn chỉ đọc `tacticSlotsVi`/`statFocusVi`, Đội khác chỉ đọc `tacticSlotsRaw`/`statFocusRaw` | Payload dựng lại **trùng byte** với bản đã phát (`rebuilt == published`: True) ⇒ không cần publish lại; `tests.test_hero_summaries` 11 OK |
| N-d | `console.warn` về tỷ lệ 50 chạy ở production | **Giữ** theo quy ước sẵn có của file (cảnh báo dev cho dữ liệu sai) cho tới khi sửa dữ liệu (N7) | Ghi nhận |
| N-e | Dòng phụ thẻ tướng dính chữ ("Thục Thống ngự 6 Chiến") | Thêm dấu `·` giữa các mảnh: `.lookup-card-meta > * + *::before { content: "·" }` (artboard đọc "Ngô · Thống ngự 7") | Dòng phụ nay đọc "Ngô · Thống ngự 7 · Khống chế / Kiêm nhiệm"; `textContent` của từng mảnh không đổi nên unit test cũ giữ nguyên |
| N-f | Lớp phủ 821–1279 rộng hết màn hình | **Không sửa** (tuỳ chọn) — vẫn dùng được, không tràn | Ghi nhận |

## Vòng nit (2026-09-26) — N-f, N7, N8

| # | Nội dung | Kết luận vòng này | Bằng chứng |
| --- | --- | --- | --- |
| N-f | Lớp phủ 821–1279 rộng hết màn hình. | **Đã sửa** — `@media (max-width: 1279px) { .lookup-backdrop { padding-inline: var(--space-40) } }`: hộp thoại 960px luôn chừa lề hai bên, chỉ co thật dưới 1040px. Khối ≤680 giữ padding riêng và đứng sau nên thắng ở mobile. | `design-compare --tokens --phase 07` **531/531** cả hai theme |
| N7 | `activationRate: 50` của `tactic:thien-uy-khieu-tran` (thượng nguồn SGSDeck ghi sai đơn vị; mọi chiến pháp khác dùng phân số 0–1). | **Đã sửa tại bước nhận giá trị** trong `pipeline/build_unified_lookup.py` (Kongming phán quyết: **không** sửa `data/sgsdeck/**`, vì fingerprint đầu vào bản dịch chứa cả object `attributes` — sẽ làm 3 mục ledger đã review thành `stale` và đòi receipt độc lập). Bảng `SOURCE_VALUE_CORRECTIONS` hardcode có lý do + hàm tra thuần, lỗi khi giá trị thô đổi / owner lệch / entry thừa; ledger thêm disposition `corrected-public` (`sourceValueHash` = 50 gốc, `localValueHash` = 0.5); validator chiến pháp từ chối `activationRate` ngoài [0,1]. | Candidate dựng lại → validate → promote: `data/tactics.json` **chỉ** đổi 50 → 0.5 ở đúng bản ghi đó; `heroes-dict`/`lookup-catalog` không đổi byte; generation Lookup `lookup:582ec0b0…` → **`lookup:064fd2d5…`**. UI: hồ sơ + bảng hiện **50%** (trước `—`). **Căn cứ:** byte `activationRate\":50` trong `pipeline/sgsdeck-cache/tactics-list.html`; quy ước đơn vị (163 chiến pháp ACTIVE trải 0,2–1, trong đó 30 giá trị đúng bằng 0,5). Đọc 50 là 50% là **suy luận** độ tin cậy cao, không có nguồn trong game độc lập; build **cố ý đỏ** nếu thượng nguồn đổi giá trị thô. Không dùng `effectText` làm căn cứ (chuỗi "32%→50%" ở đó là xác suất tăng số lần đánh thường — đính chính của Kongming). |
| N8 | Chuỗi biên tập/nguồn gốc lọt ra UI: `[Hiệu chỉnh OCR] …` (3 chuỗi) và `(Bahamut bsn=36815)` (8 chiến pháp). | **bsn: đã sửa ở lớp hiển thị** — `js/lookup-detail.js` thêm `acquisitionDisplayText()` xoá đúng hậu tố ` (Bahamut bsn=<số>)` ở **cuối** chuỗi và không bao giờ trả chuỗi rỗng; `field.value` vẫn là mảng gốc nên dữ liệu + ledger đã review + `data/sgsdeck` giữ nguyên nguồn gốc; không thêm `title`/nhãn mới (sẽ là chữ UI mới). **`[Hiệu chỉnh OCR]`: chấp nhận, giữ nguyên từng byte** — là bản dịch trung thành của cảnh báo độ tin cậy `【OCR校正】` của nguồn, ẩn đi sẽ khiến văn bản chưa kiểm chứng trông như đã xác thực, còn đổi chữ thì cần receipt độc lập (quyết định #7); chuyển cho vòng review bản dịch sau. | `pipeline/lookup-translations.json` và `data/sgsdeck/**` **không đổi byte** (`git diff` rỗng). Node unit test cho `acquisitionDisplayText` (hậu tố ở cuối, chuỗi không có hậu tố, hậu tố ở giữa, chuỗi chỉ có mã), test dữ liệu (mọi tactic trong `data/tactics.json` không còn `bsn=`) và e2e `tactic:kien-cuong-chi-hoa` ("Cách nhận" có tên sự kiện, không có `bsn=`). |

## 12. Opus re-review round 3 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P07-R3** | Nút tên chiến pháp trong bảng Tra cứu chỉ cao **21px** ở mobile (60 nút/trang ở 390 và 320, cả 2 theme). Hàng ở mobile là `display:block` và nút là control duy nhất của hàng ⇒ không có ngoại lệ inline, cũng không có control tương đương ≥ 44px. Các lượt sweep trước chỉ đo nhóm mặc định (Tướng) nên bỏ sót. | Khối ≤680: `.lookup-table-name { display: inline-flex; align-items: center; min-height: var(--control-44) }` (cùng kiểu với `.lookup-relation-name` của Phase 10); probe `bang` thêm ca mobile `/tra-cuu/?group=tactics` (`min-height: control.44`, `bang.phaseUsed` bổ sung 10) | e2e mới trong `a11y-targets.spec.mjs` (320/390 × 2 theme): **mọi** `.lookup-table-name` ≥ 44×44, Enter mở đúng hồ sơ (`?id=tactic…`, hộp thoại chứa đúng tên), không cuộn ngang; `design-compare --tokens --phase 07` = **526/526** và `--phase 10` = **381/381** (đo lại sau lượt này) |
| Đính chính A5 | Các khẳng định trước đây trong §3/§10/§11 ("hộp thoại không còn target dưới 44px", "không còn control đứng riêng dưới 44px") là **sai** cho bảng chiến pháp mobile. | Nay đúng: chip nhóm 44px (R1), hàng đội tiêu biểu là cả hàng ≥ 44px (R2), nút tên chiến pháp 44px (R3), link nguồn 44px (P10-B2) | Sweep 320/390 × 2 theme trên `/tra-cuu/`, `/tra-cuu/?group=tactics`, `/doi-chuan/`, `/doi-khac/`: chỉ còn ngoại lệ "control tương đương" đã khai (link tiêu đề thẻ đội) |

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

## Audit 260926 — sửa theo ảnh ghép

Nguồn phát hiện: `agent://AuditLookup` (L*, M*, T*, P*). Chỉ xử lý mục **new**; mục accepted (L5–L7, M5, M6, P5) giữ nguyên.

| Id | Trạng thái | Chi tiết |
| --- | --- | --- |
| L1 | đã sửa | `.lookup-search { margin-top: var(--space-24) }` — kẻ đầu mục cách ô tìm 24px (DOM 1440: `.lookup-head` đáy 273 → ô tìm 297; artboard 273 → 298). |
| M3 | đã sửa | ≤680: `.lookup-head { padding-bottom: 0; border-bottom: 0 }` (LookupMobile không có kẻ) + ô tìm `margin-top: var(--space-16)` (gap main mobile). DOM 390: border 0px, khối đầu → ô tìm 16px. |
| L2 | đã sửa | Vai trò tách khỏi `.lookup-card-meta` thành `<span class="lookup-card-role">` dòng riêng (`lookupCardView` đánh dấu mảnh `kind: "role"`; `meta` vẫn đủ 3 mảnh nên unit test cũ giữ); dấu `·` gắn `::after` cho **mọi** mảnh không cuối của meta (trước chỉ mảnh phe) ⇒ thẻ chiến pháp/trang bị cũng có dấu đều. Câu N-e ở §10 ("`.lookup-card-meta > * + *::before`", "Ngô · Thống ngự 7 · Khống chế / Kiêm nhiệm") nay đã lỗi thời: dòng phụ đọc "Ngô · Thống ngự 7", vai trò ở dòng dưới như artboard. |
| L3 | giữ | Chip "Trang bị" 204 = `catalog.equipment` 114 + `catalog.specials` 90: nhóm `equipment` của Tra cứu gộp cả bảo vật đặc biệt để mục nào cũng tìm được qua một chip; tách chip mới là đổi phân nhóm (thêm nhãn cần review dịch) chứ không phải sửa thị giác. Số artboard 114 là số riêng của equipment — ghi "Lệch có chủ đích". |
| L4 | đã sửa | `.lookup-grid { margin-top: var(--space-24) }` (desktop; artboard `main` gap 24) — mobile `var(--space-16)` theo LookupMobile. |
| M1 | đã sửa | ≤680: `.lookup-card-portrait { height: var(--space-96) }`, chữ Hán `font: var(--type-portrait-han-mobile)` (token mới 48px/600), `.lookup-grid-cards { gap: var(--space-10) }`. DOM 390: ô 96px, chữ 48px, gap 10px. |
| M2 | giữ (D1) | Lead/placeholder rút gọn của LookupMobile không áp — quy tắc "không ẩn nội dung trên mobile". Lệch có chủ đích. |
| M4 | đã sửa một phần / giữ (D1) | Không bỏ "· bấm để mở hồ sơ" và "Thứ tự theo nguồn" (D1). ≤680 `.lookup-status-row` `flex-wrap: wrap; row-gap: var(--space-4)`, `.lookup-order { white-space: nowrap }`: vừa một dòng thì một dòng (390 nhóm hỗn hợp), không vừa thì ghi chú xuống dòng **nguyên khối** thay vì cả hai mảnh cùng gãy 2 dòng (390 Chiến pháp, 320). |
| T1 | đã sửa | `.lookup-table thead th { box-sizing: content-box }` — artboard khai báo `width` trên ô content-box nên bề rộng cột thật = width + padding (84/144/254/224/116); cột Tỷ lệ lề phải `var(--space-18)` như artboard (mobile đặt lại 0). DOM 1440: ranh cột 575/659/803/1057/1281 (artboard ≈570/654/798/1052/1276, trước sửa 686/746/866/1096). |
| T2 | đã sửa | Bỏ override `-webkit-line-clamp: 3` ở ≤680 ⇒ mô tả chiến pháp 2 dòng như desktop/artboard (DOM 390: cao 39px = 2 × 19,5). |
| P1 | đã sửa | Thang thanh chỉ số = **120** (`STAT_BAR_MAX` trong `js/unified-lookup.js`): artboard vẽ 81→68%, 89→74%, 91→76%, 37→31% đúng bằng giá trị/120. Dữ liệu thật (`data/heroes-dict.json`, 188 tướng có số): đa số ≤100 nhưng có ngoại lệ (Vũ lực tới 248,96; Thống soái 165,6; Tốc độ 143,09; Trí lực 155) — phần vượt 120 khoá đầy thanh, con số vẫn in đúng. DOM: 81→68%, 89→74%, 91→76%, 37→31% khớp artboard. |
| P2 | đã sửa | `camNangView` xếp vị trí theo số đội **giảm dần** (hoà giữ thứ tự Chủ tướng → Phó 1 → Phó 2). DOM SP Lữ Mông: Phó tướng 2 42 → Phó tướng 1 11 → Chủ tướng 2. |
| P3 | giữ | Tiêu đề thẻ 3 "Đội tiêu biểu" (khối gộp mọi mùa, mùa hiện ở từng hàng); tên thẻ theo một mùa của artboard sẽ sai khi đội đến từ nhiều mùa. Lệch có chủ đích. |
| P4 | đã sửa | `.lookup-backdrop` padding-top `calc(var(--control-72) + var(--space-40))` (desktop; hộp thoại ở y=112 như artboard, nav không bị che); ≤820 `calc(var(--control-44) + var(--space-16) + var(--space-40))`; ≤680 `calc(var(--control-44) + var(--space-16) + var(--space-8))` (DOM 390: header 60, hộp thoại y=68). |

**Chữ:** không đổi chuỗi UI nào (không động vào `UI_LITERAL_OBLIGATIONS`).

**Token/component:** token mới `type.portrait-han-mobile` (48px/1/600 cjk, nguồn LookupMobile) + `--type-portrait-han-mobile` trong `:root`; component `o-chan-dung`: probe "ô chân dung mobile" đổi `space.132` → `space.96`, thêm probe chữ Hán thẻ mobile `type.portrait-han-mobile`, `artboard` ghi thêm LookupMobile.

**Test đổi theo hành vi:** `tests-js/unified-lookup.test.mjs` (thứ tự/percent vị trí giảm dần), `tests-e2e/unified-lookup.spec.mjs` (so hàng vị trí theo thứ tự giảm dần của phép đếm độc lập, kèm nhãn).

**Kiểm:** ảnh ghép `.cache/design-compare/phase-07{,-dark}/*.png` (xem Lookup, LookupTactics, LookupMobile, LookupProfile dark); `--tokens --phase 7` **517/517 · 517/517** (light · dark; lần chạy cuối sau khi slice Landing gỡ probe `.landing-preview-card .badge.faction` — trước đó light 538/538); unit `tests-js/unified-lookup.test.mjs` 47/47.
