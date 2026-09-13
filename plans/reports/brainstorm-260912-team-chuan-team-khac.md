# Brainstorm: nâng cấp danh sách và trang chi tiết đội

**Trạng thái:** đã chốt hướng sản phẩm, làm đầu vào cho một plan triển khai mới. Tài liệu này thay thế các quyết định giao diện cũ trong chính bản brainstorm; không phải bằng chứng đã sửa code, hoàn thành plan mới hoặc deploy.

**Quyết định cốt lõi:** giữ độ gọn và cách sử dụng của tqccl.com; bổ sung duyệt theo mùa, điểm số và trang chi tiết riêng. Không thiết kế lại toàn bộ chỉ để giống SGSDeck, không làm mất dữ liệu cũ để làm giao diện ngắn hơn.

## 1. Kết quả người dùng cần

Người chơi tìm đội bằng từ khóa và bộ lọc, so sánh ngay trên thẻ, rồi mở trang riêng để đọc hướng dẫn đầy đủ. Thẻ phải đủ tướng, chiến pháp, binh thư và thông tin khắc chế đã có; trang chi tiết giữ mô tả, cộng điểm, điều kiện và phương án thay thế. Quay lại danh sách không mất mùa, bộ lọc hoặc vị trí đang xem.

## 2. Cơ sở đối chiếu và phần đã có

### Bản production trên tqccl.com

Đã kiểm tra trực tiếp [tqccl.com](https://tqccl.com/) bằng trình duyệt:

- Team PK hiển thị 56 đội; Meta phe (cũ) hiển thị 110 đội tại thời điểm đối chiếu. Đây là số liệu bản live, không phải số lượng yêu cầu cho bản mới.
- Desktop 1440px hiển thị 4 thẻ mỗi hàng. Thẻ có ba khối tướng, chiến pháp, binh thư, phương án thay thế và chip khắc chế khi có dữ liệu.
- Bộ lọc Team PK gồm Loại binh / Sao / Phe, có màu phe, số lượng và một ô tìm kiếm chung.
- Mobile 375px thu gọn các nhóm lọc dưới nút **Bộ lọc**, giữ tìm kiếm luôn hiện và thẻ một cột; khi kiểm tra không có tràn ngang.
- Bấm tên **Hoàng Mã Thương** hiện đưa tên vào ô tìm kiếm, không mở trang đội riêng.

**Giữ bản live làm chuẩn cho mật độ thẻ và thao tác lọc.** Hai đề xuất trước đây — giới hạn desktop chỉ 2–3 cột và mở sẵn toàn bộ chip trên mobile — không còn áp dụng.

### Nguồn tham khảo SGSDeck

- [Danh sách Recommended](https://sgsdeck.com/recommended): tham khảo cách chọn mùa, phân nhóm thông tin và liên kết đến đội. Đã quan sát các điểm số như 113, 105, 98.
- [Chi tiết Cung Lữ Bố 40Y](https://sgsdeck.com/recommended/og-bingyan-40y-lvbu-xiandeng): tham khảo trang riêng với cấu hình từng tướng, cộng điểm và ghi chú.
- Không sao chép ô tìm mùa, bộ lọc Tier hoặc thẻ chỉ liệt kê tên tướng của nguồn. Các phần đó không đáp ứng yêu cầu giữ giao diện cũ và xem chiến pháp/binh thư ngay trên thẻ.

### Phần đã triển khai trong worktree

Đã có luồng Team chuẩn / Team khác, dữ liệu Recommended theo mùa, đối chiếu trùng, bản dịch tướng/chiến pháp/binh thư được duyệt và 29 tên mùa. SP/CO/40Y đã có tag; Kết Nghĩa Vườn Đào được phân loại là duyên phận. Tên đội và nhiều mô tả nguồn vẫn chưa Việt hóa; chi tiết hiện tại chưa phải trang riêng theo yêu cầu mới.

[Báo cáo kiểm chứng](../260912-0950-recommended-season-browser/reports/validation.md) ghi phạm vi thực tế đã làm, gồm kiểm tra bảo toàn 90 payload và quyết định xét trùng. Không coi trạng thái hoàn thành của [plan ban đầu](../260912-0950-recommended-season-browser/plan.md) là hoàn thành đợt nâng cấp này. [Draft PR #3](https://github.com/nguyennguyenit/CamNangTQCCL/pull/3) không đồng nghĩa mọi thay đổi local đã được push hoặc deploy.

## 3. Hướng chọn và đánh đổi

**Chọn: nâng cấp trên giao diện tqccl.com.** Giữ thẻ giàu thông tin và bộ lọc quen thuộc; chỉ thay những phần người dùng đã yêu cầu. Thêm chọn mùa sẽ chiếm thêm diện tích, nên mục tiêu là giữ tốc độ xem và so sánh đội, không hứa giao diện ngắn hơn bản cũ ở mọi màn hình.

Không chọn:

- Giữ nguyên hoàn toàn bản cũ: thiếu duyệt nhiều mùa và trang chi tiết có URL riêng.
- Sao chép toàn bộ SGSDeck: làm mất lợi thế xem chiến pháp, binh thư và khắc chế ngay trên thẻ; mang thêm các thành phần người dùng đã yêu cầu bỏ.
- Dồn toàn bộ mô tả vào thẻ hoặc rút thẻ chỉ còn tên tướng: một cách làm danh sách quá dài, cách còn lại buộc mở nhiều trang mới so sánh được đội.

## 4. Tab và phạm vi dữ liệu

Hai tab đội dùng tên đã chốt **Team chuẩn** và **Team khác**. “Giữ tab như cũ” là giữ cách tổ chức và thao tác quen thuộc, không quay lại tên Team PK / Meta phe (cũ), cũng không đổi thành Đội cộng đồng / Đội đề cử.

- **Team chuẩn:** các cấu hình thuộc SGSDeck Recommended, qua những mùa nguồn đã có dữ liệu; không giới hạn ở mùa mới hoặc riêng Binh Diễn Xuân Thu.
- **Team khác:** các cấu hình có sẵn đã xác định khác Team chuẩn theo quy tắc tướng + chiến pháp. Đợt đầu không bắt buộc research hoặc chiến báo mới cho từng đội cũ.
- Giữ nguồn đã biết. Thiếu nguồn ghi **Nguồn chưa xác định**, không nói có chiến báo khi không có bằng chứng. Bài người chơi chia sẻ trên SGSDeck không tự động là Recommended.
- Giữ các tab/chức năng khác: Cùng Tồn, Khai hoang, tra cứu, chiêu mộ, soi đội và gợi ý đội. Không đưa thêm hệ tab danh mục chỉ để giống nguồn; không bỏ khả năng truy cập các danh mục nguồn đã có trong phạm vi duyệt.
- Khai hoang hiện có tiếp tục dùng dữ liệu được bảo trì riêng. Khai hoang thuộc Recommended vẫn là tham khảo theo mùa nguồn, không thay thế tab này.

## 5. Tìm kiếm, chọn mùa và bộ lọc

### Tìm kiếm và mùa

- Giữ **một ô tìm kiếm chung** cho đội, tướng, chiến pháp và binh thư; tiếp tục hỗ trợ tên Việt có dấu/không dấu và tên Trung nguyên bản.
- Bổ sung **danh sách chọn mùa** bằng bấm/chạm, hiển thị mã và tên mùa Việt. Không có ô **Tìm mùa** riêng, không bắt người dùng gõ để tìm mùa.
- Giữ các lựa chọn mùa hợp lệ của từng tab; không tự gán mùa cho đội chưa rõ mùa. Mùa nguồn không tự quy đổi thành mùa máy chủ Việt Nam.
- Mùa chưa thu thập, danh mục rỗng và không có kết quả lọc phải có thông báo đúng nguyên nhân. Không lấp chỗ trống bằng đội mùa khác.

### Các nhóm lọc

- Giữ kiểu chip, màu phe, số lượng, cách chọn và nút **Xóa lọc** của bản cũ.
- Thứ tự nhóm: **Loại binh → Điểm → Phe**. Nhóm **Điểm** thay **Sao**; không giữ mức sao 4/4.5/5 và không thay bằng bộ lọc Tier.
- Lựa chọn điểm dựa trên dữ liệu thật trong phạm vi đang xét, có cách lọc đội **Chưa có điểm**. Không tự đặt thang điểm mới hoặc quy đổi sao.
- Không thêm bộ lọc **Phiên bản luật** hoặc điều khiển sắp xếp ngoài yêu cầu. Giữ thứ tự nguồn đã xác minh, nhưng bỏ các tiêu đề nhóm T0/T0.5/T1 trên danh sách.

### Bố cục responsive

- **Desktop:** giữ khối lọc gọn như bản live; tìm kiếm và chọn mùa cùng hàng khi đủ rộng, các nhóm chip bên dưới. Xóa lọc và số kết quả nằm trong cùng khối, không tạo thêm một thanh công cụ riêng. Giữ 4 cột ở chiều rộng phù hợp như bản 1440px đã kiểm tra; giảm xuống 3/2 cột khi nội dung không còn đủ chỗ đọc.
- **Mobile:** tìm kiếm và chọn mùa luôn nhìn thấy, xếp dọc khi cần. Loại binh / Điểm / Phe tiếp tục thu gọn dưới nút **Bộ lọc** như bản cũ; mở ra thì chip tự xuống dòng. Thẻ một cột, không kéo ngang toàn trang.
- Nút chọn mùa, tìm kiếm và bộ lọc phải dùng được bằng bàn phím/chạm, có nhãn và trạng thái chọn rõ. Không thu nhỏ chữ hoặc vùng bấm chỉ để nhét thêm nội dung.

## 6. Thẻ đội và điểm số

Thẻ phục vụ **so sánh nhanh**, không thay thế trang hướng dẫn:

- Tên đội Việt bên trái; **điểm số ở góc trên bên phải**, ví dụ **113 điểm**. Tên dài được xuống dòng, không đè điểm.
- Giữ nhãn loại binh/phe, ba khối tướng, chiến pháp, binh thư, phương án thay thế dạng ngắn và chip khắc chế/bị khắc chế đã có.
- SP/CO/40Y là tag đầu tên tướng. Giữ đầy đủ **CO Vô Song Đại Kiều / Tiểu Kiều / Tinh Thái** và các tên Việt đã được duyệt.
- Bỏ sao, dạng 4.5★, badge T0/Tier và dòng dưới thẻ như **OG · Binh Diễn Xuân Thu · Giao chiến**. Áp dụng cho mọi dòng mùa/danh mục cùng vai trò; không thay bằng một dòng mùa rút gọn.
- Giữ tên đội và liên kết **Xem chi tiết** cùng dẫn tới một trang riêng. Chip tướng/chiến pháp/binh thư giữ chức năng riêng, không vô tình kích hoạt mở đội.
- Không đưa thêm mô tả dài vào thẻ. Giữ các thông tin ngắn cần so sánh; giải thích đầy đủ ở chi tiết.

Điểm phải có bằng chứng cho **đúng cấu hình**. Không quy đổi 4.5 sao thành 90/113 điểm, không suy điểm từ Tier, không lấy điểm của đội cùng tên hoặc gần giống. Thiếu điểm ghi **Chưa có điểm**, không dùng 0 thay cho thiếu dữ liệu. Điểm nguồn không tự trở thành đánh giá Global/VN hoặc điểm áp dụng mọi mùa.

Bỏ sao/Tier khỏi giao diện không xóa đánh giá lịch sử hoặc metadata nguồn khỏi dữ liệu đối chiếu.

## 7. Trang chi tiết riêng

### Điều hướng

- Bấm tên đội hoặc **Xem chi tiết** mở cùng URL riêng trong tab hiện tại; hỗ trợ mở tab mới bằng thao tác trình duyệt.
- Không còn khung chi tiết chen trong danh sách. Đây là thay đổi có chủ đích so với cả hành vi tìm theo tên trên production lẫn khung chi tiết trong worktree.
- URL mở trực tiếp, tải lại và chia sẻ được; ID/URL không phụ thuộc bản dịch tên đội.
- Quay lại danh sách, Back/Forward giữ tab, mùa, từ khóa, chip đã chọn và vị trí cuộn. Giữ hệ điều hướng chính trên trang chi tiết.
- Chuyển các liên kết chi tiết hiện có của luồng này sang đường dẫn mới; không làm hỏng luồng gameplay, so kho hoặc gợi ý đội khác.

### Nội dung

Trình tự đọc đề xuất: **quay lại danh sách → tên đội và điểm → tướng/cấu hình/cộng điểm → mô tả, cách vận hành → khắc chế/bị khắc chế → phương án thay thế → nguồn**.

- Giữ mô tả đội, ghi chú từng tướng, thứ tự/tốc độ, điều kiện sử dụng, lựa chọn chiến pháp/binh thư và cấu hình thay thế đã có.
- Giữ cả **đội khắc chế** và **đội bị khắc chế/cần tránh**, cùng phần giải thích. Không chỉ dựng trang từ dữ liệu Recommended rồi bỏ nội dung của đội cũ.
- Phân chia ghi chú chung và ghi chú từng tướng để tránh lặp cùng đoạn; không cắt nội dung nhằm rút ngắn trang.
- Thông tin nguồn, mùa và danh mục được giữ trong phần nguồn của chi tiết, không lặp thành dòng dưới từng thẻ danh sách.
- Mục chưa có nội dung không được bịa thêm. Nêu rõ thiếu dữ liệu khi cần để tránh người đọc hiểu nhầm.

**Ràng buộc liên kết nội dung cũ:** đối chiếu đúng cấu hình và xuất xứ trước khi gắn mô tả/khắc chế vào đội nguồn. Không ghép chỉ vì cùng tên, cùng ba tướng hoặc cùng nhóm xét trùng. Nội dung chưa đủ căn cứ liên kết phải được giữ với cấu hình gốc để truy xuất, không bị xóa hoặc trình bày như hướng dẫn đã xác nhận cho cấu hình khác.

## 8. Việt hóa và danh tính độc lập ngôn ngữ

- Bổ sung bản Việt cho **tên đội**, giữ các phần phân biệt biến thể/cấu hình; không đặt một tên chung khiến nhiều cấu hình không phân biệt được.
- Dùng lại tên tướng, chiến pháp, binh thư và mùa đã được duyệt. Nguồn quản lý chung là [identity map](../../pipeline/recommended-identity-map.json); không sửa riêng từng dòng đội hoặc tự dịch lại thuật ngữ đã thống nhất.
- Giữ mô tả Việt cũ và bản Trung gốc. Khi bổ sung bản dịch mô tả, lưu riêng; mục chưa có bản Việt vẫn đọc được bằng bản nguồn, không bị giấu.
- Tách ID thực thể/cấu hình khỏi nhãn Việt/Trung và nhãn tiếng Anh về sau. Đổi tên hiển thị không đổi ID, URL, biến thể hoặc kết quả xét trùng; không gộp bản thường với SP/CO/40Y.
- Phê duyệt bản dịch không tự xác nhận danh tính. Từ còn thiếu `戮力上心` vẫn giữ nguyên cho đến khi đủ bằng chứng; không tự coi là `勠力同心` — Đồng Lòng Hợp Sức.
- `桃園結義` là **Kết Nghĩa Vườn Đào**, hiển thị dưới **Duyên phận**, không phải chiến pháp có thể chọn. Giữ ô nguồn nguyên bản và phân loại hiển thị riêng.
- Giữ worksheet tên thiếu cùng chữ Trung, biến thể và ngữ cảnh nguồn để người dùng duyệt. Không dịch tự động lúc mở trang hoặc âm thầm phiên âm tên chưa xác minh.
- Chưa triển khai từ điển tiếng Anh, bộ chuyển ngôn ngữ hoặc trang quản trị bản dịch trong đợt này. [Tài liệu dữ liệu theo mùa](../../docs/season-team-data.md) ghi cách duy trì bản dịch hiện có.

## 9. Các bất biến dữ liệu phải giữ

### Xét trùng và cấu hình

- Tiêu chí phân nhóm là **ba danh tính tướng đúng biến thể + chiến pháp gắn với từng tướng**. Đổi tướng, đổi chiến pháp hoặc chuyển chiến pháp sang tướng khác là cấu hình khác.
- Chỉ đổi thứ tự hiển thị tướng hoặc thứ tự hai ô chiến pháp trên cùng tướng không tạo đội khác theo quy tắc xét trùng hiện có.
- Chỉ khác binh thư, cộng điểm, trang bị, chủ tướng, mô tả, mùa, điểm hoặc Tier không chứng minh đội khác theo tiêu chí phân nhóm; vẫn giữ nguyên từng cấu hình nguồn và chi tiết tương ứng. Quy tắc xét trùng này không đủ để chuyển hướng dẫn/điểm giữa các cấu hình.
- Đối chiếu trên toàn bộ tập Recommended đã xác nhận trước khi lọc mùa. Đổi bộ lọc không làm đội trùng trở thành Team khác.
- Với đội nhiều phương án, giữ các phương án xác định không trùng; thiếu danh tính hoặc liên kết phương án thì giữ trạng thái chờ đối chiếu. Không tự sinh tích các phương án thành đội mới.
- Không xóa raw, ID, thứ tự slot, vai trò, điểm, mùa, nguồn, dữ liệu cũ hoặc WIP vì đổi giao diện.

### Thu thập và xuất bản

- Tái sử dụng pipeline Python và cache hiện có: thu danh sách/chi tiết, lưu URL/thời điểm/checksum, parse offline, đối chiếu rồi xuất bản dữ liệu đồng bộ. Browser dùng khi cần xác minh; không crawl lúc người dùng mở website.
- Giữ cơ chế tiếp tục sau gián đoạn, giới hạn tốc độ và kiểm tra publication. Không làm lại crawler hoặc coi thử nghiệm trên vài trang là chứng minh đủ mọi mùa.
- Quyền lưu/hiển thị cấu hình và điểm Recommended đã được người dùng xác nhận. Team khác không bị chặn chỉ vì chưa có chiến báo mới.

## 10. Phần không làm

- Không thiết kế lại toàn site, thay hệ tab khác, thêm tài khoản, bình chọn, đăng bài hoặc upload chiến báo.
- Không tạo thang điểm, tự chấm đội, quy đổi sao sang điểm hoặc coi đội có điểm nguồn là dùng được trong mọi mùa VN.
- Không thay engine xét trùng, gợi ý đội, luật gameplay, MCP hoặc dữ liệu Khai hoang hiện có chỉ vì sửa luồng duyệt.
- Không thu gọn bằng cách bỏ chiến pháp/binh thư, mất mô tả hay xóa khắc chế. Thu gọn nhóm lọc trên mobile là giữ thao tác bản cũ, không loại bỏ khả năng lọc.
- Không tự commit, push, merge hoặc deploy trong bước viết brainstorm. Việc tạo plan triển khai mới là bước kế tiếp, không phải phần đã hoàn thành ở đây.

## 11. Tiêu chí nghiệm thu cho plan mới

Các mục dưới đây là yêu cầu phải được chứng minh sau triển khai, không phải danh sách đã hoàn thành:

- [ ] Team chuẩn / Team khác đúng phạm vi dữ liệu; các tab/chức năng khác giữ nguyên hành vi.
- [ ] Desktop ở độ rộng phù hợp giữ mật độ 4 cột như bản live; các màn hẹp giảm cột mà không ép chữ hoặc tràn ngang.
- [ ] Mobile 375px có tìm kiếm và chọn mùa luôn hiện; các nhóm chip mở/đóng qua Bộ lọc, thẻ một cột. Kiểm tra thêm biên 320px.
- [ ] Chọn mùa hoàn toàn bằng bấm/chạm/bàn phím; không còn ô Tìm mùa riêng. Phân biệt đúng chưa có dữ liệu, không khớp bộ lọc và đội chưa rõ mùa.
- [ ] Chip Loại binh / Điểm / Phe giữ màu, số lượng, cách chọn và Xóa lọc như cũ; đội thiếu điểm vẫn tìm được.
- [ ] Điểm ở góc trên phải đúng cấu hình; không có sao, badge/tiêu đề nhóm Tier hoặc dòng mùa/danh mục dưới thẻ.
- [ ] Thẻ giữ ba tướng, chiến pháp, binh thư, tag biến thể, phương án ngắn và chip khắc chế đã có; tên dài không đè điểm.
- [ ] Tên đội Việt nhất quán giữa thẻ, tìm kiếm và chi tiết; tên Trung, ID và các tên đã duyệt được giữ. Duyên phận không trở thành chiến pháp.
- [ ] Tên đội và Xem chi tiết mở cùng URL riêng; mở trực tiếp, tải lại, chia sẻ và mở tab mới hoạt động. Không còn khung chi tiết trong danh sách.
- [ ] Back/Forward và quay lại giữ tab, mùa, từ khóa, lựa chọn lọc, vị trí cuộn; chip chiến pháp không vô tình mở trang đội.
- [ ] Chi tiết giữ mô tả, cộng điểm, điều kiện, khắc chế/bị khắc chế và phương án thay thế cũ; không lặp ghi chú hoặc ghép nhầm cấu hình. Nội dung chưa liên kết vẫn truy xuất được ở cấu hình gốc.
- [ ] Đối chiếu dữ liệu trước/sau chứng minh raw, ID, cấu hình, nguồn, điểm và quyết định xét trùng không bị sửa bởi việc dịch hoặc đổi giao diện.
- [ ] Kiểm tra bản chạy thật trên desktop/mobile, sáng/tối, bằng bàn phím/chạm; dùng tên dài, nhiều phương án, nhiều mức điểm và dữ liệu thiếu. Không đánh giá độ gọn chỉ từ mã nguồn hoặc bố cục mô tả.

## 12. Đầu vào cho plan triển khai mới

**Lập một plan riêng cho đợt nâng cấp này.** Giữ [plan ban đầu](../260912-0950-recommended-season-browser/plan.md) cùng bằng chứng lịch sử; không mở lại toàn bộ pipeline hoặc dùng trạng thái done cũ cho yêu cầu mới.

Plan mới cần bao phủ bốn phần:

1. **Dữ liệu và bản dịch:** tên đội, bảo toàn/liên kết mô tả và khắc chế, điểm đúng cấu hình, danh tính độc lập ngôn ngữ.
2. **Danh sách đội:** tái sử dụng thẻ/bộ lọc production; chọn mùa, điểm số, mật độ desktop và thu gọn mobile; bỏ những nhãn đã chốt.
3. **Trang chi tiết:** URL riêng, dữ liệu đầy đủ, chuyển các điểm mở chi tiết và bảo toàn trạng thái quay lại.
4. **Kiểm chứng:** dữ liệu trước/sau, các luồng liên quan và giao diện thực tế; chỉ đánh dấu hoàn thành theo bằng chứng mới.

Các điểm bắt đầu đã biết: [render thẻ cũ](../../js/render.js), [bộ lọc dùng chung](../../js/team-filter-section.js), [render Recommended hiện tại](../../js/recommended-reference-render.js), [tài liệu dữ liệu](../../docs/season-team-data.md) và [báo cáo kiểm chứng](../260912-0950-recommended-season-browser/reports/validation.md). Đây là điểm khảo sát, không phải danh sách đầy đủ file cần sửa.

## 13. Rủi ro và điểm cần giải quyết khi lập plan

Không cần hỏi lại các lựa chọn sản phẩm đã chốt. Plan phải làm rõ bằng dữ liệu và mã nguồn:

- Cấu hình cũ nào liên kết chắc chắn với Recommended, cấu hình nào chỉ cùng nhóm xét trùng; bảo toàn mô tả/khắc chế mà không gán sai hướng dẫn.
- Đội nào có điểm xác thực, đội nào chỉ có sao lịch sử; nhiều mức điểm có làm hàng chip quá dài hay không. Không giải quyết bằng quy đổi điểm hoặc bỏ các đội thiếu điểm.
- Các nơi đang mở chi tiết, liên kết cũ và trạng thái điều hướng cần chuyển; không làm mất luồng gameplay ngoài phạm vi.
- Tên đội dài, nhiều phương án và nhiều chip khắc chế ảnh hưởng đến độ gọn thực tế. Chỉ chốt khoảng cách, cách xuống dòng và breakpoint sau khi xem bản chạy; không cắt dữ liệu để đạt kích thước thẻ tùy ý.

Riêng `戮力上心` vẫn là tên chưa xác thực, không phải lý do chặn toàn bộ nâng cấp. Giữ chữ nguồn và không tự đồng nhất với một chiến pháp khác.
