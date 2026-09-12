# Cùng Tồn: UI và failure-mode audit

Ngày: 2026-09-07. Review-only bởi controller. Runtime giới hạn số agent thread nên lens thứ ba được controller thực hiện; hai lens data/MCP dùng reviewer độc lập. Không sửa plan/code, không chạy build hoặc test suite.

## Findings

Không thấy finding mới có chứng cứ đủ để chặn kế hoạch trong UI/state scope đã khảo sát.

## Evidence và adjudication

- Current `js/app.js:47–69` chỉ quản lý hash. Phase 3:47,78,82 quy định rõ query owner, URL thắng preference, scenario-only restore không auto-upgrade, popstate không push vòng lặp. Không coi việc runtime chưa có tính năng mới là lỗi kế hoạch.
- Current `js/app.js:93–94` append Cùng Tồn/Khai hoang một lần; phase 3:93 yêu cầu replace mount theo scope, test đổi mùa/back/reload không duplicate tại matrix cuối phase. Hai bộ cùng tên được resolve bằng recordId phase 2, không label.
- Current `js/roster-recommend-ui.js:117–138,224–250` giữ teams trong closure và confirmed state; `js/analyze.js:225–243` render sau async response. Phase 3:51,82,87 và matrix đổi khi request chạy yêu cầu invalidate kết quả/confirmation, không dùng stale context và bỏ kết quả stale. Coverage đó đáp ứng đường lỗi thực; implementation phải có cơ chế lifecycle/token tương ứng, nhưng không cần bịa thêm service trong kế hoạch.
- Phase 3:52 giữ hash generation/cross-reference trước activation và chặn seasonal recommendation khi thiếu data. Phase 3:89 và interface checklist cấm fallback legacy dưới nhãn scoped. Không tìm thấy hợp đồng cho phép silent fallback.
- `src/pages/index.astro:21` còn hard-coded Binh Diễn Xuân Thu. Phase 3 inventory sở hữu shell/tagline động; giữ sửa này dù Khai hoang được tách scope. Không suy nhãn mùa toàn trang thành evidence cho bộ cũ.
- Quyết định Khai hoang đã xác minh qua `plans/reports/brainstorm-260907-0347-khai-hoang-team-details.md:9–24` và plan mùa phần Điều chỉnh Khai hoang. Phase 2 chỉ còn kind/dataset coexist; phase 3:50 giữ Khai hoang ngoài projector. Đổi scope không được thay nội dung Khai hoang là acceptance plan index. Không mở lại phạm vi cũ trong reports lịch sử.
- Plan Khai hoang mới đang được soạn đồng thời; tại snapshot audit index vẫn scaffold dù phase files đã tồn tại. Đây không phải dependency chặn plan mùa: nguồn accepted brainstorm đã ghi rõ boundary và plan mùa cấm sửa song song render.js. Khi implementation phải đọc phiên bản hoàn chỉnh mới nhất.
- Scenario applicability không đồng nghĩa inventory readiness: phase 2:101 và phase 3:95 giữ diagnostic cho mandatory condition unknown, không báo dùng ngay. Không re-open finding đã được giải quyết bằng invariant cụ thể.

## Giới hạn

Audit đọc kế hoạch hiện tại và source, không chứng minh implementation hoặc tất cả tương tác browser. Mẫu UX scenario-only còn PROPOSED; không ghi user đã phê duyệt. Danh mục ruleset và scope bộ cũ vẫn là khoảng trống dữ liệu có cách biểu đạt.

Status: DONE
Summary: Không có finding UI/failure-mode mới cần thay thiết kế. Shared state, URL, lifecycle và boundary Khai hoang đã có acceptance phù hợp với các đường code hiện tại.
