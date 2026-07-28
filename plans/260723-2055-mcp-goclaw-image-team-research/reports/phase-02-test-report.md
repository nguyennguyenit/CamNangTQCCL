---
title: "Báo cáo kiểm thử Phase 2 — MCP TQCCL"
date: 2026-07-28
status: done
scope: "Phase 2: harden domain recommendation and provenance"
node: "v22.16.0"
---

# Báo cáo kiểm thử Phase 2 — MCP TQCCL

## Tóm tắt

- Vòng regression cuối chạy độc lập trên Freeze 6 sau sửa locked referential integrity/ID-holder mapping, ambiguity fail-closed, serializer allowlist, normalization hard bounds, slot index tùy chọn và mixed explicit/omitted slot reservation; Node `v22.16.0` qua NVM.
- Tất cả gate đều xanh: focused JS `70/70`, MCP domain `84/84`, root Node `133/133`, dist `9/9`, focused E2E `2/2`, full E2E `14/14`, Python `82/82`, Worker `53/53`.
- Phase regression gate dùng `npm run test:node` sau root build.
- Kết luận: Phase 2 regression PASS, không còn lỗi hoặc blocker mở.

## Môi trường

- Working directory: `/Users/plateau/Project/CamNangTQCCL`
- `.node-version`: `22.16.0`
- NVM activation: `source "$HOME/.nvm/nvm.sh" && nvm use --delete-prefix 22.16.0`.
- Node/npm dùng cho mọi gate JavaScript: `v22.16.0` / `10.9.2`.
- Python: `3.14.6`.
- Mỗi lệnh Node bên dưới thực tế chạy sau:

```bash
source "$HOME/.nvm/nvm.sh" &&
nvm use --delete-prefix 22.16.0 >/dev/null
```

## Kết quả vòng regression cuối

| Phạm vi | Lệnh thực tế | Kết quả | Thời gian thực |
|---|---|---:|---:|
| Focused domain JS | `node --test tests-js/{hero-identity,match-dict,analyze-map,roster-scan-map,roster-scan-state,team-recommend-engine}.test.mjs` | PASS — 70 pass, 0 fail, 0 skip | 0.18s |
| Workflow closure | `cd mcp-worker && npm run check:workflow-build` | PASS | 0.62s |
| MCP domain | `cd mcp-worker && npm test -- --run test/domain` | PASS — 7 files, 84 pass, 0 fail | 1.09s |
| MCP typecheck | `cd mcp-worker && npm run typecheck` | PASS | 1.60s |
| MCP build | `cd mcp-worker && npm run build` | PASS | 1.37s |
| MCP Node-min smoke | `cd mcp-worker && npm run test:node-min` | PASS | 0.18s |
| Root build | `npm run build` | PASS — 1 page, có `dist/js/hero-identity.js` | 1.23s |
| Dist verification | `npm run verify` | PASS — 36 files, 34 raw assets | 0.16s |
| Dist contracts | `npm run test:dist` | PASS — 9 pass, 0 fail | 0.32s |
| Root Node script | `npm run test:node` | PASS — 133 pass, 0 fail, 0 skip | 3.94s |
| Focused browser smoke | `npm run test:e2e -- tests-e2e/mcp-domain-compatibility.spec.mjs` | PASS — 2 pass, 0 fail | 5.54s |
| Full browser E2E | `npm run test:e2e` | PASS — 14 pass, 0 fail | 15.59s |
| Python unittest | `python3 -m unittest discover -s tests` | PASS — 82 pass, 0 fail | 0.59s |
| Worker tests | `cd worker && npm test` | PASS — 6 files, 53 pass, 0 fail | 0.94s |
| Worker typecheck | `cd worker && npm run typecheck` | PASS | 0.90s |

Không có test bị skip/cancel/todo trong các suite có thống kê. Không chạy coverage vì phase gate không yêu cầu coverage.

## Cảnh báo không chặn

- Node báo `ExperimentalWarning` cho `--experimental-strip-types`.
- Playwright web server báo `NO_COLOR` bị bỏ qua do `FORCE_COLOR`.
- Không có cảnh báo nào làm gate fail.

## Khuyến nghị

1. Giữ thứ tự root `build -> verify -> test:dist -> test:node`; Freeze 6 đã dùng đúng thứ tự này.

## Câu hỏi chưa giải quyết

- Không.
