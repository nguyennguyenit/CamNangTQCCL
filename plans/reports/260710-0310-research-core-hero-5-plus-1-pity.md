---
type: research-report
date: 2026-07-10
topic: core-hero-5-plus-1-pity
status: complete
---

# Research Report: Có bảo hiểm core sau bao nhiêu tướng thường không

## Executive Summary

Có thông tin cộng đồng về cơ chế gọi là `5+1`: sau tối đa 5 tướng cam thường/non-core, tướng cam tiếp theo sẽ là rare/core. Nói theo ngôn ngữ user: **quay ra 5 tướng vàng "rác/thường" thì tướng vàng kế tiếp được cộng đồng cho là core/rare**.

Nhưng đây **không phải luật official tìm thấy được**. Official Ejoy chỉ công bố xác suất theo loại gói: Danh tướng 5★ 5.6%, đặc biệt 5★ 5.6%, bá nghiệp/cát cứ 14.1%; không công bố phân lớp core/non-core hoặc bảo hiểm 5+1. Vì vậy tracker không nên hiển thị như guarantee cứng. Nếu thêm, phải ghi "tham khảo cộng đồng".

## Research Methodology

- Conducted: 2026-07-10.
- Gemini CLI unavailable/auth failed, used WebSearch.
- Sources consulted: Ejoy official probability page, 17173, GamerSky, 7724, Sohu/Zhihu snippets.
- Key search terms: `三国志战略版 5+1 核心 橙将`, `几张废橙 出核心`, `核心保底`, `稀有橙色卡`.

## Key Findings

### 1. Official source does not disclose core pity

Ejoy official probability disclosure lists only star probabilities by pack:

- `名将招募卡包`: 5★ 5.6%, 4★ 36%, 3★ 58.4%.
- `特殊招募卡包`: 5★ 5.6%, 4★ 36%, 3★ 58.4%.
- `霸业/割据卡包`: 5★ 14.1%, 4★ 85.9%.

No official line found for `core`, `rare`, `5+1`, or "after N ordinary orange cards".

Reference: https://sgz.ejoy.com/huodong/detail-4585.html

### 2. Community calls it `5+1`

17173 states the `5+1` rule as: at most 5 ordinary orange cards, then 1 rare orange card; same-season same-pack, separate counters by pack, reset on season switch. It also lists rare heroes by PK big pool, four PK opening packs, hegemony small packs, collection packs, etc.

Important: article says the list is based on player statistics.

Reference: https://news.17173.com/content/02172025/202701817.shtml

### 3. GamerSky records similar player-derived logic and caveat

GamerSky article says:

- every 30 pulls guarantees 1 orange card.
- pulling orange resets normal pity.
- every 6 orange cards guarantees 1 rare orange card.
- pulling rare resets rare pity.
- pack expiry/season end resets card-pack pull records.

But it explicitly states the content is player-discovered and does not represent the true game mechanism.

Reference: https://www.gamersky.com/handbooksy/202204/1476101.shtml

### 4. 7724 explains why this is not official

7724 explains `5+1` as: if first five orange cards are ordinary, next orange is core. It also says official did not publish this `5+1` rule; 30-pull orange guarantee is official, while `5+1` is inferred by players.

Reference: https://m.7724.com/sgzzlbyx/news/67556.html

### 5. "Core" list is season/pack dependent

17173 2025 lists different rare/core sets for:

- PK big pool.
- PK1/PK2/PK3/PK4 opening packs.
- Hegemony stage packs: `其疾如风`, `其徐如林`, `侵略如火`, `不动如山`, etc.
- Collection packs.

Therefore a single global "core" list is wrong. It should be per season + per banner.

## Practical Interpretation

| Question | Practical answer |
|---|---|
| Có thông tin "bao nhiêu tướng rác tới core" không? | Có, cộng đồng gọi là `5+1`. |
| Con số là bao nhiêu? | 5 tướng cam thường/non-core, tướng cam tiếp theo rare/core. |
| Có official không? | Không tìm thấy. Official chỉ có star probability. |
| Có nên đưa vào app như guarantee không? | Không. Chỉ optional "tham khảo cộng đồng". |
| Nếu tính theo pull tệ nhất? | 6 orange × tối đa 30 pull/orange = 180 pull tệ nhất, nhưng đây là phép nhân từ 2 cơ chế và `5+1` không official. |

## Tracker Recommendation

Default phase:

- Do not show `core pity` as official.
- Track only 5★ pity 30.

Optional later:

```json
{
  "corePity": {
    "enabled": false,
    "mode": "community-5-plus-1",
    "ordinaryFiveStarSinceRare": 3,
    "confidence": "community",
    "note": "Tham khảo cộng đồng; không phải công bố official."
  }
}
```

UI copy if enabled:

- `Core 5+1: tham khảo`
- `Đã ra 3 tướng thường từ core gần nhất`
- `Nguồn: cộng đồng, không phải bảo hiểm official`

Do not use:

- `Chắc chắn core sau X lượt`
- `Bảo hiểm core official`
- Any warning that implies user should spend gold based on this alone.

## Product Decision

For current local tracker, recommendation is:

1. Keep `heroValueClass` badges: `Chủ lực`, `Dùng đội`, `Tình huống`, `Nội chính`, `Vật liệu`.
2. Store enough data so future core-streak can be derived:
   - `heroChinese`
   - `heroValueClass`
   - `bannerId`
   - `season`
   - `isCommunityCore` optional snapshot.
3. Do not build a dedicated core-pity panel in phase 1.

## Resources & References

- Official probability disclosure — https://sgz.ejoy.com/huodong/detail-4585.html
- 17173 PK season `5+1` rare/core list — https://news.17173.com/content/02172025/202701817.shtml
- GamerSky player-discovered pity logic — https://www.gamersky.com/handbooksy/202204/1476101.shtml
- 7724 explanation and caveat that official did not publish `5+1` — https://m.7724.com/sgzzlbyx/news/67556.html
- Sohu core/non-core discussion caveat — https://www.sohu.com/a/456604501_118576

## Next Steps

1. Keep phase 1 tracker focused on official 30-pull 5★ pity.
2. Add `heroValueClass` snapshot so core/non-core streak can be calculated later.
3. If user wants, phase 2 can add an experimental `5+1 community tracker` toggle.

## Unresolved Questions

- Vietnamese server/TTH has same `5+1` behavior? Not official-confirmed.
- Exact current core list per VN banner requires local manual curation or more screenshots/source.
- Whether `rare/core` is truly equivalent to user "tướng core ghép team" is imperfect; some rare cards may be niche and some ordinary cards can still be useful by season.
