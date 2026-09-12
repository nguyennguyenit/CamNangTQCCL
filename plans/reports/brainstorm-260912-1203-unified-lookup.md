# Brainstorm đã chốt — Bộ tra cứu thống nhất

Ngày: 2026-09-12. Trạng thái: **Accepted** — người dùng xác nhận “OK chốt brainstorm”.
Đây là quyết định sản phẩm để bàn giao lập plan, chưa phải bằng chứng triển khai.

## Outcome

Một bộ tra cứu tiếng Việt thống nhất từ dữ liệu hiện có và snapshot
`data/sgsdeck/`, bao phủ tướng, chiến pháp, trang bị/đặc kỹ, kỹ năng quân sư,
cải tạo binh chủng và công trình/cấp nâng cấp.

Người dùng tìm một thực thể và xem một hồ sơ. Giao diện không hiện tên nguồn,
URL nguồn hoặc yêu cầu chọn nguồn. Thông tin mùa/điều kiện chỉ hiện khi ảnh
hưởng cách dùng. Thông tin nguồn giữ nội bộ để bảo trì và đối chiếu.

## Quy tắc hợp nhất đã được người dùng quyết định

1. Xác nhận cùng thực thể và đúng biến thể trước khi ghép. Bản thường, SP, CO
   và 40Y giữ riêng. Chuyển giản thể/phồn thể là bước tìm ứng viên, không phải
   bằng chứng duy nhất để tự ghép mọi bản ghi.
2. Giữ tên Việt và ID hiện có đối với thực thể đã tồn tại. Dịch/chuẩn hóa tên
   Việt cho thực thể mới, không tạo bản trùng chỉ vì tên nguồn viết khác.
3. **Ưu tiên giá trị SGSDeck khi hai bộ khác nhau**, vì người dùng xác định
   bộ hiện tại đã cũ. Áp dụng theo trường dữ liệu sau khi xác nhận danh tính.
4. SGSDeck thiếu trường, để trống hoặc ghi “chờ bổ sung” thì giữ thông tin
   hiện có. Không ghi đè thông tin thật bằng placeholder; không coi số 0 là
   thiếu dữ liệu nếu đó là giá trị hợp lệ.
5. Ví dụ đã chốt: Hạ Hầu Đôn dùng thích tính Khiên **S** theo SGSDeck khi hợp
   nhất. Cả 11 khác biệt đã thống kê xử lý theo cùng quy tắc, không hỏi lại
   người dùng để chọn từng giá trị.
6. Dịch thông tin còn thiếu sang tiếng Việt; giữ đúng số liệu, đối tượng tác
   động, điều kiện kích hoạt, thời gian hiệu lực và quan hệ giữa các mục.
7. Nếu cả hai bộ đều thiếu thông tin, hiển thị “Đang cập nhật”; không bịa nội
   dung để tạo cảm giác đầy đủ.

Quy tắc ưu tiên SGSDeck thay thế đề xuất trước đây “giữ giá trị local đến khi
xác minh phiên bản”. Chọn nguồn ưu tiên là quyết định sản phẩm; không tự suy
ra mọi mùa hoặc mọi biến thể có cùng điều kiện sử dụng.

## Trách nhiệm kiểm tra và constraints

- Agent thực hiện đối chiếu tiếng Trung, Việt hóa và kiểm chứng. Người dùng
  không cần biết giản thể/phồn thể hoặc tự kiểm từng cặp dữ liệu.
- Kiểm tra trong từng bước: danh tính/biến thể → hợp nhất theo trường → bản
  dịch/quan hệ → kiểm thử dữ liệu và các chức năng sử dụng dữ liệu.
- Nếu có điều chưa thể xác định, giải thích bằng tiếng Việt. Chỉ nhờ người
  dùng khi cần thông tin thực sự không thể tìm được, chẳng hạn thông tin
  nhìn thấy trong game của họ; không mở lại quy tắc ưu tiên đã chốt.
- Tạo bản hợp nhất để kiểm tra; kiểm tra đạt mới tích hợp vào giao diện.
  Giữ khả năng khôi phục bộ đang dùng và bảo toàn WIP không liên quan.
- Bám Astro/vanilla JS, Python pipeline và JSON hiện có. Giữ tương thích ID,
  soi đội, gợi ý từ kho, tracker và MCP; thay đổi contract nếu cần phải được
  xác định cụ thể trong plan và kiểm thử các consumer liên quan.

## Công việc bàn giao vào plan

[Báo cáo đối chiếu](analysis-260912-1142-unified-lookup.md) và
[bảng chi tiết](analysis-260912-1142-unified-lookup.json) ghi bằng chứng đầu vào:

- 338 cặp tên tiềm năng: 79 liên kết đã review và **259 ứng viên mới** gồm
  73 tướng + 186 chiến pháp. Review danh tính trước khi promote mapping.
- **11 khác biệt** ở sáu chỉ số gốc/năm thích tính chung: áp dụng SGSDeck theo
  quyết định mới, kiểm output có đúng giá trị và đúng hồ sơ.
- 14 chiến pháp hiện tại chưa ghép; 90 tướng và 167 chiến pháp SGSDeck chưa
  ghép theo phép chuẩn hóa tên. Xử lý danh tính/tên Việt; các số này chưa phải
  số lượng thực thể mới đã xác minh.
- Việt hóa phần thiếu; nối quan hệ và tổ chức bốn danh mục bổ sung. Giữ đầy
  đủ đặc kỹ, lựa chọn cải tạo và cấp công trình; không đoán liên kết còn thiếu.
- 37 mô tả chiến pháp SGSDeck chỉ có placeholder: dùng thông tin hiện tại nếu
  có, nếu không thì trạng thái cập nhật.

Đây là backlog triển khai, không phải các câu hỏi yêu cầu người dùng đọc
tiếng Trung hoặc các quyết định sản phẩm còn bỏ ngỏ.

## Acceptance criteria

- [ ] Một hồ sơ cho mỗi thực thể/biến thể; giữ ID và tên Việt đang dùng.
- [ ] Mọi bản ghi đầu vào được kiểm kê: đã ghép, thực thể mới hoặc chưa xác
  định; không mất bản ghi âm thầm hoặc hợp nhất bằng fuzzy không kiểm tra.
- [ ] Giá trị SGSDeck được ưu tiên đúng trường; cả 11 khác biệt có kiểm chứng
  output. Thiếu/placeholder không xóa dữ liệu thật của bộ hiện tại.
- [ ] Sáu nhóm tra cứu có tên/nhãn/mô tả tiếng Việt theo nội dung có được;
  dữ kiện chưa có hiện trạng thái cập nhật, không invent nội dung.
- [ ] Không hiện nguồn trên giao diện; metadata nội bộ đủ để tái lập cách
  hợp nhất và cập nhật về sau.
- [ ] Không trùng sai biến thể, không có liên kết giả; số liệu, điều kiện và
  bản dịch được đối chiếu trong lúc làm, rồi kiểm tra tổng thể.
- [ ] Kiểm thử phù hợp cho pipeline, tra cứu, soi đội, gợi ý kho, tracker và
  contract MCP đạt; build/check liên quan đạt trước khi nghiệm thu tích hợp.

## Non-goals và quan hệ với plan mùa

- Không triển khai/cook, commit hoặc deploy trong lượt chốt brainstorm này.
- Không nhập cấu hình Recommended, thay tier/điểm đội hoặc triển khai bộ chọn
  mùa trong plan hợp nhất danh mục. Các phần này do
  [plan mùa](../260907-0233-season-team-lookup/plan.md) sở hữu.
- Giữ nguyên quyết định hiện có về điểm đội của plan mùa; yêu cầu không hiện
  nguồn ở đây áp dụng cho bộ tra cứu danh mục, không tự đổi contract điểm/MCP.
- Phase 1 và phần dùng corpus hiện tại ở Phase 2 plan mùa có thể triển khai
  độc lập. Cấu hình dùng thực thể mới cần mapping tương ứng; phối hợp owner
  khi chạm chung dictionary, identity, app/render hoặc public manifest.

## Bước tiếp theo và câu hỏi còn mở

Lập plan triển khai riêng cho hợp nhất danh mục, kế thừa nguyên văn các quyết
định trên và ghi các dependency cụ thể với plan mùa. Không còn câu hỏi sản
phẩm chặn lập plan. Chưa có bản dữ liệu hợp nhất hoặc thay đổi giao diện.
