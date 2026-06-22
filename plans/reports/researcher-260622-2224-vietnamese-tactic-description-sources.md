---
type: researcher-report
date: 2026-06-22 22:24:39 +0700
topic: vietnamese-tactic-description-sources
status: done-with-concerns
---

# Research Report: Nguồn Mô Tả Chiến Pháp Tiếng Việt

## Summary

Không tìm thấy nguồn tiếng Việt public/crawlable đủ để thay `effect` tiếng Trung cho toàn bộ chiến pháp. Nguồn Việt tốt nhất hiện có là tài liệu mùa PK dạng Google Sheet/Scribd và bài/post chính thức theo mùa. Chúng hữu ích để lấy tên Việt, mô tả ngắn, cách dùng, tướng phù hợp, nhưng không phải DB đầy đủ có mô tả số liệu chuẩn cho 112 chiến pháp đang dùng.

Khuyến nghị thực dụng: giữ Lingxi Trung làm nguồn authoritative cho `type/quality/effect`; thêm lớp `effectVi` dịch máy + review thủ công. Với 28 chiến pháp generic đang pending, ưu tiên lấy từ `Meta Team PK/Tướng&CP.html` và bài chính thức Facebook theo mùa, vì đây là nhóm Lingxi API đang thiếu.

## Methodology

- Research time: 2026-06-22 22:24 +0700
- Repo context: static site TQCCL, `data/tactics.json` hiện có 237 chiến pháp.
- Local inspection:
  - `data/tactics.json`: 209 bản có `effect` tiếng Trung, 28 bản thiếu `effect`.
  - `data/facets.json`: 112 chiến pháp đang dùng trong team.
  - Report cũ `research-tactic-content-and-team-suggestion-feasibility-260621-1946-report.md`: local `Tướng&CP.html` chỉ phủ ~22/112 chiến pháp đang dùng.
- Web queries used:
  - `"Tam Quốc Chí Chiến Lược" "chiến pháp"`
  - `"Tam Quốc Chí Chiến Lược" "Chiến Pháp Kế Thừa"`
  - `"Meta Team Giới Thiệu Mùa PK" "Chiến Pháp Sự Kiện"`
  - exact tactic names: `"Thái Bình Đạo Pháp"`, `"Tạm Tránh Mũi Nhọn"`, `"Thịnh Khí Lăng Địch"`

## Findings

### 1. Local/Scribd Meta Team PK

Source:
- Local: `Meta Team PK/Tướng&CP.html`
- Web mirror: https://www.scribd.com/document/735309629/Meta-Team-Gi%E1%BB%9Bi-Thi%E1%BB%87u-Mua-PK

Value:
- Có bảng `Chiến Pháp Sự Kiện`, `Tướng Mới`, `CP Kế Thừa`, `Cách Dùng`, `Tướng Thích Hợp`, `Food Cần`.
- Có mô tả tiếng Việt ngắn cho nhiều chiến pháp sự kiện, ví dụ bảng PK6/PK9/PK4.
- Có thể dùng ngay để điền `effectViShort`, `recommendedHeroes`, `usageNotes` cho subset.

Limits:
- Không đủ coverage: report cũ đo được ~22/112 chiến pháp đang dùng.
- Text extraction từ Scribd/HTML lẫn dòng, nhiều chỗ cần clean thủ công.
- Mô tả thường là tóm tắt gameplay, không phải text in-game đầy đủ có tỷ lệ phần trăm.

Verdict: nguồn Việt tốt nhất để seed thủ công, nhất là nhóm event/generic. Không đủ để auto-fill toàn bộ.

### 2. Official Facebook Tam Quốc Chí - Chiến Lược

Source:
- Fanpage official: https://www.facebook.com/tamquocchi.chienluoc
- Search result thấy bài ảnh/post có cụm `Chiến Pháp Kế Thừa`, ví dụ bài gần đây nhắc `Nhạn Hình Trận`, `Chỉ Qua Vi Vũ`, `Thâm Tàng Nhược Hư`.

Value:
- Chính thức tiếng Việt, tốt để xác nhận tên Việt, tên mùa, chiến pháp mới.
- Hữu ích cho 28 generic/pending và chiến pháp theo mùa mới.

Limits:
- Facebook không ổn định cho crawl: mở bằng tool trả internal error hoặc bị chặn/ẩn nội dung.
- Nội dung phân tán theo post/photo, không có cấu trúc DB.
- Cần manual scrape bằng browser hoặc lưu snapshot/screenshot nếu muốn dùng làm nguồn đối chiếu.

Verdict: nguồn đối chiếu chính thức, không phải nguồn ingestion tự động.

### 3. Vietnamese Guides/Press

Sources:
- BlueStacks beginner guide: https://www.bluestacks.com/vi/blog/game-guides/three-kingdoms-tactics/tqccl-beginner-guide-vi.html
- BlueStacks army guide: https://www.bluestacks.com/vi/blog/game-guides/three-kingdoms-tactics/tqccl-army-building-guide-vi.html
- GameK season 2 article: https://gamek.vn/vinh-du-buoc-len-top-1-ve-doanh-thu-tam-quoc-chi-chien-luoc-chinh-thuc-buoc-vao-mua-giai-thu-2-178230317151119083.chn
- Download.com.vn app page: https://download.com.vn/tam-quoc-chi-chien-luoc-cho-ios-168645

Value:
- Giải thích khái niệm chiến pháp bằng tiếng Việt.
- Xác nhận một số chiến pháp/mùa, ví dụ mùa 2 có `Thái Bình Đạo Pháp`, `Quỷ Thần Đình Uy`, `An Ủi Quân Dân`.
- Dùng được cho docs/tooltip giải thích hệ thống, không phải data chiến pháp.

Limits:
- Không có mô tả từng chiến pháp.
- Bài marketing/guide tổng quan, ít số liệu.

Verdict: chỉ dùng làm tài liệu nền và xác nhận tên/mùa.

### 4. YouTube / Community

Example:
- PKT Gaming video về `Thái Bình Đạo Pháp`: https://www.youtube.com/watch?v=rOfZEAzlO2I

Value:
- Có phân tích cách dùng chiến pháp tiếng Việt.
- Hữu ích nếu muốn viết `usageNotes`, `recommendedTeam`.

Limits:
- Không tiện crawl; cần transcript/OCR thủ công.
- Không authoritative; độ đúng phụ thuộc người làm video và mùa game.

Verdict: dùng bổ sung cách chơi, không dùng làm nguồn effect chính.

### 5. Chinese Lingxi API Still Required

Current repo already uses Lingxi:
- `data/tactics.json`: 209 chiến pháp có `effect` tiếng Trung.
- `pipeline/crawl_tactics.py`: nguồn chính thức Trung, có `type`, `quality`, `effect`, `source`.

Value:
- Coverage tốt nhất, cấu trúc rõ, đã tích hợp pipeline.
- Đủ làm source of truth cho mô tả chuẩn.

Limits:
- Không có tiếng Việt.
- 28 generic/formation/event placeholders chưa có effect vì API không trả nhóm này.

Verdict: giữ làm base. Dịch sang Việt, không thay bằng nguồn Việt rời rạc.

## Source Ranking

| Rank | Source | Coverage | Accuracy | Crawlable | Best use |
|---|---:|---:|---:|---|
| 1 | Lingxi API Trung | Cao cho 209 | Cao | Có | Source of truth + dịch |
| 2 | Local `Tướng&CP.html` / Scribd | Thấp-vừa | Vừa | Có, cần clean | Seed event/generic + usage |
| 3 | Official Facebook | Thấp-vừa | Cao | Kém | Xác nhận tên Việt/mùa |
| 4 | BlueStacks/GameK/Download | Thấp | Vừa | Có | Docs nền, xác nhận khái niệm |
| 5 | YouTube/community | Rải rác | Thấp-vừa | Kém | Usage notes |

## Recommendation

1. Add fields, don't overwrite current data:

```json
{
  "effect": "Chinese official effect",
  "effectVi": "Vietnamese reviewed translation",
  "effectViSource": "lingxi-translation|local-sheet|official-facebook",
  "effectViStatus": "machine|reviewed|needs-review"
}
```

2. Auto-translate 209 Chinese effects from Lingxi, then review only top 112 used tactics first.

3. For 28 pending generic tactics:
   - Start from `Meta Team PK/Tướng&CP.html` / Scribd for Vietnamese short text.
   - Cross-check official Facebook posts by exact tactic names.
   - If no Vietnamese post found, translate Chinese community/source manually and mark `needs-review`.

4. Do not build a scraper around Facebook or Scribd yet. Fragile, low ROI. Use them as manual curation sources.

## Next Steps

1. Build a small curation TSV for the 112 used tactics:

```text
viet	hanViet	effectZh	effectVi	effectViSource	effectViStatus	notes
```

2. Fill the top 30 most-used tactics first from `facets.json`.

3. Add UI fallback:
   - show `effectVi` when reviewed
   - else show machine translation with warning
   - else show Chinese original for internal/debug only

4. Add tests to ensure every used tactic has one of:
   - reviewed `effectVi`
   - pending marker
   - documented missing source reason

## References

- Scribd mirror of Meta Team PK: https://www.scribd.com/document/735309629/Meta-Team-Gi%E1%BB%9Bi-Thi%E1%BB%87u-Mua-PK
- Official fanpage: https://www.facebook.com/tamquocchi.chienluoc
- BlueStacks beginner guide: https://www.bluestacks.com/vi/blog/game-guides/three-kingdoms-tactics/tqccl-beginner-guide-vi.html
- BlueStacks army guide: https://www.bluestacks.com/vi/blog/game-guides/three-kingdoms-tactics/tqccl-army-building-guide-vi.html
- GameK season 2 article: https://gamek.vn/vinh-du-buoc-len-top-1-ve-doanh-thu-tam-quoc-chi-chien-luoc-chinh-thuc-buoc-vao-mua-giai-thu-2-178230317151119083.chn
- Download.com.vn app page: https://download.com.vn/tam-quoc-chi-chien-luoc-cho-ios-168645
- YouTube example: https://www.youtube.com/watch?v=rOfZEAzlO2I
- Local source: `Meta Team PK/Tướng&CP.html`
- Local reports:
  - `plans/reports/research-tactic-content-and-team-suggestion-feasibility-260621-1946-report.md`
  - `plans/reports/researcher-260622-1734-sgz-generic-tactics-source-discovery-report.md`
  - `plans/reports/researcher-260622-1734-sgz-generic-tactics-source-investigation-report.md`

## Unresolved Questions

- Có chấp nhận `effectVi` là bản dịch + review, thay vì chỉ nguồn Việt gốc?
- Ưu tiên dịch đủ 112 chiến pháp đang dùng hay chỉ 28 generic/pending trước?
- Có muốn lưu snapshot official Facebook làm bằng chứng nguồn cho từng chiến pháp không?
