---
phase: 1
title: Data binh thư
status: completed
priority: P1
effort: 0.5d
dependencies: []
---

# Phase 1: Data binh thư

## Overview
Dựng `data/books-dict.json` `[{chinese, hanViet, viet}]` (~74 binh thư) qua module pipeline mới, để site map binh thư Hán→Việt canonical. Không mô tả/hiệu ứng (scope chốt).

## Requirements
- Functional: từ bảng map thủ công `{chinese: viet}` → validate `viet ∈ facets.json.books` (74 mục) → gắn `hanViet` (qua `hanviet.py`, chỉ hiển thị) → ghi `books-dict.json` sort theo `viet`.
- Non-functional: parser thuần test bằng fixture (không gọi mạng lúc test); crawl chạy offline lúc build; file <200 LOC (tách module riêng, không nhồi `build_dict.py`).

## Architecture
> **[RED-TEAM] Sửa cơ chế:** binh thư game dùng tên Việt DỊCH NGHĨA, không phải Hán-Việt (vd 铁甲→"Giáp Sắt" chứ không "Thiết Giáp"; 统军→"Dẫn Quân"; 久战→"Chiến Đấu Trường Kỳ"; 惜兵爱民→"Yêu Lính Thương Dân"). Nên `link_tactics.auto_link` (normalize Hán-Việt vs facet) sẽ TRƯỢT phần lớn binh thư. → KHÔNG dùng auto-link cho books.

- **Cơ chế đúng = bảng map thủ công** `{chinese: tên-Việt-facet}` soạn trực tiếp (cặp Hán↔tên-game chỉ có từ nguồn VN, không suy từ Hán-Việt). File `pipeline/books-han-viet-map.json`.
- **Nguồn cặp Hán↔Việt:** nguồn VN (community sheet / wiki VN có đối chiếu Hán) HOẶC soạn tay từ kiến thức game. Seed Hán: 13 tên trong `NON_TACTIC_TERMS`. **Crawl wiki Hán gần như vô dụng** cho mục tiêu này (chỉ cho tên Hán + hiệu ứng, KHÔNG cho tên Việt game) → bỏ crawl khỏi scope, trừ khi cần lấy thêm danh sách tên Hán.
- `hanviet.py` CHỈ dùng sinh field `hanViet` (hiển thị/tham khảo), KHÔNG dùng để link.
- **Ưu tiên phủ:** binh thư xuất hiện trong `teams.json` + ảnh mẫu trước (subset), không cần đủ 74 ngay.
- `viet` PHẢI là 1 trong 74 tên `facets.json.books` (fail-loud nếu không thuộc facet → tránh map lệch).

## Related Code Files
- Create: `pipeline/build_books_dict.py`, `pipeline/books-han-viet-map.json` (bảng `{chinese: viet}` thủ công), `data/books-dict.json`, `tests/test_build_books_dict.py`
- Reuse (no edit): `pipeline/hanviet.py` (chỉ field `hanViet`), `data/facets.json`
- KHÔNG dùng: `pipeline/link_tactics.py` cho books (cơ chế Hán-Việt không hợp — xem Architecture)

## Implementation Steps (TDD)
1. **Test trước** `tests/test_build_books_dict.py`: `build_books_dict(han_viet_map, facet_books)` → mỗi record `{chinese, hanViet, viet}`; `viet` PHẢI thuộc `facet_books` (assert fail-loud khi map sai tên ngoài facet); `hanViet` = `hanviet.to_viet(chinese)`. Chạy đỏ.
2. Soạn `pipeline/books-han-viet-map.json`: bảng `{chinese: tên-Việt-facet}` cho subset ưu tiên (13 seed + 7 binh thư ảnh mẫu: 铁甲→Giáp Sắt, 防备→Phòng Bị, 三军之众→Tam Quân Chi Chúng, 锤炼→Rèn Luyện, 统军→Dẫn Quân, 久战→Chiến Đấu Trường Kỳ, 惜兵爱民→Yêu Lính Thương Dân...). Mở rộng dần tới phần giao `teams.json`.
3. Viết `pipeline/build_books_dict.py`: thuần — đọc map + facet → validate `viet ∈ facet` → sinh `hanViet` → `_write_json("data/books-dict.json")`. Theo khuôn `build_dict._write_json`.
4. Chạy build → `data/books-dict.json`; spot-check vài cặp khớp facet.
5. Test xanh.

## Success Criteria
- [ ] `tests/test_build_books_dict.py` xanh (gồm assert `viet ∈ facet`).
- [ ] `data/books-dict.json` tồn tại, mỗi record `{chinese, hanViet, viet}`, `viet` khớp tên trong `facets.json.books`.
- [ ] Phủ tối thiểu 7 binh thư ảnh mẫu (铁甲, 防备, 三军之众, 锤炼, 统军, 久战, 惜兵爱民) + 13 seed `NON_TACTIC_TERMS`.
- [ ] Build thuần, không gọi mạng.

## Risk Assessment
- **[RED-TEAM] Cặp Hán↔Việt sai/thiếu** là rủi ro chính (map thủ công): bù bằng assert `viet ∈ facet` (fail-loud chống map ra tên không tồn tại) + spot-check. Thiếu mục → binh thư đó giữ Hán + cờ ở P3, không vỡ.
- **Nhầm binh chủng** (象兵...): KHÔNG đưa tên binh chủng vào map.
- **Effort thực tế**: là công soạn bảng thủ công (cần nguồn VN đối chiếu Hán), không phải crawl tự động — đừng đánh giá thấp.
- **Rollback**: xóa `books-dict.json` + module; P3 fallback rỗng không vỡ.
