# Project Overview PDR

## Tóm tắt

`Cẩm Nang Team` là site tĩnh tra cứu meta team của Tam Quốc Chí Chiến Lược. Repo gom dữ liệu từ export HTML local, build sang JSON, rồi render bằng frontend vanilla JS.

## Phạm vi hiện tại

| Hạng mục | Nội dung |
|---|---|
| Frontend | `index.html`, `css/styles.css`, `js/*.js` |
| Dữ liệu | `data/teams.json`, `data/team-tier.json`, `data/coexist.json`, `data/khaihoang.json`, `data/facets.json`, `data/tactics.json`, `data/heroes-dict.json`, `data/books-dict.json` |
| Build data | `pipeline/*.py` |
| Vision proxy | `worker/` |
| Test | `tests/`, `tests-js/`, `worker/test/` |

## Mục tiêu sản phẩm

1. Cho người chơi xem nhanh team PK, team cùng tồn tại, khai hoang, và từ điển chiến pháp.
2. Cho phép lọc/search theo dữ liệu thật đã build sẵn.
3. Giữ site chạy được chỉ với static hosting.
4. Tách riêng tính năng soi đội từ ảnh để không làm nặng site tĩnh.

## Người dùng mục tiêu

- Người cần tra team nhanh trên web.
- Người cần search chiến pháp / tướng offline.
- Người muốn soi screenshot để tìm team tương tự.
- Người maintain dữ liệu export từ `Meta Team PK/`.

## Yêu cầu chức năng

| ID | Yêu cầu |
|---|---|
| FR-1 | Hiển thị các section: `Team PK`, `Đô Úy (ss18)`, `Cùng Tồn`, `Khai hoang`, `Tra cứu tướng`, `Tra cứu chiến pháp`, `Soi đội từ ảnh`, `Gợi ý đội từ kho` |
| FR-2 | Lọc `Team PK` theo chip và combo, search toàn văn, giữ tương tác offline sau khi JSON đã tải; mobile dùng drawer lọc + hamburger menu section |
| FR-3 | Render `Cùng Tồn` và `Khai hoang` từ JSON đã build |
| FR-4 | Tra cứu chiến pháp và tướng bằng dữ liệu local (`data/tactics.json`, `data/heroes-dict.json`), search fuzzy Việt/Hán-Việt/Hán, click tướng mở modal chi tiết |
| FR-5 | Tab Đô Úy render team `do-uy` riêng với filter bar inline (loại binh / phe / tier / khuyến nghị), team `do-uy` ẩn khỏi Team PK |
| FR-6 | Gắn badge tier T0–T3 theo team từ `data/team-tier.json` (multi-source, hiện bậc tốt nhất + tooltip) |
| FR-7 | Cho phép upload ảnh soi đội khi `js/config.js` và Worker đã cấu hình thật; map output Hán sang tên Việt canonical rồi đối chiếu với `data/teams.json` |
| FR-8 | Cho phép scan kho tướng/chiến pháp/team đã build, review dữ liệu, rồi gợi ý portfolio 5 team bằng engine local, không để AI quyết team |
| FR-8 | Rebuild dữ liệu từ HTML export local bằng pipeline (`build_json`, `build_dict`, `build_books_dict`, `build_team_tier`) |
| FR-9 | Theo dõi chiêu mộ tướng 5★ bằng `localStorage`: nhiều account, `Danh tướng PK` 4 lượt/ngày, banner hạn giờ, pity 30, lịch sử 5★, xuất/nhập JSON |

## Yêu cầu phi chức năng

- Static-first, không bundler, không framework.
- Dùng HTTP server local vì frontend gọi request JSON.
- Tracker chiêu mộ là local-first; không có cloud sync, dùng JSON export/import để backup.
- Dữ liệu và render phải bám đúng file thật trong repo.
- Không để secret nằm trong frontend repo.
- Tách rõ phần build data, phần render, phần Worker.
- Giữ code path testable bằng unit test nhỏ, pure function nếu được.

## Ràng buộc

- Nguồn HTML `Meta Team PK/` không commit.
- `js/config.js` là public config, không phải secret.
- `worker/` chỉ là proxy riêng; static host không deploy Worker.
- Quota Worker hiện là best-effort, không phải hard limit tuyệt đối.

## Tiêu chí chấp nhận

- `python3 -m http.server 8000` mở site được và load đủ JSON.
- `python3 -m unittest discover -s tests` pass.
- `node --test tests-js/*.test.mjs` pass.
- `cd worker && npm test` và `cd worker && npm run typecheck` pass.
- `data/*.json` khớp số lượng hiện tại: `teams=213` (Team PK 55 + Meta phe cũ 110 + do-uy 48), `tactics=237`, `heroes-dict=112`, `coexist=5`, `khaihoang=11/5`, `team-tier=56`.

## Rủi ro chính

- Thiếu `Meta Team PK/` thì không rebuild được pipeline.
- `js/config.js` placeholder làm tab soi đội bị vô hiệu hóa.
- Quota Worker dùng KV, nên chỉ best-effort.
- Dữ liệu chiến pháp generic còn phần mô tả chờ ghép tay.

## Kết luận

Repo này ưu tiên: dữ liệu đúng, render an toàn, deploy đơn giản, và có đường mở rộng cho soi đội ảnh nhưng không phụ thuộc vào backend nặng.
