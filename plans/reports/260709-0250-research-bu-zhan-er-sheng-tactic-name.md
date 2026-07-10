---
type: researcher
date: 2026-07-09
topic: "不战而胜 tactic-name verification"
---

# Research Report: 不战而胜

## Summary

`不战而胜` is likely **not an official tactic name** in Tam Quốc Chí Chiến Lược / 三国志战略版. It is a normal Chinese idiom meaning "win without fighting". Current repo mapping `Không Đánh Mà Thắng -> 不战而胜` is probably a stale generic placeholder.

The official tactic the user identifies as Vietnamese `Không Đánh Mà Thắng` is **`非攻制胜`**, not `不战而胜`.

## Findings

### Local Evidence

- `data/tactics.json` currently has:
  - `chinese`: `不战而胜`
  - `hanViet`: `Bất Chiến Nhi Thắng`
  - `viet`: `Không Đánh Mà Thắng`
  - `pending`: `true`
  - empty effect/type/source fields
- `data/tactics-generic.json` has stale entry:
  - `{ "viet": "Không Đánh Mà Thắng", "chinese": "不战而胜" }`
- Existing report `plans/reports/research-260703-phi-cong-che-thang-bat-mon.md` already states:
  - `非攻制胜` VN canonical: `Không Đánh Mà Thắng`
  - data conflict: current generic entry uses `不战而胜`

### Web Evidence

Searches for `不战而胜 三国志战略版 战法` do not return an official tactic page. Results mostly use `不战而胜` as ordinary prose/idiom, tournament forfeit wording, or Sun Tzu phrase.

Searches for `非攻制胜 三国志战略版 战法` return tactic-effect articles. 17173 describes it as a tactic that starts from round 3: when the ally with highest Force deals weapon damage, it heals the lowest-troop ally.

## Decision

Use:

```text
Không Đánh Mà Thắng = 非攻制胜
Bất Chiến Nhi Thắng = 不战而胜
```

But treat `Bất Chiến Nhi Thắng / 不战而胜` as **not verified as an actual tactic** until a primary source or screenshot confirms it.

## Recommendations

1. Fix dictionary source:
   - Change `Không Đánh Mà Thắng` Chinese from `不战而胜` to `非攻制胜`.
2. Add aliases:
   - `Non Công`
   - `Phi Công Chế Thắng`
   - `Phi Công`
   - `非攻制胜`
3. Remove or quarantine `不战而胜` from tactic dictionary unless a real in-game tactic screenshot/source confirms it.
4. If keeping it as pending:
   - `viet`: `Bất Chiến Nhi Thắng`
   - `chinese`: `不战而胜`
   - `pending`: `true`
   - do not let it capture `Không Đánh Mà Thắng` links.

## Sources

- Local: `data/tactics.json`
- Local: `data/tactics-generic.json`
- Local: `plans/reports/research-260703-phi-cong-che-thang-bat-mon.md`
- 17173 `非攻制胜` effect article: https://news.17173.com/z/sgzzlb/content/02012023/144949741.shtml
- 17173 SP Pháp Chính / Pháp Quan Khiên article using `非攻制胜`: https://news.17173.com/content/01142025/015701714.shtml

## Unresolved Questions

- Need an official VN screenshot/dictionary export for `非攻制胜` to lock whether final VN display should be `Không Đánh Mà Thắng` or another localized spelling.
- Need confirm whether `不战而胜` exists in any non-mainland/TW/VN localization as a tactic; no evidence found in current pass.
