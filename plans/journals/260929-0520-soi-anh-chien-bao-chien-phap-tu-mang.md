---
title: "Soi ảnh chiến báo: chiến pháp tự mang chiếm ô A, chiến pháp thứ ba thành binh thư"
date: 2026-09-28
summary: Prompt chép mọi dòng chiến pháp; site bỏ dòng tự mang bằng selfTacticCn; chưa deploy vì phiên khác đang sửa recruit-tracker-store.js
---

# Soi ảnh chiến báo: chiến pháp tự mang chiếm ô A, chiến pháp thứ ba thành binh thư

## What happened
Soi ảnh chiến báo (戰報) ra sai: Lăng Thống ô A = Quốc Sĩ Tướng Phong (tự mang), binh thư = 盛氣凌敵; Trương Phi ô A = Yến Nhân Bào Hao (tự mang), binh thư = 疾風驟雨. Màn chiến báo in 3 dòng chiến pháp mỗi tướng (tự mang + 2 đã học), không in binh thư. `VISION_PROMPT` chỉ mô tả màn đội hình (2 dòng trắng A/B + dòng binh thư vàng), `tacticSlots` (worker/src/schema.ts) và `draftFromRead` (js/analyze-map.js) cắt cứng 2 ô đầu, nên dòng tự mang luôn chiếm ô A và dòng thứ ba bị model đẩy sang booksCn.

## Decision
- AI chỉ chép mọi dòng chiến pháp theo thứ tự (≤3), booksCn = [] khi không in binh thư, bỏ ô tướng trống, chỉ phe 我方.
- Site loại dòng tự mang bằng `selfTacticCn` của từ điển tướng (dữ liệu, không nhờ AI); tướng chưa rõ mà 3 dòng thì bỏ dòng đầu (game luôn in tự mang đầu tiên).
- Chữ trong booksCn khớp chắc tên chiến pháp mà không khớp binh thư thì trả về hàng chiến pháp (chống model theo thói cũ).
- Repro với dữ liệu thật: cả output kiểu cũ lẫn kiểu mới đều ra Lăng Thống A=Ngự Địch Bình Chướng, B=Thịnh Khí Lăng Địch; Trương Phi A=Lính Thanh Châu, B=Tật Phong Sậu Vũ; binh thư trống.

## Next steps
- Chưa deploy: phiên khác đang sửa `js/recruit-tracker-store.js` (hash bản dịch stale) nên build site bị chặn; user chọn chờ. Khi xong: re-pin + publish localization, re-pin team-route-handles, `npm run build && npm run verify`, deploy `worker/` và Pages cùng lúc (worker mới + client cũ vẫn sai).
- Editor bắt buộc đủ 3 tướng: đội 2 tướng như ảnh này vẫn không bấm Đối chiếu được — cần user quyết.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
