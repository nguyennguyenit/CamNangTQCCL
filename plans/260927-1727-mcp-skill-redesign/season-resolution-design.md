# Mùa chơi khi tra cứu và ghép đội

Ngày 2026-09-27, sửa 2026-10-07. Quyết định user 2026-10-07: **"mùa" của agent là mùa nguồn (`sourceSeasonId`) như trang Gợi ý kho**, mặc định `defaultSourceSeasonId` của bản publish Recommended. Thay quyết định 2026-09-27 (mặc định scenario Binh Diễn Xuân Thu theo season policy riêng).

Trạng thái: thiết kế, chưa đổi skill/MCP runtime.

## 1. Chọn mùa trước chọn đội

Thứ tự, giống website (`js/roster-recommend-ui.js:161-167`: URL → mùa đã lưu → `registry.defaultSourceSeasonId` → option đầu):

1. User chỉ định mùa nguồn trong yêu cầu hiện tại.
2. Mùa user đã xác nhận trong cuộc hội thoại, đúng account/server đang xét.
3. Profile có mùa đã xác nhận cho đúng account/server, nếu host có profile được phép dùng.
4. Nếu chưa có: `defaultSourceSeasonId` của bản publish Recommended đang pin trong snapshot.

Giá trị không có trong `seasonOptions` của registry thì về mặc định và báo lại, như website (`js/recommended-reference-state.js:70-71`).

Không hỏi user chọn mùa khi đã có default dùng được. Mở đầu ngắn: "Mình đang tính theo <nhãn mùa nguồn mặc định>; bạn có thể đổi mùa." Default là assumption, không lưu thành user-confirmed fact chỉ vì user không phản đối. Skill không chứa ID hay tên mùa; nhãn lấy từ registry.

## 2. Nguồn dữ liệu

Không có artifact season policy riêng. Mặc định và danh sách mùa nguồn nằm trong `seasons` của bản publish Recommended (`defaultSourceSeasonId`, `seasonOptions`) — cùng byte website dùng, đóng vào snapshot v3 ([design §3.2](design.md)). Đổi mùa mặc định = publish Recommended mới; website và MCP đổi cùng generation.

Scenario/ruleset (`data/season-registry.json`, vd. Binh Diễn Xuân Thu) là trục khác: chỉ dùng cho chấm theo luật khi có ruleset đã review. Không suy scenario từ mùa nguồn và ngược lại khi chưa có mapping được review.

Region: mùa nguồn là mùa của nhà cung cấp nguồn; applicability cho VN/CN/Global giữ là `unknown` nếu không có bằng chứng, không suy từ locale.

## 3. MCP trả resolution để mọi skill dùng chung

Bề mặt 7 tool P\* ([design §4](design.md)). `tqccl_get_playbook` nhận lựa chọn mùa từ consumer và trả:

- `seasonSelection`: mode `explicit|session|profile|default`, `sourceSeasonId`, label, resolutionSource, selectionStatus `confirmed|assumed`, `dataVersion` của bản publish.
- `rulesetResolution`: reviewed ruleset cụ thể hoặc unresolved; không tạo ruleset từ nhãn mùa.
- `readiness`: `referenceAvailable`, `referenceFitReady` (mùa nguồn có đội để ghép theo kho; vẫn cần roster đã rà soát + binding hợp lệ khi gọi recommend), `rulesetScoringReady` (có ruleset đã review), missingRequirements, warnings.

`tqccl_recommend_teams` nhận đúng `sourceSeasonId` đó. Consumer gửi selection cùng provenance; server validate với registry trong snapshot. Caller khai `confirmed` không tự trở thành chứng minh consent; host vẫn sở hữu UX review.

Work packet và feedback record giữ **`sourceSeasonId` + `dataVersion`**, không chỉ chữ "mặc định", để tái hiện câu trả lời sau khi publish đổi.

## 4. Mùa mới

1. Pipeline Recommended publish bản mới với `seasonOptions`/`defaultSourceSeasonId` mới; website và MCP release cùng generation.
2. Agent bắt đầu task mới gọi `tqccl_get_playbook`, nhận mặc định mới. Không sửa SKILL.md.
3. Task đang làm giữ `sourceSeasonId` + `workflowVersion` đã pin; publish đổi giữa chừng thì báo `WORKFLOW_VERSION_CHANGED` khi dùng binding/cursor cũ, không trộn hai bản.
4. Profile đã pin mùa cũ không bị đổi tự động; mùa đó không còn trong `seasonOptions` thì về mặc định và báo.

## 5. Chọn đúng mùa khác với đủ dữ liệu để chấm đội

Hiện cả hai scenario trong `data/season-registry.json` đều `rulesets: []`. `tqccl_recommend_teams` ghép theo mùa nguồn + kho như trang Gợi ý kho, kết quả ghi `basis:"source-reference-fit"`, `rulesetVerified:false`; `rulesetScoringReady=false`. Không âm thầm trộn corpus engine; không chặn tra cứu/ghép theo nguồn vì chưa chấm được theo luật.

Standalone research không có mùa từ user hoặc build packet thì giữ unknown; không áp mặc định để thay bối cảnh lịch sử.

## 6. Acceptance và regression cases

- Không chọn mùa → `defaultSourceSeasonId` của bản publish, selectionStatus assumed; cùng mùa mặc định với trang Gợi ý kho.
- User chọn mùa nguồn khác có trong `seasonOptions` → dùng mùa đó; kết quả trùng website khi chọn cùng mùa.
- Mùa không có trong `seasonOptions` → về mặc định, báo lại.
- Publish đổi mặc định → task mới dùng mùa mới, không sửa skill text.
- Publish đổi giữa hai tool call → binding/cursor cũ bị từ chối; không trộn state.
- Hai account khác mùa → không dùng chéo profile.
- Scenario có nhưng ruleset trống → ghép theo nguồn dùng được, `rulesetScoringReady=false`, kết quả ghi `rulesetVerified:false`.
- Feedback "tôi đang chơi mùa X" → sửa lựa chọn của user; không đổi mặc định project.

## Tích hợp vào kế hoạch

Phase 1 đóng `seasons` của Recommended vào snapshot v3 và validate `sourceSeasonId` ở tool. Phase 2 thêm resolver vào playbook, chỉnh coexist bắt đầu bằng mùa; research nhận scope packet. Phase 4 smoke đổi mặc định và rollback.
