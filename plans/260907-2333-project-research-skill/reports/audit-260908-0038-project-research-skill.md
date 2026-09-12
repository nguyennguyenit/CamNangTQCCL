# Audit plan tqccl-research — 2026-09-08

## Kết luận

**2 findings Medium mới; đã sửa hợp đồng kế hoạch. Chưa xác minh được harness thực thi toàn bộ preflight.** Không có finding High/Critical trong lượt audit này. Ba reviewer độc lập: Security Adversary, Failure Mode Analyst, Assumption Destroyer; controller đối chiếu và gộp finding read isolation trùng nhau. Không triển khai skill hoặc chạy behavioral tests.

Plan giữ đủ bốn file mới + handoff nhỏ, 26 tình huống gốc và subcases. SGSDeck, 233乐园, budget5 và quyền cùng tồn không thay đổi. Các5 findings ngày7/9 vẫn có hiệu lực; audit mới kiểm sâu tính khả thi và độc lập của kiểm chứng.

## Findings

### Medium — Chưa xác định capability thực thi guard

**Evidence trước sửa:** `phase-01-start.md:35,103`, `phase-02-research-skill-package.md:114`, `plan.md:60`. Plan nói “harness sẵn có/fresh session” nhưng yêu cầu write guard, allowlist một file và trace attempted action. Runtime `collaboration.spawn_agent` không có tham số sandbox/read roots; phiên controller là danger-full-access. Fresh context không giới hạn quyền công cụ.

**Failure:** cook dùng collaboration hiện tại cho baseline, hoặc tạo candidate chưa kiểm chứng rồi gặp toàn bộ behavioral gates blocked. Kế hoạch chưa nói rõ điểm dừng.

**Disposition:** Accept. Phase1 thêm preflight có capability/config cụ thể, probe quyền bằng file task-owned vô hại, kiểm mọi tool surface (shell, connector, delegation), capture attempts. Chưa đạt thì dừng trước baseline/Phase2; chỉ hoàn thiện plan/input được tiếp tục. Không nới guard, không tự thêm runner/global config ngoài scope.

**Trạng thái:** khoảng trống đặc tả đã sửa; dependency môi trường vẫn unresolved. Không biến một checklist preflight thành bằng chứng đã có harness.

### Medium — Candidate có thể đọc đáp án hoặc report baseline

**Evidence trước sửa:** `phase-01-start.md:35,44,48`, `reports/behavioral-case-matrix.md:7,11,13,48`, `phase-02-research-skill-package.md:27,85,105`. Rubric/results và report case15 lưu cùng repo; guard chỉ chặn ghi, không ngăn read/search toàn repo.

**Failure:** candidate tìm roster, đọc baseline correction/results rồi trả lời đúng nhờ input mới. Hoặc case15 lượt2 đọc report phía baseline, dù report candidate chưa từng được dùng lại. Fresh session và prompt giống nhau không giữ được controlled comparison.

**Disposition:** Accept; gộp finding trùng của Security và Failure reviewers. Manifest visibility/source hashes khóa trước baseline; loại plan/matrix/rubric/reviewer/results/outputs khác lượt khỏi read/search và auto-loaded context. Giữ dossier thật và correction gốc làm nguồn hợp lệ. Case15 lượt2 mỗi bên chỉ thêm report do lượt1 cùng nhánh tạo; tương đương về đường/quyền và có lineage trace.

Nếu đã đọc dữ liệu chấm hoặc sai nhánh: **CONTAMINATED**, không PASS/behavioral FAIL. Sửa isolation rồi chạy lại cặp. Input/rubric thay thì version hóa và chạy lại hai bên; không sửa oracle để biến fail thành pass.

**Trạng thái:** hợp đồng đã sửa; read isolation thực tế phải đạt preflight trước kiểm chứng.

## Kiểm tra capability hiện tại

Đã chạy read-only `codex exec --help`:

- Có `--sandbox read-only|workspace-write|danger-full-access`, `-C`, `--json`, `--ephemeral`.
- Help mô tả sandbox cho model-generated shell commands. Không tự chứng minh single-file allowlist, loại rubric khỏi read/search, hay guard connector/delegation.
- `--add-dir` là directory writable, không phải bằng chứng file allowlist.
- Không launch model bằng CLI, không đổi config/sandbox của session, không dựng runner, không chạy probe filesystem trong audit này. Không tuyên bố CLI này đủ dùng hoặc không bao giờ dùng được; cần empirical preflight cho cấu hình chọn khi triển khai.

## Phạm vi sửa

- `plan.md`: readiness và liên kết audit mới.
- `phase-01-start.md`: preflight, visibility manifest, branch lineage, trạng thái contamination và gate trước Phase2.
- `phase-02-research-skill-package.md`: điều kiện vào phase, cách ly candidate và report cùng nhánh.
- `phase-03-coexist-integration-and-validation.md`: guard/read visibility cho integration, contamination không qua gate.
- `reports/behavioral-case-matrix.md`: protocol và trạng thái thống nhất; giữ26 hàng gốc.
- Báo cáo audit này. Không sửa registry, skill/runtime, Git hoặc WIP khác.

## Whole-plan consistency sweep

Đọc lại index, cả3 phase và matrix sau sửa; kiểm3 delta: preflight trước baseline/Phase2, read/search visibility và report lineage/CONTAMINATED. Snapshot review7/9 giữ nguyên lịch sử; index chỉ rõ kết luận audit8/9 mới hơn. Không còn mâu thuẫn nội bộ đã biết. Đặc tả nhất quán không đồng nghĩa capability thực thi đã được xác minh.

## Kiểm tra sau sửa

Hai reviewer kiểm lại đúng delta: các finding được xử lý nhất quán ở cấp tài liệu, không còn finding trong delta. Cả hai giữ kết luận capability thực tế chưa được xác minh. CLI format validation đạt; YAML/link verification ghi trong lần kiểm cuối. Không có application hoặc behavioral test nào được chạy.

## Unresolved prerequisites

**Một dependency môi trường:** chứng minh được capability enforcement + read isolation + attempted-action traces (bao gồm persistence case15). Chủ trách nhiệm: controller thực thi Phase1. Artifact cần có: `reports/harness-preflight.md`. Chưa đạt thì không bắt đầu baseline hoặc tạo package Phase2; không yêu cầu người dùng quyết định lại thiết kế đã chốt.
