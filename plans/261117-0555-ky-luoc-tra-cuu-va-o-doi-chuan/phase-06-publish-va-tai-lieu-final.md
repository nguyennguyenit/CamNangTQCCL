---
phase: 6
title: "Publish, kiểm toàn bộ, tài liệu, PR"
status: pending
priority: P1
effort: "4h"
dependencies: [2, 3, 4, 5]
---

# Phase 6: Publish, kiểm toàn bộ, tài liệu, PR

## Goal
Promote lookup và publish reference trong một lượt, đúng chuỗi bước ở `docs/unified-lookup.md:105`. Cập nhật tài liệu và mở PR. Merge chính là deploy production, nên phải review trước khi merge.

## Tasks & Steps (đúng thứ tự)
1. Dựng lookup candidate rồi validate, sau đó review `generation.json`, ledger và diff. Tiếp theo promote bằng `python3 -m pipeline.promote_unified_lookup promote … --activation …`.
2. `python3 -m pipeline.lookup_route_handles --write` rồi chạy `--check`. Lần này dùng đến migration nhóm mới ở Phase 2.
3. Ghim lại `policy.sourceFiles` (`pipeline/site-localization-policy.json`) cho mọi file đã sửa, kèm receipt review. Một số file cần ghim: `js/lookup-*.js`, `js/unified-lookup.js`, `js/recommended-reference-render.js`, `src/lib/lookup-*.ts`, `LookupGroupPage.astro`, `LookupItemPage.astro`, `RecommendedDetail.astro`. <!-- Red-team F4 -->
4. Chạy chuỗi `site_localization`: `build --stage all` → `check --stage all` → `publish` → `check --stage public` → `prune`. Bước `publish` dựng lại Recommended có `qilue`, nên **không** chạy `build_recommended_reference` bằng tay.
5. Ghim lại `pipeline/team-route-handles.json` theo `generationId` mới.
6. Chạy `node scripts/report-zh-gaps.mjs`, script này sinh lại `docs/zh-gaps.md`.
7. Chạy `npm --prefix mcp-worker run generate:workflow-build` để có digest MCP.
8. Chạy `npm run verify`, `npm run test:dist`, `npm run test:e2e` (toàn bộ), `npm --prefix mcp-worker test` và `python3 -m unittest discover -s tests`.
9. Cập nhật tài liệu:
   - `docs/unified-lookup.md`: thêm mục Kỳ lược và migration nhóm route.
   - `docs/season-team-data.md`: trường `qilue`, các dạng nguồn, overrides, gate độ phủ.
   - `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/project-changelog.md`.
   - Tài liệu tool MCP nếu có.
10. Mở PR từ `feat/ky-luoc-tra-cuu-o-doi-chuan`, đóng #119 và link plan này.
    - Kèm ảnh chụp (Phase 4), danh sách đội theo dạng và kết quả gate.
    - Ghi rõ trong PR: **merge = deploy production** (Pages qua `.github/workflows/pages-deploy.yml`, MCP qua `.github/workflows/mcp-release.yml`). <!-- Red-team F3 -->
    - Rollback: revert commit merge, để auto-deploy chạy lại.
11. Review Astra → Fable. Chỉ merge khi anh duyệt.
12. Sau khi deploy, smoke các trang sau: `/tra-cuu/ky-luoc/`, một thẻ và một phương lược (vi/zh), Ngũ Mưu Kỵ cùng một đội ở mỗi dạng, và `tqccl_search`/`tqccl_get_team` trên MCP production.

## Regression gate
- Mọi lệnh ở bước 8 đều xanh, và CI PR xanh.

## Todo
- [ ] Promote lookup
- [ ] Route handles write/check
- [ ] Re-pin policy.sourceFiles
- [ ] site_localization build/check/publish/check public/prune
- [ ] Re-pin team-route-handles
- [ ] zh-gaps, MCP digest
- [ ] Toàn bộ test và verify
- [ ] Docs
- [ ] PR có cảnh báo merge = deploy
- [ ] Review Astra → Fable, anh duyệt merge
- [ ] Smoke production

## Success Criteria
PR merge với CI xanh. Production có nhóm Kỳ lược, ô kỳ lược trên trang đội, tên thống nhất với ghi chú, và MCP trả đúng. Mọi gate generation đều qua.
