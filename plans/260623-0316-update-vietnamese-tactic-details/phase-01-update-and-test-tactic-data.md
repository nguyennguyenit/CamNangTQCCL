# Phase 01: Cập nhật và kiểm thử dữ liệu

## Context Links

- [Plan](./plan.md)
- [`data/tactics.json`](../../data/tactics.json)
- [`tests-js/tactics-data.test.mjs`](../../tests-js/tactics-data.test.mjs)

## Overview

- Priority: P2
- Status: Completed
- Sửa trực tiếp 6 record; không thêm field hoặc logic UI.

## Key Insights

- `所向披靡` dùng tên Việt xác nhận: `Đánh Đâu Thắng Đó`.
- Ảnh phản ánh chỉ số nâng cấp dạng cấp 1→cấp tối đa.
- `Khắc Địch Chế Thắng` đã đổi điều kiện và xác suất so với mô tả Hán cũ.
- `Đánh Bại Quân Địch` là `折冲御侮`, tách biệt với `克敌制胜`.

## Requirements

- Cập nhật `viet`, `effect`, `target`, `type` khi ảnh cho dữ liệu mới.
- Giữ `chinese`, `hanViet`, `quality`, `troopFit`, `source`, `sourceHeroCn`, `iconUrl`.
- Không đổi schema JSON.

## Architecture

Artifact JSON → `js/tactics.js` render nguyên văn. Không cần đổi code runtime.

## Related Code Files

- Modify: `data/tactics.json`
- Modify: `data/teams.json`
- Modify: `data/khaihoang.json`
- Modify: `data/coexist.json`
- Modify: `data/facets.json`
- Modify: `pipeline/aliases.json`
- Modify: `pipeline/tactic-name-overrides.json`
- Modify: `tests-js/tactics-data.test.mjs`
- Create/delete: none

## Implementation Steps

1. Viết test hồi quy cho 6 record theo khóa chữ Hán.
2. Cập nhật dữ liệu tiếng Việt theo ảnh.
3. Parse JSON, chạy test hẹp rồi full test phù hợp.
4. Review diff, loại thay đổi ngoài phạm vi.

## Todo List

- [x] Thêm test 6 chiến pháp.
- [x] Cập nhật dữ liệu.
- [x] Chạy kiểm thử.
- [x] Review và đóng plan.

## Success Criteria

- Mỗi record tồn tại duy nhất và khớp giá trị đã chốt.
- `node --test tests-js/tactics-data.test.mjs` pass.
- Bộ test Python/JS/Worker theo README không phát sinh lỗi.

## Risk Assessment

- Sai chính tả OCR: giảm bằng đối chiếu ảnh và xác nhận trực tiếp tên khó đọc.
- Rebuild ghi đè artifact: test khóa theo `chinese` để phát hiện hồi quy.

## Security Considerations

- Không có input động, secret, quyền hoặc mạng.

## Next Steps

- Không có nếu test pass.
