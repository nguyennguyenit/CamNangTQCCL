---
title: "Tra cứu đội hình theo mùa và kịch bản"
description: "Tra cứu đội theo kịch bản và phiên bản luật đã xác minh"
status: completed
priority: P1
effort: ""
tags: [frontend, database, api]
branch: main
blockedBy: []
blocks: []
created: 2026-09-07
---

# Tra cứu đội hình theo mùa và kịch bản

## Trạng thái — 2026-09-12

**Completed: cả bốn phase đã hoàn thành, gồm real clean-source release validation.** Invocation `--auto --advice --tdd`; Kongming được giao quyền quyết định. Người dùng đã cho phép worktree riêng và commit local bền vững để đóng gate; không push, merge, deploy hoặc bypass guard. [Bằng chứng đóng release](reports/isolated-release-closure.md).

Outcome: chọn kịch bản/ruleset → lọc đội → nhóm tier → cấu hình cụ thể → đối chiếu kho. Phạm vi Team PK, Meta phe cũ, Cùng Tồn, soi đội, gợi ý kho và Research MCP. Giữ ID/hash/no-context cũ; không thêm backend, hợp nhất danh mục hoặc suy luật/tier/lịch phát hành. Strict clients phải refresh discovery/schema output v2.

Dữ liệu hiện tại: một kịch bản VN Binh Diễn Xuân Thu; **0 ruleset/config/evaluation reviewed**, năm nhóm tham khảo mới/25 đội/75 vị trí. Khoảng trống là trạng thái được hỗ trợ: cơ chế scoped execution đã triển khai và fixture-test, chưa có gợi ý gameplay VN đã xác minh. Chín artifact legacy giữ nguyên bytes.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Registry và phiên bản luật](phase-01-start.md) | Completed |
| 2 | [Cấu hình và đánh giá đội](phase-02-season-team-configurations.md) | Completed |
| 3 | [Tra cứu trên giao diện](phase-03-season-lookup-interface.md) | Completed |
| 4 | [MCP và kiểm chứng](phase-04-mcp-and-release-validation.md) | Completed |

Thứ tự checkpoint 1 → 2 → UI/MCP consumers → parity/release closure. Năm sidecars/resolver đã được khai báo cùng outputs; shell kiểm nguyên generation trước activation. Không tự promote dữ kiện game từ test fixtures.

## Acceptance và bằng chứng

- [x] Kịch bản độc lập ruleset; chọn lại kịch bản cũ, không mặc định số mùa lớn nhất. Reviewed-pair behavior có fixture evidence.
- [x] Cùng teamId giữ các cấu hình/tier riêng; conflict chưa review trả null; không mượn tier lịch sử cho scoped config.
- [x] Team PK, Meta phe cũ, Cùng Tồn, match/recommend dùng chung scope; đổi scope vô hiệu kết quả/confirmation, giữ inventory.
- [x] Legacy hashes, scan state, IDs, MCP input no-context và fixture release v1 giữ parity; migration output schema v2 đã kiểm chứng.
- [x] Public manifest, snapshot/schema v2, workflow bindings/cursor đồng bộ; local behavioral/build/type/artifact checks đạt.
- [x] Ambiguity choices bounded xuyên CLI/stdio/HTTP; shared cap 500 sau scope/eligibility, không silent slice.
- [x] Real clean-source asset build/verification và toàn bộ repository gate gồm Wrangler dry-run đạt trên commit `f2741f5`; [closure](reports/isolated-release-closure.md) phân biệt full behavioral gate với final-HEAD packaging. Các lỗi `SOURCE_NOT_CLEAN`/thiếu assets trước đây được giữ trong lịch sử.

[Final validation](reports/final-validation.md): MCP351, Workerd3, Node186, Python187, Vision53, dist13, E2E55; check/build/typechecks pass, verify43 files/40raw assets,9legacy hashes unchanged. [Validation timeline](reports/validation.md) phân biệt checkpoint và full gate. Không coi guard rejection là release Green.

TDD giữ Red → Green → Refactor cho lỗi/hành vi mới. **Ngoại lệ chronology đã công khai:** 11 resolver cases đầu và các regression bổ sung không có pre-code Red riêng; không tính missing-module/setup errors là Red. [Resolver](reports/phase-02-resolver-validation.md), [UI](reports/phase-03-ui-validation.md), [MCP](reports/phase-04-mcp-validation.md), [release](reports/phase-04-release-tooling.md) ghi đúng lịch sử; Kongming đã chấp nhận tiếp tục.

## Quyết định đang áp dụng

Người dùng đã trả lời **YES**, quyền nguồn bao gồm Recommended trên website. Câu hỏi quyền nguồn đã đóng; chỉ promote score khi có bằng chứng đúng config/context/selection. [Quyết định thực thi cập nhật](reports/execution-decisions.md).

- Scenario-only cho xem tham khảo có nhãn chưa xác minh luật; chỉ reviewed pair tạo effective seasonContext. Restore URL không tự nâng pair; selector chung, không fallback legacy ngầm. [Quyết định thực thi](reports/execution-decisions.md) chốt phương án từng được đề xuất trong [planning contract](reports/coexist-planning-contract.md).
- Người dùng chọn luồng SGSDeck Recommended ngày 2026-09-07; thay sao đánh giá đội bằng **Điểm SGSDeck** đúng config/context/selection, giữ giá trị gốc kể cả trên 100. Quyết định 2026-09-12 12:47 giữ nhãn/nguồn ở phần đội; chỉ ẩn nguồn ở danh mục thống nhất. Khai hoang dùng hướng dẫn mới nhất, không chia mùa/hiện nguồn. Chi tiết giữ trong phase 2–3 và [snapshot index cũ](reports/pm-260912-1419-season-plan-sync.md).
- Cùng Tồn giữ corpus cũ unknown; source-owned sidecar mới giữ raw slots/điều kiện/cải tạo, không tự thành canonical config/tier/score. [Nguồn](reports/coexist-source-research.md), [owner inventory](reports/coexist-owner-verification.md), [data inventory](reports/phase-02-data-validation.md).

## Phụ thuộc và ranh giới

Catalog SGSDeck (tài liệu ngoài nhánh: `../260907-0228-sgsdeck-catalog/plan.md`) sở hữu sáu danh mục/identity nguồn; plan mùa sở hữu scenario/ruleset/config/evaluation và Recommended evidence. Chỉ config dùng thực thể mới cần identity reviewed; không chặn toàn plan hoặc tạo vòng phụ thuộc. Đối chiếu danh mục (tài liệu ngoài nhánh: `../reports/analysis-260912-1142-unified-lookup.md`) và metadata owner `docs/sgsdeck-catalog.md` giữ nguồn riêng.

Tra cứu thống nhất (tài liệu ngoài nhánh: `../260912-0607-unified-lookup/plan.md`) sở hữu hợp nhất sáu danh mục, Việt hóa và UI danh mục; brainstorm (tài liệu ngoài nhánh: `../reports/brainstorm-260912-1203-unified-lookup.md`) giữ policy nguồn. Serialize owner edits ở app/render/identity/manifest/Worker packaging. Lookup rollback phải kiểm refs mùa trước khi bỏ IDs; orphan cần phối hợp owner rollback dependency hoặc fix forward, không tự revert season files. SGSDeck priority danh mục không đổi policy tier/score mùa.

[Tách Chạm Sứ](../260907-0236-cham-su-khai-hoang/plan.md) và [hướng dẫn Khai hoang](../260907-0353-khai-hoang-team-details/plan.md) giữ owners riêng; không khôi phục liên kết chuyển hình sai hoặc season-split Khai hoang. Research skill (tài liệu ngoài nhánh: `../260907-2333-project-research-skill/plan.md`) là scope khác; không phải điều kiện đóng implementation này.

Lịch sử plan/audit được giữ tại [prior index](reports/pm-260912-1419-season-plan-sync.md), [audit 2026-09-12](reports/audit-260912-1144-season-team-lookup.md), audit liên plan (tài liệu ngoài nhánh: `../reports/audit-260907-0310-season-catalog-plans.md`), [planning validation](reports/coexist-plan-validation.md). Các status pending/proposed trong tài liệu lịch sử không thay trạng thái thực thi hiện tại.

## Kết quả đóng

Worktree `feat/season-team-lookup` đã đạt gate trên source identity sạch, bảo toàn WIP gốc. Commit tài liệu chốt cần rebuild/verify assets và dry-run theo HEAD mới; attestation cuối lưu ngoài worktree để không tạo vòng SHA tự tham chiếu. Không cần deploy để đóng plan. Bằng chứng luật VN/config/điểm áp dụng vẫn unknown, không được điền suy đoán.

<!-- slug: season-team-lookup -->
