# Phase 4 — UI Soi đội từ ảnh

## Context
- Tính năng chính: user upload screenshot → Worker (P3) trả team Hán → map sang Việt qua `tactics.json` (P1) → hiện kết quả + đối chiếu 172 team có sẵn.
- Chống hallucination: mọi tên Hán từ model **fuzzy-match về dict**; cái nào không chắc → đánh dấu "không chắc, kiểm tra lại".

## Requirements
- Section "Soi đội" (tab thứ 5, `#analyze`): upload/paste ảnh + Turnstile widget (**lazy-load script chỉ khi mở tab** — giữ 3 section cũ offline/zero-dep).
- Gọi Worker → nhận `{heroes:[{nameCn,tacticsCn,statFocusCn}]}`.
- **[C1] Map đủ 3 trục**: `tacticCn`→`tactics.json`; `nameCn`→`heroes-dict.json`; `statFocusCn`→bảng chất tướng. Tất cả qua `js/match-dict.js` (H1) → tên Việt canonical + confidence. **KHÔNG hiện raw Hán** trừ khi confidence thấp (gắn cờ "không chắc, kiểm tra").
- **[M2] Đối chiếu 172 team (DEFERRABLE — tách khỏi MVP)**: scoring Jaccard trên set tướng (chuẩn hóa canonical), ngưỡng hiển thị ≥ vd 2/3 tướng trùng, tie-break theo số chiến pháp trùng → "Giống team: <tên> (n/3)". MVP ship "đọc + map 3 trục" trước; đối chiếu thêm sau.
- Trạng thái: loading, lỗi (422 / 429 hết lượt / mạng). **[M3] Disclaimer đích danh**: "ảnh gửi tới Alibaba Cloud Model Studio xử lý, không lưu; tránh ảnh lộ tên tài khoản".

## Files
- Tạo: `js/analyze.js` (upload, gọi worker, map, render kết quả), `js/match-dict.js` (fuzzy-match Hán→canonical, dùng chung).
- Sửa: `index.html` (tab + section + Turnstile script), `js/app.js` (nav `#analyze`, SECTIONS), `css/styles.css`.
- Config: URL Worker + Turnstile site-key (public, không phải secret) trong 1 const/`config.js`.
- Test: `tests-js/match-dict.test.mjs`.

## Steps
1. UI upload (drag/drop + paste clipboard) + nén ảnh client (giảm token) trước khi gửi.
2. Turnstile widget → lấy token → gửi kèm.
3. Gọi Worker `/analyze`; xử lý 200/422/429/lỗi.
4. `matchDict(cn)`: normalize + fuzzy vào dict → {viet, icon, confidence}. Tái dùng logic Phase 1/2.
5. Render: mỗi tướng = tên Việt + chất tướng + chiến pháp (tag + icon + tooltip mô tả) + cờ "không chắc".
6. Đối chiếu 172 team → gợi ý team giống + link.

## Acceptance (3 trục đo riêng — C1)
- % chiến pháp đúng, % tướng đúng, % chất tướng đúng (đo riêng, không gộp).
- Mọi tên hiển thị là canonical Việt hoặc gắn cờ "không chắc" — KHÔNG raw Hán im lặng.

## Tests (TDD)
- `match-dict.test.mjs`: `魅惑`→Mê Hoặc; OCR-lỗi-giả `神机刀算`→top `神机妙算`/Thần Cơ Diệu Toán; tướng `连环计`-kiểu; tên lạ → confidence thấp + flag.
- Thủ công: 5 screenshot game thật (gồm 2 ảnh user đã đưa) → đo riêng 3 trục %.

## Risks / Rollback
- Vision sai/hallucinate → fuzzy về dict + cờ độ tin + user sửa; không tự nhận là chân lý.
- Hết quota (429) → thông báo lịch sự; feature degrade, 3 section cũ vẫn chạy.
- Ảnh lớn → nén client; giới hạn kích thước.
- Privacy → disclaimer rõ; không lưu ảnh ở client lẫn worker.
- Nếu Phase 3 chưa sẵn → section ẩn sau feature-flag, không block P1/P2 ship.
