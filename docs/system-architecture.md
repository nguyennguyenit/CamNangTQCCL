# System Architecture

## Tổng quan

Repo là static site 2 lớp:

```text
HTML export local
  -> pipeline Python
  -> data/*.json
  -> frontend vanilla JS
  -> browser qua HTTP server
```

Không có backend chung, không có DB, không có bundler.

## Luồng dữ liệu

### 1. Build data

- Nguồn HTML nằm trong `Meta Team PK/` ở root repo.
- `pipeline/grid_extractor.py` tái dựng bảng HTML từ export Google Sheets, xử lý `rowspan` / `colspan`.
- `pipeline/parse_team_intro.py` đọc 3 file team-intro cùng schema.
- `pipeline/parse_coexist.py` đọc `Team Cùng Tồn.html`.
- `pipeline/parse_khaihoang.py` đọc `Khai hoang.html`.
- `pipeline/normalize.py` áp alias, tách biến thể, parse tướng, chia counter, phân loại phe / sao / trạng thái / binh.
- `pipeline/build_json.py` ghi `data/teams.json`, `data/facets.json`, `data/coexist.json`, `data/khaihoang.json`.
- `pipeline/build_dict.py` ghi `data/tactics.json` và `data/heroes-dict.json`.

### 2. Render site

- `index.html` load `css/styles.css` và `js/app.js`.
- `js/app.js` load JSON rồi init nav, theme, filter, render.
- `js/render.js` tạo DOM an toàn cho Team PK, Cùng Tồn, Khai hoang.
- `js/filters.js` xử lý search / filter thuần.
- `js/tactics.js` render tra cứu chiến pháp.

### 3. Soi đội từ ảnh

```text
upload ảnh
  -> nén client trong js/analyze.js
  -> Turnstile
  -> Cloudflare Worker /analyze
  -> Qwen / DashScope
  -> JSON Hán
  -> js/analyze-map.js map sang Việt
  -> so với data/teams.json
```

- `js/config.js` đang dùng placeholder cho `workerUrl` và `turnstileSiteKey`.
- Nếu chưa cấu hình thật, tab `Soi đội từ ảnh` chỉ báo setup.
- Worker ở `worker/` không lưu ảnh; IP chỉ hash để limit.

## Thành phần chính

| Thành phần | Vai trò |
|---|---|
| `index.html` | Shell HTML |
| `css/styles.css` | Theme, layout, card, badge, drawer |
| `js/app.js` | Orchestration |
| `js/render.js` | Render DOM |
| `js/filters.js` | Search / filter |
| `js/analyze.js` | Flow upload ảnh |
| `js/analyze-map.js` | Map result + team match |
| `pipeline/*.py` | Build data |
| `worker/src/*.ts` | Proxy Vision LLM |

## Deploy boundary

- Static host chỉ publish `index.html`, `css/`, `js/`, `data/`.
- Static deploy không build data, không run pipeline, không deploy Worker.
- GitHub Pages workflow đã bỏ vì repo private không được plan hiện tại hỗ trợ Pages.
- Worker deploy riêng bằng Wrangler trong `worker/`.

## Dữ liệu quan trọng

- `data/teams.json`: 172 team.
- `data/facets.json`: nguồn count cho chip / combo.
- `data/tactics.json`: từ điển chiến pháp.
- `data/heroes-dict.json`: từ điển tướng.
- `data/coexist.json`: nhóm cùng tồn tại.
- `data/khaihoang.json`: đội khai hoang + mỏ.

## Rủi ro / giới hạn

- Thiếu `Meta Team PK/` thì không rebuild được pipeline.
- `js/config.js` placeholder làm analyze tab vô hiệu hóa.
- Worker quota dựa trên KV nên là best-effort.
- Dữ liệu upstream / provider Vision phải tự xác minh trước khi public rộng.

## Kết luận

Thiết kế hiện tại cố tình đơn giản: static site + JSON đã build + Worker phụ trợ tùy chọn. Mục tiêu là dễ giữ dữ liệu đúng, dễ deploy, và dễ test từng phần.
