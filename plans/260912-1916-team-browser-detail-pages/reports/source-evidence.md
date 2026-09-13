# Source evidence — Team browser/detail plan

Khảo sát 2026-09-13 tại `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`; không dùng source checkout main. Line references dưới đây là tại thời điểm planning, không phải anchor để edit sau này. New APIs/files trong phase docs là đề xuất, không giả nhận đã tồn tại.

## Verified baseline

- Selected generation: `89317bb82ae31a886e49cf0d04180f413cb654ec75e5d25b29f3ff9173d4a9d0`.
- Manifest SHA-256: `1e99c46372a36176a439eb1b5fb87933c0103f4845efbe71f7031d95be67e37c`.
- Computation trực tiếp JSON: 1,366 Recommended records; 661 distinct `nameZh`; tối đa 36 numeric scores trong một season; OG có 98, 105, 113.
- `/data/teams.json`: 166 originals; 53 có counters good/avoid không rỗng, 33 có team notes. Ledger: 40 distinct/admitted, 19 duplicate, 107 pendingIdentity, 0 pendingSource. Không dùng số lượng thay cho so sánh nội dung.
- Accepted UI evidence thuộc brainstorm: tqccl.com desktop 1440 có 4 cột, mobile 375 dùng Bộ lọc collapse. Reference này là visual baseline, không clone website nguồn.
- Stylesheet thực tế: `css/styles.css` duy nhất. Không có `css/style.css`, `components.css`, `animations.css`.

## Standard-tier verification — 10 claims mỗi phase

Fact Checker kiểm tra các sự kiện/callers/commands; Contract Verifier kiểm tra hệ quả kế hoạch và acceptance coverage. Các claim kiến trúc mới chỉ được coi là quyết định có test dự kiến, **không** phải runtime behavior đã chứng minh.

### Phase 1

1. Display translations tách identity resolution: `pipeline/recommended_identity.py:23-49,52-95` → title dùng translation-reviewed, không thêm dedup identity.
2. `build_display_mapping` chưa nhận kind team: cùng file `:60` → cần sửa shared mapping, không giả dùng API đã có.
3. Alias normalize giữ variant prefix semantics: cùng file `:15-20` → không fuzzy đồng nhất tên nguồn.
4. Publication hiện kiểm tra index/detail scope membership và ordered IDs: `pipeline/build_recommended_reference.py:42-64`. Shared title/lineage equality là validation **mới** phải thêm ở D5, chưa phải guarantee hiện tại.
5. Generation ID dựa descriptor/payload hashes và selector atomic: cùng file `:67-105` → new lineage inputs phải vào generation, stale reviewed link không đổi selector.
6. Dedup key bỏ books/stats/notes và xét assigned tactics: `pipeline/recommended_team_dedup.py:34-63` → dedup equality không đủ để chuyển hướng dẫn.
7. Complete alternative groups/unresolved identities ảnh hưởng admission: cùng file `:117-181` → không tự admit các tổ hợp hay pending khi dịch.
8. Original dataset giữ counters/team/hero notes/alternatives: `data/teams.json` và JSON computation ở trên → pipeline/UI mới phải giữ các trường đang bị rơi.
9. Legacy renderer hiện chưa render counters: `js/recommended-reference-render.js:115-130` → test D3/R3 có lỗi mất thông tin thực tế để phòng ngừa.
10. Reviewed locator + content fingerprint đã có precedent, nhưng chỉ cho coexist: `pipeline/season_validation.py:213-259` → reuse validation principles, không nhét sourceConfigId vào gameplay coexist schema.

### Phase 2

1. Root shell hiện là một Astro page: `src/pages/index.astro:1-75` → cần route files thực, không root-only query panel.
2. Reference handler inline dùng request token: `js/app.js:201-211,244-289` → cutover phải xử lý old references/callers, không giữ hai UI.
3. Gameplay `openConfig` riêng; presence của config key chặn reference dù value invalid: `js/app.js:142-198,281-284`, regression `tests-e2e/recommended-browser.spec.mjs:92-94` → không đổi precedence khi migrate URL.
4. URL destination có identity families khác nhau: `js/recommended-reference-state.js:76-81` → variant phải kiểm tra cùng legacy ID.
5. Root loader xác minh manifest/payload và load seasons/index/other: cùng file `:97-112` → detail-only loading reuse verifier, không buộc tải corpus.
6. External source URL validator đã tồn tại: cùng file `:83-95` → dùng lại cho source links; return URL có allowlist riêng.
7. Callback buttons ngoài cards gồm analyzer/roster: `js/analyze.js:114-135`, `js/roster-recommend-ui.js:83-96`; chúng đi qua `js/app.js:onOpenTeam:347-353`, không qua resolveTeamDestination → migrate trực tiếp nhánh legacy, giữ config branch.
8. `surfaceSnapshots` và popstate đã tồn tại nhưng không có explicit scroll restore: `js/app.js:213-240,300-340` → merge state, restore đúng entry sau data render.
9. Artifact inventory/paths có các guard tập trung: `src/lib/public-artifact-manifest.mjs`, `src/lib/root-static-artifacts.ts`, `src/lib/recommended-reference-artifacts.ts`, `scripts/verify-astro-dist.mjs` → exact catalog admission, không broad HTML wildcard.
10. Header policy chưa có nested team HTML: `public/_headers`. `docs/deployment-guide.md:114` ghi Pages có SPA fallback khi thiếu top-level 404.html → cần exact 404 page/output và header policy, không suy từ dev behavior.

### Phase 3

1. Feature factory là `createRecommendedSection`, không phải bản main cũ: `js/team-filter-section.js:259` → fresh scout đúng worktree.
2. Search + season-search + season/category selects hiện riêng: cùng file `:263-282` → bỏ đúng season-search, giữ search/season ngoài collapse.
3. Mobile filters đã mặc định collapsed với toggle aria: cùng file `:267-272` → reuse interaction thay vì dựng mobile UI khác.
4. Scope notice có status semantics: cùng file `:268,339-345` → không xóa global scope notice khi xóa card caption.
5. Facets hiện faction/unit/tier/subcategory/source: cùng file `:313-321` → replace tier với score, giữ source/subcategory access và bổ sung count/style theo legacy pattern.
6. Render đang group theo Tier: cùng file `:339-345` → bỏ group presentation, không tự đổi ranking comparator.
7. Card hiện title chưa là link và có callback button: `js/recommended-reference-render.js:67-89` → native anchor migration cần keyboard/modifier proof.
8. Holder names/bond handling đã có: cùng file `:5-40,53-64` → giữ approved SP/CO/40Y và tacticSlotKinds.
9. Search hiện stringify full row và query score bị từ chối: `js/recommended-reference-state.js:1-74` → cần explicit domain haystack và accepted repeated score syntax trước enrichment làm search nhiễu.
10. Numeric scores nhiều hơn star categories cũ: JSON computation 36 values/season → disclosure là presentation-only, selected values không biến mất hoặc đổi filter semantics.

### Phase 4

1. Project dùng static Astro và canonical root raw assets: `docs/code-standards.md` → không SSR/framework/duplicate public copies.
2. Existing design guidelines yêu cầu responsive cards/filter behavior: `docs/design-guidelines.md`; accepted override ở brainstorm §11 → thực tế 1440/375/320 là verification obligation.
3. Authoritative contract có 13 checkboxes: `plans/reports/brainstorm-260912-team-chuan-team-khac.md:156-168` → map đủ AC01–AC13, không sample.
4. Build/check/node/dist/e2e scripts tồn tại: `package.json`; test:node wildcard gồm actual dist checks tại `tests-js/astro-dist-contract.test.mjs:362-376` → build trước full test:node, focused source tests dùng filenames trực tiếp.
5. Node engine yêu cầu >=24.20.0 <25: `package.json` → execution preflight kiểm tra runtime, không ép test chạy sai version.
6. Playwright project tên astro, baseURL port 4174: `playwright.config.mjs:3,22-28` → commands phase docs dùng đúng project.
7. Playwright webServer tự build + preview, reuseExistingServer false, timeout 30s: cùng file `:16-20` → invocation E2E có build riêng; chưa đo được thời gian với route corpus mới, không tuyên bố startup budget đủ.
8. Existing recommended E2E có inline/history/outage coverage: `tests-e2e/recommended-browser.spec.mjs` → migrate public contract assertions, không xóa entire regression file.
9. Gameplay và khaihoang có suites riêng: `tests-e2e/season-lookup.spec.mjs`, `tests-e2e/khaihoang-options.spec.mjs`, `tests-e2e/mcp-domain-compatibility.spec.mjs` → giữ phạm vi ngoài browser mới qua regression gates.
10. README/docs hiện hữu, không có root CHANGELOG được tìm thấy: exact file glob trong worktree → cập nhật docs có thật sau smoke, không tạo changelog chỉ vì template.

## Planning-only checks performed

Đã chạy CLI help để xác nhận `recommended_team_dedup`, `report_recommended_translations`, `ak plan validate`, `ak plan reindex`, `ak plan use`, `ak journal create`; đã đọc package/config và tính snapshot statistics. Chưa chạy implementation test/build/browser trong turn lập plan, không có Red/Green mới để công bố.

## Execution risks, not hidden scope changes

- 1,532 static original/source pages theo snapshot hiện tại: phải đo build/startup sau implement; chưa có evidence cần pagination/SSR hoặc đổi timeout. Variant query không nhân số HTML pages.
- Legacy bytes pin riêng có thể gặp stale HTML vs mutable raw artifact: fail-closed với reload rõ; không silent fallback mất integrity.
- Team titles có thể cần scoped override; dựa tên gốc và reviewed sourceConfigId, không nối identity mới.
- Histories, BFCache và storage denial cần actual browser tests, không chỉ unit URL serialization.
