---
type: research-report
date: 2026-07-10
topic: chieu-mo-banner-data
status: complete
---

# Research Report: Dữ liệu banner chiêu mộ cho tracker

## Executive Summary

Có thêm dữ liệu nên đưa vào tracker: `bannerType`, `bannerName`, `bannerTitle`, `featuredHeroes`, `expiresAt`, `drawKind`, `cost`, `pityGroupId`, `freeNextAt`, `sourceScreenshotNote`. Hai ảnh user cung cấp đủ để phân biệt banner thường `Danh tướng PK` và banner hạn giờ `Cân Bằng Tĩnh Thế`.

Không nên làm auto-research pool banner trong phase đầu. Pool/balance thay đổi theo mùa, server, bản Việt/Trung; nguồn cộng đồng hữu ích để tham khảo nhưng không đủ làm data tự động. KISS: cho user tự tạo/sửa banner, app chỉ seed vài banner mặc định.

## Research Methodology

- Conducted: 2026-07-10.
- Gemini: unavailable/auth failed, used WebSearch.
- Sources consulted: official/near-official Chinese game pages, Vietnamese/Chinese screenshot evidence, community analysis.
- Key search terms: `Tam Quốc Chí Chiến Lược chiêu mộ danh tướng hạn giờ`, `三国志战略版 招募 概率 5.6 30次`, `悬权而动 SP马超 SP董卓`.

## Image Findings

| Field | Banner thường | Banner hạn giờ |
|---|---|---|
| Left tab | `Danh tướng PK` | `Cân Bằng Tĩnh Thế` |
| Type | normal / recurring | limited-time |
| Timer text | `Miễn phí sau` | `Sẽ mất` |
| Main art | Lữ Bố, Gia Cát Lượng | SP Đổng Trác, SP Mã Siêu |
| Main title | `Trường Giang cuồn cuộn chảy về đông...` | `Nhà Hán Thất Quyền / Đổng Trác Loạn Thiên` |
| Single cost | 198 vàng | 198 vàng |
| 5-pull cost | 948 vàng | 948 vàng |
| Important copy | "Chiêu mộ tiếp 2 lần, chắc chắn nhận Tướng Tài hoặc Danh Tướng" | "Sau khi chiêu mộ hạn giờ ... gọi thẻ sẽ mất" |

## Hoàng Đồ Bá Nghiệp Stage Pack Names

Observed from user screenshots. These are useful seed/banner metadata, not hard game rules.

| Stage / milestone | Opened card pack | Type guess | Notes |
|---|---|---|---|
| `Sẵn Sàng Chiến Đấu` | `Kỳ Tật Như Phong` | hegemony-stage | From `Mở Gói Thẻ: Kỳ Tật Như Phong` |
| `Hưng Động Can Qua` | `Kỳ Từ Như Lâm` | hegemony-stage | From `Mở Gói Thẻ: Kỳ Từ Như Lâm` |
| `Đã Đánh Là Thắng` | `Xâm Lược Như Lửa` | hegemony-stage | From `Mở Gói Thẻ: Xâm Lược Như Lửa` |
| `Khí Thế Ngút Trời` | `Bất Động Như Sơn` | hegemony-stage | From `Mở Gói Thẻ: Bất Động Như Sơn` |
| `Cử Binh Đến Nơi` | `Cân Bằng Tĩnh Thế` | hegemony-stage / scenario | Same pack name as limited screenshot |
| `Tổng Kết Giữa Kỳ / Quyết Thắng Trung Nguyên` | `Nan Tri Như Âm` | hegemony-stage | From `Mở Gói Thẻ: Nan Tri Như Âm` |
| `Quân Đến Chân Thành` | `Động Như Lôi Đình` | hegemony-stage | From `Mở Gói Thẻ: Động Như Lôi Đình` |

Other visible milestones without opened pack observed in screenshots:

- `Anh Hùng Lộ Đình`
- `Tụ Họp Anh Kiệt`
- `Mở Mang Bờ Cõi`
- `Hổ Cư Kinh Thôn`
- `Quyết Sách Tám Phương`
- `Thiên Hạ Quy Tâm`

## Key Findings

### 1. Official-ish rules confirm banner classes

Ejoy official guide states event recruitment is tied to activities and may only exist for a limited time; example event package existed for 24h. Same page states recruit probability: 5-star 5.6%, 4-star 36%, 3-star 58.4%. Source: Ejoy game guide lines 33-35.
Reference: https://sgz.ejoy.com/gengduo/detail-4071.html

### 2. Limited packages can open/close by exact time

A 2025 anniversary notice says adjusted limited card packs opened from `9月20日10:00~9月22日10:00`, and pulls during limited packages could grant event currency. This supports storing `startsAt`, `expiresAt`, and optional `eventReward`.
Reference: https://h5.9game.cn/content/postsDetail?postId=1000054469

### 3. PK normal package and limited package composition changes over time

Official Jan 2024 update says `PK名将` added SP Ma Chao/SP Xu Chu, and a new limited hegemony package `悬权而动` containing SP Ma Chao was added. This means tracker should not hardcode permanent pool data by code.
Reference: https://sgz.ejoy.com/huodong/detail-14549.html

### 4. Community current-state data useful, but not canonical

17173 2026 article says `权悬而动` contains only SP Ma Chao and SP Dong Zhuo as useful targets, and is mainly for SP Ma Chao top-up/red stars. Treat as advisory metadata: `featuredHeroes`, `valueNote`, not rules.
Reference: https://news.17173.com/content/06142026/045658045.shtml

### 5. Return/season packages keep similar price/probability pattern

7724 reports return season packages at 198 per single pull, 948 per 5-pull, probability 5-star 5.6%, 4-star 36%, 3-star 58.4%, and guaranteed 5-star after specified cumulative pulls. This matches user screenshots and official probability pattern, but source is lower quality.
Reference: https://opengame.7724.com/sgzzlbyx/news/49596.html

## Recommended Data Additions

### Banner entity

```json
{
  "id": "banner_...",
  "name": "Cân Bằng Tĩnh Thế",
  "type": "limited",
  "group": "PK",
  "title": "Nhà Hán Thất Quyền / Đổng Trác Loạn Thiên",
  "featuredHeroes": ["SP董卓", "SP马超"],
  "startsAt": null,
  "expiresAt": "2026-07-10T16:34:00+07:00",
  "pityLimit": 30,
  "pityGroupId": "acc-banner",
  "singleCost": 198,
  "fivePullCost": 948,
  "notes": "Hạn giờ; hết giờ gọi thẻ sẽ mất."
}
```

### Pull record extra fields

```json
{
  "drawKind": "free|half|paid-single|paid-five|ticket|unknown",
  "pullsAdded": 1,
  "costGold": 0,
  "bannerSnapshot": "Cân Bằng Tĩnh Thế",
  "featuredHit": true
}
```

### Pity state

```json
{
  "accountId": "acc_...",
  "bannerId": "banner_...",
  "pullsSinceFiveStar": 12,
  "lastFreeAt": "2026-07-10T02:54:00+07:00",
  "nextFreeAt": "2026-07-10T14:54:00+07:00"
}
```

## Implementation Recommendations

1. Seed default banners:
   - `Danh tướng PK` type `normal`.
   - `Tướng tài PK` type `normal`.
   - User-created limited banner template.
2. User can add/edit limited banner:
   - name, title, featured heroes, expiresAt.
3. Keep pity per `account + banner` by default.
4. Add draw kind buttons:
   - `Miễn phí`, `Nửa giá`, `Thường`, `5 lần`.
5. For daily estimate:
   - default `4 lượt/ngày`, editable per account.
6. Do not auto-import pool data from web in phase đầu.

## Common Pitfalls

| Pitfall | Why bad | Recommendation |
|---|---|---|
| Hardcode exact pool by season | Pool changes by version/server | User editable banner metadata |
| Treat community tier/card advice as official | Can be outdated/opinionated | Store as `note`, not rule |
| One pity counter for all banners | Could be wrong if pity is per pool | Default per banner; allow manual reset |
| Save countdown text only | `13:40:18` stale immediately | Convert to `expiresAt` when user enters |
| Store screenshot images in localStorage | Quota/perf issue | Do not store images phase đầu |

## Proposed Schema Delta From Brainstorm

Add to previous brainstorm:

- `banner.type`: `normal | limited | season | return | event`
- `banner.title`
- `banner.featuredHeroes`
- `banner.seasonStageName`
- `banner.startsAt`
- `banner.expiresAt`
- `banner.singleCost`
- `banner.fivePullCost`
- `record.drawKind`
- `record.costGold`
- `account.dailyCheapPullLimit`, default `4`

## Resources & References

- Ejoy official guide: event recruitment and 5.6/36/58.4 probability — https://sgz.ejoy.com/gengduo/detail-4071.html
- 2025 anniversary limited card pack notice — https://h5.9game.cn/content/postsDetail?postId=1000054469
- Ejoy Jan 2024 update: PK名将 and 悬权而动 changes — https://sgz.ejoy.com/huodong/detail-14549.html
- 17173 2026 community card-pack analysis — https://news.17173.com/content/06142026/045658045.shtml
- 7724 return season package probability/price reference — https://opengame.7724.com/sgzzlbyx/news/49596.html

## Next Steps

1. Update brainstorm report or implementation plan with banner metadata fields.
2. In `/ck:plan`, include `recruit-tracker-banner-store` tests for limited/normal banner behavior.
3. Keep UI manual-first: user edits banner name/title/timer, no web scraping.

## Unresolved Questions

- Pity 30 in Vietnamese server: `Danh tướng PK` / `Tướng tài PK` should be treated as separate. Follow-up research `260710-0259-research-pity-30-card-pack-sharing.md` found official probability table excludes 5 sao from `Tướng tài/Lương tướng`, so it should not participate in 5-star pity.
- Should limited banner expiry be manually entered as date/time, or only stored as note?
- Does `Chiêu mộ tiếp 2 lần, chắc chắn nhận Tướng Tài hoặc Danh Tướng` require a separate mini counter apart from 5-star pity?
