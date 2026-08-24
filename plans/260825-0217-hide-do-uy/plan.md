---
title: "Ẩn toàn bộ team Đô Úy khỏi website và MCP"
description: "Loại source do-uy khỏi artifact công khai, UI và mọi kết quả MCP mà không phá contract hiện có."
status: completed
priority: P1
branch: main
tags: [data, frontend, mcp, regression]
blockedBy: []
blocks: []
created: 2026-08-25
---

# Ẩn toàn bộ team Đô Úy khỏi website và MCP

## Outcome

Website và tám MCP tools tiếp tục giữ nguyên schema/tên/error contract, nhưng không còn công khai hoặc trả về team có `source: "do-uy"`. Artifact công khai giảm từ 214 xuống 166 team; 26 tier row liên quan bị loại; facet, tab và module Đô Úy không còn được publish.

## Constraints

- Giữ nguyên `pipeline/do-uy-ss18-source.json` làm nguồn curate thô, không publish và không xóa.
- Không chạy `python3 -m pipeline.build_json`: pipeline hiện chỉ dựng được 50 `team-intro` + 12 `do-uy` + 110 `moi-phe`, không tái tạo an toàn artifact đang có 56 + 48 + 110.
- Chỉ sửa đúng đường dữ liệu/publication cần thiết; giữ nguyên MCP input/output schemas, tool names, error codes và các filter contract dùng chung.
- Không deploy, commit, sửa hoặc xóa file untracked không liên quan.

## Non-goals

- Không xóa nghiên cứu, docs lịch sử hoặc raw source Đô Úy.
- Không đổi thuật toán match/recommend, tier semantics hoặc các artifact ngoài phạm vi.
- Không sửa drift sẵn có khác trong `facets.json` hay hiện đại hóa pipeline tổng thể.

## Phase

| Phase | Name | Status | Dependency |
|---|---|---|---|
| 1 | [Ẩn Đô Úy ở data, website và MCP](./phase-01-hide-do-uy.md) | Completed | None |

## Acceptance Criteria

- [x] `data/teams.json` còn 166 record và không có `source: "do-uy"`.
- [x] `data/team-tier.json` và `pipeline/team-tier-map.json` cùng loại đúng 26 `do-uy-*` record/mapping; mọi tier row còn lại join được với team còn tồn tại.
- [x] `data/facets.json` không còn source facet `do-uy`; các facet/count không liên quan được giữ nguyên.
- [x] Website không còn tab/mount/hash section Đô Úy; `js/do-uy.js` không còn trong source/public manifest/build output.
- [x] Pipeline tổng hợp không còn đưa `Team Đô Úy.html` vào `teams.json`; test khóa tổng pipeline còn 160 record (50 `team-intro` + 110 `moi-phe`) và không có `do-uy`.
- [x] MCP regression test chứng minh search, get, match, recommend-team và recommend-coexist không thể trả team Đô Úy, kể cả khi data source đầu vào bị trộn lại record `do-uy`; lookup/suggest trực tiếp ID đã ẩn trả error hiện hành.
- [x] Test contracts, frontend build/E2E cần thiết, MCP test/typecheck và kiểm tra dữ liệu đều xanh; không đổi public MCP schemas/contracts.

## Review Decision

Đặt guard MCP tại bước tạo request context, trước khi build `SnapshotIndex` và trước khi truyền corpus sang match/recommend. Đây là điểm chung nhỏ nhất bao phủ search/get/match/recommend/suggest; chỉ xóa artifact là chưa đủ để bảo vệ khi snapshot cũ hoặc nguồn dữ liệu lỗi tái xuất hiện.

## Rollback

Revert trọn thay đổi của phase. Vì raw curate source được giữ nguyên, có thể phục hồi data/module/publication từ version control; không cần crawl lại hoặc chạy pipeline tổng không an toàn.
