# Cộng đồng, song ngữ Việt–Trung, blog, redesign Landing

Ngày: 2026-09-27. Quyết định đã chốt với người dùng:

| Chủ đề | Quyết định |
|---|---|
| Backend | Cloudflare Worker mới `community-worker/` (Hono) + D1 + R2 |
| Đăng nhập | Better Auth, provider Google |
| Blog | Admin viết Markdown trên web → lưu D1 → nút Xuất bản gửi GitHub `repository_dispatch` → workflow `pages-deploy.yml` build lại HTML tĩnh (Pages là direct upload, không có Deploy hook) |
| Tiếng Trung | Toàn bộ site nhân bản dưới `/zh/`; vi và zh tách rời, không trộn |
| Donate | Chỉ ảnh QR: `public/donate-qr.png` (người dùng cung cấp file) |
| Chiến báo | Ảnh → Qwen Vision trích đội hình/kết quả → người dùng xác nhận → admin duyệt → thống kê trên trang build |
| Nguồn | Không nhắc SGSDeck trên Đội chuẩn/chi tiết đội; ghi chung "tổng hợp từ các website và diễn đàn game thủ Trung Quốc" |

## Kiến trúc

```text
Browser (tqccl.pages.dev, /… và /zh/…)
  ├── static HTML/JS/JSON (Astro static, như cũ)
  └── fetch same-origin /api/*  ──►  Pages Function functions/api/[[path]].ts
                                        │ service binding COMMUNITY (fallback env COMMUNITY_API_ORIGIN)
                                        ▼
                                  community-worker (Hono)
                                   ├── Better Auth /api/auth/* (Google) ─ D1
                                   ├── comments / reports / posts ─ D1
                                   ├── ảnh chiến báo, ảnh bài viết ─ R2
                                   ├── Qwen Vision (DashScope) cho phân tích chiến báo
                                   └── publish bài → GitHub repository_dispatch → pages-deploy.yml
Astro build ──GET {COMMUNITY_API_ORIGIN}/api/posts──► HTML tĩnh /bai-viet/<slug>/ (+ /zh/)
```

Proxy same-origin để cookie phiên Better Auth là first-party (Safari/Chrome chặn cookie bên thứ ba giữa `pages.dev` và `workers.dev`).

## Hợp đồng dùng chung

### i18n (`js/i18n.js`, đã có)

- `currentLocale()` đọc `<html lang>`; `L(vi, zh)` chọn chuỗi; `pick(locale, vi, zh)` cho Astro; `localePath(path, locale)` thêm/bỏ tiền tố `/zh`; `stripLocale`, `localeFromPath`, `formatNumber`, `formatDate`.
- Mọi chuỗi UI mới phải qua `L()`/`pick()`; không bao giờ hiển thị hai ngôn ngữ cạnh nhau.
- `<html lang="vi">` cho bản Việt, `<html lang="zh-Hans">` cho bản Trung.
- Ở bản zh, tên tướng/chiến pháp/binh thư/đội dùng chữ Hán gốc từ dữ liệu nguồn (raw), không dùng bản dịch Việt.
- Link nội bộ dựng trong JS phải đi qua `localePath()`.

### Page key

`pageKey` = pathname canonical **không có tiền tố locale**, ví dụ `/doi-chuan/s18-abc/`. Regex hợp lệ:
`^/(doi-chuan|doi-khac|khai-hoang)/[a-z0-9][a-z0-9-]{0,120}/$`. Comment và chiến báo của bản vi và zh dùng chung pageKey nhưng mỗi mục mang `lang` (`vi`|`zh`); UI chỉ hiện mục cùng `lang` với trang (không trộn). Thống kê chiến báo (tỉ lệ thắng) tính trên mọi ngôn ngữ vì là số liệu.

### API (`/api`, JSON, lỗi `{error:{code,message}}`)

Auth (Better Auth, base `/api/auth`): client dùng fetch thuần, không SDK.
- `POST /api/auth/sign-in/social` `{provider:"google", callbackURL}` → `{url, redirect:true}`; browser điều hướng `url`.
- `POST /api/auth/sign-out`.
- `GET /api/me` → `{user: {id, name, image, isAdmin} | null}`. Admin = email thuộc `ADMIN_EMAILS` (var, phân tách dấu phẩy).

Comments:
- `GET /api/comments?page=<pageKey>&lang=vi|zh&cursor=<opaque>` → `{items:[{id, body, lang, createdAt, author:{id,name,image}, canDelete}], nextCursor|null}` (mới nhất trước, 20/trang).
- `POST /api/comments` `{page, lang, body}` (đăng nhập; 1–2000 ký tự; rate limit 10/giờ/user) → comment.
- `DELETE /api/comments/:id` (tác giả hoặc admin) → `{ok:true}`.

Chiến báo:
- `POST /api/reports/analyze` multipart `image` (đăng nhập; JPEG/PNG/WebP ≤ 1.5MB; 20 lần/ngày/user) → `{uploadId, analysis:{result:"win"|"loss"|"draw"|null, ally:{heroes:[string]}, enemy:{heroes:[string]}, battleType:string|null, notes:string|null}}` (tên tướng chữ Hán như ảnh). Ảnh lưu R2 `pending/<uploadId>`.
- `POST /api/reports` `{page, lang, uploadId, result, allyHeroes[], enemyHeroes[], note?, season?}` → `{id, status:"pending"}`.
- `GET /api/reports?page=&lang=&cursor=` → chỉ `approved`: `{items:[{id, result, allyHeroes, enemyHeroes, note, season, lang, imageUrl, createdAt, author:{id,name,image}}], nextCursor}`.
- `GET /api/reports/stats?page=` → `{total, wins, losses, draws, winRate|null, topOpponents:[{heroes:[string], count, wins}]}` (approved, mọi lang).
- `GET /api/reports/:id/image` → bytes (approved hoặc chủ/admin).
- `GET /api/me/reports` → báo cáo của tôi kèm `status` (`pending|approved|rejected`) và `rejectReason`.
- Admin: `GET /api/admin/reports?status=pending&cursor=`, `POST /api/admin/reports/:id/approve`, `POST /api/admin/reports/:id/reject` `{reason}`.

Bài viết:
- Trường: `id, slug, lang (vi|zh), translationKey|null, title, description, bodyMarkdown, faq:[{q,a}], tags:[string], coverImage|null, status (draft|published), author:{name}, publishedAt|null, updatedAt, createdAt`.
- Công khai (build dùng): `GET /api/posts` → `{items:[post đã publish, đủ body]}`; `GET /api/posts/:lang/:slug`.
- Admin: `GET /api/admin/posts`, `POST /api/admin/posts`, `PUT /api/admin/posts/:id`, `DELETE /api/admin/posts/:id`, `POST /api/admin/posts/:id/publish`, `POST /api/admin/posts/:id/unpublish` (cả hai gọi deploy hook), `POST /api/admin/uploads` multipart → `{url:"/api/media/<key>"}`; `GET /api/media/:key`.
- Slug: `^[a-z0-9][a-z0-9-]{0,100}$`, duy nhất theo `(lang, slug)`.

### Route mới (bản vi; bản zh thêm `/zh`)

| Route | Owner |
|---|---|
| `/chien-bao/` — kho chiến báo đã duyệt + "chiến báo của tôi" | frontend cộng đồng |
| `/quan-tri/` — duyệt chiến báo, xoá comment, editor bài viết (noindex) | frontend cộng đồng |
| `/bai-viet/`, `/bai-viet/<slug>/`, `/rss.xml`, `/llms.txt` | blog |

JS mới đặt phẳng trong `js/` (manifest cấm thư mục con), tiền tố `community-*.js` / `blog-*.js`.
