# Design "Sổ binh pháp" — bản chụp canvas

Bản chụp mã nguồn canvas Design dùng làm chuẩn thị giác cho đợt redesign. Contract và quyết định: [brainstorm-260923-2001-so-binh-phap-redesign.md](../../../plans/reports/brainstorm-260923-2001-so-binh-phap-redesign.md).

| | |
|---|---|
| Canvas gốc | <https://claude.ai/artifact/JshDEV8qspJo6VJ6rgiB71> (riêng tư — cần quyền của chủ canvas) |
| Phiên bản chụp | `1790191281-3a81` (StyleGuide bổ sung component; hồ sơ tướng hiện đủ + khối "Trong cẩm nang") |
| Ngày chụp | 2026-09-24 |
| Nội dung | `project/canvas.json` (vị trí, kích thước, tiêu đề artboard) + 28 artboard `project/*.dc.html` + `project/support.js` (shim tự viết, xem dưới) + 25 ảnh chuẩn `screens/*.png` |
| Ảnh chuẩn | Chụp lại 2026-09-24 bằng `scripts/design-capture.mjs` · **đã đối chiếu 2026-09-24 với canvas bản `1790202333-0a0d`** (xem mục đối chiếu) |

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
- Artboard tải font từ Google Fonts như canvas → chụp cần mạng (~35 giây cho 25 artboard). Script tải **mọi** lát unicode-range của các font trước khi chụp (lát nào lỗi mạng thì chụp lại artboard đó, tối đa 3 lần); dừng nếu Be Vietnam Pro hoặc Noto Serif Display chưa tải. Chụp lại nhiều lần vẫn có thể lệch dưới 1 px ở vị trí nét chữ serif/chữ Hán (Chrome), không đổi bố cục — đừng commit ảnh chỉ vì lệch kiểu này.

### Đối chiếu shim với canvas (2026-09-24)

Canvas chỉ mở được trong Chrome profile của chủ canvas (tài khoản đã đăng nhập claude.ai). Hai cách đã kiểm:

- **Runtime gốc:** menu xuất của một artboard (Play full screen → Export → HTML .zip) kèm `support.js` + `vendor/react*.js` của canvas. Dựng cả 25 artboard của bản chụp này bằng runtime gốc trong thư mục tạm (không commit runtime) rồi so với ảnh do shim dựng: **24/25 trùng từng pixel**; `StyleGuide` lệch 143 px ở dòng mã màu phe (khử răng cưa chữ, nhìn không khác).
- **Canvas đang chạy:** Export PDF toàn bộ 28 artboard từ canvas bản `1790202333-0a0d`, raster 96 dpi, so với ảnh shim cắt đúng `h`: kích thước 28/28 khớp `canvas.json`; sau khi thu nhỏ 25% để bỏ nhiễu khử răng cưa, lệch ≤ 0,3% ở mọi artboard (chỉ viền chữ Hán) → nội dung canvas hiện tại trùng bản chụp `1790191281-3a81`.

Lần sau canvas đổi: chụp lại theo mục dưới và lặp lại một trong hai cách trên. Lệch → sửa `support.js` rồi chụp lại; không sửa `.dc.html`.

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
