# Project Overview PDR

## Tóm tắt

`Cẩm Nang Team` là site tĩnh tra cứu meta team của Tam Quốc Chí Chiến Lược. Repo gom dữ liệu từ export HTML local, build sang JSON, rồi render bằng frontend vanilla JS.

## Phạm vi hiện tại

| Hạng mục | Nội dung |
|---|---|
| Frontend | `index.html`, `css/styles.css`, `js/*.js` |
| Dữ liệu | `data/teams.json`, `data/coexist.json`, `data/khaihoang.json`, `data/facets.json`, `data/tactics.json`, `data/heroes-dict.json` |
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
| FR-1 | Hiển thị 5 section: `Team PK`, `Cùng Tồn`, `Khai hoang`, `Tra cứu chiến pháp`, `Soi đội từ ảnh` |
| FR-2 | Lọc `Team PK` theo chip và combo, search toàn văn, giữ tương tác offline sau khi JSON đã tải |
| FR-3 | Render `Cùng Tồn` và `Khai hoang` từ JSON đã build |
| FR-4 | Tra cứu chiến pháp bằng dữ liệu local `data/tactics.json` và `data/heroes-dict.json` |
| FR-5 | Cho phép upload ảnh soi đội khi `js/config.js` và Worker đã cấu hình thật |
| FR-6 | Map output Hán sang tên Việt canonical rồi đối chiếu với `data/teams.json` |
| FR-7 | Rebuild dữ liệu từ HTML export local bằng `python3 -m pipeline.build_json` |

## Yêu cầu phi chức năng

- Static-first, không bundler, không framework.
- Dùng HTTP server local vì frontend gọi request JSON.
- Dữ liệu và render phải bám đúng file thật trong repo.
- Không để secret nằm trong frontend repo.
- Tách rõ phần build data, phần render, phần Worker.
- Giữ code path testable bằng unit test nhỏ, pure function nếu được.

## Ràng buộc

- Nguồn HTML `Meta Team PK/` không commit.
- `js/config.js` là public config, không phải secret.
- `worker/` chỉ là proxy riêng; GitHub Pages không deploy Worker.
- Quota Worker hiện là best-effort, không phải hard limit tuyệt đối.

## Tiêu chí chấp nhận

- `python3 -m http.server 8000` mở site được và load đủ JSON.
- `python3 -m unittest discover -s tests` pass.
- `node --test tests-js/filters.test.mjs tests-js/match-dict.test.mjs tests-js/analyze-map.test.mjs` pass.
- `cd worker && npm test` và `cd worker && npm run typecheck` pass.
- `data/*.json` khớp số lượng hiện tại: `teams=172`, `tactics=237`, `heroes-dict=112`, `coexist=5`, `khaihoang=11/5`.

## Rủi ro chính

- Thiếu `Meta Team PK/` thì không rebuild được pipeline.
- `js/config.js` placeholder làm tab soi đội bị vô hiệu hóa.
- Quota Worker dùng KV, nên chỉ best-effort.
- Dữ liệu chiến pháp generic còn phần mô tả chờ ghép tay.

## Kết luận

Repo này ưu tiên: dữ liệu đúng, render an toàn, deploy đơn giản, và có đường mở rộng cho soi đội ảnh nhưng không phụ thuộc vào backend nặng.
