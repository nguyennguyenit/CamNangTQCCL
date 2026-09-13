---
phase: 4
title: "Kiểm chứng tích hợp và hoàn tất chuyển giao"
status: completed
priority: P1
effort: ""
dependencies: [phase-03-compact-browser]
---

# Phase 4 — Kiểm chứng tích hợp và hoàn tất chuyển giao

## Goal and fresh scout

Chứng minh cả 13 tiêu chí của [plan.md](plan.md) trên dữ liệu/surface thật, cùng lỗi nguồn và lịch sử trình duyệt. Đây không phải phase chỉ chạy lint rồi tuyên bố hoàn tất.

Trước cook: scout lại changed APIs/test contracts, current publication, scripts/package/config, docs hiện hành và artifacts đã tạo ở phase trước. Đọc evidence Red/Green từng phase; thiếu evidence thì chạy scenario tương ứng, không suy ra từ lời báo của worker. Không chạy lại kiểm tra chỉ để xác nhận lỗi người dùng đã báo.

## Files

Modify: `tests-e2e/team-detail-pages.spec.mjs`, `tests-e2e/recommended-browser.spec.mjs` cho integration gaps có thể gây bug; các test liên quan route/artifact chỉ khi thực tế phát hiện thiếu invariant. Root worktree xem [plan.md](plan.md).

Review regression, chỉ sửa khi contract hợp lệ thực sự đổi: `tests-e2e/season-lookup.spec.mjs`, `tests-e2e/spa-parity.spec.mjs`, `tests-e2e/mcp-domain-compatibility.spec.mjs`, `tests-e2e/khaihoang-options.spec.mjs`, existing Node/Python contracts. Không sửa expected để che regression ngoài scope.

Doc owner bổ sung sau smoke: `docs/season-team-data.md` cho lineage/displayNotes; `docs/deployment-guide.md` cho exact static detail/404 behavior. Không giữ lời mô tả root-only SPA fallback khi output đã có top-level 404.html.

Sau smoke mới cập nhật tài liệu hiện có phù hợp: `docs/design-guidelines.md`, `docs/code-standards.md`, `README.md`. Không có root CHANGELOG.md trong khảo sát này; không tạo chỉ vì template. Ghi route/filter/content/provenance contract, không viết README mới hoặc boilerplate docs. Evidence ở `reports/implementation-verification.md` dưới plan này được tạo khi cook, chưa tồn tại/không phải bằng chứng lúc lập plan.

## TDD integration gate

**Red** trước sửa integration bug, thêm một hành trình còn thiếu vào suite hiện có:

- **V1 — corpus-to-browser:** mở season có nhiều score → chọn score ngoài 8 + unit + faction → nhập tìm kiếm Việt → scroll → mở title → kiểm tra đúng nguồn/cấu hình/nội dung cũ nếu linked → reload → Quay lại → Back/Forward. Kết quả/chips/tab/season/scroll còn đúng, không bơm history entries.
- **V2 — original accessibility/admission:** đi direct original của duplicate/pending có notes/counters; đọc được cả alternatives; chọn season khác và quay Team khác không xuất hiện dòng bị loại. Mở admitted variant và fake variant trên cùng original URL cho hai trạng thái đúng.
- **V3 — integrity under failure:** chặn Recommended network, original vẫn đọc; stale HTML pin/new payload báo lỗi chứ không đổi generation/score; input nguồn có text/script và from URL độc hại không thực thi/đổi origin. Gameplay `?config` không bị reference redirect chiếm.

Nếu hành trình mới đã Green nhờ phase trước, ghi nhận là coverage/characterization; **không bịa Red và không sửa code chỉ để tạo Red**. Chọn integration bug thực tế/uncertain boundary để TDD, hoặc kết thúc phase bằng evidence không có source change. Không lặp test matrix parameter rows chỉ để tăng số lượng.

**Green:** sửa đúng owner source và test contract liên quan, không thêm retry/fallback/telemetry ngoài yêu cầu. **Refactor:** chỉ sau smoke đã pass, loại throwaway probes và obsolete reference-only code được cutover; không dọn unrelated user changes.

## Runtime/visual checklist

- Desktop 1440: bốn cột; tại 1280/1024/768 chuyển cột hợp lý, không chồng chữ. Mobile 320/375/390: một cột, search/season luôn thấy, Bộ lọc mặc định thu, facets/disclosure có thể mở/chọn bằng touch và keyboard.
- Light/dark; title dài nhiều dòng; hero badge SP/CO/40Y; CO Vô Song names; bond; tactics/books/short alternatives/counter chips không bị cắt. Không có caption scope/Tier/team-rating stars trên cards.
- OG có 98/105/113; một mùa đủ 36 score values; null và 0 tách biệt bằng fixture nếu corpus không có 0. Fixture không thay dữ liệu public để tạo demo.
- Dedicated Recommended, admitted legacy variant, original-only legacy, invalid variant/route; direct/reload/copy URL/native new tab; old URL migration; same-tab title/CTA equality.
- List history từ cả hai tab, season/category/q/chips/scroll; browser Back/Forward, nút Quay lại, storage unavailable, BFCache. Chip chiến pháp không mở trang đội. Unrelated hero modal/theme/menu/analyzer/roster/config/scenario/ruleset/khaihoang vẫn có hành vi cũ.
- Actual dev và built preview route smoke; không suy ra host headers từ dev server. Header policy chứng minh bằng built `_headers`/contract; production deploy chưa được ủy quyền.

## Final commands

Chỉ chạy project-wide validation một lần khi mọi writer hoàn tất; khi lỗi, sửa nguyên nhân rồi rerun phần fail và gate cần thiết. Commands từ feature worktree:

```sh
python3 -m unittest discover -s tests
npm run check
npm run build
npm run test:node
npm run verify
npm run test:e2e:astro
```

Kiểm tra node version theo package trước chạy. Full test:node đã gồm test:dist và cần dist vừa build; không lặp riêng test:dist trong final full gate. Playwright tự build/preview thêm, yêu cầu port 4174 trống; chỉ manual smoke tái sử dụng managed service đúng worktree trên port khác. Đo startup thực trước đổi timeout; startup/config lỗi không là TDD Red. Browser dùng tab riêng, không trỏ production để mutate. Không chạy implementation trong turn chỉ lập plan.

## Tasks and exit evidence

- [x] P4.1 Fresh scout và V1–V3 test-first/characterization trung thực.
- [x] P4.2 Chạy final gates và actual dev/build browser scenarios.
- [x] P4.3 Đối chiếu toàn bộ AC, lưu screenshots/result paths và regression evidence.

Sau khi smoke pass, thêm việc cập nhật docs/changelog và loại throwaway artifacts vào runtime tasks, thực hiện rồi mới đóng plan; không tạo cleanup phase trước bằng chứng.

Report cuối phải có: mỗi AC pass/fail và file/test/scenario chứng minh; lệnh thực sự chạy/exit status; dataset diff/ledger baseline; title/link review kết quả; screenshot paths; lỗi còn lại và nguyên nhân. Chỉ đánh dấu phase/plan completed khi đủ cả 13 AC và không còn regression/actionable gap. Không tự commit, push, sửa PR, merge hoặc deploy; bàn giao local changes cho người dùng quyết định.
