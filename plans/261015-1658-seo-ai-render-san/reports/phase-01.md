# Phase 1 — Builder đội sang view-tree: báo cáo

Kết quả: mọi builder dựng nội dung chính của đội trả cây view (`h`), chạy trong Node không cần `document`. Client chuyển bằng `treeToDom` rồi gắn sự kiện. Không đổi trang Astro nào.

## TDD (đỏ → xanh)

- Đỏ trước khi port: gọi `recommendedTeamCard({...})` trong Node ném `ReferenceError: document is not defined`; `tests-js/team-view-trees.test.mjs` viết trước dừng ở `SyntaxError: The requested module '../js/render.js' does not provide an export named 'khaihoangDetailTrees'`.
- Xanh sau port: `node --experimental-strip-types --test tests-js/team-view-trees.test.mjs` 11/11.
- Test mới `tests-js/team-view-trees.test.mjs` (vi + zh, record thật từ `src/data/recommended-reference/<current.json>`, `data/teams.json`, `data/khaihoang.json`, `data/coexist.json`, `data/season-content-links.json`): tên tướng, chiến pháp, binh thư, ghi chú đội, cấu hình thay thế, nhóm Cùng Tồn (cả nhánh legacy lẫn bảng nguồn), toàn bộ 17 thẻ Khai hoang, điểm khai hoang, chip phiên bản đang chọn đều có trong `treeToHtml`; cây không chứa hàm sự kiện; `locale` tường minh không rò sang lần gọi sau.
- `tests-js/view-tree.test.mjs` thêm 1 ca: `svg` + con dùng `createElementNS`, thuộc tính `viewBox` giữ chữ hoa.

## Đối chiếu DOM trước/sau (throwaway, đã xoá)

Playwright + static server trên bản `dist` trước (sao chép từ build cũ) và bản build sau (`astro build --outDir`), `main.outerHTML` bỏ khoảng trắng giữa thẻ. 43 file mỗi bên: vi + zh × `/doi-chuan/` (thẻ, `?view=luoi`, `?view=bang`, sau "Xem thêm", sau bấm chip chiến pháp), `/doi-khac/` (thẻ, bảng), `/cung-ton/` (nhóm 1, nhóm 2), `/khai-hoang/` (mặc định, sau chọn cấu hình, sau lọc loại binh), 3 trang chi tiết mỗi họ (đầu/giữa/cuối; Khai hoang cả sau đổi cấu hình). `diff -rq` giống hệt 42/42 file HTML; không `pageerror`; URL sau click chiến pháp/chip giống nhau.
Khác biệt duy nhất được chủ động thêm: nút chiến pháp bấm được mang `data-tactic-search="<giá trị tìm>"` (thay cho closure `onTag`); script chụp bỏ attribute này khỏi cả hai bên.

## Thay đổi

- `js/i18n.js`: `withLocale(locale, run)` — ép locale đồng bộ trong phạm vi `run` (không shim DOM) để Node dựng zh; `currentLocale()` tôn trọng nó. `js/i18n.js` thuộc `semanticFiles` của mcp-worker → đã chạy `npm run generate:workflow-build` (`check:workflow-build` OK).
- `js/view-tree.js`: `treeToDom` tạo `svg` và con bằng `createElementNS`; `ATTR` nhận chữ hoa (cho `viewBox`).
- `js/render.js`: thêm `t` (chữ ký như `el`, nhưng ra cây; ném lỗi nếu prop là hàm), `svgTree`, `iconTree`. Tree builders: `seasonCoexistGroup` (cây; `{teamCard, locale}`), `variantNameNodes`, `heroMentionNodes`, `khaihoangBuildContent`, `khaihoangRatings`, `khaihoangGuide` (mảng/nullable cây), `khaihoangHolderTrees`, `khaihoangConfigRowTree`, `khaihoangDetailTrees(team,{variantId,locale})` (thân trang chi tiết: khối build + điểm + hướng dẫn), `khaihoangTableTree(data,{hrefFor,locale})` (cả trang danh sách ở trạng thái mặc định). `khaihoangTable` giữ chữ ký cũ = `treeToDom(khaihoangTableTree)` + gắn lọc loại binh / chọn cấu hình / link thẻ. Gỡ: `khaihoangConfigRow`, `khaihoangRatingBar` export (thay bằng `khaihoangConfigRowTree` + `bindKhaihoangConfigRow(root,onSelect)`).
- `js/recommended-reference-render.js`: `recommendedTeamCard`, `coexistTeamCard`, `recommendedTeamTable(+Row)`, `recommendedTeamDetailContent`, `legacyOriginalDetailContent`, `detailBadges` đều trả cây/mảng cây và nhận `locale` tuỳ chọn. Mới: `teamItemTree`, `teamRowsTree`, `groupRowsByTier`, `tierOf`, `tierSectionTree`, `recommendedListTrees(rows,{family,mode,limit,labels,hrefFor,mountId,locale})` (thân danh sách Đội chuẩn/khác, dùng cho SSR Phase 2), `bindTacticTags(root,onTag)`. Bỏ tham số `onTag` khỏi builder.
- `js/team-filter-section.js`, `js/team-detail.js`, `js/khaihoang-detail.js`: chỉ đổi sang `treeToDom` + gắn sự kiện. `js/app.js` không cần đổi (`khaihoangTable` cùng chữ ký).
- `tests-e2e/team-detail-pages.spec.mjs`: 4 probe dựng nội dung chi tiết trực tiếp trong trang nay `treeToDom` mảng cây trước khi gắn vào host (API đổi từ DocumentFragment sang mảng cây).

## Phần giữ DOM (không thuộc nội dung cần prerender)

- Khung tương tác của `createRecommendedSection` / `createSeasonCoexistSection`: ô tìm, nút "Bộ lọc", sidebar facet, nút kiểu hiển thị, chọn mùa, hàng nút phiên bản Cùng Tồn, "Xem thêm", "Xóa lọc". Toàn bộ là điều khiển đổi theo state/URL, không phải nội dung đội; phần nội dung bên trong (thẻ, hàng, nhóm Tier, nhóm Cùng Tồn) đã là cây.
- `seasonConfigDetail`, `el`/`svgNode`/`icon` DOM: dùng cho công cụ/Gợi ý đội/Soi đội, ngoài phạm vi.
- Trang Astro (Phase 2) cần tự dựng khung chọn mùa/lọc nếu muốn SSR; phần thân danh sách dùng `recommendedListTrees`, Cùng Tồn dùng `seasonCoexistGroup`+`coexistTeamCard`, Khai hoang dùng `khaihoangTableTree`, chi tiết dùng `recommendedTeamDetailContent` / `legacyOriginalDetailContent` / `khaihoangDetailTrees` + `detailBadges`, mọi hàm nhận `locale`.

## Localization

- File nguồn sửa nằm trong `policy.sourceFiles`: `js/render.js`, `js/recommended-reference-render.js`, `js/team-filter-section.js`, `js/team-detail.js`, `js/khaihoang-detail.js`. `js/i18n.js`, `js/view-tree.js` không nằm trong policy.
- `pipeline/site_localization.py` `UI_LITERAL_OBLIGATIONS`: `ui:khaihoang/guide-heading` sourceExpression `el("h2", …)` → `t("h2", …)`; `ui:khaihoang/detail-versions-label` chuyển owner `js/khaihoang-detail.js::initKhaiHoangDetail` → `js/render.js::khaihoangDetailTrees` (chữ `Phiên bản`); owner symbol đã biến mất đổi tên: `khaihoangTeamCard`→`khaihoangTeamCardTree`, `khaihoangConfigRow`→`khaihoangConfigRowTree`, `khaihoangRatingBar`→`ratingBarTree`.
- Policy: hash 5 file nguồn + `baseline.notes.concreteInventorySha256` (`a779dda4…` → `29eb1033…`; số location 56826 không đổi). Chuỗi chạy: `inventory` → `build --stage all` → `check --stage all --candidate` (exit 0) → `publish` → `check --stage public` → `prune`. Generation Recommended mới `6f65a4e0…` (cũ `a973b093…` bị prune); re-pin `pipeline/team-route-handles.json` (`team_route_handles --check` OK: 1366/166/17), `data/website-display.json` đổi theo publish. Không đổi `data/lookup-*`/`books-dict.json` nên pin `lookup-route-handles` của Phase 3 không bị ảnh hưởng.
- Không thêm UI literal mới; `unit` tests `tests.test_site_localization tests.test_team_route_handles` 72 OK.

## Xác minh

- `npm run build` OK (3145 trang), `npm run verify` OK (3342 file), `npm run test:dist` 32/32, `npm run test:node` 509/509 (493 nền + 11 + 1 + test của Phase 3), `npx playwright test -c playwright.local.config.mjs` 414/414.
- `mcp-worker`: `npm run check:workflow-build` OK sau regenerate.

## Còn lại / lưu ý cho phase sau

- Docs/changelog chưa sửa (Phase 5; `docs/project-changelog.md` có thay đổi tay của người dùng, không đụng).
- Trong Node, zh cần `setZhNameResolver(...)` (tên Hán-Việt → chữ Hán) và `setTeamRouteHandles*` (link đội gốc, `teamDetailPath`) trước khi dựng; builder không tự nạp. Hai việc này thuộc Phase 2 khi dựng trang.
- Dist dùng chung giữa các worktree/agent: lần chụp trước/sau dùng thư mục `/tmp` riêng, chỉ bản cuối `npm run build` ghi `dist/`.
