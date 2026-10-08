# Bước 1 — Publication và MCP

Trạng thái: chưa triển khai. Context: [design](design.md), [scan](reports/repo-scan.md).

## Điều kiện đầu vào

Chốt baseline WIP và ownership trước sửa; không discard/stash thay đổi người khác. Xác minh Node theo `.node-version`. Pin bytes/generation dùng cho cả website và MCP.

**Bước 0 — MCP live và Dewee:** bản ghi deploy MCP mới nhất là 2026-08-25 (`docs/deployment.md`, release `sha256:a3db20b1…`). Cho agent Dewee `tra` gọi `tqccl_get_data_version` (tool cũ, còn tồn tại trước cutover), so `releaseId` với release của repo (`npm run cli -- version`). Nếu lệch: deploy exact SHA hiện tại, ghi bản ghi deploy, rồi reconnect server `tqccl` trên Dewee (`POST /v1/mcp/servers/{id}/reconnect` hoặc restart; `fullReconnect` không lấy lại tool list — [dewee#887](https://github.com/nextlevelbuilder/dewee/issues/887)). Chi tiết: [Dewee runtime](reports/dewee-runtime-2026-10-07.md).

**Bề mặt đích:** 7 tool P\* ([design §4](design.md)). Phase này làm `tqccl_search`, `tqccl_get_entity`, `tqccl_find_teams`, `tqccl_get_team`, `tqccl_normalize_entities` (giữ) và `tqccl_recommend_teams`; `tqccl_get_playbook` thuộc [phase 2](phase-02-skills.md) bước 0.

**Release 1 (6 tool):** bốn tool đọc mới + `tqccl_normalize_entities` (không gồm `tqccl_recommend_teams`), cộng `tqccl_get_playbook`. Cần phase 2 bước 0 xong (playbook thay `get_data_version`). Xoá 8 tên cũ trong cùng release, không alias.

**Release 2 (`tqccl_recommend_teams`):** chỉ sau khi adapter/engine dùng chung đã sửa lỗi audit (fallback tên Việt + "chưa đối chiếu", lọc kho trước khi cắt 60/80, món bù theo `troopFit`, nhãn biến thể) có fixture `s28-wutugu-huangma`, `team-831163` và probe >60/>80 ứng viên, và website đã ship bản sửa. Giữa hai release, corpus engine vẫn đọc qua `tqccl_find_teams`/`tqccl_get_team` (`collection:"engine"`), nhưng MCP không có tool ghép đội.

## Files

- Sửa `mcp-worker/src/data/{artifact-contracts,filesystem-data-source,static-assets-data-source,lookup-bundle,public-snapshot-view}.ts`.
- Sửa `mcp-worker/src/research/{research-contracts,research-handlers}.ts`, `mcp-worker/src/mcp/tool-definitions.ts`, `mcp-worker/src/cli.ts` (`CLI_ALIASES` sang 7 tên; xoá 8 tên cũ).
- Sửa scripts builder/verifier/release có inventory assumptions, `mcp-worker/workflow-source-manifest.json`; generated ID chỉ sinh bằng script owner. Thêm `js/roster-season-candidates.js` và dependency của nó vào `semanticFiles` (hiện chưa có) để sửa adapter làm đổi `workflowVersion`.
- Tạo `mcp-worker/src/data/publication-projection.ts`, `mcp-worker/src/research/{catalog-handlers,team-handlers,recommend-handlers}.ts`. `recommend-handlers` import `js/roster-season-candidates.js` như `legacy-domain-adapter.ts` import engine; không viết engine thứ hai. `team-handlers` thay `boundedJson` bằng `section`/cursor + `omittedCounts`.
- Chỉ tách pure validator từ website khi cần; không import Node/DOM vào Worker.

## Thực hiện

1. Đo bytes projection và max detail; chốt deterministic shard layout dưới 8 MiB/artifact trước khi viết reader.
2. Viết RED tests cho snapshot v3, mixed generation, private-field exclusion, route/locale parity.
3. Implement builder và readers dùng verified bytes; v1/v2 fixtures giữ identity cũ.
4. Implement 6 tool của phase này theo [design §4](design.md): selector `reference` và `kinds`/`collection` nằm trong `properties` (không union ở gốc, không `$ref`/`$defs`); `expectedWorkflowVersion` optional ở tool đọc, bắt buộc khi có `cursor`/`confirmationBinding`; mô tả tool có câu "khi dùng / trả về / lỗi" trong 200 byte đầu; structured output dưới 40.000 ký tự hoặc phân trang.
5. Gỡ 8 tool cũ khỏi contracts, definitions, CLI và tests; corpus engine chuyển sang `collection:"engine"`. Kiểm output qua discovery thật (`tools/list` stdio + HTTP).
6. Cập nhật source graph, regenerate workflow ID, kiểm closure không bỏ semantic dependencies.

## RED → GREEN

| RED | GREEN |
|---|---|
| Trang bị, Quân sư, Cải tạo binh chủng, Công trình không tìm được; Tướng/Chiến pháp/Binh thư chỉ có ID + tên | Search/detail đủ bảy nhóm Tra cứu, đúng ID, public fields và link; detail mỗi nhóm khớp hồ sơ `/tra-cuu/<nhóm>/` (vi/zh) |
| Recommended chỉ có trên site | `tqccl_find_teams`/`tqccl_get_team` đúng source season và holder/slot |
| Source season bị dùng như ruleset | Đọc reference được; `tqccl_recommend_teams` chỉ ghép theo nguồn với `rulesetVerified:false`; không nhận `seasonContext` |
| Other trả raw legacy tùy ý | Chỉ admitted variant; corpus engine chỉ qua `collection:"engine"` |
| Chiến pháp thay thế nguồn và món bù theo kho lẫn nhau | `alternatives`/`tacticRefs` ở `tqccl_get_team`; `substitutes[]` theo kho ở `tqccl_recommend_teams` |
| `tools/list` còn tên cũ hoặc có union/`$ref` ở input schema | Đúng 7 tên; input schema gốc là `type:object`, không `oneOf`/`anyOf`/`allOf`/`$ref` |
| Gửi `expectedWorkflowVersion` lệch nhưng vẫn chạy | `WORKFLOW_VERSION_CHANGED`; bỏ field thì chạy với version hiện tại |
| Roster không biết nhưng claim buildable | Giữ unknown; chặn suy luận sở hữu |
| Cursor replay khác scope/tool/locale | CURSOR_INVALID |
| Detail quá lớn | Section/pagination hoặc lỗi bounded; không mất slot mà báo đầy đủ |
| Sai hash, symlink, mixed inventory | DATA_UNAVAILABLE đã redact |
| Sửa adapter mùa nhưng `workflowVersion` giữ nguyên | Adapter nằm trong `semanticFiles`; sửa adapter đổi `workflowVersion` |
| Ghép đội qua MCP khác trang Gợi ý kho với cùng roster/mùa | Cùng adapter, cùng generation; output trùng theo đội, bậc, nhãn |
| Client ném protocol error khi tool lỗi | OutputSchema validate structured error sau listTools |

Tests mới: `mcp-worker/test/data/publication-snapshot.test.ts`, `test/research/{catalog-tools,team-tools,recommend-teams}.test.ts`, test contract mô tả/schema cho 7 tool. Viết lại `test/transport/all-tools-parity.test.ts` cho 7 tên; xoá test của 8 tool cũ cùng lúc gỡ tool.

## Validation, rủi ro và rollback

Chạy tests mới trước, rồi data/research/domain/transport, typecheck và source-graph checks. Build release chỉ từ baseline sạch đã kiểm chứng. Inventory v3 phải được cập nhật coherent ở builder, reader, verifier và version output. Giữ exact v1/v2 release để rollback; không vá digest bằng tay khi publication đổi giữa chừng.

## Bổ sung mùa mặc định

Mùa: đóng `seasons` của bản publish Recommended (`defaultSourceSeasonId`, `seasonOptions`) vào snapshot v3; tool validate `sourceSeasonId` theo registry đó. Không có artifact season policy riêng; xem [season design](season-resolution-design.md).
