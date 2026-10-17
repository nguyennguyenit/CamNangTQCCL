# Phase 5 — Docs và kiểm toàn bộ (2026-10-15)

## Docs
Cập nhật: `docs/system-architecture.md`, `docs/codebase-summary.md`, `docs/code-standards.md`, `docs/deployment-guide.md`, `docs/design-guidelines.md`, `docs/unified-lookup.md`, `docs/project-overview-pdr.md`, `README.md`, mục mới đầu `docs/project-changelog.md` (không đổi dòng có sẵn của người dùng; `git diff` không có dòng xoá). `docs/season-team-data.md` không đổi (luồng publish mùa không đổi).

## Kiểm toàn bộ (orchestrator, cây làm việc cuối)

| Lệnh | Kết quả |
|---|---|
| `npm run build` | exit 0, 4917 trang |
| `npm run verify` | exit 0 |
| `npm run test:dist` | 49/49 |
| `npm run test:node` | 545/545 |
| `python3 -m unittest discover -s tests` | OK (426) |
| `python3 -m pipeline.lookup_route_handles --check` | 886 id, generation `lookup:29322cab13be` |
| `python3 -m pipeline.team_route_handles --check` | 1366 / 166 / 17 |
| `npm run check` (astro check) | 0 errors |
| `npx playwright test -c playwright.local.config.mjs` | 481 passed + 1 flaky (`beta-tools.spec.mjs:856` Turnstile, công cụ Gợi ý đội, ngoài phạm vi); chạy lại riêng `--repeat-each=3` → 6/6 passed |

## Done-means (đọc `dist/`, tương đương `curl -A ClaudeBot`)
Bảng đối chiếu từng mục: `agent://FinalReview` (đạt hết; JSON-LD trang mục đã chuyển sang `ItemPage` + `mainEntity` ở "Final review fixes" của `phase-04.md`). Kiểm lại ở orchestrator: `llms-full.txt` 2.668.288 B chứa 1366/1366 URL đội chuẩn và 886/886 URL trang mục; 44 link con trong `llms.txt` đều có file; 0 trang đội chứa `/tra-cuu/…?id=`; sitemap 4912 `<loc>`; 7 nhóm Tra cứu đủ số `data-lookup-id` ở vi và zh.

## Còn lại
- Chưa commit, chưa deploy (không được cho phép trong phiên).
- Khai hoang: sau Back, thẻ hiện cấu hình mặc định một nhịp trước khi khôi phục lựa chọn đã lưu (ghi ở `phase-02.md` Review fixes).
- 570/886 mục thiếu mô tả zh (`reports/zh-gaps.md`) — bổ sung dữ liệu là ngoài phạm vi.
