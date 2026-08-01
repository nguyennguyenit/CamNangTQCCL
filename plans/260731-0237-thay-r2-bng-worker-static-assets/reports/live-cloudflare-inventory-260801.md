# Live Cloudflare inventory

Ngày xác minh: 2026-08-01  
Công cụ: Wrangler `4.114.0`, OAuth session hiện có  
Account identifier: redacted

## Kết quả

| Probe chỉ đọc | Kết quả | Ý nghĩa |
|---|---|---|
| `wrangler r2 bucket list` | Cloudflare API `10042`: R2 chưa được enable | Không có R2 bucket đang hoạt động trong account mục tiêu; không có resource cần retire |
| `wrangler deployments list --name tqccl-research-mcp` | Cloudflare API `10007`: Worker không tồn tại | Release tiếp theo là first deployment, chưa có prior known-good version |
| `wrangler versions list --name tqccl-research-mcp` | Cloudflare API `10007`: Worker không tồn tại | Không có version/deployment để rehearsal rollback hiện tại |
| `wrangler secret list --name tqccl-research-mcp` | Worker không tồn tại | Managed MCP bearer chưa được provision cho Worker này |

## Cập nhật domain

- Zone `tqccl.com` active trên Cloudflare với nameserver đã được delegate đúng.
- Production MCP hostname chốt là `mcp.tqccl.com`; `mcp-worker/wrangler.jsonc` quản lý hostname này bằng Worker Custom Domain.
- Quan sát lịch sử trước khi owner tạo DNS ghi nhận hai Pages custom domains còn `pending`; đây không phải trạng thái hiện tại.
- Lần đọc lại sau khi owner tạo DNS: Pages báo apex `active`; `www` đã verification active nhưng certificate chưa hoàn tất.
- Edge rate limiting rule `tqccl-mcp-rate-limit` đã được deploy và xác minh trực tiếp trên Cloudflare dashboard: expression `http.request.uri.path eq "/mcp"`, đặc tính đếm theo IP, ngưỡng `10 request/10 giây`, action `Block`, mitigation timeout `10 giây`, trạng thái `Active`. Worker limiter giữ `60 request/60 giây` làm lớp phòng vệ thứ hai.

Không lưu OAuth token, account ID, raw Wrangler log path hoặc credential trong report.

## Kết luận

- External R2 inventory đạt trạng thái `not present`; không thực hiện revoke/delete.
- Không được chạy controller prior/candidate hiện tại trước first-release bootstrap; hostname production đã chốt nhưng Worker và bearer chưa được provision.
- Live edge rule đã có evidence; bearer, candidate override, promotion và rollback vẫn chưa có evidence.

## Next

1. Chờ certificate của `www.tqccl.com` active và xác minh lại Pages custom-domain state.
2. Provision các GitHub repository secrets còn thiếu và dedicated deploy token.
3. Tạo first known-good Worker deployment trên `mcp.tqccl.com` bằng nhánh manual `bootstrap_first_release` đã được test local; nhánh này từ chối chạy nếu deployment đã tồn tại.
4. Chạy normal `100/0` candidate flow và whole-version rollback rehearsal để đóng plan.
