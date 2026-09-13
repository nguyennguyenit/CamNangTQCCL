# SGSDeck catalog kỹ thuật (private)

Snapshot chuẩn hóa của sáu catalog hiện nằm tại `data/sgsdeck/` và đạt validator
local. Ngày 2026-09-12, chủ project xác nhận quyền import trong đúng phạm vi sáu
catalog này; đây là căn cứ riêng cho project, không phải open license hoặc quyền
tái phân phối không giới hạn. Xem [source inventory](../plans/260907-0228-sgsdeck-catalog/reports/source-inventory.md#reuse-gate).

`data/sgsdeck/` là private source subtree: không có route Astro và không được
đưa vào `dist`. Boundary thực thi nằm tại
`src/lib/root-static-artifacts.ts`. Website chỉ publish projection tiếng Việt
đã review ở `data/heroes-dict.json`, `data/tactics.json` và
`data/lookup-catalog.json`; public DTO không mang provenance/source object.

## Snapshot hiện tại

| Nhóm | Record cha | Record con |
|---|---:|---:|
| generals | 202 | 0 |
| tactics | 393 | 0 |
| equipment | 114 | 90 specials |
| advisors | 39 | 0 |
| troop-mods | 16 | 192 options |
| buildings | 41 | 426 levels |

Mapping đã review gồm 79 exact-Chinese matches: 39 generals và 40 tactics. Cả
114 equipment dùng upstream ID từ Flight payload; deferred fields của `古錠刀`
được resolve thành `quality: 橙` và `slot: 武器`. Trong 90 equipment specials,
57 record nối được với equipment parent và 33 record giữ `parentSourceId: null`;
không suy đoán liên kết còn thiếu.

## Projection Tra cứu công khai

Generation public được chứng nhận local ngày 2026-09-13 có 202 tướng, 406 chiến
pháp và toàn bộ 114/90, 39, 16/192, 41/426 parent/child catalog kể trên. Số chiến
pháp public lớn hơn snapshot SGSDeck vì union còn giữ 240 identity baseline và
các nguồn local đã review; không phải 13 record SGSDeck bị tạo thêm.

Builder [`build_unified_lookup.py`](../pipeline/build_unified_lookup.py) merge
baseline + nguồn theo registry/translation fingerprint, chỉ emit allowlisted DTO.
Manifest [`lookup-manifest.json`](../data/lookup-manifest.json) bind exact ba
payload. [Quy trình build/promote/recover](unified-lookup.md) là owner publication;
private catalog builder này không ghi trực tiếp public lookup.

## Contract

Mỗi file nhóm có `schemaVersion`, `provider: "sgsdeck"`, `region: "TW"`,
`fetchedAt`, inventory và `records`. Mỗi record giữ:

```text
id, sourceId, nameZh, nameVi, canonicalRef, attributes,
provenance, sourceSeason, verification, missingFields
```

`canonicalRef` luôn là `null` hoặc `{kind,id}`. General chỉ trỏ `hero:*`, tactic
chỉ trỏ `tactic:*`; ID phải resolve theo helper runtime hiện có trên trường
`viet` của dictionary canonical. Equipment, advisor, troop-mod và building chưa
có owner canonical nên ref của chính record giữ `null`. Match danh tính không
xác nhận thông số hay khả năng dùng tại Việt Nam.

## Source và cache

`pipeline.sgsdeck_source` chỉ chấp nhận HTTPS origin `sgsdeck.com`, sáu category
root, equipment specials query và detail một segment của generals/buildings;
credentials, port, fragment, query khác và resource-key/URL lệch đều bị từ chối.
Helper `fetch_cache()` thực hiện
network acquisition có giới hạn response, checksum và atomic cache promotion;
module hiện chưa cung cấp CLI fetch/update. Raw cache/export nằm tại
`pipeline/sgsdeck-cache/` và bị Git ignore.

`pipeline.build_sgsdeck_catalog` là rebuild offline. CLI hiện yêu cầu cache
đủ sáu resource `list`, 176 general details, 41 building details và equipment
specials. Builder đối chiếu detail ID/tên/slug với list snapshot và dùng shrink
guard zero-tolerance so với snapshot cũ đã validate. Giảm parent/child count,
mất identity, nested option/level hoặc critical field làm lệnh lỗi và không thay
snapshot đã chấp nhận. Cùng cache manifest, parser, reviewed mapping và hai
dictionary canonical tạo output byte-identical. Manifest normalized ghi hash
của source manifest, mapping và hai dictionary.

## Build, validate và query

```bash
python3 -m pipeline.build_sgsdeck_catalog --cache pipeline/sgsdeck-cache
python3 -m pipeline.query_sgsdeck_catalog validate
python3 -m pipeline.query_sgsdeck_catalog query --group tactics --name "一身是膽"
python3 -m pipeline.query_sgsdeck_catalog query --group generals --name "Tào Tháo"
```

Các lệnh trên chạy với cache/snapshot hiện có. Chúng không tạo cache hoặc gọi
mạng thay người vận hành; build website cũng không chạy fetch/importer.
Query/validate cần normalized catalog, manifest và dictionary canonical, không
cần raw cache. Query giới hạn 1–100 kết quả, hỗ trợ tên Hán và tên Việt đã được
mapping, và trả record cùng provenance.

Reviewed mapping nằm tại `pipeline/sgsdeck-name-map.json`. Chỉ thêm mapping có
evidence, đúng variant và đúng record canonical. Thay mapping, dictionary,
identity registry hoặc translation là thay input có chủ ý; build candidate mới,
review diff/hash rồi promote cả generation, không chép riêng một file.

## Recovery và chuyển generation

Importer private validate trọn staged set rồi mới thay `data/sgsdeck/`; lỗi
fetch/parse/checksum/canonical reference giữ snapshot cũ.
`promote_unified_lookup.py recover` chỉ sửa transaction public bị gián đoạn,
kiểm pre/postimage, shared WIP và dependent season refs trước restore. Nó không
rollback activation đã commit; chuyển khỏi generation hiện tại cần candidate và
activation mới đã review. Không đưa private source vào public manifest để né
validator.
