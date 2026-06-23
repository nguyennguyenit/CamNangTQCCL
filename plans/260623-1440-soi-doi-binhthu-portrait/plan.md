---
title: 'Soi đội từ ảnh: binh thư + nhận diện tướng'
description: 'Đọc binh thư + đoán tướng từ chân dung + icon xác nhận cho Soi đội từ ảnh'
status: completed
priority: P2
branch: main
tags: []
blockedBy: []
blocks: []
created: '2026-06-23T08:05:16.008Z'
createdBy: 'ck:plan'
source: skill
---

# Soi đội từ ảnh: binh thư + nhận diện tướng

## Overview

Mở rộng "Soi đội từ ảnh": đọc thêm **binh thư** + tăng độ tin nhận diện tướng, giữ kiến trúc tĩnh + Worker.
3 nhánh gộp 1 đợt (A + B0 + B1) — xem brainstorm: `plans/reports/brainstorm-260623-1440-soi-doi-binhthu-portrait-recognition-report.md`.

- **A** — `data/books-dict.json` (Hán↔Việt ~74 binh thư) qua `pipeline/build_books_dict.py`.
- **B0** — nới `VISION_PROMPT` cho phép đoán tướng từ chân dung khi tên vắng (low-conf).
- **B1** — `booksCn` vào worker schema; map binh thư + gắn `iconUrl` ở `analyze-map.js`; hiển thị icon hotlink + dòng binh thư ở `analyze.js`.

Out of scope: pHash/embedding (B2), binh thư tính điểm `findSimilarTeams`, mô tả hiệu ứng binh thư, commit asset PNG.

**Phương pháp: TDD** — mỗi phase viết test trước (khóa hành vi đọc đội hiện tại) rồi mới đổi code.

## Acceptance Criteria

- [ ] **Unit/mock (verify local):** mock result chứa `booksCn:["铁甲","防备"]` → `mapRead` ra `["Giáp Sắt","Phòng Bị"]`; render hiện icon + dòng binh thư.
- [ ] Mỗi tướng kết quả có icon official (hotlink) để xác nhận; icon gãy/403 thì ẩn, không chặn text.
- [ ] Tên tướng bị che → vẫn ra ứng viên + cờ ⚠ (không crash, không auto-accept sai).
- [ ] Test JS (`tests-js/`) + worker (`worker/test/`) + pipeline (`tests/`) xanh; không hồi quy 3 tab offline.
- [ ] **Manual sau deploy (không verify local được — config.js placeholder):** ảnh mẫu user qua Worker thật → đọc đủ tướng + chiến pháp + binh thư.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Data binh thư](./phase-01-data-binh-th.md) | Completed |
| 2 | [Worker schema + prompt](./phase-02-worker-schema-prompt.md) | Completed |
| 3 | [Site map + UI](./phase-03-site-map-ui.md) | Completed |

## Dependencies

- Mở rộng plan đã hoàn tất `260621-2324-screenshot-team-analyzer-vision-llm` (status: done). Không khóa phụ thuộc.
- Build order: P1 (books-dict) + P2 (booksCn) độc lập → P3 phụ thuộc cả hai (cần dict + field để map/render).
