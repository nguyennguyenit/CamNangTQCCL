# Phase 01: Cập nhật schema và UI song ngữ

## Context Links

- [Plan](./plan.md)
- [`data/tactics.json`](../../data/tactics.json)
- [`js/tactics.js`](../../js/tactics.js)

## Overview

- Priority: P2
- Status: Completed
- Dùng field tùy chọn; tương thích toàn bộ record cũ.

## Key Insights

- `effect` hiện là dữ liệu nguồn tiếng Trung do crawler ghi.
- Ghi đè `effect` bằng tiếng Việt làm mất nguồn và bị mất khi rebuild.
- Existing override theo khóa chữ Hán là nơi phù hợp để lưu bản dịch review thủ công.

## Requirements

- Khôi phục `effect`, `target` tiếng Trung cho 6 record.
- Thêm `effectViet`, `targetViet` qua `tactic-name-overrides.json` và pipeline.
- Render cả Việt/Trung; fallback một mô tả nếu chưa có bản dịch.
- Không dùng `innerHTML`; không thêm dependency.

## Architecture

Crawler source (`effect`, `target`) + manual override (`effectViet`, `targetViet`) → `tactics.json` → `tacticCard` song ngữ.

## Related Code Files

- Modify: `data/tactics.json`
- Modify: `pipeline/tactic-name-overrides.json`
- Modify: `pipeline/build_dict.py`
- Modify: `js/tactics.js`
- Modify: `css/styles.css`
- Modify: `tests/test_build_dict.py`
- Modify: `tests-js/tactics-data.test.mjs`
- Modify: `docs/code-standards.md`
- Modify: `docs/project-changelog.md`

## Implementation Steps

1. Viết test schema song ngữ, pipeline propagation và fallback UI.
2. Mở rộng override/pipeline cho field bản dịch.
3. Khôi phục nguồn Trung, thêm bản dịch Việt vào artifact.
4. Render hai khối mô tả và style phân cấp.
5. Chạy toàn bộ test, review diff, đóng plan.

## Todo List

- [x] Viết test hồi quy.
- [x] Cập nhật pipeline và data.
- [x] Cập nhật UI/CSS.
- [x] Cập nhật docs.
- [x] Test, review, đóng plan.

## Success Criteria

- Bản ghi song ngữ có đủ 4 field nội dung.
- Record chỉ có `effect` vẫn hiển thị một mô tả.
- Python, Node, Worker test và typecheck pass.

## Risk Assessment

- Rebuild mất dịch: giảm bằng test `_apply_overrides`.
- UI card dài hơn: tiếng Trung dùng màu phụ, khoảng cách gọn.

## Security Considerations

- DOM tạo bằng `textContent`/text node qua `el`; không phát sinh XSS.

## Next Steps

- Cân nhắc dịch thêm record khác trong các lần cập nhật sau.
