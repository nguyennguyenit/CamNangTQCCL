---
type: researcher
date: 2026-07-11
topic: "Thẩm Hằng Ngụy Mưu - Anh Hùng Mệnh Thế"
status: completed
---

# Research Report: Thẩm Hằng Ngụy Mưu - Anh Hùng Mệnh Thế

> Thực hiện: 2026-07-11 15:17 +07. Dữ liệu xét: bản Nhật S25, Trung Quốc Anh Hùng Mệnh Thế, snapshot project 2026-07-11.

## Mục lục

1. [Kết luận](#kết-luận)
2. [Phạm vi và phương pháp](#phạm-vi-và-phương-pháp)
3. [Đội chuẩn có SP Tuân Úc](#đội-chuẩn-có-sp-tuân-úc)
4. [Áp vào kho tướng hiện có](#áp-vào-kho-tướng-hiện-có)
5. [Biến thể thử nghiệm nếu buộc dùng Thẩm Hằng](#biến-thể-thử-nghiệm-nếu-buộc-dùng-thẩm-hằng)
6. [Đối chiếu nguồn](#đối-chiếu-nguồn)
7. [Lỗi dữ liệu local cần tránh](#lỗi-dữ-liệu-local-cần-tránh)
8. [Khuyến nghị hành động](#khuyến-nghị-hành-động)
9. [Nguồn](#nguồn)
10. [Câu hỏi chưa giải quyết](#câu-hỏi-chưa-giải-quyết)

## Kết luận

- Đã xác nhận người chơi có **SP Tuân Úc**. Kho hiện tại ghép được đúng lõi **SP Tuân Úc + Thẩm Hằng + SP Quách Gia**, Kỵ, được nguồn CN và JP cùng ghi nhận.
- SP Tuân Úc giữ vai trò giảm sát thương và hồi phục; Thẩm Hằng lặp chiến pháp; SP Quách Gia là nguồn sát thương chính. Trình Dục và Tuân Du không vào bản ưu tiên này.
- Cường độ chưa đồng thuận: nguồn Nhật 2026 đánh giá bản Thẩm Hằng là all-rounder mạnh nhưng dao động; project gắn T0.5; một tier CN sau giai đoạn thực chiến lại đánh giá bộ ba thể hiện chưa tốt. Không nên gọi chắc chắn T0/T0.5 cho bản Việt Nam khi chưa có chiến báo tài khoản/server Việt.
- Khuyến nghị thực dụng: có thể dựng đội ngay nếu sáu chiến pháp không bị khóa ở đội khác; vẫn nên đánh 20-30 trận cùng cấp trước khi xếp đội này làm chủ lực số một.

## Phạm vi và phương pháp

- Nguồn đã đối chiếu: 6 nguồn web ngoài + ảnh client Việt + 4 artifact local.
- Khoảng thời gian nguồn web: 2024-10-12 đến 2026-06-19; kiểm tra ngày 2026-07-11.
- Từ khóa: `沈姮`, `英雄命世`, `富連騎/富连骑`, `SP荀彧`, `SP郭嘉`, `荀攸`, `程昱`.
- Nguồn: project-local, Nhật S25 ngày 2026-06-19, CN 2025-2026, video/tier cộng đồng.
- Ưu tiên: build ghi đủ tướng + chiến pháp + tốc; sau đó cơ chế; tier đơn lẻ chỉ dùng như tín hiệu.
- Gemini CLI không chạy được bước kiểm tra do máy thiếu `timeout`; chuyển WebSearch theo quy trình skill.
- Không nghiên cứu portfolio cùng tồn vì chưa có danh sách team/chiến pháp đang khóa.

## Đội chuẩn có SP Tuân Úc

### Chốt build theo nguồn JP mới nhất

| Thứ tự | Tướng | Chiến pháp | Điểm / tốc |
|---|---|---|---|
| 1 | **SP Quách Gia** | Đoạt Hồn Hiệp Phách `夺魂挟魄` + Đương Phong Thôi Quyết `当锋摧决` | Trí; nhanh nhất |
| 2 | **Thẩm Hằng** | Nhanh Trí Động Não `灵机一动` + `戮力同心` | Trí; nhanh nhì |
| 3 | **SP Tuân Úc** | Dốc Sức Tính Kế `竭力佐谋` + Cắt Xương Trị Độc `刮骨疗毒` | Trí + đủ tốc; chậm nhất trong ba |

Nguồn JP yêu cầu tốc **SP Quách Gia > Thẩm Hằng > SP Tuân Úc**. Phần còn lại cộng Trí. SP Tuân Úc vẫn cần đủ tốc để xử lý đội hình đối thủ theo mục tiêu matchup.

### Binh thư tham khảo

| Tướng | Binh thư |
|---|---|
| SP Quách Gia | Kỳ Chính Tương Sinh · Văn Thao · Giấu Đao |
| Thẩm Hằng | Đại Mưu Bất Mưu · Thần Cơ · Tướng Uy (tên theo nguồn Hán/JP; đối chiếu tên client VN trước khi chọn) |
| SP Tuân Úc | Tam Quân Chi Chúng · Rèn Luyện · Dẫn Quân |

### Vì sao đội chạy

1. Thẩm Hằng tái kích hoạt chiến pháp chủ động/đột kích thành công, không cần chuẩn bị/hồi chiêu cho lần lặp.
2. Mỗi lượt chủ động/đột kích của đồng đội tạo thêm cơ hội kích nội tại SP Quách Gia.
3. SP Tuân Úc cung cấp Cảnh Giới/giảm sát thương; Dốc Sức + Cắt Xương vừa hạ Trí đối thủ vừa hồi, giải trạng thái.
4. Nhanh Trí Động Não và Đoạt Hồn kéo chênh lệch thuộc tính; `戮力同心` tăng độ bền. Ở biến thể CN dùng Thượng Binh, Thượng Binh/Đương Phong bổ sung kết liễu và vô hiệu hóa bị động/chỉ huy.

### Điểm yếu

- Nhiều chiến pháp chủ động: sợ kế cùng, khống chế, Gia Cát Lượng và đội phá nhịp chủ động.
- Trần cao nhưng phương sai lớn: Thẩm Hằng lặp tốt thì bùng nổ, hụt lượt thì thấp hơn bản ổn định.
- Nguồn JP khuyên ra đội 2, không mặc định đội 1.
- Tốc công nhiều hit, SP Mã Siêu/Ôn Hầu và đội tạo debuff mạnh là matchup khó.

## Áp vào kho tướng hiện có

Danh sách đã xác nhận: **Thẩm Hằng, SP Tuân Úc, SP Quách Gia, Trình Dục, Tuân Du**.

| Phương án | Đánh giá | Lý do |
|---|---|---|
| Thẩm Hằng + SP Quách Gia + **SP Tuân Úc** | **Chọn** | Exact build có nguồn CN + JP; đủ công, giảm sát thương và hồi phục |
| Thẩm Hằng + SP Quách Gia + **Trình Dục** | Loại cho đội chính | Ba slot thiên công, thiếu giảm sát thương/hồi phục; không có proof đúng mùa |
| Thẩm Hằng + SP Quách Gia + **Tuân Du** | Có thể test, không gắn tier | Tuân Du tăng nhịp chủ động, hợp SP Quách Gia hơn; vẫn mất lõi phòng thủ SP Tuân Úc |
| SP Quách Gia + Tuân Du + **Chu Thiệu** | Bản meta gần nhất nhưng thiếu tướng | Có nguồn video đúng mùa và local build; không dùng Thẩm Hằng |

`Trình Dục + Tuân Du` có giá trị trong Ngũ Mưu cổ điển, nhưng bằng chứng đó không chứng minh thay thế vào đội Thẩm Hằng. Không chuyển kết luận giữa hai đội.

## Biến thể thử nghiệm nếu buộc dùng Thẩm Hằng

> Nhãn: off-meta/test. Không phải T0.5 đã chứng minh.

### Build đề xuất để test

| Tướng | Chiến pháp | Binh thư | Điểm |
|---|---|---|---|
| **SP Quách Gia** | Đoạt Hồn Hiệp Phách + Đương Phong Thôi Quyết | Kỳ Chính Tương Sinh · Văn Thao · Giấu Đao | Trí; nhanh nhất |
| **Tuân Du** | Dốc Sức Tính Kế + Cắt Xương Trị Độc | Tấn Công Điểm Yếu · Khích Lệ Lòng Quân · Khép Hờ | Trí; nhanh nhì |
| **Thẩm Hằng** | Nhanh Trí Động Não `灵机一动` + Thượng Binh Phạt Mưu | Đại Mưu Bất Mưu · Thần Cơ · Tướng Uy | Trí; chậm nhất |

Logic: giữ sáu lượt/chủ động tiềm năng, một slot hồi + giải khống, Đoạt Hồn mở chênh lệch thuộc tính, Tuân Du hỗ trợ tỷ lệ chủ động. Đổi lại, không có lớp giảm sát thương của SP Tuân Úc; dễ vỡ trước tốc công.

### Cách test

1. Chỉ đánh đội cùng cấp, binh lực tương đương.
2. Ghi ít nhất 20-30 trận: tổng thương vong, số lần Thẩm Hằng lặp, hồi phục Cắt Xương, trận hòa/thua sớm.
3. Tránh kết luận từ 3-5 chiến báo đẹp.
4. Nếu thường xuyên vỡ trước hiệp 4, dừng đầu tư; lỗi là cấu trúc thiếu phòng thủ, không phải chỉnh thêm sát thương.

## Đối chiếu nguồn

| Nguồn | Khu vực / thời điểm | Kết luận | Độ tin cậy |
|---|---|---|---|
| Kazten S25 | Nhật, 2026-06-19 | Bản SP Tuân Úc + Thẩm Hằng + SP Quách Gia all-rounder, bùng nổ cao nhưng kém ổn định | Khá: build, tốc, matchup, thay chiến pháp đầy đủ |
| Xiaomi Game Center | CN, 2025-12-15 | Exact bộ ba; giải thích Thẩm Hằng lặp chủ động và kích SP Quách Gia | Trung bình-khá: bài cơ chế/build, không đủ chuỗi chiến báo chữ |
| SMZDM tier sau thực chiến | CN, 2025-10-29 | Bộ ba thể hiện chưa tốt | Trung bình: tier có bối cảnh, thiếu build/chiến báo parse đầy đủ |
| Bilibili Ngũ Mưu Tuân Du | CN, Anh Hùng Mệnh Thế | SP Quách Gia + Tuân Du + Chu Thiệu là biến thể khác | Yếu-trung bình: tiêu đề/video đúng mùa, nội dung khó parse |
| Project local | Snapshot 2026-07-11 | Thẩm Hằng Ngũ Mưu T0.5 | Project-local; mapping Nhanh Trí đã sửa theo ảnh client, tier vẫn chưa đủ proof URL |

Suy luận: chênh đánh giá có thể do cân bằng/server, độ đỏ, thiên phú Đô Úy, hoặc thời gian meta trưởng thành. Chưa đủ dữ liệu để chọn một nguồn làm chân lý tuyệt đối cho server Việt.

## Lỗi dữ liệu local cần tránh

### 1. Sai chiến pháp ở slot Thẩm Hằng

Ảnh client Việt ngày 2026-07-11 xác nhận **Nhanh Trí Động Não = `灵机一动`**: Chủ động 30%→55%, Kỵ/Khí giới, tăng Trí–Thống–Mị cho 2-3 tướng. Mapping cũ `才辩机捷 → Nhanh Trí Động Não` là sai; `才辩机捷` là bị động của Y Tịch và được trả về tên fallback **Tài Biện Cơ Tiệp**.

### 2. Sai mapping `戮力同心`

Build local ghi **Đồng Lòng Hợp Sức**, nhưng `data/tactics.json` hiện map tên này tới `戮力上国`—chiến pháp **Nội chính của Tào Phi**. Nguồn JP dùng `戮力同心`, là chiến pháp chiến đấu khác. Phải đối chiếu tên chính thức client Việt trước khi trang bị.

### 3. Tier local chưa đủ bằng chứng

Record `Thẩm Hằng Ngũ Mưu` gắn T0.5 nhưng không lưu chiến báo hoặc URL proof theo record. Dùng như candidate, không dùng làm chứng cứ duy nhất.

## Khuyến nghị hành động

1. Dựng **SP Tuân Úc + Thẩm Hằng + SP Quách Gia** theo build JP.
2. Dùng đúng Nhanh Trí Động Não có mô tả Chủ động 30%→55%; tiếp tục kiểm tra tên Việt thật của `戮力同心`.
3. Gửi ảnh kho chiến pháp và số đỏ ba tướng để tối ưu bản cùng tồn, tránh trùng chiến pháp premium.
4. Mapping local `灵机一动` đã được sửa theo ảnh client; `戮力同心` vẫn cần bằng chứng tên Việt chính thức.

## Nguồn

- [Kazten: S25 Đô Úy template, Nhật, 2026-06-19](https://kazten.com/entry/2026/06/19/180000)
- [Xiaomi Game Center: Thẩm Hằng Phú Liên Kỵ, CN, 2025-12-15](https://game.xiaomi.com/viewpoint/1663267689_1765775893262_100)
- [SMZDM: tier Anh Hùng Mệnh Thế sau thực chiến, CN, 2025-10-29](https://post.m.smzdm.com/zz/p/a650rzxg/)
- [Bilibili: SP Quách Gia + Tuân Du + Chu Thiệu, CN](https://www.bilibili.com/video/BV1Raxcz6Egn/)
- [17173: cơ chế/build SP Quách Gia, CN, 2026-03-08](https://news.17173.com/content/03082026/031054459.shtml)
- [7724: mô tả `灵机一动`, CN, 2024-10-12](http://www.7724.com/sgzzlbyx/news/164899.html)
- Project: `data/teams.json`, `data/coexist.json`, `data/tactics.json`, `pipeline/do-uy-ss18-source.json`.

## Câu hỏi chưa giải quyết

- Tên Việt chính thức trên client cho `戮力同心` là gì?
- Các chiến pháp premium nào đang bị khóa ở team khác, số đỏ từng tướng bao nhiêu?
