# Review lựa chọn khai hoang theo nguồn

Ngày: 2026-09-06. Scope: diff runtime/data/tests của kế hoạch `260906-1431-khaihoang-source-options`; Stage 1 đã pass theo controller. Review theo skill `ak:code-review`. Chỉ ghi report, không sửa code hoặc WIP.

## Kết quả

Không tìm thấy lỗi mới có bằng chứng cần chặn trong phạm vi review. 12 lựa chọn trên 10 đội giữ roster và cấu hình mặc định; các giai đoạn được khai báo đầy đủ, không trùng chiêu hoặc trái `troopFit` trong dictionary hiện tại.

- `js/render.js:226-255`: state và closure nằm riêng từng card; select luôn còn trong DOM khi thay nội dung, giữ focus; mặc định được chọn lại bằng giá trị rỗng. Mỗi lựa chọn thay nguyên bộ, không kế thừa trước 20 hoặc chuyển hình của bản mặc định.
- `js/render.js:197-215,258-265`: giai đoạn không có dữ liệu được ẩn; nội dung dùng DOM/text node. URL nguồn giới hạn HTTPS, mở tab với `noopener noreferrer`. Native select có label/tên truy cập và cao tối thiểu 44px; nội dung đổi có live region.
- `data/tactics.json`, `data/tactics-generic.json`, `pipeline/tactic-name-overrides.json`: Đồng Lòng Hợp Sức mang danh tính 勠力同心 và mô tả trị liệu theo bằng chứng client do controller cung cấp; 戮力上国 vẫn giữ hiệu ứng Nội chính với tên riêng. `_apply_overrides` chạy trước `_merge_generic`, regression kiểm tra không còn tên Việt xung đột trong input cũ này.
- Nhãn mùa/khu vực và ghi chú giới hạn tránh trình bày nguồn mùa cũ thành xác nhận meta Binh Diễn Xuân Thu. Boundary importer HTML được ghi rõ trong docs; không đánh dấu đây là vấn đề mới cần mở rộng phạm vi.

## Đối chiếu nguồn trực tiếp

Đã mở và đối chiếu nội dung nguồn trong lượt review:

- [JP S23](https://sangokushi-shinsen.info/2026/01/25/520%E3%80%90%E8%B2%82%E8%9D%89%E3%81%AE%E4%B8%89%E5%9B%BD%E5%BF%97%E7%9C%9F%E6%88%A6%E3%80%91%E3%80%80s23%E3%80%80%E3%82%B9%E3%82%BF%E3%83%80%E3%82%AC%E3%82%A4%E3%83%89%E3%80%80%E3%82%B9%E3%82%BF/): hai bộ Pháp–Mã–Khác và Khương–Hạ–Khác khớp; thứ tự nguồn đổi Gia Cát Khác lên đầu sau 20 được biểu diễn bằng chủ tướng riêng.
- [JP S13](https://sanngokusinnsenn.com/seazon13-sutada/): Quan Ngân Bình làm chủ tướng sau 20, mang Thanh Châu; cảnh báo chỉnh Võ Lực được giữ.
- [JP PK](https://sangokushi-shinsen.com/sutada-hensei/): nhánh Hạ Hầu Uyên Tam Thế khớp cả hai giai đoạn và chủ tướng.
- [CNBlogs](https://www.cnblogs.com/walj/articles/19910985), [18183](https://www.18183.com/sg/5540906.html), [Bilibili](https://www.bilibili.com/read/cv9175015/): các nhánh CN được chọn khớp bộ chiêu và mốc bài; nhánh Cung giữ Vô Đương.
- [Dengeki](https://dengekionline.com/article/202601/61284): bộ Lục–Tả–Xuân Hoa và SP Viên–Hạ–Xuân Hoa khớp danh sách hai chiêu; không bịa bộ trước 20.
- [KR](https://gall.dcinside.com/mgallery/board/view/?id=3kingdoms&no=355794): nguồn ngày 13/04/2026 dùng Sĩ Biệt sau 20, khớp variant Hàn.

## Kiểm tra và giới hạn

- Reviewer chạy `node --test tests-js/khaihoang-data.test.mjs tests-js/tactics-data.test.mjs`: **9/9 pass**.
- Reviewer chạy `python3 -m unittest tests.test_build_dict`: **5/5 pass**.
- Đã đọc E2E kiểm tra toàn bộ lựa chọn, cách ly card, khôi phục mặc định và bàn phím mobile. Controller đang sở hữu lượt chạy Playwright/build; report này không thay thế kết quả đó và không xác nhận deploy.
- Bahamut trả Internal Error qua công cụ web ở lượt review. Nội dung đất 6 được kiểm với audit đã lưu, chưa tái xác minh trực tiếp; không có bằng chứng mới bác bỏ kết quả nghiên cứu trước.
- Ảnh client do controller xác minh; reviewer kiểm danh tính và số liệu đã chuyển vào JSON, không tuyên bố tự xem lại ảnh.

Unresolved questions: không có câu hỏi chặn. Cần controller ghi kết quả E2E/build cuối cùng vào hồ sơ delivery.

Status: DONE
Summary: Không phát hiện lỗi mới có bằng chứng; kiểm tra hẹp pass, đối chiếu trực tiếp các nguồn truy cập được khớp cấu hình đã thêm.
