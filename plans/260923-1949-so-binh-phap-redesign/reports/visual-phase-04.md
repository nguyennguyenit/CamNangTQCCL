# Phase 4 — Báo cáo: Landing + Tải game

Ngày: 2026-09-25 · Plan `260923-1949-so-binh-phap-redesign`, [phase-04](../phase-04-landing.md).
Phạm vi: dựng lại thân trang `/` theo artboard Landing (+ LandingMobile), số liệu tính lúc build từ dữ liệu đã
publish, hai khối xem trước (thẻ đội ở hero, bảng ở mục "Hai kho đội") dựng từ chính dữ liệu publish,
mục Tải game có QR SVG, CTA tối, giữ nguyên shell Phase 3 và chuyển tiếp hash cũ Phase 2.
Bộ A2 đầy đủ đã chạy xanh sau khi land mọi việc của phase (§7). Chưa commit — orchestrator commit sau go/no-go.

Bản này đã sửa **cả ba yêu cầu của phiên review Kongming** (P04-1 số liệu Khai hoang, P04-2 hai khối xem trước,
P04-3 mũi tên link ngoài) — xem §2, §4, §9.

## 1. Việc đã làm (theo bước trong phase file)

| Bước | Nội dung | Trạng thái |
|---|---|---|
| 1 | `src/lib/landing-stats.ts`: số liệu tính lúc build từ một snapshot publication (`websiteDisplayPublicationSnapshot()` + `recommended.files`), không hard-code; định dạng số kiểu Việt bằng hàm thuần (`1.366`) | xong — §2 |
| 2 | Dải số liệu `id="nguon-du-lieu"` + dòng "Tổng hợp từ SGSDeck và người chơi · tham khảo, không phải phương án duy nhất." thay hàng ghi chú cũ (`.disclaimer` legacy đã xoá) | xong |
| 3 | Bốn khối điều hướng: thẻ là `<a href>` tới trang mục (3 "Bạn đang cần gì?", 2 kho đội, 2 "Giữ đất và mở đất", 3 công cụ) | xong — §4 |
| 4 | `#tai-game`: QR SVG sinh một lần bằng `npx --yes qrcode@1.5.4 -t svg`, nhúng trong `src/components/DownloadQr.astro` (`role="img" aria-label="Mã QR tải game"`, comment ghi lệnh + phiên bản); ba nút tải có icon thiết bị **và mũi tên ↗** (aria-hidden), link từ `official-links.ts` với `rel="noopener noreferrer"` | xong — §5 |
| 5 | CTA tối + nút "Mở cẩm nang" → `/doi-chuan/` | xong |
| 6 | Mobile theo LandingMobile: hero 1 cột 42px kèm thẻ đội, lưới số liệu 2 cột, bảng cuộn trong vùng riêng, nút tải full width, header nút "Mở" nhỏ (Phase 3) | xong — §4 |
| 7 | 74 obligation `authored-vi` (`ui:landing/<khối>/<trường>`), 5 obligation `ui:root/*` giữ nguyên tại chỗ và không đổi chữ | xong — §6 |

### File tạo mới
- `src/lib/landing-stats.ts` — `landingStatistics()`, `landingCopy()`, `landingPreviews()`, `viNumber()`
- `src/components/DownloadQr.astro` — SVG QR tĩnh (2,3 KB) + provenance trong comment
- `tests-e2e/landing.spec.mjs` — 9 test Landing

### File sửa
`src/pages/index.astro`, `src/layouts/SiteLayout.astro` (một dòng: `class:list={['layout', landing && 'layout-landing']}` để Landing tràn viền), `src/lib/official-links.ts` (3 hằng link tải game + `OFFICIAL_GAME_SITE_HREF`), `css/styles.css`, `docs/design/so-binh-phap/tokens.json`, `scripts/design-compare.mjs`, `pipeline/site_localization.py`, `pipeline/site-localization-policy.json`, `pipeline/team-route-handles.json`, `data/website-display.json`, generation `src/data/recommended-reference/`.

### File xoá
`.disclaimer` khỏi khối legacy CSS (chỉ Landing dùng) — `ceiling` 603 → **600**.

## 2. Số liệu (bước 1) — nguồn, mẫu số, lệch so với artboard

Một snapshot duy nhất (`websiteDisplayPublicationSnapshot()`, hash đã xác minh ở cả `website-display.json` và
generation Recommended) ⇒ không đọc file thô lần hai, không payload runtime.

| Số | Giá trị | Mẫu số / công thức | Artboard |
|---|---|---|---|
| cấu hình Đội chuẩn | 1.366 | `records.length` của `recommended/index.json` | 1.366 ✓ |
| cấu hình xếp T0 | 205 | `tierRaw === 'T0'` cùng nguồn | 205 ✓ |
| mùa nguồn | 26 | số `sourceSeasonId` khác nhau trong `index.json` | 26 ✓ |
| tướng | 202 | `heroes-dict.json` | 202 ✓ |
| chiến pháp | 406 | `tactics.json` | 406 ✓ |
| đội người chơi | **40** | `records.length` của `recommended/other-teams.json` (đúng tập `/doi-khac/`) | **166** (kho `teams.json` trước khử trùng) — lệch có chủ đích theo bước 1 |
| đội ghi đội sợ | 9 | `legacyContent.counters.avoid` không rỗng / 40 | artboard chỉ nói "có khắc chế" |
| đội có phương án thay thế | 16 | có ≥1 `alternatives` trong `legacyContent` / 40 | như trên |
| Cùng Tồn | 5 nhóm × 5 đội, 15 tướng | `coexist.json`: số nhóm, số đội mỗi nhóm, tướng không trùng mỗi nhóm (build từ chối nếu không đồng nhất) | 5 × 5 / 15 ✓ |
| Khai hoang: đội mở đất / Chạm Sứ / mỏ | 17 / 8 / 5 | `khaihoang.json`: `teams`, `chamSuTeams`, `mines` | 17 / 8 / 5 ✓ |
| Khai hoang: đội có **đủ cấu hình trước/sau** | **16** | đội mà **mọi tướng** đều có bộ trước (`unitTypeBefore` + `tacticBefore`) **và** bộ sau (`unitTypeAfter` + ≥1 `tacticsAfter`) | artboard ghi "17 đội … có cấu hình trước/sau" |

### P04-1 — sửa nghĩa của số "trước/sau" (review Kongming)

Bản đầu đếm `teams[].variants` (10) rồi gắn nhãn "cấu hình trước/sau" — sai nghĩa: biến thể là cấu hình khác,
không phải bộ trước/sau. Nay số lấy từ chính các trường trước/sau của từng tướng (`beforeAfterTeams` = **16**) và
câu chữ đổi thành "16 đội có đủ cấu hình trước/sau". Hai ca biên được khẳng định trong e2e:

| Ca biên | Dữ liệu | Phải được đếm? |
|---|---|---|
| `thai-van-co-khuong-duy-thai-su-tu` | 0 biến thể, cả 3 tướng đều có `tacticBefore`/`unitTypeBefore` và `tacticsAfter`/`unitTypeAfter` | **có** (đếm theo trường trước/sau, không theo `variants`) |
| `truong-xuan-hoa-lu-bo-ta-tu` | chỉ có bộ sau cấp 20 (`buildNote`: "Chỉ có dữ liệu sau cấp 20; không suy ra bộ trước cấp 20") | **không** |

Test e2e tính lại phép đếm bằng predicate độc lập (mọi tướng có đủ trước + sau), không lặp lại predicate của
implementation, và khẳng định tổng là `16` trước khi so câu chữ trên DOM.

Câu nào không có nguồn thì bỏ: **"điểm từng mốc đất"** (chỉ 11/17 đội có `guide.ratings`) và **"kèm chủ lực được
tiến cử và gợi ý mở đất"** của Cùng Tồn (không có trường dữ liệu nào). Không hard-code số nào.

## 3. Vi mô (tự động)

`node scripts/design-tokens.mjs --check`: **pass** — `:root` khớp `tokens.json` (25 vai trò chữ `landing-*`,
5 bước `space-30/44/72/88/96`, 2 màu `--band-btn-line`/`--qr-panel`), 0 mã màu ngoài khối token,
**0 giá trị thô ngoài khối legacy**; khối legacy **603 → 600 giá trị thô** trên 284 selector, `ceiling` = 600.

`node scripts/design-compare.mjs --tokens --phase 04` (light + dark):

```
489/489 thuộc tính khớp token (theme light, phase 4); 0 lệch chưa giải thích.
489/489 thuộc tính khớp token (theme dark, phase 4); 0 lệch chưa giải thích.
```

Component trong danh mục:
- Mới của phase: `khoi-hero` (hero lưới 2 cột), `so-lieu` (dải số liệu), `the-landing` (thẻ điều hướng/kho/công cụ),
  `the-tai-game` (panel QR + nút cửa hàng + thẻ .exe + mũi tên ↗), `cta-toi`, `dau-khoi` (đầu khối),
  **`the-doi-xem-truoc`** (thẻ đội ở hero), **`bang-xem-truoc`** (bảng ở mục Hai kho đội).
- Dùng lại component có sẵn (thêm `4` vào `phaseUsed`): `badge`, `badge-phe`, `badge-binh`, `nut-chinh`,
  `nut-chien-phap`, `so-diem`, `the-doi`, `dong-tuong`, `bang`, `nhan-bien-the` — CSS của thẻ/bảng xem trước dùng
  đúng class của các component này để Phase 5 kế thừa, chỉ khác vỏ (cỡ/bán kính/bóng của Landing).

## 4. Bố cục (người duyệt)

4 ảnh ghép × 2 theme ở `.cache/design-compare/phase-04{,-dark}/` (không commit). Cặp ảnh phase 4 cắt toàn trang
(`ready: '#tai-game'`).

| Artboard | Trang | Đã xem | Kết luận |
|---|---|---|---|
| Landing | `/` @1440 | light + dark | **đã sửa**: hero 2 cột (dẫn trái + **thẻ đội thật** phải); dải số liệu 5 ô ngăn vạch; 3 thẻ "Bạn đang cần gì?"; mục Hai kho đội: khối dẫn bên trái, cột phải gồm 2 thẻ kho đội ở trên và **bảng thật** bên dưới; "Giữ đất và mở đất"; 3 thẻ công cụ có chip Beta + dòng ghi chú; panel QR + 2 nút cửa hàng + thẻ .exe cùng hàng, cả ba nút có mũi tên ↗; CTA tối ấn 兵 + h2 48px |
| LandingMobile | `/` @390 | light + dark | **đã sửa**: hero 1 cột 42px + thẻ đội full width, lưới số liệu 2 cột, thẻ 1 cột, bảng trong vùng cuộn riêng, panel Tải game bỏ khung nền, nút tải full width, CTA và footer xếp dọc |

### P04-2 — hai khối xem trước đã được dựng lại từ dữ liệu publish

| Khối | Nguồn dữ liệu (lúc build) | Giá trị hiển thị |
|---|---|---|
| Thẻ đội ở hero | bản ghi **đầu tiên** của phạm vi mặc định (`seasons.defaultSourceSeasonId` + scope đầu theo `listIndex`) | `40Y Lữ Bố Cung (Vương Dị, Pháp Chính)` · 113 điểm · Cung · Quần · 3 hàng tướng (40Y Lữ Bố / Vương Dị / SP Pháp Chính) với chiến pháp + binh thư Việt; CTA "Xem chi tiết" trỏ `/doi-chuan/og-40y-lu-bo-cung-vuong-di/` (**200**, có test) |
| Bảng ở mục Hai kho đội | cùng phạm vi mặc định (`safeScopeKey` của bản ghi đầu) | thanh "Chế độ Bảng · OG · Binh Diễn Xuân Thu", "25 / 25 đội" (số thật của scope), 4 dòng đầu với tên đội + "Phe · Binh" + tướng + điểm |

Không dùng dữ liệu mẫu của artboard: cả hai khối lấy từ publication của generation đang pin, nhãn phe/loại binh
lấy từ `seasons.displayLabels` (cùng nguồn trang thật dùng), chuỗi còn chữ Hán bị bỏ chứ không rò ra UI.
Bảng nằm trong vùng cuộn riêng có nhãn (`role="region" tabindex="0"`) nên mobile không cuộn ngang trang.

### Lệch có chủ đích (giữ, có lý do)

| Chỗ | Artboard | Thực tế | Lý do |
|---|---|---|---|
| "166 đội người chơi" | 166 | **40** | đúng tập `/doi-khac/` (`other-teams.json`), bước 1 |
| "có khắc chế và phương án thay thế" | không số | "9 đội ghi đội sợ, 16 đội có phương án thay thế" | số thật từ `other-teams.json` (9/40, 16/40) |
| "điểm từng mốc đất" / "chủ lực được tiến cử" | có | **bỏ** | không có nguồn dữ liệu (11/17 đội có thanh điểm; Cùng Tồn không có trường tiến cử) |
| "17 đội … có cấu hình trước/sau" | không nêu số | "16 đội có đủ cấu hình trước/sau" | số thật theo trường trước/sau từng tướng (P04-1) |
| Dòng nguồn dải số liệu | "…và chia sẻ kinh nghiệm người chơi · mang tính tham khảo…" | "Tổng hợp từ SGSDeck và người chơi · tham khảo, không phải phương án duy nhất." | chữ đã chốt ở phase bước 2 |
| Footnote DashScope ở thẻ "Soi đội từ ảnh" | có | **bỏ** | phase bước 2: thông báo DashScope chỉ ở trang Soi đội |
| Nút CTA tối | "Mở Đội chuẩn" | "Mở cẩm nang" | phase bước 5 chốt chữ này → `/doi-chuan/` |
| Chip Beta | desktop chip viền, mobile "· Beta" | chip viền ở mọi bề rộng | một markup, khác đúng dấu "·" của bản mobile |
| Tên tướng trong thẻ xem trước | "SP Mã Siêu" là chữ thường | **giữ chữ thường** (không tách thành nhãn `.pre`) | đúng artboard; nhãn biến thể là việc của Phase 5 (thẻ thật) |
| Màu chữ số đội trong thanh bảng | `#B8AF9F` (2:1 trên nền sáng) | `--muted` (6,7:1) | A4: chữ thường ≥ 4,5:1 |
| Tên đội trong bảng | serif 15px/700 | `--type-strong` (15px/600 sans) | dùng vai trò chữ có trong danh mục; chữ serif 15px chưa có token |
| Nút "Xem chi tiết"/"Chi tiết →" | "Chi tiết" (nhãn ngắn) | "Xem chi tiết" | trùng chữ renderer thẻ hiện tại; Phase 5 đổi sang "Chi tiết →" theo contract của phase đó |
| Số liệu mobile | 4 ô | **5 ô** | không ẩn số liệu nào trên mobile |
| Khối "Hai kho đội" và CTA tối trên mobile | không vẽ | **vẫn dựng** | contract bước 2/5 yêu cầu đủ khối; mobile chỉ xếp dọc |
| QR trên mobile | không vẽ | **vẫn dựng** | contract bước 4 yêu cầu QR trong `#tai-game` |
| Hai `<a>` lồng trong một thẻ | có | một `<a>`/thẻ, nhãn link là `<span>` | HTML không hợp lệ; bước 3 yêu cầu thẻ là `<a href>` |
| Viền thẻ .exe | `#E7C3BB` | `--line` | không có token cho màu này; `--line` đúng ở cả hai theme |
| Chữ thẻ .exe | `#7E1620` | `--accent-ink` | `#7E1620` trên `--accent-soft` theme tối chỉ đạt **1,43:1** |
| Nhãn C (chủ tướng) | `--accent` trên `--accent-soft` | `--accent-ink` | theme tối chỉ đạt 4,46:1 (sát ngưỡng) ⇒ 6,37:1 |
| Số thứ tự 01/02/03 | `#D8CFBD` = `--line` | giữ `--line`, `aria-hidden` | chữ trang trí đúng artboard, không tính là chữ cần 4,5:1 |
| Font | webfont Google đầy đủ | subset self-host (Phase 1) | tiêu đề thẻ thứ ba có thể xuống dòng sớm hơn artboard một dòng |

## 5. Kiểm QR (Verification của phase)

QR là **SVG tĩnh sinh một lần**, không thêm dependency; kiểm bằng cách chụp chính khung QR trên trang thật
(Playwright, DPR 3) rồi giải mã bằng `jsqr` (cài tạm ngoài repo ở `/tmp/qrdecode`, không vào `package.json`):

| Ảnh chụp | Giải mã |
|---|---|
| `.cache/p4/qr-light-1440.png` | `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true` |
| `.cache/p4/qr-dark-1440.png` | `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true` |
| `.cache/p4/qr-light-390.png` | `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true` |
| `.cache/p4/qr-dark-390.png` | `https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true` |

Khung QR giữ nền `--qr-panel` (#FFFFFF) ở cả hai theme (đo bằng computed style, có test e2e) nên máy quét đọc được cả
trong giao diện tối. Đã thử `zbarimg`/`pyzbar`: không có trên máy này.

## 6. Policy bản dịch (bước 7 / quy trình bước 2)

### Obligation
- **Thêm 74 obligation `authored-vi`**: 66 chuỗi trong `src/pages/index.astro` + 8 câu/công thức có số trong
  `src/lib/landing-stats.ts`, key `ui:landing/<khối>/<trường>`. Không cần receipt (lớp `authored-vi`).
  (bản đầu 66 = 59 + 7; bản này thêm 8 cho hai khối xem trước: nhãn thẻ, đơn vị "điểm", nhãn "Chủ tướng", CTA "Xem chi tiết",
  thanh "Chế độ Bảng", nhãn vùng bảng, caption ẩn, mẫu "n / n đội" — trong đó câu Khai hoang đổi chữ in-place.)
- 5 obligation `translate` của `src/pages/index.astro` (`ui:root/brand`, `meta-description`, `team-chuan`, `team-khac`, `beta`)
  **giữ nguyên tại chỗ, không đổi chữ**; không obligation `translate` nào bị dời file/đổi chữ ⇒ không cần receipt độc lập.
- `tests/test_site_localization.py`: **không phải sửa số ghim** (2088 ledger / 68 `uiPending` / 5591 obligation /
  3503 lookup không đổi vì không thêm chuỗi `translate`).

### Policy
- `sourceFiles`: 50 (thêm `src/lib/landing-stats.ts`; làm mới hash `src/pages/index.astro`, `src/lib/landing-stats.ts`,
  `src/layouts/SiteLayout.astro`, `src/lib/official-links.ts`).
- `policyVersion`: `site-vi-260925-header-footer` → `site-vi-260925-landing` → **`site-vi-260925-landing-preview`** (chốt).

### baseline.notes cũ → mới (chốt)
| Khóa | Trước phase 4 | Sau bản đầu | **Chốt** |
|---|---|---|---|
| `concreteLocationCount` | 56 333 | 56 399 | **56 407** |
| `concreteInventorySha256` | `9e8fbcea…` | `ddb55346…` | **`d95ef34f…`** |
| `siteLedgerObligations` / `translationObligations` / `uiTranslateObligations` / `lookupReviewObligations` | 2 088 / 5 591 / 68 / 3 503 | không đổi | không đổi |

### Generation + re-pin (chốt)
`build --stage all` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public`
(exit 0, `uiPending` 68, 0 problem) → `pipeline/team-route-handles.json` `generationId`:

```
38bae7dc9ed30efbedaa17d454e2b206a6e623bcfa37fd86302fdc2b704bfb3f   (Phase 3)
→ 8eec9bac65f5bca60d6aca8ec93072c52b4556f221039dd340222a0d2460561b   (Phase 4, chốt)
```

`data/website-display.json` generation `site-localization:e51277ef0f1d51d6e885447d90c53cb1daaf660bd6a9a4de0b810a95e29fa678`.
Generation trung gian sinh trong lúc làm (`daa88bbe…`, `308eeac4…`) đã xoá — không file nào tham chiếu;
`index.json` của generation chốt trùng byte với generation Phase 3 (3 374 425 byte).
`python3 -m pipeline.team_route_handles --check` pass (1366 recommended / 166 legacy / 17 Khai hoang).

## 7. Gate (bộ A2)

| Lệnh | Kết quả |
|---|---|
| `npm run check` | pass — `site_localization check --stage public` exit 0, `astro check` 0 error (1 hint có trước ở `team-detail-routes.ts`) |
| `npm run build` | pass — 1559 trang |
| `npm run verify` | pass — `check --stage public` + 1725 file dist (54 raw asset, 16 file `public/` tĩnh) |
| `npm run test:dist` | **28/28 pass** |
| `npm run test:node` | **334/334 pass** |
| `npm run test:e2e` | **206/206 pass** (197 shell + 9 test Landing) |
| `python3 -m unittest discover -s tests` | **368 OK** |
| `node scripts/design-tokens.mjs --check` | pass (legacy 600 = ceiling 600) |
| `node scripts/design-compare.mjs --tokens --phase 04` (+`--theme dark`) | 489/489 · 489/489, 0 lệch chưa giải thích |

### Kiểm trên trình duyệt thật (Chromium, preview `dist/`)

- **Khối & thứ tự**: `#dau-trang` → `#nguon-du-lieu` → `#landing-need` → `#landing-vaults` → `#landing-land` →
  `#landing-tools` → `#tai-game` → `#landing-cta`; 10 thẻ link trỏ đúng 6 trang mục.
- **Anchor**: 10 kịch bản (3 anchor × 2 bề rộng, nạp trực tiếp + bấm từ nav desktop/menu mobile/footer) đều dừng
  đúng `top = 76px` (desktop) / `60px` (mobile) = đáy header dính; `#dau-trang` về thẳng đầu trang.
- **Responsive**: 320/390 không cuộn ngang; bảng cuộn trong vùng riêng (`scrollWidth 420 > clientWidth 356`);
  thẻ đội 500px (desktop) / 358px (mobile) bằng artboard; hero 28/16, h1 42px, số liệu lưới 2 cột.
- **Liên kết ra ngoài trong `main`**: 4 link HTTP(S) đều `target="_blank" rel="noopener noreferrer"` **và** có mũi tên ↗
  (nhận diện bằng hình học 2 path, aria-hidden) + chữ ẩn "(mở tab mới)"; 11 link nội bộ không `target`; 0 ảnh
  (`main img` = 0) nên không có ảnh từ domain nhà phát hành.
- **Theme tối**: đo computed style + probe token cho mọi khối mới; QR nền trắng; focus-visible son 2px cách 2px.
- **Tương phản** (đo bằng script tạm, 48 cặp chữ cả hai theme): mọi cặp mới ≥ 4,5:1, trừ hai chỗ ghi ở §9.
- **Link chi tiết của thẻ xem trước**: `/doi-chuan/og-40y-lu-bo-cung-vuong-di/` trả **200** và chứa đúng tên đội
  (có test e2e).

## 8. Test sửa/thêm có chủ đích + lý do

1. `tests-e2e/landing.spec.mjs` — **spec mới 9 test** (phase cho phép tách spec khi `spa-parity` quá tải):
   (1) 7 khối theo thứ tự + CTA cuối + href của 10 thẻ; (2) số liệu khớp dữ liệu — test tự tính lại từ
   `current.json`/`index.json`/`other-teams.json`/`data/*.json`, không import `landing-stats.ts`;
   (3) anchor ở 1440/390 (nạp trực tiếp + bấm nav/menu/footer); (4) QR + `target`/`rel` + 0 ảnh;
   (5) không cuộn ngang 320/390 + QR nền sáng ở theme tối; (6) **Khai hoang: predicate độc lập + hai ca biên**
   (`thai-van-co-khuong-duy-thai-su-tu` phải đếm, `truong-xuan-hoa-lu-bo-ta-tu` không) + tổng 16 + câu chữ trên DOM;
   (7) **hai khối xem trước**: tên/điểm/badge/hàng tướng của thẻ, href chi tiết trả 200, số đội + 4 dòng + giá trị
   của bảng, vùng bảng cuộn riêng ở 390px; (8) **mũi tên link ngoài** của ba nút tải nhận diện bằng hình học mũi tên
   + còn icon thiết bị; (9) không nạp `app.js` và hash cũ vẫn chuyển.
   Trước phase này các phần tử được khẳng định (`#nguon-du-lieu`, `.landing-stat-number`, `.landing-qr-frame`,
   `.landing-preview-card`, `.reference-table`) chưa tồn tại — `index.astro` ở HEAD chỉ có `#landing-quick` + danh sách mục.
2. `scripts/design-compare.mjs` — `ready` của cặp phase 4 đổi `#landing-quick` → `#tai-game` (khối tạm Phase 2 đã bị thay).
3. `docs/design/so-binh-phap/tokens.json` — 25 vai trò chữ `landing-*`, 5 bước `space`, 2 màu, 8 component mới/kèm probe;
   `phaseUsed` của 10 component dùng lại thêm `4`.
4. `pipeline/site_localization.py` — 74 obligation `authored-vi` (8 mới + 1 đổi chữ in-place cho câu Khai hoang).
5. Không test nào bị nới lỏng hay xoá để né lỗi; các test shell khác không phải sửa (Landing vẫn thoả
   `id="tai-game"`, `/#nguon-du-lieu`, đếm `target="_blank"`).

## 9. Rủi ro còn lại / việc của phase sau

1. **Tương phản nút son ở theme tối (Phase 10 / A4)**: `.landing-btn` = `--accent` nền + `--on-accent` (#FFFFFF) chữ
   đạt **3,33:1** trong theme tối (light 7,23:1). Đây là **cùng cặp với `nut-cta` của Phase 3** (nút CTA header, menu
   mobile), không phải lỗi mới của Phase 4; sửa phải đổi token `--on-accent` dùng chung nên để Phase 10 quyết.
   **Không im lặng bỏ qua**: mục này phải được xử lý trước khi A4 được nghiệm thu (Kongming cũng đã nêu).
2. **Vỏ CSS của hai khối xem trước thuộc Phase 4** (`the-doi-xem-truoc`, `bang-xem-truoc`): phần trong đã dùng đúng
   component (`the-doi`, `dong-tuong`, `so-diem`, `nut-chinh`, `nut-chien-phap`, `badge-*`, `bang`) để Phase 5 kế thừa;
   Phase 5 nên gộp vỏ này vào component thẻ/bảng thật rồi cập nhật `phaseOwner` nếu cần.
3. **Số thứ tự thẻ 01/02/03** giữ `--line` theo artboard (1,5:1 light / 1,4:1 dark) — chữ trang trí `aria-hidden`.
4. **Hai khối không có trong LandingMobile** (kho đội, CTA tối) và **QR trên mobile** vẫn được dựng; nếu Phase 10 muốn
   mobile khớp artboard tuyệt đối thì phải ẩn (đánh đổi: mất nội dung/số liệu).
5. Tên đội trong bảng dùng `--type-strong` (sans 15/600) thay vì serif 15/700 của artboard vì chưa có vai trò chữ đó.
6. `landing-stats.ts` là file mới trong `sourceFiles`: phase sau sửa file này phải làm mới hash + publish lại generation.
7. `.cache/p4/`, `.cache/site-localization-candidate/`, `/tmp/qrdecode/` là scratch (`.cache/` đã gitignore; `/tmp` ngoài repo).

## 10. Gợi ý commit

```
feat(landing): rebuild the Landing from published data with real previews and a download section

- rewrite src/pages/index.astro (two-column hero with a real team card, statistics
  strip with #nguon-du-lieu, question/two-vaults/territory/tools blocks with a real
  table preview, #tai-game, dark CTA) and drop the temporary Phase 2 markup
- add src/lib/landing-stats.ts computing every number at build time from the
  published snapshot (1366/205/26/202/406, 40 other teams, 5x5x15 coexist,
  17/8/5 khai hoang, 16 teams with full before/after data) plus landingPreviews()
  deriving both previews and their detail links from the same publication
- count before/after coverage from the per-hero before/after fields instead of
  the variant list, with boundary coverage for a variant-free team and an
  after-only team
- add src/components/DownloadQr.astro: one-shot qrcode@1.5.4 SVG for
  https://tqccl.onelink.me/qmz6/qifw0r4t?af_qr=true, with provenance comment
- give all three download controls the shared external-link arrow next to their
  device icons, keep the legend hash redirect and the Phase 3 shell intact
- extend tokens/components (hero, statistics, cards, previews, table, download,
  CTA) with source-backed values and 489 probes, lower the legacy raw-value
  ceiling 603 -> 600
- declare 74 authored-vi Landing obligations, refresh the localization policy
  (56407 locations), republish the generation and re-pin route handles to 8eec9bac
- add tests-e2e/landing.spec.mjs (order, data-backed numbers, before/after
  boundaries, previews with a live detail link, anchors in both widths, QR,
  outbound arrows, dark-theme QR, legacy redirect)
```

## Nits từ re-review (round 3) — **đã sửa ở vòng nit (2026-09-26)**

| # | Nội dung | Trạng thái |
| --- | --- | --- |
| N4-1 | Bảng xem trước trên Landing mobile: cột **điểm** chỉ tới được khi cuộn ngang trong bảng và không có gợi ý nào cho biết bảng cuộn được. | **Đã sửa** (vòng nit). Ở ≤820 bảng xếp dọc theo `MobileTable`: `min-width: 0`, `tr` là grid `minmax(0,1fr) auto`, điểm ở góc phải hàng 1, vạch ngăn chuyển sang hàng. Không còn cuộn trong khung nên không cần gợi ý cuộn. Đo ở 390 **và** 320: `scrollWidth` trang ≤ bề rộng, cuộn trong khung = 0, mép điểm nằm trong khung, điểm cùng hàng với tên đội. e2e `landing.spec.mjs` thay khẳng định cũ "vùng bảng cuộn riêng ở 390" (nay sai theo thiết kế); `LandingMobile` không vẽ bảng nên đây vẫn là ngoại lệ đã khai. |
| N4-2 | Lệnh sinh QR và version (`qrcode@1.5.4`) nằm ở comment frontmatter của `src/pages/index.astro`, nên **không** có trong `dist/index.html` — trong khi plan ghi "comment ở đầu SVG". | **Đã sửa** (vòng nit). Comment nguồn gốc nay nằm **ngay sau thẻ `<svg>`** trong `src/components/DownloadQr.astro` (chỉ còn một bản; frontmatter chỉ trỏ tới), nên nó vào thẳng `dist/index.html`; bytes của SVG không đổi. `tests-js/astro-dist-contract.test.mjs` thêm khẳng định đọc `dist/index.html` và đòi comment nằm trong `<svg>` của `.landing-qr-frame` — đã kiểm đỏ trên `dist` cũ, xanh sau khi sửa; `npm run test:dist` 28/28. |

## Audit 260926 — sửa theo ảnh ghép

Nguồn finding: `agent://AuditChromeLanding` (F11–F18). Soát bằng `design-compare --phase 4 [--theme dark] --base http://127.0.0.1:4411` (`.cache/design-compare/phase-04/`, `phase-04-dark/`): Landing 1440 cao 4448px (artboard 4420; trước sửa 4589). `--tokens --phase 4` light/dark: 714/714 khớp.

| Finding | Trạng thái | Chi tiết |
| --- | --- | --- |
| F11 | đã sửa | `#landing-vaults`: cột trái `.landing-vaults-intro` = khối dẫn + 2 thẻ kho (grid 2 cột, gap 22), cột phải = panel bảng (`src/pages/index.astro`); bỏ `.landing-vaults-body`. |
| F12 | đã sửa | `.landing-table-bar` nền `--band`, chữ `--band-ink`, số đội `--band-dim`, bỏ vạch dưới; panel bảng bo `radius.16` như artboard. Probe `bang-xem-truoc` cập nhật (có `source`). |
| F13 | đã sửa | Thẻ xem trước dựng lại thành thẻ gọn của artboard, cùng lớp với thẻ danh sách Phase 5: đầu thẻ tên + dòng meta "■ phe · **loại binh** · OG · Binh Diễn Xuân Thu" + điểm; hàng tướng grid 40px/1fr với nhãn CHỦ/PHÓ 1/PHÓ 2, tên (tiền tố 40Y/SP/CO là chip `nhan-bien-the`, D4), chiến pháp chữ son, dòng "Binh thư · …"; chân thẻ link chữ son "Chi tiết →" cao 44. Phe giữ trong dòng meta vì có dữ liệu (artboard không vẽ phe — D2 không bỏ dữ liệu). Component `the-doi-xem-truoc` + probe viết lại; bỏ probe Landing trong `badge-phe` và `nut-chien-phap`. |
| F14 | đã sửa | Hai dòng `.landing-tool-note` thêm svg ✓ 16px (`--good`), CSS sẵn có. |
| F15 | đã sửa (ngắt dòng) · giữ (kicker) | `<br class="landing-hero-break">` ẩn ≤820 + khoảng trắng trước → h1 mobile chảy "Mùa này chơi / đội nào? Mở sổ / là thấy." như artboard. Phần kicker " · Tam Quốc Chí Chiến Lược" giữ trên mobile → D1. |
| F16 | giữ | Kicker/phụ đề/số 01–03 và tiêu đề dài trên mobile: nội dung artboard mobile lược bớt → D1 (không ẩn nội dung trên mobile). |
| F17 | giữ | Tiêu đề "Chưa cài game? Tải Tam Quốc Chí – Chiến Lược" bản đầy đủ trên mobile → D1. |
| F18 | đã sửa | Bỏ `margin-bottom: space.40` của `.landing-cta` ≤820: CTA tối liền footer tối như desktop. |

Chữ thay đổi (`pipeline/site_localization.py`, đều authored-vi, `src/pages/index.astro`):
- `ui:landing/preview-card-link`: "Xem chi tiết" → "Chi tiết" (literal hàng `>Chi tiết<`).
- Bỏ `ui:landing/preview-card-main-holder` "Chủ tướng" (huy hiệu C không còn trên thẻ gọn).
- Thêm `ui:landing/preview-card-role-main` "CHỦ", `…-role-deputy-1` "PHÓ 1", `…-role-deputy-2` "PHÓ 2", `ui:landing/preview-card-books` "Binh thư · ", `ui:landing/preview-card-books-missing` "Nguồn chưa ghi".

Test: `tests-e2e/landing.spec.mjs` đổi selector thẻ xem trước (`.reference-units`, `.reference-faction`, `.hero-name`, `.landing-preview-link`) — không chạy suite theo chỉ dẫn.
