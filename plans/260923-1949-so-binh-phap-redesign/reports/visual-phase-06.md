# Phase 6 — Báo cáo: Trang chi tiết đội

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-06](../phase-06-chi-tiet-doi.md).
Phạm vi: dựng lại trang chi tiết của **cả ba họ** (Đội chuẩn, Đội khác, Khai hoang) theo artboard
`TeamDetail.dc.html:36-117` — khung chung, panel điểm, thẻ tướng ×3, ghi chú nguồn đánh số; khối build
Khai hoang dùng chung (`khaihoangBuildContent`) thiết kế lại theo artboard Khaihoang để Phase 8 dùng lại;
kiểm scheme `http(s)` cho mọi URL nguồn; nút sao chép liên kết có nhánh lỗi; bỏ CSS legacy đã bị thay.
Chưa commit — orchestrator commit sau go/no-go.

## 1. Việc đã làm (theo bước trong phase file)

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | Khung chung: hàng quay lại (`.detail-back-row` + `.detail-link`, thêm `.detail-back-link` có mũi tên 44px) → header (nhãn mùa · danh mục caps son, h1 serif 56px, tên Trung `lang="zh-Hant"`, hàng huy hiệu phe + binh) → panel điểm 340px (nhãn caps + "theo SGSDeck", số serif son 64px + đơn vị, "Xem nguồn" + nút sao chép 44px) | xong — §3, §4 |
| 1b | Mọi URL nguồn của 3 họ qua `validateHttpSourceUrl` (http(s), không userinfo/ký tự điều khiển, giữ fragment); URL hỏng không thành link; Recommended giữ nguyên ràng buộc danh tính `https://sgsdeck.com/recommended/<sourceConfigId>` | xong — §2 |
| 1c | "Sao chép liên kết" (`navigator.clipboard.writeText(location.href)`, `role="status"` báo "Đã sao chép liên kết"); clipboard lỗi/không có → hiện ô chỉ đọc đã chọn sẵn URL + thông báo lỗi, không báo thành công giả | xong — §3 |
| 2 | Thẻ tướng ×3 theo artboard (đầu thẻ vai trò + chỉ số, tên serif 26px + huy hiệu C, tên Trung, ô chiến pháp có số thứ tự + chữ Hán, duyên phận, dòng binh thư, ghi chú theo tướng); các phần artboard không vẽ được giữ nguyên và xếp dưới (ghi chú nguồn đánh số, cấu hình thay thế, "Khắc chế tốt"/"Nên tránh", tham chiếu legacy, metadata nguồn) | xong — §4 |
| 2b | "Khắc được"/"Sợ" chỉ render khi `content.counters` legacy có dữ liệu (Đội chuẩn 0/1366 → không có khối, không tiêu đề rỗng) | xong — §4 |
| 3 | Đội khác thiếu tên Trung và điểm → không render hai phần đó (không ô trống); panel chỉ còn hàng hành động | xong — §4 |
| 4 | Khai hoang chi tiết dùng cùng khung; hướng dẫn vẫn ngoài subtree build; **khối build dùng chung** `khaihoangBuildContent` thiết kế lại (mỗi tướng "Trước · … → Sau · …", chiến pháp chữ son không nền, ghi chú build) — thẻ danh sách dùng lại nguyên khối | xong — §4 |
| 5 | `?from=`/snapshot quay lại (Phase 2) giữ nguyên hành vi (e2e cũ vẫn xanh) | xong — §6 |
| 6 | 17 obligation `authored-vi` mới cho chữ mới ("Điểm nguồn", "theo SGSDeck", "Xem nguồn", "Sao chép liên kết đội", "Đã sao chép liên kết", thông báo lỗi clipboard, "Đội hình", "Ghi chú nguồn", 3 vai trò tướng, "Chiến pháp", "Binh thư", "Duyên phận", "Lưu ý: ", "Chưa có dữ liệu") | xong — §5 |
| 7 | Cặp so ảnh: TeamDetail ↔ `/doi-chuan/pk-s24-tiem-long-dieu-thuyen/` @1440 + soát nhất quán @390 và hai trang Đội khác/Khai hoang (không có artboard) | xong — mỗi theme 1 ảnh ghép artboard + 5 ảnh soát nhất quán, đã duyệt (§7, §8) |

| 8 | **Vòng sửa theo Kongming P06:** P06-1 khôi phục ràng buộc Recommended (từ chối fragment, `%ZZ` trả `null`) kèm regression + ca renderer URL hỏng; P06-2 huy hiệu chủ tướng `C` dùng `--accent-ink` (7,17 / 6,37 ≥ 4,5); P06-3 dòng binh thư bỏ số thứ tự, Việt trái · Hán phải, gộp CSS trùng | xong — §2, §4, §6 |

## 2. Kiểm scheme URL nguồn (bước 1b)

- `js/recommended-reference-state.js`: tách `validateHttpSourceUrl(raw)` — chỉ nhận URL tuyệt đối `http(s)`,
  từ chối userinfo, ký tự điều khiển, `javascript:`/`data:`/`file:`, URL tương đối và `//host`;
  **giữ fragment** (URL nguồn thật có `#gid=…`).
- `validateReferenceSourceUrl('recommended', …)` giữ **nguyên** ràng buộc danh tính đóng băng: `https`,
  `hostname === 'sgsdeck.com'`, `decodeURIComponent(pathname) === '/recommended/<sourceConfigId>'`,
  **không query và không fragment**; mọi lỗi giải mã (`%ZZ`) trả `null` trong `try/catch`, không ném ra ngoài.
  Bản đầu của lượt này từng để lọt fragment và để `URIError` thoát ra (bị Kongming bắt ở P06-1) — đã sửa và
  có regression ở `tests-js/recommended-reference-state.test.mjs` (§6.1) cùng ca renderer ở §6.2.
- Dùng chung: chi tiết Đội chuẩn (`record.sourceUrl`), Khai hoang (`team`/`variant.sources[].url`, thay cho
  phép lọc `/^https:\/\//` cũ ở `js/render.js`) và panel hành động của cả ba họ. URL hỏng → không render link.
- Link ngoài vẫn `target="_blank" rel="noopener noreferrer"`.

## 3. Nút sao chép liên kết (bước 1c)

- Module mới `js/detail-actions.js` (dùng chung 3 trang chi tiết): dựng link nguồn + nút `#team-copy-link`
  (44px, `aria-label="Sao chép liên kết đội"`), ô `#team-copy-fallback` (readonly, `hidden`) và vùng
  `#team-copy-status` (`role="status"`, `aria-live="polite"`).
- Thành công: `navigator.clipboard.writeText(location.href)` → "Đã sao chép liên kết", ô chọn sẵn vẫn ẩn.
- Lỗi/từ chối/không có clipboard: ô chỉ đọc hiện ra, được `focus()` + `select()` (chọn sẵn đúng URL hiện tại,
  gồm cả `from`/`variant`), thông báo "Không sao chép tự động được. Liên kết đã được chọn sẵn để bạn tự sao chép.".
- e2e: ca "copy link reports the real clipboard result and offers a selected fallback" đọc lại clipboard bằng
  `navigator.clipboard.readText()` (đã cấp quyền) và kiểm nhánh lỗi bằng `writeText` bị từ chối.

## 4. Micro (tự động)

- `node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`, 0 mã màu / 0 giá trị thô
  ngoài khối legacy; **ceiling legacy 570 → 547** (547 giá trị thô trên 255 selector) sau khi xóa khối
  `.detail-*`/`.reference-detail-holder`/`.kh-line` legacy đã bị thay.
- `node scripts/design-compare.mjs --tokens --phase 06` (light + dark): **378/378 thuộc tính khớp token · 0 lệch chưa giải thích** ở cả hai theme (khung chi tiết, panel điểm, thẻ tướng, badge phe/binh, số điểm, chữ chiến pháp khối build).
- Component trong danh mục:
  - **Thêm mới:** `khung-chi-tiet` (header + hàng quay lại), `panel-diem` (panel điểm + hành động),
    `the-tuong` (thẻ tướng chi tiết) — `phaseOwner: 6`, 7-11 probe mỗi component, có trạng thái mobile 390.
  - **Thêm host/probe:** `badge-phe` (thêm host `#team-detail-root .detail-badges .badge.faction`, giữ probe
    Landing), `badge-binh` (thêm host chi tiết), `so-diem` (thêm probe chi tiết 64px), `nut-chien-phap`
    (thêm biến thể "chữ son (khối build)" ở `/khai-hoang/`).
  - **Token chữ mới (10, đều ghi nguồn artboard TeamDetail):** `detail-hero-title` 56px, `detail-kicker`
    12/600/0.14em, `detail-name-zh` 24px (cjk), `score-panel` 64px, `detail-section-title` 28px,
    `hero-card-title` 26px, `hero-card-role` 11/700/0.12em, `hero-card-zh` 13px (cjk), `han-line` 12.5px (cjk),
    `book-line` 14px.

### Tương phản (đo computed style trên DOM thật, cả hai theme)

Đo **33 cặp chữ mới/đổi** của phase (không phải toàn bộ chữ trên trang) trên `/doi-chuan/pk-s24-thai-su-cung/`,
`/doi-khac/tan-ngo-thuong/`, `/khai-hoang/chu-thai-truong-phi-truong-xuan-hoa/`: **33/33 cặp đạt ngưỡng**
(chữ thường ≥ 4,5:1, chữ ≥ 24px ≥ 3:1). Thấp nhất: số điểm panel 7,05 / 5,04; chữ Hán chiến pháp 5,46 / 5,70;
kicker 6,25 / 5,52; đầu thẻ tướng 13,43 / 12,11; chip khắc chế 10,9 / 8,88.
**Huy hiệu chủ tướng `C`** sau khi sửa P06-2: **7,1695:1 (light) / 6,3651:1 (dark)**, đo lại trên cả hai họ
trang ở 1440 và 320 (trước khi sửa là 4,4636:1 ở theme tối — đã tính lại, không làm tròn lên 4,5).
**Nợ kế thừa, không phải lỗi mới của phase:** chữ nhãn biến thể `SP` (`.pre.sp` — `--on-accent` trên `--accent`)
đo 3,33:1 ở theme tối ở mọi nơi dùng nó; phase này không mở rộng sang việc dọn tương phản toàn cục (Phase 10),
nhưng đã sửa đúng chỗ nó **tự tạo mới**: số thứ tự chiến pháp (P06-2/P06-3 đều không đụng `.pre.sp`).
Riêng **số thứ tự chiến pháp** lần đo đầu chỉ đạt 7,23 / **3,33** (mực `--on-accent` trên nền `--accent`,
đúng nợ Phase 3/4) → đã sửa sang mực giấy `--bg` trên nền son: **6,25 / 5,52** ở cả hai theme
(ghi chú trong `the-tuong` của `tokens.json`).

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
|---|---|---|---|
| Nhãn panel và số điểm | nhãn caps **bên trái**, số **bên phải** cùng hàng | nhãn caps **trên**, số dưới | Bố cục một cột đọc tốt ở 320-1440 và không cần bảng hai cột; đây là **lệch có chủ đích** (Kongming: nonblocking, phải ghi rõ trong báo cáo) |
| Số điểm trong panel | chỉ số 64px, nhãn caps lo nghĩa | `120` + đơn vị "điểm" | Hợp đồng render `.detail-score` đã khóa từ Phase 2 (`"{value} điểm"`); đơn vị là chữ dữ liệu, không bịa |
| Huy hiệu phe/loại binh | 30px/13px, padding 0 12px | component `badge-phe`/`badge-binh` (28/24px, 11/9px) | Chuẩn component StyleGuide (tiền lệ Phase 5: nhãn caps 11px thắng artboard) |
| Nhãn caps ("Điểm nguồn", "Chiến pháp", "Binh thư") | 11/600/0.1em | `type.field-caps` 11/600/0.12em | Một vai trò caps dùng chung toàn site |
| Chữ chiến pháp trong thẻ | #6E141C | `--accent-ink` #8E1B24 | Không có token #6E141C; #8E1B24 là "son đậm" cùng họ, giữ đúng vai trò |
| Chữ Hán chiến pháp | 12px | `type.han-line` 12.5px | Gộp với chữ Hán binh thư (12.5px), lệch ≤0.5px |
| Tiêu đề "Ghi chú nguồn" | 16/700 | `type.strong` 15/600 | Dùng lại vai trò chữ hiện có; tiêu đề khối khác giữ 28px serif |
| Chỉ số trong đầu thẻ | 12.5/500 | `type.meta` 12.5/400 | Dùng lại vai trò hiện có (lệch weight) |
| Số thứ tự chiến pháp | nền son + chữ kem (`on-accent`) | nền son + mực giấy (`--bg`) | Cặp `--on-accent`/`--accent` chỉ 3,33:1 theme tối (nợ Phase 3/4); mực giấy đạt 6,25/5,52 |
| Câu "Dịch từ ghi chú gốc…" dưới ghi chú | có | không | Là tuyên bố nguồn gốc; trang đã có khối "Nguồn & phạm vi" nói đúng dữ liệu thật |
| Thẻ build ở **thẻ danh sách** | hàng 4 cột | khối build xếp dọc (chỉ trang chi tiết dùng hàng 4 cột) | Thẻ Khai hoang hiện 3 cột hẹp; Phase 8 mở rộng thẻ theo artboard rồi bỏ phần xếp dọc |
| Ảnh artboard cho 390 / Đội khác / Khai hoang | — | chỉ có ảnh trang thật | Không có artboard mobile cho TeamDetail và hai họ kia (chỉ soát nhất quán) |

## 5. Policy bản dịch (bước 6 / quy trình bước 2)

- Thêm **17 obligation `authored-vi`**: `js/detail-actions.js` 5 (nhãn nút, nhãn ô chọn sẵn, "Đã sao chép…",
  thông báo lỗi, "Xem nguồn"), `js/recommended-reference-render.js` 10 ("Đội hình", "Ghi chú nguồn", 3 vai trò
  tướng, "Chiến pháp", "Binh thư", "Duyên phận", "Lưu ý: ", "Chưa có dữ liệu"),
  `src/pages/doi-chuan/[team].astro` 2 ("Điểm nguồn", "theo SGSDeck"). Không cần receipt (lớp `authored-vi`).
- Obligation `translate` của 3 shell giữ **nguyên chỗ, nguyên chữ đã duyệt** (`— Đội chuẩn —`,
  `dữ liệu nguồn SGSDeck Recommended`, `Chi tiết đội chuẩn`, `Quay lại đội chuẩn`, `danh sách đội chuẩn`,
  và bộ tương ứng của Đội khác) ⇒ không cần receipt độc lập.
- `sourceFiles`: 50 → **51 file** (thêm `js/detail-actions.js`, làm mới hash mọi file).
- `policyVersion`: `site-vi-260925-doi-danh-sach` → **`site-vi-260925-chi-tiet-doi`**.
- `baseline.notes`: `concreteLocationCount` **56 440 → 56 457** (+17 = đúng 17 obligation mới),
  `concreteInventorySha256` `9c9015c2…` → **`8b720096…`**; các số khác không đổi
  (`siteLedgerObligations` 2 088, `translationObligations` 5 591, `uiTranslateObligations` 68, blocks 1 967).
- Generation + re-pin: `build --stage all` → `check --stage all --candidate` (exit 0) → `publish` →
  `check --stage public` (exit 0, 0 problem) → `python3 -m pipeline.team_route_handles --check`
  (1366 recommended / 166 legacy / 17 Khai hoang). `generationId`:
  `e14550ae…` (Phase 5) → `a2b10b3c…` (trước vòng sửa P06) → **final `2c8031116d6e48bca60ebd9ac689896dba890635c2477a822164de073c13c439`**
  (các generation trung gian `e83feac1…`, `ef11581e…`, `676de623…`, `0a0655f0…`, `a2b10b3c…` đã xóa, không file nào tham chiếu).
- Vòng sửa P06 chỉ đổi mã JS (không thêm/bớt obligation) nên số đếm/digest inventory giữ nguyên; bước 2b–2d
  chạy lại vì hash `sourceFiles` thay đổi (generation `2c803111…`, re-pin ledger khớp).
- `tests/test_site_localization.py`: **không phải sửa số ghim** (368 OK).

## 6. Test sửa/thêm có chủ đích + lý do

1. `tests-js/recommended-reference-state.test.mjs` — thêm ca `validateHttpSourceUrl` (http/https, fragment
   Google Sheets hợp lệ; `javascript:`/`data:`/`file:`/URL tương đối/`//host`/userinfo/ký tự điều khiển bị
   từ chối) và khẳng định ràng buộc danh tính Recommended không bị nới (http, query).
2. `tests-e2e/team-detail-pages.spec.mjs` — **thêm 6 ca** (5 ca ở dưới + ca vòng sửa P06-1): khung TeamDetail (nhãn phạm vi, tên Trung, huy hiệu,
   panel điểm, link nguồn `rel`), thẻ tướng (vai trò/chỉ số/tên Trung/số thứ tự chiến pháp/binh thư),
   Đội khác bỏ phần điểm + tên Trung (không ô trống), sao chép liên kết (thành công + nhánh lỗi chọn sẵn URL);
   **sửa 3 ca cũ** theo cấu trúc mới: nhãn `'Cấu hình chính'` → `'Đội hình'`, `'Mô tả & điều kiện'` →
   `'Ghi chú nguồn'`, `.holder-*-dd` → `.detail-hero-*` (cùng ngữ nghĩa, chỉ đổi cách trình bày),
   `.detail-score` của Đội khác từ `'Chưa có điểm nguồn'` → `toHaveCount(0)` (plan bước 3: thiếu dữ liệu thì bỏ);
   **ca mới "a malformed source URL suppresses the anchor without breaking the render"**: URL nguồn `%ZZ`
   vẫn dựng đủ thẻ tướng nhưng không có anchor nguồn, `validateReferenceSourceUrl` trả `null` cho fragment
   và cho `%ZZ`, giữ fragment Google Sheets ở `validateHttpSourceUrl` (vòng sửa P06-1).
3. `tests-e2e/recommended-browser.spec.mjs` — 2 ca chi tiết đổi selector theo thẻ tướng
   (`.detail-hero-bonds`/`.detail-hero-tactics-vi`, `.detail-hero-books-block`), giữ nguyên phép kiểm
   "trống khác chưa dịch"; thêm khẳng định `.detail-hero-stat` không render khi cả ba tướng trống chỉ số.
4. `tests-e2e/khaihoang-options.spec.mjs` — **thêm 2 ca**: (a) đầu trang chi tiết có huy hiệu loại binh +
   khối build dùng chung ("Trước · … → Sau · …", mũi tên, chữ son, không nút bấm) + nút sao chép;
   (b) fixture `sources[].url` chứa `javascript:`/URL tương đối → chỉ URL `https` thật thành link, tiêu đề
   trang không bị đổi. Thêm helper fixture `routeDetailSource` (thay cả pin sha256 của nguồn Khai hoang).
   Các ca cũ giữ nguyên; 2 ca "Chạm Sứ" xanh lại sau khi cho phép fragment URL.
5. `scripts/design-compare.mjs` — thêm cặp phase 6 (TeamDetail @1440 + 5 ảnh soát nhất quán) và hỗ trợ cặp
   **không có artboard** (`name` thay `artboard`: chỉ chụp trang thật, không ghép ảnh, ghi rõ trong bảng).
6. `css/styles.css` — khối "Phase 6" cuối file; xóa 24 rule legacy đã bị thay (`.detail-*`,
   `.reference-detail-holder`, `.kh-line .kh-label`, `.kh-detail-build .kh-line`) ⇒ ceiling 570 → 547.
7. `docs/design/so-binh-phap/tokens.json` — 10 vai trò chữ mới, 3 component mới, probe mới cho 4 component.
   `:root` thêm đúng 12 dòng `--type-*` (10 vai trò + 2 letter-spacing).
8. `src/lib/public-artifact-manifest.mjs` — khai `js/detail-actions.js` (file JS mới có chữ UI).

## 7. Gate (bộ A2)

| Lệnh | Kết quả |
|---|---|
| `npm run check` | pass (exit 0) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass (exit 0, 1726 file dist) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **338/338 pass** |
| `npm run test:e2e` | **217/217 pass** (thêm ca renderer URL nguồn hỏng) |
| `python3 -m unittest discover -s tests` | **368 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 547 = ceiling 547) |
| `node scripts/design-compare.mjs --tokens --phase 06` (+`--theme dark`) | **378/378 thuộc tính khớp token · 0 lệch chưa giải thích** ở cả hai theme |
| `node scripts/design-compare.mjs --phase 06` (+`--theme dark`) | **đã chạy** — mỗi theme: **1 ảnh ghép artboard** (TeamDetail @1440) + **5 ảnh chụp trang thật** để soát nhất quán (390 của TeamDetail, 1440/390 của Đội khác và Khai hoang), ở `.cache/design-compare/phase-06{,-dark}/` (không commit) |

## 8. Bố cục (người duyệt)

Mỗi theme: **1 ảnh ghép cạnh artboard** (TeamDetail @1440) + **5 ảnh chụp trang thật** (không có artboard tương ứng) ở `.cache/design-compare/phase-06{,-dark}/` (không commit). Đã xem từng ảnh:

| Artboard | Trang | Đã xem | Kết luận |
|---|---|---|---|
| TeamDetail | `/doi-chuan/pk-s24-tiem-long-dieu-thuyen/` @1440 | light + dark | **đã sửa/đạt**: hàng quay lại có mũi tên; nhãn `PK-S24 · BÁ VƯƠNG THẢO NGHỊCH · GIAO CHIẾN` caps son trên tiêu đề serif lớn + tên Trung `潛龍貂蟬`; huy hiệu phe `Quần` cùng hàng; panel 340px bên phải có nhãn caps + "theo SGSDeck", số serif son, nút tối "Xem nguồn" + nút sao chép 44px; "Đội hình" serif 28px + 3 thẻ tướng (đầu thẻ vai trò/chỉ số, tên 26px + huy hiệu C, tên Trung, ô chiến pháp có số thứ tự + chữ Hán, dòng binh thư); "Ghi chú nguồn" là panel có viền với danh sách đánh số son |
| TeamDetail (390, không có artboard mobile) | cùng trang @390 | light + dark | **đạt**: một cột, panel xuống dưới tiêu đề, thẻ tướng xếp dọc, không tràn ngang |
| — (không có artboard) | `/doi-khac/tan-ngo-thuong/` @1440 + @390 | light + dark | **đã sửa**: khung y hệt Đội chuẩn nhưng bỏ đúng phần dữ liệu không có (không nhãn phạm vi, không tên Trung, không khối điểm, đầu thẻ tướng không có vai trò/chỉ số); panel co theo hàng hành động thay vì để ô trống 340px; "Khắc chế tốt"/"Nên tránh" giữ nguyên chip trung tính |
| — (không có artboard) | `/khai-hoang/gia-cat-khac-sp-ma-sieu-phap-chinh/` @1440 + @390 | light + dark | **đạt**: cùng khung (huy hiệu loại binh ở đầu trang, panel chỉ có hành động + sao chép); khối build "Trước · … → Sau · …" ở hàng 4 cột, hướng dẫn nằm ngoài subtree build. **Nguồn:** đội này **không có** `sources` ở build mặc định và có **1** link ở mỗi biến thể `cn-thoi-phong` / `jp-s23`; đội có **4** link nguồn là **Chu Thái · Trương Phi · Trương Xuân Hoa** (3 nguồn `https` + 1 URL ảnh CDN) — bản đầu của báo cáo ghi nhầm ví dụ này (lỗi ghi chép, không phải mất link) |

Hai chỗ lệch bố cục đã **sửa trong lượt này**: (1) vỏ bài viết còn class `season-config-detail` nên toàn trang
bị bọc trong thẻ panel → bỏ class, thêm rule padding `32/48/56` cho `main.layout` của trang chi tiết và gỡ
`max-width: 64rem`; (2) panel của Đội khác/Khai hoang là ô trống 340px chỉ có một nút → co theo nội dung
(`width: max-content`, padding 16px) và cập nhật probe `panel-diem` cho trạng thái không điểm.

Kiểm thêm bằng đo trực tiếp (Chromium thật): `scrollWidth == innerWidth` ở 320/390/1440 trên cả ba họ trang, **Đính chính P06-R1 (vòng round 3):** phép kiểm `scrollWidth` chỉ chạy trên `gia-cat-khac-sp-ma-sieu-phap-chinh` (nguồn ngắn) nên **đã bỏ sót P06-B1** — panel hành động có thể rộng hơn cột và tràn ra ngoài mép **trái**, mà tràn sang trái thì `scrollWidth` không phát hiện được. Panel nay là `width: fit-content; max-width: 100%; min-width: 0` (con của hàng hành động và ô dự phòng cũng có `max-width: 100%; min-width: 0`), và phạm vi kiểm là **cả 17** trang `/khai-hoang/<slug>/` ở 1440/390/320 cộng ca clipboard bị từ chối, kiểm bằng e2e thường trực trong `khaihoang-options.spec.mjs`;
0 lỗi console/pageerror.

## 9. Rủi ro còn lại / việc của phase sau

1. **Phase 7 (Tra cứu + hồ sơ)** dùng lại được `js/detail-actions.js` (link nguồn đã kiểm scheme + nút sao chép),
   `detailBadges` và khung `.detail-header`/`.detail-section`/`.detail-facts` — nhưng hồ sơ tướng là hộp thoại
   (component `hop-thoai`), không phải trang chi tiết, nên phải kiểm lại bố cục thay vì bê nguyên khung.
2. **Ngân sách tải**: `loadRecommendedDetailView` nay nạp thêm `seasons.json` (124 KB) để có nhãn phe/loại binh
   cho huy hiệu đầu trang. Trang chi tiết vốn đã tải toàn bộ `sourceHashes` (~2,1 MB, finding #18); Phase 7 đo
   ngân sách phải tính cả phần này.
3. **Phase 8** phải mở rộng thẻ Khai hoang theo artboard rồi **bỏ nhánh xếp dọc** trong `.kh-build .kh-hero`
   (hiện chỉ trang chi tiết dùng hàng 4 cột); kiểm lại `.kh-detail-build` không đổi.
4. **Nợ tương phản `--accent` + `--on-accent` theme tối (3,33:1)** vẫn còn ở các component khác (Phase 3/4);
   phase này chỉ sửa chỗ nó tự tạo mới (số thứ tự chiến pháp). Phase 10 xử lý phần còn lại cùng A4.
5. Thẻ Khai hoang/Khai hoang detail hiển thị **4 link nguồn** (gồm URL ảnh `cdn-ak.f.st-hatena.com`) ở panel:
   Phase 8 có thể gom nhãn dài thành "Nguồn (n)" nếu bố cục thẻ cần, nhưng không được bỏ link.
6. `.chart`/`.combo-*`/`.sel-tag`/`.visually-hidden` và `--aliases` vẫn thuộc Phase 10 (ceiling legacy 547).

## 10. Gợi ý commit

```
feat(teams): rebuild the three team detail pages on the TeamDetail frame

- add js/detail-actions.js: scheme-checked source links plus a copy-link button
  that reports the real clipboard result and falls back to a selected readonly URL
- rebuild the detail shell (scope kicker, serif title + Chinese name, faction/unit
  badges, 340px score panel) for Recommended, legacy and Khai hoang
- render the primary lineup as TeamDetail hero cards (role/stat head, ordinal tactic
  rows with Han text, bonds, books, per-owner notes) and number the source notes
- keep every non-artboard section (alternatives, counters, legacy references, source
  metadata); legacy pages omit the absent score and Chinese name instead of faking them
- redesign the shared khaihoangBuildContent ("Trước … → Sau …", son tactic text) for
  both the Khai hoang cards and its detail page; Phase 8 reuses it unchanged
- generalise source URL validation to a shared http(s) check that keeps fragments (Sheets) and
  never throws, while Recommended still rejects fragments, query and malformed escapes
- fix the new detail commander badge contrast with the shared accent-ink treatment (6.37:1 dark)
  and render book rows as Vietnamese-left / Chinese-right without decorative ordinals
- drop the superseded legacy detail CSS (ceiling 570 -> 547), add ten TeamDetail type
  roles and three components with probes, declare 17 authored-vi obligations,
  refresh the localization policy (56457 locations) and re-pin route handles to 2c803111
```

## Opus re-review round 2 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P06-B1** | Panel hành động của trang chi tiết Đội khác/Khai hoang có thể rộng hơn cột và tràn ra **ngoài mép trái** (4/17 trang Khai hoang: panel tới 1570px; ở 390 link nằm ở x ≈ −1179). `scrollWidth` không bắt được vì tràn sang trái không cuộn được | `.detail-score-panel:not(:has(.detail-score)) { width: fit-content; max-width: 100%; min-width: 0 }`; `.detail-actions-body > *`, `.detail-copy-fallback`/`#team-copy-fallback`: `max-width: 100%; min-width: 0`; `.detail-source-link`: `white-space: normal; overflow-wrap: anywhere; text-align: start` | e2e mới `khaihoang-options.spec.mjs` chạy **cả 17** trang `/khai-hoang/<slug>/` ở 1440/390/320: mọi `a/button/input` trong panel có `left ≥ 0` và `right ≤ innerWidth`, và panel không giao với tiêu đề trang; thêm ca Đội khác khi `clipboard.writeText` bị từ chối (390/320: mép trái ≥ 0, ô dự phòng hiện). Đo trực tiếp 15 tổ hợp trước/sau: 0 vi phạm, ảnh `kh-panel-320-light.png` cho thấy 4 link nguồn xuống dòng trong khung |
| **P06-B2** | Link "Mở nguồn SGSDeck trong thẻ mới" dùng **màu link mặc định của trình duyệt** (`rgb(0,0,238)` / `rgb(158,158,255)`) vì mất wrapper `season-config-detail` | `js/recommended-reference-render.js`: thêm `class:'detail-link'` (đã token hoá, đang dùng cho "Xem trang đội gốc") ⇒ vùng bấm 44px luôn, màu `--ink`/`--accent` theo theme | Đo: `class="detail-link"`, cao **44px**, màu `rgb(30,27,22)` (token), nền `--panel-3`; e2e mới trong `a11y-targets.spec.mjs` (320/390 × 2 theme) khẳng định cao/rộng ≥ 44, màu **không** thuộc bộ màu link mặc định, Enter mở tab mới |
| N6-1 | §8 trước đây khẳng định "không tràn ở 320/390/1440" nhưng chỉ đo một trang Khai hoang có nguồn ngắn | §8 sửa: phạm vi đo nay là cả 17 trang + ca clipboard bị từ chối (xem e2e ở trên) | §8 cập nhật; e2e bao phủ toàn bộ 17 slug |

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
