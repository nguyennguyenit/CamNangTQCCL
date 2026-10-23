---
phase: 11
title: "Release cuối đợt và đóng issue"
status: pending
priority: P1
effort: "1d"
dependencies: [2, 3, 6, 10]
---

# Phase 11: Release cuối đợt và đóng issue

## Goal

Trong một cửa sổ release có người theo dõi: merge client #21/#23 (phase 10), release Research MCP một lần và deploy Pages một lần trên cùng SHA của `main`, kiểm production bằng tài khoản thật, ghi `docs/deployment.md`, đóng 9 issue.

<!-- Updated: Red Team 2026-10-22 - merge phase 10 trong cửa sổ release; Pages không có preview; kiểm MCP bằng CLI local; checklist #23 production; rollback theo SHA đã ghi -->

## Bối cảnh

- MCP: job `production-release` của `.github/workflows/mcp-worker.yml` chỉ chạy khi `workflow_dispatch` từ `main`, `confirm_production == true`, và `production_sha` (40 ký tự) khớp `HEAD`, `GITHUB_SHA`, `origin/main` (`docs/deployment-guide.md:168-179`; `mcp-worker.yml:136-142`). Bản trước: run `39652210255` (`957bb3d`), worker `93d02cc5…` (`docs/deployment.md:41-49`).
- Pages: `pages-deploy.yml` checkout `main` (`:28-30`), không nhận SHA, chạy `wrangler pages deploy dist --branch main` (`:51-53`) — **deploy thẳng production, không có bước preview/promote**. Có `concurrency: cancel-in-progress` (`:17-19`). Build cần `COMMUNITY_API_ORIGIN` chỉ có trong workflow (`:26`); build local thiếu biến này cho blog rỗng (`docs/deployment-guide.md:98`), nên không deploy Pages từ máy local.
- Không có bearer MCP trên máy (`docs/deployment.md:49`); bearer chỉ đọc từ `TQCCL_MCP_BEARER_CURRENT`, không đưa vào argv (`docs/deployment-guide.md:182`).
- Worker community đã release ở phase 4.

## Tasks & Steps

1. **Chuẩn bị (người dùng xác nhận trước khi bắt đầu):** báo không xuất bản/sửa/gỡ blog và không push `main` cho tới khi bước 8 xong. Ghi lại SHA `main` hiện tại, deployment ID Pages đang chạy (rollback target), và bookmark D1 mới: `npx wrangler d1 time-travel info tqccl-community`.
2. Merge PR phase 10 (đã xanh). Sau merge, trên đúng SHA đã merge, checkout sạch: `npm ci && npm run build && npm run verify`.
3. Gate: `workflow_dispatch` `mcp-worker.yml` với `production_sha=<SHA main>`, `confirm_production=false`. `gh run view <id> --json headSha` phải bằng SHA đã nhập (job không tự kiểm input khi `confirm_production=false`). Chờ xanh.
4. **Dừng, hỏi người dùng** release MCP: `workflow_dispatch` với `confirm_production=true`, cùng SHA.
5. **Dừng, hỏi người dùng** deploy Pages: `workflow_dispatch` `pages-deploy.yml`. Sau khi chạy: `gh run view <id> --json headSha` bằng SHA của MCP. Nếu MCP đã release mà Pages build fail (ví dụ API blog lỗi lúc build): không push gì, chạy lại `pages-deploy.yml`; nếu vẫn fail thì dừng và hỏi.
6. Kiểm production sau deploy (không có preview, nên lỗi thì rollback ngay theo mục Rollback):
   - Header và canary theo `docs/deployment-guide.md:129-141` (phần áp dụng sau deploy).
   - `curl -s https://tqccl.com/doi-chuan/pk-s24/ | grep -c '<h1'` = 1, có tên tướng; `https://tqccl.com/sitemap.xml` có `/doi-chuan/pk-s24/`; `/doi-chuan/` không JS có đủ đội mùa mặc định và khối "Các mùa khác".
   - Trang đội mùa cũ có nhãn "mùa cũ".
   - MCP: chạy CLI `mcp-worker` local trên SHA đã release, kiểm release ID khớp với workflow, đọc `pagePath` của `hero:sp-lu-mong` là `/tra-cuu/tuong/sp-lu-mong/` và một `equipment-special:*` là `?id=` (theo tiền lệ `docs/deployment.md:49`). Không gọi live bằng bearer.
   - `/goi-y-doi-tu-kho/`: mục tranh món với kho ví dụ #5; khối độ phủ.
   - `/api/roster` không đăng nhập 401; `/doi-cua-toi/` noindex; `/my-teams-source-index.json` trả JSON.
7. **Checklist #21/#23 với tài khoản Google thật (người dùng làm, trong devtools hoặc giao diện; không dùng `curl` kèm cookie):**
   - Chưa đăng nhập, bấm Lưu ở từng nguồn (Gợi ý đội, chi tiết Đội chuẩn/Đội khác, chi tiết Khai hoang, Soi đội) → đăng nhập Google → đúng đội được lưu.
   - Sửa một đội, tải lại trang: thay đổi còn.
   - Mở trên trình duyệt thứ hai cùng tài khoản: thấy cùng kho và đội.
   - Đăng nhập lần đầu với kho local có sẵn: hỏi gộp; gộp xong máy kia thấy.
   - Xóa một hộp test và một nhóm test; đăng xuất, kiểm `tqccl.roster.cloud.v1` đã bị xóa khỏi localStorage.
   - Chỉ ghi mã trạng thái và kết quả có/không vào `docs/deployment.md`.
8. Ghi `docs/deployment.md`: SHA, run MCP, worker MCP version, run và deployment Pages, bookmark D1, kết quả bước 6–7. Commit sau khi cả hai deploy xong (đây là commit đầu tiên được push sau cửa sổ).
9. Báo người dùng có thể đăng blog lại.
10. Đóng 9 issue, mỗi issue một comment dẫn tới PR và kết quả kiểm; #6 ghi phần đã làm và các quyết định thu hẹp (bỏ Đội khác, giữ H1, giữ `?season=`, server comment dễ dãi được chấp nhận); #14 ghi chỉ làm hướng A; #21/#23 chỉ đóng khi bước 7 đủ bằng chứng.
11. Cập nhật trạng thái plan này và plan gốc `plans/261021-0632-dong-bo-kho-va-doi-cua-toi/`.

## Verification

- `gh issue list --state open` chỉ còn #10 (và issue mới phát sinh, nếu có).
- `docs/deployment.md` có mục release mới với cùng SHA cho MCP và Pages.

## Rollback

- Rollback target là các SHA và deployment ID đã ghi (xem "Mốc rollback" trong `plan.md` và bước 1).
- Pages: revert `main` về SHA đã ghi **trước**, rồi chạy lại `pages-deploy.yml` hoặc promote deployment đã ghi trong dashboard (`docs/deployment.md:29`, `docs/community-worker.md:357`). Revert theo thứ tự ngược các merge của hàng nối tiếp tới SHA đã ghi; không revert riêng một PR giữa hàng (xung đột generation). Nếu không revert được: sửa tiến bằng một PR mới + chuỗi publish.
- MCP: theo `docs/mcp-research-server.md`, về worker version trước đã ghi.
- D1: không xóa bảng. Lỗi dữ liệu của một người dùng: khôi phục từ Time Travel vào DB tạm rồi chép lại bản ghi `roster_records` của người đó; không restore cả database (ghi đè mọi dữ liệu khác, `docs/community-worker.md:363`).
- Không đăng blog trong lúc rollback.
