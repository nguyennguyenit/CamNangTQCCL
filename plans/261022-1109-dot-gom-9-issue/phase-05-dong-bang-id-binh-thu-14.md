---
phase: 5
title: "Đóng băng id binh thư (#14)"
status: done
priority: P1
effort: "2d"
dependencies: []
---

# Phase 5: Đóng băng id binh thư (#14)

## Goal

68 id `book:*` hiện tại được ghi cố định trong dữ liệu nguồn và giữ nguyên qua mọi lần build lại, đổi tên Việt, hoặc sửa tên Hán. Không chỗ nào còn suy id binh thư từ tên Việt. URL `/tra-cuu/binh-thu/<slug>/` không đổi.

## Hiện trạng (bằng chứng: [reports/scout-14-book-ids.md](./reports/scout-14-book-ids.md))

- `data/books-dict.json`: 68 dòng, không có `id`; `chinese` không trùng; `chinese` + `sourceNames` cho 125 tên không trùng.
- Generator `pipeline/build_books_dict.py:51-90` dựng dòng từ `pipeline/books-han-viet-map.json`, không có `id`; `:88` sắp theo `viet`; `:97-106` ghi đè file.
- Nơi suy id từ tên Việt:
  - `js/lookup-ids.js:18-21` `bookLookupId`; `:42-44` `bookSourceAliases`; `:147,177` resolver `bookIds` và `byVi`.
  - `pipeline/lookup_route_handles.py:79-83` `_book_id`; `:146` `mint_handles`.
  - `js/analyze-map.js:59-77` `recordEntityId` (chỉ tactic dùng `record.id`); `:164-170` `createEntityIndex`; `:385-388,410,422` `nameEntry("book", name)` (so sánh ở `~:506` cho kết quả lệch sau khi đổi tên).
  - `js/season-context.js:134-143`; `js/render.js:1013-1016`; `pipeline/season_validation.py:60-85`.
  - `js/unified-lookup.js:104-123`; `mcp-worker/src/data/publication-builder.ts:313-317` (qua `bookLookupId`); `mcp-worker/src/data/entity-identity.ts:20-33` (đã ưu tiên `recordId`, còn fallback slug tên).
- Nơi chỉ mang id (không cần đổi khi id cố định): `js/analyze-state.js:18-25,70` (link `?doi=`, lịch sử `tqccl.analyze.history.v1`), `community-worker/src/validate.ts:12`, `community-worker/src/routes/scan.ts:85-100`.
- `docs/project-changelog.md:298`: tên Hán của 3 binh thư từng bị sửa. Khóa theo `chinese` sẽ đổi id khi sửa tên Hán, nên id phải đi cùng mục trong file map, không khóa riêng theo `chinese`.
- Ledger `pipeline/lookup-route-handles.json`: 68 handle sách, mỗi slug bằng phần sau `book:`, `retired.books` rỗng, `booksSha256` khớp `data/books-dict.json`.

## Thiết kế

<!-- Updated: Red Team 2026-10-22 - bỏ fixture đóng băng và CLI --mint-id; dùng ledger làm nguồn "không mất/không tái dùng"; dùng aliases thay formerViet; xóa bookLookupId; liệt kê fixture phải chuyển -->

- Mỗi mục trong `pipeline/books-han-viet-map.json` thành object có `"id": "book:<slug hiện tại>"`. Giá trị lấy từ ledger hiện tại, không tính lại. Binh thư mới: người thêm viết `id` bằng tay (68 mục, hiếm khi thêm; không làm CLI cấp id).
- `build_books_dict.py` chép `id` sang từng dòng `books-dict.json`, không bao giờ slug lại tên. Kiểm: mục thiếu `id` → lỗi; id trùng → lỗi; id sai dạng `^book:[a-z0-9]+(?:-[a-z0-9]+)*$` → lỗi; id mới (không có trong ledger `handles.books`) mà trùng một id trong `retired.books` → lỗi (không tái dùng id đã retire cho sách khác). Nguồn "không mất / không tái dùng" là ledger `pipeline/lookup-route-handles.json`; không thêm bản sao id thứ tư trong `tests/`.
- Đổi tên: tên Việt cũ ghi vào `aliases` của mục (trường đã có ở dòng dict, đã được resolver chiến pháp và MCP builder dùng: `js/lookup-ids.js:29-36,85-107`, `mcp-worker/src/data/publication-builder.ts:243,316`). Không thêm trường mới. Kiểm facet (`pipeline/build_books_dict.py:66-70`) chấp nhận mục khi `viet` hoặc một tên trong `aliases` có trong `facets.json.books`, vì `facets.json` dựng từ HTML đội vẫn dùng tên cũ.
- Mọi consumer đọc `row.id`. `bookLookupId` bị xóa khỏi `js/lookup-ids.js`; mọi chỗ gọi sửa trong cùng PR (`js/lookup-ids.js:42,147`, `js/unified-lookup.js:111`, `mcp-worker/src/data/publication-builder.ts:314`, `tests-js/lookup-ids.test.mjs:40-41`; snapshot #21/#23 sửa ở phase 10). Dòng thiếu `id` hợp lệ: builder corpus, MCP builder, season validator fail-closed thay vì lùi về slug tên.
- Resolver tên → id cho sách: map `chinese`, `sourceNames`, `viet`, `aliases` → `row.id`. `analyze-map.nameEntry` nhận index `bookIdOf` giống `tacticIdOf`, và khóa cache (`js/analyze-map.js:398,426`) gồm cả `bookIdOf`. `bookSourceAliases` join theo `chinese`/`sourceNames`, không theo `slug(viet)`.
- `docs/unified-lookup.md` thêm quy trình: thêm binh thư mới (viết `id` tay), đổi tên (sửa `viet`, đưa tên cũ vào `aliases`), gộp/bỏ binh thư (id vào `retired`, không cấp lại).

## Files to Create / Modify

- Pipeline/data: `pipeline/books-han-viet-map.json`, `pipeline/build_books_dict.py`, `data/books-dict.json` (sinh lại), `pipeline/lookup_route_handles.py` (`_book_id` đọc `row["id"]`; `LEDGER_NOTE` `:42` nói đúng về sách; docstring `:4-6`), `pipeline/lookup-route-handles.json` (`--write` đổi `booksSha256`, `note`; handle giữ nguyên), `pipeline/season_validation.py`, `public/_redirects` (sinh lại, nội dung không đổi).
- JS/TS: `js/lookup-ids.js`, `js/analyze-map.js` (ghim), `js/season-context.js`, `js/render.js` (ghim), `js/unified-lookup.js` (ghim; sửa cả comment `:104-107`), `js/analyze.js` (ghim) và `js/community-team-data.js` nếu cần truyền index sách, `worker/eval/score.ts:56-58` (dùng `createEntityIndex`), `mcp-worker/src/data/entity-identity.ts` (bỏ fallback slug tên cho sách), `mcp-worker/src/data/publication-builder.ts:314`.
- Fixture sách không có `id` phải thêm `id` (fail-closed sẽ làm chúng đỏ):
  - `tests-js/fixtures/season-fixtures.mjs:13,16` (9 file test dùng).
  - `mcp-worker/test/fixtures/release-snapshot/books-dict.json`, kèm sinh lại sha256, byteLength, `releaseId` trong `mcp-worker/test/fixtures/release-snapshot/manifest.json:2-4,42-46` và mọi giá trị kỳ vọng suy từ chúng (14 file test dùng).
  - `tests-js/community-team-state.test.mjs:28`, `worker/test/eval-score.test.ts:15`.
  - `tests-js/analyze-map.test.mjs:28-32`, `tests-js/lookup-ids.test.mjs:47,61-66,92-96`, `tests-js/unified-lookup.test.mjs:133,376`, `mcp-worker/test/data/publication-snapshot.test.ts:331`, `mcp-worker/test/fixtures/lookup-roots.ts`, `tests/test_build_season_data.py:230`, `tests/test_lookup_route_handles.py:45-48,240`, `tests/test_build_books_dict.py`.
- Sinh lại: `mcp-worker/src/generated/workflow-build.ts` (`cd mcp-worker && npm run generate:workflow-build`).
- Publish lại bản dịch (file ghim đổi): chuỗi `docs/deployment-guide.md:251-271`, re-pin `generationId` trong `pipeline/team-route-handles.json`.
- Docs: `docs/unified-lookup.md:136` (+ quy trình ở trên), `docs/system-architecture.md:118`, `README.md:111`, `docs/deployment-guide.md:106-112`, `docs/codebase-summary.md:85`, mục mới trong `docs/project-changelog.md`.

## TDD (đỏ trước)

Python (`tests/test_build_books_dict.py`, `tests/test_lookup_route_handles.py`, `tests/test_build_season_data.py`):

1. Build từ map thật cho đúng tập 68 id bằng `handles.books` của ledger `pipeline/lookup-route-handles.json` (không dùng fixture riêng).
2. Đổi `viet` của một mục trên **map thật và `facets.json` thật** (ví dụ `Dĩ Trực Báo Oán` → `Lấy Thẳng Báo Oán`, tên cũ vào `aliases`): build qua kiểm facet; id vẫn `book:di-truc-bao-oan`; `lookup_route_handles --write` giữ nguyên `handles`, `retired` rỗng; `--check` xanh.
3. Đổi khóa `chinese` của một mục, giữ `id`: id không đổi.
4. Mục thiếu `id`, id trùng, id sai dạng, id mới trùng `retired.books` → mỗi trường hợp báo lỗi; mục có `id` mà thiếu tên không làm crash.
5. `dictionary_ids` (season validation) trả id cố định sau khi đổi tên.
6. `LEDGER_NOTE` không còn nói tên không suy ra id cho sách; `docs/unified-lookup.md` và `docs/system-architecture.md` khớp câu mới.

JS (`tests-js/lookup-ids.test.mjs`, `unified-lookup.test.mjs`, `analyze-map.test.mjs`, `analyze-state.test.mjs`, `season-context.test.mjs`, `lookup-detail-routes.test.mjs`, `astro-dist-contract.test.mjs`):

7. `createLookupIdResolver({books}).book(raw, vi)` trả id cố định sau khi đổi tên, khi tra bằng `chinese`, `sourceNames`, tên mới, tên cũ trong `aliases`; không bao giờ trả `book:<slug tên mới>` trừ khi bằng `row.id`. `js/lookup-ids.js` không còn export `bookLookupId`.
8. `buildLookupCorpus` dùng id cố định; `lookupHref(id)` vẫn `/tra-cuu/binh-thu/<slug cũ>/` sau khi đổi tên, bảng ngoại lệ vẫn rỗng.
9. Soi đội: đội tham chiếu lưu tên sách cũ, người dùng có sách id cố định → `book.status === "match"` (bắt lỗi `nameEntry`/`slugOf`).
10. Link `?doi=…_giap-sat` tạo trước khi đổi tên vẫn giải mã được và `hasId` nhận; mục lịch sử cũ vẫn tải.
11. Season JS `dictionary()` trả id cố định.
12. Fixture dist: sách trong fixture có `id`; đổi `viet` trong fixture không tạo route sách mới.

MCP (`mcp-worker/test/data/publication-snapshot.test.ts:331-344`, `test/research/entity-ref-names.test.ts`, `test/data/artifact-contracts.test.ts:144-174`, `test/fixtures/lookup-roots.ts`):

13. Entity id sách trong publication bằng id cố định sau khi đổi tên; `tqccl_get_entity` nhận id cũ; `tqccl_search` tìm được bằng tên Việt cũ (qua `aliases`, cùng kết quả với resolver site).
14. `snapshot-index` / `artifact-contracts` từ chối id trùng và không còn fallback slug tên cho sách.

## Verification

```
python3 -m pipeline.build_books_dict
python3 -m pipeline.lookup_route_handles --write && python3 -m pipeline.lookup_route_handles --check
python3 -m unittest tests.test_build_books_dict tests.test_lookup_route_handles tests.test_build_season_data
npm run test:node
(cd worker && npm test)
(cd mcp-worker && npm run generate:workflow-build && npm run check)
<chuỗi Publish lại bản dịch hiển thị>
python3 -m pipeline.team_route_handles --check
node scripts/report-zh-gaps.mjs --check   # sinh lại nếu đỏ
npm run build && npm run verify && npm run test:dist
```

`git diff pipeline/lookup-route-handles.json` chỉ đổi `booksSha256` và `note`; 68 handle sách giữ nguyên.

## Risks

- `js/analyze-map.js:116-119` `mapName` truyền `kind:"tactic"` cho mọi bản ghi không phải tướng, kể cả sách; ảnh hưởng tới `findSimilarTeams`/MCP chưa được kiểm. Thêm test hoặc sửa trong phase này nếu đụng.
- File sinh và pin bị bỏ sót (ledger, policy, `workflow-build.ts`, generation) làm `build`/`verify` đỏ. Thứ tự lệnh ở mục Verification chặn.
- Phase 6 và 10 cũng đổi `workflow-build.ts`: merge phase này trước, phase 6 rebase và sinh lại.
