---
phase: 5
title: "Cờ bản dịch trên giao diện"
status: pending
priority: P1
effort: "5h"
dependencies: [3]
---

# Phase 5 — Cờ bản dịch trên giao diện

<!-- Updated: Red Team 2026-10-20 - helper ở lookup-detail.js, thêm bảng nhóm zh + bỏ hiệu ứng khỏi meta/JSON-LD zh (quyết định người dùng), bỏ đăng ký UI_LITERAL_OBLIGATIONS, kiểm đổi phiên bản bằng record giả -->

## Mục tiêu
Khi `lookup.effectZhSource.kind == "translation"`:
- Hồ sơ chiến pháp: cờ ở vi + zh (trang tĩnh không JS, modal), nằm ngoài panel phiên bản.
- Thẻ chiến pháp liên quan: cờ chỉ ở zh.
- Bảng nhóm `/zh/tra-cuu/chien-phap/`: cờ trong ô hiệu ứng.
- Meta description + JSON-LD trang zh: không dùng đoạn hiệu ứng.
Mục `source`/`capture`/`null` không có cờ, meta không đổi. Giải thích đội (roster) để nguyên.

## Bằng chứng
- `js/lookup-tactic-profile.js:116-154` `effectSection` (head `:120-131`), locale `:19`, `L` `:10`, import `lookup-detail.js` `:11`; dùng chung modal + trang (`:216-219`, `src/lib/lookup-item-pages.ts:118-122`).
- `js/lookup-profile.js:119-143` `tacticCard`, `:136`, tag `:140`; import `lookup-detail.js` `:14` (không import `lookup-tactic-view.js`).
- `js/unified-lookup.js:283-294` `tacticTableRow` (`effect` `:291`), render `:344`; import `lookup-detail.js` `:7`.
- `src/lib/lookup-item-pages.ts:62` `effect = snippet(currentEffect(zh ? record.effect : record.effectViet))`, dùng ở `:66` và cho meta/JSON-LD (`:157`, `:170`).
- `.lookup-version-tag` `css/styles.css:7993-8000`; `.lookup-effect-version-label` `:8257-8265` (ẩn khi có JS — không dùng).
- Hash ghim trong `pipeline/site-localization-policy.json`: `js/lookup-detail.js :775`, `js/lookup-profile.js :779`, `js/lookup-tactic-profile.js :780`, `js/unified-lookup.js :797`, `src/lib/lookup-item-pages.ts :814` → repin ở phase 06. `UI_LITERAL_OBLIGATIONS` chỉ kiểm tuple đã đăng ký (`site_localization.py:1781-1810`); `lookup-tactic-profile.js` hiện không có tuple nào → không đăng ký.
- Không chiến pháp thật nào trong 63 mục có nhiều hơn một phiên bản hiệu ứng (`revisions: []`, `build_unified_lookup.py:1134`, `:1080-1081`).

## File
- Sửa: `js/lookup-detail.js` (helper + chuỗi cờ)
- Sửa: `js/lookup-tactic-profile.js`, `js/lookup-profile.js`, `js/unified-lookup.js`
- Sửa: `src/lib/lookup-item-pages.ts`
- Sửa test: `tests-js/lookup-profile-trees.test.mjs`, `tests-js/unified-lookup.test.mjs`, `tests-js/seo-dist-contract.test.mjs` (meta zh)
- Sửa e2e: `tests-e2e/lookup-item-pages.spec.mjs`, `tests-e2e/zh-locale.spec.mjs`

## Thiết kế
- `js/lookup-detail.js`:
  ```js
  export const isTranslatedZhEffect = (record) => record?.lookup?.effectZhSource?.kind === "translation";
  export const zhTranslatedNote = () => L("Hiệu ứng chữ Hán dịch từ tiếng Việt, chưa đối chiếu", "中文效果译自越南语，未经核对");
  export const zhTranslatedTag = () => t("span", { class: "lookup-version-tag lookup-zh-translated", "data-zh-source": "translation" }, zhTranslatedNote());
  ```
  (Dùng đúng hàm dựng cây mà file đang dùng — `t` của `render.js` cho profile, `h` của `view-tree.js` cho bảng; nếu `lookup-detail.js` không import `t`, xuất chuỗi và để mỗi nơi tự dựng span cùng class/attr.)
- `effectSection`: thêm tag vào `head` sau tiêu đề, trước nút phiên bản — không nằm trong panel, nên không mất khi đổi phiên bản/dựng lại thân.
- `tacticCard`: `zh && isTranslatedZhEffect(record)` → tag sau `current?.labelVi` (`:140`).
- Bảng: `tacticTableRow` thêm `zhTranslated: normalizeLocale(locale) === "zh" && isTranslatedZhEffect(record)`; render `:344` thêm tag trong `p.lookup-table-effect` (hoặc ngay sau) khi `row.zhTranslated`.
- Meta: tại `:62`, `const effect = zh && isTranslatedZhEffect(record) ? "" : snippet(…)`; `tail("", …)` phải cho câu không có phần hiệu ứng (kiểm `tail` xử lý rỗng; nếu không, rẽ nhánh câu).
- CSS: không thêm màu; chỉ token sẵn có; `node scripts/design-tokens.mjs --check`.

## Các bước
1. Test trước:
   - `tests-js/lookup-profile-trees.test.mjs`: một chiến pháp `translation` và một `source`/`capture` (sau phase 04 dùng corpus thật; trước đó dùng fixture) — cờ có ở hồ sơ vi + zh đúng chữ; không có ở mục khác. Record giả 2 revision + `translation`: cờ nằm ngoài panel, còn sau khi dựng lại thân bằng binder phiên bản.
   - `tests-js/unified-lookup.test.mjs`: `tacticCard` zh có cờ, vi không; `tacticTableRow` zh có `zhTranslated`, vi không.
   - `tests-js/seo-dist-contract.test.mjs`: trang zh của một mục `translation` có meta description không chứa đoạn hiệu ứng; mục `null` vẫn có.
2. Cài helper + 4 chỗ (profile, thẻ, bảng, meta).
3. E2E: `tests-e2e/lookup-item-pages.spec.mjs` trang tĩnh (JS tắt) `/tra-cuu/chien-phap/<id translation>/` và `/zh/...` có `[data-zh-source="translation"]`; `zh-locale.spec.mjs`: bảng `/zh/tra-cuu/chien-phap/` có cờ ở hàng của mục translation; thẻ liên quan trên hồ sơ tướng zh có cờ.
4. `node scripts/design-tokens.mjs --check`.

## Todo
- [x] Test cây vi/zh, record giả 2 revision, thẻ, bảng, meta (đỏ trước)
- [x] Helper trong `lookup-detail.js`
- [x] Render: hồ sơ, thẻ zh, bảng zh, meta zh
- [x] E2E
- [x] `design-tokens --check`

## Kiểm tra
- `node --experimental-strip-types --test tests-js/lookup-profile-trees.test.mjs tests-js/unified-lookup.test.mjs` pass.
- `npm run test:dist` (gồm `seo-dist-contract`) pass sau build ở phase 06.
- Playwright `tests-e2e/lookup-item-pages.spec.mjs tests-e2e/zh-locale.spec.mjs` pass.

## Rủi ro
- Câu cờ trên trang vi nói về chữ Hán trong khi trang hiện tiếng Việt: đúng lựa chọn người dùng; câu nói rõ "chữ Hán".
- Bỏ hiệu ứng khỏi meta zh làm snippet ngắn hơn cho ~mục translation: chấp nhận theo quyết định người dùng.
