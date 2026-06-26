---
phase: 2
title: "UI tra cứu tướng + modal"
status: pending
priority: P1
effort: "5h"
dependencies: [1]
---

# Phase 2: UI tra cứu tướng + modal

## Overview
Tab mới "Tra cứu tướng" (mirror pattern `tactics.js`: search + chip lọc + grid card) và modal chi tiết tướng. Modal mở từ card tab tướng (modal-từ-Soi-đội tách pha sau, KHÔNG làm ở đây).

## Requirements
- Functional: browse 112 tướng; search (Việt bỏ dấu / Hán-Việt / Hán) tái dùng `searchDict` (match-dict.js); lọc theo thích tính binh chủng (S/A) / vai trò / phe / sao; click card → modal stats + 2 chiến pháp (tên VN + mô tả link từ tactics) + S/A/B + roleTagViet.
- Non-functional: 0 dep, DOM-safe (`el` render.js), responsive + mobile nav, dark mode.

## Architecture
- `js/hero-list.js`: `initHeroList(heroesDict, tacticsDict, mount)` — dựng search/chip/grid; card hiển thị icon, tên VN, phe, sao, troopApt badges, roleTagViet.
- `js/hero-detail.js`: `heroDetailModal(hero, tacticsDict)` — build modal; **link chiến pháp**: tra `tacticsDict` theo `hero.selfTacticCn` / `hero.inheritTacticCn` (`chinese`), lấy `viet`+effect; fallback hiển thị tên Hán nếu không khớp (1 case `高橹联营`).
- `index.html`: thêm `<button class="nav-tab" data-section="heroes">Tra cứu tướng</button>` + `<section id="section-heroes">`.
- `js/app.js`: load sẵn `heroesDict`+`tactics` → gọi `initHeroList`; wiring section switch (theo pattern `initTactics`/`initAnalyze`).
- `css/styles.css`: style `.hero-card`, `.hero-grid`, `.troop-apt`, `.hero-modal` (tái dùng token tac-card sẵn có).

## Related Code Files
- Create: `js/hero-list.js`, `js/hero-detail.js`, `tests-js/hero-list.test.mjs`, `tests-js/hero-detail.test.mjs`
- Modify: `index.html`, `js/app.js`, `css/styles.css`, `README.md` (sửa claim sai + thêm tab mới)

## Implementation Steps (TDD)
1. **Test trước** (`tests-js/hero-detail.test.mjs`): pure builder — given hero + tacticsDict, modal node chứa tên VN chiến pháp tự mang/truyền thừa + effect; case không khớp → fallback tên Hán. Đỏ.
2. **Test trước** (`tests-js/hero-list.test.mjs`): filter logic thuần (lọc theo troopApt/role/faction/stars) trả đúng tập. Đỏ.
3. Viết `hero-detail.js` (builder thuần, export để test) → xanh.
4. Viết `hero-list.js` (tách filter thuần + render) → xanh.
5. Wiring `index.html` + `app.js` + CSS.
6. Sửa README: bỏ "237 chiến pháp + 112 tướng" ở tab chiến pháp; thêm mô tả tab "Tra cứu tướng".
6b. **[Audit A1] Sửa lệnh test JS trong README** từ danh sách file cứng → glob `node --test "tests-js/*.test.mjs"` để test mới (P2/P3) thực sự chạy (không có CI bù).
7. Smoke thủ công qua `python3 -m http.server` (mô tả ở plan, không tự chạy browser).

## Success Criteria
- [ ] Test JS hero-list + hero-detail đỏ→xanh.
- [ ] Tab render 112 card; 4 nhóm lọc hoạt động; search đa ngõ vào OK.
- [ ] Modal hiện stats + 2 chiến pháp link đúng + fallback 1 case + S/A/B + roleTagViet.
- [ ] `node --test tests-js/*.mjs` pass; README khớp thực tế.

## Risk Assessment
- **Mobile nav 6 tab chật**: tái dùng `mobile-section-menu.js` sẵn có; kiểm overflow.
- **Link chiến pháp lệch**: 1 self-tactic ngoài thư viện → fallback tên Hán, test phủ.
- **Scope creep modal-từ-Soi-đội**: KHÔNG làm ở P2 (đã chốt tách).
