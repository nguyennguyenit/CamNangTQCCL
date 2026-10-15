# Phase 2 — SSR trang đội và trang danh sách: báo cáo

Kết quả: 3098 trang chi tiết (`doi-chuan` 1366, `doi-khac` 166, `khai-hoang` 17 × vi/zh) có thân đầy đủ trong HTML tĩnh; 4 trang danh sách (`/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/` × vi/zh) có đội mặc định (mỗi đội 3 tướng + link chi tiết, trừ Cùng Tồn vốn không có trang chi tiết). Hết "Đang tải chi tiết…" và noscript "cần JavaScript" ở các trang này. Client nhận lại DOM dựng sẵn, chỉ gắn tương tác. Mọi markup dựng từ builder cây view dùng chung (`treeToHtml` ở build, `treeToDom` ở client); không có bản markup song song trong `.astro`.

## Lệnh đã chạy

| Lệnh | Kết quả cuối |
|---|---|
| `npm run build` (localization `check --stage public` + `astro build`) | OK, 3145 trang |
| `npm run verify` | OK, 3342 file |
| `npm run test:dist` | 36/36 (trước 32; +4 ca dựng sẵn) |
| `npm run test:node` | 517/517 (509 + 4 ca `team-section-ssr` + 4 ca dist) |
| `python3 -m unittest discover -s tests` | 422 OK (sửa 5 hằng số đếm, xem Localization) |
| `npx playwright test -c playwright.local.config.mjs` | 434 passed (414 + 14 no-JS + 5 adopt + 1 tách từ test fetch); 2 flaky tự qua ở lần thử lại: `community.spec` (admin AI, không liên quan) và `recommended-browser` chevron (chờ `data-boot` quá 5 s lúc máy tải nặng) |
| `python3 -m pipeline.team_route_handles --check` / `lookup_route_handles --check` | OK (1366/166/17; 886 lookup id, generation lookup không đổi) |
| `npx astro check` | 0 lỗi |
| `mcp-worker`: `npm run check:workflow-build` | OK (không file semantic nào bị đổi) |

## TDD (đỏ → xanh)

- Đỏ (trước khi sửa, dist Phase 1): 4 ca mới trong `tests-js/astro-dist-contract.test.mjs` fail đúng lý do — Đội chuẩn: thiếu tướng `Đổng Trác` trong HTML dựng sẵn; Đội khác: thiếu `Tuân Úc`; Khai hoang: thiếu chiến pháp `Thịnh Khí Linh Địch`; danh sách: noscript `JavaScript` còn trong `/doi-chuan/`.
- Xanh sau khi sửa: 4/4. Ca dùng dữ liệu thật (bản ghi chi tiết đã pin, `teams.json`, `khaihoang.json`, `index.json`/`other-teams.json`, mô hình mùa) và hỏi tên tướng/chiến pháp/binh thư/link của chính đội đó, vi và zh (zh tra chữ Hán bằng `createRawNameResolver`).
- e2e `team-ssr-nojs.spec.mjs` (14 ca, `javaScriptEnabled:false`): 4 trang danh sách × 2 ngôn ngữ (đội đầu ≥3 hàng tướng, link `^<prefix>/<mục>/<seg>/`, đúng 1 `h1`, không câu "JavaScript"), và bấm đội đầu → trang chi tiết có thân (3 họ × 2). Viết cùng lúc với sửa (chưa chạy riêng trước khi sửa; đỏ chỉ được ghi nhận ở tầng dist ở trên).
- e2e `team-ssr-adopt.spec.mjs` (5 ca): giữ `app.js` lại, ghi nhớ node dựng sẵn, thả → trạng thái mặc định giữ nguyên các node (`isConnected`), không nhân đôi thẻ, một `h1` (Đội chuẩn/Đội khác/Cùng Tồn/Khai hoang × vi/zh); chip chiến pháp trên thẻ dựng sẵn vẫn tìm được (sự kiện đã gắn); `?view=bang` thay danh sách (không còn thẻ cũ); link chi tiết mang `from=/doi-chuan/`.
- Test cũ "không có JavaScript: trang mục có h1…" (`spa-parity.spec.mjs`) cập nhật: 4 mục đội + Tra cứu không còn lời nhắn, 3 trang công cụ vẫn có; vẫn đúng 1 `h1` khi có/không JS.
- `tests-js/team-section-ssr.test.mjs` (4 ca, dữ liệu thật qua `src/lib/team-ssr.ts`): chỉ đội của mùa mặc định, ≤ 60 đội, link chi tiết theo ngôn ngữ + biến thể, nhóm đầu Cùng Tồn có 3 tướng/đội, đủ 17 thẻ Khai hoang.
- Verifier (`scripts/verify-astro-dist.mjs`) thêm: trang chi tiết phải có `#team-detail-body[data-prerendered]` không `hidden`, có `<h2>`, không `#team-detail-status`, không chữ chờ/"cần JavaScript"; 4 trang mục phải có dấu nội dung riêng (`data-ssr-signature`, thẻ đội, link chi tiết / `kh-card`), đúng 1 `h1`, không chữ chờ/JS, `data-ssr-source` khớp pin publication. Fixture dist-contract được cập nhật và có ca âm tính cho từng điều kiện.

## Kích thước HTML (vi, byte)

| Trang | Trước (Phase 1) | Sau |
|---|---|---|
| `/doi-chuan/` | 133 049 | 214 383 (zh 205 513) |
| `/doi-khac/` | 133 078 | 274 263 (zh 260 186) |
| `/cung-ton/` | 133 043 | 145 025 (zh 139 668) |
| `/khai-hoang/` | 132 005 | 208 727 (zh 199 492) |
| Trang chi tiết lớn nhất (`doi-chuan/pk-s24-thai-uy-thuan-ban-suc-the-hanh-nhat/`) | ≈ 70 000 (ước lượng: sau trừ thân 19 843 B và huy hiệu, cộng ~900 B khối chờ + noscript đã bỏ; dist cũ không còn để đo) | 89 410 |

3098 trang chi tiết: trung vị 77 194 B, tổng ≈ 239 MB. Phần lớn kích thước là khung chung của trang (bảng route handle, pin, script), không phải thân đội.

## Quyết định thiết kế

- Build: `src/lib/team-ssr.ts` nạp publication đã pin (`websiteDisplayPublicationSnapshot`), áp lớp dịch Việt bằng chính `loadWebsiteDisplay` + `localizeData(…, locale)` như trình duyệt, đặt một lần `setZhNameResolver` + `setTeamRouteHandles({r,l,k})` (cùng bảng SiteLayout nhúng), rồi gọi builder Phase 1 + `treeToHtml`. `src/lib/team-detail-pages.ts` chỉ thêm `recommendedDetailBody`; props không đổi.
- Chọn mặc định dùng chung code với client: `referenceSectionState(family, href, registry, storage)` (`js/recommended-reference-state.js`, app.js dùng lại — hành vi cũ giữ nguyên, kể cả Đội khác xem mọi mùa); `coexistScenarioIds`/`coexistGroups`/`COEXIST_LATEST_SCENARIO_ID` chuyển sang `js/season-ui-state.js`; builder SSR của mục nằm ở `src/lib/team-section-ssr.js` (không phát ra `/js/`, nên không phải đăng ký thêm artifact).
- Nhận lại DOM (không nháy, không nhân đôi): phần thân dựng sẵn mang dấu `data-ssr-signature` (mùa, từ khóa, bộ lọc, kiểu hiển thị, số đội, nguồn quay lại `from` / kịch bản + nhóm). `createRecommendedSection`, `createSeasonCoexistSection`, `khaihoangTable({adopt})` chuyển đúng node đó vào khung tương tác và chỉ gắn sự kiện khi dấu khớp trạng thái đầu của client; lệch (URL khác, kiểu hiển thị đã lưu khác, publication khác) thì thay như cũ. Chỉ nhận lại khi `data-ssr-source` (sha256 publication) khớp pin đã xác minh của trang — điều kiện này cũng giúp fixture e2e đổi pin/dữ liệu vẫn dựng lại bằng dữ liệu giả.
- Phần chữ đầu mục (kicker/h1/lời dẫn) là `referenceHeadTextTree` / `coexistHeadTextTree` — một định nghĩa cho cả SSR lẫn client. Khung tương tác (ô tìm, sidebar lọc, chọn mùa, nút kiểu hiển thị, "Xem thêm") vẫn do client dựng, như Phase 1 đã ghi; khi JS chạy, sidebar xuất hiện làm lưới dịch ngang một lần, danh sách thẻ không bị dựng lại.
- Chi tiết: `data-prerendered` trên `#team-detail-body`. Client Đội chuẩn/Đội khác (`js/team-detail.js`) chỉ hiện panel + nút sao chép liên kết; đường tải/dựng lại cho Đội chuẩn bị gỡ (không còn runtime-only data). Khai hoang (`js/khaihoang-detail.js`) nhận lại thân, gắn chip chọn cấu hình; dữ liệu đã pin chỉ được tải, băm, đối chiếu ở **lần bấm chip đầu tiên** (lỗi → thông báo, thân dựng sẵn bị xoá khỏi DOM, có "Thử lại").
- Phần buộc phải giữ ở client (phụ thuộc dữ liệu runtime/URL): `?variant=` của Đội khác (cần `other-teams.json` đã pin để chứng thực biến thể) và `?variant=` của Khai hoang (cấu hình khác mặc định). Hai trường hợp này ẩn thân dựng sẵn ngay (script inline 1 dòng + `hidden`), hiện trạng thái chờ do client tạo, rồi tải/xác minh/dựng như cũ — vẫn fail-closed. Phần tử `#team-detail-status` không còn trong HTML build; client tự tạo khi cần.
- CSS: thêm `#team-detail-body[hidden]{display:none}` (trước đây `display:flex` đè `hidden`, chỉ "ẩn" vì rỗng).
- Link sang Tra cứu giữ `?id=` như cũ (builder Phase 1 vẫn sinh từ `lookupLinks`; Phase 4 đổi ở nguồn đó thì SSR đổi theo, không còn script `#team-lookup-links`).
- Cùng Tồn không có trang chi tiết nên chỉ có tướng, không có link chi tiết (đúng dữ liệu hiện tại).

## Localization

- Nguồn sửa trong `policy.sourceFiles`: `js/app.js`, `khaihoang-detail.js`, `recommended-reference-state.js`, `render.js`, `team-detail.js`, `team-filter-section.js`, 3 trang chi tiết `.astro`, `SectionPage.astro`, `SiteLayout.astro` → hash cập nhật trong `pipeline/site-localization-policy.json` (+ `concreteLocationCount` 56826→56824, `concreteInventorySha256` mới).
- Hai nghĩa vụ UI không còn nguồn (noscript chi tiết Đội chuẩn/Đội khác: `ui:route-recommended/noscript`, `ui:route-legacy/noscript`) bị gỡ khỏi `UI_LITERAL_OBLIGATIONS` (`pipeline/site_localization.py`) và khỏi `site-translations.json` / `site-translation-reviews.json`. `tests/test_site_localization.py`: 2073→2071, 5670→5668, 106→104, 62→60 (3 chỗ).
- Chuỗi chạy: `inventory` → `build --stage all --output .cache/…` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public` (exit 0) → `prune`. Generation Recommended mới `e40a244a…` (cũ `6f65a4e0…` bị prune); `pipeline/team-route-handles.json` re-pin sang generation mới (`--check` OK); `data/website-display.json` đổi theo publish. Không đụng `data/lookup-*`, `books-dict.json`, ledger lookup.

## File chính

- Mới: `src/lib/team-ssr.ts`, `src/lib/team-section-ssr.js`, `tests-e2e/team-ssr-nojs.spec.mjs`, `tests-e2e/team-ssr-adopt.spec.mjs`, `tests-js/team-section-ssr.test.mjs`.
- Sửa: `src/lib/team-detail-pages.ts`, 3 trang chi tiết `.astro`, `SectionPage.astro`, `SiteLayout.astro` (noscript chỉ còn cho 3 mục công cụ), `js/{app,team-detail,khaihoang-detail,team-filter-section,render,recommended-reference-state,season-ui-state}.js`, `css/styles.css`, `scripts/verify-astro-dist.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-e2e/{spa-parity,khaihoang-options,team-detail-pages,recommended-browser,selected-state-contrast}.spec.mjs`.

## Test e2e cũ phải đổi (hành vi chủ động thay đổi)

- Thẻ/danh sách dựng sẵn hiện trước khi `app.js` chạy → các test chờ "thẻ đầu tiên hiện" rồi thao tác bộ lọc/mùa/Back phải chờ `body[data-boot=ready]` (recommended-browser ×5, selected-state-contrast, team-detail-pages tracking, spa-parity Khai hoang round trip). Hành vi người dùng giữ nguyên.
- Trang chi tiết mặc định không còn tải/băm payload: test "fetch only display publication + khaihoang/teams.json" và các test fail-closed (hash lệch, mạng, teams.json lệch, payload Đội chuẩn lệch) chuyển sang đường `?variant=` (nơi client vẫn tải/xác minh), thêm ca khẳng định trang mặc định không tải gì (Đội chuẩn, Đội khác, Khai hoang) và Khai hoang chỉ tải khi bấm chip. Ca Khai hoang `chuThai.buildNote` so với bản dịch đã phát hành (thân dựng sẵn mang bản dịch).

## Còn lại / lưu ý

- Sau Back, thẻ Khai hoang hiện cấu hình mặc định trước một nhịp rồi `restoreReturnState` áp lựa chọn đã lưu (không có nháy ở danh sách Đội chuẩn/Đội khác/Cùng Tồn).
- Danh sách Đội chuẩn/Đội khác chỉ dựng sẵn 60 đội đầu của mùa mặc định (hết chỗ → "Xem thêm" cần JS); Cùng Tồn chỉ nhóm đầu của mùa mới nhất. Sidebar lọc/chọn mùa không dựng sẵn.
- Docs/changelog chưa sửa (Phase 5; `docs/project-changelog.md` có thay đổi tay của người dùng, không đụng).
- Dùng chung `dist/` với agent khác: lần chạy cuối là `npm run build` + e2e cấu hình local (port 4184). Không commit/push/deploy.

## Review fixes (ReviewPhase12, findings 1–11)

| # | Finding → fix | Bằng chứng |
|---|---|---|
| 1 | Link/tiêu đề chép giữa `src/lib/team-section-ssr.js` và `js/app.js` → `referenceDetailHref(row,{from,origin,locale})` + `khaiHoangCardHref(teamId,variantId,{from,origin,locale})` ở `js/team-detail-navigation.js`, `referenceSectionTitle(family)` ở `js/team-filter-section.js`; app.js, SSR và `createRecommendedSection` (không còn nhận `title`) dùng chung | `tests-js/team-section-ssr.test.mjs` + parity e2e (#2) |
| 2 | Không có test so DOM nhận lại với DOM client dựng → `tests-e2e/team-ssr-parity.spec.mjs`: 4 trang × vi/zh, một context nhận lại DOM, một context bỏ `data-ssr-source` qua `page.route` (client tự dựng); `outerHTML` khối danh sách (bỏ `data-ssr-signature`) phải bằng nhau | 8/8 xanh |
| 3 | Chữ UI "Đội chuẩn/Đội khác" trong file ngoài gate → bỏ literal, dùng `referenceSectionTitle` (file đã trong `sourceFiles`) | `check --stage public` exit 0 |
| 4 | Chip "Mặc định" khi chưa tải → `selectVariant('')` thoát sớm khi `!team` (không tải, không xoá thân) | `team-ssr-detail-states.spec.mjs` "bấm chip Mặc định…": đỏ khi bỏ dòng guard (thân bị xoá), xanh sau |
| 5 | `?variant=` giữ huy hiệu mặc định → script inline của `LegacyDetail.astro`/`KhaiHoangDetail.astro` ẩn luôn `#team-detail-badges`; `showError` (`team-detail.js`, `khaihoang-detail.js`) xoá + ẩn huy hiệu | `team-ssr-detail-states.spec.mjs` ×2 (đang tải / sau lỗi, Khai hoang + Đội khác); đỏ khi bỏ phần `showError` |
| 6 | Lỗi boot/dữ liệu nằm sau thẻ dựng sẵn → `mount.prepend` (cả nhánh thiếu dữ liệu đội và `catch`) | `team-ssr-adopt.spec.mjs` "lỗi dữ liệu hiện ở đầu mục": đỏ với `append`, xanh sau |
| 7 | Danh sách Khai hoang bị tháo/gắn lại → `if (element.parentNode !== mount) mount.replaceChildren(...)`; sửa comment (đích `#cham-su`/`#mo` đã có từ HTML dựng sẵn) | `team-ssr-adopt.spec.mjs` "giữ focus": đỏ khi bỏ guard, xanh sau |
| 8 | Nút dựng sẵn chưa có sự kiện → `disableButtons` (`js/view-tree.js`) áp qua `inertUntilBound` (`src/lib/team-section-ssr.js`) cho `button[data-tactic-search]`, `.kh-config-chip`, `.kh-unit-chip` (danh sách + thân chi tiết Khai hoang): `disabled` + `aria-disabled="true"` trong HTML; `bindTacticTags`, `bindKhaihoangConfigRow`, chip loại binh gọi `enableControl` khi gắn xong. Không JS thì các nút vẫn khoá thay vì "im lặng". | e2e `team-ssr-adopt.spec.mjs` ×3 trang (khoá trước boot, mở sau boot) + chi tiết Khai hoang; unit `team-section-ssr.test.mjs`. **Back flicker Khai hoang không sửa:** lựa chọn đã lưu nằm trong snapshot `sessionStorage` do `restoreReturnState` (sau `data-boot`, cần `khaiHoangUI`, URL `khTeam/khVariant` và cuộn) áp; làm trước lần vẽ đầu cần một script inline trùng logic snapshot (`matchesReturnSnapshot`, `khaiHoangPairFromUrl`) chạy trước module — không làm được mà không chép logic đó vào HTML. Giữ nguyên: thẻ hiện cấu hình mặc định một nhịp rồi áp lựa chọn đã lưu (Đội chuẩn/Đội khác/Cùng Tồn không nháy). |
| 9 | Code chết → xoá `loadRecommendedDetailView` (`recommended-reference-state.js`) và wrapper `khaihoangRatings` (`render.js`; owner policy `pipeline/site_localization.py` đổi sang `ratingsTree`); bỏ `export` của `khaihoangHolderTrees`, `khaihoangConfigRowTree`, `teamRowsTree` (chỉ dùng nội bộ, quét mọi export mới của `js/`+`src/` không còn tham chiếu ngoài file) | `grep` toàn repo; build/test xanh |
| 10 | Comment cũ → `src/lib/team-detail-pages.ts` (`TeamLookupLinks`), `js/recommended-reference-render.js` (`lookupHref`), `js/team-detail.js` (không còn nhắc Khai hoang) | — |
| 11 | Biến thừa `detail` ở `tests-e2e/team-ssr-nojs.spec.mjs` | — |

Localization: hash nguồn (`app.js`, `khaihoang-detail.js`, `recommended-reference-render.js`, `recommended-reference-state.js`, `render.js`, `team-detail-navigation.js`, `team-detail.js`, `team-filter-section.js`, 2 trang `.astro`) và `concreteInventorySha256` cập nhật (số location 56836 không đổi); chuỗi `build --stage all` → `check --stage all --candidate` → `publish` → `check --stage public` → `prune`; generation Recommended mới `72ef7f49…` (cũ `4fb559ea…` đã prune), `pipeline/team-route-handles.json` re-pin; `lookup_route_handles --check` OK (886 id, `lookup:29322cab13be`).

Kết quả: `npm run build` 4917 trang, `verify` OK, `test:dist` 40/40, `test:node` 532/532 (531 + 1 ca `team-section-ssr`), `python3 -m unittest` 422 OK, `check --stage public` exit 0, `team_route_handles --check` OK, `mcp-worker check:workflow-build` OK, e2e đầy đủ 476 passed (+17 ca mới: parity 8, detail-states 4, adopt 5); 1 flaky tự qua ở lần thử lại (`responsive.spec` bảng chiến pháp, không liên quan).
