# Brainstorm — Redesign "Sổ binh pháp" (toàn site)

Ngày: 2026-09-23 · Trạng thái: **đã chốt, sẵn sàng làm plan** · Nguồn design: canvas <https://claude.ai/artifact/JshDEV8qspJo6VJ6rgiB71>

## 1. Outcome

Toàn bộ site Cẩm Nang TQCCL mang giao diện "Sổ binh pháp" đúng như canvas: nền giấy dó, dải header mực, ấn son 兵, tiêu đề serif, accent son. Áp cho mọi mục: Đội chuẩn/Đội khác (Thẻ + Bảng), chi tiết đội, Tra cứu, Cùng Tồn, Khai hoang, 3 công cụ Beta; desktop 1440 và mobile 390; sáng + tối.

## 2. Constraints

- Canvas là chuẩn: lấy đúng giá trị (màu, cỡ chữ, spacing, radius) từ mã nguồn artboard; không copy inline style — chuyển thành class/token trong CSS.
- Giữ contract hiện có: class test đang bắt (`.reference-score`, `.nav-tab[data-section]`, `.fchip`…), ARIA, hash/URL deep-link, hành vi JS, `localStorage` tracker, luồng Worker/Turnstile, engine gợi ý cục bộ.
- Cổng bản dịch `pipeline/site_localization.py`: đổi chữ hiển thị thuộc ledger phải qua review độc lập; không tự duyệt.
- Thuật ngữ 碰瓷: Khai hoang = "Chạm Sứ", Đội chuẩn = "cảm tử"; tên VN game là chuẩn.
- Pin publication/route handle/`_headers`/dist verifier phải cập nhật hợp lệ khi đụng tới; build qua `npm run build` (gate public trước astro).
- Mỗi bước commit riêng (conventional, không nhắc AI); deploy production cần ủy quyền riêng.

## 3. Non-goals

- Không thêm tính năng ngoài canvas, trừ chế độ Thẻ/Bảng (đã duyệt).
- Không đổi dữ liệu, engine gợi ý, schema lưu trữ, Worker.
- Không self-host ảnh chân dung (vướng quyền sử dụng) — để sau.
- Không đổi 5 tên đội "…cảm tử" hay URL đã đóng băng.
- 3 artboard hướng A/B/C chỉ để tham khảo, không implement.
- Không viết lại lịch sử git (đường dẫn cục bộ cũ còn trong commit `2f1de73`).

## 4. Acceptance criteria

- Mỗi mục: ảnh chụp localhost 1440px + 390px đặt cạnh artboard tương ứng, chênh lệch được liệt kê và xử lý.
- `npm run check`, build, `npm run test:node`, `npm run test:e2e`, `python3 -m unittest discover -s tests` đều pass; test cũ chỉ được sửa khi hành vi đổi có chủ đích (vd bỏ lọc điểm), không xóa để né.
- Gate `site_localization check --stage public` 5592/5592, không problem.
- Giao diện tối: chữ thường ≥ 4.5:1, chữ ≥ 24px ≥ 3:1; không mất nghĩa phe/binh/trạng thái (luôn có chữ đi kèm màu).
- Vùng bấm mobile ≥ 44px; không cuộn ngang; focus-visible rõ; hộp thoại khóa focus + Escape.
- `docs/design-guidelines.md` cập nhật theo hành vi mới.

## 5. Quyết định Bước 0 (đã đồng ý)

| # | Chủ đề | Quyết định | Lý do / bằng chứng |
|---|---|---|---|
| 1 | Thẻ/Bảng — mặc định | **Thẻ** mọi khổ | Người mới thấy giao diện quen; Bảng là tùy chọn so nhanh |
| 2 | Thẻ/Bảng — ghi nhớ | URL `?view=bang` (chỉ khi Bảng, ưu tiên) + `localStorage` làm mặc định khi URL không có | Bộ lọc đã giữ trên URL (`js/app.js` replaceState); theme đã dùng `localStorage` (`js/site-chrome.js`) |
| 3 | Thẻ/Bảng — phạm vi | Cả Đội chuẩn và Đội khác | Hai tab chung một factory (`js/team-filter-section.js`); legacy đủ trường cho cột bảng |
| 4 | Font | Self-host woff2: Be Vietnam Pro 400/500/600/700 + Noto Serif Display 700 (Latin + Vietnamese, ~150–250 KB); ấn 兵 vẽ SVG, không tải font CJK | `public/_headers` chưa có CSP; tránh gửi truy cập sang Google; cần thêm rule `/fonts/*` + allowlist trong `astro-dist-contract`/`runtime-asset-contract` |
| 5 | Giao diện tối | Dùng bảng tối trong artboard StyleGuide; rà ở Bước 8, chỗ xấu mới vẽ thêm | Site đã có toggle sáng/tối, mặc định sáng — giữ hành vi |
| 6 | Chân dung tướng | Ảnh thật từ `iconUrl` như hiện tại; ô màu phe + chữ Hán làm fallback khi ảnh lỗi | Ảnh hotlink `cloud.lingxigames.com`; fallback tránh ảnh vỡ |

## 6. Hướng đã chọn & các quyết định design đã chốt trong phiên

- Hướng "Sổ binh pháp" (chọn trên 3 hướng A Chiến báo / B Bảng tra / C Thủy mặc), mượn cách xếp một dòng mỗi đội của B cho chế độ Bảng.
- Menu nhóm 3 cụm: Đội hình (Đội chuẩn, Đội khác, Cùng Tồn, Khai hoang) · Tra cứu · Công cụ (Beta).
- **Bỏ bộ lọc Điểm nguồn**; điểm chỉ hiển thị trên thẻ/chi tiết.
- Thẻ đội gọn: tên + dòng "■ phe · binh", điểm 28px; mỗi tướng: vai trò viết tắt, tên, 2 chiến pháp chữ son, dòng binh thư; binh thư trống → một dòng nghiêng "Nguồn chưa ghi" (thay 3 ô "Chưa có dữ liệu"); dòng cuối gộp "Sợ …", "Thay thế (n)", "Chi tiết →". Đội thiếu phe/binh thì bỏ phần thiếu (như site hiện tại).
- Tra cứu: lưới tướng 6 cột, bảng chiến pháp (phẩm, loại, hiệu quả, mục tiêu, tỷ lệ), hộp thoại hồ sơ; sửa lỗi lộ khóa `bonusVi:`.
- Cùng Tồn: chọn nhóm 1–5, ô tổng quan (chủ lực, gợi ý khai hoang, "5 đội · 15 tướng · không trùng" tính từ dữ liệu).
- Khai hoang: Trước → Sau, thanh điểm 6 mốc, lưới Chạm Sứ, bảng quân thủ mỏ.
- Công cụ Beta: chỉ đổi giao diện; bỏ emoji (📷, ⚠) → icon SVG; lưu trữ/Worker/engine giữ nguyên.

## 7. Lộ trình cho plan

| Bước | Nội dung | File chính | Test chính |
|---|---|---|---|
| 1 | Token sáng/tối, font self-host, component dùng chung; cân nhắc tách `tokens.css`/`components.css` | `css/styles.css`, `public/fonts/`, `public/_headers` | `tests-js/runtime-asset-contract.test.mjs`, `astro-dist-contract` |
| 2 | Header tối + ấn SVG, menu 3 nhóm, menu mobile | `src/layouts/SiteLayout.astro`, `src/pages/index.astro`, `js/site-chrome.js`, `js/mobile-section-menu.js` | `spa-parity.spec.mjs`, `team-detail-pages.spec.mjs` |
| 3 | Đội chuẩn/khác: sidebar lọc, bỏ lọc điểm, thẻ gọn, Thẻ/Bảng | `js/team-filter-section.js`, `js/recommended-reference-render.js`, `js/app.js` | `recommended-browser.spec.mjs`, `season-lookup.spec.mjs` |
| 4 | Trang chi tiết đội | `js/team-detail.js`, `recommended-reference-render.js`, `src/pages/doi-*/[team].astro` | `team-detail-pages.spec.mjs` |
| 5 | Tra cứu + hồ sơ | `js/unified-lookup.js`, `js/lookup-detail.js` | `unified-lookup.spec.mjs` |
| 6 | Cùng Tồn + Khai hoang | `js/render.js` (`coexistGroup`, `khaihoang*`) | `khaihoang-options.spec.mjs` |
| 7 | 3 công cụ Beta | `js/recruit-tracker.js`, `js/analyze.js`, `js/roster-recommend-ui.js` | `tests-js` liên quan |
| 8 | Giao diện tối, a11y, responsive, docs, full test | toàn bộ + `docs/design-guidelines.md` | toàn bộ |

Artboard tham chiếu theo bước: 1 → StyleGuide · 2 → header mọi artboard · 3 → Main, MainTable, MobileList, MobileTable, MobileFilters · 4 → TeamDetail · 5 → Lookup, LookupTactics, LookupProfile, LookupMobile · 6 → Coexist(+Mobile), Khaihoang(+Mobile) · 7 → Recruit, Analyze, Roster (+Mobile).

## 8. Rủi ro

- Chữ UI thuộc ledger (`ui:*`) — đổi câu chữ có thể cần review độc lập; chạy `npm run check` sớm mỗi bước.
- Thêm file tĩnh (font, CSS tách) chạm allowlist dist verifier + byte parity `_headers`.
- `index.astro` và `SiteLayout.astro` viết `<head>` riêng — dễ lệch nếu chỉ sửa một nơi.
- Dev server giữ snapshot pin trong bộ nhớ: sau publish dữ liệu phải restart (`root-static-artifacts.ts`).
- Ảnh chân dung hotlink có thể bị chặn → fallback phải chắc.
- Chế độ Bảng trên legacy: dữ liệu `heroes[].tactics` dạng object khác Recommended — renderer cần adapter.
- Chiều cao artboard là ước tính; canvas là chuẩn thị giác, không phải chuẩn pixel tuyệt đối về chiều dọc.

## 9. Việc tồn đọng ngoài phạm vi (ghi nhận)

- 5 tên đội "…cảm tử" nằm trong glossary source — đổi sẽ vô hiệu 5592 receipt.
- Góp ý reviewer: "Bản 2 người" → "Bản 2 tướng"; "Phụ Nữ Thương" dễ đọc nhầm; một câu dùng `|` ASCII thay `｜`.
- Đường dẫn `/Users/plateau/Downloads/…mp4` còn trong 23 file đã commit (thế hệ cũ, `plans/`, `assets/videos/…/team-list.md`) và lịch sử git.
- Production `tqccl.pages.dev` còn bản cũ đến khi deploy.

## Handoff

Tiếp theo: `/ak:plan` dùng file này làm contract (outcome, constraints, non-goals, acceptance, 6 quyết định, lộ trình 8 bước), rồi `/ak:cook` theo từng bước.

## Câu hỏi chưa giải quyết

- Không có câu hỏi chặn. Tùy chọn: có tách `css/styles.css` thành nhiều file ở Bước 1 hay giữ một file — quyết khi làm plan sau khi đọc `runtime-asset-contract`.
