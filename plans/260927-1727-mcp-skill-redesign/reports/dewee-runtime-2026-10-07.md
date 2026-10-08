# Dewee runtime và source — 2026-10-07

Kiểm read-only bản Dewee đang chạy (`/Users/plateau/dewee`, `http://localhost:18790`) và source `/Users/plateau/dewee-src`. Không đọc giá trị secret; credential chỉ ghi có/không.

## Runtime

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Binary | `ab0db8cc` (dirty build), khớp `dewee-src` HEAD | `go version -m dewee`: `vcs.revision=ab0db8cc…`; `git -C dewee-src log -1` |
| Lưu cấu hình | PostgreSQL local; truy vấn với `default_transaction_read_only=on` | `.env.local` có `GOCLAW_POSTGRES_DSN` |
| MCP TQCCL | `tqccl`, streamable-http, `https://mcp.tqccl.com`, timeout 60s, enabled | bảng `mcp_servers` |
| Auth | Header tĩnh cấp server: có. `api_key`: không. `require_user_credentials=false`; `mcp_user_credentials`, `mcp_oauth_credentials`, `mcp_user_grants` đều 0 dòng | bảng `mcp_servers`, `mcp_user_*` |
| Quyền | Chỉ agent `tra` có grant `tqccl`, `tool_allow`/`tool_deny` NULL (mọi tool server trả về đều thấy) | bảng `mcp_agent_grants` |
| Tên tool phía Dewee | `mcp_tqccl__<tool>` | `sessions.messages` |
| Đã gọi | `tqccl_search` 55, `tqccl_get_team` 16, `tqccl_get_data_version` 15, `tqccl_match_team` 4; tổng 90, đều agent `tra`; 2026-08-09 → **2026-08-22T18:20:39Z**; không có lượt nào sau đó | `sessions.messages` tool_calls |
| Lỗi trong tool result | `INVALID_REQUEST` (sai tham số get_team/match_team), `WORKFLOW_VERSION_CHANGED` (search, get_team) — lỗi dùng sai/version cũ, không phải auth/timeout | `sessions.messages` (08-15, 08-22) |
| Skill TQCCL | Không có. 8 skill hiện có: docx, goclaw, pancake-pos-create-order, pdf, pptx, skill-creator, workspace-organizing, xlsx | bảng `skills`; grep `tqccl` trong `workspace/`, `data/skills-store`, `agent_context_files` = 0 |

Bản ghi deploy MCP mới nhất là 2026-08-25, release `sha256:a3db20b1…` (`docs/deployment.md`). Lượt gọi cuối của Dewee (08-22) có trước deploy đó; chưa biết Dewee sẽ gặp release nào ở lượt gọi kế tiếp.

## Source `ab0db8cc`

**Skill**
- Nạp từ đĩa (workspace `skills/`, `.agents/skills/`, global) và managed store `skills-store/<slug>/<version>/` — `internal/skills/loader.go:1-14,100-152,222-300`.
- Cài bằng upload ZIP `POST /v1/skills/upload` (`internal/http/skills.go:110-111`), import hàng loạt (`internal/http/skills_import.go`), tool `publish_skill`; có version và grant theo agent/user.
- Giới hạn mặc định 20 MB, tối đa cấu hình 500 MB — `internal/config/config.go:182-184`.
- Prompt chỉ chứa metadata (`name`, `description` ≤200 ký tự, `location`); nội dung `SKILL.md` và `references/` đọc khi cần bằng `read_file` — `loader.go` `BuildSummaryFrom`, `internal/agent/systemprompt_sections.go:285-301`, `internal/tools/filesystem.go:370-397`.
- Không có đồng bộ từ repo ngoài; mỗi lần đổi phải upload/import lại.
- Skill evolution có chế độ `suggest_only` và `auto_analyze` — `internal/store/skill_evolution_store.go:12-13`.

**MCP**
- Danh sách tool chỉ lấy khi kết nối (`internal/mcp/manager_connect.go:78-84`); không xử lý `list_changed`; health loop chỉ ping 30s.
- `fullReconnect` không lấy lại danh sách tool — `manager_connect.go:483-486`. Tool mới chỉ xuất hiện khi agent re-resolve: sửa cấu hình MCP/grant, `POST /v1/mcp/servers/{id}/reconnect`, hoặc restart.
- Grant per-agent/per-user có `tool_allow`/`tool_deny`, lọc lúc đăng ký và kiểm lại mỗi lần gọi — `internal/mcp/tool_filter.go:13-16`, `bridge_tool.go:200-215`.
- Quá 40 tool thì chuyển sang chế độ tìm tool — `internal/mcp/manager.go:29-32`.
- Kết quả: phần structured cắt ở 40.000 ký tự (`bridge_tool.go:455-475`); toàn bộ kết quả cắt ở 48.000, phần vượt ghi ra file — `internal/config/defaults.go:15-25`.

## Hệ quả cho plan

1. Dewee nạp được gói skill có `references/`; lý do giữ `tqccl_get_playbook` là logic chọn mùa, readiness và version chạy ở server, không phải vì Dewee không đọc được file.
2. Lỗi `INVALID_REQUEST`/`WORKFLOW_VERSION_CHANGED` xảy ra khi agent `tra` không có skill; skill portable (phase 2) và playbook cùng nhắm vào loại lỗi này.
3. Sau mỗi release MCP thêm hoặc đổi tool: gọi reconnect server `tqccl` trên Dewee rồi kiểm `tools/list` của agent `tra`.
4. Đã xác minh 2026-10-08: Dewee đang gọi release `sha256:a3db20b1…` (deploy 08-25), lệch repo — xem mục dưới.

## Bước 0 — release MCP Dewee đang gọi (user, 2026-10-08)

Agent `tra` gọi `tqccl_get_data_version`:

| | Đang chạy (Dewee thấy) | Repo hiện tại (`npm run cli -- version`) |
|---|---|---|
| Release | `sha256:a3db20b188b1e8d0…` (= deploy 2026-08-25, `docs/deployment.md`) | `sha256:a7cd638e45576faa…` |
| Data version | `data:a3db20b188b1` | `data:a7cd638e4557` |
| Workflow | `workflow:o9sgsYix…` | `workflow:sha256b64:p81jjkVX…` |
| `teams.json` | 166 | 166 |
| `team-tier.json` | 31 | 31 |
| `coexist.json` | 5 | 5 |
| `heroes-dict.json` | **112** | **202** |
| `tactics.json` | **239** | **406** |
| `books-dict.json` | 66 | 68 |
| Season sidecars | không có trong danh sách user gửi | 5 (`season-registry` 2, `season-evidence` 3, `season-team-configs` 0, `season-team-evaluations` 0, `season-content-links` 10) |

Kết luận: MCP production lệch repo. Dewee đang thiếu 90 tướng và 167 chiến pháp so với website; tra cứu và chuẩn hoá tên cho các tướng/chiến pháp mới sẽ không tìm thấy. Theo [phase 1](../phase-01-mcp-publication.md) bước 0: deploy exact SHA hiện tại, ghi bản ghi deploy, reconnect server `tqccl` trên Dewee.
