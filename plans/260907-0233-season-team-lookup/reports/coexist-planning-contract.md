# Cùng Tồn theo kịch bản — hợp đồng lập kế hoạch

Ngày: 2026-09-07. Chế độ `--deep --tdd`; chỉ chỉnh kế hoạch, không runtime.

## Quyết định và phạm vi

- Outcome: Cùng Tồn dùng bộ chọn mùa/kịch bản chung; bộ Google Sheet mới thuộc Binh Diễn Xuân Thu theo người dùng xác nhận; bộ cũ còn xem lại được.
- Constraints: giữ `#coexist`, dataset legacy và no-context MCP; giữ options, variant, điều kiện, cải tạo binh chủng. Không trộn hai nguồn cùng nhãn Cùng tồn 1–5.
- Non-goals của phần bổ sung: không biến display string thành engine candidate, không suy tier/điểm/luật từ tên mùa, không thêm selector riêng, không commit/deploy. Các yêu cầu đã có về SGSDeck/Team PK/MCP trong kế hoạch cha vẫn giữ.
- Acceptance: bộ mới đúng 5 nhóm/25 đội/75 vị trí; nguồn rõ; bộ cũ chưa biết mùa nằm tham khảo; không rơi sang mùa khác khi thiếu dữ liệu; chọn mùa/URL/back-forward đồng bộ; Red trước Green theo từng hành vi.

## Bằng chứng

- Nguồn: https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit#gid=190730430
- Snapshot nghiên cứu: ../research/coexist-binh-dien-xuan-thu.csv
- SHA-256: 838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb
- Tên tab Team Cùng Tồn; 94 hàng CSV/10 cột; không có tên ruleset được xác minh. Xác nhận người dùng chỉ bao phủ scenario, không luật/balance.
- Cột J mới cải tạo chiến pháp binh chủng; parser hiện gán advisorSkill. CSV không mang rowspan, cần parser CSV riêng hoặc snapshot HTML thích hợp; không feed CSV qua HTML grid.
- Bộ cũ data/coexist.json 5 nhóm/25 đội; giữ bytes không rebuild chung. Sheet cột A có khai hoang và chủ lực là thông tin tham khảo theo nhóm, không tự liên kết thành chuyển hình chắc chắn.

## Hướng kỹ thuật đề xuất cho planner

- Tích hợp vào 4 phase có sẵn; không scaffold plan cạnh tranh, không đổi thứ tự/status phase.
- Giữ 5 season sidecar, 11 MCP artifact v2/12 file gồm manifest: lưu payload nhóm mới trong nhánh source-owned của season-content-links; link legacy dùng locator + fingerprint. Phải định nghĩa discriminator và cross-ref theo nhánh, không bắt record mới tồn tại trong legacy coexist.json.
- Source-scoped stable recordId tách revision fingerprint; cùng nhãn hoặc reorder không merge/gán sai. Payload hiển thị giữ raw text/options/coupled alternatives, canonicalRef null nếu chưa match.
- Đề xuất reference browsing scenario-only cho trường hợp ruleset null; recommendation vẫn cần context có reviewed ruleset. Câu hỏi tùy chọn đã gửi người dùng: cho xem với nhãn chưa xác minh luật (khuyến nghị) hay chỉ hiện khi đủ luật. Chưa có câu trả lời; sau thời gian chờ hợp lý, tiếp tục theo mặc định thiết kế đề xuất, không ghi là user-approved. Không coi im lặng là approval triển khai.
- Nội dung kế hoạch cũ nói mọi context phải có ruleset cần phân biệt reference browse và verified engine context. Chọn ruleset cụ thể: bản chỉ biết scenario ở vùng tham khảo riêng, không count là applicable.

## Quan hệ kế hoạch

Mở rộng plan mùa hiện có. Catalog SGSDeck không chặn việc hiển thị source-owned reference; chỉ canonical mapping dùng thực thể mới mới phụ thuộc record reviewed. Không thêm blockedBy/blocks toàn plan hay phụ thuộc vòng. Chạm Sứ hiện completed theo plan/source, bảo toàn chamSuTeams. Plan tướng/tier cũ pending lịch sử không cần chạy lại.

## Câu hỏi còn mở

Phiên bản luật cụ thể và mùa của bộ cũ chưa có chứng cứ; là khoảng trống dữ liệu cần hiển thị, không tự suy đoán.
