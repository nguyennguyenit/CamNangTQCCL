# Phase 8 — Báo cáo: Cùng Tồn + Khai hoang

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-08](../phase-08-cung-ton-khai-hoang.md).
Phạm vi: `/cung-ton/` có hàng chọn **kịch bản** rồi hàng chọn **nhóm 1–5** của kịch bản đó và ô tổng quan
nguồn của nhóm đang xem; `/khai-hoang/` có thẻ đội Trước → Sau dùng lại khối build Phase 6, thanh điểm
6 mốc, lưới Chạm Sứ và bảng quân thủ các mỏ (thẻ trên mobile). Chưa commit — orchestrator commit sau go/no-go.

## 1. Việc đã làm theo bước trong phase file

| Bước | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Cùng Tồn: hàng chọn kịch bản (`labelVi` từ `season-registry.json`, `aria-pressed`) → hàng chọn nhóm 1–5 của kịch bản đó (`groupLabel`, nhận diện theo `recordId`, legacy dùng số thứ tự 1-based), phân loại giữ nguyên ba mục cũ (`Áp dụng theo phiên bản luật` / `Tham khảo kịch bản` / `Chưa xác định kịch bản — tham khảo`), tiêu đề khối nhóm ghi `nhãn nhóm · kịch bản`; nhóm đang chọn nằm ở query `group=<recordId>` (`replaceState`), `group` không hợp lệ sau đổi phạm vi → về nhóm đầu + bỏ khỏi URL | xong — §2, §3 |
| 2 | Ô tổng quan: `summaryRaw` ("Tổng quan"), `openingSuggestionsRaw` ("Gợi ý khai hoang"), `notesRaw` ("Ghi chú"), dòng phân loại (`scope-note`), link "Nguồn Cùng Tồn" (`rel="noopener noreferrer"`) và `disclaimerRaw` ("Lưu ý nguồn") đều hiện **nguyên văn** qua `el()`/text (`white-space: pre-line`, CRLF chuẩn hoá) — không `innerHTML`, không tách câu; trường rỗng không dựng ô; nhánh legacy dùng cùng khung với các trường nó có; số liệu `5 đội · 15 tướng · không trùng` **tính** từ mảng 3 tướng mỗi đội | xong — §2, §5 |
| 2b | Phạm vi mùa + chi tiết cấu hình trên `/cung-ton/` (Phase 2 giữ hành vi, **không có artboard**): select Mùa 44px + nhãn caps theo StyleGuide đặt trong đầu mục; select Phiên bản luật vẫn ẩn theo thiết kế Phase 2; `#season-config-detail` chỉ áp token panel/thẻ, không trau chuốt lại bố cục | xong — §2 (probe `select-nhan-caps`), §5 |
| 3 | Khai hoang — thẻ: bọc `khaihoangBuildContent` (Trước → Sau, chiến pháp chữ son, ghi chú build) **không fork markup**; chip chọn cấu hình 44px (`aria-pressed`); thanh điểm 6 mốc đọc `guide.ratings` (chỉ vẽ khi có `ratings`, cột Tổng màu mực); dòng cuối thẻ là link `Hướng dẫn đánh đất →` (đội không có guide: `Chi tiết →`) giữ `variant` | xong — §2, §5, §6 |
| 4 | Khai hoang — khối khác: lọc loại binh (chip đếm theo dữ liệu), anchor 3 khối trên đầu trang, lưới Chạm Sứ, bảng quân thủ mỏ (mobile: thẻ từng mỏ) | xong — §2, §3 |
| 5 | Thuật ngữ: khối Khai hoang dùng "Chạm Sứ"; 5 tên "…cảm tử" không đổi | xong |
| 6 | 57 obligation `authored-vi` mới; không dời/đổi chuỗi `translate` nào → không cần receipt | xong — §4 |
| 7 | Cặp so ảnh Coexist, CoexistMobile, Khaihoang, KhaihoangMobile + 3 ảnh soát nhất quán (320 cả hai trang, chi tiết Khai hoang @390) | xong — §3 |

## 2. Vi mô (tự động)

- `node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`, 0 mã màu / 0 giá trị thô
  ngoài khối legacy; **ceiling legacy 519 → 470** (470 giá trị thô trên 215 selector sau khi xoá 44 rule
  Cùng Tồn/Khai hoang cũ đã được thay).
- `node scripts/design-compare.mjs --tokens --phase 08` (light + dark): **541/542 thuộc tính khớp token ·
  0 lệch chưa giải thích** ở cả hai theme, gồm trạng thái **chip đang chọn**, **ô tổng quan**, **thanh điểm
  có dữ liệu**, **chip cấu hình đang chọn**, **bảng quân thủ mỏ**, và 390/320 mobile.
  Ngoại lệ duy nhất (khai báo sẵn, không phải của phase): `select-nhan-caps line-height = normal` — form
  control của Chrome bỏ qua `line-height` của token, chiều cao đã khoá bằng `control.44`.
- Token mới: 2 vai trò chữ (`coexist-count` 30/1.1/700 serif, `card-title-sm` 17/1.2/700 serif — đều ghi
  nguồn artboard) và màu `color.light.transparent` (`rgba(0, 0, 0, 0)`, nguồn: `border-color` của tab
  Tra cứu đang chọn) dùng cho probe Phase 7 đã khai mà chưa từng chạy.
- **Vòng sửa P08 (2026-09-25):** Kongming chấm **NO-GO** cho bản đầu (`'/Users/plateau/.omp/agent/sessions/-Project-CamNangTQCCL/2026-09-24T22-09-56-961Z_01a0d577-dae1-736c-8498-7e6dfd3aabd6/KongmingP08.md'`) vì **P08-1**:
  kích hoạt hàng chọn kịch bản/nhóm làm mất focus bàn phím (về `BODY`). Đã sửa bằng cách **giữ nguyên nút vừa
  kích hoạt trong DOM**: chỉ hàng nhóm được dựng lại khi đổi kịch bản, `aria-pressed` cập nhật tại chỗ, không
  gọi `.focus()` (nên tải trang và đổi Mùa không cướp focus của điều khiển đang dùng). Kèm P08-2 (giữ nguyên
  chuỗi thô sau khi chuẩn hoá CRLF, chỉ trim để biết ô rỗng; giữ kiểm tra an toàn tiếng Việt), P08-3 (xoá
  `coexistCountsLine` không có nơi dùng và các test chỉ kiểm câu chữ của nó) và P08-4 (sửa số generation trong
  báo cáo). Chi tiết + bằng chứng ở §2b; số liệu dưới đây là của **bản đã sửa**.
- 5 component mới trong danh mục (`chon-nhom`, `o-tong-quan-cung-ton`, `the-cung-ton`, `the-khai-hoang`,
  `luoi-cham-su`, 30 probe) + `thanh-diem` đặc tả lại theo thanh điểm của thẻ + 2 probe bảng mỏ cho `bang`;
  `the` bỏ `.mine`/`.coexist-group` khỏi danh sách thẻ nền.
- Sửa 3 probe cũ đo sai trạng thái (đã ghi lý do ở §5): `chip-loc` "chip nhóm đang chọn" trỏ `/tra-cuu/`
  nơi không chip nào bật (đúng phải là `?group=heroes`) và khai `border-color: transparent` không phải token;
  `bang` "đầu bảng chiến pháp" đo nền trên `th` trong khi nền nằm trên `thead tr`; probe chip kịch bản Cùng
  Tồn tách thành chưa chọn / đang chọn.

### Tương phản (cặp token dùng thật, tính từ `tokens.json`)

| Cặp chữ thật | Sáng | Tối |
| --- | --- | --- |
| dòng số liệu · không trùng (`--good`) | 5.19:1 | 8.60:1 |
| dòng số liệu · có trùng (`--avoid`) | 6.18:1 | 7.18:1 |
| văn bản nguồn nguyên văn (`--ink-2` trên nền thẻ) | 11.87:1 | 9.92:1 |
| nhãn cột caps / dòng binh thư / ghi chú thang điểm (`--muted`) | 6.69:1 / 6.69:1 / 6.14:1 | 6.43:1 / 6.43:1 / 5.75:1 |
| link "Nguồn Cùng Tồn" (`--accent`) | 7.05:1 | 5.04:1 |
| tên nhóm / tên đội / tiêu đề khối (`--ink` trên nền trang) | 14.83:1 | 14.82:1 |
| dòng phân loại phạm vi (`--muted` trên nền trang) | 5.92:1 | 7.04:1 |
| chip kịch bản chưa chọn (`--ink` trên `--panel-3`) | 15.38:1 | 12.11:1 |
| chip đang chọn (`--band-ink` trên `--band`) | 15.01:1 | 15.54:1 |
| tóm tắt nhóm trên chip đang chọn (`--nav-idle` trên `--band`) | 10.26:1 | 11.40:1 |
| chiến pháp Cùng Tồn / Chạm Sứ (`--accent-ink`) | 8.79:1 | 7.18:1 |
| lưu ý nguồn Khai hoang (`--ink-2` trên `--panel-2`) | 9.52:1 | 8.88:1 |
| đầu bảng quân thủ (`--muted` trên `--panel-2`) | 5.36:1 | 5.75:1 |

Phase không thêm màu mới cho chữ (chỉ `transparent` cho viền); mọi cặp chữ mới đạt ngưỡng (chữ thường
≥ 4,5:1, chữ ≥ 24px ≥ 3:1). Nợ kế thừa `--on-accent` trên `--accent` theme tối (3,33:1) vẫn ở
`.badge.unit`/`.pre.sp` (Phase 3/4/10) — phase này không dùng cặp đó cho chữ mới.

## 2b. Vòng sửa P08 (từng finding + bằng chứng)

| # | Lỗi Kongming | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| P08-1 (chặn) | Kích hoạt selector Cùng Tồn (Enter/Space) xong focus về `BODY`, Tab quay lại nút đầu hàng | `js/team-filter-section.js`: tách `paint()` thành `paintScenarioRow` / `paintGroupRow` / `paintGroupView`; nút đang có giữ trong `scenarioNodes`/`groupNodes` theo nhận diện, `activate()` chỉ dựng lại hàng nhóm khi **đổi kịch bản** rồi `syncPressed()` tại chỗ — không `replaceChildren` hàng chứa nút vừa bấm, không `.focus()` | e2e mới `coexist selectors keep keyboard focus and continuation after Enter/Space` ở **1440 và 320**: kịch bản thứ 2 bằng Enter → `aria-pressed=true` **và** `toBeFocused()`, Tab sang hàng nhóm, Shift+Tab về đúng nút; nhóm thứ 3 bằng Space → đang chọn **và** giữ focus, `?group=` đúng khóa, Tab sang nhóm kế tiếp rồi Shift+Tab về đúng nhóm; đổi Mùa → focus vẫn ở `#season-scenario`, hàng kịch bản ẩn (chỉ còn 1 kịch bản) và Tab đi tiếp vào hàng nhóm |
| P08-2 | Claim "nguyên văn" quá mạnh: `summaryRaw` của `coexist-bdx-group-f2abf392d119` mất khoảng trắng cuối vì `publicText` trim | `sourceFieldText()`: chuẩn hoá CRLF rồi **giữ nguyên chuỗi**, chỉ `trim()` để quyết định ô rỗng; vẫn chặn chuỗi còn chữ Hán | e2e `coexist overview …` chọn đúng **nhóm chạm biên khoảng trắng** (`summaryRaw !== summaryRaw.trim()`) và khẳng định `raws[0] === payload.summaryRaw` **kèm** `raws[0].trim() !== raws[0]` |
| P08-3 | `coexistCountsLine` không có nơi dùng ⇒ test chỉ kiểm câu chữ của hàm chết | Xoá hàm; renderer dựng dòng tại chỗ (một nguồn duy nhất); bỏ 2 khẳng định câu chữ trong `tests-js/coexist-counts.test.mjs`, giữ `coexistCounts` + bất biến dữ liệu thật; obligation `ui:coexist/counts-*` đổi `ownerSymbol` sang `seasonCoexistGroup` và text về đúng chuỗi trong renderer | e2e khẳng định **đúng dòng hiện trên trang** theo phép đếm độc lập; `grep coexistCountsLine` = 0 |
| P08-4 | Báo cáo/commit ghi `6fc0b011` là bản trước (đó là generation site-localization) | Ghi đúng bước chuyển **recommendedPin `9e9136f3` (c11b58a) → `bacb5510` (bản đã sửa P08)**, generation trung gian chỉ ghi là lịch sử | §4 |
| P08 (ghi nhận) | Bảng mỏ mobile dùng dòng chữ xếp dọc thay vì pill màu từng địch | Giữ nguyên, **ghi nhận là đơn giản hoá trình bày**, không gọi là khớp artboard từng phần tử | §3 |
| P08 (ghi nhận) | Nợ kế thừa: hành động nguồn trên trang chi tiết bị cắt ở 320px (x=-65.8) và `#section-coexist a` thắng rule nút | Không phải hồi quy của Phase 8 (tái hiện y hệt với CSS `c11b58a`); ghi vào §7 kèm gợi ý `:where(#section-coexist) a` | §7 |

## 3. Bố cục (người duyệt)

Mỗi theme: **4 ảnh ghép cạnh artboard** (Coexist @1440, CoexistMobile @390, Khaihoang @1440,
KhaihoangMobile @390) + **3 ảnh chụp trang thật** không có artboard (`/cung-ton/` và `/khai-hoang/` @320,
chi tiết Khai hoang @390 để soát lại bề mặt Phase 6 sau khi đổi CSS dùng chung) ở
`.cache/design-compare/phase-08{,-dark}/` (không commit).

| Artboard | Trang thật | Đã xem | Kết luận |
| --- | --- | --- | --- |
| Coexist | `/cung-ton/` @1440 | light | **đạt**: đầu mục kicker son + h1 serif 48 + lead, select Mùa 44px bên phải; hàng chọn nhóm 5 ô chia đều, ô đang chọn nền mực chữ giấy + dòng tóm tắt đội của nguồn; ô tổng quan 3 cột (Tổng quan + Ghi chú / Gợi ý khai hoang / Kiểm tra trùng tướng + lưu ý nguồn + link nguồn) với dòng serif "5 đội · 15 tướng · không trùng" màu lục; 5 thẻ đội 3 cột, dòng tướng có tên + thích tính bên phải, chiến pháp chữ son, dòng "Binh thư · …" |
| Coexist | `/cung-ton/` @320 và @390 | light + dark | **đạt**: hàng kịch bản và hàng nhóm xếp dọc toàn chiều rộng, ô tổng quan 1 cột, thẻ đội 1 cột, không cuộn ngang (`scrollWidth == innerWidth`), chip đang chọn và dòng số liệu đọc rõ ở cả hai theme |
| CoexistMobile | `/cung-ton/` @390 và @320 | light + dark | **đạt** (ảnh ghép): kicker + h1 serif + lead, chọn nhóm 1–5, ô tổng quan, thẻ đội xếp dọc — đúng thứ tự artboard |
| Khaihoang | `/khai-hoang/` @1440 | light | **đạt**: đầu mục + lead; ô "Lưu ý nguồn · Binh Diễn Xuân Thu." nền giấy đậm; 3 nút nhảy khối kèm số đếm (17 / 8 / 5); chip lọc loại binh đếm đúng dữ liệu (Tất cả 17 · Cung 10 · Thương 4 · Kỵ 2 · Khiên 1); 2 cột thẻ: badge loại binh + tên serif 19, chip cấu hình (Mặc định đang chọn), dòng Trước → Sau, thanh điểm 6 mốc, chân thẻ "Hướng dẫn đánh đất →"; Chạm Sứ 4 cột; bảng quân thủ mỏ có đầu bảng caps và ô tên mỏ serif |
| Khaihoang | `/khai-hoang/` @320 và @390 | light + dark | **đạt**: 1 cột thẻ, thanh điểm 3 cột như artboard mobile, **thẻ từng mỏ** thay bảng, `scrollWidth == innerWidth`; chụp riêng một thẻ đã xem ở 320 (giá trị "8,5" và "7,9" đúng dấu phẩy, thanh Tổng màu mực) |
| KhaihoangMobile | `/khai-hoang/` @390 | light | **đạt** (ảnh ghép): thứ tự đầu mục → anchor → lọc → thẻ → Chạm Sứ → quân thủ mỏ; một mỏ một thẻ |
| — (không có artboard) | `/cung-ton/` và `/khai-hoang/` @320 | light | **đạt**: không phần tử nào tràn khung, chip vẫn ≥ 44px |
| — (không có artboard) | chi tiết Khai hoang @390 | light + dark | **giữ nguyên như Phase 6**: khối build, hướng dẫn đánh đất, select cấu hình và nút nguồn không đổi sau khi CSS dùng chung được dọn (`kh-detail-build`, `kh-guide*`, `kh-variant-*` vẫn nằm trong khối legacy và không bị phase này sửa) |

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
| --- | --- | --- | --- |
| Pill "Tham khảo kịch bản" cạnh Mùa | có | không có; phân loại hiện ở tiêu đề khối nhóm + dòng `scope-note` và ở tiêu đề phân loại của hàng chọn nhóm | Cùng một thông tin, tránh lặp ba chỗ; contract bắt buộc dòng `scope-note` trong khối nhóm (bước 2) |
| Hàng chọn kịch bản | không vẽ | có (2 chip: `labelVi` của `season-registry.json`) | Dữ liệu thật có 10 nhóm, hai bộ đều đặt nhãn "Cùng tồn 1…5"; nếu chỉ có một hàng nhãn thì nhóm 1 của hai kịch bản trùng nhãn (finding #28) |
| Ba đội "Chủ lực" | viền son + badge "Chủ lực" | mọi thẻ một kiểu viền | Nguồn chỉ có `notesRaw` dạng chuỗi; contract cấm tách câu nên không suy ra được danh sách chủ lực |
| Cột thứ 4 của ô tổng quan | ba cột | ba cột (Ghi chú nằm dưới Tổng quan trong cột 1) | Contract bắt buộc hiện đủ `summaryRaw` + `openingSuggestionsRaw` + `notesRaw` |
| Chip "Cải tạo" | nhiều chip rời | một chip chứa nguyên chuỗi nguồn | `unitTacticEffectsRaw` là một chuỗi thô, không tách theo dấu phẩy để khỏi làm hỏng dữ liệu |
| Nền dải "Cải tạo"/thanh điểm | `#FBF7EE` | `--panel-3` `#F7F2E8` | Không có token cho `#FBF7EE`; **thay bằng token gần nhất đã duyệt** (chênh 4/5/6 theo kênh RGB), không phải "không nhìn thấy được" |
| Chip cấu hình thẻ | 34px | 44px | Contract §11.4 (vùng bấm mobile) |
| Cỡ chữ vài vai trò | 13/13.5/17/19px… | `type.*` gần nhất (lệch ≤ 1px hoặc ≤ 1 bậc weight) | Quy ước chung: dùng lại vai trò hiện có trước khi thêm token mới |
| Anchor, link chân thẻ | `min-height` 40px | 44px | Vùng bấm tối thiểu §11.4 |
| Bảng quân thủ mỏ trên mobile | thẻ từng mỏ, mỗi địch một pill màu | thẻ từng mỏ, mỗi địch một **dòng chữ** "Tên · Binh chủng" | **Đơn giản hoá trình bày có ghi nhận** (không phải khớp artboard từng phần tử): bảng desktop giữ `table` ngữ nghĩa, mobile ẩn bảng và chỉ hiện một bản nên cây trợ năng không lặp |

## 4. Policy bản dịch (quy trình bước 2)

- Thêm **57 obligation `authored-vi`**: 28 `ui:coexist` (Cùng Tồn) và 29 `ui:khaihoang`
  cho Khai hoang (đầu mục, neo, nhãn bảng mỏ, chip cấu hình, thanh điểm, Chạm Sứ). Không cần receipt
  (lớp `authored-vi`). **Không dời, không đổi chữ `translate` nào** ⇒ không cần receipt độc lập.
- `sourceFiles`: vẫn **53 file**, làm mới hash 4 file đã sửa (`js/render.js`, `js/team-filter-section.js`,
  `js/app.js`, `js/team-detail-navigation.js`). `policyVersion`:
  `site-vi-260925-tra-cuu` → **`site-vi-260925-cung-ton-khai-hoang`**.
- `baseline.notes`: `concreteLocationCount` **56 514 → 56 571** (+57 = đúng số obligation mới),
  `concreteInventorySha256` `8d00467b…` → `1f7a8727…` (vòng P08 đầu) → **`5135e32f3c4bd0910a37d15edda43a931ff5f3766d0234e4a40cc2d196fadeb7`**
  (sau khi sửa P08-3, cùng số 56 571);
  các số khác không đổi (`siteLedgerObligations` 2 088, `translationObligations` 5 591,
  `uiTranslateObligations` 68, blocks 1 967).
- Publish theo `docs/season-team-data.md`: `build --stage all` → `check --stage all --candidate` (exit 0) →
  `publish` → `check --stage public` (exit 0) → sửa trường `generationId` trong `pipeline/team-route-handles.json`
  rồi `--check` (1366 recommended / 166 legacy / 17 Khai hoang).
- `recommendedPin`: **`9e9136f359abce6d36cafcf1c70484c96b463af3e76cf0a30632836a7fbd2e1f`** (bản Phase 7 ở `c11b58a`)
  → **final `bacb55104b9eee0cdc3f29264686e9c973f2a1666ffa00223acec2d4fd8476cf`** (bản đã sửa P08, manifest
  `b13be0b0386ccf87…`). Generation `site-localization` đi kèm: `6fc0b011…` → `bb65871b…`/`7c8947fa…`/`0e9f2a…`
  (các bước trung gian, chỉ ghi là lịch sử; generation trung gian đã xoá, chỉ generation đang pin còn lại).
- `tests/test_site_localization.py`: **không phải sửa số ghim** (377 OK).

## 5. Test sửa/thêm có chủ đích + lý do

1. `tests-js/coexist-counts.test.mjs` (**mới, 2 ca**): `coexistCounts` (đội, tướng khác nhau, tên trùng, tên
   rỗng, thiếu mảng tướng) và **bất biến của dữ liệu thật**: mỗi nhóm nguồn 5 đội × 3 tướng, 15 tướng khác
   nhau, 0 trùng. Câu chữ của dòng số liệu **không** kiểm ở đây (P08-3: hàm định dạng đã xoá) mà kiểm bằng e2e
   trên đúng dòng hiện trên trang.
2. `tests-js/team-detail-navigation.test.mjs`: thêm 3 khẳng định `safeReturnUrl` cho `group` của
   `/cung-ton/` (giữ `group` + `q`, bỏ `fbclid`; giữ số thứ tự legacy; bỏ khóa vòng lặp) — chứng minh
   allowlist mới của bước 1.
3. `tests-e2e/season-lookup.spec.mjs`: **6 ca mới** (hàng kịch bản/nhóm khớp `projectSeasonBrowse` tính
   trong test với dữ liệu thật + `group` vào URL bằng replaceState + reload giữ nhóm + đổi Mùa bỏ `group`;
   ô tổng quan nguyên văn 4 trường + số liệu khớp phép đếm độc lập trong test; `group` ngoài phạm vi và khóa
   lặp bị bỏ; nhánh legacy khi bộ dữ liệu mùa không khả dụng). Sửa **có chủ đích**: bề mặt Cùng Tồn giờ chỉ
   dựng nhóm đang xem nên `.coexist-subteam` 25 → 5 (và thêm `.coexist-group-chip` = 5), `#season-controls`
   nằm trong `.coexist-head` thay vì sau `h2`, cấu trúc thẻ đội đổi sang `.coexist-heroes/.coexist-hero/
   .coexist-hero-head/.coexist-hero-name`; thêm 2 ca **focus bàn phím** (Enter/Space trên kịch bản và nhóm
   không đầu, Tab/Shift+Tab, 1440 và 320) và mở rộng ca ô tổng quan sang nhóm chạm biên khoảng trắng. Ba ca Phase 2 khác trên `/cung-ton/` (phân loại áp dụng/tham khảo,
   chỉ giữ bộ lọc mùa, lịch sử) **giữ nguyên assertion và vẫn pass**.
4. `tests-e2e/khaihoang-options.spec.mjs`: **3 ca mới** (thanh điểm chỉ có ở đội có `guide.ratings` và độ dài
   thanh đúng `value × 10%`, cột Tổng đúng một cái; lọc loại binh thu hẹp đúng số thẻ và không đụng trạng
   thái; bảng mỏ desktop + thẻ mỏ mobile). Sửa **có chủ đích**: thẻ đổi từ `select` sang **chip** (`aria-pressed`,
   chọn bằng Enter) nên ca bàn phím dùng chip thay type-ahead; tiêu đề khối kèm số đếm nên phải khớp
   `"Đội khai hoang đề xuất 17"`; mỗi thẻ còn **1 link** (`Hướng dẫn đánh đất →` / `Chi tiết →`) thay vì 2;
   Chạm Sứ dùng `.cham-su-hero/.cham-su-tactic/.cham-su-note`; `.mine` → `.kh-mine-card`. Ca "mở chi tiết từ
   thẻ" và các ca trang chi tiết giữ nguyên hành vi, chỉ đổi cách chọn cấu hình trên thẻ.
5. `tests-e2e/spa-parity.spec.mjs`: các ca Khai hoang (chọn cấu hình, snapshot quay lại, `from` của link chi
   tiết) đổi theo cùng thay đổi có chủ đích: `select[aria-label="Cấu hình …"]` → `.kh-config-row[aria-label=
   "Chọn cấu hình …"]` khi nhận diện thẻ, `.locator("select").selectOption(x)` → bấm chip
   `.kh-config-chip[data-variant="${x}"]`, đọc lựa chọn bằng `data-variant` của chip `aria-pressed="true"`,
   và `.kh-title-link` → `.kh-detail-link` (thẻ chỉ còn một link). 13 ca trước đó đỏ vì lý do này, không
   phải lỗi hành vi.
6. `docs/design/so-binh-phap/tokens.json`: sửa 3 probe cũ đo sai trạng thái (chi tiết ở §2) và thêm token
   `color.light.transparent` + `var(--transparent)` trong rule tab Tra cứu đang chọn (giá trị không đổi,
   chỉ để đo được) — **không xoá kỳ vọng nào**, không thêm ngoại lệ.
7. `scripts/design-compare.mjs`: cặp Phase 8 đổi `ready` sang mốc nội dung thật (`.coexist-group-chip`,
   `.kh-card .kh-build`) và thêm 3 ảnh soát nhất quán (320 hai trang, chi tiết Khai hoang @390).

## 6. Gate (bộ A2)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` | pass (exit 0) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass (exit 0) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **346/346 pass** |
| `npm run test:e2e` | **244/244 pass** |
| `python3 -m unittest discover -s tests` | **377 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 470 = ceiling 470) |
| `node scripts/design-compare.mjs --tokens --phase 08` (+`--theme dark`) | **541/542 thuộc tính khớp token · 0 lệch chưa giải thích** ở cả hai theme |
| `node scripts/design-compare.mjs --phase 08` (+`--theme dark`) | mỗi theme **4 ảnh ghép artboard + 3 ảnh trang thật** ở `.cache/design-compare/phase-08{,-dark}/` (không commit) |

Kiểm thêm trên Chromium thật bản đã sửa P08 (320/390/1440, light/dark): kịch bản thứ 2 và nhóm thứ 3 kích
hoạt bằng Enter/Space đều **giữ focus** (không về `BODY`), Tab đi tiếp đúng thứ tự và Shift+Tab quay lại đúng
nút; đổi Mùa không cướp focus của select. 0 lỗi console/pageerror trên `/cung-ton/` và
`/khai-hoang/`; `scrollWidth == innerWidth`; `/khai-hoang/` có 17 thẻ, **11 thanh điểm** đúng bằng số đội có
`guide`, 8 thẻ Chạm Sứ, 5 hàng bảng mỏ + 5 thẻ mỏ; `/cung-ton/` có 2 chip kịch bản, 5 chip nhóm, 5 thẻ đội và
dòng "5 đội · 15 tướng · không trùng".

## 7. Rủi ro còn lại / việc của phase sau

1. Ba probe cũ của Phase 7 (`chip-loc` tab Tra cứu, `bang` đầu bảng chiến pháp) chưa từng chạy dưới
   `--phase 07` vì component không khai phase 7; phase này sửa lại cho đúng trạng thái thật — Phase 10 nên
   chạy `--tokens` cho **mọi** phase để không còn probe chết.
2. `#section-coexist a` (id + type) vẫn thắng rule nút chung của Phase 1 (Kongming P08 xác nhận: `ana-link-btn`
   trong `#section-coexist` ra chữ son trên nền nút tối) — **nợ kế thừa đã ghi từ Phase 1**, chưa xử lý; gợi ý
   thu hẹp độ đặc hiệu bằng `:where(#section-coexist) a` (Phase 10 kiểm riêng link nguồn và link nút).
2b. **Nợ kế thừa đã xác nhận, không phải hồi quy Phase 8:** ở 320px, hành động "nguồn" trên trang chi tiết bị
   cắt bên trái (x ≈ -65.8) dù không có cuộn ngang — thay lại đúng CSS của `c11b58a` cho kết quả y hệt; sửa bố
   cục hành động/ô nhãn cho co hoặc xuống dòng trong Phase sau, không ẩn `overflow`.
3. Nợ tương phản `--on-accent` trên `--accent` theme tối (3,33:1) ở `.badge.unit`/`.pre.sp` (Phase 10).
4. Bảng mỏ mobile dựng thêm một bản thẻ: chỉ một bản hiển thị ở mỗi bề rộng, nhưng nếu phase sau đổi cấu
   trúc thì phải giữ đúng quy ước ẩn/hiện này.
5. `/#…` cũ và snapshot quay lại của `/cung-ton/` giờ mang thêm `group`: đã thêm vào allowlist của Phase 2 và
   có ca unit; Phase 10 nên rà lại ma trận URL khi thêm khóa mới.

## 8. Gợi ý commit

```
feat(coexist,khaihoang): rebuild Cùng Tồn and Khai hoang on the Coexist and Khaihoang artboards

- Cùng Tồn: scenario row (labelVi) then a 1–5 group row identified by recordId (legacy groups
  keep their 1-based index), one group rendered at a time, chosen group in ?group= (replaceState,
  dropped when it leaves the scope); selecting keeps the activated button in the DOM so keyboard
  focus and Tab/Shift+Tab order survive (no focus steal on load or Mùa change); overview keeps
  summaryRaw/openingSuggestionsRaw/notesRaw/scope note/source link/disclaimerRaw verbatim (CRLF
  normalised only, multiline, no innerHTML, no sentence splitting) with computed
  "5 đội · 15 tướng · không trùng" and the same frame for the legacy branch
- Khai hoang: page header, source note, in-page anchors, unit filter, cards with 44px config chips,
  the shared Phase-6 build block, a six-mark rating bar drawn only for teams that have guide.ratings
  (total column in ink) and one foot link per card ("Hướng dẫn đánh đất →" / "Chi tiết →"); Chạm Sứ
  grid and a mines table on desktop with per-mine cards on mobile
- add 57 authored-vi obligations (no translate string moved), republish the Recommended
  generation (9e9136f3 -> bacb5510) and re-pin the route handles; concrete locations 56514 -> 56571
- legacy ceiling 519 -> 470; add the coexist/khaihoang component catalog entries with probes and fix
  three Phase-7 probes that never ran against their real state
```

## Audit 260926 — sửa theo ảnh ghép

Nguồn finding: `agent://AuditCoexistKhaihoang` (C*, CM*, K*, KM*) và `agent://AuditTeamLists` (P6-2, P6-3 — trang chi tiết Khai hoang, ghi ở đây; `visual-phase-06.md` trỏ sang). Chỉ sửa mục `new`; mục `accepted` (C3, K6, K7, KM1) giữ nguyên.

| Finding | Trạng thái | Chi tiết |
| --- | --- | --- |
| K1 (high) hàng build thẻ xếp dọc | **đã sửa** | `css/styles.css` khối build dùng chung: `.kh-build .kh-hero` dùng lưới `140px 0.8fr 20px 1.2fr` cho **cả thẻ và trang chi tiết**, `.kh-stages { display: contents }`, `.kh-before`/`.kh-arrow`/`.kh-after` đặt cột 2/3/4 (hàng chỉ có "Sau" không lọt sang cột "Trước"). `.kh-stage` thành chữ chảy dòng (`display: block`) để "Trước · <chiến pháp>" xuống dòng giữa từ như artboard; nhiều chiến pháp "Sau" nối " + " (`js/render.js` `khaihoangHeroRow`, ký hiệu như artboard). Ảnh `phase-08/Khaihoang.png`: mỗi tướng một hàng `tên | Trước · … → Sau · …` |
| KM2 hàng build mobile | **đã sửa** | `.kh-build` là container (`container-type: inline-size`); `@container (max-width: 480px)` → một cột: tên / Trước / Sau mỗi phần một dòng (KhaihoangMobile.dc.html). Áp cho thẻ mobile, thẻ hai cột ở màn vừa và trang chi tiết mobile. Nhãn "Trước ·" giữ (artboard mobile "Trước:" — cùng nghĩa, không thêm chuỗi) |
| K2 lead không có measure | **đã sửa** | `.khaihoang-head .reference-head-text { max-width: 720px }` (Khaihoang.dc.html:33, tiền lệ 720px của Lookup/Recruit). Đo 1440: `.reference-lead` 1344px → **720px**, lead 2 dòng như artboard |
| K3 thứ tự chip loại binh | **đã sửa** | `js/render.js` `khaihoangTable`: sort giảm dần theo số đội (ổn định khi bằng). Đo: `Tất cả 17 · Cung 10 · Thương 4 · Kỵ 2 · Khiên 1` (khớp cả hai artboard) |
| K4 / KM3 chân thẻ thiếu chevron | **đã sửa** | Link chân thẻ = nhãn trái + icon chevron sát phải (`justify-content: space-between`). Artboard vẽ `⌄` vì là nút disclosure; ở site đây là **link sang trang chi tiết** nên chevron chỉ sang phải (D3 — ngữ nghĩa điều khiển). Mũi tên chữ "→" trong nhãn bỏ (icon thay) |
| K5 badge binh chủng trong hàng build | **đã sửa (có điều kiện)** | Badge chỉ hiện khi loại binh của tướng **khác** loại binh của build (đã ở badge đầu thẻ). Dữ liệu `data/khaihoang.json`: 156 ô loại binh, 3 ô khác build (đội "Tôn Thượng Hương · Trần Cung · Hoàng Nguyệt Anh": build Cung, "Sau" chuyển Kỵ) — đó là thông tin không có ở chỗ khác nên giữ ở đúng 3 ô này; mọi hàng còn lại khớp artboard (không badge) |
| KM4 mũi tên rớt dòng ở 320 + badge trái tiêu đề | **đã sửa** | Ở khối hẹp mũi tên trang trí (`aria-hidden`) ẩn vì Trước/Sau đã tách dòng; `.kh-card-head` ≤680px xếp cột (badge **trên** tiêu đề). Ảnh `Khaihoang-320.localhost.png` |
| C1 cấp độ đội / nhãn tướng gộp vào tên | **đã sửa** | `js/render.js` `splitSourceTag`: chỉ tách khi hiện, không sửa dữ liệu. Dòng cuối `teamNameRaw` dạng `\d+C` → pill `badge coexist-level` trong `header.coexist-subteam-head`; dòng cuối `nameRaw` trong ngoặc (ASCII hoặc toàn khổ) → `.coexist-hero-tag` ("Thương S"). Dòng khác nối bằng dấu cách như trước (vd. `Quan Hưng/ Quan Vũ` không bị coi là nhãn). `coexistCounts` vẫn đếm theo chuỗi nguồn nguyên vẹn |
| C2 nhãn "Ghi chú" lặp dòng đầu dữ liệu | **đã sửa** | Khi dòng đầu nguồn trùng nhãn cột (bỏ `:` cuối, không phân biệt hoa thường) thì bỏ nhãn của site; chuỗi nguồn hiện **nguyên văn** (test "verbatim" vẫn đúng) và dòng đầu mang dáng nhãn caps qua `.coexist-raw-titled::first-line` |
| CM1 hàng chọn nhóm mobile | **đã sửa** | `js/team-filter-section.js` `paintGroupRow`: mỗi chip thêm `.coexist-chip-number` (aria-hidden) + dòng `.coexist-group-note` dưới hàng (tóm tắt đội của nhóm đang chọn, cùng chuỗi nguồn của chip). ≤680px: một hàng 5 nút số 44px `flex:1`, nhãn nhóm ẩn thị giác nhưng vẫn là tên truy cập, tóm tắt từng chip ẩn (hiện lại ở dòng dưới khi chọn). Đo 390: 5 nút cao 44px; khối chọn 588px → hàng 44px + 1 dòng |
| CM2 ô tổng quan mobile luôn mở | **đã sửa** | `seasonCoexistGroup`: hai cột nguyên văn (Tổng quan + Ghi chú, Gợi ý khai hoang) nằm trong `details.coexist-overview-fold`; desktop luôn mở (dòng tóm tắt ẩn, tỉ lệ cột giữ 1 : 1.2 : 1), mobile mặc định **đóng** — nội dung giữ nguyên, chỉ gập. Rời mobile khi đang gập thì tự mở lại (một listener `matchMedia` cho cả module) |
| CM3 dòng số liệu mobile | **đã sửa** | Cột "Kiểm tra trùng tướng" nằm ngoài disclosure, ngay dưới nó; ≤680px `.coexist-count-line` dùng token mới `type.coexist-count-mobile` 13px/600 |
| CM4 h1 mobile 36 → 34 | **đã sửa** | ≤680px `.reference-title` của trang mục `coexist` và `khaihoang` (`body[data-page-section]`) dùng `var(--type-detail-title)` (34px/1.05 sẵn có). Đo 390/320: 34px; desktop 48px không đổi |
| P6-2 badge loại binh lặp ở chi tiết Khai hoang | **đã sửa** | `js/khaihoang-detail.js`: bỏ `.kh-detail-build-head` (badge thứ hai); loại binh chỉ còn ở `#team-detail-badges` và đổi theo cấu hình. Đo 1440: `#team-detail-root .badge` = `["Thương"]` |
| P6-3 chọn cấu hình chi tiết khác họ | **đã sửa** | `<select>` + "Chọn cấu hình"/"Cấu hình mặc định" thay bằng `khaihoangConfigRow` **dùng chung** với thẻ danh sách (`.kh-config-row` `role=group` + `button.fchip.kh-config-chip[aria-pressed]` 44px). Đổi chip vẫn `replaceState` `?variant=` và giữ `from`. Tiêu đề khối serif 28px **giữ không thêm**: không có artboard chi tiết Khai hoang, thêm tiêu đề là thêm chữ tác giả ngoài phạm vi finding |

### Lệch có chủ đích (thêm ở vòng này)

| Chỗ | Artboard | Thực tế | Lý do |
| --- | --- | --- | --- |
| Lead mobile Cùng Tồn/Khai hoang | câu rút gọn | câu đầy đủ như desktop | D1 — không ẩn/rút nội dung trên mobile |
| Nhãn disclosure mobile | "Chủ lực & gợi ý khai hoang" | "Tổng quan nhóm" | Nguồn không có danh sách chủ lực tách riêng (C3/"Ba đội Chủ lực"); nhãn dùng đúng tên vùng đã có (`aria-label`) |
| Tiêu đề phân loại hàng nhóm trên mobile | không vẽ | giữ "Tham khảo kịch bản (5)" | D1 + đã ghi ở bảng lệch trên (phân loại phạm vi là contract) |
| Dòng số liệu mobile | cả dòng màu `--good` | số liệu màu mực, kết luận `--good`/`--avoid` | Giữ màu theo kết luận để ca "có trùng" vẫn đỏ; cỡ/độ đậm khớp 13/600 |
| Nhãn phụ tướng | 11.5px | `type.badge` 12px | Vai trò chữ gần nhất có sẵn (≤ 0,5px) |
| Chevron chân thẻ Khai hoang | `⌄` (disclosure) | `›` sát phải | Chân thẻ là link điều hướng, không phải disclosure (D3) |

### Thay đổi chữ (`pipeline/site_localization.py`, tất cả `authored-vi`)

- `ui:khaihoang/card-guide-link`: "Hướng dẫn đánh đất →" → "Hướng dẫn đánh đất" (mũi tên thành icon).
- `ui:khaihoang/card-detail-link`: "Chi tiết →" → "Chi tiết".
- `ui:khaihoang/card-config-aria`, `card-default`, `card-variant`: chữ giữ nguyên, cột symbol `khaihoangTeamCard` → `khaihoangConfigRow` (hàm dùng chung thẻ + chi tiết).
- Mới `ui:coexist/overview-summary` (`summaryLabel`): "Tổng quan nhóm".
- Bỏ khỏi `js/khaihoang-detail.js` (không có dòng obligation): "Chọn cấu hình", "Cấu hình mặc định".
- Không đụng dòng `translate`; không sửa dữ liệu (`textVi`/JSON). " + " giữa chiến pháp là ký hiệu.

### Token / component

- Token mới `type.coexist-count-mobile` 600 13px/1.5 sans (CoexistMobile.dc.html:45), `:root` thêm `--type-coexist-count-mobile`.
- `components`: `chon-nhom` (phần/biến thể mobile + probe số nhóm, dòng nhóm đang chọn; probe chip mobile đổi sang `radius.10`), `o-tong-quan-cung-ton` (disclosure; probe mobile chuyển sang `.coexist-overview-fold` + summary 48px + dòng số liệu 13px), `the-cung-ton` (probe đầu thẻ tách `.coexist-subteam-head`; probe mới pill cấp độ, nhãn phụ tướng), `the-khai-hoang` (hàng build, chân thẻ, ghi chú K1–K5), `select-nhan-caps` bỏ `.kh-variant-select` + biến thể "chọn biến thể" (CSS select Khai hoang đã xoá).

### Test cập nhật

`tests-e2e/khaihoang-options.spec.mjs`: nhãn link chân thẻ bỏ "→"; hàng build không còn badge `Cung` trùng build (`toHaveCount(0)`); mọi thao tác chọn cấu hình ở trang chi tiết đổi từ `combobox.selectOption` sang chip `detailChip(page, id)` (+ `aria-pressed`), ca 320px chọn bằng Enter trên chip. Chưa chạy bộ e2e (build gate chờ lead re-pin).

### Kiểm chứng

- Ảnh ghép đã xem (dev server riêng `127.0.0.1:4404`): `phase-08/Khaihoang.png` (hàng build 1 hàng/tướng, chân thẻ chevron), `KhaihoangMobile.png` + `Khaihoang-320.localhost.png` (badge trên tiêu đề, tên/Trước/Sau, không mũi tên rớt), `Coexist.png` (pill 19C, nhãn "Thương S", dòng đầu "GHI CHÚ" dáng nhãn), `CoexistMobile.png` (hàng 5 nút số, dòng đội, disclosure đóng, số liệu 13px), `phase-08-dark/CoexistMobile.png`, `phase-06/KhaiHoang-1440.localhost.png` + `KhaiHoang-390.localhost.png` (một badge, nhóm chip, build 4 cột / 3 dòng).
- Probe: `--tokens --phase 8` **616/617** light và dark, 0 lệch chưa giải thích (1 ngoại lệ đã khai `select-nhan-caps` line-height); `--tokens --phase 6` **378/378** hai theme; `design-tokens.mjs --check` ok.
- Smoke Playwright 390→1440: disclosure đóng ở mobile, bấm mở được, đổi nhóm dựng lại vẫn đóng, resize lên 1440 tự mở; chip chi tiết đổi `?variant=` + `aria-pressed`; 320px `scrollWidth == innerWidth`.
