# Đối chiếu video kazten "SP曹操対策" (S27) với Đội chuẩn PK-S27 và SGSDeck

- Ngày nghiên cứu: 2026-11-16
- Topic: đội đối kháng SP Tào Tháo (漢室弓) trong video kazten, so với Đội chuẩn PK-S27 của cẩm nang
- Nguồn: [SP曹操対策に虎臣盾⁉ S27最強編成:漢室弓の対策編成を徹底解説します！](https://www.youtube.com/watch?v=79LwxX01G5Y), kênh kazten, đăng 2026-11-15, dài 23:37. Video không có phụ đề.
- Phạm vi: máy chủ Nhật (三国志真戦), mùa S27 (漢焔不滅). Chưa xác minh có áp dụng cho máy chủ VN không.
- Cách đọc: tải video, trích frame mỗi 2 giây rồi đọc các slide đội hình và màn chiến báo. Âm thanh chưa nghe.
- SGSDeck: đã đối chiếu ngày 2026-11-16, xem mục "SGSDeck (đọc lại 2026-11-16)". Riêng đội CO Đại Kiều · Trương Liêu · SP Điêu Thuyền: chưa có mốc SGSDeck đã xác minh.
- Dữ liệu cẩm nang: `main` @ 8adc44d, `data:9a20976dfc24`, 128 cấu hình PK-S27 (lấy qua CLI `tqccl_find_teams` / `tqccl_get_team`). Đây là quan sát runtime của dự án, không phải bằng chứng cơ chế.

## Kết quả

Trạng thái mọi đội dưới đây: **Phương án từ nguồn** (một nguồn, máy chủ JP).

### Chưa có trong cẩm nang

| Đội trong video | Tướng (chiến pháp JP) | Ghi chú |
|---|---|---|
| CO Đại Kiều · Trương Liêu · SP Điêu Thuyền | 無双大喬 (草船借箭・独行赴闘) · 張遼 (剣鋒破砕・摧鋒断刃) · SP貂蝉 (戮力同心・潜龍陣) | Slide khoảng 990s. Cẩm nang PK-S27 không có đội nào dùng Đại Kiều. |
| 40Y Lữ Bố · Hứa Du · SP Pháp Chính | 40Y呂布 (血刃争奪・雄図待時) · 許攸 (志操堅固・藤甲兵) · SP法正 (三勢陣・伏機即動) | Slide khoảng 1266s, ngay sau phần giới thiệu blog 虎臣盾 của 石虎; nhiều khả năng đây là "虎臣盾" ở tiêu đề [INFERENCE]. Slide ghi chú: 40Y呂布 cần luyện binh S mọi binh chủng; 許攸 cần bảo vật binh chủng thuẫn. Cẩm nang PK-S27 không có đội nào dùng 40Y Lữ Bố. |
| CO Đại Kiều · Trương Liêu · Hứa Du | Chỉ thấy trong chiến báo khoảng 1040s, không có slide | Biến thể của đội Đại Kiều phía trên, chưa đủ dữ liệu để thành cấu hình. |

### Có bộ ba tướng trong cẩm nang, cấu hình chiến pháp khác

| Đội trong video | Cấu hình gần nhất trong cẩm nang | Khác biệt |
|---|---|---|
| SP Tuân Úc · Tuân Du · SP Quách Gia (竭力佐謀・刮骨療毒 / 霊気一動・転獅子奮迅 / 昏迷乱擾・上兵破謀) | Tuân Du Ngũ Mưu (bản cùng tồn Thi Nhân), T1 | SP Quách Gia trong video dùng 昏迷乱擾 thay 奪魂挾魄; Tuân Du dùng bản 転 của 獅子奮迅. |
| SP Chu Du · SP Lữ Mông · Lục Tốn (衆志成城・戮力同心 / 転形一陣・草船借箭 / 功不唐捐・乗敵不虔) | Đô Thống Cung (bản đầu tiên của Tiểu Bang Thủ), T0.5 | SP Chu Du dùng 戮力同心 thay 士別三日; Lục Tốn dùng 乗敵不虔 thay 萬軍奪帥; SP Lữ Mông dùng bản 転 của 形一陣. |
| Bàng Thống · Gia Cát Lượng · SP Pháp Chính (杯中蛇影・刮目相待 / 刮骨療毒・乗敵不虔 / 伏機即動・拓鎮扼防拒) | Thục Trí Thuẫn, T0.5 | Bàng Thống dùng 杯中蛇影 thay 太平道法; Gia Cát Lượng dùng 刮骨療毒 thay 藤甲兵. |
| Viên Thuật · SP Chu Tuấn · Chu Thái (転獅子奮迅・上兵破謀 / 太平道法・無當飛軍 / 意気衝天・八門金鎖の陣) | Hạt Nhân Chu Tuấn, không xếp tier | Viên Thuật dùng 転獅子奮迅 thay 焚營; Chu Thái dùng 意気衝天・八門金鎖陣 thay 盛氣凌敵・潛龍陣. |
| SP Mã Siêu · SP Hoàng Phủ Tung · Hứa Du (剣鋒破砕・摧鋒断刃 / 草船借箭・藤甲兵 / 伏機即動・志操堅固) | Các bản Hoàng Mã, T0 | SP Hoàng Phủ Tung dùng 藤甲兵; Hứa Du dùng 伏機即動・志操堅固. Không bản nào trong cẩm nang khớp đủ. |
| Cam Ninh · Thái Sử Từ · Chu Thái (臨鋒決闘・一騎当千 / 折衝禦侮・剣鋒破砕 / 赴湯踏火・志操堅固) | Hổ Thần Cung, T0.5 | Chỉ trùng 折衝禦侮; Cam Ninh và Chu Thái khác hẳn. |
| SP Quan Vũ · Mã Đại · Pháp Chính | Mã Đại Pháp Quan Thuẫn, T0/T0.5 | Chỉ thấy trong chiến báo, không có slide. |
| Hứa Du · Lữ Bố · Tả Từ | Ôn Hầu Cung / Tả Lữ Thương | Chỉ thấy trong chiến báo, có nhiều cách xếp chiến pháp. |

## Giới hạn

- Tên chiến pháp tiếng Nhật chưa map 1-1 sang bản Trung/Việt. Phần so khớp trên là theo bộ ba tướng; khác biệt chiến pháp đọc thủ công.
  - Một số tên JP có thể chỉ là tên dịch khác của cùng một chiến pháp, ví dụ 剣鋒破砕 có thể là 當鋒摧決, 刮目相待 có thể là 士別三日. Các cặp này **Chưa xác minh**.
- Tiền tố 転 (ví dụ 転獅子奮迅, 転形一陣) khớp với tiền tố "Chuyển" trong shop chiến pháp mùa của client VN. Đây là quan sát của người dùng; 転 là phiên bản chuyển hóa nào thì **Chưa xác minh**.
- Video là phần giới thiệu đối kháng của một người chơi, không phải bảng tier. Mình không tự gán tier.

## SGSDeck (đọc lại 2026-11-16)

Đã đọc [danh sách PK-S27 交戰](https://sgsdeck.com/recommended?season=pk-s27&category=%E4%BA%A4%E6%88%B0): 138 cấu hình (T0: 37, T0.5: 47, T1: 41, T1.5: 11, T2: 2). So với 128 cấu hình PK-S27 trong cẩm nang (`data:9a20976dfc24`, refresh SGSDeck 2026-11-03), **SGSDeck có thêm 23 cấu hình**. Phần lớn có id `official-*` (nguồn: fanpage chính thức máy chủ Đài Loan) hoặc `ofw-*` (sách trắng cải tiến đội hình của máy chủ Đài Loan, 2026-11-10). Tier của 115 cấu hình trùng id đều giống nhau. Chưa đối chiếu chiến pháp từng cấu hình.

| Tier | Cấu hình SGSDeck mới (chưa có trong cẩm nang) |
|---|---|
| T0 | s27-official-lv-diao-lu-gong (40Y 呂貂盧弓), s27-ofw-han-2plus1-gong (SP 曹操漢陣營 2+1 弓), s27-official-sanshi-lvbu-dun (三勢 40Y 呂布盾), s27-official-erqiao-gong (二喬弓: 無雙大喬·孫尚香·無雙小喬), s27-official-wumou-qi, s27-official-dahan-gong, s27-ofw-dahan-gong, s27-official-fa-guan-dun, s27-official-qianlong-lvbu-gong, s27-official-huangma-qiang, s27-ofw-cangqi-lvbu-dun (藏器待時三勢 40Y 呂布盾), s27-ofw-cangqi-xingcai-faguan-dun |
| T1 | s27-official-beifa-dun, s27-official-taiwei-dun, s27-official-hedan-zhang, s27-ofw-chengyu-wumou-qi, s27-ofw-dengfeng-xiong, s27-ofw-wanghong-qiang, s27-official-dudu-gong, s27-official-qilin-gong, s27-official-pangtong-gong |
| T1.5 | s27-official-sanxian-feixiong, s27-official-kangkai-gong |

Có 13 cấu hình trong cẩm nang không nằm trong danh sách 交戰 này. Phần lớn là đội khai hoang/cảm tử thuộc nhóm khác (開荒/器械); chưa kiểm.

### Đội 40Y Lữ Bố · Hứa Du · SP Pháp Chính

- Đã đọc [三勢 40Y 呂布盾](https://sgsdeck.com/recommended/s27-official-sanshi-lvbu-dun) (T0, điểm 113, cập nhật 2026-11-10, nguồn [fanpage chính thức máy chủ Đài Loan](https://www.facebook.com/100064157226677/posts/1549258503889376/)) và [藏器待時三勢 40Y 呂布盾](https://sgsdeck.com/recommended/s27-ofw-cangqi-lvbu-dun) (T0, điểm 113, sách trắng máy chủ Đài Loan 2026-11-10). Hai trang có cùng cấu hình:
  - 40Y 呂布: 血刃爭鋒 + 藏器待時 | 示敵以弱, 久戰, 掩虛 | dồn điểm Võ lực | báu vật Hán, binh chủng thuẫn S
  - SP 法正: 蓄勢待發 + 藤甲兵 | 三軍之眾, 錘煉, 統軍 | dồn điểm Trí lực
  - 許攸: 三勢陣 + 臨危救主 | 三軍之眾, 錘煉, 統軍 | dồn điểm Trí lực | báu vật binh chủng thuẫn
- So với video: cùng 6 chiến pháp, chỉ khác người cầm. Video cho 許攸 cầm 藤甲兵, SP 法正 cầm 三勢陣; SGSDeck thì ngược lại.
- Tên tiếng Nhật ↔ tiếng Trung đọc được từ cặp này: 雄図待時 = 藏器待時, 伏機即動 = 蓄勢待發, 志操堅固 = 臨危救主, 血刃争奪 = 血刃爭鋒. Kết luận rút ra bằng cách so cùng một đội, chưa đối chiếu với nguồn chính thức.
- Trạng thái: **Đã đối chiếu**. Đây là đội hình SGSDeck "Sách Giáo Khoa", có nguồn chính thức máy chủ Đài Loan, và trùng với một nguồn độc lập (video JP) ở bộ tướng và chiến pháp.

### Đội Đại Kiều

- SGSDeck có 二喬弓 (無雙大喬 · 孫尚香 · 無雙小喬, T0). Đây không phải đội trong video (無双大喬 · 張遼 · SP貂蝉).
- Đội CO Đại Kiều · Trương Liêu · SP Điêu Thuyền: chưa có mốc SGSDeck đã xác minh.

### Giới hạn mới

- Ánh xạ tên JP ↔ CN ở trên cho thấy một số "khác biệt chiến pháp" trong bảng so khớp đầu tiên chỉ là khác tên dịch, ví dụ Hứa Du dùng 伏機即動・志操堅固 tức là 蓄勢待發・臨危救主. Bảng so khớp đầu tiên cần đọc lại với ánh xạ này trước khi nhập dữ liệu.
- Mới đọc chi tiết 2 trong 23 cấu hình mới.

## Ngân sách

| Allowance | Limit | Used | Remaining |
|---|---|---|---|
| External sources | 5 | 5 (trang YouTube, tải video, danh sách SGSDeck, 2 trang chi tiết SGSDeck) | 0 |
| TQCCL MCP | 5 | 0 (chỉ dùng CLI local) | 5 |
