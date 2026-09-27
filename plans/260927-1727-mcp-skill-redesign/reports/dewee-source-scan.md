# Khảo sát source MCP client của Dewee

Ngày: 2026-09-27. Repo do user cung cấp: `nextlevelbuilder/dewee`, private, truy cập read-only qua `gh` có sẵn. Default branch `dev`, pin commit `d860101f466e4d7dc43948cc0e3ae1a607e189d4`. Chỉ tải các source liên quan vào thư mục tạm; không clone vào workspace, không sửa repo Dewee, không đọc secrets.

## Kết luận

Per-user API key đã có implementation phía Dewee. Đề xuất dùng nó cho TQCCL có cơ sở source; không cần thiết kế lại MCP client từ đầu. TQCCL vẫn cần auth registry nhiều principal, scopes/quota/revocation nếu chọn cung cấp dịch vụ từng user. Chưa chạy test Dewee hoặc smoke với MCP TQCCL; source mới nhất không chứng minh binary local có cùng behavior.

## Bằng chứng

| Đường thực thi | Kết quả đọc source |
|---|---|
| [HTTP user credentials](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/http/mcp_user_credentials.go) | PUT/GET/DELETE `/v1/mcp/servers/{id}/user-credentials`; caller dùng self-service, sửa user khác có check admin/tenant membership. GET trả cờ hiện diện, không trả secret |
| [PG credential store](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/store/pg/mcp_user_credentials.go) | Lookup/upsert/delete theo server + user + tenant; mã hóa API key khi `encKey` có cấu hình; có nhánh lưu plain khi thiếu encKey, nên không khẳng định deployment luôn mã hóa |
| [Manager](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/mcp/manager.go#L249) | Require-user-credentials bỏ qua khi không có credential; server defaults được merge rồi user override; các server per-user được defer lúc startup |
| [Agent per-user tools](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/agent/loop_mcp_user.go#L85) | Load credential của actor, gắn Bearer, AcquireUser, tool objects riêng từng user và execution theo actor; không đăng ký object cá nhân vào registry chung |
| [Connection pool](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/mcp/pool.go#L109) | User key gồm tenant UUID + server UUID + user ID; kết nối đã connected có thể được reuse |
| [Grant checker](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/mcp/grant_checker.go) | Store-backed runtime check agent/user/server/tool; load error bị deny; cache có bus invalidation. Config-only mode không có store bỏ qua check này |
| [OAuth factory](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/mcp/oauth_transport.go#L221) và [AcquireUser](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/mcp/pool.go#L235) | OAuth lookup theo tenant/server; AcquireUser cũng có thể resolve factory đó rồi strip Authorization header. Không nên trộn tenant OAuth với key TQCCL từng user |
| [Client connection](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/internal/mcp/manager_connect.go) | Client tạo transport, initialize và list tools; init dùng `LATEST_LEGACY_PROTOCOL_VERSION`. Cần smoke negotiation thay vì suy ra từ protocol của public server |

## Bốn điều kiện bổ sung vào thiết kế

1. **Không có key mặc định trong bản ghi TQCCL per-user.** Cờ require-user-credentials nhận diện cả env/header, không chỉ API key. Nếu user chỉ có env/header phụ, merge vẫn có thể giữ Authorization mặc định. Để trống server-level key/Authorization, không bật tenant OAuth cùng server, validate key tại onboarding.
2. **Rotate/revoke kiểm chứng cả cache.** `getUserMCPTools` trả cache nếu connection còn connected; `AcquireUser` reuse entry theo user, không key digest. HTTP PUT/DELETE source đã đọc chỉ ghi store, chưa invalidate pool trực tiếp. Đây là khoảng trống kiểm chứng lifecycle, chưa kết luận mọi đường provisioning đều lỗi. Revoke tại provider là quyền quyết định cuối; test update làm mới connection trước rollout.
3. **Actor identity phải khớp provisioning.** `resolveActorUserID` ưu tiên SenderID cho Bitrix24, có logic group riêng. Source ghi các channel khác chưa có provisioning per-user tương tự. Không giả định dashboard ID, memory user ID và external sender ID luôn trùng nhau. Cần chốt channel đầu tiên và test group/DM/contact merge.
4. **Mã hóa phải được cấu hình thực tế.** Store PG có mã hóa có điều kiện. Xác nhận backend/key-at-rest configuration bằng kiểm tra trạng thái không lộ secret; không dựa riêng comment trong migration.

## Hai chiều MCP của Dewee

[MCP client compatibility](https://github.com/nextlevelbuilder/dewee/blob/d860101f466e4d7dc43948cc0e3ae1a607e189d4/docs/mcp-client-compatibility.md) mô tả client ngoài gọi **public MCP server của Dewee**, gồm owner-bound API key và scope `mcp.tools.read`. Tài liệu này không phải hướng dẫn Agent Dewee dùng credential để gọi server TQCCL. Public export policy của Dewee cũng không chứng minh endpoint đó tự proxy mọi tool TQCCL.

Luồng mục tiêu vẫn là: người chơi → Agent Dewee → MCP TQCCL. TQCCL cấp credential của TQCCL; Dewee lưu và gửi theo user. Không tái dùng gateway token hoặc public-MCP key của Dewee làm credential TQCCL.

## Giới hạn kiểm chứng

Đã đọc các test source `loop_mcp_user_test.go`, `pool_identity_test.go`; có actor mapping và pool identity/eviction cases. Không chạy suite, không tuyên bố tests pass hoặc transport tương thích production. Các acceptance probe hai user, revoke, rotate, channel identity, OAuth conflict, scope và feedback isolation trong [thiết kế tích hợp](../dewee-access-design.md) vẫn cần thực hiện trên deployment thật.
