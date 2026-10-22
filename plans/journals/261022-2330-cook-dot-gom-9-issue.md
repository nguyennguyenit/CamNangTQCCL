# Cook: đợt gom 9 issue (plan 261022-1109) — 2026-10-22

## Kết quả
- Merge vào `main`: #28 (worker roster), #27 (#16), #32 (worker Đội cộng đồng, phối hợp), #29 (#12), #31 (#14), #30 (#15), #33 (#5), #34 (#20), #35 (#6), #37 (plan + mốc rollback). `main` = `c4abbf4`.
- Snapshot #21/#23 giữ ở `feat/dong-bo-kho-va-doi-cua-toi` `a4cf6c1`. Client #21/#23 là PR #36: cổng xanh, chưa merge.
- Chưa có gì lên production. Pages vẫn chạy `957bb3d`, không có lần deploy blog nào trong đợt.

## Sự cố và cách xử lý
- GitHub Actions hết phút giữa đợt. Người dùng chọn chạy local đúng lệnh của job (`CI=true npm run check:repository`) trên head PR, từng PR một.
- Bản đầu `/tmp/gate.sh` lấy `FETCH_HEAD` của `main` thay vì head PR; đã sửa bằng ref riêng `refs/gate/pr-N`. Lần chạy sai không được dùng làm bằng chứng.
- Sửa script đang chạy làm bash đọc lệch dòng (gate #30). Phần `check:repository` vẫn chạy xong và in "đã đạt".
- Chạy Playwright song song ở nhiều worktree tranh cổng 4174 (`reuseExistingServer: false`), nên agent chạy bằng config tạm trên cổng khác.
- Chuỗi publish lỗi "candidate differs" khi còn `.cache/site-localization-candidate` cũ: xóa cache rồi chạy lại.

## Còn lại (cần người dùng)
- Phase 4 bước 7–8: xác nhận gói Workers Paid (1000 câu D1 mỗi lần gọi), áp D1 `0011` remote, deploy community-worker gồm #28 và #32, kiểm production.
- Phase 11: cửa sổ release. Merge CĐ-B rồi #36 (rebase, chạy lại chuỗi publish mỗi lần), gate MCP, release MCP, deploy Pages, chạy checklist Google thật, đóng #21/#23.
- Sau khi worker mới lên: bỏ `blog-publish` khỏi `pages-deploy.yml` (việc của CĐ-B).

## Bổ sung 2026-10-23
- Tài khoản Cloudflare ở gói Free: #38 hạ `ROSTER_MAX_BATCH` 200 → 12 (M2 đếm mọi câu D1 của request); #36 đổi `PUSH_CHUNK_SIZE` theo, head `25884a5`, cổng local xanh.
