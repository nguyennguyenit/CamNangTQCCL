# Audit hai plan catalog và tra cứu mùa — 2026-09-07

Phạm vi: đọc hai index và tám phase, đối chiếu pipeline, bộ lọc/render/engine JS và MCP contracts. Hai reviewer độc lập kiểm nguồn dữ liệu và contract; controller kiểm UI/state và tổng hợp. Không chạy test implementation vì chỉ sửa kế hoạch.

## Findings và xử lý

| Mức | Phát hiện, bằng chứng | Xử lý trong plan |
|---|---|---|
| High | Candidate identity chỉ theo teamId: `js/team-recommend-engine.js:48`, `:91`, `:119`, `:639`; MCP lấy entry.team.id tại `mcp-worker/src/domain/recommendation-service.ts:159` | Phase 2/4 quy định candidateKey=configId, giữ teamId riêng, diagnostics và provenance theo config; Red cùng team cùng context hai config |
| Medium | Thu thập Recommended chỉ là prose ở phase 2 mùa, trong khi catalog phase 2:25 chỉ giao sáu danh mục | Phase 2 mùa giao parser, evidence, fixture, cache/coverage, mismatch và failure-preservation tests |
| Medium | Config có alternatives nhưng sourceScore chưa khóa tổ hợp: phase 2 mùa:15–19 | Bind config/selection fingerprint và snapshot hash; thay tổ hợp không kế thừa điểm |
| Medium | Replacement input teamId+tacticName và service lấy match đầu: `mcp-worker/src/research/research-contracts.ts:691`, `mcp-worker/src/domain/recommendation-service.ts:227` | Config không duy nhất trả ambiguity; holder/slot selector khi cần, có Red cases |
| Medium | Xóa chip Sao chưa xử lý logic `js/filters.js:48`, state tại `:75`, tests cũ `tests-js/filters.test.mjs:33` | Phase 3 bổ sung owner state/filter/tests và URL contract; không còn sao lọc ngầm |

Accepted và đã sửa: 5 (1 High, 4 Medium). Không đảo quyết định người dùng. Không phát hiện lỗi catalog mức High cần thay kiến trúc; staged snapshot/mapping và ranh giới dữ liệu nguồn đã có kế hoạch kiểm chứng.

## Whole-Plan Consistency Sweep

Đọc lại hai plan.md và toàn bộ tám phase sau chỉnh sửa. Kiểm các delta: sourceScore selection binding, acquisition ownership, candidate identity, replacement ambiguity, star-filter migration. Metadata nguồn chung và số artifact MCP không đổi (11 + manifest). TDD giữ ở mọi phase; parser mới thuộc plan mùa, không thêm nhóm thứ bảy vào catalog. Không có mâu thuẫn còn mở trong các delta được audit. Đây là kết quả review kế hoạch, không phải bằng chứng implementation/tests đã đạt.

## Còn cần xác minh khi triển khai

Coverage Recommended theo mùa, phương thức reuse nguồn, và mapping cấu hình/luật sang VN vẫn cần bằng chứng thực theo phase 1–2. Thiếu bằng chứng giữ unknown/null, không tự gán điểm. Duyệt triển khai bao gồm thay đổi output MCP v2 đã ghi trong plan; audit không tự cấp quyền deploy.
