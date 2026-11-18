---
phase: 1
title: "Đo trên đường gọi thật và chốt trần"
status: pending
priority: P1
effort: "4h"
dependencies: []
---

# Phase 1: Đo trên đường gọi thật và chốt trần
<!-- Updated: Red Team 2026-11-19 - viết lại: đo trên đường tra tên, chốt trần từ số đo, bỏ it.fails và digest literal -->

## Goal
Dựng fixture theo đúng cách client thật gọi (gửi tên, server tra), đo kích thước + thời gian của **thiết kế phase 2**, rồi chốt trần số mục / byte từ số đo trước khi sửa code.

## Context
- Client thật gửi `observedText`, không gửi `canonicalId` (tqccl-auto `advise.py:110-121` chỉ gửi id khi đã `pick`; coexist skill `SKILL.md:20`). Đường tra tên: `withResolvedNames` (`research-handlers.ts:56-97`) quét catalog mỗi mục, `similarCatalog` khi trượt, điền `displayName` từ catalog.
- Trần kết quả ràng buộc thật là **40 000 ký tự** (`tool-context.ts:12,122`), không phải 42 KiB: kết quả gọn gần như toàn ASCII.
- Số đo cũ trong `research/size-measurement.md` dùng fixture có sẵn canonicalId, tên rỗng, không có `unresolved`: **không dùng để chốt trần** (red team: thiết kế cũ ra 40 845–47 043 ký tự ở 238 mục).

## Files to Create / Modify
- Create: `mcp-worker/test/research/normalize-full-roster.test.ts`.
- Create: `mcp-worker/test/fixtures/normalize-full-roster.json` = danh sách canonicalId (93 tướng + 145 chiến pháp, từ `research/full-roster-sample.json`, không tên tài khoản). Test **dựng observation lúc chạy** từ snapshot `data/`: biến thể (a) chỉ `observedText` = tên catalog hiện tại; (b) (a) + 25 tên mơ hồ/không biết (base name có bản SP/40Y, tên Hán-Việt) để có `unresolved`; (c) có canonicalId + `familyId` lấy như `withHeroFamilies`.
- Modify: `mcp-worker/test/performance/domain-budget.test.ts` (thêm `normalizeMs` cho biến thể (a)/(b) và `recommendMs` cho kho 238 mục ở `fullBox`, `recommend-handlers.ts:326`).
- Update: `research/size-measurement.md` với số đo mới.

## Tests Before (xanh trên code hiện tại, ghim hành vi hiện tại)
1. Handler với biến thể (a) 238 mục → `INVALID_REQUEST` có `fields` chỉ `observations` (trần 100). Phase 3 đảo assert này.
2. Domain `normalizeObservations` với biến thể (c): 93 hero, 145 tactic, `unresolved` rỗng, `redStars` khớp.
3. **Bất biến digest:** helper `compactNormalizeResult` chưa có → test ghim `normalizationDigest` của domain cho biến thể (c) bằng cách tính lại `createNormalizationDigest(canonicalState)` sau khi xoá `displayName`/`evidence`/`confidence` khỏi heroes/tactics và `evidence` khỏi unresolved: phải bằng digest gốc. Không ghim chuỗi hash literal (id phụ thuộc catalog).

## Đo (script trong test, in ra, không ghim byte)
Áp thiết kế phase 2 (`phase-02-compact-output.md` › Design) lên kết quả domain + `commonResult` + `workflowVersion` thật cho: (a) 238, (b) 238+25, ca xấu nhất = N mục tên catalog dài nhất **tất cả không biết** (mỗi mục 5 `candidates`) trong trần byte đầu vào dự kiến. Ghi ký tự và byte vào `research/size-measurement.md`.

## Chốt trần (quyết định ghi vào phase 3 › Decisions trước khi sang phase 2)
- `MAX_NORMALIZE_OBSERVATIONS` = N lớn nhất sao cho ca xấu nhất < 40 000 ký tự, có dư ≥ 10 %.
- `MAX_NORMALIZE_REQUEST_BYTES` sao cho `1,07 × trần + envelope JSON-RPC (~512 B) ≤ 65 536` (escape ASCII của client, red team: +5,5 %).
- **Nếu N < 238: dừng, báo user, replan** (phân trang đang ngoài phạm vi). Không hạ mục tiêu âm thầm.
- <!-- Updated: Validation Session 2 - user chốt trần thực tế --> **Đã chốt (2026-11-19, user):** ca toàn tên sai cho N ≈ 131–174 < 238, nên không lấy ca xấu nhất làm trần. Trần = **300 observation**, byte request **60 770 B**. Bảo đảm: kho ≤ 300 mục với ≤ 40 mục chưa rõ (tỉ lệ tướng/chiến pháp như kho thật) lọt 40 000 ký tự; vượt thì `RESULT_TOO_LARGE` (lỗi có kiểu, nextAction hướng dẫn sửa tên/gửi ít hơn). Số đo: `research/size-measurement.md` › Đo lần 3.

## Success Criteria
- Test 1–3 xanh; số đo (a)(b)(xấu nhất) và thời gian `normalizeMs`/`recommendMs` có trong `research/size-measurement.md`; trần đã chốt từ số đo.

## Risk Assessment
- Catalog đổi tên (#164) làm biến thể (a) đổi: fixture chỉ lưu canonicalId, tên lấy từ snapshot lúc chạy, nên test tự theo data. Tín hiệu hỏng: canonicalId fixture không còn trong snapshot → test báo rõ id nào, cập nhật fixture.
- `normalizeMs` (a) vượt 2 s ở domain: dừng, replan (cân nhắc trần thấp hơn) trước phase 3.
