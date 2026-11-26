---
title: "Dựng sẵn khung bộ lọc của Đội chuẩn / Đội khác"
description: "Build phát sẵn cả khung tương tác (ô chọn mùa, thanh công cụ, sidebar lọc có chip đã đếm) quanh danh sách dựng sẵn, để bộ lọc hiện cùng lúc với danh sách và hết nhảy bố cục khi JS boot."
status: completed
priority: P2
effort: 14h
branch: feat/ssr-khung-bo-loc
tags: [frontend, ssr, refactor, tech-debt]
blockedBy: []
blocks: []
created: 2026-11-26
---

# Dựng sẵn khung bộ lọc của Đội chuẩn / Đội khác

## Overview

Build phát sẵn cả khung tương tác (ô chọn mùa, thanh công cụ, sidebar lọc có chip đã đếm) quanh danh sách dựng sẵn, để bộ lọc hiện cùng lúc với danh sách và hết nhảy bố cục khi JS boot.

**Nguyên nhân:** `recommendedSectionTrees` (`src/lib/team-section-ssr.js:51-71`) chỉ phát `header.reference-head` và `.reference-view`. Toàn bộ phần còn lại do `createRecommendedSection` (`js/team-filter-section.js:269-369`) dựng bằng `el()`, sau khi `js/app.js` chờ xong `loadWebsiteDisplay`, mô hình mùa và `loadRecommended()` (`js/app.js:178-257`). Phần đó gồm `.reference-browser`, thanh công cụ, `aside.reference-filters` và ô chọn mùa.

Hệ quả trên desktop: danh sách bị đẩy ngang 308px (cột 272px cộng gap 36px, `css/styles.css:3925-3931`) và bị đẩy xuống một hàng thanh công cụ. Nợ này đã được ghi ở `plans/261015-1658-seo-ai-render-san/reports/phase-02.md:46,72`.

**Hướng làm** (Phương án 1, Fable khuyến nghị, anh đã chốt):
- Tách khung thành **một** bộ hàm cây thuần, dùng chung cho build và trình duyệt.
- Build phát khung ở trạng thái mặc định, khoá mọi điều khiển của khung.
- Client giữ nguyên các node khung tại chỗ và chỉ thay **con** của ô chọn mùa, thanh công cụ và sidebar.
- `.reference-view` vẫn được nhận lại theo chữ ký như hiện nay.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Tách khung thành cây dùng chung (không đổi hành vi)](./phase-01-tach-khung-thanh-cay-dung-chung.md) | Completed |
| 2 | [Phát khung từ build](./phase-02-phat-khung-tu-build.md) | Completed |
| 3 | [Khoá bằng test, verifier và cập nhật docs](./phase-03-khoa-bang-test-va-verifier.md) | Completed |

## Non-goals (đã tách issue)

- #180: `index.json` 4,36 MB chặn tương tác trên cả hai trang.
- #181: thanh gợi ý kho hiện muộn, đẩy danh sách Đội chuẩn xuống, cả khi là khách lẫn khi máy có kho (thay đổi phạm vi, review PR #184). Phase 3 đo đúng độ lệch này, không giấu nó.
- #182: `modulepreload` cho đồ thị module của `app.js`.
- Không đổi `referenceViewSignature` và luật nhận lại `.reference-view`.

## Success Criteria

- [x] Khung bao của thẻ đội đầu tiên trước và sau boot, đo ở 1440px và 390px, vi/zh/ja:
  - `/doi-khac/`: lệch ≤1px.
  - `/doi-chuan/`: lệch ≤1px, **trừ** phần lệch dọc đúng bằng chiều cao thanh kho cộng gap (#181), cả khi là khách lẫn khi máy có kho.
  - **Thay đổi phạm vi (review PR #184, anh chốt): máy có kho cũng thuộc #181.** Bản đầu của tiêu chí chỉ loại trừ trường hợp khách và đòi máy có kho lệch ≤1px ở mọi trục; thanh kho của máy có kho hiện sau khi kho và từ điển tải xong nên không đạt được trong phạm vi plan này. Spec vẫn khẳng định đúng chiều cao thanh + gap (±1px) và không giấu thanh; mọi dung sai khác giữ nguyên.
- [x] `.reference-head` và `.reference-results` dựng sẵn bằng bản sau boot ở trạng thái mặc định, sau khi bỏ `disabled`/`aria-disabled`, con của danh sách và thanh kho.
- [x] Mọi `button`/`input`/`select` của khung dựng sẵn bị khoá trước boot và dùng được sau boot. HTML Khai hoang không đổi.
- [x] URL có `?faction=`, `?season=` hoặc kiểu hiển thị đã lưu: trước boot không thấy chip, số đếm, nút kiểu hiển thị, mùa hay badge "Đang diễn ra" sai.
- [x] Không JS, hoặc dữ liệu/boot lỗi: không thấy điều khiển chết. Danh sách vẫn đọc được. Nhãn mùa tĩnh của Đội khác vẫn hiện.
- [x] Tab vào thẻ trước boot thì sau boot focus vẫn ở đó. Quay lại trên mobile khi panel lọc đang mở thì danh sách không bị đẩy.
- [x] Xanh: `npm run test:node`, `npm run test:dist`, `npm run verify` (sau `npm run build`), các spec e2e trong gate của phase 3.

## Rủi ro chính

| Rủi ro | Giảm thiểu |
|---|---|
| Hai định nghĩa khung (SSR và client) lệch nhau | Một bộ cây trong `js/reference-shell-tree.js`. So DOM trước và sau boot trong spec layout-shift. |
| Khác ngữ nghĩa giữa `el()` và `t()` (boolean, con là object) | Truyền `aria-*` dạng chuỗi. `chipText` trả `String`. `sourceLabel` dùng `Object.hasOwn`. |
| Delegation bắt nhầm chip kho hoặc bỏ sót ô chọn mùa | Gốc sự kiện ghi rõ ở phase 1. Giá trị chip đối chiếu với state, không đọc từ DOM. |
| Thứ tự chip khi hoà số đếm khác nhau giữa Node (build) và trình duyệt | `Intl.Collator` theo locale của trang, khoá cuối là mã thô. Có test Node chạy với `LANG` khác nhau. |
| Lỗi boot để lại khung bị khoá | `data-ssr-failed` ẩn khung (dùng chung luật với `scripting: none`). Phần còn lại: `app.js` không tải được, anh đã chấp nhận. |

## Review

Không thuộc nhóm rủi ro cao của AGENTS.md (không schema, worker, pipeline hay generation). Sau khi cook xong, đề xuất Astra review PR.

## Red Team Review

### Session — 2026-11-26
**Findings:** 16 sau gộp trùng, từ 27 phát hiện của 3 reviewer (16 accepted, 0 rejected)
**Severity breakdown:** 0 Critical, 7 High, 9 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Boot/dữ liệu lỗi để lại khung bị khoá vĩnh viễn | High | Accept (modified: không thêm hẹn giờ) | Phase 2 |
| 2 | Delegation trên `results` không bắt được ô chọn mùa ở header | High | Accept | Phase 1 |
| 3 | Delegation `.fchip` bắt nhầm chip kho, ghi `?undefined=` | High | Accept | Phase 1 |
| 4 | ≤1px không đạt trên Đội chuẩn do thanh kho (chắc chắn, không chập chờn) | High | Accept (anh chốt loại trừ, đo đúng chiều cao) | Plan, Phase 3 |
| 5 | `?source=__proto__` làm `t()` crash | High | Accept | Phase 1 |
| 6 | Test cũ ghim hợp đồng cũ: `team-ssr-adopt.spec:72-80`, `team-section-ssr.test:115-126` | High | Accept | Phase 2 |
| 7 | Khoá "mọi điều khiển" qua `inertUntilBound` sẽ lan sang Khai hoang | High | Accept | Phase 2 |
| 8 | Snapshot phase 1 mâu thuẫn với thuộc tính mới, phụ thuộc dữ liệu và OS | Medium | Accept (oracle tạm, dùng `data-focus-key`) | Phase 1 |
| 9 | Thiếu cờ `hidden` cho notice/more/empty (lệch 12px) | Medium | Accept | Phase 1, 2 |
| 10 | Stale không ẩn badge "Đang diễn ra" | Medium | Accept | Phase 2 |
| 11 | `scripting: none` ẩn mất nhãn mùa tĩnh của Đội khác | Medium | Accept | Phase 2 |
| 12 | Chuyển node làm mất focus; quay lại trên mobile đẩy danh sách | Medium | Accept | Phase 2 |
| 13 | Test pixel chờ font và CSS chưa đủ | Medium | Accept | Phase 3 |
| 14 | Mở rộng parity thực ra so client với client | Medium | Accept | Phase 3 |
| 15 | Nhiều e2e qua được nhờ node dựng sẵn bị khoá | Medium | Accept (`gotoBooted`) | Phase 2 |
| 16 | `localeCompare` lệch giữa Node và Chromium; tier không truyền locale | Medium | Accept | Phase 1 |

Sửa dữ kiện: `SectionPage.astro:94` → `:108`. `recommended-browser.spec.mjs:794` là test độ tương phản, không phải test bàn phím. Câu cần sửa trong docs nằm ở `docs/system-architecture.md:114`.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03
- Decision deltas checked: 7. Gồm: gốc sự kiện; `data-focus-key` thay cho `data-facet-*`; nhận lại khung tại chỗ thay cho `replaceChildren`; khoá khung tách khỏi `inertUntilBound`; `data-ssr-failed`; tiêu chí thanh kho; parity so trước và sau boot.
- Reconciled stale references: 6. Gồm: bỏ `data-facet-*`, bỏ snapshot commit, bỏ ẩn `.reference-season-field` chung, bỏ so `.reference-browser` trong parity, bỏ "ẩn roster trong test", sửa dòng 794.
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-11-26
Câu hỏi và quyết định (hỏi cùng lượt duyệt red-team):

1. **Áp các phát hiện red-team?** Áp tất cả.
2. **Thanh kho (#181) làm thẻ Đội chuẩn nhảy với mọi khách.** Giữ #181 riêng. Tiêu chí ghi "trừ thanh kho"; test khẳng định độ lệch đúng bằng chiều cao thanh kho cộng gap.
3. **`app.js` không tải được.** Chấp nhận điều khiển bị khoá, theo quy ước hiện có. Không thêm cờ hẹn giờ.

### Verification Results
- **Tier:** Standard (Fact Checker + Contract Verifier, do 3 reviewer thực hiện, main agent kiểm lại bằng chứng)
- **Claims checked:** 89 (31 + 27 + 31)
- **Verified:** 79 | **Failed:** 7, đã sửa trong plan | **Unverified:** 3, trong đó ngân sách 10 KB đo ở phase 2
- Hiện còn **Failed: 0** sau khi áp.

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01, phase-02, phase-03
- Decision deltas checked: 3
- Reconciled stale references: 1 (Success Criteria của Đội chuẩn)
- Unresolved contradictions: 0

## Review PR #184 (Astra)

### Session — 2026-11-27
**Findings:** 4 (đã xác minh, đã sửa)

| # | Finding | Disposition | Applied To |
|---|---------|-------------|------------|
| 1 | Script chống nháy đứng sau cả thân dựng sẵn: HTML về dần thì khung/ô chọn mùa ở trạng thái mặc định hiện sai mùa/bộ lọc tới khi cả danh sách về | Sửa: script là con đầu của mount (`SectionPage.astro`), dùng chung cho cả bốn mục; verifier khóa vị trí; e2e phát HTML hai đoạn, cắt trước danh sách | Phase 2 |
| 2 | Quay lại mobile với `?kho=`/`?xep=` vẫn dịch danh sách: script bỏ qua hai khóa, `restoreReturnState` hoãn cả việc mở panel | Sửa: panel mở ngay (script và client), chỉ thẻ đích/focus/cuộn chờ kho; e2e 390px cho `?kho=`, `?xep=` và máy có kho khi kho tới muộn | Phase 2 |
| 3 | Tiêu chí layout-shift: máy có kho không đạt ≤1px (thanh kho hiện sau khi kho tải xong) | **Thay đổi phạm vi (review PR #184, anh chốt): máy có kho cũng thuộc #181.** Spec giữ phép trừ cho cả hai trường hợp, đặt tên rõ; Success Criteria và phase 3 ghi lại | Plan, Phase 3 |
| 4 | Xung đột với `main` (`772ad109`) | Gộp, giữ cả hai ý ở nguồn; file sinh ra lấy bản của main làm gốc rồi re-pin/publish lại | Changelog |
