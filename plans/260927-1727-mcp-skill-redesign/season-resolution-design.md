# Mùa chơi của user và mặc định latest

Ngày 2026-09-27. Quyết định user: build team phải xác định mùa trước; nếu user chưa chọn thì mặc định mùa mới nhất, hiện dùng **Binh Diễn Xuân Thu**. Đây là quyết định cấu hình của project do user cung cấp, không phải kết quả khảo sát lịch phát hành mọi server.

Trạng thái: thiết kế, chưa đổi skill/MCP runtime. Bổ sung này là thẩm quyền cho cách chọn mùa trong build-team workflow; giữ source-season và ruleset validation hiện có.

## 1. Chọn mùa trước chọn đội

Thứ tự:

1. User chỉ định trong yêu cầu hiện tại, kể cả chỉ định mùa cũ hoặc nói “dùng mùa mới nhất”.
2. Mùa user đã xác nhận trong cuộc hội thoại, đúng account/server đang xét.
3. Profile có mùa đã xác nhận cho đúng account/server, nếu host có profile được phép dùng.
4. Nếu chưa có: resolve `latest` từ season policy của project theo phạm vi áp dụng.

Không hỏi user chọn mùa khi đã có default dùng được. Mở đầu ngắn: “Mình đang tính theo Binh Diễn Xuân Thu, mùa mặc định mới nhất của cẩm nang; bạn có thể đổi mùa.” Default là assumption, không lưu thành user-confirmed fact chỉ vì user không phản đối.

`latest` là selector động; `binh-dien-xuan-thu` là ID cụ thể được resolve ở một version. Skill chứa quy tắc chọn selector, không chứa tên mùa để tự sửa prompt mỗi lần có mùa mới.

## 2. Dataset có owner rõ

Mở rộng season publication pipeline với `season-defaults.json` (tên dự kiến), thuộc **game snapshot**, không thuộc knowledge preference. Input curator đặt trong pipeline; public projection validated/hash-pinned đóng cùng season registry. [Ví dụ cấu hình](prototype/season-policy.json) chỉ là design artifact.

Record production cần: policyVersion, deploymentScope, latestScenarioId, source registry digest, effectiveFrom, reviewedAt, reviewAfter, provenance và status. Required dates/identity phải hợp lệ trước activation. Không chọn latest từ thứ tự array, số S lớn nhất, ngày scrape hoặc `defaultSourceSeasonId` của nhà cung cấp.

Scope đầu tiên của project là VN theo registry hiện hành, cần công bố đây là default scope khi user chưa nói server. User chỉ rõ CN/Global hoặc server khác thì resolver dùng policy tương ứng; thiếu policy trả scope-unavailable, không ép default VN sang đó. Region không suy từ locale. Nếu nhiều server có mùa khác nhau và điều đó ảnh hưởng kết luận, chỉ hỏi phần server còn thiếu.

User đã chọn mùa cụ thể vẫn được giữ dù latest đổi; cùng người dùng có nhiều account phải tách lựa chọn.

## 3. MCP trả resolution để mọi skill dùng chung

Giữ 14 tools. `tqccl_get_playbook` nhận thêm lựa chọn mùa/scope từ consumer và trả:

- `seasonSelection`: mode `explicit|session|profile|latest`, resolvedScenarioId, label, resolutionSource, selectionStatus `confirmed|assumed`, seasonPolicyVersion, asOf.
- `rulesetResolution`: reviewed ruleset cụ thể hoặc unresolved; không tạo ruleset từ scenario label.
- `readiness`: `referenceAvailable`, `recommendationReady`, missingRequirements, warnings.

Consumer gửi selection cùng provenance; server validate scenario/region/ruleset với snapshot. Caller khai `confirmed` không tự trở thành chứng minh consent; host vẫn sở hữu UX review.

Work packet và feedback record giữ **resolved ID + policy version**, không chỉ chữ latest. Vì vậy có thể tái hiện câu trả lời trước rollover. get_data_version công bố policy capability/version; client cũ bỏ qua theo kế hoạch compatibility, input tool cũ không bị thêm default ngầm.

## 4. Mùa mới thay đổi thì cập nhật gì

1. Research/maintainer nhận thông tin mùa mới, xác minh scope và ngày hiệu lực; feedback tạo candidate, chưa tự promote latest.
2. Cập nhật registry và latest pointer cùng evidence, release game snapshot mới qua quy trình hiện hành.
3. Agent bắt đầu build mới gọi playbook/version, resolve latest sang ID mới. Không sửa SKILL.md, không retrain model.
4. Task đang làm giữ resolved season đã pin để không trộn hai mùa giữa normalize và recommend. Khi user yêu cầu chuyển mùa, bỏ binding/cursor phụ thuộc scope và review state lại.
5. Profile pinned mùa cũ không bị đổi tự động. Chế độ follow-latest resolve lại ở task mới, vẫn ghi assumption nếu user chưa xác nhận mùa cụ thể.

Freshness có `reviewAfter`: hết hạn thì báo stale cùng last-known season, thực hiện verification được phép hoặc hỏi phần cần thiết; không tự gọi mùa cũ là mới nhất đã xác minh. Không có scheduler chạy thì cập nhật không tự xuất hiện. Skill linh hoạt nhờ data refresh; muốn tự phát hiện mùa mới cần job research có lịch và budget được cấu hình riêng.

## 5. Chọn đúng mùa khác với đủ dữ liệu để chấm đội

Hiện `data/season-registry.json` có Binh Diễn Xuân Thu, region VN, nhưng `rulesets: []`. Vì vậy thiết kế có thể mặc định đúng scenario và đọc đội tham khảo ngay; chưa được gọi engine như thể luật mùa đã review.

Khi thiếu ruleset/config: trả source configurations theo mùa, giữ nhãn tham khảo, dùng research bổ sung bằng chứng nếu được yêu cầu. Không âm thầm chạy legacy và không chặn toàn bộ tra cứu chỉ vì chưa chấm được. Khi luật/config đủ, `recommendationReady=true` mở đúng đường normalize/recommend theo scope.

Default mới áp dụng build-team workflow và các handoff từ workflow đó. Standalone research không có season từ user hoặc project build packet vẫn giữ unknown nếu thiếu scope; không áp latest để thay bối cảnh lịch sử.

## 6. Acceptance và regression cases

- Không chọn mùa → Binh Diễn Xuân Thu theo policy ban đầu, selectionStatus assumed.
- User nói mùa cũ → giữ mùa cũ dù latest khác.
- User nói “mới nhất” → thắng profile pinned cũ, resolve pointer hiện tại.
- Latest đổi trong dataset → task mới dùng mùa mới, không sửa skill text.
- Latest đổi giữa hai tool calls → task pin cũ hoặc báo stale version; không trộn state.
- Hai account khác mùa → không dùng chéo profile.
- User nói CN nhưng chỉ có VN policy → không default sai region.
- Policy quá hạn, pointer thiếu, ambiguous/multiple active policies → báo trạng thái rõ, không đoán ID.
- Scenario có nhưng ruleset trống → reference dùng được, recommendationReady=false.
- Đổi scope → normalize/review lại và binding cũ bị từ chối.
- Feedback “tôi đang chơi mùa X” → sửa scope user; không đổi latest toàn project.
- Policy/evidence update → game release identity đổi, stale state/cursor xử lý đúng contract.

## Tích hợp vào kế hoạch

Phase 1 thêm season-defaults artifact/schema/identity/parity. Phase 2 thêm resolver và tests, chỉnh coexist bắt đầu bằng mùa; research nhận scope packet. Phase 3 phân loại season correction là user context hay project season update; không học lẫn. Phase 4 rollout policy+data nguyên tử và smoke rollover/rollback.
