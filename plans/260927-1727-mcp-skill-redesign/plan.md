# Thiết kế lại MCP và skill theo repo hiện tại

Ngày: 2026-09-27 · Trạng thái: **code phase 1, 1b, 2 đã triển khai trên branch `feat/mcp-skill-redesign` (2026-10-08, chưa commit/deploy); phase 3, 4 và các bước live chưa làm** — [báo cáo](reports/implementation-2026-10-08.md).
Mốc khảo sát: working tree hiện tại trên `main`, gồm thay đổi chưa commit.

## Kết quả cần đạt

Agent đọc được cùng catalog (7 nhóm Tra cứu), đội chuẩn, đội khác, Khai hoang và ngôn ngữ mà website công bố; ghép đội qua MCP trùng kết quả trang Gợi ý kho. Bề mặt MCP gồm 7 tool gộp theo việc (P\*). Skill và MCP hỗ trợ hai chiều qua workflow cards và rules. Các skill bàn giao chung scope/evidence/budget; feedback vào vòng học dùng chung có kiểm chứng và rollback.

## Ràng buộc và ngoài phạm vi

- Bề mặt MCP là **7 tool P\*** ([design §4](design.md), [debate](reports/debate-tool-surface.md)): `tqccl_get_playbook`, `tqccl_search`, `tqccl_get_entity`, `tqccl_find_teams`, `tqccl_get_team`, `tqccl_normalize_entities`, `tqccl_recommend_teams`. Xoá 8 tên cũ ở cutover, không alias (user bỏ ràng buộc giữ tool cũ, 2026-10-07). `tqccl_search_rules` có core + CLI, chỉ đăng ký khi chạm ngưỡng ở [phase 2](phase-02-skills.md).
- Build team chọn mùa trước: user chỉ định/đã xác nhận, nếu chưa có thì `defaultSourceSeasonId` của bản publish Recommended — cùng mùa nguồn như trang Gợi ý kho (user 2026-10-07; thay mặc định scenario Binh Diễn Xuân Thu).
- Giữ phân biệt source season, scenario/ruleset, locale và server/region.
- Chỉ dùng projection công khai đã xác minh; không mở private SGSDeck, tài khoản, cookie, ảnh hoặc credential.
- Không đổi SDK/protocol, policy bằng chứng hay quyền GoClaw trong đợt này. Hạn mức research đổi theo quyết định user 2026-10-09 (sau debate `research-budget-1`): một ledger/topic, nguồn ngoài ≤5 và MCP TQCCL ≤5 (playbook ≤1). Không viết thuật toán xếp đội thứ hai: MCP gọi đúng adapter/engine của website.
- Community/blog được khảo sát và có ranh giới tích hợp; chưa đưa dữ liệu động hoặc thao tác quản trị vào MCP game.
- Rule lớn ở dataset và search core; Markdown giữ entrypoint. Prototype chỉ ở thư mục kế hoạch.
- Learning phân biệt personal preference, input correction, rule gap và tool/data bug; chưa bật collector/auto-promote/global memory.
- Bản thiết kế không sửa runtime, skill đang dùng, dữ liệu game, Git hay deployment.

## Tài liệu và thứ tự

| Bước | Tài liệu | Trạng thái | Phụ thuộc |
|---|---|---|---|
| Khảo sát | [Bằng chứng hiện trạng](reports/repo-scan.md) | Đã làm | working tree |
| Thiết kế | [Kiến trúc và hợp đồng](design.md) | Đã làm | khảo sát |
| Thiết kế mở rộng | [Skill–MCP, dataset và learning loop](skill-mcp-learning-design.md) | Đã làm | yêu cầu bổ sung + upstream source |
| Mùa | [Chọn mùa nguồn như Gợi ý kho](season-resolution-design.md) | Đã thiết kế | quyết định user 2026-10-07 |
| Consumer và auth | [Dewee và cấp quyền từng user](dewee-access-design.md) | Đề xuất, đã đối chiếu source gốc | commit Dewee đã pin; runtime chưa smoke |
| Dewee runtime | [Runtime và source Dewee 2026-10-07](reports/dewee-runtime-2026-10-07.md) | Đã kiểm | Dewee `ab0db8cc` |
| Debate | [Rules dataset + tool knowledge](reports/debate-rules-dataset.md) | Đã chốt 2026-10-07 | — |
| Debate | [Bề mặt tool P\*](reports/debate-tool-surface.md) | Đã chốt 2026-10-07 | — |
| Dewee upstream | [dewee#887](https://github.com/nextlevelbuilder/dewee/issues/887) re-list tools → PR [#895](https://github.com/nextlevelbuilder/dewee/pull/895); [dewee#888](https://github.com/nextlevelbuilder/dewee/issues/888) `$defs` → PR [#896](https://github.com/nextlevelbuilder/dewee/pull/896); [dewee#900](https://github.com/nextlevelbuilder/dewee/issues/900) kết quả MCP bị gửi hai lần | #895, #896 đã merge `dev` (Dewee local `ab0db8cc` chưa có); #900 mở 2026-10-09 | user sửa |
| 1 | [Snapshot và MCP](phase-01-mcp-publication.md) — Release 1 (6 tool), Release 2 (`tqccl_recommend_teams`) | Bước 0 đã kiểm (lệch, deploy dời tới sau code); code xong 2026-10-08; deploy chưa làm | chốt baseline; Release 1 cần 2 bước 0; Release 2 cần 1b |
| 1b | [Sửa adapter Gợi ý kho](phase-01b-adapter-fix.md) | Code xong 2026-10-08; chưa ship website | chạy song song 1; website ship trước |
| 2 | [Knowledge, skill và kiểm chứng hành vi](phase-02-skills.md) | Bước 0 + skill xong; routing traces/owner review chưa làm | bước 0 song song 1; skill sau Release 1 |
| 3 | [Vòng học qua Dewee evolution](phase-03-learning.md) | Chưa làm | 2 + skill đã upload lên Dewee |
| 4 | [Tích hợp và cutover Dewee](phase-04-integration.md) | Check local đạt; R0–R2/cutover chưa làm | 1 + 1b + 2; phase 3 bật sau upload skill |

## Nghiệm thu triển khai

1. `tqccl_search`/`tqccl_get_entity` đọc bảy nhóm Tra cứu (Tướng, Chiến pháp, Trang bị, Quân sư, Cải tạo binh chủng, Công trình, Binh thư); `tqccl_find_teams`/`tqccl_get_team` đọc ba họ đội tham khảo và corpus engine; kết quả có ID, version, nguồn, scope và link đúng ngôn ngữ; detail mỗi nhóm khớp hồ sơ trên `/tra-cuu/<nhóm>/`.
2. CLI/stdio/HTTP trả kết quả tương đương cho 7 tool; `tools/list` không còn 8 tên cũ.
3. `tqccl_recommend_teams` trùng trang Gợi ý kho với cùng roster/mùa (đội, bậc, nhãn, món bù); ghi `basis:"source-reference-fit"`, `rulesetVerified:false`; không dùng source season để tạo ruleset, không chuyển điểm nguồn sang biến thể, không ngầm trộn corpus engine.
4. Snapshot sai hash, mixed generation, private fields, cursor cũ và response quá giới hạn đều bị xử lý có kiểm thử.
5. Ba skill nghiệp vụ có routing/consumer traces thật; handoff giữ scope và budget.
6. Không gọi trạng thái local là production; release và consumer rollout có evidence riêng.
7. Required rules không phụ thuộc top-k; retrieval có no-match và knowledge version.
8. Vòng học qua Dewee `suggest_only` ([phase 3](phase-03-learning.md)): metric được ghi thật; đề xuất chỉ vào repo sau khi duyệt và qua eval; hash skill trên Dewee khớp repo.

9. Mặc định mùa đổi qua bản publish Recommended, không sửa skill; mùa user đã chọn được giữ, assumption không thành confirmed fact; thiếu ruleset vẫn ghép theo nguồn với `rulesetVerified:false`, không trộn corpus engine.

10. Cutover có bằng chứng: log Worker đã xem; bộ hội thoại mẫu chạy trên Dewee `tra` trước cutover, sau cutover chưa có skill và sau khi upload skill; `tools/list` của `tra` đúng 7 tên sau mỗi release.

## Kết quả kiểm tra lúc thiết kế

67 test MCP đạt lúc khảo sát; CLI `version` đọc được snapshot v2. Node hiện `v24.20.0`, khớp `.node-version` (lúc khảo sát là 24.14.0). Chưa chạy full release gate hay authenticated tool smoke. Probe remote sau khảo sát: healthz 200, MCP không token 401. Chi tiết trong báo cáo khảo sát.

Prototype dataset có 14 rules; 10 deterministic retrieval tests đạt. Chưa là consumer A/B hoặc learning-loop implementation. Xem [thiết kế và giới hạn](skill-mcp-learning-design.md).
