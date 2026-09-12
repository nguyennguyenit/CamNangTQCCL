# Đội hình theo mùa / kịch bản

Ngày: 2026-09-07 (Asia/Ho_Chi_Minh).
Trạng thái: Người dùng đã chốt hướng sản phẩm; chưa triển khai code.

## Quyết định được chấp nhận

- Tổ chức tra cứu đội hình theo mùa / kịch bản.
- Người dùng xác nhận bản Việt Nam có cơ chế chơi lại kịch bản cũ. Đây là thông tin do người dùng cung cấp; lượt nghiên cứu trước chưa xác minh độc lập được quy tắc bản TTH.
- Kịch bản cũ vẫn có nhu cầu sử dụng; không tự coi danh sách của kịch bản cũ là hết hiệu lực.

## Hợp đồng cho bước lập kế hoạch

### Outcome

Người chơi chọn mùa / kịch bản đang chơi để xem danh sách đội và cấu hình phù hợp, kể cả khi chơi lại kịch bản cũ.

### Constraints

- Dùng bản Việt Nam làm bối cảnh chính của thiết kế; nguồn khu vực khác phải giữ xuất xứ và phạm vi áp dụng.
- Giữ dữ liệu hiện có và đường dẫn/contract công khai trong quá trình chuyển đổi.
- Không tự gán mùa cho dữ liệu thiếu bằng chứng.
- Phân biệt tên kịch bản với đợt cập nhật đánh giá: cùng kịch bản có thể cần cấu hình hoặc tier mới.
- Không suy ra tier hiện hành từ việc một đội từng mạnh ở mùa trước.
- Giữ nguyên WIP không liên quan, gồm docs/deployment.md và báo cáo deployment hiện có.

### Non-goals

- Không triển khai code, thay schema hoặc deploy trong lượt chốt brainstorm.
- Không tự dự đoán meta, tỷ lệ thắng hoặc tự chuyển đánh giá giữa các khu vực.
- Không bổ sung backend chỉ để phân loại mùa.

### Acceptance criteria đề xuất

- Chọn mùa / kịch bản trả đúng danh sách và cấu hình tương ứng.
- Không dùng tier của bối cảnh khác để hiển thị hoặc xếp hạng gợi ý.
- Dữ liệu chưa xác định mùa có nhãn rõ, vẫn tra cứu được ở phạm vi tham khảo.
- Khi bổ sung đánh giá mới, cấu hình/đánh giá cũ vẫn được lưu để đối chiếu.
- Link chia sẻ giữ đúng bối cảnh; web và MCP thống nhất khi hỗ trợ lựa chọn mùa.

## Hướng thiết kế đề xuất để lập kế hoạch

- Trải nghiệm: chọn mùa / kịch bản, rồi chọn giao chiến, khai hoang hoặc cùng tồn.
- Mỗi mùa có danh sách riêng ở giao diện; thông tin chung của đội có thể tái sử dụng.
- Tách đội hình chung, cấu hình cụ thể và đánh giá theo mùa / đợt cập nhật. Cách biểu diễn schema cần đối chiếu owner, loader và test trước khi chốt.
- Ưu tiên tái sử dụng JSON và frontend hiện có.

## Bằng chứng đã đọc trong phiên brainstorm

- js/team-pk.js và js/meta-cu.js phân loại theo source team-intro / moi-phe.
- data/teams.json chứa 166 đội ở thời điểm kiểm tra trong phiên.
- data/team-tier.json gắn rankings với teamId; mẫu đã đọc có source, tier, updatedAt, chưa có trường mùa riêng.
- js/team-recommend-engine.js chọn tier tốt nhất từ rankings; cần kiểm tra toàn bộ đường gọi khi thiết kế lọc bối cảnh.
- Sheet nguồn có tab theo nội dung và mới/cũ, chưa chứng minh lưu lịch sử từng mùa: https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit#gid=562317106

## Bước tiếp theo

Lập kế hoạch dựa trên hướng đã chốt; kiểm tra schema, render, recommender và MCP để xác định thay đổi tương thích. Chỉ hướng tổ chức theo mùa / kịch bản đã được người dùng chốt; chi tiết kỹ thuật ở trên là đề xuất cho bước lập kế hoạch.

## Điểm còn mở

- Danh mục mùa / kịch bản ban đầu và bằng chứng để gán các đội hiện có vào từng danh mục.
- Quy tắc chọn đánh giá hiện hành khi nhiều nguồn cùng bối cảnh bất đồng.
