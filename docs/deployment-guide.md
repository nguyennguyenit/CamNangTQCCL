# Hướng dẫn triển khai

## Tổng quan

Deploy tách hai surface: static site trên Cloudflare Pages và Vision proxy trên Cloudflare Workers. Pipeline dữ liệu chạy local trước deploy, không chạy trên Pages. Bản này là hướng dẫn evergreen; phiên bản/commit/URL preview theo thời điểm nằm ở [Deployment Record](deployment.md).

## Prerequisite

- Python 3 để preview, pipeline và test.
- Node.js/npm để test/deploy Worker.
- Cloudflare account, Wrangler login, Pages project, Worker và Turnstile widget.
- Alibaba DashScope/Qwen API key phù hợp region/model.
- Khi rebuild: HTML export đúng tên trong `Meta Team PK/`; raw crawl cache hoặc quyền/network để recrawl.

## Preview và test local

```bash
python3 -m http.server 8000
```

Mở `http://localhost:8000`, không dùng `file://`.

Full verification:

```bash
python3 -m unittest discover -s tests
node --test "tests-js/*.test.mjs"
cd worker
npm install
npm test
npm run typecheck
```

Snapshot 2026-07-11: Python 80, JS 82, Worker 53 pass; Worker typecheck pass. Đây là snapshot, không phải count acceptance cố định.

## Rebuild dữ liệu có kiểm soát

Các lệnh dự án:

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
python3 -m pipeline.build_books_dict
python3 -m pipeline.build_team_tier
```

Curate tier từ HTML xếp hạng tải tay:

```bash
python3 -m pipeline.suggest_team_tier path/to/saved-tier-list.html
```

`suggest_team_tier` chỉ in gợi ý; maintainer review rồi cập nhật `pipeline/team-tier-map.json` trước khi chạy builder tier.

### Cảnh báo bắt buộc

Không chạy `pipeline.build_json` trực tiếp trên artifact production mà chưa backup. Code đang assert 50 Team PK + 12 Đô Úy + 110 meta cũ, trong khi `data/teams.json` commit có 56 + 48 + 110. Snapshot Đô Úy hiện gồm augmentation không có consumer Python nhìn thấy; `do-uy-ss18-source.json` có 40 record. `facets.json` cũng đang lệch một team. Một clone sạch thường thiếu HTML nguồn và raw crawl cache vì chúng bị ignore.

Quy trình an toàn:

1. Copy/backup `data/` ngoài worktree hoặc tạo branch/worktree riêng.
2. Xác nhận HTML/cache/map nguồn đủ và expected count đã phản ánh đường build thực.
3. Chạy từng builder; không dùng `--recrawl` nếu chưa chấp nhận network/source drift.
4. So sánh schema, count, ID, source distribution và nội dung diff; không chỉ nhìn test pass.
5. Chạy full gate; chỉ commit artifact sau review.

## Static Pages

Production origin hiện tại: `https://tqccl.pages.dev`.

Publish đúng:

```text
index.html
css/
js/
data/
```

Không publish `Meta Team PK/`, crawl cache, `.dev.vars`, `pipeline/`, `worker/`, tests hoặc plans. Pages không build JSON và không deploy Worker.

Trước deploy:

- review diff static/data;
- xác nhận `js/config.js` trỏ đúng Worker URL và Turnstile public site key;
- chạy HTTP preview và full gate;
- xác nhận `worker/wrangler.toml` `ALLOWED_ORIGIN` khớp exact Pages origin.

## Cloudflare Worker

### Setup lần đầu

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create RL
```

Gắn namespace ID vào `[[kv_namespaces]]` trong `wrangler.toml`. Dev local:

```bash
cp .dev.vars.example .dev.vars
npm run dev
```

`.dev.vars` không được commit.

### Public vars và bindings

Commit trong `worker/wrangler.toml`:

- `ALLOWED_ORIGIN`: exact production origin.
- `REGION`, `MODEL_ID`, tùy chọn `MODEL_ENDPOINT`.
- `FEATURE_ENABLED` kill-switch.
- `RL_PER_HOUR`, `DAILY_CAP`, `MONTHLY_CAP`, `MAX_IMAGE_BYTES`.
- KV binding `RL` và namespace ID.

Frontend public config trong `js/config.js`:

- `workerUrl`.
- `turnstileSiteKey`.
- client image compression settings.

Các giá trị này công khai, không phải secret.

### Secrets

```bash
cd worker
npx wrangler secret put QWEN_API_KEY
npx wrangler secret put TURNSTILE_SECRET
```

Không commit API key, Turnstile secret, token, `.dev.vars` hoặc credential Cloudflare.

### Deploy

```bash
cd worker
npm test
npm run typecheck
npm run deploy
```

Config hiện dùng region `intl`, model `qwen3.7-plus`, endpoint DashScope Model Studio theo region. Chỉ đặt `MODEL_ENDPOINT` khi chủ đích đổi endpoint/provider; không dùng Coding Plan endpoint cho Vision.

## Verification sau deploy

Preflight:

```bash
curl -i -X OPTIONS \
  https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze \
  -H 'Origin: https://tqccl.pages.dev'
```

Kỳ vọng `204` và `access-control-allow-origin: https://tqccl.pages.dev`.

Smoke checklist:

1. Mở production, chuyển đủ 10 hash section và kiểm tra JSON/network không lỗi.
2. Kiểm tra ba tab team hiển thị 56/48/110 và filter mobile collapse.
3. Test tra cứu, theme, tracker export/import bằng dữ liệu không nhạy cảm.
4. Upload screenshot đã crop; xác nhận Turnstile, analyze và map/team match.
5. Test scan/review/recommend; reload và xác nhận state không chứa ảnh/token.
6. Kiểm tra origin lạ có header bị 403 và lỗi không leak upstream detail.

Lưu ý: request không có `Origin` vẫn qua app guard; CORS không phải auth. KV rate/day/month cap là best-effort do eventual consistency.

## Rollback

### Static Pages

Chọn deployment known-good trong Cloudflare Pages deployment history và rollback/promote. Sau rollback, kiểm tra `js/config.js` còn tương thích Worker và data schema.

### Worker

Dùng Cloudflare dashboard rollback về version known-good hoặc checkout commit known-good rồi chạy full Worker gate và `npm run deploy`. Khi sự cố đang hoạt động, đặt `FEATURE_ENABLED="false"` và deploy để kill-switch trước khi điều tra.

### Data

Khôi phục trọn bộ `data/` từ commit/backup known-good; không mix artifact sinh từ các lần build khác nhau. Re-run static smoke test.

## Bước tiếp theo

Sau mỗi deploy, cập nhật facts có ngày/version trong [Deployment Record](deployment.md), không đóng băng chúng trong guide evergreen.

## Tham chiếu

- [Deployment Record](deployment.md)
- [Worker README](../worker/README.md)
- [System Architecture](system-architecture.md)
- [Code Standards](code-standards.md)
