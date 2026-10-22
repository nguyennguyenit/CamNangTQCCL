---
phase: 1
title: "Lối vào menu + thẻ landing, publish lại bản dịch"
status: pending
priority: P1
effort: "3h"
dependencies: []
---

# Phase 1 — Lối vào menu + thẻ landing, publish lại bản dịch

## Mục tiêu
Mục "Đội cộng đồng" có mặt trong menu Cộng đồng (desktop, mobile, thanh chuyển nhanh, footer) và một thẻ trong khối Cộng đồng của landing, ở cả `/` và `/zh/`; chuỗi publish localization chạy hết để `npm run build`/`npm run verify` xanh với hash nguồn mới.

## Bằng chứng
- `communityEntries` chỉ có Chiến báo, Bài viết: `src/layouts/SiteLayout.astro:227-242`; dùng ở menu thả `:301`, thanh chuyển nhanh `:312`, menu mobile `:324`, footer `:345-350`. Mục đang xem suy từ pathname bằng `pathMark` `:225-226` (trang con `/doi-cong-dong/<id>/` sẽ được `aria-current="true"`). Comment mô tả nhóm ở `:221-224`.
- `communityCards` có 3 thẻ: `src/components/landing/Landing.astro:121-152`; render `:317-336`; icon tra theo `SECTION_ICONS` `:78`, khoá có sẵn `other` (nhóm người) ở `src/lib/section-icons.ts:7`. Lưới `.landing-community-grid` 3 cột: `css/styles.css:2791-2793`; mobile 1 cột `:3305-3309`.
- Hai file bị ghim: `pipeline/site-localization-policy.json:803` (`Landing.astro`), `:811` (`SiteLayout.astro`). `package.json:10,15`: `build` và `verify` chạy `site_localization check --stage public` trước. Thực nghiệm (local://verification-facts.md): thêm 1 dòng vào `SiteLayout.astro` → exit 1 `reviewed source hash is stale`; file/route mới không bị gate. `css/styles.css` và `js/community-*.js` không có trong `sourceFiles` (`pipeline/site-localization-policy.json:761-833`).
- Quy trình publish: `docs/deployment-guide.md:251-271` (inventory → ghim hash → build candidate → check all → publish → check public → re-pin `generationId` của `pipeline/team-route-handles.json:2` theo `recommendedPin.generationId` trong `data/website-display.json` → `team_route_handles --check` → build/verify/test:dist). Đổi fingerprint obligation lớp `translate` cần receipt người duyệt độc lập; lớp `authored-vi` thì không (`docs/deployment-guide.md:269-270`).
- Obligation khai trong `pipeline/site_localization.py` (`CLASSIFICATIONS` `:51`, `UI_LITERAL_OBLIGATIONS` từ `:267`; header/menu/footer dùng lớp `authored-vi` `:432-472`). Nhãn "Chiến báo"/"Bài viết" của `communityEntries` không có obligation riêng (grep `site_localization.py` không thấy) → nhiều khả năng nhãn mới cũng không sinh obligation; **phải xác nhận bằng `inventory`**, không suy đoán.
- Tiền lệ commit publish: `22e3ffd` (đổi `SiteLayout.astro` + policy + `data/website-display.json` + `pipeline/team-route-handles.json` + thư mục generation `src/data/recommended-reference/<generation>/` + `mcp-worker/src/generated/workflow-build.ts` vì commit đó sửa `js/website-display.js`). `mcp-worker/workflow-source-manifest.json:23` chỉ theo dõi `js/website-display.js` trong nhóm này → phase này không dự kiến đổi `workflow-build.ts`; vẫn kiểm.
- Test hiện có: `tests-e2e/landing.spec.mjs:93-98` khoá danh sách href thẻ landing; `:368-375` kiểm `/chien-bao/`, `/bai-viet/` trong `.site-nav`, `#section-menu-items`, `.site-footer` (chỉ bản vi). Python: `tests/test_site_localization.py`, `tests/test_team_route_handles.py` (`python3 -m unittest`, `docs/deployment-guide.md:38`).
- Worktree `/Users/plateau/Project/worktrees/CamNangTQCCL-doi-cong-dong` (nhánh `feat/doi-cong-dong`) sạch, chậm 17 commit so với `main` (`e41a30a` là tổ tiên của `5b6014a`).

## File
- Sửa: `src/layouts/SiteLayout.astro` (thêm 1 entry vào `communityEntries` + cập nhật comment `:221-224`)
- Sửa: `src/components/landing/Landing.astro` (thêm 1 thẻ vào `communityCards`)
- Sửa: `css/styles.css` (`.landing-community-grid` 3 → 2 cột ở desktop, thành lưới 2×2)
- Sửa: `pipeline/site-localization-policy.json` (hash `sourceFiles` của 2 file; `baseline.notes` nếu `inventory` báo đổi)
- Sinh lại (do `publish`): `data/website-display.json`, thư mục generation mới dưới `src/data/recommended-reference/`, `src/data/recommended-reference/current.json` và các file publish khác mà lệnh `publish` ghi
- Sửa: `pipeline/team-route-handles.json` (`generationId`)
- Sửa test: `tests-e2e/landing.spec.mjs`

Không sửa: `js/community-auth.js` (menu tài khoản giữ nguyên), `src/lib/section-icons.ts`, bất kỳ file nào khác trong `sourceFiles`.

## Thiết kế
- Entry mới đặt giữa Chiến báo và Bài viết:
  `{label: pick(locale, 'Đội cộng đồng', '社区阵容'), href: localePath('/doi-cong-dong/', locale), description: pick(locale, 'Đội người chơi đăng, bình chọn và chiến báo', '玩家发布的阵容、投票与战报'), ariaCurrent: pathMark('/doi-cong-dong/'), icon: 'other'}`.
- Thẻ landing đặt sau thẻ Chiến báo: `{path: '/doi-cong-dong/', icon: 'other', title: t('Đội cộng đồng', '社区阵容'), desc: t('Người chơi đăng đội theo mùa, quản trị viên duyệt trước khi hiện; xem, bình chọn và gửi chiến báo cho từng đội.', '玩家按赛季发布阵容，经管理员审核后显示；可浏览、投票并为每支阵容提交战报。'), action: t('Xem đội cộng đồng', '查看社区阵容')}`. Thứ tự 4 thẻ: Chiến báo, Đội cộng đồng, Bài viết, Bình luận.
- Không liệt kê đội trên landing (Không làm).
- Chữ mới thuộc lớp nào do `inventory` quyết định; plan không tự gán obligation mới.

## Test-first matrix

| Lớp | Test | Đỏ trước khi code? | Lệnh |
|---|---|---|---|
| E2E landing vi | `landing.spec.mjs:94-98` thêm `'/doi-cong-dong/'` sau `'/chien-bao/'` | Đỏ | `npx playwright test tests-e2e/landing.spec.mjs` |
| E2E landing zh | Test mới: `/zh/` thẻ cộng đồng có `href="/zh/doi-cong-dong/"` đúng 1 lần | Đỏ | như trên |
| E2E menu vi | `landing.spec.mjs:368-375` thêm `'/doi-cong-dong/'` vào mảng href, kiểm đủ 3 scope | Đỏ | như trên |
| E2E menu zh | Test mới: `/zh/doi-chuan/` có `a[href="/zh/doi-cong-dong/"]` đúng 1 lần trong `.site-nav`, `#section-menu-items`, `.site-footer` | Đỏ | như trên |
| E2E aria-current | Test mới: trên `/doi-cong-dong/` link `.site-nav a[href="/doi-cong-dong/"]` có `aria-current="page"` | Đỏ | như trên |
| Gate localization | `site_localization check --stage public` exit 1 ngay sau khi sửa 2 file, exit 0 sau publish | Đỏ (cố ý) | xem Các bước 3, 9 |
| Python | `tests.test_site_localization`, `tests.test_team_route_handles` xanh sau publish | — | `python3 -m unittest tests.test_site_localization tests.test_team_route_handles` |

## Các bước
0. Trong worktree: `git -C /Users/plateau/Project/worktrees/CamNangTQCCL-doi-cong-dong merge --ff-only main` (ff thuần; lỗi → dừng và hỏi). Mọi lệnh sau chạy với `cwd` là worktree.
1. Viết các test e2e ở bảng trên; chạy `npx playwright test tests-e2e/landing.spec.mjs` → đỏ đúng các ca mới (webServer tự `npm run build`, build hiện xanh vì chưa sửa file ghim).
2. Sửa `SiteLayout.astro:227-242`, comment `:221-224`; sửa `Landing.astro:121-152`; sửa `css/styles.css:2791-2793` thành `repeat(2, minmax(0, 1fr))`.
3. `python3 -m pipeline.site_localization check --root . --stage public` → kỳ vọng exit 1 `reviewed source hash is stale` (xác nhận gate bắt đúng 2 file).
4. `python3 -m pipeline.site_localization inventory --root . --report .cache/l10n-inventory.json` → đọc báo cáo: (a) obligation mới/đổi fingerprint nằm ở file nào, lớp nào; (b) số `blocks`/digest so với `baseline.notes` (`pipeline/site-localization-policy.json:12-15`). Nếu có obligation lớp `translate` mới/đổi fingerprint → **dừng và hỏi** (cần receipt duyệt độc lập). Nếu chỉ `authored-vi` hoặc không có obligation mới → tiếp.
5. Ghim hash: `shasum -a 256 src/layouts/SiteLayout.astro src/components/landing/Landing.astro` → ghi vào `sourceFiles` (`:803`, `:811`); cập nhật `baseline.notes` đúng số `inventory` báo (chỉ khi đổi).
6. `python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate`
7. `python3 -m pipeline.site_localization check --root . --stage all --candidate .cache/site-localization-candidate` → exit 0.
8. `python3 -m pipeline.site_localization publish --root . --candidate .cache/site-localization-candidate`
9. `python3 -m pipeline.site_localization check --root . --stage public` → exit 0.
10. Re-pin: đặt `generationId` trong `pipeline/team-route-handles.json:2` bằng `recommendedPin.generationId` mới của `data/website-display.json`; `python3 -m pipeline.team_route_handles --check` → exit 0.
11. `npm --prefix mcp-worker run check:workflow-build` → exit 0 (nếu báo stale thì `npm --prefix mcp-worker run generate:workflow-build` và ghi vào commit, như `22e3ffd`).
12. `npm run build && npm run verify && npm run test:dist`, rồi `npx playwright test tests-e2e/landing.spec.mjs` → xanh.
13. `git status --short` chỉ gồm các file ở mục File + file publish sinh ra; nếu `publish` đổi baseline ngoài 2 file đã sửa (vd. digest obligation ở file khác) → **dừng và hỏi**.

## Verification
```bash
python3 -m pipeline.site_localization check --root . --stage public          # exit 0
python3 -m pipeline.team_route_handles --check                                # exit 0
python3 -m unittest tests.test_site_localization tests.test_team_route_handles
npm --prefix mcp-worker run check:workflow-build                              # exit 0
npm run build && npm run verify && npm run test:dist
npx playwright test tests-e2e/landing.spec.mjs
```
Kỳ vọng thêm: `grep -o 'href="/doi-cong-dong/"' dist/doi-chuan/index.html | wc -l` ≥ 3 (menu, chuyển nhanh, footer); `grep -o 'href="/zh/doi-cong-dong/"' dist/zh/index.html | wc -l` ≥ 2 (menu + thẻ landing).

## Rủi ro
- `inventory` báo obligation `translate` → cần receipt (dừng và hỏi). Khả năng thấp vì nhãn cộng đồng hiện không có obligation riêng, nhưng chưa kiểm thực nghiệm.
- Publish sinh generation Recommended mới (vài chục file JSON) → diff lớn nhưng cơ học; rollback = revert commit (Phase 4).
- Lưới 2×2 đổi bố cục khối Cộng đồng trên desktop; mobile không đổi.

## Rollback
Revert commit của phase (gồm policy + file publish + team-route-handles) là đủ; không có trạng thái remote.

## Checklist
- [x] Worktree ff lên `main`
- [x] Test e2e mới đỏ
- [x] Sửa `SiteLayout.astro`, `Landing.astro`, `css/styles.css`
- [x] `inventory` đọc xong, xác định lớp obligation (không `translate`)
- [x] Ghim hash + publish + check public + re-pin `team-route-handles.json`
- [x] `check:workflow-build`, build/verify/test:dist, e2e landing xanh
