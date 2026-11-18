# Binh thư cho đội YouTube PK-S27 (#163)

Nguồn: `pipeline/team-youtube-pk-s27.json`. Binh thư đọc lại từ 30 video bằng chứng của các đội (OCR mỗi giây để lọc cảnh có binh thư, rồi đọc frame bằng mắt), tên Việt map qua bảng thủ công `pipeline/books-han-viet-map.json`.

## Kết quả

- Tướng có binh thư: 382/801 (trước: 3/801).
- Đội có binh thư ít nhất một tướng: 135/267 (trước: 1/267); đủ cả ba tướng: 120.
- Đội vẫn trống: 132; đội có một phần: 15.
- Dedup Đội khác không đổi (387 admitted, 20 pending, cùng danh sách id): dedup chỉ xét tướng + chiến pháp.

## Quy tắc đã áp

- Thứ tự: binh thư chính trước, rồi hai binh thư phụ. Dạng "A/B" trên bảng creator ghi B vào `alternatives`.
- Chỉ nhận tướng đọc rõ, khớp đúng bộ tướng của đội (chiến pháp khớp để tách đội cùng bộ tướng), và binh thư chính map được. Cuốn phụ không đọc được hoặc chưa map thì bỏ, không đoán.
- Nhãn PK trên chân dung (bản PK của cùng tướng) được nhận khi chiến pháp khớp đội.
- Nhiều video cho cùng tướng mà lệch nhau: lấy video đứng sớm nhất trong `evidence` của đội (video dùng để curate đội).
- Màn chiến báo không hiện binh thư, nên đội chỉ có bằng chứng chiến báo vẫn trống.
- `歸心` (Quy Thuận) nay có đội dùng: gỡ cờ `outsideTeams` trong bảng binh thư.

## Chưa map được

- `以退為進` và `無功而勵` đang nằm trong `_unresolved` của bảng binh thư (chưa có tên game VN, cần ảnh client). Tướng có binh thư chính là hai cuốn này để trống.
- Tên Nhật trong video kazten (79LwxX01G5Y) không quy đổi: 三軍救助 ×11, 練磨 ×6, 常勝 ×3, 精確 ×2, 当機立断 ×1, 奇策勝利 ×1, 先制 ×1, 傷兵支援 ×1, 時制判断 ×1, 譲渡 ×1, 一気呵成 ×1, 笑裏蔵刀 ×1, 勝敵益強 ×1.

## Lệch giữa các video (đã chọn nguồn chính)

| Đội | Tướng | Đã chọn | Bản khác |
|---|---|---|---|
| [Pháp Quan Thuẫn (Khương Duy)](https://tqccl.com/doi-khac/phap-quan-thuan-khuong-duy/) | SP Quan Vũ | Yêu Lính Thương Dân, Giáp Sắt, Tĩnh Tâm ([ryQDIKf6crg@26s](https://youtu.be/ryQDIKf6crg?t=26)) | Yêu Lính Thương Dân, Tĩnh Tâm, Nghĩa Dũng ([c2etTumCOjA@92s](https://youtu.be/c2etTumCOjA?t=92)) |
| [Pháp Quan Thuẫn (Khương Duy)](https://tqccl.com/doi-khac/phap-quan-thuan-khuong-duy/) | Khương Duy | Man Dũng Phi Dũng, Cầm Binh Khí, Văn Thao ([ryQDIKf6crg@26s](https://youtu.be/ryQDIKf6crg?t=26)) | Man Dũng Phi Dũng, Văn Thao, Cầm Binh Khí ([c2etTumCOjA@92s](https://youtu.be/c2etTumCOjA?t=92)) |
| [Trương Giác Bế Nguyệt Thuẫn](https://tqccl.com/doi-khac/truong-giac-be-nguyet-thuan/) | Tả Từ | Tấn Công Điểm Yếu, Cứu Chủ, Tản Tiên ([8wZjFWUB6V4@472s](https://youtu.be/8wZjFWUB6V4?t=472)) | Tấn Công Điểm Yếu, Tản Tiên, Khép Hờ ([ryQDIKf6crg@50s](https://youtu.be/ryQDIKf6crg?t=50)) |
| Đại Hán Cung (chưa lên site) | SP Tào Tháo | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([8wZjFWUB6V4@24s](https://youtu.be/8wZjFWUB6V4?t=24)) | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([tNne3heLCuQ@0s](https://youtu.be/tNne3heLCuQ?t=0)); Tam Quân Chi Chúng, Dẫn Quân, Chiến Đấu Trường Kỳ ([EA8Hy8LoPOs@154s](https://youtu.be/EA8Hy8LoPOs?t=154)) |
| Đại Hán Cung (chưa lên site) | SP Lô Thực | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([8wZjFWUB6V4@24s](https://youtu.be/8wZjFWUB6V4?t=24)) | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([tNne3heLCuQ@0s](https://youtu.be/tNne3heLCuQ?t=0)); Tam Quân Chi Chúng, Dẫn Quân, Chiến Đấu Trường Kỳ ([EA8Hy8LoPOs@154s](https://youtu.be/EA8Hy8LoPOs?t=154)) |
| Đại Hán Cung (chưa lên site) | SP Điêu Thuyền | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([8wZjFWUB6V4@24s](https://youtu.be/8wZjFWUB6V4?t=24)) | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([tNne3heLCuQ@0s](https://youtu.be/tNne3heLCuQ?t=0)); Tam Quân Chi Chúng, Dẫn Quân, Chiến Đấu Trường Kỳ ([EA8Hy8LoPOs@154s](https://youtu.be/EA8Hy8LoPOs?t=154)) |
| Pháp Quan Thuẫn (Mã Đại) (chưa lên site) | Mã Đại | Biết Cách Phòng Thủ, Tĩnh Tâm, Phòng Bị ([EA8Hy8LoPOs@262s](https://youtu.be/EA8Hy8LoPOs?t=262)) | Biết Cách Phòng Thủ, Thế Phòng Thủ, Giáp Sắt ([ryQDIKf6crg@4s](https://youtu.be/ryQDIKf6crg?t=4)) |
| Pháp Quan Thuẫn (Mã Đại) (chưa lên site) | SP Pháp Chính | Tam Quân Chi Chúng, Dẫn Quân, Rèn Luyện ([EA8Hy8LoPOs@262s](https://youtu.be/EA8Hy8LoPOs?t=262)) | Tam Quân Chi Chúng, Rèn Luyện, Dẫn Quân ([ryQDIKf6crg@4s](https://youtu.be/ryQDIKf6crg?t=4)) |
| Hoàng Mã Thương (chưa lên site) | SP Mã Siêu | Tấn Công Điểm Yếu, Tốc Chiến, Khép Hờ ([8wZjFWUB6V4@244s](https://youtu.be/8wZjFWUB6V4?t=244)) | Dĩ Trực Báo Oán, Tinh Chuẩn, Trì Trọng ([c2etTumCOjA@84s](https://youtu.be/c2etTumCOjA?t=84)) |
| Hoàng Mã Thương (chưa lên site) | SP Hoàng Phủ Tung | Đánh Giá Tình Hình, Khai Hạp, Chia Lời ([8wZjFWUB6V4@244s](https://youtu.be/8wZjFWUB6V4?t=244)) | Đánh Giá Tình Hình, Khai Hạp, Trì Trọng ([c2etTumCOjA@84s](https://youtu.be/c2etTumCOjA?t=84)) |
| Hoàng Mã Thương (chưa lên site) | Hứa Du | Yêu Lính Thương Dân, Thế Phòng Thủ, Phòng Bị ([8wZjFWUB6V4@244s](https://youtu.be/8wZjFWUB6V4?t=244)) | Yêu Lính Thương Dân, Giáp Sắt, Thế Phòng Thủ ([c2etTumCOjA@84s](https://youtu.be/c2etTumCOjA?t=84)); Yêu Lính Thương Dân, Thế Phòng Thủ, Phòng Bị ([eDxpzZxDXo8@64s](https://youtu.be/eDxpzZxDXo8?t=64)) |
| Bế Nguyệt Thuẫn (chưa lên site) | Điêu Thuyền | Tam Quân Chi Chúng, Rèn Luyện, Dẫn Quân ([iFEJdMXzTy8@106s](https://youtu.be/iFEJdMXzTy8?t=106)) | Tam Quân Chi Chúng, Dẫn Quân, Rèn Luyện ([EA8Hy8LoPOs@690s](https://youtu.be/EA8Hy8LoPOs?t=690)) |
| Quyền Kỵ (chưa lên site) | Lăng Thống | Gặp Địch Không Loạn, Tốc Chiến, Khích Lệ Lòng Quân ([EA8Hy8LoPOs@86s](https://youtu.be/EA8Hy8LoPOs?t=86)) | Chẩm Qua Tọa Giáp, Sắc Bén, Dẫn Quân ([ryQDIKf6crg@81s](https://youtu.be/ryQDIKf6crg?t=81)) |
| Quyền Kỵ (chưa lên site) | Chu Thái | Yêu Lính Thương Dân, Thế Phòng Thủ, Phòng Bị ([EA8Hy8LoPOs@86s](https://youtu.be/EA8Hy8LoPOs?t=86)) | Tam Quân Chi Chúng, Rèn Luyện, Dẫn Quân ([ryQDIKf6crg@81s](https://youtu.be/ryQDIKf6crg?t=81)) |
| [Tuân Thái Úy](https://tqccl.com/doi-khac/tuan-thai-uy/) | Tư Mã Ý | Thích Làm Việc Thiện, Dẫn Quân, Rèn Luyện ([EA8Hy8LoPOs@773s](https://youtu.be/EA8Hy8LoPOs?t=773)) | Tam Quân Chi Chúng, Chiến Đấu Trường Kỳ, Dẫn Quân ([oPjKZBOmzp8@830s](https://youtu.be/oPjKZBOmzp8?t=830)) |
| [Tuân Thái Úy](https://tqccl.com/doi-khac/tuan-thai-uy/) | Trương Xuân Hoa | Tam Quân Chi Chúng, Dẫn Quân, Rèn Luyện ([EA8Hy8LoPOs@773s](https://youtu.be/EA8Hy8LoPOs?t=773)) | Tam Quân Chi Chúng, Rèn Luyện, Dẫn Quân ([oPjKZBOmzp8@830s](https://youtu.be/oPjKZBOmzp8?t=830)) |
| [Tuân Thái Úy](https://tqccl.com/doi-khac/tuan-thai-uy/) | SP Tuân Úc | Tam Quân Chi Chúng, Dẫn Quân, Rèn Luyện ([EA8Hy8LoPOs@773s](https://youtu.be/EA8Hy8LoPOs?t=773)) | Tam Quân Chi Chúng, Rèn Luyện, Dẫn Quân ([oPjKZBOmzp8@830s](https://youtu.be/oPjKZBOmzp8?t=830)) |

## Đọc được nhưng chưa nhận

| Đội | Tướng | Lý do | Nguồn |
|---|---|---|---|
| Hạt Nhân Trương Phi | Trương Phi | không có cuốn chính map được: 以退為進, 精準, 持重 | [8wZjFWUB6V4@430s](https://youtu.be/8wZjFWUB6V4?t=430) |
| Hạt Nhân Chu Tuấn | SP Chu Tuấn | không có cuốn chính map được: 以退為進, 精準, 善戰 | [fnEUNcZUmqI@328s](https://youtu.be/fnEUNcZUmqI?t=328) |
| Hạt Nhân Chu Tuấn | SP Viên Thiệu | không có cuốn chính map được: 以退為進, 精準, 善戰 | [fnEUNcZUmqI@328s](https://youtu.be/fnEUNcZUmqI?t=328) |
| SP Thục Trí Thuẫn | Bàng Thống | confidence thấp: 三軍之眾, 歸心, 統軍 | [fnEUNcZUmqI@328s](https://youtu.be/fnEUNcZUmqI?t=328) |
| Đội chức năng (Trương Phi) | Trương Phi | không có cuốn chính map được: 以退為進, 精準, 善戰 | [c2etTumCOjA@190s](https://youtu.be/c2etTumCOjA?t=190) |
| Đội chức năng (Quan Ngân Bình) | Quan Ngân Bình | không có cuốn chính map được: 以退為進, 精準, 善戰 | [c2etTumCOjA@190s](https://youtu.be/c2etTumCOjA?t=190) |
| Đội chức năng (Trương Phi, Quan Ngân Bình, Hoàng Nguyệt Anh) | Trương Phi | không có cuốn chính map được: 以退為進, 精準, 善戰 | [c2etTumCOjA@190s](https://youtu.be/c2etTumCOjA?t=190) |
| Đội chức năng (Trương Phi, Quan Ngân Bình, Hoàng Nguyệt Anh) | Quan Ngân Bình | không có cuốn chính map được: 以退為進, 精準, 善戰 | [c2etTumCOjA@190s](https://youtu.be/c2etTumCOjA?t=190) |
| Tàng Khí Lữ Bố Hình Nhất Thuẫn | SP Pháp Chính | confidence thấp: 三军之众, 锤炼, 统军 | [oPjKZBOmzp8@508s](https://youtu.be/oPjKZBOmzp8?t=508) |
| Tàng Khí Lữ Bố Hình Nhất Thuẫn | Trình Phổ | confidence thấp: 三军之众, 统军, 锤炼 | [oPjKZBOmzp8@508s](https://youtu.be/oPjKZBOmzp8?t=508) |
| Hoàng Mã Thương | SP Mã Siêu | confidence thấp: 援其必攻, 速战, 掩虚 | [ryQDIKf6crg@112s](https://youtu.be/ryQDIKf6crg?t=112) |
| Hoàng Mã Thương | SP Hoàng Phủ Tung | confidence thấp: 审时度势, 开合, 分利 | [ryQDIKf6crg@112s](https://youtu.be/ryQDIKf6crg?t=112) |
| Hoàng Mã Thương | Hứa Du | confidence thấp: 惜兵爱民, 守势, 刚柔 | [ryQDIKf6crg@112s](https://youtu.be/ryQDIKf6crg?t=112) |
| Thích Đổng Cung | Hứa Du | không có cuốn chính map được: 無功而勵, 掩虚, 救主 | [-vwpyxaT9ks@44s](https://youtu.be/-vwpyxaT9ks?t=44) |
| Hán Thất Cung (bản Hoa Đà) | Điêu Thuyền (SP) | confidence thấp: 枕戈坐甲, 久戰, 統軍 | [iFegveMn4z0@22s](https://youtu.be/iFegveMn4z0?t=22) |
| Hoàng Mã (Phấn Đột) | Hoàng Phủ Tung (SP) | không có cuốn chính map được: 開闔, 分利 | [6oZ7uOTJdGw@89s](https://youtu.be/6oZ7uOTJdGw?t=89) |
| Trình Phổ Cung (Cam Ninh, Tả Từ) | Cam Ninh | không có cuốn chính map được: 鬼謀, 將威 | [scZe9zuAckw@48s](https://youtu.be/scZe9zuAckw?t=48) |
| Tuân Du Ngũ Mưu (Sư Tử Phấn Tấn) | Tuân Úc (SP) | không có cuốn chính map được: 統軍 | [79LwxX01G5Y@552s](https://youtu.be/79LwxX01G5Y?t=552) |
| Tuân Du Ngũ Mưu (Sư Tử Phấn Tấn) | Tuân Du | không có cuốn chính map được: 統軍, 久戰 | [79LwxX01G5Y@552s](https://youtu.be/79LwxX01G5Y?t=552) |
| Đô Đốc Cung | Chu Du (SP) | không có cuốn chính map được: 統軍, 久戰 | [79LwxX01G5Y@712s](https://youtu.be/79LwxX01G5Y?t=712) |
| Đô Đốc Cung | Lữ Mông (SP) | không có cuốn chính map được: 統軍, 久戰 | [79LwxX01G5Y@712s](https://youtu.be/79LwxX01G5Y?t=712) |
| Đô Đốc Cung | Lục Tốn | không có cuốn chính map được: 善戰 | [79LwxX01G5Y@712s](https://youtu.be/79LwxX01G5Y?t=712) |
| Thục Trí Thuẫn | Bàng Thống | không có cuốn chính map được: 統軍, 歸心 | [79LwxX01G5Y@800s](https://youtu.be/79LwxX01G5Y?t=800) |
| Thục Trí Thuẫn | Gia Cát Lượng | không có cuốn chính map được: 統軍 | [79LwxX01G5Y@800s](https://youtu.be/79LwxX01G5Y?t=800) |
| Thục Trí Thuẫn | Pháp Chính (SP) | không có cuốn chính map được: 統軍 | [79LwxX01G5Y@800s](https://youtu.be/79LwxX01G5Y?t=800) |
| Viên Thuật Quần Cung (bản Chu Tuấn) | Viên Thuật | không có cuốn chính map được: 蠻勇非勇, 文韜, 執銳 | [79LwxX01G5Y@830s](https://youtu.be/79LwxX01G5Y?t=830) |
| Viên Thuật Quần Cung (bản Chu Tuấn) | Chu Thái | không có cuốn chính map được: 臨敵不亂, 勵軍, 掩虛 | [79LwxX01G5Y@830s](https://youtu.be/79LwxX01G5Y?t=830) |
| Hoàng Mã Thuẫn | Mã Siêu (SP) | không có cuốn chính map được: 速戰, 掩虛 | [79LwxX01G5Y@956s](https://youtu.be/79LwxX01G5Y?t=956) |
| Hoàng Mã Thuẫn | Hoàng Phủ Tung (SP) | không có cuốn chính map được: 開闔 | [79LwxX01G5Y@956s](https://youtu.be/79LwxX01G5Y?t=956) |
| Hoàng Mã Thuẫn | Hứa Du | không có cuốn chính map được: 統軍 | [79LwxX01G5Y@956s](https://youtu.be/79LwxX01G5Y?t=956) |
| Kiều Liêu | Đại Kiều (Vô Song) | không có cuốn chính map được: 統軍, 久戰 | [79LwxX01G5Y@996s](https://youtu.be/79LwxX01G5Y?t=996) |
| Kiều Liêu | Điêu Thuyền (SP) | không có cuốn chính map được: 統軍, 久戰 | [79LwxX01G5Y@996s](https://youtu.be/79LwxX01G5Y?t=996) |
| Hổ Thần Thuẫn | Cam Ninh | không có cuốn chính map được:  | [79LwxX01G5Y@1103s](https://youtu.be/79LwxX01G5Y?t=1103) |
| Hổ Thần Thuẫn | Thái Sử Từ | không có cuốn chính map được: 蠻勇非勇, 武略 | [79LwxX01G5Y@1103s](https://youtu.be/79LwxX01G5Y?t=1103) |
| Tam Thế 40Y Lữ Bố Thuẫn | Lữ Bố (40Y) | không có cuốn chính map được: 武略 | [79LwxX01G5Y@1276s](https://youtu.be/79LwxX01G5Y?t=1276) |
| Tam Thế 40Y Lữ Bố Thuẫn | Hứa Du | không có cuốn chính map được: 統軍 | [79LwxX01G5Y@1276s](https://youtu.be/79LwxX01G5Y?t=1276) |
| Tam Thế 40Y Lữ Bố Thuẫn | Pháp Chính (SP) | không có cuốn chính map được: 統軍 | [79LwxX01G5Y@1276s](https://youtu.be/79LwxX01G5Y?t=1276) |

## Đội vẫn trống

Phần lớn chỉ có bằng chứng chiến báo hoặc slide không ghi binh thư. Bổ sung: điền `heroes[].books` trong file nguồn rồi chạy lại chuỗi build_json → dedup → site_localization.

| # | Đội | Video |
|---|---|---|
| 1 | [Tam Thế Đằng Giáp 40Y Lữ Bố](https://tqccl.com/doi-khac/tam-the-dang-giap-40y-lu-bo/) | [001m42s](https://youtu.be/tNne3heLCuQ?t=102) [004m26s](https://youtu.be/tNne3heLCuQ?t=266) [001m12s](https://youtu.be/fnEUNcZUmqI?t=72) |
| 2 | [40Y Lữ Bố](https://tqccl.com/doi-khac/40y-lu-bo/) | [000m04s](https://youtu.be/YVtssGwHfz8?t=4) [001m24s](https://youtu.be/YVtssGwHfz8?t=84) |
| 3 | [Tam Thế 40Y Lữ Bố Thuẫn](https://tqccl.com/doi-khac/tam-the-40y-lu-bo-thuan-youtube-4/) | [021m06s](https://youtu.be/79LwxX01G5Y?t=1266) [021m20s](https://youtu.be/79LwxX01G5Y?t=1280) |
| 4 | [40Y Lữ Bố Thuẫn (CO Tinh Thái, Mãn Sủng)](https://tqccl.com/doi-khac/40y-lu-bo-thuan-co-tinh-thai-man-sung/) | [005m12s](https://youtu.be/fnEUNcZUmqI?t=312) [004m36s](https://youtu.be/tNne3heLCuQ?t=276) |
| 5 | [40Y Lữ Bố Thương (Bàng Thống, Vương Nguyên Cơ)](https://tqccl.com/doi-khac/40y-lu-bo-thuong-bang-thong-vuong-nguyen-co/) | [007m32s](https://youtu.be/iFEJdMXzTy8?t=452) |
| 6 | [40Y Lữ Bố Cung (SP Hoàng Phủ Tung, Gia Cát Lượng)](https://tqccl.com/doi-khac/40y-lu-bo-cung-sp-hoang-phu-tung-gia-cat-luong/) | [003m02s](https://youtu.be/khGmfKDo9ng?t=182) |
| 7 | [Đội Chu Du (Công Tôn Toản, 40Y Lữ Bố)](https://tqccl.com/doi-khac/doi-chu-du-cong-ton-toan-40y-lu-bo/) | [002m16s](https://youtu.be/tNne3heLCuQ?t=136) |
| 8 | [Pháp Quan Thuẫn (CO Tinh Thái, Ngư Lân Trận)](https://tqccl.com/doi-khac/phap-quan-thuan-co-tinh-thai-ngu-lan-tran/) | [002m12s](https://youtu.be/fnEUNcZUmqI?t=132) |
| 9 | [Pháp Quan Thuẫn (CO Tinh Thái, Ngư Lân Trận, Mê Hoặc)](https://tqccl.com/doi-khac/phap-quan-thuan-co-tinh-thai-ngu-lan-tran-me-hoac/) | [000m22s](https://youtu.be/tNne3heLCuQ?t=22) [002m34s](https://youtu.be/tNne3heLCuQ?t=154) |
| 10 | [Pháp Quan](https://tqccl.com/doi-khac/phap-quan/) | [007m24s](https://youtu.be/iFEJdMXzTy8?t=444) |
| 11 | [Pháp Quan Thuẫn (Khương Duy, Ngư Lân Trận)](https://tqccl.com/doi-khac/phap-quan-thuan-khuong-duy-ngu-lan-tran/) | [001m24s](https://youtu.be/7Zbrf8VgbnQ?t=84) |
| 12 | [Pháp Quan Thuẫn (Trương Bào, Ngư Lân Trận)](https://tqccl.com/doi-khac/phap-quan-thuan-truong-bao-ngu-lan-tran/) | [000m46s](https://youtu.be/deVvRrbSR4w?t=46) |
| 13 | [Pháp Quan Thuẫn (Triệu Vân)](https://tqccl.com/doi-khac/phap-quan-thuan-trieu-van/) | [001m36s](https://youtu.be/Tf-py67sULA?t=96) |
| 14 | [SP Gia Cát Lượng Thuẫn (SP Quan Vũ, Quan Ngân Bình)](https://tqccl.com/doi-khac/sp-gia-cat-luong-thuan-sp-quan-vu-quan-ngan-binh/) | [001m04s](https://youtu.be/fnEUNcZUmqI?t=64) |
| 15 | [Lục Tốn Thuẫn (SP Pháp Chính, Tào Tháo)](https://tqccl.com/doi-khac/luc-ton-thuan-sp-phap-chinh-tao-thao/) | [004m32s](https://youtu.be/tNne3heLCuQ?t=272) |
| 16 | [Xích Bích Hán Cung (SP Tào Tháo mang Kết Nghĩa Vườn Đào)](https://tqccl.com/doi-khac/xich-bich-han-cung-sp-tao-thao-mang-ket-nghia-vuon-dao/) | [006m12s](https://youtu.be/fnEUNcZUmqI?t=372) |
| 17 | [SP Điêu Thuyền Cung (SP Tào Tháo, SP Chu Du)](https://tqccl.com/doi-khac/sp-dieu-thuyen-cung-sp-tao-thao-sp-chu-du/) | [002m54s](https://youtu.be/fnEUNcZUmqI?t=174) |
| 18 | [SP Pháp Chính Cung (SP Chu Du, SP Điêu Thuyền)](https://tqccl.com/doi-khac/sp-phap-chinh-cung-sp-chu-du-sp-dieu-thuyen/) | [006m06s](https://youtu.be/fnEUNcZUmqI?t=366) |
| 19 | [Hán Thất Cung (biến thể)](https://tqccl.com/doi-khac/han-that-cung-bien-the/) | [001m36s](https://youtu.be/eDxpzZxDXo8?t=96) |
| 20 | [SP Tào Tháo Cung (Giả Hủ, SP Điêu Thuyền)](https://tqccl.com/doi-khac/sp-tao-thao-cung-gia-hu-sp-dieu-thuyen/) | [001m14s](https://youtu.be/tNne3heLCuQ?t=74) |
| 21 | [SP Tào Tháo Cung (Lục Tốn, SP Điêu Thuyền)](https://tqccl.com/doi-khac/sp-tao-thao-cung-luc-ton-sp-dieu-thuyen/) | [000m32s](https://youtu.be/LM_wSM299wk?t=32) |
| 22 | [Cự Mã Cung (Hình Nhất)](https://tqccl.com/doi-khac/cu-ma-cung-hinh-nhat/) | [001m24s](https://youtu.be/eDxpzZxDXo8?t=84) |
| 23 | [SP Chu Tuấn Cung (SP Đổng Trác, SP Điêu Thuyền)](https://tqccl.com/doi-khac/sp-chu-tuan-cung-sp-dong-trac-sp-dieu-thuyen/) | [001m58s](https://youtu.be/AGS4b-kkiR8?t=118) |
| 24 | [Giả Hủ Đổng Trác Điêu Thuyền Cung](https://tqccl.com/doi-khac/gia-hu-dong-trac-dieu-thuyen-cung/) | [005m26s](https://youtu.be/iFEJdMXzTy8?t=326) |
| 25 | [SP Đổng Trác Cung (Vương Dị, SP Điêu Thuyền)](https://tqccl.com/doi-khac/sp-dong-trac-cung-vuong-di-sp-dieu-thuyen/) | [001m04s](https://youtu.be/LM_wSM299wk?t=64) |
| 26 | [Đổng Trác Cung (SP Điêu Thuyền, Lữ Bố)](https://tqccl.com/doi-khac/dong-trac-cung-sp-dieu-thuyen-lu-bo/) | [007m04s](https://youtu.be/r76AkV92VnM?t=424) |
| 27 | [Ly Hỏa Cung](https://tqccl.com/doi-khac/ly-hoa-cung/) | [000m00s](https://youtu.be/LM_wSM299wk?t=0) [000m38s](https://youtu.be/LM_wSM299wk?t=38) |
| 28 | [SP Điêu Thuyền Cung (Chu Du, Tào Tháo)](https://tqccl.com/doi-khac/sp-dieu-thuyen-cung-chu-du-tao-thao/) | [007m28s](https://youtu.be/r76AkV92VnM?t=448) |
| 29 | [Tiềm Long Điêu Thuyền Cung](https://tqccl.com/doi-khac/tiem-long-dieu-thuyen-cung/) | [006m58s](https://youtu.be/r76AkV92VnM?t=418) |
| 30 | Bế Nguyệt Thuẫn (Hành Ách Trận) (chưa lên site) | [001m58s](https://youtu.be/2lY2K3zWLXE?t=118) |
| 31 | [Trương Giác Thuẫn](https://tqccl.com/doi-khac/truong-giac-thuan/) | [001m24s](https://youtu.be/scZe9zuAckw?t=84) |
| 32 | [Trương Giác Thuẫn (Điêu Thuyền mang Lính Giáp Mây)](https://tqccl.com/doi-khac/truong-giac-thuan-dieu-thuyen-mang-linh-giap-may/) | [001m10s](https://youtu.be/eDxpzZxDXo8?t=70) |
| 33 | [Điêu Thuyền Cung (Trương Giác, Tả Từ)](https://tqccl.com/doi-khac/dieu-thuyen-cung-truong-giac-ta-tu/) | [000m18s](https://youtu.be/eDxpzZxDXo8?t=18) |
| 34 | [Bế Nguyệt Thuẫn (Thư Thụ, Dốc Sức Tính Kế)](https://tqccl.com/doi-khac/be-nguyet-thuan-thu-thu-doc-suc-tinh-ke/) | [009m38s](https://youtu.be/EA8Hy8LoPOs?t=578) [001m46s](https://youtu.be/tNne3heLCuQ?t=106) |
| 35 | [Trương Giác Thuẫn (Điêu Thuyền, Thư Thụ)](https://tqccl.com/doi-khac/truong-giac-thuan-dieu-thuyen-thu-thu/) | [000m32s](https://youtu.be/2lY2K3zWLXE?t=32) [000m34s](https://youtu.be/2lY2K3zWLXE?t=34) |
| 36 | [Tam Tiên Kỵ](https://tqccl.com/doi-khac/tam-tien-ky/) | [002m20s](https://youtu.be/TfxP8li8ME0?t=140) |
| 37 | Hoàng Mã Hành Ách Điêu Thuyền (chưa lên site) | [006m12s](https://youtu.be/r76AkV92VnM?t=372) [006m54s](https://youtu.be/r76AkV92VnM?t=414) [007m04s](https://youtu.be/r76AkV92VnM?t=424) |
| 38 | Điêu Mã Thương (Hành Ách Trận, Mê Hoặc) (chưa lên site) | [004m14s](https://youtu.be/tNne3heLCuQ?t=254) |
| 39 | Điêu Mã Thương (chưa lên site) | [000m54s](https://youtu.be/-vwpyxaT9ks?t=54) |
| 40 | [Hoàng Mã Thuẫn](https://tqccl.com/doi-khac/hoang-ma-thuan/) | [015m48s](https://youtu.be/79LwxX01G5Y?t=948) [016m02s](https://youtu.be/79LwxX01G5Y?t=962) [016m20s](https://youtu.be/79LwxX01G5Y?t=980) |
| 41 | [Hoàng Mã Cung (biến thể)](https://tqccl.com/doi-khac/hoang-ma-cung-bien-the/) | [003m14s](https://youtu.be/tNne3heLCuQ?t=194) |
| 42 | [Lữ Bố Thương (SP Hoàng Phủ Tung, Hứa Du)](https://tqccl.com/doi-khac/lu-bo-thuong-sp-hoang-phu-tung-hua-du/) | [001m54s](https://youtu.be/zNmVTu0X_Ic?t=114) |
| 43 | [Hứa Du Cung (Lữ Bố, Chu Du)](https://tqccl.com/doi-khac/hua-du-cung-lu-bo-chu-du/) | [000m42s](https://youtu.be/tNne3heLCuQ?t=42) |
| 44 | [Ôn Hầu Cung (Quân Cẩm Phàm)](https://tqccl.com/doi-khac/on-hau-cung-quan-cam-pham/) | [001m38s](https://youtu.be/zNmVTu0X_Ic?t=98) [017m34s](https://youtu.be/79LwxX01G5Y?t=1054) |
| 45 | [Lữ Bố Kỵ (Lăng Thống, Quách Gia)](https://tqccl.com/doi-khac/lu-bo-ky-lang-thong-quach-gia/) | [001m10s](https://youtu.be/dvOYA56_4gk?t=70) |
| 46 | [Lữ Bố Cung (Quách Gia, CO Tiểu Kiều)](https://tqccl.com/doi-khac/lu-bo-cung-quach-gia-co-tieu-kieu/) | [001m24s](https://youtu.be/tNne3heLCuQ?t=84) |
| 47 | [Đổng Trác Cung (Lữ Bố, Hứa Du)](https://tqccl.com/doi-khac/dong-trac-cung-lu-bo-hua-du/) | [001m46s](https://youtu.be/zNmVTu0X_Ic?t=106) |
| 48 | [Chu Thái Thương (SP Viên Thiệu, Trương Phi)](https://tqccl.com/doi-khac/chu-thai-thuong-sp-vien-thieu-truong-phi/) | [001m38s](https://youtu.be/scZe9zuAckw?t=98) |
| 49 | [Chu Thái Thuẫn (Trương Phi, SP Viên Thiệu)](https://tqccl.com/doi-khac/chu-thai-thuan-truong-phi-sp-vien-thieu/) | [001m22s](https://youtu.be/zNmVTu0X_Ic?t=82) |
| 50 | [Bạch Mã Cung](https://tqccl.com/doi-khac/bach-ma-cung/) | [002m52s](https://youtu.be/khGmfKDo9ng?t=172) |
| 51 | [Tôn Quyền Kỵ (SP Lữ Mông, Chu Thái)](https://tqccl.com/doi-khac/ton-quyen-ky-sp-lu-mong-chu-thai/) | [004m42s](https://youtu.be/fnEUNcZUmqI?t=282) |
| 52 | [Quyền Kỵ (biến thể)](https://tqccl.com/doi-khac/quyen-ky-bien-the/) | [007m48s](https://youtu.be/iFEJdMXzTy8?t=468) |
| 53 | [Đô Đốc Cung](https://tqccl.com/doi-khac/do-doc-cung-youtube-109/) | [011m44s](https://youtu.be/79LwxX01G5Y?t=704) |
| 54 | [Đô Đốc Cung](https://tqccl.com/doi-khac/do-doc-cung-youtube-110/) | [001m24s](https://youtu.be/YVtssGwHfz8?t=84) |
| 55 | [Đô Đốc Cung (có Đương Phong Thôi Quyết phá Cương Nghị)](https://tqccl.com/doi-khac/do-doc-cung-co-duong-phong-thoi-quyet-pha-cuong-nghi/) | [001m30s](https://youtu.be/YVtssGwHfz8?t=90) |
| 56 | [Cặp Đô Đốc](https://tqccl.com/doi-khac/cap-do-doc/) | [007m32s](https://youtu.be/r76AkV92VnM?t=452) |
| 57 | [SP Chu Du Cung (Lục Tốn, SP Lữ Mông)](https://tqccl.com/doi-khac/sp-chu-du-cung-luc-ton-sp-lu-mong/) | [007m48s](https://youtu.be/khGmfKDo9ng?t=468) |
| 58 | [SP Chu Du Cung (Lục Tốn, Lữ Mông)](https://tqccl.com/doi-khac/sp-chu-du-cung-luc-ton-lu-mong/) | [001m34s](https://youtu.be/scZe9zuAckw?t=94) |
| 59 | Xã Tắc Cung (Hành Ách Trận) (chưa lên site) | [001m58s](https://youtu.be/VrradVYuQYU?t=118) [000m40s](https://youtu.be/iFegveMn4z0?t=40) |
| 60 | [Xã Tắc Cung (Nhạn Hành Trận, Cương Nhu Kết Hợp)](https://tqccl.com/doi-khac/xa-tac-cung-nhan-hanh-tran-cuong-nhu-ket-hop/) | [004m56s](https://youtu.be/iFEJdMXzTy8?t=296) |
| 61 | [Chu Du Cung (Thái Sử Từ, Trình Phổ)](https://tqccl.com/doi-khac/chu-du-cung-thai-su-tu-trinh-pho/) | [001m14s](https://youtu.be/hVEky_vX0F8?t=74) |
| 62 | [Chu Du Cung (Lục Tốn, SP Tôn Kiên)](https://tqccl.com/doi-khac/chu-du-cung-luc-ton-sp-ton-kien/) | [002m54s](https://youtu.be/tNne3heLCuQ?t=174) |
| 63 | [Khống Chế Cung](https://tqccl.com/doi-khac/khong-che-cung/) | [001m14s](https://youtu.be/2lY2K3zWLXE?t=74) |
| 64 | [Khống Chế Thương (biến thể)](https://tqccl.com/doi-khac/khong-che-thuong-bien-the/) | [000m48s](https://youtu.be/iFegveMn4z0?t=48) |
| 65 | [Đội Chu Du (SP Lữ Mông, Thái Sử Từ)](https://tqccl.com/doi-khac/doi-chu-du-sp-lu-mong-thai-su-tu/) | [001m40s](https://youtu.be/AGS4b-kkiR8?t=100) |
| 66 | [Chu Du Cung (Giả Hủ, SP Tuân Úc)](https://tqccl.com/doi-khac/chu-du-cung-gia-hu-sp-tuan-uc/) | [006m06s](https://youtu.be/fnEUNcZUmqI?t=366) [006m12s](https://youtu.be/fnEUNcZUmqI?t=372) |
| 67 | [Khảng Khái Cung (Thịnh Khí Linh Địch)](https://tqccl.com/doi-khac/khang-khai-cung-thinh-khi-linh-dich/) | [003m18s](https://youtu.be/tNne3heLCuQ?t=198) |
| 68 | [Cam Thái Trình (biến thể)](https://tqccl.com/doi-khac/cam-thai-trinh-bien-the/) | [001m22s](https://youtu.be/hVEky_vX0F8?t=82) |
| 69 | [Cam Thái Trình (Đương Phong Thôi Quyết)](https://tqccl.com/doi-khac/cam-thai-trinh-duong-phong-thoi-quyet/) | [001m04s](https://youtu.be/iFegveMn4z0?t=64) |
| 70 | [Trình Phổ Cung (Thái Sử Từ, Tả Từ)](https://tqccl.com/doi-khac/trinh-pho-cung-thai-su-tu-ta-tu/) | [000m26s](https://youtu.be/eDxpzZxDXo8?t=26) [000m30s](https://youtu.be/eDxpzZxDXo8?t=30) |
| 71 | [Trình Phổ Cung (Ngụy Diên, Thư Thụ)](https://tqccl.com/doi-khac/trinh-pho-cung-nguy-dien-thu-thu/) | [002m14s](https://youtu.be/LM_wSM299wk?t=134) |
| 72 | [SP Gia Cát Lượng Cung (Quan Vũ, Bàng Thống)](https://tqccl.com/doi-khac/sp-gia-cat-luong-cung-quan-vu-bang-thong/) | [000m28s](https://youtu.be/-vwpyxaT9ks?t=28) [001m14s](https://youtu.be/-vwpyxaT9ks?t=74) |
| 73 | [Thục Trí Cung (SP Gia Cát Lượng, Pháp Chính)](https://tqccl.com/doi-khac/thuc-tri-cung-sp-gia-cat-luong-phap-chinh/) | [006m54s](https://youtu.be/r76AkV92VnM?t=414) |
| 74 | [Thục Trí Thuẫn](https://tqccl.com/doi-khac/thuc-tri-thuan/) | [013m06s](https://youtu.be/79LwxX01G5Y?t=786) |
| 75 | [Thục Trí Thuẫn (Mê Hoặc, Lính Giáp Mây)](https://tqccl.com/doi-khac/thuc-tri-thuan-me-hoac-linh-giap-may/) | [001m04s](https://youtu.be/7Zbrf8VgbnQ?t=64) |
| 76 | [Thục Trí Thuẫn (Mê Hoặc)](https://tqccl.com/doi-khac/thuc-tri-thuan-me-hoac/) | [001m56s](https://youtu.be/6oZ7uOTJdGw?t=116) |
| 77 | [Bắc Phạt Thuẫn (Gió Táp Mưa Sa, Thâm Tàng Nhược Hư)](https://tqccl.com/doi-khac/bac-phat-thuan-gio-tap-mua-sa-tham-tang-nhuoc-hu/) | [001m48s](https://youtu.be/2lY2K3zWLXE?t=108) |
| 78 | [Bắc Phạt Thuẫn](https://tqccl.com/doi-khac/bac-phat-thuan/) | [001m32s](https://youtu.be/eDxpzZxDXo8?t=92) [001m36s](https://youtu.be/eDxpzZxDXo8?t=96) |
| 79 | [Bắc Phạt Thuẫn (Biết Mình Biết Ta, Xông Pha Khói Lửa)](https://tqccl.com/doi-khac/bac-phat-thuan-biet-minh-biet-ta-xong-pha-khoi-lua/) | [001m32s](https://youtu.be/tNne3heLCuQ?t=92) |
| 80 | [Bắc Phạt Thương](https://tqccl.com/doi-khac/bac-phat-thuong-youtube-160/) | [000m42s](https://youtu.be/deVvRrbSR4w?t=42) [000m46s](https://youtu.be/deVvRrbSR4w?t=46) [000m50s](https://youtu.be/hVEky_vX0F8?t=50) |
| 81 | [Kỳ Lân Cung (biến thể)](https://tqccl.com/doi-khac/ky-lan-cung-bien-the/) | [002m26s](https://youtu.be/tNne3heLCuQ?t=146) |
| 82 | [Khương Duy Kỵ (Quan Ngân Bình, Lưu Bị)](https://tqccl.com/doi-khac/khuong-duy-ky-quan-ngan-binh-luu-bi/) | [001m42s](https://youtu.be/2lY2K3zWLXE?t=102) |
| 83 | [Khương Duy Kỵ (Lưu Bị, Quan Ngân Bình)](https://tqccl.com/doi-khac/khuong-duy-ky-luu-bi-quan-ngan-binh/) | [000m24s](https://youtu.be/-vwpyxaT9ks?t=24) |
| 84 | [Lưu Bị Kỵ (Triệu Vân, Khương Duy)](https://tqccl.com/doi-khac/luu-bi-ky-trieu-van-khuong-duy/) | [002m14s](https://youtu.be/zNmVTu0X_Ic?t=134) |
| 85 | [Quan Quan Trương (biến thể)](https://tqccl.com/doi-khac/quan-quan-truong-bien-the/) | [001m10s](https://youtu.be/hVEky_vX0F8?t=70) |
| 86 | [Mã Vân Lộc Kỵ (Hoàng Nguyệt Anh, Quan Ngân Bình)](https://tqccl.com/doi-khac/ma-van-loc-ky-hoang-nguyet-anh-quan-ngan-binh/) | [003m46s](https://youtu.be/iFEJdMXzTy8?t=226) [006m04s](https://youtu.be/iFEJdMXzTy8?t=364) |
| 87 | [Cẩu Quan Thương (biến thể)](https://tqccl.com/doi-khac/cau-quan-thuong-bien-the/) | [001m30s](https://youtu.be/CDWVKcSQ7Is?t=90) |
| 88 | [Ngũ Mưu (Trình Dục)](https://tqccl.com/doi-khac/ngu-muu-trinh-duc/) | [000m56s](https://youtu.be/scZe9zuAckw?t=56) [001m04s](https://youtu.be/scZe9zuAckw?t=64) |
| 89 | [Ngũ Mưu Kỵ (Vương Dị)](https://tqccl.com/doi-khac/ngu-muu-ky-vuong-di/) | [001m54s](https://youtu.be/hVEky_vX0F8?t=114) |
| 90 | [Ngũ Mưu Kỵ (Biến Đá Thành Vàng)](https://tqccl.com/doi-khac/ngu-muu-ky-bien-da-thanh-vang/) | [007m20s](https://youtu.be/iFEJdMXzTy8?t=440) |
| 91 | [Ngũ Mưu Cung](https://tqccl.com/doi-khac/ngu-muu-cung/) | [000m12s](https://youtu.be/AGS4b-kkiR8?t=12) [000m58s](https://youtu.be/AGS4b-kkiR8?t=58) |
| 92 | [SP Tuân Úc Cung (Vương Dị, Giả Hủ)](https://tqccl.com/doi-khac/sp-tuan-uc-cung-vuong-di-gia-hu/) | [006m04s](https://youtu.be/fnEUNcZUmqI?t=364) |
| 93 | [Trình Dục Kỵ (Quách Gia, Mãn Sủng)](https://tqccl.com/doi-khac/trinh-duc-ky-quach-gia-man-sung/) | [000m20s](https://youtu.be/-vwpyxaT9ks?t=20) |
| 94 | [Tư Mã Ý Thuẫn (Trương Xuân Hoa, Mãn Sủng)](https://tqccl.com/doi-khac/tu-ma-y-thuan-truong-xuan-hoa-man-sung/) | [000m46s](https://youtu.be/AGS4b-kkiR8?t=46) [000m50s](https://youtu.be/AGS4b-kkiR8?t=50) |
| 95 | [Tư Mã Ý Cung (SP Tuân Úc, Tuân Du)](https://tqccl.com/doi-khac/tu-ma-y-cung-sp-tuan-uc-tuan-du/) | [001m42s](https://youtu.be/Tf-py67sULA?t=102) |
| 96 | [Tư Mã Ý Kỵ (Quách Gia, Tuân Du)](https://tqccl.com/doi-khac/tu-ma-y-ky-quach-gia-tuan-du/) | [001m44s](https://youtu.be/Tf-py67sULA?t=104) |
| 97 | Ngô Nữ Cung (Hành Ách Trận) (chưa lên site) | [002m00s](https://youtu.be/YVtssGwHfz8?t=120) |
| 98 | [Ngô Nữ Cung (Tử Sĩ Tiên Phong)](https://tqccl.com/doi-khac/ngo-nu-cung-tu-si-tien-phong/) | [000m34s](https://youtu.be/tNne3heLCuQ?t=34) |
| 99 | [CO Đại Kiều Kỵ (Trương Liêu, Tả Từ)](https://tqccl.com/doi-khac/co-dai-kieu-ky-truong-lieu-ta-tu/) | [001m48s](https://youtu.be/YVtssGwHfz8?t=108) |
| 100 | [CO Đại Kiều Thuẫn (Đổng Trác, Trương Liêu)](https://tqccl.com/doi-khac/co-dai-kieu-thuan-dong-trac-truong-lieu/) | [005m58s](https://youtu.be/iFEJdMXzTy8?t=358) |
| 101 | [Hán Thất Cung (SP Tào Tháo mang Tử Sĩ Tiên Phong)](https://tqccl.com/doi-khac/han-that-cung-sp-tao-thao-mang-tu-si-tien-phong/) | [007m44s](https://youtu.be/iFEJdMXzTy8?t=464) |
| 102 | Đại Hán Cung (không đặc kỹ Trị Quân) (chưa lên site) | [000m26s](https://youtu.be/tNne3heLCuQ?t=26) |
| 103 | [Hán Thất Cung (Lập Lờ Đánh Tráo)](https://tqccl.com/doi-khac/han-that-cung-lap-lo-danh-trao/) | [001m12s](https://youtu.be/tNne3heLCuQ?t=72) [003m50s](https://youtu.be/tNne3heLCuQ?t=230) |
| 104 | [SP Lô Thực Thái Sư Cung (SP Lô Thực chủ tướng)](https://tqccl.com/doi-khac/sp-lo-thuc-thai-su-cung-sp-lo-thuc-chu-tuong/) | [000m48s](https://youtu.be/AGS4b-kkiR8?t=48) [000m02s](https://youtu.be/AGS4b-kkiR8?t=2) |
| 105 | [Cự Mã Cung](https://tqccl.com/doi-khac/cu-ma-cung-youtube-212/) | [001m32s](https://youtu.be/eDxpzZxDXo8?t=92) |
| 106 | [Tiềm Long Lục Tốn (Cương Nhu Kết Hợp)](https://tqccl.com/doi-khac/tiem-long-luc-ton-cuong-nhu-ket-hop/) | [002m46s](https://youtu.be/tNne3heLCuQ?t=166) [001m02s](https://youtu.be/LM_wSM299wk?t=62) |
| 107 | [Pháp Quan Thuẫn (Mã Đại, Lính Giáp Mây)](https://tqccl.com/doi-khac/phap-quan-thuan-ma-dai-linh-giap-may/) | [001m16s](https://youtu.be/2lY2K3zWLXE?t=76) [000m58s](https://youtu.be/Tf-py67sULA?t=58) |
| 108 | [Pháp Quan Thuẫn (Mã Đại, Kích Kỳ Nọa Quy)](https://tqccl.com/doi-khac/phap-quan-thuan-ma-dai-kich-ky-noa-quy/) | [000m42s](https://youtu.be/deVvRrbSR4w?t=42) |
| 109 | [Pháp Quan Thuẫn (Mã Đại)](https://tqccl.com/doi-khac/phap-quan-thuan-ma-dai-youtube-219/) | [020m08s](https://youtu.be/79LwxX01G5Y?t=1208) [020m44s](https://youtu.be/79LwxX01G5Y?t=1244) |
| 110 | [Pháp Quan Thuẫn (Lưu Bị)](https://tqccl.com/doi-khac/phap-quan-thuan-luu-bi/) | [005m30s](https://youtu.be/EA8Hy8LoPOs?t=330) [000m28s](https://youtu.be/Tf-py67sULA?t=28) [000m30s](https://youtu.be/Tf-py67sULA?t=30) |
| 111 | [Pháp Quan Thuẫn (Lưu Bị, Ngư Lân Trận)](https://tqccl.com/doi-khac/phap-quan-thuan-luu-bi-ngu-lan-tran/) | [000m28s](https://youtu.be/hVEky_vX0F8?t=28) [001m02s](https://youtu.be/hVEky_vX0F8?t=62) |
| 112 | [Pháp Quan Thuẫn (Lưu Bị, Kích Kỳ Nọa Quy)](https://tqccl.com/doi-khac/phap-quan-thuan-luu-bi-kich-ky-noa-quy/) | [001m34s](https://youtu.be/VrradVYuQYU?t=94) |
| 113 | [Pháp Quan Thuẫn (Lưu Bị, Lính Giáp Mây)](https://tqccl.com/doi-khac/phap-quan-thuan-luu-bi-linh-giap-may/) | [001m48s](https://youtu.be/AGS4b-kkiR8?t=108) |
| 114 | [Hoàng Mã Thương (Lâm Nguy Cứu Chủ)](https://tqccl.com/doi-khac/hoang-ma-thuong-lam-nguy-cuu-chu/) | [000m04s](https://youtu.be/AGS4b-kkiR8?t=4) [000m40s](https://youtu.be/AGS4b-kkiR8?t=40) [000m20s](https://youtu.be/VrradVYuQYU?t=20) |
| 115 | [Hoàng Mã Thương (Mau Giành Lợi Thế)](https://tqccl.com/doi-khac/hoang-ma-thuong-mau-gianh-loi-the/) | [000m08s](https://youtu.be/-vwpyxaT9ks?t=8) [002m08s](https://youtu.be/fnEUNcZUmqI?t=128) [003m12s](https://youtu.be/fnEUNcZUmqI?t=192) |
| 116 | [Hoàng Mã Thương (Nhân Lợi Chế Quyền)](https://tqccl.com/doi-khac/hoang-ma-thuong-nhan-loi-che-quyen/) | [007m40s](https://youtu.be/iFEJdMXzTy8?t=460) [000m54s](https://youtu.be/eDxpzZxDXo8?t=54) |
| 117 | [Hoàng Mã Cung](https://tqccl.com/doi-khac/hoang-ma-cung/) | [000m24s](https://youtu.be/eDxpzZxDXo8?t=24) [001m44s](https://youtu.be/AGS4b-kkiR8?t=104) |
| 118 | Bế Nguyệt Thuẫn (Toàn Quân Đồng Lòng) (chưa lên site) | [007m48s](https://youtu.be/iFEJdMXzTy8?t=468) [005m50s](https://youtu.be/fnEUNcZUmqI?t=350) [006m00s](https://youtu.be/fnEUNcZUmqI?t=360) |
| 119 | Bế Nguyệt Thuẫn (Thừa Địch Bất Ngu) (chưa lên site) | [001m08s](https://youtu.be/scZe9zuAckw?t=68) |
| 120 | [Kỳ Lân Cung (Tiểu Bang Thủ)](https://tqccl.com/doi-khac/ky-lan-cung-tieu-bang-thu/) | [000m24s](https://youtu.be/deVvRrbSR4w?t=24) [001m00s](https://youtu.be/deVvRrbSR4w?t=60) |
| 121 | [Kỳ Lân Cung (Thiêu Đốt Doanh Lũy)](https://tqccl.com/doi-khac/ky-lan-cung-thieu-dot-doanh-luy/) | [001m02s](https://youtu.be/iFegveMn4z0?t=62) |
| 122 | [Kỳ Lân Cung (có Đương Phong Thôi Quyết, Thịnh Khí Linh Địch)](https://tqccl.com/doi-khac/ky-lan-cung-co-duong-phong-thoi-quyet-thinh-khi-linh-dich/) | [000m52s](https://youtu.be/YVtssGwHfz8?t=52) [002m06s](https://youtu.be/YVtssGwHfz8?t=126) |
| 123 | [Thương nổi mạng](https://tqccl.com/doi-khac/thuong-noi-mang/) | [001m28s](https://youtu.be/scZe9zuAckw?t=88) [000m28s](https://youtu.be/dvOYA56_4gk?t=28) [001m02s](https://youtu.be/LM_wSM299wk?t=62) |
| 124 | [Thương nổi mạng (Thôi Phong Đoạn Nhẫn)](https://tqccl.com/doi-khac/thuong-noi-mang-thoi-phong-doan-nhan/) | [000m40s](https://youtu.be/deVvRrbSR4w?t=40) [001m22s](https://youtu.be/deVvRrbSR4w?t=82) |
| 125 | [Ngô Kỵ (Nằm Gai Nếm Mật)](https://tqccl.com/doi-khac/ngo-ky-nam-gai-nem-mat/) | [002m04s](https://youtu.be/YVtssGwHfz8?t=124) |
| 126 | [Ngô Kỵ (Thiết Kỵ Khu Trì)](https://tqccl.com/doi-khac/ngo-ky-thiet-ky-khu-tri/) | [000m18s](https://youtu.be/-vwpyxaT9ks?t=18) [002m04s](https://youtu.be/-vwpyxaT9ks?t=124) |
| 127 | [Đô Đốc Cung (Hòa Hán Cung)](https://tqccl.com/doi-khac/do-doc-cung-hoa-han-cung/) | [001m38s](https://youtu.be/YVtssGwHfz8?t=98) [000m38s](https://youtu.be/-vwpyxaT9ks?t=38) |
| 128 | [Quần Cung](https://tqccl.com/doi-khac/quan-cung-youtube-254/) | [001m44s](https://youtu.be/-vwpyxaT9ks?t=104) |
| 129 | [Ngũ Mưu Kỵ (Anh Thành Tự Thủ)](https://tqccl.com/doi-khac/ngu-muu-ky-anh-thanh-tu-thu/) | [001m36s](https://youtu.be/dvOYA56_4gk?t=96) [004m20s](https://youtu.be/tNne3heLCuQ?t=260) [004m44s](https://youtu.be/tNne3heLCuQ?t=284) |
| 130 | [Ngũ Mưu Kỵ (Sư Tử Phấn Tấn)](https://tqccl.com/doi-khac/ngu-muu-ky-su-tu-phan-tan/) | [001m40s](https://youtu.be/7Zbrf8VgbnQ?t=100) [002m04s](https://youtu.be/7Zbrf8VgbnQ?t=124) |
| 131 | [Phú Quý Kỵ (Tuân Du)](https://tqccl.com/doi-khac/phu-quy-ky-tuan-du/) | [003m22s](https://youtu.be/khGmfKDo9ng?t=202) [007m50s](https://youtu.be/khGmfKDo9ng?t=470) [007m30s](https://youtu.be/iFEJdMXzTy8?t=450) |
| 132 | [Thái Úy Thuẫn (Thừa Thắng Trường Khu)](https://tqccl.com/doi-khac/thai-uy-thuan-thua-thang-truong-khu/) | [001m40s](https://youtu.be/dvOYA56_4gk?t=100) |

