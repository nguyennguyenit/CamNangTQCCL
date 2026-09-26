# Phase 1 — Chốt working tree (2026-09-27)

## Trạng thái trước
- `git status`: 35 file `M`, 3 generation `??` (`0ddbd034…`, `1a4fd71a…`, `f93a51ea…`), 2 báo cáo research `??`, thư mục plan + journal `??`. Khớp dự kiến.
- `current.json` pin `f93a51ea05f65f92008c3e3677983225be3871ab74484ea345407d508c626620`.
- Orphan `0ddbd034…`, `1a4fd71a…`: chỉ còn nhắc trong `docs/project-changelog.md` (lịch sử) và `.cache/` (ignore). Đã chuyển sang `~/.Trash/CamNangTQCCL-cleanup-260926/`.

## Gate A2 (exit 0, 186 s)
| Bộ | Kết quả |
|---|---|
| `npm run test:dist` | 28/28 |
| `npm run test:node` | 352/352 |
| `npm run test:e2e` | 283 passed |
| `python3 -m unittest discover -s tests` | 381 OK |
| `worker` vitest | 6 file, 53 test |
| `mcp-worker` check | 43 file, 374 test |

## Mốc
- `policyVersion`: `site-vi-260926-bo-mua-cong-cu`.
- `baseline.notes`: `concreteLocationCount` 56657, `concreteInventorySha256` `51d6454e…`, `siteLedgerObligations` 2088, `translationObligations` 5591, `uiTranslateObligations` 68.
- `WORKFLOW_BUILD_ID`: `build:sha256b64:lusCsTDpwKjnvfr2zYciePPmkCfjc_Cqx8HzD9GrUTk`.
- Generation đang track sau commit: 36 thư mục (35 cũ + `f93a51ea…`).
