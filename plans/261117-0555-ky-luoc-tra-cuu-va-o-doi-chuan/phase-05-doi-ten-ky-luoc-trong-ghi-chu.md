---
phase: 5
title: "Đổi tên kỳ lược trong ghi chú đội (#119)"
status: pending
priority: P1
effort: "4h"
dependencies: [1]
---

# Phase 5: Đổi tên kỳ lược trong ghi chú đội (#119)

## Goal
Bản dịch tiếng Việt của ghi chú đội dùng tên client cho thẻ và phương lược kỳ lược. Chữ Hán gốc (`textRaw`) không đổi. Phase này phát hành chung PR với Phase 2–4 (Validation Session 1).

## Context
- Bản dịch nằm ở `pipeline/site-translations.json`. Receipt review nằm ở `pipeline/site-translation-reviews.json` và `pipeline/localization-reviews/`.
- Hàm liên quan: `recommended_note_inputs` (`pipeline/site_localization.py:1548`), `validate_review_receipts` (l.1631).
- Tên cũ sang tên client: lấy cột "Repo hiện dùng" và "Client" trong `plans/reports/261117-client-ky-luoc-pk-s27.md`. Phương lược: Chỉnh Quân → Toàn quân, Mưu Toán → Mưu tính, Tập Nhiễu → Quấy nhiễu, Chiến Đấu Trường Kỳ → Chiến đấu lâu dài.
- Có tên trùng nhóm khác: 十面埋伏/Thập Diện Mai Phục và 摧鋒斷刃 là chiến pháp, "Chiến Đấu Trường Kỳ" và "Cửu Chiến" là binh thư. <!-- Red-team F11 -->

## Thiết kế
- Chỉ thay tên trong **ngữ cảnh kỳ lược**: câu hoặc đoạn mà `textRaw` tương ứng chứa `奇略`, `奇謀`, `作戰方略` hoặc nhãn phương lược kèm `→`. Câu nói về chiến pháp hay binh thư thì giữ nguyên.
- Viết một script một lần (không thêm vào pipeline): đề xuất thay thế và in diff theo từng entry. Người review duyệt rồi mới ghi `site-translations.json` và receipt mới.

## Tests Before
- Test: không entry nào có ngữ cảnh kỳ lược còn chứa tên Hán-Việt cũ trong `aliasesVi` cũ (bảng từ Phase 1).
- Test: các entry nhắc chiến pháp Thập Diện Mai Phục và binh thư Chiến Đấu Trường Kỳ/Cửu Chiến không đổi.

## Tasks & Steps
1. Viết test, xác nhận chúng fail.
2. Chạy script đề xuất, review diff, áp vào bản dịch, ghi receipt.
3. `python3 -m pipeline.site_localization check --root . --stage all` trên candidate scratch.

## Todo
- [ ] Test trước fail
- [ ] Script đề xuất và diff
- [ ] Review và receipt
- [ ] Check localization qua

## Success Criteria
Trên cùng một trang đội, ô kỳ lược và chữ ghi chú dùng một bộ tên client. Không câu chiến pháp hay binh thư nào bị đổi nhầm. #119 đóng theo PR.
