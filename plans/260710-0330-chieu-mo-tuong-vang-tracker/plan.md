---
title: Theo dõi chiêu mộ tướng vàng
description: Tab local-first theo dõi lịch sử ra tướng 5 sao và pity 30 cho nhiều account.
status: completed
priority: P2
branch: main
tags:
  - frontend
  - localStorage
  - tdd
  - tracker
blockedBy: []
blocks: []
created: '2026-07-09T20:32:09.849Z'
createdBy: 'ck:plan'
source: skill
---

# Theo dõi chiêu mộ tướng vàng

## Overview

Thêm tab `Theo dõi chiêu mộ` vào static site hiện tại. Feature lưu local bằng `localStorage`, hỗ trợ nhiều account, theo dõi pity 30 theo `account + banner`, ghi lịch sử từng lần ra 5 sao, export/import JSON. Scope phase đầu chỉ gồm `Danh tướng PK` hằng ngày và banner/gói hạn giờ tự nhập; không theo dõi `Tướng tài PK`.

Nguồn quyết định:

- Brainstorm chốt scope: `plans/reports/260710-0248-brainstorm-chieu-mo-tuong-vang-tracker.md`
- Research banner/pity/core: `plans/reports/260710-0254-research-chieu-mo-banner-data.md`, `plans/reports/260710-0259-research-pity-30-card-pack-sharing.md`, `plans/reports/260710-0309-research-core-vs-material-heroes.md`, `plans/reports/260710-0310-research-core-hero-5-plus-1-pity.md`
- Red-team brainstorm: `plans/reports/260710-0324-red-team-chieu-mo-tuong-vang-tracker.md`

## Scout Summary

- Repo là static site vanilla ES modules, không bundler/framework.
- `index.html` khai báo nav tab và section; `js/app.js` load JSON, init nav/theme, rồi mount từng section.
- `localStorage` hiện chỉ dùng cho theme trong `js/app.js`; tracker cần key riêng và safe-parse.
- Pattern repo: logic thuần đặt module riêng và test bằng `node --test tests-js/*.test.mjs`.
- CSS chính là `css/styles.css`; UI cần giữ dashboard gọn, mobile-first, label tiếng Việt ngắn.
- Existing pending plan `260626-1600-cap-nhat-data-tuong-tier-ui` còn stale/pending nhưng không chặn feature này vì tracker không sửa pipeline tướng hoặc hero modal.

## Locked Scope

### In

- Tab mới `Theo dõi chiêu mộ`.
- Multi-account local state.
- Default banner `Danh tướng PK` với 4 daily slot: `Miễn phí 1`, `Nửa giá 1`, `Miễn phí 2`, `Nửa giá 2`.
- Slot status: `pending`, `miss`, `fiveStar`.
- Banner hạn giờ/đột xuất do user tạo, có actions `+1 không ra`, `+5 không ra`, `Ra 5★`.
- History 5 sao mới nhất trước, lưu: tướng, ngày, account, banner, slot/lượt, `pullCount`, ghi chú.
- Pity 30 tính riêng theo `account + banner`.
- Export/import JSON overwrite-only có validate + confirm.
- Hero autocomplete từ `heroes-dict.json` nhưng cho nhập free-text.

### Out

- `Tướng tài PK`.
- Counter “chiêu mộ tiếp 2 lần”.
- OCR/upload ảnh.
- Cloud sync.
- Community rule `5+1 core pity`.
- Lưu ảnh/base64 trong localStorage.
- Curated tier/core dataset hoàn chỉnh.

## Architecture

```text
index.html
  -> section-recruit-tracker
js/app.js
  -> load heroes-dict.json
  -> initRecruitTracker({ heroesDict, mount })
js/recruit-tracker-store.js
  -> pure-ish state operations + localStorage adapter
  -> import/export validation
js/recruit-tracker.js
  -> DOM render + event handlers
css/styles.css
  -> compact tracker layout
tests-js/recruit-tracker-store.test.mjs
  -> TDD behavior coverage
```

Store direction: keep an event-like `pullEvents` list as source of truth for pulls and derive pity/history from it. This directly addresses red-team risk around edit/delete consistency. UI can display derived state while still storing simple records.

## Data Model

```json
{
  "schemaVersion": 1,
  "activeAccountId": "acc_main",
  "accounts": [{ "id": "acc_main", "name": "Main" }],
  "banners": [
    {
      "id": "danh-tuong-pk",
      "name": "Danh tướng PK",
      "type": "normal",
      "drawMode": "daily",
      "hasFiveStar": true,
      "pityLimit": 30,
      "dailyCheapPullLimit": 4
    }
  ],
  "dailyStates": [
    {
      "date": "2026-07-10",
      "accountId": "acc_main",
      "bannerId": "danh-tuong-pk",
      "slots": [
        { "key": "free_1", "status": "pending" },
        { "key": "half_1", "status": "pending" },
        { "key": "free_2", "status": "pending" },
        { "key": "half_2", "status": "pending" }
      ],
      "nextFreeAt": ""
    }
  ],
  "pullEvents": [
    {
      "id": "evt_...",
      "accountId": "acc_main",
      "bannerId": "danh-tuong-pk",
      "date": "2026-07-10",
      "drawSlot": "free_2",
      "drawKind": "free",
      "pulls": 1,
      "result": "fiveStar",
      "heroName": "Lưu Bị",
      "heroValueClass": "Chủ lực",
      "note": "",
      "createdAt": "2026-07-10T03:30:00+07:00",
      "updatedAt": "2026-07-10T03:30:00+07:00"
    }
  ]
}
```

Derived selectors:

- `getPity(state, accountId, bannerId)` counts pulls since latest five-star event.
- `getFiveStarHistory(state)` filters `pullEvents.result === "fiveStar"`, sorted newest first.
- `getTodayDailyState(state, accountId, localDate)` resets slot view by local date while keeping pity events.

## Acceptance Criteria

- New nav tab and section `Theo dõi chiêu mộ` open via `#recruit-tracker`.
- User can create, rename, delete, and switch accounts.
- Active account is obvious in the tracker header.
- `Danh tướng PK` daily card has 4 slots with `pending/miss/fiveStar`.
- Marking a daily slot as miss adds one pull and increments derived pity.
- Recording `Ra 5★` from a slot stores the hero record, marks slot `fiveStar`, and resets derived pity for only that `account + banner`.
- User can create limited banners and use `+1`, `+5`, `Ra 5★`.
- Pity over 30 is retained but shown with a warning, not hard-capped.
- History shows newest first and includes account/banner/slot/pull count/hero/note.
- Hero input supports autocomplete from `heroes-dict.json` and free-text unknown heroes.
- Export downloads valid JSON; import validates schema before overwrite and rejects invalid JSON without touching current data.
- Corrupt localStorage falls back to default state without breaking the app.
- Existing tabs still load and navigation remains functional.
- `node --test "tests-js/*.test.mjs"` passes.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Plan audit](./phase-01-plan-audit.md) | Completed |
| 2 | [TDD store](./phase-02-tdd-store.md) | Completed |
| 3 | [TDD UI](./phase-03-tdd-ui.md) | Completed |
| 4 | [Verification review](./phase-04-verification-review.md) | Completed |

## Dependencies

- No blocking cross-plan dependency. Existing plan `260626-1600-cap-nhat-data-tuong-tier-ui` is pending/stale but tracker uses current `heroes-dict.json` read-only and supports free-text fallback.
- Internal dependency order: Phase 1 -> Phase 2 -> Phase 3 -> Phase 4.

## Red-Team Guardrails

- Do not store pity as the only source of truth if edits/deletes can make it stale; derive from events or recompute after mutation.
- Do not use UTC date keys for daily slots.
- Do not block unknown heroes missing from `heroes-dict.json`.
- Do not write imported data before validation and confirmation.
- Do not add deferred features under hidden flags.

## Open Questions

None blocking. Import is locked as overwrite-only for phase đầu, with backup/confirm copy.
