---
phase: 2
title: "Nhóm Tra cứu Kỳ lược (gồm MCP catalog)"
status: pending
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 2: Nhóm Tra cứu Kỳ lược (gồm MCP catalog)

## Goal
Thêm nhóm Tra cứu thứ 8 là `ky-luoc`, với trang `/tra-cuu/ky-luoc/` và `/zh/tra-cuu/ky-luoc/`. Danh sách lọc được theo loại thẻ và độ hiếm. Mỗi mục có trang riêng, meta và JSON-LD đúng nhóm. MCP phát entity và search kind cho nhóm này. Phase này chỉ dựng candidate trong scratch; promote để Phase 6.

## Context
- Khóa catalog đang cố định ở 3 nơi: `pipeline/build_unified_lookup.py:1981`, `js/lookup-data.js:170`, `pipeline/lookup_route_handles.py:106-111` (`load_corpus`).
- Nhóm và slug: `js/unified-lookup.js:15`, `js/lookup-ids.js:266` (`LOOKUP_GROUP_SLUGS`), `GROUP_BY_KIND`, `lookupItemPath` (l.342).
- Ledger route: `GROUP_KINDS` chỉ có một tiền tố cho mỗi nhóm (comment l.48). `ledger_problems` đòi `set(section) == set(GROUP_KINDS)` (l.189-192), nên `--write` từ chối ledger 7 nhóm (l.290). <!-- Red-team F9 -->
- Trang: `src/pages/tra-cuu/[group]/[slug].astro`, `src/pages/zh/tra-cuu/[group]/[slug].astro` (đã có), `src/lib/lookup-pages.ts`, `src/lib/lookup-item-pages.ts`. Hàm `describe()` (l.50-95) đẩy nhóm lạ vào nhánh "công trình". `TERM_GROUPS` ở l.139. <!-- Red-team F12 -->
- MCP:
  - `pageIdsByGroup` dựng từ `LOOKUP_GROUP_SLUGS`, sau đó `parseLookupDetailLedger` gọi `exactKeySet` (`mcp-worker/src/data/publication-builder.ts:823-834`, `js/lookup-detail-ledger.js:83`).
  - Vì vậy phải phát entity. Các chỗ cần sửa: `CATALOG_FIELDS` (l.247-253), `catalogRows` (l.312-316), `CATALOG_GROUPS`/`CATALOG_KINDS`/`KIND_GROUP` (`publication-projection.ts:239-263`), `SEARCH_KINDS`/`PUBLIC_KIND` (`research/catalog-handlers.ts:13-34`). <!-- Red-team F2 -->

## Thiết kế
- **Catalog:** 2 khóa phẳng `qilueStrategies` và `qilueCards`. Kind trùng với tiền tố id: `qilue-strategy`, `qilue-card`. Cả hai thuộc nhóm `ky-luoc`. <!-- Red-team F15 -->
- **Row công khai:**
  - Chung: `aliasesZh: [nameZh]`. Không bao giờ chứa biến thể.
  - Thẻ: `type`, `rarity`, `targetVi`, `effectVi`.
  - Phương lược: `cardTypes`, `descriptionVi`, `buffVi`.
  - Cả hai có `lookup.conditions` kind `season` cho PK-S27, kèm `textZh`.
- **Builder:** `_apply_client_qilue` trong `pipeline/build_unified_lookup.py`, đọc từ `client_tactics`. File này đã được hash và đã được `site_localization.compile_candidate` truyền vào, nên không thêm cờ CLI hay input mới. <!-- Red-team F5 -->
- **Bản zh:** `nameZh` lấy từ input. `effectZh` và `descriptionZh` đi qua `zhTexts` kind `translation`, có `viSha256` và cờ "dịch từ tiếng Việt". `ZH_SOURCE_HOSTS` giữ nguyên. <!-- Red-team F10, Validation Q2 -->
- **Hồ sơ thẻ:** tên, chữ Hán, loại, độ hiếm, đối tượng, hiệu ứng, và các phương lược dùng được loại thẻ này (tính từ `cardTypes`).
- **Hồ sơ phương lược:** mô tả, buff, 2 loại thẻ kèm link sang danh sách đã lọc.
- **Ledger route:** `GROUP_KINDS["ky-luoc"]` nhận 2 tiền tố (đổi kiểu thành tuple và sửa comment). Thêm bước migration để `--write` coi nhóm mới vắng mặt là `{}` (chỉ với nhóm có trong `GROUP_KINDS` mà ledger chưa có), sau đó tự đặt pin.
- **SEO:** `describe()` có nhánh `ky-luoc`. Chữ dịch zh không vào meta (`docs/unified-lookup.md:72`). Thêm `ky-luoc` vào `TERM_GROUPS` (DefinedTerm).
- **Tìm kiếm và MCP:** kết quả luôn ghi nhãn nhóm. Ví dụ tìm "Cường Công" ra 2 kết quả, một nhãn "Chiến pháp", một nhãn "Kỳ lược".

## Tests Before (viết trước, phải fail)
- `tests/test_build_unified_lookup.py`:
  - Catalog có 5 và 40 row.
  - `aliasesZh == [nameZh]`.
  - Thiếu khóa thì build dừng.
  - `zhTexts` stale thì build dừng.
  - `conditions` có mùa.
- `tests/test_lookup_route_handles.py`:
  - Chạy trên **bản sao ledger thật 7 nhóm**: `--write` thêm nhóm `ky-luoc` với 45 handle, slug cũ không đổi.
  - Ledger bị sửa tay vẫn bị từ chối.
- `tests-js/lookup-ids.test.mjs`: `lookupItemPath("qilue-card:bo-tri-thap-dien")` ra `/tra-cuu/ky-luoc/bo-tri-thap-dien/`.
- `tests-js/lookup-data.test.mjs`: catalog thiếu khóa mới thì reject.
- `tests-js/lookup-master.test.mjs`: lọc theo loại và độ hiếm.
- `tests-js/unified-lookup.test.mjs`:
  - Tìm 十面埋伏 không ra `qilue-card:*`.
  - `lookupDisplayName(card, "zh") === nameZh`.
- `tests-js/astro-dist-contract.test.mjs`:
  - Bảng slug (l.138) có `ky-luoc`.
  - Có 45 trang vi và 45 trang zh.
  - Meta và JSON-LD của 1 thẻ và 1 phương lược không chứa "công trình"/"建筑"; meta zh không chứa chữ dịch.
- MCP vitest:
  - Publication có 45 entity `ky-luoc`.
  - `tqccl_search("Bố Trí Thập Diện")` ra thẻ.
  - `tqccl_search("Cường Công")` ra cả tactic lẫn phương lược, có nhãn nhóm.
- E2E (`tests-e2e/unified-lookup.spec.mjs`, `lookup-item-pages.spec.mjs`, `zh-locale.spec.mjs:88`): mở nhóm, lọc Mưu ra 8 thẻ, mở trang Bố Trí Thập Diện thấy hiệu ứng nguyên văn.

## Tasks & Steps
1. Viết test, xác nhận chúng fail.
2. Builder và validate Python, gồm `_apply_client_qilue`, `_build_model`, `_validate_payloads`, `validate_candidate`.
3. Ledger route: sửa `GROUP_KINDS`, `load_corpus`, viết migration và test của nó.
4. JS: `lookup-ids.js`, `unified-lookup.js`, `lookup-data.js`, `lookup-master.js`, `lookup-detail.js` (`ZH_VALUES` cho loại, độ hiếm, đối tượng).
5. Astro: `lookup-pages.ts` (nhãn, mô tả), `lookup-item-pages.ts` (`describe`, `TERM_GROUPS`). Nhãn i18n đi qua `pipeline/site_localization.py` và receipt review.
6. MCP: sửa các chỗ ở mục Context. Fixture `mcp-worker/test/fixtures/lookup-roots.ts` và `tests-js/fixtures/lookup-bundle-fixtures.mjs`.
7. Dựng candidate lookup vào scratch (`--candidate` ra thư mục tạm) và chạy validate. **Không promote.**

## Regression gate
- `python3 -m unittest discover -s tests`
- `npm run test:node`
- `npm --prefix mcp-worker test`
- `npm run test:dist` và các e2e ở trên (chạy trên candidate được dựng tạm)

## Todo
- [ ] Test trước fail
- [ ] Builder và validate
- [ ] Migration ledger route kèm test trên ledger thật
- [ ] JS lookup
- [ ] Astro (describe, TERM_GROUPS, nhãn)
- [ ] MCP entity và search kind
- [ ] Candidate scratch validate
- [ ] Regression gate pass

## Success Criteria
Candidate có nhóm `ky-luoc` qua mọi validate. Các nhóm cũ không đổi gì ngoài manifest và hash. MCP publication qua.

## Risk
- Quên một chỗ khóa catalog thì gate dừng. Đây là thất bại an toàn.
