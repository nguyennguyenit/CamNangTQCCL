---
phase: 6
title: "MCP route sang trang riêng (#15)"
status: done
priority: P2
effort: "1d"
dependencies: [5]
---

# Phase 6: MCP route sang trang riêng (#15)

## Goal

Research MCP trả `pagePath` là trang riêng dựng sẵn `/tra-cuu/<nhóm>/<slug>/` (vi và `/zh/...`) cho mọi mục có trang; mục không có trang (`equipment-special:*`) vẫn dùng `?id=`. Builder đọc bảng ngoại lệ slug của ledger như site.

## Hiện trạng (bằng chứng: [reports/scout-15-16-12.md](./reports/scout-15-16-12.md) mục #15)

- `mcp-worker/src/data/publication-builder.ts:7,323,820-822` dùng `lookupProfilePath`; `mcp-worker/src/data/publication-projection.ts:39,799-801` assert route bằng `lookupProfilePath`.
- `js/lookup-ids.js:258-261` `lookupProfilePath`; `:269-273` `lookupDerivedSlug` (null cho `equipment-special:*`); `:277-304` bảng ngoại lệ toàn cục `setLookupRouteHandles`; `:307-315` `lookupItemPath`, `lookupHref`.
- Site đăng ký ngoại lệ ở `src/lib/lookup-pages.ts:139-148`, tính từ `src/lib/lookup-detail-routes.ts:105,128`.
- Publication dựng trong bộ nhớ: 1028 entity route; 938 có trong ledger; 90 `equipment-special:*` không có trang.
- `PublicationSources` (`publication-builder.ts:43-52`) chỉ có ledger đội (`routeLedger`), chưa có ledger Tra cứu; `publication-source-reader.ts:12-24,64-72`.
- Mô tả tool `mcp-worker/src/research/catalog-handlers.ts:248` và `docs/mcp-research-server.md:8,17` nói `pagePath` là trang nhóm.

## Thiết kế

<!-- Updated: Red Team 2026-10-22 - không dùng setLookupRouteHandles (trạng thái toàn cục qua await); dùng lại parseLookupDetailLedger; kiểm sách theo books-dict -->

- Builder nhận thêm `lookupRouteLedger` (bytes `pipeline/lookup-route-handles.json`) qua `PublicationSources` và `PublicationRoots.lookupRouteLedgerPath`.
- Parse bằng `parseLookupDetailLedger` đã export ở `src/lib/lookup-detail-routes.ts` (hàm thuần; kiểm `generationId`, `handlesSha256`, `booksSha256`). Nếu builder `mcp-worker` không import được file này (phụ thuộc Astro/Node), tách phần parse thuần sang một module JS chung trong `js/` mà cả site và builder dùng; không viết parser thứ hai. Tập id sách đối chiếu với `books-dict`, không với `lookup-manifest` (manifest không có sách).
- Route entity tính cục bộ, không đụng trạng thái toàn cục: `path = ledgerPathById.get(id) ?? lookupProfilePath(id)` (dùng `lookupDetailPath(group, slug)` đã có cho id có trong ledger); `zh = localePath(vi, "zh")`. Không gọi `setLookupRouteHandles` trong builder. Bỏ kiểm `lookupProfilePath(id) === null` ở `:323`, thay bằng kiểm id có route.
- Projection (lúc Worker chạy, không có ledger), theo quyết định đã chốt: route hợp lệ khi là `/tra-cuu/<slug nhóm của id>/<slug hợp lệ>/` cho id có trang, hoặc đúng `lookupProfilePath(id)` cho id không có `lookupDerivedSlug`. Không đổi schema manifest.
- Cập nhật mô tả tool và docs.

## Files to Create / Modify

- Modify: `mcp-worker/src/data/publication-builder.ts`, `publication-projection.ts`, `publication-source-reader.ts`, `mcp-worker/src/research/catalog-handlers.ts:248` (tất cả trong `semanticFiles`).
- Modify: `mcp-worker/test/data/publication-snapshot.test.ts:380-392`, `mcp-worker/test/fixtures/publication-sources.ts` (`writeRawCheckout` chép thêm `lookup-route-handles.json`), `mcp-worker/test/release/publication-worker-assets.test.ts:92`.
- Sinh lại: `mcp-worker/src/generated/workflow-build.ts`.
- Modify: `docs/mcp-research-server.md:8,17`; `agent-knowledge/**` nếu nhắc `pagePath` dạng `?id=` (grep trước).
- Không sửa `js/lookup-ids.js` trừ khi buộc phải.

## TDD (đỏ trước)

1. Với mọi kind có trang (hero, tactic, equipment, advisor, troop-mod, building, book): `pagePath.vi === lookupItemPath(id)`, `zh === "/zh" + vi`.
2. `equipment-special:*` (90 mục) giữ `?id=` ở cả hai locale; một tướng vẫn có path slug (chặn đổi đồng loạt).
3. Ledger tiêm một ngoại lệ (ví dụ `hero:luu-bi → luu-bi-2`): route xuất bản là `/tra-cuu/tuong/luu-bi-2/` và qua projection.
4. Projection từ chối artifact có route `?id=` cho id có trang; route profile cho `equipment-special` vẫn qua.
5. Projection từ chối route không khớp mẫu nhóm/slug.
6. Ledger lệch `generationId`, lệch `booksSha256` với bytes `books-dict`, hoặc tập id sách lệch `books-dict` → build fail.
7. Ledger bị sửa tay (slug đổi, `handlesSha256` không đổi) → builder từ chối.
8. Hai lần build chạy song song (`Promise.all`) với hai ledger khác nhau cho route đúng của từng ledger; `lookupItemPath` toàn cục của `js/lookup-ids.js` không bị builder thay đổi.
9. `FilesystemDataSource` trên `writeRawCheckout` cho cùng `releaseId` với bản đóng gói; checkout thiếu ledger → `load()` từ chối với `DATA_UNAVAILABLE`.

## Tasks & Steps

1. Làm trên nhánh riêng song song với hàng nối tiếp; merge **sau** phase 5.
2. Trước khi merge: rebase lên `main`, `cd mcp-worker && npm run generate:workflow-build`, commit file sinh.
3. Kiểm kích thước artifact `public-routes` so với `MAX_ARTIFACT_BYTES` (`publication-projection.ts:16`) và test `domain-budget`.

## Verification

```
cd mcp-worker && npm run check
npm run --silent build:worker-assets && npm run --silent verify:worker-assets
npm run check:repository        # trong CI của PR
```

## Risks

- Bảng ngoại lệ là trạng thái toàn cục của module: test 8 chặn rò.
- Artifact lớn hơn do path dài hơn: bước 3.
- Release MCP thật ở phase 11, không ở đây.
