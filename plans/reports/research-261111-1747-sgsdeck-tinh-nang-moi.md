# sgsdeck.com — tính năng mới có thể bổ sung vào tqccl.com

Scan 2026-11-11, đã đăng nhập (built-in browser). Nguồn chính: `/changelog` (10/03 → 11/10), `/seasons/pk-s27/lineup`, menu Công cụ.

Đối chiếu lại 2026-11-11 18:30: phần mô tả sgsdeck khớp với site thật (changelog, số liệu 配隊計劃, `/siege`, `/buildings/calc`). Cột "tqccl hiện có" đã sửa ở các dòng #1, #2, #3, #9, #11 theo dữ liệu và code trong repo; các dòng đó ghi rõ căn cứ.

## Kết luận

Phần lớn "nguyên liệu" của 配隊計劃 tqccl đã có rời rạc: Khai hoang trước/sau lv20 kèm tuyến chuyển hình, Chạm Sứ, Cùng Tồn, độ phủ kho ở Gợi ý đội. Riêng dữ liệu khắc chế thì mùa hiện tại gần như chưa có (xem #3). Khoảng trống lớn nhất là **gộp chúng thành một lộ trình mùa có badge "ráp được / thiếu N món" theo kho**. Các công cụ tính toán (mô phỏng trận, nội chính) tốn công và rủi ro sai số cao, để sau.

## Đề xuất theo ưu tiên

| # | Tính năng sgsdeck | tqccl hiện có | Đề xuất | Công |
|---|---|---|---|---|
| 1 | **配隊計劃**: wizard 4 bước Khai hoang → 1 đội → 5 đội → khắc chế; khai hoang ghi "chuyển sang đội X" | Khai hoang, Đội chuẩn, Cùng Tồn có ở trang riêng. Tuyến chuyển **đã có**: `guide.transitions` ở 11/17 đội trong `data/khaihoang.json`, hiện ở mục "Chuyển hình" (`js/render.js`); tên đích là chữ tự do ("Uyên Kỵ", "Kỳ Lân Cung"), chưa nối ID Đội chuẩn | Nối tên đích của "Chuyển hình" sang trang Đội chuẩn (S), rồi mới tới trang `/lo-trinh-mua/` theo mùa (M). Không cần trường `transitionTo` mới | S + M |
| 2 | **Badge "可組 / 缺 N 項" trên mọi danh sách** + tóm tắt đầu trang "Khai hoang 0/8, Đội đầu 2/24, Chạm Sứ 0/6"; sort "dễ ráp nhất", lọc "chỉ đội ráp được / thiếu ≤2" | Chỉ có trong Gợi ý đội (Độ phủ kho); danh sách Đội chuẩn/Khai hoang không đọc kho. `roster-coverage.js` chỉ trả "đủ" và "thiếu đúng 1", chỉ nhận đội theo mùa; Khai hoang và Cùng Tồn lưu tên tướng/chiến pháp dạng chữ tự do | Mở rộng `roster-coverage.js` để trả số món thiếu, áp cho Đội chuẩn trước (S–M); Khai hoang và Cùng Tồn cần bước đối chiếu tên → ID (M). Sửa issue #59 (khối Độ phủ kho hiện chữ "null") trước khi dùng lại | S–M / M |
| 3 | **Sơ đồ khắc chế vòng tròn**: 18 đội, 46 câu khắc chế trích nguyên văn có nguồn, bấm 1 đội xem thắng/thua, bấm đội 2 so trực tiếp; không suy diễn trận không có nguồn | Code hiển thị "Khắc chế tốt / Nên tránh" có (`recommended-reference-render.js`) nhưng cả 1640 đội của generation hiện tại có `legacyReferences` rỗng, nên khối này không hiện ở Đội chuẩn. Dữ liệu khắc chế chỉ có ở 53/166 đội cũ (`data/teams.json`): 115 tên chữ tự do, 8 tên khớp tên đội, lẫn nhóm chung như "các loại khiên" | Phải biên tập dữ liệu khắc chế có nguồn cho mùa hiện tại gần như từ đầu, rồi mới vẽ biểu đồ | L (chủ yếu dữ liệu) |
| 4 | **"Các nguồn nói khác nhau"**: đặt hai ý kiến cạnh nhau, không chọn bên; mục "Chờ xác nhận" khi vào game | Có evidence/reviewStatus nội bộ, chưa hiện cho người đọc | Khối hiển thị bất đồng nguồn trên trang đội/mùa | S |
| 5 | **Lưu ý ra quân** (đổi chiến pháp theo đối thủ: địch nhiều Đằng Giáp dùng X, nhiều Cự Mã Cung đổi Y…) | Ghi chú rải trong từng đội | Mục riêng theo mùa | S (chủ yếu dữ liệu) |
| 6 | **Máy tính nâng cấp công trình**: chọn nhiều công trình, cấp hiện tại → cấp đích, cộng tổng tài nguyên + thời gian | **Đã có dữ liệu** 41 công trình × 426 cấp (`costs`, `durationVi`) trong `lookup-catalog.json` | Thêm công cụ thuần client, không cần pipeline mới | S |
| 7 | **Công cụ công thành**: thích tính khí giới SSS…CCC → giá trị công thành, đếm số đội cần cho thành | Chưa có | Công thức đơn giản (S120/A100/B80/C60); cần xác minh cho bản VN | S |
| 8 | **Thêm hàng loạt món thiếu** ("cái thiếu tôi đều có, thêm vào kho một lần") trên trang đội; **dán danh sách tên** vào kho | Có "Tôi có…" từng món, roster picker chọn tất cả, đọc ảnh | Nút "Thêm tất cả món thiếu" + ô dán tên (tận dụng `hanviet`/`match-dict`) | S |
| 9 | **Lịch sử cân bằng** (300+ lần buff/nerf, timeline trên trang tướng/chiến pháp) | Có một phần: 71/412 chiến pháp đã có `lookup.revisions` (69 có ngày hiệu lực), hiện trong hồ sơ Tra cứu. Tướng chưa có; chưa có trang tổng hợp theo thời gian | Trang timeline gom các `revisions` sẵn có (M); phần tướng và các lần chỉnh còn thiếu cần nguồn VN đáng tin | M (+ dữ liệu) |
| 10 | **Tổng quan mùa** (29 mùa, cơ chế kịch bản như 奇謀武略, bản đồ) + "Xem trước" mùa server CN đi trước | Có trang mùa của Đội chuẩn, chưa có trang cơ chế kịch bản | Làm cho mùa hiện tại trước | M–L |
| 11 | **Nội chính** (官職委任): lưu nhiều bộ, tự xếp quan chức tối ưu | Schema `lookup.civil` đã có trên 252 tướng nhưng chỉ 1 tướng có dữ liệu; `civilInnatePoints` trống hết. Chưa có dữ liệu quan chức, chưa có công cụ | Cần dữ liệu quan chức + công thức cộng thưởng; schema tướng dùng lại được | L |
| 12 | **Mô phỏng trận** (170 chiến pháp, 61 binh thư, 48 đặc kỹ; tự nhận khớp ~60% với khắc chế trong bài) | Chưa có | Không nên làm lúc này: tốn công, sai số cao, dễ làm mất uy tín dữ liệu | XL |
| 13 | Xuất PDF "sổ tay phối tướng"; số liệu LIVE trang chủ; tìm kiếm toàn trang (`/search`, tìm cả theo hiệu ứng "giải giới", "viện hộ") | Tra cứu có tìm theo nhóm, chưa có tìm toàn trang | Tìm toàn trang theo hiệu ứng là đáng làm (S–M); PDF/LIVE thấp | — |
| 14 | **Tính sát thương một đòn** (`/simulator`): ma trận 3×3 giữa hai đội theo binh lực, chỉ số, bậc đỏ, khắc binh chủng, hệ số chiến pháp; tách riêng với mô phỏng trận | Chưa có | Cùng rủi ro sai số như #12, để sau | L |
| 15 | **"Dữ liệu sai? Đề xuất sửa"** theo từng trường trên trang tướng/chiến pháp/trang bị/đội, báo lại kết quả cho người gửi; diễn đàn `/forum`; nhãn bậc đỏ của tướng mình trên danh sách đội | Có form góp ý chung ở footer với loại "Thông tin sai" (`js/feedback-kinds.js`), có comment và Đội cộng đồng; chưa có góp ý gắn sẵn mục và trường | Nút "Báo sai" trên trang Tra cứu/đội, điền sẵn mục đang xem vào form góp ý hiện có | S |

## Chạy thử wizard 配隊計劃 khi đã đăng nhập

- Đầu trang: "kho của bạn ráp ngay được: Khai hoang 0/8 · Đội đầu 2/24 · Chạm Sứ 0/6", chọn nhân vật (tài khoản game) "khớp nhất".
- Bước 1: thẻ khai hoang xếp theo số món thiếu; bấm thẻ mở cấu hình trước/sau lv20, cộng điểm, lưu ý, "chờ xác nhận".
- Bước 2: danh sách đội đầu gắn nhãn "Chuyển đổi khuyến nghị" (theo nguồn) và "Dùng lại <tướng>" (tướng của đội khai hoang dùng tiếp được), lọc "chỉ xem chuyển đổi/dùng lại".
- Bước 3: 5 ô đội; mỗi đội ứng viên ghi "trùng <tướng/chiến pháp>" với các đội đã chọn; nút "Tự điền đủ" (ưu tiên đội ráp được), "Áp bộ Cùng Tồn 7 đội / 10 đội". Chiến pháp 拓·/轉· tính riêng với bản gốc. **Gợi ý đội của tqccl đã làm được phần lớn bước này** (portfolio 5 đội, "tranh món").
- Bước 4: phân tích khắc chế **cho cả bộ 5 đội**: đếm "đánh được 3 / cần cẩn thận 7 / thắng thua lẫn lộn 4"; với mỗi đối thủ nguy hiểm, trích câu nguồn và gợi ý "có thể thay vào đội X (nguồn ghi X thắng nó, và không trùng tướng với các đội còn lại)"; đội nào nguồn không nói thì ghi rõ "không đưa vào phân tích".

Điểm đáng học nhất: bước 4 (khắc chế ở cấp bộ đội + gợi ý đội thay thế không trùng món) và bước 2 (nhãn "dùng lại tướng khai hoang"). Cả hai ghép vào Gợi ý đội hiện có được, không cần trang mới. Bước 2 làm được ngay vì `guide.transitions` đã có; bước 4 phải chờ dữ liệu khắc chế của mùa (xem #3).

## Nội chính (`/civil`, `/me/civil`)

12 quan chức, mỗi chức: công trình mở khóa, chỉ số dùng (Chính trị/Mị lực), hệ số mỗi điểm, top tướng kèm % lúc trắng/đỏ max và lựa chọn chính thức. Công thức có nguồn chính thức: `thưởng = (xây dựng cá nhân + thành + lãnh địa) × (% chủ chính + % quan chức)`, `% quan chức = chỉ số × hệ số + chiến pháp`. Máy tính: chọn tướng, cấp, đỏ, điểm cộng, điển tàng → chỉ số cuối và %. Bản đăng nhập lưu nhiều bộ theo nhân vật, tự xếp (chọn chủ chính trước, rồi tối đa tổng thưởng, mỗi người một chức). Công nếu làm: M (dữ liệu 26 tướng nội chính + 12 chức; cần xác minh hệ số cho bản VN).

## Gợi ý gói đầu tiên

#6 (máy tính công trình, đã có `buildingTotals` cộng tổng từng công trình) + #8 (thêm hàng loạt món thiếu) + #2 riêng cho Đội chuẩn + nối đích "Chuyển hình" của Khai hoang sang trang Đội chuẩn (#1 phần S): ít rủi ro, dùng dữ liệu đã có, không đụng worker/schema. Sửa issue #59 trước #2. Sau đó thêm nhãn "dùng lại tướng khai hoang" vào Gợi ý đội, #2 cho Khai hoang và Cùng Tồn, rồi #4 và #15. Phân tích khắc chế cấp bộ đội (#1 bước 4, #3) lùi lại cho tới khi có dữ liệu khắc chế của mùa.

## Câu hỏi chưa giải quyết

- Câu khắc chế và lưu ý ra quân cho mùa VN hiện tại lấy từ nguồn nào (dịch lại nguồn CN/TW như sgsdeck hay nguồn VN)? Câu này chặn cả #3 lẫn bước 4 của #1. Không được copy nguyên nội dung biên tập của sgsdeck. Tuyến chuyển khai hoang thì đã có trong `data/khaihoang.json`, chỉ thiếu 6/17 đội.
- Vì sao `legacyReferences` của generation Đội chuẩn hiện tại rỗng hết: chủ ý hay bị rơi khi build (`pipeline/build_recommended_reference.py`)?
- Công thức công thành / cộng thưởng nội chính có giống bản VN không?
