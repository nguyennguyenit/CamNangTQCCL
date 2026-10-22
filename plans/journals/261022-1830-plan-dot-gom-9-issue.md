---
title: "Plan đợt gom 9 issue (#5 #6 #12 #14 #15 #16 #20 #21 #23)"
date: 2026-10-22
summary: "Advise + Fable/Astra review + plan --hard --tdd 11 phase; red team 31 → 15 đã áp; validation 4 quyết định"
---

# Plan đợt gom 9 issue

Plan: `plans/261022-1109-dot-gom-9-issue/`. Chưa sửa code, chưa commit. Có sửa phase 07 của plan gốc #21/#23 (bản trong worktree) để tách rollout: worker sớm, Pages cuối đợt.

## Kiểm chứng đã chạy (đọc code, curl production, không build)
- `pages-deploy.yml` chỉ chạy tay hoặc khi xuất bản blog, luôn build `main`, có `cancel-in-progress`; không có preview.
- #21/#23 đã code xong trong worktree `feat/dong-bo-kho-va-doi-cua-toi` nhưng ~272 path chưa commit, base `1fa81ab`.
- Id binh thư suy từ tên Việt ở ít nhất 8 chỗ (JS, Python, MCP); id đã lưu trong D1 `scan_samples`, link `?doi=`, lịch sử Soi đội.
- Production: JSON-LD đội đã có, title có mã mùa, H1 không; sitemap có 2734 URL đội; `llms.txt` có 26 file theo mùa.
- Đội khác: 40/40 đội không có dữ liệu mùa.
- Subagent `scout` lỗi khoá API hết hạn; scout chạy bằng agent mặc định, red team bằng `code-reviewer`.

## Red team (4 lens, 31 → 15)
Bẫy lớn: phase 10 chỉ chuyển file mới và file ghim, bỏ sót ~15 file sửa không ghim (xóa cache khi đăng xuất, noindex `/doi-cua-toi/`, payload lưu đội); bỏ CI trên push thì không gì kiểm `main` trước lần blog deploy; client đồng bộ lên production qua blog không ai theo dõi trong khi xóa hộp là xóa cứng; kiểm production bằng `curl` kèm cookie root; fixture sách không id làm đỏ ~25 file test.

## Quyết định
Gom theo lần release, không theo PR. #12 A' + CI trên PR, hook chạy build+verify khi push main. #14 chỉ đóng băng id, tên cũ vào `aliases`, xóa `bookLookupId`. #6 chỉ Đội chuẩn, trang `/doi-chuan/<mã mùa>/` cho mùa cũ, giữ `?season=`, giữ H1. Worker release sớm ngay sau PR worker; client #21/#23 merge trong cửa sổ release cuối (ngừng blog nửa ngày).

## Tiếp theo
`/ak:cook plans/261022-1109-dot-gom-9-issue/plan.md --tdd`. Bắt đầu phase 1 (commit snapshot #21/#23) ngay để tránh mất code.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
