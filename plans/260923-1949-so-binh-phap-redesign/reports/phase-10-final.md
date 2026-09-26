# Phase 10 — Sổ nợ cuối, số obligation/receipt/generation và gate

Ngày: 2026-09-26 · Plan `260923-1949-so-binh-phap-redesign`.
Bằng chứng chi tiết (đo DOM thật, probe token, ảnh tối) ở [`visual-phase-10.md`](visual-phase-10.md).
File này là bản chốt số liệu cuối theo yêu cầu bước 5–6 của `phase-10-toi-a11y-docs.md`.

## 1. Số obligation / receipt / bản dịch

| Chỉ số | Phase 8 → Phase 9 | Phase 10 | Ghi chú |
| --- | --- | --- | --- |
| `translationObligations` | 5 591 | **5 591** | không thêm/dời/đổi chuỗi `translate` nào |
| `siteLedgerObligations` | 2 088 | **2 088** | không đổi |
| `uiTranslateObligations` | 68 | **68** | không đổi |
| `concreteLocationCount` | 56 653 | **56 653** | `inventory` chạy lại xác nhận |
| `concreteInventorySha256` | `a85e2fd6…` | **`a85e2fd6…`** | không đổi |
| Receipt đã nhận | 5 591 | **5 591** | không cần receipt mới (không dời/đổi `translate`) |
| `policyVersion` | `site-vi-260926-cong-cu-beta` | **`site-vi-260926-toi-a11y-docs`** | chỉ làm mới hash nguồn |
| Hash nguồn đổi | 5 file (Phase 9) | **1 file**: `js/roster-recommend-ui.js` `78c17b38…` → `cbc7cd3b…` | thêm `aria-labelledby`/`id`, không thêm chữ UI |

## 2. Chuỗi generation

| Mốc | Phase 9 | Phase 10 |
| --- | --- | --- |
| `data/website-display.json` `generationId` | `site-localization:514257b9…` | **`site-localization:4db4f297…`** |
| `recommendedPin.generationId` / `manifestSha256` | `362730e1…` / `8c21bffd…` | **`d008d8be…` / `f9a6a4d3…`** |
| `pipeline/team-route-handles.json` `generationId` | `362730e1…` | **`d008d8be…`** (re-pin; `--check` pass: 1 366 recommended / 166 legacy / 17 Khai hoang) |

Chuỗi publish đã chạy đúng thứ tự: `inventory` → `build --stage all` → `check --stage all --candidate` (exit 0) →
`publish` → `check --stage public` (exit 0) → re-pin → `team_route_handles --check` → `build`/`verify`/`test:dist`.

## 3. Gate (bộ A2) — xanh toàn bộ

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` | pass (0 lỗi, 1 hint) |
| `npm run build` | pass — 1 559 trang |
| `npm run verify` | pass (exit 0) |
| `npm run test:dist` | 28/28 pass |
| `npm run test:node` | 347/347 pass |
| `npm run test:e2e` | 258/258 pass (3 ca mới `tests-e2e/a11y-targets.spec.mjs`) |
| `python3 -m unittest discover -s tests` | 377 OK |
| `python3 -m pipeline.team_route_handles --check` | pass |
| `python3 -m pipeline.site_localization check --root . --stage public` | exit 0 |
| `node scripts/design-tokens.mjs --check` | pass — legacy **0** giá trị thô, 12 token chết đã bỏ |
| `node scripts/design-compare.mjs --tokens` (phase 1–9 × light/dark) | 0 lệch chưa giải thích |

## 4. Bảng provenance Phase 1–10

| Phase | `policyVersion` sau phase (theo báo cáo phase) | recommended generation đang pin |
| --- | --- | --- |
| 1 | — (chỉ token/font, không đổi policy) | — |
| 2 | `site-vi-260925-duong-dan-layout` | xem [visual-phase-02](visual-phase-02.md) |
| 3 | `site-vi-260925-header-footer` | xem [visual-phase-03](visual-phase-03.md) |
| 4 | `site-vi-260925-landing` | xem [visual-phase-04](visual-phase-04.md) |
| 5 | `site-vi-260925-doi-danh-sach` | xem [visual-phase-05](visual-phase-05.md) |
| 6 | `site-vi-260925-chi-tiet-doi` | `2c803111…` |
| 7 | `site-vi-260925-tra-cuu` | `9e9136f3…` (commit `c11b58a`) |
| 8 | `site-vi-260925-cung-ton-khai-hoang` | `bacb5510…` |
| 9 | `site-vi-260926-cong-cu-beta` | `362730e1…` (manifest `8c21bffd…`) |
| 10 | **`site-vi-260926-toi-a11y-docs`** | **`d008d8be…`** (manifest `f9a6a4d3…`) |

Các phase 4–5 có thêm lần publish trung gian trong cùng phase; bảng ghi giá trị cuối mỗi phase (chuỗi đầy đủ ở báo
cáo từng phase). Receipt bản dịch **giữ nguyên lịch sử**, không cấp lại: Phase 10 không thêm/dời/đổi obligation nào.
Chỉ mục 24 artboard + StyleGuide → báo cáo sở hữu nằm ở [`visual-phase-10.md`](visual-phase-10.md) §6.

## 5. Sổ nợ cuối (đã đóng / đã ghi quyết định)

### Đã đóng bằng sửa hoặc đo lại

1. Tương phản tối: `.header-cta`, `.landing-btn`, `.pre.sp`, `.pre.co`, `.clear-btn:hover::before`, `.ana-stat` —
   sửa bằng token mới `--on-fill` và `--f-nguy-strong`, đo lại trên DOM thật ở 10 trang × 2 theme × 4 bề rộng: 0 vi phạm
   (ngoại lệ duy nhất: số thứ tự thẻ Landing `aria-hidden` — trang trí, đã ghi lý do).
2. Khối `legacy`: 256 rule / 240 selector / 329 giá trị thô → **0** (87 rule token hoá vào khối "Nền trang + rule
   dùng chung", 169 rule xoá vì không còn đường render); không thu hẹp checker, không bỏ hành vi.
3. 44px + không cuộn ngang: 320/390/768/1440 × 10 trang × 2 theme (80 tổ hợp) + 48 trạng thái mở → 0 control < 44px
   ngoài hai ngoại lệ inline/checkbox-có-nhãn-bọc đã khai; `/soi-doi/` 320 và select mùa ở 320 đã hết tràn ngang.
4. Link nguồn bị cắt ở 320px (nợ Phase 8): trang chi tiết Khai hoang 320/390/1440 × 2 theme — 0 phần tử ngoài khung.
5. Specificity link Cùng Tồn: đo `/cung-ton/` cả hai theme — 0 vi phạm tương phản, chip/nút vẫn 44px.
6. Probe thiếu/đo nhầm: sửa 1 selector (`nut-phu`) + 3 ref màu CTA; mọi phase × 2 theme 0 lệch; ảnh chụp theme đã
   đúng ở Phase 9.
7. Imperceptible-focus `P09-R1` (ô nhập JSON): 0/60 lượt Tab không thấy vòng focus ở 320/390/1440 × 2 theme.
8. Hai nhóm Tra cứu thưa (`troop-mods` 16, `buildings` 41): render + hộp thoại hồ sơ có dữ liệu, 0 `pageerror`.
9. Bề mặt hướng dẫn Khai hoang (`.kh-guide*`) token hoá: đo lại trên đội có `guide`, đạt ở cả hai theme.
10. A7: 7 tài liệu cập nhật theo mô hình đường dẫn + token (bảng ở §7 của `visual-phase-10.md`).
11. Render an toàn: `js/` chỉ còn 2 comment nhắc quy tắc, **0** chỗ ghi HTML bằng chuỗi với dữ liệu.
12. Vòng sửa Kongming P10: ba họ control < 44px đã sửa và có regression `tests-e2e/a11y-targets.spec.mjs`;
    8 điểm tài liệu sai contract đã sửa; 12 token bảng màu hết consumer đã xoá; chỉ mục artboard + bảng provenance
    đã bổ sung (chi tiết ở `visual-phase-10.md` §11b).

### Hạn chế kế thừa / ngoài phạm vi — quyết định giữ nguyên

| Nợ | Quyết định |
| --- | --- |
| Ngân sách tải khởi động chung (~2,1 MB source hash; hồ sơ đầy đủ ~6,2 s dưới throttle) | Giữ ngoài phạm vi plan; đường hồ sơ Tra cứu dùng `hero-summaries.json` (~1,03 s trung vị) đúng ngân sách 2 s |
| Lịch sử pity mẫu số cứng `/30` | Giữ (không bịa mốc lịch sử, không đổi schema lưu trữ) |
| Đội bị khoá hiện id canonical từ engine | Giữ (không đổi engine/xếp hạng, đã ghi ở báo cáo Phase 9) |
| Control chọn tệp native của Gợi ý đội | Giữ control native; đã thêm `aria-labelledby` + 44px (sai lệch trình bày có tên truy cập và vùng bấm đạt) |
| Nút chính nền dải trên nền tối (~1,24:1 hình dạng, chữ 15,5:1) | Giữ theo bảng tối StyleGuide; ghi là hạn chế thẩm mỹ đã chấp nhận, không phải vi phạm A4 |
| Ảnh chân dung CDN ngoài | Cần kiểm trên origin deploy; localhost không gọi được CDN (giới hạn môi trường) |
| Turnstile trên preview localhost (Cloudflare `110200`) | Hành vi Turnstile kiểm bằng mock trong `tests-e2e/beta-tools.spec.mjs`; preview thật thuộc bước deploy |
| Markup publish không đường render (`team-pk.js`, `meta-cu.js`, `hero-list.js`, `hero-detail.js`, `tactics.js`) | CSS đã xoá theo; xoá module + entry manifest để phase riêng nếu muốn dọn tiếp |

## Vòng sửa Opus round 2 — số liệu thay cho §1–§4 (2026-09-26)

Khối này **thay thế** mọi số liệu policy/generation/manifest/gate ở §1–§4 (chúng thuộc cây trước vòng sửa):

| Mục | Giá trị trên cây hiện tại |
| --- | --- |
| `policyVersion` | **`site-vi-260926-opus-round-2b`** (trước: `site-vi-260926-toi-a11y-docs` → `site-vi-260926-opus-recheck`) |
| `sourceFiles` làm mới hash | 5 file ở vòng P3/P7 (`js/lookup-detail.js`, `js/site-nav.js`, `js/unified-lookup.js`, `src/layouts/SiteLayout.astro`, `src/pages/doi-chuan/index.astro`) + 3 file ở vòng round 2 (`js/analyze.js`, `js/recommended-reference-render.js`, `js/roster-recommend-ui.js`) |
| Generation đang pin | **`27d82121c65bf5443fbe1a1745acab271e8d6f96b1747a83aefba6b282e31cac`**, manifest **`ef994027575931e2`** (trước: `9e1a982a…`/`872ea98f…`, rồi `ac620801…`/`6a935bb3…`) |
| Obligation sửa chữ | 2 obligation `authored-vi`: `ui:section-page/doi-chuan` (meta description) và `ui:lookup/badge-cost` (biểu thức) — không cần receipt; số đếm không đổi: 5591 / 2088 / 68, `concreteLocationCount` 56 653, `concreteInventorySha256` `a85e2fd6…` |
| Gate cuối | `check`/`build`/`verify` pass (1559 trang, 0 problem), `test:dist` **28/28**, `test:node` **349/349**, `python3 -m unittest discover -s tests` **379 OK**, `test:e2e` **276/276**, `design-tokens --check` pass (legacy 0), `design-compare --tokens` phase 03–10 × 2 theme **0 lệch chưa giải thích** |
| A5 sau vòng sửa | chip nhóm Tra cứu mobile 44px (chữ căn giữa), link nguồn SGSDeck 44px, link đội tiêu biểu trong hồ sơ là cả hàng ≥44px; sweep 320/390 × 2 theme không còn control đứng riêng dưới 44px |

### Cập nhật round 3

- `policyVersion`: **`site-vi-260926-opus-round-3`**; hash `js/analyze.js` làm mới (P9-R1).
- Generation đang pin: **`df725667d70890c15f1848c90346bb7d4db7107ab3eb57af09f76bd0732edc16`**, manifest **`fbf26a73fa10bc01`** (trước đó `27d82121…`/`ef994027…`); generation trung gian đã xóa, chỉ còn bản đang pin.
- Gate: `check`/`build`/`verify` pass, `test:dist` 28/28, `test:node` 349/349, `test:e2e` **278/278 pass**, `unittest` **379 OK**; `design-tokens --check` pass; `design-compare --tokens` 07 **526/526**, 09 chỉ ngoại lệ đã khai, 10 **381/381** (cả 2 theme).
- A5 nay đầy đủ ở mobile: chip nhóm 44px, nút tên chiến pháp 44px (P07-R3), link nguồn 44px, hàng đội tiêu biểu là cả hàng ≥44px.
