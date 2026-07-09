---
type: research-report
date: 2026-07-10
topic: pity-30-card-pack-sharing
status: complete
---

# Research Report: Pity 30 có share giữa Danh tướng PK và Tướng tài PK không

## Executive Summary

Kết luận thực dụng cho tracker: **không share pity 30 giữa `Danh tướng PK` và `Tướng tài PK`**.

Lý do chính: official probability page tách `名将招募卡包` và `良将招募卡包`; `名将` có 5 sao 5.6%, còn `良将` không có dòng 5 sao, chỉ có 4/3/2/1 sao. Vì `Tướng tài/Lương tướng` không có 5 sao, nó không tham gia pity 30 ra tướng vàng. Pity 30 nên chỉ tracking cho `Danh tướng PK` và các gói vàng/limited/special có 5 sao.

## Research Methodology

- Conducted: 2026-07-10.
- Gemini CLI unavailable/auth failed, used WebSearch.
- Sources consulted: official Ejoy probability page, 18183, 7724, OurPlay.
- Key search terms: `三国志战略版 名将招募 良将招募 保底 30 次 分开 共享`, `三国志战略版 招募规则 名将 良将 概率 30次 五星`.

## Findings

### 1. Official probability page separates Danh tướng and Tướng tài

Official Ejoy probability page:

- `名将招募卡包`: 5 sao 5.6%, 4 sao 36%, 3 sao 58.4%.
- `良将招募卡包`: 4 sao 0.2%, 3 sao 2%, 2 sao 38%, 1 sao 59.8%.
- Note: `名将` uses gold; `良将` uses copper.
- `特殊招募卡包` is all non-`名将` packages using gold, also 5 sao 5.6%.

Interpretation: `Tướng tài/Lương tướng` cannot share 5-star pity because its public probability table has no 5-star outcome.

Source: https://sgz.ejoy.com/huodong/detail-4585.html

### 2. In-game guide screenshots align with official probability table

Earlier user screenshots show:

- `Chiêu mộ Danh Tướng`: 5.6% 5 sao, 36% 4 sao, 58.4% 3 sao, has "nhiều nhất chiêu mộ liên tiếp 30 lần chắc chắn được 5 sao".
- `Chiêu mộ Tướng Tài`: 0.2% 4 sao, 2% 3 sao, 38% 2 sao, 59.8% 1 sao, no 5 sao line.
- `Chiêu mộ đặc biệt`: same as Danh Tướng for 5 sao and pity 30.

Interpretation: tracker should not show pity 30 for `Tướng tài PK`; only maybe track it as copper pulls/material if user wants.

### 3. Third-party sources say different card packs do not share pity

7724 says different card packs are not counted together for the 30-pull pity; each pack calculates separately. It also says `良将` has no orange/5-star guarantee.

Source: https://opengame.7724.com/sgzzlbyx/news/20378.html

18183 says 30-pull pity is triggered after continuous draws in `名将卡包`, and says no pity sharing between different card pack types, using `名将卡包` vs `限时卡包` as example.

Source: https://www.18183.com/gonglue/202402/bb570li0.html

OurPlay Q&A says limited/small pack has 30 pity like `名将`, but calculates separately from `名将`.

Source: https://www.ourplay.net/ask/detail/1214357

## Tracker Recommendation

### Pity counter policy

```json
{
  "banner": {
    "name": "Danh tướng PK",
    "type": "normal-gold",
    "hasFiveStar": true,
    "pityLimit": 30,
    "pityGroupId": "account:banner"
  }
}
```

```json
{
  "banner": {
    "name": "Tướng tài PK",
    "type": "copper",
    "hasFiveStar": false,
    "pityLimit": null,
    "pityGroupId": null
  }
}
```

```json
{
  "banner": {
    "name": "Cân Bằng Tĩnh Thế",
    "type": "limited-gold",
    "hasFiveStar": true,
    "pityLimit": 30,
    "pityGroupId": "account:banner"
  }
}
```

### UI behavior

- `Danh tướng PK`: show pity 30.
- `Tướng tài PK`: hide pity 30; optionally show "Không có 5 sao / không tính pity vàng".
- Limited/special/hegemony gold packs: show independent pity 30 by default.
- Do not count `Tướng tài PK` pulls into any 5-star pity.

## Confidence

High for `Tướng tài PK` not sharing with `Danh tướng PK`, because official probability table excludes 5-star from `良将`.

Medium for exact sharing among all gold limited packs, because official sources found do not provide a single explicit cross-pack sharing rule. Community sources consistently say separate counters.

## Next Steps

1. Update implementation plan: seed `Tướng tài PK` as non-pity banner.
2. Add `hasFiveStar` and `pityEnabled` to banner model.
3. Add UI copy: `Tướng tài PK không tính pity 5 sao`.
4. Keep limited/special pack pity separate unless user proves server shares a counter.

## Unresolved Questions

- Does Vietnamese server use exactly same cross-pack pity separation for every limited pack? Not directly confirmed by official VN text.
- Does `Chiêu mộ tiếp 2 lần, chắc chắn nhận Tướng Tài hoặc Danh Tướng` represent a separate 2-pull mechanic? Still unresolved.
