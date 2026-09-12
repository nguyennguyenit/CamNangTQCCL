# Dữ liệu đội theo kịch bản

Năm sidecar `data/season-*.json` bổ sung phạm vi kịch bản, phiên bản luật,
cấu hình và bằng chứng cho dữ liệu đội hiện có. Các file gốc `teams.json`,
`team-tier.json`, `coexist.json` và `khaihoang.json` vẫn giữ vai trò riêng.
Không chạy `pipeline.build_json` để cập nhật sidecar mùa.

## Bảo trì và kiểm chứng

Nguồn curate nằm trong năm file cùng tên dưới `pipeline/`. Builder độc lập
kiểm cả bộ trước khi ghi, không suy mùa VN từ số mùa, nhãn nguồn hoặc ngày:

```bash
python3 -m pipeline.build_season_data --output-dir /tmp/tqccl-season-candidate
python3 -m unittest tests.test_build_season_data tests.test_parse_coexist_csv
node --test tests-js/season-context.test.mjs
```

Review candidate và các bằng chứng liên quan trước khi chạy builder không có
`--output-dir` để ghi năm file vào `data/`. Publisher có rollback khi một lần
thay file phát sinh lỗi được xử lý; đây không phải transaction chống mất điện
giữa các lần thay file. Triển khai và rollback website phải dùng nguyên bộ
shell/JS/JSON tương thích, theo [deployment guide](deployment-guide.md).

Schema và cross-reference do [builder](../pipeline/build_season_data.py),
[validator](../pipeline/season_validation.py) và
[resolver dùng chung](../js/season-context.js) sở hữu. Hash dùng JSON canonical
UTF-8, khóa sắp theo code point, giữ thứ tự mảng và ký tự Unicode nguyên bản.
Các [golden vectors](../tests/fixtures/season-fingerprint-vectors.json) kiểm
parity Python/JavaScript; không tự viết một quy tắc hash khác trong consumer.

## Phạm vi, cấu hình và điểm

Xác nhận một nguồn thuộc kịch bản chỉ cho phép phân loại tham khảo. Để dùng
cấu hình trong gợi ý, cần bằng chứng đã review cho đúng cặp kịch bản/luật và
fingerprint cấu hình. `teamId` là đội; `configId` là cấu hình cụ thể. Hai cấu
hình của cùng đội không được chọn thành hai đội trong một portfolio.

Tier mặc định phải được review đúng cấu hình. Xung đột chưa giải quyết hoặc
thiếu tier giữ `null`; không lấy tier tốt nhất từ lịch sử. Điều kiện quân sư,
độ thuần thục, thứ tự hoặc cải tạo chưa được kho hỗ trợ vẫn chặn cấu hình dùng
ngay, kể cả khi bật gợi ý đội chưa có tier.

“Điểm SGSDeck” giữ giá trị gốc, kể cả lớn hơn 100. Điểm chỉ hợp lệ khi cấu hình,
cặp kịch bản/luật, nguồn/snapshot và lựa chọn thực tế khớp bằng chứng. Đổi tướng,
holder, chiến pháp, binh thư hoặc lựa chọn khác làm điểm trở về `null`; không
quy đổi sao đánh giá cũ thành điểm.

Projector dùng chung lọc phạm vi, review, điều kiện và tier trước giới hạn
500 cấu hình có thể xét. Vượt giới hạn trả `CANDIDATE_LIMIT_EXCEEDED` với số
lượng thực, không lấy im lặng 500 cấu hình đầu. Engine theo mùa đối chiếu kho trên toàn
bộ tập đã được projector chấp nhận, trước giới hạn tìm kiếm. Greedy xét toàn
bộ cấu hình khả thi; full-box giữ ngân sách tìm kiếm hiện có và dùng kết quả
greedy làm phương án ban đầu, không bảo đảm tối ưu toàn cục. Tra cứu một đội
có nhiều cấu hình mà thiếu `configId` trả `CONFIG_AMBIGUOUS`, tối đa 20 ID cùng tổng số và
số bị lược. Contract và các giới hạn này được kiểm tại
[resolver tests](../tests-js/season-context.test.mjs).
Consumer MCP dùng search đúng context và cursor để duyệt các `configId` còn lại;
xem [hợp đồng consumer](mcp-research-server.md).

## Cùng Tồn và nguồn Recommended

[Parser CSV](../pipeline/parse_coexist_csv.py) giữ nhóm, ba vị trí tướng, các
slot có thứ tự, dòng ghi chú và điều kiện nguồn. Cột J thuộc “Cải tạo chiến
pháp binh chủng”; không tự chuyển thành quân sư. Payload nguồn mới nằm trong
`season-content-links.json`. [Bản đồ record](../pipeline/coexist-source-record-map.json)
tách ID ổn định khỏi fingerprint nội dung và tọa độ dòng; thay nội dung cần
review mapping, không đổi ID theo vị trí CSV.

Khai hoang dùng hướng dẫn được bảo trì mới nhất và không thuộc sidecar mùa.
Text gợi ý khai hoang trong nguồn Cùng Tồn không tự thêm đội hoặc liên kết
chuyển hình vào dữ liệu Khai hoang.

Recommended có adapter/parser offline trong
[`pipeline/sgsdeck_recommended.py`](../pipeline/sgsdeck_recommended.py) và crawler
có cache/checkpoint trong
[`pipeline/crawl_sgsdeck_recommended.py`](../pipeline/crawl_sgsdeck_recommended.py).
Crawler chỉ nhận URL `https://sgsdeck.com/recommended`, kiểm tra redirect trước
khi theo, đóng băng danh sách mùa/danh mục và lưu checksum từng trang. Chạy lại
với `--resume`; scope chỉ được xuất bản khi có trạng thái `complete`,
`empty-category` hoặc `uncollected-season`.

```bash
python3 -m pipeline.crawl_sgsdeck_recommended \
  --cache .cache/sgsdeck-recommended --all-source-scopes --resume
python3 -m pipeline.recommended_team_dedup \
  --teams data/teams.json --team-tier data/team-tier.json \
  --cache .cache/sgsdeck-recommended \
  --identity-map pipeline/recommended-identity-map.json \
  --output pipeline/recommended-other-teams.json
python3 -m pipeline.build_recommended_reference \
  --cache .cache/sgsdeck-recommended \
  --identity-map pipeline/recommended-identity-map.json \
  --other-ledger pipeline/recommended-other-teams.json \
  --output src/data/recommended-reference
```

`recommended-identity-map.json` là ledger alias đã review. Identity nguồn chưa
giải quyết được luôn là wildcard khi đối chiếu, không phải bằng chứng rằng một
đội khác Team chuẩn. Team có alternatives chưa tách thành cấu hình cụ thể cũng
ở trạng thái pending. Chỉ các row `admitted` trong
`recommended-other-teams.json` được ghi vào `other-teams.json`; duplicate và
pending không đi vào public artifact.

`src/data/recommended-reference/current.json` chọn đúng một generation bất biến.
Manifest khai báo hash và kích thước của `seasons.json`, `index.json`,
`other-teams.json` và từng `details-<safeScopeKey>.json`. Astro chỉ xuất
`/data/recommended/current.json` cùng các byte đã khai báo dưới
`/data/recommended/<generationId>/`; HTML pin generation đó nên một trang đang
mở không trộn hai lần cập nhật.

Quyền lưu và hiển thị cấu hình/điểm Recommended đã được người dùng xác nhận
ngày 2026-09-12. Dữ liệu này là tham khảo nguồn, không tự trở thành điểm,
tier hoặc eligibility gameplay VN. Khai hoang hiện tại vẫn dùng dữ liệu bảo
trì riêng; danh mục Khaihoang của Recommended chỉ nằm trong Team chuẩn.

## Kiểm tra phạm vi đã có dữ liệu

[Registry](../data/season-registry.json) và
[cấu hình đã curate](../data/season-team-configs.json) là nơi kiểm tra scope
hiện có. Một kịch bản xuất hiện trong registry không bảo đảm đã có luật hoặc
cấu hình đủ bằng chứng. Tập rỗng phải được giữ nguyên cho đến khi đủ bằng
chứng, không điền bằng dữ liệu mùa khác.

Registry hiện chỉ có Binh Diễn Xuân Thu, chưa có luật đã review;
configs/evaluations rỗng nên chưa có tier hay điểm VN theo luật. Nguồn Cùng Tồn
mới thuộc kịch bản này ở mức tham khảo; nhóm legacy chưa xác định kịch bản vẫn
nằm riêng. Website cho phép đọc nguồn khi chỉ chọn kịch bản; request gameplay
theo mùa của MCP cần cặp kịch bản/luật đã review, vì vậy dữ liệu hiện tại chưa
cung cấp cặp hợp lệ cho nhánh đó.

[Báo cáo intake Cùng Tồn](../plans/260907-0233-season-team-lookup/reports/phase-02-data-validation.md)
và [inventory Recommended](../plans/260907-0233-season-team-lookup/reports/recommended-score-inventory.md)
ghi phạm vi nguồn đã kiểm ở thời điểm nhập. Chúng là bằng chứng lịch sử,
không phải quy tắc chọn mùa mới nhất hoặc xác nhận các scope khác không tồn tại.
