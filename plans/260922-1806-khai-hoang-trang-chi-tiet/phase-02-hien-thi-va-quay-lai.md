---
phase: 2
title: "Hiển thị, điều hướng và kiểm chứng"
status: completed
priority: P2
dependencies: [1]
---

# Phase 2: Hiển thị, điều hướng và kiểm chứng

## Overview và dependencies

Chỉ bắt đầu sau gate offline phase 1 xanh: ID/ghi chú/ledger v2/catalog assembly đã kiểm bằng injected source. Phase 2 sở hữu toàn bộ cutover runtime: page + entry + đăng ký asset + UI + localization/publication/rebind, rồi gate build/browser. Không cần phase 1 tạo page hoặc publication trước.

## Context và key insights

Các quan sát dưới đây là trạng thái nguồn **lúc lập plan**, giữ làm mốc "trước/sau":

- [Thiết kế](../../docs/design-guidelines.md), [chuẩn code](../../docs/code-standards.md), [plan index](./plan.md).
- `js/render.js:293-325` có native select, renderer build và guide; dùng lại, không dựng bản markup khác trên trang riêng.
- `js/app.js:295-330` có history/session snapshot, native anchor navigation và restore; `:385-393` restore khi đó xảy ra trước mount Khai hoang.
- `js/team-detail-navigation.js:177-230` capture/read snapshot phải cùng hiểu state mới; chỉ thêm field vào writer là chưa đủ.
- `tests-e2e/khaihoang-options.spec.mjs` khi đó kiểm guide trong card; các assertion placement này đã được chuyển sang detail, vẫn giữ kiểm build/Chạm Sứ/mines.

## Requirements và architecture

### Danh sách

- Card giữ tên team, binh chủng, tướng, chủ tướng trước/sau cấp 20, chiến pháp, native selector, `buildNote` và link.
- Không render `guide`/`openingNote` ở card, kể cả HTML ẩn. Không đưa rating, yêu cầu đỏ hoặc thứ tự đánh đất ra ngoài.
- Tên team và “Xem chi tiết” là anchor thật; không bọc cả card quanh select/tactic links, không click handler trên article.
- Link phản ánh variant đang chọn ngay khi onchange, để Enter, Cmd/Ctrl-click, middle-click và copy link đều hoạt động.

### Chi tiết

- Entry `js/khaihoang-detail.js` dùng publication pin/source hash và `localizeData` hiện có; chỉ render khi xác minh thành công, không fallback raw data.
- Build dùng cùng hàm với card; bên dưới là `openingNote` của cấu hình đang chọn và `guide` của team.
- Guide không nằm trong subtree bị replace khi đổi build; không reset disclosure/focus hoặc đổi điểm theo variant chưa được chấm.
- Ghi chú team và variant giữ scope gốc: không mặc định merge lời khuyên của default build vào variant. Guide bộ ba vẫn dùng chung; các ghi chú cấp hero theo build đang chọn.
- Team không guide vẫn hiển thị build và mọi note hiện có; không dựng nhóm guide rỗng hoặc tự lấy `variant.guide`.
- Loading/network/hash error có status, retry và link quay lại. Không giả nội dung thiếu thành dữ liệu hợp lệ.

### URL và phục hồi

- Detail `/khai-hoang/<handle>/?variant=<variantId>&from=<safeRootURL>`; default bỏ `variant`. Canonical luôn pathname.
- Không có variant => default. Variant lạ => thông báo rõ + link chọn mặc định, không render default dưới danh nghĩa variant lạ. Reload, Back/Forward sau đổi variant phải đồng bộ select/build; đổi select dùng `replaceState` để không tạo lịch sử cho mỗi option.
- Root `khTeam=<id>&khVariant=<variantId>#khaihoang` chỉ chọn cấu hình của đúng team; bỏ khVariant khi default. Parse theo family, không dùng `config` gameplay. Các surface khác không tiêu thụ hoặc mang state này sang query của chúng.
- Mỗi anchor có `variant` và `from` tự đủ state cho đúng card ngay khi dựng/cập nhật href. Đổi selector cập nhật active pair trên root URL; primary-click card khác cập nhật root URL trước khi ghi snapshot, không preventDefault. Modified click/copy link không cần và không được phụ thuộc việc sửa URL tab nguồn.
- Map snapshot `khaihoangVariants` lưu `teamId -> variantId` trong history/session snapshot hiện có, giới hạn theo inventory và validate key/value. Default dùng chuỗi rỗng; thiếu key cũng về default. Không tạo storage key, localStorage hoặc state store thứ hai.
- **Khóa phục hồi riêng cho Khai hoang:** gọi `safeReturnUrl` trước; chỉ khi snapshot và đích đều có tab/hash `khaihoang` mới tính context key bằng cách bỏ đúng `khTeam` và `khVariant` khỏi URL an toàn. Giữ nguyên path, hash và mọi query khác, kể cả thứ tự/giá trị lặp. Không bỏ `q`, `scenario`, `ruleset` hoặc nới so khớp cho Đội Chuẩn/Đội Khác; các surface đó vẫn exact-root-URL.
- Snapshot lưu full URL gốc, không nhận context key do query cung cấp; tính lại context key khi đọc. Snapshot Khai hoang có optional `khaihoangVariants` đã validate; snapshot v1 cũ thiếu map vẫn đọc tab/scroll theo contract cũ, không tự sinh map.
- Persist map ngay sau mỗi đổi selector và refresh snapshot ở `pagehide` để bắt scroll mới nhất trước navigation bằng paste/copy URL trong cùng tab. Chỉ snapshot root Khai hoang đã khởi tạo thành công; giữ primary-click capture hiện có để không dựa riêng vào pagehide/BFCache. Dùng cùng serializer cho history và session; không ghi đè snapshot root từ trang detail.
- Restoration precedence: lấy history snapshot có map hợp lệ và context key khớp; nếu không có map hợp lệ thì thử session snapshot cùng context. Sau đó overlay active pair hợp lệ từ URL, cuối cùng dùng default cho key thiếu/stale. Map hợp lệ có thể rỗng; không fallback sang dữ liệu session cũ khi người dùng đã reset map. Legacy tab/scroll fallback không được chặn lựa chọn map mới hơn có trong session.
- Mount Khai hoang rồi mới restore selections và cuối cùng scroll. Cold load, `popstate` và `pageshow.persisted` đi cùng đường restoration; kiểm `capture/read/restore` giữ field mới đầy đủ.
- Nút quay lại dùng safe `from`, fallback `/#khaihoang`. Đổi build bên trong detail không sửa ngược cấu hình root lúc rời danh sách. Trong cùng tab, copy link từ card khác vẫn phục hồi map nhờ context key, rồi áp active pair của card đích.
- Tab mới có snapshot được trình duyệt sao chép thì phục hồi theo cùng quy tắc. Tab mới không có snapshot, hoặc storage bị chặn/malformed, chỉ bảo đảm active team qua URL; các card khác về default, không hứa chuyển state giữa tab.
- Scroll phục hồi từ snapshot cùng context khi có; không có snapshot thì không hứa vị trí cũ. Không phụ thuộc browser BFCache để giữ variant và không hứa giữ scroll qua tab mới thiếu snapshot.

## Related code files

Sửa:
- `src/lib/team-detail-routes.ts`: nối catalog assembly phase 1 với verified website snapshot; default/custom-root đều nhận đúng nguồn Khai hoang; `htmlPaths` bao phủ ba family.
- `src/pages/index.astro`, `src/layouts/SiteLayout.astro`: nhúng registry `k` trước khi dựng href, giữ `r`/`l`; activeSection thêm `khaihoang`, dùng shell/CSS hiện có.
- `src/pages/sitemap.xml.ts`, `scripts/verify-astro-dist.mjs`, `public/_headers`: inventory/canonical/OG/cache policy cho route mới; 404 vẫn noindex, không canonical hoặc entry detail.
- `src/lib/public-artifact-manifest.mjs`: đăng ký `khaihoang-detail` cùng lúc file entry được tạo thật, không để manifest tham chiếu file chưa tồn tại.
- `js/render.js`: trích helper build dùng chung; card gọn, detail content mới; không tạo re-export/compat wrapper thừa.
- `js/app.js`: mount/restore order, Khai hoang selection state và snapshot integration; giữ orchestration ở đây, logic thuộc renderer/navigation.
- `js/team-detail-navigation.js`: validate/persist state mới, href family k, safe return và URL parse/build helpers.
- `js/season-ui-state.js`, `js/recommended-reference-state.js`: chỉ sửa nếu kiểm owner query chứng minh cần giữ/cô lập cặp khTeam/khVariant; không thay ngữ nghĩa gameplay/reference query.
- `css/styles.css`: tái dùng tokens/card/detail styles, bổ sung focus/link/spacing tối thiểu.
- `tests-e2e/khaihoang-options.spec.mjs`, `tests-e2e/team-detail-pages.spec.mjs`, `tests-e2e/spa-parity.spec.mjs`: migrate các kỳ vọng presentation đã đổi, bổ sung journey ở nơi phù hợp.
- `tests-js/khaihoang-data.test.mjs`, `tests-js/team-detail-navigation.test.mjs`, `tests-js/website-display.test.mjs`, `tests-js/astro-dev-contract.test.mjs`: consumer semantics và restoration; không đưa assertion `displayNote` đã nghỉ trở lại.
- `tests/test_site_localization.py`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/pages-headers-contract.test.mjs`, `tests-js/runtime-asset-contract.test.mjs`, `tests-js/team-detail-routes.test.mjs`: migrate published fixtures, route inventory/registry và cả default/custom-root contract.
- `docs/system-architecture.md`, `docs/code-standards.md`, `docs/deployment-guide.md`: cập nhật vị trí guide, query/route mới và public inventory sau smoke xanh.
- `pipeline/site_localization.py`, `pipeline/site-localization-policy.json`, `pipeline/site-translations.json`, `pipeline/site-translation-reviews.json`, `data/website-display.json`: migrate field/owner/route-family inventory theo code hoàn chỉnh, review độc lập, không tự refresh fingerprint để né review.
- `src/data/recommended-reference/current.json` và successor generation mới: publish bằng workflow hiện có; giữ schema Recommended v1, không sửa generation đã xuất.
- `pipeline/team-route-handles.json`: sau mỗi publication mới, rebind generationId sang successor trước build; giữ map cũ byte-equivalent và `khaihoangSha256` đúng nguồn.

Tạo `src/pages/khai-hoang/[team].astro` và `js/khaihoang-detail.js` trong cùng phase. Page prerender dùng SiteLayout, title/canonical pathname/OG article, activeSection Khai hoang, return link và loading/error/body mount. Không xóa file hoặc đổi business data ngoài migration đã chốt.

## Implementation steps

1. Dùng LSP references cho exported renderer/navigation API trước thay đổi; migrate caller thay vì để alias cũ. Xác minh mọi note đã phân loại trong phase 1.
2. Tách helper build và detail content trong `render.js`; card không render hướng dẫn, detail tái dùng build và guide. Giữ build-specific note và roster guide tách biệt.
3. Tạo đồng thời page và entry detail hoàn chỉnh; đăng ký asset, nối default verified catalog/registry, shell và sitemap/headers/verifier. Loader dùng pin/hash/localize, có selector/lỗi/query/return link; không boot app root. Href chỉ qua navigation helper, không nối path ở renderer. Không chạy build giữa các mutation phụ thuộc này.
4. Tích hợp root selection với context key Khai hoang, giữ exact URL cho các surface khác. Mount trước restore; persist map khi đổi selector, primary-click và pagehide; active pair chỉ override team tương ứng. Href tự đủ state cho modified/copy navigation; không dùng click handler làm điều kiện để phục hồi map.
5. Cập nhật CSS dùng tokens hiện có; desktop/mobile và focus-visible; không thêm UI framework/modal.
6. Migrate E2E guide assertions sang route detail và giữ variant/commander/tactic/Chạm Sứ/mines tests. Kế thừa migration note-field từ phase 1, bảo vệ nội dung bằng mapping đủ câu/điều kiện và consumer scenarios; cập nhật đầy đủ published fixtures. Bỏ test chỉ pin wording/incidental markup thay vì re-pin. Chỉ giữ test mới cho lỗi có thể xảy ra thật.
7. Hoàn tất code/fixtures và review localization → build/check successor candidate → publish → rebind ledger generationId khớp publication vừa chọn, không sinh lại handle → chạy các gate khi không còn writer đồng thời. Refresh publication thêm lần nào phải rebind lại lần đó.
8. Mở browser thật qua local runtime, thực hiện journey, chụp danh sách và detail. Sau smoke xanh, cập nhật docs liên quan, bỏ script tạm và ghi evidence vào plan. Không push/deploy; người dùng đã cho phép commit local cho đợt này.

## Todo

- [x] Dựng card chỉ build và detail dùng renderer chung.
- [x] Tạo page/entry, nối catalog/shell và đăng ký public artifact đồng bộ.
- [x] Load pin/localize, variant URL và trạng thái lỗi đầy đủ.
- [x] Giữ cấu hình, return URL, snapshot và scroll đúng thứ tự.
- [x] Review localization, publish successor rồi rebind ledger trước build.
- [x] Migrate kiểm thử contract và chạy verification sau tích hợp.
- [x] Kiểm browser mobile/desktop, cập nhật docs sau smoke.

## Success criteria và scenario coverage

- A1/A2: mở từng team trong inventory; build-only bên ngoài, toàn bộ guide/note đúng bên trong. Kiểm riêng Lục Tốn (cảnh báo đánh đất), Chu Thái (note hỗn hợp) và Gia Cát Khác/Thái Sử Từ/Tả Từ (guide + variant).
- A3: chọn variant khác mặc định, copy/open link tab mới, reload detail: đúng chiến pháp/chủ tướng; select/tactic click không điều hướng sai. Đổi variant không mất guide disclosure.
- A4: chọn B=b rồi A=a, mở A bằng primary-click và quay lại để có snapshot URL A; copy link B, paste mở trong cùng tab rồi dùng nút quay lại. B=b lấy từ URL, A=a vẫn lấy từ map, scroll phục hồi từ snapshot cùng context. Thử thêm browser Back và cold reload. Snapshot khác `q`/`scenario`/`ruleset` hoặc tab phải bị loại; khác riêng active pair Khai hoang thì phải nhận.
- A4 biên: history snapshot cũ không có map không che session map hợp lệ; map rỗng sau reset không hồi sinh lựa chọn cũ; variant stale chỉ loại entry sai. Tab mới có snapshot clone phục hồi map; tab mới không snapshot hoặc storage lỗi chỉ giữ active team từ URL. Đội Chuẩn/Đội Khác vẫn từ chối snapshot khác full URL.
- A5: invalid slug 404; invalid/cross-team variant có thông báo; external/protocol-relative `from` bị loại; network/hash lỗi không render raw.
- A6: 320/375/1280 px, sáng/tối; Tab/Enter/native select, Cmd/Ctrl-click, mobile menu; không overflow. Quan sát screenshot trực tiếp, không chỉ dựa DOM count.
- A7: nguyên thứ tự teams → Chạm Sứ → mines, array legacy/empty Chạm Sứ không lỗi; Đội Chuẩn/Đội Khác restore/link vẫn đúng; không đổi guide khi đổi variant.

## Verification commands

Các lệnh dưới đây đã chạy trên cây tĩnh sau cutover; kết quả ghi ngay bên dưới:

```bash
python3 -m pipeline.team_route_handles --check
python3 -m pipeline.site_localization check --root . --stage public
python3 -m unittest tests.test_team_route_handles tests.test_site_localization
npm run check
npm run build
npm run test:contracts
npm run test:dist
npm run verify
npm run test:node
npm run test:dev-contract
npm run test:e2e:astro -- tests-e2e/khaihoang-options.spec.mjs tests-e2e/team-detail-pages.spec.mjs tests-e2e/spa-parity.spec.mjs
```

Kết quả: Python 368 pass; Node 316 pass; runtime contract 5; dist contract 27; dev contract 2;
Astro E2E 153 pass (gồm ba spec focused trên rồi full suite); `npm run check` 0 error / 0 warning /
1 hint; `npm run build` 1551 trang; `npm run verify` 1700 file; gate localization public xanh và
ledger `--check` xanh trên generation cuối. Playwright tự build + preview tại 4174 với
`reuseExistingServer:false`; không chiếm port đó bằng server thủ công và không sửa config.

## Risks và security

- Root query normalize có thể làm rơi state Khai hoang: trace `updateSeasonURL`, `readRecommendedQuery`, tab switching và `from` cùng nhau.
- Storage lỗi/tab mới không có snapshot chỉ giảm scroll/multi-card restore, không làm mất active variant hoặc chặn navigation. Trong cùng tab với snapshot còn hợp lệ theo context, copy-link phải giữ toàn map, không được coi khác active pair là storage failure.
- Thay notes/source bytes phải refresh publication thực, không chỉ patch hash. Renderer nhãn UI mới cũng thuộc inventory localization.
- Dữ liệu đã dịch mới được hiển thị; không để chữ Hán từ raw note lọt lại trong migration.

## Trạng thái hoàn tất

Đóng ngày 2026-09-24 sau khi toàn bộ acceptance xanh. Cả bảy mục Todo đã xong, không mục nào còn treo.

- **Card chỉ build (A1):** `js/render.js` tách `khaihoangBuildContent(build, openingNotes=false)` và `khaihoangGuide(guide)`; card gọi build content ở chế độ không có `openingNote` và **không** gọi guide, còn `openingNote` chỉ bật ở detail (`openingNotes = true`). Tên team và “Xem chi tiết” là anchor thật; `onSelect` cập nhật href của cả hai link nên Enter/Cmd-click/middle-click/copy link đều mang đúng cặp đang chọn.
- **Detail và guide ownership (A2):** `src/pages/khai-hoang/[team].astro` + `js/khaihoang-detail.js` dùng `loadWebsiteDisplay`/`localizeData` với pin `data-khaihoang-team-id` + `data-khaihoang-sha256`; guide lấy theo team (owner bộ ba) và nằm ngoài subtree bị replace khi đổi build, team thiếu guide vẫn hiển thị build và mọi note hiện có.
- **17 route tĩnh:** `dist/khai-hoang/` có đúng 17 thư mục, khớp `handles.khaihoang` trong ledger; `catalog.htmlPaths` = recommended + legacy + khaihoang và verifier kiểm từng trang (`scripts/verify-astro-dist.mjs`), `public/_headers` phủ `/khai-hoang/*`, `public-artifact-manifest.mjs` đăng ký `js/khaihoang-detail`, 404 vẫn `noindex` và không boot entry nào.
- **Variant và URL (A3/A5):** detail dùng `?variant=<variantId>&from=<safeRootURL>`, default bỏ `variant`, đổi select dùng `replaceState`; variant lạ hiện thông báo + link về cấu hình mặc định thay vì render default dưới tên variant lạ; canonical luôn là pathname.
- **Snapshot và quay lại (A4):** `js/team-detail-navigation.js` có `KHAIHOANG_TEAM_QUERY_KEY`/`KHAIHOANG_VARIANT_QUERY_KEY`, `khaiHoangContextKey` (gọi `safeReturnUrl` trước, chỉ bỏ đúng `khTeam`/`khVariant` khi URL thuộc `#khaihoang`), `khaiHoangUrlWithPair`, và map `khaihoangVariants` được validate theo inventory trong `captureReturnSnapshot`/`readReturnSnapshot`. `js/app.js` mount Khai hoang trước khi restore, persist map khi đổi selector/primary-click/`pagehide`, overlay active pair hợp lệ từ URL sau snapshot, và chỉ nhận overlay khi URL có đúng một team, tối đa một variant thuộc team đó — nên cặp sai/ngoài team/stale không xoá được lựa chọn đã lưu. Đội Chuẩn/Đội Khác vẫn so full URL.
- **Localization (A7):** publication cuối là generation `b60b51c9f5a5b86de3d27a278a9a562dabbfdeeb0b61cac54d00e71e9f6bbb67`; ledger v2 rebind `generationId` sang đúng generation này và giữ 17 handle + `khaihoangSha256` đúng nguồn. Nhãn guide “Hướng dẫn khai hoang” là copy tiếng Việt do người viết, có obligation + review độc lập (UX reviewer ACCEPT) và render là `h2`, không đi vòng qua inventory. Chạm Sứ, mines, Đội Chuẩn/Đội Khác, sitemap, headers và verifier giữ nguyên contract.
- **Kiểm chứng:** bảng kết quả ở mục Verification commands. Visual kiểm thật ở 320/375/1280 px, cả sáng và tối, không tràn ngang và không mất focus khi đổi build; đo tương phản theme tối đạt tối thiểu 4.85:1 ở unit badge và 6.20:1 ở chip. Hai finding có điều kiện của Kongming đã đóng: (1) variant URL sai không còn xoá lựa chọn snapshot hợp lệ — phủ bởi `tests-e2e/spa-parity.spec.mjs:333-361,364-391`; (2) fixture âm của Option B nay phân biệt được exact projection với subset-only — phủ bởi `tests/test_site_localization.py:357-379` theo contract ở `docs/season-team-data.md:171-178`. Kongming kết luận **GO** trên bản cuối.
- Ba finding review ban đầu (2 High: version coupling, publication pin; 1 Medium: note-field cutover) đã xử lý đúng như plan mô tả: ledger tách v2 khỏi publication v1, thứ tự publish → rebind → build được giữ, và `displayNote` đã nghỉ không quay lại dưới dạng alias.
- Docs `docs/system-architecture.md`, `docs/code-standards.md`, `docs/deployment-guide.md` và `docs/season-team-data.md` đã cập nhật sau smoke xanh.

## Next step

Acceptance đã xanh và checklist đã đóng bằng trạng thái trong frontmatter. Plan đi vào **một commit local duy nhất** theo yêu cầu người dùng; không push, không deploy. Không đề nghị thêm thay đổi nào ngoài phạm vi này.
