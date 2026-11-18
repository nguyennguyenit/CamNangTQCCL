# Mục Tra cứu bản ja còn thiếu bản dịch

Sinh bằng `node scripts/report-ja-gaps.mjs` (không sửa tay). Mục nằm đây khi hồ sơ ja (`lookupProfile` dưới `withLocale("ja")`) có khóa chữ Hán nguồn chưa có bản dịch máy trong `data/lookup-ja.json` (`untranslated`) hoặc bỏ phần chỉ có chữ Việt (`viOnly`); trang ja hiện một dòng báo thiếu.
Cột "Khóa chưa dịch" là khóa `texts` còn vắng (bảng khóa ở [ja-lookup-data.md](ja-lookup-data.md)); cột "Phần thiếu" so hồ sơ vi với hồ sơ ja của cùng mục.

Tổng: 147 / 1028 mục.

| Nhóm | Mục thiếu | Tổng mục |
|---|---:|---:|
| Tướng | 0 | 263 |
| Chiến pháp | 147 | 422 |
| Trang bị | 0 | 114 |
| Quân sư | 0 | 59 |
| Cải tạo binh chủng | 0 | 16 |
| Công trình | 0 | 41 |
| Binh thư | 0 | 68 |
| Kỳ lược | 0 | 45 |

## Trạng thái tên Nhật

`verified`: tên đã thấy trong nguồn Nhật (độ tin cao, gồm ảnh client Nhật). `derived`: đổi tự dạng từ chữ Hán nguồn hoặc nguồn chưa chắc; trang ja gắn nhãn 字形変換.

| Nhóm | verified | derived | Không có tên Nhật | Tổng mục |
|---|---:|---:|---:|---:|
| Tướng | 214 | 49 | 0 | 263 |
| Chiến pháp | 210 | 212 | 0 | 422 |
| Trang bị | 0 | 114 | 0 | 114 |
| Quân sư | 2 | 57 | 0 | 59 |
| Cải tạo binh chủng | 0 | 16 | 0 | 16 |
| Công trình | 0 | 41 | 0 | 41 |
| Binh thư | 29 | 39 | 0 | 68 |
| Kỳ lược | 27 | 18 | 0 | 45 |

## Tướng (heroes): 0 / 263

Không có mục nào thiếu.

## Chiến pháp (tactics): 147 / 422

| Mã | Tên | Khóa chưa dịch | Phần thiếu |
|---|---|---|---|
| tactic:an-ui-quan-dan | 慰撫軍民 · An Ủi Quân Dân | — | exchangeConditionVi, acquiredFromVi, revisions (2) |
| tactic:anh-thanh-tu-thu | 籠城自守 · Anh Thành Tự Thủ | — | exchangeConditionVi, acquiredFromVi |
| tactic:binh-vo-thuong-the | 兵無常勢 · Binh Vô Thường Thế | — | acquiredFromVi |
| tactic:bach-bo-xuyen-duong | 百歩穿楊 · Bách Phát Bách Trúng | — | revisions (2) |
| tactic:bach-ke-da-muu | 百計多謀 · Bách Kế Đa Mưu | — | revisions (4) |
| tactic:bach-ky-kiep-doanh | 百騎劫営 · Bách Kỵ Kiếp Doanh | effect | effect, revisions (2) |
| tactic:bach-nhi-binh | 白耳兵 · Bạch Nhị Binh | — | revisions (3) |
| tactic:be-nguyet | 羞花閉月 · Bế Nguyệt | — | revisions (3) |
| tactic:cao-lo-lien-doanh | 高櫓連営 · Cao Lỗ Liên Doanh | — | revisions (1) |
| tactic:chung-dong-van-ke | 衆妙奇計 · Chúng Động Vạn Kế | — | exchangeConditionVi, acquiredFromVi |
| tactic:cho-doi-xuat-phat | 整装雌伏 · Chờ Đợi Xuất Phát | — | exchangeConditionVi, acquiredFromVi |
| tactic:cuong-dung-vo-tien | 剛勇無比 · Vô Địch Can Trường | — | exchangeConditionVi, acquiredFromVi |
| tactic:cuoi-ngua-nghin-dam | 単騎千里 · Cưỡi Ngựa Nghìn Dặm | — | exchangeConditionVi, acquiredFromVi |
| tactic:cam-pham-bach-linh | 錦帆百翎 · Cẩm Phàm Bách Linh | effect | effect, revisions (4) |
| tactic:cat-xuong-tri-doc | 刮骨療毒 · Cắt Xương Trị Độc | — | conditions (1) |
| tactic:cu-thuy-doan-kieu | 据水断橋 · Dùng Nước Đẩy Cầu | — | exchangeConditionVi, acquiredFromVi |
| tactic:dung-liet-tri-trong | 勇烈持重 · Thận Trọng Anh Dũng | — | revisions (3) |
| tactic:dung-quan-tam-quan | 勇冠三軍 · Dũng Quán Tam Quân | — | revisions (3) |
| tactic:duong-suc-chong-dich | 以逸待労 · Dưỡng Sức Chống Địch | — | revisions (2) |
| tactic:dan-huyen-luc-chien | 引弦力戦 · Dẫn Huyền Lực Chiến | — | exchangeConditionVi, acquiredFromVi |
| tactic:giang-dong-manh-ho | 江東猛虎 · Giang Đông Mãnh Hổ | — | revisions (2) |
| tactic:giang-dong-tieu-ba-vuong | 江東小覇王 · Giang Đông Tiểu Bá Vương | — | revisions (2) |
| tactic:hiep-the-long-quyen | 挾勢弄権 · Ỷ Thế Cầm Quyền | — | exchangeConditionVi, acquiredFromVi |
| tactic:hoang-thien-thai-binh | 黄天太平 · Hoàng Thiên Thái Bình | — | revisions (2) |
| tactic:huyet-dao-tranh-gianh | 血刃争奪 · Huyết Đao Tranh Giành | — | exchangeConditionVi |
| tactic:ham-tran-doanh | 陥陣営 · Hãm Trận Doanh | — | revisions (2) |
| tactic:ham-tran-dot-tap | 遼来遼来 · Tập Kích Trận Địa | — | revisions (4) |
| tactic:hinh-nhat-tran | 形一陣 · Hình Nhất Trận | — | acquiredFromVi, revisions (3) |
| tactic:hoa-si-nguyen-lieu | 火熾原燎 · Lửa Lan Khắp Chốn | — | exchangeConditionVi, acquiredFromVi, revisions (2) |
| tactic:hoa-thieu-lien-doanh | 火焼連営 · Hỏa Thiêu Liên Doanh | effect | effect, revisions (4) |
| tactic:hoa-than-anh-phong | 火神英風 · Hỏa Thần Anh Phong | — | acquiredFromVi, revisions (3) |
| tactic:ho-gia-du-am | 胡笳余音 · Tiếng Sáo Dư Âm | effect | effect, revisions (4) |
| tactic:ho-bao-ky | 虎豹騎 · Hổ Báo Kỵ | — | revisions (3) |
| tactic:ho-cu-ung-duong | 虎踞鷹揚 · Hổ Cứ Ưng Dương | — | exchangeConditionVi, acquiredFromVi |
| tactic:ho-si | 虎痴 · Hổ Dại | — | revisions (3) |
| tactic:ho-ve-quan | 虎衛軍 · Quân Hổ Vệ | — | exchangeConditionVi, acquiredFromVi |
| tactic:khuynh-quoc-khuynh-thanh | 傾国傾城 · Đẹp Động Lòng Người | — | acquiredFromVi |
| tactic:khi-lang-tam-quan | 気凌三軍 · Khí Lăng Tam Quân | — | exchangeConditionVi, acquiredFromVi |
| tactic:kim-thanh-thang-tri | 湯池鉄城 · Thành Trì Vững Chắc | — | revisions (2) |
| tactic:kim-dan-bi-thuat | 金丹秘術 · Kim Đơn Mật Thuật | — | revisions (3) |
| tactic:kich-ky-noa-quy | 撃其惰帰 · Kích Kỳ Nọa Quy | — | exchangeConditionVi, acquiredFromVi |
| tactic:ke-hay-muu-gioi | 奇計良謀 · Kế Hay Mưu Giỏi | — | revisions (2) |
| tactic:ket-minh | 結盟 · Liên Minh | — | revisions (3) |
| tactic:ky-binh-gian-dao | 奇兵近道 · Kỳ Binh Gian Đạo | — | revisions (3) |
| tactic:lien-hoan-ke | 連環計 · Liên Hoàn Kế | — | revisions (3) |
| tactic:liem-chung-nhi-kich | 歛衆而撃 · Đánh Vào Chỗ Đông | — | exchangeConditionVi |
| tactic:lam-chien-tien-dang | 臨戦先駆 · Lâm Chiến Tiên Đăng | — | revisions (3) |
| tactic:linh-thanh-chau | 青州兵 · Lính Thanh Châu | — | acquiredFromVi, revisions (3) |
| tactic:loa-y-huyet-chien | 裸衣血戦 · Lõa Y Huyết Chiến | — | exchangeConditionVi, acquiredFromVi, revisions (3) |
| tactic:luy-the-lap-danh | 累世立名 · Công Danh Nhiều Đời | effect | effect, revisions (3) |
| tactic:nam-man-cu-khoi | 南蛮巨魁 · Nam Man Cự Khôi | — | revisions (4) |
| tactic:ngu-loi-oanh-dinh | 五雷轟天 · Ngũ Lôi Oanh Đỉnh | — | revisions (2) |
| tactic:nguy-thu-tuong-gian | 偽書疑心 · Ngụy Thư Tương Gian | — | revisions (3) |
| tactic:nhanh-tri-dong-nao | 霊機一動 · Nhanh Trí Động Não | — | exchangeConditionVi |
| tactic:nach-chien-quan-hung | 搦戦群雄 · Khiêu Chiến Quần Hùng | effect | effect, revisions (3) |
| tactic:nam-gai-nem-mat | 臥薪嘗胆 · Nằm Gai Nếm Mật | — | acquiredFromVi |
| tactic:quyet-thuy-hoi-thanh | 決水潰城 · Quyết Thủy Hội Thành | — | exchangeConditionVi, acquiredFromVi |
| tactic:quan-cam-pham | 錦帆軍 · Quân Cẩm Phàm | — | exchangeConditionVi, acquiredFromVi, revisions (2) |
| tactic:quy-than-dinh-uy | 鬼神霆威 · Quỷ Thần Đình Uy | — | exchangeConditionVi, acquiredFromVi |
| tactic:si-dieu-phuong-tu | 鴟苕鳳姿 · Si Điều Phượng Tư | — | revisions (2) |
| tactic:si-biet-tam-nhat | 刮目相待 · Sĩ Biệt Tam Nhật | — | conditions (1) |
| tactic:tam-the-tran | 三勢陣 · Tam Thế Trận | — | acquiredFromVi, revisions (2) |
| tactic:thanh-nang | 青嚢 · Thanh Nang | — | revisions (3) |
| tactic:thieu-dot-doanh-luy | 焚輜営塁 · Thiêu Đốt Doanh Lũy | — | exchangeConditionVi, revisions (4) |
| tactic:thiet-ky-khu-tri | 鉄騎駆馳 · Thiết Kỵ Khu Trì | — | exchangeConditionVi, acquiredFromVi, revisions (2) |
| tactic:thuyen-co-muon-ten | 草船借箭 · Thuyền Cỏ Mượn Tên | — | exchangeConditionVi, acquiredFromVi, conditions (1) |
| tactic:thai-binh-dao-phap | 太平道法 · Thái Bình Đạo Pháp | — | exchangeConditionVi, acquiredFromVi |
| tactic:than-co-dieu-toan | 神機妙算 · Thần Cơ Diệu Toán | — | revisions (2) |
| tactic:than-co-mac-trac | 神機莫測 · Thần Cơ Khó Đoán | effect | effect, revisions (4) |
| tactic:thap-dien-mai-phuc | 十面埋伏 · Thập Diện Mai Phục | — | revisions (2) |
| tactic:thap-nhi-ky-sach | 十二奇策 · Thập Nhị Kỳ Sách | — | revisions (2) |
| tactic:thu-nhi-tat-co | 守而必固 · Thủ Nhĩ Tất Cố | — | revisions (2) |
| tactic:thua-dich-bat-ngu | 乗敵不虞 · Thừa Địch Bất Ngu | — | revisions (2) |
| tactic:tinh-luyen-sach-so | 精錬策数 · Tinh Luyện Sách Số | — | revisions (2) |
| tactic:tiem-long-tran | 潜龍陣 · Tiềm Long Trận | — | exchangeConditionVi, acquiredFromVi, revisions (3) |
| tactic:toan-quan-dong-long | 衆志成城 · Toàn Quân Đồng Lòng | — | exchangeConditionVi, acquiredFromVi |
| tactic:truyen-hich-tuyen-uy | 伝檄宣威 · Truyền Hịch Tuyên Uy | — | exchangeConditionVi, acquiredFromVi, revisions (2) |
| tactic:tri-ke | 智計 · Trí Kế | — | revisions (3) |
| tactic:truong-khu-truc-nhap | 長駆直入 · Tiến Quân Thần Tốc | — | revisions (3) |
| tactic:tuyet-ky-cap-dao | 水路断截 · Tuyệt Kỳ Cấp Đạo | — | exchangeConditionVi, acquiredFromVi |
| tactic:tay-luong-thiet-ky | 西涼鉄騎 · Tây Lương Thiết Kỵ | — | revisions (2) |
| tactic:tuong-binh | 象兵 · Tượng Binh | — | acquiredFromVi, revisions (2) |
| tactic:toa-doan-dong-nam | 坐断東南 · Tọa Đoạn Đông Nam | — | revisions (3) |
| tactic:to-giang-dao-lo | 遡江揺櫓 · Nghịch Giang Diêu Lỗ | — | revisions (2) |
| tactic:tuu-tri-nhuc-lam | 酒池肉林 · Tửu Trì Nhục Lâm | — | revisions (4) |
| tactic:van-tu-anh-tong | 雲聚影従 · Văn Tụ Ảnh Tòng | — | acquiredFromVi |
| tactic:vo-phong-tran | 武鋒陣 · Võ Phong Trận | — | acquiredFromVi, revisions (4) |
| tactic:van-tru-quyet-toan | 奇策妙計 · Vận Trù Quyết Toán | — | revisions (2) |
| tactic:xe-dao-chuoc-dich | 掣刀斫敵 · Xế Đao Chước Địch | — | exchangeConditionVi, acquiredFromVi |
| tactic:yen-nhan-bao-hao | 燕人咆哮 · Yên Nhân Gào Thét | — | revisions (2) |
| tactic:doat-hon-hiep-phach | 昏迷乱擾 · Đoạt Hồn Hiệp Phách | — | conditions (1) |
| tactic:dai-quan-quyet-chien | 掲棺決戦 · Đài Quan Quyết Chiến | — | revisions (2) |
| tactic:danh-dau-thang-do | 万夫不当 · Đánh Đâu Thắng Đó | — | revisions (2) |
| tactic:dang-phong-ham-tran | 登鋒陥陣 · Đăng Phong Hãm Trận | — | revisions (3) |
| tactic:duong-phong-thoi-quyet | 剣鋒破砕 · Đương Phong Thôi Quyết | — | exchangeConditionVi, acquiredFromVi |
| tactic:dai-kich-si | 大戟士 · Đại Kích Sĩ | — | revisions (4) |
| tactic:doc-hanh-pho-dau | 独行赴闘 · Độc Hành Phó Đấu | — | exchangeConditionVi, revisions (2) |
| tactic:doc-tuyen-cu-thuc | 毒泉拒蜀 · Độc Tuyền Cự Thục | — | acquiredFromVi |
| tactic:biet-minh-biet-ta | 戦況見極 · Biết Mình Biết Ta | — | exchangeConditionVi, acquiredFromVi |
| tactic:giai-phien-ve | 解煩兵 · Giải Phiền Vệ | — | exchangeConditionVi, acquiredFromVi |
| tactic:khong-danh-ma-thang | 非攻制勝 · Không Đánh Mà Thắng | — | exchangeConditionVi, acquiredFromVi |
| tactic:lam-nguy-cuu-chu | 志操堅固 · Lâm Nguy Cứu Chủ | — | exchangeConditionVi, acquiredFromVi |
| tactic:lam-phong-quyet-dich | 臨鋒決闘 · Lâm Phong Quyết Địch | — | exchangeConditionVi, acquiredFromVi |
| tactic:phi-hung-quan | 飛熊軍 · Phi Hùng Quân | — | exchangeConditionVi, acquiredFromVi |
| tactic:tham-tang-nhuoc-hu | 玄虚深蔵 · Thâm Tàng Nhược Hư | — | exchangeConditionVi |
| tactic:thoi-phong-doan-nhan | 摧鋒断刃 · Thôi Phong Đoạn Nhẫn | — | exchangeConditionVi, acquiredFromVi |
| tactic:duong-suc-doi-chien | 伏機即動 · Dưỡng Sức Đợi Chiến | — | exchangeConditionVi, acquiredFromVi, conditions (1) |
| tactic:dong-long-hop-suc | 勠力同心 · Đồng Lòng Hợp Sức | — | exchangeConditionVi, acquiredFromVi |
| tactic:chung-vong-so-quy | 衆望所帰 · Đích Đến Cuối Cùng | — | exchangeConditionVi, acquiredFromVi |
| tactic:cuu-doc | 鴆毒 · Rượu Độc | effect | effect, revisions (3) |
| tactic:dan-duong-binh | 丹陽兵 · Lính Đan Dương | — | exchangeConditionVi, acquiredFromVi, revisions (2) |
| tactic:dao-vien-ket-nghia | 桃園結義 · Kết Nghĩa Vườn Đào | — | exchangeConditionVi, conditions (2) |
| tactic:duy-noi-thien-quyen | 帷内擅権 · Duy Nội Thiện Quyền | — | conditions (2) |
| tactic:huy-quan-ket-tran | 軍人結集 · Huy Quân Kết Trận | — | exchangeConditionVi |
| tactic:kien-cuong-chi-hoa | 堅強之花 · Hoa Kiên Cường | — | acquiredFromVi |
| tactic:lac-loi | 名文雷震 · Lạc Lôi | — | target |
| tactic:ngoc-co-hoa-mao | 玉肌花貌 · Ngọc Cơ Hoa Mạo | — | acquiredFromVi |
| tactic:phuc-my-phan-cong | 伏盾反攻 · Phục Khiên Phản Kích | — | acquiredFromVi |
| tactic:quy-than-chi-nu | 鬼神之女 · Quỷ Thần Chi Nữ | — | acquiredFromVi |
| tactic:quyen-tiem-cuu-dinh | 権僭九鼎 · Quyền Tiếm Cửu Đỉnh | — | acquiredFromVi |
| tactic:so-trang-trich-kich | 投擲画戟 · Sơ Trang Chiến Kích | — | exchangeConditionVi, revisions (2) |
| tactic:tam-quan-chi-chung | 三軍之衆 · Tam Quân Chi Chúng | — | acquiredFromVi |
| tactic:thau-thien-xung-de | 受禅称帝 · Thụ Thiền Xưng Đế | — | acquiredFromVi |
| tactic:thua-thien-tinh-the | 天意靖乱 · Thừa Thiên Tĩnh Thế | — | effectTypeVi |
| tactic:thuan-khiet-chi-hoa | 純潔之花 · Hoa Thuần Khiết | — | acquiredFromVi |
| tactic:thuong-lam-phong-thuc | 倉廩豊実 · Kho Lương Đầy Ắp | — | exchangeConditionVi, acquiredFromVi |
| tactic:tien-dang-tu-si | 先駆死士 · Tử Sĩ Tiên Phong | — | revisions (2) |
| tactic:toa-dieu-kinh-ngao | 坐釣鯨鰲 · Tọa Điếu Kình Ngao | — | acquiredFromVi |
| tactic:tuyet-ke-chiet-muu | 智計破謀 · Tuyệt Kế Chiết Mưu | — | conditions (2) |
| tactic:vo-thanh-chi-tu | 武聖之子 · Quân Thần Chi Tử | — | acquiredFromVi |
| tactic:tinh-bach-ma-nghia-tong | 精·白馬義従 · Tinh • Bạch Mã Nghĩa Tòng | — | conditions (6) |
| tactic:tinh-bach-nhi-binh | 精·白毦兵 · Tinh • Bạch Nhị Binh | — | conditions (7) |
| tactic:tinh-dai-kich-si | 精·大戟士 · Tinh • Đại Kích Sĩ | — | conditions (6) |
| tactic:tinh-giai-phien-ve | 精·解煩衛 · Tinh • Giải Phiền Vệ | — | conditions (7) |
| tactic:tinh-ham-tran-doanh | 精·陥陣営 · Tinh • Hãm Trận Doanh | — | conditions (6) |
| tactic:tinh-ho-bao-ky | 精·虎豹騎 · Tinh • Hổ Báo Kỵ | — | conditions (6) |
| tactic:tinh-linh-dan-duong | 精·丹陽兵 · Tinh • Lính Đan Dương | — | conditions (7) |
| tactic:tinh-linh-giap-may | 精·藤甲兵 · Tinh • Lính Giáp Mây | — | conditions (7) |
| tactic:tinh-linh-thanh-chau | 精·青州兵 · Tinh • Lính Thanh Châu | — | conditions (6) |
| tactic:tinh-nhanh-tri-dong-nao | 精・ひらめき · Tinh • Nhanh Trí Động Não | — | conditions (2) |
| tactic:tinh-phi-hung-quan | 精·飛熊軍 · Tinh • Phi Hùng Quân | — | conditions (7) |
| tactic:tinh-quan-cam-pham | 精·錦帆軍 · Tinh • Quân Cẩm Phàm | — | conditions (6) |
| tactic:tinh-quan-ho-ve | 精·虎衛軍 · Tinh • Quân Hổ Vệ | — | conditions (6) |
| tactic:tinh-tay-luong-thiet-ky | 精·西涼鉄騎 · Tinh • Tây Lương Thiết Kỵ | — | conditions (6) |
| tactic:tinh-tu-si-tien-phong | 精·先登死士 · Tinh • Tử Sĩ Tiên Phong | — | conditions (7) |
| tactic:tinh-tuong-binh | 精·象兵 · Tinh • Tượng Binh | — | conditions (6) |
| tactic:tinh-vo-duong-phi-quan | 精·無當飛軍 · Tinh • Vô Đương Phi Quân | — | conditions (7) |

## Trang bị (equipment): 0 / 114

Không có mục nào thiếu.

## Quân sư (advisors): 0 / 59

Không có mục nào thiếu.

## Cải tạo binh chủng (troop-mods): 0 / 16

Không có mục nào thiếu.

## Công trình (buildings): 0 / 41

Không có mục nào thiếu.

## Binh thư (books): 0 / 68

Không có mục nào thiếu.

## Kỳ lược (qilue): 0 / 45

Không có mục nào thiếu.
