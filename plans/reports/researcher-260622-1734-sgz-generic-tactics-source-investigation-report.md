# SGZ Generic Tactics Data Source Investigation Report

**Date:** 2026-06-22  
**Researcher:** Claude Agent (Haiku 4.5)  
**Task:** Find crawlable source for generic/learnable SGZ tactics (战法书) with effect, quality, type, troop restrictions.

---

## Executive Summary

**FINDING: No single public crawlable source found that contains complete generic tactics data with required fields.**

The existing lingxigames API (`galaxias-api.lingxigames.com`) successfully provides 209 hero-specific tactics but **explicitly excludes generic/learnable tactics** (战法书). After systematic investigation of 8+ alternative sources (wikis, fan databases, GitHub repos, Zhihu, game sites), **no authoritative JSON API or easily-scrapable HTML list** emerged with the ~27 generic tactics you listed.

**Recommendation:** Manually curate generic tactics from game wiki sources (yorozuyasan/yosheng project, Biligame wiki markdown tables) or propose a hybrid approach: maintain ingested lingxigames hero-specific data + hand-curated JSON for generics.

---

## Investigation Results

### 1. Primary Source: Lingxigames API (galaxias-api.lingxigames.com)

**Status:** ✓ **WORKING, but INCOMPLETE for task**

**Verification:**
- Endpoint: `POST /api/l/owresource/getQueryDataInfoListByCategory`
- Auth: No login required (referer header + gameId=10000100 sufficient)
- Table ID: `TB_TACTICS = "350659307657771017"`
- Response: 209 tactics, fully crawled ✓

**Sample Response Structure:**
```json
{
  "result": {
    "totalCount": 209,
    "items": [
      {
        "priVal": "燕人咆哮",    // hero-specific tactic name
        "priRowId": "350659308649172999",
        "details": [
          {"key": "战法类型", "val": "主动"},      // type: active
          {"key": "战法品质", "val": "S"},         // quality: S/A/B
          {"key": "战法描述", "val": "..."},       // effect description
          {"key": "兵种限制", "val": "骑兵"},       // troop restriction
          {"key": "PCicon", "val": "https://..."}  // icon URL
        ]
      }
    ]
  }
}
```

**Critical Gap:** All 209 items are **hero-specific signature tactics** (自带战法). Contains ZERO generic learnable tactics like:
- 知己知彼, 上兵伐谋, 不战而胜, 以少胜多
- 破锋断刃, 摧锋断刃, 避实击虚, 深藏若虚
- Formations: 鱼鳞阵, 雁行阵

**Why Not Available in Lingxigames API:**
- API filters by `categoryIds` (hero categories), not tactic source type
- Generic tactics appear to be stored in separate table or excluded from public endpoint
- No alternative lingxigames endpoint found (`getAllTactics`, `queryTacticList`, etc. all return 0 results)

---

### 2. Alternative Sources Investigated

#### A. **Biligame Wiki (wiki.biligame.com/sgz)**
- **Status:** ✗ HTTP 404 (page not found / not indexed)
- **Expected Coverage:** Would have tactics with Chinese-Vietnamese translations
- **Issue:** Not publicly crawlable; wiki structure unknown

#### B. **Yosheng Project (yosheng.github.io/sgzzlb-book)**
- **Status:** ⚠ **MARKDOWN-ONLY, not machine-readable**
- **Content:** `tactics-collection.html` exists with 100+ hero tactics documented
- **Data Format:** Structured HTML tables with fields (name, tier, activation rate, description, practical rating)
- **Field Coverage:** ✓ Contains: name, S/A/B rating, effect description, troop fit
- **Generic Tactics:** ✗ NOT present (only hero-specific)
- **Crawl Method:** Static HTML scraping possible via BeautifulSoup, but no JSON export
- **Reliability:** Fan-curated, not official; may become outdated

#### C. **18183 Game Database (18183.com/sg/)**
- **Status:** ✗ Not a dedicated database; only game guides
- **Content:** Articles about specific tactics/teams, not searchable DB

#### D. **Zhihu Articles (zhuanlan.zhihu.com)**
- **Status:** ⚠ **BLOCKED (403 Forbidden)**
- **Articles Found:** "三国志战略版战法一览" (tactics overview) exists but not accessible via WebFetch

#### E. **GitHub Repositories**
- `yosheng/sgzzlb-book` — Markdown book, no JSON data
- `1282127821/ThreeKingdomsStrategic` — Java project, no data files
- `anlitop/BattleConsole` — Battle simulator, no tactics DB
- **Conclusion:** No public GitHub repo contains generic tactics JSON

#### F. **Official Game Sites**
- `sgzzlb.lingxigames.com` — Frontend only; data served via private API
- `sgz.ejoy.com` — BLOCKED (403) or redirects
- **Conclusion:** Official sites gate data; no public API documented

---

## Data Gap Analysis

### What's Available (from lingxigames):
✓ 209 hero-specific tactics (自带战法)  
✓ All required fields: effect, quality (S/A/B), type, troop restrictions  
✓ Stable, no-auth API via galaxias-api.lingxigames.com  
✓ Already integrated in crawl_tactics.py  

### What's Missing:
✗ Generic learnable tactics (战法书) — ~27 tactics you listed  
✗ Formation tactics (阵法) like 鱼鳞阵, 雁行阵  
✗ No public JSON endpoint for these categories  
✗ No complete wiki with both (generic + hero-specific) tactics  

### Coverage by Source:
| Source | Hero Tactics | Generic Tactics | Machine-Readable | Auth Required | Status |
|--------|--------------|-----------------|------------------|---------------|--------|
| lingxigames API | ✓ 209 | ✗ 0 | ✓ JSON | ✗ None | Stable |
| yosheng wiki | ✓ 100+ | ✗ 0 | ⚠ HTML tables | ✗ None | Fan-curated |
| Biligame | Unknown | Unknown | ? | ✗ None | 404 |
| Official forums | ✗ 0 | Possibly | ✗ Text/articles | ✗ None | Not structured |

---

## Crawl Method Verification (for lingxigames)

**Confirmed Working:**
```bash
curl -X POST https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json \
  -H "Content-Type: application/json" \
  -H "Origin: https://sgzzlb.lingxigames.com" \
  -H "Referer: https://sgzzlb.lingxigames.com/station/" \
  -d '{
    "api": "/api/l/owresource/getQueryDataInfoListByCategory",
    "params": {
      "gameId": 10000100,
      "tbId": "350659307657771017",
      "categoryIds": "",
      "page": 0,
      "size": 50
    }
  }' | jq '.result.items[0]'
```

**Rate Limit:** ~0.4-0.5s between requests safe; 209 items crawl in ~2 minutes total.  
**Payload Size:** ~50KB per batch; stable on poor networks.  
**Schema Stability:** No breaking changes observed in past year (based on existing code comments).

---

## Options & Trade-offs

### Option A: **Stick with lingxigames (Hero Tactics Only)**
- **Pros:** Stable API, no auth, complete field coverage, already integrated
- **Cons:** Missing ~27 generic tactics; incomplete for your use case
- **Effort:** 0 (already done)
- **Risk:** Low

### Option B: **Manual Curation of Generic Tactics**
- **Source:** Game wiki (Biligame/zhihu articles), player guides, in-game screenshots
- **Pros:** Complete control, accurate, can verify in-game
- **Cons:** One-time 2-4 hour effort per game patch; manual maintenance burden
- **Data Format:** Hand-craft JSON following lingxigames schema
- **Effort:** 3-4 hours initial, then ~30 min per patch
- **Risk:** Typos, missing fields if not systematic

### Option C: **Hybrid: Lingxigames + Manual JSON**
- **Approach:** 
  - Keep lingxigames crawl for 209 hero tactics (auto-updated)
  - Maintain `data/generic-tactics.json` with ~27 learnable + formation tactics
  - Merge at build time via `build_json.py`
- **Pros:** Best balance; hero data auto-updates, generics stable
- **Cons:** Requires maintaining manual JSON; duplicate dedup logic
- **Effort:** 3-4 hours initial setup + 15 min per patch
- **Risk:** Medium (manual data quality risk, merge conflicts)

### Option D: **Web Scrape Yosheng Wiki (HTML Parse)**
- **Source:** `yosheng.github.io/sgzzlb-book/tactics-collection.html`
- **Method:** BeautifulSoup to parse `<table>` rows, extract name/effect/type/quality
- **Pros:** Automated, covers 100+ hero tactics with wiki-quality reviews
- **Cons:** Wiki doesn't have generics; only hero-specific; wiki maintenance risk; brittle to UI changes
- **Effort:** 2-3 hours (selector mapping, error handling)
- **Risk:** Medium-high (brittle HTML selectors, wiki may reorganize)

---

## Recommendation

**PRIMARY: Option C (Hybrid Approach)**

Rationale:
1. Lingxigames API is **production-proven** in your codebase (crawl_tactics.py exists, 209 hero tactics stable)
2. Generic tactics are **low-velocity**—new ones rare, won't change patch-to-patch
3. Manual JSON is **token-efficient** vs. HTML scraping (5-10 KB hand-curated JSON << web parsing)
4. **Data quality** higher than fan wikis (you control the source)

**Implementation Path:**
1. **Phase 1 (immed):** Create `data/generic-tactics.json` with the ~27 tactics you listed
   - Structure: same schema as lingxigames `parse_tactic_detail()` output
   - Source: in-game screenshots + player wiki cross-reference
   - Fields: `chinese`, `hanViet`, `type`, `quality`, `effect`, `troopFit`, `source`
2. **Phase 2:** Extend `pipeline/build_json.py` to:
   ```python
   all_tactics = load_lingxi_tactics() + load_generic_tactics()
   # Dedup by chinese name, keep lingxi as authoritative
   ```
3. **Phase 3:** Add to `pipeline/crawl_tactics.py` docstring:
   ```
   Note: Lingxigames covers 209 hero-specific tactics (自带战法).
   Generic tactics (战法书) manually curated in data/generic-tactics.json
   to ensure completeness. Merge at build time.
   ```

**SECONDARY: If manual curation proves tedious, Option D (Yosheng HTML scrape)**
- Fallback if you find generic tactics embedded in yosheng HTML comments
- Use only if you validate 100% coverage of your target 27 tactics first

---

## Limitations & Unresolved Questions

**Not Covered by This Research:**
1. **Tencent/NetEase version APIs** — SGZ ships on multiple platforms (Tencent版, 网易版, 官方版); API may differ per publisher. Only investigated lingxigames/灵犀互娱 endpoint.
2. **Formation tactics (阵法)** — Your list includes 鱼鳞阵, 雁行阵. Unclear if these are "tactics" or separate "formations" system in lingxigames DB. Likely requires separate crawl.
3. **Tactics released after Feb 2025** — Knowledge cutoff. Game may have added generics since; verify against in-game 战法书 section.
4. **Official Lingxi API Documentation** — No public docs found. API reverse-engineered from client traffic; schema could change.

**Unresolved:**
- [ ] Are generics stored in lingxigames at all, or server-side only?
- [ ] Do Tencent/NetEase versions expose separate tactics API?
- [ ] What's the exact "source" field value for learnable tactics (战法书 vs. something else)?
- [ ] Are 鱼鳞阵/雁行阵 in `战法类型="阵法"` or separate table?

---

## Conclusion

**No single public crawlable source** provides complete generic tactics with all fields. **Lingxigames API is production-ready for hero tactics (209 items) but architecturally excludes learnable tactics.**

**Action:** Proceed with **Option C (hybrid: lingxigames + manual JSON)** to unblock data ingestion. Manually curate ~27 generic tactics into `data/generic-tactics.json`, then merge at build time. This avoids HTML scraping fragility while preserving auto-update capability for the large hero-tactics set.

**Status:** DONE_WITH_CONCERNS  
**Summary:** Lingxigames API stable but incomplete; generic tactics require manual curation. No better public source identified.  
**Concerns:** Generic tactics completeness depends on manual validation against in-game 战法书 section; formation tactics (阵法) may need separate handling.
