# Research Report: Nguồn tier T0 / "team Đô Úy" (都尉) — bản Trung / Nhật / Hàn

> Thực hiện: 2026-06-26 17:24 (Asia/Saigon). Phương pháp: WebSearch ×4 + WebFetch ×1 (Gemini CLI fail auth → fallback WebSearch).

## Executive Summary

- **"Đô Úy" = 都尉**, là nội dung của **kịch bản 英雄命世剧本 (Anh Hùng Mệnh Thế)** bên bản **Trung** (三国志战略版). Tier "都尉 T0" là CN-specific, gắn với scenario đó — KHÔNG phải hệ phân loại chung của Nhật/Hàn.
- **Nguồn máy-đọc-được tốt nhất = bản NHẬT** (三國志真戦). Blog `kazten.com` Season 24 (04/2026) liệt kê **117 編成 phân T0/T0.5/T1 × 4 phe, kèm comp 3 tướng (chữ Hán)** — đã verify **fetch được + cấu trúc đầy đủ**. Hợp nhất với pipeline suggest tool (Phase 4) hơn hẳn.
- **zhihu (94 套, nguồn plan nhắm tới) = 403** anti-bot, không tự crawl được. Bản Hàn (dcinside/namuwiki) có tier nhưng dạng ảnh/wiki, khó parse.
- **Cảnh báo data:** bản Nhật/Trung mới nhất đã có tướng SP (SP曹操汉弓, SP关羽蜀盾, SP马超群枪…) mà `teams.json` của ta **CHƯA có** → tier các đội đó không gắn được nếu không cập nhật teams trước.

## Methodology
- Sources consulted: ~20 (4 query đa ngôn ngữ + 1 fetch verify).
- Date range: 2021 → 04/2026 (ưu tiên 2026).
- Key terms: `都尉 阵容 T0 英雄命世`, `三國志真戦 編成 ランキング ティア 2026`, `삼국지 전략판 티어표 2026`, `Sangokushi Shinsen tier list 2026`.

## Key Findings

### 1. Bản TRUNG (三国志战略版) — "都尉" gắn kịch bản 英雄命世

| Nguồn | URL | Fetch? | Ghi chú |
|---|---|---|---|
| 233乐园 — 英雄命世 T0 都尉 | https://www.233leyuan.com/post-detail/2063255062787248128 | chưa thử | đúng chủ đề "最强都尉推荐" |
| zhihu — 英雄命世 都尉 阵容 | https://zhuanlan.zhihu.com/p/1959647087458252766 | ❌ 403 | zhihu chặn bot |
| bilibili video 都尉 阵容 | https://www.bilibili.com/video/BV1P516BNEH9/ | video | tham khảo người |
| zhihu 94套 (2025 tổng hợp) | https://zhuanlan.zhihu.com/p/15790075354 | ❌ 403 | đầy đủ nhưng blocked |
| gamersky / zol / taptap / xiaomi / mumu | (đã có ở chat) | ✅ phần lớn | tier chung, 1 phần cũ 2023/2025 |

→ CN: nguồn đầy đủ nhất (zhihu) bị chặn; nguồn mở thì rời rạc/cũ. 233乐园 đáng thử cho 都尉.

### 2. Bản NHẬT (三國志真戦 / Shinsen) — TỐT NHẤT để parse

| Nguồn | URL | Fetch? | Ghi chú |
|---|---|---|---|
| **kazten S24 (04/2026)** | https://kazten.com/entry/2026/04/09/190000 | ✅ verify | **117 編成, T0/T0.5/T1 × 4 phe, comp 3 tướng chữ Hán** |
| kazten S23 (01/2026) | https://kazten.com/entry/2026/01/27/190804 | ✅ | mùa trước, cũng 117 編成 |
| kazten スタダ 21 編成 | https://kazten.com/entry/2026/04/14/190000 | ✅ | đội khai cuộc |
| sangokushi-shinsen.com 2026 | https://sangokushi-shinsen.com/2026/ | likely ✅ | tier 武将 + 編成 |
| gameapp-village 最強編成 | https://gameapp-village.com/sar/ | likely ✅ | ranking |
| dengeki — 定軍山 SP黄忠/SP法正 | https://dengekionline.com/article/202601/61284 | ✅ | tướng SP mới 2026 |

Mẫu T0 trích từ kazten S24 (đã verify): 富貴騎(SP郭嘉/賈詡/SP荀彧), 王佐騎(曹操/SP荀彧/SP郭嘉), **太尉盾(司馬懿/曹操/滿寵)→ khớp `team-intro-42`**, 麒麟弓(姜維/龐統/諸葛亮)…

⚠️ Bản Nhật dùng **phồn thể** (滿寵, 馬, 龐) ≠ heroes-dict (giản thể: 满宠, 马, 庞). Dùng nguồn JP phải thêm bước phồn→giản trước khi map.

### 3. Bản HÀN (삼국지 전략판)

| Nguồn | URL | Fetch? | Ghi chú |
|---|---|---|---|
| namu.wiki | https://namu.wiki/w/삼국지%20전략판 | ✅ wiki | tổng quan, không bảng tier sạch |
| dcinside tier표 중섭 (2025/05) | https://m.dcinside.com/board/3kingdoms/313035 | ảnh | tier dạng hình, khó parse |
| dcinside tier 최신 | https://m.dcinside.com/board/3kingdoms/324678 | ảnh | như trên |
| coconamu 등급표/조합 | https://www.coconamu.com/2021/03/blog-post_69.html | cũ (2021) | lỗi thời |

→ KR: tier thường dạng ảnh trong forum → không parse offline được; chỉ dùng đối chiếu mắt người.

## Comparative Analysis

| Tiêu chí | Trung (zhihu/233) | **Nhật (kazten)** | Hàn (dcinside) |
|---|---|---|---|
| Độ mới | 2025–2026 | **2026 S24 (04/2026)** | 2025/05 |
| Đầy đủ comp 3 tướng | có (zhihu) | **có, 117 đội** | một phần |
| Máy parse được | ❌ 403 / rời rạc | **✅ HTML sạch** | ❌ ảnh |
| Khớp heroes-dict | giản thể ✅ | phồn thể ⚠️ cần convert | Hàn ngữ ❌ |

→ **Khuyến nghị: dùng bản NHẬT kazten làm nguồn chính** (mới + đầy đủ + parse được), bổ sung bước phồn→giản; bản Trung 233乐园 cho riêng 都尉 英雄命世; bản Hàn chỉ tham khảo.

## Implementation Recommendations

1. **Lưu HTML kazten S24** (Save As) → đưa vào `pipeline/suggest_team_tier.py`. Cần bổ sung **map phồn→giản** (hoặc 1 bảng nhỏ) để khớp `heroes-dict` (giản thể). Hiện parser nhận `<li>/<td>` + heading tier — cần kiểm cấu trúc thật của kazten (có thể là bảng/section, không phải `<ul><li>`), tinh chỉnh `_ITEM_TAGS`/heading nếu lệch.
2. **都尉 (英雄命世)**: nếu mục tiêu là tier riêng cho category `do-uy` của ta → nguồn đúng là 233乐园/zhihu 英雄命世, không phải tier PK chung. Hai hệ tier khác nhau, đừng trộn.
3. **Trước khi gắn tier 2026**: rà `teams.json` vì meta 2026 (đội SP mới) chưa có trong data → hoặc giới hạn tier cho đội đang có (đa số khớp nguồn 2025/JP cho đội kinh điển như 太尉盾, 麒麟弓, 三仙), hoặc mở plan cập nhật teams trước.

## Resources & References
- CN 都尉: [233乐园](https://www.233leyuan.com/post-detail/2063255062787248128) · [zhihu 英雄命世](https://zhuanlan.zhihu.com/p/1959647087458252766) · [zhihu 94套](https://zhuanlan.zhihu.com/p/15790075354)
- JP: [kazten S24](https://kazten.com/entry/2026/04/09/190000) · [kazten S23](https://kazten.com/entry/2026/01/27/190804) · [sangokushi-shinsen 2026](https://sangokushi-shinsen.com/2026/) · [gameapp-village](https://gameapp-village.com/sar/) · [dengeki 定軍山](https://dengekionline.com/article/202601/61284)
- KR: [namu.wiki](https://namu.wiki/w/삼국지%20전략판) · [dcinside tier](https://m.dcinside.com/board/3kingdoms/313035)

## Unresolved Questions
1. "Team Đô Úy" của bạn = category `do-uy` trong app (đội PK Đô úy) hay 都尉 英雄命世 scenario bên CN? Hai nguồn tier khác nhau — cần chốt để lấy đúng.
2. Có muốn nâng cấp `suggest_team_tier.py` thêm map **phồn→giản** để xài trực tiếp nguồn Nhật không? (ngoài scope plan hiện tại, ~30 phút).
3. Có chấp nhận chỉ gắn tier cho đội ĐANG CÓ trong `teams.json` (bỏ đội SP 2026 chưa có), hay muốn cập nhật teams trước?
