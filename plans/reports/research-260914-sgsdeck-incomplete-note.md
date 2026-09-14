# Xác minh ghi chú `許攸弓S帶`

- Research date: 2026-09-14
- Topic: phần bị dở trong ghi chú SGSDeck PK-S24 `team-gzx50`
- Scope: nguồn Đài Loan/phồn thể, mùa nguồn PK-S24; mùa/server của người dùng: unknown

## Kết luận thay thế

**Chưa xác minh** — chuỗi nguồn `評分：86分（賈詡帶援助甲，許攸弓S帶）` kết thúc ngay sau động từ `帶`, nên phần Hứa Du mang/trang bị gì đã bị thiếu. Có thể dịch phần đã rõ: 86 điểm; Giả Hủ dùng giáp Viện Trợ; Hứa Du dùng cung bậc S. Không được tự khép câu như thể `帶` không tồn tại hoặc đoán vật phẩm còn thiếu.

## Bằng chứng

- Project snapshot: `pipeline/localization-inputs/recommended.json`, PK-S24, `sourceConfigId: team-gzx50`, đội Giả Hủ / Hứa Du / Thái Sử Từ, `notesRaw` đúng chuỗi dở trên. **Đã đối chiếu**.
- Trang nguồn trực tiếp: https://sgsdeck.com/recommended/team-gzx50 — xác nhận đội `滑鼠弓`, T2, PK-S24; reader output không cung cấp phần ghi chú hoàn chỉnh hơn. **Đã đối chiếu** cho record; **Chưa xác minh** cho phần bị thiếu.
- Exact search `"許攸弓S帶" OR "賈詡帶援助甲"`: không có kết quả có thể truy nguyên. **Chưa xác minh**.
- Search `"滑鼠弓" "援助甲" 許攸 弓S`: không có kết quả có thể truy nguyên. **Chưa xác minh**.

## Bằng chứng có thể mở lại

- Ảnh/bản gốc trước OCR hoặc payload nguồn có phần sau `帶`.
- Đính chính của tác giả/SGSDeck.
- Nguồn độc lập đúng đội và đúng mùa ghi rõ vật phẩm còn thiếu.

## External-call budget

- Limit: 5
- Used: 3
- Remaining: 2
- Calls: 1 direct SGSDeck page read và 2 web searches.
