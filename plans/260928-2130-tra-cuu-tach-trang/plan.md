---
title: "Tách Tra cứu thành 7 trang theo nhóm, tải lười phụ thuộc chéo"
description: "/tra-cuu/<nhóm>/ ×2 locale, mỗi trang chỉ tải payload của nhóm; hồ sơ tải lười payload phụ thuộc; trang đầu lưới render lúc build; /tra-cuu/ là mục lục + chuyển tiếp."
priority: P1
status: completed
tags: [lookup, performance, seo, astro, localization]
created: 2026-09-28
---

# Tách Tra cứu thành 7 trang

## Outcome đã khóa (advise 2026-09-28)

- Route: `/tra-cuu/{tuong,chien-phap,trang-bi,quan-su,cai-tao-binh-chung,cong-trinh,binh-thu}/` và `/zh/…`.
- Lúc vào trang chỉ fetch payload của nhóm (vi và zh): Tướng `heroes-dict`, Chiến pháp `tactics`,
  4 nhóm catalog `lookup-catalog`, Binh thư chỉ `books-dict`. Payload phụ thuộc tải lười khi mở hồ sơ
  (Tướng → `tactics` + `lookup-catalog` + resolver tên zh; Chiến pháp/Trang bị/Quân sư → `heroes-dict`).
- Xác minh payload đơn theo `lookup-manifest.files[name]` + `generationId`; kiểm quan hệ chéo chạy lúc build.
- Trang đầu (60 mục) render lúc build; markup thẻ/hàng bảng dùng chung giữa Astro và client (cây view).
- `/tra-cuu/` = mục lục 7 thẻ (nhãn + mô tả menu + số đếm build), chuyển tiếp `?group=&id=` / `?id=`.
- Chip nhóm là link, search theo nhóm. Mọi href hồ sơ đi qua `js/lookup-ids.js`.
- Không làm: artifact quan hệ, trang tĩnh từng hồ sơ, đổi format manifest/pipeline promote, tách catalog,
  MCP tool, cách tải của công cụ, cache immutable.

## Quyết định thực thi

- Landing hash cũ (`js/legacy-routes.js`) giữ đích `/tra-cuu/?group=&id=`; trang mục lục chuyển tiếp tiếp
  (hàm inline tự đủ, không nhân đôi bảng slug trong script Landing).
- Nhóm hồ sơ khác trang → điều hướng sang trang nhóm đó (`<a href>`), không mở trong trang.
- Thẻ/tên chiến pháp dựng sẵn là link hồ sơ thật (bấm trước khi app chạy vẫn đúng); app chặn click thường.
- Menu/footer chỉ đọc nhãn + mô tả + đường dẫn (`lookupGroupLinks`), không phụ thuộc kho Tra cứu; số đếm chỉ
  ở mục lục và chip nhóm.
- Republish localization local được người dùng cho phép; không deploy, không commit.

## Phase

| # | Nội dung | Trạng thái |
|---|---|---|
| 1 | Loader payload đơn (`lookup-data.js`) + test | done |
| 2 | View helper theo locale + cây markup dùng chung (thẻ, hàng bảng, chân dung) | done |
| 3 | Controller trang nhóm + render hồ sơ theo nhóm; wiring `app.js` | done |
| 4 | Astro: route nhóm, SSR, mục lục, menu/footer/sitemap/link hồ sơ, số đếm | done |
| 5 | Localization policy + republish (generation `b840489e…`); MCP workflow build id | done |
| 6 | Test node/E2E, docs, verify toàn bộ | done |

## Còn mở (ngoài phạm vi)

- Dev server không trả 404 cho `/pipeline/recommended-identity-map.json` (`astro.config.mjs:3` chỉ chặn
  `pipeline/lookup-*` và `data/sgsdeck`); có từ trước refactor, chỉ ảnh hưởng dev.
