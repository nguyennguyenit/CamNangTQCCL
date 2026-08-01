# Project-manager sync: Worker Static Assets

Ngày: 2026-08-01

## Trạng thái

| Phase | Hoàn tất | Trạng thái | Còn mở |
|---|---:|---|---|
| 1 — Asset contract/builder | 13/13 | Completed | — |
| 2 — Static Assets runtime | 16/16 | Completed | — |
| 3 — Release/control plane | 16/16 | Completed | — |
| 4 — Docs/verification | 15/18 | In progress | Live bootstrap/override/rollback; cross-plan closure |
| **Tổng** | **60/63 (95%)** | **In progress** | **3 live/closure checks** |

## Evidence reconciled

- `reports/implementation-verification.md`: local Node `22.16.0`, MCP, Workerd, root Node/Python/E2E, Vision Worker, clean-tree repository/Wrangler dry-run và `git diff --check` pass.
- Current worktree: deterministic builder/evidence, `ASSETS` + `run_worker_first`, version metadata/header, Static Assets datasource, exact-version deployment controller/workflow, R2/AWS pipeline removal, docs/runbook updates.
- Old MCP plan now records the R2 release design as superseded but correctly remains open for live production gates.
- Cloudflare Free edge rule `tqccl-mcp-rate-limit` đã được xác minh live: `/mcp`, theo IP, `10 request/10 giây`, Block `10 giây`, Active; Worker limiter giữ `60/60 giây`.

## Open gates

- Confirmed exact-SHA live run: candidate `0%` Version Override, exact identity/performance, promote and known-good rollback rehearsal.
- First-release bootstrap vì Worker chưa tồn tại; sau đó live candidate/rollback flow.
- Close cross-plan dependency only after those gates pass.

## Quyết định/live prerequisite còn mở

- Production hostname đã chốt: `mcp.tqccl.com` trong zone active `tqccl.com`; Pages apex đã active, `www` verification active và đang chờ certificate.
- Phê duyệt ngoại lệ bootstrap one-time trước workflow run; GitHub CLI authentication đã được khôi phục và migration commit đã push.
- Owner đã duyệt giữ repo private và dùng manual exact-SHA approval; không tạo environment rỗng.
