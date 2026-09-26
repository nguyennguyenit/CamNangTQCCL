# Bộ Tra cứu thống nhất

## Phạm vi và nguồn truth

Mục **Tra cứu** đọc một generation đã xác minh gồm bốn file công khai:

- `data/heroes-dict.json`: 202 tướng;
- `data/tactics.json`: 406 chiến pháp;
- `data/lookup-catalog.json`: 114 trang bị với 90 đặc kỹ, 39 kỹ năng quân sư, 16 cải tạo binh chủng với 192 lựa chọn, và 41 công trình với 426 cấp;
- `data/lookup-manifest.json`: hash của ba payload và `generationId`.

Schema và kiểm tra quan hệ thuộc [`pipeline/build_unified_lookup.py`](../pipeline/build_unified_lookup.py). Loader trình duyệt thuộc [`js/lookup-data.js`](../js/lookup-data.js); nó kiểm đúng inventory, SHA-256, generation và quan hệ trước khi trả snapshot. UI không render một phần bundle lỗi.

`data/sgsdeck/`, `pipeline/sgsdeck-cache/`, `pipeline/lookup-inputs/`, registry danh tính, bản dịch, ledger và transaction journal là nguồn/evidence nội bộ. Chúng không phải public route và không được copy vào `dist/`. DTO công khai không chứa `provider`, `sourceUrl`, `provenance`, `sourceRecordId`, `sourceSnapshot` hay raw source object. `iconUrl` đã kiểm duyệt là trường hiển thị, không phải provenance.

Nguồn Team chuẩn/Team khác có contract attribution riêng. Không áp quy tắc ẩn nguồn của catalog lên link nguồn, nhãn mùa hoặc điểm SGSDeck đã được review của hai tab đó.

## Danh tính, nội dung và quan hệ

Baseline bất biến ở `pipeline/lookup-inputs/` giữ 112 tướng và 240 chiến pháp cũ. Mọi record cũ giữ tên Việt, canonical ID và loại biến thể; base, SP, CO và 40Y không bị nhập chung. Snapshot SGSDeck đã review bổ sung record mới nhưng không tự tạo đội, tier, điểm hoặc availability theo mùa.

`pipeline/lookup-identity.json` ghi 260 quyết định `matched` và 556 quyết định `new`. Quan hệ không đủ chứng cứ giữ `null` kèm trạng thái thay vì đoán; hiện có 33 đặc kỹ không nối parent. Translation fingerprint gắn bản dịch với nội dung nguồn. Nội dung nguồn thay đổi mà fingerprint cũ sẽ chặn build/promotion; thiếu dữ liệu nguồn được phân biệt với nội dung chưa dịch.

Giá trị SGSDeck có nghĩa thắng theo trường. Placeholder hoặc trường thiếu dùng fallback đã review; `0` và `false` là giá trị hợp lệ, không phải thiếu. Mười một delta baseline đã được allowlist và kiểm bằng ID chính xác; xem phase execution thay vì sửa fixture lịch sử.

## Build và validate candidate

Builder chỉ đọc một tập raw bytes đã capture, chạy offline, không recrawl và không đọc output của chính nó làm input:

```bash
python3 -m pipeline.build_unified_lookup build \
  --inputs pipeline/lookup-inputs \
  --source data/sgsdeck \
  --identity pipeline/lookup-identity.json \
  --translations pipeline/lookup-translations.json \
  --output pipeline/lookup-output/candidate
python3 -m pipeline.build_unified_lookup validate \
  --candidate pipeline/lookup-output/candidate
```

Review `generation.json`, ledger, coverage và toàn bộ diff trước activation. Cùng inputs/registry/translations phải tạo byte-identical output. Không thay frozen baseline bằng output mới và không dùng candidate từ một generation khác.

## Promote và recover

Promotion là local activation có lock/journal/backup, không phải deployment và không hứa atomic switch nhiều file:

```bash
python3 -m pipeline.promote_unified_lookup promote \
  --candidate pipeline/lookup-output/candidate \
  --activation pipeline/lookup-output/activation-phase3-final/activation-manifest.json \
  --transaction <transaction-id> \
  --root .
```

`--activation` là đường dẫn file JSON manifest, không phải thư mục. Các `source`
trong manifest resolve tương đối từ thư mục chứa file đó; file phải bind code/
config/test postimage đã review cùng preimage checkpoint. Promotion tạo journal
bền trước mutation, kiểm preimage dưới shared lock, rồi thay đúng các path owned.
Browser, build, legacy dictionary writer, season publisher và MCP raw reader từ
chối transaction chưa hoàn tất hoặc bundle trộn.

Sau process interruption, dùng đúng transaction đã ghi:

```bash
python3 -m pipeline.promote_unified_lookup recover \
  --transaction <transaction-id> \
  --root .
```

Recovery chỉ sửa transaction bị gián đoạn và restore path khi current bytes vẫn
bằng postimage owned; edit ngoài transaction làm nó dừng trước partial restore.
Nó kiểm dependent season refs, giữ file mùa và WIP không thuộc ownership. Nó
không hoàn tác một activation đã `committed`: `phase3-final-2` là evidence
committed hiện tại, còn `phase3-certified-first-activation` chỉ là rehearsal
`rolled-back`. Muốn chuyển khỏi generation đã commit cần một activation mới đã
review; không xóa lock hoặc chép preimage thủ công.

## Consumer và publication contract

Route canonical của Tra cứu là `/tra-cuu/?group=<nhóm>&id=<id>`; hash cũ `#lookup`, `#heroes`, `#tactics` và dạng query trong hash `#lookup?group=<nhóm>&id=<id>` được Landing chuyển tiếp sang đường dẫn đó (dạng `#lookup/<nhóm>/<id>` không thuộc contract) mà không rewrite history ngoài navigation do người dùng thực hiện. Sáu chip nhóm, tìm Việt bỏ dấu/Hán/Hán-Việt, phân trang, modal focus trap, Escape, Back/Forward, mobile và light/dark thuộc contract trình duyệt.

Astro build capture một website-display publication snapshot. Sidecar pin exact bytes/generation của Lookup cùng source JSON hiển thị và generation Recommended; HTML và mọi route raw đều dùng snapshot đó. Candidate strict của `site_localization` tự dựng/validate Lookup từ review inputs và chỉ publish khi bốn file Lookup công khai đã trùng candidate. Nếu source hash, HTML pin, route hoặc generation bị interleave, build/verifier dừng toàn bộ khởi tạo thay vì phát hành artifact trộn hoặc render raw.

MCP vẫn có tám tool và bốn search kinds `hero`, `tactic`, `team`, `book`. Bốn nhóm catalog mới chỉ thuộc website. Raw project root được nhận khi hai lookup sidecar và dictionary bytes coherent; packaged MCP root được nhận theo `manifest.json` sáu/mười một artifact. Hai lookup sidecar website được validate ở ingress nhưng không emit thành MCP artifact hay kind. Root trộn hai format bị từ chối.

## Regeneration triggers

- Đổi source snapshot, identity decision, translation hoặc merge rule: build/validate candidate và review generation mới.
- Đổi hero/tactic/catalog bytes: promote cả bundle bốn file; không thay từng file.
- Đổi semantic runtime MCP: chạy `npm --prefix mcp-worker run generate:workflow-build`, commit generated identity rồi chạy `check`.
- Đổi public manifest/build verifier/router: chạy root check, build, dist verifier, dev contract và Astro E2E.
- Đổi raw-ingress/MCP packaging: chạy MCP `check` và `test:worker`; build release assets chỉ trong clean exact-SHA checkout.
- Đổi code/UI source được policy localization theo dõi: review diff, cập nhật exact source binding, dựng/check/publish candidate `--stage all`, rồi chạy public check; không sửa sidecar hay generation bằng tay.

Release/deploy, Worker asset publication và rollback production cần authorization riêng. Local acceptance không cấp quyền cho các thao tác đó.
