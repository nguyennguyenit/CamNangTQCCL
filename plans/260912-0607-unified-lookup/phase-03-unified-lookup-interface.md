---
title: "Phase 3: Giao diện thống nhất và tích hợp generation"
status: todo
---

# Phase 3: Giao diện thống nhất và tích hợp generation

## Overview

Trạng thái **pending**; sau [Phase 2](phase-02-merge-and-vietnamese-content.md);
effort 2–3 ngày. Giao diện sáu nhóm dùng một bundle đã verify; checkpoint này
sở hữu loader, manifest/preflight, promotion đầu tiên và compatibility canaries.
[Plan](plan.md), [consumer research](reports/research-consumers.md),
[design guidelines](../../docs/design-guidelines.md).

## Bằng chứng scout đã đọc

| # | Current source (repository root) | Fact/hệ quả |
|---|---|---|
| 1 | `src/pages/index.astro:29–56` | Hai nav/sections heroes+tactics riêng; owner đổi shell. |
| 2 | `js/app.js:47–69` | Hash whitelist nguyên chuỗi, Back/hashchange cần alias parser. |
| 3 | `js/app.js:77–109` | Hai dictionaries dùng chung cho lookup/tracker/soi/kho. |
| 4 | `js/app.js:110–111` | Catch hiện lỗi ở Team PK; cần localized lookup error boundary. |
| 5 | `js/hero-detail.js:22–36` | Resolve tactics bằng Chinese; canonical IDs chưa có. |
| 6 | `js/hero-detail.js:39–44` | `stats?.[k] || "—"` nuốt số 0. |
| 7 | `js/hero-detail.js:57–68`; `js/tactics.js` | Effect raw/fallback Chinese có thể hiện; VI profile cần projection riêng. |
| 8 | `js/match-dict.js:51–70,144–155` | CJK chỉ so chinese; search mặc định limit 60. |
| 9 | `src/lib/public-artifact-manifest.mjs`; `root-static-artifacts.ts:45–72` | Root inventory phải exact allowlist. |
| 10 | `src/lib/root-static-artifacts.ts:18–42,94–101` | Private sgsdeck và symlink/root guards đã có; không nới wildcard. |
| 11 | `scripts/verify-astro-dist.mjs:36–60` | Dist exact paths/bytes; cần thêm generation coherence. |
| 12 | `mcp-worker/scripts/build-worker-assets.ts:95–125` | Source validator hiện reject directories; private sgsdeck cần scoped checked exception. |
| 13 | `docs/design-guidelines.md:48–59`; consumer research | Tab semantics/modal focus là required touched-UI gap; chưa có a11y proof. |

## Architecture: một cửa vào, một tập dữ liệu

`js/lookup-data.js` export `validateLookupBundle(manifest,rawFiles)` và
`loadLookupBundle(fetchFn)`; rawFiles keys đúng ba basenames ở Phase 2, values
Uint8Array. Validate exact manifest schema/digests, SHA-256 raw bytes, derived
generationId, JSON shapes and cross-record IDs trước trả
`{heroes,tactics,catalog,manifest,rawFiles}`. Consumers không mutate buffers;
route/packager dùng đúng verified bytes này, không mở lại files hoặc stringify.
Không parse rồi stringify để kiểm hash. Không tải private source/ledger.
Hai exports async, dùng WebCrypto; browser/Node call sites phải await. Existing
root `readPublicArtifact/staticPathsFor` và worker source validator đều async,
propagate await/error đến callers và test no-unawaited-promise behavior.
`FilesystemDataSource.loadCandidate` là runtime caller bổ sung cho CLI/stdio;
thêm FilesystemDataSource làm entrypoint và khai báo exact transitive semantic
closure gồm source này cùng `js/lookup-data.js` ngay checkpoint này. Worker builder
reuse helper; helper đã được băm qua semanticFiles, không duplicate trong buildInputs.

`app.js` nạp verified dictionaries một lần và truyền cùng objects cho lookup,
tracker, analyze, roster, faction derivation. Không dictionary v1 ở scanner và
v2 ở lookup. Bundle lỗi: không accept một phần; localized error ở lookup và
các dictionary-dependent sections, team-only sections vẫn dùng independent data.
Không fallback sang unverified old array để giấu mixed generation.

`src/lib/root-static-artifacts.ts` dùng validator trên raw files, kiểm private
journal trước/sau read và manifest hash trước/sau đọc; build/read fail khi
transaction incomplete hoặc bytes không khớp. `verify-astro-dist.mjs` kiểm
coherence bundle trong dist ngoài existing exact bytes checks. Worker asset
builder validate bundle trước khi chọn heroes/tactics cho MCP snapshot; không
emit supplemental catalog/lookup manifest vào MCP artifact inventory.

MCP filesystem ingress `mcp-worker/src/data/filesystem-data-source.ts` cũng phải
kiểm coherence trước `createDataManifest`; CLI/stdio không qua worker packaging.
Có bất kỳ lookup sidecar, dictionary `lookup` marker hoặc active/incomplete
transaction thì bắt buộc đủ manifest + ba payload hợp lệ. Chỉ root legacy không
có các dấu hiệu này được dùng nhánh cũ, để historical v1 fixtures vẫn chạy.
Bracket việc đọc bằng manifest/transaction observations; dùng đúng verified
hero/tactic buffers cho MCP snapshot, giữ error `DATA_UNAVAILABLE`. Existing
cached snapshot bất biến trong process; restart stdio để nhận generation mới,
không thêm hot reload. Astro/worker/MCP phải test thay file giữa preflight và read:
không được kiểm A rồi serve/package bytes B chưa kiểm.

### Giao diện chọn dùng

- Thay hai top-level nav bằng **Tra cứu**, section `section-lookup`, hash `#lookup`.
  Một search, chips Tất cả + sáu nhóm, count và card list gọn. Không source selector.
- Route schema `#lookup?group=<heroes|tactics|equipment|advisors|troop-mods|buildings>&id=<encoded canonical ID>`.
  `group` optional (all), `id` optional. Reject duplicate/unknown params and
  wrong kind/id combination bằng lookup error; không fetch arbitrary URL từ hash.
  `#heroes` và `#tactics` alias preselect group trong cùng section, không rewrite
  alias khi initial load hoặc Back/Forward. Invalid unrelated hash vẫn theo current PK fallback.
- `js/unified-lookup.js` sở hữu route/filter/search state và group adapters;
  `js/lookup-detail.js` sở hữu profile dialog + supplemental renderers, reuse
  hero-detail helper. `hero-list.js`/`tactics.js` chuyển thành reusable render/filter
  helpers cho coordinator; không mount hai bộ profile độc lập.
- Result paging 60 items + “Xem thêm”, search toàn corpus trước slice. Tất cả
  matched records/last child truy cập được. VI accent-insensitive search, reviewed
  CJK aliases; exact/fuzzy/ambiguity semantics giữ nguyên cho soi/kho/MCP.
- Tướng hiển thị tên Việt, base/SP/CO/40Y, stats/aptitudes, growth/civil extras;
  tactic links theo IDs trước, legacy Chinese fallback chỉ khi unique đã xác minh.
  Missing relation là text cập nhật, không title/link Chinese giả.
- Chiến pháp hiển thị effectViet/targetViet, rate/conditions/revisions rõ;
  raw effect không render như cách lấp missing translation. Valid zero hiển thị 0.
- Trang bị có related specials; toàn bộ 90 specials searchable trong cùng nhóm,
  gồm 33 chưa biết parent. Advisor skill link hero; troop mod giữ đủ options và
  revisions; building mở ordered levels/chi phí/thời gian, không cắt danh sách.
- Conditions chỉ hiện khi gameplay cần, bằng tiếng Việt. Catalog lookup không
  suy Global/mùa applicability từ provider snapshot. Chữ Hán chỉ search alias,
  source name/URL/selector không hiển thị; score/source đội không thay.
- Modal dialog focus trap, Escape/backdrop, focus restore; group chips buttons
  aria-pressed; section nav tablist/tab/tabpanel và arrows. Text-safe DOM only,
  light/dark, mobile wrap, loading/empty/error live regions tiếng Việt.

### Promotion có phục hồi: contract duy nhất

Implement `pipeline/promote_unified_lookup.py` subcommands `promote --candidate
<path>` và `recover --transaction <id>`. Owned public paths chính xác bốn file:
`data/heroes-dict.json`, `data/tactics.json`, `data/lookup-catalog.json`,
`data/lookup-manifest.json`. Không replace shared data directory.

1. Validate private candidate trước mutation; capture input hashes, destination
   preimages (including absence), intended postimages và generationId.
2. Exclusive filesystem lock `pipeline/lookup-output/promotion.lock` chứa
   PID/transaction; stale lock không tự xóa theo timeout. Serialize với owner mùa.
   Under lock recheck source/baseline/review/destination hashes; conflict abort.
3. Write durable `pipeline/lookup-output/transactions/<id>/journal.json` schema 1:
   `{id,state:"prepared"|"writing"|"committed"|"rolled-back",generationId,
   inputHashes,activationCodeManifestHash:sha256,
   paths:[{path,beforeHash:null|sha256,afterHash:sha256,backupPath:null|string}]}`.
   Back up only four owned paths; journal+backup valid before first replacement.
4. Flush backup contents và transaction directory trước mutation. Replace mỗi
   payload bằng same-directory temp file + fsync + os.replace, rồi fsync parent;
   manifest replace last. Verify full bundle và journal committed; remove owned
   lock only after success. Journal state updates dùng temp/replace + fsync file
   và parent; chỉ committed sau khi payload/manifest directory entries durable.
   Recovery/delete áp cùng ordering. Retain backup đến Phase 4 certification.
5. Caught failure: restore preimages under lock, verify full prior state. Crash:
   readers/build fail on incomplete journal/hash; next explicit recover rolls
   back. Chỉ restore nếu current destination là recorded before/after bytes;
   third-party edits cause conflict stop, không overwrite WIP.
6. First activation rollback deletes only new catalog/manifest if recorded absent
   and hash still exactly candidate; restore old dictionaries and matching loader/
   manifest code checkpoint bên dưới. Later rollback restores previous whole
   generation chỉ sau kiểm dependent season refs against target dictionaries.

Path safety: transaction ID theo `[a-z0-9][a-z0-9-]{0,63}`; derives destinations
từ four-path constant, không trust journal paths. Validate real project/data/
transaction parents, reject symlinks/escape/duplicate or extra paths; backups và
journals phải regular files trong đúng transaction, backup hash bằng beforeHash.
Check toàn bộ trước write/delete; test traversal, symlink parent và backup tamper
với sentinel ngoài checkout. Không giả định reader guard bảo vệ writer.

Trước edit activation đầu tiên, lưu private
`pipeline/lookup-output/transactions/<id>/activation-code.json` gồm exact
owned code/config/test/generated paths của phase này, before bytes/hash/absence;
hoàn thiện postimages trước promotion và bind hash trong journal. Không đưa reports
hoặc files ngoài activation vào restore set; preimages phải giữ nguyên season/WIP
đã có, chỉ undo thay đổi thuộc activation. Recovery preflight tất cả code
và data paths trước mutation: chỉ restore matching owned postimages/preimages;
third-party edit trong shared file cũng phải stop, không Git-reset cả file.
Giữ lock, restore data rồi code checkpoint, cho phép intermediate unavailable;
validate previous complete tree rồi mark rolled-back/remove lock. Test first
activation rollback khôi phục cả UI/allowlist/loader, giữ season sentinel có sẵn;
new sentinel xuất hiện sau checkpoint phải báo conflict trước mọi restore.

Cross-owner gate: chỉ generation đã chứng nhận ở Phase 4 mới cung cấp IDs mới
cho công bố cấu hình mùa. Trước rollback sau đó, kiểm current seasonal refs với
target dictionaries; nếu orphan thì stop trước mutation, phối hợp owner mùa
rollback dependency hoặc fix forward. Không tự sở hữu/revert season files.

Không hứa crash-atomic multi-file switch hoặc zero-gap reader success. Browser
hash verification rejects mixed fetched bytes; root/worker/MCP reads reject active
transaction. Successful inputs/outputs remain usable after validation/write failure.
Promotion mutates local reviewed bundle only; no deployment/commit permission implied.

## Related Code Files

**Create/planned:** `js/lookup-data.js`, `js/unified-lookup.js`, `js/lookup-detail.js`,
`pipeline/promote_unified_lookup.py`, `data/lookup-catalog.json`,
`data/lookup-manifest.json`, `tests/test_promote_unified_lookup.py`,
`tests-js/lookup-data.test.mjs`, `tests-js/unified-lookup.test.mjs`,
`tests-e2e/unified-lookup.spec.mjs`.

**Modify/planned:** `js/{app,hero-list,hero-detail,tactics,match-dict}.js`,
`src/pages/index.astro`, `css/styles.css`, both dictionary arrays,
`src/lib/{public-artifact-manifest.mjs,root-static-artifacts.ts}`,
`scripts/verify-astro-dist.mjs`, `mcp-worker/scripts/build-worker-assets.ts`,
`mcp-worker/src/data/filesystem-data-source.ts`,
`mcp-worker/workflow-source-manifest.json`, `mcp-worker/src/generated/workflow-build.ts`,
`pipeline/build_dict.py`, corresponding existing UI/artifact/worker-builder tests.
Conditional owner: `astro.config.mjs` nếu present-private-file requests chứng minh
cần dev file-serving enforcement; không tự thay config trước khi có Red.
**Delete:** none. Retain existing module basenames while adapting their ownership.

At **same checkpoint creating root files**, manifest adds exact JS entries
`lookup-data`, `unified-lookup`, `lookup-detail` and data entries `lookup-catalog`,
`lookup-manifest`. Existing two arrays already listed. Preserve all season entries.
Worker allowed-input files add two website-only JSON basenames; private `sgsdeck`
must be real directory within data root, no symlinks/unknown subtrees. Compose
versioned season inventory, never substitute artifact count `6→10` or `11→15`.
Legacy build_dict checks manifest/sidecars/active lock/incomplete journals **before**
cache/network. Ngay trước hai writes, acquire same writer lock và recheck activation;
không cần giữ lock suốt crawl. Test legacy passes entry guard → promotion completes
→ legacy resumes: abort, bốn promoted files giữ nguyên. Test first activation
prepared/writing nhưng chưa có manifest cũng abort trước cache/network.

## Implementation Steps and gates

1. [ ] Claim shared paths with owner mùa, capture preimages; add loader/promotion,
   allowlist/navigation tests and prove Red assertions before implementation.
2. [ ] Implement byte validation, transaction checks, worker source preflight and
   guarded legacy writer; test private paths/symlinks and every failure boundary.
3. [ ] Implement one lookup coordinator/profiles, aliases/routes and accessibility.
   Existing source/provider team score UI remains untouched.
4. [ ] Use candidate in isolated test fixture/project root; run focused dictionary
   identity/soi/kho/tracker/MCP canaries and UI contracts before promotion.
5. [ ] Add exact root allowlists with first local promotion only after canaries
   pass; recheck destinations under lock; validate/read/build verified generation.
6. [ ] Run focused E2E on real candidate, record screenshots/cases and hashes;
   Phase 4 broad certification follows, backups retained until that gate passes.

## TDD Red → Green → Refactor

| Slice | Red assertion | Green | Refactor gate |
|---|---|---|---|
| `lookup-data` | Mixed bytes/extra manifest key accepted | Strict byte/hash/schema validation | Same browser/build validator |
| Promotion Python | Input change/write fail loses preimage | Conflict checks/restore/journal | Inject each replace/recovery failure |
| Runtime tree/worker builder | Private symlink accepted/new file missing | Exact public entries, checked private exclusion | No wildcard or extra MCP output |
| Unified route | Alias/Back resets PK; duplicate profile | One nav/profile, preserved group/hash | Same old nonlookup routes |
| Search/detail | >60 result inaccessible/CJK alias misses | Paging/all aliases, reviewed ID relations | Matcher thresholds unchanged |
| VI content | Stale/raw effect shown, zero becomes dash | Current VI, zero, pending correct | Exact source-backed goldens |
| E2E a11y | Focus escapes/no restore/mobile overflow | Keyboard/modal/light/dark contracts | Existing navigation unchanged |
| Legacy writer | Active bundle overwritten or network called | Fail before IO/network | Pre-unified build fixture compatible |
| Filesystem MCP | Mixed pair tự có valid releaseId | Verified same buffers; legacy fixture works | CLI/stdio errors, process snapshot stable |
| Recovery scope | Code/WIP/dependent seasonal refs bị hỏng | Bound code checkpoint + dependency preflight | Exact before bytes/absence |
| Dev privacy | 404 vì private fixture không tồn tại | Present sentinel files never served | Public routes remain byte-exact |

```bash
python3 -m unittest tests.test_promote_unified_lookup tests.test_build_dict
node --test tests-js/lookup-data.test.mjs tests-js/unified-lookup.test.mjs tests-js/hero-detail.test.mjs tests-js/match-dict.test.mjs
node --test tests-js/runtime-asset-contract.test.mjs tests-js/frontend-shell-contract.test.mjs
npm --prefix mcp-worker test -- test/release/build-worker-assets.test.ts test/data/artifact-contracts.test.ts test/data/snapshot-index.test.ts test/domain/legacy-domain-adapter.test.ts
npm --prefix mcp-worker test -- test/data/data-sources.test.ts test/cli.integration.test.ts test/transport/stdio.integration.test.ts
node --test tests-js/analyze-map.test.mjs tests-js/roster-scan-map.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/derive-team-faction.test.mjs
npm run test:e2e:astro -- tests-e2e/unified-lookup.spec.mjs tests-e2e/spa-parity.spec.mjs
```

Dev privacy fixture phải tạo và assert tồn tại private sentinel files trong
`pipeline/lookup-inputs`, identity/translations, transactions và `data/sgsdeck`.
Probe direct URLs, `/@fs`, raw/module query và traversal; response không chứa
sentinel, public positive controls vẫn đúng bytes. Chạy `npm run test:dev-contract`.
Durability tests kiểm ordering/injected interruption; không gọi đó là kiểm thử
power-loss thực tế nếu chưa có thử nghiệm tương ứng.

## Success Criteria, risks and rollback

- [ ] One source-hidden VI lookup covers six groups and every retained child.
- [ ] Deep links, same dictionary objects, focused canaries and error boundaries pass.
- [ ] Every new root file allowlisted; private provenance never routed or emitted.
- [ ] Mixed/incomplete generation rejected, rollback conflict-safe and tested.

Reuse deterministic project test port; inspect existing listeners before starting
server, track PID/port/CWD, stop only task-owned processes. Candidate failure leaves
public bytes untouched; after promotion failure restore full owned checkpoint via
journal, not individual dictionary. No new season availability or team/tier edits.
