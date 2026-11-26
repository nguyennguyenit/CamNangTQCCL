---
phase: 2
title: "Trang chi tiết và mọi caller"
status: done
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 2: Trang chi tiết và mọi caller

## Goal
Không nơi nào phát `from`; hai trang chi tiết dùng `resolveDetailReturn`, ghim đích vào `history.state` + sessionStorage và dọn `from` khỏi thanh địa chỉ; chữ ký prerender không còn thành phần URL.

## Files
- Modify: `js/app.js` (372, 578, 648; restore cuộn ~402-440)
- Modify: `src/lib/team-section-ssr.js` (1-3, 54, 58, 78-79, 140, 153-167)
- Modify: `js/team-filter-section.js` (167-172, 525-528)
- Modify: `js/lookup-tactic-profile.js` (39-45, 228, 259, 292-295), `js/lookup-profile.js` (289, 349, 402-405, 486-498)
- Modify: `js/team-detail.js` (31-36), `js/khaihoang-detail.js` (57-58, 75)
- Modify: `js/site-chrome.js` (102-111)
- Modify: `public/_headers`, `tests-js/pages-headers-contract.test.mjs`
- Create: `tests-js/site-chrome.test.mjs`
- Modify: `tests-js/team-section-ssr.test.mjs:31`

## Tests Before
1. `team-section-ssr.test.mjs`: HTML dựng sẵn Đội chuẩn/Đội khác/Khai hoang (vi/zh/ja) không có href chứa `from`; chữ ký = `[season, q, filters, view, shown]` (không thành phần URL); stale guard không bật với chỉ `kho`/`xep`.
2. `tests-js/site-chrome.test.mjs` (mới, `documentTarget`/`windowTarget` giả): `?variant=v&from=%2Fkhai-hoang%2F` → href giữ `variant`, không `from`; URL không có `from` → href **đúng nguyên chuỗi** như hiện tại (không re-encode `%20`).
3. `pages-headers-contract.test.mjs`: `/*` có `Referrer-Policy: strict-origin-when-cross-origin`.

## Refactor
1. `js/app.js`: `referenceHref = row => referenceDetailHref(row)`; Khai hoang `hrefFor` không `from`; `onOpenTeam` gọi `teamDetailHref(...)` không `from`. Sửa chú thích 571-572 ("href tự đủ state" → snapshot + referrer). Giữ `rememberReturn`/`syncKhaiHoangRoot`/`onNavigate`.
2. **Cuộn với kho** (Red Team F4): trong `restoreReturnState`, nếu URL có `kho`/`xep` và có kho cục bộ (nguồn kho đang tải), hoãn bước cuộn/disclosure tới lần `setRoster` đầu tiên áp xong (one-shot); không có kho thì như cũ.
3. `team-section-ssr.js`: `hrefFor` không `from` (54, 140); chữ ký bỏ thành phần URL (58); `ssrStaleGuardScript` lấy `keys` = allowlist trừ `SSR_STALE_EXEMPT_KEYS`; sửa chú thích 1-3, 78-79.
4. `team-filter-section.js`: `referenceViewSignature=(state,mode,shown)` bỏ `from`; xóa biến 527; sửa chú thích 167-170 (theo Astra finding 3).
5. Tra cứu: `representativeTeamHref(team)` bỏ tham số `from`; xóa chuỗi truyền `from` qua `camNangCards`, `heroSummaryTree`, `tacticSummaryBlockTree`, `profilePageTree`, JSDoc 486-489.
6. `js/team-detail.js` thay `upgradeReturnLink`:
   ```js
   const storage = sessionStore();
   const target = resolveDetailReturn({href: location.href, referrer: document.referrer, state: history.state, storage, origin: location.origin});
   if (target) { link.href = target; rememberDetailReturn(storage, location.href, target); }
   const clean = detailUrlWithoutReturn(location.href);
   if (clean !== currentUrl || history.state?.teamDetailReturn !== (target ?? null))
     history.replaceState({...(history.state || {}), teamDetailReturn: target ?? null}, '', clean);
   ```
7. `js/khaihoang-detail.js`: cùng mẫu, `khaiHoang: {teamId, variantId: known(requestedVariant()) ? requestedVariant() : ''}` — `known` kiểm với tập chip dựng sẵn `.kh-config-chip[data-variant]` (Red Team S5); fallback `familyReturnHref('khaihoang')`. Nút "Xem cấu hình mặc định" giữ là link thật; đích quay lại sống qua sessionStorage.
8. `js/site-chrome.js:110`: chỉ khi `location.search` có `from` mới dựng lại search bỏ `from`; ngược lại giữ chuỗi gốc.
9. `public/_headers`: thêm `Referrer-Policy: strict-origin-when-cross-origin` dưới `/*` (khớp production hiện tại, chỉ đưa vào repo).
10. `js/detail-actions.js` `shareableUrl`: giữ (phòng thủ).

## Tests After
`npm run test:node`; `xd://lsp` diagnostics các file đã sửa.

## Regression gate
`npm run test:node`

## Risks
- Đổi ngôn ngữ / đăng nhập Google / skip-link + reload / nút cấu hình mặc định: entry mới, referrer vô dụng → sessionStorage giữ đích (theo tab). Tab mới không có storage cho đội đó → referrer.
- Mở lại cùng đội từ danh sách khác: referrer thắng storage, rồi ghi đè storage.
- `replaceState` trên trang có `#hash`: `detailUrlWithoutReturn` giữ hash.
