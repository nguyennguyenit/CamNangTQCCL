---
title: "Đội khác: gộp team theo bộ tướng + binh chủng, chỉ hiện đội không trùng và đủ dữ liệu"
description: "Đổi đơn vị hiển thị của /doi-khac/ sang team = bộ 3 tướng + binh chủng, mỗi cấu hình khác chiến pháp/binh thư là một phương án có trang riêng, và website chỉ còn phương án không trùng + đủ chiến pháp và binh thư."
status: pending
priority: P1
effort: 6d
branch: feat/doi-khac-gop-team
tags: [feature, frontend, pipeline, doi-khac, high-risk]
blockedBy: []
blocks: []
created: 2026-11-20
---

# Đội khác: gộp team theo bộ tướng + binh chủng

## Overview

Đổi đơn vị hiển thị của `/doi-khac/` sang **team = bộ 3 tướng + binh chủng**. Mỗi cấu hình khác chiến pháp hoặc binh thư là một **phương án**, mỗi phương án vẫn là trang riêng của nó (một `legacyTeamId` ↔ đúng một `legacyVariantId`). Website chỉ còn phương án **không trùng** (admitted) và **đủ dữ liệu** (3 tướng, mỗi tướng ≥2 chiến pháp và ≥1 binh thư). Phương án còn lại ra khỏi website và vào danh sách cần bổ sung.

Số liệu trên main (generation `0386fde1`, khóa `heroIdentityId` + unit): 387 phương án admitted → 237 team; 250 phương án đủ dữ liệu thuộc 180 team (sheet 147/147, YouTube 103/240). 443 route hiện có: 56 không admitted (36 duplicate, 20 pendingIdentity) + 137 admitted thiếu dữ liệu sẽ trả 404. Số cuối cùng chốt bằng script đếm trong Phase 1 sau khi đổi khóa gộp nội bộ.

Quy tắc và quyết định do anh chốt 2026-11-20 (xem Validation Log). Bản đồ code: [reports/scout-doi-khac-code-map.md](./reports/scout-doi-khac-code-map.md).

## Quyết định thiết kế

| # | Quyết định |
|---|---|
| D1 | Builder (`build_recommended_reference.py`) gắn `teamGroupKey`, `teamGroupId`, `dataComplete`, `optionRank` vào mỗi record `other-teams.json` và thêm bảng `teamGroups`; validator builder + MCP kiểm chéo bất biến. Một nguồn cho list, chi tiết, sitemap, llms, MCP. |
| D2 | Khóa team = 3 `holders[].heroIdentityId` đã sort + `unit` chuẩn hóa ("Kỵ, Cung" → binh chủng riêng). Không có nhánh tên nguồn; identity rỗng là lỗi. |
| D3 | Gộp trùng **nội bộ** Đội khác dùng khóa v2 = tướng + chiến pháp + binh thư + unit; so với Đội chuẩn giữ khóa v1. Khi trùng hệt, giữ hàng đủ dữ liệu trước rồi mới tới Đề cử. (Đổi ledger.) |
| D4 | Mỗi phương án giữ trang riêng, canonical về chính nó. Trang hiện khối "Các phương án khác của team" với link thật tới trang của từng phương án đủ dữ liệu cùng team. Không đổi phương án tại chỗ. |
| D5 | Thứ tự phương án và đại diện team do builder tính (`optionRank`: Đề cử trước, rồi thứ tự ledger); JS dùng lại, không tính lần hai. |
| D6 | Website chỉ dựng route, thẻ, sitemap, llms cho phương án admitted + đủ dữ liệu. Phương án khác trả 404; handle giữ nguyên trong `team-route-handles.json` (không tombstone) để quay lại đúng URL khi đủ dữ liệu. |
| D7 | Hồ sơ tướng/chiến pháp (`hero-summaries`, `tactic-summaries`) chỉ tính phương án admitted + đủ dữ liệu. |
| D8 | MCP lọc theo cùng quy tắc, giữ ref `other:<legacyTeamId>`, thêm trường team; test parity Đội khác web ↔ MCP viết mới. |
| D9 | Danh sách cần bổ sung (20 pendingIdentity + phương án admitted thiếu dữ liệu) ghi thành report + GitHub issue để anh research; đội trùng thì bỏ qua. |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Pipeline: gộp nội bộ v2, khóa team, đủ dữ liệu, publish](./phase-01-pipeline-team-group-and-completeness.md) | Pending |
| 2 | [Danh sách: thẻ team, chỉ phương án đủ dữ liệu](./phase-02-list-team-cards.md) | Pending |
| 3 | [Trang chi tiết + route: phương án khác, 404 cho phương án bị loại](./phase-03-detail-team-options.md) | Pending |
| 4 | [Bề mặt phụ: sitemap, llms, landing, MCP, docs](./phase-04-secondary-surfaces-mcp-docs.md) | Pending |
| 5 | [Issue bổ sung, gate đầy đủ, review, PR](./phase-05-publish-gates-review-pr.md) | Pending |

Thứ tự tuần tự 1 → 2 → 3 → 4 → 5 (Phase 2 và 3 cùng sửa `js/recommended-reference-render.js`). Mỗi phase sửa file nằm trong `sourceFiles` của policy localization thì ghim lại hash và publish generation ở cuối phase đó.

## Non-goals

- Không gộp Đội khác vào Đội chuẩn; không đổi khóa so với Đội chuẩn.
- Không đổi `legacyVariantId`, handle, tombstone.
- Không tự bổ sung chiến pháp/binh thư (việc riêng theo issue D9).
- Không đổi Đội chuẩn, Khai hoang, Cùng Tồn.

## Success Criteria

- [ ] `/doi-khac/` (vi, zh, ja) hiện đúng số team có phương án đủ dữ liệu, bằng số tính từ `teamGroups` (script đếm trong reports); mỗi thẻ ghi số phương án.
- [ ] Mọi phương án admitted + đủ dữ liệu có trang 200, canonical về chính nó, khối "Các phương án khác của team" đúng; mọi phương án khác trả 404 và không có trong sitemap/llms.
- [ ] `/<A>/?variant=<vB>` báo lỗi, không render nội dung trộn.
- [ ] Hồ sơ tướng/chiến pháp và MCP chỉ tính/trả phương án đủ dữ liệu; test parity Đội khác web ↔ MCP xanh.
- [ ] Gate: Python (`test_recommended_team_dedup`, `test_build_recommended_reference`, `test_hero_summaries`, `test_tactic_summaries`, `test_site_localization`, `test_team_route_handles`), `npm run test:node`, build, `verify`, `test:dist` (gồm `seo-dist-contract`), e2e Đội khác/team detail/landing, `npm run check:repository` trong `mcp-worker` đều xanh.
- [ ] Report + issue danh sách cần bổ sung; docs/README cập nhật.

## Rủi ro chính

- Khoảng 193 URL `/doi-khac/<handle>/` đã công bố thành 404 (đội đã lưu trong Đội của tôi mất link): theo quyết định của anh; PR liệt kê đủ.
- Đổi ledger (khóa gộp nội bộ v2) và generation: chạy lại chuỗi publish, rebind handle.
- Merge vào main tự release MCP: ghi version known-good trước merge.

## Red Team Review

### Session — 2026-11-20
**Findings:** 26 từ 3 reviewer, gộp còn 14 (14 accepted, 0 rejected)
**Severity breakdown:** 2 Critical, 5 High, 7 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | `legacyTeamId` ↔ variant là 1:1; "trang team đổi phương án tại chỗ" sai, `?variant=` chéo đội trộn nội dung và locator | Critical | Accept | D4, Phase 2, 3 |
| 2 | Gate Phase 2–4 không thể xanh khi publish/ghim hash để Phase 5; Phase 2 và 3 cùng sửa render.js | Critical | Accept | Phase order, Phase 1–5 |
| 3 | Dedup bỏ phương án khác binh thư/unit; có thể giữ hàng thiếu thay hàng đủ | High | Accept (anh chọn đổi khóa gộp nội bộ) | D3, Phase 1 |
| 4 | 56 route không admitted không có group, chưa có quy tắc | High | Accept (anh chọn bỏ khỏi website + issue) | D6, D9, Phase 3, 5 |
| 5 | `seo-dist-contract.test.mjs` khẳng định canonical tự trỏ + llms đủ 443 URL | High | Accept | Phase 3, 4 |
| 6 | Không có test parity Đội khác web ↔ MCP; allowlist + schema strict; gate thật là `check:repository` | High | Accept | D8, Phase 4 |
| 7 | Hồ sơ tướng/chiến pháp vẫn đếm/link phương án bị ẩn | High | Accept (anh chọn lọc) | D7, Phase 1 |
| 8 | Số 238/181 sai theo khóa identity; đúng 237/180/250 | Medium | Accept | Overview, Phase 1 |
| 9 | Nhánh `name:`, "A/B", `UNRESOLVED_NAME` là code chết | Medium | Accept | D2, Phase 1 |
| 10 | Thứ tự D5 tính ở cả Python và JS; `teamGroups` không kiểm chéo | Medium | Accept | D1, D5, Phase 1, 4 |
| 11 | noindex + canonical chéo mâu thuẫn quy ước repo | Medium | Accept (D4 tự canonical, D6 404) | D4, D6 |
| 12 | Số landing do `landing-stats.ts` tính; trùng chữ "phương án thay thế" | Medium | Accept | Phase 4 |
| 13 | File JS mới nằm ngoài `sourceFiles` policy | Medium | Accept | Phase 2, 3, 5 |
| 14 | Ràng buộc render an toàn (h()/treeToHtml, link qua `referenceDetailHref`); `dataComplete` theo bản vi, bản zh có thể thiếu tên Hán | Medium | Accept | Phase 1, 3 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-05
- Decision deltas checked: 9 (D1–D9)
- Reconciled stale references: trang team đổi tại chỗ, noindex cho phương án thiếu, số 238/181, thứ tự song song, test parity "đã có"
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-11-20
1. Gộp nội bộ dedup: **xét cả binh thư + binh chủng** (đổi ledger) → D3.
2. 56 route không admitted: **bỏ khỏi website**; đội trùng bỏ qua, 20 pendingIdentity ghi vào issue để anh research → D6, D9.
3. 137 phương án admitted thiếu dữ liệu: **404**, handle giữ để quay lại → D6, D9.
4. Hồ sơ tướng/chiến pháp: **lọc theo đủ dữ liệu** → D7.
5. Áp cả 14 finding red-team.
