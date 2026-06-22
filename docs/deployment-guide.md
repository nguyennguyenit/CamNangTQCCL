# Deployment Guide

## Local preview

Frontend không chạy tốt bằng `file://` vì cần request JSON. Dùng HTTP server:

```bash
python3 -m http.server 8000
```

Mở `http://localhost:8000`.

## Rebuild data local

Chỉ làm khi có export HTML `Meta Team PK/` ở root repo.

```bash
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
```

Kết quả ghi vào `data/*.json`. Các file này là artifact commit sẵn cho site tĩnh.

## GitHub Pages

Hiện deploy static site đi qua `.github/workflows/deploy.yml`.

- Workflow copy `index.html`, `css/`, `js/`, `data/` sang `_site`.
- Workflow không build lại dữ liệu.
- Workflow không deploy `worker/`.

Trước khi push `main`, phải đảm bảo `data/*.json` đã đúng.

## Cloudflare Worker cho soi đội

Worker ở `worker/` là deploy riêng, không đi cùng GitHub Pages.

### Chuẩn bị

```bash
cd worker
npm install
wrangler login
wrangler kv namespace create RL
```

### Secret

```bash
wrangler secret put QWEN_API_KEY
wrangler secret put TURNSTILE_SECRET
```

### Vars cần khớp

- Cấu hình origin allowlist trong Worker.
- Chọn endpoint theo region hoặc endpoint override.
- Chốt model vision đang dùng.
- Có cờ tắt feature ngay khi cần.
- Có các mức cap trong `worker/src/config.ts`.

### Deploy worker

```bash
npm run deploy
```

## Kích hoạt tab Soi đội

Sau khi worker chạy thật:

1. Điền URL Worker và Turnstile site key trong `js/config.js`.
2. Kiểm tra UI báo đã cấu hình thật.
3. Mở tab `Soi đội từ ảnh` để test upload ảnh.

## Lưu ý vận hành

- Không commit secret.
- Không giả định quota là hard limit tuyệt đối.
- Nếu đổi origin site hoặc domain Pages, phải cập nhật allowlist origin và recheck CORS.
- Nếu đổi provider/model, test lại vài screenshot thật trước khi public rộng.

## Kết luận

Deploy của repo chia đôi rõ: static site qua GitHub Pages, soi đội qua Worker riêng. Hai phần này phải được cấu hình và test riêng.
