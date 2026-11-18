---
phase: 1
title: "Chốt tên và dữ liệu client kỳ lược"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Chốt tên và dữ liệu client kỳ lược

## Goal
Đưa 5 phương lược và 40 thẻ (client 24.547) vào `pipeline/lookup-client-tactics.json` ở 2 khóa phẳng `qilueStrategies` và `qilueCards`, sau khi bảng tên qua gate review. Tạo `pipeline/recommended-qilue-overrides.json` cho phần ghi chú đội (biến thể chữ Hán sai, 復刻, sửa tay, bỏ qua). Hai file này là nguồn duy nhất cho Phase 2–5.

## Context
- Nguồn: `plans/reports/261117-client-ky-luoc-pk-s27.md` (bảng thẻ, mục Phương lược, "Tổng hợp lệch").
- Tiền lệ đặt dữ liệu client vào `lookup-client-tactics.json`: commit `d62a882` (troopMods, buildings, advisors, equipment). File này đã có hash `inputHashes.clientTactics`, nên không cần nối hash mới. <!-- Red-team F5 -->
- `aliasesZh` là khóa công khai của mọi row catalog (`pipeline/build_unified_lookup.py:49`) và được đọc trước `nameZh` (`js/lookup-detail.js:247`). Vì vậy biến thể sai **không** được đặt ở đây. <!-- Red-team F8 -->

## Shape
`pipeline/lookup-client-tactics.json`, thêm 2 khóa:
```json
"qilueStrategies": [{"slug": "muu-tinh", "nameVi": "Mưu tính", "aliasesVi": ["Mưu Toán"], "nameZh": "謀算", "cardTypes": ["muu", "phu"], "descriptionVi": "…", "buffVi": "…"}],
"qilueCards": [{"slug": "bo-tri-thap-dien", "nameVi": "Bố Trí Thập Diện", "nameZh": "設伏十面", "type": "muu", "rarity": "common", "targetVi": "Nhóm quân ta", "effectVi": "…"}]
```
- `slug` là khóa viết tay, đóng băng. Validator chỉ kiểm hình dạng (`^[a-z0-9-]+$`), không sinh lại từ `nameVi`. <!-- Red-team F15 -->
- `aliasesVi` chỉ chứa tên client khác (ví dụ tên trong Hướng dẫn). Không chứa tên Hán-Việt cũ trùng nhóm khác (ví dụ "Chiến Đấu Trường Kỳ" là binh thư 久戰). <!-- Red-team F11 -->
- Tên phương lược theo thẻ chọn (Validation Session 1): Toàn quân, Cường Công, Mưu tính, Chiến đấu lâu dài, Quấy nhiễu.

`pipeline/recommended-qilue-overrides.json` (không công khai, có hash ở reference, xem Phase 3):
```json
{"schemaVersion": 1, "seasons": ["pk-s27"],
 "noteVariantsZh": {"十面埋伏": "bo-tri-thap-dien", "合圍突擊": "hop-vay-giap-kich", "鴻門避險": "lanh-hiem-hong-mon", …},
 "copyFrom": {"s27-lp-beifa-qiang": ["…"], …},
 "fix": {"s27-han-huangma-qiang": {"strategy": "…", "cards": ["…"], "reason": "摧鋒斷刃 là tên chiến pháp; nguồn ghi nhầm cho 摧鋒陷敵"}},
 "skip": {"<configId>": "lý do"}}
```
- `noteVariantsZh` gồm 13 biến thể trong report, cộng 鴻門避險. 摧鋒斷刃 trùng tên chiến pháp nên không đưa vào đây; đội dùng nó được xử lý qua `fix`. <!-- Red-team F7 -->
- `copyFrom` của 4 đội 復刻: anh hoặc người review chọn đội nguồn cụ thể. Đội "五謀或者拒馬" có 2 đội nguồn.

## Tests Before (viết trước, phải fail)
- `tests/test_build_unified_lookup.py`:
  - Có đúng 5 strategies và 40 cards. Mỗi loại thẻ có 8 thẻ, trong đó 2 thẻ `rare`.
  - `slug` và `nameZh` không trùng nhau.
  - `cardTypes` của mỗi phương lược khớp bảng trong report.
  - Không có HTML hay ký tự điều khiển.
  - Đổi `nameVi` thì id không đổi.
- Test liên nhóm: mọi `nameVi`, `nameZh`, `aliasesVi` của kỳ lược được so với tactic (`viet`/`chinese`/`aliases`), book và hero. Va chạm chỉ được chấp nhận khi có trong `QILUE_NAME_COLLISIONS_ALLOWED`; danh sách này có review, ban đầu là 強攻/Cường Công và Ám Độ Trần Thương. <!-- Red-team F11 -->
- `tests/test_recommended_qilue.py` (phần overrides):
  - Mọi giá trị trong `noteVariantsZh` phải là slug có thật.
  - Không khóa nào trùng `nameZh` của thẻ khác.
  - Không khóa nào trùng `chinese` của tactic, trừ 十面埋伏. Khóa này được phép vì chỉ dùng trong ngữ cảnh kỳ lược và đã có test riêng ở Phase 3.

## Tasks & Steps
1. Gate review tên theo quy trình hiện có (`pipeline/localization-reviews/`). Gate chốt 4 thứ: tên 40 thẻ, 5 phương lược, allowlist va chạm, và `copyFrom`.
2. Viết test, xác nhận chúng fail.
3. Thêm 2 khóa vào `lookup-client-tactics.json`, chép nguyên văn `effectVi`. Lỗi của client chỉ sửa khi gate review quyết.
4. Tạo `recommended-qilue-overrides.json`.

## Regression gate
- `python3 -m unittest discover -s tests`

## Todo
- [ ] Gate review tên, va chạm, copyFrom
- [ ] Test trước fail
- [ ] `qilueStrategies`, `qilueCards` trong `lookup-client-tactics.json`
- [ ] `recommended-qilue-overrides.json`
- [ ] Test pass

## Success Criteria
Đủ 45 mục, có receipt review. Không còn biến thể sai nào nằm trong khóa công khai.

## Risk
- Sau khi publish, đổi `slug` sẽ làm link cũ thành 404, vì redirect chỉ sinh cho tactics (`pipeline/lookup_route_handles.py:269`). Đổi tên hiển thị thì an toàn.
