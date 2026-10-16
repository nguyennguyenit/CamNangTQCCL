---
phase: 2
title: "SSR trang đội và trang danh sách (#6)"
status: completed
depends_on: [1]
---

# Phase 2 — SSR trang đội và danh sách

## Mục tiêu
- 3098 trang chi tiết (`doi-chuan`, `doi-khac`, `khai-hoang` ×2 locale) có thân đầy đủ trong HTML tĩnh; không còn "Đang tải chi tiết…" và `<noscript>` "cần JavaScript" (`RecommendedDetail.astro:99-105`, `LegacyDetail.astro:56-62`, `KhaiHoangDetail.astro:55-61`).
- `/doi-chuan/`, `/doi-khac/`, `/cung-ton/`, `/khai-hoang/` (vi + zh) có nội dung mùa/kịch bản mặc định trong `#section-*`: mỗi đội 3 tướng + link chi tiết; bỏ noscript `SiteLayout.astro:572` (thông báo `:160-163`) cho 4 mục này.
- Link sang tra cứu tạm giữ dạng `?id=` (đổi ở Phase 4).

## Thiết kế
- Build: `src/lib/team-detail-pages.ts` đã có record/lookup links → gọi builder Phase 1 + `treeToHtml`, đưa vào component bằng `set:html`.
- Danh sách: hàm chọn mặc định dùng chung với client (import từ module hiện có; nếu đang phụ thuộc `window`/URL thì tách phần thuần ra). Không chép logic.
- Client chi tiết (`js/team-detail.js`, `js/khaihoang-detail.js`): thân đã dựng sẵn → không fetch/dựng lại; chỉ gắn tương tác. Nếu phần nào của thân phụ thuộc dữ liệu runtime không có lúc build, ghi rõ và giữ phần đó client-side.
- Client danh sách (`js/app.js` + `team-filter-section.js`): trạng thái URL = mặc định → giữ DOM dựng sẵn (gắn sự kiện); khác mặc định → thay như cũ. Không nháy, không nhân đôi.
- `verify-astro-dist.mjs`: giữ ràng buộc hiện có (pins, `team-detail.js`, không `app.js` ở chi tiết, title duy nhất); thêm kiểm "trang chi tiết có thân dựng sẵn" và "trang mục có nội dung đội" nếu cần cho Done-means.

## TDD
### 3.T
- `tests-js/astro-dist-contract.test.mjs` / verifier: thêm ca **đỏ** — với dist thật: trang chi tiết mẫu mỗi họ (vi + zh) chứa tên tướng/chiến pháp/binh thư lấy từ data của chính đội; không có "cần JavaScript"/"Đang tải chi tiết"; 4 trang mục chứa link chi tiết + tên tướng của ≥1 đội mặc định.
- e2e: context `javaScriptEnabled: false` mở 1 trang chi tiết mỗi họ + 4 trang mục → thấy nội dung (đỏ trước khi sửa). Cập nhật test noscript h1 hiện có (`ReviewAstroCss#12`) theo hành vi mới: vẫn đúng 1 `h1` khi có/không JS.
- e2e hiện có cho lọc/đổi mùa/chi tiết/focus/Back: phải xanh trước và sau.

### 3.I / 3.V
Sửa, rồi: `npm run build`, `verify`, `test:dist`, `test:node`, e2e toàn bộ; localization `check --stage public`; đo kích thước HTML (trang mục, trang chi tiết lớn nhất) ghi vào `reports/phase-02.md`.

## Xong khi
- [x] `curl`-tương đương (đọc file dist) trang chi tiết thấy đủ tướng/chiến pháp/binh thư; không còn câu chờ JS.
- [x] 4 trang mục ×2 có đội mặc định kèm 3 tướng + link.
- [x] Hành vi client giữ nguyên (e2e xanh).
- [x] `reports/phase-02.md`.
