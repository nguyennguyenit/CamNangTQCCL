# Đo kích thước normalize (2026-11-19)

Nguồn: `research/full-roster-sample.json` (93 tướng + 145 chiến pháp, canonicalId theo catalog, ẩn danh).

## Đo lần 1 (KHÔNG dùng để chốt trần)
Gọi thẳng `normalizeObservations` với canonicalId có sẵn: bỏ qua tra tên, `displayName` rỗng, `unresolved` rỗng, chưa tính `commonResult`.

| Biến thể (238 mục) | Byte |
|---|---:|
| Hiện tại (full) | 111 054 |
| state bỏ `evidence`/`confidence` + observations chỉ id | 32 517 |

## Đo của red team (thiết kế phase 2 bản đầu, `workflowVersion` giả)

| Ca | Ký tự | Kết quả |
|---|---:|---|
| canonicalId, tên rỗng, có `entityKind` | 37 851 | qua, dư 2 149 |
| tên catalog điền đủ | 41 038 | `RESULT_TOO_LARGE` (≥ 40 000 ký tự) |
| đường tqccl-auto (tên), 22 mơ hồ đã pick | 40 845 | `RESULT_TOO_LARGE` |
| đường tqccl-auto lần đầu, 22 unresolved | 47 043 | `RESULT_TOO_LARGE` |
| 300 tên dài nhất: request | 63 456–74 888 B | vượt 60 KiB, không tới bước output |

Kết luận: trần ràng buộc là 40 000 ký tự; phải bỏ tên khỏi state và bỏ lặp unresolved (phase 2 bản sửa), rồi đo lại theo phase 1 trước khi chốt trần.

## Đo lần 2 (phase 1, 2026-11-19)
Harness: `mcp-worker/test/research/normalize-full-roster.test.ts` + `test/fixtures/normalize-full-roster.{json,ts}`. Đường tra tên là **bản sao** `withResolvedNames`/`withHeroFamilies` (handler chặn > 100 mục; test xác nhận bản sao trùng handler thật trên 55 mục). Thiết kế phase 2 áp bằng `projectCompact` (state `{canonicalId,familyId,redStars?,level?,manual?}`, tactics `{canonicalId,manual?}`, unresolved bỏ `evidence` giữ `trust`, observations chỉ mục đã giải quyết, `commonResult` + `workflowVersion` thật, provenance có `trust`). `evidence` request: `{sourceScope:"currentTurnImage",batchId:"roster-sweep-1"}`.

| Ca | Request (ký tự / byte) | Kết quả (ký tự / byte) | unresolved | `normalizeMs` (domain) |
|---|---:|---:|---:|---:|
| (a) 238 tên catalog | 36 859 / 37 921 | 29 617 / 29 676 | 22 (22 mơ hồ, 0 không biết) | 9 ms |
| (b) 263 = (a) + 25 (10 mơ hồ, 15 Hán-Việt không biết) | 40 518 / 41 682 | 33 383 / 33 544 | 47 (32 mơ hồ, 15 không biết) | 14 ms |
| Xấu nhất tại trần byte (N = 377, tên dài nhất, toàn unknown) | 58 608 / 60 722 | **73 872 / 75 986** | 377 | — |
| Xấu nhất, N lớn nhất có kết quả ≤ 36 000 ký tự | 26 352 / 27 306 | 35 866 / 36 820 | 168 | — |

- Trần byte ứng viên: `floor((65 536 − 512) / 1,07)` = **60 770 B**.
- Ca xấu nhất dùng tên catalog dài nhất đã biến đổi nhẹ (`?` / cắt đầu / cắt cuối) để không khớp đúng; ưu tiên tên cho đủ 5 gợi ý nhưng không đủ 5 cho mọi mục khi N lớn (`minCandidates` = 1) → số thật với 5 gợi ý/mục còn **thấp hơn** 168.
- (a) và (b) lọt 40 000 ký tự (dư 26 % và 16,5 %), nhưng ca xấu nhất không: mỗi mục `unknown` tốn ~213–215 ký tự kết quả dù request chỉ ~150 B → N chốt từ ràng buộc 36 000 ký tự là **≈ 168 (< 238)**.
- **Kết luận phase 1: N < 238 → dừng, replan (không chốt trần, không ghi phase 3 › Decisions).** Hướng cân nhắc: giữ trần đầu vào 238–300 nhưng giới hạn riêng số mục `unresolved` đầu ra (vd. cắt `candidates`/gộp, hoặc từ chối request có > ~150 mục không giải quyết được), hoặc rút gọn `unresolved` (bỏ `observedText` lặp tên catalog, candidates ≤ 3), hoặc phân trang (đang ngoài phạm vi). `recommendMs` kho 238 chưa đo (dừng trước bước sửa `domain-budget.test.ts`).

## Đo lần 3 (phase 1, replan: unresolved không còn `observedText`)
Thiết kế: `unresolved[] = {observationId, entityKind, reason, candidates, trust}` (bỏ `observedText`, `evidence`). Ca xấu nhất: tên catalog dài nhất, toàn unknown; `candidates` dựng chặn trên bằng k canonicalId dài nhất trong catalog (686 tên; bước dò thật không tạo đủ 5/mục). Trần byte 60 770 B.

| Ca | Request (ký tự / byte) | Kết quả (ký tự / byte) | unresolved |
|---|---:|---:|---:|
| (a) 238 | 36 859 / 37 921 | 29 028 / 29 028 | 22 |
| (b) 263 | 40 518 / 41 682 | 32 050 / 32 050 | 47 |
| k=5 tại trần byte (N = 377) | 58 608 / 60 722 | 101 701 / 101 701 | 377 |
| k=5, N lớn nhất ≤ 36 000 ký tự | 20 543 / 21 284 | 35 825 | **131** |
| k=3 tại trần byte (N = 377) | 58 608 / 60 722 | 76 819 / 76 819 | 377 |
| k=3, N lớn nhất ≤ 36 000 ký tự | 27 294 / 28 288 | 35 865 | **174** |

Kết luận: N = 131 (k ≤ 5) hoặc 174 (k ≤ 3), cả hai < 238 → dừng, chưa chốt trần. Mỗi unresolved unknown tốn ~270 ký tự (k=5) / ~206 (k=3) kết quả; request chỉ ~100–150 B/mục nên trần byte không còn ràng buộc. (a)/(b) vẫn lọt (dư 27 % / 20 %).

## Thời gian domain + quyết định trần (phase 1 hoàn tất, 2026-11-19)
- `normalizeMs` (domain, đường tên, máy dev, 3 lần): (a) 238 mục 22–28 ms, (b) 263 mục 29–35 ms. Đo lại 3 lần: (a) 21–23 ms, (b) 28–35 ms. Ngân sách test `domain-budget.test.ts`: 150 ms (≈ 4–5×, chịu tải song song).
- `recommendMs` kho 238 mục `fullBox: true` (handler, snapshot đã nạp, state (c)): 33–43 ms; lần đầu gồm cold load snapshot + index: 611–637 ms (cold load đã có test riêng). Ngân sách: 200 ms (≈ 5×, chịu tải song song của bộ test).
- Trần chốt (user, Validation Session 2): `MAX_NORMALIZE_OBSERVATIONS` = 300, `MAX_NORMALIZE_REQUEST_BYTES` = 60 770 B. Bảo đảm: ≤ 300 mục, ≤ 50 mục chưa rõ lọt 40 000 ký tự; ca toàn tên sai vượt → `RESULT_TOO_LARGE` có kiểu.

## Đo phase 3 (handler, trần 300)
- 300 mục tỉ lệ thật (93:145), 40 chưa rõ (candidates thật): **36 128 ký tự** (< 40 000, dư 9,7 %). Tham khảo 50 chưa rõ: 36 534 (lọt, không ghim).
- 300 tướng đã giải quyết: 33 518; 300 chiến pháp: 32 487; 250 tướng + 50 unresolved "xấu nhất" (đủ 5 candidates, tên dài): `RESULT_TOO_LARGE` (ghim bằng test toàn tên sai).
- Request đúng trần 60 770 B, escape ASCII toàn bộ + `_meta`: thân HTTP **63 492 B** (≤ 65 536).
- Cảnh báo: 300 mục ảnh lệch redStars/level cho 300 cảnh báo → gộp theo loại còn 2 (`conflicting-redStars:150`, `conflicting-level:150`).
