# Phase 10 — Báo cáo: Giao diện tối, a11y, responsive, docs, full test

Ngày: 2026-09-26 · Plan `260923-1949-so-binh-phap-redesign`, [phase-10](../phase-10-toi-a11y-docs.md).
Phạm vi: A1 (vi mô + bố cục), A4 (tương phản), A5 (a11y/responsive), A7 (docs), xoá hẳn khối `legacy`
(`ceiling` = 0), full gate. Không đụng engine/Worker/schema lưu trữ. Script đo nằm ở `.cache/` (không commit).

## 1. Việc đã làm theo bước

| Bước | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Rà tối mọi phase: `design-compare --tokens` cho phase 1–9 × 2 theme (không có artboard tối → soát theo bảng tối StyleGuide + đo DOM thật); chụp bố cục tối cho phase 5 ở `.cache/design-compare/phase-05-dark/` | xong — §2, §4, §6 |
| 2 | Tương phản: script đo mọi phần tử có chữ trên 10 trang đại diện × 2 theme × 4 bề rộng, tính với nền thật (`getComputedStyle` + pha alpha + opacity) | xong — §4 |
| 3 | A11y + responsive: 320/390/768/1440, `scrollWidth` vs `innerWidth`, vùng bấm 44px, focus-visible bằng Tab thật, menu/hộp thoại, `prefers-reduced-motion`, theme (mặc định/đã lưu/storage lỗi/Back-Forward/đổi OS khi đang mở) | xong — §5 |
| 4 | Docs theo mô hình mới: `design-guidelines`, `code-standards`, `system-architecture`, `README`, `deployment-guide`, `unified-lookup`, `project-changelog` | xong — §7 |
| 5 | Full test + gate; kiểm quy tắc render an toàn; ghi số obligation/receipt/generation | xong — §8, §9, §10 |
| 6 | Xoá khối `legacy` (ceiling 329 → **0**), `design-tokens --check` pass, `design-compare --tokens` mọi trang × 2 theme, rà token không còn dùng, tổng hợp báo cáo so ảnh | xong — §2, §3, §6 |

## 2. Vi mô (tự động)

- `node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json`, 0 mã màu ngoài khối token,
  **0 giá trị thô ngoài khối legacy**, `mốc legacy: 0 giá trị thô trên 0 selector`.
- `node scripts/design-compare.mjs --tokens --phase NN --theme light|dark` (phase nào có probe):

| Phase | light | dark |
| --- | --- | --- |
| 01 | 215/216 · 0 lệch | 215/216 · 0 lệch |
| 03 | 118/118 · 0 lệch | 118/118 · 0 lệch |
| 04 | 702/702 · 0 lệch | 702/702 · 0 lệch |
| 05 | 583/584 · 0 lệch | 583/584 · 0 lệch |
| 06 | 382/382 · 0 lệch | 382/382 · 0 lệch |
| 07 | 344/344 · 0 lệch | 344/344 · 0 lệch |
| 08 | 541/542 · 0 lệch | 541/542 · 0 lệch |
| 09 | 686/688 · 0 lệch | 686/688 · 0 lệch |

  Phần lệch còn lại đều là ngoại lệ đã khai **đúng `actual`**: `select-nhan-caps` và `tool-head`
  `line-height: normal` (Chrome bỏ `line-height` của token trên form control; chiều cao đã khoá bằng `control.44`).
  Phase 02 không có probe (phase cấu trúc) — giữ nguyên phân biệt "0/0 không phải pass" như báo cáo Phase 2, không giả vờ đạt.
- **Hai lỗi probe được sửa trong phase này** (không nới checker, không thêm ngoại lệ):
  `nut-phu` đo nhầm nút icon `⋯` do Phase 9 thêm sau (`padding: 0`, `display: none` ở desktop) → selector
  thêm `:not(.rt-account-toggle)`; chữ trên nút CTA đổi từ `color.light.on-accent` sang cặp token mới
  `color.light.on-fill` (xem §4) ở ba probe `nut-cta`, `khoi-hero`, `cta-toi`.
- **Token mới (có nguồn, ghi trong `tokens.json`)**: `color.light.on-fill` / `color.dark.on-fill`
  (#FFFFFF / #16140F — mực trên nền tô), `color.faction.nguy-strong` (#1F3A93 / #3C5CB8 — nền pill cần chữ trắng),
  `type.variant-label` (700 9,6px/1,2), `type.badge-small` (600 9,92px/1,2), `type.note` (400 14,4px/1,5 —
  giữ đúng pixel của `.pre`, `.badge.unit.small`, `.scope-note` khi token hoá). **Bỏ** nhóm `alias`
  (`--radius`, `--shadow`) và **12 token bảng màu không còn runtime consumer** (`tier-0/05/1/15/2`, `stars`,
  `stars-ink`, `status-untested-bg/ink`, `status-situational-bg/ink`, `status-recommend-bg`) — đã kiểm
  `var()` trong CSS = 0 và 0 tham chiếu trong `tests/`/`scripts/` trước khi xoá (P10-3).

## 3. Xoá khối `legacy` (ceiling 329 → 0)

Khối cũ: **256 rule / 240 selector / 329 giá trị thô**. Đã phân loại trước khi xoá (không thu hẹp checker):

- **87 rule / 82 selector được token hoá và chuyển sang khối mới** "Nền trang + rule dùng chung (Phase 10)"
  đặt đúng vị trí cũ (trước mọi khối component Phase 1–9, giữ nguyên thứ tự cascade): `*`/`html`/`body`,
  `prefers-reduced-motion` (dùng `--motion-off`), `.content`, `.stats`, `.section(.active)`, `.empty`/`.error`,
  `.card-head`/`.units`/`.head-right`/`.heroes`/`.hero`/`.hero-name`/`.hn`/`.line`/`.counters`/`.tag`/`.t-book`/
  `.slot-label`/`.t-bond`/`.badge`/`.badge.role`/`.badge.unit.small`/`.pre(.sp/.co)`/`.team-card(:hover)`,
  `.reference-team-card .team-name > a:hover`, khối Khai hoang (`.kh-variant-*`, `.kh-build-note`,
  `.kh-commander`, `.kh-opening-note`, `.kh-guide*`, `.kh-detail-build*`, `.kh-sources`),
  bộ lọc dùng chung (`.fgroup`, `.flabel`, `.chip-row`, `.search:hover/::placeholder`, `.clear-btn*`, `.scope-note`),
  phạm vi mùa (`.season-controls`, `.reference-scope-controls`, `.season-config-detail`, `.season-hero-slot`,
  `.season-slot`, `.season-inventory-comparison`, `.season-opt-in`, media 680/480).
- **169 rule / 158 selector bị xoá** vì không còn đường render (đã kiểm bằng import closure từ 5 entry point +
  đối chiếu DOM của 17 trạng thái trang và HTML build): bộ lọc v1 (`.team-filter-bar`, `.team-filters`,
  `.filter-bar`, `.combo-*`, `.sel-tag`, `.section-intro*`), danh sách tướng + modal tướng cũ
  (`.hero-grid`, `.hero-card`, `.hc-*`, `.hero-overlay`, `.hero-modal*`, `.hero-stats`, `.hero-stat`, `.hs-*`,
  `.hero-apt`, `.hero-tactic*`, `.ht-*`, `.apt*`, `.fgroup-inline`, `.flabel-inline`), danh sách chiến pháp cũ
  (`.tac-*`), badge/trạng thái của thẻ legacy không còn render (`.badge.tier`, `.t-*`, `.badge.status`,
  `.status-*`, `.badge.recommend`, `.badge.stars`, `.badge.beta`, `.dim`, `.fa-*`), `.notes`, `.variant`, `.vg`,
  `.alt-sep`, `.stat`, `.advisor`, `.team-grid`, padding của `.team-card`, `.u-*` (bị `.badge.unit` Phase 1 phủ),
  `.season-raw`, `.season-tier-group`, `.season-team-groups`, `.kh-build-context`, `#section-team-*>.stats`,
  `.team-filters .fgroup.secondary`, `.filter-bar select`.
- Rule nào còn dùng nhưng đã có component Phase 1–9 phủ **hết** thuộc tính (`.badge`, `.badge.unit`,
  `.badge.faction[class*="f-"]`, `.chip`, `.tag.t-tactic`, `.hero-name`, `.team-name`, `.team-grid`,
  `.filter-collapse-toggle`, `.clear-btn` nền/chữ) thì không chép lại; đã kiểm bằng cách so từng thuộc tính
  với rule hậu duệ (specificity bằng hoặc cao hơn, đứng sau).
- Bốn lớp hành vi của khối cũ được **giữ đủ** ở khối mới: box-sizing + `scroll-behavior` + reduced-motion,
  base `body`, control mùa/cấu hình, và 44px mobile (`.season-controls button`, `.season-config-detail summary`,
  `#section-coexist .fchip/.clear-btn/.search`, `.season-opt-in`) — không đạt 0 bằng cách bỏ hành vi.
- Điểm mã markup phải sửa để không mất hành vi khi mất rule cũ: `select` là phần tử replaced ở Chrome nên
  `.reference-scope-controls select/input { width: 100% }` phải khai tường minh (thiếu → select lấy bề rộng nội tại
  và tràn ô ở 320px).

## 4. Tương phản (A4) — đo DOM thật, 10 trang × 2 theme × 320/390/768/1440

Trước vòng sửa (DOM thật, không phải suy từ token): **57 dòng vi phạm** trên 5 trang — `.header-cta` (kể cả
`header-cta-short/label`), `.landing-btn.landing-btn-primary`, `.pre.sp`, `.pre.co`, `span.landing-card-index`.
Sau vòng sửa: **chỉ còn `.landing-card-index`** (xem ngoại lệ bên dưới), **0 vi phạm A4 khác ở cả hai theme**.

| Chỗ | Cặp cũ (tối) | Sửa | Cặp mới |
| --- | --- | --- | --- |
| `.header-cta`, `.landing-btn` | `--on-accent` trên `--accent` 3,33:1 | token `--on-fill` (mực trên nền tô: sáng #FFFFFF, tối #16140F) | 7,23:1 sáng / 5,52:1 tối |
| `.pre.sp`, `.pre.co` | trắng trên `--accent` 3,33:1 · trên `--khien` **1,93:1** | cùng `--on-fill` | 7,23/4,90 sáng · 5,52/9,52 tối |
| `.clear-btn:hover::before` (vòng ✕ trên nền son) | `--on-accent` trên `--accent` 3,33:1 | `--on-fill` | 5,52:1 tối |
| `.ana-stat` | `--on-accent` trên `--f-nguy` 4,37:1 | token `--f-nguy-strong` (sáng giữ #1F3A93, tối #3C5CB8) | 10,07:1 sáng / 6,14:1 tối |
| hover CTA (`--accent-strong`) | — | giữ mực trắng ở trạng thái hover (`--on-accent` trên #7E1620) | 10,38:1 |
| `select-nhan-caps`/`.tool-head` | — | ngoại lệ đã khai (`line-height: normal` của form control) | — |

- `--f-nguy` chỉ còn dùng làm **chấm phe** (`--badge-dot`, `--meta-faction-dot`, `--chip-dot`) và viền trái thẻ —
  đều là trang trí `aria-hidden`, luôn đi kèm chữ tên phe; **không còn chữ nào** đặt trên nền `--f-nguy`.
- **Ngoại lệ khai rõ**: `span.landing-card-index` ("01"–"03", 44px) ở 1,51:1 (sáng) / 1,38:1 (tối) là số thứ tự
  **trang trí, `aria-hidden="true"`, lặp lại thông tin đã có trong tiêu đề thẻ** → không phải chữ cần đạt ngưỡng;
  ghi nhận thay vì "chữa" bằng cách đổi màu (đổi màu sẽ phá tương phản chủ ý của artboard Landing).
- `.badge.unit`/`.badge.faction[class*="f-"]` dùng nền giấy + mực (Phase 1), `.chip.good/.avoid` trung tính (Phase 5),
  pill lục Phase 9 dùng `--panel-3` + `--good`: cả ba đã đo lại và đạt, giữ nguyên.
- Ranh giới hình dạng nút chính trên nền tối: `--band` trên `--panel` chỉ ~1,24:1 (nút "Soi đội"), nhưng chữ
  trong nút đạt 15,54:1 và đây là lựa chọn của bảng tối StyleGuide (nền dải) — **ghi nhận là hạn chế thẩm mỹ đã
  chấp nhận**, không phải vi phạm A4 (không phải phần tử đồ hoạ bắt buộc).

## 5. A11y + responsive (A5)

**Cuộn ngang** — `document.documentElement.scrollWidth == innerWidth` ở **80/80 tổ hợp** (10 trang × 2 theme ×
320/390/768/1440), 0 phần tử có mép trái âm. Hai chỗ rộng có chủ đích nằm trong container cuộn rõ:

- bảng xem trước Landing (`.landing-table-preview { overflow-x: auto }`) ở 320/390;
- khung Turnstile: widget Cloudflare render 300px cố định, dưới 380px bọc trong `.ana-turnstile { overflow-x: auto }`
  → sửa `scrollWidth` 333/320 trước đây ở `/soi-doi/` (đây là lỗi có từ trước, không phải do Phase 10).

**Vùng bấm 44px mobile** — đo `getBoundingClientRect` của `a, button, input, select, textarea, summary,
[role=button], [role=tab]` trên 10 trang × 4 bề rộng × 2 theme và 48 trạng thái mở. Vòng sửa P10-1 (Kongming NO-GO)
đã sửa **sáu họ control** dưới 44px, mỗi chỗ có số đo lại:

| Control | Trước | Sau (đo lại 320/390 × 2 theme) |
| --- | --- | --- |
| `a.brand` header | 43,3px cao | `min-height: 44px` |
| `a.footer-brand` | 36px cao | `min-height: 44px` |
| nút icon đầu menu mobile (`.site-menu-close`, `#theme-toggle-menu`) | 39,5×44 / 39,8×44 | `flex: none` → 44×44 |
| `input.reference-search-input` / `.lookup-search-input` | 23px cao | `min-height: 44px` (nhãn bọc 48px vẫn là vùng bấm chính) |
| ô chọn ảnh native Gợi ý đội | 21px cao | `min-height: 44px` |
| link danh sách nguồn Khai hoang | 16,9–33,8px cao | `inline-flex` + `min-height: 44px` |
| `.kh-guide-details summary` | 336×19,5 @390 · 266×39 @320 | **336×44 @390 · 266×44 @320**, cả hai theme, Enter mở/đóng |
| `.lookup-relation-name` | 24px cao | **179×44** @320 và @390, cả hai theme, Enter mở hồ sơ liên quan |
| `.ana-team-link` | 20,4px cao | **≥44×44** @320/390, cả hai theme, Enter mở trang chi tiết |

  Ba họ cuối là phát hiện chặn P10-1 và có **regression test riêng** `tests-e2e/a11y-targets.spec.mjs`
  (3 ca × 4 tổ hợp 320/390 × sáng/tối: đo cả hai chiều + kích hoạt bằng Enter trên trạng thái thật — mục lục mở,
  hồ sơ Tra cứu có quan hệ, kết quả Soi đội có dữ liệu). Đo lại sau sửa: 0 phần tử ngoài khung và
  `scrollWidth == innerWidth` ở cả 4 tổ hợp cho từng bề mặt. Đã sửa: nút icon đầu menu mobile bị tiêu đề co còn
39,5/39,8px (`flex: none`), link thương hiệu header/footer 36–43,3px (`min-height: 44px`), ô nhập trong nhãn ô tìm
(`min-height: 44px`), ô chọn ảnh native của Gợi ý đội (`min-height: 44px`), link danh sách nguồn Khai hoang
(`inline-flex` 44px). Hai dạng còn lại không phải control: checkbox native 13×13 **nằm trong nhãn bọc 44px**, và
link nằm **trong câu/dòng chữ** (tên tướng, chiến pháp, nguồn trong đoạn văn) giữ ngoại lệ "inline target" của WCAG 2.5.8.

**Bàn phím** — Tab thật 40 bước trên Landing, `/chieu-mo/`, `/tra-cuu/` × 320/390/1440 × 2 theme =
**18 tổ hợp × 40 bước = 720 lượt**, **0 lượt không thấy vòng focus**. Menu thả: `aria-expanded` false→true→false, Escape đóng, focus trả về nút, bấm ngoài đóng.
Hộp thoại hồ sơ Tra cứu: mở, **focus nằm trong hộp thoại sau 14 lần Tab**, Escape đóng và focus trả về thẻ vừa bấm.
48 trạng thái mở (panel lọc mobile, menu mobile, 10 trang × 2 theme × 320/390): 0 control <44px, 0 vi phạm tương
phản, **0 control thiếu tên truy cập được** (sau khi gắn `aria-labelledby` cho ba ô chọn ảnh native của Gợi ý đội,
trỏ vào tiêu đề thẻ — không thêm chuỗi UI mới).
`prefers-reduced-motion: reduce`: **0 phần tử còn transition/animation** trên Landing.

**Theme** — không lưu + OS tối → `dark`; lưu `light` + OS tối → `light`; đổi OS khi trang đang mở → cập nhật theo
(hệ điều hành mới); `localStorage` ném lỗi → rơi về `prefers-color-scheme`, 0 `pageerror`; Back/Forward giữ đúng theme.
**Theme theo OS chỉ được đọc ở mỗi lần tải trang**: đổi OS khi trang đang mở **không** tự cập nhật
(`js/site-chrome.js` không có listener `matchMedia`; lần đo đầu của phase đổi OS ngay lúc khởi tạo nên đọc sai —
Kongming P10-2 xác nhận lại và report sửa theo hành vi thật, không thêm listener vì contract đóng băng không yêu cầu);
nút đổi trong UI là đường đổi tức thời, tab khác đồng bộ qua sự kiện `storage`. Turnstile không render được ở origin preview localhost (Cloudflare trả `110200`) nên hành vi Turnstile được
kiểm bằng mock trong `tests-e2e/beta-tools.spec.mjs` — ghi rõ giới hạn môi trường.

## 6. Bố cục (người duyệt)

- Báo cáo so ảnh artboard của 9 phase trước đã có: [`visual-phase-01`](visual-phase-01.md) … [`visual-phase-09`](visual-phase-09.md)
  (`design-compare` không pass/fail pixel; 24 artboard trang + StyleGuide đã soát ở Phase 1).
- Phase 10 **tạo** bộ ảnh tối `.cache/design-compare/phase-05-dark/` (5 cặp: Main, MainTable, MobileList,
  MobileTable, MobileFilters; exit 0). **Không có artboard tối**, nên kết luận bố cục tối dựa trên bảng tối
  StyleGuide + đo token/tương phản ở §2/§4; ảnh chỉ để đối chiếu thủ công giữa hai theme (không pass/fail pixel),
  còn bố cục kế thừa kết luận đã duyệt ở từng phase (phase này không đổi cấu trúc DOM).
### Chỉ mục 24 artboard + StyleGuide → báo cáo sở hữu

| Artboard (PNG trong `docs/design/so-binh-phap/screens/`) | Trang | Báo cáo so ảnh | Sai lệch đã duyệt |
| --- | --- | --- | --- |
| StyleGuide (1280, không có trang tương ứng) | — (nguồn token + bảng tối) | [visual-phase-01](visual-phase-01.md) | — (Phase 10 soát theo bảng tối + đo DOM) |
| Landing, LandingMobile | `/` | [visual-phase-03](visual-phase-03.md) (header/footer), [visual-phase-04](visual-phase-04.md) (toàn trang) | nội dung thêm + QR, theme control chỉ trong menu mobile, typography/chiều cao hàng |
| LandingMenu, LandingMenuMobile | `/` | [visual-phase-03](visual-phase-03.md) | — |
| Main, MainTable, MobileList, MobileTable, MobileFilters | `/doi-chuan/` | [visual-phase-05](visual-phase-05.md) | 44px mobile, "Sợ …"/"Khắc được" thiếu dữ liệu, cặp chip đạt ngưỡng tương phản |
| TeamDetail | `/doi-chuan/<handle>/` | [visual-phase-06](visual-phase-06.md) | bố cục xếp dọc, chiều cao hàng, chân dung + dims token gần nhất |
| Lookup, LookupTactics, LookupProfile, LookupMobile | `/tra-cuu/` | [visual-phase-07](visual-phase-07.md) | thành phần xem trước dùng chung, thẻ mine mobile giản lược, trường thiếu "Đang cập nhật" |
| Coexist, CoexistMobile, Khaihoang, KhaihoangMobile | `/cung-ton/`, `/khai-hoang/` | [visual-phase-08](visual-phase-08.md) | đánh số tướng theo mục, khối build dùng chung, dải bước |
| Recruit, RecruitMobile, Analyze, AnalyzeMobile, Roster, RosterMobile | `/chieu-mo/`, `/soi-doi/`, `/goi-y-doi/` | [visual-phase-09](visual-phase-09.md) | ảnh trống vs trạng thái có dữ liệu, id canonical từ engine, thứ tự cột/khoá lưu trữ |

- Chỗ lệch giữ lại có lý do (kế thừa từ các phase, không mở lại): cặp ảnh Analyze/Roster ở trạng thái trống
  (có ảnh chụp populated riêng), hàng "mạnh nhưng chưa xây dựng" hiện id canonical từ engine, số thứ tự gợi ý
  theo từng khối, thẻ/Bảng và bố cục công cụ xếp dọc, chữ nút "Đọc …", nhãn gói dữ liệu — tất cả đã ghi ở
  báo cáo phase sở hữu.
- Một lệch nhỏ **mới** của phase này: `.stats` (số đếm danh sách) dùng `--type-small` cho cả desktop và mobile
  (trước đây mobile nhỏ hơn 11,52px mà không có token tương ứng) → chọn cỡ đọc được thay vì thêm token vi mô;
  `.kh-guide` nền `--panel-3` thay `color-mix(panel 88%, accent)` (không có token cho tỉ lệ trộn, chênh lệch
  không nhìn thấy); `.team-name` bỏ `letter-spacing: .01em` (≈0,15px, không có token).

## 7. Docs (A7)

| Tài liệu | Nội dung đã cập nhật |
| --- | --- |
| `docs/design-guidelines.md` | Viết lại theo mô hình mới: Landing + 8 trang mục + 3 họ chi tiết + 404 và bảng chuyển tiếp hash cũ; `tokens.json` là nguồn duy nhất (token **và** danh mục component) + 3 tầng golden master + quy tắc thêm token/component + lệnh `design-tokens`/`design-compare`; shell dùng chung, theme theo OS + script chặn nháy; component Thẻ/Bảng; quy tắc 44px + ngoại lệ inline; a11y contract; bộ lọc danh sách đội (không còn `score`); Tra cứu `/tra-cuu/?group=&id=` (không còn tablist/`#heroes` canonical); phạm vi mùa + chi tiết cấu hình; render an toàn |
| `docs/code-standards.md` | Mô hình trang + `data-page-section` + `SiteLayout` duy nhất; **bảng payload mỗi trang mục**; fetch `/data/…` tuyệt đối; `js/legacy-routes.js`; `safeReturnUrl` giữ khóa theo trang; `js/site-nav.js`/`site-chrome.js`; artifact `hero-summaries.json`; font `public/fonts/` + rule `_headers`; CSS chỉ dùng token; render an toàn (`innerHTML` cấm với dữ liệu); bộ khóa URL mới |
| `docs/system-architecture.md` | Landing + 8 trang mục + `data-page-section`; hash chỉ còn là chuyển tiếp; card Khai hoang ở `/khai-hoang/`; thêm mục artifact `hero-summaries.json` và ngân sách tải |
| `README.md` | Danh sách tính năng theo đường dẫn mới (bỏ 2 dòng "9/8 section hash" trùng nhau), chuyển Thẻ/Bảng, ba họ chi tiết, token/theme; cây thư mục thêm `legacy-routes.js`, `public/fonts/`, `src/pages/<mục>/`, layout, token; lệnh soát thiết kế; ghi chú token/theme |
| `docs/deployment-guide.md` | `_headers` **16 rule** (thêm 5 trang mục + `/fonts/*`); smoke checklist theo đường dẫn (gồm dán hash cũ + theme); mục mới **"Publish lại bản dịch hiển thị"** (inventory → build → check candidate → publish → check public → re-pin route handles → build/verify/test:dist) |
| `docs/unified-lookup.md` | Route canonical `/tra-cuu/?group=<nhóm>&id=<id>`; hash cũ `#lookup`/`#heroes`/`#tactics` chỉ là chuyển tiếp |
| `docs/project-changelog.md` | Mục **2026-09-26** cho redesign (đường dẫn, shell, token, font, tương phản tối, a11y/responsive, docs) |

## 8. Policy bản dịch và provenance

- Chỉ sửa **một file** trong `sourceFiles` (`js/roster-recommend-ui.js`, thêm `aria-labelledby`/`id`): làm mới hash
  `78c17b38…` → `cbc7cd3b…` bằng `sha256_hex()`. **Không thêm/dời/đổi chữ** nào ⇒ 0 obligation mới, 0 receipt mới
  (`translationObligations` 5 591, `siteLedgerObligations` 2 088, `uiTranslateObligations` 68 giữ nguyên).
- `baseline.notes` **không đổi**: `concreteLocationCount` 56 653, `concreteInventorySha256` `a85e2fd6…`
  (lệnh `inventory` xác nhận lại; `unknownLocationDetails` rỗng).
- `policyVersion`: `site-vi-260926-cong-cu-beta` → **`site-vi-260926-toi-a11y-docs`**.
- Chuỗi publish: `build --stage all` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public`
  (exit 0). Generation: website-display `site-localization:514257b9…` → **`site-localization:4db4f297…`**;
  `recommendedPin` `362730e1…` (manifest `8c21bffd…`) → **`d008d8be…`** (manifest `f9a6a4d3…`);
  `pipeline/team-route-handles.json` re-pin `362730e1…` → `d008d8be…`, `--check` pass (1 366 recommended / 166 legacy / 17 Khai hoang).
- Trang chi tiết Khai hoang ở 320/390/1440 × 2 theme: 0 phần tử ngoài khung, **đóng nợ "link nguồn bị cắt ở 320px" của Phase 8**.
- Hai nhóm Tra cứu thưa (nợ Phase 7): `/tra-cuu/?group=troop-mods` 16 thẻ, `?group=buildings` 41 thẻ, hộp thoại hồ sơ
  mở với dữ liệu thật (`Đan Dương Binh`, `Bát Trận Đồ`; trường thiếu hiện "Đang cập nhật"), 0 `pageerror`.
- Bề mặt hướng dẫn Khai hoang (`.kh-guide*`, token hoá trong phase này) đo lại trên đội có `guide`:
  `--panel-3` (247,242,232 / 42,38,32), tiêu đề + dải điểm + 11 mục, chữ cảnh báo 14,8:1 sáng / 7,9:1 tối, 0 phần tử ngoài khung.

## 9. Quy tắc render an toàn (plan.md quyết định #14)

`grep -rn "innerHTML|insertAdjacentHTML|outerHTML" js/` → **2 kết quả, cả hai là comment** nêu chính quy tắc
(`js/render.js:1`, `js/unified-lookup.js:4`); **0 chỗ ghi HTML bằng chuỗi với dữ liệu**. Không có chuỗi tĩnh nào
cần liệt kê thêm.

## 10. Gate (bộ A2)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` | pass (0 lỗi, 1 hint) |
| `npm run build` | pass — 1 559 trang |
| `npm run verify` | pass (exit 0) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **347/347 pass** |
| `npm run test:e2e` | **258/258 pass** (255 ca cũ + 3 ca mới `tests-e2e/a11y-targets.spec.mjs`) |
| `python3 -m unittest discover -s tests` | **377 OK** |
| `python3 -m pipeline.team_route_handles --check` | pass |
| `python3 -m pipeline.site_localization check --root . --stage public` | exit 0, 0 problem |
| `node scripts/design-tokens.mjs --check` | pass — legacy **0** |
| `node scripts/design-compare.mjs --tokens` (phase 1–9 × 2 theme) | 0 lệch chưa giải thích (§2) |
| Script tương phản / vùng bấm / cuộn ngang (80 tổ hợp + 48 trạng thái mở) | 0 vi phạm ngoài ngoại lệ đã khai (§4, §5) |

**Test đổi có chủ đích trong phase này**: không sửa/xoá test nào; chỉ *sửa dữ liệu probe* trong
`docs/design/so-binh-phap/tokens.json` (selector `nut-phu` thêm `:not(.rt-account-toggle)`; ref màu của ba probe
CTA → `color.light.on-fill`). Lý do: probe cũ đo nhầm phần tử và trỏ vào cặp màu không còn dùng.

## 11. Sổ nợ cuối (theo ledger Kongming P09b)

**Phải sửa/kiểm cho nghiệm thu cuối — đã đóng:**

1. *Tương phản tối còn lại* → sửa và đo lại ở DOM thật (§4); 0 vi phạm ngoài số trang trí `aria-hidden`.
2. *Ranh giới control tối + trang trí tương phản thấp* → đo nút chính (§4) và ghi lý do chấm phe/số thẻ là trang trí;
   quy tắc tương phản cho `.badge.faction.f-nguy` của khối cũ đã **hết hiệu lực** vì Phase 1 phủ `[class*="f-"]`
   (nền giấy + chấm màu) — báo cáo Phase 9 ghi theo selector cũ, đã đối chiếu lại.
3. *Specificity của link Cùng Tồn* → giữ rule `#section-coexist a { color: var(--accent) }` nhưng chỉ cho link chữ;
   đo `/cung-ton/` 320/390/768/1440 × 2 theme: 0 vi phạm tương phản, `.fchip`/`.clear-btn`/`.search` vẫn đủ 44px.
4. *Link nguồn bị cắt ở 320px* → đo lại trang chi tiết Khai hoang: 0 phần tử ngoài khung, không mép trái âm.
5. *329 giá trị thô + dọn legacy* → khối `legacy` xoá hẳn, ceiling **0**, `--radius`/`--shadow` bỏ cùng nhóm `alias`,
   thêm 12 token bảng màu hết consumer (P10-3),
   `.visually-hidden` giữ nguyên (đã token hoá ở Phase 1, không xoá nhầm), `team-pk`/`meta-cu` chỉ còn là module
   publish không đường render (không xoá file — ngoài phạm vi redesign).
6. *Probe thiếu + ảnh chụp sai theme* → phase 1–9 × 2 theme đều 0 lệch (§2); vòng lặp ảnh của Phase 9 đã sửa ở phase đó.
7. *Rà tối/A4/A5 toàn site bị hoãn* → đã chạy (§4, §5), gồm trạng thái mở, focus bàn phím thật, reduced motion,
   theme (mặc định/lưu/storage lỗi/Back-Forward/đổi OS) và import-focus `P09-R1` (0/60 lượt vô hình).
8. *Ảnh chân dung CDN chưa chứng minh* → **hạn chế môi trường**: preview localhost không gọi được CDN ngoài;
   các ca chặn ảnh/fallback chữ Hán vẫn chạy trong e2e; cần kiểm trên bản deploy thật (ngoài quyền của phase).
9. *Hai nhóm Tra cứu thưa* → đã exercise (§8).
10. *Hành vi dùng chung phải sống sót sau dọn CSS* → e2e 255/255 (khung chi tiết, biến thể/build Khai hoang,
    Cùng Tồn nhóm/query/return-state, guard không có `#season-controls` ở Chiêu mộ, lịch sử Back/Forward).
11. *A7 + provenance* → §7, §8.

**Phải có quyết định cuối — đã ghi rõ:**

- *Ngân sách tải khởi động*: giữ nguyên phạm vi — hồ sơ Tra cứu dùng `hero-summaries.json` (trung vị 1 029 ms sau
  vòng sửa Phase 7); toàn bộ hồ sơ/khởi động chung (~2,1 MB source hash, ~6,2 s dưới throttle) **không** thuộc
  ngân sách 2 s của đường hồ sơ và không tối ưu trong plan này → hạn chế kế thừa, chấp nhận.
- *Lịch sử pity mẫu số cứng /30*: giữ nguyên (không bịa mốc lịch sử, không đổi schema) → hạn chế kế thừa, chấp nhận.
- *Đội bị khoá trả id canonical*: giữ (không đổi engine/xếp hạng) → hạn chế hiển thị đã ghi.
- *Control chọn tệp native của Gợi ý đội*: giữ control native (khác `Nhập JSON` đã phủ trong suốt) nhưng đã gắn
  `aria-labelledby` + `min-height: 44px` → sai lệch trình bày đã chấp nhận, có tên truy cập và vùng bấm đạt.
- *Sai lệch artboard đã chấp nhận* (§6) + các token hoãn trước đây: đã map sang token đã dùng hoặc ghi ngoại lệ;
  bề mặt không có artboard (phạm vi mùa, chi tiết cấu hình, khung Turnstile) soát theo StyleGuide.

## 11b. Vòng sửa P10 (Kongming NO-GO)

| Finding | Sửa | Bằng chứng |
| --- | --- | --- |
| **P10-1** ba họ control < 44px | `css/styles.css` khối a11y mobile: `.kh-guide-details summary`, `.lookup-relation-name`, `.ana-team-link` nhận `min-height: var(--control-44)` (giữ nguyên semantics/focus, không ẩn overflow, không mở rộng selector của audit) | số đo lại ở §5 + `tests-e2e/a11y-targets.spec.mjs` (3 ca × 4 tổ hợp, cả hai chiều + Enter) |
| **P10-2** tài liệu/report sai contract | Sửa 8 điểm: bỏ claim "trang đang mở theo OS" (design-guidelines, code-standards, system-architecture, report); `#lookup/<nhóm>/<id>` → `#lookup?group=&id=` (design-guidelines, unified-lookup, README, deployment-guide); payload Landing = **hai** pin publication (code-standards); `safetyReturnUrl` giữ khóa theo `SECTION_QUERY_KEYS` + allowlist pathname + chuẩn hoá URL gốc cũ (code-standards, system-architecture); bỏ hướng dẫn lọc điểm còn sót (design-guidelines, code-standards); Landing dùng `SiteLayout` + sitemap có 8 đường dẫn mục (code-standards); quy trình publish ghi rõ bước ghim lại hash nguồn/baseline trước khi dựng candidate (deployment-guide); evidence report bỏ claim "0 control dưới 44px" chung chung và sửa mẫu số focus 720 lượt | §5, §7, bảng gateway §10; đối chiếu lại với `js/team-detail-navigation.js:20-29,178-190`, `src/layouts/SiteLayout.astro:398-401`, `js/team-filter-section.js:392-393` |
| **P10-3** token/consolidation | Xoá 12 token bảng màu hết consumer (đã kiểm `var()` = 0 và 0 tham chiếu test/script); thêm **chỉ mục 24 artboard + StyleGuide** (§6) và **bảng provenance Phase 1–10** ở [`phase-10-final.md`](phase-10-final.md) §5; ghi rõ cặp sentinel `legacy:start ceiling=0`/`legacy:end` là mốc bắt buộc của checker, **không** phải CSS legacy còn sót | `design-tokens --check` pass sau khi xoá; §6; phase-10-final §5 |

Không mở lại các quyết định đóng băng: **không** thêm listener `matchMedia`, **không** thêm cú pháp route
`#lookup/<nhóm>/<id>`, **không** đổi engine/lưu trữ/hiệu năng để "chữa" tài liệu.

## 12. Rủi ro mở / gợi ý bước sau

- Kiểm ảnh chân dung CDN và Turnstile thật trên origin deploy (ngoài quyền của phase này).
- Nút chính nền dải trên nền tối chỉ ~1,24:1 về hình dạng: nếu người dùng thấy khó nhận diện, cân nhắc thêm viền
  `--band-link` cho biến thể "nút chính" (đổi artboard → cần chủ dự án duyệt).
- `js/team-pk.js`, `js/meta-cu.js`, `js/hero-list.js`, `js/hero-detail.js`, `js/tactics.js` vẫn được publish nhưng
  không có đường render: CSS đã xoá theo; nếu muốn dọn tiếp thì xoá module + manifest entry ở một phase riêng.
