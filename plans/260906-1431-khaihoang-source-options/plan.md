# Lựa chọn cấu hình khai hoang có nguồn

Trạng thái: hoàn tất local, chưa commit/deploy.

- Kết quả: giữ build mặc định, thêm lựa chọn nguyên bộ theo nguồn/khu vực/giai đoạn; sửa Khác–Bình–Tiến thành Thương; sửa Đồng Lòng Hợp Sức theo ảnh client Việt.
- Người dùng xác nhận mùa đang chơi là Binh Diễn Xuân Thu trong lúc thực hiện. UI lấy mùa này làm mục tiêu, giữ rõ nhãn nguồn mùa khác; chưa mô tả nhánh binh chủng tùy chỉnh.
- Phạm vi: dữ liệu khai hoang, từ điển chiến pháp và nguồn build_dict, renderer/CSS, test và docs sở hữu. Không đổi tier, commit hoặc deploy; giữ WIP khác.
- Nguồn: [audit 14 đội](../reports/research-260906-1420-khaihoang-cn-global-meta-audit.md), ảnh người dùng 2026-09-06, các URL trực tiếp lưu cùng cấu hình.
- Thiết kế: `variants[]` tùy chọn chứa cấu hình độc lập, tên/khu vực/mốc áp dụng/nguồn. Giai đoạn không được nguồn mô tả không tự kế thừa. Native select đổi nội dung trong card; mặc định giữ chuyển hình, biến thể không kế thừa chuyển hình chưa xác nhận.
- Chấp nhận: mọi biến thể có URL nguồn và ba tướng đúng roster; không trùng chiến pháp trong cùng giai đoạn; không binh chủng trái chiêu. Lựa chọn được bằng bàn phím/mobile, đổi lại mặc định được, không ảnh hưởng card khác.
- Kiểm tra: regression từ điển + merge offline; dữ liệu variant; Playwright chọn cấu hình và nguồn; Astro check/build/dist/verify; review theo skill ak:code-review.
- Rủi ro: pipeline HTML cũ không tái tạo đủ JSON curated; không chạy builder ghi đè. Ghi rõ boundary này trong docs. Revert riêng thay đổi của lượt này nếu cần rollback.
- Tiến độ: inspect/source → implement → scout/spec review → [review độc lập](../reports/review-260906-1431-khaihoang-source-options.md) → verify hoàn tất. Full Node 137, Python 5, Playwright 2 pass; Astro check 0 lỗi; build, 9 dist contracts và verifier pass. [Báo cáo delivery](../reports/implementation-260906-1431-khaihoang-source-options.md).
