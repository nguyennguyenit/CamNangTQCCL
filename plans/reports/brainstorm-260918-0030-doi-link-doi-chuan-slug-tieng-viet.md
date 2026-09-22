# Brainstorm — Đổi URL trang chi tiết đội sang slug tiếng Việt

- **Ngày:** 2026-09-18
- **Trạng thái:** đã chốt 2/3 quyết định; còn chờ chốt **ngữ pháp đặt tên** (mục 7)
- **Đã chốt:**
  1. Đổi cả segment đường dẫn: `/doi-chuan/` + `/doi-khac/`.
  2. Cutover sạch — URL cũ không cần tiếp tục chạy (URL chi tiết chưa public).
- **Phạm vi mã:** `src/lib/team-detail-routes.ts`, `js/team-detail-navigation.js`,
  `src/pages/teams/{recommended,legacy}/`, `pipeline/recommended-identity-map.json`,
  `public/_headers`, `docs/*`, `tests*/`

## 1. Hợp đồng

### Outcome

Link trang chi tiết đội đọc được bằng tiếng Việt, có cấu trúc, thay cho ID nguồn sgsdeck.

```
hiện tại : /teams/recommended/og-bingyan-40y-lvbu-b/
hiện tại : /teams/recommended/team-b8ink3/
mong muốn : /doi-chuan/og-40y-lu-bo-cung-vuong-di-phap-chinh/
mong muốn : /doi-chuan/pk-s24-tu-ma-phi-hung/
```

| Họ | Hiện tại | Số trang |
| --- | --- | --- |
| Đội chuẩn | `/teams/recommended/<sourceConfigId>/` | 1366 |
| Đội khác (đội gốc) | `/teams/legacy/<legacyTeamId>/` | 166 |

### Constraints (đã kiểm chứng)

1. **Song ánh 1–1 bắt buộc.** `team-detail-routes.ts` ném lỗi khi ID trùng hoặc không
   routable; `scripts/verify-astro-dist.mjs` dùng chung inventory ⇒ `dist/` không được
   thừa/thiếu trang.
2. **Không có cache crawl.** `.cache/` trống ⇒ mọi phương án ghi slug vào publication
   (`index.json`, manifest) đều buộc crawl lại sgsdeck và sinh generation mới, kéo theo
   chuỗi hash `manifest → website-display.json → current.json`.
3. **URL phải ổn định.** `displayNameVi` là bản dịch *đang được duyệt*
   (`pipeline/recommended-identity-map.json`, 661 entry `kind: team`,
   `reviewStatus: translation-reviewed`). Suy slug lại mỗi build ⇒ sửa một chữ trong
   bản dịch là URL cũ chết.
4. **Link nguồn phải giữ.** `validateReferenceSourceUrl` xác thực
   `https://sgsdeck.com/recommended/<sourceConfigId>` ⇒ `sourceConfigId` phải còn
   nguyên trong record. Slug không thay thế nó.
5. **Đường dẫn chỉ dựng ở hai chỗ** (`docs/code-standards.md`):
   `src/lib/team-detail-routes.ts` (build) và `js/team-detail-navigation.js` (runtime).
   Hai bản cài phải cho cùng kết quả.
6. **Runtime không đọc tham số đường dẫn.** `js/team-detail.js` lấy định danh từ
   `data-source-config-id` / `data-legacy-team-id`, không parse URL ⇒ đổi URL không
   đụng logic tải dữ liệu.
7. **Host tĩnh.** `public/_headers` phủ wildcard; `404.html` là trang tĩnh thật;
   không SPA fallback.
8. Mọi hàng đều có `sourceSeasonCode` (26 mùa, 0 hàng thiếu) và `displayNameVi`
   (0/1366 hàng thiếu).

### Non-goals

- Không đổi hash deep-link 8 section, không đổi query param root
  (`season`, `category`, `q`, `faction`, `unit`, `score`, `subcategory`, `source`).
- Không đổi `sourceConfigId` / `legacyTeamId` / `legacyVariantId` trong dữ liệu raw,
  `data/teams.json`, identity ledger hay link nguồn sgsdeck.
- Không đổi `safeScopeKey` (`s-<sha256>`), cơ chế pin generation, hay URL asset
  (`/js/*`, `/css/*`, `/data/*`).
- Không sinh trang redirect cho URL cũ.

### Acceptance criteria

1. Build sinh đúng 1366 + 166 trang ở route mới; `npm run verify` xanh.
2. Không hai URL nào trùng; build **fail** nếu trùng.
3. `data-source-config-id` vẫn là ID nguồn; link “Nguồn: sgsdeck.com” vẫn đúng.
4. `npm run test:node` + `npm run test:e2e` xanh sau khi cập nhật 8 file test
   (`team-detail-navigation`, `team-detail-routes`, `pages-headers-contract`,
   `astro-dist-contract`, `team-detail-pages`, `recommended-browser`,
   `site-localization`, `spa-parity`).
5. `public/_headers`, `docs/code-standards.md`, `docs/deployment-guide.md`, `README.md`
   mô tả path mới.
6. Mở trực tiếp URL mới, reload, dùng link quay lại → giữ nguyên hành vi snapshot `from`.
7. Sửa một `displayNameVi` trong ledger **không** đổi URL đã phát hành.

## 2. Ngữ pháp đặt tên — đo trên 1366 hàng đang pin

Ký hiệu: `S(x)` = slug hoá tiếng Việt (bỏ dấu, `đ→d`, gạch nối); `SC` = `sourceSeasonCode`
viết thường (`pk-s28`, `s2`, `og`).

| Ngữ pháp | Khác nhau | Nhóm trùng | Hàng bị ảnh hưởng | Dài TB / max |
| --- | --- | --- | --- | --- |
| `S(displayNameVi)` (không mùa) | 656 | 244 | 954 | 16.8 / 48 |
| `SC-S(tên ngắn, bỏ ngoặc)` | 1263 | 84 | 187 | 21.4 / 47 |
| `SC-S(tướng)` (theo thành phần) | 1190 | **126** | **302** | **36.1** / 64 |
| **`SC-S(displayNameVi)`** | **1358** | **8** | **16** | 23.4 / 55 |
| `SC-S(displayNameVi)-h6` | 1366 | 0 | 0 | 23.8 / 55 |

Kết luận từ số đo:

- **Không có mùa là không được.** `Ngụy Pháp Kỵ` xuất hiện **15 lần**
  (`s2-wei-fa-qi` … `s11-wei-fa-qi`, `PK-S4`…`PK-S11`): 244 nhóm trùng, 954/1366 hàng.
- **Bỏ phần trong ngoặc là tệ hơn.** Chính phần ngoặc phân biệt các bản:
  `40Y Lữ Bố Cung (Vương Dị, Pháp Chính)` vs `40Y Lữ Bố Cung (Tinh·Tiên Đăng Tử Sĩ)`,
  `Pháp Âm Thuẫn (bản Trấn Ách)` vs `(bản Trấn Ách) 2`.
- **Ngữ pháp theo tướng không đặt tên được hàng loạt.** `SC-S(tướng)` trùng 126 nhóm /
  302 hàng và dài nhất (36.1 ký tự) — vì cùng một bộ ba tướng dùng nhiều chiến pháp khác
  nhau. Đây là điều chỉnh so với ví dụ `og-lu-bo-vuong-di-sp-phap-chinh`: riêng đội OG
  đó có tên nguồn đã chứa sẵn tướng nên nó *trông* như ngữ pháp theo tướng, nhưng nhân
  rộng ra toàn bộ thì không dùng được.
- **`SC-S(displayNameVi)` là ngữ pháp máy móc tốt nhất**: chỉ 16/1366 hàng (8 nhóm)
  cần người xử lý tay, và tất cả đều là hai bản khác nhau trong *cùng* một mùa.

8 nhóm phải xử lý tay (đều cùng mùa, cùng tên):

| Khoá máy móc | Hai ID nguồn | Ghi chú |
| --- | --- | --- |
| `pk-s28-on-hau-cung` | `s28-wenhou-gong`, `s28-wenhou-gong-hun` | 溫侯弓 / 混 |
| `pk-s25-on-hau-cung` | `s25-wenhou-gong`, `s25-wenhou-gong-hun` | nt |
| `pk-s27-on-hau-cung` | `s27-wenhou-gong-qun`, `s27-wenhou-gong-hun` | 群 / 混 |
| `pk-s28-hoang-ma` | `s28-huangma-qun`, `s28-huangma-hun` | 皇馬 群 / 混 |
| `pk-s25-hoang-ma` | `s25-huangma-qun`, `s25-huangma-hun` | nt |
| `pk-s27-hoang-ma` | `s27-huangma-qun`, `s27-huangma-hun` | nt |
| `pk-s26-don-don-thuan` | `s26-dundun-dun`, `yxms-031-惇惇盾` | 墩墩盾 / 惇惇盾, khác nguồn |
| `pk-s11-do-doc-cung` | `s11-wu-dudu-gong`, `s11-wu-dudu-zhuanyou` | 都督弓 / 專有 |

## 3. Hai cách xếp mùa vào URL

| | Phẳng (tiền tố) | Phân cấp (segment) |
| --- | --- | --- |
| Dạng | `/doi-chuan/pk-s28-hoang-ma/` | `/doi-chuan/pk-s28/hoang-ma/` |
| Route | `src/pages/doi-chuan/[team].astro` | `src/pages/doi-chuan/[season]/[team].astro` |
| Phạm vi duy nhất của slug | toàn bộ Đội chuẩn | từng mùa |
| Cấu trúc | 1 khối | 3 tầng: bảng → mùa → đội |
| Mở rộng sau này | khó gắn trang theo mùa | `/doi-chuan/pk-s28/` thành trang mùa tự nhiên |
| Khớp ví dụ đề xuất | có (`og-…`, `pk-s28-…`) | không |

### Kết luận theo SEO (đã đối chiếu tài liệu Google)

- **Không có khác biệt xếp hạng giữa phẳng và phân cấp.** Google nói từ khoá trong
  đường dẫn “hardly any effect” ngoài việc có thể xuất hiện trong breadcrumb; độ sâu
  thư mục không phải tín hiệu xếp hạng.
  ([SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide),
  [URL structure](https://developers.google.com/search/docs/crawling-indexing/url-structure))
- **Quy tắc Google về dấu:** `/` = tầng nội dung thật, `-` = phân tách từ trong một tên.
  Không dùng `/` thay cho `-`, và không tạo tầng chỉ để nhồi từ khoá.
- Hệ quả cho hai dạng:
  - **Phẳng** `/doi-chuan/pk-s28-hoang-ma/` — `pk-s28-hoang-ma` là *một tên đội* có
    tiền tố mùa. Đúng quy tắc dấu của Google.
  - **Phân cấp** `/doi-chuan/pk-s28/hoang-ma/` — chỉ hợp lệ nếu `/doi-chuan/pk-s28/`
    **là trang thật** (trang mùa). Nếu không, nó tạo một tầng thư mục 404 ⇒ đúng dạng
    “artificial URL folder” mà Google khuyên tránh.
- Nếu ship kèm **trang mùa thật**, phân cấp thắng ở chỗ đáng kể: hub internal-link
  thật cho từng mùa + breadcrumb 3 tầng trên SERP
  (`… › Đội chuẩn › PK-S28 › Hoàng Mã`). Nhưng lợi đó đến từ *trang mùa*, không từ
  hình dạng URL.

⇒ **Khuyến nghị: phẳng.** Không mất gì về từ khoá, không tạo tầng 404, và đổi sang
phân cấp sau này là một migration — nên chỉ chọn phân cấp nếu trang mùa được ship
trong cùng lần này.

## 3b. SEO — thứ nặng hơn hình dạng URL đang thiếu

Kiểm trực tiếp trên repo:

| Hạng mục | Trạng thái |
| --- | --- |
| `<link rel="canonical">` | **thiếu** (`src/layouts/SiteLayout.astro` chỉ có title/description/og) |
| `og:url` | **thiếu** |
| `og:type` trên trang chi tiết | `website` (đúng ra là `article`) |
| `public/robots.txt` | **thiếu** |
| sitemap | **thiếu** (không có integration, không có file) |

Vì sao quan trọng hơn flat/nested:

1. Trang gốc nhận vô số biến thể query (`season`, `category`, `q`, `faction`, `unit`,
   `score`, `subcategory`, `source`) mà **không có canonical** ⇒ đúng dạng faceted
   navigation sinh URL gần trùng mà Google cảnh báo là tốn crawl và cản index.
2. 1532 trang chi tiết không có sitemap ⇒ chỉ được khám phá qua link nội bộ.
3. Không có `robots.txt` ⇒ không khai báo được sitemap.

Đây là phạm vi **tuỳ chọn**, không tự động gộp: nếu gộp cùng lần đổi URL thì mọi thứ
định hình URL public được làm một lần; nếu tách thì ghi thành việc riêng.

## 4. Ví dụ thật (dạng phẳng, `SC-S(displayNameVi)`)

| Tên tiếng Việt | Mùa | Hôm nay | Đề xuất |
| --- | --- | --- | --- |
| 40Y Lữ Bố Cung (Vương Dị, Pháp Chính) | OG | `og-bingyan-40y-lvbu-b` | `/doi-chuan/og-40y-lu-bo-cung-vuong-di-phap-chinh/` |
| Quan Ngụy Pháp Thuẫn | OG | `og-bingyan-guanyu-weiyan-fazheng-shield` | `/doi-chuan/og-quan-nguy-phap-thuan/` |
| Tạm Tị Kỳ Lân | PK-S28 | `s28-zanbi-qilin` | `/doi-chuan/pk-s28-tam-ti-ky-lan/` |
| Tân Chu Du Đô Đốc | PK-S28 | `s28-xin-zhouyu-dudu` | `/doi-chuan/pk-s28-tan-chu-du-do-doc/` |
| Tư Mã Phi Hùng | PK-S24 | `team-b8ink3` | `/doi-chuan/pk-s24-tu-ma-phi-hung/` |
| Thái Sư Cung | PK-S24 | `team-dip6a` | `/doi-chuan/pk-s24-thai-su-cung/` |
| Tiềm Long Điêu Thuyền | PK-S24 | `team-epoddo` | `/doi-chuan/pk-s24-tiem-long-dieu-thuyen/` |
| Tư Mã Tào Nhân Thuẫn | S2 | `s2-wei-sima-caoren-dun` | `/doi-chuan/s2-tu-ma-tao-nhan-thuan/` |
| S3 Tư Mã cấu hình tối ưu | S3 | `s3-wei-s3-dingpei-sima` | `/doi-chuan/s3-tu-ma-cau-hinh-toi-uu/` |
| Thái Úy Thuẫn（Hình Nhất Trận） | PK-S10 | `s10-wei-taiwei-dun-xingyizhen` | `/doi-chuan/pk-s10-thai-uy-thuan-hinh-nhat-tran/` |
| SP Tuân Úc Sơn Hà Cung (Thượng Binh) | PK-S23 | `s23-sp-xunyu-shanhe-gong-2` | `/doi-chuan/pk-s23-sp-tuan-uc-son-ha-cung-thuong-binh/` |
| Ngô Kỵ (Tôn Thượng Hương) | PK-S11 | `s11-wu-wuqi-sunshangxiang` | `/doi-chuan/pk-s11-ngo-ky-ton-thuong-huong/` |

Hai chỉnh lại so với ví dụ đã nêu:

- `pk-s28-tam-ty-ky-lan` → đúng chính tả slug là **`pk-s28-tam-ti-ky-lan`**
  (`Tạm Tị Kỳ Lân`).
- **`pk-s28-hoang-ma-thuong` không tồn tại.** `Hoàng Mã Thương` là **Đội khác**
  (`data/teams.json` → Úc Liêu Cơ). Ở PK-S28 có ba hàng `皇馬`: `s28-huangma-qun`,
  `s28-huangma-hun` (đều dịch là “Hoàng Mã”) và `s28-huangma-bianzhong`
  (“Hoàng Mã biến thể” → `pk-s28-hoang-ma-bien-the`).

Đội khác (166 đội, `nickname` không có chữ Hán, `S(nickname)` trùng 14 nhóm 2–3 đội):

| Đề xuất | Nguồn |
| --- | --- |
| `/doi-khac/vinh-quang-thuong/` | `team-intro-0` (Úc Liêu Cơ) |
| `/doi-khac/hoang-ma-thuong/` | `team-intro-1` (Siêu Tung Du) |
| `/doi-khac/tan-ngo-thuong/` | `team-intro-4` (Mông Tốn Túc) |
| `/doi-khac/do-giang-thuong/` | `team-intro-3` (Vũ Tung Mông) |

## 5. Phương án

### P1 — Slug máy móc ở build + runtime, đóng băng bằng ledger (khuyến nghị)

1. Thêm field `routeHandle` vào 661 entry `kind: team` của
   `pipeline/recommended-identity-map.json` (đã có `aliases`, `displayNameVi`,
   `evidenceRef`, `reviewStatus`), và một ledger tương tự cho 166 Đội khác.
2. Sinh máy móc: `routeHandle = S(displayNameVi)` (Đội chuẩn) / `S(nickname || name)`
   (Đội khác) — tự động điền lần đầu, sau đó review.
3. 16 hàng thuộc 8 nhóm trùng ở mục 2 được người gán thêm token phân biệt.
4. Từ đó build **chỉ đọc** ledger, không suy lại từ bản dịch.
5. `src/lib/team-detail-routes.ts` dựng `routePath`/`htmlPath` từ
   `SC + routeHandle`; `js/team-detail-navigation.js` đọc cùng giá trị đó từ hàng dữ
   liệu (cần đưa `routeHandle` vào `index.json`/`other-teams.json` ở tầng build —
   **không** đụng publication đang pin, chỉ đọc thêm ở tầng dựng route).

- **Không cần crawl**, không bump manifest, không đổi generation.
- **Giả định chịu lực nhất:** TS (build) và JS (runtime) tính ra cùng một handle.
  Chặn bằng test hợp đồng chạy hết 1366 hàng của generation đang pin.
- **Hỏng trước khi nào:** ai đó sửa `displayNameVi` mà quên ledger — nhưng vì ledger
  là nguồn duy nhất của URL, URL vẫn đứng yên; đây chính là điều acceptance #7 kiểm.
- Chi phí: 827 dòng thêm một field (auto-fill + review), 8 nhóm gán tay, 1 file route
  đổi tên, 8 file test, 4 file docs/headers.

### P2 — Nhét `routeSlug` thẳng vào publication

`index.json` / `other-teams.json` / `details-*.json` mang sẵn slug; runtime chỉ đọc.

- Lợi: slug nằm trong generation bất biến và trong hash manifest; một nguồn sự thật.
- Giá: `.cache/` trống ⇒ crawl lại sgsdeck, sinh generation mới, cập nhật
  `manifest → website-display.json → current.json`, bump schema, sửa
  `pipeline/site_localization.py` + `scripts/verify-astro-dist.mjs`, kèm review churn
  cho mọi source hash.
- **Hỏng trước khi nào:** crawl lệch ⇒ generation mới trộn thay đổi không liên quan vào
  cùng một lần ship.
- Kết luận: **không cần**, vì P1 đã cho cùng lợi ích ổn định mà không phải crawl.

### P3 — Giữ URL cũ làm alias

- Giá: 1532 trang stub (hoặc 1532 rule `_redirects`, sát giới hạn Pages), hai không
  gian URL, phải khai báo canonical; `astro dev` không áp `_redirects` nên localhost
  khác production.
- Đã bị loại ở bước chốt: URL chi tiết chưa public.

## 5b. Handle lấy từ tên đội hay từ bộ ba tướng?

Đo trên 1366 hàng đang pin:

| Ngữ pháp | Khác nhau | Nhóm trùng | Hàng cần gán tay | Dài TB / max |
| --- | --- | --- | --- | --- |
| `SC-S(tên đội)` | 1358 | 8 | **16** | **23.4 / 55** |
| `SC-S(3 tướng)` | 1190 | **126** | **302** | **36.1 / 64** |

Và điểm quyết định: **7/8 nhóm trùng tên có danh sách tướng HOÀN TOÀN GIỐNG NHAU.**

| Nhóm trùng tên | Hai ID nguồn | Bộ ba tướng |
| --- | --- | --- |
| `pk-s28-on-hau-cung` | `s28-wenhou-gong`, `s28-wenhou-gong-hun` | Tả Từ · Lữ Bố · Hứa Du — **giống hệt** |
| `pk-s28-hoang-ma` | `s28-huangma-qun`, `s28-huangma-hun` | SP Mã Siêu · SP Hoàng Phổ Tung · Hứa Du — **giống hệt** |
| `pk-s26-don-don-thuan` | `s26-dundun-dun`, `yxms-031-惇惇盾` | Tào Tháo · Hạ Hầu Đôn · Mãn Sủng — **giống hệt** |

⇒ Ngữ pháp theo tướng **không thể phân biệt đúng những ca cần phân biệt**, vì đó là cùng
tướng khác chiến pháp. Chiều ngược lại cũng hỏng: bộ ba
(Khương Duy · Bàng Thống · Gia Cát Lượng) ứng với **40 đội khác tên**
(`Thục Trí Cung`, `Kỳ Lân Cung`, …) mà người chơi phân biệt bằng tên đội; bộ ba
(Tư Mã Ý · Tào Tháo · Mãn Sủng) ứng với 32 đội.

**Kết luận: dùng tên đội.** Ví dụ `og-40y-lu-bo-cung-vuong-di-phap-chinh` mà đề xuất
ban đầu thực chất *là* tên đội (`40Y Lữ Bố Cung` + phần ngoặc liệt kê tướng), không
phải ngữ pháp theo tướng.

Vì `routeHandle` được review trong ledger, dạng theo tướng vẫn dùng được **như ngoại lệ
từng đội** ở nơi nó đọc dễ hơn — chỉ không dùng làm luật chung:

```
luật chung   : /doi-chuan/og-40y-lu-bo-cung-vuong-di-phap-chinh/
ngoại lệ     : /doi-chuan/og-lu-bo-vuong-di-phap-chinh/          (gán trong ledger)
```

## 5c. Bỏ phần trong ngoặc — đo cụ thể

Đề xuất rút `40Y Lữ Bố Cung (Vương Dị, Pháp Chính)` → `og-40y-lu-bo-cung`.
**Không dùng được**: cùng mùa OG có **4 đội** rút về đúng khoá đó.

| ID nguồn | Tên | Bỏ ngoặc → |
| --- | --- | --- |
| `og-bingyan-40y-lvbu-b` | 40Y Lữ Bố Cung (Vương Dị, Pháp Chính) | `og-40y-lu-bo-cung` |
| `og-bingyan-40y-lvbu-xiandeng` | 40Y Lữ Bố Cung (Tinh·Tiên Đăng Tử Sĩ) | `og-40y-lu-bo-cung` |
| `og-bingyan-40y-lvbu-d` | 40Y Lữ Bố Cung (Đổng Trác, Điêu Thuyền) | `og-40y-lu-bo-cung` |
| `og-bingyan-40y-lvbu-a` | 40Y Lữ Bố Cung (Điêu Thuyền, Lư Thực) | `og-40y-lu-bo-cung` |

Trên toàn bộ 1366 hàng: 224 hàng có phần ngoặc; bỏ ngoặc làm luật chung ⇒ **84 nhóm
trùng / 187 hàng phải gán tay** (so với 8 nhóm / 16 hàng khi giữ nguyên), trong đó
**76 nhóm trùng mới hoàn toàn**. Nhóm tệ nhất:
`pk-s23-uy-thao-hoang-ma` gộp 7 biến thể `Uy Thảo Hoàng Mã` (`Bạo Lệ`, `Hoàng Phủ Uy
Mưu`, `Dẫm Đạp Thần Uy`, `chống khống chế đơn mục tiêu`, `Tả Từ thay thế`,
`bạch bản không Lâm Nguy`, `bạch bản`).

Nhưng hướng của đề xuất đúng: với phần lớn hàng, ngoặc là nhiễu. Luật ba bậc đo được:

| Bậc | Luật | Khác nhau | Phải gán tay | Dài TB |
| --- | --- | --- | --- | --- |
| 1 | `SC-S(tên đội)` | 1181 | 185 | 21.7 |
| 2 | + token đầu trong ngoặc khi trùng | **1338** | **28** | **22.9** |
| 3 | + cả ngoặc khi trùng | 1338 | 28 | 22.9 |
| — | luôn giữ cả ngoặc | 1358 | 16 | 23.4 |

Bậc 3 không thêm được gì: 28 hàng còn lại **không có ngoặc** để phân biệt
(`Tư Mã Phi Hùng`, `Ôn Hầu Cung`, `Hoàng Mã`, `Đô Đốc Cung`, `Bát Môn Thục Cung`…) nên
phải do người gán trong ledger.

**Luật chốt:** bậc 1 mặc định, bậc 2 khi trùng, 28 hàng còn lại gán tay trong ledger.

Họ `40Y Lữ Bố Cung` sau review — ngắn hơn mà vẫn phân biệt được:

```
/doi-chuan/og-40y-lu-bo-cung-vuong-di/       <- (Vương Dị, Pháp Chính)
/doi-chuan/og-40y-lu-bo-cung-tien-dang/      <- (Tinh·Tiên Đăng Tử Sĩ)
/doi-chuan/og-40y-lu-bo-cung-dong-trac/      <- (Đổng Trác, Điêu Thuyền)
/doi-chuan/og-40y-lu-bo-cung-dieu-thuyen/    <- (Điêu Thuyền, Lư Thực)
```



## 5d. Tự động hoá — kết quả cuối: 0 dòng gán tay, mỗi nhóm va chạm đều có URL trơn

### `qun` / `hun` là PHE, không phải binh chủng

Kiểm trên toàn bộ 1366 hàng: hậu tố id ⇔ `factionRaw` khớp tuyệt đối.

| Hậu tố id | `factionRaw` | Số hàng | Nhãn Việt (đã review) |
| --- | --- | --- | --- |
| `-qun` | 群 | 6/6 | **Quần** |
| `-hun` | 混 | 7/7 | **Hỗn hợp** |
| `-bianzhong` | 群 | 4/4 | biến thể |

Nhãn lấy từ `pipeline/recommended-display-map.json` → `labels.faction`
(`群`=Quần, `混`=Hỗn hợp, `騎`=Kỵ). Binh chủng là trường khác (`unitTypesRaw`).

Luật chốt (thay luật "bản trơn giữ khoá gốc" ở bản trước):

1. **Base** `SC-S(tên đội)` bỏ phần ngoặc.
2. Nhóm va chạm: hàng **có ngoặc** nhận `-{token đầu trong ngoặc}`.
3. Hàng không ngoặc trong nhóm va chạm: **URL trơn thuộc bản xếp hạng cao nhất** —
   `tierOrder` → `value` → không phải phe `混` → `listIndex` → `sourceConfigId`.
4. **Tag** = nhãn Việt của `factionRaw` khi hai hàng khác phe (`quan`, `hon-hop`);
   nếu cùng phe thì delta của `sourceConfigId` (`yxms-031`, `zhuanyou`→`chuyen-huu`);
   delta rỗng ⇒ `goc`.

Kết quả: **1366/1366 khác nhau, 0 hàng `None`, dài TB 22.8**, cả 8 nhóm va chạm đều có
đúng một URL trơn.

| Nhóm va chạm | URL trơn | Bản còn lại |
| --- | --- | --- |
| `pk-s28-on-hau-cung` | `/doi-chuan/pk-s28-on-hau-cung/` (混, T0, 113) | `/…-quan/` (群, T1.5, 90) |
| `pk-s25-on-hau-cung` | `/doi-chuan/pk-s25-on-hau-cung/` (混, T0, 113) | `/…-quan/` (群, T1.5, 90) |
| `pk-s27-on-hau-cung` | `/doi-chuan/pk-s27-on-hau-cung/` (混, T0, 113) | `/…-quan/` (群, T1, 98) |
| `pk-s28-hoang-ma` | `/doi-chuan/pk-s28-hoang-ma/` (群, T0, 113) | `/…-hon-hop/` (混, T0, 113) |
| `pk-s25-hoang-ma` | `/doi-chuan/pk-s25-hoang-ma/` (群, T0, 113) | `/…-hon-hop/` (混, T0, 113) |
| `pk-s27-hoang-ma` | `/doi-chuan/pk-s27-hoang-ma/` (群, T0, 113) | `/…-hon-hop/` (混, T0, 113) |
| `pk-s26-don-don-thuan` | `/doi-chuan/pk-s26-don-don-thuan/` (T0.5, 105) | `/…-yxms-031/` (T1, 98) |
| `pk-s11-do-doc-cung` | `/doi-chuan/pk-s11-do-doc-cung/` (T1, 100) | `/…-chuyen-huu/` (T1, 100) |

### Phát hiện: 6/8 nhóm là nguồn liệt kê CÙNG cấu hình hai lần

So sánh toàn bộ trường giữa hai hàng trong mỗi nhóm, bỏ qua `factionRaw`/`notesRaw`/
`tierRaw`/`value`/`listIndex`/`sourceConfigId`/`sourceUrl`/`displayNotes`:

| Nhóm | Còn khác gì ngoài phe/ghi chú/tier/điểm |
| --- | --- |
| 3 nhóm Hoàng Mã (PK-S25/27/28) | **không còn gì** — tướng, chiến pháp, binh thư, binh chủng, tier, điểm giống hệt |
| 3 nhóm Ôn Hầu Cung (PK-S25/27/28) | **không còn gì** — chỉ khác tier/điểm (T0 113 vs T1.5 90 / T1 98) |
| `pk-s26-don-don-thuan` | `heroes`, `nameZh`, `unitTypesRaw` |
| `pk-s11-do-doc-cung` | `heroes`, `nameZh` |

Ví dụ PK-S28 Hoàng Mã: cùng SP Mã Siêu · SP Hoàng Phổ Tung · Hứa Du, cùng chiến pháp
(`當鋒摧決+速乘其利` / `草船借箭+臨危救主` / `威謀靡亢+解煩衛`), cùng binh thư, cùng T0 và
113 điểm — chỉ khác nhãn phe (`群` vs `混`) và ghi chú nguồn
(`內戰…` vs `跨陣營依然超模`).

⇒ Đây **không** phải hai đội khác nhau về cấu hình; nguồn phân biệt **bối cảnh sử dụng**
(nội chiến vs xuyên phe). Việc này đổi số trang public nên cần người quyết: giữ cả hai
URL (1366 trang) hay gộp các cặp trùng cấu hình (bớt 6 trang Đội chuẩn).

Đội khác (29 hàng / 14 nhóm): tên tướng giống hệt nhau, khác biệt nằm trong
`books`/`tactics`, nên tag tự động chỉ còn là số id — `/doi-khac/du-tu-mong-23/`,
`/doi-khac/du-tu-mong-122/`.

**Đính chính ghi nhận trước:** `team-intro-26` và `moi-phe-118` **không** trùng lặp —
đã so toàn bộ trường, cả 14 nhóm đều khác nhau ở `heroes[].books`/`tactics`.



## 5e. Ledger chứa gì — cái dễ hiểu nhầm nhất

Luật auto **không phải** cơ chế ngoại lệ: cả 1366 URL Đội chuẩn sinh hoàn toàn bằng máy
(mục 5d). Việc rút bậc-2 result (`…-vuong-di-phap-chinh` → `…-vuong-di`) là ngoại lệ
**tuỳ chọn**: bậc 2 đã cho URL hợp lệ, người chỉ rút gọn thêm cho đẹp.

### Nhưng ledger phải chứa CẢ 1532 dòng, không phải vài ngoại lệ

Nếu ledger chỉ chứa vài dòng sửa tay thì phần còn lại **vẫn suy từ `displayNameVi` mỗi
build** ⇒ sửa một nhãn hiển thị là URL chết, phá đúng acceptance #7. Máy sinh trước,
review sau, rồi đóng băng toàn bộ.

Điều đáng nhấn: **cả 83 nhóm trùng ở bậc 1 đều nằm gọn trong MỘT mùa** — tiền tố mùa đã
tách hết các mùa khác nhau. Nếu bỏ tiền tố mùa thì số nhóm trùng nhảy từ 83 lên **243
nhóm / 1069 hàng**. Ví dụ `Ôn Hầu Cung` có mặt ở 8 mùa (PK-S16/17/18/19/25/26/27/28) và
mỗi mùa là một khoá riêng, không đụng nhau.

Tag chỉ xuất hiện khi **hai đội cùng mùa cùng tên** — đúng 8 nhóm / 16 hàng, liệt kê đầy
đủ ở mục 5d.

`routeHandle` không đặt được trong entry dịch thuật hiện có
(`pipeline/recommended-identity-map.json` khoá theo alias tên, 661 entry phủ 1366 hàng —
một tên dùng cho nhiều mùa), vì handle là **theo từng hàng**. Cần file riêng:

```json
{
  "schemaVersion": 1,
  "generationId": "5202c942…",
  "note": "Handle URL đã review; gán một lần, không suy lại từ displayNameVi.",
  "handles": {
    "recommended": {
      "og-bingyan-40y-lvbu-b": "40y-lu-bo-cung-vuong-di",
      "team-b8ink3": "tu-ma-phi-hung"
    },
    "legacy": {
      "team-intro-4": "tan-ngo-thuong"
    }
  }
}
```

- Ledger giữ handle **không kèm mùa**; code ghép `SC` khi dựng route, nên mùa luôn lấy
  từ dữ liệu chứ không bị đóng băng hai lần.
- Build **fail** nếu một hàng của generation đang pin thiếu handle ⇒ generation mới buộc
  phải mở rộng ledger, không âm thầm rơi về suy máy.
- Build **fail** nếu `SC + handle` trùng hoặc handle chứa ký tự không routable.

### Đính chính về 29 dòng Đội khác

Ghi nhận trước rằng `team-intro-26` / `moi-phe-118` có thể là bản ghi trùng lặp là **sai**.
Đã so toàn bộ trường: cả 14 nhóm đều khác nhau ở `heroes[].books` / `heroes[].tactics`
(cùng tướng, khác chiến pháp). **Không có vấn đề dedup**, chỉ là trùng `nickname`.

## 5f. Nghi vấn dữ liệu nguồn: binh chủng vs 兵種改造

### Cách `unitTypesRaw` hình thành

`pipeline/sgsdeck_recommended.py:250` đọc badge binh chủng ngay trên trang nguồn:

```python
unit_types = [node.text[1:] for node in root.walk("span")
              if node.text in {"#弓","#騎","#盾","#槍","#器械"}]
```

Nên `unitTypesRaw` là **tuyên bố của chính sgsdeck**, không phải suy đoán của repo.
Đã tải lại trang để xác nhận: `s28-huangma-qun` render đúng badge `#騎`.

### `解煩衛` chỉ dùng được cho 槍

Ba nguồn độc lập khớp nhau:

| Nguồn | Nội dung |
| --- | --- |
| `data/tactics.json` (repo) | `"Dành riêng cho binh chủng Thương."` |
| Payload của chính trang nguồn | `"kind":"TROOP"`, `"troopLimit":["SPEAR"]`, `"槍兵專屬"` |
| `data/sgsdeck/troop-mods.json` | `解煩衛 → troopLimit: ["SPEAR"]` |

⇒ Một đội mang `解煩衛` chỉ có thể là **槍**, trừ khi có **兵種改造 → 轉騎兵**.

### Chuyển binh chủng có thật, và nguồn CÓ đánh dấu — nhưng chỉ ở OG

Toàn bộ 1366 hàng, đúng **3 hàng** có chữ `轉` trong tên nguồn, tất cả ở mùa `OG`
(Binh Diễn Xuân Thu), và cả 3 đều mang badge `#兵種改造` cạnh badge binh chủng:

| ID nguồn | Tên nguồn | Badge | Troop mod (cần) |
| --- | --- | --- | --- |
| `og-bingyan-dudu-bow-baimaobing` | 都督弓（**轉**·白毦兵） | 弓 + 兵種改造 | 白毦兵 (槍) |
| `og-bingyan-taishi-bow-feixiong` | 太師弓（**轉**·飛熊軍） | 弓 + 兵種改造 | 飛熊軍 (騎) |
| `og-bingyan-wumou-bow-baimaobing` | 五謀弓（**轉**·白毦兵） | 弓 + 兵種改造 | 白毦兵 (槍) |

Đã tải 9 trang PK (S25/27/28) + 3 trang OG để đối chiếu: **mọi trang PK có 0 lần xuất
hiện `轉·` và 0 badge `兵種改造`**, còn trang OG có cả hai.

### Bất biến `badge binh chủng == troopLimit` đúng gần tuyệt đối

| Troop mod (cần) | Badge khớp | Lệch |
| --- | --- | --- |
| 虎豹騎 (騎) | **119/119** | 0 |
| 無當飛軍 (弓) | **90/90** | 0 |
| 藤甲兵 (盾) | **72/72** | 0 |
| 錦帆軍 (弓) | **62/62** | 0 |
| 西涼鐵騎 (騎) | **26/26** | 0 |
| 先登死士 (弓) · 大戟士 (槍) · 虎衛軍 (盾) | **16/16** | 0 |
| 飛熊軍 (騎) | 50 | **14** |
| 象兵 (騎) | 28 | **10** |
| **解煩衛 (槍)** | 31 | **10** |
| 陷陣營 (盾) | 102 | 8 |
| 青州兵 (槍) | 69 | 4 |
| 白毦兵 (槍) · 白馬義從 (弓) | 26 | 3 |

⇒ Badge **đúng là binh chủng của đội**; các ca lệch là ngoại lệ thật, không phải nhiễu.

### Phân loại 83 hàng lệch

| Lớp | Số hàng | Mùa | Đánh giá |
| --- | --- | --- | --- |
| **A.** `unitTypesRaw` rỗng (trang nguồn không render badge) | **38** | PK-S26 ×37, OG ×1 | Lỗ hổng thu thập, không phải sai loại. Đã xác nhận `yxms-042-皇馬槍` render 0 badge |
| **B.** OG có `轉` + `#兵種改造` | **3** | OG | **Đúng cơ chế**, không phải lỗi |
| **C.** Lệch binh chủng, **không** có dấu chuyển | **42** | PK-S28 ×9, PK-S25 ×10, PK-S27 ×6, PK-S17 ×6, PK-S11 ×3, PK-S19 ×3, PK-S26 ×3, PK-S10 ×1, PK-S13 ×1 | **Mâu thuẫn**: đội mang troop mod X nhưng badge không phải binh chủng X, và nguồn không đánh dấu chuyển |

Trong lớp C, 10 hàng là `解煩衛` (PK-S25 ×4, PK-S27 ×2, PK-S28 ×4 — đúng các đội
"Hoàng Mã") và 32 hàng thuộc 6 troop mod khác (飛熊軍 14, 象兵 10, 陷陣營 8, 青州兵 4,
白毦兵 2, 白馬義從 1). **Đây là vấn đề dữ liệu nguồn, không phải vấn đề URL**: repo sao
chép trung thực badge của nguồn.

Ảnh hưởng tới công việc đổi URL: **không**, vì handle lấy từ tên đội, không từ binh chủng.
Nhưng `Loại binh` là một facet lọc của site, nên binh chủng sai ⇒ lọc sai. Cần một việc
sửa dữ liệu riêng (ledger hiệu chỉnh, hoặc báo nguồn), tách khỏi lần đổi URL này.

## 6. Khuyến nghị

1. Ngữ pháp `SC-S(tên đội)` theo **luật ba bậc** ở mục 5c: mặc định bỏ phần ngoặc, chỉ
   thêm token phân biệt ngắn nhất khi trùng (1338/1366 máy móc), 28 hàng còn lại gán tay
   trong ledger. Không dùng hash.
2. Dạng **phẳng** `/doi-chuan/pk-s28-hoang-ma/` — Google không phân biệt phẳng/phân cấp
   về xếp hạng, và phân cấp chỉ thắng nếu ship kèm trang mùa thật.
3. **Đóng băng handle trong ledger** (P1 bước 1–4). So sánh trực tiếp:

   | | Có ledger | Suy thẳng mỗi build |
   | --- | --- | --- |
   | Sửa `displayNameVi` | URL đứng yên | **URL cũ chết** |
   | Tên URL tách khỏi tên hiển thị | được — `routeHandle` ngắn/đúng từ khoá trong khi `displayNameVi` vẫn dài | không |
   | Chi phí | 827 dòng thêm 1 field (auto-fill) + 16 hàng gán tay | 0 |
   | Crawl lại publication | không | không |

   Đối chứng: `pipeline/recommended-missing-translations.json` hiện báo
   `{"team": {"missingNames": 0}, "total": 0}` — bản dịch **đã phủ hết**, nên ledger là
   **bảo hiểm**, không phải việc gấp. Nhưng chính yêu cầu đang đặt ra (rút ngắn tên đội)
   là tình huống làm chết URL, và lợi ích thứ hai — cho phép URL đặt tên theo từ khoá
   tách khỏi nhãn hiển thị — chỉ có được nếu có ledger.
4. Đội khác: `S(nickname || name)`, 14 nhóm trùng gán tay trong ledger.
5. **Gộp kèm** (đã chốt): `canonical` + `og:url` + `og:type=article` + `robots.txt` +
   sitemap 1532 URL (mục 3b).

## 6b. Cách xử lý đề xuất

Ba việc tách biệt, ba cách xử lý khác nhau — không gộp.

### Lớp A — 38 hàng thiếu `unitTypesRaw`

Nguyên nhân đã xác minh: trang nguồn **không render hàng badge nào** (không phải lỗi
selector của repo). `yxms042.html` chứa **0** chuỗi `"#"`; trang `s26-huangma-qun` chứa
`"children":["#","槍"]`. Cả hàng `flex flex-wrap gap-1.5` đều vắng trên trang thiếu.

| Lựa chọn | Nội dung | Giá |
| --- | --- | --- |
| **A1 (khuyến nghị)** | Suy từ troop mod khi badge vắng, ghi `unitTypesSource: "derived-from-troop-mod"` | Bất biến đúng 100% trên 8/15 troop mod; 38 hàng này không hàng nào có dấu `轉` nên suy là an toàn. Cần record provenance để không lẫn với tuyên bố nguồn |
| A2 | Báo nguồn, để trống | Trung thành, nhưng 38 hàng không lọc được theo "Loại binh" |
| A3 | Sửa selector của crawler | **Không áp dụng** — hàng badge vắng thật trên trang |

### Lớp C — 42 hàng lệch binh chủng

Không tự động sửa được: `轉` không đánh dấu vẫn là khả năng, nên suy luận phải do người
xác nhận. Luật điền mặc định đề xuất: lấy `troopLimit` của troop mod, **trừ** các hàng có
dấu `轉` / `#兵種改造` (3 hàng OG đang đúng, không được "sửa").

| Lựa chọn | Nội dung | Giá |
| --- | --- | --- |
| C1 | **Báo nguồn** kèm danh sách 42 hàng và bằng chứng (badge X + troop mod Y `troopLimit` Z) | Nguồn sở hữu badge; chi phí thấp; không kiểm soát được thời điểm |
| C2 | **Ledger hiệu chỉnh** trong `pipeline/`, khoá `sourceConfigId`, có `evidenceRef` + `reviewStatus` | Đúng kiến trúc repo (đã có pattern tương tự); 42 hàng review được; nhưng phải đi vào publication |
| C3 | Để nguyên | Trung thành nguồn; facet "Loại binh" sai 3% |

Khuyến nghị: **C1 + C2**, với C3 là trạng thái tạm.

### Ràng buộc chung: cả A và C đều phải đi vào publication

`unitTypesRaw` được phân loại **`canonical`** trong `pipeline/site_localization.py`
(bắt buộc khớp glossary đã duyệt), nên **không được** vá ở tầng hiển thị. Sửa phải nằm
trong generation ⇒ cần **crawl lại** (`crawl_sgsdeck_recommended.py --all-source-scopes`),
vì `.cache/` đang trống.

Hệ quả: A và C thuộc một **lần crawl/publication kế tiếp**, không phải lần đổi URL này.

### Thứ tự đề xuất

1. **Lần này — đổi URL + slug freeze + SEO meta.** Độc lập hoàn toàn với dữ liệu binh
   chủng; ledger slug là file build-time nên **không cần crawl**.
2. **Lần riêng — sửa dữ liệu binh chủng.** Ledger hiệu chỉnh + bù coverage + báo nguồn,
   gắn vào lần crawl tới.

Nếu người dùng định crawl lại sớm thì có thể gộp: một generation mang cả `routeSlug`
(phương án P2) và `unitTypesRaw` đã hiệu chỉnh — một lần sinh, nhưng lần đổi URL sẽ bị
chặn cho tới khi crawl xong.

### Đã chốt với người dùng

| Quyết định | Kết quả |
| --- | --- |
| Thứ tự | **Hai đợt** — URL trước, dữ liệu binh chủng sau |
| Lớp C | **Ledger hiệu chỉnh + báo nguồn** cho 42 hàng |
| 6 nhóm trùng cấu hình | Giữ cả hai URL (1366 trang); câu hỏi gộp thuộc đợt 2 vì là câu hỏi dữ liệu |

Kế hoạch triển khai đợt 1: [`plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet/plan.md`](../../260918-0144-doi-url-doi-chuan-slug-tieng-viet/plan.md).




## 7. Đã chốt

| Quyết định | Kết quả |
| --- | --- |
| Segment đường dẫn | `/doi-chuan/` + `/doi-khac/` |
| URL cũ | cutover sạch, không redirect |
| Hình dạng | **phẳng** `/{bảng}/{mùa}-{tên đội}/` |
| Nội dung handle | **tên đội**, bỏ ngoặc mặc định; tag theo phe (luật 5d) |
| Handle khác nhãn hiển thị | **được phép** — ledger là nơi review tên URL |
| Đóng băng | **có** — thêm `routeHandle` vào ledger |
| Phạm vi | cả hai họ route trong cùng lần |
| Gộp kèm | `canonical` + `og:url` + `og:type=article` + `robots.txt` + sitemap |

**Còn mở:**

1. 6 nhóm trùng cấu hình ở mục 5d — giữ cả hai URL (1366 trang) hay gộp (bớt 6 trang Đội
   chuẩn). Việc này đổi inventory nên phải chốt trước khi lập kế hoạch.
2. **42 hàng lệch binh chủng** (mục 5f, lớp C) — `unitTypesRaw` mâu thuẫn với troop mod và
   nguồn không đánh dấu chuyển. Ảnh hưởng facet lọc "Loại binh", **không** ảnh hưởng URL.
   Đề xuất: tách thành việc sửa dữ liệu riêng + báo nguồn, không gộp vào lần đổi URL này.
3. **38 hàng thiếu `unitTypesRaw`** (mục 5f, lớp A; PK-S26 ×37 + OG ×1) — lỗ hổng thu thập
   badge, cũng tách riêng.

URL mục tiêu:

```
/doi-chuan/og-40y-lu-bo-cung-vuong-di/
/doi-chuan/pk-s24-tu-ma-phi-hung/
/doi-chuan/pk-s28-tam-ti-ky-lan/
/doi-chuan/pk-s28-hoang-ma/            (phe Quần, T0, 113)
/doi-chuan/pk-s28-hoang-ma-hon-hop/    (phe Hỗn hợp, T0, 113)
/doi-khac/hoang-ma-thuong/
```

Việc còn lại trước khi lập kế hoạch: chốt mục "Còn mở" ở trên. Sẵn sàng chuyển sang
`ak-plan` sau đó.
