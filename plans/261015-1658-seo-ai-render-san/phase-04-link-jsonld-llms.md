---
phase: 4
title: "Link path, JSON-LD, llms, báo cáo zh"
status: done
depends_on: [3]
---

# Phase 4 — Link path, JSON-LD, llms, báo cáo zh

## Mục tiêu
1. **Link path:** `lookupHref` (`js/recommended-reference-render.js:152`) và mọi chỗ trang đội dựng link tra cứu dùng `/tra-cuu/<nhóm>/<slug>/` từ ledger; dist trang đội không còn `?id=`. `?id=` trên trang nhóm vẫn mở dialog. Sửa `docs/design-guidelines.md:109`.
2. **JSON-LD** (mẫu `src/lib/blog-seo.ts:96-171`):
   - Trang chi tiết đội: kiểu phù hợp (vd `WebPage`/`Article` + `about` các tướng có `url` trang mục) + `BreadcrumbList` + `isPartOf` `VideoGame` "三国志·战略版".
   - Trang mục: tướng `Thing`; chiến pháp/binh thư/quân sư `DefinedTerm` + `inDefinedTermSet` (`DefinedTermSet` của nhóm); trang bị/công trình/cải tạo `Thing`. `name`, `alternateName` (chữ Hán), `description`, `url`, `image` (tướng có `iconUrl`, nâng `https`; thiếu thì bỏ), `BreadcrumbList` (Tra cứu → Nhóm → Mục), `isPartOf` `VideoGame`.
   - Trang nhóm: `CollectionPage` + `ItemList`, mỗi phần tử có `url` trang mục.
   - JSON-LD chỉ phản ánh nội dung có trong HTML.
3. **llms:**
   - Một hàm sinh (`src/lib/llms-documents.ts` hoặc mở rộng `blog-seo.ts`): `treeToText` (cây view → chữ thuần) trên cùng các cây Phase 1–3.
   - `/llms.txt`: giữ nội dung hiện có, thêm 7 nhóm tra cứu và link tới từng `/llms/<mục>.txt`.
   - File con: `/llms/doi-chuan.txt` (tách `/llms/doi-chuan/<mùa>.txt` nếu > ~300 KB), `/llms/doi-khac.txt`, `/llms/cung-ton.txt`, `/llms/khai-hoang.txt`, `/llms/tra-cuu/<nhóm>.txt` ×7. Mỗi dòng có URL trang riêng (đội: trang chi tiết; cung-ton: trang mục `/cung-ton/` + tham số nhóm hiện có nếu không có trang riêng).
   - `/llms-full.txt` = nối các file con theo thứ tự cố định.
   - Allowlist `verify-astro-dist.mjs` lấy danh sách file từ cùng hàm.
4. **Báo cáo zh:** script `scripts/report-zh-gaps.mjs` (hoặc pipeline Python nếu hợp convention) quét `lookupProfile(...).viOnly` trên toàn corpus → `plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md` (nhóm, id, tên, trường thiếu).

## TDD
- Đỏ trước: dist contract — trang đội không chứa `?id=` tới tra cứu; mọi JSON-LD parse được và có trường bắt buộc; mọi `ItemList.url` có file dist tương ứng; `/llms-full.txt` = nối file con; chứa mọi đội chuẩn (1366 URL) và 886 URL trang mục; `llms.txt` link tới mọi file con tồn tại.
- e2e: link chiến pháp trên trang chi tiết đội dẫn tới trang mục; `?id=` cũ trên trang nhóm mở dialog.

## Xong khi
- [x] Không còn `?id=` trong trang đội; e2e xanh.
- [x] JSON-LD hợp lệ trên 3 loại trang.
- [x] `llms.txt`, file con, `llms-full.txt` đúng hợp đồng; ghi kích thước vào `reports/phase-04.md`.
- [x] `reports/zh-gaps.md`.
