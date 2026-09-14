# Planning verification — Việt hóa toàn bộ

Ngày: 2026-09-14 (+07). Đây là bằng chứng **lập plan**, không phải implementation test result.

## Intake và scope challenge

- Giữ toàn outcome brainstorm; không cắt Analyze/Recruit/Roster hay các state do `--yagni`. Loại runtime translator/admin UI/new service, không thêm engine/Worker API migration.
- 11-slot display-only fix đã hoàn tất; không chạy lại để xác nhận user-reported result và không xếp thành task sửa mới.
- Không hỏi lại preferences đã chốt. Những lựa chọn còn lại là closure kỹ thuật có evidence, không product decision cần user cân nhắc.

## Research và Kongming checkpoints

- `WebSurfacePlan` (scout, read-only): tám mounts, standalone routes, current render/raw fallbacks, UI/provider/user text boundaries và test seams. Nguồn chính: `js/app.js:111–151`, `js/recommended-reference-render.js:161–179`, `js/render.js:382–400`, `js/analyze.js:54–70`, `js/roster-recommend-ui.js:148–223`, `js/recruit-tracker.js:18–70`.
- `PublicationPlan` (scout, read-only): reuse ledger, immutable Recommended boundary, non-Recommended gap, source cache, manifest/dist/CI. `pipeline/lookup_translations.py:13–88`, `pipeline/build_recommended_reference.py:110–121,353–412,587–740`, `src/lib/root-static-artifacts.ts:153–213`, `src/lib/recommended-reference-artifacts.ts:25–70`, `.github/workflows/mcp-worker.yml:25–91`.
- `PlanCounsel` (`kongming`): scope GO; yêu cầu chốt projection, real glossary freshness, independent receipts, dynamic origin và portable source trước freeze kiến trúc. Config đọc được là `model: @advisor`; không có bằng chứng model ID nên không tuyên bố Fable/Sol cụ thể.
- Architecture checkpoint GO về C2/C3/C4 shape; hai closure đã đưa vào contract/phase: raw normalized input cần hydrate lại metadata/localization vì `--input` chỉ JSON-load; captured snapshot phải cung cấp bytes cho `readPublicArtifact`, không chỉ HTML pin.
- Main kiểm trực tiếp: cache 1.444 pages / 117.522.979 bytes; normalized current candidate serialized ~6,19 MB. Chọn parsed private input, không commit HTML cache. Raw corpus và inventory hash đã ghi C3.
- Main phát hiện shared `SiteLayout.astro:20–29,68–88` giữ literal/nav riêng và không có `src/components/SiteHeader.astro`; plan dùng owner thật.
- Main khóa order phase 3: RED trên site cũ → implementation A/B/C → strict compile D → integrated A/B/C Verify → final E. Không bắt browser test build với artifact chưa tạo.

## Command provenance

Lệnh hiện có đã đối chiếu source/help: `ak plan create/add-phase/validate/reindex/use`, root npm scripts, Python unittest discover, Lookup build/validate/promote, Playwright project `astro`, Recommended CLI và credential-free repository gate.

Lệnh **đề xuất mới**, chỉ chạy trong cook sau task tạo implementation: `python3 -m pipeline.site_localization capture|inventory|build|check`, `npm run verify:localization`, test files/names mới được phase gắn rõ Create. Không báo chúng đã chạy/pass trong phiên này.

Các lệnh planning thực sự chạy: CLI scaffold ba phase; prefs resolve (`journal.auto` không override, default true); source/cache sizing và structural inspection. Không chạy app build/test, không sửa application/data files trong phiên lập plan.

## Red Team Review

Bốn lens độc lập: Security/Fact Checker, Failure Modes/Contract Verifier, Assumptions/Fact Checker, Scope–Complexity/Contract Verifier. Standard tier cho ba phase. Không reviewer nào chạy test/build/lint hoặc sửa file.

Kết quả: 5 observations từ bốn lens + Kongming, hợp nhất thành **4 unique findings: 1 High, 3 Medium**. Accept cả 4; một duplicate về section wrapper được hợp nhất, không bỏ scope. Failure Modes không xác nhận blocker riêng.

### R1 — Source inventory pin chép sai — High — Accept

- Reviewer: FinalPlanCounsel.
- Evidence: `pipeline/recommended-other-teams.json:5607`; builder strict equality tại `pipeline/build_recommended_reference.py:192–193,669–670`.
- Failure: P1-B sẽ reject source đúng nếu buộc bằng hash chép thiếu ký tự.
- Applied: C3 baseline dùng đúng authority digest; kiểm lại đủ 64 hex và bằng captured inventory. Không thay source/pins trong repo để né lỗi.

### R2 — Bỏ sót intermediate renderer — Medium — Accept

- Reviewers: ScopePlanReview và AssumptionPlanReview (cùng một finding).
- Evidence: `js/app.js:181,332–333`; `js/team-filter-section.js:244,249,300–304,334,364,375`.
- Failure: Không forward display context, search Cùng Tồn chỉ raw, tooltip tiếp tục lộ Hán/intro English.
- Applied: C1/C6, P1 inventory, P3 files/caller closure/tests. Explicit callbacks thay array-index forwarding; Việt/Hán search; kiểm season/facet/category titles; migrate direct e2e callers.

### R3 — Receipt không giữ output để offline kiểm — Medium — Accept

- Reviewer: SecurityPlanReview.
- Evidence: `pipeline/lookup_translations.py:70–79` chỉ kiểm metadata không rỗng; schema này không tự chứng minh reviewer output.
- Failure: Ephemeral output biến mất ở clean CI; hoặc không verify được, hoặc false acceptance từ metadata.
- Applied: private portable reviewer outputs, digest + actual runtime metadata + per-item accepted binding; reject missing/tampered/rejected/mismatched output. C2, P1-C và P2-A cập nhật. Main capture thật là trust boundary, không signing service và không ledger thứ hai.

### R4 — Generated Worker label bị coi nhầm OCR — Medium — Accept

- Reviewer: SecurityPlanReview.
- Evidence: `worker/src/schema.ts:152` sinh `Team N`; `js/roster-scan-map.js:113,123` giữ tên; roster UI render tên đó.
- Failure: Client fallback đã dịch nhưng unnamed scan vẫn hiện English từ upstream producer.
- Applied: sửa default tại producer, giữ wire schema/genuine names; test input thiếu tên qua validator thật + browser dùng output đó; thêm targeted Worker test/typecheck. C1 và P3-C cập nhật; production proof phụ thuộc deployment approval riêng.

### Kongming closure checkpoint

FinalPlanCounsel kiểm lại deltas và kết luận **GO — planning readiness**, required fixes `[]`. Đã xác nhận cả bốn closures, normalized capture không strip mất scope/owner và giữ `--advice --yagni`/TDD. Không claim implementation hay live Worker đã pass.

## Validation Log

- Questions asked: 0. Không có product choice mới; không mở lại preferences đã chốt.
- CLI `ak plan validate plans/260913-2018-viet-hoa-toan-bo --json --no-interactive`: exit 0, `valid:true`, `errors:null`.
- `ak plan parse`: 3 phases, 12 tasks, 0 done; plan pending, phase parser normalizes pending thành todo. Không đánh dấu implementation hoàn tất.
- Structural/TDD check: 3/3 phase có literal Failure Protocol, Tests Before/Refactor/Tests After; 12/12 task có Goal/Target/Steps/Success criteria/Verify.
- 13 bash code blocks được `bash -n` syntax-check thành công. Không execute các implementation commands hoặc proposed CLIs.
- Local Markdown links được resolve, không broken link. Existing API/caller claims đã grep trực tiếp; new files/subcommands/test names được phân loại proposed, không báo là đã tồn tại.
- CLI scaffold dùng UTC nên tên folder `260913-2018`; session report dùng ngày địa phương 2026-09-14 (+07). Không rename folder do khác timezone.

### Whole-plan consistency sweep

- Đọc index, cả ba phases và hai reports; phase dependencies acyclic 1 → 2 → 3.
- Kiểm 8 decision deltas: inventory authority pin; intermediate wrapper; portable review outputs; generated Worker default; normalized hydration; shared emitted bytes; phase-3 build/test order; stable display-key serialization.
- Source inventory/corpus digests bằng authority; không còn typo cũ. New path/command declarations và source-preservation/identity/lookup boundaries nhất quán.
- Unresolved mandatory findings: **0**. Unresolved product decisions: **0**. Implementation tests/browser proof: **chưa chạy, thuộc cook**, không thay bằng planning review.

### Task handoff

12 checklist items trong phase files là source of truth. Runtime projection giữ 3 groups/dependencies và trạng thái chờ lệnh cook; không tự triển khai sau khi lập plan. Auto journal theo preference mặc định; không publish AgentWiki/GitHub hay deploy.
