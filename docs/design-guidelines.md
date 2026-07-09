# Design Guidelines

## Hướng UI

Site đang đi theo hướng dashboard tĩnh, nhiều card và badge, ưu tiên đọc nhanh hơn là hiệu ứng.

## Nguyên tắc chính

- Giữ layout rõ, ít lớp, ít nhiễu.
- Dùng tiếng Việt ngắn cho label, button, badge.
- Giữ các section tách bạch: `Team PK`, `Cùng Tồn`, `Khai hoang`, `Tra cứu chiến pháp`, `Soi đội từ ảnh`, `Gợi ý đội từ kho`.
- Với tracker cá nhân như `Theo dõi chiêu mộ`, ưu tiên form/slot/action nhỏ gọn hơn dashboard trang trí.
- Tránh style "mặc định framework" nếu không cần.
- Giữ khả năng đọc tốt trên mobile trước, desktop sau.

## Pattern hiện có

| Pattern | Dùng ở đâu |
|---|---|
| Card grid | Team PK, Cùng Tồn, Khai hoang |
| Badge / chip | Loại binh, phe, sao, trạng thái, chiến pháp |
| Combo search | Tướng, chiến pháp, binh thư |
| Drawer filter | Mobile filter panel |
| Theme toggle | Light / dark theo `localStorage` + system |
| Slot tracker | Theo dõi chiêu mộ: 4 slot hằng ngày, action rõ `Không ra` / `Ra 5★` |

## Màu và nhãn

- Phe có code màu riêng trong `js/render.js`.
- Trạng thái dùng nhãn ngắn: Meta, Cũ, Youtuber, Tình huống.
- Badge sao, binh, phe phải nhìn nhanh được, không cần mô tả dài.

## Typography / spacing

- Chữ tiêu đề phải rõ hơn nội dung phụ.
- Khoảng cách giữa card, section, và filter phải đủ lớn để quét mắt nhanh.
- Không nhét quá nhiều text vào một dòng nếu có thể tách thành tag hoặc meta nhỏ.

## Mobile

- Filter panel có thể thu gọn thành drawer.
- Button và chip phải đủ dễ bấm bằng ngón tay.
- Bảng / card không nên phụ thuộc hover.
- Khi section không phải `Team PK`, layout nên bung full width.

## An toàn nội dung

- Không đưa dữ liệu thô vào `innerHTML`.
- Ảnh soi đội phải có alt text và disclaimer rõ.
- Nếu thêm text mới, tránh dùng từ mơ hồ; ưu tiên thông báo trạng thái ngắn.

## Với tính năng Soi đội

- Phải nói rõ ảnh đi qua Worker / DashScope.
- Phải báo khi cấu hình chưa xong.
- Kết quả nhận diện nên gắn cờ nếu độ tin thấp.
- Danh sách team giống nên hiển thị theo mức trùng để user tự kiểm tra.

## Với tính năng Gợi ý đội từ kho

- Bắt buộc có bước review scan trước khi recommend.
- Phân biệt rõ `Portfolio sau khi build` và `Nên thêm` khi user đã có team khóa.
- Không dùng wording làm user hiểu AI đang tự nghĩ đội; chọn team là engine local dựa trên data đã curate.

## Không nên làm

- Không đổi palette sang kiểu generic không liên quan.
- Không làm nhiều motion nếu không có lý do.
- Không đổi sang layout nặng tay chỉ vì "trông hiện đại".
- Không giấu dữ liệu thật sau tương tác quá nhiều bước.

## Kết luận

Design của repo nên giữ 3 chữ: nhanh, rõ, gọn. Nếu thêm style mới, phải giữ được khả năng scan dữ liệu và khả năng dùng trên mobile.
