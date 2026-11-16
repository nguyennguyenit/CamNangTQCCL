---
title: "Phase 4: Docs-deploy"
status: todo
priority: P2
effort: "3h"
dependencies: [3]
---

# Phase 4: Docs, PR, cutover production

## Goal
Docs khớp hành vi mới; production chuyển không có 5xx trên các đường frontend dùng (đọc, vote, chiến báo, export); có cổng kiểm thật trước bước không lùi được. Ngoại lệ đã biết: `POST /api/community-teams` gọi trực tiếp API trong cửa sổ "worker mới + schema cũ" lỗi unique index — frontend cũ không có nút đăng; cửa sổ = bước 3.2 → 3.6, giữ ngắn.

## Files
- Modify: `docs/community-worker.md` (bảng `community_seasons`, API mùa/đội/vote/chiến báo, bỏ mục "Mở mùa mới", mã lỗi, catalog runtime; luật thứ tự deploy: migration **phá bỏ** chạy sau worker), `docs/system-architecture.md` (luồng catalog site → worker), `docs/deployment.md` (runbook dưới), `docs/project-changelog.md`
- Docs ghi rõ: cache isolate chỉ giảm độ trễ (không phải bản bền); nhãn trong `community_seasons` chỉ cập nhật khi có bài đăng mới ở mùa đó; mùa mặc định đi theo `pipeline/recommended-default-season.json`; rủi ro `sourceSeasonId` đổi giữa generation.

## Ma trận lệch phiên bản

| Pages \ Worker + schema | Worker cũ + schema cũ | Worker mới + schema cũ | Worker mới + schema mới |
|---|---|---|---|
| Frontend cũ | hiện tại | đọc/vote/chiến báo chạy (test Phase 2 #8); trang đăng ẩn vì không có `open`; chi tiết thiếu `seasonOpen` → nút vote hiện khoá | như cột trước |
| Frontend mới | worker bỏ qua `season` → sai mùa (**cấm**) | POST đội lỗi (unique index) (**cấm**) | đích |

Worker cũ + schema mới = 500 → không bao giờ migrate trước khi worker mới chạy.
Cửa sổ "frontend cũ + worker mới" (≈ 5–10 phút, không đăng được, nút vote hiện khoá) chấp nhận theo lệ clean cutover, không shim.

## Tasks
1. Cập nhật docs như trên.
2. Mở PR; CI `community-worker-gate` + build site xanh. **Chưa merge.**
3. Cutover (khi anh duyệt; tránh khung 20:17 UTC — build Pages theo lịch gọi export):
   1. Ghi version ID worker đang phục vụ: `npx wrangler deployments list` → lưu vào báo cáo làm đích rollback.
   2. `cd community-worker && npm run deploy` (worker mới, schema cũ).
   3. Cổng đường thật (Pages Function → service binding → worker → fetch `tqccl.com`): `curl https://tqccl.com/api/community-seasons` → 29 mùa, `current = pk-s27`; `curl https://tqccl.com/api/community-teams/export` → 200. Không dùng `wrangler dev --remote` làm cổng.
      - Lỗi fetch (same-zone/1042): bật compatibility flag `global_fetch_strictly_public` (kiểm trước: không provider AI nào do admin cấu hình trỏ về zone `tqccl.com`), deploy lại, kiểm lại.
      - Vẫn lỗi: đổi hằng `CATALOG_ORIGIN` trong `season-catalog.ts` sang `https://tqccl.pages.dev` (đã trả 200; không đổi `SITE_ORIGIN`), deploy lại, kiểm lại.
      - Vẫn lỗi: `npx wrangler rollback <version ID ở 3.1>`, dừng; schema chưa đụng.
   4. Ghi bookmark Time Travel: `npx wrangler d1 time-travel info tqccl-community`.
   5. Kiểm prod chỉ có `binh-dien-xuan-thu`: `npx wrangler d1 execute tqccl-community --remote --command "select id from community_seasons"`. Khác → dừng.
   6. `npm run db:migrate:remote`; kiểm lại `GET /api/community-teams/export` → 2 đội mang `season.id = og-兵演春秋`.
   7. Merge PR → Pages deploy (frontend mới + trang tĩnh đội lấy nhãn mới). Tab cũ đang mở → tải lại trang.
4. Đường lui:
   - Lỗi sau migrate, trước merge: chạy `rollback/0013_restore_community_season_open.sql` (hoặc khôi phục bookmark Time Travel nếu migration dở dang) + `npx wrangler rollback <version ID ở 3.1>`. Pages vẫn cũ.
   - Sau merge mà phải lui → revert PR (Pages cũ) + rollback SQL + `wrangler rollback <version ID ở 3.1>`.
5. Smoke: tài khoản A đăng đội thử mùa cũ (vd `pk-s5`) → root duyệt → tài khoản **B (không phải tác giả)** vote + gửi chiến báo được → xoá đội thử. `npx wrangler tail` suốt cutover: không 5xx trên đọc/vote/chiến báo/export; 5xx của POST đội (nếu có) chỉ được nằm trong cửa sổ 3.2 → 3.6.
6. Việc ngoài phạm vi → GitHub issue (vd nâng cấp D′: cron kéo catalog vào D1 làm bản last-known-good bền, nếu sau này cần).

## Verification
- Kết quả cổng 3.3, export 3.6 và smoke 5 trong báo cáo.
