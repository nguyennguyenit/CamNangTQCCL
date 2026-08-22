---
phase: 4
title: "Search match provenance (B4)"
status: completed
priority: P2
effort: "4h"
dependencies: [3]
---

# Phase 4: Search match provenance (B4)

## Overview

`snapshot-index.ts:105-122` index cả `nickname` và `source` cho team, nhưng item trả về chỉ có `displayName`. Agent search "Hoàng Quan Thương", nhận về `Vũ Tung Úc`, không nhận ra đó là kết quả đúng, rồi trả lời user "database không có team này". Bổ sung trường cho biết **vì sao khớp**.

## Requirements

**Functional**
- Mỗi item có `matchedTerm`: chuỗi trong record đã làm nên match.
- Với team có nickname và match qua nickname, `matchedTerm` là nickname đó.
- Match qua tên chính → `matchedTerm` bằng `displayName`.
- Query rỗng (duyệt corpus) → `matchedTerm` vắng mặt, không phải chuỗi rỗng.

**Non-functional**
- Không đổi thứ tự xếp hạng hiện có (`compareEntries`, `matchScore`).
- Không tăng đáng kể kích thước response — thêm 1 chuỗi ngắn mỗi item.

## Architecture

`matchScore` (`snapshot-index.ts:132-142`) duyệt `entry.normalizedTerms` và lấy `Math.max` của điểm, **mất dấu** term nào thắng. Cần trả về cả term thắng chứ không chỉ điểm.

`normalizedTerms` là dạng đã chuẩn hoá (bỏ dấu/lowercase). Trả nguyên văn chuẩn hoá sẽ khó đọc cho người dùng cuối. Hai lựa chọn:
- (a) lưu song song term gốc cùng term chuẩn hoá, trả bản gốc — dễ đọc, tốn thêm bộ nhớ index;
- (b) trả bản chuẩn hoá — rẻ, xấu.

Chọn **(a)**: mục đích của trường này là để agent và người đọc hiểu được, bản chuẩn hoá đánh mất đúng giá trị đó.

Đổi `SearchEntry.normalizedTerms: string[]` thành cấu trúc mang cặp `{ raw, normalized }`, `matchScore` trả `{ score, matchedTerm }`.

## Related Code Files

- Modify: `src/data/snapshot-index.ts` (75-142: `dictionaryEntries`, `teamEntries`, `matchScore`, type `SearchEntry`)
- Modify: `src/research/research-handlers.ts` (~370-380, chỗ dựng item)
- Modify: `src/research/research-contracts.ts` (521-560 `searchOutputSchema`)
- Modify: `test/data/snapshot-index.test.ts`
- Modify: `test/research/research-handlers.test.ts`

## Implementation Steps (TDD)

1. **RED** — `test/data/snapshot-index.test.ts`: `matchScore` trả term thắng; khi nhiều term cùng điểm cao nhất, chọn term xác định được (đề xuất: term đầu tiên theo thứ tự khai báo — khoá bằng test để không phụ thuộc thứ tự Map).
2. **GREEN** — đổi `SearchEntry` + `matchScore`.
3. **RED** — test handler với dữ liệu thật `data/teams.json`: query "Hoàng Quan Thương" → `canonicalId: "team:team-intro-2"`, `displayName: "Vũ Tung Úc"`, `matchedTerm: "Hoàng Quan Thương"`. Thêm case "Độ Giang Thương" → `team:team-intro-3` / `Vũ Tung Mông`.
4. **GREEN** — nối `matchedTerm` vào item + output schema.
5. **RED/GREEN** — query rỗng: `matchedTerm` vắng mặt.
6. **REFACTOR** — test khẳng định thứ tự kết quả không đổi so với trước (snapshot của một query đại diện).

## Success Criteria

- [x] "Hoàng Quan Thương" → `Vũ Tung Úc` kèm `matchedTerm` là nickname
- [x] "Độ Giang Thương" → `Vũ Tung Mông` kèm `matchedTerm` là nickname
- [x] Match qua tên chính → `matchedTerm === displayName`
- [x] Query rỗng → không có `matchedTerm`
- [x] Thứ tự xếp hạng không đổi

## Risk Assessment

**Đổi `SearchEntry` chạm cả hero/tactic/book**, không chỉ team (`dictionaryEntries` dùng `chinese`, `hanViet`, `aliases`). Tín hiệu: test của 3 kind kia đỏ. Phản ứng: giữ nguyên hành vi, chỉ thêm trường — không đổi thứ tự term trong `normalizedTerms`.

**Giả định có thể sai: agent sẽ dùng `matchedTerm` để tin kết quả.** Đây là thay đổi dữ liệu, không ép được hành vi model. Tín hiệu: sau khi deploy, agent vẫn nói "không tìm thấy" dù item có `matchedTerm`. Phản ứng: chuyển sang hạng mục C (sửa prompt agent `tra`) — không phải lỗi của MCP.

**Bộ nhớ index tăng** do giữ term gốc. Corpus 214 team + 3 dict, `teams.json` 574KB. Tín hiệu: `test/performance/domain-budget.test.ts` hoặc `worker-budget.workerd.test.ts` đỏ. Phản ứng: chỉ giữ term gốc cho `teams` (nơi cần), dict dùng bản chuẩn hoá.
