# Refresh Đội chuẩn từ SGSDeck: PK-S27 Hán Diễm Trường Minh

- Research date: 2026-11-03 (giờ máy, +07)
- Branch: source verification + data refresh (người dùng yêu cầu "cập nhật pk27 hán diễm trường minh từ sgsdeck vào đội chuẩn", rồi chọn làm cả kho)
- Topic lock: SGSDeck Recommended hiện có gì cho PK-S27 và các mùa khác so với generation đang xuất bản

## Scope

| Field | Value | How determined |
| --- | --- | --- |
| Server/region | SGSDeck (TW) làm mốc Sách Giáo Khoa; không suy áp dụng cho VN | `docs/research-sources.md`, report 2026-11-02 |
| Season | PK-S27 漢焰長明, mở rộng toàn kho theo lựa chọn người dùng | Yêu cầu + câu trả lời "Cả kho" |
| Capture date | 2026-11-03 | host metadata |

## Previous Conclusion and Corrections

- [research-261102-han-diem-truong-minh.md](research-261102-han-diem-truong-minh.md): PK-S27 có 76 cấu hình SGSDeck trong repo. Nay SGSDeck có 128 (115 交戰 + 13 開荒) — kết luận cũ về số lượng được thay.
- `docs/season-team-data.md` đính chính 2026-11-03 về `桃園結義`: đã áp dụng trong lần duyệt lại toàn bộ này.

## Call Budget

Đây là lượt cập nhật dữ liệu theo quy trình có sẵn (crawler), không phải nghiên cứu meta.

| Topic | Allowance | Limit | Used | Remaining |
| --- | --- | ---: | ---: | ---: |
| PK-S27 SGSDeck refresh | External sources (đọc trực tiếp) | 5 | 4 | 1 |
| PK-S27 SGSDeck refresh | TQCCL MCP | 5 | 0 | 5 |

Lượt đọc trực tiếp: trang `recommended?season=pk-s27&category=交戰`, trang `/recommended` (curl), bộ chọn mùa render bằng trình duyệt, đếm 9 trang danh sách (1 lượt gộp). Ngoài budget: crawler `pipeline.crawl_sgsdeck_recommended` tải 1721 trang công khai theo quy trình xuất bản (cache `.cache/sgsdeck-recommended/`).

## Claim Evidence

| Claim | Status | URL | Notes |
| --- | --- | --- | --- |
| SGSDeck: PK-S27 128 cấu hình (交戰 115, 開荒 13), PK-S28 192 (177/15), PK-S20 119, mùa mặc định vẫn OG-兵演春秋 「進行中」, PK-S27 gắn nhãn 「新賽季 · 11/14 開季」 | Đã đối chiếu | https://sgsdeck.com/recommended | Đọc bộ chọn mùa đã render và từng trang danh sách. |
| SGSDeck đổi tên PK-S20 奇兵八陣 → 奇門八陣 | Đã đối chiếu | https://sgsdeck.com/recommended | Bộ chọn mùa. |
| Markup SGSDeck đổi: danh sách không còn điểm/tiền tố phe; điểm và phe ở trang chi tiết | Đã đối chiếu | trang danh sách + chi tiết trong cache | Parser cũ trả `null` mà không báo. |
| 開荒 mới có hàng 「20 級前 / 20 級後 / (không nhãn)」, mỗi hàng 1 chiến pháp, đồng nhất ở 31 trang / 93 tướng | Đã đối chiếu | cache, ví dụ https://sgsdeck.com/recommended/s28-kh-sanshi-lu | Khảo sát toàn bộ 58 cấu hình 開荒. |
| Cấu hình và tier SGSDeck là của server TW | Phương án từ nguồn | — | Không tự áp cho VN. |

## Conclusion

Đội chuẩn đã cập nhật toàn kho theo SGSDeck ngày 2026-11-03 (generation `43a4bb32…`, 1640 cấu hình). Mốc SGSDeck PK-S27 đã xác minh (bản TW); chưa có mốc SGSDeck đã xác minh cho bản VN của kịch bản.

## Limits and Unresolved Questions

- `替代` và `特技` của SGSDeck chưa vào schema.
- 10 tên chiến pháp chưa có trong từ điển dùng Hán-Việt tạm (quyết định người dùng); đổi khi có tên chính thức VN.
- 46 cấu hình PK-S28 SGSDeck đã gỡ nên trang cũ của chúng trả 404.
