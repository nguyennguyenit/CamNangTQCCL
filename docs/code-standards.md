# Code Standards

## Mục tiêu

Giữ code nhỏ, rõ, test được, và bám đúng kiểu repo hiện có: static site + pipeline Python + Worker TypeScript.

## Cấu trúc code

| Khu vực | Chuẩn hiện tại |
|---|---|
| `js/app.js` | Orchestrator, chỉ lo boot và wire-up |
| `js/filters.js` | Pure function, không DOM |
| `js/render.js` | DOM builder, dữ liệu đi qua `createElement` |
| `js/analyze-map.js` | Logic map/testable, không phụ thuộc UI |
| `pipeline/*.py` | Python stdlib, mỗi file một nhiệm vụ |
| `worker/src/*.ts` | Module nhỏ, tách config / guard / limit / model / schema |

## Quy ước chính

- Dùng vanilla ES modules trong `js/`.
- Không thêm framework hay bundler nếu chưa có lý do rõ.
- Giữ `render.js` an toàn: không bơm dữ liệu thô bằng `innerHTML`.
- Ưu tiên pure function cho phần filter, normalize, map, parse.
- Python pipeline chỉ dùng stdlib.
- Secret chỉ đi qua Worker env / wrangler secret, không để trong frontend.
- Tên file mới nên rõ nghĩa, kebab-case nếu tạo file mới theo convention repo.

## Data standards

- JSON trong `data/` là artifact đã build, commit sẵn.
- Nếu thêm field vào data model, cập nhật:
  - `pipeline/normalize.py`
  - `pipeline/build_json.py`
  - `js/render.js`
  - `js/filters.js` nếu field ảnh hưởng search/filter
  - test liên quan
- `pipeline/aliases.json`, `pipeline/team-nicknames.json`, `pipeline/tactic-name-overrides.json` là source control thủ công.

## UI standards

- Từ khóa, nhãn, badge dùng tiếng Việt ngắn gọn.
- Filter chip phải phản ánh count từ `data/facets.json`.
- Section không nên đổi layout đột ngột giữa desktop và mobile.
- Tính năng soi đội phải báo rõ khi chưa cấu hình `js/config.js`.

## Worker standards

- Kiểm tra origin, method, Turnstile, input guard theo thứ tự rẻ -> đắt.
- Không log nội dung ảnh.
- IP chỉ dùng dạng hash cho rate-limit.
- Response lỗi nên ngắn, không leak upstream detail.
- Quota `KV` là best-effort, đừng ghi như hard guarantee.

## Test standards

- Test pure function bằng Node test khi có thể.
- Test pipeline Python bằng `unittest`.
- Test Worker bằng `npm test` trong `worker/`.
- Khi chạm contract public, chạy test hẹp trước rồi mới mở rộng.

## Khi sửa file lớn

- Nếu file code vượt khoảng 200 LOC và phải chạm, cân nhắc tách module.
- Chỉ tách khi nó giảm thật complexity hoặc khớp boundary đã có.
- Không thêm abstraction chỉ để "đẹp".

## Checklist trước khi merge

1. Code đúng file boundary hiện có.
2. Test liên quan pass.
3. Docs cập nhật nếu thay đổi behavior, command, hoặc architecture.
4. Không đưa secret, cache, hay artifact phụ vào repo nếu không cần.
