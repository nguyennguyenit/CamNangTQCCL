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
| `data/teams.json` | 197 team (team-intro 50 + moi-phe 110 + do-uy 37) |
| `data/tactics.json` | 237 chiến pháp |
| `data/heroes-dict.json` | 112 tướng |
| `data/coexist.json` | 5 nhóm |
| `data/khaihoang.json` | 11 đội + 5 mỏ |
| `data/team-tier.json` | 28 team có tier (multi-source rankings) |
| `data/facets.json` | 75 heroes, 107 tactics, 69 books, 4 unitTypes, 3 stars, 5 factions, 2 statuses, 2 sources |
| `data/tactics-generic.json` | 28 tactic generic placeholder |
| `data/books-dict.json` | map binh thư Hán→Việt |

`Team PK` chỉ render team-intro + moi-phe (160 team); team `do-uy` ẩn khỏi Team PK và hiện ở tab Đô Úy riêng.

## Điểm vào code

- `js/app.js`: boot app, load JSON, nav section, theme, filter, render, init analyze + Đô Úy + tra cứu tướng.
- `js/render.js`: tạo DOM an toàn (không bơm thô vào `innerHTML`), `teamCard`, badge tier (`bestTier`).
- `js/filters.js`: lọc và search pure function, dùng được cả browser lẫn Node test.
- `js/do-uy.js`: tab Đô Úy — filter bar inline (loại binh / phe / tier / khuyến nghị), facets tính riêng từ tập do-uy, dùng lại `applyFilters`/`teamCard`.
- `js/hero-list.js` + `js/hero-detail.js`: tra cứu tướng (chip lọc binh chủng/vai trò/phe/sao + search fuzzy) và modal chi tiết tướng.
- `js/match-dict.js`: search đa ngõ vào (Việt bỏ dấu / Hán-Việt / Hán) cho tướng và chiến pháp.
- `js/mobile-section-menu.js` + `js/mobile-filter-drawer.js`: hamburger menu section + drawer bộ lọc Team PK trên mobile.
- `js/analyze.js`: flow upload ảnh, nén client, Turnstile, gọi Worker, render kết quả.
- `js/analyze-map.js`: map output Hán sang Việt canonical và tìm team giống.
- `pipeline/build_json.py`: build `teams.json`, `facets.json`, `coexist.json`, `khaihoang.json`.
- `pipeline/build_dict.py` + `pipeline/build_books_dict.py`: build từ điển chiến pháp, tướng, binh thư.
- `pipeline/build_team_tier.py`: build `team-tier.json` từ `team-tier-map.json` (fail-loud nếu tier ngoài tập hợp lệ).
- `worker/src/index.ts`: route `/analyze`, check origin, limit, Turnstile, gọi model, trả JSON.

## Lệnh hay dùng

```bash
python3 -m http.server 8000
python3 -m pipeline.build_json
python3 -m pipeline.suggest_aliases
python3 -m pipeline.build_dict
python3 -m pipeline.build_books_dict
python3 -m pipeline.build_team_tier
python3 -m unittest discover -s tests
node --test tests-js/*.test.mjs
cd worker && npm test
cd worker && npm run typecheck
```

## Kết luận nhanh

Repo này là static site trước, pipeline dữ liệu sau, Worker là phần phụ trợ tùy chọn. Không có backend chung, không có DB, không có bundler.
