# Dựng 28 artboard "Thiết kế mới" vào site

Issue: #74 · Trạng thái: đang chạy · Brief đã chốt 2026-11-13.

## Mục tiêu

Dựng 14 màn (desktop 1440 + mobile 390) của mục "Canvas mới và 28 artboard thiết kế mới" trong
`docs/design/so-binh-phap/README.md` vào site, gồm cả 6 thay đổi hành vi đề xuất. Kết thúc khi 4 PR
mở từ `main`, CI xanh, review độc lập sạch. Không gộp, không deploy.

## Phase

| # | Phase | Nhánh | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 0 | Nền dùng chung: token/component chung, `compare-moi.mjs` có mock API, khung README | `feat/thiet-ke-moi-nen` (không PR) | — | chờ |
| 1 | Đội cộng đồng: `DoiCongDongMoi`, `DoiCongDongDetailMoi`, `DoiCongDongNewMoi`, `DoiCongDongMineMoi`, `BanNoticeMoi` | `feat/thiet-ke-moi-doi-cong-dong` | 0 | chờ |
| 2 | Quản trị: `AdminTeamsMoi`, `AdminAnalyze`, `AdminAIFeatures`, `AdminUsersMoi`, `AdminUserBanMoi`, `AdminAuditMoi` | `feat/thiet-ke-moi-quan-tri` | 0 | chờ |
| 3 | Đội của tôi: `DoiCuaToi` | `feat/thiet-ke-moi-doi-cua-toi` | 0 | chờ |
| 4 | Bài viết + Đội chuẩn: `BaiVietDetail`, `MainKho` | `feat/thiet-ke-moi-bai-viet-kho` | 0 | chờ |
| 5 | Thử gộp cả 4 nhánh, review độc lập từng PR, sửa tới sạch | — | 1–4 | chờ |

Mỗi artboard có bản `…Mobile`. Nhánh 1–4 cắt từ đỉnh nhánh 0; commit nền nằm trong cả 4 PR, PR gộp
trước mang nền vào `main`, các PR còn lại tự thu diff.

## Chống xung đột giữa các nhánh

- CSS mỗi nhóm nằm trong khối riêng của `css/styles.css` do Phase 0 tạo sẵn (dấu `/* moi:<nhom>:start */` … `end`).
- Component riêng của nhóm chèn vào `tokens.json` ngay sau mục neo do Phase 0 ghi trong README Phase 0.
- Cặp so ảnh nằm ở `scripts/design-canvas/moi-pairs/<nhom>.mjs`, mỗi nhóm một file.
- README: mỗi nhóm chỉ sửa dòng tình trạng của mình (các dòng cách nhau một dòng trống).
- Không nhóm nào sửa `docs/project-changelog.md` ngoài mục riêng của nhóm do Phase 0 tạo.

## Done means (từ brief)

1. 28 artboard: ảnh localhost 1440/390 cạnh `screens/<Artboard>.png` (`plans/261113-0116-thiet-ke-moi/reports/visual/`), bố cục khớp, 390 không tràn ngang.
2. Chip binh chủng ở đăng đội (Đội của tôi giữ ô "Binh chủng / ghi chú" theo artboard — người dùng chốt 2026-11-13); hộp xác nhận xoá trong trang (đăng đội + đội của tôi); ngày hết khoá + nhãn nút theo thời hạn; nhật ký nhóm theo ngày; Soi đội quản trị hiện tên tiếng Việt; món thiếu trên thẻ Đội chuẩn ở 390px + trình đọc màn hình — mỗi cái có e2e.
3. `node scripts/design-tokens.mjs --check` đạt; component mới có trong `tokens.json`; ceiling legacy không tăng.
4. Test hiện có đạt; `/zh/` tương ứng vẫn hiển thị, chữ mới có bản Trung.
5. 4 PR mở, CI xanh, review độc lập sạch; README thiết kế ghi artboard đã dựng.
6. Không sót dev server/worktree của đợt chạy.

## Ngoài phạm vi

Gộp/deploy; #69 mục 2–3; artboard ngoài nhóm 28; sửa `.dc.html`; đổi schema D1/worker.

## Quyết định thay người dùng

- Tối đa 2 phiên con song song (đĩa còn 11 GB).
- Nền dùng chung tách thành Phase 0 để 4 PR gộp độc lập theo thứ tự bất kỳ.
- Lỗi ngoài phạm vi gặp trên đường → issue `ai-handle`, không sửa.
