---
phase: 4
title: "Ô kỳ lược trên trang Đội chuẩn và MCP đội"
status: pending
priority: P1
effort: "1d"
dependencies: [2, 3]
---

# Phase 4: Ô kỳ lược trên trang Đội chuẩn và MCP đội

## Goal
Trang chi tiết Đội chuẩn có `qilue` thì hiện section "Kỳ lược", nằm giữa Đội hình và Ghi chú, ở cả bản vi và zh. Section gồm phương lược và ô cho từng hiệp, mỗi thẻ link tới trang Tra cứu. `tqccl_get_team` trả section kỳ lược đã có tên, chỉ gồm các trường được liệt kê rõ.

## Context
- Trang chi tiết chỉ render SSR. Client chỉ `adoptPrerendered()` (`js/team-detail.js:196-197`), còn `team-ssr-parity.spec.mjs` và `team-section-ssr.js` dành cho trang danh sách. <!-- Red-team F14 -->
- SSR: `src/lib/team-ssr.ts:98-110` (`recommendedDetailParts`). Builder: `js/recommended-reference-render.js:681` (`recommendedTeamDetailContent`), options hiện có là `{legacyTeams, labels, lookupLinks, locale}`.
- Mã đã canonical, nên `lookupItemPath(id)` (`js/lookup-ids.js:342`) tự ra href. Vì vậy **không** thêm `TeamLookupLinks.qilue`. <!-- Red-team F6 -->
- MCP: `mcp-worker/src/data/publication-builder.ts:395-405` spread `...detail` vào record. Section đội ở `mcp-worker/src/research/team-handlers.ts` (`TEAM_SECTIONS`, `notesBlockSchema` ~l.578). <!-- Red-team F2 -->
- llms: `src/lib/llms-documents.ts:82` dùng `recommendedDetailPlainText`.

## Thiết kế
- **Bảng tra kỳ lược** `qilueTable: {id → {nameVi, nameZh, type, rarity}}`: dựng một lần từ `lookup-catalog.json` của snapshot đang ghim (`readPublicArtifact`). Phase 3 đã bảo đảm cùng candidate. Bảng được truyền vào options của `recommendedTeamDetailContent`, dùng chung cho SSR, llms và zh.
- **UI:**
  - Chip phương lược (link tới hồ sơ).
  - Dạng `ordered`: lưới "Hiệp 2…6". Mỗi ô có tên, nhãn loại có màu và dấu Hiếm.
  - Dạng `list`: chú thích "Nguồn không ghi thứ tự hiệp" cùng các chip.
  - Dạng `copy`: "Dùng kỳ lược của: <link đội>", kèm ô của đội nguồn nếu có.
  - Ở 375px lưới chuyển thành 2 hàng, không cuộn ngang. Có cả light và dark.
  - Dùng token và CSS sẵn có (`css/styles.css`).
- **Ẩn block ghi chú trùng:** block có id `hideNoteBlockId` chỉ bị ẩn trên trang chi tiết. Đội của tôi và tìm kiếm giữ nguyên (Validation Q3).
- **MCP `tqccl_get_team`:**
  - Section `qilue`: `{strategy: {id, nameVi, nameZh} | null, cards: [{round?, id, nameVi, nameZh, type, rarity}], ordered, copyFrom?: [teamId]}`.
  - Record MCP bỏ `qilue` thô và `hideNoteBlockId` ra khỏi `...detail` (dùng allowlist trường).
  - Cập nhật schema và mô tả tool.

## Tests Before (viết trước, phải fail)
- `tests-js/recommended-qilue-view.test.mjs`, theo mẫu `tests-js/recommended-before-level-20.test.mjs`:
  - Có đủ 4 dạng hiển thị.
  - href đúng `lookupItemPath`.
  - Bản zh dùng `nameZh`.
  - Đội không có `qilue` thì không có section.
  - Block `hideNoteBlockId` bị ẩn trên trang chi tiết.
- `tests-js/team-ssr-detail-qilue.test.mjs` (file mới, test `recommendedDetailParts` ở `src/lib/team-ssr.ts:103`):
  - Thứ tự section là Đội hình → Kỳ lược → Ghi chú.
  - Chữ llms có dòng kỳ lược gọn.
- `tests-e2e/team-detail-pages.spec.mjs`:
  - Ở `/doi-chuan/pk-s27-ngu-muu-ky-official-wumou-qi/`, Hiệp 2 là "Bố Trí Thập Diện", bấm vào tới trang Tra cứu. Không còn block ghi chú trùng.
  - Ở 375px không cuộn ngang.
  - Bản zh có tên chữ Hán.
- `tests-js/astro-dist-contract.test.mjs`: mọi href của ô kỳ lược trỏ tới file có thật trong site đã dựng. <!-- Red-team F6 -->
- MCP vitest:
  - `tqccl_get_team` của Ngũ Mưu Kỵ có section `qilue` đúng.
  - Record không có `hideNoteBlockId`.

## Tasks & Steps
1. Viết test, xác nhận chúng fail.
2. Dựng `qilueTable` và truyền qua options. Builder section trong `recommended-reference-render.js`.
3. Nhánh SSR trong `team-ssr.ts`/`RecommendedDetail.astro`.
4. CSS cho lưới hiệp, chip loại và dấu Hiếm.
5. Nhãn vi/zh mới ("Kỳ lược", "Hiệp", "Nguồn không ghi thứ tự hiệp", "Dùng kỳ lược của"), đi qua `site_localization` và receipt review.
6. MCP: section đội, allowlist trường, schema.

## Regression gate
- `npm run test:node`
- `npm --prefix mcp-worker test`
- `npm run test:dist`
- `npm run test:e2e -- tests-e2e/team-detail-pages.spec.mjs tests-e2e/recommended-browser.spec.mjs`
- Xem trực tiếp trên preview: mỗi dạng một đội, light và dark, 375px, vi và zh. Ảnh chụp đưa vào PR.

## Todo
- [ ] Test trước fail
- [ ] `qilueTable` cùng builder section
- [ ] SSR và Astro
- [ ] CSS
- [ ] Nhãn vi/zh có review
- [ ] Ẩn block trùng
- [ ] MCP section đội và allowlist trường
- [ ] Regression gate và ảnh chụp

## Success Criteria
Đội có `qilue` hiện section đúng dạng ở bản vi và zh. Đội không có thì trang không đổi. Không có href 404. MCP trả kỳ lược có tên.
