---
title: "Đội chuẩn: badge kho trên danh sách (#62, kèm #59)"
description: "Danh sách Đội chuẩn hiện Ráp được / Thiếu N món theo kho, có tóm tắt, sắp dễ ráp nhất và lọc theo kho."
status: pending
priority: P1
effort: "2d"
issue: 62
branch: feat/doi-chuan-badge-kho
tags: [feature, frontend]
blockedBy: []
blocks: []
created: 2026-11-11
---

# Đội chuẩn: badge kho trên danh sách (#62, kèm #59)

## Overview

Danh sách Đội chuẩn hiện "Ráp được" hoặc "Thiếu N món" theo kho của người chơi, kèm dòng tóm tắt đầu trang, kiểu sắp "dễ ráp nhất" và bộ lọc theo kho. Bản sửa #59 (chữ "null" ở Độ phủ kho) đã nằm trên nhánh này (commit `f48697d`); hash nguồn được ghim lại và generation publish đúng một lần ở phase cuối.

## Scope Challenge

- Existing code: `js/roster-coverage.js` (độ phủ theo bậc), `buildSeasonCandidates` trong `js/roster-season-candidates.js` (đội ứng viên từ `index.records`, `id = sourceConfigId`), `toScanState` và `CLOUD_STORAGE_KEY` trong `js/roster-cloud-store.js`, thẻ đội đã có `data-source-config-id`.
- Requested scope: toàn bộ tiêu chí của #62, giao đủ, không cắt.
- Complexity: 1 module mới, khoảng 6 file sửa, 5 phase vì phase cuối là thủ tục publish generation bắt buộc.
- Selected mode: HOLD SCOPE.

## Quyết định thiết kế

| # | Quyết định | Lý do |
|---|---|---|
| 1 | Module mới `js/roster-list-coverage.js` chỉ có hàm thuần và đọc storage, không có chữ UI | Tách khỏi các file bị ghim hash; dễ test node |
| 2 | Kho đọc từ máy, không gọi mạng: cache cloud hộp `main` nếu có, không thì kho local | Trang danh sách không cần phiên đăng nhập; kho cloud đã được Gợi ý đội lưu sẵn |
| 3 | Chỉ nạp `heroes-dict` và `tactics` (khoảng 1,4 MB) khi máy có kho | Khách chưa có kho không tốn thêm request |
| 4 | Tham số mới `kho=rap-duoc|thieu-2` và `xep=de-rap`; không dùng `sort` | `sort` nằm trong `RETIRED` của `recommended-reference-state.js`, bị gỡ khỏi URL |
| 5 | "Dễ ráp nhất" sắp trong từng bậc, giữ nhóm theo bậc | Danh sách hiện chia khối theo bậc; cần anh xác nhận (xem Câu hỏi mở) |
| 6 | Badge là tham số tùy chọn của cây view; không có kho thì cây y nguyên | HTML tĩnh và các test SSR parity không đổi |
| 7 | Đội ngoài hạng mục Giao chiến hoặc chưa đối chiếu được tướng: không có badge | Cùng luật với khối Độ phủ kho, để hai con số khớp nhau |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Xác nhận hợp đồng và chạy test nền](./phase-01-start.md) | Pending |
| 2 | [roster-coverage trả số món thiếu từng đội](./phase-02-roster-coverage-so-mon-thieu.md) | Pending |
| 3 | [Đọc kho và tính độ phủ cho danh sách](./phase-03-doc-kho-va-tinh-do-phu-tren-danh-sach.md) | Pending |
| 4 | [Badge, tóm tắt, sắp xếp và lọc](./phase-04-badge-tom-tat-sap-xep-loc.md) | Pending |
| 5 | [Ghim hash, publish generation, docs và PR](./phase-05-ghim-hash-publish-generation-va-pr.md) | Pending |

## Success Criteria

- [ ] Số "Ráp được" trên `/doi-chuan/` bằng tổng "Ráp đủ" của khối Độ phủ kho cho cùng mùa và cùng kho.
- [ ] Badge có ở Thẻ, Thẻ gọn và Bảng, bản vi và zh, không tràn ngang ở 390px.
- [ ] `kho=` và `xep=` nằm trên query, giữ qua tải lại; giá trị lạ bị bỏ.
- [ ] Chưa có kho: không badge, không request tới `heroes-dict`/`tactics`, có một dòng dẫn sang `/goi-y-doi-tu-kho/`.
- [ ] Tắt JavaScript: HTML của `/doi-chuan/` và trang mùa cũ không đổi so với trước.
- [ ] Test node cho số món thiếu; e2e cho badge, sắp xếp, lọc.
- [ ] `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:node`, e2e liên quan đều xanh sau khi publish generation.

## Rủi ro

- Publish generation thuộc loại rủi ro cao theo `AGENTS.md`: đề xuất review Astra → Fable trước khi merge.
- Chữ UI zh mới thuộc lớp `translate`, cần receipt của người duyệt độc lập; phase 5 dừng chờ anh duyệt.

## Ngoài phạm vi

Khai hoang, Cùng Tồn, thêm hàng loạt món thiếu (#61), đồng bộ kho qua mạng trên trang danh sách.

## Validation Log

### Session 1 (2026-11-11)

| Câu hỏi | Trả lời của anh | Ảnh hưởng |
|---|---|---|
| "Dễ ráp nhất" sắp thế nào? | Sắp trong từng bậc, giữ khối theo bậc | Khớp quyết định 5; phase 3 và 4 không đổi |
| Ai duyệt chữ UI zh mới? | Anh tự duyệt | Phase 5 dừng ở cổng 1, gửi bảng chữ vi/zh cho anh xác nhận rồi mới ghi receipt |
| Thực thi ngay? | Cook ngay với `--tdd` | Dừng ở các cổng duyệt và trước khi publish generation |

Rà soát toàn plan: 5 phase, phụ thuộc tuyến tính 1 → 5; không còn câu hỏi mở.

## Review độc lập (2026-11-11)

Báo cáo: [reports/code-review-261111-badge-kho.md](./reports/code-review-261111-badge-kho.md). Bản sửa #59 được xác nhận đúng.

| Phát hiện | Xử lý |
|---|---|
| F1: danh sách không tính món bù (`tacticOverrides`) nên lệch khối Độ phủ kho | Đã sửa: `readOwnedRoster` trả món bù, `buildListCoverage` áp `applyTacticOverrides`; có test node. Ghi chú "không áp `tacticOverrides`" ở phase 3 sai so với tiêu chí của issue và đã bị thay |
| F2: quay lại từ trang chi tiết khi đang lọc/sắp theo kho làm mất focus và vị trí | Đã sửa: khôi phục lại trên danh sách mới khi kho tới sau; e2e mới đỏ khi tắt bản sửa |
| F3: bản zh lẫn tên Việt trong `title` | Đã sửa: món thiếu mang `nameZh` của từ điển |
| F4: trang trả về từ bfcache không đọc lại kho | Sửa một phần: `pageshow` đọc lại kho. Còn lại: phiên đã nhớ trong `loadSession` không đổi khi đăng xuất ở tab khác; đưa vào issue theo dõi |
| F5: thanh kho ẩn vẫn chiếm một khoảng `gap` | Đã sửa bằng `[hidden]{display:none}`; có e2e |
| G4, G5, G6 | Đã sửa (bỏ `role=status`, bắt lỗi tính độ phủ, bộ chọn trang mùa) |
| G1, G3 | Chưa làm, đưa vào issue theo dõi: gỡ `kho` khỏi URL khi mùa không có độ phủ; xem món thiếu trên mobile và trình đọc màn hình |
| G2, G7 | Không đổi: mẫu số theo đúng khối Độ phủ kho; trang mùa cũ chỉ tải thêm khi máy có kho |

<!-- slug: doi-chuan-badge-kho -->
