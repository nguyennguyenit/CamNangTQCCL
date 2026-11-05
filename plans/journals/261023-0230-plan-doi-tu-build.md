---
title: "Plan Đội tự build (đổi tên Đội cộng đồng, editor TipTap, cutover /doi-tu-build/)"
date: 2026-10-23
summary: Advise + review Astra/Fable + plan --hard --advice 6 phase; red team 32 → 15 đã áp; validate 4 quyết định; kongming 8 điểm
---

# Plan Đội tự build (đổi tên Đội cộng đồng, editor TipTap, cutover /doi-tu-build/)

# Plan Đội tự build

Plan: `plans/261022-1828-doi-tu-build/`. Chưa sửa code, chưa commit. Bắt đầu chỉ khi PR #36 và nhánh `fix/community-teams-ui-polish` đã merge vào `main`. Plan này đi trước và chặn `261022-1145-doi-cong-dong-cong-khai` (tạm dừng, rebase sau).

## Kiểm chứng đã chạy (đọc code, gh, không build)
- Trang tĩnh đội, menu, landing và export v1 kèm `analysis` đã bị revert khỏi `main` (PR #41/#42) và nằm trên `feat/doi-cong-dong-cong-khai`. Fable đọc repo đúng lúc chúng còn trên `main`, nên phần blocker về trang tĩnh và localization pin của vòng Fable bị loại.
- Không file nào plan sửa nằm trong `sourceFiles` ghim localization.
- Production: D1 đã áp 0008 và 0011; export trả 0 đội. GitHub Actions hết phút, nên deploy Pages bằng `wrangler pages deploy` tay.
- `FEATURE_ENABLED` chỉ chặn analyze, không dùng làm cửa sổ bảo trì được. `/js/*` phục vụ nguyên byte và script `is:inline` nên TipTap phải qua entry Vite. `pragma table_info` không trả cột generated.
- PR #36 không sửa `community-worker/`.

## Red team (4 lens, 32 → 15, áp tất cả)
Các bẫy lớn:
- Tính nguyên tử của migration remote chưa kiểm, R1 kiểm sai bất biến. Sửa bằng diễn tập trên D1 tạm.
- `git add -A` gom thay đổi chưa commit của user.
- Nháp, editor và token ảnh lệch vòng đời view.
- Blockquote đệ quy làm tràn stack (đã chạy thử).
- 301 công khai trong cửa sổ cutover. Sửa: 302 lúc cutover, đổi 301 sau.
- `stale_client` không tới được tab cũ.
- Trần AI của site bị tính vào quota user.

## Quyết định
- Tên "Đội tự build/自配阵容", URL `/doi-tu-build/`, 1 ảnh tự đọc AI, TipTap 3.32.0 lưu Markdown, gộp 6 cột vào `body_md`.
- Cutover một lần trong cửa sổ `MAINTENANCE`, deploy P0 trước.
- Payload cũ trả 400 `stale_client`.
- Diễn tập D1 tạm đã được đồng ý.
- Kiểm IME tay không chặn phát hành: macOS Telex, iPhone Telex, Windows Unikey/EVKey.

## Tiếp theo
Khi #36 và ui-polish đã merge: `/ak:cook plans/261022-1828-doi-tu-build/plan.md --advice`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
