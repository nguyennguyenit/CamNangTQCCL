# SGZ Generic Tactics Data Source Discovery Report

**Status**: DONE_WITH_CONCERNS  
**Date**: 2026-06-22  
**Researcher**: claude (haiku-4.5)

---

## Executive Summary

After systematic investigation of 12+ potential data sources, **NO publicly crawlable JSON API currently exists for SGZ generic/learnable tactics (战法书)**. The existing lingxigames API (`galaxias-api.lingxigames.com`) only covers 209 hero-specific tactics, not the ~27 generic tactics (知己知彼, 上兵伐谋, etc.). 

**Recommendation: Manual curation + HTML scraping fallback** (see below).

---

## Findings

### 1. Primary Data Source: Lingxigames API (VERIFIED INCOMPLETE)

**Status**: Production-grade, but hero-only  
**URL**: `https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json`  
**Method**: POST  

**Coverage**: ✓ 209 hero-specific tactics / ✗ 0 generic tactics

- Endpoint: `/api/l/owresource/getQueryDataInfoListByCategory`
- Params: `gameId: 10000100, tbId: "350659307657771017", categoryIds: "", page: N, size: 50`
- Response structure: `result.items[].{priVal (name), priRowId, details[]{key, val}}`
- Fields available: 战法类型 (type), 战法品质 (quality), 战法描述 (effect), 兵种限制 (troop fit), 战法来源 (source)

**Verification**: Crawled all 209 tactics; confirmed **zero matches** for generic tactics like 知己知彼.

```
First 10 hero-specific tactics: 燕人咆哮, 威震华夏, 一身是胆, 江东猛虎, 江东小霸王, 百步穿杨, 槊血纵横, 乱世奸雄, 古之恶来, 仁德载世
```

**Adoption Risk**: ⚠️ MEDIUM
- No documented generic tactics endpoint (verified via API probing)
- Lingxigames may add generic tactics in future client/DB update
- No breaking-change history in your codebase, but API stability unknown

---

### 2. Lingxigames Web UI (NOT CRAWLABLE)

**URL**: `https://sgzzlb.lingxigames.com/station/` (战法库 listing section)  
**Status**: ✗ Fails SSL handshake / redirects to 404  
**Verification**: curl + Python urllib both timeout/redirect

The UI advertises filtering by:
- Tactic type: 指挥, 主动, 突击, 被动, 内政, 战前, 普攻, 阵法
- Quality: S, A, B
- Source: 自带战法 (hero), 传承战法 (learnable), 战法书 (generic book)

However, **no direct HTML endpoint accessible**; likely requires JavaScript rendering + session auth.

---

### 3. Community Wikis & Fan Sites (NOT STRUCTURED DATA)

| Source | Format | Generic Tactics | JSON API |
|--------|--------|-----------------|----------|
| yosheng/sgzzlb-book (GitHub) | Markdown/mdbook | Yes (mentioned) | ✗ No |
| Zhihu (知乎) | Blog posts | Yes (gameplay guides) | ✗ No |
| 9game, Ali213, 18183 | HTML articles | Yes (game guides) | ✗ No |
| BiliBili wiki | Wiki markup | Unknown | ✗ No |

**Finding**: Community content is **narrative/blog-style**, not structured game databases. Would require heavy HTML scraping + regex parsing.

---

### 4. Official Game Sources (NOT PUBLIC)

- **sgz.ejoy.com**: Redirects; no public API documented
- **TapTap/4399/Tencent**: Game distribution, no data export
- **Lingxi Games official**: No developer docs mentioning public tactics API

---

## What Data IS Available

### Hero-Specific Tactics (Via Existing API)
✓ Already in your `data/heroes-dict.json` + covered by `crawl_tactics.py`
- 209 tactics with full structure (type, quality, effect, troop fit, source hero)
- Python 3 stdlib crawl works reliably; your current pattern is sound

### Generic/Learnable Tactics (NOT AVAILABLE VIA API)
✗ Known tactics that exist in-game:
- 知己知彼 (指挥, 事件战法)
- 上兵伐谋 (?, PvP season)
- 不战而胜, 以少胜多, 破锋断刃, 摧锋断刃, 避实击虚, 深藏若虚, 深谋远略
- 因利制权, 临锋决敌, 临危救主, 刚柔并济, 功不唐捐, 忠勇义烈, 御敌屏障
- Formations: 鱼鳞阵, 雁行阵
- 解烦兵/解烦卫, 万军之中

**Source**: Game player guides (Zhihu, 18183, Ali213) confirm these exist, but no centralized DB.

---

## Recommended Solutions (Ranked)

### Option A: Manual Curation + JSON (YAGNI approach) ⭐ RECOMMENDED

**Effort**: ~30 min (one-time)  
**Maintainability**: KISS—no dependency, full control  
**Adoption Risk**: NONE

1. Gather generic tactics from in-game learning menus or player guides
2. Create `data/tactics-generic.json` with minimal structure:
   ```json
   [
     {
       "chinese": "知己知彼",
       "hanViet": "Tri Kỷ Tri Bỉ",
       "type": "Chỉ huy",
       "quality": "A",
       "effect": "[From in-game or Wiki] …",
       "source": "Sự kiện"
     }
   ]
   ```
3. No crawler needed; human verify once per season if game updates.

**Why**: Generic tactics change infrequently; API doesn't exist; wiki data is authoritative enough for reference UI.

### Option B: HTML Scraping + Headless Chrome (Medium complexity)

**Source**: yosheng/sgzzlb-book wiki or Zhihu strategy posts  
**Tool**: Puppeteer/Selenium to render + BeautifulSoup to parse  
**Cons**: Fragile (wiki restructures), slow (JS render), headless Chrome dependency  
**Risk**: Medium (abandonment if wiki changes)

**When to use**: Only if you need live updates from community wikis.

### Option C: Wait for Official API (Unlikely)

**Likelihood**: LOW  
**Timeline**: Unknown; Lingxi Games has not announced generic tactics API  
**Action**: Monitor official channels; no action needed now

### Option D: Reverse-engineer game client (NOT RECOMMENDED)

**Risk**: HIGH (terms of service, fragile, client updates)  
**Effort**: Days  
**Payoff**: Transient (client updates break it)

---

## Data Quality Assessment

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Coverage** | ⚠️ 0/~27 generic | Hero-specific: 209/209 ✓ |
| **Accuracy** | ✓ Official | Lingxigames data is authoritative |
| **Freshness** | ✓ Live | API updated with client patches |
| **Accessibility** | ✗ Generic: NO | Hero: YES (JSON API) |
| **Maintainability** | ✓ (hero) / ⚠️ (generic) | If using manual approach: low cost |
| **Authentication** | ✓ None required | No login needed for API |

---

## Technical Blockers

1. **No generic tactics endpoint**: Lingxigames API only serves hero-specific tables
2. **No public JSON schema**: Official game doesn't publish tactics metadata
3. **Client rendering required**: Web UI likely uses Vue/React; not static HTML
4. **Rate limiting unknown**: lingxigames.com doesn't document limits (assumed lenient for non-auth reads)

---

## Next Steps (For Controller)

**Immediate** (use Option A):
1. Ask team/players: Source of truth for generic tactics in-game?
2. Decide: commit `data/tactics-generic.json` with manual data, or skip for now (YAGNI)?
3. If committed: link in README + note that it's curated, not API-driven

**If live updates needed later** (Option B):
- Spike: test HTML scraping on one wiki page (30 min)
- Evaluate fragility vs. cost

**Monitor** (low-touch):
- lingxigames official announcements if they publish tactics API

---

## Unresolved Questions

1. **In-game source of truth**: Where do players learn generic tactics? Game menus? NPC dialogs? Events?
   - *Impact*: Affects whether data is discoverable/verifiable
2. **Coverage needed**: Do you need all ~27 generic tactics, or just a subset for team-filter UI?
   - *Impact*: Affects feasibility (manual curation is cheap if <10 items)
3. **Update frequency**: How often do generic tactics change (per season, per patch)?
   - *Impact*: Affects whether API vs. manual is better long-term

---

## References

- **Verified sources**:
  - Lingxigames API: `https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json` (POST)
  - yosheng GitHub: `https://github.com/yosheng/sgzzlb-book` (wiki only, no JSON)
  - Zhihu guide: Player strategies mention generic tactics

- **Web search results** (from research):
  - [Zhihu 知己知彼 guide](https://zhuanlan.zhihu.com/p/625731375) — gameplay analysis, not data
  - [18183 tactics collection](https://www.18183.com/sg/) — fan articles, no API
  - Official game: No public developer docs

---

**Report Status**: Ready for controller decision on Option A (manual) vs. Option B (scraping) vs. Option C (skip for now per YAGNI).
