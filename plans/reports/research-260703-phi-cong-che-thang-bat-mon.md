# Research: 非攻制胜 and 八门金锁阵

Date: 2026-07-03

## Summary

- `八门金锁` in the video is shorthand for `八门金锁阵`.
- Existing canonical VN in repo: `Bát Môn Kim Tỏa Trận`.
- `非攻制胜` is missing from `data/tactics.json`, and one stale `data/teams.json` entry used Hán-Việt `Phi Công Chế Thắng`.
- Correct in-game VN canonical: `Không Đánh Mà Thắng`.
- Hán-Việt/alias: `Phi Công Chế Thắng`.
- Correction from first pass: `非攻制胜` healing should be stored as level scaling `10% -> 20%` if numeric values are included. Do not store only `10%`.
- Data conflict: `data/tactics-generic.json` currently maps `Không Đánh Mà Thắng` to `不战而胜`; resolve before adding `非攻制胜` to dict/build outputs.

## Evidence

### 八门金锁阵

- Chinese name: `八门金锁阵`
- Han-Viet: `Bát Môn Kim Tỏa Trận`
- Type: formation / `阵法`
- Source: inherited from `曹仁`
- Effect: first 3 turns, reduce damage dealt by 2 enemy units, affected by Intelligence; allied main general gets first action.
- Value: repo official-source scrape has base `15%`; GamerSky guide says max damage reduction reaches `30%`.
- Repo evidence: `data/tactics.json` already has exact entry with `viet: "Bát Môn Kim Tỏa Trận"`.
- Web sources:
  - GamerSky: https://www.gamersky.com/handbooksy/201909/1226656.shtml
  - Official/Lingxi mirror (`sgz.ejoy.com`): https://sgz.ejoy.com/m/station/detail-350659307657771017-367353729220884488
  - 17173 conflict/stacking explanation: https://news.17173.com/z/sgzzlb/content/08252021/130513704.shtml

### 非攻制胜

- Chinese name: `非攻制胜`
- Han-Viet: `Phi Công Chế Thắng`
- VN canonical: `Không Đánh Mà Thắng`
- Type: command/event tactic, no troop-type restriction found in sources.
- Source: event exchange, tied to `水淹七军` / PK scenario sources.
- Effect: from turn 3, the allied unit with highest Force heals the allied unit with lowest troop count whenever it deals weapon/blade damage. Healing scales from that damage and Force.
- Value: level scaling appears as `10% -> 20%`. 7724 quotes `10%` only; Bahamut/TW post quotes `20%`, likely max-level value.
- Repo evidence: `data/teams.json` had one stale Hán-Viet entry; dict missing `非攻制胜`.
- Web sources:
  - GamerSky event/tactic intro: https://www.gamersky.com/handbooksy/202301/1554328.shtml
  - 7724 effect summary: https://m.7724.com/sgzzlbyx/news/142520.html
  - Bahamut TW repost with full value: https://forum.gamer.com.tw/Co.php?bsn=36815&sn=53459

## Recommendation

Use:

```json
{
  "chinese": "非攻制胜",
  "hanViet": "Phi Công Chế Thắng",
  "viet": "Không Đánh Mà Thắng",
  "aliases": ["Phi Công Chế Thắng"],
  "effectViet": "Từ hiệp 3, mỗi khi đơn thể quân ta có Võ Lực cao nhất gây sát thương Binh Đao, hồi binh cho đơn thể quân ta có binh lực thấp nhất. Lượng hồi phục bằng 10% -> 20% sát thương lần này, chịu ảnh hưởng bởi Võ Lực của tướng gây sát thương."
}
```

For the video team list:

- Replace `非攻制胜` with `Không Đánh Mà Thắng`.
- Replace `八门金锁` with `Bát Môn Kim Tỏa Trận`.

## Unresolved Questions

- Need resolve `Không Đánh Mà Thắng` collision: current generic entry uses `不战而胜`, while user confirms `非攻制胜` is the exact in-game tactic for this VN name.
- Need decide whether to add `非攻制胜` as full `data/tactics-generic.json` entry or rebuild from an upstream source that includes newer PK/event tactics.
