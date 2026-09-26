# Phase 5 — Báo cáo: Đội chuẩn / Đội khác (lọc, thẻ, Thẻ/Bảng)

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-05](../phase-05-doi-danh-sach.md).
Phạm vi: dựng lại hai trang danh sách đội theo artboard Main / MainTable / MobileList / MobileTable /
MobileFilters — đầu mục, sidebar lọc 272px, panel lọc mobile, thanh công cụ có chuyển Thẻ/Bảng, thẻ đội gọn,
bảng 5 cột, bỏ bộ lọc điểm, ghi nhớ chế độ xem. Bản này đã sửa **cả bốn yêu cầu của phiên review Kongming**
(P05-1 thẻ gọn + vùng bấm 44px, P05-2 thứ tự/bố cục thanh công cụ, P05-3 thứ tự tên `nickname || name`,
P05-4 khôi phục probe `badge-phe`) cùng hai nit (focus sau "Xóa lọc", ca quay lại bấm link thật + so danh tính)
— xem §4, §5, §8. Bộ A2 đầy đủ chạy xanh sau khi land mọi việc của phase (§7). Chưa commit — orchestrator
commit sau go/no-go.

## 1. Việc đã làm (theo bước trong phase file)

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | Đầu mục `.reference-head`: nhãn caps son, h1 serif 48px (36px mobile), mô tả 15px; select Mùa nguồn + Danh mục (44px) bên phải (desktop) / lưới 2 cột trên ô tìm (mobile) | xong — §4 |
| 2 | Sidebar `.reference-filters` 272px: "Bộ lọc" + "Xóa lọc" (`disabled` khi không có lọc), nhóm Loại binh/Phe dạng hàng có ô vuông chọn + ô vuông phe + nhãn + số đếm; nhóm phụ thu gọn bằng `aria-expanded` **chỉ khi có dữ liệu**: `/doi-chuan/` **không** có nhóm "Nhóm"/"Nguồn" (dữ liệu `subcategoryRaw` rỗng 1366/1366, `source` null 1366/1366 ⇒ `facetGroup()` bỏ nhóm rỗng — D2, không bịa facet), `/doi-khac/` có nhóm "Nguồn" (`Meta phe (cũ)` / `Giới thiệu`). *(Đính chính audit 260926 P5-2: bản trước ghi "Nhóm/Nguồn thu gọn" như đã dựng cho cả hai trang là sai.)* Mobile: nút "Bộ lọc" kèm số lọc đang bật mở panel (chip viên 44px) | xong — §3, §4 |
| 3 | Bỏ facet `score`: xóa khỏi state/projector/UI, bỏ `canonicalScoreValue`/`rowScoreValue`/`SCORE_UNKNOWN`; URL cũ có `score=` bị bỏ qua và bị xóa ở lần `replaceState` đầu | xong — §2, §6 |
| 3b | `safeReturnUrl` giữ `view` cho `/doi-chuan/` + `/doi-khac/`, `score` không còn trong allowlist nên tự bị bỏ; `safeDisclosures` bỏ `score` | xong — §6 |
| 4 | Thanh công cụ: ô tìm 48px có icon, "x / y đội" (`role="status"`), nhóm 2 nút Thẻ \| Bảng `aria-pressed` (desktop có chữ, mobile icon 44×44) | xong — §4 |
| 5 | Thẻ gọn: header tên serif 19px (link) + "■ phe · binh" + điểm serif son 28px + "điểm"; mỗi tướng có vai trò viết tắt, tên 600, chiến pháp là nút tìm, dòng "Binh thư · …" (trống → nghiêng "Nguồn chưa ghi"); footer "Sợ …" (counters `avoid`) + "Thay thế (n) ▾" (`<details>` giữ nguyên) + "Chi tiết →"; bỏ chip ⚔/⚠ | xong — §4, §5 |
| 6 | Bảng 5 cột `<table>` (`<th scope="row">` cho đội), hàng xen màu; adapter Recommended (`displayNameVi`/`heroes`/`tacticSlotsVi`/`value`) và legacy (`nickname \|\| name`/`holders`, điểm vắng → "—"); link chi tiết giữ `sourceConfigId`/`legacyTeamId`+`legacyVariantId`; mobile xếp lại thành hàng thu gọn theo MobileTable, không cuộn ngang | xong — §4, §5 |
| 7 | Ghi nhớ chế độ: `?view=bang` chỉ khi Bảng (replaceState), ghi `localStorage['tqccl.teamView.v1']`, URL > storage > Thẻ, lỗi storage → Thẻ; dùng chung hai trang | xong — §2, §6 |
| 8 | 33 obligation `authored-vi` cho chữ mới; 2 obligation `translate` của trang giữ nguyên chữ và vị trí (không cần receipt) | xong — §6 |
| 9 | Cặp so ảnh Main / MainTable / MobileList / MobileTable / MobileFilters (`ready` của 2 cặp bảng đổi sang hàng bảng, MobileFilters mở panel) | xong — §5 |

## 2. Chế độ Thẻ/Bảng (bước 7) — quyết định và bằng chứng

- **Nguồn chân lý:** `readRecommendedQuery()` đọc `view` (`the`/`bang`, giá trị lạ bị bỏ kèm thông báo);
  `resolveTeamView(urlView, storage)` = URL > `localStorage['tqccl.teamView.v1']` > `the`; app.js ghi storage
  chỉ khi thao tác đổi chế độ (`Object.hasOwn(changes,'view')`), nên đổi bộ lọc/mùa không ghi đè lựa chọn.
- **Module mới `js/team-view.js`** (thuần, không DOM): `canonicalTeamView` tra bằng own-property, đọc/ghi
  storage bọc `try/catch` (chặn cả trường hợp `localStorage` ném lỗi khi truy cập), `resolveTeamView`.
  Renderer bảng nằm trong `js/recommended-reference-render.js` để dùng lại `localizedSlot`/`holderNameNodes`
  (không dựng bản adapter thứ hai như bản xem trước của Landing).
- **`view` thuộc URL, không thuộc snapshot:** `safeDisclosures` chỉ còn `filters` + `alternatives`; `view` sống
  sót vòng list → detail → Back vì nằm trong `SECTION_QUERY_KEYS` của hai trang.
- **Focus sau khi xóa lọc (nit Kongming):** "Xóa lọc" là nút duy nhất không có `data-focus-key` và bị vô hiệu
  sau khi xóa nên trước đây focus rơi về `BODY`; nay handler trả focus về ô tìm kiếm
  (`searchInput.focus({preventScroll:true})`) — đã kiểm `document.activeElement` sau khi bấm.
- e2e: `Thẻ/Bảng remembers the choice, keeps filters and lets the URL win over storage` (đổi chế độ giữ bộ lọc +
  không thêm bước lịch sử, reload giữ chế độ, Đội khác dùng chung lựa chọn, `?view=bang` thắng storage);
  `list to detail and Back from the table view restores view, filters and scroll` (danh tính bản ghi + vị trí cuộn).

## 3. Bỏ bộ lọc điểm (bước 3, 3b)

- `REPEATABLE` còn `faction, unit, subcategory, source`; xóa `canonicalScoreValue`, `rowScoreValue`,
  `SCORE_UNKNOWN` và nhánh `score` của `readFacet`. **Điểm nguồn vẫn hiển thị và vẫn quyết định thứ tự nguồn**
  (`fixedRank` không đổi).
- URL cũ: `app.js` có `stripRetiredReferenceParams(pageSection)` — chạy ngay sau `stripTrackingParams()`, xóa
  `score` bằng `replaceState` (không thêm bước lịch sử) trên đúng hai trang danh sách.
- `legacy-routes.js` giữ nguyên danh sách khóa root đóng băng (có `score`) nên `/?score=113` vẫn chuyển sang
  `/doi-chuan/?score=113` rồi bị xóa tại chỗ — xác nhận bằng e2e.
- e2e thay ca facet điểm: URL `?season=…&score=113` → đủ số đội của mùa, không còn nhóm "Điểm" trong sidebar,
  và `search` sau khi tải là `?season=…` (không còn `score`).

## 4. Micro (tự động)

- `node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`, 0 mã màu / 0 giá trị thô ngoài
  khối legacy; **ceiling legacy 600 → 570** (570 giá trị thô trên 271 selector).
- `node scripts/design-compare.mjs --tokens --phase 05` (light + dark):
  `485/486 thuộc tính khớp token · 0 lệch chưa giải thích` ở **cả hai theme** (1 ngoại lệ có sẵn của
  `select-nhan-caps`: Chrome tính `line-height: normal` cho `<select>`).
- **Đo trực tiếp cho P05-1/P05-2 (Chromium thật, light + dark):** nút chiến pháp trong thẻ cao **44px** ở
  390/320 (desktop 26px), không chồng nút kế tiếp (kiểm giao hai hình chữ nhật); hàng tướng có nền **trùng nền
  thẻ** và `border-radius: 0` (hết vỏ panel `--bg`/radius 8 của component chung); `.heroes` `row-gap: 0`;
  dòng binh thư `display: block`; thứ tự mobile `search(1) → Bộ lọc(2) → số đội(3) → Thẻ/Bảng(4)`
  (390: ô tìm một hàng riêng full width, bên dưới Bộ lọc/số đội/Thẻ–Bảng chung một hàng; 320: Thẻ/Bảng xuống thêm một hàng **theo đúng thứ tự DOM**); hai select phạm vi desktop cùng
  một hàng; khoảng cách thanh công cụ → kết quả **20px** (trước là 72px do giữ hàng trống cho notice ẩn).
- Component trong danh mục:
  - **Thêm mới:** `head-doi` (đầu mục), `sidebar-loc` (panel lọc), `chuyen-the-bang` (2 nút Thẻ/Bảng).
  - **Bổ sung probe (kèm trạng thái bật/mở):** `the-doi` (đầu thẻ, tên đội, dòng phe·binh, nhãn điểm, chân thẻ,
    dòng "Sợ", disclosure "Thay thế", mobile), `dong-tuong` (hàng tướng, vai trò, tên, binh thư), `bang`
    (khung, đầu bảng, ô đội, tên đội, ô tướng, chiến pháp, ô điểm, hàng xen, hàng mobile), `chip-loc`
    (hàng lọc desktop + hàng đang bật + chip viên mobile + chip viên đang bật), `so-diem` (biến thể ô bảng),
    `nut-khac-che` (chip trung tính trên trang chi tiết đội gốc).
  - **Nợ Phase 1 — tương phản `.chip.good` 4,47:1:** chip khắc chế nay trung tính (mực `--ink-2` trên `--panel-3`,
    viền `--line`), nghĩa khắc được/nên tránh do nhóm "Khắc chế tốt"/"Nên tránh" nói. Đo lại trong DOM thật:
    `#team-detail-body .chip.good` = 26px/9px/radius 6/nền `#F7F2E8`/chữ `#3A352D` (≈10,9:1) ở light.
  - **Chuyển host probe:** `badge-binh` đo trên `/khai-hoang/` (bảng Khai hoang dùng cùng component).
    `badge-phe`: **giữ probe và đo trên host thật đang có là thẻ xem trước ở Landing**
    (`#dau-trang .landing-preview-card .badge.faction` — 28px/11px/radius 999/nền `--panel`/viền `--line`/chữ
    `--ink`, đúng bạc component, đã đo ở cả hai theme). Bản báo cáo trước nói "không còn host" là **sai**; đã
    sửa theo đúng ruling REJECT của Kongming. Probe cho trang chi tiết đội do Phase 6 thêm.
  - **Biến thể thay vì nới chuẩn (P05-1):** `nut-chien-phap` tách hai biến thể có probe riêng — chip son nhạt
    (Landing, trang chi tiết) đo trên Landing, và chữ son bấm được của thẻ danh sách đo trên `/doi-chuan/`
    (desktop 26px, mobile 44px). Không sửa chuẩn của component để hợp thức hoá kiểu kế thừa.
- **Tương phản (đo computed style trên DOM thật, cả hai theme, 40 cặp):** mọi cặp chữ mới đạt ≥ 4,5:1
  (chữ thường) và ≥ 3:1 (điểm 22/28px), thấp nhất là `điểm nguồn` 5,04:1 và `nhãn Sợ` 5,04:1 ở theme tối;
  ví dụ: nhãn ĐỘI HÌNH 6,25 / 5,52; dòng "■ phe · binh" 6,69 / 6,43; vai trò tướng 5,92 / 7,04;
  chân trang "Sợ" 6,69 / 6,43; đầu bảng 8,88 / 8,88; tên đội (bảng) 16,75 / 13,53; nút Thẻ đang chọn 15,01 / 15,54;
  chip khắc chế trên trang chi tiết **10,9 / 8,88** (trước đây 4,47:1).
- Công cụ so ảnh: `scripts/design-compare.mjs` thêm init script dọn `localStorage` (trừ `theme`) +
  `sessionStorage` mỗi lần tải trang, để probe sau không đo nhầm trạng thái do probe trước để lại (chế độ Bảng
  ghi storage; panel lọc ghi snapshot). Vỏ bảng của Landing (`min-width: 420px`…) nay chỉ áp trong
  `.landing-table-preview`, không còn đè lên bảng danh sách.

## 5. Bố cục (người duyệt)

5 ảnh ghép × 2 theme ở `.cache/design-compare/phase-05{,-dark}/` (không commit).

| Artboard | Trang | Đã xem | Kết luận |
|---|---|---|---|
| Main | `/doi-chuan/` @1440 | light + dark | **đã sửa**: đầu mục 1 hàng có select bên phải; sidebar 272px với hàng lọc có ô vuông + ô vuông phe + số đếm; thanh công cụ ô tìm 48px + "25 / 25 đội" + nhóm Thẻ\|Bảng (Thẻ đang chọn nền dải); lưới **2 cột** thẻ gọn |
| MainTable | `/doi-chuan/?view=bang` @1440 | light + dark | **đã sửa**: khung bo góc, đầu bảng nền giấy đậm 11 caps, hàng xen màu, ô đội = tên serif + "■ phe · binh", ô tướng = tên + 2 chiến pháp son, ô điểm serif son. *(Đính chính audit 260926 P5-6: câu cũ "ô điểm căn phải" là **sai** tới trước vòng sửa 260926 — `th, td { text-align:left }` (0,2,1) đè `.reference-table-score` (0,2,0), đo `textAlign = 'left'`; nay đã căn phải thật, xem mục "Audit 260926".)* |
| MobileList | `/doi-chuan/` @390 | light + dark | **đã sửa**: đầu mục xếp dọc, 2 select lưới 2 cột, ô tìm full width, hàng [Bộ lọc][25 / 25 đội][Thẻ\|Bảng], thẻ 1 cột có dòng binh thư và chân thẻ |
| MobileTable | `/doi-chuan/?view=bang` @390 | light + dark | **đã sửa**: hàng thu gọn tên + "■ phe · binh" + danh sách tướng + điểm bên phải; không cuộn ngang (đo `scrollWidth = clientWidth` ở 320/390) |
| MobileFilters | `/doi-chuan/` @390 (mở panel) | light + dark | **đã sửa**: panel lọc bo góc sau hàng công cụ với chip viên 44px |

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
|---|---|---|---|
| Câu mô tả đầu mục | "Cấu hình tham khảo từ SGSDeck, giữ đúng thứ tự nguồn." | "Dữ liệu đề xuất của SGSDeck được phân chia theo mùa tương ứng trong nguồn." (Đội chuẩn) / "Các đội có sẵn, đã đối chiếu với đội chuẩn." (Đội khác) | Đây là obligation `translate` đã duyệt (`ui:recommended/introduction`); đổi chữ cần receipt độc lập nên giữ nguyên chữ đã duyệt, chỉ áp kiểu 15px (bước 1) |
| Hàng lọc cao 36px (sidebar) | `min-height:36px` | 44px (`control.44`) | Contract §11.4 + A5 (vùng bấm ≥ 44px); giữ một con số cho cả hai bề rộng |
| Chip lọc trong panel mobile | 40px desktop/44px | 44px | như trên |
| Nhãn select phạm vi | 12px/600 chữ thường | 11 caps (`type.field-caps`) | StyleGuide mục "Tìm kiếm · chọn" là bản mới hơn: "Select cao 44 có nhãn caps phía trên" |
| "Xóa lọc" trên mobile | nằm cùng hàng công cụ (chỉ ở artboard MobileFilters) | nằm trong đầu panel lọc | Một nút duy nhất dùng cho cả hai bề rộng; đứng ngay trên các nhóm lọc mà nó xóa |
| "Thay thế (n) ▾" | cùng hàng chân thẻ | hàng riêng ngay trên chân thẻ (chọn có chủ đích) | Giữ `<details class="reference-alternatives">` hiện có; đặt summary cùng hàng buộc phải bọc body ra ngoài phần tử details |
| Mũi tên disclosure | chevron phải | marker gốc của `<details>` | Giữ hành vi bàn phím/AT gốc, không dựng chevron giả |
| Bảng: chip "+N thay thế" ở ô đội | có | không | Bước 6 chốt ô đội = tên + "■ phe · binh"; số thay thế vẫn hiện ở thẻ và ở disclosure của thẻ |
| Bảng: chiến pháp là chữ, không bấm | chữ son | chữ son | Bước 6 không yêu cầu nút tìm trong bảng; nút tìm nằm ở thẻ |
| Thẻ Đội chuẩn không có chữ "Sợ" | artboard vẽ `Sợ …` | không có dòng nào | Dữ liệu: 0/1366 bản ghi Đội chuẩn có counters `avoid` (9/40 ở Đội khác) — không để khoảng trống, ghi độ lệch ở đây theo bước 5 |
| "Chưa có điểm nguồn" trên thẻ | không vẽ | hiện ở đội thiếu điểm | Bước 5: "không hiện số"; giữ nhãn trung tính thay vì bịa số 0, và bảng ghi "—" |
| Bảng trên mobile | hàng `<a>` thu gọn | cùng một `<table>`, CSS xếp lại thành hàng thu gọn | Không dựng hai DOM; giữ ngữ nghĩa `<th scope="row">`, không cuộn ngang |
| Vỏ trang mục | `main` 40/48/56 · 24/16/32 | áp cho đúng hai trang danh sách | Các trang mục khác thuộc phase sau; không đổi bố cục trang không thuộc phase này |
| Thanh công cụ ở 320 | không vẽ | Thẻ/Bảng xuống hàng riêng sau ô tìm + Bộ lọc + số đội | Ba điều khiển 44px không vừa một hàng; wrap theo đúng thứ tự DOM (đã đo) |
| Bảng mobile | không vẽ 5 cột | ẩn 3 ô tướng chi tiết, hiện dòng danh sách tướng | Ruling Kongming: hàng thu gọn theo MobileTable, và báo cáo không được nói mọi ô desktop còn hiện |

## 6. Policy bản dịch (bước 8 / quy trình bước 2)

- **Thêm 33 obligation `authored-vi`**: `js/team-filter-section.js` 16 (nhãn đầu mục, Bộ lọc, Xóa lọc, Mùa nguồn,
  Danh mục, Kiểu hiển thị, Thẻ, Bảng, 2 aria-label chế độ, 4 nhãn facet, placeholder tìm, empty) và
  `js/recommended-reference-render.js` 17 (5 nhãn cột bảng, 3 vai trò tướng, Binh thư ·, Nguồn chưa ghi, điểm,
  Chưa có điểm nguồn, Sợ, Thay thế, Chi tiết, "Tìm chiến pháp này", "—"). Không cần receipt (lớp `authored-vi`).
- 2 obligation `translate` của danh sách giữ **nguyên tại chỗ và nguyên chữ** (`ui:recommended/introduction`,
  `ui:app/team-chuan-title`/`team-khac-title`) ⇒ không cần receipt độc lập. "Phương án thay thế"/"Xem chi tiết"
  đổi thành "Thay thế (n)"/"Chi tiết →": hai chuỗi này **không** nằm trong `UI_LITERAL_OBLIGATIONS` hay ledger
  (đã kiểm), nên đổi chữ không cần receipt; đã khai báo mới là `authored-vi` (`ui:recommended/alternatives`,
  `ui:recommended/detail-cta`).
- `sourceFiles`: 50 file, làm mới hash cho `js/app.js`, `js/render.js`, `js/team-filter-section.js`,
  `js/recommended-reference-render.js`, `js/recommended-reference-state.js`, `js/team-detail-navigation.js`
  (`js/team-view.js` không có chữ UI nên không vào tập nguồn).
- `policyVersion`: `site-vi-260925-landing-preview` → **`site-vi-260925-doi-danh-sach`**.
- `baseline.notes` cũ → mới:

| Khóa | Trước phase 5 | Sau |
|---|---|---|
| `concreteLocationCount` | 56 407 | **56 440** |
| `concreteInventorySha256` | `d95ef34f…` | **`9c9015c2…`** |
| `siteLedgerObligations` / `translationObligations` / `uiTranslateObligations` / `lookupReviewObligations` | 2 088 / 5 591 / 68 / 3 503 | không đổi |

- Generation + re-pin: `build --stage all` → `check --stage all --candidate` (exit 0) → `publish` →
  `check --stage public` (exit 0, `uiPending` 68, 0 problem) → `python3 -m pipeline.team_route_handles --check`
  (1366 recommended / 166 legacy / 17 Khai hoang). `generationId`:
  `8eec9bac…` (Phase 4) → `2fd184a9…` (bản đầu của phase) → **`e14550ae1449295a7ed00150a4095ec5e091e70ed5c9df901a793c6956c9cd1f`**
  (sau vòng sửa theo review); các generation trung gian `7b915b011e6a…`, `2fd184a9…`, `e8ac2168…` đã xóa
  (không file nào tham chiếu). Vòng sửa chỉ đổi mã/kiểu nên obligation và baseline không đổi (56 440 vị trí, cùng digest).
  `data/website-display.json` generation `site-localization:…` theo lần publish cuối; `index.json` của generation chốt
  **trùng byte** với generation Phase 4 (3 374 425 byte).
- `tests/test_site_localization.py`: **không phải sửa số ghim** (368 OK) — các con số ghim là của lớp `translate`
  và lookup, không đổi.

## 7. Gate (bộ A2)

| Lệnh | Kết quả |
|---|---|
| `npm run check` | pass — `site_localization check --stage public` exit 0, `astro check` 0 error (1 hint có trước ở `team-detail-routes.ts`) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass — 1726 file dist (55 raw asset, 16 file `public/` tĩnh) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **337/337 pass** (334 + 3 test mới cho `js/team-view.js`) |
| `npm run test:e2e` | **210/210 pass** |
| `python3 -m unittest discover -s tests` | **368 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 570 = ceiling 570) |
| `node scripts/design-compare.mjs --tokens --phase 05` (+`--theme dark`) | 485/486 · 485/486, 0 lệch chưa giải thích |

## 8. Test sửa/thêm có chủ đích + lý do

1. `tests-js/recommended-reference-state.test.mjs` — **xóa 2 ca facet điểm** (bộ lọc đã bỏ), fixture bỏ khóa
   `score`; **thêm** ca `view` (hợp lệ/lặp/giá trị lạ) và ca "`score` không còn là facet và không lọc gì".
2. `tests-js/team-detail-navigation.test.mjs` — ca `safeReturnUrl` cũ kỳ vọng `score` sống sót; nay kỳ vọng
   `score` bị bỏ và **thêm** ca `view=bang` sống sót; ca snapshot bỏ `score` khỏi `disclosures` (và `view` không
   nằm trong snapshot).
3. `tests-js/team-view.test.mjs` — **spec mới 3 test** cho module mới: canonical hóa giá trị, thứ tự
   URL > storage > Thẻ, storage lỗi (đọc/ghi/`localStorage` ném lỗi) không chặn render.
4. `tests-e2e/recommended-browser.spec.mjs` (38 test):
   - thẻ gọn: `.books` là dòng chữ (không còn tag/buitton), vai trò viết tắt `.reference-role`, CTA "Chi tiết";
   - facet: thứ tự nhóm `['Loại binh','Phe']` và nhãn chip `${label} ${count}` (bỏ "(n)");
   - thay ca facet điểm bằng ca "URL `score=113` bị bỏ qua và bị xóa khỏi URL";
   - thay ca chip khắc chế bằng ca dòng "Sợ …" (không còn `.counters`/`.chip`, và Đội chuẩn không có dòng này);
   - lưới thẻ 1440/1100 → **2 cột**, 800/375/320 → 1 cột;
   - thêm 2 ca mới: ghi nhớ Thẻ/Bảng (reload, dùng chung hai trang, URL thắng storage, giữ bộ lọc, không thêm
     bước lịch sử) và "Bảng → chi tiết → Back" trả lại đúng chế độ + bộ lọc + vị trí cuộn;
   - hai ca cuộn đổi sang **cuộn tức thời** (`scrollBehavior='auto'`) trước khi ghi mốc: legacy có
     `html { scroll-behavior: smooth }` nên đọc `scrollY` ngay sau `scrollTo` là giá trị giữa animation
     (nguồn flaky, không phải lỗi sản phẩm).
5. `tests-e2e/team-detail-pages.spec.mjs` (26 test) — hai ca quay lại bấm `.score-toggle`/`.score-group .fchip`
   viết lại: ca "return link" giữ panel lọc + `<details>` (bỏ nhóm điểm, bỏ chuyển chế độ vì chế độ đã có ca
   riêng), ca còn lại dùng `view=bang` + unit + faction + tìm kiếm, chọn bản ghi **có route handle** (bảng chỉ
   dựng link khi có handle) và sửa kỳ vọng cuối cho đúng chiều history (goForward → danh sách).
6. `tests-e2e/spa-parity.spec.mjs` — ca "legacy score query" trước đây kỳ vọng đích chuyển tiếp giữ `score`;
   bộ lọc điểm đã bỏ nên nay kỳ vọng `/doi-chuan/` (bảng khóa root đóng băng vẫn nhận diện `score`) và xác nhận
   danh sách hiển thị, không còn nhóm "Điểm".
7. `tests-e2e/recommended-browser.spec.mjs` (vòng sửa Kongming, 40 test): **thêm** ca "compact cards drop the
   hero panel and give tactic buttons a 44px mobile hit box" (vùng bấm ≥44px, không chồng nhau, hàng tướng nền =
   nền thẻ, radius 0, binh thư `display:block`, bấm chiến pháp ra `q`) và ca "the legacy table names rows by
   nickname before name without touching identity" (`nickname || name`, link thật, `data-legacy-team-id` +
   `variant`); **viết lại** ca quay lại từ Bảng: bấm link đang render bằng click DOM (không để công cụ tự cuộn
   hộ nên mốc cuộn ghi lại là mốc người dùng), chờ `aria-busy=false`, và so **đúng danh tính từng hàng** trước/sau.
8. `tests-e2e/season-lookup.spec.mjs` — ca "closing details after a search" bám `#section-team-khac h2`; đầu mục
   danh sách nay là `h1.reference-title` theo artboard Main nên đổi selector focus.
9. `scripts/design-compare.mjs` — `ready` của `MainTable`/`MobileTable` đổi sang hàng bảng, `MobileFilters` sang
   `.reference-toolbar` + mở panel; thêm init script dọn storage mỗi lần tải (giữ `theme`).
10. `docs/design/so-binh-phap/tokens.json` — 3 vai trò chữ mới (`section-title-mobile` 36px, `table-name` 16.5px,
   `hero-role` 10.5/0.08em — đều có nguồn artboard), 3 component mới, probe mới cho 6 component, `nut-phu`/
   `so-diem`/`badge-phe`/`badge-binh` cập nhật selector/host.
11. `css/styles.css` — khối "Phase 5" cuối file; xóa 26 rule legacy đã bị thay (chip cũ, nhóm điểm, nút điểm,
   vỏ thẻ cũ, disclosure cũ, `.badge.score`, `.reference-score.missing-score`, `.fchip` legacy) ⇒ ceiling 600 → 570;
   vỏ bảng của Landing thu về `.landing-table-preview`; thêm biến thể thẻ gọn (bỏ vỏ panel, chiến pháp chữ son,
   binh thư chảy dòng, vùng bấm 44px mobile), thứ tự toolbar tường minh và `.reference-results-body` gộp
   notice/kết quả nên hết hàng trống 72px.

## 9. Rủi ro còn lại / việc của phase sau

1. **`badge-phe`**: probe đang đo trên thẻ xem trước ở Landing (host thật, đúng chuẩn component);
   **Phase 6 thêm host trang chi tiết đội** khi trang đó dựng huy hiệu phe.
2. **`.visually-hidden`/khối legacy còn lại**: `.team-filters`, `.team-filter-bar`, `.filter-bar`, `.combo-*`,
   `.sel-tag`, `.section-intro*` giờ không còn màn hình nào dùng (chỉ `js/team-pk.js`/`js/meta-cu.js` chưa bị xóa);
   Phase 10 quét nốt cùng `--aliases` (`--radius`, `--shadow`).
3. **Tương phản nút son ở theme tối (Phase 10/A4)**: `.view-btn[aria-pressed=true]`, `.filter-collapse-toggle`
   (mobile, khi mở) và `.ana-link-btn` dùng `--band` + `--band-ink` (đo được, cao); nhưng cặp `--accent` +
   `--on-accent` (3,33:1 dark) của Phase 3/4 vẫn chưa xử lý — không thuộc phase này.
4. **Chiều cao hàng bảng**: hàng dài hơn artboard một chút vì ô tướng có 2 dòng chiến pháp (artboard cũng vậy)
   và hàng mobile giữ link 44px theo A5; không khóa `min-height` thật cho `<tr>` (bảng không nhận).
5. **`view` trong storage là trạng thái dùng chung toàn origin**: người dùng mở Bảng ở Đội chuẩn rồi vào Đội
   khác cũng thấy Bảng (đúng contract bước 7); nếu sau này muốn tách theo trang thì đổi khóa
   `tqccl.teamView.v1` → `.v2`.
6. `.cache/site-localization-candidate/`, `.cache/design-compare/`, `.cache/inventory.json` là scratch (gitignored).

## 10. Gợi ý commit

```
feat(teams): rebuild the team lists with a filter sidebar, compact cards and a table mode

- add js/team-view.js (URL > localStorage > Thẻ) and persist the Thẻ/Bảng choice
- retire the source-score facet: drop it from the projector, the facet UI and the
  return-query allowlist; strip a stale `score=` on load and add `view` for the lists
- rebuild createRecommendedSection: page head with season/category scope, 272px filter
  sidebar (checkbox rows, Phe swatches, collapsible Nhóm/Nguồn), mobile filter panel,
  toolbar with a 48px search, scoped x/y status and the Thẻ|Bảng toggle (aria-pressed)
- rebuild the compact team card (■ phe · binh, serif score, role-labelled hero rows,
  "Binh thư · " line, Sợ …/Thay thế (n)/Chi tiết →) and drop the ⚔/⚠ counter chips
- add the five-column table adapter for Recommended and legacy rows (missing score is "—")
  with an internal mobile layout that never scrolls the page sideways
- make the counter chip neutral (--ink-2 on --panel-3) so `.chip.good` clears 4.5:1
- scope the Landing preview table shell to .landing-table-preview and make design-compare
  reset per-page storage before each probe
- extend the component catalog (head-doi, sidebar-loc, chuyen-the-bang + probes for
  the-doi, dong-tuong, bang, chip-loc, so-diem, nut-khac-che) and lower the legacy ceiling
  600 -> 570
- declare 33 authored-vi obligations, refresh the localization policy (56440 locations),
  republish the generation and re-pin route handles to 2fd184a9
```

## Opus re-review round 2 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P05-B1** | Ô vuông phe trong hàng lọc **không bao giờ được vẽ**: `.fchip[class*="f-"]::before` (bản viết lại ở commit 4fcdd0d) đặt bề rộng/màu nhưng thiếu `content`, nên probe token vẫn xanh trong khi không có gì hiển thị (cả sidebar 1440 lẫn panel lọc mobile 390) | Thêm `content: var(--content-dot); display: inline-block; flex: none;` (token mới `content.dot` = `""`, nguồn artboard `Main.dc.html:74-76`); probe `chip-loc` bổ sung `content` (đo trên `::before` qua `probe.pseudo` mới của `design-compare`) | `getComputedStyle(chip, '::before').content` = `'""'`, hộp **8×8**, `display: block`, nền = màu phe `rgb(176,132,34)` cho hàng Quần; ảnh `sidebar-1440-light.png` cho thấy thứ tự **ô chọn → ô vuông phe → nhãn → số** ở 1440 và 390 cả 2 theme; `design-compare --tokens --phase 05` = 631/632, 0 lệch chưa giải thích |
| N5-1 | Nút "Xóa lọc" khi rỗng trông y như đang bấm được (son, có hover) | `.clear-btn:disabled { color: var(--muted); cursor: not-allowed }`, `::before` mờ, hover không đổi nền; probe `nut-chu` tách 2 trạng thái (enabled có `setup` bật một chip, disabled mong đợi `color.light.muted`) | Ảnh sidebar 1440 (không có lọc): nhãn + icon mờ, không còn affordance đỏ; probe 2 trạng thái xanh cả 2 theme |
| Sửa báo cáo | §1/§4 ghi "chấm phe" trong sidebar là **sai** cho tới khi P05-B1 được sửa | Sửa lại thành "ô vuông phe" và ghi rõ vòng sửa | §1 và §4 cập nhật trong cùng commit này |
| Chưa áp (ghi lại) | N5-2 (cột nhãn vai trò trên thẻ mobile lệch ~8px), N5-3 (canonicalise `?view=the`) | Không sửa trong vòng này | Cần đo lại bố cục thẻ mobile và thêm một lần `replaceState`; để vòng sau |

## Vòng nit (2026-09-26) — N5-2, N5-3, N5-4 đã sửa

| # | Nội dung | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| N5-2 | Cột nhãn vai trò của hàng tướng trên thẻ mobile lệch (~8px). | **Đây là lỗi thật:** `var(--space-38)` dùng ở `css/styles.css` nhưng **chưa từng được khai**, nên `grid-template-columns` vô hiệu lúc tính (→ `none`) và hàng tướng mobile mất cột nhãn/tên. Thêm token thật `size.col-hero-role` = 38px (nguồn `MobileList.dc.html` dòng tướng `38px minmax(0, 1fr)`) và `column-gap: var(--space-8)` đúng artboard (trước kế thừa 10px của bản rộng). | `design-tokens --check` pass; rà toàn file còn **0** custom property chưa khai; probe `dong-tuong` (mobile: `row-gap`, nền, viền) vẫn xanh cả 2 theme; `design-compare --tokens --phase 05` 642/643 (1 ngoại lệ đã khai của `select`) |
| N5-3 | Canonicalise `?view=the`. | `js/app.js` thêm `canonicaliseView()` chạy sau render: bỏ `view` nếu không phải `bang`, gộp bản lặp, và dùng `history.replaceState` (không thêm mục lịch sử); lượt đọc đầu vẫn hiện thông báo cho giá trị không hợp lệ. | e2e `recommended-browser.spec.mjs`: `?view=the`, `?view=the&q=…`, `?view=bang`, `view` lặp, giá trị lạ, và Back rời trang |
| N5-4 | Escape đóng panel lọc mobile. | `js/team-filter-section.js`: `keydown` trên vùng kết quả, chỉ hành động khi panel mở **và** nút "Bộ lọc" thực sự được vẽ (`getClientRects().length`) nên desktop là no-op; đóng rồi trả focus về nút. | e2e mới trong `recommended-browser.spec.mjs` (390: mở → Escape → `aria-expanded=false` + focus ở nút + chip ẩn; mở lại bằng Enter; 1440: focus và sidebar không đổi) |
| N-f | Hộp thoại hồ sơ 821–1279 rộng hết màn hình. | Khối `@media (max-width: 1279px)` đặt `.lookup-backdrop { padding-inline: var(--space-40) }`: hộp thoại 960px luôn chừa lề hai bên (chỉ co thật dưới 1040px); khối ≤680 giữ padding riêng và đứng sau nên thắng ở mobile. | `design-compare --tokens --phase 07` **531/531** cả hai theme; khối ≤680 không đổi |

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

## Audit 260926 — sửa theo ảnh ghép

Nguồn: `agent://AuditTeamLists` (Phase 5). Đo lại trên dev server + ảnh ghép `.cache/design-compare/phase-05{,-dark}/` (Main, MainTable, MobileList, MobileTable, MobileFilters).

| Finding | Trạng thái | Chi tiết |
|---|---|---|
| P5-1 thứ tự chip lọc | **đã sửa** | `js/team-filter-section.js` `facetEntries`: sắp theo **số đếm giảm dần**, hòa thì theo nhãn hiển thị tiếng Việt (`localeCompare(…,'vi')`) thay vì giá trị Hán thô. Đo: `/doi-chuan/` `Cung 14 \| Kỵ 5 \| Khiên 4 \| Thương 1` · `Quần 9 \| Thục 5 \| Ngô 4 \| Ngụy 3` (đúng artboard); `/doi-khac/` `Cung 11 \| Khiên 11 \| Kỵ 10 \| Thương 9` · `Ngô 13 \| Thục 11 \| Ngụy 8 \| Hỗn hợp 4 \| Quần 4` · `Meta phe (cũ) 30 \| Giới thiệu 10` — cùng một quy tắc cho hai trang |
| P5-2 thiếu nhóm "Nhóm"/"Nguồn" | **giữ (D2)** | Dữ liệu Đội chuẩn `subcategoryRaw` rỗng 1366/1366, `source` null 1366/1366 ⇒ không bịa facet rỗng; `/doi-khac/` vẫn có "Nguồn". Đã đính chính câu sai ở §1 bước 2 |
| P5-3 chip tiền tố `40Y`/`SP`/`CO` | **giữ (D4)** | Chip `nhan-bien-the` là bổ sung của hợp đồng; `tokens.json` → `nhan-bien-the` sửa `artboard` + `note`: artboard in tiền tố là chữ trơn trong tên tướng, không vẽ chip |
| P5-4 CTA "Chi tiết →" đổi mép | **đã sửa** | `css/styles.css` `.reference-card-foot .ana-link-btn { margin-left: auto }` ở mọi bề rộng. Đo: mọi thẻ (có/không dòng "Sợ") CTA cách mép phải thẻ **19px** @1440 / **15px** @390 trên cả `/doi-chuan/` và `/doi-khac/` |
| P5-5 tỉ lệ cột bảng | **đã sửa** | Token mới `size.col-250`, `size.col-64` (nguồn MainTable.dc.html, content-box); `thead th.reference-table-team` / `.reference-table-score-head` `box-sizing: content-box; width; padding-inline 18px`. Đo @1440: `286 \| 214 \| 214 \| 219 \| 100` (artboard render `286 \| 214–216 ×3 \| 100`); chiến pháp dài không còn xuống dòng; probe `bang` thêm 2 trạng thái đo `width` |
| P5-6 cột Điểm căn trái | **đã sửa** | Selector `.reference-view .reference-table .reference-table-score` (0,3,0) vượt `th, td { text-align:left }` (0,2,1); đầu cột `.reference-table-score-head` căn phải; padding 18px như artboard; mobile reset `padding: 0`. Đo: `th`/`td` `textAlign = right` @1440, ô mobile vẫn phải. Đã đính chính câu sai ở §5 |
| P5-7 nút chiến pháp desktop | **đã sửa** (một phần giữ theo D3) | `.reference-view .reference-holder .t-tactic`: `padding: 0`, `justify-content: flex-start`, `text-align: left` như artboard. **Giữ** `min-height: 26px` trên desktop (vùng bấm ≥ 24px, WCAG 2.5.8 — D3) nên mỗi dòng vẫn cao hơn chữ trơn của artboard vài px; mobile giữ 44px (P5-A2). Probe desktop của `nut-chien-phap` bỏ `padding-left: space.9` (không có token 0) + ghi chú |

Thay đổi chữ: **không có** (chỉ comment trong code; không obligation nào đổi).

Token/component mới: `size.col-250` (`--size-col-250`), `size.col-64` (`--size-col-64`); không có component mới. Probe cập nhật: `nut-chien-phap` (desktop), `bang` (+2 trạng thái cột).

Kiểm chứng: ảnh ghép phase-05 light/dark đã xem (MainTable: đầu bảng + 4 hàng khớp artboard, Điểm căn phải; Main: CTA mép phải, chip xếp theo số đếm); `design-compare --tokens --phase 5` **645/646** light trên tokens đầy đủ trước khi Landing đổi; sau đó (bỏ probe trang `/` đang bị slice Landing sửa) **531/532** light và dark — 1 ngoại lệ đã khai `select-nhan-caps`, 0 lệch chưa giải thích; probe mới `bang` cột Đội/Điểm và `nut-chien-phap` desktop xanh.
