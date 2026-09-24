---
phase: 1
title: "Enrich heroes-dict (pipeline+data)"
status: cancelled
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1: Enrich heroes-dict (pipeline+data)

Không triển khai tiếp theo [quyết định ngày 2026-09-24](./plan.md). Nội dung và checklist bên dưới chỉ giữ làm lịch sử.

## Overview
Parse thêm field đã có sẵn trong cache lingxi vào `heroes-dict.json`: thích tính binh chủng (S/A/B), tên chiến pháp truyền thừa, tag vai trò (+ map Hán→Việt). KHÔNG thêm mô tả chiến pháp (link runtime ở P2).

## Requirements
- Functional: `parse_hero_detail` xuất thêm `troopApt{ky,thuan,cung,thuong,khiGioi}`, `inheritTacticCn`, `roleTag`, `roleTagViet`.
- Non-functional: giữ fail-loud `hanviet` (chỉ chạy `to_viet` trên tên đã chắc có trong bảng); zero dep mới; không gọi mạng (dùng cache).

## Architecture
- `兵种适性{骑兵,盾兵,弓兵,枪兵,器械}` → `troopApt` keys `ky/thuan/cung/thuong/khiGioi`, value giữ nguyên "S"/"A"/"B".
- `传承战法` → `inheritTacticCn` (chỉ tên Hán; VN name + mô tả lấy ở P2 bằng cách link `tactics.json` theo `chinese`). KHÔNG dịch ở đây.
- `武将标签` → `roleTag` (Hán đơn) + `roleTagViet` qua bảng mới `pipeline/role-tag-map.json` (13 giá trị: 辅战医武控政蛮谋盾兼仙魅黄). `黄` cần kiểm — nếu là tag Khăn Vàng đặt "Khăn Vàng", ngược lại để best-effort + ghi chú.
- Bảng map là dict thuần `{ "辅": "Phụ tá", ... }`; thiếu key → fail-loud (giống `hanviet`) để không lọt tag chưa map.
- **[Audit A2] Giữ nguyên chữ ký `parse_hero_detail(item, missing=None)`** — load `role-tag-map.json` **module-level** (cache trong `crawl_tactics`), KHÔNG thêm param. Tránh vỡ `build_dict.py` + `test_crawl_tactics.py` đang gọi `(item, missing)`.

## Related Code Files
- Create: `pipeline/role-tag-map.json`
- Modify: `pipeline/crawl_tactics.py` (`parse_hero_detail`), `data/heroes-dict.json` (build lại), `tests/test_crawl_tactics.py`
- Modify (nếu cần load map): `pipeline/build_dict.py` (truyền map vào parser hoặc đọc trong parser)

## Implementation Steps (TDD)
1. **Test trước** (`tests/test_crawl_tactics.py`): thêm fixture item hero tối giản có `兵种适性*`, `传承战法`, `武将标签` → assert `parse_hero_detail` trả `troopApt` đủ 5 key đúng S/A/B, `inheritTacticCn` đúng tên Hán, `roleTag`/`roleTagViet` đúng. Thêm test thiếu key map → raise. Chạy đỏ.
2. Tạo `pipeline/role-tag-map.json` 13 entry (kiểm `黄`).
3. Sửa `parse_hero_detail`: thêm 3 field; load map (đọc 1 lần, truyền vào hoặc cache module-level). Giữ chữ ký tương thích.
4. Chạy test đỏ→xanh (`python3 -m unittest tests.test_crawl_tactics`).
5. Re-run build: `python3 -m pipeline.build_dict` (dùng cache, không recrawl). Verify `heroes-dict.json` 112/112 có field mới.
6. Chạy `tests/test_build_dict.py` + `test_build.py` đảm bảo không regress.

## Success Criteria
- [ ] Test parser mới đỏ→xanh; test thiếu map raise.
- [ ] `heroes-dict.json`: 112/112 có `troopApt` (5 key), `inheritTacticCn`, `roleTag`+`roleTagViet`.
- [ ] `python3 -m unittest discover -s tests` pass, không fail-loud.
- [ ] Không thêm dependency; không gọi mạng.

## Risk Assessment
- **`黄` nghĩa mơ hồ** → kiểm tướng gắn tag trước khi đặt tên; nếu chưa chắc, để "Khăn Vàng" (giả định) + ghi open question.
- **Field name `troopApt` vs `troopFit`**: cố ý khác `tactics.json` (list) để không nhầm shape — ghi comment rõ.
- **Re-run build đổi diff lớn `heroes-dict.json`**: bình thường (thêm field); review git diff để chắc không mất field cũ.
