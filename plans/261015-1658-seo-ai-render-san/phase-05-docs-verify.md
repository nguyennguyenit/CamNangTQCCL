---
phase: 5
title: "Docs, changelog, kiểm toàn bộ"
status: completed
depends_on: [4]
---

# Phase 5 — Docs, changelog, kiểm toàn bộ

- Cập nhật docs sở hữu: `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/code-standards.md` (view-tree cho builder đội/hồ sơ, ledger slug tra cứu, quy ước link path), `docs/deployment-guide.md` (bước `lookup_route_handles --check`, số trang/sitemap), `docs/season-team-data.md` nếu pipeline đổi, `README.md` nếu có số đếm, `docs/project-changelog.md` (đã có thay đổi chưa commit của người dùng — chỉ thêm mục, không sửa phần của họ).
- Chạy toàn bộ: `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:node`, `python3 -m unittest discover tests`, e2e toàn bộ, `node scripts/design-tokens.mjs --check` nếu CSS đổi, `npm run check` (astro check).
- Kiểm Done-means bằng đọc file dist (tương đương `curl -A ClaudeBot`): ghi bảng bằng chứng vào `reports/phase-05.md`.
- Cập nhật trạng thái plan.
