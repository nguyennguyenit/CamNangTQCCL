---
phase: 5
title: "Issue bổ sung, gate đầy đủ, review, PR"
status: pending
priority: P1
effort: "0.5d"
dependencies: [4]
---

# Phase 5: Issue bổ sung, gate đầy đủ, review, PR

## Goal
Danh sách đội cần bổ sung thành report + GitHub issue; toàn bộ gate xanh; review Astra → Fable; PR chờ anh duyệt.

## Steps
1. **Report + issue bổ sung** (D9): `plans/reports/doi-khac-can-bo-sung-<date>.md` sinh từ ledger + generation:
   - 20 hàng `pendingIdentity`: tướng/chiến pháp chưa xác định, kèm nguồn (video + mốc giây với đội YouTube).
   - Phương án admitted thiếu dữ liệu: tướng nào thiếu chiến pháp/binh thư, nguồn, handle (để biết URL sẽ quay lại).
   - Đội duplicate (trùng Đội chuẩn/trùng nội bộ): chỉ đếm, không đưa vào việc cần làm.
   - Tạo GitHub issue tóm tắt + link report (kiểm trùng #135, #163, #168 trước; link chéo).
2. **Gate đầy đủ**: Python (`test_recommended_team_dedup`, `test_build_recommended_reference`, `test_other_team_groups`, `test_hero_summaries`, `test_tactic_summaries`, `test_site_localization`, `test_team_route_handles`), `build_json --check`, `npm run test:node`, build, `npm run verify`, `npm run test:dist`, e2e (`doi-khac-single-season`, `team-detail-pages`, `team-ssr-parity`, `team-ssr-nojs`, `team-ssr-detail-states`, `landing`, `site-localization`), `mcp-worker`: `npm run check:repository`.
3. **Xem trên preview**: `/doi-khac/`, `/zh/doi-khac/`, `/ja/doi-khac/`; một team nhiều phương án (khối phương án khác); một handle bị loại (404); một `?variant=` cũ còn hợp lệ.
4. **PR**: số liệu trước/sau (script `reports/count-team-groups.py`), danh sách URL thành 404, hàng ledger đổi trạng thái do khóa gộp v2, báo cáo zh thiếu tên Hán (Phase 1 Requirement 8), version MCP Worker known-good.
5. **Review** Astra → Fable (ledger, generation, MCP); xử lý finding; anh duyệt mới merge (main không bắt buộc check, không dùng `--auto`).

## Verification
- Toàn bộ gate bước 2 xanh; ảnh preview đính PR; issue đã tạo.

## Rollback
- Revert merge commit; generation và ledger cũ còn trong lịch sử git; MCP về version known-good; handle không mất nên URL cũ quay lại ngay khi revert.
