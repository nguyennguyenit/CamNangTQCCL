# Project-manager sync: Worker Static Assets

Ngày: 2026-08-01

## Trạng thái

| Phase | Hoàn tất | Trạng thái | Còn mở |
|---|---:|---|---|
| 1 — Asset contract/builder | 13/13 | Completed | — |
| 2 — Static Assets runtime | 16/16 | Completed | — |
| 3 — Release/control plane | 16/16 | Completed | — |
| 4 — Docs/verification | 11/15 | In progress | Protected approval; live override/rollback; cross-plan closure |
| **Tổng** | **56/60 (93%)** | **In progress** | **4 live/closure checks** |

## Evidence reconciled

- `reports/implementation-verification.md`: local Node `22.16.0`, MCP, Workerd, root Node/Python/E2E, Vision Worker, clean-tree repository/Wrangler dry-run và `git diff --check` pass.
- Current worktree: deterministic builder/evidence, `ASSETS` + `run_worker_first`, version metadata/header, Static Assets datasource, exact-version deployment controller/workflow, R2/AWS pipeline removal, docs/runbook updates.
- Old MCP plan now records the R2 release design as superseded but correctly remains open for live production gates.

## Open gates

- Protected live run: candidate `0%` Version Override, exact identity/performance, promote and known-good rollback rehearsal.
- Live edge rate-rule state.
- First-release bootstrap vì Worker chưa tồn tại; sau đó live candidate/rollback flow.
- GitHub `mcp-production` required reviewer: repo private hiện không có environment/protection capability; workflow preflight fail closed trước Cloudflare access.
- Close cross-plan dependency only after those gates pass.

## Quyết định/live prerequisite còn mở

- Chọn production hostname/zone (`mcp.<domain-moi>` nếu owner mua domain riêng, hoặc hostname hiện có).
- Phê duyệt ngoại lệ bootstrap one-time trước workflow run; GitHub CLI authentication đã được khôi phục và migration commit đã push.
- Chọn public repo hoặc GitHub plan hỗ trợ required-reviewer protection cho repo private; không thể coi manual dispatch/environment rỗng là protected approval.
