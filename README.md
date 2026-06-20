# Cẩm Nang Team — Tam Quốc Chí Chiến Lược

Website tĩnh tổng hợp **meta team** game Tam Quốc Chí Chiến Lược, đầy đủ bộ lọc, đẹp & dễ nhìn. Dữ liệu tổng hợp từ folder `Meta Team PK/` (Google Sheets export).

3 section:
- **Team PK** — 172 team, lọc theo loại binh / sao / trạng thái / phe / tướng / chiến pháp / binh thư + search toàn văn.
- **Cùng Tồn** — đội hình cùng tồn tại (kèm Thêm điểm + Kỹ năng quân sư).
- **Khai hoang** — đội thủ quân theo mỏ (PvE).

## Kiến trúc

```
Meta Team PK/*.html  ──(pipeline Python)──►  data/*.json  ──►  frontend vanilla JS
```

- `pipeline/` — build script (chỉ Python stdlib): tái dựng grid HTML (xử lý rowspan), 3 parser, normalize + alias, sinh JSON.
- `data/` — JSON đã build (commit sẵn). **Nguồn HTML KHÔNG commit.**
- `js/`, `css/`, `index.html` — frontend tĩnh, không framework/bundler.

## Build lại dữ liệu (local)

Cần folder nguồn `Meta Team PK/` + Python 3.

```bash
python3 -m pipeline.build_json        # sinh data/{teams,facets,coexist,khaihoang}.json
python3 -m pipeline.suggest_aliases   # gợi ý typo cho pipeline/aliases.json (review thủ công)
```

`build_json` assert đúng số team (50 + 12 + 110 = 172), fail-fast nếu lệch.

## Chạy local

Cần HTTP server (vì `fetch` JSON):

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

## Test

```bash
python3 -m unittest discover -s tests   # pipeline (grid, parser, normalize, build)
node --test tests-js/filters.test.mjs   # filter logic
```

## Deploy

GitHub Pages tự động qua `.github/workflows/deploy.yml` khi push `main` (publish static, không build trên CI). Bật Pages: Settings → Pages → Source = GitHub Actions.

## Ghi chú

Dữ liệu mang tính tham khảo từ kinh nghiệm người chơi, không phải phương án duy nhất. `Meta mỗi phe (cũ)` được gắn nhãn **Cũ**.
