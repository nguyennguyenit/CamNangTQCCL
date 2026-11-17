---
title: "Kỳ lược PK-S27: nhóm Tra cứu và ô kỳ lược trên trang Đội chuẩn"
description: "Thêm nhóm Tra cứu Kỳ lược (5 phương lược, 40 thẻ, tên client 24.547), ô kỳ lược có cấu trúc trên trang Đội chuẩn và đổi tên kỳ lược trong ghi chú đội (#119), phát hành chung một PR."
status: pending
priority: P2
effort: 5d
issue: 119
branch: feat/ky-luoc-tra-cuu-o-doi-chuan
tags: [feature, frontend, pipeline, lookup, mcp, pk-s27]
blockedBy: []
blocks: []
created: 2026-11-17
---

# Kỳ lược PK-S27: nhóm Tra cứu và ô kỳ lược trên trang Đội chuẩn

## Overview

Kế hoạch này làm 3 việc và phát hành chung một PR:

- Thêm nhóm Tra cứu Kỳ lược, gồm 5 phương lược và 40 thẻ, dùng tên client 24.547.
- Thêm ô kỳ lược có cấu trúc trên trang Đội chuẩn.
- Đổi tên kỳ lược trong chữ ghi chú đội cho khớp client (#119).

Hiện kỳ lược chỉ nằm trong chữ ghi chú đội, vẫn dùng tên Hán-Việt cũ (ví dụ "Thiết Phục Thập Diện"). Tra cứu chưa có nhóm kỳ lược.

Nguồn dữ liệu: `plans/reports/261117-client-ky-luoc-pk-s27.md` (client Global 24.547, PR #120). Báo cáo scout: `reports/scout-tra-cuu.md`, `reports/scout-doi-chuan.md`.

## Mục tiêu và tiêu chí nhận

| # | Mục tiêu | Ưu tiên |
|---|---|---|
| 1 | `/tra-cuu/ky-luoc/` (vi và zh) liệt kê 5 phương lược và 40 thẻ. Mỗi mục có trang riêng, tên client, hiệu ứng nguyên văn, meta và JSON-LD đúng nhóm. | P1 |
| 2 | Mọi đội PK-S27 có chữ kỳ lược đều hiện ô "Kỳ lược" trên trang chi tiết. Ô có phương lược và các thẻ theo hiệp (hoặc dạng không thứ tự, hoặc dạng chép đội khác), mỗi thẻ link tới trang Tra cứu có thật. | P1 |
| 3 | Chữ ghi chú đội dùng cùng tên client trong ngữ cảnh kỳ lược (#119). | P1 |
| 4 | MCP: tìm được thẻ và phương lược; `tqccl_get_team` trả kỳ lược đã có tên. | P1 |
| 5 | Mọi gate generation, localization, verify và MCP đều qua. `recommendedCorpusHash` và ledger dedup không đổi. | P1 |

## Ngoài phạm vi

- Mùa khác ngoài PK-S27 (parser chỉ chạy với mùa trong allowlist).
- Lọc hoặc tìm đội theo thẻ; JSON-LD trang đội; Đội của tôi.

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Chốt tên và dữ liệu client kỳ lược](./phase-01-start.md) | Pending |
| 2 | [Nhóm Tra cứu Kỳ lược (gồm MCP catalog)](./phase-02-tra-cuu-nhom-ky-luoc.md) | Pending |
| 3 | [Tính kỳ lược đội ở đường publish](./phase-03-parser-ky-luoc-tu-ghi-chu-doi.md) | Pending |
| 4 | [Ô kỳ lược trên trang Đội chuẩn và MCP đội](./phase-04-o-ky-luoc-tren-trang-doi-chuan.md) | Pending |
| 5 | [Đổi tên kỳ lược trong ghi chú đội (#119)](./phase-05-doi-ten-ky-luoc-trong-ghi-chu.md) | Pending |
| 6 | [Publish, kiểm toàn bộ, tài liệu, PR](./phase-06-publish-va-tai-lieu-final.md) | Pending |

Thứ tự: 1 → 2 → 3 → 4 → 5 → 6.

- Phase 2–5 chỉ dựng candidate trong thư mục scratch. Không promote, không publish.
- Chỉ Phase 6 promote và publish, và làm một lần cho toàn bộ. Việc này tránh tình trạng lookup đã promote nhưng reference còn cũ.

## Quyết định đã chốt (Validation Session 1, 2026-11-17)

- **Tên thẻ:** đúng tên client 24.547.
- **Tên phương lược:** dùng tên trên thẻ chọn: Toàn quân, Cường Công, Mưu tính, Chiến đấu lâu dài, Quấy nhiễu. Tên trong Hướng dẫn đưa vào `aliasesVi`.
- **Dữ liệu Tra cứu:** đặt ở 2 khóa phẳng `qilueStrategies` và `qilueCards` trong `pipeline/lookup-client-tactics.json`. Đây là tiền lệ của `d62a882`, nên không phải nối hash cho một input mới.
  - Mã: `qilue-strategy:<slug>`, `qilue-card:<slug>`.
  - `slug` viết tay và đóng băng, không sinh lại từ tên.
- **Bản zh:** `nameZh` là tên game. Hiệu ứng dùng `zhTexts` kind `translation` (có cờ "dịch từ tiếng Việt", không vào meta). Không mở `ZH_SOURCE_HOSTS`.
- **Kỳ lược đội:** tính trong `site_localization.compile_candidate`, sau `hydrate_inputs`, từ `lookup-catalog.json` của cùng candidate. Không bao giờ đi vào pack.
  - Biến thể chữ Hán sai, 復刻, sửa tay và bỏ qua nằm trong `pipeline/recommended-qilue-overrides.json`. File này có hash trong `input_hashes` của reference và không công khai.
- **Ghi chú trùng:** ẩn block chỉ chứa dòng kỳ lược 台服 trên trang chi tiết. Đội của tôi và tìm kiếm giữ nguyên.
- **MCP:** nhóm Kỳ lược có entity và search kind. `tqccl_get_team` có section kỳ lược với các trường được liệt kê rõ, không lộ trường nội bộ.
- **Tên trùng nhóm khác** (Cường Công, Ám Độ Trần Thương): giữ đúng tên client, kết quả tìm kiếm và MCP luôn ghi nhãn nhóm. Mỗi va chạm phải nằm trong allowlist có review.
- **#119:** gộp vào plan này (Phase 5), phát hành cùng PR.

## Rủi ro chính

- **Merge vào `main` là deploy production.** Pages tự deploy (`.github/workflows/pages-deploy.yml:9`), MCP tự release (`.github/workflows/mcp-release.yml:13,70`), cộng thêm cron hằng ngày.
  - Gate duyệt nằm ở lúc merge PR.
  - Rollback: revert commit merge rồi để auto-deploy chạy lại.
  - Trước merge cần review Astra → Fable, vì PR chạm pipeline, generation và dữ liệu đã publish.
- Thêm nhóm thứ 8 phải sửa đồng bộ khoảng 20 chỗ: khóa catalog, ledger route, MCP projection, `describe()`. Quên một chỗ thì gate dừng, đây là thất bại an toàn.
- Hook Bash trên máy chặn chữ `build`/`dist`/`node_modules`. Khi đó chạy `npm run …` qua file script hoặc trong terminal của anh.

## Red Team Review

### Session — 2026-11-17

**Findings:** 15 (14 accepted, 1 accepted một phần, 0 rejected)
**Severity breakdown:** 1 Critical, 9 High, 5 Medium. Ba reviewer: Failure Mode, Assumption Destroyer, Security/Fact Check.

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | `qilue` gắn ở đường capture (`attach_display_notes`), trong khi publish đi qua `compile_candidate`/`hydrate_inputs` (`pipeline/site_localization.py:2049,2115`). Corpus hash được tính ở 4 chỗ. | Critical | Accept | Phase 3 |
| 2 | MCP bắt buộc phải có entity của nhóm mới (`mcp-worker/src/data/publication-builder.ts:823-834`). `...detail` làm lộ `qilue` qua `tqccl_get_team` (l.395-400). | High | Accept | Phase 2, 4 |
| 3 | Merge = deploy production; gate "anh đồng ý deploy" không có tác dụng. | High | Accept | plan.md, Phase 6 |
| 4 | Thiếu bước re-pin `policy.sourceFiles` và `team-route-handles`. Phase 5 cũ chạy `build_recommended_reference` tay, trái với `docs/unified-lookup.md:105`. Lệnh `recommended_team_dedup --check` không tồn tại. | High | Accept | Phase 3, 6 |
| 5 | Input và module mới không được nối vào `inputHashes`/`executionHashes`/`compile_candidate` (`pipeline/build_unified_lookup.py:2445`, `site_localization.py:2058-2101`). | High | Accept: đặt dữ liệu vào `lookup-client-tactics.json` | Phase 1, 2 |
| 6 | Ô kỳ lược không có nguồn tên, loại, độ hiếm; `TeamLookupLinks.qilue` trùng state; link có thể 404 mà không gate nào bắt. | High | Accept | Phase 3, 4 |
| 7 | Parser bỏ sót dạng E `整軍：…→[極]…` và các biến thể 鴻門避險, 摧鋒斷刃 (tên chiến pháp). Dạng C thực tế là 17 đội, không phải 13. R khớp nhầm dạng C. Không có gate độ phủ. | High | Accept | Phase 3 |
| 8 | `aliasesZh` dùng cho biến thể sai sẽ lọt vào catalog công khai (`pipeline/build_unified_lookup.py:49`, `js/lookup-detail.js:247`). | High | Accept | Phase 1, 2, 3 |
| 9 | `lookup_route_handles --write` từ chối ledger 7 nhóm (`pipeline/lookup_route_handles.py:189-192,290`). | High | Accept | Phase 2 |
| 10 | Mở `sgsdeck.com` vào `ZH_SOURCE_HOSTS` là mở rộng toàn cục, trái invariant (`pipeline/build_unified_lookup.py:65-68`). | High | Accept: bỏ phương án | Phase 2 |
| 11 | Tên trùng giữa các nhóm (強攻/Cường Công, 久戰 là binh thư, Ám Độ Trần Thương). | Medium | Accept | Phase 1, 2, 5 |
| 12 | `describe()` đẩy nhóm lạ vào nhánh "công trình"; thiếu xử lý `TERM_GROUPS` (`src/lib/lookup-item-pages.ts:50-95,139`). | Medium | Accept | Phase 2 |
| 13 | Parser fail-closed chặn publish mọi mùa và không chốt mùa. | Medium | Accept một phần: thêm allowlist mùa; vẫn fail-closed vì pack đã pin và recapture phải qua review | Phase 3 |
| 14 | Test parity SSR/client nhắm vào trang danh sách; trang chi tiết chỉ có SSR (`js/team-detail.js:196`). | Medium | Accept | Phase 4 |
| 15 | Lời hứa "slug đóng băng" sai vì id sinh từ tên; catalog lồng nhau phá quy ước row phẳng. | Medium | Accept | Phase 1, 2 |

## Validation Log

### Session 1 — 2026-11-17
- Q (red-team): áp mọi phát hiện đã chấp nhận → **Áp tất cả**.
- Q1 tên phương lược → **tên trên thẻ chọn**.
- Q (#119) → **gộp cùng PR**.
- Q4 MCP đội → **đưa vào phạm vi**.
- Q2 hiệu ứng zh → **dịch từ tiếng Việt**.
- Q3 ghi chú trùng → **ẩn trên trang chi tiết**.
- Q tên trùng → **giữ tên, kèm nhãn nhóm**.
