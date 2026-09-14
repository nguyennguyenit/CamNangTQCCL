# Xác minh gói ghi chú SGSDeck bị lỗi OCR

- Research date: 2026-09-14
- Scope: 10 location thuộc PK-S24 trong source pack đã pin
- Status: **Chưa xác minh** cho đúng các đoạn bị lặp, ghép hoặc thiếu vị ngữ; các tên, điểm số và mệnh đề xung quanh vẫn có thể dịch.

## Locations và đoạn chưa xác minh

- `2-1nsjj7f`, block p-1: `武聖盾S武聖雅雅` — chuỗi Võ Thánh/Nhã Nhã bị ghép hoặc lặp.
- `team-1imndp3`, block p-1: `武聖盾S武聖雅雅` — cùng lỗi, holder khác.
- `team-1x19qnl`, block p-1: `武聖雅雅` — `雅雅` không xác định.
- `2-1nsjj7f`, block p-3 và `team-1imndp3`, block p-3: `拓鎮扼防拒` — tiền tố `拓` không thuộc tên chiến pháp đã đối chiếu; ranh giới danh sách thay thế không chắc chắn.
- `2-jh7wzr`, block p-1 và `team-1tfma2f`, block p-1: `膽略膽略` — Đảm Lược bị lặp nhưng chưa có bằng chứng cho phép xóa một lần.
- `team-831163`, block p-1: `騎兵寶物寶物` — `bảo vật` bị lặp; chưa rõ là OCR lặp hay thiếu tên vật phẩm thứ hai.
- `team-831163`, block p-3: `拓濟世救貧` — tiền tố `拓` không thuộc tên chiến pháp đã đối chiếu.
- `team-hrgfo`, block p-1: `SP皇甫嵩` đứng riêng, không có vị ngữ/trang bị đi kèm.

## Bằng chứng nội bộ

- `pipeline/localization-inputs/recommended.json`: giữ nguyên toàn bộ raw source, owner, season, config và block IDs nêu trên. **Đã đối chiếu**.
- `data/sgsdeck/tactics.json`: xác nhận tên chiến pháp thông thường `Trấn Ách Phòng Cự` và `Tế Thế Cứu Bần`; không giải thích tiền tố `拓`. **Đã đối chiếu** cho tên; **Chưa xác minh** cho ký tự thừa.
- Independent review v3 từ chối các bản phiên âm/diễn giải hiện tại vì chúng biến lỗi nguồn thành cấu hình chắc chắn. **Đã đối chiếu**.

## Kết luận thay thế

Không xóa lặp, tách chuỗi hoặc bổ sung vị ngữ bằng suy đoán. Phương án phát hành trung thực là dịch mọi phần có bằng chứng và gắn chú thích tiếng Việt tại đúng đoạn lỗi, ví dụ `ghi chú nguồn bị lặp/ghép nên chưa xác minh được cấu hình này`. Raw source tiếp tục được giữ riêng để truy nguyên.

## External-call budget

- Limit: 5
- Used: 0
- Remaining: 5
- Không gọi external research: source pack và canonical tactic data đủ để xác định rằng văn bản hiện tại không chứng minh được phần còn thiếu.
