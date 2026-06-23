# Brainstorm Report: Nâng cấp "Soi đội từ ảnh" — Binh thư + Nhận diện tướng

---
type: brainstorm
created: 2026-06-23 14:40 Asia/Saigon
modes: []
related-research:
  - plans/reports/binh-thu-data-availability-and-soi-doi-integration-260623-1413-report.md
  - plans/reports/researcher-260623-1423-hero-portrait-assets-for-recognition.md
---

## Problem Statement

Module "Soi đội từ ảnh" hiện đọc **tướng + chiến pháp** (Qwen-VL đọc chữ Hán in trong ảnh), nhưng:
1. **Không đọc binh thư** (worker prompt + `analyze-map.js` cố tình bỏ).
2. **Không nhận tướng khi tên bị che** (prompt cấm đoán từ chân dung — chống hallucination).
3. **User không có cách xác nhận nhanh** tướng đọc đúng/sai (chỉ có text + cờ ⚠).

Mục tiêu: đọc thêm binh thư + tăng độ tin nhận diện, **giữ kiến trúc tĩnh + Worker hiện tại**, theo YAGNI/KISS.

## Quyết định đã chốt (user)

| Vấn đề | Chốt |
|---|---|
| Scope binh thư | Chỉ map Hán↔Việt, hiển thị (không effect, không tính điểm) |
| Hướng nhận diện | **B0+B1**: nới prompt đoán chân dung (low-conf) + hiển thị icon xác nhận |
| Gộp/tách | **Gộp 1 đợt** (cùng chạm worker schema + analyze render) |
| Asset icon | **Hotlink CDN** (iconUrl sẵn trong heroes-dict, zero-commit) |

## Approaches Evaluated (hướng B — nhận diện chân dung)

| PA | Cách | Chi phí | Rủi ro | Giữ tĩnh | Verdict |
|---|---|---|---|---|---|
| B0 | Nới prompt, LLM đoán tướng từ chân dung khi tên vắng + low-conf | ~0 hạ tầng | Thấp (gate confidence sẵn) | ✅ | **Chọn** |
| B1 | Hiển thị icon official cạnh kết quả để user mắt thường xác nhận | Thấp (UI+1 field) | Thấp | ✅ (hotlink) | **Chọn** |
| B2 | pHash client / CLIP embedding Worker khớp chân dung crop | Cao | Cao: crop giòn (no fixed grid), model ~50-100MB phá kiến trúc tĩnh, hoặc thêm hạ tầng Worker | ❌ | **Hoãn** |

**Brutal honest:** B2 (đề xuất trong research report) over-engineer cho vấn đề thật — đa số screenshot đã in tên (kể cả ảnh mẫu). Asset chân dung giá trị cao hơn khi **hiển thị xác nhận (B1)** chứ không phải input matching. Hoãn B2 tới khi có bằng chứng "tên bị che" là failure mode thật.

## Recommended Solution — A + B0 + B1, 1 đợt

### A. Binh thư data
- **Mới** `pipeline/build_books_dict.py` (khuôn `build_dict.py`, tránh phình file >200 LOC) → `data/books-dict.json` `[{chinese, hanViet, viet}]` ~74 mục.
- Hán→Hán-Việt qua `pipeline/hanviet.py`; auto-link Hán-Việt→tên Việt facet qua `pipeline/link_tactics.py`; fuzzy/nomatch in report review thủ công.
- **Nguồn tên Hán (rủi ro):** lingxi KHÔNG có 兵书库 (đã verify reverse bundle). Crawl wiki: huijiwiki 403, 9game JS-render → thử gamersky/baidu baike/tieba server-rendered; **fallback** seed thủ công 13 tên Hán đã có trong `analyze-map.js` `NON_TACTIC_TERMS` + bổ sung tay tới đủ phần giao với 74 facet.

### B0. Nới prompt
- `worker/src/model.ts` `VISION_PROMPT`: bỏ "không đoán tên tướng từ chân dung, icon"; cho phép đoán **chỉ khi cột không có tên in**, ưu tiên tên in. Thêm hướng dẫn đọc binh thư vào field riêng (không lẫn tacticsCn).
- Bù hallucination: matchDict + ngưỡng + cờ ⚠ sẵn có; auto-accept chỉ khi confidence cao.

### B1. Schema + map + UI
- `worker/src/schema.ts`+`model.ts`: thêm `booksCn: string[]` mỗi hero; `validateResult` cắt/bảo vệ (MAX như tactics).
- `js/analyze-map.js`: bỏ binh thư khỏi `NON_TACTIC_TERMS`; thêm `booksDict` vào `mapRead` → `books[]` canonical; gắn `iconUrl` (từ heroesDict match) vào kết quả hero. `findSimilarTeams` GIỮ NGUYÊN.
- `js/analyze.js` `heroResultCard`: thêm `<img class="ana-hero-icon">` (hotlink iconUrl, lazy, alt=tên) + render dòng binh thư.
- `js/app.js`: nạp `books-dict.json` + truyền vào deps soi đội.

## Touchpoints
- Mới: `pipeline/build_books_dict.py`, `data/books-dict.json`
- Sửa: `worker/src/schema.ts`, `worker/src/model.ts`, `js/analyze-map.js`, `js/analyze.js`, `js/app.js`, `css/styles.css` (icon)
- Test: `tests-js/analyze-map.test.mjs`, worker test (`worker/test/`), fixture binh thư; `pipeline` test cho build_books_dict nếu tách parser thuần

## Risks & Mitigation
1. **Nguồn binh thư Hán không crawl ổn định** → fallback bảng thủ công (đã có seed). Chấp nhận dựng dần phần giao facet trước.
2. **Hallucination tướng từ chân dung (B0)** → chỉ đoán khi tên vắng + luôn low-conf + gate ngưỡng; có thể thêm test prompt regression.
3. **Hotlink CDN gãy** → ảnh icon là phụ trợ xác nhận, gãy thì `onerror` ẩn `<img>`, không chặn kết quả text.
4. **Vision nhầm binh chủng (象兵) với binh thư** → prompt tách rõ + dict binh thư không chứa tên binh chủng.

## Success Metrics
- Ảnh mẫu user → đọc đủ tướng + chiến pháp + binh thư đúng canonical Việt; mỗi tướng có icon hiển thị.
- Tên bị che → vẫn ra ứng viên tướng + cờ ⚠ (không crash, không auto sai).
- Test JS/worker xanh; không hồi quy 3 tab offline.

## Out of Scope
- B2 pHash/embedding matching.
- Binh thư tính vào điểm `findSimilarTeams`.
- Mô tả/hiệu ứng binh thư.
- Tải asset PNG về repo.

## Unresolved Questions
1. Nguồn wiki cụ thể nào server-rendered đủ ổn để crawl đủ 74 tên Hán? (giải quyết ở phase build, có fallback)
2. Binh thư xuất hiện trong ảnh dạng chữ Hán hay đã là tiếng Việt? (ảnh mẫu là Hán — giả định Hán; nếu game VN hiển thị Việt thì map đổi chiều)
3. Ngưỡng auto-accept cho tướng đoán-từ-chân-dung có khác ngưỡng tên-in không?
