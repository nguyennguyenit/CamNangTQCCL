---
phase: 3
title: "Báo cáo zh-gaps (#16)"
status: done
priority: P2
effort: "0.25d"
dependencies: []
---

# Phase 3: Báo cáo zh-gaps (#16)

## Goal

Báo cáo zh-gaps nằm ở `docs/zh-gaps.md`, và `npm run verify` báo lỗi khi báo cáo lệch dữ liệu.

## Hiện trạng (bằng chứng: [reports/scout-15-16-12.md](./reports/scout-15-16-12.md) mục #16)

- `scripts/report-zh-gaps.mjs:15` ghi vào `plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md`; comment `:5-6` lặp lại đường dẫn; `--check` ở `:99-108` so chuỗi báo cáo với file, hiện exit 0 (0.2s).
- `package.json:15` `verify` = `python3 -m pipeline.site_localization check --root . --stage public && node scripts/verify-astro-dist.mjs`.
- `tests-js/seo-dist-contract.test.mjs:11,343-346` import `zhGaps`, không đọc file báo cáo.
- `.github/workflows/mcp-worker.yml` không lọc `docs/**`.
- Tài liệu nhắc đường dẫn cũ: `README.md:116`, `docs/deployment-guide.md:44,111` (câu "test:dist chỉ kiểm bất biến, không đọc file báo cáo" phải viết lại), `docs/codebase-summary.md:16,48`, `docs/unified-lookup.md:96,147`.

## Files to Create / Modify

- Modify: `scripts/report-zh-gaps.mjs` — `ZH_GAPS_REPORT_PATH = new URL("../docs/zh-gaps.md", import.meta.url)`; sửa comment `:5-6`; cho phép ghi đè đường dẫn qua biến môi trường `ZH_GAPS_REPORT_PATH` chỉ để test.
- Create: `docs/zh-gaps.md` (sinh bằng script).
- Delete: `plans/261015-1658-seo-ai-render-san/reports/zh-gaps.md` (file sinh, đã chuyển chỗ).
- Modify: `package.json` — `verify` thêm `&& node scripts/report-zh-gaps.mjs --check`.
- Modify: `.github/workflows/mcp-worker.yml` `pull_request.paths` thêm `docs/zh-gaps.md` (phối hợp với phase 2 nếu cùng lúc: merge phase nào trước thì phase sau rebase).
- Modify: `README.md:116`, `docs/deployment-guide.md:44,111`, `docs/codebase-summary.md:16,48`, `docs/unified-lookup.md:96,147`; thêm mục vào `docs/project-changelog.md`.
- Create: `tests-js/zh-gaps-report.test.mjs`.

## TDD

1. `--check` với `ZH_GAPS_REPORT_PATH` trỏ tới file không tồn tại → exit 1, thông báo nêu đường dẫn.
2. `--check` sau khi sửa một dòng trong file báo cáo tạm → exit 1; sinh lại → exit 0.
3. Chạy không có `--check` với đường dẫn mặc định → chỉ ghi `docs/zh-gaps.md` (kiểm `ZH_GAPS_REPORT_PATH.pathname` kết thúc bằng `/docs/zh-gaps.md`), không ghi vào `plans/`.
4. Sinh hai lần liên tiếp cho cùng nội dung byte-to-byte; chạy từ cwd khác cho cùng kết quả.
5. `package.json` `scripts.verify` chứa `report-zh-gaps.mjs --check`.

## Verification

- `node --test tests-js/zh-gaps-report.test.mjs` xanh.
- `node scripts/report-zh-gaps.mjs && node scripts/report-zh-gaps.mjs --check` exit 0.
- `npm run build && npm run verify` xanh.
- Grep: không còn `261015-1658-seo-ai-render-san/reports/zh-gaps.md` trong `scripts/`, `README.md`, `docs/` (trừ changelog cũ và `docs/deployment.md`).

## Risks

- Một PR đổi dữ liệu Tra cứu mà không sinh lại báo cáo sẽ làm `verify` đỏ, và một lần xuất bản blog trên `main` đó sẽ fail. Chặn bằng `verify` trong CI của PR (`check:repository` chạy `verify`).
- Các phase 5, 9 đổi dữ liệu Tra cứu hoặc trang: mỗi phase chạy lại `node scripts/report-zh-gaps.mjs` nếu `--check` đỏ.
