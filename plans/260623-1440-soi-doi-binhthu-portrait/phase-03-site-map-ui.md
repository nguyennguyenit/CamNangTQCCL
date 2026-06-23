---
phase: 3
title: Site map + UI
status: completed
priority: P1
effort: 0.5d
dependencies:
  - 1
  - 2
---

# Phase 3: Site map + UI

## Overview
Site map binh thư Hán→Việt + gắn icon tướng, hiển thị ở "Đội đọc được". `findSimilarTeams` giữ nguyên (binh thư không tính điểm — chốt).

## Requirements
- Functional: `analyze-map.js` bỏ binh thư khỏi lọc, map `booksCn`→canonical qua `booksDict`, gắn `iconUrl` (từ heroesDict match) vào hero; `analyze.js` render icon (hotlink, lazy, onerror ẩn) + dòng binh thư; `app.js` nạp `books-dict.json` + truyền deps.
- Non-functional: zero-dep giữ nguyên; icon gãy không chặn text; tướng đoán-từ-chân-dung (low-conf) → cờ ⚠.

## Architecture
- `analyze-map.js`:
  - Xóa các tên binh thư khỏi `NON_TACTIC_TERMS` (giữ set cho tên rác khác nếu cần) — binh thư giờ map chứ không bỏ.
  - `mapRead(read, {heroesDict, tacticsDict, booksDict})`: thêm `books = (read.booksCn||[]).map(b => mapName(b, booksDict))`; gắn `iconUrl` = record heroesDict khớp (nếu `hero.matched`).
  - Tôn trọng `read.nameFromPortrait` (nếu P2 thêm): ép `sure=false` dù confidence cao.
  - `findSimilarTeams`: KHÔNG đổi.
- `analyze.js` `heroResultCard`: thêm `<img class="ana-hero-icon" loading="lazy" onerror=ẩn>` + block binh thư (giống `ana-tactics`).
- `app.js`: `loadJSON("./data/books-dict.json")` → `initAnalyze({..., booksDict}, ...)`.
- `css/styles.css`: `.ana-hero-icon`, `.ana-books`.

## Related Code Files
- Modify: `js/analyze-map.js`, `js/analyze.js`, `js/app.js`, `css/styles.css`, `tests-js/analyze-map.test.mjs`
- Create: fixture binh thư trong test (inline DICTS books)
- Depends on: `data/books-dict.json` (P1), `booksCn` field (P2)

## Implementation Steps (TDD)
1. **Test trước** `tests-js/analyze-map.test.mjs`: thêm `BOOKS` dict + cập nhật `DICTS`; assert (a) `mapRead` map `booksCn:["铁甲"]`→`viet:"Giáp Sắt"` (theo seed thật); (b) binh thư KHÔNG còn bị lọc khỏi output; (c) `iconUrl` gắn vào hero khi matched; (d) `nameFromPortrait`→`sure=false`; (e) `findSimilarTeams` điểm KHÔNG đổi khi thêm books. Chạy đỏ.
2. Sửa `analyze-map.js` theo Architecture.
3. Sửa `analyze.js` render icon + binh thư; `app.js` nạp dict; `css` style.
4. `node --test tests-js/analyze-map.test.mjs tests-js/filters.test.mjs tests-js/match-dict.test.mjs` xanh.
5. Smoke thủ công: `python3 -m http.server`, mở tab Soi đội với ảnh mẫu (cần Worker cấu hình) — hoặc mock result để verify render icon + binh thư.

## Success Criteria
- [ ] `tests-js/analyze-map.test.mjs` xanh; không hồi quy `filters`/`match-dict` test.
- [ ] Kết quả mỗi tướng: icon official + dòng binh thư canonical Việt; icon gãy → ẩn, không lỗi.
- [ ] Tên che/đoán → cờ ⚠; `findSimilarTeams` cho cùng kết quả như trước với input không-books.
- [ ] 3 tab offline (Team PK / Cùng Tồn / Khai hoang / Tra cứu) không hồi quy.

## Risk Assessment
- **books-dict thiếu mục** (P1 chưa phủ hết): binh thư không khớp → giữ Hán + cờ (giống tactic lạ), không vỡ.
- **[RED-TEAM] Hotlink bị chặn Referer**: aligames/lingxi CDN có thể trả 403 khi load từ domain khác → icon không hiện dù URL đúng. **Verify từ browser TRƯỚC** khi tin vào giá trị B1; nếu chặn diện rộng → B1 mất tác dụng, cân nhắc bỏ icon hoặc dùng `referrerpolicy="no-referrer"`. `onerror` ẩn `<img>` nên không vỡ layout.
- **Rollback**: revert 4 file; bỏ nạp books-dict ở app.js → trở lại hành vi cũ.
