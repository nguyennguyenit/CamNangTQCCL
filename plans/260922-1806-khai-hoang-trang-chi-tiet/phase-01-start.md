---
phase: 1
title: "Định danh, ghi chú và route contract offline"
status: completed
priority: P2
dependencies: []
---

# Phase 1: Định danh, ghi chú và route contract offline

## Overview và exit boundary

Khóa ID, phân loại ghi chú và hợp đồng ledger/catalog bằng kiểm chứng dữ liệu thuần. Phase này hoàn tất khi gate offline bên dưới xanh (**đã đạt**), không phụ thuộc page, entry JS, renderer hoặc publication của phase 2.

Đây là checkpoint nội bộ, **không phải bản có thể deploy**: source dữ liệu đổi có thể làm publication hiện tại stale cho tới cutover phase 2. Không tuyên bố build/UI xanh ở phase 1, không hạ gate localization để đạt checkpoint. Không tạo route page, không đăng ký asset chưa tồn tại, không publish candidate tại phase này.

## Context và key insights

Các quan sát dưới đây là trạng thái nguồn **lúc lập plan**, giữ làm mốc "trước/sau":

- [Chuẩn code](../../docs/code-standards.md), [kiến trúc](../../docs/system-architecture.md), [governance localization](../../docs/season-team-data.md).
- `data/khaihoang.json` có 17 team, khi đó chưa có team ID; không dùng array index/title làm identity.
- `pipeline/team_route_handles.py:27,35-36,496-538`: ledger và publication đang dùng chung constant version; phải tách trước khi nâng riêng ledger.
- `src/lib/team-detail-routes.ts:300-321`: default catalog đọc verified website snapshot; gate offline phải inject source/publication/ledger của fixture, không gọi nhánh default đòi publication mới.
- `src/lib/root-static-artifacts.ts:162-169`: asset inventory phải bằng source tree; page/entry/manifest phải cùng thuộc phase 2.

## Requirements và contract bàn giao

- Thêm `id` bất biến cho 17 team ở `data/khaihoang.json`; ASCII rõ nghĩa, unique, không derive lại khi đổi title. Giữ variant ID và thứ tự dữ liệu.
- Ledger thêm `handles.khaihoang` (`id -> handle`) và `khaihoangSha256`; nâng riêng ledger v2, đồng bộ Python/TS. Recommended selector/manifest/index vẫn v1; không sinh lại handle Recommended/legacy.
- Hàm catalog/validator offline nhận nguồn explicit, trả `khaihoang` entries gồm ID/handle/title/hash và các path dự kiến. Source hash lệch, ID thiếu/trùng, handle thiếu/trùng/không routable phải bị từ chối. Custom-root không được rơi về dữ liệu project thật.
- Phase 2 mới nối những entries này vào default published catalog, `htmlPaths` phát ra, runtime map `k`, `teamDetailPath/Href`, page và sitemap. Phase 1 không đưa path chưa có page vào live emitted inventory.
- Ghi chú ở cấp team/variant/hero: câu lắp đội, chọn chiến pháp, cộng điểm, chủ tướng, điều kiện kích hoạt => `buildNote`; câu đánh đất, đối thủ, mốc tiến độ, hột tài khoản, cảnh báo vận hành => `openingNote`.
- Tách ghi chú hỗn hợp thủ công, giữ đủ câu/điều kiện/thứ tự/mức độ chắc chắn. `guide` giữ nguyên ownership theo team. Migrate `displayNote` thuộc Khai hoang đã được thay thế; không giữ hai bản editable cùng ý nghĩa. Không đổi raw note/source metadata hoặc domain khác.
- ID/handle là canonical metadata. Toàn bộ nội dung UI phải qua localized publication khi phase 2 render; kiểm offline không cấp phép đưa raw JSON ra UI.

## Related code files và ownership

Sửa trong phase 1:
- `data/khaihoang.json`: ID và tách ghi chú, không thay gameplay.
- `pipeline/team-route-handles.json`, `pipeline/team_route_handles.py`: schema v2, assignment/validation và source hash; phase 1 chỉ pin generation hiện tại, rebind successor thuộc phase 2.
- `src/lib/team-detail-routes.ts`: pure parsing/validation/catalog assembly với injected bytes/path; cutover default published path thuộc phase 2.
- `tests/test_team_route_handles.py`, `tests-js/team-detail-routes.test.mjs`: offline contract cases, fixture v2 ledger + v1 Recommended; không nới assertion để nuốt mismatch.
- `tests-js/khaihoang-data.test.mjs`: bỏ assertion `build.note -> build.displayNote` đã nghỉ; bảo vệ semantic content bằng mapping và consumer scenarios ở phase 2, không thay bằng assert field mới non-empty.

Không tạo page/entry/asset mới trong phase 1. Không sửa `render.js`, app/navigation, shell, sitemap, headers, public-artifact manifest hoặc localization publication ở phase này. Toàn bộ owner của các surface đó được kê ở phase 2.

## Implementation steps

1. Đọc lại file và LSP references cho exported symbol trước khi sửa. Chụp baseline dữ liệu/handle làm chứng cứ bảo toàn; không chạy `pipeline.build_json`.
2. Gán ID và ghi bảng đối chiếu câu ghi chú cũ sang owner/field mới. Bảo toàn gameplay, guide, Chạm Sứ và mines. Team thiếu guide vẫn có identity riêng, không mượn guide từ team khác.
3. Tách ledger-version khỏi publication-version; migrate ledger Python/TS readers/writers và fixture v2. Giữ map cũ nguyên vẹn; source hash mới phải đúng bytes Khai hoang sau migration.
4. Hoàn thiện catalog assembly có dependency injection trong module hiện có. Kiểm route identity/path trên raw fixture hoặc bytes explicit, không gọi default published snapshot hay tạo page giả để chạy gate.
5. Thêm các case offline có lỗi thực sự: duplicate ID/handle, source hash sai, title/reorder không đổi handle, v2 ledger đọc v1 Recommended, custom-root không đọc repo thật. Đặt nhóm Python `KhaiHoangOfflineContracts` và nhóm Node `Khai hoang route contract` (tên Node thật lúc triển khai; xem ghi chú ở mục gate) để gate dưới đây xác định rõ phạm vi.
6. Chạy gate offline; ghi output và bảng bảo toàn. Gate đỏ thì sửa contract của phase 1, không bắt đầu phase 2 để lấp phụ thuộc thiếu.

## Todo

- [x] Khóa ID/handle và mapping ghi chú đủ nội dung.
- [x] Tách version và migrate ledger validators Python/TS.
- [x] Hoàn thiện catalog assembly dùng injected source.
- [x] Kiểm offline contract và semantic preservation độc lập.

## Success criteria và gate offline

- Mỗi team chính có đúng một entry/path dự kiến; không cần HTML page tồn tại để chứng minh mapping. Số entry theo inventory, hiện 17.
- Title/reorder không đổi handle; duplicate/missing ID/handle, hash lệch fail rõ; custom-root fixture độc lập với repo thật.
- Ledger v2 nhận Recommended v1; map Recommended/legacy giữ nguyên. Không có schema shim hoặc fallback chấp nhận source không khớp.
- So sánh semantic trước/sau: tướng/binh chủng/chiến pháp/chủ tướng/variants/guide/Chạm Sứ/mines không đổi; mọi câu note có vị trí đích, không mất điều kiện.
- Nhóm kiểm dưới đây **đã tồn tại và đã chạy**: nhóm Python `KhaiHoangOfflineContracts` (11 case)
  và nhóm Node `Khai hoang route contract` (6 case). Tên nhóm Node lúc triển khai là
  `Khai hoang route contract`, không phải `Khai hoang offline contract` như bản nháp; lệnh dưới
  đây đã sửa theo tên thật để filter không thể khớp zero test:

```bash
python3 -m unittest tests.test_team_route_handles.KhaiHoangOfflineContracts
node --experimental-strip-types --test --test-name-pattern='Khai hoang route contract' tests-js/team-detail-routes.test.mjs
```

Số case thực chạy đã ghi nhận (11 Python, 6 Node), nên không có pass do filter khớp zero tests.
Smoke in-memory/injected-path đối chiếu dữ liệu thật trước/sau đã chạy; phase 1 không cần browser,
Astro build, public localization check hoặc entry JS của phase 2. Full suite không bị thay thế bằng
gate hẹp này: đã chạy đủ ở phase 2 sau cutover.

## Risks và security

- Working tree sau phase 1 chưa deployable vì renderer/publication chưa migrate; phase 1 đã **không** được commit/publish/deploy riêng như ràng buộc này yêu cầu — cả plan đi vào một commit local duy nhất sau khi phase 2 xanh (chỉ local, không push/deploy).
- Path sinh từ ID/handle đã validate, không từ tên dịch, array index hoặc path tùy ý. Không để fixture thiếu tham số lấy nhầm nguồn live.
- Không sửa generation đã xuất. `generationId` chỉ rebind ở phase 2 sau successor publication; không sinh lại handle vì source hash thay đổi.

## Trạng thái hoàn tất

Đóng cùng plan, sau khi phase 2 xanh. Cả bốn mục Todo đã xong, không mục nào còn treo.

- `data/khaihoang.json`: 17 team có `id` bất biến (ASCII, unique, không suy lại từ title); variant ID và thứ tự dữ liệu giữ nguyên. 30 owner `displayNote` đã nghỉ được ghi thành bảng mapping sang `buildNote`/`openingNote` theo từng câu (59 câu, có case phải vắng field thay vì rỗng) trong `tests-js/khaihoang-data.test.mjs`; `displayNote` không còn xuất hiện trong toàn document.
- `pipeline/team-route-handles.json`: `schemaVersion: 2`, thêm `handles.khaihoang` (17 khoá) và `khaihoangSha256` = `sha256:973b252b08ef9332f19866e7321389bd952d03d8156c586718674db8a09de211`; map Recommended/legacy giữ nguyên byte-equivalent, publication vẫn v1.
- `src/lib/team-detail-routes.ts`: ledger v2 đọc được publication Recommended v1; catalog assembly nhận nguồn injected (`recommendedRoot`/`teamsPath`/`handlesPath`/`khaiHoangPath`/`khaiHoangBytes`) và từ chối custom-root thiếu nguồn Khai hoang thay vì rơi về dữ liệu repo thật.
- Gate offline xanh: `KhaiHoangOfflineContracts` 11 case (Python) + `Khai hoang route contract` 6 case (Node) đều chạy thật, không có filter khớp zero test. Phase 1 không tạo page/entry/asset, không publish candidate, không hạ gate localization.

## Next step

Gate offline xanh nên phase 1 đã hoàn tất và bàn giao ID, note schema, ledger v2, catalog assembly cùng evidence cho phase 2; phase 2 đã nhận và đóng trọn page + entry + asset registration + UI + localization/publication/rebind cùng toàn bộ gate tích hợp. Không có điều kiện hoàn tất phase 1 nào chờ phase 2.
