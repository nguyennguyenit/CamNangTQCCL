---
title: "Khai hoang: build ở danh sách, hướng dẫn ở trang chi tiết"
description: "Tách hướng dẫn từng team vào trang riêng, giữ build bên ngoài và phục hồi cấu hình khi quay lại."
status: pending
priority: P2
effort: ""
branch: main
tags: [frontend, feature, routing]
blockedBy: []
blocks: []
created: 2026-09-23
---

# Khai hoang: build ở danh sách, hướng dẫn ở trang chi tiết

## Outcome và phạm vi đã chốt

- **Outcome:** danh sách `/#khaihoang` chỉ trình bày build; bấm tên team hoặc “Xem chi tiết” mở trang riêng có build đang chọn và đầy đủ hướng dẫn.
- **Constraints:** Astro static + vanilla JS, dùng `SiteLayout.astro`, CSS và navigation hiện có; không đổi nội dung gameplay. Giữ cấu hình khi mở, reload và quay lại. Chỉ đổi metadata/placement dữ liệu cần thiết.
- **Non-goals:** không research/crawl, không sửa chiến pháp/chủ tướng/binh chủng/điểm, không đổi Chạm Sứ hoặc quân thủ chung, không framework/backend/modal mới, không commit/deploy.
- **Acceptance:** ngoài card không còn hướng dẫn đánh đất; mọi team có link chi tiết đúng; chọn variant không điều hướng; guide giữ ownership theo bộ ba; Back/nút quay lại giữ lựa chọn; mobile/keyboard và các trang đội hiện có không regression.
- Người dùng đã đồng ý hướng trang chi tiết riêng; plan này cần duyệt trước khi code. Chưa có thay đổi implementation.

## Evidence hiện tại

- `js/render.js:241-325`: guide đang nằm ngay trong card; selector chỉ thay `.kh-build`.
- `data/khaihoang.json`: kiểm dữ liệu bằng script read-only cho thấy 17 team, 11 guide, 17 bộ ba khác nhau, chưa team chính nào có `id`; variant đã có ID.
- `displayNote` có cả chỉ dẫn build và lời khuyên đánh đất; chỉ bỏ `guide` khỏi card là chưa đạt yêu cầu.
- `js/app.js:320-393`: restore chạy trước khi mount Khai hoang; snapshot hiện chỉ lưu tab/scroll/disclosures, chưa lưu variant.
- `js/team-detail-navigation.js:18-19`, `src/lib/team-detail-routes.ts`: mới có Recommended/legacy; không có route Khai hoang.
- `pipeline/site_localization.py:527-530`: gate hiện yêu cầu đúng hai route family; thêm trang phải cập nhật contract localization, không bỏ qua gate.
- `docs/code-standards.md:22-35`: route mới cần inventory, verifier, headers, sitemap và canonical đồng bộ.
- Plan URL và plan hướng dẫn Khai hoang trước đều đã completed; chỉ dùng làm tham chiếu, không mở lại hoặc thay đổi trạng thái.

## Quyết định kỹ thuật

1. Route `/khai-hoang/<handle>/`; ID team và handle cấp một lần, đóng băng; đổi title hoặc sắp lại card không đổi URL.
2. Mở rộng ledger/catalog/href hiện có cho family Khai hoang; không tạo hệ routing thứ hai. Giữ toàn bộ handle Recommended/legacy byte-equivalent.
3. Di chuyển trọn `guide` vào detail. Tách ghi chú hỗn hợp theo câu thành `buildNote` và `openingNote`; không regex đoán ngữ nghĩa ở runtime, không đổi nội dung hoặc mức độ chắc chắn của lời khuyên.
4. Query detail `variant` chọn build của đúng team. Root dùng cặp `khTeam`/`khVariant` để phục hồi active team ngay cả khi storage lỗi. Snapshot Khai hoang dùng context key bỏ đúng hai query này để copy link card khác trong cùng tab vẫn giữ toàn map; các tab khác tiếp tục so full URL. Persist khi đổi selector/primary-click/pagehide; URL override đúng active team.
5. Nút quay lại khôi phục trạng thái danh sách lúc rời đi. Đổi variant trong detail chỉ đổi URL detail, không âm thầm sửa bản chọn trước đó trên danh sách.
6. Trang riêng dùng entry `js/khaihoang-detail.js`, chia sẻ renderer với danh sách, không boot `app.js`.

## Phases

1. [Định danh, ghi chú và route contract offline](./phase-01-start.md) — pending. ID/note schema, ledger v2, catalog assembly và gate dữ liệu thuần với injected source; không tạo page/entry hoặc đăng ký asset.
2. [Hiển thị, điều hướng và kiểm chứng](./phase-02-hien-thi-va-quay-lai.md) — pending; chỉ phụ thuộc gate offline phase 1. Sở hữu page + entry + asset registration + UI + localization/publication/rebind, rồi build/browser.

Một owner thực thi tuần tự; phase 1 có exit gate độc lập, không chờ phase 2. Checkpoint phase 1 chưa deployable vì source/publication/runtime chưa cutover; chỉ phase 2 kiểm toàn bộ ứng dụng. Không chạy validation trên cây đang bị sửa đồng thời.

## Acceptance checklist

- [ ] A1: Card chỉ còn tên/tướng/binh chủng/chủ tướng/chiến pháp/chọn cấu hình/ghi chú build và link.
- [ ] A2: Detail của mọi team mở được trực tiếp; đủ hướng dẫn vốn có, không mượn guide từ variant hoặc team khác; thiếu guide không bịa nội dung.
- [ ] A3: Variant đúng trên card, link, detail và reload; native select/tactic link không kích hoạt link team.
- [ ] A4: Back/nút quay lại/copy link card khác trong cùng tab giữ toàn map và scroll khi snapshot khớp context Khai hoang; query khác hoặc tab khác không được dùng lại. Tab mới thiếu snapshot hoặc storage lỗi vẫn giữ active team qua URL, không hứa toàn map. Đội Chuẩn/Đội Khác vẫn so full URL.
- [ ] A5: URL ổn định; slug lạ 404; variant lạ có thông báo và đường về build mặc định, không giả vờ đó là cấu hình yêu cầu.
- [ ] A6: Mobile 320/375 px và desktop 1280 px, hai theme, keyboard; không tràn ngang, không mất focus khi đổi build.
- [ ] A7: Chạm Sứ, mỏ chung, Đội Chuẩn/Đội Khác, localization, sitemap, headers và verifier đều giữ contract.

## Review và validation

Hai reviewer độc lập đã kiểm route/publication/security và UI/state/content. Có 3 finding có bằng chứng: 2 High, 1 Medium; cả ba đã đưa vào plan, không thay đổi phạm vi sản phẩm:

- **High — version coupling:** `pipeline/team_route_handles.py:27,496,510,538` dùng chung version ledger và publication. Phase 1 nay tách ledger v2 khỏi Recommended v1, kèm compatibility check.
- **High — publication pin:** `pipeline/site_localization.py:1499-1513,1658-1660`, `pipeline/build_recommended_reference.py:377-379` và `docs/season-team-data.md:190-193` chứng minh policy mới sinh successor nhưng publish không rebind ledger. Phase 2 sở hữu thứ tự publish → rebind → build; phase 1 chỉ khóa ledger/schema offline.
- **Medium — note-field cutover:** `tests-js/khaihoang-data.test.mjs:154-160` đòi field `displayNote` cũ. Phase 1 migrate assertion này; phase 2 kiểm consumer bảo toàn nội dung, không giữ alias hoặc chỉ kiểm field non-empty.

### Audit bổ sung và sửa theo yêu cầu — 2026-09-23

- **P2 — copy-link mất map:** full-URL snapshot ở `js/team-detail-navigation.js:189-221` không khớp `from` của card khác. Đã khóa context key riêng cho Khai hoang, persist trước khi rời root và precedence history/session/URL; thêm scenario hai card → copy/paste card khác → quay lại, cùng trường hợp tab mới thiếu snapshot.
- **P2 — gate phase phụ thuộc ngược:** `src/lib/root-static-artifacts.ts:162-169` từ chối entry manifest khi file chưa tồn tại. Đã chuyển page/entry/asset/publication/gate tích hợp sang phase 2; phase 1 chỉ cần gate offline thực chạy và evidence bảo toàn dữ liệu.
- Kết luận “không có mâu thuẫn” của sweep trước đã bị audit bổ sung thay thế; hai correction này là bản contract hiện hành.
- Kiểm lại sau sửa: `ak plan validate` trả `valid: true`; đọc cả 3 file, 8/8 link nội bộ tồn tại, A1–A7 có scenario tương ứng; không còn các chỉ dẫn cũ về exact-root snapshot Khai hoang hoặc page/entry nằm ở hai phase khác nhau.
- Mô phỏng riêng context-key contract đạt 8/8 ca: đổi active pair được nhận; đổi query/scenario/ruleset/tab bị loại; Đội Chuẩn/Đội Khác giữ full-URL matching. Đây là kiểm thiết kế trong bộ nhớ, chưa phải test implementation.
- Hai finding P2 đã được xử lý trong plan. Trạng thái implementation vẫn pending; chưa sửa code ứng dụng, chưa chạy build/E2E và chưa có xác nhận runtime cho feature mới.

## Handoff

Sau khi người dùng duyệt, chạy `/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260922-1806-khai-hoang-trang-chi-tiet/plan.md`.
Không tự bắt đầu code, commit hoặc deploy từ phiên lập plan này.

<!-- slug: khai-hoang-trang-chi-tiet -->
