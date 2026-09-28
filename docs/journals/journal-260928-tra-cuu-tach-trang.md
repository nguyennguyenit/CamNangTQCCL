# 2026-09-28 — Tra cứu: mỗi nhóm một trang

## What happened
`/tra-cuu/` tải và xác minh đủ ba payload (1,47 MB raw) dù người dùng chỉ xem một nhóm. Trang được tách thành 7 trang nhóm, vi và zh. Mỗi trang chỉ tải manifest và payload của nhóm mình; payload hồ sơ cần thêm được tải lười. Trang đầu 60 mục dựng lúc build, còn `/tra-cuu/` thành mục lục tĩnh. Kế hoạch ở `plans/260928-2130-tra-cuu-tach-trang/plan.md`.

## Decisions
- Payload đơn được kiểm theo digest trong manifest đã pin cộng `generationId`. Tham chiếu chéo chỉ kiểm được trên trọn bộ, nên chuyển ra build (`src/lib/lookup-pages.ts`) và dist verifier.
- Chọn tải lười thay vì artifact quan hệ tính lúc build. Artifact chỉ lợi ở lần mở hồ sơ đầu tiên, trong khi phải thêm pin, verifier và test.
- Markup thẻ/hàng bảng/chân dung là một cây view (`js/view-tree.js`) cho cả HTML lúc build lẫn DOM. Hàm hiển thị nhận `locale` tường minh, vì lúc build không có `<html lang>`.
- Landing hash cũ giữ nguyên đích `/tra-cuu/?…`, mục lục chuyển tiếp tiếp. Cách này tránh nhân đôi bảng slug trong script inline tự đủ.

## Surprises
- Trang zh gọi `loadRawNameResolver` lúc boot trên mọi trang mục, kéo cả `tactics.json`. Ở trang Tra cứu, bộ tra này chuyển sang tạo khi mở hồ sơ.
- Localization policy băm cả file nguồn. Mỗi lần sửa file bị theo dõi đều phải publish lại generation và re-pin route handles; đợt này publish 4 lần.
- Nội dung dựng sẵn làm lộ lỗi click chết trước khi app chạy. Sửa bằng cách cho thẻ và tên chiến pháp thành link hồ sơ thật, app chặn click thường.
- Dev test vỡ vì mọi trang đọc kho Tra cứu qua menu. Sửa bằng cách tách `lookupGroupLinks`, không cần kho.

## Left open
- Generation Recommended cũ `6ded1637…` vẫn giữ theo lệ repo. Các generation trung gian của phiên này đã prune.
- Dev server không trả 404 cho `/pipeline/recommended-identity-map.json`. Lỗi này có từ trước.
- `design-tokens --check` vẫn đỏ vì 2 giá trị thô từ trước (`.detail-tier`, `.detail-note-*`), ngoài phạm vi.
