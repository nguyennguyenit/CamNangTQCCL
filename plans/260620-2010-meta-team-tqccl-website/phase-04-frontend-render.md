---
phase: 4
title: Build JSON & Frontend Render
status: completed
effort: ''
---

# Phase 4: Build JSON & Frontend Render

## Overview
Orchestrate pipeline → sinh `data/*.json`, rồi frontend tĩnh load + render 3 section (Team PK / Cùng Tồn / Khai hoang) với section nav. Vanilla ES modules, không framework/bundler.

## Requirements

### build_json.py
- Gọi 3 parser + normalize → ghi `data/teams.json` (172 Team PK), `data/coexist.json`, `data/khaihoang.json`, `data/facets.json` (distinct + count cho autocomplete — sinh TĨNH ở đây, audit J).
- **Assert per-file count** (50/12/110), log diff `got/expected/missing-hero` khi lệch (audit #2, R5). `ensure_ascii=False, indent=2`, sort key ổn định (deterministic).

### Frontend
- `app.js` fetch `./data/*.json` (relative — R4); section nav (tabs) Team PK / Cùng Tồn / Khai hoang; mặc định Team PK.
- `render.js` pure DOM builders:
  - `teamCard(team)`: header (loại binh + phe nếu có + sao badge + status badge), 3 dòng tướng (tên đậm + variant + 2 CP + chip binh thư + "hoặc" cho alternatives), footer counter chip xanh(Chạm)/đỏ(Tránh), notes.
  - `coexistGroup(group)`: tên nhóm + summary + các team con (hiện statFocus + advisorSkill).
  - `khaihoangTable(mines)`: bảng mỏ → đội thủ (hero + chip loại binh).
- Badge màu sao (★ gold) + status (out-meta xám / Youtuber tím / situational cam).
- Dùng `createElement`/`textContent`, KHÔNG `innerHTML` chèn data (chuẩn an toàn).

## Architecture
ES modules: `index.html` `<script type="module" src="js/app.js">`. `render.js` export builders thuần (team→`HTMLElement`), tái dùng ở P5. Section nav = ẩn/hiện container + lazy render. P4 render đầy đủ, filter để P5.

## Related Code Files
- Create: `build/build_json.py`, `build/test_build.py` (→ `tests/test_build.py`)
- Create: `index.html`, `js/app.js`, `js/render.js`, `css/styles.css` (skeleton)
- Create (generated): `data/{teams,coexist,khaihoang,facets}.json`
- Depends: Phase 2, 3

## Implementation Steps
1. **TDD build**: `tests/test_build.py` assert tổng teams=172, JSON hợp lệ UTF-8 không escape, build 2 lần byte-identical. **GREEN** viết `build_json.py`.
2. `index.html`: header + disclaimer nguồn; section nav; `#stats`; `#filters` (placeholder P5); container mỗi section.
3. `render.js` builders (team/coexist/khaihoang) — guard null (team thiếu sao/phe/2 tướng không vỡ layout).
4. `app.js`: fetch song song 3 JSON, lỗi → thông báo; render section active; nav switch; `#stats` đếm.
5. CSS skeleton: grid `repeat(auto-fill,minmax(320px,1fr))`, card viền, badge cơ bản, bảng khaihoang.
6. Verify thủ công: serve local (`python3 -m http.server`), 172 card Team PK, đổi nav sang Cùng Tồn/Khai hoang hiển thị đúng, team mốc đủ trường.

## Success Criteria
- [ ] `python3 build/build_json.py` → 4 JSON; `tests/test_build.py` PASS (172 team, deterministic).
- [ ] Local server: Team PK = 172 card; nav chuyển 3 section OK; team mốc (SP Mã Siêu) đủ tướng/CP/binh thư/counter/sao.
- [ ] Không lỗi console; fetch path tương đối; dùng `createElement`/`textContent`.
- [ ] Khai hoang bảng 5 mỏ; Cùng Tồn nhóm + team con hiển thị statFocus/advisor.

## Risk Assessment
- R4 base path: tuyệt đối `./data/...`, không `/data/...`.
- Team thiếu trường → builder guard null.
- Section nav lazy render tránh dựng 172+ node khi không cần (perf).
