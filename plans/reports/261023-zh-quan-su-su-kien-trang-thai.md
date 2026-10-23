# Chữ Hán cho 20 quân sư client, 17 sự kiện và 6 nhãn trạng thái

Ngày research: 2026-10-23. Phạm vi: tên chữ Hán trong game; không đánh giá mùa/server khác ngoài nhãn nguồn. Dữ liệu máy: local://zh-research.json (bản sao nội dung dưới đây).

## Kết luận

- **Quân sư:** cả 20 mục có tên giản thể ở 三略库 (sanzhan.slgsim.com/zh-hans), khớp tướng và hiệu ứng. Không nguồn TW nào có 20 mục này: SGSDeck /advisors (live) và slgsim zh-hant đều chỉ có 39 quân sư cũ. Vì vậy chưa thấy dạng phồn thể (trường zhHant để null).
- **Sửa bản dịch cũ:** zhTexts trong pipeline/lookup-client-tactics.json gắn cờ dịch từ tiếng Việt. Năm tên trong đó lệch với tên game: 計畫策算 → 奇画策算, 計畫周全 → 计出万全, 一往無前 → 蓄锐摧锋, 屯軍待戰 → 屯兵待战, 情牽擊逆 → 情牵戟逆. 15 tên còn lại khớp sau khi chuyển giản thể sang phồn thể.
- **Tướng mang khác gợi ý:** Bạch Mã Thay Chủ là 庞统, Hổ Vệ Thần Uy là 许褚, Tình Khiên Kích Nghịch là SP貂蝉, Võ Thánh Dương Uy là 关兴, Lao Thẳng Phía Trước là SP黄忠, Ký Họa Sách Toán là SP法正.
- Bạch Môn Nghịch Chiến = 白门逆战: **Đã đối chiếu** trên trang 情牵戟逆. Dạng phồn thể 白門逆戰 chưa thấy ở nguồn nào.
- **Sự kiện:** 16/17 sự kiện có tên phồn thể ở trang chiến pháp SGSDeck (TW). Dương Đông Kích Tây là 彭越撓楚, trùng tên nhận Bành Việt Nạo Sở; không nguồn nào ghi 聲東擊西 là tên sự kiện. Ép buộc thiên tử lệnh chư hầu là 挾天子令諸侯 (tên nhận 同力協契). Huy Quân Kết Trận = 麾軍結陣 là **Phương án từ nguồn**: SGSDeck không ghi nhãn sự kiện riêng, còn đoạn tóm tắt của 925g ghi "事件名为麾军结阵" nhưng chưa mở được bài.
- **Trạng thái:** đối chiếu với trường 效果衝突 của SGSDeck trên cùng chiến pháp: Phòng ngự 抵禦, Cùng truy 窮追, Tập kích 遇襲, Bắt Giữ 捕獲, Nhìn thấu 看破. Một quân khác = 其他單體 chỉ lấy từ chữ hiệu ứng 落雷, vì SGSDeck không có trường 作用目標 cho chiến pháp này (**Phương án từ nguồn**).

## Bảng

| Loại | Tiếng Việt | Chữ Hán | Trạng thái | URL |
| --- | --- | --- | --- | --- |
| Quân sư | ba-vuong-thao-nghich (孙策) | 霸王讨逆 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E9%9C%B8%E7%8E%8B%E8%AE%A8%E9%80%86-47/ |
| Quân sư | bach-ma-thay-chu (庞统) | 白马替主 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E7%99%BD%E9%A9%AC%E6%9B%BF%E4%B8%BB-61/ |
| Quân sư | chi-bay-tran (高顺) | 陷阵之志 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E9%99%B7%E9%98%B5%E4%B9%8B%E5%BF%97-38/ |
| Quân sư | chu-nghich-binh-phan (马岱) | 诛逆平叛 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%AF%9B%E9%80%86%E5%B9%B3%E5%8F%9B-46/ |
| Quân sư | don-doc-tham-nhap (徐晃) | 孤军深入 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E5%AD%A4%E5%86%9B%E6%B7%B1%E5%85%A5-26/ |
| Quân sư | don-quan-doi-chien (邓艾) | 屯兵待战 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E5%B1%AF%E5%85%B5%E5%BE%85%E6%88%98-63/ |
| Quân sư | hieu-lenh-thien-ha (曹操) | 号令天下 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E5%8F%B7%E4%BB%A4%E5%A4%A9%E4%B8%8B-62/ |
| Quân sư | ho-ve-than-uy (许褚) | 虎卫神威 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%99%8E%E5%8D%AB%E7%A5%9E%E5%A8%81-53/ |
| Quân sư | ke-hoach-chu-toan (陈宫) | 计出万全 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%AE%A1%E5%87%BA%E4%B8%87%E5%85%A8-52/ |
| Quân sư | ky-hoa-sach-toan (SP法正) | 奇画策算 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E5%A5%87%E7%94%BB%E7%AD%96%E7%AE%97-50/ |
| Quân sư | lao-thang-phia-truoc (SP黄忠) | 蓄锐摧锋 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%93%84%E9%94%90%E6%91%A7%E9%94%8B-51/ |
| Quân sư | sung-vinh-ai-dai (SP步练师) | 宠荣爱待 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E5%AE%A0%E8%8D%A3%E7%88%B1%E5%BE%85-54/ |
| Quân sư | tap-dia-doat-thanh (张燕) | 袭地夺城 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%A2%AD%E5%9C%B0%E5%A4%BA%E5%9F%8E-36/ |
| Quân sư | tay-luong-phi-hung (SP董卓) | 西凉飞熊 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%A5%BF%E5%87%89%E9%A3%9E%E7%86%8A-58/ |
| Quân sư | thien-cong-tuong-quan (张角) | 天公将军 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E5%A4%A9%E5%85%AC%E5%B0%86%E5%86%9B-14/ |
| Quân sư | tich-lich-xa-tran (SP刘晔) | 霹雳车阵 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E9%9C%B9%E9%9B%B3%E8%BD%A6%E9%98%B5-37/ |
| Quân sư | tiet-nghia-da-muu (王异) | 节义多谋 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E8%8A%82%E4%B9%89%E5%A4%9A%E8%B0%8B-64/ |
| Quân sư | tinh-khien-kich-nghich (SP貂蝉) | 情牵戟逆 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E6%83%85%E7%89%B5%E6%88%9F%E9%80%86-56/ |
| Quân sư | vo-kien-bat-ham (SP乐进) | 无坚不陷 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E6%97%A0%E5%9D%9A%E4%B8%8D%E9%99%B7-60/ |
| Quân sư | vo-thanh-duong-uy (关兴) | 武圣扬威 | Đã đối chiếu | https://sanzhan.slgsim.com/zh-hans/advisors/%E6%AD%A6%E5%9C%A3%E6%89%AC%E5%A8%81-57/ |
| Sự kiện | Giả Kế Thoát Hiểm | 詐計脫險 | Đã đối chiếu | https://sgsdeck.com/tactics/%E9%9D%88%E6%A9%9F%E4%B8%80%E5%8B%95 |
| Sự kiện | Bát Trận Đồ | 八陣圖 | Đã đối chiếu | https://sgsdeck.com/tactics/%E7%9C%BE%E5%BF%97%E6%88%90%E5%9F%8E |
| Sự kiện | Chia Ba Thiên Hạ (Tam Phân Thiên Hạ) | 三分天下 | Đã đối chiếu | https://sgsdeck.com/tactics/%E7%9F%A5%E5%B7%B1%E7%9F%A5%E5%BD%BC |
| Sự kiện | Giải Phiền Vệ | 解煩衛 | Đã đối chiếu | https://sgsdeck.com/tactics/%E8%A7%A3%E7%85%A9%E8%A1%9B |
| Sự kiện | Nước Ngập Thất Quân (Thủy Yêm Thất Quân) | 水淹七軍 | Đã đối chiếu | https://sgsdeck.com/tactics/%E9%9D%9E%E6%94%BB%E5%88%B6%E5%8B%9D |
| Sự kiện | Cắt Râu Vứt Áo | 割須棄袍 | Đã đối chiếu | https://sgsdeck.com/tactics/%E8%87%A8%E5%8D%B1%E6%95%91%E4%B8%BB |
| Sự kiện | Chung Hội Chi Loạn | 鍾會之亂 | Đã đối chiếu | https://sgsdeck.com/tactics/%E8%87%A8%E9%8B%92%E6%B1%BA%E6%95%B5 |
| Sự kiện | Dương Đông Kích Tây | 彭越撓楚 | Đã đối chiếu | https://sgsdeck.com/tactics/%E9%A3%9B%E7%86%8A%E8%BB%8D |
| Sự kiện | Trận Nam Quận | 南郡之戰 | Đã đối chiếu | https://sgsdeck.com/tactics/%E6%B7%B1%E8%97%8F%E8%8B%A5%E8%99%9B |
| Sự kiện | Tôn Sách bị thích sát | 孫策遇刺 | Đã đối chiếu | https://sgsdeck.com/tactics/%E6%91%A7%E9%8B%92%E6%96%B7%E5%88%83 |
| Sự kiện | Trận trảm Hạ Hầu Uyên | 陣斬夏侯淵 | Đã đối chiếu | https://sgsdeck.com/tactics/%E8%93%84%E5%8B%A2%E5%BE%85%E7%99%BC |
| Sự kiện | Ép buộc thiên tử lệnh chư hầu | 挾天子令諸侯 | Đã đối chiếu | https://sgsdeck.com/tactics/%E5%8B%A0%E5%8A%9B%E5%90%8C%E5%BF%83 |
| Sự kiện | Vu Cát Cầu Mưa | 于吉請雨 | Đã đối chiếu | https://sgsdeck.com/tactics/%E7%9C%BE%E6%9C%9B%E6%89%80%E6%AD%B8 |
| Sự kiện | Đan Dương Tinh Binh | 丹陽精兵 | Đã đối chiếu | https://sgsdeck.com/tactics/%E4%B8%B9%E9%99%BD%E5%85%B5 |
| Sự kiện | Huy Quân Kết Trận | 麾軍結陣 | Phương án từ nguồn | https://sgsdeck.com/tactics/%E9%BA%BE%E8%BB%8D%E7%B5%90%E9%99%A3 |
| Sự kiện | Đình Phụng Nghi | 鳳儀亭 | Đã đối chiếu | https://sgsdeck.com/tactics/%E6%A2%B3%E5%A6%9D%E6%93%B2%E6%88%9F |
| Sự kiện | Xây Dựng Đồn Điền (Kiến Trí Đồn Điền) | 建置屯田 | Đã đối chiếu | https://sgsdeck.com/tactics/%E5%80%89%E5%BB%A9%E8%B1%90%E5%AF%A6 |
| Trạng thái | Phòng ngự | 抵禦 / 抵御 | Đã đối chiếu | https://sgsdeck.com/tactics/%E7%99%BD%E8%A1%A3%E6%B8%A1%E6%B1%9F |
| Trạng thái | Cùng truy | 窮追 | Đã đối chiếu | https://sgsdeck.com/tactics/%E9%99%B7%E9%99%A3%E7%AA%81%E8%A5%B2 |
| Trạng thái | Tập kích | 遇襲 / 遇袭 | Đã đối chiếu | https://sgsdeck.com/tactics/%E9%90%B5%E9%A8%8E%E9%A9%85%E9%A6%B3 |
| Trạng thái | Bắt Giữ | 捕獲 / 捕获 | Đã đối chiếu | https://sgsdeck.com/tactics/%E6%9A%97%E7%AE%AD%E9%9B%A3%E9%98%B2 |
| Trạng thái | Nhìn thấu | 看破 | Đã đối chiếu | https://sgsdeck.com/tactics/%E5%A8%81%E6%AD%A6%E4%B8%A6%E6%98%AD |
| Trạng thái | Một quân khác | 其他單體 / 其他单体 | Phương án từ nguồn | https://sgsdeck.com/tactics/%E8%90%BD%E9%9B%B7 |

## Giới hạn

- 三略库 và SGSDeck là trang cộng đồng/không chính thức, không phải ảnh chụp client. Chưa có ảnh chụp client Global hoặc CN.
- Duckduckgo, Baidu và Sogou chặn truy vấn tự động (captcha). Chỉ một lượt Duckduckgo trả kết quả cho 麾軍結陣. 925g.com hết thời gian kết nối nên chưa mở được bài.
- Sổ ngân sách: kỹ năng mặc định 5 lượt nguồn ngoài; bài giao yêu cầu URL cho từng mục (43 mục) nên đã vượt mức đó. Đã dùng khoảng 95 lượt gọi ngoài (gồm các lượt lặp lại), 0 lượt TQCCL MCP.
- Chưa sửa dữ liệu runtime; các tên cần sửa được nêu trên để người thực hiện xử lý.
