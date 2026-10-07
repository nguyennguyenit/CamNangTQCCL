# Duyệt bản dịch 評價 + 取得管道 (SGSDeck)

Ngày: 2026-10-07. Phạm vi: mục **Đánh giá** (94 tướng) và **Cách nhận** (16 gói, 6 loại gói) trên hồ sơ Tra cứu tướng.
Nguồn: bản lưu SGSDeck `pipeline/sgsdeck-cache/` (fetchedAt 2026-09-12), đã dựng lại vào `data/sgsdeck/generals.json`.

## Quy ước dịch

| Chữ Hán | Bản Việt | Ghi chú |
|---|---|---|
| 必留一個 | Bắt buộc giữ 1 thẻ | |
| 可留一個 | Có thể giữ 1 thẻ | |
| 可不留 | Không cần giữ | |
| 多餘將 | Thẻ thừa | |
| 拆 X | rã lấy X | rã thẻ để học chiến pháp truyền thừa |
| 換 X | đổi X | dùng thẻ đổi chiến pháp sự kiện / binh chủng |
| 優先 / 酌情 / 其次 | ưu tiên / tùy tình hình / sau đó | |
| 升星 / 覺醒 | thăng sao / thức tỉnh | |
| 換典藏 | đổi bản sưu tầm | 典藏 = "Sưu tầm" như cờ `isCollectible` đang hiện trên web |
| 作內政 | dùng làm nội chính | |

Tên chiến pháp và tướng dùng đúng tên Việt đang có trong `data/tactics.json` / `data/heroes-dict.json`
(vd 折衝禦侮 → **Đánh Bại Quân Địch**, 杯蛇鬼車 → **Sợ Bóng Sợ Gió**), nên khác mockup trước ("Chiết Xung Ngự Vũ").

Nguồn gõ sai 4 tên, bản dịch dùng tên đúng của chiến pháp truyền thừa: 兵峰 → 兵鋒 (Binh Phong), 運籌帷幄 → 運籌決算
(Vận Trù Quyết Toán, truyền thừa của Trương Xuân Hoa), 擋風摧決 → 當鋒摧決 (Đương Phong Thôi Quyết), 乘勝不虞 → 乘敵不虞 (Thừa Địch Bất Ngu).
夏侯淵 thiếu động từ ("優先剛勇無前、擊其惰歸") — dịch là "đổi" vì cả hai là chiến pháp sự kiện.

## Tên gói (Cách nhận)

| Gói | Bản Việt | Loại gói | Bản Việt | Tỉ lệ lõi / thường |
|---|---|---|---|---|
| 名將 | Danh tướng | 名將卡包 | Gói Danh tướng | 34% / 66% |
| 典藏卡包 | Sưu tầm | 典藏卡包 | Gói Sưu tầm | 36% / 64% |
| 其疾如風 | Kỳ Tật Như Phong | EX小卡包（風林火山） | Gói EX (Phong Lâm Hỏa Sơn) | 41% / 59% |
| 其徐如林 | Kỳ Từ Như Lâm | EX小卡包（風林火山） | Gói EX (Phong Lâm Hỏa Sơn) | 41% / 59% |
| 侵略如火 | Xâm Lược Như Hỏa | EX小卡包（風林火山） | Gói EX (Phong Lâm Hỏa Sơn) | 41% / 59% |
| 不動如山 | Bất Động Như Sơn | EX小卡包（風林火山） | Gói EX (Phong Lâm Hỏa Sơn) | 41% / 59% |
| 懸權而動 | Huyền Quyền Nhi Động | EX小卡包（權陰雷） | Gói EX (Quyền Âm Lôi) | 41% / 59% |
| 難知如陰 | Nan Tri Như Âm | EX小卡包（權陰雷） | Gói EX (Quyền Âm Lôi) | 41% / 59% |
| 動如雷霆 | Động Như Lôi Đình | EX小卡包（權陰雷） | Gói EX (Quyền Âm Lôi) | 41% / 59% |
| PK 名將 I | PK Danh tướng I | PK名將卡包 | Gói Danh tướng PK | 54% / 46% |
| PK 名將 II | PK Danh tướng II | PK名將卡包 | Gói Danh tướng PK | 54% / 46% |
| PK 名將 III | PK Danh tướng III | PK名將卡包 | Gói Danh tướng PK | 47% / 53% |
| PK 名將 IV | PK Danh tướng IV | PK名將卡包 | Gói Danh tướng PK | 40% / 60% |
| S1 名將卡包 | Danh tướng S1 | 雙十一限定 | Giới hạn 11/11 | 31% / 69% |
| S2 名將卡包 | Danh tướng S2 | 雙十一限定 | Giới hạn 11/11 | 32% / 68% |
| S3 名將卡包 | Danh tướng S3 | 雙十一限定 | Giới hạn 11/11 | 33% / 67% |

## Đánh giá (94 tướng)

| Tướng | Chữ Hán | Nguồn | Bản Việt |
|---|---|---|---|
| SP Điển Vi | SP 典韋 | 可留一個，優先拆折衝禦侮、酌情換虎衛軍，其次升星 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Đánh Bại Quân Địch, tùy tình hình đổi Hổ Vệ Quân, sau đó thăng sao. |
| SP Chu Du | SP 周瑜 | 必留一個，多餘將酌情拆焰逐風飛，其次升星。有SP諸葛亮優先拆SP諸葛亮 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Lửa Đuổi Gió Bay, sau đó thăng sao. Nếu có SP Gia Cát Lượng thì ưu tiên rã SP Gia Cát Lượng. |
| SP Tôn Kiên | SP 孫堅 | 可留一個，優先換三勢陣、酌情拆挫銳，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên đổi Tam Thế Trận, tùy tình hình rã lấy Tỏa Nhuệ, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| SP Chu Tuấn | SP 朱儁 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| SP Pháp Chính | SP 法正 | 必留一個，多餘將優先換擊其惰歸、酌情拆沉沙決水，其次升星、覺醒 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi Kích Kỳ Nọa Quy, tùy tình hình rã lấy Trầm Sa Quyết Thủy, sau đó thăng sao, thức tỉnh. |
| SP Tuân Úc | SP 荀彧 | 可不留，優先拆四面楚歌、酌情換決水潰城、青州兵，其次作內政、覺醒 | Không cần giữ. Ưu tiên rã lấy Tứ Diện Sở Ca, tùy tình hình đổi Quyết Thủy Hội Thành, Lính Thanh Châu, sau đó dùng làm nội chính, thức tỉnh. |
| SP Đổng Trác | SP 董卓 | 可留一個，優先拆暴戾無仁、換火熾原燎，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Bạo Lệ Vô Nhân, đổi Hỏa Sí Nguyên Liệu, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| SP Viên Thiệu | SP 袁紹 | 必留一個，多餘將優先拆箕型陣，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Cơ Hình Trận, sau đó thăng sao. |
| SP Hứa Chử | SP 許褚 | 可留一個，多餘將優先換裸衣血戰，其次酌情拆所向披靡 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên đổi Lõa Y Huyết Chiến, sau đó tùy tình hình rã lấy Đánh Đâu Thắng Đó. |
| SP Gia Cát Lượng | SP 諸葛亮 | 必留一個，多餘將酌情拆焰逐風飛，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Lửa Đuổi Gió Bay, sau đó thăng sao. |
| SP Điêu Thuyền | SP 貂蟬 | 可留一個，多餘將酌情拆傾國傾城，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Khuynh Quốc Khuynh Thành, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| SP Quách Gia | SP 郭嘉 | 必留一個 | Bắt buộc giữ 1 thẻ. |
| SP Quan Vũ | SP 關羽 | 有劉備張飛必留一個，多餘將優先拆橫掃千軍，其次升星 | Nếu có Lưu Bị và Trương Phi thì bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Hoành Tảo Thiên Quân, sau đó thăng sao. |
| SP Mã Siêu | SP 馬超 | 必留一個，多餘將優先換裸衣血戰，其次優先拆所向披靡，酌情換鐵騎驅馳 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi Lõa Y Huyết Chiến, sau đó ưu tiên rã lấy Đánh Đâu Thắng Đó, tùy tình hình đổi Thiết Kỵ Khu Trì. |
| SP Hoàng Trung | SP 黃忠 | 可留一個，多餘將優先拆萬箭齊發，其次換擊其惰歸 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Vạn Tiễn Tề Phát, sau đó đổi Kích Kỳ Nọa Quy. |
| SP Hoàng Nguyệt Anh | SP 黃月英 | 必留一個，多餘將優先拆鋒矢陣，其次升星、覺醒 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Phong Thi Trận, sau đó thăng sao, thức tỉnh. |
| Vũ Cát | 于吉 | 可留一個，多餘將優先拆杯蛇鬼車，其次升星、覺醒 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Sợ Bóng Sợ Gió, sau đó thăng sao, thức tỉnh. |
| Vu Cấm | 于禁 | 可留一個，優先換草船借箭、酌情拆克敵制勝，其次升星、覺醒 | Có thể giữ 1 thẻ. Ưu tiên đổi Thuyền Cỏ Mượn Tên, tùy tình hình rã lấy Khắc Địch Chế Thắng, sau đó thăng sao, thức tỉnh. |
| Ngột Đột Cốt | 兀突骨 | 可不留，優先拆藤甲兵，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Lính Giáp Mây, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Công Tôn Toản | 公孫瓚 | 可留一個，優先拆白馬義從、換三勢陣，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Bạch Mã Nghĩa Tòng, đổi Tam Thế Trận, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Lưu Bị | 劉備 | 必留一個，多餘將優先換撫輯軍民，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi An Ủi Quân Dân, sau đó thăng sao. |
| Tư Mã Ý | 司馬懿 | 必留一個，多餘將優先拆用武通神，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Dụng Võ Thần Thông, sau đó thăng sao. |
| Lữ Bố | 呂布 | 必留一個，多餘將優先拆一騎當千、換鬼神霆威，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Nhất Kỵ Đương Thiên, đổi Quỷ Thần Đình Uy, sau đó thăng sao. |
| Lữ Linh Ỷ | 呂玲綺 | 可留一個，優先拆絕地反擊，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Tuyệt Địa Phản Kích, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Lữ Mông | 呂蒙 | 可留一個，優先拆士別三日，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Sĩ Biệt Tam Nhật, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Chu Thái | 周泰 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| Chu Du | 周瑜 | 必留一個，多餘將優先換草船借箭、酌情換虎踞鷹揚，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi Thuyền Cỏ Mượn Tên, tùy tình hình đổi Hổ Cứ Ưng Dương, sau đó thăng sao. |
| Nghiêm Nhan | 嚴顏 | 可不留，優先拆一力拒守，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Nhất Lực Cự Thủ, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Hạ Hầu Đôn | 夏侯惇 | 可留一個，多餘將換剛勇無前、酌情拆絕地反擊，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Thẻ thừa đổi Cương Dũng Vô Tiền, tùy tình hình rã lấy Tuyệt Địa Phản Kích, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Hạ Hầu Uyên | 夏侯淵 | 必留一個，多餘將優先剛勇無前、擊其惰歸，酌情拆萬箭齊發 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi Cương Dũng Vô Tiền, Kích Kỳ Nọa Quy, tùy tình hình rã lấy Vạn Tiễn Tề Phát. |
| Thái Sử Từ | 太史慈 | 必留一個，多餘將優先拆折衝禦侮，酌情換血刃爭鋒，其次升星。有典韋優先拆典韋 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Đánh Bại Quân Địch, tùy tình hình đổi Huyết Đao Tranh Giành, sau đó thăng sao. Nếu có Điển Vi thì ưu tiên rã Điển Vi. |
| Khương Duy | 姜維 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| Mạnh Hoạch | 孟獲 | 可留一個，多餘將酌情拆兵峰，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Binh Phong, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Tôn Thượng Hương | 孫尚香 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| Tôn Quyền | 孫權 | 必留一個，多餘將優先拆臥薪嚐膽，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Nằm Gai Nếm Mật, sau đó thăng sao. |
| Tôn Sách | 孫策 | 可留一個，優先拆破陣摧堅、酌情換虎踞鷹揚、血刃爭鋒，其次酌情覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Phá Trận Thôi Kiên, tùy tình hình đổi Hổ Cứ Ưng Dương, Huyết Đao Tranh Giành, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Tả Từ | 左慈 | 必留一個，多餘將酌情拆杯蛇鬼車，其次升星。有于吉優先拆于吉 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Sợ Bóng Sợ Gió, sau đó thăng sao. Nếu có Vũ Cát thì ưu tiên rã Vũ Cát. |
| Trương Cơ | 張姬 | 可留一個，優先拆勇者得前，其次升星、覺醒 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Dũng Giả Đắc Tiền, sau đó thăng sao, thức tỉnh. |
| Trương Xuân Hoa | 張春華 | 必留一個，多餘將酌情拆運籌帷幄，其次升星、覺醒 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Vận Trù Quyết Toán, sau đó thăng sao, thức tỉnh. |
| Trương Bào | 張苞 | 張苞關興打包上陣，可留一個，有多餘張苞或關興可酌情拆士爭先赴 | Trương Bào và Quan Hưng ra trận cùng nhau, có thể giữ 1 thẻ. Có Trương Bào hoặc Quan Hưng thừa thì tùy tình hình rã lấy Sĩ Tranh Tiên Phó. |
| Trương Giác | 張角 | 可留一個，優先換太平道法，其次升星、覺醒 | Có thể giữ 1 thẻ. Ưu tiên đổi Thái Bình Đạo Pháp, sau đó thăng sao, thức tỉnh. |
| Trương Liêu | 張遼 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| Trương Cáp | 張郃 | 可不留，優先換武鋒陣，其次換絕其汲道，玩關銀屏槍隊優先拆大戟士 | Không cần giữ. Ưu tiên đổi Võ Phong Trận, sau đó đổi Tuyệt Kỳ Cấp Đạo. Nếu chơi đội thương Quan Ngân Bình thì ưu tiên rã lấy Đại Kích Sĩ. |
| Trương Phi | 張飛 | 必留一個，多餘將優先換據水斷橋，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi Cứ Thủy Đoạn Kiều, sau đó thăng sao. |
| Từ Thứ | 徐庶 | 可留一個，優先拆暫避其鋒，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Tạm Lánh Sóng Gió, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Từ Hoảng | 徐晃 | 可留一個，多餘將優先換武鋒陣，其次升星、覺醒 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên đổi Võ Phong Trận, sau đó thăng sao, thức tỉnh. |
| Văn Sửu | 文醜 | 可不留，優先拆破陣摧堅，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Phá Trận Thôi Kiên, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Tào Nhân | 曹仁 | 可留一個，優先拆八門金鎖陣，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Bát Môn Kim Tỏa Trận, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Tào Tháo | 曹操 | 必留一個，多餘將優先換嬰城自守，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên đổi Anh Thành Tự Thủ, sau đó thăng sao. |
| Tào Thuần | 曹純 | 可不留，優先拆虎豹騎，其次覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Hổ Báo Kỵ, sau đó thức tỉnh, đổi bản sưu tầm. |
| Mộc Lộc Đại Vương | 木鹿大王 | 可不留，優先拆象兵，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Tượng Binh, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Lý Nho | 李儒 | 可留一個，優先拆四面楚歌、換火熾原燎，其次酌情覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Tứ Diện Sở Ca, đổi Hỏa Sí Nguyên Liệu, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Nhạc Tiến | 樂進 | 可留一個，多餘將優先拆鋒矢陣、換據水斷橋，其次升星、覺醒 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Phong Thi Trận, đổi Cứ Thủy Đoạn Kiều, sau đó thăng sao, thức tỉnh. |
| Thư Thụ | 沮授 | 可留一個，優先拆威謀靡亢，其次升星 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Uy Mưu Vô Địch, sau đó thăng sao. |
| Mãn Sủng | 滿寵 | 必留一個，多餘將優先升星。 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| Vương Nguyên Cơ | 王元姬 | 必留一個，多餘將優先拆速乘其利，其次升星、覺醒 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Mau Giành Lợi Thế, sau đó thăng sao, thức tỉnh. |
| Vương Bình | 王平 | 可不留，優先拆無當飛軍、換絕其汲道，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Vô Đương Phi Quân, đổi Tuyệt Kỳ Cấp Đạo, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Vương Song | 王雙 | 可留一個，多餘將優先拆破軍威勝。S8新武將，待實戰。 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Phá Quân Uy Thắng. Tướng mới của S8, chờ kiểm chứng thực chiến. |
| Cam Ninh | 甘寧 | 必留一個，多餘將優先拆百騎劫營、酌情換錦帆軍，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Bách Kỵ Kiếp Doanh, tùy tình hình đổi Quân Cẩm Phàm, sau đó thăng sao. |
| Điền Phong | 田豐 | 可留一個，優先拆兵無常勢，其次酌情覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Binh Vô Thường Thế, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Chúc Dung Phu Nhân | 祝融夫人 | 必留一個，多餘將酌情拆兵無常勢，其次酌情升星、覺醒 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Binh Vô Thường Thế, sau đó tùy tình hình thăng sao, thức tỉnh. |
| Trình Dục | 程昱 | 必留一個，有賈詡多餘將優先升星 | Bắt buộc giữ 1 thẻ. Nếu có Giả Hủ thì thẻ thừa ưu tiên thăng sao. |
| Trình Phổ | 程普 | 必留一個，多餘將酌情拆克敵制勝，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Khắc Địch Chế Thắng, sau đó thăng sao. |
| Tuân Du | 荀攸 | 可留一個，多餘將酌情拆運籌決算，其次升星、覺醒 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Vận Trù Quyết Toán, sau đó thăng sao, thức tỉnh. |
| Hoa Đà | 華佗 | 可留一個，優先拆刮骨療毒，其次升星、覺醒 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Cắt Xương Trị Độc, sau đó thăng sao, thức tỉnh. |
| Hoa Hùng | 華雄 | 可不留，酌情換氣凌三軍、拆誘敵深入，其次酌情覺醒、換典藏 | Không cần giữ. Tùy tình hình đổi Khí Lăng Tam Quân, rã lấy Dụ Địch Thâm Nhập, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Thái Văn Cơ | 蔡文姬 | 必留一個，多餘將酌情拆奪魂挾魄，其次升星。有小喬優先拆小喬 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Đoạt Hồn Hiệp Phách, sau đó thăng sao. Nếu có Tiểu Kiều thì ưu tiên rã Tiểu Kiều. |
| Viên Thiệu | 袁紹 | 可留一個，優先換三勢陣、武鋒陣，其次酌情覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên đổi Tam Thế Trận, Võ Phong Trận, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Viên Thuật | 袁術 | 可留一個，多餘將酌情拆形機軍略，其次升星 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Hình Cơ Quân Lược, sau đó thăng sao. |
| Hứa Du | 許攸 | 必留一個 | Bắt buộc giữ 1 thẻ. |
| Gia Cát Lượng | 諸葛亮 | 必留一個，多餘將換草船借箭，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa đổi Thuyền Cỏ Mượn Tên, sau đó thăng sao. |
| Giả Hủ | 賈詡 | 必留一個，多餘將酌情拆偽書相間，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Ngụy Thư Tương Gian, sau đó thăng sao. |
| Triệu Vân | 趙雲 | 必留一個，多餘將優先拆橫掃千軍，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Hoành Tảo Thiên Quân, sau đó thăng sao. |
| Hác Chiêu | 郝昭 | 必留一個，多餘將優先升星，玩三勢呂酌情拆橫戈躍馬 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao; nếu chơi đội Lữ Bố Tam Thế Trận thì tùy tình hình rã lấy Hoành Qua Dược Mã. |
| Quách Gia | 郭嘉 | 必留一個，多餘將酌情拆沉沙決水，其次升星、覺醒 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Trầm Sa Quyết Thủy, sau đó thăng sao, thức tỉnh. |
| Trâu Thị | 鄒氏 | 可留一個 | Có thể giữ 1 thẻ. |
| Đặng Ngải | 鄧艾 | 可留一個，多餘將優先拆文武雙全，其次酌情覺醒、換典藏 | Có thể giữ 1 thẻ. Thẻ thừa ưu tiên rã lấy Văn Võ Song Toàn, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Chung Hội | 鍾會 | 可留一個，多餘將酌情拆文武雙全，其次升星、覺醒 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Văn Võ Song Toàn, sau đó thăng sao, thức tỉnh. |
| Quan Hưng | 關興 | 張苞關興打包上陣，可留一個，有多餘張苞或關興可酌情拆士爭先赴 | Trương Bào và Quan Hưng ra trận cùng nhau, có thể giữ 1 thẻ. Có Trương Bào hoặc Quan Hưng thừa thì tùy tình hình rã lấy Sĩ Tranh Tiên Phó. |
| Quan Ngân Bình | 關銀屏 | 必留一個，多餘將酌情拆箕型陣，其次升星。有SP袁紹優先拆SP袁紹 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Cơ Hình Trận, sau đó thăng sao. Nếu có SP Viên Thiệu thì ưu tiên rã SP Viên Thiệu. |
| Trần Đáo | 陳到 | 可不留，優先拆白毦兵，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Bạch Nhị Binh, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Trần Cung | 陳宮 | 必留一個，多餘將酌情拆智計，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Trí Kế, sau đó thăng sao. |
| Lục Kháng | 陸抗 | 可留一個，多餘將酌情換乘勝長驅，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình đổi Thừa Thắng Trường Khu, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Lục Tốn | 陸遜 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |
| Nhan Lương | 顏良 | 可不留，優先換擋風摧決、拆盛氣凌敵，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên đổi Đương Phong Thôi Quyết, rã lấy Thịnh Khí Linh Địch, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Mã Vân Lộc | 馬雲祿 | 可留一個，多餘將酌情拆乘勝不虞，其次升星、覺醒 | Có thể giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Thừa Địch Bất Ngu, sau đó thăng sao, thức tỉnh. |
| Mã Đằng | 馬騰 | 可不留，優先拆西涼鐵騎、換武鋒陣、酌情換鐵騎驅馳，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Tây Lương Thiết Kỵ, đổi Võ Phong Trận, tùy tình hình đổi Thiết Kỵ Khu Trì, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Cao Lãm | 高覽 | 可不留，優先換武鋒陣、酌情拆乘勝長驅，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên đổi Võ Phong Trận, tùy tình hình rã lấy Thừa Thắng Trường Khu, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Cao Thuận | 高順 | 可不留，優先拆陷陣營，其次酌情覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Hãm Trận Doanh, sau đó tùy tình hình thức tỉnh, đổi bản sưu tầm. |
| Ngụy Diên | 魏延 | 必留一個，多餘將酌情拆威謀靡亢，其次升星。有沮授優先拆沮授 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Uy Mưu Vô Địch, sau đó thăng sao. Nếu có Thư Thụ thì ưu tiên rã Thư Thụ. |
| Lỗ Túc | 魯肅 | 必留一個，多餘將酌情拆奇計良謀，其次升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa tùy tình hình rã lấy Kế Hay Mưu Giỏi, sau đó thăng sao. |
| Hoàng Cái | 黃蓋 | 可留一個，優先拆風助火勢，其次酌情升星、覺醒、換典藏 | Có thể giữ 1 thẻ. Ưu tiên rã lấy Phong Trợ Hỏa Thế, sau đó tùy tình hình thăng sao, thức tỉnh, đổi bản sưu tầm. |
| Bàng Đức | 龐德 | 可不留，優先拆暫避其鋒、酌情換鐵騎驅馳，其次覺醒、換典藏 | Không cần giữ. Ưu tiên rã lấy Tạm Lánh Sóng Gió, tùy tình hình đổi Thiết Kỵ Khu Trì, sau đó thức tỉnh, đổi bản sưu tầm. |
| Bàng Thống | 龐統 | 必留一個，多餘將優先升星 | Bắt buộc giữ 1 thẻ. Thẻ thừa ưu tiên thăng sao. |

## Sửa sau duyệt (2026-10-07)

Chủ repo báo đoạn của SP Tuân Úc là lời khuyên cho Tuân Úc thường. Kiểm tra cho thấy SGSDeck gắn 評價 của bản
thường vào bản SP ở 11 tướng: SP Quan Vũ, SP Điển Vi, SP Hứa Chử, SP Tuân Úc, SP Mã Siêu, SP Hoàng Trung,
SP Hoàng Nguyệt Anh, SP Pháp Chính, SP Tôn Kiên, SP Đổng Trác, SP Điêu Thuyền. Bằng chứng: danh sách nguồn ngày
2022-01-24 (tới khoảng S11), các bản SP này ra mắt S13–S25; chiến pháp "拆" là truyền thừa của bản thường; bản
thường không có 評價 riêng. Bản dịch giữ nguyên chữ, chỉ chuyển sang hồ sơ bản thường (`USAGE_REASSIGNMENTS`
trong `pipeline/build_unified_lookup.py`).
