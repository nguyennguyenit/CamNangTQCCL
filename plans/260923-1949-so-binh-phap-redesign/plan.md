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

- **Chặn bởi** plan `260922-1806-khai-hoang-trang-chi-tiet` đang cook (31 file chưa commit, trùng `css/styles.css`, `js/app.js`, `js/render.js`, `src/pages/index.astro`, `src/layouts/SiteLayout.astro`, `pipeline/site-localization-policy.json`). Chỉ bắt đầu Phase 1 khi plan đó đã commit xong và `git status --short` không còn file của nó.
- Phase 1 đọc lại mọi file nó sửa sau khi plan Khai hoang land; số dòng trích dẫn dưới đây lấy từ cây làm việc ngày 2026-09-24 và có thể lệch.

## Bằng chứng hiện trạng

- **Shell trùng lặp:** `src/pages/index.astro:14-27,29-55,73-75` tự viết head/header/footer; `src/layouts/SiteLayout.astro:52-65,68-96,106-108` viết lại lần nữa, có nhánh `pageKind: root` riêng (`:5-14,25-41,84-93`).
- **SPA theo hash:** 8 mục `team-chuan, team-khac, coexist, khaihoang, lookup, recruit-tracker, analyze, roster-recommend`, mặc định `team-chuan` (`js/app.js:36,57`); alias `team-pk`, `meta-cu` → `team-khac` (`js/app.js:58,84-98`); `#heroes`, `#tactics`, `#lookup?group=&id=` (`js/unified-lookup.js:27-45,129-131`). `app.js` import tĩnh mọi module, mount cả 8 mục (`js/app.js:1-23,424-486`).
- **Link trỏ `/#…`:** `SiteLayout.astro:75,91`, `src/pages/404.astro:16-18`, `src/pages/doi-khac/[team].astro:36`, `src/pages/khai-hoang/[team].astro:31`, `familyReturnHref` (`js/team-detail-navigation.js:149-162`), `safeReturnUrl` chỉ nhận pathname `/` (`js/team-detail-navigation.js:7,121-146`).
- **CSS:** một file `css/styles.css` 921 dòng; token ở `:root` và `:root[data-theme="dark"]` (`:2-51`); 39 mã hex nằm ngoài khối token. Chưa có `@font-face`, font hệ thống.
- **Asset:** manifest chỉ nhận `js/css/data` (`src/lib/public-artifact-manifest.mjs:1-53`); file `public/` phải khai báo trong verifier (`scripts/verify-astro-dist.mjs:16-19,61-89`) và `_headers` + test (`tests-js/pages-headers-contract.test.mjs:8-19,75-93`).
- **Theme:** khóa `theme`; không có giá trị lưu → theo `prefers-color-scheme` (`js/site-chrome.js:5-13,28-38`). Brainstorm §5 #5 ghi "mặc định sáng" là không chính xác; plan **giữ hành vi hiện tại**.
- **Bản dịch:** policy khóa sha256 của 36 file nguồn, lệch → `stale`, chặn `check` (`pipeline/site_localization.py:605-615,1858-1861`); không có lệnh làm mới hash — sửa trường `sourceFiles` bằng `sha256_hex()` (`:341-342,493-499`). Chữ UI phải khai báo trong `UI_LITERAL_OBLIGATIONS` (`:267-338`); chỉ lớp `translate` cần receipt người duyệt độc lập (`draftSession != reviewerSession`, `:1095-1100`); lớp `authored-vi` không cần receipt (`:1333-1368`). Đúng 8 section id (`:52-60,524-527`) và đúng 3 route family (`:62,527-530`).
- **Test bám cấu trúc cũ:** tab/hash ở `tests-e2e/spa-parity.spec.mjs:121-125,163-220,477-495`, `unified-lookup.spec.mjs:13-69,102-115`, `recommended-browser.spec.mjs:18-69,407-444`, `season-lookup.spec.mjs:23-49`, `team-detail-pages.spec.mjs:288-289,312-385`, `khaihoang-options.spec.mjs:50-51,135-137,392-394`, `mcp-domain-compatibility.spec.mjs:10-13,72-80`, `site-localization.spec.mjs:59-71`; class bị test bắt liệt kê ở Phase 1.

## Quyết định kỹ thuật

1. **Mục = trang tĩnh.** 8 trang `src/pages/<đường-dẫn>/index.astro` dùng `SiteLayout` với `pageKind="section"` + `activeSection`; mỗi trang chỉ có một mount `section-<id>`. Layout gắn `data-section` lên `<body>`; `js/app.js` đọc giá trị này và chỉ khởi động mục đó (bỏ tab, `hashchange`, `switchSection`). Hiện `app.js` tải **mọi** dữ liệu lúc khởi động (`js/app.js:154-196`: website display, teams/coexist/khaihoang, bộ Tra cứu, season model, Recommended); chia trang mà giữ nguyên thì mỗi lần chuyển mục tải lại toàn bộ → Phase 2 phải chỉ tải dữ liệu mục đang mở cần (bảng phụ thuộc mục → dữ liệu lập từ code, không đoán).
2. **Trạng thái trên query, giữ tên khóa cũ:** bộ lọc đội giữ `season, category, q, detail, legacyTeam, legacyVariant, faction, unit, subcategory, source`; bỏ `score`; thêm `view=bang`. Tra cứu chuyển `group`, `id` từ hash sang query của `/tra-cuu/`.
3. **Landing `/`** = `src/pages/index.astro` dùng `SiteLayout` `pageKind="landing"` + entry `js/landing.js`: đọc hash cũ, `location.replace` sang đường dẫn mới, giữ query; hash lạ → ở lại Landing. Bảng ánh xạ ở Phase 2.
4. **Điều hướng dùng chung:** entry mới `js/site-nav.js` lo menu thả (Công cụ, Game; Landing thêm Đội hình, Tra cứu) và menu mobile toàn màn hình; thay hẳn `js/mobile-section-menu.js` (xóa file + test cũ, không để alias).
5. **CSS một file.** Giữ `css/styles.css` (không tách): khối token → nền → component → theo trang. Không có mã hex ngoài khối token. Tránh thêm manifest/verifier cho file CSS mới (`tests-js/astro-dist-contract.test.mjs:609-612` đang khóa `/css/styles.css`).
6. **Font self-host** trong `public/fonts/`: Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700, chỉ subset latin + latin-ext + vietnamese, `font-display: swap`, preload 2 file dùng ngay màn đầu; kèm `public/fonts/OFL.txt`. Ấn 兵 là SVG path (trích từ Noto Serif TC Bold một lần); chữ Hán thay chân dung dùng serif hệ thống.
7. **Chữ UI:** chữ tác giả mới (Landing, nhãn menu, footer) khai báo lớp `authored-vi`; chỉ chuỗi lớp `translate` bị đổi mới cần receipt độc lập (người dùng sắp xếp phiên review, agent không tự duyệt).
8. **Quyết định nội dung đã chốt 2026-09-24:** thẻ Khai hoang giữ build + Trước → Sau + thanh điểm 6 mốc, hướng dẫn chữ ở trang chi tiết, dòng cuối thẻ là link "Hướng dẫn đánh đất →"; ô tổng quan Cùng Tồn hiện nguyên `notesRaw`/`openingSuggestionsRaw`, "5 đội · 15 tướng · không trùng" tính từ mảng tướng; ngày cập nhật = ngày build (dd/mm/yyyy, giờ Việt Nam), mục "Góp ý, báo lỗi" ẩn đến khi có kênh; credit sửa thành "dành cho game".
9. **Thẻ đội:** dòng cuối gộp "Sợ …" (lấy từ counters `avoid`), "Thay thế (n)", "Chi tiết →"; "Khắc được" chỉ còn ở trang chi tiết; bỏ glyph ⚔/⚠.

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
| 9 | [3 công cụ Beta](./phase-09-cong-cu-beta.md) | Recruit, Analyze, Roster (+Mobile) | 3 |
| 10 | [Giao diện tối, a11y, responsive, docs, full test](./phase-10-toi-a11y-docs.md) | StyleGuide (bảng tối) | 1–9 |

Một người thực thi tuần tự 1 → 10. Phase 4, 5, 7, 9 cùng phụ thuộc Phase 3 nhưng đều sửa `css/styles.css` và `pipeline/site-localization-policy.json` → không chạy song song.

## Acceptance (theo brainstorm §4)

- [ ] A1: Mỗi artboard có báo cáo so ảnh 1440/390, mọi chỗ lệch đã xử lý hoặc có lý do.
- [ ] A2: `npm run check`, `npm run build`, `npm run verify`, `npm run test:node`, `npm run test:e2e`, `python3 -m unittest discover -s tests` pass; test chỉ đổi khi hành vi đổi có chủ đích.
- [ ] A3: `site_localization check --stage public` pass, không problem; số obligation mới được ghi trong báo cáo Phase 10.
- [ ] A4: Giao diện tối: chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1; màu phe/binh/trạng thái luôn có chữ đi kèm.
- [ ] A5: Mobile vùng bấm ≥ 44px, không cuộn ngang ở 320/390; focus-visible rõ; menu thả và hộp thoại: `aria-expanded`, Escape đóng, focus quay về nút, bấm ngoài để đóng, hộp thoại khóa focus.
- [ ] A6: Mọi hash cũ (§ bảng Phase 2) chuyển đúng đường dẫn mới, giữ query; URL chi tiết đội không đổi.
- [ ] A7: `docs/design-guidelines.md`, `docs/code-standards.md` mô tả đúng mô hình đường dẫn + token mới.

## Rủi ro

- Policy bản dịch là JSON một dòng: sửa hash bằng script Python gọi `sha256_hex()`, không sửa tay.
- Snapshot quay lại cũ trong `sessionStorage` chứa URL `/#…` → `safeReturnUrl` mới từ chối, người dùng về trang mục mặc định; chấp nhận, không viết lớp tương thích.
- Dev server giữ snapshot pin trong bộ nhớ (`src/lib/root-static-artifacts.ts`): sau publish phải khởi động lại.
- Ảnh chân dung hotlink có thể bị chặn → fallback chữ Hán phải test bằng route chặn ảnh.
- Thẻ/Bảng với dữ liệu Đội khác: `value` vắng trong `other-teams.json` → cột Điểm hiện "—", không bịa.
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
| 5 | `pageKind` mặc định `'root'` + `isRoot`; `legacyRouteSegments` chỉ nạp cho `detail` | Medium | `src/layouts/SiteLayout.astro:19,42-48` | Phase 2 bước 1 |
| 6 | Thanh điểm Khai hoang nằm trong `guide.ratings`, chỉ 11/17 đội có | Medium | `data/khaihoang.json:188` (11 lần `ratings`) | Phase 8 bước 3 |

Đã kiểm, không thành finding: nội dung thô Cùng Tồn đi qua `el()` gán text (`js/render.js:1`), `innerHTML` trong Tra cứu chỉ là chuỗi tĩnh (`js/unified-lookup.js:175,242,252`); chuyển tiếp hash ở Landing dùng bảng cố định nên không mở open redirect; `group` của Cùng Tồn và Tra cứu ở hai trang khác nhau nên không đụng nhau.

### Whole-Plan Consistency Sweep
- Đã đọc lại: plan.md, phase-01 … phase-10.
- Thay đổi quyết định đã rà: 6 (tải dữ liệu theo mục, context key Khai hoang theo đường dẫn, parser query, consumer menu mobile, `pageKind` bắt buộc, nguồn `ratings`).
- Chỗ cũ đã sửa theo: 6. Mâu thuẫn còn lại: 0.

## Validation Log

### Verification Results
- **Tier:** Full (10 phase), chạy phần Fact Checker + Contract Verifier trên các claim chịu lực.
- **Claims checked:** 24 — **Verified:** 24 | **Failed:** 0 sau khi sửa (2 claim sai ban đầu: consumer `mobile-section-menu`, "không tăng tải").
- Quyết định người dùng đã chốt trước khi viết plan (2026-09-24): thẻ Khai hoang = build + thanh điểm, hướng dẫn ở chi tiết; tổng quan Cùng Tồn hiện nguyên văn gốc; ngày build + ẩn "Góp ý"; "dành cho game".
- `ak plan validate` → `valid: true`.

## Handoff

Sau khi plan `260922-1806-khai-hoang-trang-chi-tiet` land (và nên chạy lại red-team độc lập): `/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260923-1949-so-binh-phap-redesign/plan.md`. Không tự bắt đầu code từ phiên lập plan.

<!-- slug: so-binh-phap-redesign -->
