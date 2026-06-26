# Brainstorm: Cập nhật data tướng + UI chi tiết + tier

- **Ngày**: 2026-06-26
- **Skill**: `/brainstorm` (kèm research)
- **Trạng thái**: Đã chốt thiết kế, chờ red-team
- **Flags**: none

## 1. Problem statement

Data 112 tướng trong `data/heroes-dict.json` mới dùng ~9 field (stats, sao, phe, tên chiến pháp tự mang, icon). Yêu cầu: "cập nhật tiếp data tướng dựa trên nguồn API sẵn có", có UI hiển thị, kèm tier cộng đồng.

**Phát hiện then chốt (scout)**: cache crawl `pipeline/raw_crawl_cache.json` **đã có sẵn** nhiều field giá trị nhưng `parse_hero_detail` bỏ qua — phủ **112/112**. Không cần API mới cho phần lõi.

## 2. Research — nguồn API

- Nguồn chính thức duy nhất có cấu trúc: **lingxi** (`galaxias-api.lingxigames.com`), đã tích hợp sẵn.
- **Không có API công khai** cho tier list / win-rate. Dữ liệu tier toàn guide cộng đồng (zhihu/taptap/bluestacks) — phi cấu trúc, chủ quan, mau lỗi thời, rủi ro bản quyền.

## 3. Field khả dụng trong cache (112/112 trừ ghi chú)

| Field lingxi | Map ra | Phủ |
|---|---|---|
| `兵种适性` ×5 | `troopFit{ky,thuan,cung,thuong,khiGioi}` S/A/B | 112/112 |
| `传承战法`+desc | `inheritTacticCn/HanViet/Desc` | 112/112 |
| `自带战法描述` | `selfTacticDesc` | 112/112 |
| `武将标签` | `roleTag` | 112/112 |
| `缘分` | (ngoài scope) | 72/112 |
| `列传`,`立绘` | (loại — user bỏ) | 112/112 |
| `所属赛季` | (loại — gần trống) | 1/112 |

## 4. Quyết định người dùng (qua AskUserQuestion)

- **Field thêm**: thích tính binh chủng (S/A/B) · truyền thừa + mô tả 2 chiến pháp · tag vai trò. (Bỏ liệt truyện/tranh chân dung.)
- **Đích hiển thị**: JSON + **UI chi tiết tướng**.
- **UI form**: **cả hai** — tab "Tra cứu tướng" + modal click icon.
- **Tier**: **cả hai cách** (manual + scraper) — nội dung: hạng T0–T3 · build gợi ý · win-rate/điểm.

## 5. Giải pháp chốt

### 5.1 Dung hòa "manual + scraper" (KISS, theo tiền lệ `suggest_aliases.py`)
- `pipeline/hero-tier-map.json` = **nguồn chân lý** (manual, commit, bền).
- `pipeline/suggest_hero_tier.py` = scraper **offline chỉ in gợi ý** để người duyệt → chép vào map. Scraper vỡ không ảnh hưởng runtime/build.

### 5.2 Đầu ra
1. **Enrich `heroes-dict.json`**: sửa `parse_hero_detail` thêm `troopFit`, `selfTacticDesc`, `inheritTacticCn/HanViet/Desc`, `roleTag`. Re-run `build_dict`.
2. **Tier**: `data/hero-tier.json` build từ `hero-tier-map.json`; key theo `chinese`; field `tier/build/score?/winRate?` (optional).
3. **Frontend**: `js/hero-list.js` (tab mirror `tactics.js`) + `js/hero-detail.js` (modal, dùng ở tab + Soi đội). CSS + wiring `app.js` + tab trong `index.html`.

### 5.3 Phân pha
| Pha | Nội dung | Rủi ro |
|---|---|---|
| P1 | Parse cache → enrich JSON + tests | Thấp |
| P2 | Tab "Tra cứu tướng" + modal + CSS | Thấp-TB |
| P3 | `hero-tier-map.json` + build `hero-tier.json` + badge | TB |
| P4 | `suggest_hero_tier.py` gợi ý | TB |

## 6. Ràng buộc
Zero runtime dep / offline build · Python stdlib · tên VN canonical authoritative · `hanviet` fail-loud · không commit PNG aligames · không đụng `teams.json`.

## 7. Touchpoints
`pipeline/crawl_tactics.py`, `pipeline/build_dict.py`, `data/heroes-dict.json` · mới: `pipeline/hero-tier-map.json`, `pipeline/suggest_hero_tier.py`, `data/hero-tier.json`, `js/hero-list.js`, `js/hero-detail.js` · `index.html`, `css/styles.css`, `js/app.js` · `tests/`, `tests-js/`.

## 8. Acceptance criteria
- `build_dict` re-run → `heroes-dict.json` đủ field mới 112/112, không lỗi fail-loud.
- Tab "Tra cứu tướng": render 112 card, lọc theo binh chủng thích tính / vai trò / phe / sao hoạt động.
- Modal mở từ card + từ icon Soi đội, hiện stats + 2 chiến pháp + S/A/B + tier (nếu có).
- `hero-tier.json` build sạch; UI ẩn field tier trống, không vỡ.
- Tests Python + JS pass.

## 9. Rủi ro & cảnh báo
1. **`winRate`/`score` sẽ thưa** — không có nguồn chuẩn; để optional, UI ẩn khi trống, không fail-loud.
2. **Tier chủ quan + lỗi thời theo mùa** — ghi rõ nguồn + ngày trong map; UI ghi "tham khảo, cập nhật [ngày]".
3. **Scraper phụ thuộc HTML nguồn** — cô lập offline, suggest-only, không chặn build.

## 10. RED-TEAM (kèm bằng chứng kiểm chứng)

### R1. ✅ KHÔNG nhân bản mô tả chiến pháp — phải LINK (sửa §5.2)
Kiểm chứng cache vs `tactics.json`:
- self-tactic: **111/112** đã có trong `tactics.json` (miss 1: `高橹联营`).
- inherit-tactic: **112/112** đã có.

→ **Bỏ `selfTacticDesc`/`inheritTacticDesc`/`inheritTacticHanViet`** trong heroes-dict. Thay bằng **link theo `chinese`** tới `tactics.json` (lấy free tên VN canonical + effect + quality). Lợi:
- Triệt **rủi ro `hanviet` fail-loud** trên text mới (không re-dịch).
- DRY: 1 nguồn mô tả chiến pháp.
- Chỉ cần fallback inline cho **1** self-tactic ngoài thư viện (`高橹联营`).

Heroes-dict chỉ cần lưu `selfTacticCn` (đã có) + thêm `inheritTacticCn`. Frontend join lúc render.

### R2. ⚠️ Đổi tên field tránh va chạm ngữ nghĩa
`tactics.json` đã dùng `troopFit` = **list** (hạn chế binh chủng). Hero "thích tính" là **dict S/A/B** → dùng tên khác: **`troopApt`** (`{ky,thuan,cung,thuong,khiGioi}`). Tránh nhầm shape.

### R3. ⚠️ `roleTag` 13 giá trị Hán đơn — bắt buộc map Hán→Việt
Distinct: `辅战医武控政蛮谋盾兼仙魅黄` (vd 武=20, 战=19, 谋/辅=15…). 1-ký-tự không tự suy ra tên VN → cần `pipeline/role-tag-map.json` thủ công (vd 辅→Phụ, 控→Khống chế, 谋→Mưu…). `黄`=1 nghi là tag Khăn Vàng, kiểm lại. → Unresolved Q3 là việc thật, đưa vào P1.

### R4. ⚠️ README sai — tab "Tra cứu chiến pháp" KHÔNG search tướng
README ghi "237 chiến pháp + 112 tướng" nhưng `tactics.js` chỉ render tactics; `heroesDict` chỉ dùng cho Soi đội. → Tab tướng mới là **chính đáng** (không có search tướng để mở rộng). Nhưng phải **sửa README** cho khớp khi làm.

### R5. ⚠️ Tier mapping: coverage một phần + biến thể SP
112 `chinese` key unique ✅. Nhưng guide cộng đồng phủ 489+ tướng và đặt tên khác (vd `SP吕蒙` vs `吕蒙`). → Map tier sẽ **khớp một phần**; UI phải chịu được tướng thiếu tier (badge ẩn). Ghi rõ % phủ trong report build.

### R6. ⚠️ P4 scraper có thể là YAGNI / rủi ro ToS
P3 manual đã giao đủ giá trị. Scrape tự động zhihu/taptap dễ vi phạm ToS + vỡ HTML. **Khuyến nghị: hạ P4 xuống optional/cắt**; người đọc guide rồi nhập tay (P3) an toàn hơn. Cần user xác nhận có thực sự cần scraper không.

### R7. ⚠️ Quản trị lỗi thời
Tier sai/cũ tệ hơn không có. Bắt buộc field `source` + `updatedAt` trong `hero-tier-map.json`; UI hiện ngày; cân nhắc ẩn nếu quá cũ (vd > 1 mùa).

### R8. ℹ️ Modal trong "Soi đội" = scope creep nhẹ
Icon Soi đội hiện chỉ để mắt thường đối chiếu. Thêm click→modal đổi hành vi sẵn có. → Đề xuất **P2 chỉ làm modal ở tab tướng**; modal-từ-Soi-đội tách P2.5 hoặc bỏ.

## 11. Thiết kế sau red-team (delta)
- heroes-dict thêm: `troopApt{}`, `inheritTacticCn`, `roleTag` (+ map VN). **Không** thêm `*Desc`.
- Frontend join chiến pháp theo `chinese` từ `tactics.json` (fallback 1 case).
- P4 scraper: optional, chờ user chốt.
- `hero-tier-map.json` bắt buộc `source`+`updatedAt`.

## 12. THIẾT KẾ CUỐI (sau research nguồn TQ — chốt mọi quyết định)

### Reframe lớn: tier theo **TEAM**, không theo tướng lẻ
Research xác nhận nguồn TQ (TapTap 强度榜, zhihu 天梯表, lingxi 阵容安利) **chỉ rank đội hình (阵容 T0–T3)**, không rank tướng. Không có API tier. Project bản chất là meta-đội (`teams.json` 172 team) → gắn tier vào **team** mới khớp nguồn + kiến trúc.

**Quyết định cuối (user-confirmed):**
- Tier điểm gắn: **TEAM** (`teams.json` / bảng `team-tier-map.json`).
- Tier tướng (nếu cần): suy ra = "xuất hiện trong N team T0".
- Scraper: **seasonal suggest-helper** (`pipeline/suggest_team_tier.py`) — fetch nguồn TQ, trích chuỗi tên đội T0/T1, **in gợi ý** để người map về tên team canonical → ghi `team-tier-map.json`. KHÔNG auto-ghi. Nguồn chân lý vẫn manual.
- Modal mở từ Soi đội: **tách pha sau** (P2 chỉ modal ở tab tướng).

### Phạm vi cuối
**A. Enrich heroes-dict.json** (P1): `troopApt{ky,thuan,cung,thuong,khiGioi}`, `inheritTacticCn` (link tactics.json), `roleTag` (+ `role-tag-map.json` Hán→Việt). KHÔNG thêm `*Desc` (link 111-112/112). Fallback inline 1 self-tactic `高橹联营`.

**B. Frontend** (P2): tab "Tra cứu tướng" (`hero-list.js`) + modal (`hero-detail.js`, chỉ tab) + CSS + wiring + sửa README.

**C. Tier team** (P3): `pipeline/team-tier-map.json` (manual, field `tier`,`source`,`updatedAt`) → build vào `teams.json` hoặc `data/team-tier.json`; badge T0–T3 ở card team (Team PK). UI ghi "tham khảo, cập nhật [ngày]".

**D. Seasonal suggest-helper** (P4, optional): `pipeline/suggest_team_tier.py` in gợi ý tier, người duyệt.

### Touchpoints (cập nhật)
P1: `crawl_tactics.py`, `build_dict.py`, `data/heroes-dict.json`, `pipeline/role-tag-map.json`.
P2: `js/hero-list.js`, `js/hero-detail.js`, `index.html`, `css/styles.css`, `js/app.js`, `README.md`.
P3: `pipeline/team-tier-map.json`, build driver, `data/team-tier.json`, `js/render.js` (badge), `css`.
P4: `pipeline/suggest_team_tier.py`.

## 13. Unresolved questions (còn lại)
- Nguồn TQ chính để curate P3 (TapTap 强度榜 vs zhihu 94 套 vs lingxi 阵容安利)? lingxi = chính thức nhưng prose rời rạc.
- Map tên đội TQ (太尉盾…) ↔ tên team canonical (`teams.json`): bao nhiêu % khớp được? Cần spike nhỏ ở P3.
- `黄` trong roleTag nghĩa gì — kiểm lại tướng gắn tag (nghi Khăn Vàng).
- Tier team lưu thẳng `teams.json` hay `data/team-tier.json` riêng (nhịp cập nhật khác)?
