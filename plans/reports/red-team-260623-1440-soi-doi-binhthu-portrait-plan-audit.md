# Red-Team Audit: Plan "Soi đội từ ảnh — binh thư + nhận diện tướng"

> 2026-06-23 14:40. Plan: `plans/260623-1440-soi-doi-binhthu-portrait/`. Verify bằng dữ liệu thật (facets.json, link_tactics.py).

## Verdict
Plan dùng được SAU khi sửa cơ chế Phase 1. 1 finding nghiêm trọng (đã vá), 3 finding trung bình (đã ghi rủi ro).

## Findings

### F1 [HIGH, đã vá] Auto-link Hán-Việt→facet gãy cho binh thư
- **Bằng chứng:** `link_tactics.auto_link` normalize Hán-Việt vs tên facet (exact + difflib ≥0.8). Binh thư game dùng tên Việt DỊCH NGHĨA, không Hán-Việt: 铁甲→"Giáp Sắt" (≠Thiết Giáp), 统军→"Dẫn Quân" (≠Thống Quân), 久战→"Chiến Đấu Trường Kỳ" (≠Cửu Chiến, không có trong facet), 惜兵爱民→"Yêu Lính Thương Dân". Probe facet: "Cửu Chiến" không tồn tại.
- **Hệ quả:** cơ chế P1 (crawl Hán + hanviet + auto-link) chỉ đúng số ít tên Hán-Việt thuần → đa số trượt.
- **Vá:** P1 đổi sang bảng map thủ công `pipeline/books-han-viet-map.json` `{chinese: tên-facet-Việt}`; bỏ link_tactics + crawl khỏi scope; `hanviet.py` chỉ sinh field hiển thị; assert `viet ∈ facet` fail-loud.

### F2 [MED] `nameFromPortrait` rò rỉ (P2)
Model có thể đoán tên từ chân dung mà không set cờ → auto-accept sai âm thầm. Giảm nhẹ: matchDict yêu cầu khớp heroes-dict. Rủi ro còn: đoán nhầm tướng có thật → precision giảm. Đã ghi risk + gợi ý thu hẹp B0 nếu tụt.

### F3 [MED] Hotlink icon có thể bị chặn Referer (P3/B1)
aligames/lingxi CDN có thể 403 khi hotlink cross-domain → icon không hiện dù URL đúng. Phải verify từ browser trước; cân nhắc `referrerpolicy="no-referrer"`. Đã ghi risk.

### F4 [MED] Acceptance "ảnh mẫu" không verify local
`config.js` placeholder workerUrl → end-to-end cần deploy Worker. Đã reframe acceptance: unit/mock verify local + manual check sau deploy.

## Đã cập nhật
- `phase-01`: Architecture/Steps/Success/Risk + Requirements (bảng thủ công, bỏ auto-link/crawl).
- `phase-02`: Risk F2.
- `phase-03`: Risk F3.
- `plan.md`: Acceptance F4.

## Unresolved
- Nguồn nào cho cặp Hán↔tên-Việt-game đầy đủ (ngoài soạn tay)? — ảnh hưởng độ phủ books-dict.
