---
status: done
issue: 66 (mục 3, 4)
branch: claude/khai-hoang-pk-s27-7474af
---

# Khai hoang chuyển sang PK-S27 Hán Diễm Trường Minh

## Kết quả mong muốn

Mục Khai hoang ghi mùa PK-S27, có thêm các cấu hình khai hoang PK-S27 đang chỉ nằm ở Đội chuẩn,
không URL `/khai-hoang/<handle>/` nào đã công bố bị đổi hoặc mất. Docs hết chỗ ghi mùa mục tiêu
Binh Diễn Xuân Thu.

Không làm: không đổi generation nguồn Recommended (chỉ publish lại generation hiển thị do hash đổi),
không đụng PR #93, không sửa tên SP 盧植 lệch giữa các mục (ghi thành issue riêng).

## Khảo sát (generation `95de17f0…`, 18/11/2026)

PK-S27 có 31 cấu hình nhóm 開荒 (issue ghi 13 trước refresh 16/11):

- 16 đội khai hoang (T1/T2): 8 từ sách trắng chính thức máy chủ Đài Loan (`s27-ofw-kh-*`),
  8 từ sách Thu Thạch (`s27-kh-*`).
- 15 đội cảm tử (碰瓷): 10 từ sách trắng Đài Loan (`s27-ofw-pc2/3-*`), 5 từ bảng Thu Thạch/A Diễm
  (`s27-hedan-*`, `s27-pengci-*`, `s27-lp-sanshi-lv-pengci`).

Đối chiếu với `data/khaihoang.json` (18 đội, 13 đội Chạm Sứ):

| Nhóm | Trùng bộ ba đã có | Mới |
|---|---|---|
| Khai hoang (16) | 14 cấu hình ứng với 11 đội đã có | 2: Trương Phi · Quan Ngân Bình · Thái Văn Cơ (`s27-kh-zhang-guan-cai`); Gia Cát Khác · Hà Thị · SP Lô Trực (`s27-ofw-kh-heshi`) |
| Cảm tử (15) | 10 (toàn bộ sách trắng Đài Loan, đã có ở bảng Chạm Sứ) | 5 đội Thu Thạch: Hạt Nhân Viên Thuật, Hạt Nhân Chu Tuấn, Đương Phong Kỵ, Lữ cảm tử, Mã cảm tử |

- Bản sách trắng Đài Loan đã được đưa vào mục Khai hoang ngày 15/11 (7 đội "Tiến cử"): mặc định của
  các đội trùng khớp cấu hình chính thức, chỉ lệch ở ô hai-chọn-một.
- Cấu hình Thu Thạch lệch đáng kể so với mặc định: Khương Thái Thái (cả 3 tướng), Hạ Thái Hoàng
  (Hoàng Nguyệt Anh Tam Thế Trận + Hổ Báo Kỵ), Mã Pháp Khác (sách gốc tự ghi Pháp Chính/Gia Cát Khác
  có thể đảo, chờ xác nhận), Khương Hạ Khác (Hạ Hầu Uyên sau 20 Thôi Phong Đoạn Nhẫn).
- Đội không có nguồn PK-S27: 7 đội khai hoang (Tôn Thượng Hương · Trần Cung · Hoàng Nguyệt Anh;
  Khương Duy · Hạ Hầu Uyên · Pháp Chính; Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ; SP Lô Trực ·
  Thái Sử Từ · Trương Xuân Hoa; Chu Thái · Trương Phi · Trương Xuân Hoa; Trương Xuân Hoa · Lữ Bố ·
  Tả Từ; SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác) và 3 đội Chạm Sứ (Mã Siêu · Hoàng Nguyệt Anh;
  Thái Sử Từ · Lăng Thống; Hạ Hầu Uyên · Tào Thuận).

## Ràng buộc kỹ thuật

- `pipeline/team-route-handles.json`: handle Khai hoang gán một lần; `--rebind` từ chối khi
  `khaihoang.json` đổi, nên theo tiền lệ (e0b1f5f7, f8a19f0a) sửa tay `khaihoangSha256` và chỉ
  **thêm** handle cho đội mới. Gỡ đội = URL 404 vĩnh viễn, nên không gỡ.
- Receipt dịch trong `pipeline/site-translations.json` gắn theo chỉ số (`teams[10]…`): đội mới thêm
  ở **cuối** mảng; thứ tự hiển thị do `recommended/recommendedOrder` quyết định lúc render.
- Chuỗi chỉ có chữ Việt ở field `note/context/buildNote/openingNote/label/displayLabel/seasonNote`
  là lớp `authored-vi`, không cần receipt. Không ghi chữ Hán vào dữ liệu mới.
- Tên chiến pháp lấy theo tên VN trong `data/tactics.json` (tra qua chữ Hán gốc), không lấy
  `tacticSlotsVi` của Recommended (vd 據水斷橋 = "Dùng Nước Đẩy Cầu" ở client VN).
- Test cứng: `tests-js/khaihoang-data.test.mjs` (season, danh sách Chạm Sứ),
  `tests/test_team_route_handles.py` (18 handle), e2e Khai hoang.

## Các bước

1. Chốt lựa chọn biên tập với chủ repo (xem mục Quyết định).
2. Sửa `data/khaihoang.json`: `season`, `seasonNote`; thêm đội/biến thể theo quyết định (cuối mảng).
3. Ghim hash: `pipeline/site-localization-policy.json` (`sourceFiles`, `baseline.notes` theo
   inventory), `pipeline/team-route-handles.json` (`khaihoangSha256` + handle mới).
4. `site_localization build/check/publish`, `team_route_handles --rebind/--check`, prune.
5. Cập nhật test có số cứng, `docs/codebase-summary.md`, `docs/season-team-data.md`, changelog.
6. Gate: `npm run check`, build, `npm run verify`, `npm run test:node`, e2e Khai hoang, unittest.
7. PR `Closes #66`, ghi chú xung đột với #93; đề xuất review Astra → Fable.

## Quyết định

Chủ repo chốt ngày 18/11/2026:

1. Đội không có nguồn PK-S27: **giữ nguyên**, URL không đổi; `seasonNote` nói rõ đội "Tiến cử" theo
   sách trắng PK-S27, các đội còn lại là cấu hình tham khảo mùa trước.
2. Thêm **2 đội mới** (Trương Phi · Quan Ngân Bình · Thái Văn Cơ; Gia Cát Khác · Hà Thị · SP Lô Trực)
   kèm handle mới, và **4 biến thể** `cn-pk-s27` (nhãn "CN · PK-S27", vùng Trung Quốc: nguồn là sách khai
   hoang đăng ở Trung Quốc đại lục) cho Khương Thái Thái, Hạ Thái Hoàng, Mã Pháp Khác, Khương Hạ Khác.
   Lúc đầu Mã Pháp Khác bị bỏ vì bản đảo lại trùng "CN · Thôi Phong"; sau review, chủ repo xác nhận lại trong
   session này: thêm đúng như chữ in, kèm lưu ý nguồn tự ghi có thể in đảo.
3. 5 đội cảm tử Thu Thạch **không** đưa lên bảng Chạm Sứ; giữ ở Đội chuẩn PK-S27.

## Rủi ro

- Xung đột với PR #93 (cùng sửa `khaihoang.json`, policy, ledger, generation) — người merge sau phải
  ghim lại hash và publish lại generation.
- Generation hiển thị đổi đồng thời ở nhiều PR song song → rebase xong phải publish lại.
