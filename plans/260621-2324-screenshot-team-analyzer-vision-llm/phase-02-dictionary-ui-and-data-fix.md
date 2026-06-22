# Phase 2 — UI Từ điển chiến pháp + sửa data team

## Context
- **[H2] Ship trước P3/P4, NHƯNG SAU P1** (cứng phụ thuộc `tactics.json`). Không cần AI/proxy.
- Dùng `data/tactics.json` (Phase 1). Tái dùng `normalizeText` (filters.js).
- **[H1] Fuzzy matcher CHƯA tồn tại trong `js/`** — phải viết mới `js/match-dict.js` (0-dep levenshtein/n-gram trên chuỗi đã normalize). Đây là logic lõi, TDD-first, định nghĩa **ngưỡng confidence** + hành vi dưới ngưỡng. Dùng chung cho Phase 4.

## Requirements
- Section/trang mới "Tra cứu chiến pháp" (nav tab thứ 4, deep-link `#tactics`).
- Ô search đa ngõ vào: tiếng Việt bỏ dấu, Hán-Việt, dán chữ Hán → khớp `aliases` + `chinese` + `hanViet` + `viet`.
- Chịu typo: fuzzy qua `js/match-dict.js` (viết mới, H1). Kết quả: card chiến pháp = tên Việt + Hán + Hán-Việt + loại + chất lượng + mô tả + binh chủng phù hợp (icon optional URL-only, C3).
- Lọc theo loại (7 loại) + chất lượng (S/A/B).
- **Sửa data**: dùng `tactics.json` làm nguồn chuẩn → cập nhật `aliases.json` để chuẩn hóa tên lệch trong 172 team (vd Trấn Mục→Sân Mục); rebuild data.

## Files
- Tạo: `js/tactics.js` (render card + search dict), `data/tactics.json` (từ P1).
- Sửa: `index.html` (thêm tab + section), `js/app.js` (load tactics.json, nav `#tactics`, SECTIONS), `css/styles.css` (card chiến pháp + lọc), `pipeline/aliases.json` (chuẩn hóa tên), `js/filters.js` (nếu cần normalize dùng chung).
- Test: `tests-js/tactics-search.test.mjs`.

## Steps
1. Thêm tab "Tra cứu chiến pháp" + section rỗng; nav hash.
2. `tactics.js`: hàm thuần `searchTactics(query, dict)` (đa ngõ vào + fuzzy) + `tacticCard(t)` (DOM-safe).
3. app.js: load `tactics.json`, render lưới + lọc loại/chất lượng.
4. Data-fix: chạy `link_tactics.py` đối chiếu → cập nhật aliases → `python3 -m pipeline.build_json` → verify tên lệch đã chuẩn.
5. CSS card + responsive.

## Tests (TDD)
- `tactics-search.test.mjs`: gõ "me hoac" / "mi hoac" / "魅惑" đều ra Mê Hoặc; typo "tran muc" ra Sân Mục; lọc theo loại đúng.
- Rebuild: `unittest discover` vẫn xanh sau khi sửa aliases; facets.tactics phản ánh tên chuẩn.

## Risks / Rollback
- Sửa alias làm lệch tên đang đúng → review từng cặp trước khi áp; test count không đổi.
- tactics.json lớn (icon) → lazy-load icon, chỉ load section khi mở.
