# Tóm tắt codebase

## Tổng quan

Repo gồm ba boundary độc lập: static SPA chạy trong trình duyệt, pipeline Python chạy offline để sinh JSON, và Cloudflare Worker TypeScript cho Vision. Không có bundler, framework frontend, backend chung hoặc database ứng dụng.

## Cấu trúc

```text
.
├── index.html              # shell 10 section
├── css/styles.css          # theme, responsive, component styles
├── js/                     # vanilla ES modules
├── data/                   # JSON runtime đã commit
├── pipeline/               # parser/normalizer/builder Python stdlib
├── worker/                 # Vision proxy Cloudflare
├── tests/                  # Python unittest
├── tests-js/               # Node test cho logic frontend
├── docs/                   # tài liệu evergreen
└── plans/                  # kế hoạch/báo cáo lịch sử
```

## Điểm vào và module chính

| File | Vai trò |
|---|---|
| `index.html` | Khai báo 10 tab/section và nạp `js/app.js`. |
| `js/app.js` | Load 6 JSON bắt buộc + tier tùy chọn; init nav, theme và các section. |
| `js/team-filter-section.js` | Shared full-text search, chip động, stats, clear và mobile collapse cho 3 tab team. |
| `js/team-pk.js`, `js/do-uy.js`, `js/meta-cu.js` | Chọn source, cấu hình filter và sort riêng từng tab. |
| `js/render.js`, `js/filters.js` | DOM builder, team card, tier và pure filter/search. |
| `js/hero-list.js`, `js/hero-detail.js`, `js/tactics.js` | Tra cứu tướng/chiến pháp local. |
| `js/recruit-tracker-store.js` | State schema v1, nhiều account, banner, pity, import/export localStorage. |
| `js/analyze.js`, `js/analyze-map.js` | Nén ảnh, Turnstile, Worker call, canonical map và team similarity. |
| `js/roster-scan-state.js` | Serialize scan state, loại dữ liệu ảnh/token. |
| `js/team-recommend-engine.js` | Chấm tier, kiểm tra conflict, greedy/DFS và tạo portfolio local. |
| `pipeline/build_json.py` | Build team, facet, Cùng Tồn, khai hoang từ HTML export. |
| `pipeline/build_dict.py` | Crawl/cache/link và merge chiến pháp generic, build tướng/chiến pháp. |
| `pipeline/build_books_dict.py` | Validate bảng map Hán→Việt với facet binh thư. |
| `pipeline/build_team_tier.py` | Join tier curate theo team ID, validate tier fail-loud. |
| `worker/src/index.ts` | `POST /analyze`: origin, limits, Turnstile, image guard, model, response. |
| `worker/src/config.ts`, `schema.ts` | Env config và schema kết quả cho 4 mode. |

## Dữ liệu runtime

| Artifact | Snapshot 2026-07-11 |
|---|---:|
| `data/teams.json` | 214: 56 team-intro, 48 do-uy, 110 moi-phe |
| `data/team-tier.json` | 57 team, 65 rankings |
| `data/tactics.json` | 239, gồm 27 record pending sau merge generic |
| `data/heroes-dict.json` | 112 |
| `data/books-dict.json` | 66 |
| `data/coexist.json` | 5 nhóm, 25 team |
| `data/khaihoang.json` | 11 team, 5 mỏ |
| `data/tactics-generic.json` | 29 record nguồn |

`data/facets.json` có 91 tướng, 119 chiến pháp, 67 binh thư, 4 loại binh, 3 mức sao, 5 phe, 2 trạng thái, 3 nguồn; tổng source/status là 213. Frontend không fetch artifact này: tab team tính facet trực tiếp từ tập team runtime.

## Local state và external state

- `theme`: light/dark trong `localStorage`.
- `tqcclRecruitTracker`: tracker schema version 1; có export/import JSON.
- `tqccl.rosterRecommend.scanState.v1`: tên tướng/chiến pháp/team khóa, xác nhận và timestamp; không ảnh/base64/blob/token.
- Ảnh preview giữ trong memory/data URL của phiên UI, gửi tới Worker khi người dùng xác thực.
- Worker dùng KV cho replay/rate/cap; secret và API key chỉ ở Worker environment.

## Kiểm thử

- `tests/`: parser, normalize, build, từ điển, tier, crawl/link.
- `tests-js/`: filter, map, hero UI, mobile menu, tracker, roster state và recommend engine.
- `worker/test/`: config, guard, model, rate-limit, scan modes, schema.

Snapshot 2026-07-11: Python 82, root JS 83, Worker 53 test pass; Worker typecheck pass.

## Điểm cần chú ý

- Comment `50 team` trong `js/team-pk.js` đã cũ; UI dùng số runtime nên vẫn hiện 56.
- `build_json.py` vẫn expect 50 Team PK và 12 Đô Úy; không tái tạo artifact hiện tại an toàn.
- `facets.json` chậm hơn `teams.json` một team nhưng hiện không ảnh hưởng filter runtime.
- `plans/` có thể chứa mô tả cũ; kiểm chứng bằng code, config và JSON commit.

## Bước tiếp theo

Khi sửa behavior: bắt đầu từ module section/store/engine tương ứng, chạy test hẹp, rồi mở rộng test contract. Khi sửa data: backup artifact và review diff trước khi commit.

## Tham chiếu

- [Chuẩn code](code-standards.md)
- [Kiến trúc hệ thống](system-architecture.md)
- [Roadmap](project-roadmap.md)
