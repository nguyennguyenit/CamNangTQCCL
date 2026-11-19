---
phase: 4
title: "Bề mặt phụ: sitemap, llms, landing, MCP, docs"
status: pending
priority: P2
effort: "1d"
dependencies: [3]
---

# Phase 4: Bề mặt phụ: sitemap, llms, landing, MCP, docs

## Goal
Mọi nơi khác liệt kê hoặc đếm Đội khác dùng cùng quy tắc (team, phương án đủ dữ liệu); MCP và web cùng câu trả lời; docs/README đúng.

## Requirements
- **Sitemap** (`src/pages/sitemap.xml.ts:173-182`, gồm hreflang zh/ja `mirroredSitemapPaths`) và **llms** (`src/lib/llms-documents.ts:106-111`): theo catalog route mới của Phase 3 (chỉ phương án đủ dữ liệu); `/llms/doi-khac.txt` nhóm theo team.
- **Landing**: số Đội khác tính ở `src/lib/landing-stats.ts:267,286-288` = số team; câu "đội có phương án thay thế" (`:391-392`, vi/zh/ja) đổi thành "đội có tướng/chiến pháp thay thế" để không trùng nghĩa "phương án"; cập nhật `tests-e2e/landing.spec.mjs:15,25-26,56`.
- **MCP** (`mcp-worker/src/data/publication-builder.ts:523-602`, `mcp-worker/src/data/team-source-allowlist.ts:161-168`, `mcp-worker/src/research/team-handlers.ts:178-187` schema `.strict()`):
  - Chỉ trả phương án admitted + `dataComplete`; ref giữ `other:<legacyTeamId>`; thêm `teamGroupId`, `optionCount` vào item (mở allowlist + schema + mô tả tool).
  - Validator MCP kiểm cùng bất biến `teamGroups` như builder (Phase 1 Requirement 6).
  - Regenerate `mcp-worker/src/generated/workflow-build.ts` nếu `publication-builder.ts` đổi (`WORKFLOW_SEMANTIC_FILES`).
- **Test parity mới** `mcp-worker/test/research/doi-khac-web-parity.test.ts`: tập `teamGroupId` + phương án đại diện của MCP = `otherTeamListEntries` web trên cùng generation.
- **Hồi quy**: Đội của tôi (`js/my-teams-sources.js:369-389`, `js/my-teams-links.js`) với đội đã lưu nay 404 — hiển thị không vỡ (kiểm, không đổi tính năng); Tra cứu `js/lookup-tactic-profile.js:45` chỉ còn link phương án đủ dữ liệu (do summaries lọc ở Phase 1).
- **Docs**: `README.md:9,12,14,162,167`, `docs/design-guidelines.md:28-29,53,77,82`, `docs/code-standards.md` (định nghĩa team/phương án/đủ dữ liệu, khóa gộp nội bộ v2), `docs/codebase-summary.md:83`, `docs/deployment-guide.md:111,146,364-366`, `docs/project-changelog.md`.

## Tests Before
- Sitemap/llms (trong `tests-js/seo-dist-contract.test.mjs` hoặc test sitemap hiện có): không URL phương án bị loại; đủ URL phương án còn dựng.
- `tests-e2e/landing.spec.mjs`: số Đội khác = số team.
- `mcp-worker/test/research/doi-khac-web-parity.test.ts` (mới), `team-tools.test.ts`, `team-section-build.test.ts`: tập Đội khác MCP = web; item có `teamGroupId`; schema strict nhận trường mới.

## Tests After / Regression gate
- `npm run test:node`; build; `verify`; `test:dist`; e2e landing; trong `mcp-worker`: `npm run check:repository`.

## Files
- Modify: `src/pages/sitemap.xml.ts`, `src/lib/llms-documents.ts`, `src/lib/landing-stats.ts`, `tests-e2e/landing.spec.mjs`, `mcp-worker/src/data/publication-builder.ts`, `mcp-worker/src/data/team-source-allowlist.ts`, `mcp-worker/src/research/team-handlers.ts`, `mcp-worker/src/generated/workflow-build.ts`, docs nêu trên.
- Create: `mcp-worker/test/research/doi-khac-web-parity.test.ts`.

## Cuối phase
- Ghim lại hash file đổi trong `sourceFiles` → publish generation → rebind → `--check`.
