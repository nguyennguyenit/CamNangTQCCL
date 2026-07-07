# Research Report: Team PK Tier Anh Hùng Mệnh Thế

---
type: research
date: 2026-07-03
scope: Team PK tier badges, Anh Hùng Mệnh Thế
---

## Summary

Đã đối chiếu 55 đội `Team PK` với mùa hiện tại bản Việt Nam: `Anh Hùng Mệnh Thế`.

Nguồn nhập dữ liệu chính là bảng Zeabur `推薦隊伍 Tier List`, ghi rõ `賽季 PK-S26 · 英雄命世 進行中`. Đây là cùng kịch bản với `Anh Hùng Mệnh Thế`, nên các nguồn Zeabur trong `team-tier-map.json` được gắn nhãn `PK-S26 Anh Hùng Mệnh Thế`.

Kết quả sau verify lại: Team PK có tier 30/55 đội. Trong đó 19 đội là T0 chắc hơn vì có nguồn cùng mùa hoặc nguồn cùng mùa xác nhận biến thể T0.

## Sources

- Zeabur `推薦隊伍 Tier List`: https://sangokushi.zeabur.app/recommended
- CN/TW Bahamut `英雄命世天梯表`: https://forum.gamer.com.tw/C.php?bsn=36815&snA=11402
- CN Notion mirror `英雄命世全阵容天梯排行榜`: https://spacekid.notion.site/25-11-21-2b4159b6f94080448bf0f6ff67e90938?pvs=21
- JP `三国志真戦 S25 英雄命世`: https://sangokushi-shinsen.info/2026/05/21/579%E3%80%90%E8%B2%82%E8%9D%89%E3%81%AE%E4%B8%89%E5%9B%BD%E5%BF%97%E7%9C%9F%E6%88%A6%E3%80%91%E3%80%80s25%E3%80%80%E8%8B%B1%E9%9B%84%E5%91%BD%E4%B8%96%E3%80%8012%E5%90%8D%E3%81%AE%E3%82%AB%E3%82%B9/
- KR search evidence `S26 영웅명세`: https://www.youtube.com/watch?v=lZCaPqwVvc4
- Global app evidence: https://play.google.com/store/apps/details?hl=en_US&id=com.qookkagame.sgzzlb.gp.global
- Local video extract: `assets/videos/team-info-from-download-260701/team-list.md`

## Region Check

| Region | Finding | Data action |
|---|---|---|
| Việt Nam | User confirmed current season is `Anh Hùng Mệnh Thế`. | Use same-season sources only for new tier curation. |
| Trung/TW | Zeabur has structured PK-S26 `英雄命世` tier table; Bahamut/Notion confirm same-season tier discussion/table. | Imported exact team matches from Zeabur. |
| Nhật | `三国志真戦` is on S25 `英雄命世` / `時代の英雄`; pages explain season mechanics and duwei tier, not a clean team tier table. | Do not import team tier directly. |
| Hàn | Search confirms S26 `영웅명세` content/videos exist, but no extractable, stable team-tier table found. | Do not import team tier directly. |
| Global | `Three Kingdoms Tactics:Global` exists, but no public indexed `Anh Hùng Mệnh Thế`/equivalent team-tier table found. | Do not import team tier directly. |

## Added Or Confirmed

| Team ID | Tên VN | Nguồn đối chiếu | Tier |
|---|---|---|---|
| `team-intro-1` | Hoàng Mã Thương | `皇馬槍` | T0 |
| `team-intro-2` | Hoàng Quan Thương | `皇冠槍` | T0 |
| `team-intro-6` | Võng Hồng Thương | `網紅槍` | T0 |
| `team-intro-7` | Bắc Phạt Thương | `北伐槍` | T0.5 |
| `team-intro-10` | Gian Hùng Kỵ | `奸雄騎` | T0.5 |
| `team-intro-11` | Phú Quý Kỵ | `富貴騎` | T0 |
| `team-intro-14` | Liêu Cơ Kỵ | `遼姬騎` | T0.5 |
| `team-intro-16` | Ngô Kỵ | `吳騎` | T0.5 |
| `team-intro-17` | Đẳng Phong Hùng | `等風熊` | T0 |
| `team-intro-21` | Kỳ Lân Cung | `盛氣蜀弓` | T0 |
| `team-intro-22` | Đô Đốc Cung SP Chu Du | `嘟嘟弓(sp周瑜)` | T0 |
| `team-intro-26` | Hổ Thần Cung | `虎臣弓` | T0.5 |
| `team-intro-27` | Khảng Khái Cung | `慷慨弓` | T0.5 |
| `team-intro-32` | SP Chu Du Cung | `sp周瑜弓` | T0 |
| `team-intro-33` | Ôn Hầu Cung | `溫侯弓-by大米` | T0 |
| `team-intro-37` | Đô Đốc Cung | `飛熊都督` | T0.5 |
| `team-intro-38` | Quần Cung | `群弓` | T0 |
| `team-intro-42` | Thái Úy Khiên | `太尉盾` | T0 |
| `team-intro-44` | Sơn Hà Khiên | `山河盾` | T0 |
| `team-intro-45` | Đào Viên Khiên | `桃園盾` | T0.5 |
| `team-intro-46` | Tam Tiên Khiên | `仙人盾-by大米` / `三仙盾` | T0 / T0.5 |
| `team-intro-47` | Trương Phi Khiên (Tiềm Long) | `張飛盾(潛龍)` | T0 |
| `team-intro-48` | Đôn Đôn Khiên | `墩墩盾` | T0.5 |
| `team-intro-49` | Thi Thi Khiên | `詩詩盾` | T0.5 |
| `team-intro-53` | Thái Sư Cung | `太師弓` | T0 |
| `team-intro-54` | Cự Mã Cung | `拒馬弓` | T0.5 |

## Notes

- Verify lại ngày 2026-07-03: bỏ T0 của `Vinh Quang Thương` vì chưa có nguồn `Anh Hùng Mệnh Thế` đủ chắc; Zeabur chỉ thấy `榮光槍` ở PK-S24 T0.5 và `榮光騎` PK-S26 T0.5 nhưng khác tướng.
- Verify lại ngày 2026-07-03: `Đô Đốc Cung` bản SP Chu Du + Lỗ Túc + Lục Tốn được Zeabur PK-S26 xếp `飛熊都督` T0.5, nên không giữ best tier T0 từ video.
- `Tam Tiên Khiên` giữ T0 vì Zeabur PK-S26 có `仙人盾-by大米` T0 cùng bộ Trương Giác + Vũ Cát + Tả Từ; bản `三仙盾` thường cùng bộ tướng là T0.5.
- `Thái Sư Cung` thêm mới theo Zeabur detail `太師弓` T0: SP Lô Trực + SP Điêu Thuyền + SP Đổng Trác.
- `Cự Mã Cung` thêm mới theo Zeabur detail `拒馬弓` T0.5: SP Lô Trực + Tiêu Chỉ + SP Điêu Thuyền.
- Với các nguồn Nhật/Hàn/Global, chỉ ghi nhận season/context nếu không có bảng tier đội hình đủ sạch. Không nhập tier từ video title hoặc bài chỉ nói cơ chế mùa.
- Không gán tier cho đội chỉ khớp lỏng hoặc chưa thấy trong bảng tier PK-S26: Độ Giang Thương, Tân Ngô Thương, Thục Thương, các biến thể `Úc ...`, `Du ...`, `Quyền Túc Du`, `Vũ Đại Thái`, `Vũ Thái Bị`.

## Deep Verify: 6 Low-Confidence T0 Teams

Ngày 2026-07-03, mở trang chi tiết Zeabur cho từng đội để so `tier + tướng + chiến pháp` với data repo.

| Team | Nguồn chi tiết | Kết luận |
|---|---|---|
| `Trương Phi Khiên (Tiềm Long)` | Zeabur `張飛盾(潛龍)` T0, PK-S26. Tướng khớp `Chu Thái / Trương Phi / SP Viên Thiệu`. | T0 theo composition. Build repo lệch đáng kể: repo dùng `An Ủi Quân Dân`, `Vô Địch Can Trường`; Zeabur dùng `Thịnh Khí Linh Địch`, `Hoành Tảo`, `Xế Đao`. Độ tin cậy: trung bình-thấp nếu yêu cầu đúng chiến pháp. |
| `Quần Cung` | Zeabur `群弓-by大米` T0, PK-S26. | Khớp rất cao: cùng tướng và cùng 6 chiến pháp chính với repo (`Xế Đao/Gió Táp`, `Lửa Đuổi/Thiêu Đốt`, `Bát Môn/Vô Đương`). Độ tin cậy: cao. |
| `Võng Hồng Thương` | Zeabur `網紅槍` T0, PK-S26. | Tướng khớp. Build repo lệch 1 chiến pháp lớn ở Trương Phi: repo `Nhất Kỵ Đương Thiên`, Zeabur `Thôi Phong Đoạn Nhẫn`. Độ tin cậy: trung bình. |
| `Đẳng Phong Hùng` | Zeabur `等風熊` T0, PK-S26. | Tướng khớp, 6 chiến pháp khớp theo bộ; repo đặt `Phi Hùng` trên Lưu Bị và `Phong Thi` trên Quan Ngân Bình, Zeabur đảo hai chiến pháp này. Độ tin cậy: trung bình-cao. |
| `Ôn Hầu Cung` | Zeabur có `溫侯弓-by大米` T0 và `溫侯弓（混）` T0, nhưng cũng có `溫侯弓` T1. | Tướng khớp, nhưng build repo không khớp hoàn toàn với 2 build T0: repo là hybrid giữa by-Đại Mễ và mix. Độ tin cậy: thấp-trung bình; không nên xem là T0 chắc nếu chưa đổi chiến pháp đúng build. |
| `Sơn Hà Khiên` | Zeabur `山河盾` và `山河盾-by大米` T0, PK-S26. | Tướng khớp. Build repo gần bản by-Đại Mễ nhưng Giả Hủ dùng `Binh Vô Thường Thế`, Zeabur dùng `Đoạt Hồn Hiệp Phách` hoặc `Ngụy Thư Tương Gian`. Độ tin cậy: trung bình-cao, cần đúng chiến pháp để chắc. |

Khuyến nghị curate: nếu UI chỉ có 1 badge tier, giữ T0 cho đội khớp composition nhưng report phải ghi caveat. Nếu muốn badge phản ánh build trong repo, hạ/đánh dấu lại `Trương Phi Khiên` và `Ôn Hầu Cung` trước.

## Changed Files

- `pipeline/team-tier-map.json`
- `data/team-tier.json`
- `data/teams.json`
- `data/facets.json`
- `README.md`
- `docs/codebase-summary.md`
- `docs/project-changelog.md`
- `docs/project-overview-pdr.md`
- `docs/system-architecture.md`

## Unresolved Questions

- Một số đội có thể là biến thể cùng tướng nhưng khác binh chủng/chiến pháp, cần thêm nguồn video hoặc tier list khác trước khi gán.
