---
date: 2026-08-01
session: worker-static-assets-implementation
status: in-progress
plan: ../260731-0237-thay-r2-bng-worker-static-assets/plan.md
---

# Journal: 2026-08-01 — Triển khai Worker Static Assets

## Context

Phiên Cook thay production data path từ R2 sang private Worker Static Assets, đóng gói code, manifest và sáu JSON trong cùng một Worker version. Phạm vi giữ nguyên filesystem source cho CLI/stdio, tám tool MCP, bearer và GoClaw handoff. Production hostname đã chốt là `mcp.tqccl.com` trong zone active `tqccl.com`; chưa deploy Worker production, publish npm hoặc đóng plan khi chưa đủ live evidence.

## What Happened

- Xây deterministic seven-file bundle, evidence gắn exact commit/tree/workflow và validation fail-closed.
- Chuyển Worker sang `ASSETS` với `run_worker_first: true`, fixed internal allowlist, bounded streaming và immutable snapshot cache; public asset paths vẫn `404`.
- Xóa R2 runtime/release/control-plane, AWS SDK, pointer/CAS/lock/receipt và stage/activate/publish pipeline; giữ tên credential lịch sử chỉ trong denylist.
- Chuyển release workflow của repo private sang manual exact-SHA approval: SHA đủ 40 ký tự phải khớp checkout, `GITHUB_SHA` và current `origin/main`, kèm xác nhận production trước mọi Cloudflare access; candidate `0%` qua Version Override rồi mới promote đúng một version `100%`.
- Thêm deployment controller có expected-current guards, durable evidence và xử lý response POST mơ hồ bằng read-back/reconciliation trước khi quyết định retry, restore hoặc incident.
- Kiểm kê live chỉ đọc xác nhận R2 chưa được enable và Worker chưa tồn tại; bổ sung nhánh bootstrap one-time manual, chỉ chấp nhận trạng thái không có deployment và không thể ghi đè Worker đang hoạt động.
- Khóa bearer bằng `secrets.required`; bootstrap đưa secret vào version qua file tạm quyền hạn chế, xóa bằng trap và mở incident nếu first-version verification fail do chưa có prior rollback.
- Xác minh live Free edge rule cho `/mcp` trên `tqccl.com`: đếm theo IP, `10 request/10 giây`, action `Block`, timeout `10 giây`, trạng thái `Active`; Worker limiter `60 request/60 giây` vẫn là lớp thứ hai.
- Đồng bộ runbook, architecture và project docs; plan vẫn `in-progress` vì bootstrap, normal candidate flow và rollback rehearsal chưa chạy.

## Reflection

Việc gom code và data vào cùng Worker version đã loại bỏ phần lớn mutable release state và giảm mạnh bề mặt vận hành. Local coverage tốt, các contract quan trọng đã được khóa bằng test và edge rate control đã có live evidence. Rủi ro còn lại nằm ở first-release bootstrap và deployment state: Cloudflare Create Deployment không cung cấp CAS/precondition nguyên tử, nên test không thể thay thế kỷ luật độc quyền vận hành trong release window.

## Decisions Made

| Decision | Rationale | Impact |
|---|---|---|
| Loại bỏ hoàn toàn R2 và compatibility path | Cadence theo mùa không cần mutable object-store release plane | Code + data rollback theo một Worker version; giảm dependency, secret và control-plane state |
| Chỉ cho phép prior `100%` + candidate `0%` trong smoke gate, sau đó một exact version `100%` | Verify candidate không nhận traffic thường và tránh gradual split ngoài scope | Identity được kiểm qua authenticated Version Override trước promotion |
| Reconcile POST có kết quả mơ hồ bằng read-back | Response mất không chứng minh mutation thất bại | Tránh blind retry/rollback; phân loại committed, unchanged hoặc drift trước hành động tiếp theo |
| Yêu cầu operational exclusivity trong release window | Cloudflare deployment API không có atomic CAS | Dedicated deploy token, workflow serialization và cấm mutation ngoài workflow là precondition bắt buộc; expected-current guards chỉ giảm chứ không xóa race |
| Không rollback bearer secret cùng Worker version | Secret rotation có lifecycle độc lập | Rollback chỉ phục hồi code + data known-good, không phục hồi credential cũ |
| Bootstrap đầu tiên là manual opt-in và fail closed khi đã có deployment | Account mục tiêu chưa có Worker/prior nhưng normal release cần prior `100%` | Lần đầu tạo known-good ở `100%`; lần chạy thứ hai vẫn bắt buộc chứng minh normal `100/0` và rollback |
| Giữ repo private và dùng manual exact-SHA approval | Owner chấp thuận cơ chế kiểm soát hiện có, không tạo environment rỗng | Production mutation bị khóa bởi exact `main` SHA và xác nhận rõ ràng trước Cloudflare access |
| Dùng `mcp.tqccl.com` trong zone `tqccl.com` | Hostname production đã được owner chốt và zone đang active | Worker Custom Domain và live edge rule có một production route xác định |

## Verification

- MCP `npm run check`: `217/217`; coverage `89.72%` statements, `82.42%` branches, `95.34%` functions, `90.20%` lines; typecheck/build/Node-min/offline control-plane pass.
- Release suite `40/40`; bootstrap/config targeted suite `23/23`.
- Clean-tree exact candidate build, evidence verifier, full repository gate và Wrangler dry-run với bảy assets pass trong clone tạm.
- Workerd: functional `2/2`, production corpus `1/1`.
- Root: dist `9/9`, browser E2E `14/14`, Node `133/133`, Python `82/82`.
- Vision Worker: `53/53`, typecheck pass.
- `git diff --check`: pass. Current tracked diff summary: 54 files, 614 insertions, 4,936 deletions; untracked implementation/tests/docs evidence remain part of the shared worktree.
- Project sync hiện tại: `60/63` checks (`95%`); Phase 3 completed, Phase 4 vẫn `in-progress` với ba live/closure checks.
- Live Cloudflare inventory: R2 `not present`, Worker/version chưa tồn tại; edge rule Free cho `/mcp` đạt `10 request/10 giây`, `Block` `10 giây`, `Active`.

## Impact

- Production design no longer depends on R2, AWS SDK or an application-level promotion receipt subsystem.
- Release and rollback now operate on an atomic code+data Worker version while preserving MCP/GoClaw public contracts.
- Security boundary remains bearer authentication plus live edge rate control; asset bytes are not publicly routable.
- AgentWiki publishing skipped because neither AgentWiki CLI nor MCP capability is available in this environment.

## Next Steps

- Provision các repository secrets còn thiếu và dedicated deploy token theo runbook, không ghi identifiers hoặc values vào journal/evidence.
- Chạy manual exact-SHA bootstrap để tạo first known-good Worker trên `mcp.tqccl.com`; nhánh phải từ chối nếu deployment đã tồn tại.
- Chạy normal prior `100%` + candidate `0%` Version Override, xác minh exact runtime/release/workflow identity và account-specific performance, rồi promote một version `100%`.
- Rehearse ownership-safe whole-version rollback về known-good version.
- Close this plan and the cross-plan dependency only after all live evidence passes.

## Unresolved Questions

- Không còn product/hostname decision mở; repository secrets, bootstrap và normal `100/0`/rollback live evidence vẫn là prerequisites bên ngoài.
