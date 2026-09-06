# Cấu hình khai hoang có nguồn

Ngày: 2026-09-06. Mùa mục tiêu: **Binh Diễn Xuân Thu**, do người dùng xác nhận trong lượt triển khai. Chỉ thay đổi local, chưa commit/deploy.

## Kết quả

- Khác–Bình–Tiến: sửa đội và cả ba tướng từ Cung sang Thương, trước/sau 20.
- Đồng Lòng Hợp Sức: ảnh client Việt xác nhận Chủ động, 50%, ngẫu nhiên 1–4 lần trị liệu 51%→102%, tăng Thống Soái 8→16 theo Trí Lực, cộng dồn, 2 hiệp. Tên Hán 勠力同心 khớp [cơ sở dữ liệu chiến pháp](https://sanzhan.slgsim.com/zh-hans/tactics/) và [phân tích chiến pháp sự kiện](https://www.233leyuan.com/post-detail/1993784451508369469).
- Giữ 戮力上国 là chiêu Nội chính riêng của Tào Phi; tên hiển thị Hán-Việt Lục Lực Thượng Quốc. Sửa bảng override và thêm record đã review vào generic để merge offline tái tạo đúng danh tính.
- Thêm 12 lựa chọn trên 10 đội. Mỗi lựa chọn có URL trực tiếp, khu vực, thời điểm/mùa, giai đoạn và ghi chú khác biệt. Native select đổi nguyên bộ, không trộn chuyển hình hoặc chiêu trước 20 từ build mặc định vào nguồn chỉ mô tả sau 20.
- Mùa hiện tại hiển thị trong tab; cấu hình nguồn CN/S13/S23 là tham khảo, không gán thành meta đã kiểm chứng của Binh Diễn Xuân Thu. Chưa mô tả binh chủng tùy chỉnh.

## Các lựa chọn đã đưa vào

| Đội | Lựa chọn | Giai đoạn |
|---|---|---|
| Khác · SP Mã Siêu · Pháp Chính | CN Thôi Phong; Nhật S23 Nhất Kỵ/Bạo Lệ | Trước/sau 20 |
| Khác · Bình · Tiến | Nhật S13, chuyển Quan Ngân Bình chủ tướng | Trước/sau 20 |
| Khương · Hạ · Khác | Nhật S23 Bát Môn | Trước/sau 20 |
| Lục · Tả · Xuân Hoa | Nhật S23 Sĩ Biệt trên Tả Từ | Sau 20 |
| Hạ · Thái Sử · Nguyệt Anh | Nhật PK, Hổ Báo + Tam Thế | Trước/sau 20 |
| Thượng Hương · Trần Cung · Nguyệt Anh | CN S4+, nhánh Cung | Sau thức tỉnh |
| Khương · Hạ · Pháp | CN Vô Đương từ đầu, Mau Giành sau 20 | Trước/sau 20 |
| SP Viên · Hạ · Xuân Hoa | Nhật S23 Xế Đao/Thời Cơ | Sau 20 |
| Bình · Tiến · Thái Văn | CN Thanh Châu/Cắt Xương | Trước/sau 20 |
| Khác · Thái Sử · Tả | Bahamut chuẩn bị đất 6; Hàn Sĩ Biệt sau 20 | Sau 20, hai ngữ cảnh dùng cùng bộ chiêu |

Nguồn cụ thể gắn trong từng `variants[].sources` ở `data/khaihoang.json` và hiển thị trên card. [Audit trước triển khai](research-260906-1420-khaihoang-cn-global-meta-audit.md) giữ lịch sử nguồn/giới hạn; hai lỗi binh chủng và mapping đã được xử lý ở lượt này.

Không tạo option lặp cho đội Thái Văn–Khương–Thái Sử hoặc Khương–Bình–Thái Văn vì không có khác biệt build được chốt trong audit. Không tạo build SP Lô Trực từ tiêu đề video. Nhánh SP Nguyệt Anh sau 20 chưa đủ nguồn để biến thành lựa chọn hoàn chỉnh.

## Kiểm tra và review

- RED: regression Đồng Lòng Hợp Sức tái hiện ánh xạ 戮力上国 sai.
- GREEN: 14 Node focused, 5 Python merge/override; Astro check 0 errors/warnings/hints; 9 dist contracts và verifier 35 files pass.
- Full Node **137/137**, Python **5/5**, Playwright **2/2** pass. Playwright kiểm đủ 12 lựa chọn/khôi phục mặc định/cách ly card, nguồn, giai đoạn, keyboard type-ahead và mobile 375px; ảnh card mobile đã được xem, không tràn ngang.
- Playwright lần đầu không chạy được vì thiếu Chromium headless shell đúng phiên bản. Đã cài bằng `npx playwright install chromium --only-shell`. Hai lỗi assertion trong test được sửa: dùng cùng `textContent` khi so sánh trạng thái, và native select type-ahead vì popup ArrowDown không hoạt động trong macOS Chromium headless (đã tái hiện trên select HTML tối thiểu, độc lập sản phẩm). Lần chạy cuối 2/2 pass.
- [Review độc lập](review-260906-1431-khaihoang-source-options.md) không phát hiện lỗi mới có bằng chứng; các nguồn truy cập được khớp bộ chiêu. Bahamut không mở lại được trong review, giữ bằng chứng từ audit trước.
- Build cuối và verifier **35 files / 33 raw assets** pass; `git diff --check` sạch. Preview do harness khởi tạo đã dừng, port 4174 không còn listener.
- Không chạy pipeline HTML ghi đè: importer cũ chưa tái tạo đủ dữ liệu curated. Boundary này đã tồn tại và được ghi rõ trong docs cùng các field mới cần bảo toàn.

## Còn chưa rõ

- Nhanh Chân Tranh Đất có phải alias Việt của 士争先赴 hay không. Các option nguồn dùng tên dictionary Sĩ Tranh Tiên Phó, ghi rõ khác biệt này.
- Hiệu suất/build binh chủng tùy chỉnh riêng Binh Diễn Xuân Thu cho từng đội; chưa có đủ nguồn live để gắn tier.
