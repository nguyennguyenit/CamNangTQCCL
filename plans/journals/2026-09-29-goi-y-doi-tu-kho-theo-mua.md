---
title: "Gợi ý đội từ kho theo mùa, mục Thiếu món, Vì sao?"
date: 2026-09-29
summary: "/goi-y-doi-tu-kho/ gợi ý từ Đội chuẩn của mùa, đội cũ chỉ lấp chỗ trống; Thiếu món với món bù từ dữ liệu; Worker mode explainSubstitute"
---

# Gợi ý đội từ kho theo mùa, mục Thiếu món, Vì sao?

## What happened
- Advise → cook (`plans/260929-0415-goi-y-doi-theo-mua/`). Việc bị chặn tới khi phiên song song commit (`b80e5ff`) vì trùng đúng các file cần sửa.
- `js/roster-season-candidates.js` ánh xạ `index.json` của mùa sang dạng `teams.json`: tra tên gốc chữ Hán qua `chinese`/`aliases` của từ điển Tra cứu (98,6%), không qua `displayNameVi` (lệch chính tả kiểu "Hoàng Phổ Tung"/"Hoàng Phủ Tung"). Engine gần như giữ nguyên: thêm `seedEntries` và `missingTacticSlots`.
- Món bù = chiến pháp tướng đó mang ở cấu hình khác cùng mùa; `alternativeHoldersRaw` chỉ có ở 5/1366 cấu hình nên vô dụng. Món bù đã chọn vào engine như `alternatives` của đúng ô.
- Review độc lập bắt 3 lỗi P2: món bù được gợi ý lại cho ô thứ hai của cùng đội (đội biến mất vì `move-tactic`), đội có món bù nhưng trùng tướng với đội xếp trên thì mất đường gỡ, và trần 20 giữ bản cũ nhất làm lần chọn mới bị nuốt. Kèm P3: race khi bấm Gợi ý trước lúc tải xong mùa, focus mất sau thao tác, "Xóa toàn bộ kho" xoá luôn mùa.

## Decision
- Bỏ 2 obligation `translate` không còn nguồn cùng ledger entry và receipt item (outputs reviewer giữ nguyên, receipt chỉ claim location còn active); chữ mới là `authored-vi` nên không cần receipt.
- Mỗi lần sửa JS nằm trong `sourceFiles` là một lần publish lại + re-pin route handles; gom sửa trước khi publish để khỏi sinh generation thừa (lần này ra 4 generation trung gian, đều đã xoá).
- Dev server giữ pin publication trong bộ nhớ: phải restart sau publish, không thì trang báo "Dữ liệu hiển thị không khớp mã kiểm tra".

## Next steps
- Deploy Worker (`cd worker && npm test && npm run deploy`) trước Pages để nút "Vì sao?" có mode `explainSubstitute`.
- `node scripts/design-tokens.mjs --check` còn 5 lỗi giá trị thô ở `.detail-*`, `.lookup-tactic-*`, `.kh-jump-count` (không thuộc việc này).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
