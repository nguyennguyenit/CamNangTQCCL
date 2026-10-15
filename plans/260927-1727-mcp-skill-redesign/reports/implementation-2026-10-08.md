# Triển khai code 2026-10-08 (`/ak:cook --tdd`)

Worktree `../worktrees/CamNangTQCCL-mcp-skill-redesign`, branch `feat/mcp-skill-redesign` từ `main@9291400`. Chưa commit, chưa deploy.

## Đã làm

| Phase | Kết quả | Bằng chứng chính |
|---|---|---|
| 1b | Sửa 8 lỗi audit trong `recommendRoster` và adapter dùng chung; thêm `analyzeTacticSubstitutes`, trạng thái `unreconciled`/`incompatible`, `variantUnrated`; gỡ `suggestTacticSubstitutes` | `tests-js/roster-adapter-audit.test.mjs`, fixture `tests-js/fixtures/roster-adapter-fixtures.mjs` (bản ghi thật) |
| 1 | Snapshot v3: projection `catalog-entities-NN`, `reference-registry`, `reference-team-index`, `reference-team-details-NN`, `public-routes`; shard ≤ 2 MiB, grammar cố định; mixed generation/sai hash/symlink/shard lạ bị từ chối; v1/v2 giữ identity | `mcp-worker/test/data/publication-snapshot.test.ts`, `test/release/publication-worker-assets.test.ts` |
| 1 | Bề mặt 7 tool P\*; 8 tên cũ đã xoá; schema input không union/`$ref`; mô tả ≤ 200 byte; `tools/list` ≈ 85 KB (trần 98304 giữ nguyên); `content[0].text` là JSON | `test/research/{catalog-tools,team-tools,recommend-teams,recommend-web-parity,playbook}.test.ts`, `test/transport/all-tools-parity.test.ts`, `test/mcp/registry.contract.test.ts` |
| 1 | `js/roster-season-candidates.js`, `js/roster-scan-state.js` nằm trong `semanticFiles` | `test/domain/workflow-build.test.ts`, `npm run check:workflow-build` |
| 2 bước 0 | `agent-knowledge/` (80 rule, 65 invariant), core `mcp-worker/src/knowledge/`, bundle sinh `src/generated/knowledge-bundle.ts`, CLI `search-rules` (không đăng ký MCP); invariant luôn ở required (kể cả điều kiện unknown, `conditionStatus`) | `test/knowledge/*`, ledger `reports/rule-migration-ledger.md` |
| 2 | Skill `tqccl-lookup` mới; coexist và research làm lại; evals; helper Python đã gỡ | `tests-js/agent-skills-contract.test.mjs`, baseline `reports/skill-baseline-capture.md` |
| Publish site | Bản dịch publish lại (generation Recommended `9945cf05…`), route ledger re-pin | `site_localization check --stage public`, `team_route_handles --check` |

Review code (code-reviewer): H1 khoá chiến pháp lệch web/MCP, H2 ngân sách playbook, M1–M7, L1–L10 đã sửa; seasonal engine path trong `js/team-recommend-engine.js` giữ lại cho `rulesetScoringReady` sau này.

## Kiểm tra đã chạy (sau sửa review)

- Root: `npm run build`, `verify`, `test:dist`, `check` đạt; `npm run test:node` 538/538.
- MCP: `npm run check` (497 test, workflow/knowledge bundle check, typecheck, build, node-min, control-plane), `test:stdio` 3/3, `test:worker` 3/3, `test:release` 76/76.
- Smoke stdio thật từ `/tmp` (lệnh phase 4): `tools/list` đúng 7 tên; `tqccl_get_entity` trang bị (zh) và lỗi `REFERENCE_NOT_FOUND` có cấu trúc.

## Chưa làm / NOT_RUN

- Deploy production và reconnect Dewee: chưa làm. Bước 0 của phase 1 đã kiểm ngày 2026-10-08 (Dewee gọi `sha256:a3db20b1…`, lệch repo; xem `dewee-runtime-2026-10-07.md`). Deploy dời tới khi code xong theo quyết định user, chạy một lần ở phase 4 bước 8.
- Phase 2: routing traces thật, so skill/no-skill, owner review ledger (mọi dòng còn `pending`) — cần chạy R0–R2 trên Dewee `tra`.
- Phase 3 (Dewee evolution `suggest_only`) và phase 4 bước 8 (R0–R2, cutover): cần Dewee và skill đã upload.
- `check:repository` (cần clean source, chạy khi release).

## Rủi ro còn lại

- Playbook `research` ≈ 33,9k/40k ký tự; có test headroom ≤ 34.000, thêm invariant research sẽ cần chia `stage`.
- `tools/list` gọn nhờ bọc handler private `_requestHandlers` của SDK 1.30.0; nâng SDK phải chạy lại integration test.
- `get_entity` `profile` vẫn là `record<string, unknown>`; team detail đã có allowlist + schema hữu hạn.
- Ngưỡng retrieval (0.5 score, 0.4 coverage) chưa calibrate.
