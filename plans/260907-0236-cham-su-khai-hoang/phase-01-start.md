---
title: "Sửa nguồn, dữ liệu, UI và kiểm chứng"
status: done
---

# Sửa nguồn, dữ liệu, UI và kiểm chứng

## Context

- [Plan](./plan.md), [quyết định import](../reports/import-260906-1413-khaihoang-google-sheet.md), [CSV](../reports/source-260906-1413-khaihoang-google-sheet.csv).
- [Kiến trúc](../../docs/system-architecture.md): browser dùng JSON commit; pipeline HTML chưa tái tạo đủ dữ liệu curate.
- Owner hiện tại: `pipeline/parse_khaihoang.py`, `pipeline/build_json.py`, `data/khaihoang.json`, `js/render.js`, `css/styles.css`.

## Hợp đồng TDD (`--tdd`)

- Hoàn tất đối chiếu nguồn và lưu baseline trước mutation runtime. Tạo fixture có provenance trước test parser.
- Với mỗi phần bên dưới: viết test đúng hành vi mong muốn → chạy đỏ và xác nhận lỗi do hành vi thiếu/sai → sửa tối thiểu → chạy xanh → refactor nếu cần và chạy lại. Lỗi môi trường/import không thay cho bằng chứng bug.
- Test bảo toàn đang xanh giữ nguyên; không cố làm đỏ. Lưu lệnh và kết quả red/green tại `reports/validation.md`. Handoff cook luôn kèm `--tdd`.

## 1. Nguồn, schema và parser

1. Chụp baseline/diff riêng các file sẽ sửa; rà `khaihoang`, `transforms` trong runtime, test, scripts, docs và MCP. Chưa tìm thấy consumer khaihoang trong source MCP; xác minh lại lúc triển khai. Ghi đánh giá thay đổi public JSON: `chamSuTeams` additive; bỏ `transforms` là correction nhưng có thể phá consumer ngoài. Nếu phát hiện consumer cần tương thích, thống nhất migration trước khi bỏ field, tuyệt đối không giữ ý nghĩa chuyển hình sai trên UI.
2. Đối chiếu I–K của `Meta Team PK/Khai hoang.html` với snapshot CSV; ghi bảng quyết định tại `reports/source-reconciliation.md`. CSV có tám cặp ở hàng 21–43; HTML cũ có sáu cặp. Lăng Thống đi với Tôn Thượng Hương đổi từ Tây Lương Thiết Kỳ (HTML) sang Phong Thi Trận (CSV); hai cặp Mã Siêu–Lăng Thống và Cam Ninh–Lăng Thống chỉ có trong CSV. Runtime cũ có bảy attachment `transforms`, gồm Trình Phổ đứng riêng; không chuyển nguyên chúng sang mục mới.
3. Audit đã xác minh ô alternatives có rowspan=2 phủ Lữ Mông/Giả Hủ; CSV chỉ điền ô đầu. Lưu một lần trong ghi chú nhóm, không nhân đôi hoặc gán riêng cho một tướng.
4. Chốt top-level `chamSuTeams: []`; mỗi nhóm có `id`, `title`, `heroes: [{name, tactic}]`, `note`, `sources: [{label, url}]`. Ghi chú nguồn/alternatives giữ đúng phạm vi nhóm hoặc tướng theo bằng chứng; không ép ba tướng, không dùng cấu trúc before/after của đội chính. ID ổn định từ nhóm, không từ đội A–G. `note` giữ “mang 1 lính”; không mở rộng thành hướng dẫn cơ chế chưa được kiểm chứng.
5. **Red:** tạo fixture ở bước 7 và viết test Python theo mục 3.1; assertion parser chính không sinh transforms phải đỏ với code hiện tại. **Green:** thêm parser độc lập trong `pipeline/parse_khaihoang.py`, nhận biết header và ranh giới cột phải; nhóm theo dữ liệu/ô gộp/đoạn trống của chính bảng phải. Không phụ thuộc `_is_team_open`, hàng trống cột trái hay số đội chính. Ngừng đọc I–K trong `parse_khaihoang_teams`.
6. Tách helper nhỏ `build_khaihoang_payload(html_path)` trong `pipeline/build_json.py` (hàm dự kiến tạo), chỉ gọi parser để trả `teams`, `mines`, `chamSuTeams`, không đọc team/coexist hoặc ghi file. `main()` dùng helper này; cập nhật entrypoint parser để có cùng shape. Viết fixture test helper trước implementation; kiểm tra hai lần cùng input cho payload bằng nhau, không trùng nhóm. Test Python chỉ gọi helper, không gọi full `main()` và không ghi `data/`. Nếu kiểm writer, chuyển output riêng sang temporary directory và khôi phục sau test. Parser HTML phản ánh snapshot HTML, không giả vờ đã có tám nhóm CSV. Runtime migration dùng CSV đã đối chiếu; docs nêu rõ nguồn mới hơn chưa tự nhập vào pipeline HTML.
7. Track fixture nhỏ `tests/fixtures/khaihoang-cham-su-source.html` và `tests/fixtures/khaihoang-cham-su-source.csv`, trích đúng nguồn với provenance. Bao phủ rowspan, ranh giới bảng, nhóm phải lệch nhóm trái, trái hết dữ liệu nhưng phải còn nhóm. Không phụ thuộc HTML ignore hoặc test bị skip.

## 2. Dữ liệu runtime và UI

1. **Red:** lưu baseline trước migration; viết Node assertion tám nhóm theo CSV và không còn linkage sai, chạy đỏ. **Green:** chỉnh có chọn lọc `data/khaihoang.json`: thêm tám nhóm CSV sau reconciliation; xóa linkage `transforms` sai theo quyết định compatibility ở bước 1. Lưu baseline để so sánh mọi trường đội trừ `transforms`, cùng variants, season, seasonNote và mines; không tái tạo toàn bộ đội từ HTML cũ.
2. **Red:** viết Playwright test với JSON fixture có Chạm Sứ, chạy đỏ vì mục mới chưa render; giữ option regression đang xanh. **Green:** `js/render.js`: bỏ `khaihoangTransforms` và lời gọi; thêm renderer riêng cho Chạm Sứ với heading “Team Chạm Sứ / Ăn vạ”, tên tướng, chip chiến pháp, ghi chú nguồn và links. Đặt giữa khối đội chính và mỏ; chỉ render khi có nhóm. Không dùng `.kh-card` cho nhóm mới để giữ selector/options hiện tại.
3. `css/styles.css`: chỉ thêm style cần thiết theo patterns hiện tại; bỏ style chuyển hình khi không còn consumer. Kiểm tra desktop/mobile 375px, đọc được nguồn và không overflow.
4. Giữ input mảng mỏ legacy, object thiếu field, `chamSuTeams: []` và hành vi chọn/khôi phục cấu hình mặc định; không thêm selector variant vào nhóm Chạm Sứ.

## 3. Validation, docs và review

1. `tests/test_parse_secondary.py`: thay assertion chuyển hình sai; kiểm tra nhóm độc lập, không nhân đôi merged-cell alternatives, không cắt phần phải theo cột trái, thiếu/rỗng bảng và parser main không sinh transforms. Thêm test helper payload trong file Python này; xác nhận ba trường, deterministic và không phụ thuộc HTML team/coexist. Fixture luôn chạy trên clean clone; viết và chạy đỏ trước sửa parser/helper.
2. `tests-js/khaihoang-data.test.mjs`: assert tám nhóm đúng fixture CSV, đủ provenance/note, không bịa tướng/binh chủng; so baseline chứng minh teams/variants/mỏ/mùa được giữ. Node chỉ kiểm artifact curated; kiểm parser/payload lặp và output thuộc test Python ở mục 3.1, không thêm CSV importer mới. Assertion migration viết trước khi sửa JSON; baseline comparison có thể lưu làm bằng chứng thay vì nhân bản toàn JSON trong test.
3. `tests-e2e/khaihoang-options.spec.mjs`: kiểm tra thứ tự ba khối, nhãn chuyển hình vắng, links/note đúng và option regression. Route fixture JSON để kiểm tra missing/empty list và legacy array; kiểm mobile không overflow. Không nới các assertion option hiện tại để che regression.
4. Ba lệnh hẹp đầu dùng ở từng vòng red/green tương ứng; sau khi cả ba xanh, chạy các gate rộng còn lại:

```sh
python3 -m unittest tests.test_parse_secondary
node --test tests-js/khaihoang-data.test.mjs
npm run test:e2e:astro -- tests-e2e/khaihoang-options.spec.mjs
python3 -m unittest discover -s tests
npm run test:node
npm run check
npm run build
npm run verify
npm run test:dist
```

Kiểm tra owner port 4174 trước Playwright; theo dõi và dừng process do task tạo, không kill process phiên khác. Nếu test phụ thuộc nguồn local bị skip, báo rõ; fixture regression bắt buộc không skip.

5. Đọc rồi cập nhật phần owning trong `docs/system-architecture.md`: contract ba khối, provenance CSV/HTML, giới hạn rebuild và thay đổi tương thích JSON. Không sửa báo cáo import cũ thành trạng thái hiện tại.
6. Review nguồn/schema/UI và diff preservation trước kết luận. Lưu bằng chứng test, baseline comparison và quyết định compatibility tại `reports/validation.md`; không commit/deploy.

## Rủi ro và rollback

- CSV không giữ metadata merged-cell; giữ quyết định alternatives cấp nhóm đã được HTML xác nhận, không diễn giải thành thay một tướng cụ thể.
- Full builder có thể xóa curate/options/season và cần HTML ngoài phạm vi: chỉ chỉnh artifact có chọn lọc; test helper payload bằng fixture trong Python. Temporary output chỉ áp dụng test writer nếu cần, không làm full builder thành clean-clone test.
- Consumer ngoài có thể đọc `transforms`: ghi rõ correction/removal và lựa chọn migration trước thay public contract.
- WIP SGSDeck/season lookup có thể chạm cùng file: đọc lại diff trước mỗi sửa, không reset/stash toàn workspace.
- Rollback bằng đảo đúng hunk/data migration của task từ baseline đã lưu; giữ WIP và nhóm dữ liệu không liên quan, không dùng checkout/reset toàn file.

## Câu hỏi còn lại

Không còn câu hỏi sản phẩm. Hai finding audit đã áp dụng; implementation hoàn tất local ngày 2026-09-07. Kiểm thử và review đạt.

## Kết quả

Parser, migration và UI đều có bằng chứng TDD đỏ/xanh. Python 89, Node 138, artifact 9, E2E 21 đạt. Các kiểm tra Astro đạt; review PASS 9.5/10. Xem [validation](./reports/validation.md) và [review](./reports/code-review.md). Chưa commit/deploy.
