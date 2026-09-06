---
title: "Tách Team Chạm Sứ khỏi đội khai hoang"
description: "Sửa cách đọc bảng nguồn và hiển thị nhóm Chạm Sứ độc lập."
status: completed
priority: P1
effort: ""
tags: [khaihoang, data, ui]
created: 2026-09-07
---

# Tách Team Chạm Sứ khỏi đội khai hoang

## Kết quả và phạm vi

Thêm mục **Team Chạm Sứ / Ăn vạ** giữa đội khai hoang chính và quân thủ mỏ; bỏ liên kết sai “Chuyển hình đề xuất”. Nguồn gọi bảng riêng là “Team Chạm Sứ------mang 1 lính”. Dữ liệu độc lập `chamSuTeams` giữ đúng nhóm tướng, chiến pháp, ghi chú và xuất xứ.

Giữ các đội đã curate, variants/options, mùa và mỏ. Không suy diễn tướng thứ ba, chủ tướng, binh chủng hay cơ chế. Không chạy full builder ghi đè JSON; không commit/deploy trong phạm vi này.

## Bằng chứng

- [Quyết định import trước](../reports/import-260906-1413-khaihoang-google-sheet.md): I–K là bảng riêng, không import vào `transforms`.
- [Snapshot CSV](../reports/source-260906-1413-khaihoang-google-sheet.csv): tám nhóm hai tướng; cần đối chiếu HTML cũ và dữ liệu hiện tại.
- HTML cũ cũng ghi rõ header “Team Chạm Sứ------mang 1 lính”. Parser hiện gắn I–K vào đội A–G theo hàng; renderer diễn giải thành chuyển hình.

## Giai đoạn

| # | Giai đoạn | Trạng thái |
|---|-----------|------------|
| 1 | [Sửa nguồn, dữ liệu, UI và kiểm chứng](./phase-01-start.md) | Completed |

Thực hiện tuần tự với `--tdd`: (1) nguồn/schema/parser → (2) dữ liệu runtime + UI → (3) validation/docs/review. Mỗi thay đổi hành vi phải có test đỏ đúng nguyên nhân trước khi sửa, rồi chạy xanh; test bảo toàn đang xanh không cần cố làm đỏ.

## Phụ thuộc và ràng buộc

- Grouping và ô alternatives phủ cặp Lữ Mông–Giả Hủ đã xác minh trong audit; lưu alternatives một lần ở cấp nhóm. Rà consumer đã biết trước bỏ trường schema.
- Hai kế hoạch SGSDeck và season lookup đang chờ, chưa có phụ thuộc được chứng minh. Đọc lại diff/touched files trước triển khai để giữ WIP chung trên `main`.
- Ghi rõ correction khi bỏ `teams[].transforms`; xử lý dependency nếu phát hiện consumer thực. Consumer ngoài giả định không tạo thêm gate.

## Tiêu chí chấp nhận

- [x] Chạm Sứ độc lập với số hàng/nhóm của đội chính; grouping và dữ liệu khớp nguồn đối chiếu.
- [x] Mục mới đúng vị trí; không còn nhãn/linkage chuyển hình sai, không bịa dữ liệu game.
- [x] Thiếu hoặc rỗng `chamSuTeams` và input mảng mỏ cũ vẫn render bình thường.
- [x] Các đội curate, variants/options, season và mines được bảo toàn; chọn cấu hình vẫn độc lập từng card.
- [x] Fixture nguồn đã tạo, không bị ignore; parser/payload Python chạy trên clean clone, không cần HTML team/coexist; data/UI tests và kiểm tra build đạt.
- [x] Có bằng chứng red → green cho parser, migration và UI; test bảo toàn vẫn xanh.
- [x] Docs contract và đánh giá tương thích cập nhật; review diff không chứa thay đổi ngoài phạm vi.

## Red Team Review

Ngày 2026-09-07: [audit](./reports/audit-260907-0245.md), 2 Medium đã được người dùng duyệt và áp dụng: TDD và boundary kiểm thử payload. Đã hoàn tất triển khai local sau kiểm thử và review.

### Whole-Plan Consistency Sweep

Đã đọc lại index và phase; đồng bộ trình tự test, owner Python/Node, rủi ro builder và handoff. Không còn mâu thuẫn chưa giải quyết.

## Handoff

`/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260907-0236-cham-su-khai-hoang/plan.md --tdd`

<!-- slug: cham-su-khai-hoang -->

## Hoàn tất local — 2026-09-07

8 nhóm Chạm Sứ độc lập; bảo toàn 15 đội và 5 mỏ. Python89, Node138, artifact9, E2E21 đạt. Review PASS9.5. [Validation](./reports/validation.md), [review](./reports/code-review.md), [tiến độ](./reports/progress.md). Chưa commit/deploy.
