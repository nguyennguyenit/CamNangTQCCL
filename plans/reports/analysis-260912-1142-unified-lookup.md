# Đối chiếu dữ liệu cho bộ tra cứu thống nhất

Ngày: 2026-09-12. Phạm vi: hoàn tất bảng đối chiếu đã chốt; chưa sửa dữ liệu runtime, mapping đã review hoặc giao diện.

**Cập nhật quyết định 12:03:** [Brainstorm đã chốt](brainstorm-260912-1203-unified-lookup.md)
là căn cứ bàn giao hiện tại. Người dùng chọn ưu tiên SGSDeck khi giá trị khác
nhau; SGSDeck thiếu thì giữ dữ liệu cũ. Các đề xuất “giữ local” và câu hỏi ở
dưới là lịch sử trước quyết định này. Số liệu/CSV/JSON đối chiếu giữ nguyên làm
bằng chứng, không phải policy hợp nhất hiện hành. Yêu cầu ẩn nguồn áp dụng
cho danh mục tra cứu; contract điểm đội của plan mùa giữ nguyên.

## Quyết định sản phẩm

- Một bộ tra cứu thống nhất; không hiển thị tên nguồn, URL nguồn hoặc màn hình chọn nguồn cho người dùng.
- Giữ nguồn nội bộ để cập nhật/đối chiếu. Giữ ID và tên Việt hiện có; phân biệt bản thường/SP/CO/40Y.
- Thông tin mùa/điều kiện chỉ xuất hiện khi ảnh hưởng cách chơi. Thiếu thông tin hiện “Đang cập nhật”.

## Kết quả

| Nhóm | Hiện tại | SGSDeck | Cặp theo tên | Trong đó đã có mapping reviewed | Chưa ghép ở SGSDeck | Chưa ghép ở bộ hiện tại |
|---|---:|---:|---:|---:|---:|---:|
| generals | 112 | 202 | 112 | 39 | 90 | 0 |
| tactics | 240 | 393 | 226 | 40 | 167 | 14 |

112/112 tướng có cặp tên sau chuẩn hóa. Tổng 338 cặp tên: 79 liên kết đã review và 259 ứng viên mới (73 tướng, 186 chiến pháp). Đây chưa phải 338 bản ghi đã review; không tự promote mapping. 90 tướng/167 chiến pháp chưa ghép theo tên không đồng nghĩa là nội dung đã xác minh mới cho bản Việt. 14 chiến pháp hiện tại chưa ghép gồm 8 mục thiếu tên Hán. Không dùng phép cộng trừ này làm số lượng công bố cuối cùng.

SGSDeck có 37 mô tả chiến pháp chỉ ghi “chờ bổ sung”. Bốn nhóm equipment/advisors/troop-mods/buildings chưa có owner canonical riêng tương ứng; phải tạo danh mục và tên Việt có review, không tự nối bằng tên tướng trong cấu hình đội.

## Khác biệt có cấu trúc ở tướng

So sáu chỉ số cơ bản và năm thích tính chung; chưa đối chiếu toàn bộ mô tả chiến pháp hay mọi trường của tướng. Khác biệt không chứng minh nguồn nào sai. Giữ giá trị hiện tại đến khi có kết luận đúng phiên bản.

| Tướng | Trường | Hiện tại | SGSDeck |
|---|---|---|---|
| Hạ Hầu Đôn | troopApt.thuan | A | S |
| Vương Nguyên Cơ | stats.mi | 50 | 80 |
| Nhạc Tiến | stats.toc | 68 | 58 |
| Trương Xuân Hoa | stats.mi | 68 | 75 |
| Quan Ngân Bình | stats.mi | 50 | 79 |
| Mã Vân Lộc | stats.mi | 47 | 75 |
| Lỗ Túc | troopApt.cung | A | S |
| Lữ Mông | troopApt.cung | A | S |
| Lữ Linh Ỷ | stats.mi | 34 | 74 |
| SP Lữ Mông | troopApt.cung | A | S |
| Đổng Bạch | stats.mi | 57 | 77 |

## Cách hợp nhất đề xuất

1. Review 259 ứng viên theo tên; kiểm biến thể và identity một-một, giữ canonical ID/tên Việt. Chuyển giản/phồn chỉ tạo ứng viên; không kết luận áp dụng ở Việt Nam.
2. Bổ sung trường thiếu có evidence theo đúng thực thể. Với trường đang có nhưng khác, giữ local và đưa vào danh sách đối chiếu riêng nội bộ. Không mặc định chọn bản mới hơn.
3. Review 14 chiến pháp chưa ghép và 257 bản ghi SGSDeck chưa ghép. Giữ mục chưa đủ evidence tách khỏi dữ liệu có thể dùng ngay; không gộp fuzzy.
4. Tạo phần tra cứu bốn nhóm bổ sung; giữ đặc kỹ/option/cấp công trình và các quan hệ chưa rõ. Lưu provenance trong artifact nội bộ, không xuất vào giao diện.

## Quan hệ với plan mùa

- Plan `../260907-0233-season-team-lookup/plan.md` hiện pending, 0/4 phase. Format validator đạt; không phải behavioral tests.
- Catalog completed; validator snapshot hiện đạt sáu nhóm. Phase 1 và phần dùng corpus cũ ở phase 2 không phụ thuộc toàn bộ hợp nhất danh mục.
- Mapping mới chỉ chặn cấu hình dùng đúng thực thể đó. Recommended team/score là intake riêng ở phase 2, không nằm trong sáu file catalog.
- Thống nhất owner cho identity/dictionary; không sửa đồng thời `js/app.js`, `js/render.js`, public-artifact manifest hoặc cùng dictionary ở hai luồng. Workspace main đang có WIP chưa commit; giữ nguyên.
- Quyết định không hiện nguồn đã chốt cho bộ tra cứu. Plan mùa hiện còn nhãn “Điểm SGSDeck” và breakdown nguồn từ quyết định cũ: nếu mở rộng yêu cầu ẩn nguồn sang cả điểm đội, cần đồng bộ nhãn/acceptance trong plan trước UI. Không tự suy rằng người dùng đã bỏ điểm hoặc provenance MCP.

## Kiểm chứng

- `python3 -m pipeline.query_sgsdeck_catalog validate`: valid sáu nhóm.
- `ak plan validate plans/260907-0233-season-team-lookup --json`: valid cấu trúc.
- `ak plan status plans/260907-0233-season-team-lookup --json`: pending; 0/4 phase, 0/43 checkbox.
- Đối chiếu toàn bộ 202+393 bản ghi tên với 112+240 bản ghi hiện tại; kiểm identity một-một và mọi mapping reviewed giữ đúng tên Việt.
- SHA-256 đầu vào lưu trong JSON; sau đối chiếu kiểm byte hash không đổi. Không chạy builder ghi dữ liệu, test runtime hay deploy.

Chi tiết: [analysis-260912-1142-unified-lookup.csv](analysis-260912-1142-unified-lookup.csv), [analysis-260912-1142-unified-lookup.json](analysis-260912-1142-unified-lookup.json). JSON lưu toàn bộ bảng chuyển tên để tái lập phép ghép từ input hash mà không cần tin kết quả tổng hợp.

## Câu hỏi còn mở

- 11 khác biệt chỉ số/thích tính cần evidence phiên bản để quyết định giá trị cuối; không chặn bắt đầu Phase 1 plan mùa.
- Nhãn điểm đội có thuộc yêu cầu ẩn tên nguồn hay chỉ áp dụng danh mục tra cứu? Chỉ cần chốt trước sửa UI điểm, không chặn nền dữ liệu.
