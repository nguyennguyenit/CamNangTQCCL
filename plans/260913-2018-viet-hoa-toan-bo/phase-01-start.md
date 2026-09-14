---
phase: 1
title: "Contract, inventory và nguồn offline"
status: pending
priority: P1
effort: ""
dependencies: []
---

# Phase 1: Contract, inventory và nguồn offline

## Goal

Chốt mẫu số toàn website, input portable và validation contract trước khi dịch hàng loạt; chưa đổi UI hay chọn generation mới.

## Context và decision gate

Đọc [C1–C6](reports/contracts.md) và brainstorm được index dẫn tới. Baseline 11 ô đã sửa là đầu vào, không phải task. `--advice --yagni --tdd` áp dụng cả phase. Kongming kiểm khóa source/owner/glossary/review trước phase 2; không có council khả dụng thì STOP, không tự bỏ qua.

## Files to Create / Modify

- Create: `pipeline/site_localization.py`, `pipeline/site-localization-policy.json`, `pipeline/localization-inputs/recommended.json`, `tests/test_site_localization.py`.
- Modify: `pipeline/lookup_translations.py`, `tests/test_lookup_translations.py` (Unicode guard, giữ API/schema).
- Read/reuse, không đổi source data: `pipeline/build_recommended_reference.py`, `pipeline/recommended_identity.py`, `pipeline/build_unified_lookup.py`, name/display/identity maps, raw `data/**`, current Recommended selector, `pipeline/recommended-other-teams.json`.
- Inventory read set: mọi consumer và source field trong C1; không thêm parser framework, service hay admin UI.

## Tests Before

Trước Unicode fix, thêm `test_rejects_extended_han` vào test ledger hiện có: fixture ledger hợp schema, đầy đủ review, nhưng textVi có một Han Extension-B ngoài U+9FFF; gọi validator thật và yêu cầu ValueError. Test hiện tại phải đỏ do **không reject chữ Hán đó**, không do import/setup.

```bash
python3 -m unittest discover -s tests -p test_lookup_translations.py -k rejects_extended_han -v
```

Pass của bước RED: exit khác 0, chạy đúng 1 test, assertion dự kiến thất bại. Exit 0 hoặc 0 tests là không đạt. Lưu full output vào execution evidence. Expected RED là pass, không kích hoạt Failure Protocol.

Viết fixture tests cho source capture và receipt contract trước từng implementation slice. Module/CLI mới phải có đường chạy thật trước khi đánh giá RED; lỗi “module/command not found” không phải RED hợp lệ. Giữ characterization hiện có cho raw/ownership thay vì bịa source HTML.

## Tasks & Steps

### P1-A — Chốt inventory và policy có owner

- **Goal:** Không bỏ sót tab/state/English-only field.
- **Target:** `pipeline/site-localization-policy.json`; UI/source read set ở C1.
- **Steps:** (1) Trace tám mount từ `js/app.js` và cả hai detail entrypoints. (2) Liệt kê concrete record/field ownership và dynamic states; ghi current source-file hashes, render symbol, field pattern, classification, glossary dependency và exact exceptions. (3) Inventory cả source-owned coexist, legacy embedded references, khaihoang options, 3.503 Lookup entries và UI/error text. (4) Tách alias search/user content/provider prose. (5) Ghi baseline source/identity/dedup/gameplay hashes và counts; không lấy 1.117 chuỗi làm tổng site.
- **Success criteria:** Mỗi location có đúng một classification; không wildcard miễn toàn panel; mọi tab/route/state trong C1 có owner; không đổi raw files.
- **Verify:** Sau P1-C, chạy `python3 -m pipeline.site_localization inventory --root . --report .cache/site-localization-inventory.json`. Exit 0; JSON liệt kê đủ 8 section IDs, 2 route families, record counts, classifications và UI states; `unknownLocations=0`, `duplicateLocations=0`. Missing translations được báo bằng số thật ở phase này, không giả thành 0 và không phát hành.

### P1-B — Capture nguồn Recommended portable

- **Goal:** CI không phụ thuộc cache ở worktree của người lập plan.
- **Target:** `pipeline/site_localization.py` subcommand `capture`, normalized snapshot, tests.
- **Steps:** (1) Reuse `inputs_from_cache` để đọc cache gốc, kiểm mọi page hash/inventory/corpus với pins trong C3. (2) Xuất normalized private input, giữ raw+note ownership, loại projection Việt cũ; ghi capture provenance private. (3) Từ chối cache khác/missing/symlink/path escape trước ghi output. (4) Không ghi lại snapshot có sẵn nếu bytes khác khi không có source-update approval; không force-update pins. (5) Xác nhận snapshot rebuild được ngoài cây cache.
- **Success criteria:** Có source pack kiểm chứng được, đủ 1.366 records và complete scope inventory; raw corpus/inventory hashes bằng C3; không recrawl, không serialize từ public DTO; source pack không được public allowlist.
- **Verify:** Lệnh **mới, được tạo bởi task này**:

```bash
RECOMMENDED_CACHE=/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/.cache/sgsdeck-recommended python3 -m pipeline.site_localization capture --cache /Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup/.cache/sgsdeck-recommended --output pipeline/localization-inputs/recommended.json
python3 -m unittest discover -s tests -p test_site_localization.py -k capture -v
```

Exit 0 ở cả hai. Capture command dùng đường cache **chỉ lần đầu**; API nhận `--cache` bất kỳ được xác minh. Tests chạy trên fixture/copy tạm, chứng minh corrupted page bị reject, output chưa tồn tại sau lỗi, cùng snapshot ở hai independent roots byte-identical. Không chạy lại against mutated real cache.

### P1-C — Validator, glossary freshness và review receipts

- **Goal:** Không thể hợp thức hóa draft bằng `status: reviewed` tự điền.
- **Target:** `pipeline/site_localization.py`, policy, `lookup_translations.py`, hai test files.
- **Steps:** (1) Implement full-Han guard bằng Unicode ranges kiểm chéo với JS `Script=Han`, không thêm dependency nặng; không chỉ BMP. (2) Build expected site fingerprints từ chosen raw/context + actual glossary digest; reuse serializer/validator hiện có. (3) Validate exact coverage, duplicate/missing/stale/extra key và source owner. (4) Receipt checker bind actual independent sessions, inputFingerprint, exact text hash, glossary digest, verdict; Lookup review in-place, không copy ledger. (5) Inventory/hash refresh phải explicit và được review; build/check không tự chấp nhận code/nguồn mới. (6) CLI `inventory` là read/report; `check` là fail-closed, không viết source/policy/ledger/output.
- **Success criteria:** Changed owner/source/text/glossary content—even unchanged label—invalidates old receipt; English-only missing entry cũng fail; source thật sự thiếu khác với source có mà chưa dịch; lỗi trả location+reason, không raw provider content ra browser.
- **Verify:**

```bash
python3 -m unittest discover -s tests -p test_site_localization.py -v
python3 -m unittest discover -s tests -p test_lookup_translations.py -v
python3 -m unittest discover -s tests -p test_build_unified_lookup.py -v
```

Mọi command exit 0, không skip contract mới. Fixtures kiểm same text/different owner, changed glossary bytes/same label, changed draft after review, same draft/reviewer session, missing receipt, missing source vs untranslated, extended Han, English-only coverage. Test lookup hiện có giữ exact schema và public DTO semantics. Site `check` trên dữ liệu thật chưa hoàn tất dịch phải exit khác 0 với coverage diagnostics; đó là expected incomplete-state verification, không được “fix” bằng bỏ coverage gate.

Receipt fault tests bổ sung: private reviewer-output file thiếu, bytes bị sửa, item rejected, session/key/text binding sai đều reject; valid captured output ở clean temp root passes. Không dùng hai session strings tự khai hoặc ephemeral `agent://` làm bằng chứng duy nhất. P1-A phải inventory `js/team-filter-section.js` và generated default tại `worker/src/schema.ts`, không chỉ renderer cuối.

## Refactor

Chỉ chia helper nếu validator/capture có duplicate logic thực; dùng lại canonical serializer và Recommended parser/localizer. Không rename/move toàn bộ Lookup module. Không tăng abstraction để hỗ trợ ngôn ngữ khác.

## Tests After / Phase gate

- Các Verify trên có đúng pass condition; không cần chạy full repository suite trong phase 1.
- Inventory và captured source report được lưu private; chưa đổi `current.json`, chưa generate/publish site projection.
- Kongming xem actual report + RED/GREEN evidence + C1–C4 delta. Chỉ GO mới sang phase 2.

## Implementation checklist

- [x] P1-A Chốt inventory toàn site và owner policy
- [x] P1-B Capture nguồn portable và chứng minh raw parity
- [x] P1-C Khóa freshness cùng bằng chứng review độc lập

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
