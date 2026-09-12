# Thiết kế skill tqccl-research

Ngày: 2026-09-07, Asia/Ho_Chi_Minh.
Trạng thái: **đã chốt brainstorm theo yêu cầu người dùng ngày 2026-09-07**; sẵn sàng lập kế hoạch triển khai, chưa tạo skill.

## Hợp đồng đầu ra

- **Kết quả:** skill riêng cho CamNangTQCCL, kế thừa phương pháp `ak:research`, giúp research build team, chiến pháp/cơ chế và xác minh nguồn; trả lời có dẫn chứng và giới hạn áp dụng.
- **Ràng buộc:** dùng SGSDeck làm mốc Sách Giáo Khoa; giữ 233乐园 trong tập nguồn build team đã chọn; xác định mùa từ yêu cầu/ngữ cảnh, không bắt nhập mỗi lượt; phân biệt khu vực và thử nghiệm/live; research loop là luồng chính, engineer loop xử lý thiếu sót quy trình; giữ dữ liệu curated và quy tắc cùng tồn hiện có.
- **Ngoài phạm vi:** crawler, dịch vụ mới, UI, chấm điểm sức mạnh tự động, tự nhập dữ liệu, thay tier, commit hoặc deploy. Research sản phẩm/công nghệ tiếp tục dùng skill tổng quát phù hợp.
- **Hoàn thành triển khai khi:** skill có thể được gọi trong project, chọn đúng nhánh research, kế thừa mùa đúng ngữ cảnh, cập nhật kết luận theo research loop, phân loại đúng trường hợp cần engineer loop, tạo báo cáo theo mẫu, đạt các tình huống kiểm chứng bên dưới và không sửa runtime khi chỉ được yêu cầu research.

## Căn cứ đã đọc

- `ak:brainstorm` v2.6.0: xác định kết quả, so sánh lựa chọn, bàn giao; không triển khai trong bước brainstorm.
- `ak:research` v1.0.0: định phạm vi → tìm nhiều nguồn → đối chiếu → tổng hợp → báo cáo; giới hạn mặc định tối đa 5 tool calls research mỗi chủ đề.
- [Danh mục nguồn project](../../docs/research-sources.md): vai trò từng nguồn và ba trạng thái bằng chứng.
- [Skill cùng tồn hiện có](../../.agents/skills/tqccl-coexist-team-builder/SKILL.md): lọc đội mẫu, tier, tướng/chiến pháp bị khóa và độ đỏ.
- [Quy tắc research/cơ chế hiện có](../../.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md): tìm đa ngôn ngữ và kiểm tra tương tác chiến pháp.
- [Xác minh 233乐园](research-260907-1639-233leyuan-source-validation.md): nguồn cộng đồng được chọn, đánh giá từng bài và từng nhận định.

Đây là thiết kế dựa trên tài liệu project và quyết định người dùng; không phải lượt kiểm tra lại các website.

## Lựa chọn kiến trúc

| Cách | Lợi ích | Giả định chính | Điểm dễ thất bại |
| --- | --- | --- | --- |
| Wrapper gọi bắt buộc `ak:research` | Ít nội dung mới | Mọi môi trường có đúng skill tổng quát | Thiếu skill toàn cục; template công nghệ lấn nội dung game |
| **Skill chuyên biệt tự đủ hướng dẫn — đã chọn** | Giữ phương pháp research, có hợp đồng riêng cho game | Danh mục nguồn project được duy trì | Trùng quy tắc nếu sao chép danh mục/logic cùng tồn vào nhiều nơi |
| Gộp hết vào skill cùng tồn | Một điểm gọi | Mọi research đều phục vụ cùng tồn | Xác minh website hoặc khai hoang bị áp sai ràng buộc đội khóa/tier |

Chọn cách thứ hai. Kế thừa phương pháp của `ak:research`, không phụ thuộc bắt buộc vào cài đặt toàn cục và không sao chép nguyên các phần CVE, API, hiệu năng phần mềm.

## Ba nhánh sử dụng

| Nhánh | Đầu vào điển hình | Đầu ra bắt buộc |
| --- | --- | --- |
| Build team | Bộ ba tướng, khai hoang trước/sau cấp 20, PK, mùa hoặc Global | Mẫu SGSDeck nếu có; cấu hình từ nguồn; khác biệt/điều kiện; chiến pháp, binh thư, điểm và tốc độ khi có bằng chứng |
| Chiến pháp và cơ chế | Tên chiến pháp, cách tương tác, thay chiến pháp | Danh tính chính xác, người mang/đối tượng hưởng, điều kiện kích hoạt, giới hạn phiên bản và phần chưa xác minh |
| Xác minh nguồn | URL bài hoặc website | Đúng game/khu vực, nội dung thực đọc được, ngày, nguồn gốc, vai trò research và giới hạn sử dụng |

Nhận diện từ câu yêu cầu; không cần viết bộ phân tích cờ hay thêm giao diện.

## SGSDeck là “Sách Giáo Khoa”

Đây là quyết định người dùng, không phải suy luận từ độ phổ biến của website.

1. Khi research đội, tìm đúng mẫu SGSDeck theo tướng, mùa/kịch bản và binh chủng làm mốc.
2. Giữ nguyên cấu hình nguồn làm bản chuẩn; ghi URL và thời điểm đọc. Không ghép các lựa chọn thành tổ hợp chưa được nguồn đề xuất.
3. Các nguồn khác có thể xác nhận bản chuẩn, cung cấp biến thể hoặc đề xuất phương án thay thế. Báo cáo chỉ rõ khác tướng/chiến pháp/chủ tướng/binh thư/tốc độ và lý do nếu nguồn giải thích.
4. Nếu không có hoặc không đọc được mẫu phù hợp, ghi “chưa có mốc SGSDeck đã xác minh”. Vẫn research tiếp và giữ cấu hình dưới nhãn nguồn của nó.
5. Chuẩn tham chiếu không đồng nghĩa đã chứng minh thắng tốt nhất hoặc tương thích mọi server. Tách vai trò Sách Giáo Khoa khỏi trạng thái bằng chứng, tier của nguồn và phạm vi Global.
6. Research không tự ghi đè tier runtime hay ràng buộc chọn đội của skill cùng tồn. Khi bằng chứng khác bản chuẩn, trình bày khác biệt và điều kiện, không âm thầm đổi mốc project.

## Xác định mùa và server

Tên mùa không phải đầu vào bắt buộc mỗi lượt. Thứ tự xử lý:

1. Người dùng chỉ định mùa/server trong yêu cầu → dùng phạm vi đó, ghi đè ngữ cảnh cũ.
2. Yêu cầu không chỉ định nhưng hội thoại đã chốt → kế thừa và nêu rõ trong báo cáo. Tại thời điểm chốt brainstorm, mùa đang bàn là Binh Diễn Xuân Thu; không hardcode thành mặc định vĩnh viễn trong skill.
3. Chưa có ngữ cảnh → vẫn tìm bộ khung/mẫu SGSDeck và giữ mùa của từng nguồn. Chỉ hỏi khi thiếu mùa/server làm thay đổi cấu hình hoặc kết luận cần trả lời, chẳng hạn đánh giá sức mạnh hiện tại hay cơ chế riêng của kịch bản.

Báo cáo ghi phạm vi là **người dùng chỉ định**, **kế thừa hội thoại** hoặc **chưa xác định**. Không tự lấy mùa trên website hay ngôn ngữ bài làm mùa/server của người dùng. Yêu cầu tìm nhiều mùa được giữ thành nhiều phạm vi riêng.

## Quy trình research

1. **Chốt phạm vi:** lấy mục tiêu từ yêu cầu, xác định mùa/server theo thứ tự trên, tra repo để nhận diện tên tướng/chiến pháp, SP và các phiên bản đặc biệt. Hỏi chỉ khi thông tin còn thiếu làm thay đổi kết luận. Có thể tiếp tục phần độc lập trong lúc chờ.
2. **Đọc hồ sơ và nguồn sở hữu:** tìm research cũ theo tên gốc, biệt danh và roster; đọc các đính chính/ghi chú quyết định liên quan rồi đối chiếu runtime hiện tại. Phân biệt kết luận còn dùng được, đã được sửa và cần kiểm chứng lại; không ưu tiên một ghi chú chỉ vì ngày mới hơn khi thiếu bằng chứng. `docs/research-sources.md` là nơi duy nhất quản lý vai trò và trạng thái sử dụng website. Dữ liệu local cho biết cấu hình đang có, không phải bằng chứng độc lập cho cơ chế game.
3. **Lập lượt tìm:** tìm mẫu SGSDeck cho đội; chọn các nguồn bổ sung phù hợp và từ khóa tên gốc. Ưu tiên nguồn đúng khu vực/kịch bản; đa ngôn ngữ khi hữu ích, không bắt buộc tìm đủ mọi ngôn ngữ.
4. **Đọc bằng chứng:** mở bài cụ thể; phân biệt tiêu đề/snippet, nội dung bài, ảnh thực đọc và chiến báo. Ghi ngày gốc, ngày đăng lại nếu biết, ngày truy cập, khu vực, mùa, thử nghiệm/live, tác giả và nhãn AI/đăng lại.
5. **Đối chiếu:** kiểm tra tên và điều kiện chiến pháp, đội trước/sau thức tỉnh, binh chủng, thứ tự tốc độ và mục tiêu hưởng. Nêu rõ thông tin quan sát được, nhận định tác giả và suy luận của agent.
6. **Tổng hợp:** bảng chuẩn SGSDeck → cấu hình/biến thể khác → khác biệt → điều kiện áp dụng → bằng chứng. Không ép nhãn biến thể nếu đội khác hoàn toàn hoặc không có mốc phù hợp.
7. **Trả lời và lưu:** kết luận tiếng Việt trước, báo cáo Markdown trong `plans/reports/` theo naming của phiên; ghi điều thay đổi so với kết luận cũ, liên kết hồ sơ liên quan và phần chưa giải quyết để lượt sau đọc tiếp. Chỉ đưa đề xuất cập nhật dữ liệu runtime khi người dùng yêu cầu.

## Research loop và engineer loop

**Research loop là luồng chính:** đọc kết luận trước → xác định khoảng trống hoặc nhận đính chính → tìm/đối chiếu bằng chứng → cập nhật kết luận đúng phạm vi → lưu liên kết và phần còn thiếu → dùng ở lượt research tiếp theo. Loop hoạt động trong nhiệm vụ đang được yêu cầu, theo ngân sách nghiên cứu; không tự chạy nền hoặc mở vô hạn lượt tìm mới.

Mỗi đính chính ghi ngắn: nhận định cũ, bằng chứng mới, phạm vi áp dụng, kết luận thay thế và nơi lưu. Giữ lịch sử có ngày; không xóa dấu vết khiến lượt sau không biết vì sao kết luận thay đổi. Thêm biến thể, đổi patch hoặc có chiến báo mới thường cập nhật hồ sơ kiến thức, không cần sửa skill.

**Engineer loop xử lý cách research:** khi có bằng chứng quy trình thiếu hoặc sai → tái hiện vấn đề → đề xuất sửa hướng dẫn/checklist → thử case từng sai và case vốn đúng → chỉ nhận thay đổi khi sửa được lỗi mà không phá hành vi đúng. Đây là nhánh bảo trì skill theo phạm vi công việc được giao; một yêu cầu research không tự cho phép agent sửa skill.

| Nguyên nhân | Nơi xử lý |
| --- | --- |
| Bằng chứng game mới hoặc thay đổi patch | Hồ sơ team/cơ chế, có mùa và nguồn |
| Thiếu/sai quy tắc, ví dụ trộn chiến pháp hai build | Engineer loop: hướng dẫn skill và case kiểm chứng |
| Bỏ sót bước đã được hướng dẫn, ví dụ chưa xem bảng đầu video | Sửa kết quả và kiểm tra việc thực hiện; không mặc nhiên thêm quy tắc |
| Kho tướng/chiến pháp hoặc lựa chọn riêng của tài khoản | Ngữ cảnh tài khoản có phạm vi, không áp cho mọi người |
| Quyết định project, ví dụ SGSDeck là Sách Giáo Khoa | Tài liệu sở hữu quyết định; loop giữ nguyên cho đến khi người dùng thay đổi |
| Nguồn không truy cập được hoặc đầu vào thiếu | Ghi giới hạn và đầu mối cần bổ sung, không biến thành kiến thức game |

Bản đầu dùng báo cáo và file trong repo; không thêm scheduler, dịch vụ learning riêng hoặc hệ thống tự sửa skill. Không cập nhật bộ nhớ toàn cục của agent thông qua loop này.

### Ngân sách nghiên cứu

Kế thừa mặc định tối đa **5 lần gọi công cụ nghiên cứu bên ngoài cho mỗi chủ đề đã chốt**, gồm tìm kiếm, mở trang, đọc ảnh hoặc thao tác trình duyệt lấy bằng chứng. Tôn trọng giới hạn thấp hơn của người dùng; chỉ tăng khi người dùng chỉ định rõ. Có thể gộp truy vấn độc lập trong một lần gọi theo khả năng công cụ, không chia chủ đề giả để lách ngân sách.

Đọc file local không tính là external research. Theo dõi số lượt trong báo cáo. Hết ngân sách thì trả phần đã kiểm chứng cùng khoảng trống; không biến kết quả chưa đủ thành kết luận chắc chắn. Trang nhiều ảnh/đăng nhập là trường hợp dễ thiếu bằng chứng trong giới hạn này.

### Quy tắc bằng chứng

- Dùng đúng ba trạng thái trong danh mục nguồn: **Đã đối chiếu**, **Phương án từ nguồn**, **Chưa xác minh**, gắn theo nhận định.
- Hai trang đăng lại một bài không phải hai nguồn độc lập. Nhãn AI là thông tin nguồn gốc, không tự chứng minh toàn bài sai.
- Không xem cùng số mùa giữa CN/TW/JP/Global là cùng nội dung. Ghi thiếu bằng chứng Global khi chỉ có nguồn khu vực khác.
- Không suy ra tỷ lệ thắng hoặc tổn thất trung bình từ tiêu đề, ảnh chưa đọc hay vài chiến báo chọn lọc.
- Không đoán tên Việt khi chưa ánh xạ được; giữ tên gốc và ghi thiếu ánh xạ.
- Không trộn chiến pháp của nhiều phiên bản/nguồn thành một build rồi gắn nguồn cho cả đội.
- Bài mới không tự làm mới cấu hình cũ; nguồn lịch sử vẫn có ích khi câu hỏi đúng mùa đó.

## Gói skill đã chốt

```text
.agents/skills/tqccl-research/
  SKILL.md
  agents/openai.yaml
  references/evidence-and-region-rules.md
  references/report-template.md
```

- `SKILL.md`: mô tả trigger, ba nhánh, xác định mùa, research loop, điểm chuyển engineer loop, ngân sách, đọc danh mục nguồn và ranh giới cập nhật dữ liệu.
- `agents/openai.yaml`: tên hiển thị và prompt gọi skill theo mẫu local.
- `evidence-and-region-rules.md`: tiêu chí bằng chứng, phạm vi khu vực/mùa và phân loại đính chính; tham chiếu checklist cơ chế hiện có thay vì sao chép.
- `report-template.md`: kết luận, phạm vi và cách xác định mùa, mốc SGSDeck, cấu hình/khác biệt, bảng nhận định và URL/media, kết luận cũ/đính chính, giới hạn và bước tiếp theo. Bỏ các mục không áp dụng cho nhánh xác minh nguồn.

Không thêm scripts ở bản đầu. Dùng đường dẫn tương đối theo thư mục skill/repo, tránh hardcode `/Users/...`.

## Phối hợp với skill cùng tồn và cập nhật dữ liệu

- `tqccl-research` sở hữu việc thu thập/đối chiếu bằng chứng, bao gồm đội chưa có trong catalog.
- `tqccl-coexist-team-builder` tiếp tục sở hữu việc chọn đội mẫu theo tier, kho, tướng/chiến pháp khóa và độ đỏ; dùng báo cáo research để lý giải lựa chọn.
- Khi triển khai, thêm liên kết từ workflow research của skill cùng tồn sang skill mới; giữ checklist cơ chế dùng chung ở vị trí hiện có, tránh sao chép và vòng gọi đệ quy.
- “Research team X” chỉ tạo câu trả lời/báo cáo. “Research và bổ sung team X” bao gồm bàn giao thực hiện theo quyền đã cấp, nêu rõ file dữ liệu và kiểm tra liên quan; không yêu cầu lại phê duyệt đã có.
- Không chạy `python3 -m pipeline.build_json` để nhập bổ sung; cần chỉnh phần dữ liệu curated phù hợp và bảo toàn variants. Không gán tier canonical chỉ từ bài cộng đồng.

## Kiểm chứng khi triển khai

| Tình huống | Kết quả đạt |
| --- | --- |
| SGSDeck có mẫu, 233乐园 đổi một chiến pháp | Giữ bản SGSDeck là Sách Giáo Khoa; chỉ rõ biến thể, nguồn và điều kiện |
| Không tìm thấy mẫu SGSDeck phù hợp | Ghi thiếu mốc; không tự gọi đội cộng đồng là Sách Giáo Khoa |
| Hỏi Global nhưng chỉ đọc được nguồn CN | Ghi phương án khu vực; chưa xác nhận Global |
| Hỏi Lục Tốn – Tả Từ – Trương Xuân Hoa sau 20 | Tách đúng giai đoạn/cấu hình nguồn; chiến pháp thiếu để chưa xác minh |
| Tên chiến pháp chưa có ánh xạ | Giữ nguyên tên gốc, không bịa tên Việt hoặc ID |
| Bài có ảnh chiến báo không truy cập được | Không tuyên bố đã xác minh chiến báo/tỷ lệ thắng |
| Hai bài cùng bản gốc hoặc có nhãn AI | Ghi nguồn gốc và độ độc lập; đánh giá từng nhận định |
| Yêu cầu xác minh 233乐园 hoặc nguồn lịch sử | Giữ vai trò đã chốt, đánh giá bài và thời kỳ cụ thể |
| Yêu cầu cùng tồn có chiến pháp khóa | Bàn giao chọn đội theo skill cùng tồn; không nghiên cứu xong rồi bỏ ràng buộc |
| Hết 5 lượt nhưng bằng chứng còn thiếu | Dừng research ngoài, báo khoảng trống và số lượt đã dùng |
| Chỉ yêu cầu research | Không thay dữ liệu runtime, tier, Git hoặc triển khai |
| Không ghi mùa nhưng hội thoại đã chốt Binh Diễn Xuân Thu | Kế thừa, nêu rõ phạm vi; không hỏi lại |
| Người dùng đổi mùa so với hội thoại cũ | Dùng mùa mới; không giữ mặc định cũ |
| Chưa có mùa, yêu cầu tìm các biến thể | Tìm tiếp và ghi mùa từng nguồn; không bắt nhập mùa chỉ để bắt đầu |
| Có đính chính về cấu hình hoặc patch | Research loop cập nhật kết luận có nguồn/phạm vi; không tự sửa skill |
| Tái hiện được lỗi do thiếu quy tắc research | Phân loại sang engineer loop; thay đổi chỉ được nhận sau case lỗi và case đúng đều đạt |
| Lỗi do bỏ sót bước đã có hoặc nguồn không truy cập | Sửa việc thực hiện/ghi giới hạn; không tự biến thành quy tắc mới |

Kiểm tra cấu trúc skill/frontmatter và liên kết local khi tạo; kiểm thử hành vi bằng các prompt trên và kiểm tra đầu ra thực tế. Không cần chạy toàn bộ test ứng dụng cho riêng thay đổi tài liệu skill.

## Bàn giao

### Bổ sung sau khi đọc lại hồ sơ team — 2026-09-07 19:15

Phạm vi: đọc hồ sơ local và kiểm tra dữ liệu hiện có, không xác minh lại website hay meta live. Các ví dụ sau là bằng chứng để sửa thiết kế skill, không phải khuyến nghị chơi mới.

| Hồ sơ đã đọc | Điều quan sát được | Yêu cầu bổ sung cho skill |
| --- | --- | --- |
| [Chu Thái – Trương Phi – Trương Xuân Hoa](research-260906-1533-chu-thai-truong-phi-truong-xuan-hoa-global.md) | Nguồn S20 và Kazten khác một chiêu của Trương Phi và cách cộng điểm Xuân Hoa; runtime chọn Kazten. Trương Phi chủ tướng dù người dùng gọi Chu Thái đầu tiên. | Ghi rõ lý do chọn bản mặc định; vị trí chủ tướng là dữ kiện riêng, không suy từ thứ tự tên. |
| [Lục Tốn – Tả Từ – Trương Xuân Hoa](research-260906-1554-luc-ton-ta-tu-truong-xuan-hoa-global.md) | Kazten và Dengeki khác cả người mang Tam Thế lẫn bộ chiêu của Tả Từ/Xuân Hoa; runtime giữ bản mặc định và variant riêng. | Thay một chiêu có thể kéo theo đổi nhiều ô; phải giữ nguyên cả cấu hình nguồn và quá trình chuyển chiêu. |
| [Gia Cát Khác – Thái Sử Từ – Tả Từ](research-260906-1347-gia-cat-khac-thai-su-tu-ta-tu.md), [đối chiếu khai hoang](research-260906-1420-khaihoang-cn-global-meta-audit.md) | Không chỉ trước/sau 20: còn quét đất 5, chuẩn bị đất 6, chuyển Trình Phổ sau điện 7. Báo cáo ban đầu nói chưa có đội trong local; hiện runtime đã có đội và hai variants. | Mô tả mốc vận hành/điều kiện chuyển, đối chiếu trạng thái hiện tại trước khi đề nghị thêm đội. Không tái dùng nhận định tồn tại dữ liệu từ snapshot cũ. |
| [SP Chu Tuấn – Hạ Hầu Uyên – Gia Cát Khác](research-260907-1421-khai-hoang-missing-tactics.md) | Hồ sơ đính chính việc bỏ sót bảng đủ sáu chiêu ở 00:10. Chủ tướng trước 20 là SP Chu Tuấn, ở cấp 22 là Gia Cát Khác; thời gian video không theo thứ tự tiến trình chơi. | Lưu timestamp/frame làm bằng chứng, đọc toàn cảnh trước khi nói thiếu; không suy giai đoạn game từ vị trí trong video. |
| [Trương Xuân Hoa – Lữ Bố – Tả Từ](research-260907-1421-khai-hoang-missing-tactics.md) | Ảnh nguồn cho build cấp 32; hai phương án trước 20 do người dùng đề xuất, chưa xác nhận chủ tướng. Điểm 8.0 chưa gắn được với build cụ thể. | Tách người đề xuất và mức kiểm chứng; không hồi suy bộ trước 20 hoặc chuyển điểm đánh giá sang variant khác. |
| [Tào Tháo – Giả Hủ – SP Quách Gia](260709-1816-research-team-5-nguy-ky-tao-thao-gia-hu-sp-quach-gia.md), [ghi chú trao đổi tiếp theo](../../.agents/skills/tqccl-coexist-team-builder/references/chat-context-team-notes.md) | Báo cáo ban đầu nêu Binh Vô Thường Thế và các số sát thương nhưng không lưu URL bài. Ghi chú sau chỉ ra hạn chế tương tác trong setup đã bàn và chuyển hướng sang CO Chân Cơ theo kho. | Không phục hồi khuyến nghị cũ khi chưa đọc đính chính/ràng buộc tài khoản. Phân biệt build của tác giả với bản agent tự điều chỉnh cho cùng tồn; lưu URL cho từng nhận định số liệu. |
| [Chu Du – Lỗ Túc – Trần Dực](260709-0936-research-chu-du-lo-tuc-tran-duc.md), [Bạch Mã hay Toàn Quân](260709-1055-research-lo-tuc-bach-ma-vs-toan-quan.md) | Hồ sơ cũ dùng tier T0.5 của `do-uy-ss18-0` làm căn cứ mạnh; ID này hiện không còn trong `data/teams.json` và `data/team-tier.json`. Bài so sánh suy lựa chọn đứng trước dấu `/` là main. | Không biến tier snapshot đã nghỉ dùng thành tier hiện tại hoặc chuẩn SGSDeck. Thứ tự lựa chọn không tự chứng minh ưu tiên; lập luận hợp cơ chế phải tách khỏi bằng chứng hơn/kém thực chiến. |
| [SP Mã Siêu – Hứa Du – Chu Thiệu](research-260627-2029-team-sp-ma-sieu-hua-du-chu-thieu-variants-report.md) | Báo cáo tự đánh dấu một số tên do model sinh ra là nghi bịa; có phần thay tướng nhưng chưa đủ sáu chiêu chính xác. | Kết quả do model tổng hợp chỉ là đầu mối; xác nhận roster không đồng nghĩa xác nhận full build. |
| [Binh Diễn Xuân Thu Global](research-260825-binh-dien-xuan-thu-global-only.md) | Hồ sơ tự giới hạn là preview; ghi tỷ lệ liên chiến, biến thể binh chủng và thay đổi sau cân bằng. | Ghi đúng tên chỉ số, mẫu/điều kiện nếu biết, phiên bản hiệu ứng binh chủng và patch; không đổi tỷ lệ liên chiến thành tỷ lệ thắng hoặc tier live. |

**Điều chỉnh đầu ra đề xuất:** thêm phần ngắn “Kết luận cũ còn hiệu lực / đã đính chính / cần kiểm chứng lại” khi có hồ sơ trước. Bảng cấu hình ghi từng giai đoạn thực tế, chủ/phó tướng, người mang chiến pháp, mốc chuyển đội và điều kiện tài khoản. Bảng bằng chứng có vị trí trong bài/ảnh/timestamp nếu kết luận phụ thuộc media; phân biệt nguồn ngoài, người dùng và suy luận của agent.

**Kiểm chứng bổ sung:** chạy lại các trường hợp trên khi tạo skill; đặc biệt yêu cầu phát hiện ID đã rút, không phục hồi đề xuất Ngụy Kỵ đã được sửa theo tài khoản, không bỏ sót chủ tướng đổi giai đoạn, không chuyển điểm 8.0 sang hai phương án cá nhân và không suy ưu tiên từ thứ tự dấu `/`. Ngân sách 5 lượt giữ nguyên; media chưa đọc đủ trong ngân sách phải báo thiếu, không tuyên bố đã kiểm tra toàn bộ.

Các hồ sơ chọn đọc chưa cho một phép đối chiếu trực tiếp với mẫu SGSDeck cho từng đội. Vì vậy quyết định SGSDeck là Sách Giáo Khoa được áp dụng từ thiết kế mới; chưa tự đổi nhãn nguồn, cấu hình mặc định hoặc tier của các đội đã research trước đây.

Đã chốt triển khai gói bốn file, tích hợp liên kết nhỏ với skill cùng tồn và xác minh các tình huống trên. Danh mục nguồn đã cập nhật vai trò SGSDeck theo yêu cầu người dùng. Bước tiếp theo là lập kế hoạch và tạo skill theo hợp đồng này; yêu cầu “chốt brainstorm” hoàn tất bản thiết kế, chưa thực hiện bước triển khai hoặc chỉnh dữ liệu game.

Không còn câu hỏi bắt buộc để hoàn thiện thiết kế. Rủi ro cần giữ trong triển khai: giới hạn 5 lượt có thể chưa đủ truy nguyên nguồn/ảnh; danh tính mùa Global phải xác minh theo từng nghiên cứu.
