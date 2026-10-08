# Debate: bề mặt tool MCP (P*)

Ngày chạy: 2026-10-07 · Run `mcp-tools-1` / decision `tool-surface` · 3 vòng.
Agent: `debate1` (proponent, role `@DEBATE1`) và `debate2` (skeptic, role `@DEBATE2`). Advisory; không sửa plan trong run.

**Status: COMPLETE.** Mỗi bên `write(agent://<peer>)` 3 lần đúng peer id (D1: r1–r3; D2: r1, r2, ACK). Exchange record khớp; không cần sửa peer id.

## Câu hỏi

Thay bề mặt MCP (8 tool cũ + 6 tool mới theo plan = 14) bằng bộ ~7 tool gộp theo việc agent cần làm (P), hay chọn bề mặt khác?

Ràng buộc user: không cần giữ 8 tool cũ hay hành vi legacy (2026-10-07); `tqccl_search_rules` chỉ đăng ký khi chạm ngưỡng; agent Dewee `tra`; service key chung; ghép đội qua MCP phải trùng trang Gợi ý kho; MCP read-only.

## Verdict

**Chọn P\***: 7 tool thay 14, không giữ alias cũ. D1 78%, D2 84%. Không còn crux factual mở.

| Tool | Thay cho | Việc |
|---|---|---|
| `tqccl_get_playbook` | `get_data_version` + playbook | Version, capabilities, chọn mùa, readiness tách `referenceFitReady` / `rulesetScoringReady`, required rules + guidance, next-step tool names |
| `tqccl_search` | `search` + `search_catalog` | `kinds` ⊆ {hero, tactic, equipment, advisor, troopMod, building, book, team}; trả `entityId`, `kind`, `displayName`, `matchedTerm`, `pagePath` |
| `tqccl_get_entity` | `get_catalog_entity` | Hồ sơ 1 mục Tra cứu khớp `/tra-cuu/<nhóm>/` (vi/zh); `section`/cursor cho nested; `omittedCounts` |
| `tqccl_find_teams` | `match_team` + `browse_reference_teams` | Lọc theo `collection` ∈ {recommended, other, khaihoang, engine}, `sourceSeasonId?`, `sourceCategoryId?`, `query?`, `heroes[{canonicalId, tacticIds[]}]` (đúng holder), `minHeroes` |
| `tqccl_get_team` | `get_team` + `get_reference_team` + nhánh đọc của `suggest_replacements` | Chi tiết 1 đội qua selector lồng `reference:{collection, …}`; `alternatives`/`tacticRefs` theo ô; `sourceScore` chỉ cho cấu hình gốc; `section`/cursor (không dùng `boundedJson`) |
| `tqccl_normalize_entities` | giữ | Text/OCR → `canonicalState` + `confirmationBinding`; báo ambiguity |
| `tqccl_recommend_teams` | `recommend_team` + `recommend_coexist` + `recommend_from_reference` + nhánh món bù của `suggest_replacements` | Đúng `recommendRoster` của `js/roster-season-candidates.js`; `substitutes[]` theo kho; nhãn "đã thay"; `basis:"source-reference-fit"`, `rulesetVerified:false`; không nhận `seasonContext` |

## Diễn biến

- **r1.** D1 mở P (72%). D2 (78→82% "P nguyên trạng chưa đủ"): adapter ném khi có `seasonContext`; replacements nguồn ≠ món bù theo kho; Dewee không chuyển `oneOf` gốc; `find_teams` phải giữ `heroes[{canonicalId,tacticIds}]`; bác "user đã bỏ ruleset".
- **r2.** D1 (72→75%) rút "user đã bỏ ruleset", đổi "consumer duy nhất" thành "chưa phát hiện consumer khác", nhận 3 ranh giới việc của D2. D2 (82→86%): chấp nhận 7 tool; `expectedWorkflowVersion` optional nhưng honor khi gửi; tách readiness.
- **r3.** D1 (75→78%): `season-registry.json` cả hai scenario `rulesets: []`; đóng với P*. D2 ACK (84%): reconnect Dewee mỗi lần đổi catalog tool, không chỉ một lần.

## Đã xác lập

- [OBSERVED] `recommend_team` và `recommend_coexist` cùng `recommendationInputSchema` (`research-contracts.ts:858-865`) và cùng `legacyDomainAdapter.recommendTeams`; coexist chỉ thêm `coexistReference` chưa chấm (`recommendation-service.ts:204-245`).
- [OBSERVED] `suggest_replacements` legacy đọc `tactic.alternatives` từ record team (`recommendation-service.ts:258-285`); `seasonalReplacements` lấy mọi `tacticRefs` cùng ô theo holder/slot (`:303-314`); `suggestTacticSubstitutes` lọc theo kho/reservation (`roster-season-candidates.js:170-188`) — hai việc khác nhau.
- [OBSERVED] Website gọi `recommendRoster` không truyền `seasonContext` (`js/roster-recommend-ui.js:544-556`); engine ném `Invalid seasonal candidate identity` khi có `seasonContext` mà team thiếu `candidateKey` (`team-recommend-engine.js:527-533`); team từ `buildSeasonCandidates` không có `candidateKey` (`roster-season-candidates.js:56-70`).
- [OBSERVED] `data/season-registry.json` cả hai scenario `rulesets: []`; `resolveSelectionScore` trả null khi lựa chọn khác cấu hình gốc (`js/season-context.js:405-408`).
- [OBSERVED] Dewee `inputSchemaToMap` chỉ chuyển `type/properties/required/additionalProperties` (`dewee-src/internal/mcp/bridge_tool.go:323-343`).
- [OBSERVED] `ensureExpectedWorkflow` đã honor-if-supplied (`research-handlers.ts:247-257`).
- [OBSERVED] `tqccl_search` chỉ `hero|tactic|team|book` (`research-contracts.ts:543-548`); "Thanh Long Yển Nguyệt Đao" có ở `data/lookup-catalog.json` nhưng search trả rỗng.
- [OBSERVED] `boundedJson` giới hạn 180 node / depth 8 / string 256 (`research-handlers.ts:125-163`).
- [OBSERVED] `.agents/skills/tqccl-*` không gọi tên tool MCP; chỉ docs liệt kê (`docs/goclaw-mcp-skill-handoff.md`, `docs/mcp-research-server.md`).

## Còn tranh cãi

| Vấn đề | Loại | Cách giải |
|---|---|---|
| Ít tool hơn → agent chọn đúng hơn | factual (chưa đo) | Bộ hội thoại mẫu chạy trên `tra` trước và sau cutover |
| Dewee `tra` là consumer duy nhất | factual | Log Worker; cutover xoá tên cũ nên client ẩn sẽ lộ; rollback Worker exact version |
| Ngưỡng bằng chứng trước khi đổi bề mặt | value | User chốt 2026-10-07: chuyển, đo bằng bộ hội thoại mẫu trước/sau |

## Đính chính sau debate (2026-10-07)

Debate dùng "Dewee cắt mô tả tool ở 200 byte" làm bằng chứng. Kiểm thêm source Dewee:

- 200 byte chỉ áp cho danh sách tóm tắt "## MCP Tools" trong system prompt (`systemprompt_sections.go:144-168`; comment `:23-25` ghi lý do tiết kiệm token).
- Định nghĩa tool gửi cho LLM mang **mô tả đầy đủ**: `BridgeTool.Description()` (`bridge_tool.go:121-126`), Anthropic `"description": t.Function.Description` (`internal/providers/anthropic_request.go:200`); OpenAI/Gemini giữ nguyên (`schema_cleaner.go:46-50`).

Hệ quả: bỏ quy tắc "mô tả ≤200 byte, tiếng Anh". Thay bằng: câu "khi nào dùng" nằm trong 200 byte đầu (phần hiện trong tóm tắt). Mô tả **skill** vẫn giữ dưới 200 ký tự vì model chỉ thấy mô tả đó trước khi mở `SKILL.md`.

Union ở cấp gốc bị mất ngay ở `mcp-go` v1.1.0 (`mcp/tools.go:748-757`) và OpenAI strict cũng từ chối, nên quy tắc "discriminator nằm trong `properties`" vẫn đúng.

Issue phía Dewee: [#887](https://github.com/nextlevelbuilder/dewee/issues/887) (lấy lại `ListTools` sau reconnect và khi `tools/list_changed`), [#888](https://github.com/nextlevelbuilder/dewee/issues/888) (chuyển tiếp `$defs`). Schema TQCCL hiện không dùng `$ref`/`$defs`.

## Quyết định user (2026-10-07)

- Chọn P*.
- Chuyển ngay, đo bằng bộ hội thoại mẫu: trước cutover (8 tool cũ), sau cutover chưa có skill, sau khi upload skill.
- Xem log Worker trước cutover; đổi service key trong cùng đợt.
