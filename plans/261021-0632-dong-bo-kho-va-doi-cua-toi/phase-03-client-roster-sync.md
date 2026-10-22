---
phase: 3
title: "Client: đồng bộ kho theo hộp"
status: done
priority: P1
effort: "2.5d"
dependencies: [2]
---

# Phase 3: Client — đồng bộ kho theo hộp

## Goal

Gợi ý đội đọc/ghi kho của hộp đang chọn khi đã đăng nhập, đồng bộ qua `/api/roster`; chưa đăng nhập chạy y như hiện tại với `tqccl.rosterRecommend.scanState.v1`. Một client roster duy nhất, dùng lại được cho `/doi-cua-toi/` ở phase 6.

## Files to Create / Modify

- Create: `js/roster-cloud-store.js` — trạng thái thuần: map bản ghi theo `kind:id`, gộp LWW (hòa khác payload → nhận bản server), đóng dấu Lamport (`stamp` như `js/recruit-tracker-store.js:68-70`), **dirty map khóa → `updatedAt` đã gửi**, `boxes()`, `ownedOf(boxId)`, `seasonOf`, `lockedOf`, `overridesOf`, `groupsOf`, `teamsOf`; ghi/xóa mềm; bỏ bản ghi con khi thấy bản xóa của hộp; `ensureBoxDefaults(boxId)` (idempotent: hộp + `${boxId}~khai-hoang` + `${boxId}~ghep-team`; với `main` thêm `season main`); `mergeLocal(scanState, resolve)` theo quy tắc phase 1 cho `owned`, `locked` (khóa `lockedTeamKey`) và `override`; `applyResults(results)` theo `outcome`.
- Create: `js/roster-sync.js` — `createRosterSync({kinds, storage, ...})`: kéo theo `rev` với `?kinds=`, đẩy dirty theo khúc 500 kèm `expectedUserId`, xử lý `results` theo `outcome` (ACK chỉ khi phiên bản hiện tại vẫn là phiên bản đã gửi; `conflict` → nhận bản server, phát sự kiện `conflict` kèm bản thua; `rejected` → để riêng + sự kiện `rejected`; 409 `user_mismatch` → dừng timer, bỏ request/response phiên cũ, khóa UI, nạp lại phiên), debounce 1,5 s, nghe `visibilitychange`/`online`. Cache và cursor lưu **cùng một giá trị** `tqccl.roster.cloud.v1` (`{userId, cursor, records, dirty}`); mọi đọc–sửa–ghi chạy trong `navigator.locks.request("tqccl-roster")` và **gộp** blob mới nhất với state của tab (bản ghi theo `updatedAt`, hợp dirty); sự kiện `storage` chỉ kích hoạt gộp. Trước mỗi lượt đẩy, so `userId` của blob với user của phiên; khác thì xử lý như `user_mismatch`. Không tách `js/recruit-sync.js` (tính năng đang chạy, ngoài phạm vi).
- Create: `js/roster-id-resolve.js` — suy ID món từ tên bằng `canonicalHeroId` (`js/hero-identity.js`) và `createTacticIdResolver` (`js/lookup-ids.js`), giống `js/team-recommend-engine.js:85-95`; **sau đó kiểm ID có trong tập ID của `heroes-dict`/`tactics`** (kể cả former tactic ID), lấy tên chuẩn từ hàng từ điển; bắt lỗi theo từng món (`canonicalHeroId("曹操")` ném lỗi).
- Modify: `js/roster-scan-state.js` — giới hạn `lockedTeams` tối đa 30 (`MAX_LOCKED_TEAMS`).
- Modify: `js/roster-recommend-ui.js` — khách: `loadState/saveState` như cũ (`:80-86`). Đã đăng nhập: kho của hộp đang chọn (ô chọn hộp chỉ hiện khi >1 hộp); lần đầu có hộp cloud thì hỏi "Gộp kho trên máy này vào tài khoản?" (cờ trong `tqccl.roster.merged.v1` theo `userId`). Hết phiên (401): giữ kho cloud ở chế độ chỉ đọc + lời mời đăng nhập, không chuyển sang kho local. Dòng trạng thái đồng bộ, xung đột, bản bị từ chối.
- Modify: `js/community-api.js` (`signOut`, `:238`) — xóa `tqccl.roster.cloud.v1` trước khi tải lại trang.
- Modify: `src/lib/public-artifact-manifest.mjs` — `entry("js", "roster-cloud-store")`, `entry("js", "roster-sync")`, `entry("js", "roster-id-resolve")` (tiền lệ `recruit-sync`, `docs/project-changelog.md:405`); cập nhật `tests-js/astro-dist-contract.test.mjs` nếu danh sách cần đổi.
- Modify: `src/components/pages/PrivacyPage.astro` (`:148-157`) — kho Gợi ý đội được đồng bộ lên D1 khi đăng nhập. File này **không** bị ghim bản dịch; `community-api.js` cũng không.
- Localization: `js/roster-recommend-ui.js` (ghim ở `pipeline/site-localization-policy.json:787`) và `js/roster-scan-state.js` nếu bị ghim → chạy chuỗi "Publish lại bản dịch hiển thị" (`docs/deployment-guide.md:251-271`): re-pin hash, cập nhật `baseline.notes`, build/check/publish, re-pin `pipeline/team-route-handles.json`; chữ mới lớp `translate` cần receipt người duyệt độc lập. Rebase lên `main` trước khi publish để không ghi đè generation của plan Đội cộng đồng.
- Create: `tests-js/roster-cloud-store.test.mjs`, `tests-js/roster-sync.test.mjs`, `tests-js/roster-id-resolve.test.mjs`
- Keep green: `tests-js/recruit-sync.test.mjs`, `tests-js/roster-scan-state.test.mjs`

## Test Matrix (viết trước; fixture là state local thật, món không có `canonicalId`)

| # | Ca | Kỳ vọng |
|---|---|---|
| 1 | Suy ID: món `{name, confidence:"manual"}` có trong từ điển; alias; former tactic ID | ra `hero:…`/`tactic:…` đúng như engine, tên chuẩn từ từ điển |
| 2 | Tên Việt không tồn tại; tên chỉ chữ Hán chưa map | không sinh bản ghi, vào "chỉ trên máy này"; không ném, các món khác vẫn gộp |
| 3 | Gộp: local 3 tướng + 2 chiến pháp + 1 đội khóa + 1 món bù + `seasonId`, cloud rỗng, đồng ý | `box main`, `season main` mang `seasonId` local, 2 nhóm mặc định, 5 `owned`, 1 `locked`, 1 `override` |
| 4 | Gộp: cloud có bản xóa của `main~hero:x`, của một `locked` và một `override` tương ứng local | không tạo lại cả ba |
| 5 | Gộp dở (mất mạng giữa chừng) rồi chạy lại | không nhân đôi, phần còn thiếu được tạo |
| 6 | Gộp: người dùng từ chối | không tạo gì; cờ ghi "đã hỏi", lần sau không hỏi lại |
| 7 | Đổi tài khoản A → B → A trên cùng tab | cờ theo `userId`, A không bị gộp lại; cache của A không lộ cho B |
| 8 | Hai tab: tab 1 còn dirty của A, tab 2 đăng xuất A rồi đăng nhập B | tab 1 không đẩy dữ liệu A vào B (so `userId` trước khi đẩy; server trả `user_mismatch` nếu lọt); phản hồi muộn của phiên A bị bỏ |
| 9 | Lamport: đồng hồ máy chậm hơn bản đã thấy | `updatedAt` mới > bản đã thấy |
| 10 | Sửa X@11 trong lúc X@10 đang gửi | phản hồi của X@10 không xóa X khỏi dirty; X@11 được đẩy ở lượt sau |
| 11 | Phản hồi `already-applied` (gửi lại sau mất phản hồi) | ACK, không báo xung đột |
| 12 | Phản hồi `conflict` (kể cả hòa khác payload) | nhận bản server, phát `conflict` kèm bản thua |
| 13 | Phản hồi có `rejected` | bản đó ra khỏi dirty, vào danh sách bị từ chối; các bản khác vẫn ACK |
| 14 | Bản xóa của hộp kéo về | mọi bản ghi con của hộp bị bỏ khỏi cache |
| 15 | Hai tab: A đọc S, B đọc S, A ghi S+X, B ghi S+Y trước khi có sự kiện | blob cuối có cả X và Y, dirty có cả hai; sau khi tải lại cả hai lên server |
| 16 | 401 giữa chừng | trạng thái `signed-out`, kho cloud chỉ đọc, không đổi sang kho local |
| 17 | `signOut` | `tqccl.roster.cloud.v1` bị xóa |
| 18 | `lockedTeams` vượt 30 | bản cũ nhất bị loại, có thông báo |

## Tasks & Steps

1. Viết test (fixture state thật; giả lập `navigator.locks` và hai "tab" dùng chung một storage); chạy `npm run test:node` → đỏ.
2. Viết `roster-id-resolve.js`, `roster-cloud-store.js`, `roster-sync.js` đến xanh.
3. Nối vào `roster-recommend-ui.js`; thêm manifest; sửa trang Quyền riêng tư.
4. Chạy chuỗi publish lại bản dịch; `npm run check && npm run build`.
5. Smoke theo cách đã dùng cho community (`docs/community-worker.md:157`): `wrangler dev` cho Worker + `wrangler pages dev dist --service COMMUNITY=tqccl-community`, session Better Auth tạo sẵn cho hai trình duyệt cùng user: khách thêm món → đăng nhập → đồng ý gộp → trình duyệt thứ hai thấy cùng kho.

## Verification

- `npm run test:node` xanh.
- `npm run check && npm run build && npm run test:dist` xanh.
- Smoke bước 5 qua; Theo dõi chiêu mộ vẫn đồng bộ như cũ.
