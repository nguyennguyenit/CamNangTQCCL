# Brainstorm: nâng cấp danh sách và trang chi tiết đội

Ngày: 2026-09-12. Trạng thái: đã chốt hướng sản phẩm, bổ sung quyết định Việt hóa Team chuẩn. Trạng thái triển khai và bằng chứng xem plan cùng tài liệu thực hiện bên dưới; không đồng nghĩa đã deploy.

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

## Việt hóa Team chuẩn và giữ dữ liệu hai ngôn ngữ

**Quyết định mới nhất của người dùng:** “Cứ dịch theo dữ liệu đã có sẵn, thiếu chiến pháp nào chưa Việt hóa thì anh tự dịch lại bổ sung sau, vẫn giữ tiếng Trung để sau này còn làm 2 ngôn ngữ cho site.”

### Kết quả mong muốn

Team chuẩn dùng tên Việt quen thuộc, nhất quán với Meta cũ và từ điển hiện có của dự án. Nội dung chưa có bản Việt vẫn đọc được bằng tiếng Trung; người dùng sẽ bổ sung bản dịch sau. Giữ đồng thời dữ liệu Trung và Việt để hỗ trợ hai ngôn ngữ về sau.

### Cách làm đã chốt

- Chiến pháp trùng với Meta cũ dùng nguyên tên Việt đã có, sau khi đối chiếu đúng danh tính qua tên Trung; không dịch lại thành cách gọi khác.
- Tướng và binh thư cũng dùng bản Việt sẵn có trong dữ liệu dự án. Giữ đúng biến thể thường/SP/CO/40Y; không suy tên từ đội hình hoặc vị trí trang bị.
- Đối chiếu chữ phồn thể/giản thể khi xác nhận đó là cùng tên nguồn; đây là nhận diện tên đã có bản Việt, không phải sáng tác bản dịch mới.
- Có bản Việt thì ưu tiên hiển thị trên thẻ đội, chi tiết và cấu hình thay thế. Chưa có hoặc chưa xác định chắc thì giữ tiếng Trung; không giấu mục đó hoặc thay bằng tên gần giống.
- Giữ nguyên tên và nội dung Trung gốc; bản Việt lưu riêng. Tên đội, ghi chú, cộng điểm và mô tả chưa có bản dịch sẵn vẫn giữ nguyên nguồn.
- Tìm kiếm bằng tên Việt có dấu/không dấu và tên Trung gốc đều phải tìm được đúng đội.
- Có danh sách tên còn thiếu bản Việt, chia theo tướng / chiến pháp / binh thư, loại trùng theo đúng danh tính đã xác định và kèm tên Trung cùng đội hoặc liên kết nguồn làm ngữ cảnh. Không gộp tên chưa chắc là cùng một thực thể. Đây là đầu vào để người dùng dịch bổ sung, không phải yêu cầu xây màn hình quản trị.
- Quản lý bản dịch tại một nơi dùng chung; không sửa riêng trên từng đội. Khi người dùng bổ sung hoặc sửa tên Việt, cùng bản dịch được áp dụng cho mọi đội liên quan, thẻ đội, chi tiết và tìm kiếm.
- Tách bản dịch hiển thị khỏi danh tính: đổi cách viết tên Việt hoặc ngôn ngữ hiển thị không đổi ID, liên kết đội hay kết quả xét trùng.
- Lấy nhãn, thuật ngữ và bộ lọc đã có trên `main` làm chuẩn, tái sử dụng cho Team chuẩn; không dịch lại hoặc thiết kế thêm một bộ lọc khác. Điểm đối chiếu hiện có: `js/team-filter-section.js` (nhãn và cách dựng bộ lọc), `js/render.js` (tên phe, binh chủng và nhãn nguồn), cùng dữ liệu tương ứng trên main.
- Việt hóa cả nhãn và giá trị hiển thị trong bộ lọc Team chuẩn: phe, binh chủng, mùa/kịch bản, danh mục nguồn, nhóm đội và các lựa chọn liên quan. Chip đang chọn, danh sách lựa chọn và ô tìm kiếm trong bộ lọc dùng cùng thuật ngữ đã có trên main. Chỉ giữ tiếng Trung cho giá trị thực sự chưa có bản Việt sau khi đối chiếu main; giữ nguyên ký hiệu Tier như T0/T1.
- Bản dịch bộ lọc chỉ thay phần hiển thị, không đổi mã giá trị, tham số URL hoặc quy tắc lọc. Tìm lựa chọn bằng tên Việt có dấu/không dấu hoặc tên Trung gốc đều phải nhận ra đúng lựa chọn khi có dữ liệu tương ứng.
- Việt hóa đầy đủ tên mùa/kịch bản trong bộ chọn mùa, kết quả tìm mùa, nhãn đang chọn, thẻ đội và chi tiết. Ưu tiên tên đã có trên main; tên mùa chưa có bản Việt thì đối chiếu nguồn và bổ sung bản dịch tên mùa, không áp dụng quy tắc “để người dùng dịch sau” dành cho chiến pháp còn thiếu.
- Giữ riêng tên Trung gốc và mã mùa nguồn như S1/S28/PK/OG. Dịch tên hiển thị không đồng nghĩa quy đổi mùa nguồn sang mùa máy chủ Việt Nam; không tự khẳng định bản dịch bổ sung là tên chính thức trong game.

### Ràng buộc và phần không làm

- Không tự dịch bổ sung chiến pháp còn thiếu; người dùng chịu trách nhiệm cung cấp bản dịch sau.
- Không dùng dịch tự động lúc mở trang, không phiên âm Hán–Việt hàng loạt và không ghi đè tiếng Trung bằng tiếng Việt.
- Không thay tướng, chiến pháp, binh thư, thứ tự slot, tier, điểm, mùa hoặc thứ tự xếp đội vì Việt hóa.
- Chưa thêm nút chuyển ngôn ngữ hoặc triển khai toàn bộ site song ngữ. Đợt này chỉ giữ dữ liệu đủ để làm việc đó sau.
- Chưa xây màn hình quản trị bản dịch. Danh sách thiếu bản Việt phục vụ rà soát và bổ sung dữ liệu, không mở thêm luồng quản trị.
- Không mở rộng đợt Việt hóa này sang Team khác hoặc thay đổi cơ chế xét trùng/gợi ý đội.

### Các phương án đã loại

- Dịch lại toàn bộ, kể cả tên đã có: không chọn vì dễ lệch thuật ngữ Meta cũ và vượt yêu cầu.
- Chỉ thay vài nhãn giao diện: không chọn vì chiến pháp, tướng và binh thư vẫn chưa dùng bản Việt đã có.
- Chỉ giữ bản Việt: không chọn vì mất dữ liệu gốc phục vụ đối chiếu và site hai ngôn ngữ.

### Tiêu chí nghiệm thu Việt hóa

- Tên có bản Việt được dùng nhất quán ở thẻ, chi tiết và cấu hình thay thế; từng slot thiếu bản Việt vẫn hiển thị đúng tiếng Trung của slot đó.
- Dữ liệu Trung gốc còn nguyên; các tên mới chưa được dịch không bị đoán hoặc bỏ khỏi đội.
- Tra tên Việt có dấu, không dấu và tên Trung trả về đúng cùng cấu hình tương ứng.
- Toàn bộ cấu hình, tier, điểm, thứ tự nguồn và kết quả xét trùng không đổi.
- Kiểm tra giao diện desktop/mobile và các luồng mở chi tiết, chọn thẻ tên để tìm kiếm.
- Danh sách thiếu bản Việt bao phủ dữ liệu Team chuẩn đang xét, phân nhóm rõ, không lặp cùng danh tính và có ngữ cảnh nguồn để người dùng đối chiếu.
- Một bản dịch được bổ sung hoặc sửa tại nơi quản lý chung phải áp dụng nhất quán cho mọi đội liên quan sau khi cập nhật dữ liệu; không cần sửa từng đội.
- Kiểm tra việc sửa tên Việt không thay ID, liên kết, cấu hình hoặc kết quả xét trùng; tên Trung nguyên bản vẫn được giữ.
- Bộ lọc dùng lại nhãn và thuật ngữ trên main, nhất quán ở nhãn, lựa chọn và chip đang chọn. Không để tiếng Trung ở giá trị đã có tên Việt tương ứng trên main; giá trị thực sự chưa dịch vẫn hiện tiếng Trung, không bị ẩn hoặc mất lựa chọn.
- Chọn cùng một giá trị trước/sau Việt hóa trả về cùng tập đội. URL cũ và thao tác quay lại/tiến tới vẫn khôi phục đúng bộ lọc; tìm lựa chọn mùa bằng tên Việt hoặc Trung vẫn chọn đúng mã mùa.
- Mọi tên mùa/kịch bản có trong dữ liệu thuộc phạm vi đều có tên Việt đã đối chiếu, dùng nhất quán ở bộ lọc, thẻ và chi tiết; không bỏ sót mùa cũ hoặc mùa chưa có đội. Mã mùa và tên Trung gốc vẫn được giữ; tìm bằng tên Việt có dấu/không dấu, tên Trung hoặc mã mùa đều nhận ra đúng mùa.

Các yêu cầu bổ sung về danh sách thiếu bản Việt, quản lý bản dịch dùng chung, danh tính độc lập ngôn ngữ, Việt hóa bộ lọc và dịch đầy đủ tên mùa/kịch bản đã được người dùng chấp thuận. Đây là tiêu chí đã chốt, không phải xác nhận toàn bộ đã được triển khai và kiểm chứng.

## Giới hạn và những phần không làm trong phạm vi này

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

Chưa có câu hỏi sản phẩm cần chốt lại. Plan chính và [báo cáo kiểm chứng triển khai](../260912-0950-recommended-season-browser/reports/validation.md) sở hữu trạng thái của hai tab; nhận định cũ “các phase vẫn pending” không còn áp dụng. Phần Việt hóa dùng dữ liệu sẵn có đã được triển khai và kiểm chứng cục bộ trong worktree `CamNangTQCCL-season-team-lookup` ở phiên cập nhật này, chưa commit hoặc deploy. Hướng dẫn bảo trì bản dịch nằm tại `docs/season-team-data.md` trong worktree đó. Bản brainstorm ghi quyết định và tiêu chí, không thay thế bằng chứng phát hành.
