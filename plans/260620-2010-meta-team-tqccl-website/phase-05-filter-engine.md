---
phase: 5
title: Filter Engine
status: completed
effort: ''
---

# Phase 5: Filter Engine

## Overview
Bộ lọc client-side cho section **Team PK** (172 team): chip filter cho facet nhỏ (Sao, Loại binh, Status, Phe-khi-có), combobox autocomplete+count cho facet lớn (Tướng, Chiến pháp, Binh thư), search toàn văn. Logic = pure functions trong `filters.js`, test bằng `node:test` (0 deps). Cùng Tồn/Khai hoang chỉ cần search đơn giản (không filter phức tạp).

## Requirements
- Functional `filters.js` (pure): `applyFilters(teams, state) -> filtered`; AND giữa nhóm, OR trong nhóm. State: `{stars:Set, unitTypes:Set, statuses:Set, factions:Set, heroes:Set, tactics:Set, books:Set, query:string}`.
- Matching tướng/CP/binh thư khớp cả `name` LẪN `alternatives` (nếu chỉ name sẽ MISS vế sau `/`). Search toàn văn quét tên tướng/CP/binh thư/counter/notes; bỏ dấu tiếng Việt (`normalize('NFD')` strip combining), không phân biệt hoa thường.
- Facets: ĐỌC `data/facets.json` (sinh tĩnh ở P4 — audit J), KHÔNG tính runtime. Dựng combobox value+count.
- UI (`app.js`): chip toggle; combobox gõ-lọc hiện top match kèm count; counter chip bấm → set query; nút "Xóa lọc"; `#stats` = số kết quả; empty state.
- Phe: nhiều team faction=null → chip Phe chỉ liệt kê giá trị thực có; team null không khớp filter phe (ẩn khi lọc phe). Ghi rõ trong UI.
- Non-functional: lọc < 30ms; mobile = filter drawer; URL hash đồng bộ state — OPTIONAL nếu rẻ.

## Architecture
`filters.js` ES module export pure fns → import cả browser (app.js) lẫn node test. Combobox tự viết (input + list lọc) — KHÔNG thư viện (KISS). Filter chỉ áp cho Team PK; section khác bỏ qua.

## Related Code Files
- Create: `js/filters.js`, `tests-js/filters.test.mjs`
- Modify: `js/app.js` (wire UI + state), `index.html` (#filters markup), `css/styles.css` (chip/combobox/drawer)
- Depends: Phase 4

## Implementation Steps (TDD)
1. **RED**: `filters.test.mjs` (node:test) fixture 3-4 team: AND giữa nhóm (Sao 5 + Loại binh Thương); OR trong nhóm; **khớp alternatives** (lọc CP="Vạn Quân Đoạt Sư" bắt team chỉ có ở vế alt); search bỏ dấu; rỗng state→trả hết; empty-state.
2. **GREEN**: viết `filters.js` (`applyFilters`, `normalizeText`).
3. UI: chip nhóm nhỏ; combobox autocomplete 3 facet lớn (count, ẩn long-tail sau N); search box; clear; drawer mobile.
4. Counter chip → set query + scroll top. Empty state khi 0 kết quả.
5. (Optional) sync `location.hash`. Verify thủ công combo lọc trên browser.

## Success Criteria
- [ ] `node --test tests-js/` PASS: AND/OR, khớp alternatives, search bỏ dấu, empty-state.
- [ ] Browser: lọc Sao+Loại binh+Tướng kết hợp đúng; combobox CP gõ ra match+count; bấm counter chip lọc đúng; "Xóa lọc" reset; `#stats` cập nhật.
- [ ] Mobile filter drawer mở/đóng; lọc CP có alternatives không bỏ sót.

## Risk Assessment
- 179 CP dropdown phẳng vô dụng → BẮT BUỘC autocomplete+count.
- Bỏ dấu tiếng Việt: `String.normalize('NFD')` strip; test 1 ca có dấu.
- Khớp alternatives dễ quên → test riêng (bước 1).
- Facet count phải khớp data → đọc từ facets.json (1 nguồn), không tính lại.
