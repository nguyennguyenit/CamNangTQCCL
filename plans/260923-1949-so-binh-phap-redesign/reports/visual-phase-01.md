# Phase 1 — Báo cáo thị giác: token, font, component nền, công cụ so ảnh

Ngày: 2026-09-25 · Artboard: `StyleGuide.dc.html` + inline style của 24 artboard trang (bản chụp `1790191281-3a81`)
Phạm vi: plan `260923-1949-so-binh-phap-redesign`, [phase-01](../phase-01-token-font-nen.md).
Bản này là **bản sửa sau rà soát NO-GO** (Kongming): bốn nhóm việc bắt buộc đã xử lý, bằng chứng ở §1.4, §2.1 và §10. Chưa commit — orchestrator commit sau go/no-go lần hai.

Phase 1 **không có cặp ảnh nào** (StyleGuide rộng 1280 không có trang tương ứng), nên tầng bố cục của phase được soát bằng tầng vi mô: `tokens.json` + script tương phản (A1 của plan ghi đúng cách này). Bảng so ảnh của các phase sau nằm trong `scripts/design-compare.mjs` (mục `PAIRS`); công cụ đã được sửa vòng đời tiến trình và yêu cầu mốc `ready` tường minh (§2.1).

## 1. Vi mô (tự động)

### 1.1 `node scripts/design-tokens.mjs --check`

```
ok   :root khớp tokens.json; 0 mã màu ngoài khối token; 0 giá trị thô ngoài khối legacy.
     mốc legacy: 657 giá trị thô trên 303 selector (ceiling đã ghi trong file).
        8  .team-filters
        7  .clear-btn
        7  .filter-collapse-toggle
        6  .site-header
        6  .icon-btn
        6  .section-nav
        6  .layout
        6  .fchip
        6  .sel-tag
        6  .rt-btn
        6  .team-filter-bar
        6  .section-menu-items .nav-tab
        6  .score-toggle
        5  .nav-tab
        5  .team-name
        5  .badge
        5  .pre
        5  .tac-q
        5  .rt-slot
        5  .apt
```

- `:root` và `:root[data-theme="dark"]` khớp **từng tên, từng giá trị và đúng thứ tự** với `tokens.json` (174 token khối sáng, 30 token khối tối).
- **0 mã màu** ngoài khối token (43 mã hex + 10 literal `rgba()` trong CSS cũ đã thay bằng token).
- **0 giá trị vi mô thô** trong CSS mới của phase (khối token, `@font-face`, component nền).
- **Mốc khối legacy: 657 giá trị thô** trên 303 selector, ghi ở `/* legacy:start ceiling=657 */`. Số đo trước khi bọc khối legacy (cả file `css/styles.css`, lúc đó chưa có mốc) là 751; phần giảm chủ yếu là literal bên trong `box-shadow`/`rgba` đã gom thành token. Bản sửa NO-GO **không làm tăng** con số này (vẫn 657 — mọi rule mới nằm ngoài khối legacy).

### 1.2 `node scripts/design-compare.mjs --tokens --phase 01`

Chạy trên `npm run preview` (base `http://127.0.0.1:4321`), 15 component nền có probe trong `tokens.json`, đo `getComputedStyle` trên trang `/` thật. Mỗi probe khai **trạng thái** riêng: `default`, `focus` (Tab để trình duyệt ở chế độ bàn phím rồi focus nút chính) và `pressed` (bấm một chip phe thật rồi đo đúng chip đang bật). Probe đổi trạng thái thì trang được nạp lại URL gốc trước probe kế tiếp.

**Theme sáng** — 117/118 thuộc tính khớp, 0 lệch chưa giải thích:

```
| Component | Trạng thái | Selector | Thuộc tính | Mong đợi | Thực tế |
| --- | --- | --- | --- | --- | --- |
| select-nhan-caps | default | `#season-controls select` | `line-height` | 19.58px | normal |

117/118 thuộc tính khớp token (theme light, phase 1); 0 lệch chưa giải thích.
đã giải thích: select-nhan-caps line-height = normal — select là form control: Chrome tính `line-height: normal`, bỏ qua line-height của token (chiều cao đã khóa bằng control.44)
```

**Theme tối** — 117/118 thuộc tính khớp, 0 lệch chưa giải thích:

```
| Component | Trạng thái | Selector | Thuộc tính | Mong đợi | Thực tế |
| --- | --- | --- | --- | --- | --- |
| select-nhan-caps | default | `#season-controls select` | `line-height` | 19.58px | normal |

117/118 thuộc tính khớp token (theme dark, phase 1); 0 lệch chưa giải thích.
đã giải thích: select-nhan-caps line-height = normal — select là form control: Chrome tính `line-height: normal`, bỏ qua line-height của token (chiều cao đã khóa bằng control.44)
```

Phạm vi đo đã bù hai lỗ hổng Kongming chỉ ra:

- **Letter-spacing của vai trò chữ**: `font: type.<vai trò>` nay được mở thành 5 thuộc tính (thêm `letter-spacing` khi vai trò có), và `em` được quy về px **theo font-size thật của phần tử**. Nhãn caps (`.flabel`, `.flabel-inline`, `.rt-kicker`) đã áp `letter-spacing: var(--type-field-caps-spacing)` — trước bản sửa đo được 0,55px (0,05em legacy) trong khi token ghi 0,12em = 1,32px; nay khớp (§1.4).
- **Trạng thái bật/đã chọn và nút phụ**: probe `chip-loc` có thêm trạng thái `pressed` (bấm `.fchip.f-thuc` → đo `background-color`/`border-color`/`color` của `.fchip.f-thuc[aria-pressed='true']` so với token `--band`/`--band-ink`), và component `nut-phu` có probe trên nút phụ thật của công cụ Chiêu mộ (`.rt-btn:not(.rt-primary)`, 44px, `--panel-3`/`--line`/`--ink`).
- **Ngoại lệ hẹp lại**: ngoại lệ `line-height` của `<select>` nay gắn `actual: "normal"` — chỉ đúng kết quả đã tài liệu hóa mới được giải thích, giá trị khác vẫn là lệch (§10, ca C).

### 1.3 Tương phản token

Script tạm (không commit, Phase 10 làm lại bản đầy đủ trên DOM): `.cache/design-verify/contrast.mjs` — đọc `tokens.json`, tính WCAG cho mọi cặp chữ/nền đang dùng.

| Cặp | Tỷ lệ | Ngưỡng | Kết quả |
| --- | --- | --- | --- |
| sáng: Mực / Giấy (`#1E1B16` trên `#F3EEE3`) | 14.83:1 | 4.5:1 | đạt |
| sáng: Chữ phụ / Giấy (`#5F5A50` trên `#F3EEE3`) | 5.92:1 | 4.5:1 | đạt |
| sáng: Son / Giấy (`#A8202A` trên `#F3EEE3`) | 6.25:1 | 4.5:1 | đạt |
| sáng: Chữ son trên son nhạt (`#8E1B24` trên `#F6E1DC`) | 7.17:1 | 4.5:1 | đạt |
| sáng: Chữ trên giấy đậm (badge loại binh, nhãn 40Y) (`#3A352D` trên `#EAE3D4`) | 9.52:1 | 4.5:1 | đạt |
| sáng: Chữ trên nền control (`#1E1B16` trên `#F7F2E8`) | 15.38:1 | 4.5:1 | đạt |
| sáng: Chữ trên dải (`#F3EEE3` trên `#1C1A17`) | 15.01:1 | 4.5:1 | đạt |
| sáng: Chữ phụ trên dải (`#A99F8E` trên `#1C1A17`) | 6.64:1 | 4.5:1 | đạt |
| sáng: Nhãn mờ trên dải (`#8F8676` trên `#1C1A17`) | 4.83:1 | 4.5:1 | đạt |
| sáng: Link trên dải (`#E4DCCB` trên `#1C1A17`) | 12.73:1 | 4.5:1 | đạt |
| sáng: Mục menu chưa chọn trên dải (`#CFC6B6` trên `#1C1A17`) | 10.26:1 | 4.5:1 | đạt |
| sáng: Nhãn Beta trên dải (`#D9CDB4` trên `#1C1A17`) | 11.03:1 | 4.5:1 | đạt |
| sáng: Chữ trên nền son (`#FFFFFF` trên `#A8202A`) | 7.23:1 | 4.5:1 | đạt |
| sáng: Chữ trên huy hiệu sao (`#5A4500` trên `#F5C542`) | 5.66:1 | 4.5:1 | đạt |
| sáng: Chữ trên tier T1.5 (`#3A2C00` trên `#D4A017`) | 5.74:1 | 4.5:1 | đạt |
| sáng: Đạt / nền đạt (chip khắc chế hiện tại) (`#1F7A4D` trên `#E0EFE6`) | 4.47:1 | 4.5:1 | ghi nhận cho phase 5 |
| sáng: Nên tránh / nền nên tránh (`#B8232C` trên `#FBF1EE`) | 5.71:1 | 4.5:1 | đạt |
| sáng: nhãn chưa kiểm chứng (`#6B2FB3` trên `#EFE0FB`) | 6.23:1 | 4.5:1 | đạt |
| sáng: nhãn tình huống (`#9A5A1A` trên `#FDE9D6`) | 4.62:1 | 4.5:1 | đạt |
| sáng: chữ trên nhãn đề cử (`#FFFFFF` trên `#1F7A4D`) | 5.32:1 | 4.5:1 | đạt |
| tối: Chữ / Nền (`#EDE6D8` trên `#16140F`) | 14.82:1 | 4.5:1 | đạt |
| tối: Chữ phụ / Nền (`#A99F8E` trên `#16140F`) | 7.04:1 | 4.5:1 | đạt |
| tối: Son / Nền (`#E3646A` trên `#16140F`) | 5.52:1 | 4.5:1 | đạt |
| tối: Son / Thẻ đậm (`#E3646A` trên `#2A2620`) | 4.51:1 | 4.5:1 | đạt |
| tối: Chữ son trên son nhạt (`#FF858B` trên `#3A2023`) | 6.37:1 | 4.5:1 | đạt |
| tối: Mực 2 / Thẻ đậm (badge loại binh, nhãn 40Y) (`#CFC6B6` trên `#2A2620`) | 8.88:1 | 4.5:1 | đạt |
| tối: Chữ / Thẻ (`#EDE6D8` trên `#201D18`) | 13.53:1 | 4.5:1 | đạt |
| tối: Chữ trên nền control (`#EDE6D8` trên `#2A2620`) | 12.11:1 | 4.5:1 | đạt |
| tối: Chữ trên dải (`#EDE6D8` trên `#0F0E0B`) | 15.54:1 | 4.5:1 | đạt |
| tối: Chữ phụ trên dải (`#A99F8E` trên `#0F0E0B`) | 7.39:1 | 4.5:1 | đạt |
| tối: Nhãn mờ trên dải (`#8F8676` trên `#0F0E0B`) | 5.37:1 | 4.5:1 | đạt |
| tối: nhãn SP/badge/nút legacy (chữ trên son tối) (`#FFFFFF` trên `#E3646A`) | 3.33:1 | 4.5:1 | ghi nhận cho phase 10 |
| tối: chữ trắng trên nền phe Ngụy (nhãn `.apt-a`) (`#FFFFFF` trên `#4F74D6`) | 4.37:1 | 4.5:1 | ghi nhận cho phase 10 |
| tối: Đạt / nền đạt (`#5FCE95` trên `#1C3328`) | 6.92:1 | 4.5:1 | đạt |
| tối: Nên tránh / nền nên tránh (`#FF858B` trên `#362325`) | 6.31:1 | 4.5:1 | đạt |
| sáng: chấm phe Ngụy / Thẻ (`#1F3A93` trên `#FFFCF5`) | 9.83:1 | 3:1 | đạt |
| sáng: chấm phe Thục / Thẻ (`#1F7A4D` trên `#FFFCF5`) | 5.19:1 | 3:1 | đạt |
| sáng: chấm phe Ngô / Thẻ (`#B8232C` trên `#FFFCF5`) | 6.18:1 | 3:1 | đạt |
| sáng: chấm phe Quần / Thẻ (`#B08422` trên `#FFFCF5`) | 3.32:1 | 3:1 | đạt |
| sáng: nhãn SP (chữ trên son) (`#FFFFFF` trên `#A8202A`) | 7.23:1 | 4.5:1 | đạt |
| sáng: nhãn CO (chữ trên vàng khien) (`#FFFFFF` trên `#8A6D1F`) | 4.90:1 | 4.5:1 | đạt |
| sáng: chấm phe Hỗn hợp / Thẻ (`#6B45A0` trên `#FFFCF5`) | 6.87:1 | 3:1 | đạt |
| tối: chấm phe Ngụy / Thẻ (`#4F74D6` trên `#201D18`) | 3.84:1 | 3:1 | đạt |
| tối: chấm phe Thục / Thẻ (`#5FCE95` trên `#201D18`) | 8.60:1 | 3:1 | đạt |
| tối: chấm phe Ngô / Thẻ (`#E0555D` trên `#201D18`) | 4.50:1 | 3:1 | đạt |
| tối: chấm phe Quần / Thẻ (`#E0B94E` trên `#201D18`) | 8.97:1 | 3:1 | đạt |
| tối: chấm phe Hỗn hợp / Thẻ (`#A884E0` trên `#201D18`) | 5.63:1 | 3:1 | đạt |

44 cặp thuộc Phase 1; 0 cặp Phase 1 không đạt; 3 cặp ghi nhận cho phase sau.

**Đối chiếu brainstorm §11.5** (số của plan so với số đo lại từ token):

| Cặp §11.5 | Plan | Đo lại | Kết quả |
| --- | --- | --- | --- |
| Sáng trên Giấy: Mực | 14.8 | 14.83 | khớp |
| Sáng trên Giấy: Chữ phụ | 5.9 | 5.92 | khớp |
| Sáng trên Giấy: Son | 6.3 | 6.25 | khớp |
| Tối trên Nền: Chữ | 14.8 | 14.82 | khớp |
| Tối trên Nền: Chữ phụ | 7.0 | 7.04 | khớp |
| Tối trên Nền: Son | 5.5 | 5.52 | khớp |
| Tối: Son trên Thẻ đậm | 4.51 | 4.51 | khớp |
| Footer: `#8F8676` trên `#1C1A17` | 4.83 | 4.83 | khớp |
| Footer: `#A99F8E` trên `#1C1A17` | 6.64 | 6.64 | khớp |
| Phe làm màu chữ | dưới 4.5 → không dùng | giữ nguyên: phe chỉ tô chấm 8px `aria-hidden`, chữ tên phe luôn đi kèm | đạt |

Ba cặp nợ cũ ghi nhận cho phase sau (cặp hồi quy `.pre.y40` mà Phase 1 tự gây ra **không** nằm trong bảng này — nó đã được sửa ngay trong Phase 1, xem §1.4 và §7.1):

| Chỗ | Tỷ lệ | Phân loại | Xử lý |
| --- | --- | --- | --- |
| `.chip.good` (khắc chế): `--good` trên `--good-bg` artboard `#E0EFE6` | 4.47:1 | **nợ cũ** (khối cũ `#DFF0E6` cũng chỉ 4.49:1) | Phase 5: chip khắc chế theo spec trung tính của StyleGuide (`--panel-3` + `--ink-2` = 15,4:1) |
| Chữ trắng trên Son tối: nhãn `.pre.sp`, `.sel-tag`, `.ana-btn`, nút son ở công cụ | 3.33:1 | **nợ cũ**: trắng trên `#E0555D` của khối cũ đã là 3,73:1 — dưới 4,5:1 từ trước; Phase 1 đổi `--accent` tối theo artboard sang `#E3646A` nên tỷ lệ xuống 3,33:1 (vẫn hỏng như trước, nay hỏng thêm 0,4) | Phase 9/10: bảng tối dùng chữ mực trên Son (`#16140F` = 5,52:1) hoặc nền `--band` |
| Chữ trắng trên nền phe Ngụy tối: nhãn `.apt-a` (`--f-nguy` tối) | 4.37:1 | **nợ cũ** | Phase 10, cùng cách xử lý như trên |

`.pre.y40` **không còn là nợ**: nó là hồi quy do chính Phase 1 gây ra (xem §7.1) và đã được sửa trong phase này.

### 1.4 Bằng chứng trên DOM thật sau khi sửa

`.cache/design-verify/proofs.mjs` (script tạm) mở `/` thật ở cả hai theme, đọc computed style và bấm chip phe:

```
theme light
  .pre.y40        chữ rgb(58, 53, 45) trên rgb(234, 227, 212) → 9.52:1
  .flabel         letter-spacing 1.32px trên font-size 11px (token 0.12em)
  chip tắt        chữ rgb(30, 27, 22) trên rgb(247, 242, 232) → 15.38:1 (min-height 44px, radius 999px)
  chip bật        chữ rgb(243, 238, 227) trên rgb(28, 26, 23) → 15.01:1
  nút phụ (rt-btn) chữ rgb(30, 27, 22) trên rgb(247, 242, 232) → 15.38:1 (min-height 44px)
theme dark
  .pre.y40        chữ rgb(207, 198, 182) trên rgb(42, 38, 32) → 8.88:1
  .flabel         letter-spacing 1.32px trên font-size 11px (token 0.12em)
  chip tắt        chữ rgb(237, 230, 216) trên rgb(42, 38, 32) → 12.11:1 (min-height 44px, radius 999px)
  chip bật        chữ rgb(237, 230, 216) trên rgb(15, 14, 11) → 15.54:1
  nút phụ (rt-btn) chữ rgb(237, 230, 216) trên rgb(42, 38, 32) → 12.11:1 (min-height 44px)
```

- `.pre.y40`: **9,52:1** (sáng) và **8,88:1** (tối) — yêu cầu ≥ 4,5:1 của Kongming đạt ở cả hai theme.
- `.flabel`: `letter-spacing` 1,32px trên font-size 11px = đúng `0.12em` của token `type.field-caps` (trước bản sửa: 0,55px).
- Chip tắt / chip đang bật / nút phụ: đều 44px, radius 999/10, tương phản 12–15:1 ở cả hai theme.

## 2. Bố cục (người duyệt)

Phase 1 không có cặp `{artboard, path}` nào: StyleGuide không có trang tương ứng và các trang thật chưa mang bố cục mới (Phase 3–9 mới dựng từng mục). Công cụ vẫn được chạy thật end-to-end bằng cặp của Phase 4 (`Landing` 1440 và `LandingMobile` 390 trên `/`): 2 ảnh ghép ở `.cache/design-compare/phase-04/` (không commit), tiến trình **exit 0 sau ~2 giây**; kết quả so bố cục đó không phải bằng chứng của Phase 1.

### 2.1 Sửa vòng đời tiến trình và mốc sẵn sàng (P1 của Kongming)

Trước bản sửa, `capturePairs()` mở **hai browser cho mỗi cặp**, không giữ handle để đóng, chỉ `server.close()` không `await` trong `finally` và bỏ qua lỗi chờ mốc — tiến trình chạy xong ảnh nhưng không thoát. Nay:

- **Một browser cho cả lần chạy**, mỗi bề rộng/theme một `context` trong `try/finally` (`figures` chụp trang so ảnh cũng vậy).
- `closeServer()` gọi `closeAllConnections()` rồi `await new Promise(done => server.close(done))` — connection keep-alive của trang so ảnh bị cắt nên handle HTTP không giữ tiến trình.
- **Không `process.exit`** để che rò; mọi lỗi đi qua exception và để tiến trình thoát tự nhiên (mã 1).
- **Mốc sẵn sàng tường minh**: mỗi cặp ảnh **bắt buộc** khai `ready` (selector chỉ có sau khi nội dung dựng xong; thiếu là lỗi ngay từ đầu), probe chờ chính phần tử của nó (hoặc `ready` riêng) rồi `document.fonts.ready` + hai `requestAnimationFrame`. Không còn `.catch(() => {})` và không còn delay cứng 1,2 giây.
- Probe có `setup` (đổi trạng thái) tự **nạp lại URL gốc** trước probe kế tiếp để trạng thái không rò giữa các component.

Bằng chứng (đầy đủ ở §10): chụp thật 2 cặp exit 0; setup sai → exit 1 sau 5,6 giây; mốc `ready` sai → exit 1 sau 20 giây; điều hướng hỏng → exit 1 sau 0,3 giây; ảnh chụp trang thật cao 4.134px (đúng nội dung, không còn ảnh 1.000px của trang trống).

## 3. Bảng tần suất giá trị artboard (nguồn của `tokens.json`)

**Bảng đầy đủ, không cắt dòng** (bản trước cắt ở 40 dòng và làm mất 62 giá trị `padding`, 9 giá trị `width`…; nay in hết mọi cặp giá trị/số lần).

# Tần suất giá trị artboard — 24 artboard trang

Nguồn: `docs/design/so-binh-phap/project/*.dc.html` (inline style + `<style>`), trích bằng
`node scripts/design-tokens.mjs --extract`. Bỏ 3 artboard hướng A/B/C và StyleGuide.
`<dynamic>` là giá trị nội suy `{{ … }}` theo dữ liệu mẫu, không phải giá trị thiết kế.

20781 khai báo, 598 cặp thuộc tính/giá trị
trên 70 thuộc tính.

## Bảng màu `renderVals()` (StyleGuide)

| Nhóm | Tên | Giá trị |
| --- | --- | --- |
| sáng | Giấy (nền) | `#F3EEE3` |
| sáng | Thẻ | `#FFFCF5` |
| sáng | Giấy đậm | `#EAE3D4` |
| sáng | Mực | `#1E1B16` |
| sáng | Chữ phụ | `#5F5A50` |
| sáng | Viền | `#D8CFBD` |
| sáng | Son | `#A8202A` |
| sáng | Son nhạt | `#F6E1DC` |
| sáng | Dải header | `#1C1A17` |
| tối | Nền | `#16140F` |
| tối | Thẻ | `#201D18` |
| tối | Thẻ đậm | `#2A2620` |
| tối | Chữ | `#EDE6D8` |
| tối | Chữ phụ | `#A99F8E` |
| tối | Viền | `#3A352D` |
| tối | Son | `#E3646A` |
| tối | Son nhạt | `#3A2023` |
| tối | Dải header | `#0F0E0B` |
| phe Ngụy | sáng #1F3A93 · tối #4F74D6 | |
| phe Thục | sáng #1F7A4D · tối #5FCE95 | |
| phe Ngô | sáng #B8232C · tối #E0555D | |
| phe Quần | sáng #B08422 · tối #E0B94E | |
| phe Hỗn hợp | sáng #6B45A0 · tối #A884E0 | |

## Giá trị theo thuộc tính

**font-size** — 38 giá trị

| Giá trị | Lần |
| --- | --- |
| `12.5px` | 325 |
| `13.5px` | 282 |
| `12px` | 254 |
| `15px` | 220 |
| `13px` | 212 |
| `14.5px` | 166 |
| `14px` | 159 |
| `11px` | 155 |
| `11.5px` | 57 |
| `17px` | 55 |
| `16px` | 53 |
| `19px` | 37 |
| `20px` | 31 |
| `22px` | 30 |
| `64px` | 26 |
| `24px` | 24 |
| `48px` | 22 |
| `14.0px` | 21 |
| `10px` | 15 |
| `28px` | 13 |
| `18px` | 10 |
| `10.5px` | 9 |
| `15.5px` | 9 |
| `34px` | 8 |
| `44px` | 8 |
| `30px` | 7 |
| `40px` | 5 |
| `26px` | 4 |
| `36px` | 4 |
| `21px` | 3 |
| `16.5px` | 2 |
| `76px` | 2 |
| `32px` | 1 |
| `38px` | 1 |
| `42px` | 1 |
| `52px` | 1 |
| `56px` | 1 |
| `84px` | 1 |

**font-family** — 6 giá trị

| Giá trị | Lần |
| --- | --- |
| `'Noto Serif Display', Georgia, serif` | 242 |
| `'Noto Serif TC', 'Songti TC', serif` | 64 |
| `'Be Vietnam Pro', system-ui, sans-serif` | 24 |
| `'Be Vietnam Pro',system-ui,sans-serif` | 24 |
| `inherit` | 22 |
| `'Be Vietnam Pro', sans-serif` | 12 |

**font-weight** — 5 giá trị

| Giá trị | Lần |
| --- | --- |
| `600` | 711 |
| `700` | 427 |
| `500` | 255 |
| `400` | 41 |
| `<dynamic>` | 8 |

**line-height** — 17 giá trị

| Giá trị | Lần |
| --- | --- |
| `1` | 61 |
| `1.35` | 38 |
| `1.3` | 37 |
| `1.4` | 30 |
| `1.5` | 26 |
| `1.6` | 24 |
| `1.05` | 21 |
| `1.55` | 18 |
| `1.2` | 14 |
| `1.45` | 10 |
| `1.1` | 8 |
| `1.25` | 7 |
| `1.65` | 7 |
| `1.15` | 6 |
| `0.9` | 3 |
| `1.02` | 2 |
| `1.7` | 1 |

**letter-spacing** — 6 giá trị

| Giá trị | Lần |
| --- | --- |
| `0.14em` | 87 |
| `0.12em` | 34 |
| `0.08em` | 14 |
| `0.1em` | 13 |
| `0.16em` | 8 |
| `-0.01em` | 1 |

**text-transform** — 1 giá trị

| Giá trị | Lần |
| --- | --- |
| `uppercase` | 156 |

**color** — 31 giá trị

| Giá trị | Lần |
| --- | --- |
| `#5F5A50` | 749 |
| `#1E1B16` | 513 |
| `#8F8676` | 180 |
| `#F3EEE3` | 145 |
| `#3A352D` | 143 |
| `#8E1B24` | 138 |
| `#A8202A` | 133 |
| `#CFC6B6` | 76 |
| `#E4DCCB` | 56 |
| `#F9F3E6` | 27 |
| `#7E1620` | 26 |
| `#A99F8E` | 25 |
| `#B8AF9F` | 22 |
| `#1F6B4A` | 17 |
| `#D9CDB4` | 14 |
| `#E36A6F` | 13 |
| `#1F3A93` | 12 |
| `<dynamic>` | 12 |
| `#B08422` | 11 |
| `#FFFFFF` | 11 |
| `#1F7A4D` | 10 |
| `#2E2A24` | 8 |
| `#FFF8EF` | 8 |
| `#B8232C` | 6 |
| `#7A4B00` | 4 |
| `#7FC99E` | 3 |
| `#D8CFBD` | 3 |
| `#9A9284` | 2 |
| `#1C1A17` | 1 |
| `#6E141C` | 1 |
| `#7A4A45` | 1 |

**background** — 31 giá trị

| Giá trị | Lần |
| --- | --- |
| `#FFFCF5` | 269 |
| `#1C1A17` | 75 |
| `#EAE3D4` | 75 |
| `#A8202A` | 70 |
| `transparent` | 63 |
| `#F7F2E8` | 50 |
| `#F3EEE3` | 49 |
| `<dynamic>` | 38 |
| `#F6E1DC` | 33 |
| `none` | 31 |
| `#FBF7EE` | 29 |
| `#B08422` | 13 |
| `#E4E8F4` | 12 |
| `#F3EAD3` | 11 |
| `rgba(20, 18, 16, 0.35)` | 11 |
| `#1F3A93` | 10 |
| `#1F7A4D` | 10 |
| `#E0EFE6` | 10 |
| `#DDEFE4` | 8 |
| `#B8232C` | 6 |
| `#FBEBD0` | 4 |
| `#141210` | 2 |
| `#7FC99E` | 2 |
| `#F3F8F4` | 2 |
| `#FBF1EE` | 2 |
| `rgba(20, 18, 16, 0.45)` | 2 |
| `#34302A` | 1 |
| `#E36A6F` | 1 |
| `#FFFFFF` | 1 |
| `repeating-linear-gradient(45deg, #E6DECF 0 8px, #EFE8DA 8px 16px)` | 1 |
| `rgba(28, 26, 23, 0.55)` | 1 |

**border** — 14 giá trị

| Giá trị | Lần |
| --- | --- |
| `1px solid #D8CFBD` | 281 |
| `none` | 95 |
| `1px solid #CFC5B1` | 54 |
| `1px solid #E0D6C4` | 52 |
| `1px solid #1C1A17` | 20 |
| `1px solid #A8202A` | 19 |
| `1px solid #6A6254` | 14 |
| `1px solid #3F3A32` | 13 |
| `1px solid #34302A` | 7 |
| `1.5px solid #B9AE98` | 4 |
| `1px solid #1F6B4A` | 2 |
| `1px solid #5A5348` | 2 |
| `1px solid #E7C3BB` | 2 |
| `2px dashed #CFC5B1` | 2 |

**padding** — 102 giá trị

| Giá trị | Lần |
| --- | --- |
| `0 12px` | 190 |
| `10px 12px` | 125 |
| `0 14px` | 113 |
| `0` | 100 |
| `14px 12px` | 48 |
| `10px 8px` | 41 |
| `0 9px` | 39 |
| `10px 0` | 39 |
| `10px 12px 12px` | 36 |
| `0 16px` | 33 |
| `10px` | 30 |
| `2px 8px` | 27 |
| `12px 0 4px` | 26 |
| `14px 18px` | 25 |
| `0 4px` | 24 |
| `14px 16px` | 19 |
| `1px 6px` | 18 |
| `1px 7px` | 16 |
| `4px 8px` | 16 |
| `12px 16px` | 15 |
| `14px` | 14 |
| `16px 18px` | 14 |
| `12px 0` | 13 |
| `0 10px` | 12 |
| `0 18px` | 12 |
| `0 6px 0 12px` | 12 |
| `16px` | 12 |
| `0 48px` | 11 |
| `0 8px 0 4px` | 11 |
| `12px 18px` | 11 |
| `12px 14px` | 10 |
| `22px 48px` | 10 |
| `24px 16px 32px` | 9 |
| `40px 48px 56px` | 9 |
| `12px 12px` | 8 |
| `0 8px` | 7 |
| `10px 4px` | 7 |
| `22px` | 7 |
| `9px 0` | 7 |
| `14px 18px 12px` | 6 |
| `0 24px` | 5 |
| `0 28px` | 5 |
| `10px 18px` | 5 |
| `18px` | 5 |
| `24px` | 5 |
| `2px 18px 6px` | 5 |
| `88px 64px` | 5 |
| `0 11px` | 4 |
| `12px 20px 0` | 4 |
| `14px 20px 0` | 4 |
| `3px` | 4 |
| `6px 20px 10px` | 4 |
| `0 20px` | 3 |
| `0 6px` | 3 |
| `14px 20px` | 3 |
| `20px` | 3 |
| `20px 24px` | 3 |
| `26px` | 3 |
| `28px` | 3 |
| `8px 4px` | 3 |
| `0 64px` | 2 |
| `10px 14px` | 2 |
| `10px 20px 14px` | 2 |
| `14px 14px 12px` | 2 |
| `16px 20px 12px` | 2 |
| `2px 14px 6px` | 2 |
| `2px 20px` | 2 |
| `30px` | 2 |
| `0 14px 14px` | 1 |
| `0 22px` | 1 |
| `0 22px 18px` | 1 |
| `0 28px 28px` | 1 |
| `12px` | 1 |
| `12px 14px 0` | 1 |
| `12px 14px 10px` | 1 |
| `12px 22px` | 1 |
| `14px 0` | 1 |
| `14px 14px` | 1 |
| `14px 14px 0` | 1 |
| `16px 22px 22px` | 1 |
| `18px 0` | 1 |
| `18px 16px` | 1 |
| `20px 22px 16px` | 1 |
| `22px 16px` | 1 |
| `24px 28px` | 1 |
| `24px 28px 28px` | 1 |
| `28px 16px 36px` | 1 |
| `28px 16px 40px` | 1 |
| `28px 28px 24px` | 1 |
| `2px 18px` | 1 |
| `32px 48px 56px` | 1 |
| `36px 16px 24px` | 1 |
| `40px 48px` | 1 |
| `44px 64px` | 1 |
| `64px 64px 28px` | 1 |
| `6px 14px 10px` | 1 |
| `72px 64px` | 1 |
| `72px 64px 96px` | 1 |
| `8px` | 1 |
| `8px 0` | 1 |
| `96px 64px` | 1 |
| `9px 14px 0` | 1 |

**margin** — 7 giá trị

| Giá trị | Lần |
| --- | --- |
| `0` | 323 |
| `6px 0 0` | 14 |
| `0 -8px` | 4 |
| `0 0 4px` | 1 |
| `0 auto` | 1 |
| `24px 0 0` | 1 |
| `4px 0 0` | 1 |

**gap** — 34 giá trị

| Giá trị | Lần |
| --- | --- |
| `6px` | 458 |
| `2px` | 187 |
| `8px` | 178 |
| `10px` | 128 |
| `12px` | 81 |
| `4px` | 74 |
| `5px` | 67 |
| `3px` | 49 |
| `16px` | 23 |
| `14px` | 22 |
| `4px 14px` | 22 |
| `24px` | 21 |
| `40px` | 21 |
| `22px` | 13 |
| `20px` | 10 |
| `18px` | 7 |
| `4px 12px` | 7 |
| `4px 10px` | 6 |
| `7px` | 6 |
| `36px` | 5 |
| `28px` | 4 |
| `2px 12px` | 3 |
| `32px` | 3 |
| `26px` | 2 |
| `2px 8px` | 2 |
| `56px` | 2 |
| `0` | 1 |
| `0 16px` | 1 |
| `0 18px` | 1 |
| `0 20px` | 1 |
| `1px` | 1 |
| `24px 16px` | 1 |
| `48px` | 1 |
| `64px` | 1 |

**row-gap** — 4 giá trị

| Giá trị | Lần |
| --- | --- |
| `2px` | 30 |
| `4px` | 13 |
| `3px` | 1 |
| `6px` | 1 |

**column-gap** — 5 giá trị

| Giá trị | Lần |
| --- | --- |
| `12px` | 41 |
| `10px` | 7 |
| `14px` | 1 |
| `20px` | 1 |
| `8px` | 1 |

**border-radius** — 15 giá trị

| Giá trị | Lần |
| --- | --- |
| `10px` | 227 |
| `999px` | 173 |
| `12px` | 134 |
| `14px` | 62 |
| `5px` | 58 |
| `2px` | 46 |
| `6px` | 42 |
| `3px` | 30 |
| `4px` | 29 |
| `16px` | 25 |
| `9px` | 17 |
| `8px` | 16 |
| `50%` | 14 |
| `11px` | 4 |
| `18px` | 2 |

**min-height** — 11 giá trị

| Giá trị | Lần |
| --- | --- |
| `44px` | 86 |
| `36px` | 82 |
| `40px` | 40 |
| `32px` | 30 |
| `52px` | 24 |
| `34px` | 11 |
| `48px` | 8 |
| `56px` | 4 |
| `130px` | 1 |
| `150px` | 1 |
| `42px` | 1 |

**height** — 55 giá trị

| Giá trị | Lần |
| --- | --- |
| `72px` | 88 |
| `44px` | 57 |
| `24px` | 51 |
| `8px` | 49 |
| `100%` | 39 |
| `6px` | 30 |
| `132px` | 24 |
| `32px` | 22 |
| `220px` | 18 |
| `26px` | 18 |
| `40px` | 17 |
| `96px` | 12 |
| `60px` | 11 |
| `30px` | 6 |
| `10px` | 5 |
| `48px` | 5 |
| `16px` | 4 |
| `38px` | 4 |
| `1px` | 3 |
| `1592px` | 2 |
| `18px` | 2 |
| `22px` | 2 |
| `34px` | 2 |
| `56px` | 2 |
| `76px` | 2 |
| `7px` | 2 |
| `1240px` | 1 |
| `1272px` | 1 |
| `1320px` | 1 |
| `1350px` | 1 |
| `1372px` | 1 |
| `1392px` | 1 |
| `1440px` | 1 |
| `1452px` | 1 |
| `1560px` | 1 |
| `1600px` | 1 |
| `1640px` | 1 |
| `164px` | 1 |
| `1672px` | 1 |
| `1720px` | 1 |
| `1760px` | 1 |
| `1800px` | 1 |
| `1832px` | 1 |
| `1992px` | 1 |
| `2000px` | 1 |
| `20px` | 1 |
| `2852px` | 1 |
| `36px` | 1 |
| `4136px` | 1 |
| `4420px` | 1 |
| `50px` | 1 |
| `64px` | 1 |
| `720px` | 1 |
| `80px` | 1 |
| `9px` | 1 |

**width** — 49 giá trị

| Giá trị | Lần |
| --- | --- |
| `44px` | 48 |
| `8px` | 42 |
| `500px` | 14 |
| `100%` | 13 |
| `1440px` | 13 |
| `26px` | 13 |
| `340px` | 13 |
| `40px` | 13 |
| `24px` | 12 |
| `390px` | 11 |
| `70%` | 10 |
| `32px` | 9 |
| `16px` | 4 |
| `1px` | 4 |
| `80%` | 4 |
| `10px` | 3 |
| `220px` | 3 |
| `68%` | 3 |
| `85%` | 3 |
| `90%` | 3 |
| `21%` | 2 |
| `320px` | 2 |
| `34px` | 2 |
| `40%` | 2 |
| `480px` | 2 |
| `64px` | 2 |
| `79%` | 2 |
| `7px` | 2 |
| `120px` | 1 |
| `18px` | 1 |
| `19%` | 1 |
| `2%` | 1 |
| `200px` | 1 |
| `23%` | 1 |
| `230px` | 1 |
| `250px` | 1 |
| `31%` | 1 |
| `358px` | 1 |
| `36px` | 1 |
| `60px` | 1 |
| `65%` | 1 |
| `71%` | 1 |
| `74%` | 1 |
| `76%` | 1 |
| `77%` | 1 |
| `80px` | 1 |
| `81%` | 1 |
| `960px` | 1 |
| `9px` | 1 |

**box-shadow** — 4 giá trị

| Giá trị | Lần |
| --- | --- |
| `0 24px 60px rgba(0, 0, 0, 0.45)` | 30 |
| `inset 0 0 0 2px rgba(249,243,230,0.25)` | 18 |
| `0 24px 60px rgba(0, 0, 0, 0.35)` | 1 |
| `0 30px 60px rgba(0, 0, 0, 0.35)` | 1 |

**z-index** — 5 giá trị

| Giá trị | Lần |
| --- | --- |
| `3` | 30 |
| `4` | 11 |
| `5` | 11 |
| `1` | 2 |
| `2` | 2 |

**grid-template-columns** — 32 giá trị

| Giá trị | Lần |
| --- | --- |
| `minmax(0, 1fr) auto` | 17 |
| `repeat(2, minmax(0, 1fr))` | 13 |
| `140px minmax(0, 0.8fr) 20px minmax(0, 1.2fr)` | 12 |
| `repeat(3, minmax(0, 1fr))` | 8 |
| `40px minmax(0, 1fr)` | 6 |
| `84px 40px minmax(0, 1fr) 88px` | 6 |
| `minmax(0, 1fr) 34px` | 6 |
| `24px minmax(0, 1fr) auto` | 5 |
| `34px minmax(0, 1fr) auto auto` | 5 |
| `repeat(6, minmax(0, 1fr))` | 5 |
| `26px minmax(0, 1fr)` | 2 |
| `272px minmax(0, 1fr)` | 2 |
| `120px minmax(0, 1fr)` | 1 |
| `132px minmax(0, 1fr) 44px` | 1 |
| `1fr 1.2fr 1fr` | 1 |
| `1fr 1fr` | 1 |
| `38px minmax(0, 1fr)` | 1 |
| `40px 128px minmax(0, 1fr)` | 1 |
| `440px minmax(0, 1fr)` | 1 |
| `auto minmax(0, 1fr)` | 1 |
| `minmax(0, 0.85fr) minmax(0, 1.15fr)` | 1 |
| `minmax(0, 0.9fr) minmax(0, 1.1fr)` | 1 |
| `minmax(0, 1.35fr) minmax(0, 1fr)` | 1 |
| `minmax(0, 1fr) 220px` | 1 |
| `minmax(0, 1fr) 340px` | 1 |
| `minmax(0, 1fr) 520px` | 1 |
| `minmax(0, 1fr) minmax(0, 1.1fr)` | 1 |
| `minmax(0, 1fr) minmax(0, 1.25fr)` | 1 |
| `minmax(0, 2fr) repeat(4, minmax(0, 1fr))` | 1 |
| `repeat(4, minmax(0, 1fr))` | 1 |
| `repeat(5, minmax(0, 1fr))` | 1 |
| `repeat(7, minmax(0, 1fr))` | 1 |

**max-width** — 7 giá trị

| Giá trị | Lần |
| --- | --- |
| `720px` | 7 |
| `760px` | 4 |
| `640px` | 2 |
| `360px` | 1 |
| `460px` | 1 |
| `600px` | 1 |
| `620px` | 1 |

**min-width** — 6 giá trị

| Giá trị | Lần |
| --- | --- |
| `0` | 21 |
| `44px` | 10 |
| `240px` | 3 |
| `160px` | 2 |
| `200px` | 1 |
| `20px` | 1 |

**outline** — 1 giá trị

| Giá trị | Lần |
| --- | --- |
| `none` | 8 |

**padding-top** — 4 giá trị

| Giá trị | Lần |
| --- | --- |
| `12px` | 3 |
| `10px` | 1 |
| `20px` | 1 |
| `8px` | 1 |

**padding-bottom** — 2 giá trị

| Giá trị | Lần |
| --- | --- |
| `28px` | 9 |
| `36px` | 1 |

**padding-left** — 2 giá trị

| Giá trị | Lần |
| --- | --- |
| `0` | 3 |
| `52px` | 3 |

**margin-top** — 7 giá trị

| Giá trị | Lần |
| --- | --- |
| `auto` | 9 |
| `2px` | 8 |
| `1px` | 3 |
| `4px` | 3 |
| `6px` | 2 |
| `-4px` | 1 |
| `5px` | 1 |

**margin-bottom** — 2 giá trị

| Giá trị | Lần |
| --- | --- |
| `6px` | 5 |
| `0` | 1 |

**inset** — 1 giá trị

| Giá trị | Lần |
| --- | --- |
| `0` | 1 |

Thuộc tính khác (không dùng làm token): -webkit-box-orient, -webkit-line-clamp, align-items, align-self, border-bottom, border-collapse, border-left, border-right, border-top, bottom, box-sizing, cursor, display, flex, flex-direction, flex-grow, flex-shrink, flex-wrap, font, font-style, font-variant-numeric, grid-column, grid-row, justify-content, justify-self, left, list-style, margin-left, margin-right, opacity, overflow, position, right, text-align, text-decoration, text-overflow, text-wrap, top, vertical-align, white-space

## Tổ hợp chữ theo phần tử (nguồn cho nhóm `type`)

| Font · size · weight · line-height · letter-spacing | Lần |
| --- | --- |
| `kế thừa · kế thừa · kế thừa · kế thừa · kế thừa` | 1727 |
| `kế thừa · 12.5px · kế thừa · kế thừa · kế thừa` | 272 |
| `kế thừa · 13px · kế thừa · kế thừa · kế thừa` | 157 |
| `kế thừa · 13.5px · 500 · kế thừa · kế thừa` | 134 |
| `kế thừa · 15px · 600 · kế thừa · kế thừa` | 132 |
| `kế thừa · 12px · kế thừa · kế thừa · kế thừa` | 110 |
| `kế thừa · kế thừa · 600 · kế thừa · kế thừa` | 81 |
| `kế thừa · 13.5px · 600 · kế thừa · kế thừa` | 72 |
| `kế thừa · 14px · 600 · kế thừa · kế thừa` | 70 |
| `kế thừa · 11px · 700 · kế thừa · 0.14em` | 67 |
| `kế thừa · 13.5px · kế thừa · kế thừa · kế thừa` | 64 |
| `kế thừa · 14.5px · 600 · kế thừa · kế thừa` | 59 |
| `kế thừa · 12px · 600 · kế thừa · kế thừa` | 52 |
| `Noto Serif Display · 17px · 700 · kế thừa · kế thừa` | 51 |
| `kế thừa · 11.5px · kế thừa · kế thừa · kế thừa` | 51 |
| `kế thừa · 14.5px · 500 · kế thừa · kế thừa` | 47 |
| `kế thừa · 14px · kế thừa · kế thừa · kế thừa` | 37 |
| `kế thừa · kế thừa · 400 · kế thừa · kế thừa` | 37 |
| `kế thừa · 15px · 600 · 1.3 · kế thừa` | 36 |
| `kế thừa · 12px · kế thừa · 1.35 · kế thừa` | 36 |
| `kế thừa · 11px · 600 · kế thừa · 0.12em` | 33 |
| `Noto Serif Display · 22px · 700 · kế thừa · kế thừa` | 28 |
| `Noto Serif Display · 20px · 700 · kế thừa · kế thừa` | 26 |
| `Be Vietnam Pro · kế thừa · kế thừa · kế thừa · kế thừa` | 24 |
| `kế thừa · 16px · 600 · kế thừa · kế thừa` | 24 |
| `Noto Serif TC · 64px · 600 · 1 · kế thừa` | 24 |
| `kế thừa · 14px · 500 · kế thừa · kế thừa` | 23 |
| `kế thừa · 12px · kế thừa · 1.4 · kế thừa` | 23 |
| `kế thừa · 14.0px · kế thừa · kế thừa · kế thừa` | 21 |
| `kế thừa · 12.5px · 600 · kế thừa · kế thừa` | 20 |
| `kế thừa · 13px · 600 · kế thừa · kế thừa` | 19 |
| `kế thừa · 13px · 700 · kế thừa · kế thừa` | 18 |
| `kế thừa · 14.5px · kế thừa · kế thừa · kế thừa` | 17 |
| `kế thừa · 13px · kế thừa · 1.5 · kế thừa` | 16 |
| `Noto Serif Display · 19px · 700 · kế thừa · kế thừa` | 15 |
| `kế thừa · 15px · kế thừa · 1.6 · kế thừa` | 15 |
| `kế thừa · 10px · 600 · kế thừa · kế thừa` | 14 |
| `Noto Serif Display · 16px · 700 · kế thừa · kế thừa` | 14 |
| `kế thừa · 11px · 700 · kế thừa · kế thừa` | 14 |
| `Noto Serif TC · 24px · 700 · kế thừa · kế thừa` | 13 |

## Giá trị thô trong `css/styles.css`

Ceiling khối legacy ghi trong comment: **657**.
Đang đo: **657** giá trị thô trong khối legacy, **15** ngoài khối legacy.

| Thuộc tính | Số giá trị thô (legacy) |
| --- | --- |
| `padding` | 161 |
| `font-size` | 119 |
| `gap` | 112 |
| `border-radius` | 60 |
| `margin` | 41 |
| `font-weight` | 38 |
| `min-height` | 28 |
| `margin-top` | 22 |
| `line-height` | 18 |
| `margin-bottom` | 16 |
| `height` | 8 |
| `letter-spacing` | 7 |
| `z-index` | 6 |
| `box-shadow` | 6 |
| `padding-top` | 4 |
| `padding-bottom` | 3 |
| `padding-block` | 3 |
| `margin-right` | 1 |
| `margin-left` | 1 |
| `background` | 1 |
| `padding-left` | 1 |
| `margin-block` | 1 |

| Selector | Số giá trị thô (legacy) |
| --- | --- |
| `.team-filters` | 8 |
| `.clear-btn` | 7 |
| `.filter-collapse-toggle` | 7 |
| `.site-header` | 6 |
| `.icon-btn` | 6 |
| `.section-nav` | 6 |
| `.layout` | 6 |
| `.fchip` | 6 |
| `.sel-tag` | 6 |
| `.rt-btn` | 6 |
| `.team-filter-bar` | 6 |
| `.section-menu-items .nav-tab` | 6 |
| `.score-toggle` | 6 |
| `.nav-tab` | 5 |
| `.team-name` | 5 |
| `.badge` | 5 |
| `.pre` | 5 |
| `.tac-q` | 5 |
| `.rt-slot` | 5 |
| `.apt` | 5 |
| `.lookup-more` | 5 |
| `.lookup-backdrop` | 5 |
| `.search` | 4 |
| `.clear-btn::before` | 4 |
| `.team-filter-bar .stats` | 4 |
| `.flabel` | 4 |
| `.combo-input` | 4 |
| `.combo-list` | 4 |
| `.combo-item` | 4 |
| `.tag` | 4 |
| `.chip` | 4 |
| `.ct-meta` | 4 |
| `.enemy` | 4 |
| `.kh-variant-select` | 4 |
| `.kh-sources` | 4 |
| `.kh-guide` | 4 |
| `.kh-guide-rating` | 4 |
| `.kh-card .kh-detail-link` | 4 |
| `.tac-toolbar` | 4 |
| `.tac-type` | 4 |
| `.tac-troop` | 4 |
| `.rt-select, .rt-form input, .rt-form select` | 4 |
| `.rt-btn-small` | 4 |
| `.rt-message` | 4 |
| `.rt-pity` | 4 |
| `.rt-limited` | 4 |
| `.ht-type` | 4 |
| `.ana-disclaimer` | 4 |
| `.ana-btn` | 4 |
| `.ana-stat` | 4 |
| `.ana-tac` | 4 |
| `.ana-book` | 4 |
| `.section-menu-toggle` | 4 |
| `.roster-chip-list li, .roster-status` | 4 |
| `.roster-remove` | 4 |
| `.season-config-detail` | 4 |
| `.reference-scope-controls input,.reference-scope-controls select` | 4 |
| `.skip-link` | 4 |
| `.detail-link,.detail-action` | 4 |
| `.site-header h1,.site-title` | 3 |
| `.disclaimer` | 3 |
| `.fchip[class*="f-"]::before` | 3 |
| `.card-head` | 3 |
| `.badge.unit.small` | 3 |
| `.hero` | 3 |
| `.hero-name` | 3 |
| `.line` | 3 |
| `.counters` | 3 |
| `.coexist-subteam-title` | 3 |
| `.kh-section-title` | 3 |
| `.kh-variant-control` | 3 |
| `.kh-season-context` | 3 |
| `.kh-build-context, .kh-build-note, .kh-commander, .kh-opening-note` | 3 |
| `.kh-guide-overview, .kh-guide-scope, .kh-guide-red, .kh-guide-warning, .kh-guide-note` | 3 |
| `.tac-search` | 3 |
| `.tac-card` | 3 |
| `.rt-kicker` | 3 |
| `.rt-pity-label` | 3 |
| `.rt-daily-meta` | 3 |
| `.rt-form label` | 3 |
| `.rt-history-item` | 3 |
| `.flabel-inline` | 3 |
| `.hero-card` | 3 |
| `.hero-overlay` | 3 |
| `.hero-overlay-close` | 3 |
| `.hero-modal` | 3 |
| `.hero-stat` | 3 |
| `.hero-apt .apt` | 3 |
| `.hero-tactic` | 3 |
| `.ana-rh` | 3 |
| `.team-filters .fchip` | 3 |
| `.season-hero-slot` | 3 |
| `.season-slot select,.team-filter-bar select` | 3 |
| `.season-opt-in` | 3 |
| `.reference-alternatives > summary` | 3 |
| `.lookup-profile button` | 3 |
| `.brand` | 2 |
| `.header-actions` | 2 |
| `.stats` | 2 |
| `.section-menu-items` | 2 |
| `.filter-bar` | 2 |
| `.combo-selected` | 2 |
| `.badge.beta` | 2 |
| `.notes` | 2 |
| `.coexist-group` | 2 |
| `.coexist-group > h3` | 2 |
| `.coexist-subteam` | 2 |
| `.coexist-summary-box` | 2 |
| `.coexist-summary` | 2 |
| `.kh-line .kh-label` | 2 |
| `.kh-note` | 2 |
| `.kh-guide-title` | 2 |
| `.kh-guide-list ol, .kh-guide-list ul` | 2 |
| `.cham-su-title` | 2 |
| `.kh-detail-build-head` | 2 |
| `.site-footer` | 2 |
| `.tac-grid` | 2 |
| `.tac-viet` | 2 |
| `.tac-sub` | 2 |
| `.tac-desc` | 2 |
| `.rt-section` | 2 |
| `.rt-section-head` | 2 |
| `.rt-sub` | 2 |
| `.rt-warning` | 2 |
| `.rt-history-meta` | 2 |
| `.rt-note` | 2 |
| `.section-intro` | 2 |
| `.section-intro-title` | 2 |
| `.hero-grid` | 2 |
| `.hc-icon` | 2 |
| `.hc-name` | 2 |
| `.hero-modal-icon` | 2 |
| `.hero-modal-name` | 2 |
| `.hs-val` | 2 |
| `.ht-head` | 2 |
| `.ht-slot` | 2 |
| `.ht-name` | 2 |
| `.ht-effect` | 2 |
| `.ana-status` | 2 |
| `.ana-hero` | 2 |
| `.ana-hero-head` | 2 |
| `.ana-hero-icon` | 2 |
| `.ana-books` | 2 |
| `.ana-team-link` | 2 |
| `.roster-scan-card, .roster-review-panel, .roster-locked-team, .roster-result-team` | 2 |
| `.roster-add-row` | 2 |
| `.scope-note` | 2 |
| `.reference-scope-controls` | 2 |
| `.reference-scope-controls label` | 2 |
| `.reference-team-card .team-name` | 2 |
| `.reference-alternatives` | 2 |
| `.reference-alternatives .alternative-line` | 2 |
| `.detail-actions` | 2 |
| `.detail-section > h2` | 2 |
| `.detail-facts` | 2 |
| `.lookup-chips` | 2 |
| `.lookup-search` | 2 |
| `.lookup-card > button` | 2 |
| `.lookup-dialog` | 2 |
| `.lookup-profile p` | 2 |
| `body` | 1 |
| `.top-header` | 1 |
| `.site-title` | 1 |
| `.tagline` | 1 |
| `.nav-tab.active` | 1 |
| `.search:focus-visible, .combo-input:focus-visible` | 1 |
| `.clear-btn:focus-visible` | 1 |
| `.fgroup` | 1 |
| `.chip-row` | 1 |
| `.fchip:focus-visible` | 1 |
| `.sel-tag:focus-visible` | 1 |
| `.team-grid` | 1 |
| `.team-card` | 1 |
| `.units` | 1 |
| `.head-right` | 1 |
| `.badge.tier` | 1 |
| `.badge.recommend` | 1 |
| `.heroes` | 1 |
| `.hn` | 1 |
| `.variant` | 1 |
| `.vg` | 1 |
| `.alt-sep` | 1 |
| `.t-book` | 1 |
| `.empty, .error` | 1 |
| `.coexist-teams` | 1 |
| `.ct-meta-item b` | 1 |
| `.coexist-summary-box > summary` | 1 |
| `.mines` | 1 |
| `.mine` | 1 |
| `.mine h3` | 1 |
| `.enemies` | 1 |
| `.kh-block` | 1 |
| `.kh-cards` | 1 |
| `.kh-card` | 1 |
| `.kh-title` | 1 |
| `.kh-variant-select:focus-visible` | 1 |
| `.kh-guide-ratings` | 1 |
| `.kh-guide-details` | 1 |
| `.kh-guide-details summary` | 1 |
| `.kh-guide-list` | 1 |
| `.cham-su-cards` | 1 |
| `.cham-su-card` | 1 |
| `.kh-detail-row` | 1 |
| `.kh-detail-build` | 1 |
| `.site-footer .credit` | 1 |
| `.tac-filter-row` | 1 |
| `.tac-chips` | 1 |
| `.tac-count` | 1 |
| `.tac-head` | 1 |
| `.tac-cn` | 1 |
| `.tac-meta` | 1 |
| `.tac-descs` | 1 |
| `.tac-desc-label` | 1 |
| `.rt-shell` | 1 |
| `.rt-section h2` | 1 |
| `.rt-account-bar` | 1 |
| `.rt-account-main` | 1 |
| `.rt-actions` | 1 |
| `.rt-pity strong` | 1 |
| `.rt-slot-grid` | 1 |
| `.rt-slot-main` | 1 |
| `.rt-slot-label` | 1 |
| `.rt-slot-status` | 1 |
| `.rt-slot-actions` | 1 |
| `.rt-limited-list` | 1 |
| `.rt-limited-main` | 1 |
| `.rt-empty` | 1 |
| `.rt-form` | 1 |
| `.rt-history` | 1 |
| `.rt-history-hero` | 1 |
| `.section-intro-sub` | 1 |
| `.fgroup-inline` | 1 |
| `.hc-body` | 1 |
| `.hc-badges` | 1 |
| `.hc-apt` | 1 |
| `.apt-troop` | 1 |
| `.hero-modal-head` | 1 |
| `.hero-modal-id` | 1 |
| `.hero-modal-badges` | 1 |
| `.hero-modal-cn` | 1 |
| `.hero-stats` | 1 |
| `.hs-label` | 1 |
| `.hero-apt` | 1 |
| `.hero-tactics` | 1 |
| `.ana-setup` | 1 |
| `.ana-drop` | 1 |
| `.ana-preview` | 1 |
| `.ana-turnstile` | 1 |
| `.ana-results` | 1 |
| `.ana-heroes` | 1 |
| `.ana-hero-name` | 1 |
| `.ana-flag` | 1 |
| `.ana-tactics` | 1 |
| `.ana-teams` | 1 |
| `.ana-note` | 1 |
| `.section-menu-toggle[data-label-mode="icon"]::before` | 1 |
| `.team-filter-bar .filter-bar` | 1 |
| `.team-filter-bar .filter-bar .search` | 1 |
| `.team-filter-bar .clear-btn` | 1 |
| `.filter-collapse-toggle::after` | 1 |
| `.filter-collapse-toggle:focus-visible` | 1 |
| `.roster-recommend` | 1 |
| `.roster-token-row, .roster-scan-grid, .roster-review-grid` | 1 |
| `.roster-scan-card` | 1 |
| `.roster-chip-list` | 1 |
| `.roster-chip-list li` | 1 |
| `.roster-locked-list, .roster-results, .roster-results section` | 1 |
| `.roster-result-head` | 1 |
| `.roster-empty` | 1 |
| `.season-controls` | 1 |
| `.season-raw` | 1 |
| `.season-slot` | 1 |
| `.season-slot span` | 1 |
| `.season-inventory-comparison` | 1 |
| `.season-tier-group` | 1 |
| `.season-team-groups .fchip,.season-controls button` | 1 |
| `.team-filter-bar .fchip` | 1 |
| `.season-config-detail summary,.season-config-detail button,.season-team-groups .ana-link-btn,.season-team-groups .team-name,#section-coexist .fchip,#section-coexist .clear-btn,#section-coexist .search` | 1 |
| `.season-config-detail summary` | 1 |
| `.season-controls select,.season-slot select,#section-coexist .search` | 1 |
| `.reference-holder .line` | 1 |
| `.reference-team-card .team-head` | 1 |
| `.reference-score.missing-score` | 1 |
| `.reference-team-card .card-head` | 1 |
| `.reference-alternatives .reference-holder` | 1 |
| `.reference-detail-holder` | 1 |
| `.slot-label` | 1 |
| `.detail-back-row` | 1 |
| `.detail-header` | 1 |
| `.detail-title` | 1 |
| `.detail-source-title` | 1 |
| `.detail-score` | 1 |
| `.detail-section` | 1 |
| `.detail-facts > div` | 1 |
| `.detail-facts dt` | 1 |
| `.detail-note` | 1 |
| `.reference-detail .counters` | 1 |
| `.reference-team-card > .ana-link-btn` | 1 |
| `.lookup-chip` | 1 |
| `.lookup-grid` | 1 |
| `.lookup-card > img` | 1 |
| `.lookup-close` | 1 |
| `.lookup-profile` | 1 |

## 4. `tokens.json` so với `renderVals()`

Mọi màu của `renderVals()` đều thành token, giữ đúng giá trị (không làm tròn); tên biến giữ như plan.md bước 1b yêu cầu:

| Nhóm | Tên trong artboard | Giá trị | Token | Đường dẫn | Kết quả |
| --- | --- | --- | --- | --- | --- |
| sáng | Giấy (nền) | `#F3EEE3` | `--bg` | `color.light.bg` | khớp |
| sáng | Thẻ | `#FFFCF5` | `--panel` | `color.light.panel` | khớp |
| sáng | Giấy đậm | `#EAE3D4` | `--panel-2` | `color.light.panel-2` | khớp |
| sáng | Mực | `#1E1B16` | `--ink` | `color.light.ink` | khớp |
| sáng | Chữ phụ | `#5F5A50` | `--muted` | `color.light.muted` | khớp |
| sáng | Viền | `#D8CFBD` | `--line` | `color.light.line` | khớp |
| sáng | Son | `#A8202A` | `--accent` | `color.light.accent` | khớp |
| sáng | Son nhạt | `#F6E1DC` | `--accent-soft` | `color.light.accent-soft` | khớp |
| sáng | Dải header | `#1C1A17` | `--band` | `color.light.band` | khớp |
| tối | Nền | `#16140F` | `--bg` | `color.dark.bg` | khớp |
| tối | Thẻ | `#201D18` | `--panel` | `color.dark.panel` | khớp |
| tối | Thẻ đậm | `#2A2620` | `--panel-2` | `color.dark.panel-2` | khớp |
| tối | Chữ | `#EDE6D8` | `--ink` | `color.dark.ink` | khớp |
| tối | Chữ phụ | `#A99F8E` | `--muted` | `color.dark.muted` | khớp |
| tối | Viền | `#3A352D` | `--line` | `color.dark.line` | khớp |
| tối | Son | `#E3646A` | `--accent` | `color.dark.accent` | khớp |
| tối | Son nhạt | `#3A2023` | `--accent-soft` | `color.dark.accent-soft` | khớp |
| tối | Dải header | `#0F0E0B` | `--band` | `color.dark.band` | khớp |
| phe | Ngụy | `#1F3A93 / #4F74D6` | `--f-nguy` | `color.faction.nguy` | khớp |
| phe | Thục | `#1F7A4D / #5FCE95` | `--f-thuc` | `color.faction.thuc` | khớp |
| phe | Ngô | `#B8232C / #E0555D` | `--f-ngo` | `color.faction.ngo` | khớp |
| phe | Quần | `#B08422 / #E0B94E` | `--f-quan` | `color.faction.quan` | khớp |
| phe | Hỗn hợp | `#6B45A0 / #A884E0` | `--f-honhop` | `color.faction.honhop` | khớp |

Ngoài 23 mục trên, khối token còn có: dải/nền tối của header-footer-menu (`--band-ink`, `--band-muted`, `--band-dim`, `--band-faint`, `--band-link`, `--band-line`, `--band-row-line`, `--band-control-line`, `--band-active`, `--band-beta-line`, `--band-beta-ink`, `--nav-idle`, `--nav-underline`, `--seal-ink`), màu bổ sung plan.md yêu cầu (`--panel-3`, `--ink-2`, `--line-2`, `--accent-ink`, `--on-accent`, `--on-gold`, `--overlay`, `--focus-ring`), màu đơn vị/tier/trạng thái giữ từ khối cũ, và hai màu sửa theo contract (xem §7).

**Thang vi mô** (`space` 27 bước, `radius` 15, `control` 12, `shadow` 10, `focus` 2, `border` 4, `z` 9, `motion` 3, `font` 4, `type` 27 vai trò) giữ đúng giá trị artboard. Chỗ contract thắng artboard ghi ở `note` của token: `control.38`/`control.40` (mobile 44px theo §11.4), `control.34` bị bỏ vì §11.4 yêu cầu 44px, `panel-3`/`ink-2`/`line-2` khi bảng tối không có mặt tương ứng.

## 5. Font và ấn 兵

Nguồn gốc đầy đủ ở `docs/design/so-binh-phap/README.md` (§"Font self-host", §"Ấn 兵"): URL request CSS2 + **URL `fonts.gstatic.com` riêng cho từng woff2** + SHA-256 từng file + ngày tải; lệnh trích glyph + phiên bản fontTools + URL/SHA-256 font nguồn cho ấn 兵.

Kiểm trên trình duyệt thật (`/`, cả hai theme):


=== theme light ===
html data-theme: light | không cuộn ngang: true
font faces đã tải: Be Vietnam Pro 400 loaded · Be Vietnam Pro 500 loaded · Be Vietnam Pro 600 loaded · Be Vietnam Pro 700 loaded · Noto Serif Display 700 unloaded · Noto Serif Display 700 loaded
woff2 tải về: /fonts/be-vietnam-pro-400-latin.woff2, /fonts/noto-serif-display-700-latin.woff2, /fonts/be-vietnam-pro-700-latin.woff2, /fonts/be-vietnam-pro-600-latin.woff2, /fonts/be-vietnam-pro-700-latin-ext.woff2, /fonts/be-vietnam-pro-700-vietnamese.woff2, /fonts/be-vietnam-pro-400-vietnamese.woff2, /fonts/be-vietnam-pro-400-latin-ext.woff2, /fonts/be-vietnam-pro-500-latin.woff2, /fonts/be-vietnam-pro-600-vietnamese.woff2, /fonts/be-vietnam-pro-600-latin-ext.woff2, /fonts/be-vietnam-pro-500-vietnamese.woff2, /fonts/be-vietnam-pro-500-latin-ext.woff2
request tới Google Fonts: 0 []
pageerror: 2 [
  '[Cloudflare Turnstile] Error: 110200.',
  '[Cloudflare Turnstile] Error: 110200.'
]
   #section-team-chuan .reference-team-card → "Be Vietnam Pro" 15px/400 rgb(30, 27, 22) trên rgb(255, 252, 245)
   #section-team-chuan .reference-team-card .badge.faction → "Be Vietnam Pro" 12px/600 rgb(30, 27, 22) trên rgb(255, 252, 245)
   #section-team-chuan .reference-team-card .badge.unit → "Be Vietnam Pro" 12px/600 rgb(58, 53, 45) trên rgb(234, 227, 212)
   #section-team-chuan .reference-team-card .reference-score → "Noto Serif Display" 28px/700 rgb(168, 32, 42) trên rgba(0, 0, 0, 0)
   #section-team-chuan .reference-team-card .tag.t-tactic → "Be Vietnam Pro" 12.5px/500 rgb(142, 27, 36) trên rgb(246, 225, 220)
   #section-team-chuan .fchip → "Be Vietnam Pro" 14px/600 rgb(30, 27, 22) trên rgb(247, 242, 232)
   #section-team-chuan .search → "Be Vietnam Pro" 15px/400 rgb(30, 27, 22) trên rgb(255, 252, 245)
   #season-controls select → "Be Vietnam Pro" 14.5px/400 rgb(30, 27, 22) trên rgb(255, 252, 245)
   #section-team-chuan .ana-link-btn → "Be Vietnam Pro" 14px/600 rgb(243, 238, 227) trên rgb(28, 26, 23)
   #section-team-chuan .flabel → "Be Vietnam Pro" 11px/600 rgb(95, 90, 80) trên rgba(0, 0, 0, 0)
  nhãn phe: Quần

=== theme dark ===
html data-theme: dark | không cuộn ngang: true
font faces đã tải: Be Vietnam Pro 400 loaded · Be Vietnam Pro 500 loaded · Be Vietnam Pro 600 loaded · Be Vietnam Pro 700 loaded · Noto Serif Display 700 unloaded · Noto Serif Display 700 loaded
woff2 tải về: /fonts/be-vietnam-pro-400-latin.woff2, /fonts/noto-serif-display-700-latin.woff2, /fonts/be-vietnam-pro-700-latin.woff2, /fonts/be-vietnam-pro-600-latin.woff2, /fonts/be-vietnam-pro-700-latin-ext.woff2, /fonts/be-vietnam-pro-700-vietnamese.woff2, /fonts/be-vietnam-pro-400-vietnamese.woff2, /fonts/be-vietnam-pro-400-latin-ext.woff2, /fonts/be-vietnam-pro-500-latin.woff2, /fonts/be-vietnam-pro-600-vietnamese.woff2, /fonts/be-vietnam-pro-600-latin-ext.woff2, /fonts/be-vietnam-pro-500-vietnamese.woff2, /fonts/be-vietnam-pro-500-latin-ext.woff2
request tới Google Fonts: 0 []
pageerror: 2 [
  '[Cloudflare Turnstile] Error: 110200.',
  '[Cloudflare Turnstile] Error: 110200.'
]
   #section-team-chuan .reference-team-card → "Be Vietnam Pro" 15px/400 rgb(237, 230, 216) trên rgb(32, 29, 24)
   #section-team-chuan .reference-team-card .badge.faction → "Be Vietnam Pro" 12px/600 rgb(237, 230, 216) trên rgb(32, 29, 24)
   #section-team-chuan .reference-team-card .badge.unit → "Be Vietnam Pro" 12px/600 rgb(207, 198, 182) trên rgb(42, 38, 32)
   #section-team-chuan .reference-team-card .reference-score → "Noto Serif Display" 28px/700 rgb(227, 100, 106) trên rgba(0, 0, 0, 0)
   #section-team-chuan .reference-team-card .tag.t-tactic → "Be Vietnam Pro" 12.5px/500 rgb(255, 133, 139) trên rgb(58, 32, 35)
   #section-team-chuan .fchip → "Be Vietnam Pro" 14px/600 rgb(237, 230, 216) trên rgb(42, 38, 32)
   #section-team-chuan .search → "Be Vietnam Pro" 15px/400 rgb(237, 230, 216) trên rgb(32, 29, 24)
   #season-controls select → "Be Vietnam Pro" 14.5px/400 rgb(237, 230, 216) trên rgb(32, 29, 24)
   #section-team-chuan .ana-link-btn → "Be Vietnam Pro" 14px/600 rgb(237, 230, 216) trên rgb(15, 14, 11)
   #section-team-chuan .flabel → "Be Vietnam Pro" 11px/600 rgb(169, 159, 142) trên rgba(0, 0, 0, 0)
  nhãn phe: Quần

Kết luận: chỉ tải woff2 từ `/fonts/`, **0 request** tới `fonts.googleapis.com`/`fonts.gstatic.com`; chữ tiếng Việt có dấu hiển thị bằng Be Vietnam Pro (nhãn phe "Quần", "Thục", "Nguỵ"), số điểm bằng Noto Serif Display 700; không cuộn ngang; lỗi `pageerror` duy nhất là Turnstile của công cụ Soi đội (có trước phase này, không liên quan CSS).

## 6. Mốc khối legacy và cách giảm

| Phase | Việc |
| --- | --- |
| 1 (nay) | Bọc toàn bộ CSS cũ giữa `/* legacy:start ceiling=657 */` … `/* legacy:end */`, thay mọi mã màu bằng token, viết component nền **sau** khối legacy để thắng cascade |
| 3–9 | Mỗi phase xóa CSS cũ của đúng mục mình viết lại khỏi khối và **hạ** `ceiling` xuống số còn lại |
| 10 | Xóa hẳn khối, `ceiling` = 0 |

Phân bố giá trị thô còn lại theo selector nằm ở §3 (bảng cuối của báo cáo trích): nhiều nhất là `.team-filters` 8, `.clear-btn`/`.filter-collapse-toggle` 7, rồi `.site-header`/`.icon-btn`/`.fchip` 6.

## 7. Ghi nhận, ngoại lệ và rủi ro cho phase sau

### 7.1 Hồi quy do Phase 1 gây ra — đã sửa trong Phase 1 (P1 của Kongming)

`--f-quan` đổi theo artboard từ `#C9962A` sang `#B08422` làm nhãn biến thể 40Y (`.pre.y40`, khối legacy, chữ `#3A2C00`) rơi từ **5,12:1 xuống 4,01:1**. Đây là **hồi quy do phase này tạo ra**, không phải nợ cũ. Đã sửa bằng cặp trung tính đã tài liệu hóa (`--panel-2` + `--ink-2`, như badge loại binh / StyleGuide "Thương"):

| | Trước phase | Sau khi đổi `--f-quan` | Sau khi sửa (nay) |
| --- | --- | --- | --- |
| `.pre.y40` sáng | 5,12:1 | 4,01:1 (**hỏng**) | **9,52:1** (`#3A352D` trên `#EAE3D4`) |
| `.pre.y40` tối | – | – | **8,88:1** (`#CFC6B6` trên `#2A2620`) |

`--f-quan` giữ nguyên giá trị artboard cho chấm phe; component mới `nhan-bien-the` trong `tokens.json` ghi lại quyết định này kèm probe đo đúng cặp chữ/nền và **không** khai ngoại lệ nào — nợ `.pre.sp`/`.pre.co` chỉ là ghi nhận trong báo cáo. `record()` của `design-compare.mjs` chỉ chấp nhận ngoại lệ có `actual` cụ thể và khớp **chính xác** kết quả đo (không còn nhánh wildcard); ngoại lệ duy nhất còn lại là `select-nhan-caps` với `actual: "normal"`.

### 7.2 Hai màu sửa theo contract (đã được Kongming duyệt)

- `--avoid` bảng tối: `#E0555D` → `#FF858B` (khối cũ 3,95:1 trên nền nên tránh; Son sáng của bảng tối = 6,3:1; §11.5 nói không được tối thêm son).
- `--status-recommend-bg`: `#1E8E4E` → `#1F7A4D` (literal legacy không có trong artboard; chữ trắng trên `#1E8E4E` chỉ 4,17:1). Rule dùng nó không còn markup nào gọi — phase dọn dẹp sẽ xóa cùng khối legacy.
- `--good-bg` giữ đúng giá trị artboard `#E0EFE6`; cặp chữ đạt 4,47:1 nên nằm trong nhóm nợ cũ ở §1.3 (không đổi màu artboard).

### 7.3 Màu artboard chưa token hóa (21 màu)

Chỉ token hóa màu có surface dùng ngay ở Phase 1 (khối token, component nền, khối legacy); màu trang trí/khối chưa làm thì phase sở hữu thêm token kèm nguồn (quy tắc ở README Design). Đây là deferral có biên, không phải permission để trộn màu hay viết literal.

| Màu artboard chưa token hóa | Lần | Dùng ở |
| --- | --- | --- |
| `#E0D6C4` | 57 | border ×52, border-top ×5 |
| `#CFC5B1` | 56 | border ×56 |
| `#FBF7EE` | 29 | background ×29 |
| `#7E1620` | 26 | color ×26 |
| `#1F6B4A` | 19 | color ×17, border ×2 |
| `#E4E8F4` | 12 | background ×12 |
| `#F3EAD3` | 11 | background ×11 |
| `#FFF8EF` | 8 | color ×8 |
| `#DDEFE4` | 8 | background ×8 |
| `#7FC99E` | 5 | color ×3, background ×2 |
| `#FBEBD0` | 4 | background ×4 |
| `#7A4B00` | 4 | color ×4 |
| `#B9AE98` | 4 | border ×4 |
| `#5A5348` | 2 | border ×2 |
| `#E7C3BB` | 2 | border ×2 |
| `#141210` | 2 | background ×2 |
| `#9A9284` | 2 | color ×2 |
| `#F3F8F4` | 2 | background ×2 |
| `#EFE8DA` | 1 | background ×1 |
| `#6E141C` | 1 | color ×1 |
| `#7A4A45` | 1 | color ×1 |

21 màu chưa token hóa trên tổng 65 token màu hiện có.

Trong đó `#E0D6C4`/`#CFC5B1` (viền khối lõm/nút phụ), `#FBF7EE` (nền khối lõm), `#7E1620` (link hover trên giấy), `#1F6B4A` (xanh đậm "đạt" trong Khai hoang) là những màu Phase 5/7/8 nhiều khả năng cần — thêm token lúc đó, ghi nguồn artboard.

### 7.4 Ghi nhận khác

- Chip lọc **bật** dùng nền dải + chữ trên dải; chấm phe giữ màu phe nên chấm Ngụy (`#1F3A93`) trên nền dải tối chỉ 1,7:1 — chữ tên phe vẫn là tín hiệu chính (đúng §11.5). Phase 5 quyết định khi dựng `MobileFilters`.
- Nút chính trong theme tối dùng `--band` (`#0F0E0B`) trên thẻ `#201D18` — chênh nền rất ít; Phase 10 rà tối nên cân nhắc `--panel-3` hoặc viền mạnh hơn.
- Link nút (`.ana-link-btn`…) phải viết thêm `a.` để thắng `.season-team-groups a` (0,1,1) của legacy; trong `#section-coexist` legacy `#section-coexist a` (có id) vẫn thắng ⇒ Phase 8 xử lý.
- Chọn `.fchip` 44px cho mọi khổ (contract §11.4 ≥ 44px) dù artboard desktop ghi 40px — đã ghi ở `note` của `control.40`.
- `.rt-btn` (không `.rt-primary`) của công cụ Chiêu mộ nay theo spec nút phụ (44px, `--panel-3`/`--line`/`--ink`) để có nút phụ thật mà probe đo được; Phase 9 dùng lại component này.
- Probe sau này phải trỏ đúng trang: `probe.page`/`ready` của các component dùng chung hiện là `/`, Phase 2 phải chuyển sang trang mục mới khi `/` thành Landing (rủi ro Kongming nêu). `--tokens` **fail khi 0 thuộc tính đo được**, nên "phase không có probe" không còn bị coi là đạt.
- **Quy trình bản dịch (bước 2a–2e):** không đổi chữ, không dời obligation (chỉ thêm 2 thẻ `<link rel="preload">` vào `src/layouts/SiteLayout.astro` và `src/pages/index.astro`). Hash policy: `SiteLayout.astro` `49593ba5…` → `4b6f540f…`, `index.astro` `15748f75…` → `5adb98f7…`. Baseline notes giữ nguyên (`concreteLocationCount` 56265, `concreteInventorySha256` `1017ff16…`, `siteLedgerObligations` 2089, `translationObligations` 5592, `uiTranslateObligations` 69, inventory unknown rỗng). Generation Recommended: `b60b51c9…` → `0fe39aaa1c0a279ed4b0db55c642c4436ce78675240b723addc5a3bc083f3ea4`; `pipeline/team-route-handles.json` đã re-pin và `python3 -m pipeline.team_route_handles --check` pass. `tests/test_site_localization.py` không phải sửa số ghim (368 OK).

## 8. Chạy lại

```bash
node scripts/design-tokens.mjs --extract            # bảng tần suất đầy đủ (nguồn của tokens.json)
node scripts/design-tokens.mjs --check              # khối token ↔ tokens.json + giá trị thô
npm run build && npm run preview                    # design-compare cần server này (mặc định 127.0.0.1:4321)
node scripts/design-compare.mjs --tokens --phase 01             # đo computed style, theme sáng
node scripts/design-compare.mjs --tokens --phase 01 --theme dark
node scripts/design-compare.mjs --phase 04          # so ảnh: cặp của phase 4 (Phase 1 chưa có cặp)
node .cache/design-verify/contrast.mjs              # script tạm — tương phản token
node .cache/design-verify/proofs.mjs                # script tạm — bằng chứng DOM (40Y, caps, chip bật)
sh .cache/design-verify/negative-probes.sh          # script tạm — chứng minh gate vi mô bắt được lỗi cố ý
```

## 9. Gate (A2) — chạy lại sau bản sửa

| Lệnh | Kết quả |
| --- | --- |
| `npm run check` | 0 lỗi, 0 cảnh báo (1 hint có từ trước) |
| `npm run build` | 1.551 trang |
| `npm run verify` | 1.716 file dist (53 raw asset + 16 file font public); khối bản dịch public 0 problem |
| `npm run test:dist` | 28/28 |
| `npm run test:node` | 318/318 (trước phase: 316 — thêm 2 test: khóa byte thư mục font, bộ font + giấy phép) |
| `npm run test:e2e` | 153/153 |
| `python3 -m unittest discover -s tests` | 368 OK (không phải sửa số ghim nào) |
| `node --test tests-js/runtime-asset-contract.test.mjs` | 6/6 |
| `python3 -m pipeline.team_route_handles --check` | khớp generation `0fe39aaa…` |
| `node scripts/design-tokens.mjs --check` | pass; `ceiling` legacy 657 (không tăng sau bản sửa) |
| `node scripts/design-compare.mjs --tokens --phase 01` (sáng + tối) | 117/118 thuộc tính khớp, 0 lệch chưa giải thích; 1 ngoại lệ hẹp (`select` line-height = `normal`) |

## 10. Bằng chứng công cụ so ảnh (P1 của Kongming)

| Ca | Lệnh | Kết quả |
| --- | --- | --- |
| Chụp thật, đường bình thường | `node scripts/design-compare.mjs --phase 04` | **exit 0** sau ~2 giây; 2 ảnh ghép; `Landing.localhost.png` cao 4.134px (nội dung thật, không phải trang trống 1.000px) |
| Setup selector sai | cặp `MobileFilters` đổi `setup` thành `#khong-ton-tai` (khôi phục sau khi chạy) | **exit 1** sau 5,6 giây: `Timeout 5000ms exceeded — waiting for locator('#khong-ton-tai')`; tiến trình tự thoát (không còn browser treo) |
| Mốc `ready` sai | cặp Phase 5 trỏ trang chưa có | **exit 1** sau 20 giây, lỗi nêu rõ selector chờ |
| Điều hướng hỏng | `--phase 04 --base http://127.0.0.1:1` | **exit 1** sau 0,3 giây, `ECONNREFUSED`, đã đóng browser + server |
| Gate vi mô — ca A: đổi `type.field-caps.letterSpacing` 0,12em → 0,3em | `sh .cache/design-verify/negative-probes.sh` | **exit 1**, bảng lệch có dòng `letter-spacing` (chứng minh đo được khoảng chữ caps) |
| Ca B: đổi màu nền mong đợi của chip đang bật (`--band` → `--accent`) | như trên | **exit 1**, dòng `chip-loc | pressed | … | background-color | rgb(168, 32, 42) | rgb(28, 26, 23)` |
| Ca C: nới ngoại lệ `select` sang `actual: "2px"` | như trên | **exit 1**, `1 lệch chưa giải thích` — ngoại lệ chỉ phủ đúng `normal` |
| Ca D: đổi màu nền mong đợi của nhãn 40Y (`--panel-2` → `--accent`) | như trên | **exit 1**, `| nhan-bien-the \| default \| .pre.y40 \| background-color \| rgb(168, 32, 42) \| rgb(234, 227, 212) |` — lệch chưa giải thích |
| Khôi phục `tokens.json` sau mỗi ca | `diff` với bản backup | trùng khớp |

