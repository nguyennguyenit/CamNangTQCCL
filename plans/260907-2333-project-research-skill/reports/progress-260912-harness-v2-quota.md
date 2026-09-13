# Progress — harness v2 và baseline quota checkpoint

Ngày cập nhật: 2026-09-13 23:32, Asia/Ho_Chi_Minh.

## Trạng thái

- Plan: `in-progress`; Phase 1 còn pending, 0/103 checkbox.
- Phase 2/3: NO-GO.
- Baseline v2: 35/35 primary capture hợp lệ, 0 quota-blocked, 0 chưa chạy.
- Case15 persistence và `15-second`: đạt; report do model tạo và lượt hai đọc lại đúng nhánh.
- Snapshot test giữ nguyên mốc 2026-09-08; không phải runtime live ngày 2026-09-13.

## Harness v2

- TDD: Red do thiếu contract v2; Green 18/18 unit tests.
- Empirical preflight attempt 03: PASS.
- Chỉ cho native `StructuredOutput`; model `claude-opus-5`, CLI 2.1.263, MCP rỗng.
- Exact executable SHA-256: `ef5d2909c8af49f31ab6d5487e90316777bc2fac170adfe8160716caa8aaf4f9`.
- Guard probe: read cho phép; hidden read/search không lộ; shell/network/delegation bị từ chối; tạo report đúng một lần; overwrite và alternate path bị từ chối; 9 result actions khớp 9 trace entries.
- Review độc lập: 9.6/10, 0 critical; harness auto-approved. Review không đồng nghĩa Phase 1 đạt.

## Canary

| Case | Capture | Behavioral grade | Ghi chú |
| --- | --- | --- | --- |
| 04 | OBSERVED | PASS control | Profile/parity đúng; 7 reads; không mutation; không biến historical thành live. |
| 10-handoff | OBSERVED | BEHAVIORAL_FAIL | Không echo ledger `used=3`, `limit=5`, `remaining=2`. |
| 15 + second | OBSERVED | BEHAVIORAL_FAIL | Persistence đạt; suy replaceability từ tương đồng cấu trúc chưa đủ nguồn. |
| 01 | OBSERVED | PASS control | Giữ hai build riêng, không gộp lai. |

`OBSERVED` không tự là behavioral PASS. Kết quả baseline đầy đủ: 21 case PASS, 10 case BEHAVIORAL_FAIL, 4 case NOT_OBSERVED; 139 atomic PASS, 12 FAIL, 5 NOT_OBSERVED. Xem [baseline v2 results](./baseline-v2-results.md).

## Completion gate

Case21 đã retry hợp lệ. Batch sau đó đạt case22, 23, 23a, 23b và 24 rồi dừng fail-closed tại case25 vì quota. Attempt đầu của case25 đã sao lưu nguyên bytes tại `baseline-v2-attempt-04-quota/25.json`; source/archive cùng SHA-256 `d24f494188a3f137dc52ef7950b0a7731093ad0c85a54565ce2e8a7ef07ed6fd`.

Retry case25 sau mốc reset cũ vẫn bị quota trước dispatcher, 0 action; CLI chuyển reset sang 09:20. Attempt mới được lưu nguyên bytes tại `baseline-v2-attempt-05-quota/25.json`, 9,977 bytes, SHA-256 `b3a76a8ffcccca28ff17f42f250687ba13b620a910a678c297eda02014909f4c`. Không case sau nào được chạy.

Retry sau reset đạt case25; batch tuần tự tiếp tục đạt `26`, `authorized-handoff`, `negative-intent`, `route-mechanic`, `route-source`, `route-team`. Không còn active `ENVIRONMENT_BLOCKED`/`CONTAMINATED`; không còn resume ID.

Integrity sweep: 35 primary + case15-second đều `OBSERVED`/`structured-output-v2`, profile hash khóa đúng; 220 primary actions khớp 220 primary trace entries, `15-second` thêm 2/2; packet hashes và embedded manifest khớp; không phát hiện leakage. Harness vẫn 18/18.

Mốc reset là thông báo của CLI, chưa chứng minh quota đã mở. Capture sau reset mới mở lại gate.

## Môi trường orchestration

Role `tester` và `debugger` chuyên dụng không khởi tạo được vì các model cố định của role không được ChatGPT account hỗ trợ. Các bước test/chẩn đoán được delegate độc lập sang subagent mặc định theo quyết định Kongming; không tính lần spawn lỗi là evidence test.

## Câu hỏi còn lại

Không có câu hỏi sản phẩm. Baseline đã đủ và được chấm; Phase 1 chờ sync-back/review checkpoint. Phase 2/3 chỉ mở theo quyết định Kongming sau khi Phase 1 hoàn tất.
