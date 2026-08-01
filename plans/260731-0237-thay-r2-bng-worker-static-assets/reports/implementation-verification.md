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
- First-release bootstrap là manual opt-in, read-only preflight dừng trước upload nếu đã có deployment, upload bearer qua file tạm quyền hạn chế và controller re-check chống race. Vì chưa có prior, verify fail mở incident; normal `100/0` run thứ hai với rollback rehearsal vẫn là gate bắt buộc.
- Rollback rehearsal opt-in capture prior exact Worker/release/workflow/data digest trước mutation, rollback và xác minh prior, rồi re-promote và chạy lại full candidate verifier; recovery paths giữ một version đã xác minh ở `100%`.
- Repo private không có required-reviewer environment ở GitHub plan hiện tại. Owner đã chọn manual exact-SHA approval; workflow yêu cầu full SHA khớp `HEAD`, `GITHUB_SHA`, current `origin/main` và checkbox production trước Cloudflare access.
- Zone `tqccl.com` dùng Cloudflare Free; owner đã chấp thuận edge rate rule `10 request/10 giây`, trong khi Worker limiter giữ `60 request/60 giây`.
- Candidate, production và rollback verifiers dùng chung scheduler `1.100 ms/request` cho `/mcp`; sliding-window test chứng minh không vượt `10 request/10 giây`.
- Edge rule `tqccl-mcp-rate-limit` đã được deploy và đọc lại trên Cloudflare dashboard: path `/mcp`, đếm theo IP, ngưỡng `10 request/10 giây`, action `Block`, mitigation timeout `10 giây`, trạng thái `Active`. Worker limiter vẫn là `60 request/60 giây`.

## Bằng chứng test

- MCP `npm run check`: `227/227` tests, coverage `89.72%` statements / `82.42%` branches / `95.34%` functions / `90.20%` lines; typecheck, Worker typecheck, build, Node-min và offline control-plane pass.
- Release suite sau bootstrap: `40/40`; clean-tree asset build/evidence và full `check:repository` (bao gồm Wrangler Static Assets dry-run) pass trong clone tạm có exact candidate diff.
- Workerd: functional `2/2`, production corpus `1/1`.
- Root static build/dist: build pass, dist contract `9/9`.
- Browser E2E: `14/14`.
- Root Node: `133/133`.
- Python: `82/82`.
- Vision Worker: `53/53`, typecheck pass.
- `git diff --check`: pass.

## Live gates

### Đã đạt

- Edge rate-rule verification: **pass**. Rule áp dụng path `/mcp`, đếm theo IP, ngưỡng `10 request/10 giây`, action `Block`, mitigation timeout `10 giây`, trạng thái `Active`; Worker limiter vẫn là `60 request/60 giây`.
- External R2 inventory: Wrangler live read-only trả API `10042` (R2 chưa được enable), nên account mục tiêu không có bucket đang hoạt động cần revoke/retire. Evidence: `live-cloudflare-inventory-260801.md`.
- Worker inventory: `tqccl-research-mcp` chưa tồn tại (`10007`), xác nhận release đầu tiên phải đi qua bootstrap.

### Còn mở

- Provision các GitHub repository secrets còn thiếu và chạy production workflow trên exact SHA đã được owner xác nhận; bốn repository variables cần thiết đã có.
- Chạy first-release bootstrap để tạo Worker/bearer/version known-good đầu tiên; vì chưa có prior, verification fail phải mở incident.
- Chạy workflow lần hai theo normal prior `100%` + candidate `0%`; xác minh Version Override, exact runtime version/release/workflow identity và performance trên account mục tiêu.
- Hoàn tất promotion và rehearsal rollback toàn bộ known-good Worker version.

Do đó code/docs/local gates và live edge-rate gate đã hoàn tất; Phase 4 và việc đóng plan cũ vẫn chờ live Worker release cùng rollback evidence.
