---
title: "Team chuẩn / Team khác: thẻ compact và trang chi tiết"
description: "Khôi phục nhịp duyệt đội tqccl.com cũ, dùng điểm nguồn và URL chi tiết riêng, bảo toàn nội dung legacy và bất biến xét trùng."
status: completed
priority: P1
effort: ""
branch: feat/season-team-lookup
tags: [feature, frontend, data, tdd]
blockedBy: []
blocks: []
created: 2026-09-13
---

# Team chuẩn / Team khác — Deep plan, TDD

## Outcome and authority

Giữ sự quen thuộc của tqccl.com cũ: thẻ gọn nhưng đầy đủ, bộ lọc chip và mobile thu gọn. Thay rating sao bằng điểm nguồn, dịch tên đội, chuyển phần chi tiết sang URL riêng, không làm mất hướng dẫn/khắc chế của dữ liệu cũ.

- Input được người dùng chỉ định: [brainstorm-260912-team-chuan-team-khac.md](../reports/brainstorm-260912-team-chuan-team-khac.md), đặc biệt 13 acceptance criteria. Brainstorm là product contract; plan cụ thể hóa cách triển khai, không giảm phạm vi.
- Worktree duy nhất: `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`.
- Branch: `feat/season-team-lookup`; không sửa main checkout `/Users/plateau/Project/CamNangTQCCL` hoặc làm mất local changes đang có.
- Đây là plan mới, không viết đè plan season-team-lookup cũ đã thực hiện. Folder dùng timestamp UTC của CLI; metadata dùng ngày local 2026-09-13.
- Chế độ: `--deep --tdd`, Markdown, chưa được ủy quyền implementation/commit/push/merge/deploy. Không tạo HTML/wiki hoặc hệ quản lý mới.

## Decided architecture

1. **Data trước UI:** reuse translation-reviewed map cho team titles; giữ raw/identity/score, thêm display-only note ownership để không render lặp paragraph. Enrich admitted rows bằng nội dung original; chỉ gắn hướng dẫn legacy vào Recommended với exact reviewed linkage + fingerprints và ledger/publication/raw snapshot đồng nhất. Không coi dedup equality là full-build equality.
2. **Static dedicated detail:** `/teams/recommended/<sourceConfigId>/`, `/teams/legacy/<legacyTeamId>/`, admitted variant dùng query `variant` trên đúng original. Build catalog từ validated snapshot, thêm top-level 404.html; unknown IDs không trở thành arbitrary path hoặc root SPA fallback. Tất cả originals có route, không đồng nghĩa được admit vào Team khác.
3. **Minimal detail entry:** shared Astro shell/chrome, reuse DOM renderers, không nạp toàn bộ `app.js`/gameplay datasets trên trang con. Original page pin raw `/data/teams.json` độc lập để Recommended outage không khóa nội dung gốc.
4. **Native links + state:** title/CTA href giống nhau; same-tab mặc định, modifier/middle click native. Safe `from` root URL + matching history/session snapshot giữ filter/tab/scroll. Old reference URLs redirect bằng replace; gameplay `?config` precedence giữ nguyên.
5. **Old UI rhythm, new score facet:** Loại binh → Điểm → Phe; category/subcategory/source vẫn truy cập. Exact numeric chips + “Chưa có điểm nguồn”, OR-within/AND-between; không chuyển sao/Tier thành điểm. Có 36 score values trong một mùa: group cho xem 8 giá trị đầu + mọi giá trị đang chọn, mở hết theo yêu cầu; không cắt bỏ lựa chọn. Card giữ unit/faction badges và counter-chip search.
6. **Four columns where readable:** 1440 desktop 4 cột, narrower 3/2, mobile 1; search + season select luôn thấy, Bộ lọc mobile thu gọn. Không duplicate filter implementation hoặc bỏ nội dung card để ép compact.

## Scope invariants

Team chuẩn có toàn bộ corpus Recommended theo mùa/category đã thu thập. Team khác chỉ admitted originals không trùng **toàn bộ corpus**, không chỉ mùa đang chọn. Giữ unknown/empty/uncollected distinctions; dữ liệu pending không được quay lại vì filter hoặc deep link.

Numeric value thuộc exact source config; null không phải 0, >100 hợp lệ, không bịa score từ stars/nickname hoặc suy ra VN eligibility. Giữ source order/comparator hiện có; bỏ Tier UI không có nghĩa viết thuật toán ranking mới.

Giữ tất cả tên/badge đã duyệt, CO Vô Song Đại Kiều/Tiểu Kiều/Tinh Thái, `桃園結義` → Kết Nghĩa Vườn Đào là bond. `戮力上心` chưa xác thực, không alias với `勠力同心`. Team-name translation không thay identity. Không crawler redesign, admin/account/upload, language switcher, English dictionary, gameplay/ruleset/analyzer/roster/MCP/khaihoang rewrite.

Bỏ caption scope trên card ở mọi mùa/category, không thay caption rút gọn. Metadata/filter notice/detail attribution vẫn còn. Bỏ sao/Tier của team browser, không xóa hero rarity stars hoặc gameplay Tier ngoài scope.

## Phase sequence

Tất cả bốn phase đã hoàn tất theo thứ tự phụ thuộc. Dữ liệu/state/render modules dùng ownership tuần tự; research/review độc lập chỉ chạy song song khi không cùng file. Bằng chứng implementation và giới hạn còn lại nằm trong [reports/implementation-verification.md](reports/implementation-verification.md).

1. [Phase 1 — Data contract](phase-01-data-contract.md): title translations, full legacy content, reviewed linkage/hashes. Red D1–D6 → Green publication → corpus proof. Không dependency.
2. [Phase 2 — Detail pages](phase-02-detail-pages.md): safe static route catalog/404, isolated loaders, detail content, actual native title/CTA anchors, history, artifact/header policy. Red R1–R7 → Green direct/reload/navigation. Depends on phase 1.
3. [Phase 3 — Compact browser](phase-03-compact-browser.md): exact-score chips/search/season, full compact cards và responsive presentation trên links đã hoạt động. Red B1–B6 → Green + visual check. Depends on phase 2.
4. [Phase 4 — Verification](phase-04-verification.md): end-to-end V1–V3, integrity/outage/regression checks, actual dev/build browser proof và docs sau smoke. Depends on phase 3.

`--deep`: phase 1 đã có input/schema/tests cụ thể; mỗi phase 2–4 có fresh scoped scout gate ngay trước cook vì output phase trước thay source. Đây không phải placeholder: goal, files, contracts, test commands và exit criteria đều đã chốt.

## Acceptance — 13 items, no sampling

- [x] **AC01 — Tab/data:** Team chuẩn/Team khác đúng source/admission và mọi tab khác giữ hành vi; P1 D3/D6, P2 R6, P4 V2/V3.
- [x] **AC02 — Desktop:** 1440 hiển thị 4 cột đọc được, 3/2 ở narrower hợp lý; P3 B6, P4 actual screenshots.
- [x] **AC03 — Mobile/filter:** một cột, Bộ lọc thu gọn, search/season luôn thấy; P3 B3/B6, P4 320/375/390 touch/keyboard.
- [x] **AC04 — Season/states:** click-only season, không “Tìm mùa”; empty/uncollected/no-match phân biệt và không lọc mất source; P1 D6, P3 B3.
- [x] **AC05 — Point chips:** thay star filter, exact values và unknown, counts/colors/OR/AND, không mất category/source, 36-value disclosure; P3 B1/B5.
- [x] **AC06 — Score/labels:** numeric góc phải, missing khác 0, không Tier/team-star/group heading/caption scope; P1 D6, P3 B4/B6.
- [x] **AC07 — Complete cards:** title dài đọc được, unit/faction labels, 3 hero/tactics/books/alternatives/counter-chip search/badges còn, không compact bằng xóa nội dung; P3 B2/B4/B6, P4 screenshots.
- [x] **AC08 — Vietnamese/bond:** tên đội được rà soát dịch, giữ raw/source IDs và approved glossary/badges/bond; P1 D1/D2, P3 B2/B4.
- [x] **AC09 — Detail URL/links:** title+Xem chi tiết cùng dedicated href, same-tab và native new-tab/direct/reload/share, không reference inline; P2 R1/R4, P3 B4.
- [x] **AC10 — History:** tab/season/category/q/chips/scroll giữ qua Back/Forward/Quay lại, chip chiến pháp không mở trang đội, old-link compatibility không phá ?config; P2 R4/R5, P3 B4, P4 V1/V3.
- [x] **AC11 — Legacy content:** notes/counters good/avoid+diễn giải, cộng điểm/điều kiện, hero stats/notes, tactics/books/hero/config alternatives, source vẫn đọc được đúng liên kết, không lặp ghi chú; P1 D3/D4, P2 R3/R6, P4 V2.
- [x] **AC12 — Preservation/dedup:** full originals retrievable, không admit duplicate/pending hoặc đổi score/mapping/source semantics; P1 D1/D3–D6, P2 R1/R6/R7, P4 V2/V3.
- [x] **AC13 — Actual verification:** Red/Green hợp lệ + responsive/theme/long-content visual checks + static direct links/history/outage trên actual app; P2 smoke, P3 visual gate, P4 toàn bộ report.

## Evidence and review

Source facts, verification tier và 10 evidence claims mỗi phase: [reports/source-evidence.md](reports/source-evidence.md).

Review gate: 3 independent read-only reviewers gồm Security+Fact Checker, Assumption+Contract Verifier, Failure Modes+Scope. Mỗi reviewer đọc actual worktree và plan, bỏ qua build/lint/tests khi planning; parent xử lý finding có bằng chứng, không tự đổi product contract. Kết quả và validation command outputs nằm ở [reports/plan-review.md](reports/plan-review.md) sau review.

Full paths và hiện trạng existing/proposed: [reports/file-inventory.md](reports/file-inventory.md).

Các tuyên bố planning ban đầu không được dùng làm bằng chứng implementation; kết quả thực thi hiện tại được ghi riêng trong implementation verification report.

## Execution and handoff

Các task P1.1–P4.3 trong phase files là durable execution checklist và đã được đồng bộ hoàn tất bằng `ak plan`; root acceptance AC01–AC13 đều có bằng chứng trong report.

Sau plan review/validation, pin bằng `ak plan use` trong feature worktree; pointer worktree-private, không thay git worktree. CLI validate chỉ kiểm tra format, không chứng minh tính đúng của kiến trúc hoặc code.

Hoàn tất local bằng `nlt-cook --auto --advice --tdd`. Không commit, push, PR, merge hoặc deploy. Bàn giao gồm source/test/docs đã cập nhật, báo cáo kiểm chứng và screenshots; production-host và BFCache limitations được nêu rõ trong report.
