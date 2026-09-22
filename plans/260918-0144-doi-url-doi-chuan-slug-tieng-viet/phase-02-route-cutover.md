---
phase: 2
title: "Cutover route chi tiết đội sang /doi-chuan/ và /doi-khac/"
status: pending
priority: P1
effort: "2-3d + independent review gate"
dependencies: [1]
---

# Phase 2 — Cutover route chi tiết đội

## Goal

Mọi URL trang chi tiết đội trở thành `/{bảng}/{mùa}-{handle}/` và `/doi-khac/{handle}/`,
sinh tĩnh đủ 1366 + 166 trang, không URL cũ nào tiếp tục chạy, và danh tính runtime
(`data-source-config-id` / `data-legacy-team-id`) không đổi.

## Evidence and scope

- `src/lib/team-detail-routes.ts` là inventory dùng chung cho build và verifier
  (`scripts/verify-astro-dist.mjs:8` import `teamDetailCatalog`). Hàm này **ném lỗi** khi
  ID trùng hoặc không routable, và `teamDetailHtmlPaths` là danh sách trang phải có.
- `src/pages/teams/recommended/[sourceConfigId].astro` và
  `src/pages/teams/legacy/[legacyTeamId].astro` sinh `getStaticPaths` từ catalog; trang
  recommended truyền `entry.sourceConfigId` xuống `data-source-config-id`.
- `js/team-detail.js:37` đọc định danh từ `root.dataset` — **không** parse URL, nên đổi
  segment không đụng logic tải dữ liệu. Nhưng cùng file vẫn nối cứng
  `/teams/legacy/${legacyTeamId}/` ở `:93` (action `Xem đội gốc` ở nhánh `?variant=`, có
  e2e phủ tại `tests-e2e/team-detail-pages.spec.mjs:224-245`), và
  `js/recommended-reference-render.js:272` cũng nối cứng cùng path cho mục "Nội dung đội gốc
  đã đối chiếu" — hiện chưa chạy vì 0/1366 hàng có `legacyReferences`, nhưng vẫn phải sửa.
- `js/app.js` **không** chạy trên trang chi tiết: `index.astro` và `SiteLayout.astro` là hai
  shell khác nhau (`index.astro` tự viết `<head>`, không dùng layout). Vì vậy bảng handle
  phải có mặt ở cả hai surface, nếu không hai link đội gốc ở trên không dựng được href.
- `npm run build` chạy `python3 -m pipeline.site_localization check --root . --stage public`
  **trước** `astro build`; gate này pin `sourceFiles` (hash), `routeFamilies` (đường dẫn file
  trang), `baseline.notes.concreteInventorySha256` và fingerprint/receipt của 9 obligation
  `ui:route-*` theo **đường dẫn** hai file trang. Đổi tên file mà không refresh ⇒
  `FileNotFoundError` trong `ui_source_locations`, không có `dist`.
- `js/team-detail-navigation.js:26-29` dựng href; `docs/code-standards.md:15` cấm nối
  `/teams/...` ở chỗ khác. `:188` `migrateLegacyReferenceUrl` cũng đi qua `teamDetailHref`.
- `js/app.js:279` `referenceHref` dựng href cho lưới thẻ; `:347-348` truyền vào hai section;
  `:377` dựng href cho kết quả tra cứu legacy.
- `src/pages/index.astro:69-71` đã dùng mẫu `<script is:inline type="application/json" id=…>`
  để nhúng pin build-time — dùng lại đúng mẫu này cho bảng handle.
- `public/_headers` đang phủ `/teams/recommended/*` và `/teams/legacy/*`.
- Kích thước đo được của map handle trần `{"r":{…},"l":{…}}` là **58.3 KB**; payload
  runtime phải thêm `SC-` vào 1366 giá trị Recommended để thành final route segment, nên
  budget bảo thủ là **<75 KiB** trên root. Bản legacy-only vẫn ~4.4 KB.

## Files

- Modify: `src/lib/team-detail-routes.ts` — đọc ledger phase 1 qua option `handlesPath`;
  mỗi entry giữ `routeSegment`, `routePath`, `htmlPath` từ cùng một phép dựng, cùng
  `sourceConfigId` / `legacyTeamId` cho data attribute. Cache mặc định chỉ dùng khi
  `recommendedRoot`, `teamsPath` và `handlesPath` đều là mặc định; fixture/custom project
  root phải truyền đủ ba nguồn.
- Create: `src/pages/doi-chuan/[team].astro` — chuyển từ `src/pages/teams/recommended/[sourceConfigId].astro`.
- Create: `src/pages/doi-khac/[team].astro` — chuyển từ `src/pages/teams/legacy/[legacyTeamId].astro`.
- Delete: `src/pages/teams/recommended/[sourceConfigId].astro`, `src/pages/teams/legacy/[legacyTeamId].astro`.
- Modify: `js/team-detail-navigation.js` — thêm `setTeamRouteHandles(map)`; `teamDetailPath`
  tra final route segment từ map. Giữ nguyên `teamDetailHref`, `safeReturnUrl`,
  `familyReturnHref`, `migrateLegacyReferenceUrl`, `captureReturnSnapshot`.
- Modify: `src/pages/index.astro` — nhúng map final route segment `{r, l}` dựng từ catalog.
- Modify: `src/layouts/SiteLayout.astro` — nhúng map **legacy route segment** (`l`, ~4.4 KB)
  cho `pageKind === 'detail'`; trang chi tiết không nạp `app.js` nên phải tự có map.
- Modify: `js/app.js` — nạp map route segment trước khi dựng section.
- Modify: `js/team-filter-section.js` — đổi selector delegation
  `a[href^="/teams/"]` sang marker ổn định của link chi tiết (không pin path segment), để
  click route mới vẫn ghi return snapshot.
- Modify: `js/team-detail.js` — nạp bảng handle trước khi render; thay path cứng ở `:93`
  (`/teams/legacy/…`) bằng `teamDetailPath`.
- Modify: `js/recommended-reference-render.js` — thay path cứng ở `:272`
  (`/teams/legacy/…`) bằng `teamDetailPath`; import từ `js/team-detail-navigation.js`
  (module này không phụ thuộc gì nên không tạo vòng import).
- Modify: `public/_headers` — thay hai wildcard `/teams/...` bằng `/doi-chuan/*` và `/doi-khac/*`.
- Modify: `pipeline/site_localization.py` — 9 entry `ui:route-*` trong `UI_LITERAL_OBLIGATIONS`
  trỏ sang hai file trang mới (literal nguồn không đổi).
- Modify: `pipeline/site-localization-policy.json` — `sourceFiles`, `routeFamilies`,
  `baseline.notes.concreteInventorySha256`.
- Modify: `pipeline/site-translations.json` + `pipeline/site-translation-reviews.json` +
  `pipeline/localization-reviews/*` — refresh 9 fingerprint `ui:route-*` kèm receipt review
  độc lập (xem Step 7).
- Modify: `tests-js/team-detail-navigation.test.mjs`, `tests-js/team-detail-routes.test.mjs`,
  `tests-js/pages-headers-contract.test.mjs`, `tests-js/astro-dist-contract.test.mjs`,
  `tests-e2e/team-detail-pages.spec.mjs`, `tests-e2e/recommended-browser.spec.mjs`,
  `tests-e2e/site-localization.spec.mjs`, `tests-e2e/spa-parity.spec.mjs`.
- Modify: `docs/code-standards.md`, `docs/deployment-guide.md`, `README.md`.
- Intentionally unchanged: `js/recommended-reference-state.js`, `src/pages/404.astro`,
  `astro.config.mjs`, payload generation đang pin. Refresh contract localization phải tạo
  successor generation provenance-only theo strict publisher; giữ nguyên generation cũ,
  chứng minh mọi payload byte-identical, rồi rebind duy nhất `generationId` của route ledger
  và baseline generator trước khi build.

## Shared contract

### Đường dẫn

```
/doi-chuan/{SC}-{handle}/     cho Đội chuẩn
/doi-khac/{handle}/           cho Đội khác
```

`SC` lấy từ `sourceSeasonCode` của hàng, viết thường, ký tự ngoài `[a-z0-9]` → `-`
(`PK-S28` → `pk-s28`, `OG` → `og`). Handle lấy từ ledger phase 1.

### Catalog fail-loud

`teamDetailCatalog({recommendedRoot, teamsPath, handlesPath})` phải ném lỗi khi: tập khoá
`handles.recommended` khác chính xác tập `index.records[*].sourceConfigId`; tập khoá
`handles.legacy` khác chính xác tập `data/teams.json[*].id`; `generationId` hoặc
`legacyTeamsSha256` lệch; handle không qua `isRoutableIdentifier`; hoặc emitted route path
trùng (`SC + handle` cho Recommended, handle cho legacy). Lỗi phải nêu khoá thiếu/thừa/trùng.
Mỗi entry expose `routeSegment`; `routePath` và `htmlPath` phải được dựng từ field này, không
parse ngược pathname. `teamDetailHtmlPaths` nhận cùng option.

### Bảng handle ở runtime

Schema chính xác: `r` là map `sourceConfigId -> final route segment` (ví dụ
`team-b8ink3 -> pk-s24-tu-ma-phi-hung`), `l` là map `legacyTeamId -> final route segment`
(ví dụ `team-intro-… -> hoang-ma-thuong`). Giá trị `r` **phải chứa `SC-`** vì các caller
runtime và legacy-query migration chỉ có `sourceConfigId`, không có `sourceSeasonCode`;
map handle trần sẽ không đủ dữ liệu để dựng URL. Cả hai map dựng từ post-validation catalog,
không tự ghép mùa lần nữa trong Astro.

Hai surface dùng payload khác nhau — vì `js/app.js` **không** chạy trên trang chi tiết:

```html
<!-- src/pages/index.astro (root): cần cả hai -->
<script is:inline type="application/json" id="team-route-handles" set:html={JSON.stringify({r: recommendedRouteSegments, l: legacyRouteSegments})}></script>

<!-- src/layouts/SiteLayout.astro, chỉ khi pageKind === 'detail': chỉ cần legacy -->
<script is:inline type="application/json" id="team-route-handles" set:html={JSON.stringify({l: legacyRouteSegments})}></script>
```

`setTeamRouteHandles(map)` validate toàn payload rồi **replace atomically**, không merge:
family phải là object thường; khoá và final segment là chuỗi routable; final segment trong
từng family không trùng. Payload malformed không thay registry hiện hành. Registry chưa
khởi tạo, family/identity không có, phần tử thiếu hoặc JSON parse lỗi ⇒ `teamDetailPath` trả
`null`, tuyệt đối không fallback về ID cũ.

Cả hai entry đăng ký map trước lần dùng đầu tiên: `js/app.js` phải làm trước
`migrateLegacyReferenceUrl`, tạo hai section và nhánh lookup legacy; `js/team-detail.js` phải
làm trước `load()`. Direct unit/e2e import `recommended-reference-render.js` có
`legacyReferences` phải gọi `setTeamRouteHandles({l:{...}})` trong setup.

Vì sao chỉ `l` trên trang chi tiết: hai chỗ dựng link đội gốc đều nằm trên trang chi tiết —
`js/team-detail.js:93` (action `Xem đội gốc` ở nhánh `?variant=`) và
`js/recommended-reference-render.js:272` (mục "Nội dung đội gốc đã đối chiếu"). Chúng chỉ cần
legacy route segment. Nhúng cả `r` vào layout sẽ cộng gần 70 KiB vào **từng** trang
(1366 trang ⇒ hơn 90 MB `dist`) mà không dùng đến.

Budget runtime: `{r,l}` final-segment map < **75 KiB** (phải đo lại sau build); `{l}` ~4.4
KB. Nếu sau này root page thành vấn đề, chuyển sang `/data/route-handles.json` sinh ở build —
nhưng phải đi qua inventory có gate (`src/lib/root-static-artifacts.ts`), nên chỉ làm khi có
bằng chứng cần.

### Return snapshot và migrate

`from` vẫn là URL root kèm query/hash như cũ; `safeReturnUrl` không đổi. `migrateLegacyReferenceUrl`
vẫn chuyển `?detail=` / `?legacyTeam=` sang route mới qua `teamDetailHref`. URL cũ dạng
`/teams/recommended/<id>/` **không** được chuyển hướng: trả 404 tĩnh như hợp đồng.

## Steps

- [x] Sửa `team-detail-routes.ts` đọc ledger qua `handlesPath`, đổi
      `recommendedRoutePath`/`legacyRoutePath`, kiểm exact key-set/hash/generation/routability/
      emitted-path uniqueness. Cập nhật `teamDetailHtmlPaths` và mọi custom-root caller,
      đặc biệt `scripts/verify-astro-dist.mjs`, để truyền ledger thuộc cùng project root.
- [x] Đổi tên hai trang Astro sang `src/pages/doi-chuan/[team].astro` và
      `src/pages/doi-khac/[team].astro`; đổi tên tham số route; giữ nguyên các `data-*`.
- [x] `js/team-detail-navigation.js`: thêm registry schema/replace fail-closed ở trên và tra map
      trong `teamDetailPath`.
- [x] `src/pages/index.astro` nhúng final-segment map `{r, l}` dựng từ catalog; `js/app.js`
      parse + đăng ký trước `migrateLegacyReferenceUrl` và mọi lần dựng href.
- [x] `SiteLayout.astro` nhúng `{l}` cho `pageKind === 'detail'`; `js/team-detail.js` đăng ký
      map trước `load()` rồi thay path cứng `:93` bằng `teamDetailPath`;
      `js/recommended-reference-render.js` thay path cứng `:272` bằng `teamDetailPath`;
      `js/team-filter-section.js` dùng marker link chi tiết thay selector `/teams/`.
- [x] `public/_headers`: thay hai rule wildcard.
- [x] **Refresh contract localization** — bắt buộc, vì bước 2 đổi đường dẫn file mà gate
      localization pin theo đường dẫn. `npm run build` chạy gate này **trước** `astro build`,
      nên bỏ qua bước này thì không có `dist` để kiểm:
      1. `python3 -m pipeline.site_localization inventory --root . --report .cache/site-localization-inventory.json`
         → đọc `unknownLocationDetails[].actual` để lấy `concreteInventorySha256` mới.
      2. `pipeline/site_localization.py`: 9 entry `ui:route-recommended/*` + `ui:route-legacy/*`
         trong `UI_LITERAL_OBLIGATIONS` đổi `relative` sang hai file mới. Literal nguồn
         (`"— Team chuẩn —"`, `tagline="Chi tiết Team chuẩn"`, …) không đổi và vẫn phải có mặt
         trong file mới.
      3. `pipeline/site-localization-policy.json`: thay hai khoá Astro cũ bằng hai khoá mới
         trong `sourceFiles` (hash mới), refresh hash cho mọi file pin mà phase này sửa
         (`js/app.js`, `js/team-detail.js`, `js/recommended-reference-render.js`,
         `js/team-filter-section.js`, `src/layouts/SiteLayout.astro`,
         `src/lib/team-detail-routes.ts`, `src/pages/index.astro`), giữ đủ
         `REQUIRED_OWNER_FILES`; đổi `routeFamilies[].page` / `.entrypoints` /
         `locations[].owner.file` sang path mới; cập nhật `baseline.notes.concreteInventorySha256`;
         bump `policyVersion`.
      4. `pipeline/site-translations.json`: tính lại `inputFingerprint` cho đúng 9 entry
         `ui:route-*` (fingerprint băm cả `context.sourceFile`). Nguồn chuẩn để lấy giá trị đúng
         là `expected_fingerprints(site_translation_obligations(root, pack), glossary_digest(root, policy))`
         trong `pipeline/site_localization.py` — đừng tự dựng lại payload context. Giữ nguyên
         `textVi` và khối `review`: nội dung dịch và semantic check không đổi, chỉ owner đổi.
      5. Receipt: 9 location đó hiện nằm trọn trong batch `site-review-v5-056`
         (`pipeline/site-translation-reviews.json`). Reviewer độc lập refresh đúng 9 item rồi
         sinh lại `pipeline/localization-reviews/site-review-v5-056.json`; hai phía phải khớp
         `entityId`, `fieldPath`, `glossaryDigest`, `inputFingerprint`, `textSha256`, `verdict`,
         và `outputSha256` phải bằng bytes output. Mỗi location chỉ thuộc đúng một receipt.
      6. Gate riêng của bước này: `python3 -m pipeline.site_localization check --root . --stage public`
         phải xanh **trước** khi chạy `astro build`.
      7. Vì policy/receipt là input của generation provenance, build + check candidate stage
         `all`, chứng minh payload Recommended byte-identical và site values/source hashes
         không đổi, rồi publish successor bằng strict publisher. Giữ generation cũ bất biến.
         Rebind `pipeline/team-route-handles.json.generationId` và baseline generation trong
         `pipeline/team_route_handles.py` sang successor; mọi handle/hash/note giữ nguyên.
- [x] Cập nhật 4 test `tests-js` và 4 spec `tests-e2e` sang path mới. Bổ sung fixture ledger
      cùng root cho catalog/dist tests; test exact key-set thiếu/thừa, hash/generation lệch,
      route trùng; test registry uninitialized/malformed/unknown/valid và direct renderer với
      `legacyReferences`. Riêng khẳng định link đội gốc ở
      `tests-e2e/team-detail-pages.spec.mjs:224-245` phải trỏ `/doi-khac/…`, không được xoá.
      E2E phải chứng minh click card route mới vẫn ghi/khôi phục snapshot.
- [x] Cập nhật docs: `docs/code-standards.md` (dòng mô tả route), `docs/deployment-guide.md`
      (mô tả route, danh sách `_headers`, checklist preview), `README.md` (hai dòng mô tả URL).
- [x] `npm run build` rồi `npm run verify`; đếm số trang sinh ra.

## Success criteria

- `npm run verify` xanh; `dist` có đúng **1366** trang `doi-chuan/*/index.html` và **166**
  trang `doi-khac/*/index.html`.
- Không còn file nào dưới `dist/teams/`.
- `python3 -m pipeline.site_localization check --root . --stage public` xanh với policy/ledger/
  receipt đã refresh (đây là gate thật sự chặn `npm run build`).
- `npm run test:node` xanh.
- `npm run test:e2e` xanh.
- Mở `/doi-chuan/pk-s24-tu-ma-phi-hung/` trực tiếp: tiêu đề đúng đội, `data-source-config-id`
  trên `#team-detail-root` vẫn là ID nguồn, link "Nguồn: sgsdeck.com" trỏ
  `https://sgsdeck.com/recommended/team-b8ink3`.
- Trên trang gốc, mọi anchor thẻ đội trỏ `/doi-chuan/…` hoặc `/doi-khac/…`; click primary
  không modifier vẫn ghi snapshot và quay lại đúng query/hash/tab/scroll.
- Trên trang chi tiết: link "Xem đội gốc" ở `/doi-khac/<handle>/?variant=<vid>` trỏ đúng
  `/doi-khac/<handle>/` (không phải `/teams/…`, không rỗng); direct renderer có
  `legacyReferences` cũng dựng cùng path.
- `/teams/recommended/team-b8ink3/` trả trang 404 tĩnh.

## Failure protocol

Trang sinh ra lệch 1366/166, hoặc `verify-astro-dist` báo thiếu/thừa trang ⇒ **STOP**.
Không nới validator để build xanh. Báo lại kèm: danh sách path lệch, handle liên quan, và
nhóm `(SC, base)` sinh ra nó.

Gate localization đỏ vì inventory pin ⇒ **STOP** và refresh theo Step 7 (policy + ledger +
receipt có review). Không tự refresh fingerprint để né review — `docs/season-team-data.md`
cấm đúng việc đó; cũng không sửa `baseline` cho khớp mà không có receipt.

## Trạng thái hoàn tất

Đóng ngày 2026-09-22. Cả mười step đã xong, không có mục nào chưa gán vào checklist.

- Cutover sạch: `src/pages/doi-chuan/[team].astro` và `src/pages/doi-khac/[team].astro` thay
  hai file dưới `src/pages/teams/`; `dist/teams/` không còn và `js/` không còn chuỗi `/teams/`
  nào.
- Catalog fail-loud giữ nguyên hợp đồng exact key-set/hash/generation/routability/emitted-path
  uniqueness; registry runtime `setTeamRouteHandles` / `setTeamRouteHandlesFromJSON` thay nguyên
  khối và `teamDetailPath` trả `null` thay vì fallback về ID cũ. Map được nhúng ở
  `index.astro` (`{r,l}`) và ở `SiteLayout.astro` cho `pageKind === 'detail'` (`{l}`).
- `public/_headers` phủ `/doi-chuan/*` + `/doi-khac/*`. Chín obligation `ui:route-*` trong
  `pipeline/site_localization.py` trỏ hai file mới; policy/ledger đã refresh và receipt
  `pipeline/localization-reviews/site-review-v5-056.json` đã sinh lại theo review độc lập;
  không obligation nào đổi `textVi`.
- Bốn test `tests-js` và bốn spec `tests-e2e` đã chuyển sang path mới, gồm khẳng định link
  "Xem đội gốc" trỏ `/doi-khac/…` và phép kiểm click card route mới vẫn ghi/khôi phục
  snapshot; `docs/code-standards.md`, `docs/deployment-guide.md` và `README.md` đã mô tả path
  mới.
- Gate chốt: `python3 -m pipeline.site_localization check --root . --stage public` xanh;
  `npm run verify` đếm đúng 1366 trang `doi-chuan` + 166 trang `doi-khac`; `npm run test:node`
  302/302; `npm run test:e2e` 138/138; phiên trình duyệt smoke mới xanh.
