---
title: Website Tổng Hợp Meta Team TQCCL
description: >-
  Static site tổng hợp team PK + Cùng Tồn + Khai hoang game Tam Quốc Chí Chiến
  Lược
status: completed
priority: P2
branch: main
tags: []
blockedBy: []
blocks: []
created: '2026-06-20T13:25:56.752Z'
createdBy: 'ck:plan'
source: skill
---

# Website Tổng Hợp Meta Team TQCCL

## Overview

Website tĩnh tổng hợp dữ liệu game Tam Quốc Chí Chiến Lược, đẹp & dễ lọc hơn `ss18.thanglonghoi.xyz`. Data từ folder `Meta Team PK/` (Google Sheets export HTML) qua pipeline Python build → JSON; frontend vanilla HTML/CSS/JS render + filter client-side; deploy GitHub Pages.

**Nguồn sự thật thiết kế:** `plans/reports/brainstorm-260620-1938-meta-team-website-report.md`. `raw-data-extract-1.txt` là output parser PHẲNG lỗi — KHÔNG dùng làm fixture.

## Phạm vi data (CHỐT — đã verify trên file thật)

Website gồm **3 section**, mỗi section nguồn & model riêng:

| Section | Nguồn HTML | Count verified | Schema |
|---|---|---|---|
| **Team PK** (chính) | `Team giới thiệu(mới).html` (50) + `Team Đô Úy.html` (12) + `Meta mỗi phe (cũ).html` (110) | **172 team** | `Type \| 3×(Tướng+2CP+3 Binh thư) \| Thêm(Chạm/Tránh)` — leadspan=3, 8 cột mở/6 nối (sau khi bỏ gutter col0) |
| **Cùng Tồn** | `Team Cùng Tồn.html` | nhóm lồng (đếm ở P3) | Nhóm "Cùng tồn N" → nhiều team con; hero có thêm cột **Thêm điểm** + **Kỹ Năng Quân Sư**; ncols 10/9/7 |
| **Khai hoang** | `Khai hoang.html` | 5 mỏ (Mỏ 4–8) | PvE: mỗi mỏ = danh sách 8 đội thủ quân + loại binh; KHÔNG tier/CP/counter |

- `Meta Team.html` **BỎ** (theo quyết định user).
- `Meta mỗi phe (cũ).html` → gắn `status: "out-meta"` (file cũ).

## Mode & Gates
`--deep --tdd`: tests-first cho mọi module có logic (grid extractor, 3 parser, normalize, filter). Red-team brainstorm + audit plan đã chạy; mọi finding CHÍ MẠNG/CAO đã đưa vào các phase dưới.

## Kiến trúc & cây thư mục
```
build/                        # Python pipeline (stdlib only, snake_case)
  grid_extractor.py           # HTML table -> matrix CÓ fill-down rowspan + bỏ gutter col0 [LÕI CHUNG]
  parse_team_intro.py         # 3 file team-intro -> team thô (segment theo leadspan=3 / cột Type)
  parse_coexist.py            # Team Cùng Tồn -> nhóm + team con (cột Thêm điểm, Kỹ năng quân sư)
  parse_khaihoang.py          # Khai hoang -> mỏ -> đội thủ (tướng+loại binh)
  normalize.py                # alias, tách "/" & tiền tố SP/CO/Tinh·/Thác·, split Chạm/Tránh, classify
  build_json.py               # orchestrate -> data/{teams,coexist,khaihoang,facets}.json + verify counts
  aliases.json                # bảng typo review thủ công (deterministic)
  suggest_aliases.py          # in cluster near-duplicate cho con người review
tests/                        # stdlib unittest; fixtures = HTML cắt/tự tạo có chủ đích
  fixtures/  test_grid_extractor.py  test_parse_team_intro.py
  test_parse_coexist.py  test_parse_khaihoang.py  test_normalize.py  test_build.py
data/{teams,coexist,khaihoang,facets}.json   # GENERATED (commit JSON, KHÔNG commit HTML nguồn)
index.html
css/styles.css
js/
  filters.js                  # ES module: pure functions (browser + node test)
  app.js                      # load JSON, section nav, render, wire UI
  render.js                   # card/badge/tag/table DOM builders
tests-js/filters.test.mjs     # node:test (0 deps)
.github/workflows/deploy.yml
docs/  README.md
```

## Data model — Team PK (schema chuẩn hóa)
```jsonc
Team {
  id, source: "team-intro"|"do-uy"|"moi-phe",
  rawType: string,                 // hiển thị, vd "Thương", "Kỵ/Cung(★★★★☆)"
  unitType: string[],              // ["Kỵ","Cung"] tách từ Type
  faction: string|null,            // CHỈ whitelist {Ngô,Ngụy,Thục,Quần}; else null (đa số team-intro = null)
  stars: 4|4.5|5|null,             // parse ★ TRONG rawType (☆=.5); null nếu không có
  status: "meta"|"out-meta"|"youtuber-untested"|"situational",
  heroes: [ { name, baseName, variant: string|null, isSP, isCO, note,
              tactics: [ {name, alternatives[]} ],   // tách "/"
              books:   [ {name, alternatives[]} ] } ], // tách "/" + tiền tố Tinh·/Thác·
  counters: { good: string[], avoid: string[] },  // regex split "(Chạm|Tránh)\s*:"
  notes: string|null               // phần dư cột Thêm gồm rating-điều-kiện "Có X-★★★★★"
}
```
Cùng Tồn & Khai hoang dùng model riêng (mô tả trong phase tương ứng).

## Acceptance (số tuyệt đối đã verify)
- `parse_team_intro`: Team giới thiệu = **50**, Đô Úy = **12**, Meta mỗi phe cũ = **110**; tổng `teams.json` = **172**.
- `build_json` đếm + log diff rõ ràng; assert per-file expected count (fail-fast khi lệch, in tướng bị mất).
- Filter Team PK đa nhóm AND: Sao, Loại binh, Status, (Phe khi có) [chip] + Tướng/Chiến pháp/Binh thư [autocomplete+count] + search toàn văn; khớp cả `name` LẪN `alternatives`.
- Counter = chip xanh(Chạm)/đỏ(Tránh) bấm-để-search.
- Section nav chuyển Team PK / Cùng Tồn / Khai hoang.
- Responsive (mobile = filter drawer), dark mode, deploy GitHub Pages.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Scaffold & Grid Extractor](./phase-01-scaffold-grid-extraction.md) | Completed |
| 2 | [Team-Intro Parser (3 files)](./phase-02-two-parsers.md) | Completed |
| 3 | [Coexist + Khaihoang Parsers & Normalize](./phase-03-normalize-build-json.md) | Completed |
| 4 | [Build JSON & Frontend Render](./phase-04-frontend-render.md) | Completed |
| 5 | [Filter Engine](./phase-05-filter-engine.md) | Completed |
| 6 | [Styling Deploy Docs](./phase-06-styling-deploy-docs.md) | Completed |

## Dependencies

Greenfield, không plan khác liên quan. Thứ tự: P1→P2→P3→P4 (pipeline data + render) tuần tự; P5 cần P4 (DOM render); P6 cuối.

## Risks (toàn cục, từ red-team + audit)
- **R1 Rowspan grid shift** (CHÍ MẠNG): cột Type rowspan → dòng dưới thiếu cell, lệch cột. → `grid_extractor` fill-down + BỎ gutter col0 trước khi parse. Test riêng P1.
- **R2 Counter dính chữ** (`...ThươngTránh:...`): split regex `(Chạm|Tránh)\s*:`, KHÔNG theo dấu phẩy/space. Tách `Có X-★★★★★` (rating điều kiện) ra `notes` trước khi split avoid.
- **R3 Typo** → aliases.json + test giảm-distinct (P3). Fuzzy chỉ để gợi ý, áp map thủ công.
- **R4 GitHub Pages base path**: fetch JSON bằng relative `./data/...`.
- **R5 Count brittle**: assert per-file expected count + log diff (got/expected/missing), fail-fast — chống regression parser.
- **R6 Faction nhiễu**: file Type có "Tam Thế"/"Cung Bạch Mã" (token-2 KHÔNG phải phe) → faction CHỈ whitelist {Ngô,Ngụy,Thục,Quần}, else null. team-intro phần lớn null → UI ẩn chip phe khi null.
- **R7 Heterogeneous sources**: 3 section model riêng — KHÔNG ép 1 model. Section nav tách biệt.

## Code-review resolution (post-implementation)
Tất cả finding đã fix + verify (33 Python + 8 JS test xanh):
- **C1** stars facet "4.0"≠"4" → format `%g` (→ "4"/"4.5"/"5"). Verify: facets.json stars=['4','4.5','5'].
- **C2** coexist gộp hết vào "Khác" → track marker "Cùng tồn N" + summary. Verify: 5 nhóm "Cùng tồn 1–5", test gia cố nhãn.
- **C3** faction mất ở moi-phe → detect banner-row phe, propagate vào team. Verify: faction Counter {Quần32,Ngô27,Thục26,Ngụy20}; trước đây {None:172}.
- **H1** deploy publish "." lộ source/plans/pipeline → assemble `_site/` chỉ index+css+js+data.
- **H2** hero "A/B" không tách → parse_hero split baseName + alternatives; facet + search + render dùng cả hai.
- **M1** test coexist phantom → gia cố assert nhãn "Cùng tồn N" + summary + không trùng.
