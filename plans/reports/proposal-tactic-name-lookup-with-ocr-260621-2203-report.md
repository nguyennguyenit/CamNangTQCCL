# Đề xuất: Tra cứu tên chiến pháp (Từ điển đa ngữ + sửa data + OCR ảnh)

_2026-06-21 22:03 (+07). Bối cảnh: user nhìn tên chiến pháp tiếng Trung trong game (screenshot) → cần tra ra tên Việt đúng._

## Tóm tắt
Làm được, theo 3 phase tăng dần rủi ro. Phase 1–2 chắc chắn. **Phase 3 (OCR) là phần rủi ro** vì site static (không backend) + OCR chữ Hán trên nền tranh game khó. Điểm mấu chốt cứu OCR: **không cần OCR hoàn hảo** — chỉ cần fuzzy-match output vào tập tên đóng (~vài trăm chiến pháp).

## Kiến trúc dữ liệu (nền chung)
Crawl offline → `data/tactics.json`:
```
{ chinese:"魅惑", hanViet:"mị hoặc", viet:"Mê Hoặc",
  aliases:["mi hoac","me hoac"], type, quality, effect, icon }
```

## Phase 1 — Từ điển tra cứu đa ngữ (CHẮC, làm trước)
Section/trang "Tra cứu chiến pháp":
- Search 1 ô, chịu mọi ngõ vào: tiếng Việt bỏ dấu (`me hoac`), Hán-Việt (`mi hoac`), dán chữ Hán (`魅惑`).
- **Fuzzy/typo-tolerant** (tái dùng `normalizeText` + difflib-kiểu): `tran muc` → "Sân Mục Hoành Mâu".
- Kết quả: tên Việt chuẩn + Hán + Hán-Việt + loại + mô tả + icon.
- Hạ tầng: y hệt filter engine hiện có, +1 file JSON. Zero-dep, static.

## Phase 2 — Dùng DB làm nguồn chuẩn (sửa data)
- Đối chiếu 112 tên đang dùng ↔ DB Trung → phát hiện & sửa typo (Trấn Mục→Sân Mục…), bổ sung alias.
- Gắn tooltip mô tả chiến pháp lên card team (các CP đã map).
- Tăng độ chính xác search toàn site.

## Phase 3 — OCR ảnh (RỦI RO — cần spike riêng + quyết hạ tầng)
Luồng: user upload screenshot → OCR vùng chữ Hán → **fuzzy-match từng token vào `tactics.json`** → ra tên Việt.

**Điểm mấu chốt khiến khả thi:** tập tên đóng + tên ngắn 3–4 chữ + đặc trưng → OCR sai vài ký tự vẫn match đúng (vd OCR `魁惑`, dict gần nhất `魅惑`). OCR không cần chính xác tuyệt đối.

**2 lựa chọn hạ tầng (phải chọn — đây là quyết định lớn):**
| | tesseract.js (client-side) | Cloud OCR (Google/Baidu) |
|---|---|---|
| Hợp static GitHub Pages | ✅ chạy trong browser | ❌ cần API key + proxy/serverless (phá mô hình zero-dep/static) |
| Accuracy chữ Hán nền game | ⚠️ trung bình (font cách điệu, nền nhiễu) | ✅ cao |
| Chi phí | model ~15MB tải client (lazy-load) | tiền/quota + gửi ảnh user lên cloud |
| Privacy | ảnh không rời máy | ảnh gửi bên thứ 3 |

**Khuyến nghị Phase 3:** tesseract.js + fuzzy-match-vào-dict (giữ static, miễn phí, ảnh không rời máy). NHƯNG **bắt buộc spike accuracy** trên 5–10 screenshot game thật trước khi cam kết. Nếu accuracy quá thấp → cân nhắc: (a) yêu cầu user crop vùng chữ, (b) fallback cloud OCR (user tự nhập key), (c) bỏ OCR, chỉ giữ Phase 1–2.

**Lưu ý UX thay thế OCR (rẻ hơn, đáng cân nhắc):** thay vì OCR, cho user **gõ/dán chữ Hán** từ game (nếu copy được) hoặc **chọn icon** — nhưng game mobile thường không copy được text → OCR vẫn là lối tiện nhất cho screenshot.

## Lộ trình & rủi ro
1. **Phase 1+2** (chắc): crawl full category + map Hán-Việt (đã chứng minh ~80% auto) + dựng từ điển + sửa data. ~2–3 ngày.
2. **Spike OCR** (gate): test tesseract.js trên screenshot thật, đo accuracy sau fuzzy-match. ~0.5 ngày. → quyết go/no-go Phase 3.
3. **Phase 3** nếu spike đạt: tích hợp OCR client-side + UI upload/crop. ~1–2 ngày.

## CẬP NHẬT (sau phản hồi user + OCR spike thật)

**Bỏ 2 hướng đã đề xuất sai:**
- "Dán chữ Hán": user VN không có IME Trung + game mobile không copy được text.
- "Icon-browse lưới": icon trong game quá nhỏ & na ná nhau (xác nhận qua screenshot thật) → quét tay vài trăm icon bất khả thi.

**OCR spike thật (tesseract + chi_sim, ảnh game thật):**
| Ground truth | OCR | Khớp |
|---|---|---|
| 连环计 | 连环计 | 4/4 ✅ |
| 神机妙算 | 神机刀算 | 3/4 |
| 知己知彼 | 知己知疲 | 3/4 |
| 众志成城 | 孚志成城 | 3/4 |
| 太平道法 | 平道法 | 3/4 |
| 士别三日 | 堵史一日 | 1/4 ✗ |
→ Accuracy ~50-75% ký tự. KHÔNG tự động hoàn toàn được, NHƯNG đủ thu hẹp.

**Hướng chốt — Hybrid OCR → fuzzy → user xác nhận icon:**
1. User upload/khoanh screenshot → 2. OCR vùng chữ Hán → 3. fuzzy-match vào `tactics.json` → **top-3 ứng viên kèm icon + tên Việt + Hán** → 4. user bấm icon khớp ảnh.
- OCR làm việc nặng (vài trăm→3); mắt người chốt (xử lý lỗi OCR).
- Không gõ chữ Hán; không cần OCR hoàn hảo; client-side tesseract.js; offline; hợp static.
- Search tiếng Việt (bỏ dấu, fuzzy) vẫn giữ cho ai đã biết tên cộng đồng.

## Unresolved questions
- Hạ tầng OCR: chấp nhận tesseract.js ~15MB client-side (giữ static), hay cho phép cloud OCR (cần key/proxy)?
- Phase 3 chỉ cần ra TÊN chiến pháp, hay nhận diện cả 3 tướng + đội hình từ screenshot (scope lớn hơn nhiều)?
- Làm Phase 1+2 trước rồi gate OCR, hay chờ spike OCR xong mới làm tất cả?
- Crawl full: cần lấy ĐỦ các category chiến pháp (174 mới là 1 subset) — xác nhận.
