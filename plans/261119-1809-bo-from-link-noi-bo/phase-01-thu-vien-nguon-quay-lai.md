---
phase: 1
title: "Thư viện nguồn quay lại"
status: done
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Thư viện nguồn quay lại (`js/team-detail-navigation.js`)

## Goal
Hàm thuần: builder link không còn nhận/phát `from`; một resolver duy nhất quyết định đích Quay lại (state → `?from=` cũ → referrer → sessionStorage); allowlist Đội chuẩn giữ `kho`/`xep`.

## Files
- Modify: `js/team-detail-navigation.js`
- Modify: `tests-js/team-detail-navigation.test.mjs`

## Tests Before (viết trước, phải đỏ)
1. `teamDetailHref` / `referenceDetailHref` / `khaiHoangCardHref`: kết quả không có `from`; `variant` như cũ (Đội khác luôn có, Khai hoang chỉ nondefault). Builder **không** còn option `from`/`origin` (không shim). <!-- Red Team: no-shim -->
2. `safeReturnUrl('/doi-chuan/?season=all&q=x&kho=rap-duoc&xep=de-rap')` giữ đủ 4 khóa; `/doi-khac/?kho=…` vẫn bỏ `kho` (`recommended-reference-state.js:173-175`).
3. `resolveDetailReturn({href, referrer, state, storage, origin, khaiHoang})`, mọi ca truyền `origin: 'https://tqccl.com'`:
   | state.teamDetailReturn | `?from=` | referrer | storage[path] | Kỳ vọng |
   |---|---|---|---|---|
   | hợp lệ | bất kỳ | bất kỳ | bất kỳ | state |
   | thiếu/hỏng | hợp lệ (tương đối **và** tuyệt đối cùng origin) | bất kỳ | bất kỳ | `safeReturnUrl(from)` |
   | thiếu | thiếu | `https://tqccl.com/doi-chuan/?season=s27&kho=rap-duoc` | khác | referrer (referrer thắng storage cũ) |
   | thiếu | thiếu | origin khác / `accounts.google.com` / trang chi tiết / rỗng | `/doi-chuan/?q=x` | storage |
   | thiếu | thiếu | rỗng | thiếu | `null` |
   | thiếu | thiếu | `https://tqccl.com/zh/doi-khac/?q=x` | — | `/zh/doi-khac/?q=x` |
   | thiếu | thiếu | rỗng | `/doi-chuan/?q=x` (ghi từ bản vi), trang hiện là `/zh/…` | `/zh/doi-chuan/?q=x` |
   | thiếu | thiếu | `/khai-hoang/?khTeam=A&khVariant=a1`, khaiHoang `{teamId:'B', variantId:''}` | — | `/khai-hoang/?khTeam=B` |
   | thiếu | thiếu | như trên, `{teamId:'B', variantId:'b2'}` | — | `/khai-hoang/?khTeam=B&khVariant=b2` |
   | thiếu | `/khai-hoang/?khTeam=A` | bất kỳ, khaiHoang B | — | `/khai-hoang/?khTeam=A` (link cũ giữ cặp) |
   - **Hostile** (Red Team S1/S7): lặp danh sách độc hại sẵn có (`tests-js/team-detail-navigation.test.mjs:203-221`: `javascript:alert(1)`, `//evil.example/`, `/\\evil.example`, trang chi tiết…) lần lượt ở vị trí state, `from`, referrer, storage → bị bỏ qua, nguồn hợp lệ kế tiếp thắng. Thêm: "state độc + from độc + referrer hợp lệ → referrer", state là chuỗi/không phải object, referrer `https://tqccl.com.evil.example/…`, `https://tqccl.com@evil.example/…` → không nhận; storage hỏng JSON / không phải object → bỏ qua.
   - Port ca `returnHrefFor` (`:234-236, 540-545, 564`: `/khai-hoang/handle/`, `/#khaihoang`) sang resolver.
4. `rememberDetailReturn(storage, detailHref, target)` / đọc lại: khóa = pathname trang chi tiết bỏ tiền tố locale; lưu target đã bỏ locale; tối đa 32 mục (mục cũ nhất bị loại); lỗi storage nuốt im.
5. `detailUrlWithoutReturn('/doi-chuan/x/?variant=2&from=%2Fdoi-chuan%2F#a')` → `/doi-chuan/x/?variant=2#a`; không có `from` trả **nguyên chuỗi** (không re-encode).
6. `khaiHoangDetailVariantUrl(href có from, 'v')` → không còn `from` (đảo `:523-534`).
7. `migrateLegacyReferenceUrl`: `target` không có `from`.

## Refactor
1. `SECTION_QUERY_KEYS['/doi-chuan/']` thêm `'kho','xep'`. Export thêm `SSR_STALE_EXEMPT_KEYS = ['kho','xep']` để Phase 2 loại khỏi stale guard (giữ hành vi hiện tại: kho không ẩn thân dựng sẵn). <!-- Red Team: A1/F3 -->
2. `teamDetailHref(target, {locale})`, `referenceDetailHref(row, {locale})`, `khaiHoangCardHref(teamId, variantId, {locale})`: bỏ `from`/`origin`. Sửa JSDoc 140-143, 153.
3. `TEAM_DETAIL_RETURN_STORAGE_KEY = 'tqccl:team-detail-return:v1'`. Mới `resolveDetailReturn({href, referrer, state, storage, origin, khaiHoang = null})` — **mọi** lần gọi `safeReturnUrl` truyền `{origin}`; JSDoc: `origin` PHẢI là `location.origin`, không suy từ referrer.
   1. `safeReturnUrl(state?.teamDetailReturn)` (chỉ khi state là object).
   2. `safeReturnUrl(searchParams.get('from'))`.
   3. `safeReturnUrl(referrer)`; nếu là `/khai-hoang/` và `khaiHoang?.teamId` → `khaiHoangUrlWithPair(url, khaiHoang)`.
   4. storage theo khóa pathname bỏ locale → `safeReturnUrl(localePath(stripped, localeOf(href)))`.
   5. `null`.
4. `rememberDetailReturn(storage, href, target)` như Tests Before 4.
5. `detailUrlWithoutReturn(href)`: chỉ xóa khi có `from`.
6. `khaiHoangDetailVariantUrl`: xóa `from`; sửa chú thích 296.
7. `migrateLegacyReferenceUrl`: bỏ biến/option `from`.
8. Xóa `returnHrefFor` (caller duy nhất `khaihoang-detail.js:58` chuyển sang resolver); ca test chuyển như Tests Before 3.

## Tests After
Cập nhật assertion ghim `from`: `tests-js/team-detail-navigation.test.mjs` ~85-91, 320-337, 382-387, 523-534, 570-571; bỏ import `returnHrefFor` (dòng 9) sau khi port. Giữ mọi ca đọc `?from=` cũ (qua resolver).

## Regression gate
`node --experimental-strip-types --test tests-js/team-detail-navigation.test.mjs`

## Risks
- Đổi chữ ký export: `xd://lsp` references cho `teamDetailHref`, `referenceDetailHref`, `khaiHoangCardHref`, `returnHrefFor`, `khaiHoangDetailVariantUrl`; grep `{from` / `from:` trước khi merge.
