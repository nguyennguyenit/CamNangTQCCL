# Codebase Summary

## Snapshot

Repo trọng tâm là dữ liệu JSON và frontend tĩnh. Phần nặng nhất nằm ở `data/teams.json`, `data/tactics.json`, và `data/heroes-dict.json`.

## Cấu trúc

```text
.
├── index.html
├── css/styles.css
├── js/
├── data/
├── pipeline/
├── worker/
├── tests/
├── tests-js/
├── docs/
└── plans/
```

## Nhóm file chính

| Nhóm | Vai trò |
|---|---|
| `index.html`, `css/styles.css`, `js/*.js` | UI tĩnh, render, filter, tra cứu, analyze |
| `data/*.json` | Dữ liệu đã build sẵn cho site |
| `pipeline/*.py` | Tái dựng grid HTML, parse, normalize, build JSON/dict |
| `worker/src/*.ts` | Cloudflare Worker proxy cho ảnh soi đội |
| `tests/`, `tests-js/`, `worker/test/` | Test Python, JS, Worker |
| `docs/*.md` | Tài liệu dự án |
| `plans/` | Kế hoạch, báo cáo, spike |

## Dữ liệu hiện tại

| File | Quy mô |
|---|---|
| `data/teams.json` | 172 team |
| `data/tactics.json` | 237 chiến pháp |
| `data/heroes-dict.json` | 112 tướng |
| `data/coexist.json` | 5 nhóm |
| `data/khaihoang.json` | 11 đội + 5 mỏ |
| `data/facets.json` | 85 heroes, 112 tactics, 74 books, 4 unitTypes, 3 stars, 5 factions, 2 statuses, 3 sources |
| `data/tactics-generic.json` | 28 tactic generic placeholder |

## Điểm vào code

- `js/app.js`: boot app, load JSON, nav section, theme, filter, render, init analyze.
- `js/render.js`: tạo DOM an toàn, không bơm dữ liệu thô vào `innerHTML`.
- `js/filters.js`: lọc và search pure function, dùng được cả browser lẫn Node test.
- `js/analyze.js`: flow upload ảnh, nén client, Turnstile, gọi Worker, render kết quả.
- `js/analyze-map.js`: map output Hán sang Việt canonical và tìm team giống.
- `pipeline/build_json.py`: build `teams.json`, `facets.json`, `coexist.json`, `khaihoang.json`.
- `pipeline/build_dict.py`: build từ điển chiến pháp và tướng.
- `worker/src/index.ts`: route `/analyze`, check origin, limit, Turnstile, gọi model, trả JSON.

## Lệnh hay dùng

```bash
python3 -m http.server 8000
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
python3 -m unittest discover -s tests
node --test tests-js/filters.test.mjs tests-js/match-dict.test.mjs tests-js/analyze-map.test.mjs
cd worker && npm test
cd worker && npm run typecheck
```

## Kết luận nhanh

Repo này là static site trước, pipeline dữ liệu sau, Worker là phần phụ trợ tùy chọn. Không có backend chung, không có DB, không có bundler.
