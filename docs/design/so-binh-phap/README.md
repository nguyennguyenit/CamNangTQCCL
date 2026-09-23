# Design "Sổ binh pháp" — bản chụp canvas

Bản chụp mã nguồn canvas Design dùng làm chuẩn thị giác cho đợt redesign. Contract và quyết định: [brainstorm-260923-2001-so-binh-phap-redesign.md](../../../plans/reports/brainstorm-260923-2001-so-binh-phap-redesign.md).

| | |
|---|---|
| Canvas gốc | <https://claude.ai/artifact/JshDEV8qspJo6VJ6rgiB71> (riêng tư — cần quyền của chủ canvas) |
| Phiên bản chụp | `1790189023-ec86` |
| Ngày chụp | 2026-09-24 |
| Nội dung | `project/canvas.json` (vị trí, kích thước, tiêu đề artboard) + 28 artboard `project/*.dc.html` + `project/support.js` (shim tự viết, xem dưới) + 25 ảnh chuẩn `screens/*.png` |
| Ảnh chuẩn | Chụp 2026-09-24 bằng `scripts/design-capture.mjs` · **chưa đối chiếu với canvas gốc** |

## Quy ước

- Canvas là chuẩn thị giác: lấy đúng màu, cỡ chữ, spacing, radius từ mã nguồn artboard; **không** copy inline style vào site — chuyển thành class/token CSS.
- Chiều cao artboard đã đo theo nội dung; canvas không phải chuẩn pixel tuyệt đối theo chiều dọc.
- Chữ mẫu, số liệu, dữ liệu đội trong artboard là mockup (mùa OG · Binh Diễn Xuân Thu); dữ liệu thật lấy từ `data/`.
- `[KÊNH LIÊN HỆ]`, `[NGÀY CẬP NHẬT]` là chỗ giữ, chưa có giá trị thật.
- 3 artboard hướng A/B/C (`DirA-ChienBao`, `DirB-BangTra`, `DirC-ThuyMac`) chỉ để so sánh — không implement.

## Xem artboard và ảnh chuẩn

- **Ảnh chuẩn** `screens/<Artboard>.png`: trạng thái mặc định của từng artboard, rộng đúng `w` trong `canvas.json`, DPR 1, chụp cả trang (nội dung dài hơn `h` vẫn giữ). Đây là ảnh đặt cạnh ảnh localhost khi soát mỗi bước.
- **Xem trên trình duyệt:** `node scripts/design-capture.mjs --serve` rồi mở URL được in ra. Bấm được menu thả/nút có `onClick` như trên canvas. Mở trực tiếp `file://` không chạy (shim phải đọc lại mã nguồn trang qua HTTP).
- **`project/support.js` là shim tự viết, không phải runtime gốc của canvas.** Nó chỉ hiểu `<x-dc>`, `<helmet>`, `<sc-if value>`, `<sc-for list as>`, `{{ đường.dẫn }}`, `onClick="{{ hàm }}"`, `baseVals()`/`renderVals()`, `this.props` (lấy `default` trong `data-props`), `this.state`/`this.setState`. Gặp thẻ `sc-*` lạ, biểu thức ngoài dạng đường dẫn, biến không có hoặc còn sót `{{` → hiện dải báo lỗi đỏ, script chụp dừng với mã lỗi 1.
- Artboard tải font từ Google Fonts như canvas → chụp cần mạng; script dừng nếu Be Vietnam Pro hoặc Noto Serif Display chưa tải.

### Đối chiếu shim với canvas (làm một lần, chủ canvas)

Mở canvas gốc cạnh `screens/` cho cả 25 artboard. Khớp → sửa dòng "Ảnh chuẩn" ở bảng trên thành "đã đối chiếu với canvas bản `…` ngày …". Lệch → sửa `support.js` rồi chụp lại; không sửa `.dc.html`.

## Artboard → bước trong plan

| Bước | Nội dung | Artboard |
|---|---|---|
| 1 | Token sáng/tối, font, component chung | `StyleGuide` |
| 2 | Header 1 hàng + menu thả Công cụ/Game, menu mobile | header của mọi artboard trang trong, `LandingMenu`, `LandingMenuMobile` |
| 2b | Landing `/`, footer toàn site, mục Tải game | `Landing`, `LandingMobile` |
| 3 | Đội chuẩn/Đội khác: lọc, thẻ, Thẻ/Bảng | `Main`, `MainTable`, `MobileList`, `MobileTable`, `MobileFilters` |
| 4 | Chi tiết đội | `TeamDetail` |
| 5 | Tra cứu + hồ sơ | `Lookup`, `LookupTactics`, `LookupProfile`, `LookupMobile` |
| 6 | Cùng Tồn + Khai hoang | `Coexist`, `CoexistMobile`, `Khaihoang`, `KhaihoangMobile` |
| 7 | 3 công cụ Beta | `Recruit`, `RecruitMobile`, `Analyze`, `AnalyzeMobile`, `Roster`, `RosterMobile` |

## Cập nhật bản chụp

Khi canvas thay đổi: đọc lại toàn bộ `project/` từ canvas, ghi đè `*.dc.html` và `canvas.json` (**giữ nguyên `support.js`**), chạy `node scripts/design-capture.mjs` (ảnh của artboard đã bỏ khỏi canvas tự bị xóa), cập nhật "Phiên bản chụp", "Ngày chụp", "Ảnh chuẩn" ở trên, commit chung một commit `docs(design): …`. Không sửa tay file `.dc.html` ở đây — sửa trên canvas rồi chụp lại. Artboard mới dùng cấu trúc shim chưa hiểu → script báo lỗi; bổ sung shim trong cùng commit.
