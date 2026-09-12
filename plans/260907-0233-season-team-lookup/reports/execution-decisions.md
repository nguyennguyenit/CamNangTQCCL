# Quyết định thực thi — 2026-09-12

Invocation: `ak-cook plans/260907-0233-season-team-lookup/plan.md --auto --advice --tdd`; người dùng giao quyền quyết định cho Kongming.

## Hợp đồng mở đầu

Outcome: thực thi đủ bốn phase tra cứu đội theo kịch bản/ruleset, UI và Research MCP dùng chung scope. Constraints: Red → Green → Refactor theo hành vi, giữ corpus legacy/ID/hash/no-context, bounded data và 8 tool; bảo toàn WIP Node/private catalog. Non-goals: deploy, backend, hợp nhất sáu danh mục, suy luật/tier hoặc canonical identity chưa xác minh. Acceptance: registry có bằng chứng; Cùng Tồn mới 5/25/75; config-specific identity/tier/score; URL/inventory invalidation; v1/v2 snapshot, binding/cursor/errors và transport parity; full local gates.

## Kongming trước implementation

GO local implementation cả bốn phase. Chốt scenario-only reference browsing theo quyền quyết định được giao: không phải xác nhận thêm dữ kiện game. Restore URL không tự nâng sang reviewed pair. Quyết định migration schema output v2 được chấp nhận trong scope thực thi plan.

Binh Diễn Xuân Thu đã xác nhận attribution; chưa có luật VN reviewed. Legacy còn unknown. Không tạo luật theo ngày, không nhân cấu hình qua mọi mùa; inventory rỗng reviewed pair/config/evaluation phải ghi rõ khoảng trống dữ liệu.

Recommended: parser/cache-export là scope này, không mở allowlist sáu catalog. Nguồn score >100 được Kongming quan sát trên list/detail công khai. Kongming đính chính sau khi phân biệt quyền thao tác hiện tại với phạm vi sáu catalog trước đây: yêu cầu thực thi plan cho phép acquisition công khai có giới hạn; không có căn cứ áp blanket gate cho mọi Recommended intake. Terms chặn unauthorized commercial bulk/mirroring, không chứng minh tác vụ này thuộc trường hợp đó. Câu hỏi quyền nguồn đã gửi chỉ bổ sung evidence, không chặn công việc. Public score vẫn cần đúng config/context/selection; không tuyên bố open license.

## Baseline/scout

Astro shell + vanilla JS/CSS, Python stdlib data, TypeScript MCP/Vision workers. Owners: season builder mới, shared resolver mới, engine hiện có, app/filter/render/scan state, MCP data/domain/research/transport/release. Exact public inventory phải cập nhật cùng file. Xem `baseline-tests.md`: Node52/Python126/MCP75 passed. Không tính baseline là seasonal Green. `execution-baseline.json` giữ SHA-256 chín artifact legacy trước chỉnh sửa.

Node24.20.0 đúng yêu cầu. Working tree main tại f221c2f có WIP Node/private SGSDeck và plan trước đó; không stage/commit/revert. Không có task tracker phù hợp; dùng plan CLI và reports.

## Xác nhận phạm vi Recommended — 2026-09-12

Người dùng trả lời trực tiếp câu hỏi quyền lưu và hiển thị cấu hình/điểm Recommended: **“Có, bao gồm Recommended trên website”**. Phạm vi ủy quyền của tác vụ bao gồm Recommended, không chỉ sáu catalog private. Câu hỏi quyền nguồn đã đóng; không yêu cầu xác nhận lại. Đây là xác nhận của người dùng về phạm vi sử dụng, không phải tuyên bố nguồn có open license.

Quyền sử dụng không thay thế evidence về identity, config, ruleset VN hoặc scored selection. Giữ điểm gốc và provenance; chỉ công bố điểm gắn cấu hình khi các điều kiện đối chiếu đã đạt. Không tự promote 25 record nguồn TW thành cấu hình hoặc điểm VN.

## Dữ kiện còn thiếu

Bằng chứng ruleset VN và config áp dụng còn thiếu; không chặn hành vi unknown/reference đã triển khai. Không còn câu hỏi quyền Recommended đang chờ người dùng.
