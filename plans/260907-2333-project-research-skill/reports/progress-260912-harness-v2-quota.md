# Progress — harness v2 và baseline quota checkpoint

Ngày: 2026-09-12, Asia/Ho_Chi_Minh.

## Trạng thái

- Plan: `in-progress`; Phase 1 còn pending, 0/103 checkbox.
- Phase 2/3: NO-GO.
- Baseline v2: 11/35 primary capture hợp lệ, 1 quota-blocked, 23 chưa chạy.
- Case15 persistence và `15-second`: đạt; report do model tạo và lượt hai đọc lại đúng nhánh.
- Snapshot test giữ nguyên mốc 2026-09-08; không phải runtime live ngày 2026-09-12.

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

`OBSERVED` không tự là behavioral PASS. Kết quả partial hiện tại: 8 case PASS, 3 case BEHAVIORAL_FAIL; 46 atomic PASS, 3 FAIL, 1 NOT_OBSERVED. Xem [baseline v2 results](./baseline-v2-results.md).

## Resume gate

Không gọi model để dò quota trước mốc reset, không đổi account, không API/paid fallback. Sau 16:30:

1. Archive nguyên bytes `baseline-v2/10-lower.json` vào namespace quota attempt mới bằng exclusive copy.
2. Xác minh SHA/cmp, source chưa đổi và không có runner; chỉ sau đó giải phóng đúng retry slot.
3. Kiểm lại hashes trong `baseline-v2-experiment.json`.
4. Retry đúng một lần `baseline-v2 10-lower`.
5. Nếu hợp lệ, chạy 23 primary IDs còn lại trong `baseline-v2-resume.json`, từng ID một.

Mốc reset là thông báo của CLI, chưa chứng minh quota đã mở. Capture sau reset mới mở lại gate.

## Môi trường orchestration

Role `tester` và `debugger` chuyên dụng không khởi tạo được vì các model cố định của role không được ChatGPT account hỗ trợ. Các bước test/chẩn đoán được delegate độc lập sang subagent mặc định theo quyết định Kongming; không tính lần spawn lỗi là evidence test.

## Câu hỏi còn lại

Không có câu hỏi sản phẩm. Blocker duy nhất hiện tại là quota subscription tới 16:30 Asia/Saigon.
