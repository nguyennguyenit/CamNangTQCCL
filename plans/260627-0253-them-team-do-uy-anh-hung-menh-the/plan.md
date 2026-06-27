# Plan: Thêm team Đô Úy (Anh Hùng Mệnh Thế) từ research JP/KR/CN

> Tạo: 2026-06-27. Nguồn: `plans/reports/research-260627-0159-team-do-uy-anh-hung-menh-the-jp-kr-cn-report.md`.
> Mục tiêu (goal): thêm hết team research được; team có **nhiều chiến báo uy tín** → set `recommended: true` (badge "Khuyến nghị").

## ✅ TRẠNG THÁI: DONE (2026-06-27)
- Thêm **11 team** vào `data/teams.json` + `pipeline/do-uy-ss18-source.json` (do-uy 37→48). Diff append-only.
- 3 team có chiến báo uy tín nhất set `recommended: true`: **Khảng Khái Cung, Tần Khê Tiên Phong, Mã Thiền Thái Úy Khiên** (đều có ảnh chiến báo 17173 hoặc đánh giá cao + đa nguồn).
- 2 team skip vì trùng 37 team thật: Nhị Kiều Cung (=do-uy-55 Hoành Hương Kiều), Liễu Tẩm Hoàng Mã (Liễu Tẩm đã có do-uy-57/58, comp 皇马 không rõ).
- Tướng đô úy mới **Tần Khê** tạo block (loadout build hỗ trợ canonical, innate 先声夺人 ghi trong notes — không bịa).
- Verify: 80 pytest pass; JSON valid; render thật (server :8124) hiện 48 đội, 11 team mới đủ, 12 badge "★ Khuyến nghị".
- Chưa làm (ngoài scope/đề xuất sau): thêm Tần Khê vào `heroes-dict.json` (tab Tra cứu tướng/Soi đội); gắn tier badge (`team-tier-map.json`) cho team mới.

## Bối cảnh kỹ thuật (đã verify)

- Render source = `data/teams.json` (schema đầy đủ: heroes + tactics×2 + books + counters + notes + `recommended`).
- Edit pattern = sửa **song song** `pipeline/do-uy-ss18-source.json` (notes nhẹ) + `data/teams.json` (data thật). Không có script .py sync — hand-maintained (xác nhận qua git: commit do-uy đụng cả 2 file).
- Tier badge: `pipeline/team-tier-map.json` → `data/team-tier.json` (key theo team id), build bằng `build_team_tier`.
- `recommended`: bool thủ công trong `data/teams.json` (hiện 9 team).
- **Ràng buộc:** không bịa chiến pháp/binh thư (dev rule). Tái dùng chiến pháp VN canonical đã có trong `data/teams.json`; tướng thiếu → tra từ tập teams.json rộng hoặc research.

## Phạm vi: 13 team mới (10 thuần mới + 3 biến thể)

Tướng đã có chiến pháp VN sẵn (tái dùng): Hoàng Phủ Hoành, Tiêu Chỉ, Chu Thiệu, Mã Thiền, Từ Ngạn, Trần Hy, Tô Tín, Tôn Quyền, Tư Mã Ý, **Dương Kỳ, Liễu Tẩm, Đại Kiều, Tôn Thượng Hương, Thái Sử Từ, Cam Ninh**, Chu Du, Lữ Mông, SP Quách Gia, Tuân Du, Thẩm Hằng, Hạ Hầu Đôn, Gia Cát Lượng.

Tướng cần tra chiến pháp (mainstream, lấy từ teams.json rộng): **Trương Liêu, Khương Duy, Chu Thái, Tào Tháo**. Đô úy mới cần research: **Tần Khê**. Comp cần fetch: **Liễu Tẩm Hoàng Mã** (17173 上).

## Phases

### Phase 1 — Team dùng 100% tướng đã có chiến pháp (nhập ngay)
Nhị Kiều Cung, Chí Tôn Kiều Cung, Dương Kỳ Ngũ Mưu, Khảng Khái Cung, Đông Ngô Cung, Thẩm Hằng Phá Trận (bản Quách Gia), Tôn Quyền+Tô Tín+Chu Thái?(Chu Thái thiếu→P2).
→ 6 team. Nhập vào `data/teams.json` + `do-uy-ss18-source.json`.

### Phase 2 — Team cần tra chiến pháp mainstream + research Tần Khê
Liêu Kiều Thương (Trương Liêu), Khương Duy Tạp Thảo (Khương Duy), Tôn Hùng Kỵ (Chu Thái), Mã Thiền Thái Úy (Tào Tháo), Tần Khê meta sớm (research Tần Khê), Tôn Quyền+Tô Tín+Chu Thái.
→ tra chiến pháp từ teams.json rộng + 1 research Tần Khê; nhập.

### Phase 3 — Liễu Tẩm + tier + badge khuyến nghị + verify
- Fetch 17173 上 lấy comp Liễu Tẩm đủ → nhập.
- Set `recommended: true` cho team nhiều chiến báo uy tín: **Khảng Khái Cung, Mã Thiền Thái Úy, Nhị Kiều Cung (T0), Dương Kỳ Ngũ Mưu, Tần Khê** (chốt theo số nguồn proof).
- Thêm tier vào `team-tier-map.json` cho team có tier rõ (Nhị Kiều T0...).
- Build lại: `build_team_tier`; verify đếm do-uy = 37+N, JSON hợp lệ, mở thử tab.

## Acceptance
- `data/teams.json` do-uy count tăng đúng số team thêm; JSON valid (python json.load).
- Mỗi team mới: đủ heroes/tactics (không rỗng/bịa), faction, unitType, notes có ghi nguồn + URL proof.
- Team có proof mạnh → `recommended: true`, hiện badge "Khuyến nghị" ở tab.
- `do-uy-ss18-source.json` đồng bộ.
- Verify tướng 陈熙/陈翼 đúng (Trần Hy ≠ Trần Dực).

## Unresolved
- Comp Liễu Tẩm đầy đủ (chờ fetch 17173 上).
- Tên VN cho Tần Khê chiến pháp (chờ research) — duyệt tay theo bản VN.
