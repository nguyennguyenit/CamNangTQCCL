---
phase: 4
title: "Seasonal suggest-helper (optional)"
status: pending
priority: P3
effort: "3h"
dependencies: [3]
---

# Phase 4: Seasonal suggest-helper (optional)

## Overview
Trợ lý chạy 1 lần/mùa: fetch nguồn tier TQ, trích chuỗi tên đội T0/T1, **in gợi ý** để người duyệt rồi chép vào `team-tier-map.json`. KHÔNG auto-ghi data, KHÔNG vào runtime. Optional — chỉ làm nếu P3 ổn và còn nhu cầu.

## Requirements
- Functional: `pipeline/suggest_team_tier.py` đọc **file HTML lưu sẵn** → parse tên đội + tier ứng viên → in danh sách gợi ý (tên TQ + tier đoán) + map thử sang team `id` (fuzzy theo `teams.json`).
- Non-functional: offline tool (không chạy lúc build site); stdlib; fail mềm (in cảnh báo, không raise chặn); cô lập — parser thuần test bằng fixture HTML.

## Architecture
- Theo pattern `pipeline/suggest_aliases.py`: hàm `parse_*` thuần (fixture), I/O tách riêng.
- **[Audit A4] Input = file HTML cục bộ**, KHÔNG live-fetch: zhihu/taptap thường chặn anti-bot/JS-render → urllib trả login wall, parser rỗng. Người tải trang tay trên browser → lưu `.html` → tool parse offline. Né ToS + anti-bot, ổn định cho nhịp seasonal.
- Output: in stdout bảng `{tenDoiTQ, tierUngVien, teamIdGoiY, score}` để người copy thủ công vào `team-tier-map.json`. KHÔNG sửa file map tự động.

## Related Code Files
- Create: `pipeline/suggest_team_tier.py`, `tests/test_suggest_team_tier.py`, fixture HTML trong `tests/fixtures/`
- Modify: `README.md` (ghi cách chạy seasonal: "chạy mỗi đầu mùa, duyệt tay vào team-tier-map.json")

## Implementation Steps (TDD)
1. **Test trước**: fixture HTML mẫu nguồn → `parse_team_tier_suggestions` trả list tên đội + tier đúng. Đỏ.
2. Viết parser thuần → xanh.
3. Đọc file HTML cục bộ (arg đường dẫn) + fuzzy map tên đội → team `id` (tái dùng tiện ích match nếu có).
4. In gợi ý; ghi README cách dùng (tải trang tay → lưu .html → chạy tool) + cảnh báo "gợi ý, phải duyệt tay".

## Success Criteria
- [ ] Parser test đỏ→xanh bằng fixture.
- [ ] Chạy tool trên file .html in gợi ý tier + team `id`, KHÔNG sửa map tự động.
- [ ] README ghi quy trình seasonal (tải tay → parse) + cảnh báo duyệt tay.

## Risk Assessment
- **HTML nguồn đổi** → tool vỡ; vì seasonal + suggest-only + parse file tay, chỉ sửa parser mỗi mùa, không ảnh hưởng site/build.
- **[A4] Anti-bot/JS-render** → đã né bằng input file HTML cục bộ, không live-fetch.
- **Fuzzy map sai** → chỉ là gợi ý, người duyệt quyết định cuối.
