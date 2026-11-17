# Phân loại ledger Đội khác — PK-S27 (piece B)

Ngày 2026-11-17. Ledger: `pipeline/recommended-other-teams.json`, sinh bằng `--pack pipeline/localization-inputs/recommended.json`.
Nguồn YouTube: `pipeline/team-youtube-pk-s27.json` sha256 `a648852d15119d654d2fddc5db1b97ed8c296fec91ddb05d695b0f9b85a3ddb3` (202 đội lúc chạy; file còn được bổ sung — đổi file thì chạy lại `build_json` + `recommended_team_dedup`).

## Tổng

| | admitted | duplicate | pendingIdentity | input |
|---|---|---|---|---|
| Trước (HEAD, so mọi mùa) | 40 | 19 | 107 | 166 |
| Sau (chỉ Đội chuẩn PK-S27) | 344 | 17 | 17 | 378 |

- Admitted theo nguồn trước: {'team-intro': 10, 'moi-phe': 30}; sau: {'youtube': 191, 'team-intro': 54, 'moi-phe': 99}.
- Mọi hàng admitted có `sourceSeasonIds: ["pk-s27"]`; 191 hàng YouTube `recommended: true` đứng đầu.
- YouTube: {'duplicate': 3, 'distinct': 191, 'pendingIdentity': 8}.
- `unresolvedRecommended` (Đội chuẩn PK-S27 còn ô chưa resolve, dùng làm wildcard): s27-chengpu-dudu-gong, s27-chuanzi-gong, s27-hedan-zhujun, s27-lp-beifa-qiang, s27-lp-biyue-dun, s27-lp-taoyuan-dun-ay, s27-ofw-pc2-ganning, s27-ofw-pc2-jiaxu, s27-ofw-pc2-machao, s27-ofw-pc2-sunshangxiang, s27-ofw-pc2-zhangrang, s27-ofw-pc3-ganning, s27-ofw-pc3-jiaxu, s27-ofw-pc3-machao, s27-ofw-pc3-sunshangxiang, s27-ofw-pc3-zhangrang.

Phân rã thay đổi admitted (cùng `data/teams.json` 176 đội trước YouTube):

| Cấu hình | admitted | duplicate | pending |
|---|---|---|---|
| identity map cũ, tên tướng thô, mọi mùa (= HEAD) | 40 | 20 | 116 |
| identity map mới, tên tướng thô, mọi mùa | 69 | 27 | 80 |
| identity map mới, SP/CO + baseName, mọi mùa | 115 | 50 | 11 |
| identity map mới, tên tướng thô, chỉ PK-S27 | 93 | 5 | 78 |
| identity map mới, SP/CO + baseName, chỉ PK-S27 (đã áp) | 153 | 14 | 9 |

## Team giới thiệu mới (team-intro-56..65)

| ID | Tên | Tướng | Phân loại | Ghi chú (sourceConfigId PK-S27 trùng / lý do) |
|---|---|---|---|---|
| team-intro-56 | Úc Dục Du | SP Tuân Úc / Trình Dục / Tuân Du | duplicate | s27-ofw-chengyu-wumou-qi |
| team-intro-57 | Tháo Thực Thuyền | SP Tào Tháo / SP Lô Thực / SP Điêu Thuyền | duplicate | s27-official-dahan-gong, s27-ofw-dahan-gong |
| team-intro-58 | Tháo Lượng Thuyền | SP Tào Tháo / Gia Cát Lượng / SP Điêu Thuyền | duplicate | s27-ofw-han-2plus1-gong |
| team-intro-59 | Bố Thuyền Thực | 40Y Lữ Bố / SP Điêu Thuyền / SP Lô Thực | admitted |  |
| team-intro-60 | Bố Dị Chính | 40Y Lữ Bố / Vương Dị / SP Pháp Chính(Cung S) | admitted |  |
| team-intro-61 | Bố Thuyền Trác | 40Y Lữ Bố / SP Điêu Thuyền / Đổng Trác/SP Đổng Trác | admitted | có lựa chọn thay thế (pendingBranches) |
| team-intro-62 | Úc Hủ Dị | SP Tuân Úc / Giả Hủ / Vương Dị | admitted |  |
| team-intro-63 | Bố Chính Du | 40Y Lữ Bố(S) / SP Pháp Chính / Hứa Du(S) | duplicate | s27-official-sanshi-lvbu-dun, s27-ofw-cangqi-lvbu-dun |
| team-intro-64 | Vũ Chính Thái | SP Quan Vũ(S) / SP Pháp Chính / CO Tinh Thái | duplicate | s27-ofw-cangqi-xingcai-faguan-dun |
| team-intro-65 | Bị Vũ Phi | Lưu Bị / Quan Vũ(Kỹ Năng Quân Sư Quan Hưng) / Trương Phi | admitted | có lựa chọn thay thế (pendingBranches) |

## Đội YouTube

### Không admitted

| ID | Tên | Tướng | Phân loại | Ghi chú |
|---|---|---|---|---|
| youtube-0 | Tam Thế 40Y Lữ Bố Thuẫn | 40Y Lữ Bố / SP Pháp Chính / Hứa Du | duplicate | s27-official-sanshi-lvbu-dun, s27-ofw-cangqi-lvbu-dun; có lựa chọn thay thế (pendingBranches) |
| youtube-11 | Tinh Thái Pháp Quan Thuẫn | SP Quan Vũ / SP Pháp Chính / CO Tinh Thái | duplicate | s27-ofw-cangqi-xingcai-faguan-dun |
| youtube-50 | Bế Nguyệt Thuẫn (Hành Ách Trận) | Điêu Thuyền / Trương Giác / Tả Từ | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |
| youtube-59 | Thư Thụ Bế Nguyệt | Trương Giác / Điêu Thuyền / Thư Thụ | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |
| youtube-67 | Hoàng Mã Hành Ách Điêu Thuyền | SP Mã Siêu / SP Hoàng Phủ Tung / Điêu Thuyền | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |
| youtube-69 | Hành Ách Điêu Mã Thương | SP Mã Siêu / SP Hoàng Phủ Tung / Điêu Thuyền | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận; có lựa chọn thay thế (pendingBranches) |
| youtube-70 | Điêu Mã Thương (Hành Ách Trận, Mê Hoặc) | SP Mã Siêu / SP Hoàng Phủ Tung / Điêu Thuyền | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |
| youtube-71 | Điêu Mã Thương | SP Mã Siêu / Điêu Thuyền / SP Hoàng Phủ Tung | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |
| youtube-121 | Xã Tắc Cung (Hành Ách Trận) | SP Chu Du / Lục Tốn / Trình Phổ | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |
| youtube-131 | Khảng Khái Cung | Cam Ninh / Thái Sử Từ / SP Lữ Mông | duplicate | s27-official-kangkai-gong |
| youtube-195 | Ngô Nữ Cung (Hành Ách Trận) | CO Đại Kiều / Tôn Thượng Hương / CO Tiểu Kiều | pending | unresolved-local-primary; chưa resolve: CP Hành Ách Trận |

### Admitted

| ID | Tên | Tướng | Phân loại | Ghi chú |
|---|---|---|---|---|
| youtube-1 | Tam Thế 40Y Lữ Bố Thuẫn | 40Y Lữ Bố / SP Pháp Chính / Hứa Du | admitted |  |
| youtube-2 | Tam Thế Đằng Giáp 40Y Lữ Bố | 40Y Lữ Bố / SP Pháp Chính / Hứa Du | admitted |  |
| youtube-3 | 40Y Lữ Bố | 40Y Lữ Bố / SP Pháp Chính / Hứa Du | admitted |  |
| youtube-4 | Tam Thế 40Y Lữ Bố Thuẫn | 40Y Lữ Bố / Hứa Du / SP Pháp Chính | admitted |  |
| youtube-5 | Tàng Khí Lữ Bố Thuẫn | 40Y Lữ Bố / SP Pháp Chính / SP Hoàng Phủ Tung | admitted |  |
| youtube-6 | Tàng Khí Lữ Bố Hình Nhất Thuẫn | 40Y Lữ Bố / SP Pháp Chính / Trình Phổ | admitted |  |
| youtube-7 | 40Y Lữ Bố Thuẫn (CO Tinh Thái, Mãn Sủng) | 40Y Lữ Bố / CO Tinh Thái / Mãn Sủng | admitted |  |
| youtube-8 | 40Y Lữ Bố Thương (Bàng Thống, Vương Nguyên Cơ) | 40Y Lữ Bố / Bàng Thống / Vương Nguyên Cơ | admitted |  |
| youtube-9 | 40Y Lữ Bố Cung (SP Hoàng Phủ Tung, Gia Cát Lượng) | 40Y Lữ Bố / SP Hoàng Phủ Tung / Gia Cát Lượng | admitted |  |
| youtube-10 | Đội Chu Du (Công Tôn Toản, 40Y Lữ Bố) | Chu Du / Công Tôn Toản / 40Y Lữ Bố | admitted |  |
| youtube-12 | Pháp Quan Thuẫn (CO Tinh Thái, Ngư Lân Trận) | SP Quan Vũ / CO Tinh Thái / SP Pháp Chính | admitted |  |
| youtube-13 | Pháp Quan Thuẫn (CO Tinh Thái, Ngư Lân Trận, Mê Hoặc) | SP Quan Vũ / CO Tinh Thái / SP Pháp Chính | admitted |  |
| youtube-14 | Pháp Quan | SP Quan Vũ / SP Pháp Chính / CO Tinh Thái | admitted |  |
| youtube-15 | Pháp Quan Thuẫn (Khương Duy) | SP Quan Vũ / Khương Duy / SP Pháp Chính | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-16 | Pháp Quan Thuẫn (Khương Duy, Ngư Lân Trận) | SP Quan Vũ / Khương Duy / SP Pháp Chính | admitted |  |
| youtube-17 | Pháp Quan Thuẫn (Trương Bào) | SP Quan Vũ / SP Pháp Chính / Trương Bào | admitted |  |
| youtube-18 | Pháp Quan Thuẫn (Trương Bào, Ngư Lân Trận) | SP Quan Vũ / Trương Bào / SP Pháp Chính | admitted |  |
| youtube-19 | Pháp Quan Thuẫn (Gia Cát Lượng) | SP Quan Vũ / SP Pháp Chính / Gia Cát Lượng | admitted |  |
| youtube-20 | Pháp Quan Thuẫn (Triệu Vân) | SP Quan Vũ / SP Pháp Chính / Triệu Vân | admitted |  |
| youtube-21 | SP Gia Cát Lượng Thuẫn (SP Quan Vũ, Quan Ngân Bình) | SP Gia Cát Lượng / SP Quan Vũ / Quan Ngân Bình | admitted |  |
| youtube-22 | Lục Pháp Thuẫn | Lục Tốn / SP Hoàng Phủ Tung / SP Pháp Chính | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-23 | Lục Tốn Thuẫn (SP Pháp Chính, Tào Tháo) | Lục Tốn / SP Pháp Chính / Tào Tháo | admitted |  |
| youtube-24 | Xích Bích Hán Cung | SP Chu Du / SP Tào Tháo / SP Điêu Thuyền | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-25 | Xích Bích Hán Cung (SP Tào Tháo mang Kết Nghĩa Vườn Đào) | SP Chu Du / SP Tào Tháo / SP Điêu Thuyền | admitted |  |
| youtube-26 | SP Điêu Thuyền Cung (SP Tào Tháo, SP Chu Du) | SP Điêu Thuyền / SP Tào Tháo / SP Chu Du | admitted |  |
| youtube-27 | SP Pháp Chính Cung (SP Chu Du, SP Điêu Thuyền) | SP Pháp Chính / SP Chu Du / SP Điêu Thuyền | admitted |  |
| youtube-28 | Hán Thất Cung (bản Hoa Đà) | SP Tào Tháo / Hoa Đà / SP Điêu Thuyền | admitted |  |
| youtube-29 | Hán Thất Cung (bản Thái Văn Cơ) | SP Tào Tháo / Thái Văn Cơ / SP Điêu Thuyền | admitted |  |
| youtube-30 | Hán Thất Cung (bản Viên Thiệu) | Viên Thiệu / SP Tào Tháo / SP Điêu Thuyền | admitted |  |
| youtube-31 | Hán Cung bản Cảnh Giới (Cẩu Vĩ Tục Điêu Cung) | SP Tào Tháo / SP Tuân Úc / SP Điêu Thuyền | admitted |  |
| youtube-32 | Hán Thất Cung (biến thể) | SP Tào Tháo / SP Lô Thực / SP Điêu Thuyền | admitted |  |
| youtube-33 | SP Tào Tháo Cung (Giả Hủ, SP Điêu Thuyền) | SP Tào Tháo / Giả Hủ / SP Điêu Thuyền | admitted |  |
| youtube-34 | Thích Đổng Cung | SP Tào Tháo / Lữ Bố / Hứa Du | admitted |  |
| youtube-35 | SP Tào Tháo Cung (Lục Tốn, SP Điêu Thuyền) | SP Tào Tháo / Lục Tốn / SP Điêu Thuyền | admitted |  |
| youtube-36 | Cự Mã Cung (bản thiếu SP Lô Thực) | SP Tào Tháo / SP Đổng Trác / SP Điêu Thuyền | admitted |  |
| youtube-37 | Cự Mã Cung (bản Tào Tháo) | SP Tào Tháo / SP Đổng Trác / SP Điêu Thuyền | admitted |  |
| youtube-38 | Cự Mã Cung (Hình Nhất) | SP Tào Tháo / SP Đổng Trác / SP Điêu Thuyền | admitted |  |
| youtube-39 | SP Chu Tuấn Cung (SP Đổng Trác, SP Điêu Thuyền) | SP Chu Tuấn / SP Đổng Trác / SP Điêu Thuyền | admitted |  |
| youtube-40 | Giả Hủ Đổng Trác Điêu Thuyền Cung | Giả Hủ / SP Đổng Trác / SP Điêu Thuyền | admitted |  |
| youtube-41 | Phi Hùng Thái Sư | SP Đổng Trác / SP Điêu Thuyền / SP Tuân Úc | admitted |  |
| youtube-42 | SP Đổng Trác Cung (Vương Dị, SP Điêu Thuyền) | SP Đổng Trác / Vương Dị / SP Điêu Thuyền | admitted |  |
| youtube-43 | Đổng Trác Cung (SP Điêu Thuyền, Lữ Bố) | Đổng Trác / SP Điêu Thuyền / Lữ Bố | admitted |  |
| youtube-44 | Ly Hỏa Cung (bản SP Chu Du) | SP Điêu Thuyền / SP Chu Du / Giả Hủ | admitted |  |
| youtube-45 | Ly Hỏa Cung | SP Điêu Thuyền / Lục Tốn / Tào Tháo | admitted |  |
| youtube-46 | SP Điêu Thuyền Cung (Chu Du, Tào Tháo) | SP Điêu Thuyền / Chu Du / Tào Tháo | admitted |  |
| youtube-47 | Tiềm Long Điêu Thuyền Cung | Điêu Thuyền / Gia Cát Lượng / Chu Du | admitted |  |
| youtube-48 | Trương Giác Bế Nguyệt Thuẫn | Điêu Thuyền / Trương Giác / Tả Từ | admitted |  |
| youtube-49 | Ngũ Lôi Bế Nguyệt bình dân | Điêu Thuyền / Trương Giác / Tả Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-51 | Bế Nguyệt Thuẫn (bản Trấn Ách) | Trương Giác / Điêu Thuyền / Tả Từ | admitted |  |
| youtube-52 | Trương Giác Thuẫn (Điêu Thuyền, Tả Từ) | Trương Giác / Điêu Thuyền / Tả Từ | admitted |  |
| youtube-53 | Trương Giác Thuẫn | Trương Giác / Điêu Thuyền / Tả Từ | admitted |  |
| youtube-54 | Trương Giác Thuẫn (Điêu Thuyền mang Lính Giáp Mây) | Trương Giác / Điêu Thuyền / Tả Từ | admitted |  |
| youtube-55 | Điêu Thuyền (Cung B) | Điêu Thuyền / Trương Giác / Tả Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-56 | Điêu Thuyền Cung (Trương Giác, Tả Từ) | Điêu Thuyền / Trương Giác / Tả Từ | admitted |  |
| youtube-57 | Ngũ Lôi Bế Nguyệt "Súc Linh Xa" | Điêu Thuyền / Trương Giác / Tả Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-58 | Điêu Thuyền (Khí giới) | Điêu Thuyền / Trương Giác / Tả Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-60 | Bế Nguyệt Thuẫn (Thư Thụ) | Trương Giác / Điêu Thuyền / Thư Thụ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-61 | Bế Nguyệt Thuẫn (Thư Thụ, Dốc Sức Tính Kế) | Điêu Thuyền / Trương Giác / Thư Thụ | admitted |  |
| youtube-62 | Trương Giác Thuẫn (Điêu Thuyền, Thư Thụ) | Trương Giác / Điêu Thuyền / Thư Thụ | admitted |  |
| youtube-63 | Trương Giác phối phe Hán (SP Pháp Chính) | Điêu Thuyền / Trương Giác / SP Pháp Chính | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-64 | Trương Giác phối phe Hán (SP Tuân Úc) | Điêu Thuyền / Trương Giác / SP Tuân Úc | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-65 | Trương Giác Thái Úy Thuẫn | Trương Giác / Gia Cát Lượng / Mãn Sủng | admitted |  |
| youtube-66 | Tam Tiên Kỵ | Trương Giác / Vũ Cát / Tả Từ | admitted |  |
| youtube-68 | Hoàng Mã (bản Điêu Thuyền) | SP Mã Siêu / SP Hoàng Phủ Tung / Điêu Thuyền | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-72 | Hoàng Mã Thuẫn | SP Mã Siêu / SP Hoàng Phủ Tung / Hứa Du | admitted |  |
| youtube-73 | Hoàng Mã Cung (biến thể) | SP Mã Siêu / SP Hoàng Phủ Tung / Hứa Du | admitted |  |
| youtube-74 | Lữ Bố Thương (SP Hoàng Phủ Tung, Hứa Du) | Lữ Bố / SP Hoàng Phủ Tung / Hứa Du | admitted |  |
| youtube-75 | Hắc Ti Ôn Hầu Cung (bản Đoạt Hồn Hiệp Phách) | Hứa Du / Vương Dị / Lữ Bố | admitted |  |
| youtube-76 | Hắc Ti Ôn Hầu Cung (bản Tạm Lánh Sóng Gió) | Hứa Du / Vương Dị / Lữ Bố | admitted |  |
| youtube-77 | Tiềm Long Lữ Bố Cung | Hứa Du / Chu Du / Lữ Bố | admitted |  |
| youtube-78 | Hứa Du Cung (Lữ Bố, Chu Du) | Hứa Du / Lữ Bố / Chu Du | admitted |  |
| youtube-79 | Ôn Hầu Cung (hệ Tiềm Long) | Hứa Du / Lữ Bố / Cam Ninh | admitted |  |
| youtube-80 | Ôn Hầu Cung (Tử Sĩ Tiên Phong) | Hứa Du / Lữ Bố / Tả Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-81 | Ôn Hầu Cung (Tả Từ chủ tướng) | Tả Từ / Lữ Bố / Hứa Du | admitted |  |
| youtube-82 | Ôn Hầu Cung (Quân Cẩm Phàm) | Hứa Du / Lữ Bố / Tả Từ | admitted |  |
| youtube-83 | Tam Thế Lữ bản mới | Lữ Bố / Thái Sử Từ / Hứa Du | admitted |  |
| youtube-84 | Tam Thế Lữ (Hứa Du mang Tiềm Long) | Hứa Du / Lữ Bố / Thái Sử Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-85 | Lữ Bố Kỵ (Lăng Thống, Quách Gia) | Lữ Bố / Lăng Thống / Quách Gia | admitted |  |
| youtube-86 | Lữ Bố Cung (Quách Gia, CO Tiểu Kiều) | Lữ Bố / Quách Gia / CO Tiểu Kiều | admitted |  |
| youtube-87 | Đổng Trác Cung (Lữ Bố, Hứa Du) | Đổng Trác / Lữ Bố / Hứa Du | admitted |  |
| youtube-88 | Hạt Nhân Trương (đi Cung) | Chu Thái / Trương Phi / SP Viên Thiệu | admitted |  |
| youtube-89 | Bạch Mã Hạt Nhân Cung | Chu Thái / Trương Phi / SP Viên Thiệu | admitted |  |
| youtube-90 | Đội chức năng (Trương Phi) | Chu Thái / Trương Phi / SP Viên Thiệu | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-91 | Chu Thái Thương (SP Viên Thiệu, Trương Phi) | Chu Thái / SP Viên Thiệu / Trương Phi | admitted |  |
| youtube-92 | Chu Thái Thuẫn (Trương Phi, SP Viên Thiệu) | Chu Thái / Trương Phi / SP Viên Thiệu | admitted |  |
| youtube-93 | Đội chức năng (Quan Ngân Bình) | Chu Thái / Quan Ngân Bình / SP Viên Thiệu | admitted |  |
| youtube-94 | Đội chức năng (Viên Thuật) | Chu Thái / Viên Thuật / SP Viên Thiệu | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-95 | Hạt Nhân Trương (lối điểm sát) | Chu Thái / Trương Phi / SP Chu Tuấn | admitted |  |
| youtube-96 | Hạt Nhân Cung | Chu Thái / Trương Phi / SP Chu Tuấn | admitted |  |
| youtube-97 | Hạt Nhân Chu Tuấn | Chu Thái / SP Chu Tuấn / SP Viên Thiệu | admitted |  |
| youtube-98 | Hạt Nhân Trương Phi | Chu Thái / Trương Phi / Tào Tháo | admitted |  |
| youtube-99 | Viên Thuật Quần Cung (bản Chu Tuấn) | Viên Thuật / SP Chu Tuấn / Chu Thái | admitted |  |
| youtube-100 | Viên Thuật Quần Cung | Viên Thuật / SP Viên Thiệu / Công Tôn Toản | admitted |  |
| youtube-101 | Bạch Mã Cung | Viên Thuật / SP Viên Thiệu / Công Tôn Toản | admitted |  |
| youtube-102 | Vương Đạo Quần Cung | SP Viên Thiệu / SP Chu Tuấn / Thư Thụ | admitted |  |
| youtube-103 | Hổ Thần Thuẫn | Cam Ninh / Thái Sử Từ / Chu Thái | admitted |  |
| youtube-104 | Hổ Thần Cung | Chu Thái / Cam Ninh / Thái Sử Từ | admitted |  |
| youtube-105 | Tôn Quyền Kỵ (SP Lữ Mông, Chu Thái) | Tôn Quyền / SP Lữ Mông / Chu Thái | admitted |  |
| youtube-106 | Quyền Kỵ (biến thể) | Tôn Quyền / Chu Thái / Lăng Thống | admitted |  |
| youtube-107 | Ngô Kỵ | Chu Thái / Tôn Thượng Hương / Lăng Thống | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-108 | Đô Đốc Cung | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-109 | Đô Đốc Cung | SP Chu Du / SP Lữ Mông / Lục Tốn | admitted |  |
| youtube-110 | Đô Đốc Cung | SP Chu Du / SP Lữ Mông / Lục Tốn | admitted |  |
| youtube-111 | Đô Đốc Cung (có Đương Phong Thôi Quyết phá Cương Nghị) | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted |  |
| youtube-112 | SP Đô Đốc Cung | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-113 | SP Chu Du Đô Đốc | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted |  |
| youtube-114 | Đô Đốc Cung (bản Trấn Ách) | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted |  |
| youtube-115 | Cặp Đô Đốc | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted |  |
| youtube-116 | SP Chu Du Cung (Lục Tốn, SP Lữ Mông) | SP Chu Du / Lục Tốn / SP Lữ Mông | admitted |  |
| youtube-117 | SP Chu Du Cung (Lục Tốn, Lữ Mông) | SP Chu Du / Lục Tốn / Lữ Mông | admitted |  |
| youtube-118 | Đô Đốc Cung (truyền thống) | Chu Du / SP Lữ Mông / Lục Tốn | admitted |  |
| youtube-119 | Đô Đốc Cung (Chu Du thường) | Chu Du / Lục Tốn / SP Lữ Mông | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-120 | Hình Nhất Xã Tắc Cung | SP Chu Du / Lục Tốn / Trình Phổ | admitted |  |
| youtube-122 | Xã Tắc Cung (Nhạn Hành Trận, Cương Nhu Kết Hợp) | SP Chu Du / Trình Phổ / Lục Tốn | admitted |  |
| youtube-123 | SP Chu Vương Cung | SP Chu Du / Vương Dị / Mãn Sủng | admitted |  |
| youtube-124 | Trình Phổ Đô Đốc Cung (biến thể) | Chu Du / Lục Tốn / Trình Phổ | admitted |  |
| youtube-125 | Chu Du Cung (Thái Sử Từ, Trình Phổ) | Chu Du / Thái Sử Từ / Trình Phổ | admitted |  |
| youtube-126 | Chu Du Cung (Lục Tốn, SP Tôn Kiên) | Chu Du / Lục Tốn / SP Tôn Kiên | admitted |  |
| youtube-127 | Khống Chế Cung | Chu Du / Lữ Mông / Trình Phổ | admitted |  |
| youtube-128 | Khống Chế Thương (biến thể) | Chu Du / Lữ Mông / Trình Phổ | admitted |  |
| youtube-129 | Đội Chu Du (SP Lữ Mông, Thái Sử Từ) | Chu Du / SP Lữ Mông / Thái Sử Từ | admitted |  |
| youtube-130 | Chu Du Cung (Giả Hủ, SP Tuân Úc) | Chu Du / Giả Hủ / SP Tuân Úc | admitted |  |
| youtube-132 | Khảng Khái Cung (Thịnh Khí Linh Địch) | Cam Ninh / Thái Sử Từ / SP Lữ Mông | admitted |  |
| youtube-133 | Cam Thái Trình (biến thể) | Cam Ninh / Thái Sử Từ / Trình Phổ | admitted |  |
| youtube-134 | Cam Thái Trình (Đương Phong Thôi Quyết) | Cam Ninh / Thái Sử Từ / Trình Phổ | admitted |  |
| youtube-135 | Trình Phổ Cung (Cam Ninh, Tả Từ) | Trình Phổ / Cam Ninh / Tả Từ | admitted |  |
| youtube-136 | Trình Phổ Cung (Thái Sử Từ, Tả Từ) | Trình Phổ / Thái Sử Từ / Tả Từ | admitted |  |
| youtube-137 | Trình Phổ Cung (Ngụy Diên, Thư Thụ) | Trình Phổ / Ngụy Diên / Thư Thụ | admitted |  |
| youtube-138 | Bàng Đức Đài Quan Cung | Trình Phổ / Bàng Đức / Tả Từ | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-139 | Đài Quan Cung (bản Tào Tháo) | Tào Tháo / Bàng Đức / SP Tào Chân | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-140 | Tiên Đăng Tam Thế Cung (Quan Vũ) | Giả Hủ / Quan Vũ / Tả Từ | admitted |  |
| youtube-141 | Long Phượng Cung | SP Gia Cát Lượng / Quan Vũ / Bàng Thống | admitted |  |
| youtube-142 | Hán Diễm Liên Hoàn Cung | SP Gia Cát Lượng / Quan Vũ / Bàng Thống | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-143 | SP Gia Cát Lượng Cung (Quan Vũ, Bàng Thống) | SP Gia Cát Lượng / Quan Vũ / Bàng Thống | admitted |  |
| youtube-144 | Thục Trí Cung (SP Gia Cát Lượng, Pháp Chính) | SP Gia Cát Lượng / Bàng Thống / Pháp Chính | admitted |  |
| youtube-145 | Thục Trí Thuẫn (Sư Tử Phấn Tấn) | Bàng Thống / Gia Cát Lượng / SP Pháp Chính | admitted |  |
| youtube-146 | SP Thục Trí Thuẫn | Bàng Thống / Gia Cát Lượng / SP Pháp Chính | admitted |  |
| youtube-147 | Thục Trí Thuẫn | Bàng Thống / Gia Cát Lượng / SP Pháp Chính | admitted |  |
| youtube-148 | Thục Trí Thuẫn (Mê Hoặc, Lính Giáp Mây) | Bàng Thống / Gia Cát Lượng / SP Pháp Chính | admitted |  |
| youtube-149 | Thục Trí Thuẫn (Mê Hoặc) | Bàng Thống / SP Pháp Chính / Gia Cát Lượng | admitted |  |
| youtube-150 | Thục Trí Thuẫn (bản Trấn Ách, Mê Hoặc) | Bàng Thống / Gia Cát Lượng / SP Pháp Chính | admitted |  |
| youtube-151 | Thục Trí (Thái Bình Đạo Pháp, Nhạn Hành Trận) | Bàng Thống / SP Pháp Chính / Gia Cát Lượng | admitted |  |
| youtube-152 | Bắc Phạt Thuẫn (Văn Võ) | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-153 | Bắc Phạt | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-154 | Nhóm binh đao (bản Thuẫn) | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-155 | Bắc Phạt Thuẫn (Gió Táp Mưa Sa, Thâm Tàng Nhược Hư) | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-156 | Bắc Phạt Thuẫn | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-157 | Bắc Phạt Thuẫn (Biết Mình Biết Ta, Xông Pha Khói Lửa) | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-158 | Nhóm binh đao | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-159 | Bắc Phạt Thương | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-160 | Bắc Phạt Thương | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-161 | Bắc Phạt Thương | SP Gia Cát Lượng / Quan Hưng / Trương Bào | admitted |  |
| youtube-162 | Kỳ Lân Cung (Đoạt Hồn Hiệp Phách, Thịnh Khí Linh Địch) | Khương Duy / Bàng Thống / Gia Cát Lượng | admitted |  |
| youtube-163 | Kỳ Lân Cung (Nhạn Hành Trận, Biết Mình Biết Ta) | Khương Duy / Bàng Thống / Gia Cát Lượng | admitted |  |
| youtube-164 | Kỳ Lân Cung (biến thể) | Khương Duy / Bàng Thống / Gia Cát Lượng | admitted |  |
| youtube-165 | Thiếu Phụ Cung (Kỳ Môn Bát Trận) | Khương Duy / Bàng Thống / SP Hoàng Nguyệt Anh | admitted |  |
| youtube-166 | Đẳng Phong Kỵ | Khương Duy / Quan Ngân Bình / Lưu Bị | admitted |  |
| youtube-167 | Khương Duy Kỵ (Quan Ngân Bình, Lưu Bị) | Khương Duy / Quan Ngân Bình / Lưu Bị | admitted |  |
| youtube-168 | Khương Duy Kỵ (Lưu Bị, Quan Ngân Bình) | Khương Duy / Lưu Bị / Quan Ngân Bình | admitted |  |
| youtube-169 | Lưu Bị Kỵ (Triệu Vân, Khương Duy) | Lưu Bị / Triệu Vân / Khương Duy | admitted |  |
| youtube-170 | Động Sát Thương | Triệu Vân / Trương Phi / Quan Vũ | admitted |  |
| youtube-171 | Quan Quan Trương (biến thể) | Quan Vũ / Trương Phi / Quan Ngân Bình | admitted |  |
| youtube-172 | Trương Quan Hoàng | Trương Phi / Quan Ngân Bình / Hoàng Nguyệt Anh | admitted |  |
| youtube-173 | Đội chức năng (Trương Phi, Quan Ngân Bình, Hoàng Nguyệt Anh) | Trương Phi / Quan Ngân Bình / Hoàng Nguyệt Anh | admitted |  |
| youtube-174 | Mã Vân Lộc Kỵ (Hoàng Nguyệt Anh, Quan Ngân Bình) | Mã Vân Lộc / Hoàng Nguyệt Anh / Quan Ngân Bình | admitted |  |
| youtube-175 | Cẩu Quan Thương (biến thể) | Trình Phổ / SP Quan Vũ / SP Tuân Úc | admitted |  |
| youtube-176 | Trình Dục Ngũ Mưu Kỵ | SP Tuân Úc / Trình Dục / Tuân Du | admitted |  |
| youtube-177 | Ngũ Mưu (Trình Dục) | SP Tuân Úc / SP Quách Gia / Trình Dục | admitted |  |
| youtube-178 | Ngũ Mưu Kỵ (Vương Dị) | SP Tuân Úc / SP Quách Gia / Vương Dị | admitted |  |
| youtube-179 | Ngũ Mưu (bản Tuân Du) | SP Tuân Úc / SP Quách Gia / Tuân Du | admitted |  |
| youtube-180 | Ngũ Mưu (bản Tuân Du) | SP Tuân Úc / SP Quách Gia / Tuân Du | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-181 | Ngũ Mưu Kỵ (Biến Đá Thành Vàng) | SP Tuân Úc / Giả Hủ / SP Quách Gia | admitted |  |
| youtube-182 | Ngũ Mưu Cung | SP Tuân Úc / Giả Hủ / SP Quách Gia | admitted |  |
| youtube-183 | SP Tuân Úc Cung (Vương Dị, Giả Hủ) | SP Tuân Úc / Vương Dị / Giả Hủ | admitted |  |
| youtube-184 | Trình Dục Kỵ (Quách Gia, Mãn Sủng) | Trình Dục / Quách Gia / Mãn Sủng | admitted |  |
| youtube-185 | Thái Úy Kỵ (Tư Mã Ý, Trương Xuân Hoa) | Tư Mã Ý / Trương Xuân Hoa / SP Tuân Úc | admitted |  |
| youtube-186 | Thái Úy Thuẫn (bản Vương Dị) | Tư Mã Ý / Vương Dị / Mãn Sủng | admitted |  |
| youtube-187 | Thái Úy Thuẫn | Tư Mã Ý / Tào Tháo / Mãn Sủng | admitted |  |
| youtube-188 | Tư Mã Ý Thuẫn (Trương Xuân Hoa, Mãn Sủng) | Tư Mã Ý / Trương Xuân Hoa / Mãn Sủng | admitted |  |
| youtube-189 | Tư Mã Ý Cung (SP Tuân Úc, Tuân Du) | Tư Mã Ý / SP Tuân Úc / Tuân Du | admitted |  |
| youtube-190 | Tư Mã Ý Kỵ (Quách Gia, Tuân Du) | Tư Mã Ý / Quách Gia / Tuân Du | admitted |  |
| youtube-191 | Liêu Cơ Kỵ | Trương Liêu / Quách Gia / Vương Nguyên Cơ | admitted |  |
| youtube-192 | Đôn Đôn Thuẫn biến dị | SP Điển Vi / Hạ Hầu Đôn / Tào Tháo | admitted |  |
| youtube-193 | Phản Kích Thuẫn (SP Bàng Đức) | Hác Chiêu / SP Bàng Đức / Mãn Sủng | admitted |  |
| youtube-194 | Ngô Nữ Cung | CO Đại Kiều / Tôn Thượng Hương / CO Tiểu Kiều | admitted | có lựa chọn thay thế (pendingBranches) |
| youtube-196 | Ngô Nữ Cung (Tử Sĩ Tiên Phong) | CO Đại Kiều / Tôn Thượng Hương / CO Tiểu Kiều | admitted |  |
| youtube-197 | Kiều Liêu Kỵ / Kiều Liêu Điêu | CO Đại Kiều / Trương Liêu / SP Điêu Thuyền | admitted |  |
| youtube-198 | Kiều Liêu | CO Đại Kiều / Trương Liêu / SP Điêu Thuyền | admitted |  |
| youtube-199 | CO Đại Kiều Kỵ (Trương Liêu, Tả Từ) | CO Đại Kiều / Trương Liêu / Tả Từ | admitted |  |
| youtube-200 | CO Đại Kiều Thuẫn (Đổng Trác, Trương Liêu) | CO Đại Kiều / Đổng Trác / Trương Liêu | admitted |  |
| youtube-201 | Lữ Linh Ỷ | Lỗ Túc / Viên Thiệu / Lữ Linh Ỷ | admitted |  |

## Đội cũ còn pending (không thuộc piece này)

| ID | Tên | Tướng | Phân loại | Ghi chú |
|---|---|---|---|---|
| moi-phe-147 | Ý Túc Sủng | Tư Mã Ý / Bái Sư Lỗ Túc/Lưu Bị / Mãn Sủng | pending | unresolved-local-primary; chưa resolve: tướng Bái Sư Lỗ Túc; có lựa chọn thay thế (pendingBranches) |
| moi-phe-148 | Giác Chính Từ | Trương Giác / Bái Sư Pháp Chính / Tả Từ | pending | unresolved-local-primary; chưa resolve: tướng Bái Sư Pháp Chính |
| moi-phe-149 | Quyền Úc Mông | Tôn Quyền(S) / Bái Sư SP Tuân Úc / SP Lữ Mông/Trình Phổ | pending | unresolved-local-primary; chưa resolve: tướng Bái Sư SP Tuân Úc; có lựa chọn thay thế (pendingBranches) |
| moi-phe-150 | Tốn Từ Du | Lục Tốn / Thái Sử Từ / Bái Sư Hứa Du | pending | unresolved-local-primary; chưa resolve: tướng Bái Sư Hứa Du; có lựa chọn thay thế (pendingBranches) |
| moi-phe-155 | Hủ Duy Tử | Giả Hủ / Khương Duy / Tà Tử | pending | unresolved-local-primary; chưa resolve: tướng Tà Tử |
| moi-phe-171 | Vân Từ Tử | Triệu Vân(Quần) / Thái Sử Từ(Quần) / Tà Tử | pending | unresolved-local-primary; chưa resolve: tướng Tà Tử; có lựa chọn thay thế (pendingBranches) |
| team-intro-37 | Du Túc Tốn | SP Chu Du / Lỗ Túc / Lục Tốn | pending | unresolved-local-primary; chưa resolve: CP Tinh·Phong Thi Trận; có lựa chọn thay thế (pendingBranches) |
| team-intro-53 | Lô Điêu Trác | SP Lô Trực / SP Điêu Thuyền / SP Đổng Trác | pending | unresolved-local-primary; chưa resolve: CP Đồng Tâm Hiệp Lực |
| team-intro-54 | Lô Tiêu Điêu | SP Lô Trực / Tiêu Chỉ / SP Điêu Thuyền | pending | unresolved-local-primary; chưa resolve: tướng Tiêu Chỉ, CP Đồng Tâm Hiệp Lực |

## Hàng admitted trùng khoá nhau (đội cục bộ trùng đội cục bộ; ledger không gộp)

- youtube-162, team-intro-21
- team-intro-4, moi-phe-115
- team-intro-19, team-intro-62
- team-intro-26, moi-phe-118
- team-intro-36, moi-phe-130

## Ghi chú

- Hành Ách Trận (衡軛陣): identity map chỉ có entry `translation-reviewed` (duyệt hiển thị). Quy trình identity chỉ nhận
  entry `reviewed` có bằng chứng từ từ điển (`data/tactics.json`); duyệt hiển thị không xác nhận danh tính
  (`docs/season-team-data.md`). Không thêm vào Tra cứu nên 8 đội YouTube dùng chiến pháp này để `pendingIdentity`.
- Đội cũ còn pending do tên ngoài từ điển: `Tinh·Phong Thi Trận`, `Đồng Tâm Hiệp Lực`, `Tiêu Chỉ`, `Bái Sư …`, `Tà Tử`
  (typo Tả Từ). Không sửa trong piece này.
- Tên tướng tra identity của đội cục bộ = tiền tố SP/CO + `baseName` (bỏ ghi chú trong ngoặc như `(S)`, `(Cung S)`,
  `(Kỹ Năng Quân Sư Quan Hưng)`; slot `A/B` dùng tướng chính, lựa chọn nằm ở `pendingBranches`). Đây là nguyên nhân
  chính tăng admitted (bảng phân rã ở trên).
- Identity map làm mới bằng `python3 -m pipeline.recommended_identity_refresh` (chỉ cộng: 341 entry mới, 150 entry thêm
  alias, 0 entry xoá/đổi `displayNameVi`). Bỏ qua: alias `戮力上心` (duyệt hiển thị gán cho Đồng Lòng Hợp Sức) và
  `tactics.json` Thôi Phong Đoạn Nhẫn (chạm 2 identity cũ: Thôi Phong / Phá Phong Đoạn Nhẫn).
