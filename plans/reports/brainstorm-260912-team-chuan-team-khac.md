# Brainstorm đã chốt: Team chuẩn và Team khác theo mùa

Ngày: 2026-09-12. Trạng thái: đã chốt hướng sản phẩm, bổ sung quyết định Việt hóa Team chuẩn. Trạng thái triển khai và bằng chứng xem plan cùng tài liệu thực hiện bên dưới; không đồng nghĩa đã deploy.

Tài liệu này tập hợp các quyết định của người dùng trong cuộc trao đổi, ưu tiên quyết định mới nhất. Đây là điểm tra cứu chung về sản phẩm; các bước thực hiện và kiểm thử nằm trong [plan chính](../260912-0950-recommended-season-browser/plan.md). Không tạo thêm plan triển khai.

## Mục tiêu

Người chơi duyệt đội hình theo mùa/kịch bản, xem các team SGSDeck Recommended theo Tier và tìm những cấu hình khác đang có trên website. Ngay trên thẻ đội phải thấy tướng, chiến pháp và binh thư; mở đội sẽ đọc được mô tả cụ thể.

## Các hướng đã cân nhắc và lựa chọn cuối cùng

| Hướng | Kết luận |
|---|---|
| Recommended chỉ giới thiệu mùa mới; Team PK tổng hợp tất cả mùa | Không chọn. |
| Một danh sách Recommended cho các mùa, có bộ lọc mùa; bỏ nhãn Team PK và Meta cũ | Chọn làm hướng chính, sau đó bổ sung mục riêng cho cấu hình khác. |
| Hai tab cuối cùng: Team chuẩn và Team khác | Đã chốt tên và phạm vi bên dưới. |

Không dùng các tên Đội cộng đồng hoặc Đội đề cử. Recommended đổi tên hiển thị thành **Team chuẩn**; phần đội khác đổi thành **Team khác**.

## Hai tab và nguồn dữ liệu

| Nội dung | Team chuẩn | Team khác |
|---|---|---|
| Phạm vi | Các cấu hình thuộc SGSDeck Recommended, qua các mùa nguồn | Các cấu hình khác Team chuẩn theo tướng + chiến pháp |
| Dữ liệu ban đầu | Dữ liệu Recommended được thu thập và đối chiếu nguồn | Các team/biến thể đã có sẵn trên website, sau khi loại trùng |
| Bổ sung về sau | Cập nhật theo Recommended | Tổng hợp research hoặc chiến báo của người chơi, có ghi nguồn và đối chiếu trùng trước khi đưa vào |
| Điểm và Tier | Giữ đúng điểm và Tier của cấu hình nguồn | Không tự gán điểm/Tier SGSDeck từ một đội gần giống |

**Quyết định mới nhất:** đợt đầu Team khác không cần bổ sung research hoặc chiến báo mới cho từng team có sẵn. Giữ nguồn đã biết; thiếu nguồn thì ghi **“Nguồn chưa xác định”**. Không mô tả các team này là đã có chiến báo nếu dữ liệu không chứng minh điều đó.

Ghi chú ban đầu của Team khác: **“Các đội có sẵn, đã đối chiếu với Team chuẩn.”** Với các bản ghi sau này thực sự có nguồn tương ứng, dùng ghi chú **“Tổng hợp từ dữ liệu research và chiến báo của người chơi.”**

SGSDeck có cả mục người chơi chia sẻ. Một đội được đăng trên SGSDeck không tự động thuộc Team chuẩn; phải phân biệt Recommended với bài chia sẻ của người chơi. Bài chia sẻ có thể là nguồn bổ sung Team khác sau khi kiểm tra, không tự động nhập toàn bộ.

Người dùng đã xác nhận quyền lưu và hiển thị cấu hình/điểm Recommended trên website này. Không mở lại câu hỏi quyền import chỉ vì phạm vi ban đầu từng đề cập sáu catalog private.

## Cách thu thập đã chốt

**Python là cách thu thập chính; browser dùng để xác minh và hỗ trợ trường hợp HTML tải trực tiếp chưa đủ.** Crawler chạy lúc cập nhật dữ liệu, không chạy khi người dùng mở website.

Luồng: Python đọc danh sách mùa/danh mục → tải danh sách đội → tải từng chi tiết → lưu HTML cùng URL, thời điểm và checksum → parser offline → đối chiếu danh tính/cấu hình → xuất một bộ dữ liệu đồng bộ cho hai tab. Có giới hạn tốc độ, thử lại có giới hạn và tiếp tục từ bản lưu sau khi gián đoạn.

[Thử nghiệm HTTP bằng Python](../260912-0950-recommended-season-browser/reports/python-acquisition-probe.md) đã đọc được danh sách S28 với 93 đội và một chi tiết với 3 tướng, 6 chiến pháp, 9 binh thư. Đây là bằng chứng khả thi trên hai trang, không phải xác nhận đã thu đủ mọi mùa. Browser không phải bước bắt buộc cho từng đội nếu HTTP đã trả dữ liệu đầy đủ và kiểm tra đạt.

## Quy tắc xét trùng

Tiêu chí người dùng chốt là **3 tướng + chiến pháp**. Cách áp dụng đã được cụ thể hóa trong plan và tham vấn Kongming:

| Trường hợp | Kết quả đối chiếu |
|---|---|
| Cùng đúng biến thể 3 tướng và các chiến pháp gắn với từng tướng | Trùng |
| Chỉ đổi thứ tự hiển thị tướng hoặc thứ tự hai ô chiến pháp trên cùng tướng | Vẫn trùng |
| Chỉ khác binh thư, điểm cộng, trang bị, mô tả, vai trò chủ tướng, mùa, điểm hoặc Tier | Vẫn trùng theo tiêu chí phân nhóm này; vẫn giữ chi tiết cấu hình gốc |
| Cùng 3 tướng nhưng đổi chiến pháp, hoặc chuyển chiến pháp sang tướng khác | Cấu hình khác |
| Đổi tướng thường thành SP/CO/40Y | Khác danh tính tướng; không gộp nhầm |
| Thiếu hoặc chưa xác định chắc tướng/chiến pháp | Chưa đủ căn cứ kết luận không trùng; cần xử lý riêng |

Đối chiếu trên toàn bộ tập Team chuẩn đã thu thập và xác nhận, trước khi áp dụng bộ lọc mùa. Chọn một mùa khác không biến đội trùng thành Team khác. Nếu một team cũ có nhiều phương án, chỉ loại phương án trùng và giữ phương án khác có dữ liệu xác định; không tự sinh các tổ hợp chưa có trong nguồn.

Quy tắc này quyết định đội xuất hiện ở tab nào, không khẳng định các cấu hình khác chủ tướng/binh thư/trang bị có hiệu quả chiến đấu giống nhau. Các bản ghi Team chuẩn vẫn giữ riêng mùa, mô tả và cấu hình nguồn. Khi nguồn Team chuẩn cập nhật, phải đối chiếu lại danh sách Team khác.

## Giao diện và bộ lọc

- Giữ phong cách giao diện của website mình. Bộ lọc nào đã có và đáp ứng yêu cầu thì giữ lại; không làm lại chỉ để giống SGSDeck.
- Bổ sung bộ chọn mùa có tìm kiếm và nhóm mùa như ảnh tham chiếu; hiển thị tên/mã mùa, tình trạng và số lượng khi nguồn có thông tin.
- Team chuẩn phục vụ các mùa, không giới hạn ở mùa mới hoặc riêng Binh Diễn Xuân Thu. Giữ các phân loại phù hợp từ nguồn như PK, Khai hoang, Khí giới và bộ lọc phe, binh chủng, Tier, nhóm đội.
- Không hiển thị bộ lọc **“Phiên bản luật”** trong luồng duyệt này. Mùa/kịch bản là cách người dùng chọn phạm vi đội muốn xem.
- Chia kết quả theo Tier và xếp từ trên xuống. Không có bộ lọc điểm hoặc điều khiển chọn cách sắp xếp. Quy tắc trong plan: thứ tự Tier của nguồn, điểm giảm dần trong cùng Tier, rồi thứ tự nguồn ổn định; không suy Tier từ điểm.
- Thẻ đội hiển thị 3 tướng cùng chiến pháp và binh thư. Khi mở đội, hiện mô tả, cấu hình, điểm cộng, đặc điểm/điều kiện và nguồn khi dữ liệu có; không bịa phần còn thiếu.
- Mùa chưa có dữ liệu, danh mục rỗng và không có đội khớp bộ lọc cần thông báo phù hợp. Team chưa rõ mùa không tự gán vào một mùa cụ thể.
- Nhãn Team PK và Meta cũ được thay bằng hai tab mới; giữ dữ liệu, ID và khả năng truy cập liên kết cũ. Đội trùng không được lọt vào danh sách Team khác qua liên kết cũ.

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

- Tab Khai hoang hiện có vẫn duy trì dữ liệu mới nhất như trước. Khai hoang trong Recommended là nội dung tham khảo theo mùa nguồn riêng.
- Giữ nguồn, khu vực và cấu hình chính xác. Điểm/Tier nguồn không tự biến thành đánh giá Global/VN hoặc khả năng dùng đội ở mọi mùa.
- Bỏ bộ lọc luật khỏi giao diện duyệt không đồng nghĩa bỏ kiểm tra nội bộ của các tính năng gợi ý đội, so kho hoặc MCP.
- Chưa xây tính năng người dùng tự đăng bài, upload chiến báo, tài khoản, bình chọn hay kiểm duyệt. Việc nhắc đến đội người chơi chia sẻ là hướng bổ sung dữ liệu có nguồn.
- Không tự xóa dữ liệu đội cũ hoặc WIP; không coi bản brainstorm là bằng chứng đã triển khai hay triển khai lên website.

## Tiêu chí nghiệm thu

- [ ] Hai tab hiển thị đúng tên Team chuẩn và Team khác.
- [ ] Team chuẩn có dữ liệu nguồn thật theo mùa, nhóm Tier và thứ tự đúng; không có bộ lọc luật/điểm.
- [ ] Team khác ban đầu hiển thị các cấu hình có sẵn đã xác định không trùng, không chặn chỉ vì thiếu chiến báo mới.
- [ ] Đối chiếu đúng chiến pháp theo từng tướng; chỉ khác binh thư không tạo đội mới; không làm mất phương án khác của cùng team.
- [ ] Bộ lọc hiện có được giữ phù hợp, có thêm chọn mùa; thẻ có chiến pháp/binh thư và chi tiết đọc được trên desktop/mobile.
- [ ] Nguồn thiếu được ghi rõ; không gán nhầm điểm/Tier hoặc mùa; các liên kết cũ và tính năng liên quan vẫn hoạt động.
- [ ] Python thu đủ phạm vi mùa/danh mục đã kiểm kê, chạy tiếp được khi gián đoạn và không xuất bản dữ liệu nửa chừng; browser được dùng khi cần xác minh.

## Tài liệu thực hiện và trạng thái bằng chứng

- **Plan chính duy nhất:** [260912-0950-recommended-season-browser](../260912-0950-recommended-season-browser/plan.md), gồm dữ liệu/đối chiếu → giao diện/chi tiết → kiểm thử.
- Phác thảo UI cũ đã được xóa theo yêu cầu ngày 2026-09-12; chỉ dùng plan chính ở trên.
- [Báo cáo browser](../260912-0950-recommended-season-browser/reports/browser-research.md) lưu các quan sát và ảnh nguồn đã kiểm tra ngày 2026-09-12; [bản rà soát quyết định](../260912-0950-recommended-season-browser/reports/decision-review.md) ghi cách áp dụng tư vấn Kongming và thay đổi yêu cầu đầu vào Team khác.

Chưa có câu hỏi sản phẩm cần chốt lại. Plan chính và [báo cáo kiểm chứng triển khai](../260912-0950-recommended-season-browser/reports/validation.md) sở hữu trạng thái của hai tab; nhận định cũ “các phase vẫn pending” không còn áp dụng. Phần Việt hóa dùng dữ liệu sẵn có đã được triển khai và kiểm chứng cục bộ trong worktree `CamNangTQCCL-season-team-lookup` ở phiên cập nhật này, chưa commit hoặc deploy. Hướng dẫn bảo trì bản dịch nằm tại `docs/season-team-data.md` trong worktree đó. Bản brainstorm ghi quyết định và tiêu chí, không thay thế bằng chứng phát hành.
