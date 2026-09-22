---
title: "Đổi URL trang chi tiết đội sang slug tiếng Việt"
description: "Handle URL tiếng Việt đóng băng trong ledger, route /doi-chuan/ + /doi-khac/, refresh contract localization (policy + ledger + receipt), canonical + robots.txt + sitemap. Sửa dữ liệu binh chủng tách sang đợt riêng."
status: completed
priority: P1
effort: "3-5d + independent localization review gate"
branch: main
tags: [url, seo, routing, astro, recommended, recommended-detail]
blockedBy: []
blocks: []
created: 2026-09-18
---

# Đổi URL trang chi tiết đội sang slug tiếng Việt

## Outcome đã khóa

Mọi URL trang chi tiết đội đọc được bằng tiếng Việt và **đứng yên**:

```
/doi-chuan/og-40y-lu-bo-cung-vuong-di/
/doi-chuan/pk-s24-tu-ma-phi-hung/
/doi-chuan/pk-s28-hoang-ma/            (phe Quần, T0, 113)
/doi-chuan/pk-s28-hoang-ma-hon-hop/    (phe Hỗn hợp, T0, 113)
/doi-khac/hoang-ma-thuong/
```

- Cutover sạch: URL cũ `/teams/recommended/<id>/` và `/teams/legacy/<id>/` **không** chuyển
  hướng, trả 404 tĩnh như hợp đồng hiện có.
- Sửa `displayNameVi` về sau **không** đổi URL: handle gán một lần trong ledger rồi đóng băng.
- Không đổi payload dữ liệu Recommended và không crawl. Refresh localization được phép tạo
  successor generation chỉ đổi provenance; generation cũ phải giữ nguyên và mọi route handle
  phải được rebind byte-equivalent.
- Nguồn brainstorm: [brainstorm-260918-0030](../reports/brainstorm-260918-0030-doi-link-doi-chuan-slug-tieng-viet.md).

## Decision và dependency

### Quyết định đã chốt với người dùng

| Quyết định | Kết quả |
| --- | --- |
| Segment đường dẫn | `/doi-chuan/` + `/doi-khac/` (Việt hoá cả path) |
| URL cũ | cutover sạch, không redirect |
| Hình dạng | **phẳng** `/{bảng}/{mùa}-{handle}/` — Google không phân biệt phẳng/phân cấp về xếp hạng |
| Nội dung handle | **tên đội**, bỏ phần ngoặc mặc định; tag theo phe khi trùng |
| Đóng băng | **có** — `pipeline/team-route-handles.json` |
| Phạm vi | cả hai họ route trong cùng lần |
| Gộp kèm SEO | `canonical` + `og:url` + `og:type` + `robots.txt` + sitemap |
| Contract localization | **gộp vào phase 2** — đổi tên hai file trang buộc refresh 9 obligation `ui:route-*` (policy + ledger + receipt review độc lập) |
| Link đội gốc trên trang chi tiết | **sửa** — `js/team-detail.js:93` và `js/recommended-reference-render.js:272` đi qua `teamDetailPath`; bảng handle legacy nhúng thêm ở `SiteLayout` cho trang chi tiết |
| Snapshot click delegation | **sửa** — `js/team-filter-section.js` bỏ selector cứng `a[href^="/teams/"]`, dùng marker route ổn định |
| Thứ tự | hai đợt — URL trước, sửa dữ liệu binh chủng sau |

### Chốt theo mặc định bảo thủ

6 nhóm trùng cấu hình (3 Hoàng Mã + 3 Ôn Hầu Cung — nguồn liệt kê cùng một cấu hình hai
lần dưới hai nhãn phe) **giữ cả hai URL**, tức 1366 trang Đội chuẩn. Đây là câu hỏi dữ
liệu chứ không phải câu hỏi URL, nên thuộc đợt 2.

### Non-goals

- **Đợt 2 — sửa dữ liệu binh chủng** (42 hàng lệch `unitTypesRaw` vs troop mod, 38 hàng
  thiếu `unitTypesRaw`). Cần ledger hiệu chỉnh **và** crawl lại vì `unitTypesRaw` là
  trường `canonical` trong `pipeline/site_localization.py`, không vá được ở tầng hiển thị.
  Bằng chứng đã ghi ở brainstorm mục 5f.
- Không đổi `sourceConfigId` / `legacyTeamId` / `legacyVariantId`, link nguồn sgsdeck,
  `safeScopeKey`, cơ chế pin generation, hay `data-source-config-id` trên trang.
- Không đổi hash deep-link 8 section và query param của root.
- Không thêm dependency (không dùng `@astrojs/sitemap`).
- Không sinh trang redirect, không thêm `_redirects`.
- Không đổi nội dung dịch hay review của bất kỳ obligation nào: contract localization chỉ
  refresh **đường dẫn owner + fingerprint** cho 9 obligation `ui:route-*` và hash của các file
  đã sửa; `textVi`, semantic check và glossary không đụng tới.

## Phases

1. [Ledger route handle và bộ sinh slug khóa](phase-01-route-handle-ledger.md) — không dependency.
2. [Cutover route chi tiết đội](phase-02-route-cutover.md) — phụ thuộc phase 1. Gồm refresh
   contract localization, registry runtime và toàn bộ consumer/snapshot của route cũ.
3. [Canonical, robots.txt, sitemap và khoá release](phase-03-seo-va-release.md) — phụ thuộc phase 2.

Ba phase là ba gate tuần tự. Phase 1 và 2 chia nhau cùng một inventory route dùng chung cho
build và verifier — tách nhỏ hơn nữa sẽ tạo hai nguồn sự thật cho đường dẫn. Phase 2 ôm luôn
contract localization vì chính việc đổi tên hai file trang làm gate đó đỏ; để riêng ra thì
phase 2 không thể xanh.

## Verification contract

- Phase 1 khoá bằng `python3 -m pipeline.team_route_handles --check` + pytest.
- Phase 2 khoá bằng `python3 -m pipeline.site_localization check --root . --stage public`
  (gate này chạy **trước** `astro build`) + `npm run verify` (đếm đúng 1366 + 166 trang) +
  `npm run test:node` + `npm run test:e2e`.
- Phase 3 khoá bằng `npm run verify` (allowlist dist) + sitemap đúng 1533 `<loc>`.

Mỗi phase có literal Failure Protocol: verify đỏ thì **STOP**, không nới validator để build
xanh. Bằng chứng phải là output lệnh thật, không phải mô tả.

## Done của implementation

- 1366 trang `/doi-chuan/…` + 166 trang `/doi-khac/…` trong `dist`; không còn `dist/teams/`.
- Không hai URL nào trùng; build fail nếu ledger lệch generation/hash/key-set, handle không
  routable, hoặc emitted path trùng.
- `data-source-config-id` vẫn là ID nguồn; link "Nguồn: sgsdeck.com" vẫn đúng.
- Snapshot quay lại (`from`, scroll, tab) giữ nguyên hành vi; click delegation không pin
  `/teams/`.
- Link "Xem đội gốc" / "Xem trang đội gốc" trên trang chi tiết trỏ `/doi-khac/…`, không còn
  path `/teams/…` nào trong `js/`.
- Contract localization xanh với policy/ledger/receipt đã refresh; không obligation nào đổi
  `textVi` hay review.
- `canonical`, `og:url`, `og:type`, `robots.txt`, `sitemap.xml` đúng như phase 3 mô tả.
- `docs/code-standards.md`, `docs/deployment-guide.md`, `README.md` mô tả path mới.

## Rủi ro còn lại

Đã đóng trong đợt này, giữ lại làm ràng buộc cho các lần refresh sau:

- Bảng runtime **final route segment** (`r[sourceConfigId] = SC-handle`,
  `l[legacyTeamId] = handle`) đã nhúng ở cả hai surface, nằm trong budget root `<75 KiB`, map
  `l` ~4.4 KB trên mỗi trang chi tiết. Đường lui `/data/route-handles.json` qua inventory có
  gate vẫn để ngỏ nếu sau này root phình.
- Receipt review cho 9 obligation `ui:route-*` (batch `site-review-v5-056`) đã sinh lại theo
  review độc lập. Ràng buộc cũ vẫn nguyên giá trị: không được tự refresh fingerprint để né
  review (`docs/season-team-data.md` cấm) và không obligation nào được đổi `textVi`.

Còn mở:

- Ở 4 nhóm va chạm mà tier và điểm bằng nhau (3 nhóm Hoàng Mã + Đô Đốc Cung), bản giữ URL
  trơn chốt bằng `listIndex` rồi `sourceConfigId` — mang tính quy ước, đã ghi rõ trong
  ledger. Đổi quy ước này sẽ đổi URL đã đóng băng nên phải cân nhắc riêng.
- 42 hàng lệch binh chủng **không** được sửa ở đợt này; facet "Loại binh" vẫn sai 3% cho
  tới đợt 2.

## Theo dõi sau release (không chặn)

- Ngữ nghĩa byte của final route segment: handle ngoài ASCII được percent-encode ở URL nhưng
  ledger và catalog so sánh theo chuỗi, nên lần đầu gán một handle nhiều byte mới cần một phép
  kiểm chuyên biệt cho hai biểu diễn đó.
- Baseline giả định publication đứng yên: `--write` từ chối gán lại ledger khi generation/hash
  lệch. Nếu publication dịch chuyển vì lý do khác, phải rebind baseline theo quy trình riêng
  thay vì sinh lại handle.
- Phase 3 đã xác nhận `404.html` không có canonical lẫn `og:url` qua verifier dist; một phép
  kiểm độc lập riêng cho `og:url` (ngoài verifier hiện có) vẫn nên bổ sung ở lần chạm trang 404
  tiếp theo.

## Kết quả thực thi

Đợt 1 (URL + SEO) đã xong trọn vẹn: ba phase đều đóng, mọi step trong checklist của ba file
phase đã được đánh dấu hoàn tất và trạng thái phase/plan đã ghi vào frontmatter qua `ak plan`.
Đợt 2 (sửa dữ liệu binh chủng) vẫn nằm ngoài phạm vi như Non-goals mô tả.

| Hạng mục | Bằng chứng |
| --- | --- |
| Ledger handle đóng băng | 1366 khoá `recommended` + 166 khoá `legacy`, generation `7f02c639…`; `python3 -m pipeline.team_route_handles --check` xanh |
| Cutover route | 1366 trang `/doi-chuan/…` + 166 trang `/doi-khac/…` trong `dist`; `dist/teams/` không còn; không còn `/teams/` trong `js/` |
| Contract localization | gate `check --stage public` xanh sau refresh policy/ledger/receipt; 9 obligation `ui:route-*` đổi owner, không đổi `textVi` |
| SEO | canonical + `og:url` + `og:type` + `robots.txt` + sitemap 1533 `<loc>`; `dist/404.html` chỉ `noindex` |
| Kiểm thử | Python 48/48; Node 302/302; Playwright 138/138; `npm run verify` 1682 file; `npm run build` 1534 trang |
| Review | code review PASS 9.1 không blocker; test audit PASS (Astro 19 file, 0 error, 0 warning, 1 hint); Kongming GO sau phase; docs audit đã cập nhật |
| Smoke | phiên trình duyệt mới xanh |

## Validation Log

### Session 2 — 2026-09-22

**Trigger:** Audit lại toàn bộ plan đã sửa sau audit 2026-09-18.
**Questions asked:** 0 — các phát hiện là contract kỹ thuật xác định được từ repository,
không có trade-off sản phẩm còn mở.

### Verification Results

- **Tier:** Standard (Fact Checker + Contract Verifier)
- **Claims checked:** 26
- **Verified:** 14 | **Failed trước sửa:** 8 | **Unverified trước sửa:** 4

#### Finding đã xử lý

1. Phase 1 copy riêng thư mục generation rồi sửa `index.json` sẽ phá manifest hash trước khi
   kiểm tính độc lập bản dịch. Step 5 nay copy cả publication root và cập nhật hash chỉ trong
   bản copy.
2. Contract Python trước đây chưa ghi đủ C0/DEL và giới hạn byte của
   `isRoutableIdentifier`; validator/test nay khóa đúng regex TS.
3. Catalog chưa chỉ rõ injection ledger cho fixture/custom project root; nay có
   `handlesPath`, exact key-set/hash/generation/collision contract và cache rule.
4. `js/team-filter-section.js:278` còn selector `a[href^="/teams/"]`, làm route mới không ghi
   snapshot. File và acceptance test đã được thêm vào phase 2.
5. Registry runtime chưa định nghĩa schema/lifecycle/fail-closed và direct renderer setup;
   phase 2 nay định nghĩa replace atomic `{r,l}` và test tương ứng.
6. `SiteLayout` dùng chung cho detail và 404; canonical vô điều kiện sẽ vi phạm yêu cầu 404.
   Phase 3 nay dùng canonical prop optional, 404 chỉ `noindex` và không có `og:url`.
7. Runtime map ban đầu chỉ nói `sourceConfigId -> handle`, nhưng caller migration không có
   `sourceSeasonCode`; phase 2 nay bắt buộc `sourceConfigId -> SC-handle` final segment.
8. Dist verifier fixture sẽ thiếu `robots.txt`/`sitemap.xml` khi allowlist đổi; phase 3 nay
   bắt buộc cập nhật mọi synthetic fixture, XML MIME/escaping/set equality và baseline 1533.

### Whole-Plan Consistency Sweep

- Files reread: `plan.md`, ba file `phase-*.md`.
- Decision deltas checked: 8.
- Reconciled stale references: 8.
- Unresolved contradictions: 0.
- Recommendation: **eligible for implementation**, với gate bắt buộc là reviewer độc lập
  cho 9 receipt `ui:route-*` ở phase 2.

## Handoff

```text
/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260918-0144-doi-url-doi-chuan-slug-tieng-viet/plan.md
```
