# Plan verification and validation

Date: 2026-09-07. Planning only.

Current decision: user selected roster-level guide/score ownership on 2026-09-09. The [latest decision update](#roster-guide-decision--2026-09-09) supersedes the pending ownership question and exact-build guide assumptions in older entries, red-team reports and research notes. Stage-specific tactic/commander evidence remains valid independently.

## Verification

Standard tier: Fact Checker and Contract Verifier; 10 static source checks per phase. Checks below verify existing owners, not proposed implementation. No behavior pass is inferred from static presence.

- VERIFIED: `data/khaihoang.json:2` contains `"teams"`.
- VERIFIED: `data/khaihoang.json:1396` contains `"chamSuTeams"`.
- VERIFIED: `data/khaihoang.json:1207` contains `"mines"`.
- VERIFIED: `data/khaihoang.json:41` contains `"variants"`.
- VERIFIED: `tests-js/khaihoang-data.test.mjs:84` contains `transforms`.
- VERIFIED: `data/heroes-dict.json:64` contains `SP Chu Tuấn`.
- VERIFIED: `data/tactics.json:1007` contains `Hoành Tảo Thiên Quân`.
- VERIFIED: `pipeline/aliases.json:24` contains `Hoành Tào`.
- VERIFIED: `pipeline/build_json.py:99` contains `build_khaihoang_payload`.
- VERIFIED: `tests/test_parse_secondary.py:37` contains `11`.
- VERIFIED: `js/render.js:220` contains `function khaihoangTeamCard`.
- VERIFIED: `js/render.js:197` contains `function khaihoangHeroRow`.
- VERIFIED: `js/render.js:236` contains `function showBuild`.
- VERIFIED: `js/render.js:239` contains `replaceChildren`.
- VERIFIED: `js/render.js:268` contains `function chamSuTeamCard`.
- VERIFIED: `js/render.js:282` contains `function minesGrid`.
- VERIFIED: `css/styles.css:314` contains `minmax(min(100%, 320px)`.
- VERIFIED: `tests-e2e/khaihoang-options.spec.mjs:79` contains `routeKhaihoang`.
- VERIFIED: `tests-e2e/khaihoang-options.spec.mjs:94` contains `Chuyển hình đề xuất`.
- VERIFIED: `js/render.js:215` contains `h.note`.
- VERIFIED: `js/app.js:80` contains `loadJSON("./data/khaihoang.json")`.
- VERIFIED: `src/lib/public-artifact-manifest.mjs:46` contains `khaihoang`.
- VERIFIED: `src/pages/data/[file].json.ts:4` contains `prerender`.
- VERIFIED: `scripts/verify-astro-dist.mjs:59` compares `sourceBytes.equals(emittedBytes)`.
- VERIFIED: `tests-js/astro-dist-contract.test.mjs:47` contains `khaihoang.json`.
- VERIFIED: `tests-js/runtime-asset-contract.test.mjs:9` contains `khaihoang.json`.
- VERIFIED: `package.json:6` contains `>=22.12.0 <23`.
- VERIFIED: `playwright.config.mjs:3` contains `4174`.
- VERIFIED: `playwright.config.mjs:19` contains `reuseExistingServer: false`.
- VERIFIED: `docs/system-architecture.md:67` contains `chamSuTeams`.

Final static checks: 30 verified, 0 failed. Initial generic Buffer token probe missed actual byte equality expression; direct read verified sourceBytes.equals(emittedBytes).

## Validation interview

Three questions sent asynchronously, no responses received as of this record:

1. Với hai team mới ở ảnh 7 và 9, ảnh chưa có bộ chiến pháp chính. Mình đề xuất vẫn thêm đủ tướng và hướng dẫn, để trống phần chiến pháp chưa biết; bạn muốn cách nào? Options: Thêm team, chỉ hiện thông tin đã biết (Khuyến nghị) | Tìm đủ chiến pháp chính trước khi thêm. Proposed default remains unapproved.
2. Ảnh 2 “关乐枪” có dòng tướng thay thế nên chưa khớp chắc với team Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ hiện tại. Bạn xác nhận team này gồm ba tướng nào? Free text; identity unresolved.
3. Các ảnh có điểm cho bộ ba tướng nhưng không ghi đầy đủ chiến pháp chính. Bạn muốn điểm và hướng dẫn đặt ở cấp team, hay chỉ gắn khi xác định đúng bộ chiến pháp? Options: Dùng chung cho team, ghi rõ chưa chấm riêng từng bộ chiêu (Khuyến nghị) | Chỉ gắn cho cấu hình có đủ thông tin chiến pháp. This materially changes guide ownership; no implementation-ready handoff until answer propagated.

Existing confirmed decisions reused without re-asking: six groups, current-only, no main season/source display, summary/disclosure, preserve Chạm Sứ.

## Red-team adjudication

3 unique Medium findings from 3 reviewers; duplicate hero-note findings deduplicated.

| Finding | Disposition | Result |
|---|---|---|
| Hero note retains source labels (`js/render.js:215`, `data/khaihoang.json:341`) | Accept, within existing no-source scope | Phase1/2 hero-owned displayNote, explicit empty-string handling and real-data sentinel |
| Qualitative hột notes can disappear (`reports/image-intake.md:25`) | Accept, within existing six-group scope | Phase2 note-only whole-team/named-hero rendering and E2E |
| Three heroes cannot prove exact tactic-build rating (`data/khaihoang.json:998`) | Accept evidence; ownership change awaits user | Removed arbitrary default attachment; explicit options/gate across phases |

Routine corrections implement already authorized planning scope. No user decision reversed.

## Tooling and boundaries

CLI scaffolding and active plan pointer succeeded. CLI add-phase created phases without updating all index rows; link-only index synchronization performed, all statuses still pending/todo. Format validation passed; not behavioral validation. No suitable runtime task-management surface found; durable phase checklists retained. Session set-active-plan.cjs helper absent in project/global checked paths; no missing script executed. Shell Node24 baseline is unsupported for delivery, compatible Node22 remains a setup prerequisite. No servers started by controller or reviewers. Researchers ran data tests 3/3 and discovered 21 Playwright cases; no browser suite pass claimed.

## Whole-plan consistency sweep

Read index and all3 phases after corrections; compare owning guide schema, selected-build gate, hero displayNote, qualitative red requirements, all11 coverage, missing tactic policy and no-season/no-source boundary. Pre-review exact-build design remains explicitly conditional; roster-level alternative is not silently implemented. Implementation handoff is pending applicability decision, image2 identity and 7/9 policy. Old seasonal index and four phases exclude Khai hoang; no hard blocking output dependency, shared renderer integration sequential.

Sweep: index and all three phases re-read after corrections; alternatives explicitly pending. No conflicting approved implementation paths; applicability decision unresolved, no cook-ready claim.

Journal CLI resolved the wrong project root (/Users/plateau) despite project cwd. Moved only this newly created entry into project plans/journals immediately; no journal remains outside allowed root. No skill/config code changed.

## Validation update — 2026-09-07 13:00

User supplied an additional image and answered “Thái Văn Cơ”. Image 2 opening roster confirmed: Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ. Image labels 程普（后期）, meaning Trình Phổ as later-stage replacement. Earlier unresolved-image2 statements in dated research/review records are superseded by this answer. Updated index, phases 1/3, image intake and accepted brainstorm. Remaining user decisions: images7/9 incomplete tactics representation and team-level versus tactic-specific guide applicability. No runtime change.

## Research update — 2026-09-07

User chose research for images 7/9, superseding the unanswered roster-only proposal above. [Research report](../../reports/research-260907-1421-khai-hoang-missing-tactics.md) records direct image evidence for six learned tactics at level 32 (image 7) and video frames for three before level 20 (image 9). All eight distinct tactic names match `data/tactics.json` using `viet`. Opposite-stage evidence, independent confirmation and score ownership remain unresolved. No runtime mutation or implementation tests performed; planning links and intake updated.

## User proposal update — 2026-09-07 15:15

Recorded both user-proposed pre-20 Hoa–Bố–Từ builds in the research report and owning phase. Explicitly personal assessment; not promoted to battle-verified evidence. Tam Thế activation rationale and leader positions remain unverified. No default build selected, no score inherited, no runtime changes.

## Full video update — 2026-09-07 16:28

FFmpeg inspected the user-provided complete 58.514-second video. Frame 00:10 resolves all six learned tactics at level 22 for image 9; Gia Cát Khác is leader, Hạ Hầu Uyên and SP Chu Tuấn deputies. Names checked against `data/tactics.json`. Earlier missing-post-awakening statements are superseded: the opening portion was previously overlooked. Report, index, owning phase and intake updated; no runtime changes.

## Audit corrections — 2026-09-09

User requested “Sửa plan đi”, authorizing the three accepted findings in [the audit](audit-260909-0146-khai-hoang-team-details.md). Applied all three to planning documents; no implementation or guide-ownership choice was authorized by this request.

| Finding | Applied contract |
|---|---|
| Exact stage expectations missing for new default builds | Phase 1 defines independent commander/unit/tactic-slot expectations and deliberate absence for root builds and variants. Phases 2/3 verify those expectations on actual JSON at the real route, including SP Chu Tuấn → Gia Cát Khác and the verified image-7 later stage. |
| Canonical validation scope ambiguous | Phase 1 limits strict checks to new/changed reference fields; unchanged legacy alias/compound values are compared against pre-edit values, with no blanket exception for new data. Phase 3 and the index preserve this boundary. |
| Phase 3 unresolved evidence wording stale | Phase 3 marks both image-9 stages resolved in the report and separates image-7 pre-20 proposals, independent/current source limitations, guide applicability and full transcription still pending. |

Whole-plan sweep: re-read `plan.md` and all three phase files; checked three decision deltas across contracts, implementation steps, test matrices and acceptance criteria. Zero unresolved contradictions from the corrections; the pre-existing ownership decision remains open. Historical interview/research entries above retain their dated context and are superseded by the later updates where stated.

Validation: `ak plan validate plans/260907-0353-khai-hoang-team-details --json` exited 0 with `valid: true`. Local file-link/whitespace checks passed. No application test/build, RED/GREEN execution, server, commit or deploy; all phase statuses and implementation checkboxes remain pending.

## Roster guide decision — 2026-09-09

User answered “Theo bộ ba tướng”. Ownership is resolved: one optional `teams[].guide` shared by all same-roster builds, no `variants[].guide`. Exact three canonical hero identities determine the parent roster; row order/commander/tactic changes do not change guide ownership. A different third hero remains a different team.

The guide renders once outside `.kh-build` with “Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp.” Its content and disclosure state persist through variant selection. Selected unit/tactics/commanders update independently, and guides never cross roster boundaries. Conditions in source guidance remain visible; shared ownership does not establish that every tactic build has the same effectiveness.

Updated index, all three phases, image intake and accepted brainstorm. Replaced selected-build guide replacement/collapse tests with parent-guide persistence, no variant override, guide-less parent and cross-roster isolation cases. Kept exact image-7/9 stage expectations, independent fixtures, narrow canonical checks, all-11 coverage and current-only presentation. The prior assumption that guide ownership awaits a user answer is superseded; remaining work is transcription, unresolved build evidence and implementation validation.

Whole-plan sweep checks: parent-only schema, guide placement, disclosure state, separate build data, conditional wording, test expectations and remaining-input wording across all execution files. This is a planning decision update; no runtime data/code changes or behavioral test result is implied. All implementation phases remain pending.

Validation after the ownership update: re-read index and all three phases; no unresolved ownership contradictions. `ak plan validate` returned `valid: true` (exit 0); all 20 local file links/anchors across the eight edited planning documents resolved, whitespace checks passed, and other tracked/untracked workspace files matched their pre-edit hashes. No build or application tests run.
