# Phase E2: tier JP trong generation Recommended và facet nguồn

- Ngày: 2026-11-18 (Asia/Saigon). Branch `feat/ja-locale-e2-tier`, tạo từ `origin/feat/ja-locale` (`162d250`) rồi merge `origin/feat/ja-locale-e1-tier` (`a22d026`). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-e2`. Chưa merge vào `feat/ja-locale`.
- Generation Recommended mới: `2bd854de…` (thay `c96c9871…`, đã prune).

## Kết quả

7 đội PK-S26 có tier JP (Kazten 都尉武将使用テンプレ編成, đăng 2026-06-19), đúng bằng số entry `tierAssignable` của E1: 2 `exact`, 5 `heroes-only`. Không có đội nào ở mùa khác. 17 đội `none` và 3 đội `needs-review` không được chiếu (issue #128).

| Đội VN (`sourceConfigId`) | Tier SGSDeck | Tier JP | Mức khớp |
|---|---|---|---|
| `yxms-027-周劭富貴騎` Chu Thiệu Phú Quý Kỵ | T0.5 | T0 | exact |
| `yxms-014-皇甫法關盾` Hoàng Phủ Pháp Quan Thuẫn | T0.5 | T0 | exact |
| `yxms-028-沈姮富貴騎` Thẩm Hằng Phú Quý Kỵ | T0.5 | T0 | heroes-only |
| `yxms-044-拒馬弓` Cự Mã Cung | T0.5 | T0 | heroes-only |
| `yxms-024-蕭芷太尉盾` Tiêu Chỉ Thái Úy Thuẫn | T0.5 | T0.5 | heroes-only |
| `yxms-010-周劭蜀弓` Chu Thiệu Thục Cung | T0 | T0.5 | heroes-only |
| `yxms-050-千機盾` Thiên Cơ Thuẫn | T0.5 | T0.5 | heroes-only |

## Thay đổi

**Pipeline** (`04470fd`):

- Module mới `pipeline/recommended_jp_tiers.py` kiểm hình dạng bảng khớp (schema 1, URL https, ngày `YYYY-MM-DD`, tier trong `T0…T3`, `match.kind`, `reviewStatus`) và chiếu entry gán được tier thành `tierSources: [{source: "jp", tierRaw, matchKind, url, publishedAt}]` trên hàng index và detail. Builder dừng khi hàng đích không có, lệch mùa (so `sourceSeasonId` của hàng index với `source.vnSourceSeasonId`), vắng ở detail, hoặc bị hai entry trỏ tới.
- `build_recommended_reference.py`: `build_generation`/`prepare_publication_inputs` nhận `jp_tiers_bytes` (CLI `--jp-tiers`), ghi `jpTiersHash` vào descriptor khi có bảng; kiểm `tierSources` của index và detail phải bằng nhau. `tierSources` nằm trong nhóm trường hiển thị của `raw_source_record`, nên raw lineage, `recommendedCorpusHash` của ledger Đội khác, content links và identity map không đổi. Không sửa ledger hay identity map.
- `site_localization.py`: `JP_TIERS_PATH` nằm trong `inputHashes` của candidate và được truyền vào `build_generation`. Đổi bảng khớp là sinh generation mới.
- Mã tướng nội bộ `do-uy:<tên SGSDeck>` của E1 không ra bản phát (test kiểm chuỗi `do-uy:` vắng trong mọi file generation). Output công khai chỉ có tier, mức khớp, URL và ngày đăng; tướng vẫn là tướng của hàng SGSDeck.

**Giao diện** (`f76da47`):

- Facet nguồn sẵn có (`source`, nhãn nhóm "Bộ đội hình") có thêm giá trị `jp` (`?source=jp`); `referenceFacetValues` trả `jp` cho hàng có tier JP. Không thêm khóa URL hay khóa facet mới, nên `SECTION_QUERY_KEYS`, `REPEATABLE` và chữ ký SSR không đổi. Chip: vi "Tier JP", zh "日服等级", ja "日本版ティア"; đếm theo mùa như các facet khác (PK-S26: 7, PK-S27: không có chip).
- Thẻ và bảng: huy hiệu `JP <tier>` cạnh tier SGSDeck, title ghi nguồn và ngày đăng; đội `heroes-only` có nhãn phụ "khác chiến pháp" / "战法不同" / "戦法違い".
- Trang chi tiết: khối "Tier JP" (trước khối Phạm vi) có tier, nguồn "Kazten · 2026-06-19" (bản ja: "カズ天 · 2026-06-19") link tới bài (`validateHttpSourceUrl`, `rel="noopener noreferrer"`), câu giải thích khi khác chiến pháp và câu "đánh giá cá nhân của tác giả, tier SGSDeck giữ nguyên". Các tier khác trên site không có dòng ghi nguồn riêng, nên khối này theo mẫu `detail-facts` của khối Phạm vi.

**Panel `?config=` bản ja** (`4182a6c`, chú thích sửa ở `40f2d81`): `seasonConfigDetail` ẩn đánh giá, mô tả điều kiện, nhãn/nội dung hiệu ứng và ghi chú khi có chữ Hán, rồi thêm đúng một dòng 「中国語の原文しかない説明は、日本語訳がないため表示していません。」 trước nút đối chiếu kho. Chuỗi này chuyển từ `recommended-reference-render.js` về `render.js` (`SOURCE_PROSE_MISSING_JA`) để hai nơi dùng chung, không có chuỗi trùng nghĩa. Bản vi/zh dựng như cũ.

## Test

- `tests/test_recommended_jp_tier_projection.py` (8 test, viết trước code, đỏ → xanh): chiếu đúng entry reviewed + khớp, giữ `tierRaw`, không lộ `do-uy:`, hash vào manifest; đổi bảng sinh generation mới, không có bảng thì giữ dạng cũ; dừng khi đội lạ, lệch mùa, trỏ hai lần, vắng ở detail; kiểm hình dạng bảng; `tierSources` ngoài raw lineage; index/detail phải khớp; bảng thật của repo cho đúng 7 hàng (2 exact + 5 heroes-only). Fixture detail không mang `sourceSeasonId` như input thật — lỗi này lộ ra ở lần publish đầu và đã có test giữ.
- `tests/test_site_localization.py`: candidate thật có `pipeline/recommended-jp-tiers.json` trong `inputHashes`, `jpTiersHash` đúng, đúng 7 hàng có `tierSources`, cùng mùa `pk-s26`.
- `tests-js/recommended-reference-state.test.mjs`: giá trị facet, đếm theo mùa (PK-S26 2, PK-S27 0, tất cả 2), đọc `source=jp` từ URL (bỏ trùng), OR với `team-intro` trong nhóm, AND với `tier`, nhãn phụ.
- `tests-js/team-view-trees.test.mjs`: huy hiệu trên thẻ/bảng và khối chi tiết ở cả vi/zh/ja, link chỉ khi URL http(s).
- `tests-e2e/recommended-browser.spec.mjs`: trang tĩnh `/doi-chuan/pk-s26/` có đúng 7 thẻ mang tier JP (5 nhãn phụ); `/doi-chuan/?season=pk-s26` chip "Tier JP 7", bấm chip ghi `source=jp`, còn 7 thẻ, giữ qua reload; mùa mặc định không có chip; trang chi tiết có khối Tier JP với link Kazten. Trang mùa `/doi-chuan/pk-s26/` là trang tĩnh không có bộ lọc, nên phần lọc chạy trên danh sách `/doi-chuan/?season=pk-s26`.
- `tests-e2e/season-lookup.spec.mjs`: ca mới mở panel `?config=` ở `/ja/doi-khac/` với dữ liệu chữ Trung, khẳng định chữ Trung không hiện, có một dòng báo thiếu, nhãn ja vẫn hiện. Route fixture của spec nhận thêm tiền tố `/zh/`, `/ja/`.

## Ghim localization

Commit cuối riêng `chore(data): ghim lại hash nguồn`: 4 hash (`js/recommended-reference-render.js`, `js/recommended-reference-state.js`, `js/render.js`, `js/team-filter-section.js`); `inventory` stale 0, unknown 0, digest `409a1481…` như `baseline.notes`. Chuỗi `build → check → publish → check --stage public → prune` cho generation `2bd854de…`; `team_route_handles --rebind/--check` giữ 1.681 handle, thêm 0, bỏ 0; `lookup_route_handles --check` 983 id, 57 luật. `pipeline/team-route-handles.json` chỉ đổi dòng `generationId`.

## Kết quả kiểm

Chạy trên trạng thái cuối (sau commit ghim). Máy tải 11–20 (session khác chạy song song), không có lần nào phải chạy lại vì timeout.

| Lệnh | Kết quả |
|---|---|
| `npm run check` | xanh (localization public check; `astro check` 0 lỗi, 0 cảnh báo, 2 gợi ý có sẵn) |
| `npm run build` | xanh, 8.698 trang, 19 s |
| `npm run verify` | xanh, "Verified 9136 dist files", `zh-gaps`/`ja-gaps` khớp |
| `npm run test:dist` | 69/69 |
| `npm run test:node` | 945/945 |
| `python3 -m unittest discover -s tests` | 551 OK (13 skip); gồm `test_site_localization` (lỗi stale hash mà báo cáo E1 ghi đã hết sau khi `feat/ja-locale` ghim lại) |
| Playwright `recommended-browser`, `season-lookup`, `ja-locale`, `zh-locale`, `team-detail-pages`, `doi-chuan-roster-badges`, `landing` | 203/203 (cấu hình tạm cổng 4194, không commit); chạy lại 2 ca mới sau lần build cuối: 2/2 |

Chưa chạy `npm run test:e2e` toàn bộ và `worker`/`mcp-worker` (ngoài danh sách kiểm của brief; E2 không sửa hai thư mục đó).

## Output đổi (có chủ đích)

So build của `a22d026` (base) với head bằng `compare-locale-output.mjs` (chuẩn hoá ngày build và pin generation): đổi 29 file, thêm 0, mất 0. Không trang nào khác đổi, kể cả `/doi-chuan/` (mùa mặc định PK-S27) và mọi trang PK-S27.

- Trang chi tiết của 7 đội, ở cả 3 locale (21 file): `doi-chuan/pk-s26-chu-thieu-phu-quy-ky/`, `pk-s26-chu-thieu-thuc-cung/`, `pk-s26-cu-ma-cung/`, `pk-s26-hoang-phu-phap-quan-thuan/`, `pk-s26-tham-hang-phu-quy-ky/`, `pk-s26-thien-co-thuan/`, `pk-s26-tieu-chi-thai-uy-thuan/`, cùng bản `zh/…` và `ja/…`.
- Trang mùa `doi-chuan/pk-s26/`, `zh/doi-chuan/pk-s26/`, `ja/doi-chuan/pk-s26/` (3 file).
- Dữ liệu generation: `data/recommended/<gen>/index.json`, `manifest.json`, `details-s-d8a6775f….json` (scope Giao chiến PK-S26).
- Chữ thuần cho LLM: `llms/doi-chuan/pk-s26.txt`, `llms-full.txt` (thêm khối Tier JP của 7 đội).

## Việc tồn / ghi chú cho người ghép

- Người ghép bỏ commit ghim cuối và chạy lại chuỗi ghim trên kết quả ghép (phase-08). Generation mới phải có `jpTiersHash`.
- `docs/season-team-data.md` cần thêm input `--jp-tiers` và quy tắc chiếu `tierSources` (thuộc phase H theo bảng sở hữu docs).
- `mcp-worker` đọc generation qua projection riêng và bỏ qua trường lạ; `tqccl_get_team` chưa trả tier JP. Nếu muốn MCP có tier JP thì cần việc riêng ở `mcp-worker`.
- Phase-05 dự kiến khóa facet mới `tierSource`; quyết định điều phối (Q2) là giá trị `jp` trong facet `source`, nên `SECTION_QUERY_KEYS`/`REPEATABLE` không đổi.
- Nhãn chip "Tier JP"/"日服等级"/"日本版ティア" và văn bản khối chi tiết là chữ mới; tên "Kazten"/"カズ天" lấy theo tên site/tác giả. Thuật ngữ ja nên vào đợt soát glossary của phase H.

## Câu hỏi chưa giải

- Nhãn chip trong nhóm "Bộ đội hình" ("Tier JP") có cần đổi tên nhóm khi nhóm chứa cả bộ sưu tập đội cũ lẫn nguồn tier không? Bản này giữ tên nhóm cũ theo quyết định "không thêm khóa facet mới".
