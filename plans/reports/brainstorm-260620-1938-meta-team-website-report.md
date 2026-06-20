# Brainstorm Report — Website Tổng Hợp Meta Team TQCCL

**Ngày:** 2026-06-20 | **Mode:** brainstorm (KISS/YAGNI/DRY) | **Trạng thái:** Đã duyệt → chuyển /ck:plan --deep --tdd

## 1. Problem statement & requirements

Xây website tĩnh tổng hợp meta team game Tam Quốc Chí Chiến Lược từ data trong `Meta Team PK/` (Google Sheets export HTML). Đẹp & dễ nhìn hơn site tham khảo `ss18.thanglonghoi.xyz`, đầy đủ bộ lọc.

**Yêu cầu chốt (qua Discovery):**
- **Phạm vi data**: 2 file chính — `Meta Team.html` (46 team, có Tier T0–T1.5) + `Team giới thiệu(mới).html` (có Binh Thư + counter Chạm/Tránh). Bỏ 9 file cũ/out-meta.
- **Hình ảnh**: KHÔNG — text-first (33 ảnh là grid screenshot, không map 1-1 được).
- **UI/Deploy**: Tiếng Việt + GitHub Pages.
- **Stack**: Vanilla static, không framework.

## 2. Expected output (concrete)
- `build.py`: parse 2 file HTML → `data/teams.json` (1 schema thống nhất + alias sửa chính tả).
- `index.html` + `css/` + `js/`: fetch JSON, render card grid, filter + search client-side.
- `.github/workflows/deploy.yml`: build + publish GitHub Pages.

## 3. Acceptance criteria
- Mọi team từ 2 file hiển thị đúng (không mất, không trùng sai).
- Filter đa chọn + kết hợp AND theo: Tier, Phe, Loại binh, Tướng, Chiến pháp, Binh thư.
- Search toàn văn hoạt động.
- Responsive mobile (filter = drawer).
- Deploy được lên GitHub Pages.

## 4. Scope boundary (OUT)
Ảnh/icon tướng; backend/DB; 9 file HTML còn lại; chỉnh sửa data trong app; i18n.

## 5. Evaluated approaches

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Vanilla static + Python build** | KISS, 0 deps runtime, GitHub Pages free, filter ~100 team tức thì | Tự viết filter logic (nhỏ) | ✅ CHỌN |
| React/Vite SPA | Component sạch | Over-engineering cho data tĩnh, bundler, vi phạm YAGNI | ❌ |
| SSG (11ty/Astro) | Pre-render đẹp | Thêm toolchain học, thừa cho 1 trang filter | ❌ |

## 6. Data model thống nhất
```
Team { id, source, faction(phe), unitType(Kỵ/Cung/Thương/Khiên),
       tier(T0..T1.5 | ★), heroes[≤3]{name, tactics[2], books[≤3]},
       counters{good[], avoid[]}, notes }
```
Bảng alias: "Lăm Thống"→"Lăng Thống", "Hoành Tào"→"Hoành Tảo"... để filter gom đúng.

## 7. UI/UX
Card grid (không bảng dày); tier badge màu (T0 đỏ→T1.5 xám); sidebar filter đa chọn + drawer mobile; counter chip xanh(Chạm)/đỏ(Tránh); dark mode nhẹ; sticky filter.

## 8. Risks
- **R1 Data bẩn** (chính tả lệch) → alias map + normalize, test snapshot count.
- **R2 2 schema khác nhau** → 2 parser riêng, merge về 1 model; test mỗi parser.
- **R3 Tên file có dấu/space** → build.py xử lý unicode path.
- **R4 GitHub Pages path** → dùng relative path cho fetch JSON.

## 9. Success metrics
Số team parse ≥ tổng thực tế 2 file; filter combos đúng; Lighthouse mobile khá; nhìn gọn hơn site tham khảo.

## 10. RED-TEAM ADDENDUM (đã phản biện đối kháng + chốt với user)

Red-team đập vỡ giả định parse ban đầu. Các quyết định CUỐI:

**Parsing (CHÍ MẠNG — sửa):**
- `Meta Team.html`: phân tách team theo **rowspan cột Type** (fill-down), KHÔNG hardcode 3 tướng. Verified = **44 team**.
- `Team giới thiệu(mới).html`: KHÔNG có rowspan; phân tách theo **số cột** (9 = mở team, 7 = dòng tướng nối). Verified ≈ **52 team**.
- `raw-data-extract-1.txt` là output parser PHẲNG lỗi → **BỎ khỏi nguồn sự thật & TDD fixtures**. Test parse trực tiếp HTML.
- Acceptance: dùng **số tuyệt đối verified** (44 + ~52), không "≥".

**Data model (CAO — mở rộng):**
```
unitType: string[]            // tách "Kỵ/Cung" từ Type
tierScheme: "T" | "star"
tier: "T0".."T1.5"|"T?"       // file1
stars: 4|4.5|5                // file2 (☆ = .5)
status: "meta"|"youtuber-untested"|"situational"   // GIỮ team T?/out-meta + nhãn
hero: { name, baseName, variant?, isSP, isCO, note? }
tactics: { name, alternatives[] }[]   // tách "/"
books:   { name, alternatives[] }[]   // tách "/" và tiền tố "Tinh·/Thác·"
counters: { good[], avoid[] }          // regex split "Chạm:|Tránh:" (dính liền!)
```

**Quyết định user (Discovery vòng 2):**
- **Counter**: tag bấm-để-search (chip xanh Chạm / đỏ Tránh), KHÔNG link điều hướng.
- **Team status**: GIỮ team T?/Youtuber/out-meta + field `status` + badge + filter riêng.
- **Tier scheme**: 2 nhóm filter RIÊNG (Tier T-scale vs Sao ★), không quy đổi.

**Filter UX (CAO — sửa):**
- ~150 tướng / ~179 chiến pháp / ~141 binh thư → **combobox autocomplete + count mỗi mục**, KHÔNG checklist phẳng.
- Tier / Sao / Phe / Loại binh / Status (≤6 giá trị) → chip/checkbox.

**Alias/normalize (CAO):**
- Build script in cluster near-duplicate (cutoff cao) + count → review thủ công vào `aliases.json` (deterministic, KHÔNG fuzzy runtime).
- Cặp typo thực: Lăng/Lăm Thống, Thịnh Khí Linh/Lăng Địch, Tạm/Tam Lánh Sóng Gió, Phong Trợ Hỏa/Phơng Trợ Họa Thế, Giả Hủ/Hư, Rèn Luyện/Luyền, Khép Hờ/Hở...
- Test: sau normalize, distinct GIẢM đúng số cặp đã khai.

## 11. Next steps
→ `/ck:plan --deep --tdd` (tests-first parser/normalize/filter, áp toàn bộ addendum trên). → audit plan → `/ck:cook --tdd` → `/ck:code-review` → `/ck:git cp`.
