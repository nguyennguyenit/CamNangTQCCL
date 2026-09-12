---
phase: 1
title: "Contract nguồn và inventory"
status: completed
priority: P2
dependencies: []
---
# Contract nguồn và inventory

## Context
[Kiến trúc](../../docs/system-architecture.md), [review ban đầu](../reports/review-260907-0228-sgsdeck-plan.md), [plan mùa](../260907-0233-season-team-lookup/plan.md).

## URL nguồn

- generals: https://sgsdeck.com/generals
- tactics: https://sgsdeck.com/tactics
- equipment: https://sgsdeck.com/equipment
- advisors: https://sgsdeck.com/advisors
- troop-mods: https://sgsdeck.com/troop-mods
- buildings: https://sgsdeck.com/buildings
- Điều khoản: https://sgsdeck.com/terms

Đã kiểm endpoint/title tương ứng ngày 2026-09-08. Chỉ sáu category đầu là inventory catalog; điều khoản là evidence về reuse, không phải nhóm dữ liệu thứ bảy. Phase này ghi URL cuối sau redirect, tab/detail/pagination và phạm vi host/path được phép vào `reports/source-inventory.md`; không coi việc URL truy cập được là quyền bulk hoặc bằng chứng đủ coverage.

## Requirements / thiết kế
Thống nhất metadata với phase 1 plan mùa. Catalog nguồn không tự quyết định scenario/ruleset Việt.

```text
catalog: schemaVersion, provider, region, fetchedAt, inventory, records[]
record: id, sourceId, nameZh, nameVi?, canonicalRef, attributes,
        provenance {provider, region, sourceUrl, fetchedAt, sourceUpdatedAt?},
        sourceSeason {label?, number?, scenarioName?} | null,
        verification {identity, vnAvailability}, missingFields[]
canonicalRef: null | {kind: "hero" | "tactic", id: string}
```

- Provider sgsdeck, region TW. Ngày fetch khác ngày hiệu lực luật chơi; sourceSeason chỉ là nhãn upstream, không ánh xạ số mùa sang VN.
- ID sgsdeck:<category>:<sourceId>; ưu tiên upstream ID, fallback slug namespaced khi không có ID. Không dùng array index. Variant thường/SP/CO/40Y giữ riêng.
- `canonicalRef` bắt buộc hiện diện, mặc định null. Chỉ ghi object khi identity đã matched bằng evidence reviewed và ID resolve tới đúng thực thể/variant trong corpus canonical hiện có; không dùng tên hiển thị, `sourceId` hoặc `sgsdeck:*` làm canonical ID. Ambiguous/unmapped giữ null. Ref chỉ xác nhận danh tính, không xác nhận stats hoặc khả năng dùng ở VN.
- Contract ref dùng chung dạng `null|{kind,id}` với plan mùa. Trong sáu nhóm catalog này, `generals` chỉ nhận `kind:"hero"`, ID `hero:*` theo `canonicalHeroId(canonicalRecord.viet)` của `js/hero-identity.js` trên `data/heroes-dict.json`; `tactics` chỉ nhận `kind:"tactic"`, ID `tactic:*` theo `canonicalDictionaryId("tactics", canonicalRecord.viet)` của `mcp-worker/src/data/entity-identity.ts` trên `data/tactics.json`. `canonicalRecord` là record từ dictionary Việt đã khớp. Kiểm tồn tại và đúng danh tính, không chỉ kiểm prefix. Không tạo namespace/slug rule riêng.
- Equipment/advisors/troop-mods/buildings chưa có canonical owner tương ứng nên ref của chính record giữ null; quan hệ tới tướng/chiến pháp là link riêng, không biến quân sư thành tướng hoặc cải tạo thành chiến pháp gốc. Không thêm loại entity vào public runtime/MCP. Biến thể chưa có đối ứng canonical, kể cả 40Y, giữ null thay vì ghép về bản thường.
- Cơ chế trò chơi giữ ngữ nghĩa, điều kiện, target và đơn vị qua dữ kiện/tóm tắt tự biên soạn có nguồn. Không mirror bài hướng dẫn/lore/code/ảnh. Field chưa diễn giải có trạng thái rõ và link, không giả dữ liệu.
- Điều khoản 2026-08-20 chưa có license mở, cấm bulk/mirror thương mại chưa được phép. Trước bulk ingestion xác định phương thức tái sử dụng phù hợp phạm vi project. Nếu cần quyền/export, chuẩn bị manifest yêu cầu cụ thể; không bypass giới hạn nguồn. Attribution không tự thay thế quyền reuse.
- `data/sgsdeck/` là source subtree private, không thuộc public route manifest. Source-tree validator chấp nhận duy nhất subtree này như optional real directory, giữ exact public inventory và guard entry lạ/symlink.

## Files
- Create docs/sgsdeck-catalog.md: owning contract metadata và private/public source layout; plan mùa tham chiếu.
- Read pipeline/build_dict.py, pipeline/hanviet.py, pipeline/tactic-name-overrides.json, data/heroes-dict.json, data/tactics.json, src/lib/public-artifact-manifest.mjs, src/lib/root-static-artifacts.ts, tests-js/astro-dist-contract.test.mjs và scripts/verify-astro-dist.mjs.
- Read js/hero-identity.js, mcp-worker/src/data/entity-identity.ts và mcp-worker/src/data/snapshot-index.ts để chốt canonicalRef đúng identity consumer đang dùng.
- Report inventory/coverage/access tại reports/source-inventory.md trong plan này.

## Steps / success

### TDD — chuẩn bị acceptance cases

Phase này chỉ khảo sát/contract: lập ma trận mẫu thật cho sáu nhóm, ID/variant, field thiếu và mùa theo vùng để phase 2 viết test trước code. Không tạo test tài liệu hình thức hoặc tuyên bố Red/Green khi chưa có implementation.
- [x] Kiểm sáu entry points trong mục URL nguồn, tab/detail/pagination và điều khoản; ghi thời gian/count/source, URL cuối và allowlist host/path. Không tự mở rộng sang Recommended hoặc dữ liệu tài khoản.
- [x] Mẫu thật mỗi nhóm: tướng thường/SP/CO/40Y/nội chính, tactic chưa có season, item+đặc kỹ, quân sư+tướng, cải tạo chuyển binh, công trình nhiều cấp.
- [x] Chốt per-group field map, identifier và phân biệt list thiếu/detail có.
- [x] Review metadata liên plan; xác định staged output/manifest/reference validation.
- [x] Ghi contract canonicalRef trên vào docs owner; chuẩn bị cases sai shape/kind/namespace, ID không tồn tại, nhầm variant và parity với helper hiện có cho phase 3. Chốt đầu vào cache/export và phân biệt fetch/update với rebuild offline cho phase 2; clone query/validate từ normalized catalog không phụ thuộc raw cache.

Chủ project đã xác nhận quyền import trong scope sáu catalog; Kongming GO. Inventory, contract, field map và acceptance cases đã được dùng để import/validate snapshot thực.

## Validation, risk, rollback
So nguồn công khai và record mẫu, không lấy một mẫu làm bằng chứng toàn bộ coverage. Nguồn hạn chế reuse hoặc field thiếu: ghi rõ phương án export/đối chiếu, không đánh dấu import hoàn thành. Phase này chỉ tạo contract/report; rollback đúng docs mới.
