# Audit kế hoạch mùa và Cùng Tồn

Ngày: 2026-09-07. Scope: audit-only; không chỉnh plan/code, không chạy test/build. Đọc index và cả 4 phase hiện tại, đối chiếu source, tests và quyết định Khai hoang mới nhất. Hai reviewer độc lập phụ trách data/MCP; controller phụ trách UI/failure modes vì runtime từ chối tạo thread thứ ba với `agent thread limit reached`.

## Kết luận

**0 Critical, 0 High, 2 Medium mới.** Cần bổ sung hai contract dưới đây trước khi coi kế hoạch đầy đủ để triển khai. Những sửa chữa node budget/reference projection và mandatory-condition readiness từ vòng trước vẫn có hiệu lực, không mở lại.

## Findings được chấp nhận ở mức audit

### Medium: danh sách config khi ambiguity không có đường trả ra client

- Plan: `../phase-04-mcp-and-release-validation.md:61` hứa lỗi ambiguity có danh sách config ID bounded.
- Source: `mcp-worker/src/research/research-contracts.ts:735` có error envelope strict; `mcp-worker/src/research/research-handlers.ts:276` đổi lỗi domain thành public message; `mcp-worker/src/mcp/format-result.ts:70–102` chỉ giữ code/message/nextAction/retryable/fields; `mcp-worker/src/cli.ts:134–139,178–181` serialize riêng.
- Failure: có hai config đúng pair, bỏ configId thì service reject đúng nhưng ID lựa chọn mất trên đường ra. Đưa ID vào message hoặc fields không đáp ứng contract hiện tại (fields chỉ là tên field).
- Đề xuất: định nghĩa optional ambiguity payload bounded cho v2 từ ID canonical/config đã validate; đồng bộ error schema, domain→handler, PUBLIC_ERRORS/formatToolError và CLI. Không đổi legacy khi payload vắng. TDD phải kiểm cùng hai ID tới client qua CLI/stdio/HTTP và outputSchema, bao gồm truncation/count.
- Disposition: Accept. Đây là thiếu consumer/serializer cụ thể, không phải yêu cầu mở rộng scoring hoặc thay quyết định người dùng. Chưa áp vào plan.

### Medium: cấu hình theo mùa có thể vượt silent cap của MCP

- Plan: `../phase-02-season-team-configurations.md:86` cho nhiều config/canonical team; `../phase-04-mcp-and-release-validation.md:20` yêu cầu UI/MCP cùng projector; giới hạn ở phase 4:73 nói output reference, chưa quy định engine-input seasonal.
- Source: `mcp-worker/src/domain/recommendation-service.ts:43–47,116–120` slice 500 team/1000 tier trước engine; `js/team-recommend-engine.js:489` nhận danh sách caller đưa vào, không bảo đảm browser dùng cùng slice.
- Failure: config thứ 501 là cấu hình duy nhất phù hợp kho; UI thấy, MCP cắt mất mà không có omission diagnostic. Nếu slice trước filter, record mùa khác còn chiếm budget. Corpus mới mở rộng theo config nên bound này cần contract riêng, dù snapshot 25 đội tham khảo hiện chưa tự chạm ngưỡng.
- Đề xuất: seasonal filter/project scope trước enforce bound. Chọn một chính sách chung: reject scoped set vượt cap bằng lỗi rõ (đơn giản nhất), hoặc deterministic bounded selection giống nhau UI/MCP với omission diagnostic. Giữ legacy no-context slice. TDD 500/501 với candidate phù hợp ở cuối và nhiều record sai scope đứng trước.
- Disposition: Accept. Không tăng trần tùy tiện và không âm thầm đổi thuật toán người dùng đã chọn. Chưa áp vào plan.

## Kiểm tra còn lại

- [Data audit](audit-260907-coexist-data.md): checksum nguồn khớp; 94 CSV records, 5 nhóm/25 đội/75 vị trí. Không có duplicate payload legacy cản unique fingerprint; raw options, J semantics, identity/evidence được kế hoạch bảo vệ.
- [UI audit](audit-260907-coexist-ui.md): URL restore/auto-select, invalidation, stale response, no duplicate render và legacy fallback có invariant/TDD rõ. Khai hoang không theo mùa được giữ đúng quyết định mới, không hồi phục scope cũ.
- [MCP audit](audit-260907-coexist-mcp.md): chứng cứ đầy đủ của hai finding mới; không phát hiện confirmation bypass mới ngoài phạm vi đã được chặn.
- `ak plan validate`: valid. Markdown links trong index và 4 phase: 0 link thiếu. Đây là format check, không thay thế contract audit.
- Whole-plan read completed. Không sửa phase nên không báo một consistency sweep “đã sửa hết”; hai contract trên còn outstanding. Báo cáo validation trước là lịch sử của phiên bản trước audit này.

## Giới hạn và bước tiếp

Ruleset chính xác, scope bộ cũ và một số canonical mappings còn thiếu evidence; plan đã giữ reference thay vì suy đoán. Scenario-only browse vẫn là giả định thiết kế có nhãn rõ, không user approval. Không cần hỏi lại quyết định đã chốt về Binh Diễn Xuân Thu hay Khai hoang.

Bước tiếp theo được đề xuất: bổ sung hai contract và các owner/tests vào phase 2–4, rồi kiểm lại toàn plan. Audit này chưa cấp quyền triển khai runtime hoặc deploy.
