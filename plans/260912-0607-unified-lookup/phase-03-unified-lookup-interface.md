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

<!-- Updated: Audit Session 2 - completed router/publication and generation closure -->

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
| 12 | `mcp-worker/scripts/build-worker-assets.ts:95–125` | Checked `data/sgsdeck` exception already exists; extend only lookup raw-bundle validation, do not recreate/narrow the existing guard. |
| 13 | `docs/design-guidelines.md:48–59`; consumer research | Tab semantics/modal focus là required touched-UI gap; chưa có a11y proof. |
| 14 | completed `feat/season-team-lookup` worktree `js/app.js:54–87,213–238` | Router now owns Team chuẩn/Team khác aliases and per-surface history; old main dispatcher is not implementation baseline. |
| 15 | completed worktree `src/lib/recommended-reference-artifacts.ts`, `scripts/verify-astro-dist.mjs` | Recommended scoped generation + HTML pin are existing publication contracts to preserve. |
| 16 | `js/season-ui-state.js:5–17`; `root-static-artifacts.ts:121–127` | Season model and HTML hashes also consume hero/tactic bytes; lookup coherence must cover this ingress. |

## Architecture: một cửa vào, một tập dữ liệu

`js/lookup-data.js` export `validateLookupBundle(manifest,rawFiles)` và
`loadLookupBundle(fetchFn)`; rawFiles keys đúng ba basenames ở Phase 2, values
Uint8Array. Validate exact manifest schema/digests, SHA-256 raw bytes, derived
generationId, JSON shapes and cross-record IDs trước trả
`{heroes,tactics,catalog,manifest,rawFiles}`. Consumers không mutate buffers;
route/packager dùng đúng verified bytes này, không mở lại files hoặc stringify.
Không parse rồi stringify để kiểm hash. Không tải private source/ledger.

Hai exports async, dùng WebCrypto; browser/Node call sites phải await. Browser
`app.js` dùng completed Team router làm baseline và một shared byte-request cache:
lookup loader điền/đọc hero+tactic bytes trong cache này; `loadSeasonModel` nhận
đúng cùng bytes/digests. App consumers nhận cùng parsed lookup arrays; season
validator được phép clone/freeze model, nên contract của nó là byte/digest identity,
không phải JavaScript object identity. Existing root readers/worker source
validator propagate await/error đến callers và test no-unawaited-promise behavior.

Astro side thêm một build-scoped `lookupPublicationSnapshot()` memoized từ một
verified raw set. `seasonArtifactHashes`, root data routes/static paths cho bốn
owned files và `verify-astro-dist.mjs` dùng snapshot đó hoặc fail nếu generation
đổi trong build. Dist verifier recompute `#season-artifact-hashes` từ emitted
bytes, kiểm hero/tactic hashes match lookup manifest, đồng thời giữ nguyên
Recommended `recommended-publication` pin/selected scoped bytes. Interleaving
HTML(G0) → completed promotion(G1) → routes(G1) phải fail build, không ship.

`app.js` truyền verified dictionaries cho lookup, tracker, analyze, roster,
faction derivation; không dictionary v1 ở scanner và v2 ở lookup. Bundle lỗi:
không accept một phần; localized error ở lookup và dictionary-dependent sections,
team-only sections vẫn dùng independent data. Không fallback sang unverified old
array để giấu mixed generation.

`src/lib/root-static-artifacts.ts` kiểm private journal trước/sau snapshot,
manifest hash trước/sau capture; build/read fail khi transaction incomplete hoặc
bytes không khớp. Worker asset builder validate raw lookup bundle trước khi chọn
heroes/tactics cho MCP snapshot; không emit supplemental catalog/lookup manifest
vào MCP artifact inventory.

MCP filesystem ingress phân biệt ba exact formats, fail closed:

1. raw activated project root có lookup sidecar/marker phải có manifest + ba
   payload hợp lệ và dùng verified hero/tactic buffers;
2. packaged MCP release root có exact MCP `manifest.json` + six/eleven declared
   artifacts, không website sidecars, validate existing MCP manifest/bytes dù
   dictionary có additive lookup fields;
3. genuine legacy raw root không lookup marker/sidecar và không package manifest
   dùng nhánh cũ cho historical fixtures.

`FilesystemDataSource.loadCandidate` implement branches above cho CLI/stdio.
Bracket raw-root reads bằng manifest/transaction observations; packaged branch
không bị phân loại nhầm thành partial catalog. Cached process snapshot stays
immutable until restart. Any invalid/mixed root returns `DATA_UNAVAILABLE`.
Add `filesystem-data-source.ts` as workflow entrypoint; its actual imports must
produce exact transitive semantic closure including `js/lookup-data.js`.

### Giao diện chọn dùng

- Thay hai top-level nav lookup bằng **Tra cứu**, section `section-lookup`, hash
  section `lookup`. Route giữ schema fragment
  `#lookup?group=<heroes|tactics|equipment|advisors|troop-mods|buildings>&id=<encoded canonical ID>`.
  Completed router phải split fragment section trước `?`, recognize `lookup`
  before unknown-hash canonicalization, rồi parse suffix bằng bounded URLSearchParams.
  `group` optional (all), `id` optional. Reject duplicate/unknown params and
  wrong kind/id combination bằng lookup error; không fetch arbitrary URL từ hash.
- `#heroes` và `#tactics` alias preselect group trong cùng section, không rewrite
  alias khi initial load hoặc Back/Forward. Preserve completed `team-chuan` default,
  `team-pk`/`meta-cu` source-filter aliases, `onSectionRequest`, reference/gameplay
  search params and `history.state.surfaceSnapshots`. Invalid unrelated hash follows
  completed Team chuẩn fallback—not stale main PK fallback.
- `js/unified-lookup.js` owns route/filter/search state and group adapters;
  `js/lookup-detail.js` owns profile dialog + supplemental renderers, reuse
  hero-detail helper. `hero-list.js`/`tactics.js` become reusable render/filter
  helpers; no duplicate profile mounts.
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

1. Validate private candidate and staged activation postimages before active-tree
   mutation; capture input hashes, destination preimages (including absence),
   intended postimages and generationId.
2. Before first shared-path mutation, ensure no pre-guard `build_dict.py` writer
   is already running. Coordinate owner to wait/cancel it; never kill unrelated
   processes. Then acquire exclusive filesystem lock
   `pipeline/lookup-output/promotion.lock` containing PID/transaction. Stale lock
   không tự xóa theo timeout.
3. Under lock, before mutation, durably write transaction directory,
   `activation-code.json` and `journal.json` state `activation-prepared`. Journal
   schema 1 records `{id,state:"activation-prepared"|"writing"|"committed"|"rolled-back",
   generationId,inputHashes,activationCodeManifestHash,paths:[{path,beforeHash,
   afterHash,backupPath}]}` for finalized staged code/config/test/generated and
   four data postimages. Backups valid before first replacement.
4. If crash leaves a lock before durable journal, explicit recovery may remove it
   only after owner-death and full destination/preimage proof shows no mutation.
   Otherwise journal-driven recovery is mandatory. Flush backup contents and
   transaction directory before mutation. Replace each payload with same-directory
   temp + fsync + os.replace, fsync parent; manifest last. Verify full bundle,
   mark committed durably, then remove owned lock. Retain backup to Phase 4.
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

Prepare all activation code in the integrated task worktree first; do not mutate
the active shared tree while postimages are still unknown. The staged activation
manifest lists exact owned code/config/test/generated paths, before bytes/hash/
absence and finalized after hashes. Under the protocol above, install staged code
and data only after the durable `activation-prepared` journal exists.

Recovery preflights every code/data path before mutation and restores only matching
owned postimages/preimages; third-party edit in shared file stops before any
restore. Keep lock, restore data then code checkpoint, allow intermediate
unavailable, validate previous complete tree, mark rolled-back/remove lock.
Test interruption before first code replacement, between replacements, between
lock and journal, and first activation rollback preserving season sentinels.

Cross-owner gate: the season publisher must participate in the same exclusion
from dictionary validation through final seasonal file replacement, then recheck
lookup generation while holding it. Lookup rollback holds that exclusion while
checking target dictionary refs. A publisher paused after validating G1 must
abort after rollback to G0; lookup does not own/revert season files. Only Phase 4
certified generation supplies new IDs for published season configs.

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

**Modify/planned:** integrated completed-baseline `js/{app,hero-list,hero-detail,tactics,match-dict}.js`,
`src/pages/index.astro`, `css/styles.css`, both dictionary arrays,
`src/lib/{public-artifact-manifest.mjs,root-static-artifacts.ts}`,
`scripts/verify-astro-dist.mjs`, `mcp-worker/scripts/build-worker-assets.ts`,
`mcp-worker/src/data/filesystem-data-source.ts`,
`mcp-worker/workflow-source-manifest.json`, `mcp-worker/src/generated/workflow-build.ts`,
`pipeline/build_dict.py`, corresponding UI/artifact/worker-builder tests.
**Read/preserve:** completed `js/{recommended-reference-state,recommended-reference-render}.js`,
`src/lib/recommended-reference-artifacts.ts`, scoped Recommended route files and
selected generation/pin. Conditional cross-owner prerequisite:
`pipeline/build_season_data.py` owner adds shared exclusion/final generation check.
**Delete:** none. Retain existing module basenames while adapting ownership.

At **same checkpoint creating root files**, manifest adds exact JS entries
`lookup-data`, `unified-lookup`, `lookup-detail` and data entries `lookup-catalog`,
`lookup-manifest`. Preserve every completed Recommended JS entry, scoped route,
snapshot helper and all season entries. Compose versioned season inventory; never
substitute artifact count `6→10` or `11→15`.

Worker allowed raw-input files add two website-only JSON basenames; private
`sgsdeck` exception remains exact and checked. Emitted MCP package remains its
active six/eleven artifact inventory plus MCP manifest, accepted by the packaged
FilesystemDataSource branch. Legacy build_dict checks manifest/sidecars/lock/
incomplete journals **before** cache/network; first activation additionally fences
already-running pre-guard writers. Immediately before writes it acquires the same
lock and rechecks activation. Test guarded legacy start → promotion → resume,
old-code writer already in crawl before guard install, and manifest-absent
activation-prepared/writing states.

## Implementation Steps and gates

1. [ ] Integrate/rebase onto completed `feat/season-team-lookup` baseline; pin
   reviewed commit, combined router/publication preimages and owner coordination.
2. [ ] In task worktree, add loader/promotion/allowlist/navigation Reds; add the
   completed route/pin/scoped-inventory preservation cases before implementation.
3. [ ] Implement build-scoped byte snapshot, browser shared-byte ingress, exact
   raw-versus-packaged MCP branches and guarded legacy writer.
4. [ ] Implement composed lookup coordinator/profiles/routes/accessibility without
   changing Team chuẩn default, aliases, source attribution or history snapshots.
5. [ ] Finalize activation postimages; fence old writers and season publisher;
   create durable activation journal before first active shared-path mutation.
6. [ ] Use candidate in isolated fixture/root; run dictionary/season/Recommended/
   soi/kho/tracker/MCP canaries before promotion.
7. [ ] Promote locally only after canaries; test all interruption/recovery and
   HTML(G0)→promotion(G1)→route rejection boundaries.
8. [ ] Run focused E2E on real candidate, record screenshots/cases/hashes;
   Phase 4 broad certification follows, backups retained.

## TDD Red → Green → Refactor

| Slice | Red assertion | Green | Refactor gate |
|---|---|---|---|
| `lookup-data` / publication snapshot | Mixed bytes or HTML G0 + routes G1 accepted | Strict byte/hash/schema + build pin | Same bytes feed lookup and season hashes |
| Promotion Python | Input change/write fail loses preimage | Conflict checks/restore/journal | Inject each replace/recovery failure |
| Runtime tree/worker builder | Private symlink or valid MCP package rejected | Exact public union; raw/package branches | No wildcard or extra MCP output |
| Unified route | Lookup hash canonicalized to Team chuẩn; aliases/history lost | Composed completed router + one lookup profile | Team default/source filters/snapshots unchanged |
| Search/detail | >60 result inaccessible/CJK alias misses | Paging/all aliases, reviewed ID relations | Matcher thresholds unchanged |
| VI content | Stale/raw effect shown, zero becomes dash | Current VI, zero, pending correct | Exact source-backed goldens |
| E2E a11y | Focus escapes/no restore/mobile overflow | Keyboard/modal/light/dark contracts | Existing navigation unchanged |
| Legacy writer | Active bundle overwritten, network called, old writer resumes | Fail before IO + old-process fence + lock | Pre-unified fixture compatible |
| Filesystem MCP | Mixed raw pair accepted or packaged release rejected | Raw lookup coherence; MCP manifest branch | CLI/stdio errors, process snapshot stable |
| Recovery scope | Code/WIP/dependent refs damaged or no pre-code journal | Durable activation-prepared checkpoint | Exact bytes/absence; fail before partial restore |
| Season publisher | Validates G1 then publishes after G0 rollback | Shared exclusion + final generation recheck | Lookup never reverts season files |
| Dev privacy | Present private fixture served | Phase 1 deny remains Green | Public root + Recommended scoped routes exact |

```bash
python3 -m unittest tests.test_promote_unified_lookup tests.test_build_dict
node --test tests-js/lookup-data.test.mjs tests-js/unified-lookup.test.mjs tests-js/hero-detail.test.mjs tests-js/match-dict.test.mjs
node --test tests-js/runtime-asset-contract.test.mjs tests-js/frontend-shell-contract.test.mjs
npm --prefix mcp-worker test -- test/release/build-worker-assets.test.ts test/data/artifact-contracts.test.ts test/data/snapshot-index.test.ts test/domain/legacy-domain-adapter.test.ts
npm --prefix mcp-worker test -- test/data/data-sources.test.ts test/cli.integration.test.ts test/transport/stdio.integration.test.ts
node --test tests-js/analyze-map.test.mjs tests-js/roster-scan-map.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/derive-team-faction.test.mjs
npm run test:e2e:astro -- tests-e2e/unified-lookup.spec.mjs tests-e2e/spa-parity.spec.mjs
node --test tests-js/recommended-reference-state.test.mjs tests-js/recommended-reference-artifacts.test.mjs
```

Dev privacy fixture phải tạo và assert tồn tại private sentinel files trong
`pipeline/lookup-inputs`, identity/translations, transactions và `data/sgsdeck`.
Probe direct URLs, `/@fs`, raw/module query và traversal; response không chứa
sentinel, public positive controls vẫn đúng bytes. Chạy `npm run test:dev-contract`.
Combined dev fixture must retain selected Recommended routes and HTML pin while
denying lookup evidence paths. Build interleaving and packager-output → CLI/stdio
tests are focused behavioral gates, not broad smoke claims.
Durability tests kiểm ordering/injected interruption; không gọi đó là kiểm thử
power-loss thực tế nếu chưa có thử nghiệm tương ứng.

## Success Criteria, risks and rollback

- [ ] One source-hidden VI lookup covers six groups and every retained child.
- [ ] Deep links, shared app dictionary objects/season-identical bytes, canaries and error boundaries pass.
- [ ] Every new root file allowlisted; private provenance never routed or emitted.
- [ ] Mixed/incomplete generation rejected, rollback conflict-safe and tested.
- [ ] Team chuẩn/Team khác routes, pin, source links, aliases and history remain exact.
- [ ] Season HTML hashes, lookup bundle and emitted dictionaries share one build generation.
- [ ] Valid packaged MCP release roots remain usable by CLI/stdio.

Reuse deterministic project test port; inspect existing listeners before starting
server, track PID/port/CWD, stop only task-owned processes. Candidate failure leaves
public bytes untouched; after promotion failure restore full owned checkpoint via
journal, not individual dictionary. No new season availability or team/tier edits.
