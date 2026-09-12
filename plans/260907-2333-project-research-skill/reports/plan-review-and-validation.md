# Review và validation — 2026-09-07

## Kết quả

Ba reviewer độc lập; 5 findings Medium, 5 chấp nhận và đã áp dụng, 0 bác bỏ. Các sửa đổi hoàn thiện kiểm chứng trong phạm vi brainstorm đã chốt, không đảo quyết định người dùng hoặc mở scope runtime. Không chạy behavioral tests trong lượt lập plan.

## Findings và xử lý

| Lens | Finding / bằng chứng trước sửa | Xử lý |
| --- | --- | --- |
| Assumption Destroyer | Explicit invocation chưa bảo vệ natural routing; coexist SKILL.md:3 cùng quảng bá research, :49–50 áp catalog selection | Phase3/matrix có ba intent tự nhiên, đội ngoài catalog và negative công nghệ; quan sát đúng entrypoint hoặc evidence handoff |
| Assumption Destroyer | Account override còn tùy chọn; account notes:31,67,80 có khóa/kho cũ | Case23a bắt buộc dữ liệu mới trái notes cùng account;23b account khác không thừa hưởng preferences |
| Security Adversary | Test “research và bổ sung” có thể thực ghi trong shared WIP; phase3 matrix quyền đã cấp, phase1 harness chưa có guard | Guard cấp công cụ trước dispatch, read-only mặc định; ghi attempted actions, không tính chặn write là agent tuân thủ. Thiếu capability thì blocked |
| Failure Mode Analyst | Case15 chat-only chưa chứng minh file/đọc lại; brainstorm:73–79 yêu cầu persist và research loop | Case15 hai lượt thật; chỉ allowlist report mới tại plans/reports, không overwrite; agent tự ghi, phiên sạch đọc lại, controller không làm thay |
| Failure Mode Analyst | Handoff thiếu consumed budget; phase3 interface trước sửa chỉ có roster/scope/locks/goal | Chuyển topic/limit/used/trace; case10 đã dùng3/5 chỉ còn2, thêm user limit thấp hơn |

Security reviewer kiểm lại guard và ngoại lệ persistence; Failure reviewer kiểm lại persistence và budget handoff: không còn mâu thuẫn trong delta. Khả năng harness đáp ứng vẫn phải kiểm khi cook, không coi kế hoạch là bằng chứng capability.

## Verification

- Standard tier, Fact Checker + Contract Verifier: 30 source anchors checked, 30 verified, 0 failed; [chi tiết](plan-verification.md).
- Node parser thực đọc metadata skill hiện có; system Python validator không chạy được vì thiếu yaml, không tính Red hoặc pass.
- `ak plan validate` đạt, `ak plan status` nhận cả3 phase, tất cả pending.
- Không có runtime consumer mới hay blocker với plan đang mở; [cross-plan scan](cross-plan-scan.md).

## Validation interview

Một câu hỏi tùy chọn đã gửi; không hỏi lại các quyết định thiết kế đã chốt.

**Câu hỏi:** Để kiểm chứng skill, mình dự kiến dùng các hồ sơ thật trong repo cho bộ hồi quy, rồi kiểm tra live ba nhánh (team, cơ chế, xác minh nguồn), mỗi chủ đề tối đa 5 lần gọi ngoài. Bạn muốn mức kiểm chứng nào ghi vào plan?

**Lựa chọn:** Hồi quy local + live ba nhánh (đề xuất); Live lại toàn bộ tình huống.

**Trả lời:** Chưa nhận được. Giữ default đề xuất local26 + subcases + live3; không ghi thành user approval. Đây là độ rộng validation tương lai, không cấp quyền triển khai ở lượt plan này. Không còn quyết định thiết kế bắt buộc.

## Whole-plan consistency sweep

Đọc lại plan.md, phase-01-start.md, phase-02-research-skill-package.md, phase-03-coexist-integration-and-validation.md và matrix. Kiểm5 delta: natural routing, account override, guard, persistence và budget handoff. Đồng bộ ngoại lệ report persistence vào inventory/index; 26 là case gốc, không phải tổng số lượt test. Không còn mâu thuẫn chưa xử lý. Phase1→2→3, scope4file+handoff, source authority và no-runtime đều giữ nguyên.

## Kiểm tra cuối và tooling

Đọc/parse lại index và cả3 phase: tất cả pending, 28 liên kết local resolve, matrix đủ26 hàng gốc. CLI format đạt; không chạy application/behavioral tests. Journal CLI ghi nhầm project root; đã chuyển chính file mới của task về `plans/journals/2026-09-07-ke-hoach-project-research-skill-tdd.md`, không sửa CLI/config hoặc file người dùng khác. Không có process nền được tạo.

## Câu hỏi còn lại

Không có câu hỏi bắt buộc. Harness guard/discovery thực tế là gate phải xác minh khi triển khai; không có bằng chứng behavioral Red/Green trong phiên này.
