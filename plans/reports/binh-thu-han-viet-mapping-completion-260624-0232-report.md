# Report: Hoàn thiện map binh thư Hán↔Việt cho Soi đội

> 2026-06-24. Tiếp nối feature soi-đội binh thư (commit gốc 41c25ba). Phạm vi: mở rộng `data/books-dict.json` từ 36 → 66 mục + xác định dup/unresolved.

## Trạng thái cuối: 72/74 facet đã có lối map

| Nhóm | Số | Ghi chú |
|---|---|---|
| ✅ Đã map (effect/Hán-Việt confirmed) | **66** | dùng cho soi đội ảnh chữ Hán |
| ✅ Dup facet (biến thể tên, phủ qua tên chính) | **6** | không map lại |
| ❓ Chưa rõ tên Hán | **2** | đã có hiệu ứng VN, thiếu tên Hán |

Integrity: 0 viet∉facet, 0 trùng chinese/viet. Test xanh (Python/JS/Worker). Đã push main.

## Phương pháp
- Binh thư VN dùng tên DỊCH NGHĨA, không Hán-Việt → KHÔNG auto-link (xem [[binh-thu-names-semantic-not-hanviet]]).
- Map bằng bảng thủ công `pipeline/books-han-viet-map.json` `{chinese: viet}`, validate `viet ∈ facets.json.books` (fail-loud).
- **Bắc cầu hiệu ứng**: ảnh client VN (tên + hiệu ứng) → khớp hiệu ứng với nguồn Hán (9game `news/3980828`, 7724 `156851` "新兵书") → suy ra tên Hán. Đây là cách tin cậy nhất, hơn hẳn đoán theo tên.

## 3 lỗi đoán-tên đã bắt & sửa (nhờ effect-matching)
| Đoán sai ban đầu | Đúng (effect-confirmed) | Tên Việt |
|---|---|---|
| 救援 | **驰援** | Cứu Viện |
| 一气呵成 | **一鼓作气** | Liền Mạch Một Hơi |
| 义勇 | **勇毅** | Nghĩa Dũng |
| (định đoán 明察秋毫) | **洞若观火** | Nhìn Rõ Mồn Một |
| (định đoán 攻其不备→Đánh Bất Ngờ) | 攻其不备 = **Đánh Vào Chỗ Hiểm** | (effect: địch Binh Lực cao nhất) |

→ Bài học: KHÔNG commit map theo tên; chỉ commit khi effect-confirmed hoặc Hán-Việt thuần.

## Binh thư mới (用间/始计) — map qua search hiệu ứng
审时度势→Đánh Giá Tình Hình, 乐善好施→Thích Làm Việc Thiện, 洞若观火→Nhìn Rõ Mồn Một, 应机立断→Hành Động Theo Thời, 大谋不谋→Không Lộ Tài Năng, 不勇则死→Không Chiến Sẽ Chết, 出其不意→Đánh Bất Ngờ Thắng.

## 6 dup facet (biến thể tên, không map lại)
| Biến thể | = Tên chính | Hán |
|---|---|---|
| Chuẩn Xác | Tinh Chuẩn | 精准 |
| Dũng Nghĩa | Nghĩa Dũng | 勇毅 |
| Thận Trọng | Trì Trọng | 持重 (effect-confirmed: hiệp 4,5 miễn Hỗn Loạn) |
| Thắng Chiến | Thắng Trận | 胜战 |
| Thắng mà càng mạnh | Thắng Sẽ Càng Mạnh | 胜而益强 |
| Tàng Đao | Giấu Đao | 藏刀 |

(Đã ghi trong `_dup_facet_names` của bảng map.)

## 2 binh thư CHƯA rõ tên Hán
| Tên Việt | Count | Hiệu ứng VN (từ ảnh) | Ứng viên (chưa chắc) |
|---|---|---|---|
| Chia Lời | 5 | chịu Binh Đao→Thống+1%, Mưu Lược→Trí+1%, cộng dồn 5 lần | 分利? |
| Tinh Thần Sảng Khoái | 2 | tích 2 lần khống chế → xóa bất lợi 1 đơn vị, 1 lần | 神清气爽? |

Search + nguồn công khai không ra tên Hán (quá mới/hiếm). Ảnh client VN không chứa chữ Hán nên không bổ sung được. Cần tên Hán trực tiếp (server CN / guide TQ).

## Files
- `pipeline/books-han-viet-map.json` (bảng thủ công + `_note`/`_dup_facet_names`/`_unresolved`)
- `pipeline/build_books_dict.py`, `data/books-dict.json` (66 mục)
- README cập nhật count.

## Nguồn
- 9game hiệu ứng binh thư: `https://www.9game.cn/news/3980828.html`
- 7724 binh thư mới (用间/始计): `https://m.7724.com/sgzzlbyx/news/156851.html`
- Ảnh client VN do user cung cấp (Thượng Thư Đài, IMG_7016–7030).

## Unresolved
1. Tên Hán của **Chia Lời** và **Tinh Thần Sảng Khoái** — cần nguồn CN. Khi có, thêm vào `books-han-viet-map.json` → rebuild → commit (1 phút).
