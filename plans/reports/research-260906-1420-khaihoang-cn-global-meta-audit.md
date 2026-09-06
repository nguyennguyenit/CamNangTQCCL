# Đối chiếu 14 đội khai hoang với CN và Global

Ngày kiểm tra: 2026-09-06. Phạm vi: nghiên cứu, không sửa JSON/tier hoặc deploy.

Cập nhật sau audit: người dùng xác nhận mùa Binh Diễn Xuân Thu, Khác–Bình–Tiến là Thương và cung cấp ảnh Đồng Lòng Hợp Sức. Hai vấn đề binh chủng/mapping dưới đây đã được sửa; các khác biệt đủ nguồn được đưa thành lựa chọn trong [lượt triển khai kế tiếp](implementation-260906-1431-khaihoang-source-options.md). Phần còn lại giữ nguyên như snapshot nghiên cứu ban đầu.

## Kết luận

Danh sách có nhiều bộ khung quen thuộc của CN và Global, nhưng không phải danh sách 14 đội đồng hạng meta mới nhất. Phải tách độ phổ biến của bộ ba, cấu hình chiến pháp và phiên bản/kịch bản. Không tìm thấy thống kê sử dụng đủ đại diện để gán một tier chung cho mọi khu vực.

Điểm cần xử lý trước khi quảng bá là meta hiện hành:

1. Gia Cát Khác – Quan Ngân Bình – Nhạc Tiến ghi Cung sau cấp 20 nhưng mang Lính Thanh Châu, trái điều kiện binh chủng thông thường.
2. Đội SP Lô Trực chưa có đủ bằng chứng độc lập về toàn bộ build; tên Đồng Lòng Hợp Sức đang xung đột ánh xạ Nội chính trong từ điển.
3. Một số đội đúng bộ ba nhưng là cấu hình cũ/biến thể; chưa nên thay toàn bộ chiến pháp theo một bài CN mới.

## Snapshot và cách kiểm tra

- Owner: `data/khaihoang.json`, 14 đội; đối chiếu `data/tactics.json`, `data/heroes-dict.json`, `pipeline/tactic-name-overrides.json`, renderer hiện có và bản CSV người dùng gửi.
- SHA-256 khaihoang: `4e3c0c630b4f146c687eec2dab3dd41f782e6e93dead57df058c05fc509675b7`.
- SHA-256 tactics: `e100bf80390114d151c133ed7ccb737fbadcadd6afcef66c6d681e2ce0273ea5`.
- Nguồn có đội hình cụ thể được ưu tiên hơn tiêu đề T0 hoặc snippet quảng cáo. Không suy tỷ lệ thắng từ chiến báo chọn lọc; không coi repost Trung phồn thể là bằng chứng máy chủ Đài Loan.
- Các nhận định dưới đây là tổng hợp của người nghiên cứu, không phải tier chính thức. “Có nguồn” không có nghĩa toàn bộ chiến pháp local đã được xác nhận.

## Phạm vi khu vực

| Khu vực | Bằng chứng dùng được | Giới hạn |
|---|---|---|
| CN đại lục | Hướng dẫn 2026, bài build chi tiết và tài liệu cũ để truy nguồn | Bài roundup có tính chủ quan; không có usage dataset đại diện |
| Đài Loan/Hồng Kông, cộng đồng phồn thể | Bahamut có hướng dẫn Võ Phong Thái Sử Từ và bài chuyển Ôn Hầu tháng 6/2026 | Không đủ tách riêng tỷ lệ dùng TW và HK; ghi là cộng đồng phồn thể |
| Nhật | Dengeki/Qookka S23 tháng 1/2026, hướng dẫn S23 và blog các mùa trước; tín hiệu người chơi dùng Gia Cát Khác–Thái Sử Từ–Tả Từ | Nguồn S23 không đại diện S26; bài/bảng preview không chứng minh meta live |
| Hàn | DCInside có trải nghiệm Gia Cát Khác–Thái Sử Từ–Tả Từ tháng 4/2026, thảo luận Khương–Hạ–Gia Cát Khác năm 2026, hướng dẫn cũ 2024 | Bài hỏi không phải bằng chứng hiệu suất; không dùng thứ hạng 2024 làm tier 2026 |
| Việt | Google Sheet người dùng gửi, snapshot đã lưu trong repo | Là nguồn biên soạn đội, không có mùa/chiến báo để xác nhận meta Việt độc lập |
| Global tiếng Anh | Đã tìm theo Three Kingdoms Tactics và land reclamation | Chưa có nguồn mới đủ sát 14 đội; không suy rằng mọi server Global giống CN |

## Đối chiếu từng đội

Số thứ tự khớp `data/khaihoang.json` tại thời điểm nghiên cứu.

| # | Bộ ba local | Bộ khung và khu vực đối chiếu | Chiến pháp local / nhận định |
|---|---|---|---|
| 1 | Gia Cát Khác · SP Mã Siêu · Pháp Chính | 法马恪; có hướng dẫn CN và JP S23 | Đúng khung. Local chưa dùng Thôi Phong; trước 20 Pháp Chính mang Thịnh Khí, khác bản CN mới đặt Tiềm Long. Không kết luận sai chỉ vì thiếu chiến pháp mới. [CN](https://www.cnblogs.com/walj/articles/19910985), [JP](https://sangokushi-shinsen.info/2026/01/25/520%E3%80%90%E8%B2%82%E8%9D%89%E3%81%AE%E4%B8%89%E5%9B%BD%E5%BF%97%E7%9C%9F%E6%88%A6%E3%80%91%E3%80%80s23%E3%80%80%E3%82%B9%E3%82%BF%E3%83%80%E3%82%AC%E3%82%A4%E3%83%89%E3%80%80%E3%82%B9%E3%82%BF/) |
| 2 | Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến | 诸葛恪枪/机关枪; CN, JP, KR có lịch sử sử dụng | Khung quen nhưng bản Cung + Thanh Châu không hợp điều kiện thường. Nguồn JP dùng Thương; source CN có thể đổi Thương/Kỵ với chiêu tương ứng. Tiềm Long khác Tam Thế không tự nó chứng minh sai. [JP](https://sanngokusinnsenn.com/seazon13-sutada/), [CN](https://www.toutiao.com/article/7393362975639208475/) |
| 3 | Khương Duy · Hạ Hầu Uyên · Gia Cát Khác | 姜夏恪/강하제; CN, JP, KR và Bahamut | Trước 20 khớp cấu hình vô đương–lõa y–thịnh khí trong hướng dẫn JP S23. Sau 20 JP dùng Bát Môn trên Gia Cát Khác, local dùng Tiềm Long. Đây là biến thể cần ghi nguồn, không phải bằng chứng toàn đội sai. [JP S23](https://sangokushi-shinsen.info/2026/01/25/520%E3%80%90%E8%B2%82%E8%9D%89%E3%81%AE%E4%B8%89%E5%9B%BD%E5%BF%97%E7%9C%9F%E6%88%A6%E3%80%91%E3%80%80s23%E3%80%80%E3%82%B9%E3%82%BF%E3%83%80%E3%82%AC%E3%82%A4%E3%83%89%E3%80%80%E3%82%B9%E3%82%BF/), [TW community](https://forum.gamer.com.tw/C.php?bsn=36815&snA=11286) |
| 4 | Lục Tốn · Tả Từ · Trương Xuân Hoa | 三势陆; kinh điển CN/JP/KR | Bộ khung còn xuất hiện trong tài liệu 2026. Local đặt Tam Thế ở Tả Từ, mang Thịnh Khí thay Sĩ Biệt; Dengeki đặt Tam Thế ở Trương Xuân Hoa và Sĩ Biệt ở Tả Từ. Không phải exact build. [Dengeki](https://dengekionline.com/article/202601/61284) |
| 5 | Hạ Hầu Uyên · Thái Sử Từ · Hoàng Nguyệt Anh | 夏太黄; CN/JP/KR | Khung cũ vẫn được hướng dẫn. Local dùng Bách Kỵ trên Thái Sử Từ và không có Tam Thế; bản JP tham chiếu đưa Bách Kỵ cho Hạ Hầu Uyên, Tam Thế cho Hoàng Nguyệt Anh. Khác build, chưa chứng minh kém hơn bằng đo kiểm. [JP](https://sangokushi-shinsen.com/sutada-hensei/) |
| 6 | Tôn Thượng Hương · Trần Cung · Hoàng Nguyệt Anh | 香陈黄; tìm được hướng dẫn CN đời S4+ | Trước 20 khớp bài cũ; sau 20 khác cách phân phối chiến pháp. Chưa có bằng chứng mới đủ để gọi là meta hàng đầu Global. [Bilibili 2021](https://www.bilibili.com/read/cv9175015/) |
| 7 | Thái Văn Cơ · Khương Duy · Thái Sử Từ | 蔡姜太; tìm được CN S9 | Mục riêng trong nguồn S9 khớp cả trước/sau 20, bất kể thứ tự hai phó tướng. Đúng build lịch sử; chưa xác nhận vị trí meta 2026. [17173 S9](https://news.17173.com/z/sgzzlb/content/08292021/083300803.shtml) |
| 8 | Khương Duy · Hạ Hầu Uyên · Pháp Chính | 姜夏法; có hướng dẫn CN | Local trước 20 dùng Đoạt Hồn trên Khương Duy thay Vô Đương; sau 20 dùng Nhất Kỵ thay Mau Giành ở Hạ Hầu Uyên. Khung hợp nguồn nhưng chưa là exact build tham chiếu. [18183](https://www.18183.com/sg/5540906.html) |
| 9 | SP Viên Thiệu · Hạ Hầu Uyên · Trương Xuân Hoa | 袁夏张; CN, JP và hướng dẫn KR cũ | JP S23 có đúng khung. Local SP Viên Thiệu mang Nằm Gai, JP dùng Xế Đao Chước Địch; local Trương Xuân Hoa mang Thịnh Khí, JP dùng Thời Cơ. Cần nhãn biến thể. [Dengeki](https://dengekionline.com/article/202601/61284) |
| 10 | Khương Duy · Quan Ngân Bình · Thái Văn Cơ | 蜀骑/강관채; CN/JP/KR | Bộ trước/sau 20 local khớp hướng dẫn 18183 tham chiếu. Khung kinh điển vẫn có đường chuyển đội; không đồng nghĩa top 1 hiện tại. [18183](https://www.18183.com/sg/5540906.html), [KR 2024](https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=245545) |
| 11 | Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ | 机关枪/关乐枪; CN/JP/KR | Đúng họ đội. Nguồn ghi 士争先赴, local ghi Nhanh Chân Tranh Đất nhưng dictionary chưa có tên Hán của record này; chưa thể đánh dấu exact match tự động. [JP](https://sangokushi-shinsen.com/sutada-hensei/), [CN](https://www.18183.com/sg/5540906.html) |
| 12 | Gia Cát Khác · Thái Sử Từ · Tả Từ | 恪太左/제태좌; CN, phồn thể, KR; JP có tín hiệu cộng đồng | Bộ trước 20 và sau thức tỉnh quét đất 5 khớp hướng dẫn Bahamut. Khi lên đất 6, nguồn còn đổi Thịnh Khí sang Sĩ Biệt; không coi build cấp 20 cố định là cấu hình cho mọi đất. KR dùng Sĩ Biệt ngay sau 20. [Bahamut](https://forum.gamer.com.tw/Co.php?bsn=36815&sn=70069), [KR](https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=355794) |
| 13 | SP Lô Trực · Thái Sử Từ · Trương Xuân Hoa | 卢太华; sheet Việt và kết quả tìm video CN | Chưa đọc được full build/chiến báo độc lập. Không đủ kết luận T0 CN/Global. Ô Đồng Lòng Hợp Sức cần xác minh danh tính chiến pháp. [Nguồn nhập](import-260906-1413-khaihoang-google-sheet.md) |
| 14 | SP Hoàng Nguyệt Anh · SP Mã Siêu · Gia Cát Khác | 黄马恪; có build CN, nguồn phồn thể chưa đủ xác định server | Trước 20, nhánh Tiềm Long–Thôi Phong–Giải Phiền khớp nguồn CN. Sau 20 local phân Giải Phiền cho SP Hoàng Nguyệt Anh, Thịnh Khí+Thời Cơ cho Gia Cát Khác; chưa chốt exact match nguồn CN mới. Không suy độ phổ biến JP/KR từ tên tướng có mặt trong game. [Bài CN chuyển phồn thể](https://inf.news/zh-hant/game/80083519351f8aece8475c0d2f06a9b7.html) |

## Kiểm tra cơ chế local

- Thanh Châu: `troopFit = [Thương]`. Nhạc Tiến/Quan Ngân Bình có thích tính cung lần lượt B/C trong dữ liệu, củng cố đây không phải lựa chọn mặc định nên giữ. [Wiki JP](https://wikiwiki.jp/shinsen-wiki/S%E5%85%B5%E7%A8%AE%E6%88%A6%E6%B3%95) cũng ghi chiến pháp nâng cấp Thương. Chỉ đổi kết luận nếu có cơ chế kịch bản cụ thể cho phép dùng khác.
- Tiềm Long cần ba phe khác nhau. Các bộ #1, #2, #3, #13, #14 có khung ba phe phù hợp; không gắn lỗi trận pháp chỉ vì khác một bài hướng dẫn.
- Tam Thế phụ thuộc hiệu ứng chủ tướng, nên nếu đổi người cầm/chủ tướng phải xem chiến pháp tự mang. Không hoán đổi Tiềm Long/Tam Thế như hai chiêu tương đương.
- Đồng Lòng Hợp Sức: record hiện trỏ 戮力上国 (Nội chính), còn trong các đội chiến đấu lại được dùng như một chiêu hỗ trợ. Đây là xung đột mapping chắc chắn cần điều tra; chưa biết tác giả sheet định nói tới chiến pháp nào. Không tự đổi sang 众志成城 hoặc 勠力同心.
- Nhanh Chân Tranh Đất: record pending chưa có Hán; 士争先赴 lại tồn tại riêng với tên Sĩ Tranh Tiên Phó. Chỉ nêu nghi vấn tên/alias, không tự xác nhận tương đương.
- Các record mới/pending và mô tả Thần Xạ cũ làm giảm khả năng kiểm cơ chế của build sau cập nhật. Không dùng dictionary local để kết luận Global đã/ chưa nhận một bản vá.

## Độ mới của bằng chứng

- [CN roundup 2026-07-10](https://www.kunduo.com/strategy/45794.html) vẫn nêu các họ 恪太左, 姜夏诸, 法恪马, 关乐枪 và các lựa chọn cũ. Dùng để kiểm sự hiện diện; không bê tier chủ quan sang website.
- [CN bài cá nhân 2026](https://www.cnblogs.com/walj/articles/19910985) cho cấu hình Pháp Chính: Tiềm Long trước 20, thêm Thịnh Khí sau 20; SP Mã Siêu Thôi Phong rồi thêm Mau Giành; Gia Cát Khác Giải Phiền rồi thêm Thời Cơ. Đây là mốc tham chiếu, không phải bản thay thế đã được người dùng duyệt.
- [JP Dengeki/Qookka 2026-01, S23](https://dengekionline.com/article/202601/61284) xác nhận khung SP Viên–Hạ–Xuân Hoa và Tam Thế Lục trong ngữ cảnh mùa đó. Không dùng các phần PvP khác của bài để suy meta khai hoang.
- [KR trải nghiệm S17 năm 2024](https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=262247) so sánh Khương–Hạ–Gia Cát Khác và Quan–Nhạc–Gia Cát Khác; đây là lịch sử có trải nghiệm, không phải tier hiện hành.
- [KR 2026-04](https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=355424) còn hỏi về cách dùng Khương–Hạ–Gia Cát Khác khi thiếu Thôi Phong. Chỉ chứng minh có thảo luận, không chứng minh thắng hoặc mạnh nhất.
- [JP bài chuẩn bị 2026-09-02](https://gunryakucho.com/sangokushi-s26-preparation/) viết về Binh Diễn Xuân Thu trước ngày mở dự kiến 12/9 và dựa trên tài liệu trải nghiệm. Không nâng preview thành kết luận meta live S26.
- Hai bài “T0 2026” trên Ali213 bị loại khỏi căn cứ khuyến nghị: một danh sách trộn đội PvP chi phí cao, một bài lặp Thịnh Khí trên hai tướng cùng đội. Ngày mới hoặc domain lớn không đủ bảo đảm nội dung đúng.
- Bài S9 17173 có lỗi tên ở mục Khương–Hạ–Pháp; không dùng mục lỗi đó, chỉ dùng đoạn Thái Văn Cơ–Thái Sử Từ–Khương Duy và nhận diện lịch sử phù hợp.

## Đề xuất cho lần chỉnh dữ liệu sau

1. Ưu tiên sửa binh chủng/build #2 sau khi chọn biến thể Thương cụ thể; chỉ đổi binh chủng sau 20 chưa giải quyết toàn bộ việc chọn chiến pháp và chủ tướng.
2. Xác minh danh tính Đồng Lòng Hợp Sức, Nhanh Chân Tranh Đất từ client; tránh tự suy tên dựa trên âm hoặc vị trí trong đội.
3. Giữ các đội cũ làm phương án theo kho tướng nhưng gắn nhãn mùa/nguồn. Không xóa đội vì không còn xuất hiện trong một roundup.
4. Khi cập nhật #1/#3/#9/#12/#14, lưu variant và giai đoạn, đặc biệt khác biệt đất 5/6 và trước/sau bản vá. Không đồng nhất CN với Global.

## Còn chưa rõ

- Mùa và bản vá mục tiêu của website cho từng khu vực; chưa có một lựa chọn Global duy nhất.
- Full build và chiến báo đủ đọc của SP Lô Trực–Thái Sử Từ–Trương Xuân Hoa.
- Tên chiến pháp Việt ở hai điểm mapping nêu trên.
- Tỷ lệ sử dụng/hiệu suất cùng điều kiện giữa các khu vực; chưa có dataset đại diện.
