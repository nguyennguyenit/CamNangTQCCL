# Tích hợp Dewee và cấp quyền MCP theo người dùng

Ngày: 2026-09-27. Trạng thái: đề xuất để quyết định, chưa đổi runtime hoặc cấu hình Dewee.

## Kết luận

Giữ thiết kế MCP dữ liệu + playbook/rules và skill orchestration. Bổ sung lớp danh tính/cấp quyền độc lập với logic game. Khi sản phẩm cần thu hồi, quota hoặc gói dịch vụ riêng từng người, ưu tiên thử nghiệm API key riêng từng user trên Dewee. Khi chỉ phục vụ người dùng trong một Dewee và quota được quản lý tại đó, service key vẫn là lựa chọn ít vận hành hơn. Source Dewee đã xác nhận đường per-user credential và connection pool; OAuth outbound hiện resolve theo tenant/server. Xem [khảo sát repo gốc](reports/dewee-source-scan.md) tại commit đã pin; chưa chứng minh binary local tương ứng.

Một endpoint dùng chung có thể phục vụ nhiều user. Không cần một Worker, bộ dataset, skill hoặc URL riêng cho mỗi user. API key chứng minh quyền truy cập; account game và mùa chơi là state riêng, không mã hóa cố định trong key.

## Bằng chứng hiện tại và giới hạn

| Quan sát | Ý nghĩa và giới hạn |
|---|---|
| Browser mở `/overview` chuyển tới `/login`; tiến trình `dewee` đang nghe loopback port 18790 | Chưa xem dashboard sau đăng nhập hoặc tool call thực tế |
| MCP `bearer-auth.ts` nhận current/next bearer và trả fingerprint | Chưa có registry user, scopes hoặc quota riêng user; next là rotation, không phải slot user thứ hai |
| Migration Dewee `000001_init_schema.up.sql`, dòng 406–450 | Có schema transport, headers, api_key, agent grants và user grants; schema chưa chứng minh runtime enforcement |
| Migration `000027_tenant_foundation.up.sql`, dòng 268–278 | `mcp_user_credentials` có unique `(server_id,user_id,tenant_id)`, chứa key/header/env |
| Migration `000098_add_require_user_credentials_to_mcp_servers.up.sql` | Có cờ `require_user_credentials`; cần test hành vi thiếu key không fallback key chung |
| Migration `000105_mcp_oauth_pkce.up.sql` | Credential OAuth unique `(tenant_id,server_id)`; actor nằm ở authorization flow, chưa chứng minh token riêng mỗi user |

Các migration được đọc trong thư mục cài đặt local `/Users/plateau/dewee/migrations/`. Sau đó đã đọc source repo gốc tại commit `d860101f466e4d7dc43948cc0e3ae1a607e189d4`; kết quả mới nằm trong báo cáo liên kết trên. Chưa kiểm tra migration đã áp dụng, version binary hay database runtime. Không đọc credential, không thử đăng nhập bằng secret, không thay cấu hình. Không dùng các skill wrapper cũ trong thư mục workspace làm bằng chứng tính năng MCP native.

Hợp đồng hiện hành: [consumer handoff](../../docs/goclaw-mcp-skill-handoff.md), [auth implementation](../../mcp-worker/src/security/bearer-auth.ts). Các thay đổi dưới đây là bổ sung đề xuất, không mô tả tính năng đã ship.

## Chọn mô hình truy cập

| Mô hình | Khi phù hợp | Quản lý tại MCP | Chi phí chính |
|---|---|---|---|
| Service key cho Dewee | Chỉ Dewee gọi dữ liệu game chung; kiểm soát user nằm tại Dewee | Nhận biết dịch vụ; không tự phân biệt end user | Đơn giản, nhưng thu hồi/quota cá nhân phụ thuộc Dewee |
| API key riêng user | Cần cấp quyền, quota, thu hồi, usage riêng; client hỗ trợ custom header | Registry ánh xạ key tới principal, scopes và entitlement | Cấp phát, giữ secret, rotate/revoke và support |
| OAuth theo user | Nhiều client, người dùng tự kết nối tài khoản, cần consent/expiry/refresh | Validate token cho đúng MCP resource và subject | Authorization server, discovery, PKCE, refresh; phải xác minh client |

Đề xuất mặc định cho mục tiêu **cấp MCP từng user**: API key riêng user, được Dewee giữ và chèn ở transport. User phổ thông không cần copy key vào chat. Nếu mở cho client ngoài, cung cấp trang quản lý key hoặc OAuth sau khi kiểm chứng nhu cầu và client. Key và OAuth có thể cùng ánh xạ về một principal để chuyển đổi sau này không đổi dữ liệu cá nhân.

Điều kiện cấu hình Dewee cho chế độ này: bật `require_user_credentials`; để trống server-level API key và Authorization mặc định; không bật OAuth tenant/server trên cùng bản ghi MCP. Source hiện merge default rồi override từng phần, và OAuth factory có thể thay Authorization của per-user connection. Provisioning phải yêu cầu key TQCCL hợp lệ cho mỗi user; không coi một env/header bất kỳ là đã kết nối TQCCL.

Dewee có public `/mcp` riêng để client ngoài gọi vào Dewee. API key có scope `mcp.tools.read` của endpoint đó không phải key dùng để Agent Dewee gọi TQCCL. Hai chiều kết nối cần credential riêng và kiểm chứng riêng.

Nếu cần MCP ghi nhận từng user nhưng Dewee chỉ gửi được service credential, cần adapter tin cậy cấp token ngắn hạn gắn subject. Không dùng `userId` do model đặt trong tool arguments để xác thực. Đây là phương án dự phòng phải triển khai riêng, không phải khả năng đã xác minh.

Theo [MCP authorization của protocol repo đang dùng](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), HTTP authorization có luồng OAuth với discovery và access token. Static API key là tích hợp managed-client hiện hữu; không gọi nó là hỗ trợ đầy đủ MCP OAuth. Giữ protocol/SDK đang pin trong lần thiết kế này.

## Ranh giới giữa Dewee, LLM và MCP

```text
User đăng nhập / định danh channel tại Dewee
  -> host resolve tenant + user + agent và quyền được cấp
  -> host lấy credential đúng user từ secret store
  -> MCP transport chèn Authorization
  -> TQCCL xác thực -> principal -> quyền tool + quota
  -> handler game / knowledge -> kết quả có version và evidence
```

- Gateway Token dùng đăng nhập Dewee và credential gọi MCP là hai loại riêng.
- LLM thấy tool/schema/kết quả; không thấy, lựa chọn hoặc nhập token.
- Dewee kiểm tra agent/user grants. MCP kiểm tra quyền phía server trên mọi call; tool allowlist ở prompt hoặc discovery không thay thế enforcement.
- Credential thiếu, hết hạn hoặc bị thu hồi: trả hướng dẫn kết nối; không fallback sang admin/service key trong chế độ per-user.
- Session MCP không phải danh tính. Connection pool, cache riêng tư và feedback cần key theo principal, không dùng chung theo URL server. Có thể dùng chung cache dữ liệu công khai theo release và scope.
- Credential của user cần được dùng cho toàn bộ lifecycle có xác thực, gồm discovery, gọi tool và reconnect; không discovery bằng admin rồi mặc nhiên cho mọi user gọi.
- Khi gộp danh tính người dùng từ nhiều channel, cần bước liên kết tài khoản đáng tin cậy; không suy ra cùng user qua tên hiển thị.

[MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices) yêu cầu token được cấp đúng resource và tránh token passthrough. Không tái sử dụng token đăng nhập gateway để gọi TQCCL.

## Registry tối thiểu nếu chọn per-user API key

Owner đề xuất: access layer cạnh MCP, giữ game snapshot và handler độc lập. Không triển khai bảng này trong bundle Assets công khai.

- Principal: `principalId`, `tenantId`, `subjectId`, trạng thái, entitlement/quota policy.
- Credential: `keyId`, `principalId`, digest của secret ngẫu nhiên mạnh, scopes, thời điểm tạo/hết hạn/thu hồi, rotation generation. Lưu key đầy đủ có mã hóa ở consumer; phía provider chỉ cần digest để đối chiếu.
- Một user có thể có nhiều key cho thiết bị/client và rotation; quota tổng theo principal, giới hạn phụ theo key. Rotate không reset quota hoặc tạo profile mới.
- Ví dụ scope đề xuất: `catalog:read`, `team:recommend`, `knowledge:read`. Quyền chung của skill không được vượt grant. Research web permissions và promotion authority do consumer/maintainer quản lý riêng.
- Usage chỉ ghi principal nội bộ, key ID, tên tool, thời gian, units, outcome và release; không log bearer hoặc toàn bộ roster/prompt.
- Store phải hỗ trợ lookup/revoke và quota nguyên tử theo consistency đã chọn. Nếu cache auth, định nghĩa rõ độ trễ thu hồi và kiểm thử; chưa chốt storage trước khi biết quy mô.
- Cấp key là thao tác quản trị từ account đã xác thực; không thêm tool cấp/thu hồi key vào agent chơi game.

## Điều chỉnh thiết kế skill và learning

1. Ba skill nghiệp vụ là gói portable cho Dewee, không tham chiếu đường dẫn máy dev hoặc yêu cầu shell Python để tra rule. MCP thực thi search dataset phía server; CLI là đường kiểm thử/local tương đương.
2. Repo TQCCL sở hữu schema/workflow cards/rules công khai. Repo consumer sở hữu packaging skill, grants, confirmation UX và host adapter. Giữ ranh giới của tài liệu handoff hiện hành.
3. Host cung cấp profile theo `tenant + subject + gameAccount + gameServer`; credential không mang mùa. User chọn mùa nguồn trước, nếu chưa chọn thì `defaultSourceSeasonId` của bản publish ([season design](season-resolution-design.md)).
   Source `resolveActorUserID` có xử lý riêng Bitrix24 và group chat; provisioning TQCCL phải dùng đúng actor identity theo channel, không mặc định memory user ID luôn trùng credential user ID.
4. Dewee nhận feedback và lưu state cá nhân theo subject đã xác thực. MCP game tiếp tục read-only; không thêm write tool học chỉ để thuận tiện routing.
5. Feedback cá nhân cải thiện profile tương ứng. Đề xuất cải tiến chung đi qua skill evolution `suggest_only` của Dewee và maintainer duyệt ở repo ([phase 3](phase-03-learning.md)); không có skill bảo trì grant cho agent người chơi.
6. Trước khi tin vòng học đang chạy, chứng minh `skill_usage_metrics` có dữ liệu thật và đề xuất được tạo; có bảng không có nghĩa đã ghi.

## Thông tin cần chốt

| Quyết định | Ảnh hưởng | Đề xuất ban đầu |
|---|---|---|
| Chỉ Dewee hay cả client ngoài? | Service key/API key/OAuth và onboarding | Dewee trước, principal model cho phép mở rộng |
| Ai là khách hàng: người chơi hay tổ chức? | Tenant, billing và nơi cấp key | Principal từng người, tenant là đơn vị quản lý |
| Có quota/gói trả phí riêng không? | Có cần provider nhận biết từng user? | Có thì per-user auth ngay từ đầu |
| Một user có nhiều account/server game không? | Scope profile và season | Hỗ trợ nhiều account; không dùng key làm account game |
| Personal data ở Dewee hay TQCCL? | Portability, quyền xóa và trách nhiệm lưu trữ | Dewee giữ ở giai đoạn đầu; đồng bộ đa client là scope riêng |
| Quy mô đồng thời và yêu cầu thu hồi? | Storage, quota consistency, cache TTL | Đo pilot, chốt SLO trước lựa chọn storage |
| Feedback riêng hay góp vào knowledge chung? | Collector, privacy và promotion | Riêng mặc định; bản chung qua pipeline maintainer |

## Kiểm chứng trước rollout

1. Pin version Dewee đang chạy và xác minh transport/header/JSON response với MCP thật.
2. Hai user trong cùng agent gọi đồng thời bằng hai credential thử nghiệm; provider ghi nhận đúng principal, không lẫn session/cache.
3. Hai tenant có cùng user ID vẫn tách biệt; user thiếu credential bị chặn trong chế độ require-user-credentials.
4. Revoke/rotate user A không ảnh hưởng user B; reconnect không lấy credential cũ hoặc service fallback. Quota không reset qua rotate.
   Route PUT/DELETE credential trong source đã đọc chưa gọi invalidate pool/tool cache trực tiếp; cần test đường update của deployment. Xóa credential khỏi Dewee không thay thế revoke tại TQCCL, vì kết nối đang mở có thể còn giữ key cũ.
5. Tool không có scope bị từ chối cả khi gọi trực tiếp. Log/output/error không lộ credential.
6. Profile/mùa/roster/feedback A không xuất hiện ở B; user pinned mùa cũ không bị latest override.
7. Nếu chọn OAuth, cần thiết kế hỗ trợ riêng từng user và chứng minh refresh isolation, audience/scopes và authorization flow của đúng client; source hiện resolve OAuth theo tenant/server.

Chỉ khi các probe đạt mới chốt khả năng tích hợp. Hiện tại chưa tạo key, thay auth, đăng ký MCP, cài skill, bật learning hay deploy.
