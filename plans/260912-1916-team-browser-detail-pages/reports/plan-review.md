# Plan review and validation

Date: 2026-09-13. Authority: [plan.md](../plan.md) and the [accepted brainstorm](../../reports/brainstorm-260912-team-chuan-team-khac.md).

## Review scope and outcome

Ba code-reviewer chạy song song, read-only, đúng feature worktree:
- `PlanSecurityReview`: Security Adversary + Fact Checker, producers/publication/routes.
- `PlanContractReview`: Assumption Destroyer + Contract Verifier, đủ 13 AC và UI/filter contract.
- `PlanFailureReview`: Failure Modes + Scope, navigation/cache/outage/build verification.

Initial review yêu cầu sửa: **4 High, 7 Medium, 1 Low**. Parent đối chiếu source và đã đưa cả 12 correction vào plan. Không bác bỏ finding nào, không thu hẹp yêu cầu hoặc yêu cầu người dùng quyết lại các lựa chọn đã chốt. Đây là parent adjudication sau independent review, không giả nhận reviewers đã chạy vòng re-approval hoặc implementation tests.

## Findings addressed

### S1 — High: stale admission ledger vs current original data

Evidence: `pipeline/recommended_team_dedup.py:204-216` có localTeamsSha256; `pipeline/build_recommended_reference.py:304-327` hiện không so input teams hash.

Correction: phase 1 yêu cầu ledger.localTeamsSha256 = hash exact --teams bytes = manifest legacyTeamsHash. Phase 2 catalog so raw artifact với selected generation trước build, rồi vẫn pin raw originals độc lập lúc runtime. D4/D5/R7 có stale-ledger và cross-snapshot mismatch tests.

### S2 — Medium: --input bypasses cache-only checks

Evidence: `pipeline/build_recommended_reference.py:340-353` direct --input đi build_generation, không đi inputs_from_cache.

Correction: validation đặt ở common publication boundary cho cả cache, --input và direct calls. Không tin pre-enriched legacyReferences hoặc thiếu authoritative teams/link/ledger proof; invalid input giữ selector cũ. Existing raw cache parser dùng cho dedup không bị ép publish.

### S3 — Medium: analyzer/roster callback migration incomplete

Evidence: `js/app.js:347-353` onOpenTeam có gameplay và legacy branches; consumers là callback buttons, không dùng resolveTeamDestination.

Correction: P2.3 migrate rõ nhánh legacy sang original page, giữ config branch; R4 gọi cả analyzer/roster. Source evidence bỏ mô tả sai “native callers”.

### F1 — High: missing top-level 404 preserves Pages SPA fallback

Evidence: `docs/deployment-guide.md:114`; `scripts/verify-astro-dist.mjs:44-50` chưa admit 404 output.

Correction: phase 2 tạo src/pages/404.astro, exact 404.html trong verifier và cache rules. R1/R7 kiểm tra unknown route không phục vụ root shell. Phase 4 cập nhật deployment guide; không deploy để lấy proof ngoài quyền.

### F2 — High: theme storage failure aborts boot

Evidence: `js/app.js:42-49,102-105` truy cập localStorage trước boot try.

Correction: shared chrome guard getter/read/write, system/default read fallback và in-memory toggle khi write fail. R5 tách localStorage denial khỏi sessionStorage denial, kiểm tra root/detail vẫn khởi tạo.

### F3 — Medium: dist tests preceded their build prerequisite

Evidence: package test:node bao gồm `tests-js/astro-dist-contract.test.mjs:362-376` và preview tests.

Correction: final gate build trước full test:node; không chạy test:dist riêng lần nữa vì đã nằm trong wildcard. Focused source Red không dựa vào stale/missing dist.

### F4 — Medium: native anchors deferred past their own exit gate

Evidence: card hiện tại là h3/button/article callback; phase 2 ban đầu đòi native new-tab nhưng phase 3 mới tạo anchors.

Correction: functional title/CTA anchors, snapshot interception và removal của article keyboard navigation cùng thuộc phase 2; phase 3 chỉ presentation/filter. R4 chứng minh actual anchors, không thay bằng page.goto.

### F5 — Medium: invalid config precedence weakened

Evidence: `js/app.js:281-284` kiểm tra has(config); `tests-e2e/recommended-browser.spec.mjs:92-94` giữ config=missing error thay vì mở legacy.

Correction: presence của key config luôn chặn reference migration, gồm invalid/empty selector; giữ regression và thêm valid case, không chỉ bảo vệ config resolve được.

### F6 — Low: Playwright owns an extra build and dedicated port

Evidence: `playwright.config.mjs:16-20` build+preview, port 4174, reuseExistingServer=false, startup timeout 30s.

Correction: commands ghi rõ có build của runner; manual smoke dùng port khác. Đo startup corpus 1,532 team pages trước cân nhắc timeout; không preemptive tăng timeout hoặc coi startup failure là behavioral Red.

### C1 — High: aggregate Recommended notes duplicate holder paragraphs

Evidence: `pipeline/sgsdeck_recommended.py:206-207,222` lấy cùng source paragraph vào hai fields; renderer `:62,107` render cả hai. Examples: og-bingyan-40y-lvbu-b và s23-sp-xunyu-shanhe-gong-2.

Correction: phase 1 thêm displayNotes theo source DOM occurrence/owner, giữ raw parser output và raw dedup corpus. Phase 2 render ownership projection một lần ở common/primary/alternative section, không trừ string sets hoặc xóa những occurrences giống chữ nhưng khác chủ thể. D3/R3 bảo vệ ownership, raw invariants và full conditions/stat guidance. Đây là augmentation hẹp, không parser/crawler redesign.

### C2 — Medium: visible unit/faction badges omitted

Evidence: brainstorm §6 giữ nhãn loại binh/phe; `js/render.js:126-132` có badge cũ, reference card hiện tại chưa có.

Correction: phase 3/AC07/B4/B6 yêu cầu localized visible badges theo màu/conventions cũ; không coi data-faction hoặc filter label là card label và không hồi sinh scope caption.

### C3 — Medium: counter chips lose their search domain

Evidence: `js/render.js:107-114` onTag; `js/team-filter-section.js:36-42` set query; `js/filters.js:23-30` search counter labels. Tân Ngô Thương có counter-only “team TMY”.

Correction: explicit haystack giữ notes/domain labels/good/avoid labels từ admitted/verified linked content, loại hashes/evidence URLs. B2/B4 kiểm tra click counter-only term vẫn match đội và không navigate.

## Additional parent corrections

- Verified actual CSS path css/styles.css; removed invented stylesheet filenames before review.
- Included 320px boundary and chip-not-navigation in AC/test scenarios.
- Scoped team-title map cannot leak into global alias resolution; worksheet cache includes sourceConfigId.
- Corrected source-evidence claim: current validator only enforces membership/ordered IDs, not title/lineage equality; new D5/common validation supplies that guarantee.
- Added existing docs/season-team-data.md and docs/deployment-guide.md as post-smoke documentation owners.

## Verification status

Planning-only: no application source/data/config/test files were modified by this planning work; no new build/test/browser pass is claimed. Four phase files remain pending; their 15 tasks are unchecked. Runtime hydration has the same 15 tasks blocked awaiting explicit cook authorization, with durable phase-file references and dependency order.

Observed CLI checks:
- `ak plan validate plans/260912-1916-team-browser-detail-pages --json`: valid=true, errors=null.
- `ak plan parse ... --json`: four phases, 15 tasks, zero done, zero percent.
- `ak plan use <absolute-plan-directory> --json`: worktree-private current-plan pointer set.
- `ak plan show CamNangTQCCL/260912-1916 --json`: correct feature worktree/branch, current title, pending status and four phase bodies. No broad reindex apply needed; reindex was inspected in read-only dry-run mode only.
- Python CLI help verified existing dedup/report flags; the two new builder flags are explicitly proposed.

Final machine structural sweep **passed**: AC01–AC13 đầy đủ/duy nhất; phase dependencies tuần tự không cycle; tasks 4/4/4/3, tổng 15 IDs duy nhất và khớp runtime projection; mọi plan local link tồn tại; evidence claims 10/10/10/10; 55 full-path inventory entries gồm 12 proposed files, không còn giả định stylesheet không tồn tại. Final build-before-test:node command order được kiểm tra.

`ak plan validate` chạy lại sau toàn bộ corrections: valid=true, errors=null, exit 0. `ak plan resolve --json --no-interactive` chọn đúng **CamNangTQCCL/260912-1916**, pending, feature branch/worktree. Không apply broad reindex hoặc đổi plan cũ.

Journal local ở `plans/journals/2026-09-13-team-browser-detail-plan.md`; ghi trực tiếp tại worktree do journal CLI không có explicit worktree output-dir flag. Không dùng registry mutation để đổi project root, không publish wiki/social.

**Handoff:** plan ready for explicit cook; không có unresolved planning finding sau parent corrections. Implementation vẫn pending, raw typo chưa xác thực và thời gian build corpus là execution facts cần giữ trung thực, không giả nhận đã giải quyết bằng runtime proof.
