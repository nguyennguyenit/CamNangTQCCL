---
phase: 5
title: "Đội của tôi: mô hình, bộ chuyển nguồn, lưu dở qua OAuth"
status: done
priority: P1
effort: "3d"
dependencies: [3, 4]
---

# Phase 5: Đội của tôi — mô hình, bộ chuyển nguồn, lưu dở qua OAuth

## Goal

Lớp dữ liệu thuần, test đầy đủ, cho "Đội của tôi": chuẩn hóa/kiểm đội theo mô hình đã duyệt, chuyển 4 nguồn thành đội đúng như nguồn, cảnh báo trùng, dấu thiếu món, lưu dở qua OAuth; cộng payload nhúng lúc build và endpoint hash nguồn.

## Files to Create / Modify

- Create: `js/my-teams-model.js` — thuần:
  - `normalizeTeam(input)` dùng cả khi đọc từ server (bản ghi hỏng bị bỏ qua kèm thông báo, không làm vỡ trang); `validateTeam(team)` kiểm 1–3 tướng, 2 ô chiến pháp, `alternatives`/`heroAlternatives` ≤3, `books` ≤3, giới hạn **byte** UTF-8 từng trường (`TextEncoder`), ≤16 KiB tổng.
  - `duplicateWarnings(teams)`: theo hộp, cặp đội chung `hero` hoặc `primary`, bỏ cặp có `replacesTeamId` trỏ nhau; bỏ đội đã xóa/khác hộp.
  - `missingItems(team, owned)`: tướng và `primary` không có trong kho hộp (theo ID canonical); ô `source-empty`/`unresolved` không tính là thiếu món.
- Create: `js/my-teams-sources.js` — mỗi bộ chuyển theo **bảng ghép trường** ở `docs/roster-sync.md` (phase 1), trả `{draft, source: {kind, key}, unresolved: [...]}`; `draft.id` sinh một lần (`team-…`) và giữ qua thử lại/tải lại:
  - `fromRecommended(record)`: `record.heroes[]` với `tacticSlotsRaw/Vi`, `bookSlotsRaw/Vi` theo đúng vị trí ô; bỏ ô bond; ô `slotState: "source-empty"` giữ là ô trống; phương án thay của tướng/chiến pháp/binh thư; `statFocusRaw` → `statNote`; counters → `notes`; `sourceSeasonId`, `tierRaw`, `displayNameVi`; key `sourceConfigId`. <!-- Astra M6 -->
  - `fromLegacy(content, {legacyTeamId, legacyVariantId})`: `content` là **đúng object trang đang hiện**: bản mặc định là đội gốc, biến thể là `{...admitted.legacyContent, notes: team.notes}` như `js/team-detail.js:151`. `heroes[].name` (tách "A / B" thành `heroAlternatives` như `js/hero-identity.js:63-79`), `alternatives` của tướng/chiến pháp/binh thư, `tactics[].name`, `books[].name`, `notes` → `notes.general`; key `legacyTeamId` hoặc `${legacyTeamId}~${legacyVariantId}`. <!-- Astra M6 -->
  - `fromKhaiHoang(team, variant)`: ô có cấu trúc là build **Sau cấp 20** (`tacticsAfter` tách "A/B" vào `alternatives`, `unitTypeAfter` → `troopNote`), tướng sắp theo `commanderAfter` (chủ tướng đứng đầu, như `js/render.js:367-379`); build **Trước cấp 20** (`tacticBefore`, `unitTypeBefore`, `commanderBefore`) cùng `buildNote`, `openingNote`, `note`, ghi chú từng tướng ghi vào `notes.general` có nhãn; không suy thêm dữ liệu Trước khi nguồn không có; dùng bản đã localization; key `teamId` hoặc `${teamId}~${variantId}`; nhóm mặc định Khai Hoang. <!-- Astra H7 -->
  - `fromAnalyze(canonicalTeam)`: dạng `js/analyze-state.js:29`; `source.kind = analyze`, không hash, không link nguồn.
  - `fromRosterEntry(entry, seasonRecords)`: dựng **nền** từ bản ghi đầy đủ (`entry.team.source === "season"` → `fromRecommended` của bản ghi tra theo `entry.team.id` trong `seasonRecords`; `entry.source === "legacy"` → `fromLegacy`), rồi **áp** lựa chọn engine đang hiện (`entry.heroAssignments`, `entry.tacticSelections`, như `js/roster-recommend-ui.js:659-680`) vào đúng ô — cần map `slotIndex` của engine về ô nguồn vì `js/roster-season-candidates.js:38-50` bỏ ô trống/bond trước khi engine đánh số; lựa chọn gốc khác lựa chọn đang hiện chuyển vào `heroAlternatives`/`alternatives`; món bù người dùng chọn (`tacticOverrides`) vào `userAlternatives`; hash vẫn là hash nguồn gốc. <!-- Astra H6 -->
  - `sourceHash(rawFields)`: SHA-256 hex 16 ký tự trên các trường nguồn thô có ý nghĩa (tên gốc theo ô, phương án thay, cộng điểm, chủ tướng/binh chủng theo giai đoạn, ghi chú nguồn), JSON chuẩn hóa thứ tự khóa; không tính bản dịch Việt và chỉnh sửa của người dùng; dùng chung build và client. <!-- Astra M6 -->
- Create: `js/my-teams-pending.js` — `stashPendingSave(draft)` vào `sessionStorage` key `tqccl:my-teams:pending-save` (kèm `createdAt`, hết hạn 30 phút, một mục, giữ `draft.id`); `peekPendingSave()`; `clearPendingSave()` chỉ gọi khi server trả `applied` hoặc `already-applied`.
- Create: `js/my-teams-api.js` — lớp mỏng trên `createRosterSync` (phase 3) cho kind `box,group,team,owned`, cache chỉ trong bộ nhớ (không ghi `localStorage`): `load()`, `ensureBoxDefaults(boxId)`, `saveTeam(team)` trả `{ok}` (`applied`/`already-applied`), `{conflict, server}` hoặc `{rejected, code}`.
- Modify: `src/lib/team-detail-pages.ts` — sinh payload lưu đội (draft + `source.key` + `contentHash` từ trường thô) cho Đội chuẩn, Đội khác (bản mặc định), Khai hoang (mọi biến thể).
- Modify: `src/components/pages/RecommendedDetail.astro`, `LegacyDetail.astro`, `KhaiHoangDetail.astro` — nhúng `<script type="application/json" id="team-save-payload">` bằng hàm escape kiểu `jsonLd` (`src/lib/blog-posts.ts:387-393`).
- Create: `src/pages/my-teams-source-index.json.ts` — Astro endpoint dựng sẵn `{ "kind:key": contentHash }` (gồm khóa biến thể). <!-- Astra M3 -->
- Modify: `scripts/verify-astro-dist.mjs` (`expectedFiles`, `:262-296`) — thêm `my-teams-source-index.json` vào allowlist và kiểm JSON/hash/payload thật; `tests-js/astro-dist-contract.test.mjs` — fixture dist giả có file này; `public/_headers` — quy tắc revalidate cho `/my-teams-source-index.json` và cập nhật `tests-js/pages-headers-contract.test.mjs` (`:89-94`). Không sửa `src/lib/root-static-artifacts.ts` (chỉ quản `js/css/data`, và bị ghim ở `pipeline/site-localization-policy.json:817`); không thêm file nguồn vào `data/`. <!-- Astra M3 -->
- Modify: `src/lib/public-artifact-manifest.mjs` — `entry("js", …)` cho `my-teams-model`, `my-teams-sources`, `my-teams-pending`, `my-teams-api`.
- Localization: ba `*Detail.astro` nằm trong `sourceFiles` (`pipeline/site-localization-policy.json:804-809`) → chạy chuỗi "Publish lại bản dịch hiển thị" (`docs/deployment-guide.md:251-271`), rebase lên `main` trước.
- Create: `tests-js/my-teams-model.test.mjs`, `tests-js/my-teams-sources.test.mjs`, `tests-js/my-teams-pending.test.mjs`

## Test Matrix (viết trước; fixture lấy từ dữ liệu thật)

| # | Ca | Kỳ vọng |
|---|---|---|
| 1 | `validateTeam`: 4 tướng, ô chiến pháp thứ 3 | lỗi đúng trường |
| 2 | Đội nguồn 2 tướng (`yxms-005-孫尚香凌統`, ô `source-empty`) | hợp lệ, ô thứ 3 trống |
| 3 | Tướng chưa đối chiếu được | `hero: null`, `slotState: unresolved`, `rawName`; hợp lệ |
| 4 | Chữ tự do chữ Hán tối đa + ký tự điều khiển | ≤16 KiB; vượt byte → lỗi trường, không cắt im lặng |
| 5 | `duplicateWarnings` A–B chung tướng; B `replacesTeamId = A`; đội đã xóa | có / không / không |
| 6 | `missingItems` | đúng món thiếu; `alternatives` không xóa dấu thiếu của `primary` |
| 7 | `fromRecommended` (bản ghi có bond, bản ghi có binh thư, có phương án thay, có `statFocusRaw`, có counters) | bond bị bỏ; binh thư đúng ID; vị trí ô giữ nguyên; phương án thay, `statNote`, `notes` đủ |
| 8 | `fromLegacy` có hero "A / B"; biến thể (`legacyContent` + `notes` của đội gốc) | `heroAlternatives`; key có `~variant`; `notes.general` là ghi chú đội gốc |
| 9 | `fromKhaiHoang` có "Tiềm Long Trận/Tam Thế Trận" | tách vào `alternatives`; nhóm Khai Hoang |
| 9b | Khai hoang chủ tướng không đứng đầu mảng (Chu Thái–Trương Phi–Trương Xuân Hoa, `commanderBefore/After = Trương Phi`); đổi chủ tướng sau cấp 20 (`commanderAfter = Pháp Chính`); biến thể chỉ có dữ liệu Sau | chủ tướng Sau đứng đầu; dữ liệu Trước và ghi chú nằm trong `notes.general`; không bịa dữ liệu Trước |
| 10 | `fromRosterEntry` từ `team-intro-27` (`SP Lữ Mông/Trình Phổ`), kho chỉ có Trình Phổ; ô chiến pháp thay có sẵn; món bù; ô bond đứng trước chiến pháp | draft khớp đúng thẻ đang hiện (Trình Phổ ở ô tướng, chiến pháp đã chọn ở đúng ô); SP Lữ Mông trong `heroAlternatives`; món bù trong `userAlternatives`; `sourceHash` bằng hash của bản ghi gốc |
| 11 | `fromRosterEntry` từ đội cũ (`entry.source === "legacy"`) | `source.kind = legacy` |
| 12 | `sourceHash` | đổi bản dịch Việt không đổi hash; đổi tên gốc một chiến pháp, chỉ đổi cộng điểm hoặc chỉ đổi ghi chú nguồn đều đổi hash |
| 13 | `normalizeTeam` bản ghi hỏng từ server | trả `null`, không ném |
| 14 | Pending: stash → peek → clear chỉ khi `applied`/`already-applied`; lưu lỗi; thử lại sau khi mất phản hồi | lỗi thì vẫn còn; thử lại cùng `draft.id` ra `already-applied`; quá 30 phút → `null` |
| 15 | Dist: `#team-save-payload` parse được, `contentHash` khớp `/my-teams-source-index.json`; tên có `</script>` không phá thẻ; `verify-astro-dist` chấp nhận file index; header revalidate đúng | đúng |

## Tasks & Steps

1. Chọn fixture thật (bản ghi Đội chuẩn có bond, đội 2 tướng, đội Đội khác có hero "A / B" và có biến thể, đội Khai hoang có biến thể và "A/B", đội Soi canonical, entry Gợi ý mùa + entry đội cũ).
2. Viết test; chạy đỏ; viết module đến xanh.
3. Nối build: payload nhúng, endpoint index, manifest; publish lại bản dịch; chạy dist test.
4. Ghi kích thước HTML trang Khai hoang nhiều biến thể nhất vào `docs/roster-sync.md`.

## Verification

- `npm run test:node` xanh.
- `npm run check && npm run build && npm run test:dist` xanh.
