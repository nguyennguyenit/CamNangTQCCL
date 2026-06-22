# Cẩm Nang Team — Tam Quốc Chí Chiến Lược

Website tĩnh tổng hợp **meta team** game Tam Quốc Chí Chiến Lược, đầy đủ bộ lọc, đẹp & dễ nhìn. Dữ liệu tổng hợp từ folder `Meta Team PK/` (Google Sheets export).

5 section:
- **Team PK** — 172 team, lọc theo loại binh / sao / trạng thái / phe / tướng / chiến pháp / binh thư + search toàn văn.
- **Cùng Tồn** — đội hình cùng tồn tại (kèm Thêm điểm + Kỹ năng quân sư).
- **Khai hoang** — đội thủ quân theo mỏ (PvE).
- **Tra cứu chiến pháp** — từ điển 237 chiến pháp + 112 tướng (Việt/Hán-Việt/Hán), search fuzzy đa ngõ vào + lọc loại/chất. Offline, không AI.
- **Soi đội từ ảnh** — upload screenshot → Vision LLM (Qwen qua Cloudflare Worker proxy) đọc cả đội → map về tên Việt canonical + đối chiếu 172 team. Cần deploy `worker/` + cấu hình `js/config.js`.

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
python3 -m pipeline.build_dict        # crawl lingxi -> data/{tactics,heroes-dict}.json (cache lại; --recrawl để gọi mạng)
```

`build_json` assert đúng số team (50 + 12 + 110 = 172), fail-fast nếu lệch. `build_dict` phiên âm Hán-Việt (fail-loud ký tự thiếu) + auto-link tên Việt; chiến pháp generic không có trong lingxi để placeholder ở `data/tactics-generic.json`.

**Tên team:** mỗi team tự sinh tên từ âm tiết cuối 3 tướng (Cam Ninh + Thái Sử Từ + Chu Thái → "Ninh Từ Thái"). Muốn thêm **tên gọi khác** (vd "Hổ Thần Cung"), điền vào `pipeline/team-nicknames.json` — key = 3 tên tướng (chuẩn, sau alias) ghép bằng `|`, không phân biệt thứ tự. Card hiện tên gọi khác nếu có, ngược lại hiện tên tự sinh.

## Chạy local

Cần HTTP server (vì `fetch` JSON):

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

## Test

```bash
python3 -m unittest discover -s tests                                              # pipeline (grid, parser, normalize, build, hán-việt, crawl, link)
node --test tests-js/filters.test.mjs tests-js/match-dict.test.mjs tests-js/analyze-map.test.mjs   # filter + fuzzy match + soi đội
cd worker && npm test                                                              # Vision proxy worker (vitest)
```

## Deploy

GitHub Pages tự động qua `.github/workflows/deploy.yml` khi push `main` (publish static, không build trên CI). Bật Pages: Settings → Pages → Source = GitHub Actions.

## Ghi chú

Dữ liệu mang tính tham khảo từ kinh nghiệm người chơi, không phải phương án duy nhất. `Meta mỗi phe (cũ)` được gắn nhãn **Cũ**.
