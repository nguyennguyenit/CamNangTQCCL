---
phase: 6
title: Styling Deploy Docs
status: completed
effort: ''
---

# Phase 6: Styling Deploy Docs

## Overview
Polish UI (đẹp & dễ nhìn hơn site tham khảo): hệ màu/typography, dark mode, sticky filter, responsive hoàn chỉnh, micro-interaction nhẹ. + GitHub Pages deploy workflow + docs/README.

## Requirements
- Functional UI polish: bảng màu nhất quán (light + dark), tier badge tương phản tốt, card hover, sticky/affixed filter bar (desktop) + drawer (mobile), header có tổng quan + nguồn data + disclaimer "tham khảo". Toggle dark mode lưu `localStorage`.
- Functional deploy (CHỐT — chỉ commit JSON, KHÔNG commit HTML nguồn): `.github/workflows/deploy.yml` chỉ **publish static** (`actions/upload-pages-artifact` + `deploy-pages`), KHÔNG có build step (nguồn HTML không có trong repo). `data/*.json` commit sẵn; build chạy LOCAL khi data đổi.
- Functional meta: `<html lang="vi">`, `<title>`, meta description, favicon, OG tags cơ bản (audit L).
- Docs: `README.md` (mô tả, cách build local `python3 build/build_json.py`, chạy local `python3 -m http.server`, deploy); `docs/system-architecture.md` ngắn (3 section + pipeline + data model + filter); `docs/codebase-summary.md`.
- Non-functional: responsive 360px→desktop không tràn ngang; tương phản đạt AA cơ bản; reduced-motion tôn trọng.

## Architecture
CSS thuần biến `:root`/`[data-theme=dark]` (custom properties), không preprocessor. Deploy: workflow `on: push (main)` + manual; job Python build → upload artifact `.` → `deploy-pages`. Vì JSON commit sẵn, workflow chỉ cần publish static (build step optional/an toàn).

## Related Code Files
- Modify: `css/styles.css` (polish), `index.html` (theme toggle, header), `js/app.js` (theme persist)
- Create: `.github/workflows/deploy.yml`, `README.md`, `docs/system-architecture.md`, `docs/codebase-summary.md`
- Depends: Phase 4, 5

## Implementation Steps
1. CSS design tokens (màu/space/typography) + dark mode + sticky filter + card polish.
2. Theme toggle nút + persist `localStorage`; reduced-motion.
3. Responsive QA 360/768/1280; sửa tràn.
4. `deploy.yml`: checkout → upload-pages-artifact (`.`) → deploy-pages; permissions `pages: write`, `id-token: write`; `on: push(main)` + manual. KHÔNG build step.
5. Meta/favicon/lang=vi/OG. README + 2 docs ngắn. Disclaimer nguồn data trên trang.
6. So sánh thị giác với site tham khảo (gọn hơn, badge rõ, mobile tốt).

## Success Criteria
- [ ] Dark/light toggle hoạt động + nhớ qua reload.
- [ ] Responsive 360px không scroll ngang; filter drawer mobile mượt.
- [ ] `deploy.yml` cú pháp hợp lệ (`actionlint` nếu có) + logic publish static đúng (không build).
- [ ] `<html lang="vi">` + title + meta + favicon có mặt.
- [ ] README hướng dẫn build & chạy local đầy đủ; docs cập nhật.
- [ ] Nhìn rõ ràng hơn baseline `ss18.thanglonghoi.xyz` (badge màu, card, filter).

## Risk Assessment
- GitHub Pages base path (R4): deploy `user.github.io/repo/` → path tương đối đã xử lý ở P4; xác nhận trên Pages thật.
- Chỉ commit JSON → repo KHÔNG có HTML nguồn; build là bước local, document rõ trong README để tái tạo.
