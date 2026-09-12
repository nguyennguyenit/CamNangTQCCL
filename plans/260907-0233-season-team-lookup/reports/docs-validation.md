# Docs validation — 2026-09-12

## Phạm vi đã cập nhật

Đối tượng: maintainer và consumer developer. Final pass đối chiếu dữ liệu/core,
UI và MCP đã đóng băng sau review; không tuyên bố release production.
Tái sử dụng [quyết định Kongming](execution-decisions.md) và
[shared contract](season-shared-contract.md), không mở quyết định kiến trúc mới.

- [README](../../../README.md): thêm đường bảo trì seasonal riêng và link tài liệu;
  thêm selector dùng chung, giới hạn dữ liệu và manifest theo version; giữ nguyên
  WIP Node/private SGSDeck catalog có trước.
- [Kiến trúc](../../../docs/system-architecture.md): thêm boundary builder/resolver/engine,
  lý do tách scenario/ruleset, identity team/config, query/hash activation,
  invalidation, snapshot union, public view và ngoại lệ Khai hoang.
- [Bảo trì sidecar](../../../docs/season-team-data.md): giữ workflow candidate và
  bằng chứng promote; thay inventory theo ngày bằng link dữ liệu/báo cáo nguồn.
  Xác nhận phạm vi VN hiện có và đường search phân trang khi config ambiguity.
- [MCP guide](../../../docs/mcp-research-server.md): exact v1/v2 inventory,
  output-schema refresh, context binding, selector/errors, reference bounds và
  private `data/sgsdeck/` exclusion không traversal; giữ clean-source/release guard.
- [Design guidelines](../../../docs/design-guidelines.md): reference/applicable/unknown,
  exact config detail/source score, historical tier, inventory limits và focus.

Evidence owners: [builder](../../../pipeline/build_season_data.py),
[validator](../../../pipeline/season_validation.py),
[resolver](../../../js/season-context.js),
[public manifest](../../../src/lib/public-artifact-manifest.mjs).
Behavioral evidence dùng lại [data report](phase-02-data-validation.md),
[resolver report](phase-02-resolver-validation.md),
[UI validation](phase-03-ui-validation.md), [MCP validation](phase-04-mcp-validation.md),
[release tooling](phase-04-release-tooling.md), [UI review](review-season-ui.md),
[MCP review](review-season-mcp.md) và [combined validation](validation.md).
Không chạy lại toàn bộ suites chỉ cho thay đổi docs.

## Kiểm chứng thực tế

- Initial pass: 63 relative Markdown links trong năm owning surfaces tồn tại.
- Final pass: 83 relative Markdown links trong năm owning surfaces tồn tại, không có link thiếu.
- Chạy lệnh candidate đã ghi trong docs bằng thư mục tạm riêng: builder thành công,
  đủ năm output và byte-identical với `data/`; thư mục tạm được dọn tự động.
- CLI Recommended `--help` xác nhận cờ `--cache`; các đường focused test tồn tại.
- `git diff --check` cho năm owning surfaces: PASS.
- Không sửa code, tests, plan status; không stage, commit hoặc deploy.

## Giới hạn và trạng thái bàn giao

Đã kiểm trực tiếp JSON: một kịch bản VN Binh Diễn Xuân Thu, không có ruleset,
config hay evaluation; năm source-owned reference groups chứa 25 đội/75 vị trí
tướng. Không biến capability hoặc fixture thành dữ liệu production. Kiểm source
inventory selector v1/v2, public-evidence pruning, reference projection caps và
private-directory exclusion trước khi ghi hướng dẫn.

Controller thông báo final implementation gates đều PASS; số liệu đầy đủ do
[validation](validation.md) sở hữu. Actual `build:worker-assets` vẫn exit 1
`SOURCE_NOT_CLEAN`; repository gate dừng ở dry-run thiếu assets. Xem
[local attempt log](worker-assets-local-attempt.log) và
[Kongming final advisory](final-advisory.md). Không tính fixture packaging thành
clean-source release PASS, không tạo asset giả, không commit/deploy.

Docs đã đóng băng, không còn mục consumer docs chờ thực hiện. Không mở câu hỏi
người dùng; controller sở hữu plan status và release checkpoint còn bị chặn.

Sau final pass, người dùng trả lời rõ phạm vi Recommended bao gồm lưu và hiển
thị trên website. Controller cập nhật `season-team-data.md`, execution decisions
và Recommended inventory; link mới tới execution decisions đã kiểm tồn tại,
`git diff --check` đạt. Số 83 links ở trên thuộc checkpoint trước bổ sung này.
Không thay code, dữ liệu hoặc điều kiện promote.
