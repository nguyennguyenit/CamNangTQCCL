# Research: Nội dung chiến pháp & khả thi tính năng gợi ý dựng team

_Thời điểm: 2026-06-21 19:46 (+07). Scope: (A) dữ liệu mô tả chiến pháp có sẵn không; (B) cần gì để làm tính năng gợi ý team._

## Executive Summary

- **(A) Dữ liệu local KHÔNG đủ.** File chưa dùng `Meta Team PK/Tướng&CP.html` có mô tả chiến pháp nhưng chỉ **22/112** chiến pháp đang dùng trong team có mô tả (≈20%). 90/112 (80%) trống. Tướng: chỉ ~44 có "Cách dùng", trong khi team dùng ~85 tướng. → Muốn "mỗi chiến pháp có nội dung" phải lấy **dữ liệu ngoài**.
- **(B) Làm được, theo 2 mức.** Mức KISS: tận dụng 172 team đã curate để "gợi ý theo bộ lọc/độ tương đồng/tướng đang sở hữu" — không cần dữ liệu mới. Mức đầy đủ (engine chấm điểm phối tướng): cần bổ sung dữ liệu tướng (phe, ngũ vi, **binh chủng thích tính S/A/B/C**, cost) + chiến pháp (loại, binh chủng phù hợp, hiệu quả) từ DB chính thức.
- **Nguồn dữ liệu tốt nhất:** DB chính thức 灵犀互娱 `sgzzlb.lingxigames.com` (武将库/战法库/兵种库, lọc theo phe/sao/thống/loại/chất/nguồn).

## (A) Hiện trạng nội dung chiến pháp

### Có gì trong local
`Tướng&CP.html` (156 dòng, chưa parse vào site) gồm các block theo mùa sự kiện (PK18/PK20…):
- **Bảng Tướng Mới**: `STT | Tên Tướng | Hiệu Quả Chiến Pháp | CP Kế Thừa | Cách Dùng`
- **Bảng Chiến Pháp Sự Kiện**: `STT | Tên Chiến Pháp | Hiệu Quả | Tướng Thích Hợp | Food Cần`

Đo độ phủ (script grid_extractor):

| Mục | Số có mô tả | Trên tổng đang dùng | Phủ |
|---|---|---|---|
| Chiến pháp | 29 (22 trùng tập dùng) | 112 | **20%** |
| Tướng | 44 | ~85 | ~52% |

→ Chủ yếu là chiến pháp **sự kiện** (Biết Mình Biết Ta, Toàn Quân Đồng Lòng, Phi Hùng Quân…), thiếu phần lớn chiến pháp phổ thông (Thịnh Khí Linh Địch, Vô Đương Phi Quân, Lõa Y Huyết Chiến…).

### Kết luận A
Đủ để thêm 1 tab "Chiến pháp sự kiện" (22 mục) ngay từ local. **Không đủ** để mỗi chiến pháp trong team đều có tooltip mô tả → cần nhập dữ liệu ngoài cho 90 chiến pháp còn lại.

## (B) Cần gì để làm tính năng gợi ý dựng team

### Cơ chế game (đã xác nhận qua research)
- **5 binh chủng**: Kỵ/Thuẫn(Khiên)/Cung/Thương/Khí giới. (Data hiện tại chỉ có 4 — không có Khí giới.)
- **Binh chủng thích tính S/A/B/C** → nhân thuộc tính: S=120%, A=100%, B=85%, C=70%. Quyết định tướng hợp binh chủng nào.
- **7 loại chiến pháp**: Chỉ huy / Chủ động / Đột kích / Bị động / Binh chủng / Trận pháp / Nội chính. Chất lượng S/A/B.
- **Đội = 3 tướng**, mỗi tướng: 1 chiến pháp tự mang + 2 ô lắp (mở theo cấp). **Cost ≤ 16**/đội.
- **Khắc chế binh chủng** + **đồng phe** (trận trộn phe như Tam Thế/Tiềm Long bỏ ràng buộc phe — đã xử lý ở site).

### Dữ liệu cần bổ sung (đây là phần thiếu)

**Per-Tướng** (hiện site chỉ có tên + biến thể):
```
{ name, faction, cost, stats{lực,trí,thống,tốc,phòng},
  affinity{ky,cung,thuong,khien,khigioi: S|A|B|C},
  selfTactic, tags[] }
```
**Per-Chiến pháp** (hiện chỉ có tên):
```
{ name, type(7 loại), quality(S/A/B), effect(mô tả),
  troopFit[], target, source(mùa/sự kiện), inheritFrom(tướng) }
```

### Hai hướng triển khai

**Hướng 1 — KISS, không cần data mới (khuyến nghị làm trước):**
Tận dụng 172 team đã curate.
- "Tôi có các tướng X, Y, Z → team nào dùng được?" (lọc team theo tướng sở hữu).
- "Gợi ý team theo binh chủng / phe / sao".
- "Team tương tự team này" (độ trùng tướng/chiến pháp).
→ Chi phí thấp, dùng ngay facets + filter engine có sẵn. Không phải engine phối tướng thật nhưng giải quyết 80% nhu cầu user.

**Hướng 2 — Engine gợi ý thật (cần data B):**
Chấm điểm tổ hợp 3 tướng + chiến pháp:
- ràng buộc cứng: cost ≤16, binh chủng đồng nhất (hoặc trận trộn), ô chiến pháp hợp lệ.
- điểm: affinity binh chủng, khớp chiến pháp↔stat tướng, đồng phe/synergy, khắc chế đối thủ.
→ Cần nhập đủ DB tướng+chiến pháp. Khối lượng lớn (~85 tướng, ~112 CP). Engine có thể chạy client-side (vanilla JS) vì không gian nhỏ.

### Nguồn dữ liệu để lấp 90 chiến pháp + data tướng
- **Chính thức (tốt nhất)**: 灵犀互娱 `sgzzlb.lingxigames.com` — 武将库/战法库/兵种库, có filter phe/sao/thống/loại/chất/nguồn. Cấu trúc rõ → có thể soạn map thủ công hoặc bán-tự-động.
- 游侠网 wiki `m.ali213.net/wiki/sgzzlb/`; gamersky "战法属性详解".
- VN: BlueStacks guide phối tướng/cost.
- **Lưu ý pháp lý/kỹ thuật**: chưa thấy API công khai chính thức → nhiều khả năng phải **nhập thủ công / scrape**, đối chiếu tên Hán↔Việt (rủi ro lệch tên như đã gặp với alias).

## Khuyến nghị (next steps)
1. **Ngay**: parse 22 chiến pháp sự kiện từ `Tướng&CP.html` → tooltip/tab "Chiến pháp" cho các CP có mô tả. Rẻ, dùng pipeline có sẵn.
2. **Ngắn hạn**: làm Hướng 1 (gợi ý theo tướng sở hữu / bộ lọc trên 172 team). Giá trị cao, không cần data mới.
3. **Nếu muốn engine thật**: chốt phạm vi, soạn dataset tướng+chiến pháp từ DB lingxigames (ưu tiên ~85 tướng + 112 CP đang dùng), rồi viết bộ chấm điểm client-side.

## Unresolved questions
- User muốn mức nào: tooltip mô tả CP, gợi ý từ team có sẵn, hay engine phối tướng đầy đủ?
- Chấp nhận nhập thủ công/scrape dữ liệu tướng+chiến pháp (công sức lớn) không?
- Có cần binh chủng thứ 5 (Khí giới) không, hay giữ 4 như hiện tại?
- Ưu tiên cố định tên Hán→Việt theo nguồn nào để khỏi lệch alias?

## Sources
- [灵犀互娱 官方 武将库/战法库](https://sgzzlb.lingxigames.com/station/)
- [游侠网 三国志战略版 wiki](https://m.ali213.net/wiki/sgzzlb/)
- [战法类型汇总 (9game)](https://www.9game.cn/news/3649784.html)
- [兵种适性解析 (9game)](https://www.9game.cn/news/3492912.html)
- [战法属性详解 (gamersky)](https://www.gamersky.com/handbooksy/202111/1440239.shtml)
- [TQCCL Army Building Guide (BlueStacks)](https://www.bluestacks.com/vi/blog/game-guides/three-kingdoms-tactics/tqccl-army-building-guide-vi.html)
