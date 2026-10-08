# Bước 3 — Vòng học qua Dewee skill evolution

Trạng thái: chưa triển khai. Phụ thuộc phase 2 (skill portable đã upload lên Dewee). Quyết định user 2026-10-07: dùng skill evolution có sẵn của Dewee ở chế độ `suggest_only`; **bỏ** `tqccl-improve`, SQLite feedback store và promotion runner riêng.

## Outcome

Dewee ghi nhận việc dùng skill và đề xuất cải tiến; maintainer duyệt đề xuất, sửa ở repo (bản gốc), release rule qua MCP hoặc upload lại skill. Không bấm apply trên Dewee để skill trên Dewee không lệch repo.

## Dewee đã có (source `ab0db8cc`)

- Bảng `skill_evolution_settings` (mode `suggest_only` | `auto_analyze`), `skill_improvement_suggestions`, `skill_versions`, `skill_usage_metrics` — `internal/store/sqlitestore/schema.sql`; `internal/store/skill_evolution_store.go:12-13`.
- API `GET/PATCH /v1/skills/{id}/evolution`, `GET /v1/skills/{id}/evolution/suggestions`, `.../approve`, `.../reject`, `.../apply`, `GET /v1/skills/{id}/metrics`, `GET /v1/skills/{id}/versions` — `internal/http/skills.go:142-157`.
- CLI `dewee skills evolve`, `metrics [skill]`, `suggestions` — `cmd/skills_evolution_cmd.go`.
- Hiện `skill_usage_metrics` trên bản đang chạy có 0 dòng ([Dewee runtime](reports/dewee-runtime-2026-10-07.md)).

## Thực hiện

1. Bật evolution `suggest_only` cho ba skill sau khi upload (`PATCH /v1/skills/{id}/evolution`).
2. Kiểm metric được ghi thật: sau vài hội thoại của `tra`, `dewee skills metrics <slug>` có dữ liệu. Không có thì kiểm agent có gọi `use_skill` không; ghi BLOCKED, không coi là đạt.
3. Lịch duyệt hàng tuần: đọc `suggestions`; mỗi đề xuất kết thúc ở một trong: rule mới/sửa trong `agent-knowledge/`, sửa `SKILL.md`, sửa code/data (chuyển owner), hoặc reject có lý do. Ghi lại ở `plans/.../reports/` dạng đã redact.
4. Đề xuất chấp nhận: sửa ở repo, chạy eval phase 2, release (rule qua MCP; skill thì upload lại), kiểm hash skill trên Dewee khớp repo.
5. Phân loại trước khi sửa: preference cá nhân, input của người chơi ("tôi không có tướng đó"), lỗi rule/workflow, lỗi tool/data, outage. Chỉ lỗi rule/workflow đi vào `agent-knowledge/`; game fact cần evidence research, không tự tin như nguồn độc lập.
6. Feedback đổi mùa: sửa lựa chọn của user, không đổi mặc định project ([season design](season-resolution-design.md)).

## RED/GREEN

| Failure | Acceptance |
|---|---|
| Bấm apply trên Dewee | Hash skill trên Dewee khác repo bị phát hiện ở kiểm định kỳ |
| Đề xuất bỏ invariant (nguồn, xác nhận, budget) | Reject; invariant test phase 2 vẫn đạt |
| Đề xuất chứa dữ liệu cá nhân/roster | Redact trước khi ghi vào repo |
| Game fact không có evidence | `needs-evidence`, không vào rule |
| Metric không ghi | BLOCKED, không báo vòng học đang chạy |

## Ngoài phạm vi

Nút 👍/👎 hay hook feedback chủ động từ người chơi (cần sửa code Dewee); `auto_analyze`; promote tự động; global memory.

## Rủi ro

Evolution chỉ thấy tín hiệu dùng skill và trace; câu trả lời sai mà skill vẫn "succeeded" không lộ ra. Khi điều này thành vấn đề, cân nhắc hook feedback trong Dewee (PR upstream riêng).
