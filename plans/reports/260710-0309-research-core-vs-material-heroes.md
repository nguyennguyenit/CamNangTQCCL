---
type: research-report
date: 2026-07-10
topic: core-vs-material-heroes
status: complete
---

# Research Report: Phân loại core vs material heroes

## Executive Summary

Có cơ sở để thêm metadata phân loại giá trị tướng, nhưng không nên gọi là `rác` trong app. Cộng đồng có dùng cách nghĩ `核心武将` / core hero, `普通橙卡`, `材料武将`, `内政武将`; official/near-official có phân biệt rõ `内政武将` là nhóm không tập trung chiến đấu, dùng chính trị/mị lực để tăng nội chính.

Khuyến nghị cho tracker: thêm nhãn `valueClass` thủ công/curated: `core`, `combat`, `niche`, `internal`, `tactic-material`, `unknown`. Dùng để user nhìn nhanh lần ra vàng có giá trị thế nào, nhưng phải coi là "tham khảo theo mùa", không phải chân lý cố định.

## Research Methodology

- Conducted: 2026-07-10.
- Gemini CLI unavailable/auth failed, used WebSearch.
- Sources consulted: Ejoy official/player guide, GamerSky, 17173, Sohu, Sina/ZOL, repo local data.
- Key search terms: `三国志战略版 核心武将 材料武将 内政武将`, `三国志战略版 必留橙将`, `三国志战略版 武将强度榜`.

## Key Findings

### 1. Có khái niệm core nhưng không official cứng

Nguồn cộng đồng nói người chơi thường chia tướng cam thành `core` và `non-core`, nhưng cũng cảnh báo core không cố định theo mùa/meta. Sohu ghi rõ đây là kinh nghiệm người chơi, thiếu data chính thức, chỉ nên tham khảo.

Reference: https://www.sohu.com/a/456604501_118576

### 2. Có nhóm "must keep" / "material" trong guide cộng đồng

17173 có bài `必留橙将` chia tướng nên giữ, tướng dư giữ lại, và tướng có thể tháo/đổi làm vật liệu. Bài cũng nhấn mạnh event tactics/chiến pháp sự kiện là lý do một số tướng không lên trận vẫn cần giữ.

Useful pattern:

- `must keep/core`: dùng trực tiếp trong team hoặc đội hình chủ lực.
- `duplicate keep`: có thể giữ thêm đỏ/sao hoặc dùng khi cần.
- `material/tactic`: dùng để đổi chiến pháp/sự kiện.
- `ordinary`: không phải ưu tiên cao.

Reference: https://news.17173.com/z/sgzzlb/content/09272022/182955292.shtml

### 3. Nội chính là nhóm thật, không nên gọi là rác

Ejoy guide về nội chính giải thích 4/5 sao nội chính dựa vào chính trị/mị lực và kỹ năng nội chính; không phải tướng chiến đấu chính, nhưng có giá trị trong 11 chức năng nội chính. Bài cũng nói non-internal-affairs heroes không phù hợp nội chính vì không nhận exp/không có skill liên quan.

GamerSky cũng mô tả nội chính tướng thường không tham chiến, tăng trưởng chính trị/mị lực, dùng để tăng tài nguyên, tốc độ, chất lượng.

References:

- https://sgz.ejoy.com/gonglue/detail-4199.html
- https://www.gamersky.com/handbooksy/201910/1228644.shtml

### 4. Tier/current meta thay đổi mạnh

Sina/ZOL 2025 article chia 5-star heroes thành nhóm high-frequency core, mainstream common, playable-but-not-priority, cold/niche. Nó cũng cảnh báo khác season/server có thể khác.

Reference: https://finance.sina.com.cn/tech/roll/2025-11-26/doc-infyture9089459.shtml

### 5. Repo local data already provides useful proxy

Local `teams.json` appearance count is a strong practical signal:

| Hero | Team appearances | Role | Interpretation |
|---|---:|---|---|
| Quan Vũ | 29 | Chiến | core/combat |
| Tào Tháo | 26 | Phụ trợ | core |
| Chu Du | 23 | Mưu lược | core/combat |
| Giả Hủ | 21 | Khống chế | core/combat |
| Thái Sử Từ | 20 | Vũ lực | core/combat |
| Trương Giác | 20 | Khăn Vàng | core/combat |
| Lưu Bị | 18 | Y thuật | core/support |
| Tôn Quyền | 16 | Chiến | core/combat |
| Khương Duy | 12 | Kiêm nhiệm | combat |

Examples from user "low value" list in local data:

| Hero | Team appearances | Role | Suggested class |
|---|---:|---|---|
| Hoa Hùng | 0 | Vũ lực | material/niche |
| Lý Nho | 0 | Mưu lược | material/niche |
| Tưởng Uyển | 0 | Nội chính | internal |
| Nghiêm Nhan | 0 | Phụ trợ | material/niche |
| Chân Cơ | 2 | Mị lực | internal/niche |
| Thái Ung | 0 | Nội chính | internal |
| Tiểu Kiều | 0 | Mị lực | internal |
| Đại Kiều | 3 | Mị lực | internal/niche |

Note: local dict currently lacks newer examples `SP Mã Siêu` and `SP Quan Vũ`; if tracker will classify them, data source must be updated first.

## Recommended Classification

Use neutral labels:

| `valueClass` | UI label | Meaning |
|---|---|---|
| `core` | Chủ lực | High-value hero used in meta/core teams |
| `combat` | Dùng đội | Viable combat hero, not always top core |
| `niche` | Tình huống | Can work in specific teams, red level, season, or counter role |
| `internal` | Nội chính | Political/charm/appointment hero; not main combat value |
| `tactic-material` | Vật liệu/chiến pháp | Keep for inherited/event tactic or conversion |
| `unknown` | Chưa phân loại | No confident label |

Add secondary tags instead of one overloaded label:

```json
{
  "heroChinese": "刘备",
  "valueClass": "core",
  "valueTags": ["support", "healer", "many-teams"],
  "teamAppearanceCount": 18,
  "source": "local-teams-plus-manual",
  "updatedAt": "2026-07-10"
}
```

```json
{
  "heroChinese": "蒋琬",
  "valueClass": "internal",
  "valueTags": ["politics", "appointment"],
  "teamAppearanceCount": 0,
  "source": "role-tag-plus-local-teams",
  "updatedAt": "2026-07-10"
}
```

## How To Use In Recruit Tracker

Add optional badge beside pull record:

- `Chủ lực`: green/gold, high-value pull.
- `Dùng đội`: blue.
- `Tình huống`: gray/amber.
- `Nội chính`: gray with building icon/text.
- `Vật liệu`: gray with "đổi chiến pháp/sự kiện".

Avoid:

- `Rác` label. Too blunt, misleading, and can become wrong after season/meta update.
- Fully automatic web-derived tier. Too unstable.
- Using only stats to classify. Some low-stat heroes are valuable for inherited/event tactics.

## Implementation Recommendation

Phase 1 tracker:

- Store pull history only.
- Optionally show `valueClass` if available.

Phase 2:

- Create `data/hero-value-tags.json` manually curated.
- Generate `teamAppearanceCount` from current `teams.json`.
- Add filter in history: `Chủ lực / Nội chính / Vật liệu`.

Suggested source hierarchy:

1. Manual override: maintainer/user curated.
2. Existing `teams.json` appearance count.
3. Existing `roleTagViet`: `Nội chính`, `Mị lực` -> internal candidate.
4. Event/inherited tactic mapping -> material candidate.
5. Unknown fallback.

## Pitfalls

| Pitfall | Why bad | Better |
|---|---|---|
| Label `rác` | Offensive/misleading; some have internal/event value | `Nội chính`, `Vật liệu`, `Tình huống` |
| Hardcode current meta | Meta changes by season/server | `updatedAt`, source, manual override |
| Classify only by team count | New heroes may be absent from local data | allow manual curated tags |
| Classify only by roleTag | Tuân Úc has `Nội chính` role but appears in many teams in local data | team count + manual wins |

## Resources & References

- Ejoy internal affairs guide — https://sgz.ejoy.com/gonglue/detail-4199.html
- GamerSky internal affairs hero overview — https://www.gamersky.com/handbooksy/201910/1228644.shtml
- 17173 must-keep orange heroes/material guide — https://news.17173.com/z/sgzzlb/content/09272022/182955292.shtml
- Sohu core/non-core discussion and caveat — https://www.sohu.com/a/456604501_118576
- Sina/ZOL 5-star strength grouping — https://finance.sina.com.cn/tech/roll/2025-11-26/doc-infyture9089459.shtml

## Next Steps

1. If planning tracker, add optional `heroValueClass` field to record snapshot.
2. Do not block phase 1 on a full hero tier list.
3. Later, build `hero-value-tags.json` from manual curation + local team appearances.

## Unresolved Questions

- Should tracker show hero value badges immediately, or only after curated data exists?
- Do we want Vietnamese labels `Chủ lực / Dùng đội / Tình huống / Nội chính / Vật liệu` exactly?
- Need update `heroes-dict.json` for newer heroes such as `SP Mã Siêu`, `SP Quan Vũ` before classification is complete.
