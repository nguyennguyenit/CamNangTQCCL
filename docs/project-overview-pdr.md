# Tổng quan sản phẩm và PDR

## Tổng quan

`Cẩm Nang Team` là ứng dụng web tĩnh hỗ trợ người chơi Tam Quốc Chí Chiến Lược tra cứu đội hình và tự quản lý dữ liệu cá nhân. JSON đã build cho phép phần tra cứu chạy không cần backend ứng dụng; Cloudflare Worker chỉ phục vụ các luồng đọc screenshot.

## Bối cảnh và mục tiêu

- Tra cứu nhanh team, tướng, chiến pháp, Cùng Tồn và khai hoang.
- Lọc/search trên dữ liệu curate đã commit, dùng tốt trên mobile.
- Theo dõi chiêu mộ và kho scan theo hướng local-first.
- Dùng Vision để đọc ảnh, nhưng giữ quyết định gợi ý team ở engine local minh bạch hơn.
- Duy trì kiến trúc nhỏ: Astro static shell + SPA vanilla + pipeline offline + Worker tùy chọn.

Người dùng chính: người chơi tra meta; người quản lý nhiều account; maintainer cập nhật export HTML, bảng map và tier.

## Phạm vi hiện tại

| Khối | Phạm vi |
|---|---|
| Static SPA | `src/pages/index.astro` build ra `dist/index.html`; root `css/*.css`, `js/*.js`, 9 section hash-addressed |
| Runtime data | `data/*.json`, commit và publish cùng site |
| Public artifact | Astro static endpoints theo manifest; `public/_headers` là cache deployment-control |
| Build-time | `pipeline/*.py`, Python stdlib, nguồn HTML/cache local |
| Vision | `worker/`, Cloudflare Worker + KV + Turnstile + DashScope Qwen |
| Local state | theme, tracker chiêu mộ, roster scan đã chuẩn hóa |

Ngoài phạm vi: backend chung, database server, cloud sync tracker, AI tự quyết đội, bundler/framework frontend.

## Yêu cầu chức năng

| ID | Yêu cầu |
|---|---|
| FR-01 | Điều hướng 9 section bằng tab và hash URL. |
| FR-02 | Render 56 Team PK và 110 Meta phe cũ theo tab nguồn; không công khai team Đô Úy. |
| FR-03 | Hai tab team dùng chung search toàn văn và chip facet tính động trong phạm vi tab. |
| FR-04 | Trên mobile, menu section và vùng lọc team có thể thu gọn; không phụ thuộc hover. |
| FR-05 | Render 5 nhóm/25 team Cùng Tồn và 11 team/5 mỏ khai hoang từ JSON local. |
| FR-06 | Tra cứu 112 tướng và mở chi tiết stats, thích tính, chiến pháp liên quan. |
| FR-07 | Tra cứu 239 chiến pháp bằng search Việt bỏ dấu, Hán-Việt và Hán. |
| FR-08 | Hiển thị tier tốt nhất và mọi nguồn xếp hạng cho team khi có dữ liệu tier. |
| FR-09 | Tracker hỗ trợ nhiều account, 4 slot Danh tướng PK/ngày, banner hạn giờ, pity 30, lịch sử 5★ và import/export JSON. |
| FR-10 | Soi đội nhận ảnh, xác thực Turnstile, gọi Worker, map kết quả về canonical Việt và tìm team local tương tự. |
| FR-11 | Scan tướng, chiến pháp và team đã build; người dùng review trước khi gợi ý. |
| FR-12 | Engine local chọn portfolio tối đa 5 team, xét tướng/chiến pháp/tier và team đã khóa. |
| FR-13 | Pipeline có lệnh build team/facet/Cùng Tồn/khai hoang, từ điển, binh thư và tier. |

## Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-01 | Astro tạo static shell/artifact; behavior frontend dùng vanilla ES modules, không có SSR/UI renderer. |
| NFR-02 | Dữ liệu tra cứu cốt lõi hoạt động từ static host sau lần tải JSON. |
| NFR-03 | Secret chỉ tồn tại trong Worker env; frontend chỉ chứa config công khai. |
| NFR-04 | Worker kiểm tra origin khi có, Turnstile/replay, magic byte/MIME/kích thước và quota KV best-effort trước khi gọi model. |
| NFR-05 | Ảnh không ghi vào localStorage; Worker không chủ động lưu ảnh hoặc log nội dung ảnh. |
| NFR-06 | Logic filter/map/store/engine có test độc lập; pipeline fail-loud tại các invariant đã định nghĩa. |
| NFR-07 | UI responsive, có nhãn/alt/ARIA cơ bản và theme sáng/tối lưu local. |
| NFR-08 | Tài liệu evergreen bám code/data hiện tại; `plans/` chỉ là lịch sử. |

## Dữ liệu chấp nhận

Snapshot công khai 2026-08-25:

- 166 team: 56 `team-intro`, 110 `moi-phe`; 48 team `do-uy` từng công khai đã được retire khỏi website, public artifact và Research MCP.
- 31 team có tier, tổng 39 rankings; 112 tướng; 239 chiến pháp; 66 map binh thư.
- 5 nhóm/25 team Cùng Tồn; 11 team/5 mỏ khai hoang.
- `facets.json` đang có tổng source 165, lệch 1 so với `teams.json`; frontend không load file này.

## Tiêu chí chấp nhận

| ID | Tiêu chí |
|---|---|
| AC-01 | `npm run build` tạo `dist/`; preview HTTP tải dữ liệu và mở được cả 9 hash section. |
| AC-02 | Hai tab team render đúng source và filter không rò dữ liệu giữa tab. |
| AC-03 | Tracker/scan state round-trip hợp lệ; không serialize ảnh, base64, blob hoặc token. |
| AC-04 | Vision request hợp lệ đi qua Worker; lỗi origin, token, ảnh, quota và model được trả an toàn. |
| AC-05 | Gợi ý team do local engine tạo sau bước review, không lấy quyết định portfolio từ model. |
| AC-06 | Các lệnh test Python, JS, Worker và Worker typecheck pass trước deploy. |
| AC-07 | Rebuild data chỉ được chấp nhận sau khi review diff, xác nhận nguồn và xử lý drift count hiện có. |
| AC-08 | Shared verifier chấp nhận đúng shell/raw assets/`_headers`, từ chối private output và giữ byte parity. |

## Rủi ro và giới hạn

- `build_json.py` cố ý loại `Team Đô Úy.html` và hiện chỉ dựng `50 + 110`; artifact công khai có `56 + 110`, nên chạy thẳng vẫn có thể ghi đè sáu Team PK bổ sung.
- 48 team Đô Úy từng công khai đã được retire; `pipeline/do-uy-ss18-source.json` vẫn giữ 40 record nguồn thô làm archive và không tham gia build/publication.
- HTML nguồn và raw crawl cache bị ignore; clone sạch không bảo đảm rebuild đầy đủ.
- KV không atomic, nên quota Worker là best-effort. Request không có header `Origin` vẫn được chấp nhận; Turnstile là rào chính ngoài browser.
- Phụ thuộc dịch vụ ngoài: Cloudflare, Turnstile và Alibaba DashScope.
- Accessibility còn thiếu tab semantics hoàn chỉnh, focus management dialog, drop-zone keyboard và live-region nhất quán.

## Bước tiếp theo

Ưu tiên khôi phục đường rebuild xác định, sửa drift facet/count, rồi hoàn thiện accessibility và privacy/security vận hành. Chi tiết ở [Project Roadmap](project-roadmap.md).

## Tham chiếu

- [Kiến trúc hệ thống](system-architecture.md)
- [Tóm tắt codebase](codebase-summary.md)
- [Deployment Guide](deployment-guide.md)
- [Design Guidelines](design-guidelines.md)
