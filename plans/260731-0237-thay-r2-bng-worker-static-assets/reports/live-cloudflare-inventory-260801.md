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

Không lưu OAuth token, account ID, raw Wrangler log path hoặc credential trong report.

## Kết luận

- External R2 inventory đạt trạng thái `not present`; không thực hiện revoke/delete.
- Không được chạy controller prior/candidate hiện tại cho đến khi có first-release bootstrap và endpoint/route được chốt.
- Live edge rule, bearer, candidate override, promotion và rollback vẫn chưa có evidence.

## Next

1. Chốt production hostname/zone và route cho `/mcp`.
2. Provision protected GitHub environments/vars/secrets và dedicated deploy token.
3. Tạo first known-good Worker deployment bằng nhánh manual `bootstrap_first_release` đã được test local; nhánh này từ chối chạy nếu deployment đã tồn tại.
4. Chạy normal `100/0` candidate flow và whole-version rollback rehearsal để đóng plan.
