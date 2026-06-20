# System Architecture

## Tổng quan
Static site, 2 lớp: **pipeline build (Python)** → JSON → **frontend (vanilla JS)**. Không backend, không DB, không bundler.

## Pipeline (`pipeline/`)
1. `grid_extractor.py` — đọc HTML table (Google Sheets ritz/waffle), tái dựng ma trận 2D **xử lý rowspan/colspan (fill-down)** + bỏ cột gutter spreadsheet. Lõi dùng chung.
2. `parse_team_intro.py` — 3 file cùng schema (Team giới thiệu / Đô Úy / Meta mỗi phe cũ). Phân tách team theo **cột Type rowspan=3**. Layout 8 cột `[Type, Tướng, CP1, CP2, BT1, BT2, BT3, Thêm]`. → 50 + 12 + 110 = 172.
3. `parse_coexist.py` — Team Cùng Tồn (nhóm lồng): nhóm → đội con → tướng (kèm Thêm điểm, Kỹ năng quân sư).
4. `parse_khaihoang.py` — PvE: mỏ → 8 đội thủ (tướng + loại binh).
5. `normalize.py` — apply alias (typo), tách biến thể `/` + tiền tố `Tinh·/Thác·`, parse tướng (SP/CO/variant), split counter `Chạm/Tránh` + tách rating-điều-kiện, classify (unitType / stars / faction-whitelist / status).
6. `build_json.py` — orchestrate + verify count (fail-fast) + sinh `data/*.json` deterministic (UTF-8, sort key).

`aliases.json` review thủ công; `suggest_aliases.py` chỉ gợi ý cluster typo (không auto-fuzzy).

## Data model
Xem `pipeline/normalize.py::normalize_team`. Team PK: `{id, source, rawType, unitType[], faction|null, stars|null, status, heroes[{baseName, variant, isSP/isCO, tactics[{name,alternatives}], books[...]}], counters{good[],avoid[]}, notes}`.

## Frontend (`js/`)
- `filters.js` — pure functions (`applyFilters`, `normalizeText`), dùng cả browser + node test. AND giữa nhóm, OR trong nhóm; khớp cả name LẪN alternatives; search bỏ dấu tiếng Việt.
- `render.js` — DOM builders thuần (createElement, không innerHTML data thô).
- `app.js` — load JSON, section nav (Team PK / Cùng Tồn / Khai hoang), filter UI (chip + combobox autocomplete đọc `facets.json`), theme persist, mobile drawer.

## Filter UX
- Facet nhỏ (loại binh / sao / trạng thái / phe) → chip + count.
- Facet lớn (tướng ~90, chiến pháp ~112, binh thư ~74) → combobox autocomplete + count (đọc `facets.json` sinh tĩnh).
- Counter chip bấm → set search query.

## Deploy
GitHub Pages publish static (`.github/workflows/deploy.yml`). JSON commit sẵn; HTML nguồn không commit. Fetch dùng path tương đối `./data/...`.
