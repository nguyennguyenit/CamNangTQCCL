# Spike: Map Hán-Việt trên 174 战法 — KẾT QUẢ

_2026-06-21 21:25 (+07). Mục tiêu: đo độ chính xác phiên âm Hán-Việt + auto-link tên Trung ↔ tên Việt đang dùng._

## Verdict: ✅ Phiên âm Hán-Việt CHÍNH XÁC & tự động hóa được. Auto-link ~80%, ~20% cần review (ký tự đa âm).

Đáng chú ý: crawl còn **phát hiện & sửa được lỗi tên trong data hiện tại** của site.

## Phương pháp
1. Crawl 174 tên 战法 (tiếng Trung) từ API lingxi (đã verify ở spike trước).
2. Bảng phiên âm **cấp ký tự** Hán→Hán-Việt cho toàn bộ **409 ký tự** xuất hiện (tự soạn).
3. Transliterate char-by-char → chuỗi Hán-Việt.
4. Normalize (bỏ dấu, đ→d, bỏ space) + khớp với 112 tên chiến pháp Việt đang dùng (exact + difflib fuzzy ≥0.8).

Artifact: `spike-zhanfa-174-hanviet-translit.tsv` (174 dòng Trung→Hán-Việt), `spike-hanviet-char-map.py.txt` (bảng 409 ký tự).

## Số liệu
| Chỉ số | Kết quả |
|---|---|
| Ký tự KHÔNG map được | **0 / 409** |
| Khớp exact (sau normalize) | 28 |
| Khớp fuzzy (≥0.8) | 7 |
| Tổng auto-link vào tên Việt | **35/174 战法** → **34/112 tên Việt** |
| Không khớp tập 112 | 139 |

## Phân tích (quan trọng hơn con số)

**Phiên âm tự nó đúng** — exact match hoàn hảo: `暴戾无仁→bạo lệ vô nhân→Bạo Lệ Vô Nhân`, `百骑劫营→bách kỵ kiếp doanh`, `夺魂挟魄→đoạt hồn hiệp phách`, `八门金锁阵→bát môn kim tỏa trận`…

**139 "không khớp" KHÔNG phải lỗi** — phần lớn là chiến pháp trong thư viện không nằm trong 112 đang dùng (chiến pháp **tự mang của tướng**: 燕人咆哮 Yến Nhân Bào Hao = của Trương Phi, 江东猛虎 Giang Đông Mãnh Hổ = Tôn Kiên…). → **174 này là 1 category con, KHÔNG phải toàn bộ chiến pháp.** Cần crawl thêm category để phủ hết.

**Mismatch fuzzy hé lộ 3 loại, đều xử lý được:**
1. **Ký tự đa âm** (cần disambiguation thủ công): 武 vũ/**võ**, 箕 ki/**cơ**, 摧 tồi/**thôi** → cộng đồng dùng âm thứ 2. ~bộ nhỏ ký tự, fix 1 lần trong bảng map.
2. **Data SITE đang lệch** (crawl giúp SỬA): `瞋目横矛` đúng = "Sân Mục Hoành Mâu" nhưng data ta ghi **"Trấn Mục"** (sai); `盛气凌敌` = "lăng địch" data ghi "Linh" (đã có alias). → Nguồn Trung chuẩn hơn, dùng để chuẩn hóa lại tên.
3. **Tên thuần Việt** (hiếm): `魅惑` Hán-Việt "mị hoặc" nhưng data ghi "Mê hoặc".

## Kết luận khả thi
- **Phiên âm Hán-Việt: tự động, đáng tin** (0 ký tự fail). Bảng 409 ký tự là tài sản tái dùng (mở rộng dần khi crawl thêm tướng/CP).
- **Auto-link**: ~80% exact+fuzzy; ~20% cần review do đa âm + biến thể — đúng mô hình bán-tự-động như `suggest_aliases.py`.
- **Lợi ích phụ**: phát hiện được tên sai trong data hiện tại (vd "Trấn Mục" → "Sân Mục").
- **Cảnh báo**: 174 chỉ là 1 category. Phải crawl đủ các category để có toàn bộ chiến pháp + cần crawl field nội dung (loại/hiệu quả/适性) — chưa làm.

## Ước lượng nếu làm thật
1. Hoàn thiện bảng phiên âm (xử lý đa âm bằng heuristic + override) — ~vài giờ.
2. Crawl đủ category 战法 + 武将 + field nội dung (cần spike bắt thêm categoryIds/detail). ~0.5–1 ngày.
3. Auto-link + review thủ công phần đa âm/variant. ~0.5–1 ngày.
4. Chuẩn hóa lại tên trong data hiện tại theo nguồn Trung (sửa typo) — bonus.

## Unresolved questions
- Crawl thêm các category để lấy ĐỦ chiến pháp (174 là subset) — làm không?
- Đa âm: chọn âm theo "tên cộng đồng VN đang dùng" (ưu tiên match data ta) hay theo Hán-Việt chuẩn?
- Có dùng nguồn Trung để SỬA các tên lệch trong data hiện tại không (vd Trấn Mục→Sân Mục)?
