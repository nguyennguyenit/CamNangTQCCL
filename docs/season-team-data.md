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

Bản ghi ra `data/` là bản chiếu công khai: provenance chỉ còn `region`,
`fetchedAt`, `sourceUpdatedAt`; bỏ `provider`, `sourceUrl`, `note` của bằng
chứng, `provider` của điểm và `url`/`sheetId`/`gid` của nguồn Cùng Tồn. Đầu vào
dưới `pipeline/` giữ đủ provenance và được kiểm chéo trước khi chiếu.

Review candidate và các bằng chứng liên quan trước khi chạy builder không có
`--output-dir` để ghi năm file vào `data/`. Mọi lần ghi (kể cả ra `/tmp`) giữ
khoá `pipeline/lookup-output/promotion.lock` của repo, cùng khoá với promotion
Tra cứu thống nhất, và từ chối khi khoá đang có hoặc còn transaction Tra cứu ở
trạng thái `activation-prepared`/`writing` (recover trước). Publisher có rollback khi một lần
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

`parse_coexist_csv.py` là thư viện, không có CLI. `parse_coexist_csv(csv_text,
expected_hash=...)` parse snapshot; `build_content_links(...)` là bộ sinh các link
`source-owned-coexist` của `pipeline/season-content-links.json` từ CSV, bản đồ
record đã review và metadata nguồn. Gọi bằng Python; đọc CSV bằng
`read_bytes().decode("utf-8")` để giữ nguyên xuống dòng mà hash snapshot đã ghi:

```bash
python3 - <<'EOF'
import json
from pathlib import Path
from pipeline.parse_coexist_csv import build_content_links
links = json.loads(Path("pipeline/season-content-links.json").read_text(encoding="utf-8"))
current = [link for link in links if link["target"]["type"] == "source-owned-coexist"]
rebuilt = build_content_links(
    Path("plans/260907-0233-season-team-lookup/research/coexist-binh-dien-xuan-thu.csv").read_bytes().decode("utf-8"),
    json.loads(Path("pipeline/coexist-source-record-map.json").read_text(encoding="utf-8")),
    current[0]["target"]["source"],
    scenario_id=current[0]["scenarioId"],
    evidence_refs=current[0]["evidenceRefs"],
)
print(len(rebuilt), rebuilt == current)  # 5 True với snapshot đang commit
EOF
```

Với snapshot mới: cập nhật `snapshotHash` trong metadata nguồn và review bản đồ
record trước, thay các link `source-owned-coexist` trong
`pipeline/season-content-links.json` bằng kết quả, rồi publish bằng
`python3 -m pipeline.build_season_data` như mục Bảo trì.

Khai hoang dùng hướng dẫn được bảo trì mới nhất và không thuộc sidecar mùa.
Text gợi ý khai hoang trong nguồn Cùng Tồn không tự thêm đội hoặc liên kết
chuyển hình vào dữ liệu Khai hoang.

Recommended có adapter/parser offline trong
[`pipeline/sgsdeck_recommended.py`](../pipeline/sgsdeck_recommended.py) và crawler
có cache/checkpoint trong
[`pipeline/crawl_sgsdeck_recommended.py`](../pipeline/crawl_sgsdeck_recommended.py).
Crawler chỉ nhận URL `https://sgsdeck.com/recommended`, kiểm tra redirect trước
khi theo, đóng băng danh sách mùa/danh mục và lưu checksum từng trang. Bước đầu
là lưu trang chọn mùa đã render (trình duyệt) rồi đóng băng inventory bằng
`--freeze-inventory`; lệnh ghi `<cache>/scope-inventory.json`. Chạy lại
`--all-source-scopes` là tiếp tục: trang đã có trong `manifest.json` của cache
được đọc lại, không tải lại (không còn cờ `--resume`). Scope chỉ được xuất bản
khi có trạng thái `complete`, `empty-category` hoặc `uncollected-season`.

```bash
python3 -m pipeline.crawl_sgsdeck_recommended \
  --cache .cache/sgsdeck-recommended --freeze-inventory <picker.html>
python3 -m pipeline.crawl_sgsdeck_recommended \
  --cache .cache/sgsdeck-recommended --all-source-scopes
python3 -m pipeline.recommended_team_dedup \
  --teams data/teams.json --team-tier data/team-tier.json \
  --cache .cache/sgsdeck-recommended \
  --identity-map pipeline/recommended-identity-map.json \
  --output pipeline/recommended-other-teams.json
python3 -m pipeline.build_recommended_reference \
  --cache .cache/sgsdeck-recommended \
  --identity-map pipeline/recommended-identity-map.json \
  --other-ledger pipeline/recommended-other-teams.json \
  --teams data/teams.json \
  --content-links pipeline/recommended-content-links.json \
  --catalog data/heroes-dict.json \
  --output src/data/recommended-reference
```

`--catalog` bắt buộc: là `heroes-dict.json` mà khoá nối "Trong cẩm nang" dựa
vào (quy trình publish dùng bản của kho Tra cứu vừa dựng trong candidate).

Khi máy không có cache crawler (chỉ sửa `data/teams.json` hoặc identity map),
sinh lại ledger Đội khác từ source pack đã capture thay cho `--cache`. Pack phải
khớp `baseline.sourcePins` của `pipeline/site-localization-policy.json`, lệch thì
lệnh từ chối và không ghi ledger:

```bash
python3 -m pipeline.recommended_team_dedup \
  --teams data/teams.json --team-tier data/team-tier.json \
  --pack pipeline/localization-inputs/recommended.json \
  --identity-map pipeline/recommended-identity-map.json \
  --output pipeline/recommended-other-teams.json
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

Builder bắt buộc `--teams` và `--content-links`. `data/teams.json` là bản đội gốc
duy nhất được đối chiếu; [`pipeline/recommended-content-links.json`](../pipeline/recommended-content-links.json)
là ledger liên kết nội dung đã review và hiện có `entries` rỗng. Mỗi entry phải đủ
`sourceConfigId`, `legacyTeamId`, `sourceContentSha256`, `legacyContentSha256` và
`evidenceRef`; builder tính lại hai fingerprint từ record nguồn và từ đội gốc, một
fingerprint cũ làm builder dừng thay vì xuất bản. Hàng `admitted` của Team khác phải
trỏ đúng một cặp `legacyTeamId`/`legacyVariantId` đã được phân loại `distinct` và
mang `legacyContent` khớp hash của chính nó.

Generation descriptor pin thêm `legacyTeamsHash` và `contentLinksHash`, nên đổi
`data/teams.json` hoặc ledger liên kết sẽ sinh generation mới. Trước khi ghi, builder
đối chiếu index với detail của cùng `sourceConfigId`: `displayNameVi`,
`legacyReferences` và `displayNotes` phải trùng nhau.

`displayNotes` là projection `schemaVersion: 1` gồm các block có `id` duy nhất,
`owner` thuộc `team`, `primary` hoặc `alternative`, `holderIndex` nằm trong số holder
tương ứng, `textRaw` không rỗng và `textVi` đã review không rỗng/không chứa chữ Hán.
Capture chỉ nhận ownership cùng `textRaw`; strict publication mới yêu cầu `textVi`.
Renderer không suy ownership hoặc fallback raw khi bản dịch thiếu.

### Tên Việt và dữ liệu Trung nguyên bản

Tên tướng, chiến pháp và binh thư trong Team chuẩn chỉ dùng bản Việt đã có
trong `pipeline/recommended-identity-map.json`, đối chiếu từ từ điển của dự án;
không tự dịch tên mới. Alias phồn thể/giản thể được ghi cùng bằng chứng nguồn
để tái sử dụng đúng tên Việt hiện có.

Builder bổ sung `displayNameVi`, `tacticSlotsVi`, `bookSlotsVi` và
`statFocusVi` cho tướng chính lẫn các cấu hình thay thế, sau khi kiểm tra hash
corpus gốc với ledger Team khác. Hai mảng tên Việt giữ đúng vị trí slot nguồn;
tên chưa đối chiếu được là `null`. Tìm kiếm hỗ trợ cả tên Việt có dấu/không dấu
và tên Trung gốc.

Chỉ dẫn cộng điểm được dịch bằng bảng `statFocus` đã duyệt trong
`pipeline/recommended-display-map.json`. Builder giữ nguyên `statFocusRaw`, xuất
`statFocusVi`, và dừng publication nếu gặp mẫu chữ Hán chưa có mapping.
`statFocusKind: "note"` chuyển các giá trị thực chất là ghi chú trang bị hoặc
binh thư sang nhãn **Lưu ý** thay vì **Cộng điểm**.

Các trường `nameRaw`, `tacticSlotsRaw`, `bookSlotsRaw`, `statFocusRaw`,
`nameZh` và ghi chú nguồn không bị ghi đè, giữ dữ liệu để truy nguyên và tìm
bằng alias gốc. Chưa có bộ chọn ngôn ngữ; website mặc định chỉ render projection
Việt đã review, còn trường website-owned thiếu bản dịch làm strict gate dừng.

Khi nguồn Recommended thay đổi, capture lại từ cache đã xác minh vào file private;
không recrawl trong builder và không tái dựng snapshot từ DTO public:

```bash
python3 -m pipeline.site_localization capture \
  --cache "$RECOMMENDED_CACHE" \
  --output pipeline/localization-inputs/recommended.json
python3 -m pipeline.site_localization inventory \
  --root . \
  --report .cache/site-localization-inventory.json
```

Review inventory; cập nhật identity/display map, `pipeline/site-translations.json`
và receipt độc lập trong `pipeline/site-translation-reviews.json`. Output reviewer
đã lưu là bằng chứng lịch sử bất biến; khi source location nghỉ, receipt của batch
cũ chỉ claim phần giao với ledger đang hoạt động, còn output giữ nguyên tất cả
verdict. Validator buộc receipt claim **mọi** location của output còn active;
ledger phải khớp obligation suy từ nguồn và mỗi entry cần đúng một accepted
review. Location mới phải có output/reviewer độc lập, không lấy review cũ sang
đường dẫn mới hay tự refresh fingerprint để né review. Chuỗi tiếng Việt tự soạn
trong UI không có nguồn để dịch (ví dụ heading hướng dẫn Khai hoang) khai location
trong `pipeline/site-localization-policy.json` với owner file::symbol và
classification `authored-vi` kèm text-check evidence từ review độc lập; loại này
cố ý không nằm trong ledger/receipt dịch. Không sửa generation đã xuất.
Dựng và kiểm candidate mới ở đường dẫn rỗng, rồi mới publish:

```bash
python3 -m pipeline.site_localization build --root . --stage all --output .cache/site-localization-candidate
python3 -m pipeline.site_localization check --root . --stage all --candidate .cache/site-localization-candidate
python3 -m pipeline.site_localization publish --root . --candidate .cache/site-localization-candidate
python3 -m pipeline.site_localization check --root . --stage public
python3 -m pipeline.site_localization prune --root .
git add -A src/data/recommended-reference
python3 -m unittest tests.test_build_recommended_reference
npm run build
npm run verify
npm run test:dist
```

Candidate strict cũng dựng và pin Lookup từ cùng review inputs. Publish không thay
Lookup; bốn file Lookup công khai phải đã trùng candidate, nếu không lệnh dừng.
Xóa candidate private sau khi public check đạt. `prune` xóa mọi thư mục
generation dưới `src/data/recommended-reference/` khác `generationId` mà
`current.json` đang pin (từ chối, không xóa gì, nếu thư mục được pin không tồn
tại); repo chỉ track generation đang pin, generation cũ vẫn còn trong lịch sử git.

Publication đã chọn cũng là inventory của route chi tiết đội; phần route tĩnh và
trang 404 nằm ở [deployment guide](deployment-guide.md). Publish generation mới
phải rebind `generationId` của `pipeline/team-route-handles.json` sang successor
trước `npm run build`; handle không được sinh lại.

Tên mùa và nhãn bộ lọc dùng chung từ `pipeline/recommended-display-map.json`.
Phe, loại binh và nguồn tái sử dụng thuật ngữ trên main. Toàn bộ 29 mùa nguồn,
kể cả mùa cũ/chưa thu thập, có tên Việt riêng; tên đã có trong dự án được ưu
tiên, tên bổ sung mang trạng thái `reference-translation`. Đây không phải xác
nhận tên chính thức hoặc quy đổi mùa nguồn sang máy chủ Việt Nam.

Builder giữ nguyên tên Trung, mã mùa, ID, giá trị lọc và thứ tự nguồn; chỉ thêm
metadata hiển thị sau khi kiểm tra corpus. Bộ chọn, thẻ và chi tiết dùng cùng
tên mùa. Mùa được chọn trực tiếp bằng bộ chọn; không có ô tìm mùa riêng và lựa
chọn không tự đổi. Chỉnh display map chỉ cần chạy lại builder; mùa
mới hoặc tên nguồn đổi phải được đối chiếu trong map trước khi xuất bản.

### Danh sách tên còn thiếu bản Việt

Sau mỗi publish, xuất worksheet nội bộ từ generation đã công bố, không cần
crawler hoặc mạng. Worksheet là file dẫn xuất, ghi vào `.cache/` (ignored), không
commit:

```sh
python3 -m pipeline.report_recommended_translations \
  --reference-dir src/data/recommended-reference \
  --identity-map pipeline/recommended-identity-map.json \
  --output .cache/recommended-missing-translations.json
```

Report hiện không còn tên thiếu bản Việt sau bản duyệt ngày 2026-09-14:
11 ô nguồn `戮力上心` hiển thị **Đồng Lòng Hợp Sức**. Đây là bản duyệt
hiển thị `translation-reviewed`, không xác nhận danh tính để xét trùng đội.
Khi còn tên thiếu, mỗi mục giữ biến thể chữ Trung, số lần xuất hiện, tối đa
ba ngữ cảnh đội/URL nguồn và `displayNameVi: null`. Nhóm theo khóa alias
chuẩn hóa và loại thực thể; không tự gộp danh tính mơ hồ. Report ghi hash map
và generation để nhận biết dữ liệu cũ; không được xuất ra website.

Worksheet không phải nguồn dịch tự động. Sau khi người dùng xác nhận, chuyển
bản dịch và bằng chứng vào identity map dùng chung, chạy lại dedup → builder
→ report. Việc tạo lại report sẽ ghi đè worksheet; lưu bản dịch được duyệt
vào map trước. Không đổi stable ID chỉ vì sửa cách viết tên Việt.

Nếu người dùng chỉ xác nhận tên Việt, chưa xác minh danh tính để xét trùng,
thêm entry `reviewStatus: "translation-reviewed"` với `kind`, `aliases`,
`displayNameVi`, `evidenceRef` và tiền tố biến thể tương ứng. Không gán stable
ID hoặc chuyển alias của bản SP/CO/40Y vào bản thường. Builder và report dùng
bản dịch này; bộ xét trùng chỉ nhận danh tính có trạng thái `reviewed`.
Ví dụ đã được người dùng duyệt: `40Y 呂布` → `40Y Lữ Bố`, `王異` → `Vương Dị`,
`SP 法正` → `SP Pháp Chính`, `SP 盧植` → `SP Lư Thực`, `SP 貂蟬` → `SP Điêu Thuyền`.

Tên tướng đầy đủ vẫn giữ tiền tố trong dữ liệu; renderer tách SP/CO/40Y thành
tag dùng kiểu cũ trên thẻ đội, chi tiết và tướng thay thế. Ba tên Vô Song đã
duyệt đều có CO: Đại Kiều, Tiểu Kiều, Tinh Thái; không bỏ chữ “Vô Song”.

`桃園結義` được duyệt là **Kết Nghĩa Vườn Đào**, loại `bond` (duyên phận).
Nguồn đặt tên này trong ô chiến pháp; builder giữ nguyên `tacticSlotsRaw`,
thêm `tacticSlotKinds` theo đúng vị trí và bản dịch trong `tacticSlotsVi`.
UI tách dòng **Duyên phận**, không tạo nút chọn chiến pháp cho mục này.
Phân loại hiển thị không sửa bằng chứng nguồn hay quyết định xét trùng.

Người dùng đã cung cấp ảnh tiếng Việt **Đồng Lòng Hợp Sức** và yêu cầu xử lý
11 ô Recommended ngày 2026-09-14. Alias `戮力上心` được duyệt cho **hiển thị**
bằng entry `translation-reviewed`, không gán stable ID và không nhập vào
identity `勠力同心`. `tacticSlotsRaw` vẫn giữ nguyên `戮力上心`; dedup vẫn coi
danh tính nguồn đó là unresolved. Không đổi chiến pháp Nội chính
`戮力上国` (**Lục Lực Thượng Quốc**) của Tào Phi hoặc từ điển Tra cứu.
Bằng chứng, giới hạn danh tính và kết quả kiểm tra nằm trong
[brainstorm Việt hoá](../plans/reports/brainstorm-260914-0236-viet-hoa-toan-bo.md).

Sau khi đổi generation trong lúc chạy `npm run dev`, khởi động lại dev server
để nạp publication mới; server đang chạy có thể vẫn giữ generation cũ.

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

Registry hiện có hai kịch bản tham khảo, đều chưa có luật đã review:
**PK-S26 · Anh Hùng Mệnh Thế** cho năm nhóm Cùng Tồn legacy và
**OG · Binh Diễn Xuân Thu** cho năm nhóm được thêm sau. Configs/evaluations
vẫn rỗng nên chưa có tier hay điểm VN theo luật. Website cho phép đọc nguồn
khi chỉ chọn kịch bản; request gameplay theo mùa của MCP cần cặp
kịch bản/luật đã review, vì vậy dữ liệu hiện tại chưa cung cấp cặp hợp lệ cho
nhánh đó.

[Báo cáo intake Cùng Tồn](../plans/260907-0233-season-team-lookup/reports/phase-02-data-validation.md)
và [inventory Recommended](../plans/260907-0233-season-team-lookup/reports/recommended-score-inventory.md)
ghi phạm vi nguồn đã kiểm ở thời điểm nhập. Chúng là bằng chứng lịch sử,
không phải quy tắc chọn mùa mới nhất hoặc xác nhận các scope khác không tồn tại.
