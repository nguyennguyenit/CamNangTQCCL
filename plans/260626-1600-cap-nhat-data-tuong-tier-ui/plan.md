---
title: "Cập nhật data tướng + UI chi tiết + tier team"
description: ""
status: pending
priority: P2
branch: "main"
tags: []
blockedBy: []
blocks: []
created: "2026-06-26T09:13:56.493Z"
createdBy: "ck:plan"
source: skill
---

# Cập nhật data tướng + UI chi tiết + tier team

## Overview

Làm giàu data 112 tướng từ field lingxi đã crawl sẵn (parse thêm, không gọi API mới), thêm UI tra cứu tướng + modal chi tiết, và gắn tier T0–T3 theo **team** (khớp nguồn TQ chỉ rank đội hình). Nguồn brainstorm: `plans/reports/brainstorm-260626-1600-cap-nhat-data-tuong-tier-ui-report.md`.

**Nguyên tắc chốt sau red-team:**
- LINK chiến pháp theo `chinese` từ `tactics.json` (self 111/112, inherit 112/112) — KHÔNG nhân bản mô tả → triệt rủi ro `hanviet` fail-loud, giữ DRY.
- Tier gắn vào **team** (172 team), không tướng lẻ. Tier tướng (nếu cần) = suy từ team T0.
- Scraper = seasonal **suggest-only** (in gợi ý, người duyệt vào map), không auto-ghi.
- Giữ zero runtime dep / offline build / Python stdlib / tên VN canonical authoritative / không commit PNG aligames / không đụng cấu trúc `teams.json` ngoài thêm tier.

**TDD:** mỗi phase viết test trước (đỏ → xanh). Pipeline test bằng fixture thuần (`tests/`), JS test bằng `node --test` (`tests-js/`).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Enrich heroes-dict (pipeline+data)](./phase-01-enrich-heroes-dict-pipeline-data.md) | Pending |
| 2 | [UI tra cứu tướng + modal](./phase-02-ui-tra-c-u-t-ng-modal.md) | Pending |
| 3 | [Tier team manual curate + badge](./phase-03-tier-team-manual-curate-badge.md) | Pending |
| 4 | [Seasonal suggest-helper (optional)](./phase-04-seasonal-suggest-helper-optional.md) | Pending |

## Dependencies

- Không có plan dở dang overlap. Các plan tiền đề (`260620-2010-meta-team-tqccl-website`, `260623-1440-soi-doi-binhthu-portrait`, `260623-0330-bilingual-tactic-details`) đều `completed` → prerequisite đã thỏa.
- Thứ tự nội bộ: P1 → P2 (UI cần field mới). P3 độc lập P1/P2 (gắn team). P4 phụ thuộc P3 (feed map), **optional**.

## Acceptance (toàn plan)

- `build_dict` re-run → `heroes-dict.json` đủ `troopApt`, `inheritTacticCn`, `roleTag` cho 112/112, không fail-loud.
- Tab "Tra cứu tướng" render 112 card, lọc binh chủng thích tính / vai trò / phe / sao OK; modal hiện stats + 2 chiến pháp (link) + S/A/B.
- `team-tier.json` build sạch; badge T0–T3 ở card Team PK; team thiếu tier không vỡ.
- `python3 -m unittest discover -s tests` + `node --test "tests-js/*.test.mjs"` pass (lệnh glob — xem A1).
- README cập nhật khớp (bỏ claim sai "tab chiến pháp + 112 tướng"; sửa lệnh test JS sang glob).

## Open questions (còn lại sau validate)

- % khớp tên đội TQ ↔ `teams.json` — đo bằng spike P3 bước 0 (chưa biết trước khi curate).
- `黄` trong roleTag nghĩa gì — kiểm tướng gắn tag ngay trong P1 bước 2 (giả định "Khăn Vàng" nếu chưa chắc).

## Validation Log

### Verification Results (Standard tier, 4 phases)
- Claims checked: ~10 | Verified: 9 | Failed: 0 | Unverified: 1 (% khớp tên đội — chỉ đo được lúc curate).
- Fix áp: khóa join P3 đổi từ "name+loại binh" → **team `id`** (verify: `id` unique, `name` không unique).
- Verified: field coverage 112/112, self/inherit-tactic ∈ tactics.json (111/112, 112/112), `searchDict` export, `mobile-section-menu.js`, `suggest_aliases.py` print pattern, `teams.json` 172 record có `id` duy nhất.

### Validation Session 1 — quyết định
- P3 khóa join = team **`id`**.
- P3 tier lưu **file riêng** `data/team-tier.json` (không inline `teams.json`).
- P3 tier **multi-source**: mỗi team `rankings:[{source,tier,updatedAt}]`; badge bậc tốt nhất + tooltip mọi nguồn.
- **Cắt** field `score`/`winRate` (YAGNI — nguồn thưa).
- Nguồn curate: ưu tiên zhihu 94 套 (chưa khóa cứng — multi-source cho phép thêm nguồn khác).

### Whole-Plan Consistency Sweep
- Re-read plan.md + 4 phase. P3 đã đồng bộ (schema multi-source, khóa id, bỏ score/winRate). P1/P2/P4 không tham chiếu score/winRate → không stale. Acceptance dưới đây đã khớp. Không còn mâu thuẫn.

### Audit (adversarial) — 5 findings, 4 đã patch
- **A1** (Med): không có CI (`.github/workflows/` rỗng), README chạy test JS bằng file-list cứng → test mới bị bỏ. Fix: README glob `node --test "tests-js/*.test.mjs"` (P2 bước 6b, acceptance).
- **A2** (Med): đổi chữ ký `parse_hero_detail` sẽ vỡ caller/test. Fix: load role-map module-level, giữ chữ ký (P1).
- **A3** (Low-Med): tier có half-tier `T0.5`. Fix: tập hợp lệ {T0,T0.5,T1,T1.5,T2,T3}, parse float, class `t-05` (P3).
- **A4** (Med): P4 live-fetch zhihu bị anti-bot/JS-render. Fix: input file HTML cục bộ, parse offline (P4).
- **A5** (Low, **tiền tồn, không sửa**): `iconUrl` http→ mixed-content khi https; analyze đã dùng sẵn. Ghi nhận, ngoài scope.
- Verify thêm: `searchDict` scan `viet/hanViet/chinese/aliases` → dùng được cho tướng (heroes-dict có đủ field). Re-sweep sau patch: không mâu thuẫn mới.
