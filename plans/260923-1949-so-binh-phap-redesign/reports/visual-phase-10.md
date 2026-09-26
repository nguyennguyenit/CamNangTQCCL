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

**Theme** — không lưu + OS tối → `dark`; lưu `light` + OS tối → `light`; `localStorage` ném lỗi → rơi về `prefers-color-scheme`, 0 `pageerror`; Back/Forward giữ đúng theme.
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

## Opus re-review round 2 (2026-09-26)

| # | Phát hiện | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| **P10-B1** | Chip nhóm Tra cứu trên mobile chỉ cao **40px** và chữ dính mép trên (hồi quy do chính vòng sửa trước: P07-D5c) — sai A5 và hợp đồng §11.4 (40 → 44) | Trong khối ≤680: `.lookup-chip { align-items: center; min-height: var(--control-44) }`; probe `chip-loc` ở 390 đổi sang `control.44` | e2e mới (390/320 × 2 theme): **cả 6 chip** cao ≥ 44 và khoảng cách chữ trên/dưới lệch ≤ 1px; đo trực tiếp: cao 44, khe trên = khe dưới = 13px; ảnh `chip-390-light.png` (nhãn căn giữa viên) và `chip-320-dark.png`; `scrollWidth == innerWidth` vẫn đúng |
| **P10-B2** | Link "Mở nguồn SGSDeck trong thẻ mới" trong thân chi tiết Đội chuẩn chỉ cao 19px, đứng riêng một dòng (không thuộc ngoại lệ inline của WCAG 2.5.8) trên 1366 route | `class:'detail-link'` (P06-B2) ⇒ 44px mọi bề rộng + `.detail-source > p > a { display: inline-flex; align-items: center; min-height: var(--control-44) }` trong khối A5 mobile | e2e `a11y-targets.spec.mjs` (320/390 × 2 theme): cao **44**, rộng 267, Enter mở tab mới, không có màu link mặc định, không cuộn ngang |
| **P10-B3** | Số liệu Phase 10 lệch cây thật (policyVersion/generation/manifest/gate) | Cập nhật §1–§4 của `phase-10-final.md` và §5/§8/§10 của báo cáo này theo cây sau vòng sửa (xem khối "Số liệu cây hiện tại") | Chuỗi khớp `src/data/recommended-reference/current.json` (`27d82121…`/`ef994027…`), `pipeline/site-localization-policy.json` (`site-vi-260926-opus-round-2b`) và `pipeline/team-route-handles.json` |
| N1 | Link tiêu đề thẻ đội cao 26px ở mobile — hợp lệ nhờ ngoại lệ "control tương đương" (mỗi thẻ có link "Chi tiết" 44px cùng href) nhưng chưa được khai | Khai ngoại lệ trong `docs/design-guidelines.md` (mục Responsive/touch) + ghi ở đây | Câu khai báo nằm trong tài liệu; 5 link/trang đầu `/doi-chuan/` đều có link "Chi tiết" 44px cùng href |
| N2 | §5 "Theme" tự mâu thuẫn (nói đổi theme hệ điều hành cập nhật trang ngay, rồi nói đúng là không) | **Lượt round 2 khai đã sửa nhưng thực tế chưa** — mệnh đề sai còn ở §5; đã xóa thật ở vòng round 3 (P10-R1) | §5 hiện chỉ còn câu đúng: đổi OS khi trang đang mở **không** tự cập nhật (không có listener `matchMedia`) |
| N3 | `docs/code-standards.md` còn câu cũ: chỉ `_headers`/`robots.txt` là byte-equal, `_headers` thiếu 8 trang mục và `/fonts/*`, còn dùng từ vựng tab/root | **Lượt round 2 khai đã sửa nhưng mới sửa phần từ vựng**; dòng 45 và 50 đã sửa thật ở vòng round 3 (P10-R1) | Dòng 45 nay kể cả `favicon.png` + `public/fonts/`; dòng 50 liệt kê đủ 16 luật của `public/_headers` (8 trang mục, `/404.html`, `/favicon.png`, `/js/*`, `/css/*`, `/fonts/*`, `/data/*`) |
| N4 | Checker không soát `font` shorthand và custom property ngoài khối token | `scripts/design-tokens.mjs`: thêm `/^font$/` vào `CHECKED_PROPERTIES` và coi mọi property bắt đầu `--` là thuộc tính bị soát | `--check` vẫn pass (legacy 0) và giờ bắt được giá trị thô nếu ai đó viết `font: 11px …` hay `--x: 12px` ngoài khối token |
| N5 | Bảng số probe token theo phase ở §2 đã cũ | Cập nhật theo số mới: 03 **136**, 04 **720**, 05 **631/632**, 06 **400**, 07 **520**, 08 **589/590**, 09 chỉ 2 ngoại lệ đã khai, 10 **295** | Khối Gate ở trên |
| N8-1 (từ vòng 8/9) | Theme tối: chip/nút đang chọn dùng `--band` gần bằng nền trang nên phản hồi thị giác yếu | **Chưa sửa** — cần quyết định bảng màu tối | Số đo: `--band #0F0E0B` trên nền `#16140F` ≈ 1,07:1, trên chip chưa chọn `#2A2620` ≈ 1,35:1; tương phản **chữ** vẫn đạt nên không phải lỗi A4 |

## § Nit round (2026-09-26) — vòng sửa các nit còn lại

Vòng này sửa trọn 6 nhóm nit của các vòng review trước. Hai quyết định thiết kế/dữ liệu được **Kongming phán quyết**
(agent `NitFix`), và vòng này làm đúng nguyên văn phán quyết đó.

### N8-1 — trạng thái "đang chọn" và nút chính ở theme tối

**Nguyên nhân gốc:** các rule trạng thái chọn mượn `--band` (màu **dải header** theo artboard, `renderVals dark[8]`),
nên ở theme tối nền chip chỉ 1,05:1 với nền trang và 1,28:1 với chip chưa chọn. (Số của vòng review trước ghi 1,07 và
1,35 — Kongming đính chính thành **1,05** và **1,28**; `--band-ink` trên `--band` tối là 15,54:1.)

**Phán quyết (theo đúng nguyên văn):** thêm **họ token ngữ nghĩa `--select*`**, tách khỏi `--band`; bản sáng giữ đúng
giá trị cũ nên **theme sáng không đổi pixel**; bản tối **đảo mực/giấy** như cách theme sáng đang làm. Không chọn
phương án viền (nền vẫn 1,05:1) và không đổi `--band` ở theme tối (giá trị artboard đã chốt cho khung trang).

| Token | Sáng (= token cũ) | Tối |
| --- | --- | --- |
| `--select` | `#1C1A17` (= `--band`) | `#EDE6D8` |
| `--select-ink` | `#F3EEE3` (= `--band-ink`) | `#16140F` |
| `--select-ink-2` | `#CFC6B6` (= `--nav-idle`) | `#3A352D` |
| `--select-muted` | `#A99F8E` (= `--band-muted`) | `#5F5A50` |
| `--select-hover` | `#2B2722` (= `--band-active`) | `#CFC6B6` |
| `--f-nguy-select` / `--f-thuc-select` / `--f-ngo-select` | `#1F3A93` / `#1F7A4D` / `#B8232C` | giống bản sáng |
| `--f-quan-select` / `--f-honhop-select` | `#B08422` / `#6B45A0` | `#8A6D1F` / `#6B45A0` |

Chấm phe phải có bậc màu riêng: ở theme tối nền chọn là giấy sáng nên chấm phe của bảng tối (`#4F74D6` 3,52:1,
`#5FCE95` 1,57:1, `#E0B95E`… 1,51:1) gần như mất; bậc "giấy" đạt 8,11 / 4,28 / 5,10 / 3,94 / 5,67. Quần có giá trị
tối riêng vì `#B08422` trên giấy chỉ 2,74:1.

**Đo trên DOM thật (theme tối, 390 và 1440, `/cung-ton/`, `/khai-hoang/`, `/doi-chuan/`, `/tra-cuu/`, `/goi-y-doi/`
cộng `/soi-doi/`, `/chieu-mo/`, một trang chi tiết Đội chuẩn):**

| Cặp đo | Số | Ngưỡng |
| --- | --- | --- |
| nền `.coexist-group-chip[aria-pressed=true]` `rgb(237,230,216)` trên nền trang `rgb(22,20,15)` | **14,82:1** | 1.4.11 ≥ 3 |
| như trên, so với chip chưa chọn `rgb(32,29,24)` | **13,53:1** | ≥ 3 |
| nền `.kh-config-chip[aria-pressed=true]` / `.view-btn[aria-pressed=true]` so với chip chưa chọn `rgb(42,38,32)` | **12,11:1** | ≥ 3 |
| chữ trên nền chọn `rgb(22,20,15)` / `rgb(237,230,216)` | **14,82:1** | 1.4.3 ≥ 4,5 |
| `.coexist-chip-note` (`--select-ink-2`) trên nền chọn | **9,79:1** | ≥ 4,5 |
| `.fchip-count` (`--select-muted`) trên nền chọn | **5,52:1** | ≥ 4,5 |
| dấu ✓ (`.fchip-check::after`) trên nền ô ✓ | **14,82:1** | ≥ 4,5 |
| viên `.lookup-chip[aria-pressed=true]` @390 và số đếm | **14,82:1** | ≥ 4,5 |
| hover nút chính `rgb(207,198,182)` trên nền trang và chữ trên nó | **10,87:1** | ≥ 3 / ≥ 4,5 |
| chấm phe trên chip đang chọn (Ngụy · Thục · Ngô · Quần) | **8,11 · 4,28 · 5,10 · 3,94** | mục tiêu thiết kế ≥ 3 |

Chấm Hỗn hợp không đo được trên `/doi-chuan/` vì dữ liệu trang không có chip phe Hỗn hợp; token và probe dùng ca
Thục nên giá trị vẫn được khoá trong `tokens.json`.

**Chứng minh phép đo phân biệt được (trước/sau):** ghi đè tạm `--select:#0F0E0B; --select-ink:#EDE6D8` trong trình
duyệt (không sửa file) rồi đo lại `.coexist-group-chip[aria-pressed=true]`: nền `rgb(15,14,11)` /
nền trang = **1,05:1** và so với chip chưa chọn = **1,15:1** ⇒ test mới **đỏ**; với token mới là **14,82 / 13,53**
⇒ xanh. Đây là bằng chứng "failing-before" của test, không phải suy luận.

**Theme sáng (bắt buộc giống từng pixel):** giá trị sáng của 10 token mới **bằng đúng** giá trị token cũ
(`select`=`band`, `select-ink`=`band-ink`, `select-ink-2`=`nav-idle`, `select-muted`=`band-muted`,
`select-hover`=`band-active`, `f-*-select` sáng = `f-*` sáng); đo lại trên DOM thấy đúng các giá trị cũ —
nền chip `rgb(28,26,23)`, chữ `rgb(243,238,227)`, số đếm `rgb(169,159,142)`, hover `rgb(207,198,182)`, chấm phe
`rgb(31,58,147)` / `rgb(31,122,77)` / `rgb(184,35,44)` / `rgb(176,132,34)`. Không đổi hình học, viền hay box-shadow.
Ảnh đối chiếu: `cung-ton`/`doi-chuan`/`goi-y-doi` 1440 sáng và tối (xem `.cache/design-compare`, không commit).

**Không đổi theo phán quyết:** `--band` và mọi bề mặt khung trang (header, nav, menu, hero, CTA, footer),
`.badge.badge-band` (nhãn tĩnh, 1.4.11 không áp dụng), `.filter-count` (bong bóng tự có nền `--nav-underline`),
và tab Tra cứu **desktop** (vẫn "mực trên giấy + gạch chân son"; test tương phản chữ của nó đã có sẵn).

**Probe:** 14 mục `probes` trỏ lại `color.light.band*` → `color.light.select*`, `nut-chinh.styles` trỏ lại tương tự,
thêm 5 probe mới (`.fchip-count`, `.fchip-check`, `.coexist-chip-note`, số đếm viên Tra cứu mobile, và hai probe
`::before` của chip phe đang bật nay khoá thêm `color.faction.thuc-select`). Không khai `exceptions` mới.

### N9-5 — đổi Mùa thì reset widget Turnstile

`setSeasonScope` của Soi đội (`js/analyze.js`) và Gợi ý đội (`js/roster-recommend-ui.js`) bỏ token nhưng không gọi
`turnstile.reset`, nên widget vẫn hiện "đã xác thực" mà không còn token và nút chạy khoá tới khi widget hết hạn.
Nay cả hai gọi `window.turnstile.reset(tsBox)` với **đúng guard** của lần reset sau khi chạy
(`turnstileRendered`/`window.turnstile`); token dùng một lần và các guard theo `generation` giữ nguyên. Lượt gọi
`{initial:true}` lúc boot là no-op an toàn (widget render lazy). e2e `beta-tools.spec.mjs`: stub Turnstile ghi lại
lần reset và **chỉ cấp token mới sau khi widget được reset**, thêm 2 ca (Soi đội, Gợi ý đội) đòi đúng 3 lần reset và
token thứ hai thực sự tới Worker; ca Gợi ý đội kiểm thông báo "Xác thực Turnstile trước." + Worker không được gọi
(nút của công cụ này không bị `disabled`, khác Soi đội).

### N4-1 — bảng xem trước của Landing ở bề rộng hẹp

Ở ≤820 (khối mobile của Landing; `LandingMobile` **không vẽ bảng** nên đây vẫn là ngoại lệ đã khai) bảng xếp dọc
theo `MobileTable`: `min-width: 0`, `tr` là grid `minmax(0,1fr) auto`, **điểm nằm góc phải hàng 1**, vạch ngăn
chuyển từ ô sang hàng. Không còn cuộn ngang *bên trong khung* nên không cần gợi ý cuộn, và `scrollWidth` trang vẫn
≤ 320/390. e2e `landing.spec.mjs`: **thay** khẳng định cũ "vùng bảng cuộn riêng ở 390" (nay sai theo thiết kế) bằng
4 khẳng định ở 390 **và** 320: không cuộn trong khung, mép điểm nằm trong khung, điểm cùng hàng với tên đội, và
vẫn in đúng điểm.

### N4-2 — nguồn gốc mã QR phải ra `dist`

Lệnh sinh + phiên bản `qrcode@1.5.4` nằm ở frontmatter `DownloadQr.astro` nên **không** vào `dist/index.html`.
Nay chúng là một comment HTML **ngay sau thẻ `<svg>`** (chỉ còn **một** bản, frontmatter chỉ còn câu trỏ tới).
`bytes` của SVG không đổi (`viewBox`, thuộc tính, path giữ nguyên). `tests-js/astro-dist-contract.test.mjs` thêm
khẳng định đọc `dist/index.html` và đòi comment nằm **trong** `<svg>` của `.landing-qr-frame`; đã kiểm nó **đỏ**
trên `dist` cũ và **xanh** sau khi sửa (Astro build thật; tiền lệ comment đi vào `dist` là các comment của
`src/pages/doi-khac/[team].astro`). `npm run test:dist` 28/28.

### N5-2 — cột nhãn vai trò của hàng tướng mobile (đây là **lỗi thật**, không chỉ lệch 8px)

`var(--space-38)` được dùng ở `css/styles.css` nhưng **chưa từng được khai** ở đâu: `design-tokens --check` không
soát `grid-template-columns`, nên giá trị này làm cả khai báo **vô hiệu lúc tính** (`grid-template-columns: none`)
và hàng tướng mobile mất cột nhãn/tên. Nay có token thật `size.col-hero-role` = **38px** (nguồn: `MobileList.dc.html`
dòng tướng `grid-template-columns: 38px minmax(0, 1fr)`) và `column-gap: var(--space-8)` đúng artboard (trước đó
kế thừa 10px của bản rộng). Rà toàn file: **0 custom property chưa khai** còn lại (`--badge-dot`, `--chip-dot`,
`--meta-faction-dot` khai ngay trên selector dùng chúng; `--nav-menu-width` do `SiteLayout` phát inline).

### N5-3 — chuẩn hoá `?view=the`

`view` chỉ có nghĩa khi bằng `bang`. `js/app.js` thêm `canonicaliseView()` chạy **sau** khi render: bỏ `view` nếu
giá trị không phải `bang`, gộp bản lặp, và dùng `history.replaceState` nên **không thêm mục lịch sử**. Vì chạy sau
render nên lượt đọc đầu vẫn hiện thông báo "Kiểu hiển thị không hợp lệ đã bị bỏ." rồi URL mới được chuẩn hoá.
e2e `recommended-browser.spec.mjs`: `?view=the` (một mình và kèm `q`), `?view=bang`, `view` lặp, giá trị lạ, và
Back rời trang chứ không quay lại chính URL `?view=the`.

### N5-4 — Escape đóng panel lọc mobile

`js/team-filter-section.js` (`createRecommendedSection`): vùng kết quả nhận `keydown`; Escape chỉ hành động khi
panel đang mở **và** nút "Bộ lọc" thực sự được vẽ (`getClientRects().length`), nên desktop là no-op; đóng panel rồi
trả focus về nút. e2e: mở → Escape → `aria-expanded=false` + focus ở nút + chip ẩn; mở lại bằng Enter; ca desktop
giữ nguyên focus và sidebar vẫn hiện.

### N-f — hộp thoại hồ sơ ở 821–1279

Thêm khối `@media (max-width: 1279px)` cạnh rule hộp thoại: `.lookup-backdrop { padding-inline: var(--space-40) }`.
Hộp thoại 960px nhờ đó luôn chừa lề hai bên (thực sự co dưới 1040px) thay vì trông như chiếm hết màn hình; khối ≤680
đặt padding riêng và đứng sau trong file nên vẫn thắng ở mobile.

### N3a-1b — dấu `·` mồ côi ở 320

Dấu ngăn cách chuyển từ **đầu mảnh kế tiếp** (`.reference-faction + *::before`) sang **cuối mảnh phe**
(`.reference-filters`… `.reference-faction:not(:last-child)::after`), nên khi hàng xuống dòng dấu nằm cuối dòng trên.
Đo ở 320 (`/tra-cuu/`, 60 thẻ, cả hai theme): 60/60 thẻ có dấu ở `::after` của mảnh phe, **0/60** ở `::before` của
mảnh kế tiếp, 60/60 thẻ có mảnh "Thống ngự N" xuống hàng — ảnh `tra-cuu-320-dark` cho thấy dòng đọc
"▪ Ngô ·" rồi "Thống ngự 7" ở dòng dưới, không còn dấu ở đầu dòng. Khoảng cách không đổi (6px · 6px);
`.lookup-card-meta` không có probe `::before` nên không phát sinh nợ probe.

### N6-a — §8 của `visual-phase-06.md` là mối nối, không phải bản viết lại

Đã viết lại §8: bỏ giá trị `width: max-content` đứng trước phần đính chính, bỏ câu khẳng định chung
"`scrollWidth == innerWidth` ở 320/390/1440 trên cả ba họ trang", và gộp đính chính P06-R1 vào chính đoạn văn thay
vì nối sau câu sai.

### N7/N8 — dữ liệu (`activationRate`) và chuỗi biên tập

**Kongming phán quyết chỗ sửa `activationRate`: tại bước NHẬN giá trị trong `pipeline/build_unified_lookup.py`**
(không sửa `data/sgsdeck/**`, không sửa `build_sgsdeck_catalog.py`). Lý do đã kiểm: fingerprint đầu vào bản dịch
chứa **cả object `attributes`**, nên đổi snapshot sẽ làm 3 mục ledger đã review của `tactic:thien-uy-khieu-tran`
thành `stale translation fingerprint` và đòi receipt độc lập — việc vòng này bị cấm làm. Đã làm đúng phán quyết:

- `SOURCE_VALUE_CORRECTIONS` (bảng hardcode cạnh `GOLDEN_HERO_DELTAS`) với đúng entry/lý do; tra bằng hàm thuần,
  **không** sửa `source_docs`/`attrs`; lỗi rõ ràng khi giá trị thô đổi, khi owner không khớp, và khi có entry thừa.
- Ledger thêm disposition **`corrected-public`** (chosenInput `source`, `sourceValueHash` = 50 gốc, `localValueHash`
  = 0.5); validator chiến pháp **từ chối** `activationRate` ngoài [0,1] để lần lỗi đơn vị sau làm build đỏ thay vì
  hiện "—" cho người dùng.
- Candidate dựng lại → validate → promote: `data/tactics.json` **chỉ** đổi đúng một giá trị
  (`tactic:thien-uy-khieu-tran.lookup.activationRate` 50 → 0.5); `heroes-dict.json`/`lookup-catalog.json` không đổi
  byte. Generation Lookup: `lookup:582ec0b0…` → **`lookup:064fd2d5d2b55823974c1e50738996812c90c4badbd8415db6b2ad43e8bd5773`**;
  `data/lookup-manifest.json` = `962ab9eb…`.
- **Nguồn và cách nói:** không nhắc `effectText` làm căn cứ (chuỗi "32%→50%" đó là xác suất **tăng số lần đánh
  thường**, không phải tỷ lệ kích hoạt — Kongming đính chính). Căn cứ dùng trong báo cáo: byte `activationRate":50`
  trong `pipeline/sgsdeck-cache/tactics-list.html`; quy ước đơn vị (mọi chiến pháp khác dùng phân số 0–1; 163 chiến
  pháp ACTIVE trải 0,2–1 và 30 giá trị đúng bằng 0,5); việc đọc 50 là **50%** là suy luận độ tin cậy cao nhưng
  không có nguồn trong game độc lập; và build **cố ý đỏ** nếu thượng nguồn đổi giá trị thô.
- UI: hồ sơ và bảng chiến pháp nay hiện **50%** (trước là "—"); giữ nguyên nhánh "—" + `console.warn` dev cho giá trị
  ngoài khoảng. e2e `unified-lookup.spec.mjs` đổi khẳng định thien-uy từ `—` sang `50%` (lý do ghi ở báo cáo).

**Chuỗi biên tập (N8).** Kongming phán quyết tách đôi, và đã làm đúng:

- **`(Bahamut bsn=36815)`** (8 chiến pháp, trường "Cách nhận") chỉ bị bỏ ở **chuỗi hiển thị**: `js/lookup-detail.js`
  thêm `acquisitionDisplayText()` xoá đúng hậu tố ` (Bahamut bsn=<số>)` ở **cuối** chuỗi và không bao giờ trả chuỗi
  rỗng; `field.value` vẫn là mảng gốc nên dữ liệu, ledger đã review và `data/sgsdeck` giữ nguyên nguồn gốc.
  Không thêm `title`/nhãn mới (sẽ là chữ UI mới).
- **`[Hiệu chỉnh OCR]`** (3 chuỗi) **giữ nguyên từng byte**: đó là bản dịch trung thành của cảnh báo độ tin cậy
  `【OCR校正】` của nguồn; ẩn đi sẽ khiến văn bản chưa kiểm chứng trông như đã xác thực, còn đổi chữ thì cần receipt
  độc lập. Ghi nhận là **nit đã chấp nhận**, chuyển cho vòng review bản dịch sau (nên diễn đạt thành câu cảnh báo
  thường). `pipeline/lookup-translations.json` và `data/sgsdeck/**` **không đổi byte**.

### Gate (sau vòng nit)

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` / `npm run build` / `npm run verify` | pass (0 lỗi, 1 hint; 1 559 trang; gate bản dịch public 0 problem; 1 730 file dist) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **352/352 pass** |
| `npm run test:e2e` | **288/288 pass** |
| `python3 -m unittest discover -s tests` | **381 OK** |
| `node scripts/design-tokens.mjs --check` | pass — legacy **0**, `:root`/`:root[data-theme=dark]` khớp `tokens.json` sau khi thêm 10 token |
| `design-compare --tokens` | 03 **136/136**, 04 **726/726**, 05 **642/643**, 06 **400/400**, 07 **531/531**, 08 **601/602**, 09 (2 ngoại lệ đã khai), 10 **381/381** — **0 lệch chưa giải thích** ở **cả hai theme** |
| `tests-e2e/selected-state-contrast.spec.mjs` (mới) | 5/5 pass |

Chuỗi publish: `inventory` → `build --stage all` → `check --stage all --candidate` (exit 0) → `publish` →
`check --stage public` (exit 0) → re-pin `pipeline/team-route-handles.json` → `team_route_handles --check`
(1 366 / 166 / 17). Policy `site-vi-260926-opus-round-3` → **`site-vi-260926-nit-round-1`** (làm mới hash 5 file:
`js/analyze.js`, `js/app.js`, `js/lookup-detail.js`, `js/roster-recommend-ui.js`, `js/team-filter-section.js`);
`baseline.notes` **không đổi** (56 653 vị trí, `a85e2fd6…`, 5 591/2 088/68/3 503 obligation) nên **không cần
receipt mới**. Generation Recommended: `df725667…` → **`e99d99412bf7c39414f99101ef2a786b50b941792a9319e4920676952b707835`**,
manifest `fbf26a73…` → **`492dcbfeff2057a891473f1c12411353de4b33ce2421bd1c6f0213f8ac5e2fa2`**.

### Test thay đổi có chủ đích

| Test | Thay đổi | Lý do |
| --- | --- | --- |
| `tests-e2e/landing.spec.mjs` | bỏ khẳng định "vùng bảng xem trước cuộn riêng ở 390" | khẳng định đó ghim **đúng hành vi mà N4-1 phải bỏ**; thay bằng 4 khẳng định mới ở 390 **và** 320 |
| `tests-e2e/unified-lookup.spec.mjs` | thien-uy từ `—` sang `50%` | giá trị đã nằm trong khoảng; nhánh "—" vẫn được unit test `ratePercentText` phủ |
| `tests-e2e/beta-tools.spec.mjs` | stub Turnstile mở rộng + 2 ca mới | cần quan sát được `reset`; không nới lỏng khẳng định nào |
| `docs/design/so-binh-phap/tokens.json` | 14 probe trỏ lại `band → select`; 12 giá trị sáng **không đổi** | theo phán quyết; đo theme sáng vì thế giống hệt trước |

### Số liệu cây hiện tại (thay cho số cũ ở §1–§4)

- `policyVersion`: **`site-vi-260926-opus-round-2b`**; `sourceFiles` làm mới hash cho `js/analyze.js`, `js/recommended-reference-render.js`, `js/roster-recommend-ui.js` (2 lượt) và 5 file của vòng trước.
- Generation đang pin: **`27d82121c65bf5443fbe1a1745acab271e8d6f96b1747a83aefba6b282e31cac`** / manifest **`ef994027575931e2`** (trước đó `9e1a982a…` / `872ea98f…`).
- Gate: `check`/`build`/`verify` pass, `test:dist` 28/28, `test:node` 349/349, `unittest` 379 OK; `test:e2e` 275/276 → khẳng định sai đã sửa, `beta-tools` chạy lại 9/9.
- `design-tokens --check` pass (legacy 0, đã phủ `font`/custom property); `design-compare --tokens` phase 03–10 × 2 theme: 0 lệch chưa giải thích.

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
| **P07-R3** (khoá tick A5 của Phase 10) | Nút tên chiến pháp trong bảng Tra cứu chỉ cao **21px** ở mobile (60 nút/trang ở 390 và 320, cả 2 theme) — control duy nhất của hàng nên không có ngoại lệ và không có control tương đương | `.lookup-table-name { display: inline-flex; align-items: center; min-height: var(--control-44) }` trong khối ≤680; probe `bang` thêm ca mobile, `bang.phaseUsed` bổ sung 10 | e2e mới trong `a11y-targets.spec.mjs` (320/390 × 2 theme): **mọi** nút ≥ 44×44, Enter mở đúng hồ sơ, không cuộn ngang; đo trực tiếp 60/60 nút = **44px** ở cả 4 tổ hợp, Enter ra `?group=tactics&id=tactic%3Aan-ui-quan-dan` với hộp thoại đúng tên; ảnh `name-390-light`. `design-compare --tokens --phase 07` = 526/526, `--phase 10` = 381/381 |
| **P10-R1 / N2** | §5 vẫn còn mệnh đề sai "đổi OS khi trang đang mở → cập nhật theo" (lượt round 2 khai đã sửa nhưng không) | Xóa mệnh đề đó; §5 chỉ còn câu đúng (không có listener `matchMedia`) | `grep` trên §5: không còn chuỗi "cập nhật theo" |
| **P10-R1 / N3** | `docs/code-standards.md` dòng 45 và 50 vẫn sai: chỉ `_headers`/`robots.txt` là byte-equal; `_headers` không nêu 8 trang mục và `/fonts/*` (lượt round 2 mới sửa phần từ vựng) | Dòng 45 nay kể cả `public/favicon.png` + cả `public/fonts/`; dòng 50 liệt kê đủ **16 luật** của `public/_headers` (`/`, `/index.html`, 8 trang mục, `/404.html`, `/favicon.png`, `/js/*`, `/css/*`, `/fonts/*`, `/data/*`); "Root Khai hoang"/"tập dữ liệu tab" đổi sang từ vựng trang mục | `grep -c "^/" public/_headers` = 16 khớp danh sách trong tài liệu |
| N3a-1 (từ N-e) | Dấu `·` của dòng phụ thẻ mồ côi ở đầu dòng khi mảnh xuống hàng (54/60 thẻ ở 1440, mọi thẻ ở 320) | Thu hẹp quy tắc còn `.reference-faction + *::before` (chỉ giữa phe và mảnh kế tiếp) | Đo ở 320: mảnh phe `::before: ""` (chấm màu), mảnh "Thống ngự N" có `::before: "·"`, mảnh vai trò `::before: none`; ảnh `cardmeta-320-light` cho thấy dòng vai trò xuống hàng **không** còn dấu ở đầu |

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

Nguồn: `agent://AuditStyleGuideDark` (#1–#3; #4–#6 là `accepted`, giữ).

| Finding | Trạng thái | Chi tiết |
| --- | --- | --- |
| #2 color-scheme | đã sửa | `css/styles.css`: `html[data-theme="light"]{color-scheme:light}` / `html[data-theme="dark"]{color-scheme:dark}`; bỏ `document.documentElement.style.colorScheme` trong script đầu trang (`SiteLayout.astro`) và `root.style.colorScheme` trong `js/site-chrome.js` (inline style từng thắng CSS nên đổi `data-theme` trực tiếp vẫn để scheme sáng). Smoke Chromium `/goi-y-doi/`: đặt `data-theme="dark"` → `getComputedStyle(html).colorScheme = "dark"`; bấm `#theme-toggle` trên `/` → `dark/dark`. |
| #1 nền footer tối | giữ | Bảng tối StyleGuide chỉ có 9 màu (Nền, Thẻ, Thẻ đậm, Chữ, Chữ phụ, Viền, Son, Son nhạt, Dải header — `StyleGuide.dc.html:129-131`), không có giá trị footer; luật "Hai theme" của README không cho tự đặt màu → giữ `--footer-bg` dùng chung, biên footer do `--band-line` + dải Game. |
| #3 mực ấn 兵 tối | giữ | Cùng lý do: bảng tối không có màu mực ấn; 3,02:1 vẫn đạt ngưỡng 3:1 cho đồ hoạ. |
