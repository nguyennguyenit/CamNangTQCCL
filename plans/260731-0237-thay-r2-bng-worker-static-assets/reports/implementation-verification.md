# Báo cáo implementation và verification

Ngày: 2026-08-01  
Node: `22.16.0`

## Kết quả local

- Deterministic Worker asset contract: manifest + sáu JSON, exact source/tree/workflow evidence, atomic directory swap và validation độc lập.
- Production Worker dùng private `ASSETS`, `run_worker_first: true` và version metadata; public asset path luôn `404`.
- CLI/stdio giữ filesystem source; HTTP giữ bearer, protocol và tám tool contract.
- R2 runtime/release/control-plane code, AWS SDK và stage/activate scripts đã bị loại. Tên credential R2 lịch sử chỉ còn trong denylist/repository tests.
- Production workflow manual-main + protected environment, exact SHA, credential-free gates, Workerd trước upload, candidate `0%` Version Override, single-version promotion và durable evidence artifact.
- Deployment controller có run annotation, re-read trước mutation, reconciliation cho POST đã commit nhưng response bị mất, read-back restore/rollback và drift incident. Cloudflare không cung cấp atomic precondition cho Create Deployment; dedicated deploy token và cấm mutation ngoài workflow trong release window là precondition vận hành bắt buộc.
- First-release bootstrap là manual opt-in, chỉ chấp nhận trạng thái chưa có deployment, upload bearer qua file tạm quyền hạn chế và fail closed nếu Worker đã có current deployment. Vì chưa có prior, verify fail mở incident; normal `100/0` run thứ hai vẫn là gate bắt buộc.
- Production workflow có live GitHub preflight yêu cầu `mcp-production.protection_rules` chứa required reviewer trước Cloudflare access. Repo hiện private và API chưa có environment; preflight thực tế trả fail closed, nên protected approval vẫn là live gate chưa đạt.

## Bằng chứng test

- MCP `npm run check`: `217/217` tests, coverage `89.72%` statements / `82.42%` branches / `95.34%` functions / `90.20%` lines; typecheck, Worker typecheck, build, Node-min và offline control-plane pass.
- Release suite sau bootstrap: `40/40`; clean-tree asset build/evidence và full `check:repository` (bao gồm Wrangler Static Assets dry-run) pass trong clone tạm có exact candidate diff.
- Workerd: functional `2/2`, production corpus `1/1`.
- Root static build/dist: build pass, dist contract `9/9`.
- Browser E2E: `14/14`.
- Root Node: `133/133`.
- Python: `82/82`.
- Vision Worker: `53/53`, typecheck pass.
- `git diff --check`: pass.

## Live gates chưa thực hiện

Không có production authorization/credential trong phiên implementation nên không upload hoặc mutate Cloudflare.

- Protected environment approval và exact-SHA workflow run. GitHub account/repo hiện không cung cấp environment protection; cần đổi visibility hoặc plan theo quyết định owner.
- Live edge rate-rule verification.
- Candidate `0%` Version Override, exact runtime version/release/workflow identity và performance observation trên account mục tiêu.
- Promotion + known-good whole-version rollback rehearsal.
- External R2 inventory: Wrangler live read-only trả API `10042` (R2 chưa được enable), nên account mục tiêu không có bucket đang hoạt động cần revoke/retire. Evidence: `live-cloudflare-inventory-260801.md`.
- Worker inventory: `tqccl-research-mcp` chưa tồn tại (`10007`), nên cần first-release bootstrap trước normal prior `100%` + candidate `0%` flow.

Do đó code/docs/local gates hoàn tất; Phase 4 và việc đóng plan cũ vẫn chờ live release evidence.
