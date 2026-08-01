# Live Cloudflare inventory

Ngày xác minh: 2026-08-01  
Công cụ: Wrangler `4.114.0`, OAuth session hiện có  
Account identifier: redacted

## Inventory ban đầu trước release

| Probe chỉ đọc | Kết quả | Ý nghĩa |
|---|---|---|
| `wrangler r2 bucket list` | Cloudflare API `10042`: R2 chưa được enable | Không có R2 bucket đang hoạt động trong account mục tiêu; không có resource cần retire |
| `wrangler deployments list --name tqccl-research-mcp` | Cloudflare API `10007`: Worker không tồn tại | Release tiếp theo là first deployment, chưa có prior known-good version |
| `wrangler versions list --name tqccl-research-mcp` | Cloudflare API `10007`: Worker không tồn tại | Không có version/deployment để rehearsal rollback hiện tại |
| `wrangler secret list --name tqccl-research-mcp` | Worker không tồn tại | Managed MCP bearer chưa được provision cho Worker này |

Các dòng Worker phía trên là preflight lịch sử trước bootstrap, không phải trạng thái cuối sau release.

## Cập nhật domain

- Zone `tqccl.com` active trên Cloudflare với nameserver đã được delegate đúng.
- Production MCP hostname chốt là `mcp.tqccl.com`; `mcp-worker/wrangler.jsonc` quản lý hostname này bằng Worker Custom Domain.
- Quan sát lịch sử trước khi owner tạo DNS ghi nhận hai Pages custom domains còn `pending`; đây không phải trạng thái hiện tại.
- Lần đọc lại sau khi owner tạo DNS: Pages báo apex `active`; `www` đã verification active nhưng certificate chưa hoàn tất.
- Edge rate limiting rule `tqccl-mcp-rate-limit` đã được deploy và xác minh trực tiếp trên Cloudflare dashboard: expression `http.request.uri.path eq "/mcp"`, đặc tính đếm theo IP, ngưỡng `10 request/10 giây`, action `Block`, mitigation timeout `10 giây`, trạng thái `Active`. Worker limiter giữ `60 request/60 giây` làm lớp phòng vệ thứ hai.

Không lưu OAuth token, account ID, raw Wrangler log path hoặc credential trong report.

## Release cuối đã xác minh

- Exact SHA: `080c514064e4d9f37618f154e0c4bec09771164c`.
- GitHub Actions production workflow: [run 30708870542](https://github.com/nguyennguyenit/CamNangTQCCL/actions/runs/30708870542), kết quả thành công.
- Release suite đạt `52/52`; full MCP đạt `229/229`, coverage `89.72%` statements / `82.42%` branches / `95.34%` functions / `90.20%` lines.
- Deployment shapes đã redacted: prior `[100]`, smoke `[100,0]`, rollback `[100]`, final `[100]`. Không ghi Worker version hoặc deployment ID.
- Public probes: `/healthz` trả `200`; `/mcp` không bearer trả `401`; public manifest và teams đều trả `404`.
- R2 giữ nguyên trạng thái `not enabled` / `not present` theo inventory chỉ đọc phía trên; không thực hiện revoke/delete và production release không dùng R2.

## Kết luận

- Bootstrap first release, normal candidate flow, promotion, exact-prior rollback rehearsal và re-promotion đã hoàn tất trên exact SHA được ghi ở trên.
- Trạng thái deployment cuối là một version đã xác minh nhận `100%` traffic; public asset boundary và unauthenticated MCP boundary đều đúng contract.
- External R2 inventory vẫn `not present`; không có resource R2 cần retire.
