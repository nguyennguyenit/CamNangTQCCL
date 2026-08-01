# Báo cáo implementation và verification

Ngày: 2026-08-01  
Node: `22.16.0`

## Kết quả local

- Deterministic Worker asset contract: manifest + sáu JSON, exact source/tree/workflow evidence, atomic directory swap và validation độc lập.
- Production Worker dùng private `ASSETS`, `run_worker_first: true` và version metadata; public asset path luôn `404`.
- CLI/stdio giữ filesystem source; HTTP giữ bearer, protocol và tám tool contract.
- R2 runtime/release/control-plane code, AWS SDK và stage/activate scripts đã bị loại. Tên credential R2 lịch sử chỉ còn trong denylist/repository tests.
- Production workflow manual-main + owner-confirmed exact SHA, credential-free gates, read-only deployment preflight trước upload, Custom Domain trigger, Workerd trước upload, candidate `0%` Version Override, single-version promotion và durable evidence artifact.
- Deployment controller có run annotation, re-read trước mutation, reconciliation cho POST đã commit nhưng response bị mất, read-back restore/rollback và drift incident. Cloudflare không cung cấp atomic precondition cho Create Deployment; dedicated deploy token và cấm mutation ngoài workflow trong release window là precondition vận hành bắt buộc.
- First-release bootstrap là manual opt-in: read-only preflight dừng trước mutation nếu đã có deployment; `wrangler deploy` tạo Worker/version đầu với bearer từ file tạm quyền hạn chế; controller read-back exact candidate duy nhất ở `100%` rồi xác minh production. Vì chưa có prior, verify fail mở incident; normal `wrangler versions upload` + `100/0` run thứ hai sau đó đã hoàn tất rollback rehearsal bắt buộc.
- Rollback rehearsal opt-in capture prior exact Worker/release/workflow/data digest trước mutation, rollback và xác minh prior, rồi re-promote và chạy lại full candidate verifier; recovery paths giữ một version đã xác minh ở `100%`.
- Repo private không có required-reviewer environment ở GitHub plan hiện tại. Owner đã chọn manual exact-SHA approval; workflow yêu cầu full SHA khớp `HEAD`, `GITHUB_SHA`, current `origin/main` và checkbox production trước Cloudflare access.
- Zone `tqccl.com` dùng Cloudflare Free; owner đã chấp thuận edge rate rule `10 request/10 giây`, trong khi Worker limiter giữ `60 request/60 giây`.
- Candidate, production và rollback verifiers dùng chung scheduler `1.100 ms/request` cho `/mcp`; sliding-window test chứng minh không vượt `10 request/10 giây`.
- Edge rule `tqccl-mcp-rate-limit` đã được deploy và đọc lại trên Cloudflare dashboard: path `/mcp`, đếm theo IP, ngưỡng `10 request/10 giây`, action `Block`, mitigation timeout `10 giây`, trạng thái `Active`. Worker limiter vẫn là `60 request/60 giây`.

## Bằng chứng test

- MCP full gate: `229/229` tests, coverage `89.72%` statements / `82.42%` branches / `95.34%` functions / `90.20%` lines; typecheck, Worker typecheck, build, Node-min và offline control-plane pass.
- Release suite: `52/52`; clean-tree asset build/evidence và full `check:repository` (bao gồm Wrangler Static Assets dry-run) pass trong clone tạm có exact candidate diff.
- Workerd: functional `2/2`, production corpus `1/1`.
- Root static build/dist: build pass, dist contract `9/9`.
- Browser E2E: `14/14`.
- Root Node: `133/133`.
- Python: `82/82`.
- Vision Worker: `53/53`, typecheck pass.
- `git diff --check`: pass.

## Live gates

### Release cuối đã xác minh

- Exact SHA: `080c514064e4d9f37618f154e0c4bec09771164c`.
- GitHub Actions production workflow: [run 30708870542](https://github.com/nguyennguyenit/CamNangTQCCL/actions/runs/30708870542), kết quả thành công.
- Deployment shapes đã redacted: prior `[100]`, smoke `[100,0]`, rollback `[100]`, final `[100]`. Các shape chỉ ghi tỷ lệ traffic; không lưu Worker version hoặc deployment ID.
- Public probes sau release: `/healthz` trả `200`; `/mcp` không bearer trả `401`; đường dẫn public tới manifest và teams đều trả `404`.
- Bootstrap first release và normal release có rollback rehearsal đã hoàn tất; trạng thái cuối giữ candidate đã xác minh là version duy nhất nhận `100%` traffic.
- Edge rate-rule verification: **pass**. Rule áp dụng path `/mcp`, đếm theo IP, ngưỡng `10 request/10 giây`, action `Block`, mitigation timeout `10 giây`, trạng thái `Active`; Worker limiter vẫn là `60 request/60 giây`.
- External R2 inventory vẫn là `not enabled` / `not present` theo live read-only evidence đã ghi trong `live-cloudflare-inventory-260801.md`; không có bucket cần revoke/retire và release không phụ thuộc R2.

Do đó local gates, production release, public boundary probes, promotion và rollback rehearsal đều đã có bằng chứng hoàn tất cho exact SHA nêu trên.
