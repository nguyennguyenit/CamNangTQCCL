# SGSDeck import validation

Trạng thái: owner-authorized snapshot đã import, validate và nghiệm thu kỹ thuật.
Kongming GO; không còn bulk/reuse blocker trong scope đã xác nhận.

## TDD evidence

### Private source-tree boundary

- Red: `node --experimental-strip-types --test --test-name-pattern='optional private SGSDeck' tests-js/astro-dist-contract.test.mjs`
  thất bại vì `data/sgsdeck` bị tính là source-set drift.
- Green: validator chỉ loại đúng optional real directory `data/sgsdeck/` khỏi
  public comparison; test từ chối directory lạ, file và symlink.
- Refactor/focused: ba contract test liên quan đạt 3/3. Public manifest không sửa.

### Source, cache và offline build

- Red: hai module source/build chưa tồn tại; 2 test module lỗi import đúng nguyên
  nhân trước implementation.
- Green: parser mẫu thật cho general/equipment/building/troop-mod; cache
  checksum; offline missing/partial/corrupt cases; deterministic staged build và
  parent/child counts đạt 6/6.
- Refactor: source acquisition tách khỏi offline build; cache/snapshot promote
  staging và restore backup khi lỗi. Không có network fallback trong build.

### Canonical identity và query

- Red: identity/query modules chưa tồn tại; 2 test module lỗi import trước code.
- Green: 5/5 test đạt cho base/SP/40Y, shape/kind/namespace/orphan ref, parity với
  helper Node/TS thật, query Hán/Việt cùng source identity, manifest mismatch và
  no-network query.
- Refactor: mapping reviewed là input riêng; manifest build ghi hash source,
  mapping, hero dictionary và tactic dictionary.

Focused tổng hợp cuối:

```text
python3 -m unittest tests.test_sgsdeck_source tests.test_build_sgsdeck_catalog \
  tests.test_sgsdeck_identity tests.test_query_sgsdeck_catalog
26 tests passed
```

Hậu kiểm phát hiện sáu lỗ hổng validation. Vòng TDD bổ sung chứng minh rồi sửa:
snapshot shrink, mapping lệch tên/unused, detail tráo tên/slug, dữ liệu semantic
sai, Flight equipment deferred fields và URL/resource-key ngoài allowlist.
Regression vẫn xác nhận staged output sai không thay snapshot đã chấp nhận.

## FINAL validation evidence — 2026-09-12

| Gate | Kết quả |
|---|---:|
| Focused SGSDeck | 37/37 |
| `python3 -m unittest discover -s tests` | 126/126 |
| `node --test tests-js/*.test.mjs` | 145/145 |
| `tests-js/astro-dist-contract.test.mjs` | 7/7 |
| `npm run check` | 0 diagnostics |
| `npm run build` | Green |
| `npm run test:dist` | 10/10 |
| `npm run verify` | 36 files / 33 raw assets |
| `git diff --check` | Green |

## Snapshot evidence và giới hạn

- Validate đạt: 805 parent + 708 child. Counts: 202 generals, 393 tactics,
  114 equipment + 90 specials, 39 advisors, 16 troop-mods + 192 options,
  41 buildings + 426 levels; 176 general details.
- 79 canonical refs: 39 general + 40 tactic, chỉ exact Chinese equality; mọi ref
  còn lại null/unmapped. Canonical/public input hashes không đổi.
- 114/114 equipment dùng upstream ID; `古錠刀` resolve deferred quality/slot;
  57/90 equipment specials linked và 33 unlinked.
- 176/202 general có detail; 26 general còn lại list-only theo thiết kế upstream.
- Hai rebuild cùng cache/parser/mapping/canonical inputs byte-identical.
- Catalog private không xuất hiện trong public manifest, routes hoặc 36-file dist.

Reviewer hậu sửa: **GO**. Finding cuối về equipment `sourceId` drift đã có
regression và shrink guard hiện so mọi category bằng upstream `sourceId`.

Không có unresolved blocker. UI/MCP publication, team/tier và suy luận mùa Việt
không thuộc scope plan này.
