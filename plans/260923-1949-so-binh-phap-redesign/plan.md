---
title: "Redesign Sổ binh pháp toàn site"
description: "Đưa toàn bộ Cẩm Nang TQCCL sang giao diện Sổ binh pháp đúng canvas: Landing ở /, mỗi mục một đường dẫn, header/footer dùng chung, token sáng/tối, font self-host."
status: pending
priority: P1
effort: ""
branch: main
tags: [frontend, feature, routing, design]
blockedBy: [260922-1806-khai-hoang-trang-chi-tiet]
blocks: []
created: 2026-09-24
---

# Redesign Sổ binh pháp toàn site

## Contract

Nguồn chuẩn: [brainstorm-260923-2001-so-binh-phap-redesign.md](../reports/brainstorm-260923-2001-so-binh-phap-redesign.md) — Outcome §1, Constraints §2 + §10.3, Non-goals §3, Acceptance §4, quyết định §5/§6/§10.2/§10.7, rà design §11. Plan không lặp lại toàn văn; mỗi phase ghi rõ mục contract nó thực hiện.

- **Outcome:** mọi trang (Landing, 8 trang mục, chi tiết đội, 404) mang giao diện Sổ binh pháp đúng canvas ở 1440 và 390, sáng + tối.
- **Chuẩn thị giác:** mã nguồn `docs/design/so-binh-phap/project/*.dc.html` (giá trị) + ảnh `docs/design/so-binh-phap/screens/*.png` (bố cục). Chỗ artboard trái contract → contract thắng theo bảng brainstorm §11.4.
- **Không làm:** tính năng ngoài canvas (trừ Thẻ/Bảng), đổi dữ liệu/engine/Worker/schema lưu trữ, self-host ảnh chân dung, đổi 5 tên "…cảm tử", đổi URL chi tiết đội đã đóng băng, implement artboard DirA/B/C, deploy.

## Điều kiện bắt đầu

- **Chặn bởi** plan `260922-1806-khai-hoang-trang-chi-tiet` — **đã gỡ 2026-09-24:** plan đó `status: completed`, code ở commit `68a49b3`; kiểm trên cây sau commit: `npm run check` 0 lỗi, `npm run test:node` 316/316, `python3 -m unittest discover -s tests` 368 OK, `npm run test:e2e` 153/153, `npm run verify` (gate bản dịch public + 1700 file dist) và `npm run test:dist` 27/27 pass.
- Trước khi bắt đầu Phase 1, `git status --short` không được còn file code/pipeline đang sửa dở. Còn lại lúc lập plan (không thuộc plan này): 8 thư mục generation Recommended chưa track, không file nào tham chiếu (`src/data/recommended-reference/{3415d2…,42523b…,478006…,5e55b9…,820180…,b0f897…,bd8ff3…,f57c82…}`, tạo 22–23/09), `site-compile.log` (23/09), đổi trạng thái plan `260626-1600` sang `cancelled`, 1 dòng đầu brainstorm — chủ nhân quyết giữ/xóa.
- Phase 1 đọc lại mọi file nó sửa; số dòng trích dẫn lấy từ cây làm việc ngày 2026-09-24.

## Bằng chứng hiện trạng

- **Shell trùng lặp:** `src/pages/index.astro:14-27,29-55,73-75` tự viết head/header/footer; `src/layouts/SiteLayout.astro:52-65,68-96,106-108` viết lại lần nữa, có nhánh `pageKind: root` riêng (`:5-14,25-41,84-93`).
- **SPA theo hash:** 8 mục `team-chuan, team-khac, coexist, khaihoang, lookup, recruit-tracker, analyze, roster-recommend`, mặc định `team-chuan` (`js/app.js:36,57`); alias `team-pk`, `meta-cu` → `team-khac` (`js/app.js:58,84-98`); `#heroes`, `#tactics`, `#lookup?group=&id=` (`js/unified-lookup.js:27-45,129-131`). `app.js` import tĩnh mọi module, mount cả 8 mục (`js/app.js:1-23,424-486`).
- **Link trỏ `/#…`:** `SiteLayout.astro:75,91`, `src/pages/404.astro:16-18`, `src/pages/doi-khac/[team].astro:36`, `src/pages/khai-hoang/[team].astro:31`, `familyReturnHref` (`js/team-detail-navigation.js:149-162`), `safeReturnUrl` chỉ nhận pathname `/` (`js/team-detail-navigation.js:7,121-146`).
- **CSS:** một file `css/styles.css` 921 dòng; token ở `:root` và `:root[data-theme="dark"]` (`:2-51`); 39 mã hex nằm ngoài khối token. Chưa có `@font-face`, font hệ thống.
- **Asset:** manifest chỉ nhận `js/css/data` (`src/lib/public-artifact-manifest.mjs:1-53`); file `public/` phải khai báo trong verifier (`scripts/verify-astro-dist.mjs:16-19,61-89`) và `_headers` + test (`tests-js/pages-headers-contract.test.mjs:8-19,75-93`).
- **Theme:** khóa `theme`; không có giá trị lưu → theo `prefers-color-scheme` (`js/site-chrome.js:5-13,28-38`). Brainstorm §5 #5 ghi "mặc định sáng" là không chính xác; plan **giữ hành vi hiện tại**.
- **Bản dịch:** policy khóa sha256 của 36 file nguồn, lệch → `stale`, chặn `check` (`pipeline/site_localization.py:605-615,1858-1861`); không có lệnh làm mới hash — sửa trường `sourceFiles` bằng `sha256_hex()` (`:341-342,493-499`). Chữ UI phải khai báo trong `UI_LITERAL_OBLIGATIONS` (`:267-338`); chỉ lớp `translate` cần receipt người duyệt độc lập (`draftSession != reviewerSession`, `:1095-1100`); lớp `authored-vi` không cần receipt (`:1333-1368`). Đúng 8 section id (`:52-60,524-527`) và đúng 3 route family (`:62,527-530`).
- **Test bám cấu trúc cũ:** tab/hash ở `tests-e2e/spa-parity.spec.mjs:121-125,163-220,477-495`, `unified-lookup.spec.mjs:13-69,102-115`, `recommended-browser.spec.mjs:18-69,407-444`, `season-lookup.spec.mjs:23-49`, `team-detail-pages.spec.mjs:288-289,312-385`, `khaihoang-options.spec.mjs:50-51,135-137,392-394`, `mcp-domain-compatibility.spec.mjs:10-13,72-80`, `site-localization.spec.mjs:59-71`; class bị test bắt liệt kê ở Phase 1.
- **Trang `/` đang mang payload và phần tử mà `app.js` bắt buộc có:** `#season-controls` (`index.astro:61`, `app.js:211` gọi `.after` không kiểm null), `#season-artifact-hashes` (`:77`, thiếu → `seasonModel` rỗng im lặng, `app.js:188`), `#team-route-handles` đủ `{r,l,k}` (`:78`, ≈70 KB); `SiteLayout` chỉ phát `{l}` cho trang chi tiết (`SiteLayout.astro:46-48,112-114`).
- **Fetch dữ liệu tương đối:** `app.js:146,184,193` dùng `./data/…` — đúng ở `/`, 404 ở `/doi-chuan/`; trang chi tiết đã dùng `/data/…` (`team-detail.js:74`, `khaihoang-detail.js:29`).
- **Migrate URL tham chiếu cũ:** `?detail=` / `?legacyTeam=` trên mọi tab được `migrateLegacyReferenceUrl` chuyển sang trang chi tiết, `config` thắng (`app.js:199-203`, `team-detail-navigation.js:371-392`); cần `recommendedModel.index` và `teams.json`.
- **Phạm vi mùa + chi tiết cấu hình:** select Mùa / Phiên bản luật (`scenario`, `ruleset`) ở Cùng Tồn, Soi đội, Gợi ý đội (`app.js:100-115,395-422`); chi tiết `?config=` trong `#season-detail-mount` trên 5 mục (`app.js:210-260`); nút nhập kho gọi `switchSection('roster-recommend')` (`app.js:258`, `render.js:569`). Không có artboard; `season-lookup.spec.mjs` bắt hơn 10 ca.
- **Allowlist URL quay lại:** `safeReturnUrl` loại **cả URL** khi có khóa ngoài `ROOT_QUERY_KEYS` (`team-detail-navigation.js:14,140-143`).

## Quyết định kỹ thuật

1. **Mục = trang tĩnh.** 8 trang `src/pages/<đường-dẫn>/index.astro` dùng `SiteLayout` với `pageKind="section"` + `activeSection`; mỗi trang chỉ có một mount `section-<id>`. Layout gắn `data-section` lên `<body>`; `js/app.js` đọc giá trị này và chỉ khởi động mục đó (bỏ tab, `hashchange`, `switchSection`). Hiện `app.js` tải **mọi** dữ liệu lúc khởi động (`js/app.js:154-196`: website display, teams/coexist/khaihoang, bộ Tra cứu, season model, Recommended); chia trang mà giữ nguyên thì mỗi lần chuyển mục tải lại toàn bộ → Phase 2 phải chỉ tải dữ liệu mục đang mở cần (bảng phụ thuộc mục → dữ liệu lập từ code, không đoán).
2. **Trạng thái trên query, giữ tên khóa cũ:** bộ lọc đội giữ `season, category, q, detail, legacyTeam, legacyVariant, faction, unit, subcategory, source`; bỏ `score`; thêm `view=bang`. Tra cứu chuyển `group`, `id` từ hash sang query của `/tra-cuu/`. `ROOT_QUERY_KEYS` thêm `view`; `score` chuyển sang nhóm khóa bị bỏ lặng lẽ để `from` cũ vẫn dùng được (Phase 5).
3. **Landing `/`** = `src/pages/index.astro` dùng `SiteLayout` `pageKind="landing"` + entry `js/landing.js`: đọc hash cũ, `location.replace` sang đường dẫn mới, giữ query; hash lạ → ở lại Landing. Bảng ánh xạ ở Phase 2.
4. **Điều hướng dùng chung:** entry mới `js/site-nav.js` lo menu thả (Công cụ, Game; Landing thêm Đội hình, Tra cứu) và menu mobile toàn màn hình; thay hẳn `js/mobile-section-menu.js` (xóa file + test cũ, không để alias).
5. **CSS một file.** Giữ `css/styles.css` (không tách): khối token → nền → component → theo trang. Không có mã hex ngoài khối token. Tránh thêm manifest/verifier cho file CSS mới (`tests-js/astro-dist-contract.test.mjs:609-612` đang khóa `/css/styles.css`).
6. **Font self-host** trong `public/fonts/`: Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700, chỉ subset latin + latin-ext + vietnamese, `font-display: swap`, preload 2 file dùng ngay màn đầu; kèm `public/fonts/OFL.txt`. Ấn 兵 là SVG path (trích từ Noto Serif TC Bold một lần); chữ Hán thay chân dung dùng serif hệ thống.
7. **Chữ UI:** chữ tác giả mới (Landing, nhãn menu, footer) khai báo lớp `authored-vi`; chỉ chuỗi lớp `translate` bị đổi mới cần receipt độc lập (người dùng sắp xếp phiên review, agent không tự duyệt).
8. **Quyết định nội dung đã chốt 2026-09-24:** thẻ Khai hoang giữ build + Trước → Sau + thanh điểm 6 mốc, hướng dẫn chữ ở trang chi tiết, dòng cuối thẻ là link "Hướng dẫn đánh đất →"; ô tổng quan Cùng Tồn hiện nguyên `notesRaw`/`openingSuggestionsRaw`, "5 đội · 15 tướng · không trùng" tính từ mảng tướng; ngày cập nhật = ngày build (dd/mm/yyyy, giờ Việt Nam), mục "Góp ý, báo lỗi" ẩn đến khi có kênh; credit sửa thành "dành cho game".
9. **Thẻ đội:** dòng cuối gộp "Sợ …" (lấy từ counters `avoid`), "Thay thế (n)", "Chi tiết →"; "Khắc được" chỉ còn ở trang chi tiết; bỏ glyph ⚔/⚠.
10. **Trang mục tự đủ:** layout phát cho trang mục mọi payload `app.js` đọc (bảng ở Phase 2 bước 2, `{r,l,k}` cho cả 8 trang); `app.js` fetch `/data/…` tuyệt đối; lỗi tải hiện ở mount của mục đang mở.
11. **Giữ phạm vi mùa, chi tiết cấu hình và migrate URL cũ** — không bỏ tính năng đang có dù canvas không vẽ. Phase 2 giữ hành vi; Phase 8 (Cùng Tồn) và Phase 9 (Soi đội, Gợi ý đội) làm giao diện theo StyleGuide. URL `/` không hash nhưng có khóa root cũ → `/doi-chuan/` + query (mục mặc định cũ).
12. **"Trong cẩm nang" (Phase 7) nối tướng bằng so khớp chính xác** `nameRaw` ↔ `chinese`/`aliases[]` của catalog Tra cứu (bỏ khoảng trắng); đo trên generation đang pin: 4071/4098 ô khớp, 0 mơ hồ.

## Quy trình bắt buộc mỗi phase

1. Đọc artboard của phase (mã nguồn + PNG) trước khi viết CSS; lấy giá trị qua token, không chép inline style.
2. Sửa file khóa hash → rà `UI_LITERAL_OBLIGATIONS` cho chữ đổi/thêm → cập nhật `sourceFiles` bằng hash thật → `python3 -m pipeline.site_localization check --root . --stage public`. Chuỗi `translate` đổi → dừng, ghi danh sách vào báo cáo phase, chờ receipt độc lập.
3. Chạy test đích của phase (ghi trong phase), không sửa test để né; test đổi có chủ đích phải ghi lý do trong commit.
4. Báo cáo so ảnh `plans/260923-1949-so-binh-phap-redesign/reports/visual-phase-NN.md`: chạy `node scripts/design-compare.mjs --phase NN` (tạo ở Phase 1), liệt kê từng chỗ lệch → "đã sửa" hoặc "giữ, lý do". Ảnh ghép ở `.cache/design-compare/` (không commit).
5. Commit riêng mỗi phase, conventional, không nhắc AI. Không deploy.

## Phases

| # | Phase | Artboard | Phụ thuộc |
|---|---|---|---|
| 1 | [Token, font, component nền, công cụ so ảnh](./phase-01-token-font-nen.md) | StyleGuide | — |
| 2 | [Tách đường dẫn + layout chung](./phase-02-duong-dan-layout.md) | — (cấu trúc) | 1 |
| 3 | [Header, menu thả, menu mobile, footer](./phase-03-header-footer.md) | header mọi artboard, LandingMenu, LandingMenuMobile, footer Landing | 2 |
| 4 | [Landing + Tải game](./phase-04-landing.md) | Landing, LandingMobile | 3 |
| 5 | [Đội chuẩn / Đội khác: lọc, thẻ, Thẻ/Bảng](./phase-05-doi-danh-sach.md) | Main, MainTable, MobileList, MobileTable, MobileFilters | 3 |
| 6 | [Trang chi tiết đội](./phase-06-chi-tiet-doi.md) | TeamDetail | 5 |
| 7 | [Tra cứu + hồ sơ](./phase-07-tra-cuu.md) | Lookup, LookupTactics, LookupProfile, LookupMobile | 3 |
| 8 | [Cùng Tồn + Khai hoang](./phase-08-cung-ton-khai-hoang.md) | Coexist(+Mobile), Khaihoang(+Mobile) | 5 |
| 9 | [3 công cụ Beta](./phase-09-cong-cu-beta.md) | Recruit, Analyze, Roster (+Mobile) | 3, 8 (dùng lại style phạm vi mùa) |
| 10 | [Giao diện tối, a11y, responsive, docs, full test](./phase-10-toi-a11y-docs.md) | StyleGuide (bảng tối) | 1–9 |

Một người thực thi tuần tự 1 → 10. Phase 4, 5, 7 cùng phụ thuộc Phase 3, Phase 9 thêm Phase 8; tất cả đều sửa `css/styles.css` và `pipeline/site-localization-policy.json` → không chạy song song.

## Acceptance (theo brainstorm §4)

- [ ] A1: Mỗi artboard có báo cáo so ảnh 1440/390, mọi chỗ lệch đã xử lý hoặc có lý do.
- [ ] A2: `npm run check`, `npm run build`, `npm run verify`, `npm run test:node`, `npm run test:e2e`, `python3 -m unittest discover -s tests` pass; test chỉ đổi khi hành vi đổi có chủ đích.
- [ ] A3: `site_localization check --stage public` pass, không problem; số obligation mới được ghi trong báo cáo Phase 10.
- [ ] A4: Giao diện tối: chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1; màu phe/binh/trạng thái luôn có chữ đi kèm.
- [ ] A5: Mobile vùng bấm ≥ 44px, không cuộn ngang ở 320/390; focus-visible rõ; menu thả và hộp thoại: `aria-expanded`, Escape đóng, focus quay về nút, bấm ngoài để đóng, hộp thoại khóa focus.
- [ ] A6: Mọi hash cũ (§ bảng Phase 2) và URL `/` không hash có khóa root cũ chuyển đúng đường dẫn mới, giữ query; `?detail=` / `?legacyTeam=` cũ vẫn mở đúng trang chi tiết; URL chi tiết đội không đổi.
- [ ] A7: `docs/design-guidelines.md`, `docs/code-standards.md` mô tả đúng mô hình đường dẫn + token mới.

## Rủi ro

- Policy bản dịch là JSON một dòng: sửa hash bằng script Python gọi `sha256_hex()`, không sửa tay.
- Snapshot quay lại cũ trong `sessionStorage` chứa URL `/#…` → `safeReturnUrl` mới từ chối, người dùng về trang mục mặc định; chấp nhận, không viết lớp tương thích.
- Dev server giữ snapshot pin trong bộ nhớ (`src/lib/root-static-artifacts.ts`): sau publish phải khởi động lại.
- Ảnh chân dung hotlink có thể bị chặn → fallback chữ Hán phải test bằng route chặn ảnh, chặn **mọi** host có trong `heroes-dict.json` (`image.aligames.com` 92, `cloud.lingxigames.com` 20; 90 tướng không có ảnh).
- Thẻ/Bảng với dữ liệu Đội khác: `value` vắng trong `other-teams.json` (0/40) → cột Điểm hiện "—", không bịa.
- "Sợ …" / "Khắc được" chỉ có ở dữ liệu legacy: 0/1366 Đội chuẩn, 9/40 Đội khác → thẻ và trang chi tiết Đội chuẩn lệch artboard có chủ đích.
- Chiều cao artboard là ước tính (brainstorm §8): so bố cục và giá trị, không so pixel dọc.

## Red Team Review

### Session — 2026-09-24

4 reviewer (Security, Failure Mode, Assumption, Scope) đều lỗi 429 rate limit sau ~2 phút, không trả finding. Người lập plan tự rà các giả định chịu lực bằng grep; **chưa có review độc lập** — nên chạy lại `/ak:plan red-team plans/260923-1949-so-binh-phap-redesign` khi hết giới hạn, trước khi cook.

**Findings:** 6 (6 accepted, 0 rejected) · 0 Critical, 4 High, 2 Medium

| # | Finding | Severity | Bằng chứng | Áp vào |
|---|---|---|---|---|
| 1 | Chia trang nhưng `app.js` vẫn tải toàn bộ dữ liệu mỗi lần → mỗi lần chuyển mục tải lại tất cả; câu "không tăng tải" sai | High | `js/app.js:154-196` | Quyết định #1, Phase 2 bước 3b |
| 2 | `khaiHoangContextKey` và snapshot quay lại dựa vào hash `#khaihoang`; test ghim URL hash | High | `js/team-detail-navigation.js:174-182,287-305`; `tests-js/team-detail-navigation.test.mjs:163-215` | Phase 2 bước 7 |
| 3 | Parser Tra cứu từ chối mọi khóa lạ → link có `utm_*`/`fbclid` hiện lỗi khi chuyển sang query | High | `js/unified-lookup.js:34-36` | Phase 2 bước 4 |
| 4 | Consumer của `mobile-section-menu.js` là `site-chrome.js` + manifest, không phải `app.js` | High | `js/site-chrome.js:3`; `src/lib/public-artifact-manifest.mjs:34` | Phase 3 files |
| 5 | `pageKind` mặc định `'root'` + `isRoot`; `legacyRouteSegments` chỉ nạp cho `detail` | Medium | `src/layouts/SiteLayout.astro:19,42-48` | Phase 2 bước 1 (phần route handles đã thay bằng finding #7, 2026-09-25) |
| 6 | Thanh điểm Khai hoang nằm trong `guide.ratings`, chỉ 11/17 đội có | Medium | `data/khaihoang.json:188` (11 lần `ratings`) | Phase 8 bước 3 |

Đã kiểm, không thành finding: nội dung thô Cùng Tồn đi qua `el()` gán text (`js/render.js:1`), `innerHTML` trong Tra cứu chỉ là chuỗi tĩnh (`js/unified-lookup.js:175,242,252`); chuyển tiếp hash ở Landing dùng bảng cố định nên không mở open redirect; `group` của Cùng Tồn và Tra cứu ở hai trang khác nhau nên không đụng nhau.

### Whole-Plan Consistency Sweep
- Đã đọc lại: plan.md, phase-01 … phase-10.
- Thay đổi quyết định đã rà: 6 (tải dữ liệu theo mục, context key Khai hoang theo đường dẫn, parser query, consumer menu mobile, `pageKind` bắt buộc, nguồn `ratings`).
- Chỗ cũ đã sửa theo: 6. Mâu thuẫn còn lại: 0.

### Session — 2026-09-25

4 reviewer lại lỗi 429 (retry-after ≈ 2,6 giờ). Audit chạy trong phiên chính, đối chiếu từng claim chịu lực với code ở HEAD `d8873ea` và đo dữ liệu dist/generation đang pin. **Vẫn chưa có review độc lập.**

**Findings:** 10 (10 accepted, 0 rejected) · 1 Critical, 5 High, 4 Medium

| # | Finding | Severity | Bằng chứng | Áp vào |
|---|---|---|---|---|
| 7 | Trang mục thiếu `#season-controls` (crash boot), `#season-artifact-hashes` (mất mô hình mùa im lặng), route handles `{r,k}`; plan chỉ chuyển `index.astro:62-75` | Critical | `app.js:135,188,211,491`; `index.astro:61,77-80`; `SiteLayout.astro:46-48` | Quyết định #10, Phase 2 bước 1–2 |
| 8 | `app.js` fetch tương đối `./data/…` → 404 dưới `/<mục>/` | High | `app.js:146,184,193` | Quyết định #10, Phase 2 bước 3 |
| 9 | Bảng chuyển tiếp bỏ sót URL không hash (`/?season=`, `/?detail=`) và migrate `detail`/`legacyTeam` xung đột với tải theo mục | High | `app.js:98,199-203`; `team-detail-navigation.js:371-392`; `recommended-browser.spec.mjs:81-102` | Quyết định #11, Phase 2 bước 3, 3b, 6, 10; A6 |
| 10 | Phạm vi mùa, chi tiết `?config=`, nút nhập kho không phase nào sở hữu | High | `app.js:100-115,210-260,258`; `render.js:569`; `season-lookup.spec.mjs` | Quyết định #11, Phase 2 bước 3, Phase 8 bước 2b, Phase 9 bước 3b |
| 11 | `view` ngoài `ROOT_QUERY_KEYS` → mọi URL Bảng mất `from`/snapshot; `score` bị loại làm hỏng `from` cũ | High | `team-detail-navigation.js:14,140-143`; `team-detail-navigation.test.mjs:169` | Quyết định #2, Phase 5 bước 3b |
| 12 | Khóa nối "Trong cẩm nang" không tồn tại: `index.json` không có ID tướng, identity map không có ID Tra cứu và không publish | High | `index.json` heroes keys; `pipeline/recommended-identity-map.json` entries; `other-teams.json` `heroIdentityId` khác namespace | Quyết định #12, Phase 7 bước 4b |
| 13 | Test chặn ảnh chỉ chặn `cloud.lingxigames.com`, 92/112 ảnh ở `image.aligames.com` | Medium | `data/heroes-dict.json` `iconUrl` | Phase 7 Verification, Rủi ro |
| 14 | "Sợ …" gần như không có dữ liệu (0/1366 Đội chuẩn) | Medium | `recommended-reference-render.js:147-155,198-225` | Phase 5 bước 5, Phase 6 bước 2, Rủi ro |
| 15 | Ví dụ 3b sai (Chiêu mộ cần bộ Tra cứu); lỗi tải luôn ghi vào `#section-team-chuan`; `initSiteChrome` có thể bị gọi 2 lần | Medium | `app.js:60,179,481-496`; `spa-parity.spec.mjs:468-470` | Phase 2 bước 1, 3, 3b |
| 16 | Redesign Cùng Tồn làm rơi phân loại phạm vi, `summaryRaw`, link nguồn, `disclaimerRaw`; thứ tự nhóm xung đột phạm vi mùa | Medium | `team-filter-section.js:235-239`; `render.js:498,511-516` | Phase 8 bước 1, 2, Verification |

Đã kiểm, không thành finding: số liệu Landing đều tính được (1366/26 mùa, 166 `teams.json`, 202, 406, 5×5, 17, 8 Chạm Sứ, 5 mỏ); `guide.ratings` 11/17; `index.json` 3.374.425 byte; trường adapter Bảng tồn tại; gate UI obligation chấp nhận chữ gốc hoặc bản dịch đã duyệt (`site_localization.py:1241-1244`) và chỉ `translate` cần receipt (`:1355-1358`); credit mới đúng brainstorm §10.2; `public/_headers` không có CSP nên font self-host/ảnh hotlink không cần đổi header.

### Whole-Plan Consistency Sweep — 2026-09-25
- Đã đọc lại: plan.md, phase-01 … phase-10.
- Thay đổi quyết định đã rà: 6 (payload trang mục, fetch tuyệt đối, giữ phạm vi mùa/config/migrate, allowlist `view`/`score`, khóa nối tướng, độ phủ counters).
- Chỗ cũ đã sửa theo: Phase 2 bước 1–3b, 6, 7, 10, Verification; Phase 5 files, bước 3b, 5; Phase 6 bước 2; Phase 7 bước 4b, Verification; Phase 8 files, bước 1, 2, 2b, Verification; Phase 9 files, bước 3b, dependencies; Phase 10 docs; plan.md bằng chứng, quyết định #2/#10–#12, bảng phase, A6, rủi ro.
- Mâu thuẫn còn lại: 0.

## Validation Log

### Verification Results
- **Tier:** Full (10 phase), chạy phần Fact Checker + Contract Verifier trên các claim chịu lực.
- **Claims checked:** 24 — **Verified:** 24 | **Failed:** 0 sau khi sửa (2 claim sai ban đầu: consumer `mobile-section-menu`, "không tăng tải").
- Quyết định người dùng đã chốt trước khi viết plan (2026-09-24): thẻ Khai hoang = build + thanh điểm, hướng dẫn ở chi tiết; tổng quan Cùng Tồn hiện nguyên văn gốc; ngày build + ẩn "Góp ý"; "dành cho game".
- `ak plan validate` → `valid: true`.

## Handoff

Plan `260922-1806-khai-hoang-trang-chi-tiet` đã land (`68a49b3`). Red-team 2026-09-25 chạy trong phiên chính, chưa phải review độc lập — nếu muốn, chạy lại `/ak:plan red-team plans/260923-1949-so-binh-phap-redesign` khi hết giới hạn 429. Dọn cây làm việc theo "Điều kiện bắt đầu", rồi: `/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260923-1949-so-binh-phap-redesign/plan.md`. Không tự bắt đầu code từ phiên lập plan.

<!-- slug: so-binh-phap-redesign -->
