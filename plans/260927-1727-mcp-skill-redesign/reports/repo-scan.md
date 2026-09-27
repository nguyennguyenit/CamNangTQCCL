# Khảo sát repo: MCP và skill

Ngày 2026-09-27. Khảo sát file trên working tree; không khẳng định các thay đổi đã commit/deploy.

## Nguồn kiểm tra

- `README.md`, `package.json`, `docs/mcp-research-server.md`, `docs/goclaw-mcp-skill-handoff.md`.
- `mcp-worker/src/{data,domain,research,mcp}/`, `mcp-worker/workflow-source-manifest.json`.
- `src/lib/{root-static-artifacts,recommended-reference-artifacts,team-detail-routes,locale-routes,blog-posts}.ts`.
- `js/{lookup-data,unified-lookup,website-display}.js`, `src/lib/public-artifact-manifest.mjs`.
- `.agents/skills/tqccl-{research,coexist-team-builder}/`, gồm script và reference liên quan.
- `docs/community-worker.md`, `community-worker/src/`, `src/pages/llms.txt.ts`.
- `plans/260907-2333-project-research-skill/plan.md` để phân biệt code đã có và hành vi đã kiểm chứng.

## Repo đã thay đổi thế nào

| Bề mặt | Hiện trạng quan sát | Tác động đến thiết kế |
|---|---|---|
| Site | Astro static routes, vanilla modules, trang chi tiết có handle đóng băng | MCP cần link từ route catalog; không suy slug từ tên |
| Đội chuẩn | Generation được chọn có 1.366 records, 29 seasonOptions, 87 scopes | Cần API đọc source reference độc lập recommendation |
| Đội khác | Publication `other-teams.json` có 40 variants được nhận; MCP legacy có 166 teams | Hai corpus phục vụ mục đích khác nhau; không thay thế ngầm |
| Lookup | Sáu nhóm; heroes/tactics + equipment/advisors/troopMods/buildings; specials thuộc equipment | MCP hiện chỉ search hero/tactic/team/book |
| Localization | `website-display.json` pin source hashes và recommended generation; locale `vi`/`zh` | Hiển thị không được làm đổi canonical identity hay scope game |
| Community | Worker riêng có auth, D1/R2, moderation, AI analyze, blog build fetch | Không đưa cookie/quyền quản trị vào bearer MCP chỉ đọc |
| Research skill | Ba nhánh research, ba trạng thái claim, budget 5 external calls/topic | Giữ các chính sách đã chốt; thêm đường đọc snapshot đúng |
| Coexist skill | Dùng JSON legacy, Python lọc riêng, đường script tuyệt đối theo máy tác giả | Chuyển sang workflow MCP/CLI và dữ liệu account của phiên hiện tại |

Các số đếm trên là observation tại thời điểm khảo sát, không hardcode thành invariant hoặc test kỳ vọng dài hạn.

## Những khoảng trống đã chứng minh

### 1. MCP chưa phủ publication mới

`artifact-contracts.ts` chỉ có sáu legacy artifacts và năm sidecar scenario/ruleset. `lookup-bundle.ts` kiểm generation lookup ở ingress, nhưng catalog không trở thành MCP artifact. `research-contracts.ts` chỉ cho bốn search kinds. Recommended generation, Khai hoang, route ledger và website-display không nằm trong inventory MCP hiện hành.

CLI `version` trả `manifestVersion=2`, 166 teams, 202 heroes, 406 tactics; hai scenario đều có `rulesets: []`, và `season-team-configs`/`season-team-evaluations` đều rỗng. Capability `seasonContext=true` biểu thị khả năng protocol/snapshot, không chứng minh có luật dùng được.

### 2. Skill Cùng Tồn đang có đường thực thi khác engine

Skill trỏ `/Users/plateau/.agents/skills/.../list_candidate_teams.py` dù source skill nằm trong repo. Script tự chọn best tier, so tên raw, không canonical normalization, workflow binding hoặc scope seasonal. Reference account cũ được gọi bởi các cụm như “team của mình”; không nên đóng vai kho account chung cho người dùng mới.

Probe đọc-only:

```sh
python3 .agents/skills/tqccl-coexist-team-builder/scripts/list_candidate_teams.py \
  --project . --require-available --no-conflicts --limit 1 --json
```

Không truyền roster, script vẫn trả một team với `missingHeroes: []` và `conflicts: []`. Nguyên nhân: tập `available` rỗng được coi là không cần tính thiếu; tập `used_tactics` rỗng không phân biệt chưa biết với đã xác nhận rỗng. Đây là kết quả lọc kỹ thuật, chưa đủ để kết luận “người dùng xây được đội”. Thiết kế mới phải thể hiện unknown và yêu cầu dữ liệu trước recommendation.

### 3. Ownership có sẵn cần giữ

`docs/goclaw-mcp-skill-handoff.md` giao GoClaw consumer, image extraction, UX confirmation và credential cho repo consumer. Không thêm config/skill GoClaw vào đây. Skill local của CamNangTQCCL có thể dùng MCP nhưng không thay quyền sở hữu đó.

### 4. Research validation chưa hoàn tất

Checkpoint 2026-09-14 trong plan cũ ghi Phase 1 đóng, Phase 2 candidate đã đóng băng nhưng chưa có capture hợp lệ cuối; Phase 3 chưa mở. Memory cũ có các mốc 22/35 baseline sớm hơn; dùng checkpoint repo mới hơn, không lặp lại số cũ như hiện trạng.

## Kiểm tra đã chạy

- Node `v24.14.0`; repo yêu cầu `>=24.20.0 <25`: lệch môi trường.
- Từ `mcp-worker/`: `npm run test -- test/research test/domain/source-graph.test.ts test/data/lookup-bundle.test.ts` → **5 files, 67 tests PASS**. Không có file `test/data/lookup-bundle.test.ts`; đây là filter không match, không phải bằng chứng có suite lookup riêng đã chạy.
- `npm run --silent cli -- version` → exit 0; v2 snapshot có release `sha256:a33dc5e204c0134b6f611f40b73170b63240e47ab6400a611405ba6caf422913`.
- Kiểm path các Markdown links trong research SKILL: tồn tại.
- Đọc JSON generation đang chọn để thống kê và xem field contracts.
- Không chạy builder ghi dữ liệu, không khởi chạy dev server, không deploy hoặc sửa WIP.

## Giới hạn

Chưa xác nhận remote deployment, nội dung community đang public, đủ mọi gate release, hay consumer behavior của skill mới. WIP đang thay đổi rộng nên implementation cần pin lại exact input trước khi sửa.

## Câu hỏi chưa giải quyết

Không có câu hỏi chặn việc hoàn tất thiết kế. Nếu sau này mở community MCP, cần chốt đối tượng dùng và quyền đọc/ghi riêng trước khi chọn auth/API contract.
