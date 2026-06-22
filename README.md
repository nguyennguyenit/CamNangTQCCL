# Cẩm Nang Team - Tam Quốc Chí Chiến Lược

Website tĩnh tra cứu meta team cho Tam Quốc Chí Chiến Lược. Chạy bằng HTML/CSS/vanilla JS, không bundler, không framework.

## Có gì

- `Team PK`: 172 team, lọc theo loại binh / sao / trạng thái / phe / tướng / chiến pháp / binh thư, có search toàn văn.
- `Cùng Tồn`: nhóm team cùng tồn tại, kèm `Thêm` và `Kỹ năng quân sư`.
- `Khai hoang`: đội khai hoang và quân thủ các mỏ.
- `Tra cứu chiến pháp`: 237 chiến pháp + 112 tướng, search fuzzy, chạy offline, không AI.
- `Soi đội từ ảnh`: upload screenshot, đọc bằng Worker + Vision LLM, map về tên Việt canonical rồi đối chiếu với 172 team.

## Chạy local

Frontend dùng `fetch()` JSON nên phải chạy qua HTTP server.

```bash
python3 -m http.server 8000
```

Mở `http://localhost:8000`.

Nếu cần rebuild dữ liệu từ HTML nguồn, phải có folder `Meta Team PK/` ở root repo.

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
```

## Test

```bash
python3 -m unittest discover -s tests
node --test tests-js/filters.test.mjs tests-js/match-dict.test.mjs tests-js/analyze-map.test.mjs
cd worker && npm test
cd worker && npm run typecheck
```

## Deploy

- Site tĩnh: `.github/workflows/deploy.yml` copy `index.html`, `css/`, `js/`, `data/` lên GitHub Pages.
- Worker soi đội: deploy riêng trong `worker/` bằng Wrangler.

## Cấu trúc chính

- `index.html`, `css/styles.css`, `js/*.js`: frontend tĩnh.
- `data/*.json`: dữ liệu đã build, commit sẵn.
- `pipeline/*.py`: build dữ liệu từ HTML nguồn.
- `worker/`: proxy Cloudflare cho ảnh soi đội.
- `tests/`, `tests-js/`: test Python, JS, Worker.

## Tài liệu

- [Tổng quan + PDR](docs/project-overview-pdr.md)
- [Tóm tắt codebase](docs/codebase-summary.md)
- [Chuẩn code](docs/code-standards.md)
- [Kiến trúc hệ thống](docs/system-architecture.md)
- [Roadmap](docs/project-roadmap.md)
- [Deploy](docs/deployment-guide.md)
- [Design](docs/design-guidelines.md)

## Ghi chú

- `js/config.js` đang để placeholder cho `workerUrl` và `turnstileSiteKey`, nên tab `Soi đội từ ảnh` chưa hoạt động cho tới khi cấu hình thật.
- `data/tactics-generic.json` có 28 chiến pháp generic chờ ghép mô tả.
- Nguồn HTML `Meta Team PK/` và cache crawl không commit, nên clone repo không tự rebuild được nếu thiếu export local.
- `Meta mỗi phe (cũ)` được gắn nhãn `Cũ`.
