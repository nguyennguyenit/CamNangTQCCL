---
phase: 2
title: "Dịch, kiểm độc lập và candidate publication"
status: pending
priority: P1
effort: ""
dependencies: [1]
---

# Phase 2: Dịch, kiểm độc lập và candidate publication

## Goal

Hoàn tất toàn bộ data translation đã review; tạo candidate offline nhất quán, chưa cutover UI hoặc phát hành site chưa qua phase 3.

## Context và decision gate

Phụ thuộc phase 1 GO. Dùng C2–C4 trong [contracts](reports/contracts.md). `--advice --yagni --tdd` theo mọi batch. Capture → hydrate raw input bằng localizer/maps/ledger hiện có → reviewed projections → Recommended candidate → website sidecar là thứ tự bắt buộc, không có chu kỳ.

## Files to Create / Modify

- Create: `pipeline/site-translations.json`, `pipeline/site-translation-reviews.json`, private captured reviewer outputs `pipeline/localization-reviews/<batch-id>.json`; candidate dưới `.cache/site-localization-candidate/` (không commit/publish).
- Modify: `pipeline/site_localization.py`, `pipeline/build_recommended_reference.py`, `pipeline/site-localization-policy.json`, `tests/test_site_localization.py`, `tests/test_build_recommended_reference.py`.
- Conditional data correction only: `pipeline/lookup-translations.json`, name/display maps khi thiếu cách gọi đã review; dùng Lookup candidate/promote workflow, không ghi trực tiếp public dict.
- Preserve: raw `data/teams.json`, `data/coexist.json`, `data/khaihoang.json`, source season sidecars, source hashes, gameplay/dedup decisions; 11 display-only approvals.

## Tests Before

Thêm behavioral regression `test_rejects_missing_reviewed_notes` trong test Recommended builder: một block có id/owner/holderIndex/textRaw hợp lệ nhưng thiếu textVi phải bị publication validator từ chối. Gọi `_validated_display_notes`/publication boundary thật, không kiểm source text. Trước fix, validator hiện tại chấp nhận block nên assertion phải đỏ.

```bash
python3 -m unittest discover -s tests -p test_build_recommended_reference.py -k rejects_missing_reviewed_notes -v
```

Pass RED: exit khác 0, đúng 1 test thất bại ở missing-translation assertion, không fixture/import/hash setup lỗi. Expected RED không kích hoạt Failure Protocol. Viết thêm cases ownership/index-detail parity/receipt mutation/reproducibility trước implementation tương ứng; chỉ báo GREEN sau chạy thật.

## Tasks & Steps

### P2-A — Draft và kiểm độc lập toàn bộ data locations

- **Goal:** Đủ bản dịch có nghĩa, không “100%” nhờ bỏ record hoặc nhãn thiếu dữ liệu.
- **Target:** Site ledger, review receipts, captured inputs, Lookup ledger hiện có; không chỉnh raw data.
- **Steps:** (1) Chia batch theo domain và owner, giới hạn kích thước để mỗi reviewer đọc được đầy đủ source/context/draft. (2) Reuse canonical names; draft từng expected external text, cả English-only; dedup exact text chỉ khi context tương thích. (3) Agent/session độc lập kiểm **từng item**, ghi evidence thật theo C2; không nhận bảng tổng “reviewed all” thiếu item binding. (4) Re-review Lookup tại chỗ, không copy 3.503 entries. (5) Fix accepted errors rồi reviewer kiểm lại đúng text hash; ambiguity duy nhất cần hỏi user. (6) Duy trì denominator theo domain/owner và source-missing riêng.
- **Success criteria:** Tất cả data locations có review/canonical resolution hợp lệ; `missingTranslations`, `staleFingerprints`, `unreviewedItems`, `unresolvedMeanings`, `invalidReceipts`, `forbiddenHan` đều 0. Không yêu cầu UI literals đã cutover ở phase này; chúng được báo pending riêng, không đưa vào data-complete claim.
- **Verify:** `python3 -m pipeline.site_localization check --root . --stage data --candidate .cache/site-localization-candidate` sau P2-C phải exit 0; report có actual counts theo domain và `uiPending` riêng. Compiler/check stage data chỉ thao tác candidate; không được làm release gate mặc định.

Main capture actual independent output bytes, SHA và accepted per-item result theo C2 vào private portable files; check trong clean root phải kiểm được mà không cần session đang sống. Draft inherited dùng một actual adoption session, không bịa lịch sử. Khi sửa text/glossary, receipt/output cũ chỉ là history, không tự refresh thành accepted mới.

### P2-B — Hydrate và localize Recommended đúng publication boundary

- **Goal:** notes/team/holder display Việt nhưng source identity giữ nguyên.
- **Target:** `pipeline/site_localization.py`; `build_recommended_reference.py::{localize_rows,apply_display_map,_validated_display_notes,prepare_publication_inputs,build_generation}` và tests.
- **Steps:** (1) Hydrate source pack bằng `localize_rows` + `apply_display_map`, reattach `mappingHash`, `decisionSnapshotHash`, `dedupKeyVersion` từ authoritative map/other-ledger, không gửi raw pack thẳng vào CLI `--input` vì nhánh này hiện chỉ JSON-load. (2) Resolve từng block theo location/context, thêm textVi, giữ nguyên id/owner/holderIndex/textRaw. (3) Cùng translation map áp dụng index/details; không giữ hai bản dịch độc lập. (4) Validate thiếu/stale trước `build_generation`; source pipeline parser vẫn tạo raw notes, không bắt parser giả vờ có bản dịch. (5) Thêm private input digests vào build evidence/descriptor, bảo đảm translation-only change đổi publication identity nhưng không đổi raw hash. (6) Giữ chuẩn thiếu-source và empty/uncollected scopes hiện có; không raw fallback.
- **Success criteria:** Raw hashes và dedup decisions bằng baseline; 1.366/40 và ownership không mất; cả 11 ô vẫn đúng text, không merge với chiến pháp khác; note text Việt index/detail giống nhau theo key.
- **Verify:**

```bash
python3 -m unittest discover -s tests -p test_build_recommended_reference.py -v
python3 -m unittest discover -s tests -p test_recommended_identity.py -v
python3 -m unittest discover -s tests -p test_site_localization.py -v
```

Tất cả exit 0. Tests phải chứng minh missing/stale/owner swap reject; translation edit đổi candidate generation; raw corpus/inventory/source bytes và decision snapshot không đổi; index/detail mismatch reject; same source text dưới hai owners không bị merge.

### P2-C — Compile projection ngoài Recommended và check candidate

- **Goal:** Một sidecar display-only bind nguồn, không translated copies trong gameplay model.
- **Target:** `pipeline/site_localization.py`, policy, candidate `website-display.json`, tests.
- **Steps:** (1) Emit exact DTO C4 cho legacy/coexist/khaihoang/other rendered data; Lookup tiếp tục DTO hiện có, Recommended notes ở generation của nó, không nhân bản raw source. (2) Bind public source hashes + Recommended pin cuối; generation descriptor private gồm glossary/translation/review/UI-policy hashes. (3) `build --stage data` bắt buộc `--output`, chỉ tạo candidate dưới thư mục riêng; không ghi `data/**` hoặc selected `current.json`. (4) `check --stage data --candidate` recompute từ captured inputs và so candidate, không tự update policy/pins/receipts. (5) Default `build/check` không có `--stage data` là strict **toàn site**, dùng ở phase 3 và npm/CI, không có silent partial mode.
- **Success criteria:** Candidate deterministic, fresh và no-Han ở data display fields; byte/source/glossary/receipt mismatch bị reject. Hai output roots độc lập giống byte, không phụ thuộc absolute path hoặc clock. Candidate không được public manifest nhận.
- **Verify:** Các command **mới được tạo trong task này**:

```bash
python3 -m pipeline.site_localization build --root . --stage data --output .cache/site-localization-candidate
python3 -m pipeline.site_localization check --root . --stage data --candidate .cache/site-localization-candidate
python3 -m unittest discover -s tests -p test_site_localization.py -v
```

Exit 0 tất cả; test tạo hai temp roots và so toàn bộ artifact bytes. Fault fixtures thay source/ledger/glossary/owner/pin, thiếu receipt hoặc duplicate key phải fail mà selected publication không đổi. Report dùng actual counts, không hardcode số coverage.

### P2-D — Reconcile Lookup correction qua workflow hiện có

- **Goal:** Không phá privacy/promotion để sửa bản dịch Lookup.
- **Target:** `pipeline/lookup-translations.json`, private candidate; existing `build_unified_lookup` và `promote_unified_lookup` APIs/tests; không migration identity.
- **Steps:** (1) Nếu independent review không đổi text thì giữ public bytes/generation, chỉ lưu receipts; ghi rõ no promotion needed. (2) Nếu có correction, build candidate bằng commands dưới, kiểm semantic diff và private/public boundary. (3) Lập activation manifest mới theo schema `schemaVersion/paths`; mỗi code path nếu có bind exact source/preimage/postimage, không reuse manifest lịch sử. Với data-only correction và không code activation, paths rỗng hợp schema hiện có; reviewer xác nhận không có code path cần activate. (4) Promote local bằng transaction ID mới, không deploy; transaction bị gián đoạn chỉ recover theo workflow hiện có. (5) Rebuild/revalidate candidate site sau lookup hashes đổi; không tắt stale dependency gate.
- **Success criteria:** Không correction thì lookup public bytes giữ nguyên. Có correction thì chỉ approved text delta; public DTO vẫn không source/provenance và không mixed bundle; dependent publications được recapture/review khi có dependency thay đổi.
- **Verify:** Nếu có correction:

```bash
python3 -m pipeline.build_unified_lookup build --inputs pipeline/lookup-inputs --source data/sgsdeck --identity pipeline/lookup-identity.json --translations pipeline/lookup-translations.json --output pipeline/lookup-output/site-vi-candidate
python3 -m pipeline.build_unified_lookup validate --candidate pipeline/lookup-output/site-vi-candidate
python3 -m pipeline.promote_unified_lookup promote --candidate pipeline/lookup-output/site-vi-candidate --activation pipeline/lookup-output/site-vi-activation/activation-manifest.json --transaction site-vi-260913-2018 --root .
python3 -m unittest discover -s tests -p test_promote_unified_lookup.py -v
```

Exit 0 từng command; transaction ID phải chưa tồn tại (không reuse/force overwrite); manifest do task tạo sau review, không placeholder. Nếu ID đã tồn tại, chọn fresh ID và ghi evidence trước mutation. Nếu không correction, Verify là receipt coverage + byte hashes bằng before snapshot, **không chạy promote vô ích**. Sau nhánh có correction, chạy lại P2-C, cần exit 0.

## Refactor

Reuse existing hydration/hash code, không copy parser/dedup/lookup promotion. Không tạo một generation manager thứ hai cho sidecar. Review bằng batch receipts nhỏ nhưng cùng một ledger schema; không fanout hai writers chung ledger, Main/integration owner merge kết quả đã kiểm.

## Tests After / Phase gate

- P2-A/B/C và nhánh P2-D áp dụng đều đạt; full data coverage + independent checks đã có evidence thật.
- Chưa tuyên bố toàn website Việt hóa khi UI literals/states còn pending.
- Kongming kiểm candidate report, source parity, lookup branch evidence, batch receipts và các ambiguity. Không unresolved meaning; GO mới sang consumer cutover.

## Implementation checklist

- [x] P2-A Dịch và kiểm độc lập mọi data location
- [x] P2-B Localize Recommended giữ nguyên raw và ownership
- [x] P2-C Compile candidate display có dependency pins
- [x] P2-D Reconcile Lookup review bằng promotion hiện có

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
