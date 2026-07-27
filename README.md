# Cẩm Nang Team — Tam Quốc Chí Chiến Lược

## Tổng quan

Website tĩnh tra cứu đội hình, tướng, chiến pháp và hỗ trợ quản lý đội cho Tam Quốc Chí Chiến Lược. Astro tạo document shell và artifact `dist/`; behavior vẫn dùng CSS/vanilla ES modules, còn dữ liệu JSON được build trước bằng Python. Tính năng đọc ảnh gọi Cloudflare Worker triển khai riêng.

## Tính năng

- 10 section có deep-link bằng hash: Team PK, Đô Úy, Meta phe cũ, Cùng Tồn, Khai hoang, tướng, chiến pháp, tracker chiêu mộ, soi đội và gợi ý đội từ kho.
- Ba tab team dùng chung bộ lọc inline: search toàn văn + chip động theo dữ liệu từng tab; mobile thu gọn vùng lọc sau nút `☰ Bộ lọc`.
- Tra cứu 112 tướng và 239 chiến pháp bằng dữ liệu local, hỗ trợ tên Việt/Hán-Việt/Hán.
- Tracker chiêu mộ lưu nhiều account, pity và lịch sử trong `localStorage`; có xuất/nhập JSON.
- Soi screenshot qua Worker + DashScope Qwen; frontend map kết quả và đối chiếu 214 team local.
- Gợi ý portfolio tối đa 5 team bằng engine local. AI chỉ trích xuất dữ liệu từ ảnh, không chọn team.

Snapshot dữ liệu kiểm tra ngày 2026-07-11:

| Dữ liệu | Quy mô |
|---|---:|
| Team | 214 = 56 Team PK + 48 Đô Úy + 110 Meta phe cũ |
| Tier | 57 team, 65 bản xếp hạng nguồn |
| Cùng Tồn | 5 nhóm, 25 team |
| Khai hoang | 11 team, 5 mỏ |
| Tướng / chiến pháp / binh thư map | 112 / 239 / 66 |

## Chạy local

Yêu cầu Node `22.16.0` (xem `.node-version`), npm và trình duyệt hiện đại:

```bash
npm ci
npm run dev
```

Mở URL Astro in ra terminal. Để kiểm tra đúng artifact sẽ publish:

```bash
npm run build
npm run preview
```

## Kiểm thử

```bash
npm run check
npm run build
npm run test:dist
npm run verify
npm run test:e2e
npm run test:node
python3 -m unittest discover -s tests
(cd worker && npm ci && npm test && npm run typecheck)
```

Playwright cần Chromium cài một lần bằng `npx playwright install chromium`.

## Rebuild dữ liệu

Các lệnh hiện có:

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
python3 -m pipeline.build_books_dict
python3 -m pipeline.build_team_tier
```

Không chạy máy móc trên dữ liệu đang dùng: `build_json.py` vẫn kiểm tra bộ count cũ `50 + 12 + 110`, trong khi artifact commit hiện có 56 + 48 + 110 và phần Đô Úy đã được bổ sung ngoài đường build nhìn thấy. `pipeline/do-uy-ss18-source.json` có 40 mục nhưng chưa có consumer Python hiển thị. Clone sạch thường cũng thiếu HTML nguồn và cache crawl bị ignore. Trước khi rebuild: backup `data/`, bảo đảm đủ nguồn, chạy từng bước, rồi review toàn bộ diff và test.

## Deploy

- Site production hiện tại: `https://tqccl.pages.dev`. Contract cho lần release được ủy quyền tiếp theo: repository root, `npm run build`, output `dist/`; settings thật phải được kiểm tra trước promotion.
- `public/_headers` được Astro đưa vào `dist/_headers`; shared verifier yêu cầu byte parity và cache revalidation cho shell/JS/CSS/JSON.
- Vision proxy: Worker tại `https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev`, deploy riêng từ `worker/`.
- `js/config.js` chứa Worker URL và Turnstile site key công khai đang hoạt động. Secret chỉ nằm trong môi trường Worker.
- Preview/promotion/rollback là quy trình có ủy quyền riêng; build local không tạo deployment.

Xem [Deployment Guide](docs/deployment-guide.md) và bản ghi triển khai có ngày tại [Deployment Record](docs/deployment.md).

## Cấu trúc

```text
src/pages/index.astro   # document shell Astro
src/lib/, src/pages/   # manifest + static endpoints byte-exact
css/, js/, data/       # source runtime canonical
public/_headers        # Pages deployment-control source
scripts/               # shared dist verifier
pipeline/              # build/normalize dữ liệu bằng Python stdlib
worker/                # Cloudflare Worker TypeScript, deploy riêng
tests/, tests-js/, tests-e2e/
docs/                  # tài liệu evergreen
plans/                 # kế hoạch/báo cáo lịch sử, không phải runtime truth
```

## Tài liệu

- [Tổng quan và PDR](docs/project-overview-pdr.md)
- [Tóm tắt codebase](docs/codebase-summary.md)
- [Chuẩn code](docs/code-standards.md)
- [Kiến trúc](docs/system-architecture.md)
- [Roadmap](docs/project-roadmap.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Design Guidelines](docs/design-guidelines.md)

## Ghi chú vận hành

- `data/facets.json` không được frontend load; các tab team tự tính facet runtime. File hiện phản ánh 213 team, lệch 1 so với `teams.json`.
- `data/tactics-generic.json` có 29 nguồn bổ sung; 27 record đang mang trạng thái `pending` sau merge vào `tactics.json`.
- Tracker và scan state lưu local. Scan state loại bỏ ảnh, base64, blob và Turnstile token; ảnh chỉ giữ trong bộ nhớ của phiên UI.
- Ảnh soi đội được gửi tới Alibaba Cloud DashScope; nên crop thông tin tài khoản trước khi dùng.

## Tham chiếu

Nguồn truth kỹ thuật: code và JSON commit hiện tại. Tài liệu trong `plans/` chỉ dùng làm lịch sử quyết định.
