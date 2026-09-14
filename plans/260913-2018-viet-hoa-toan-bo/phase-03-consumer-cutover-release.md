---
phase: 3
title: "Cutover mọi consumer và khóa release gate"
status: pending
priority: P1
effort: ""
dependencies: [2]
---

# Phase 3: Cutover mọi consumer và khóa release gate

## Goal

Mọi default website surface hiển thị Việt, source/search/gameplay giữ nguyên và bản dịch thiếu hoặc stale không thể qua build/release.

## Context và ownership

Đọc C1/C4/C5/C6 trong [contracts](reports/contracts.md). `--advice --yagni --tdd`; Main là integration owner. Có thể chia data renderers và dynamic UI cho hai workers sau khi snapshot API chốt; không hai writers chung `js/app.js`, `js/render.js` hoặc ledger. Không deploy/commit/push tự động.

**Thứ tự trong phase:** chạy RED trên site cũ trước; triển khai P3-A → P3-B/P3-C → P3-D. Unit tests dùng isolated fixtures có thể chạy ngay. Các Verify phụ thuộc artifact thật (`test:contracts`, browser tests ở A/B/C) chạy **sau P3-D strict build** rồi mới tick A/B/C; không đòi artifact chưa tạo hoặc bypass release gate để có GREEN. P3-C kiểm source/literal độc lập trước build; browser state proof thực tế hoàn tất sau build ở P3-E. Không mark task done chỉ vì code đã viết.

## Files to Create / Modify

- Create: `js/website-display.js`, `data/website-display.json`, `tests-js/website-display.test.mjs`, `tests-e2e/site-localization.spec.mjs`.
- Modify snapshot/entrypoints: `src/lib/root-static-artifacts.ts`, `src/lib/team-detail-routes.ts`, `src/lib/public-artifact-manifest.mjs`, `src/pages/index.astro`, hai `src/pages/teams/**/[...].astro` ở C1, `src/layouts/SiteLayout.astro`, `js/app.js`, `js/team-detail.js`, `js/site-chrome.js`.
- Modify render/search: `js/recommended-reference-render.js`, `js/recommended-reference-state.js`, `js/team-filter-section.js`, `js/render.js`; `js/unified-lookup.js`/`js/lookup-detail.js` chỉ text/coverage correction có chứng cứ, không mở DTO.
- Modify dynamic UI: `js/analyze.js`, `js/roster-recommend-ui.js`, `js/roster-scan-map.js`, `js/recruit-tracker.js`; map/engine/store logic giữ nguyên ngoài website-owned default text.
- Modify upstream default only: `worker/src/schema.ts::validateBuiltTeamsScanResult`, `worker/test/scan-modes.test.ts`; không đổi wire schema, model, auth hoặc genuine supplied names.
- Modify gates/contracts: `pipeline/site_localization.py`, policy/receipts, `scripts/verify-astro-dist.mjs`, `package.json`, `.github/workflows/mcp-worker.yml`, `mcp-worker/scripts/check-repository.ts`, `tests-js/runtime-asset-contract.test.mjs`, `tests-js/astro-dist-contract.test.mjs`, `tests-js/team-detail-routes.test.mjs`, `tests-js/recommended-reference-state.test.mjs`, `tests-js/recruit-tracker-ui.test.mjs`, existing e2e Recommended/detail/lookup/khaihoang specs.
- Update existing docs after proof: `docs/season-team-data.md`, `docs/unified-lookup.md`, `docs/code-standards.md`.

## Tests Before

Trước cutover, thêm hai cases `localization-red-note` và `localization-red-provider-error` vào spec mới, chạy website thật qua Playwright project `astro`:

```bash
npx playwright test tests-e2e/site-localization.spec.mjs --project=astro --grep localization-red
```

Pass RED: command exit khác 0 với đúng failure mô tả (1) visible note hiện có Hán / source subtitle hiện ra, (2) configured client hiển thị Chinese/English provider error thay vì message Việt. Data/config/mock đã load và page đã đến đúng state. Build/import/missing fixture/timeout trước state không phải RED. Giữ cases sau fix như regression, không disable/skip hoặc đảo assertion để “green”. Expected RED là pass của bước này, không kích hoạt Failure Protocol.

Browser test intercept config/Turnstile/Worker ở test harness, dùng endpoint giả chỉ được route.fulfill; không gọi live service, không ghi token thật, không thay production API. Với code mới, unit tests validate bytes/schema/pins trên loader thật sau khi module có implementation chạy được, không mock echo.

## Tasks & Steps

### P3-A — Dùng một snapshot cho HTML lẫn emitted data

- **Goal:** Không tạo HTML pin A nhưng data route lại serve B.
- **Target:** root static artifacts, team-detail catalog, index/detail Astro pages, manifest, new browser loader, app/detail entrypoints, JS contracts.
- **Steps:** (1) Chốt `websiteDisplayPublicationSnapshot({rootDir,manifest})` trong `root-static-artifacts.ts`, cache Promise per root; capture sidecar, Recommended và public dependency bytes một lần. (2) Tách lower-level raw read để snapshot không recurse qua `readPublicArtifact`; giữ regular-file/symlink/root safety và lookup transaction guard. (3) `readPublicArtifact` trả **captured bytes** cho website-display và mọi dependency trong snapshot; không re-read mutable file sau capture. (4) Index/detail catalog dùng cùng snapshot; embed SHA sidecar + generation, cross-check Recommended/legacy pin; title/meta không fallback raw. (5) `loadWebsiteDisplay(pin, loadBytes, recommendedPin)` verify file SHA, exact schema, public dependency hashes rồi trả readonly values; app và team-detail là hai entrypoints tải. (6) Reuse raw byte cache, truyền display context đến renderer; raw SeasonContext không đổi. (7) Manifest thêm đúng module/sidecar, không private input/receipt paths.
- **Success criteria:** Cùng process build/route emit chỉ một bộ bytes; mutation sau capture không gây mixed files, fresh build bắt stale inputs; mismatch không render raw; catalog vẫn đầy đủ route IDs và return navigation.
- **Verify:**

```bash
node --experimental-strip-types --test tests-js/website-display.test.mjs tests-js/team-detail-routes.test.mjs tests-js/recommended-reference-artifacts.test.mjs
npm run test:contracts
```

Exit 0. Tests mutate backing files sau snapshot rồi đọc emitted artifact: bytes phải bằng snapshot đã pin hoặc whole operation fail, không bytes mới cùng pin cũ. Test dependency/Recommended/legacy hash mismatch, traversal/private-file injection, missing display entry, source bytes unchanged, unchanged raw gameplay result và all-route inventory parity. Không chỉ assert file chứa tên import.

### P3-B — Migrate data renderers và bilingual search

- **Goal:** Không còn raw text lộ qua default view, alternative build hoặc standalone detail.
- **Target:** `recommended-reference-render.js`, `recommended-reference-state.js`, `team-filter-section.js::createRecommendedSection/createSeasonCoexistSection`, `render.js`, `app.js`, `team-detail.js`, index/layout/detail Astro pages, active lookup UI.
- **Steps:** (1) Notes đọc textVi theo owner, bỏ fallback textRaw/notesRaw/nameZh/nameRaw cho website-owned fields. (2) Legacy embedded references, Team khác detail, source coexist và khaihoang dùng approved display values, không sửa raw object/engine input. (3) Remove raw source-title subtitle cả hai route families; giữ external source link đúng policy. (4) Title/meta/menu/Beta/Build/Team wording và a11y/tooltip/placeholder dùng Việt đã kiểm; không đổi stable section IDs/URLs. (5) Search đọc cả approved display và alias/raw names trong index, nhưng không render alias/provenance; đối chiếu cùng result IDs/order trước/sau. (6) Lookup modal/empty/error checks giữ private DTO boundary. (7) UI thiếu/mismatch projection báo unavailable Việt; không hidden-record filtering để né coverage.
- **Caller closure:** Thêm display context vào cả hai section factories; thay `items.map(seasonCoexistGroup)` bằng callback truyền context rõ ràng (không vô tình truyền array index). Forward context khi gọi `recommendedTeamCard`. Search Cùng Tồn gồm approved Việt + raw aliases, không chỉ JSON raw content. Bỏ raw `seasonOptionTitle`, facet/category `title` và fallback label; kiểm introduction English. Update e2e direct renderer callers bằng display fixture thật.
- **Success criteria:** Mọi note location và selectable source build có display Việt; raw IDs/source URL/query behavior/gameplay unchanged. Shared layout là source riêng cần kiểm, không giả định root nav và detail nav dùng chung literal.
- **Verify:**

```bash
node --experimental-strip-types --test tests-js/recommended-reference-state.test.mjs tests-js/unified-lookup.test.mjs tests-js/team-detail-navigation.test.mjs
npx playwright test tests-e2e/site-localization.spec.mjs --project=astro --grep localization-data
```

Exit 0. Data cases bao gồm eight-section data surfaces, all source scopes/builds/note owners, both detail families, source links, VI/Chinese search trả cùng stable IDs, lookup private fields không thành DOM/a11y. Denominator từ current inventory/catalog, không fixed sample. Test static title/meta cho toàn route inventory; browser enumerate selectable builds/route data cases theo chunks và đối chiếu visited IDs với expected IDs để không bỏ sót. Screenshots chỉ lấy representative visual states, không dùng screenshot sample làm chứng cứ toàn corpus.

Browser data cases bắt buộc kiểm season option titles, facet/category tooltip và một query Cùng Tồn bằng bản Việt có nghĩa khác raw text; đối chiếu cùng group IDs khi dùng alias Hán.

### P3-C — Việt hóa dynamic/error states, giữ user content

- **Goal:** Analyze/Recruit/Roster không lọt English hoặc provider prose qua nhánh lỗi/thành công.
- **Target:** `analyze.js::callWorker/initAnalyze`, `roster-recommend-ui.js`, `roster-scan-map.js`, `recruit-tracker.js`, shell chrome; dynamic browser cases và existing node tests.
- **Steps:** (1) Giữ callWorker signature/status nhưng map service/protocol/network categories sang message Việt đã kiểm; hai callers không render arbitrary `err.message`. (2) Normalize confidence/uncertainty/default labels, gồm fallback `Team đã build`, `Account`, `Pity`; không sửa matching/rank/scan wire API. (3) Exercise Analyze upload/paste/drop, config off/on, Turnstile callbacks, all statuses và recognized/unrecognized/similar/outside-scope results. (4) Exercise cả 3 roster scan modes, review/import/storage/conflict/no-match. (5) Recruit account/banner/prompt/confirm/history/import/export/empty/error có Việt; Chinese user names/notes và backup payload không bị dịch. (6) Mỗi exception phải chỉ đúng user-origin field, không exempt generated wrapper hoặc provider explanation. (7) Reviewer độc lập kiểm UI literals, a11y names và state evidence rồi cập nhật policy source hashes explicit.
- **Success criteria:** Unknown upstream error vẫn báo lỗi dịch vụ trung thực, không success giả; user OCR/text giữ nguyên và untrusted; canonical recognized names đúng glossary; không persist image/token hoặc gọi dịch runtime.
- **Verify:**

```bash
node --test tests-js/analyze-map.test.mjs tests-js/roster-scan-map.test.mjs tests-js/roster-scan-state.test.mjs tests-js/recruit-tracker-ui.test.mjs tests-js/recruit-tracker-store.test.mjs tests-js/team-recommend-engine.test.mjs
npx playwright test tests-e2e/site-localization.spec.mjs --project=astro --grep localization-dynamic
```

Case producer bắt buộc: provider input `teams:[{heroesCn:[knownHero]}]` thiếu teamName đi qua `validateBuiltTeamsScanResult` thật, rồi UI phải hiển thị default Việt. Tên thực do người dùng/ảnh cung cấp (kể cả `Team 1`) giữ nguyên, không regex-rewrite bên client. Thêm regression trong `worker/test/scan-modes.test.ts` trước producer edit; test đỏ do generated English label, không do setup. Verify thêm `npm --prefix worker test -- test/scan-modes.test.ts` và `npm --prefix worker run typecheck`, exit 0. Browser fixture dùng output producer thật, không hardcode một response đã Việt hóa để né upstream bug. Không deploy Worker trong task; production completion chỉ có thể xác nhận khi site và Worker cùng compatible revision được deploy theo approval riêng.

Exit 0. Include 422/429/5xx/network/non-JSON, configured/unconfigured and expired/error Turnstile, malicious/unrecognized provider strings, confidence enum, same user-entered Chinese names survive save/reload/export. Test actual UI visible text, `aria-label/title/placeholder` and accessible states; no implementation-string assertions.

### P3-D — Strict build/dist/CI gate, không có partial escape

- **Goal:** Nguồn/UI/glossary/receipt mới nhưng chưa review không thể publish.
- **Target:** `pipeline.site_localization` strict build/check; package scripts; sole dist verifier; credential-free workflow/gate; dist contracts.
- **Steps:** (1) Refresh inventory after source edits, run real independent UI checks, reuse unchanged receipt bindings. (2) Default strict build validates **all** data+UI before writing; hydrate/build candidate, verify, then activate Recommended using existing builder and atomically replace sidecar. No multi-file atomicity claim; intermediate mismatch must fail closed. (3) Add `verify:localization = python3 -m pipeline.site_localization check --root .`; root `build` runs it before Astro; it never mutates/auto-refreshes inputs or selects partial mode. (4) `scripts/verify-astro-dist.mjs` adds captured byte parity, HTML/display/Recommended pins, private exclusion and designated display text checks to existing policy. (5) Both push/PR workflow paths add `pipeline/**`, `src/**` (replace narrower src path), retain current protected production jobs. Credential-free repository runner adds localization gate and `npm run verify` in correct build-before-dist order, no duplicate full suite. (6) Fault injection uses isolated temp fixtures only, never current production files.
- **Success criteria:** Missing/stale translation—even Latin text—missing/edited review, glossary content changed same label, UI-source hash drift, missing note owner, tampered sidecar/source/HTML pin, private path or Han leakage all stop build/verify. No new credentials, deployment or translation service.
- **Verify:** Commands implemented by this phase:

```bash
python3 -m pipeline.site_localization build --root .
python3 -m pipeline.site_localization check --root .
npm run build
npm run test:dist
npm run verify
```

Every command exit 0; report all final pending/unknown/unresolved/stale/missing/invalid counters 0. Dist contracts execute each tampered fixture and assert nonzero/meaningful rejected invariant; valid control fixture passes. Full strict build creates complete display artifact/selected Recommended; `--stage data` must be absent from npm/CI release paths.

### P3-E — Whole-site proof, cleanup và handoff

- **Goal:** Chỉ tuyên bố done sau đủ acceptance, không chỉ compiler xanh.
- **Target:** Existing suites, actual browser surface, execution reports; existing docs.
- **Steps:** (1) Run final focused/full gates sau khi writers dừng; tránh rerun cùng full suite trong parallel agents. (2) Dùng browser thật desktop + 390×844 kiểm cả 8 tab, menu/dialog, first/all-build enumeration evidence, last/empty/error states, keyboard focus, standalone routes và no-JS/title/meta; không reused stale dev server. (3) Record actual aggregate counts, source/gameplay/lookup privacy parity, logs + screenshots, code/translation/review/source pins. (4) Sau smoke proof, update docs owners, remove throwaway outputs/tests scaffolding; giữ regression tests defend real behaviors. Existing wording-only/source-text tests bị ảnh hưởng thì bỏ hoặc thay bằng observable contract, không re-pin incidental text. (5) Kongming review final evidence + independent code review; blockers phải xử lý và affected Verify rerun trước done. Không commit/push/deploy khi chưa được yêu cầu.
- **Success criteria:** Toàn denominator được cover; no raw UI fallback, no untranslated website-owned text, true exceptions preserved; no unresolved review/failure; docs có offline recapture/translate/review/build/gate instructions và ranh giới raw/identity.
- **Verify:**

```bash
npm run check
npm run test:node
python3 -m unittest discover -s tests
npm run test:e2e:astro
```

Exit 0 từng command; `check` 0 errors. Root build/dist/verify đã chạy ở P3-D, chỉ rerun nếu inputs bị đổi sau đó. Trong CI dùng repository gate đã cập nhật, bao gồm Worker/MCP checks hiện có; local không cần nhân đôi tất cả checks nếu credential-free gate vừa chứng minh cùng revision. Browser proof cần actual visible/a11y observations và screenshots; ghi rõ Worker được stub ở client tests, không tuyên bố đã test live upstream API.

## Refactor

Clean cutover mọi active consumer, không compatibility aliases hay fallback raw. Không gom thay đổi engine/store/Worker API vào localization. Reuse byte cache/snapshot và renderer hiện hành; module mới chỉ verify/resolve display values.

## Tests After / Final acceptance

- All P3 Verify pass đúng scope; RED → GREEN evidence tồn tại, test skips/0-test runs không tính.
- All ledger/receipts/policy inputs fresh; main data types và user storage semantics giữ nguyên.
- Không còn execution blocker hoặc semantic ambiguity. Plan chỉ được mark completed trong phiên cook sau evidence này; phiên lập plan vẫn pending.

## Implementation checklist

- [x] P3-A Pin cùng snapshot cho HTML và data routes
- [x] P3-B Cutover mọi data renderer và bilingual search
- [x] P3-C Việt hóa dynamic states giữ nguyên user content
- [x] P3-D Chặn thiếu dịch tại build dist và CI
- [x] P3-E Chứng minh toàn site rồi cập nhật tài liệu

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
