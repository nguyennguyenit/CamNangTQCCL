---
date: 2026-07-27
session: "Hoàn tất Phase 1 MCP TQCCL"
type: technical-journal
status: completed
---

# Journal: 2026-07-27 — MCP Phase 1 contracts và characterization

## Context

Phase 1 dựng seam TypeScript nghiêm ngặt quanh các ES domain module hiện có, khóa hành vi browser bằng characterization tests và giữ Vision Worker tách biệt. Đây là lịch sử công việc, không phải nguồn thẩm quyền cho kiến trúc hay hợp đồng hiện hành.

## What Happened

- TDD bắt đầu ở trạng thái đỏ do các module contracts và adapter chưa tồn tại.
- Review vòng 1 đạt 7/10, phát hiện thiếu kiểm tra namespace runtime, validation output, bảo toàn provenance, che lỗi nội bộ và độ phủ characterization adapter.
- Bản sửa bổ sung canonical validator theo prefix, bảo toàn provenance an toàn, `safeResult` cùng các output validator, và characterization đầy đủ cho toàn bộ adapter.
- Tester vòng 2 xác nhận Domain 40/40, JavaScript 102/102, Python 82/82 và Vision Worker 53/53 đều đạt.
- Gate Node 22.16.0, build, typecheck, chạy độc lập với CWD và các kiểm tra liên quan đạt 10/10.
- Review vòng 2 đạt 10/10; thay đổi không gây side effect lên SPA, Python CLI hay Vision Worker.
- Plan được đồng bộ ở mức 1/6 phase, 31/191 checklist, tương đương 16%.

## Reflection

Characterization trước khi sửa hành vi giúp phân biệt rõ defect legacy cần giữ tạm thời với contract mới phải khóa ngay. Vòng review đầu hữu ích nhất ở các boundary runtime: type tĩnh không đủ nếu output legacy, provenance và thông báo lỗi chưa được kiểm chứng khi chạy.

## Decisions

| Decision | Rationale | Impact |
|---|---|---|
| Dùng canonical ID có namespace và validator theo prefix | Chặn lẫn hero, tactic, team và family tại runtime | Contract phân biệt đúng SP/CO/base và slot thay thế |
| Bọc mọi kết quả legacy bằng `safeResult` và output validator | Không tin TypeScript cast tại biên JS | Output JSON an toàn, lỗi nội bộ được che và input không bị mutate |
| Giữ provenance an toàn khi parse roster | Provenance cần cho các phase sau nhưng không được mang dữ liệu nhạy cảm | Metadata nguồn hợp lệ được bảo toàn; media, path và secret vẫn bị cấm |
| Hoãn cập nhật evergreen docs đến Phase 6 | Phase 1 mới là seam nội bộ của package chưa hoàn chỉnh | Tránh ghi tài liệu vận hành/kiến trúc sớm và sai thẩm quyền |

## Next

- Bắt đầu Phase 2: sửa identity SP/CO, ambiguity, ranking, provenance và workflow binding.
- Giữ các characterization defect hiện tại cho đến khi test hành vi đúng của Phase 2 được viết đỏ.
- Câu hỏi chưa giải quyết: không có.
