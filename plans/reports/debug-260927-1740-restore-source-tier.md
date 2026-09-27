# Khôi phục Tier nguồn ở Đội chuẩn

Ngày: 2026-09-27. Trạng thái: đã sửa và kiểm tra UI local; cổng phát hành chưa đạt. Không commit, push hoặc deploy.

## Nguyên nhân và thay đổi

- `d28d455` có badge `tierRaw` và facet `tier`.
- `c716a1e` bỏ badge/facet này, chuyển sang hiển thị điểm nguồn. Comparator vẫn ưu tiên `tierOrder`, sau đó điểm giảm dần và thứ tự nguồn.
- Snapshot hiện tại có 1.366 bản ghi; 1.358 bản ghi có Tier nguồn. Không cần suy Tier từ điểm hoặc sửa dữ liệu.
- Khôi phục badge trên Thẻ, Thẻ gọn, Bảng; facet Tier theo thứ tự T0, T0.5, T1, T1.5, T2, T3; hỗ trợ nhãn đội chức năng nếu nguồn có.
- URL giữ nhiều lựa chọn Tier, kết hợp AND với nhóm khác, xóa lọc xóa cả Tier. Đội khác tiếp tục bỏ selector Tier lịch sử. Bản Trung có nhãn tương ứng.
- Giữ nguyên thay đổi có sẵn trong workspace. Không sửa pipeline publication, tên tướng hoặc asset ngoài phạm vi.

## Kiểm tra

- Test hồi quy Tier đã thất bại trước sửa và đạt sau sửa.
- Node: 365/366 đạt. Test còn lỗi: `astro-dist-contract` vì `public/brand-concept-v2.png` chưa nằm trong allowlist; giữ nguyên file này.
- Browser danh sách đội: 52/53 đạt. Test còn lỗi kỳ vọng `Vô Song Đại Kiều`, trong khi logic rút gọn tên có sẵn hiển thị `Đại Kiều`.
- Sau sửa cuối cho nút Xóa lọc: 3/3 browser test Tier và selector legacy đạt, gồm reload, cả ba view, bản Trung và không có pageerror.
- `npx astro build`: đạt, 3.123 trang. `npx astro check`: 0 errors, 0 warnings, 2 hints. Kiểm tra ảnh bảng và các bài kiểm tra viewport 320/375/768/1280, hai theme đạt.
- `git diff --check`: đạt.

## Cổng còn chặn

`npm run build` / `npm run check` dừng ở kiểm bản địa hóa: source hash chưa đồng bộ cho bốn file Tier vừa sửa (`recommended-reference-render`, `recommended-reference-state`, `team-detail-navigation`, `team-filter-section`) và bốn file ngoài phạm vi (`js/render.js`, `src/components/landing/Landing.astro`, `src/layouts/SiteLayout.astro`, `src/lib/seal.ts`). Không có UI source expression bị thiếu.

Bản Astro trực tiếp chỉ dùng để kiểm tra hành vi; chưa phải artifact đã vượt cổng phát hành. Trước deploy, cần hoàn tất review/publish lại bản địa hóa và re-pin theo `docs/deployment-guide.md`, đồng thời giải quyết asset allowlist và test tên tướng trong phần việc tương ứng.

## Bổ sung nhóm Tier theo SGSDeck (17:51)

- Đối chiếu trực tiếp https://sgsdeck.com/recommended: mùa OG hiện có các khối T0 (12), T0.5 (1), T1 (12), mỗi khối có tiêu đề và số đội.
- Lịch sử `b3b26a3`/`d28d455` có `season-tier-group` trong browser theo mùa. Đây là tiền lệ bố cục nhóm; không phải bằng chứng browser Recommended hiện tại từng dùng cùng đoạn code.
- Đội chuẩn nay chia khối Tier trong cả Thẻ, Thẻ gọn và Bảng; tiêu đề đếm theo kết quả lọc. Không dựng khối rỗng, bản ghi thiếu Tier vào “Chưa xếp hạng”. Đội khác giữ nguyên.
- Test hồi quy ban đầu đỏ (không có section), sau sửa đạt. 16/16 browser test: nhóm, thứ tự, chuyển view, xóa lọc, 320–1440px và hai theme. 28/28 Node test liên quan đạt. Astro build trực tiếp đạt; Astro check 0 errors/0 warnings/2 hints; đã xem ảnh mobile, không tràn ngang.
- Cổng phát hành từ mục trước vẫn chưa được xử lý; không deploy.

## Đánh dấu mùa đang diễn ra (18:04)

- Đánh dấu nguồn `og-兵演春秋` là mùa hiện tại theo yêu cầu và SGSDeck đã đối chiếu: option có “Hiện tại”, khung chọn hiện “Đang diễn ra”. Chọn mùa khác hoặc Tất cả ẩn trạng thái đang diễn ra; nhãn option mùa hiện tại vẫn giữ nguyên.
- Dùng hằng current source ID riêng, không suy từ mặc định hoặc lựa chọn người dùng. Có nhãn zh. Hướng dẫn cập nhật ở `docs/code-standards.md`.
- 9/9 browser tests đạt: đổi mùa, Tất cả, reload, zh, 320/375/768/1280px và hai theme. Astro build trực tiếp đạt; diff check đạt. Đã xem ảnh mobile, nhãn không chồng chữ.
- Chưa deploy; chưa giải quyết các cổng phát hành ghi phía trên.
