---
phase: 2
title: "Trang chi tiết riêng và lịch sử điều hướng"
status: completed
priority: P1
effort: ""
dependencies: [phase-01-data-contract]
---

# Phase 2 — Trang chi tiết riêng và lịch sử điều hướng

## Goal and start gate

Tạo URL riêng hoạt động trên static Astro, giữ đầy đủ cấu hình/nội dung cũ và không khởi tạo cả ứng dụng trên trang con. Phụ thuộc output đã Green của [phase 1](phase-01-data-contract.md).

**Fresh scout bắt buộc trước cook phase này:** đọc lại exports/callers thực tế của `js/app.js`, `js/recommended-reference-state.js`, `js/recommended-reference-render.js`, `src/pages/index.astro`, static artifact modules, dist verifier và các test điều hướng. Nếu có LSP, dùng references trước sửa exported API. Kiểm tra commit/worktree hiện tại; không dựa vào số dòng cũ để edit. Scout chỉ xác nhận/chỉnh file-level approach, không đổi product contract. Ghi thay đổi cần thiết vào plan trước source edit.

## Route and data contract

- Recommended: `/teams/recommended/<sourceConfigId>/` cho từng row trong selected generation.
- Legacy original: `/teams/legacy/<legacyTeamId>/` cho **toàn bộ 166 originals** trong snapshot hiện tại, không phụ thuộc admission.
- Admitted Team khác: cùng legacy route với `?variant=<legacyVariantId>`. Chỉ resolve nếu exact ID pair có trong published `other-teams`; một variant không xác minh được phải báo rõ, không âm thầm hiện original như thể đó là variant yêu cầu. Trang original không có variant luôn đọc được độc lập.
- ID lấy từ validated registry; không dùng tên người dùng/raw source làm filesystem path. Unknown route thật trả 404 nhờ top-level `404.html`, không dựa vào Cloudflare Pages SPA fallback hiện có; unknown variant trên route hợp lệ có trạng thái không tìm thấy và link tới original rõ ràng.
- `from` là query tùy chọn chứa root URL tương đối đã normalize; không ảnh hưởng danh tính đội. Chỉ cho same-origin pathname `/`, hash thuộc các tab hiện có và query keys được allowlist. Reject external/protocol-relative/script/encoded-path tricks; bỏ `detail`, `legacyTeam`, `legacyVariant`, `from` để tránh redirect loop. Không đưa roster hoặc nội dung nhập cá nhân vào URL.
- Link chia sẻ không cần `from`. Không có origin hợp lệ thì nút quay lại là link tới tab gia đình tương ứng; Recommended có season/category của row khi sẵn có. Không gọi `history.back()` dựa riêng vào `history.length`/referrer.

## Files and ownership

Các đường dẫn dưới root worktree trong [plan.md](plan.md).

Create:
- `src/lib/team-detail-routes.ts`: build-time catalog từ validated selected publication và raw legacy artifact; exact route inventory, ID uniqueness/path safety, metadata và root legacy bytes hash.
- `src/pages/teams/recommended/[sourceConfigId].astro`, `src/pages/teams/legacy/[legacyTeamId].astro`: `getStaticPaths`, prerender pages, validated escaped metadata/pins. Không SSR/adapter/catch-all route.
- `src/pages/404.astro`: static not-found page xuất đúng `404.html`, root-absolute links và chrome tối thiểu; không boot full app hoặc thêm catch-all router.
- `src/layouts/SiteLayout.astro`: chia sẻ head/header/nav/footer hiện hữu; không thêm framework hoặc hệ component riêng.
- `js/site-chrome.js`: phần theme/mobile menu đang có, dùng ở root và detail mà không tải gameplay data. Guard localStorage getter/getItem/setItem: đọc lỗi dùng system/default theme, ghi lỗi vẫn toggle được trong memory; không để storage chặn boot.
- `js/team-detail-navigation.js`: pure canonical href/return validation và snapshot helper dùng chung root/detail.
- `js/team-detail.js`: minimal detail entry; root-absolute imports/fetches, loading/error/retry state, DOM renderer hiện có.
- `tests-js/team-detail-navigation.test.mjs`, `tests-js/team-detail-routes.test.mjs`, `tests-e2e/team-detail-pages.spec.mjs`: chỉ test navigation/security/content behavior, không test source string/import wiring.

Modify:
- `src/pages/index.astro`, `js/app.js`: sử dụng shell/chrome chung; cut over `openReference` sang route navigation; giữ `openConfig` và mount gameplay inline.
- `js/recommended-reference-state.js`: dùng chung private manifest/payload verifier; thêm detail-only loader, không ép detail tải toàn bộ index. Root loader vẫn phục vụ các tab cũ.
- `js/recommended-reference-render.js`, `js/team-filter-section.js`: ngay phase này đổi title/CTA sang anchors cùng href và chuyển callback wiring; tái dùng holder/bond rendering; dedicated detail có sections đầy đủ và link quay lại, bỏ reference-only inline/article keyboard handler cũ. Không xóa helper gameplay ở `js/render.js`.
- `src/lib/public-artifact-manifest.mjs`, `src/lib/recommended-reference-artifacts.ts`, `scripts/verify-astro-dist.mjs`, `public/_headers`: cho phép đúng entry modules, metadata fields và **exact generated HTML paths** mới.
- Existing tests: `tests-js/recommended-reference-artifacts.test.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/frontend-shell-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs`, `tests-e2e/recommended-browser.spec.mjs`.
- Caller migration cụ thể: `js/app.js:onOpenTeam` phục vụ callback buttons trong `js/analyze.js:114-135` và `js/roster-recommend-ui.js:83-96`. Giữ nhánh configId → openConfig, đổi nhánh legacy sang dedicated original URL với return snapshot. Không dựa vào điều kiện “có dùng resolveTeamDestination”; helper này hiện không phải đường callback của hai consumer. Không rewrite unrelated analyzer/roster UI.

## Rendering and publication safety

Recommended detail dùng HTML pin → verified manifest → đúng scoped detail payload; không fetch `current.json` để chữa mismatch, không lấy score từ cấu hình khác. Build-time catalog reuse validated publication loader và yêu cầu `"sha256:" + sha256(raw teams bytes) == manifest.legacyTeamsHash`; old generation + newer raw originals phải fail build dù từng artifact riêng lẻ hợp lệ. Không viết verifier yếu hơn cạnh cái cũ.

Original legacy page chứa ID và hash của raw `/data/teams.json` bytes tại build, không cần Recommended manifest để tải/render original. Runtime kiểm tra bytes hash trước parse, tìm duy nhất ID; mismatch có lỗi rõ và reload option, không fallback sang bytes chưa xác minh. Variant có thể tải manifest + other-teams riêng, nhưng failure ở phần này không được chặn đường đọc original không có `variant`.

Không nhét raw JSON bằng `set:html`, không raw `innerHTML` cho names/notes/counters. Dùng attributes đã escape chỉ cho ID/pin và DOM `textContent` cho source text. Source URLs đi qua validator hiện có. Link ngoài có scheme phù hợp và `rel` khi mở tab mới.

Detail cần: title Việt + tên nguồn có ích, numeric score hoặc “Chưa có điểm nguồn”, ba holder và vai trò, đúng slot tactic/book, stat focus/cộng điểm, điều kiện, hero/team notes, alternatives đầy đủ theo nhóm cấu hình, good/avoid counters và diễn giải, nguồn/author/intro/mùa/category. Nội dung legacy được gắn đúng proof và nhãn nguồn, không thay Recommended text hoặc suy ra matchup từ điểm. Không tự suy diễn tổ hợp của các alternative riêng lẻ thành team hoàn chỉnh.

Recommended render `displayNotes` theo owner team/primary/alternative, mỗi source occurrence đúng một lần; không render lại holder.notesRaw/team.notesRaw aggregate bên cạnh projection. Không fuzzy/string-dedup hai occurrences khác chủ thể. Legacy references lặp cùng legacyTeamId + legacyContentSha256 chỉ render original một lần, giữ đủ locator/provenance. R3 dùng common + primary + alternative paragraphs, gồm text giống nhau ở hai occurrences thực, và duplicate legacy references; điều kiện/cộng điểm không bị bỏ.

Không dựa vào một wildcard `/teams/**` để chấp nhận mọi HTML. Dist verifier lấy expected team paths từ cùng catalog đã validate, thêm đúng `404.html`, và vẫn chặn file ngoài inventory, traversal/symlink, extra generation và hash mismatch. Thêm header rules riêng `/teams/recommended/*`, `/teams/legacy/*` và `/404.html` với mutable HTML revalidation như root; không đổi policy raw artifacts còn lại. `public/_headers` phải byte-equal bản dist. Preview status + static 404 artifact contract là local proof; không giả nhận đã kiểm tra deployed Pages.

## History and clean cutover

Ngay phase 2, title và CTA là anchors thật tới cùng URL. Chỉ same-tab unmodified navigation ghi return snapshot; Ctrl/Cmd/middle click không preventDefault, không tạo extra history trong tab nguồn. Callback legacy analyzer/roster cũng đi URL mới. Phase 3 chỉ đổi presentation/filters trên các links đã chạy được; không giữ cả inline reference lẫn page.

Trước same-tab navigation từ root, merge snapshot vào `history.state` thay vì ghi đè `surfaceSnapshots`. Snapshot versioned chứa normalized root URL, scrollY và UI-only filter/disclosure state. Một sessionStorage record gần nhất hỗ trợ link “Quay lại” khi tải mới root; key đề xuất `tqccl:team-return:v1`, chỉ restore khi URL khớp chính xác, type/range hợp lệ. Storage lỗi không làm navigation crash: URL vẫn giữ query/chips/tab, browser history snapshot vẫn phục vụ Back. Không lưu corpus/roster hoặc danh sách vô hạn.

Restore sau khi section/data đã render, chỉ entry có snapshot matching; tránh ép scroll trên mọi popstate/tab khác hoặc tắt browser scroll restoration toàn cục. Bfcache/pageshow và một lần tải root mới đều phải được kiểm tra; Back/Forward không append history vô hạn. Native modifier/middle click không bị chặn.

Old root `?detail=...`, `?legacyTeam=...&legacyVariant=...` được resolve bằng identity thật rồi `location.replace` tới route tương ứng, giữ origin root state đã sanitize. Original-only legacy link đi original page. Variant không hợp lệ báo lỗi thay vì fallback. **Sự hiện diện của key `config` luôn có precedence gameplay**, kể cả config=missing/giá trị không hợp lệ: giữ gameplay error và không redirect sang reference. Không đổi scenario/ruleset selection. Tier query cũ không đổi thành score, chỉ loại khỏi team-browser state với thông báo phù hợp ở phase 3.

## TDD sequence

**Red**, trước route/source implementation:
- **R1:** known IDs tạo đúng href/routes; unknown, duplicate, traversal và mismatched pair không được resolve. Original routes gồm cả duplicate/pending nhưng không làm chúng xuất hiện ở Team khác.
- **R2:** `from` accept normalized root/filter URL; reject foreign origin, `//`, schemes, encoded path, unknown keys/hashes và loop selectors. Malformed percent/query không crash.
- **R3:** legacy notes/counters/hero notes/alternatives hiện nguyên nghĩa; Recommended common/primary/alternative notes đúng ownership, không lặp aggregate hoặc mất occurrences riêng; bond/source giữ nguyên; hostile source string hiển thị text, không execute.
- **R4:** direct URL, reload, old link replace, invalid variant, canonical family fallback; actual title/CTA native new-tab, analyzer/roster legacy callbacks đi original; valid và invalid config selector đều giữ precedence hiện có.
- **R5:** list→detail→Back/Forward và nút Quay lại giữ q, facets, season/category, tab, scroll; phân biệt sessionStorage failure với localStorage getter/getItem/setItem denial; root/detail vẫn boot và theme toggle vẫn chạy. BFCache không tạo loop hoặc restore nhầm entry.
- **R6:** Recommended outage/hash mismatch fail-closed; original page vẫn tải khi Recommended requests bị chặn; duplicate/pending original vẫn truy cập trực tiếp, không lọt list.
- **R7:** dist chỉ admit catalog paths/pins + exact 404.html; thiếu/extra page, stale selected payload hoặc selected legacy hash khác raw original bị phát hiện. Unknown route không serve root shell; nested fetches không rơi vào `/teams/.../data/...`; header rules đúng trang con.

**Green:** catalog và href validator → detail-only loaders/pages → render content → root/caller migration → artifact/headers integration. Chạy focused test sau mỗi nhóm đã ổn định, không chạy project-wide suites giữa các writer.

**Refactor:** gom chung verifier/chrome/holder helper thật sự trùng, bỏ reference inline mount/handler không còn dùng; giữ gameplay inline. Không giữ compatibility shim cho module nội bộ đã migrate; chỉ giữ old URL migration là yêu cầu công khai.

## Tasks

- [x] P2.1 Fresh scout, references và Red R1–R7.
- [x] P2.2 Static catalog/pages, isolated loaders và shared chrome.
- [x] P2.3 Detail content, safe history và toàn bộ reference callers.
- [x] P2.4 Exact dist inventory/headers, Green và smoke navigation.

## Commands and exit gate

```sh
node --experimental-strip-types --test tests-js/team-detail-navigation.test.mjs tests-js/team-detail-routes.test.mjs tests-js/recommended-reference-artifacts.test.mjs
npm run build
npm run test:contracts
npm run test:dist
npm run verify
npx playwright test tests-e2e/team-detail-pages.spec.mjs tests-e2e/recommended-browser.spec.mjs --project=astro
```

Build thủ công sau khi source/artifact changes của phase đã ổn. Playwright command hiện **tự build thêm một lần**, cần port 4174 trống vì reuseExistingServer=false; không chiếm port đó bằng manual preview. Đo build/startup thực với corpus trước khi cân nhắc timeout, không tăng trước hoặc coi startup failure là Red. Dùng managed dev/preview trên port khác để smoke actual pages. Chỉ thoát khi actual title/CTA direct/reload/back/native new-tab, original outage isolation và bad-link guards có proof, không còn reference-only inline path. Chụp Recommended và legacy detail thật có notes/counters.
