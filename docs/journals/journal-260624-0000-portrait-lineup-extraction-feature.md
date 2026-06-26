# Portrait Lineup Extraction + Troop Manual Integration

**Date**: 2026-06-24 02:00
**Severity**: Medium
**Component**: Image analysis pipeline, books dictionary, Worker schema
**Status**: Resolved (commit 41c25ba pushed)

## What Happened

Shipped feature: analyze squad composition from portrait images (binh thư + portrait recognition + icon confirmation). Full TDD → red-team → 3-phase implementation → 2 review rounds → merged.

## The Brutal Truth

Almost wasted 8-10 hours crawling wiki + building auto-link machinery for troop manuals. Red-team caught the fatal flaw: **VN game version uses TRANSLATION NAMES, not Sino-Vietnamese literals**. Example: 铁甲 → "Giáp Sắt" (VN), NOT "Thiết Giáp" (Sino-Viet). This breaks the entire `link_tactics.py` normalization strategy that works for generals + tactics.

Pivot was brutal: switched to manual mapping table `books-han-viet-map.json`. Cost-benefit: +2 hours new approach vs. ∞ hours debugging phantom auto-links.

## Technical Details

### Key Finding: Name Encoding Mismatch
- **Problem**: `link_tactics.py` normalizes Sino-Vietnamese (铁甲 → 鐵甲 → thiết giáp pattern)
- **Reality**: Books table uses VN translation (铁甲 → "Giáp Sắt")
- **Impact**: Zero facet matches; entire dictionary dead on arrival
- **Detection**: Red-team OCR test + manual game-data spot check

### Data Gap
- Lingxi station library only has 4 corpora: 武将/战法/战备/兵种
- No 兵书库 → cannot crawl books
- Manual entry: 36/74 books seeded; incomplete but functional

### Portrait Guessing Trade-off
- B0 requirement: infer general from portrait alone
- Risk: LLM hallucination + false positives
- Mitigation: added `nameFromPortrait.sure=false` flag + `matchDict` threshold check
- Accepted: tolerate 15-20% false negatives to avoid toxic hallucination

### Test Coverage
```
Python: 71 tests (pipeline validation + books dict)
JS: 46 tests (portrait OCR + lineup assembly)
Worker: 42 tests (schema + scoring logic)
```

## What We Tried

1. **Auto-link via wiki crawl** → Blocked: Sino-Viet normalization ≠ VN translation names
2. **Partial auto-link + fallback manual map** → Accepted: faster pivot, known coverage limits
3. **Aggressive portrait guessing** → Red-team rejected: hallucination risk; added confidence flag

## Root Cause Analysis

We assumed game localization preserved transliteration rules. It doesn't. VN team chose idiomatic translations that break pattern matching. Should have diff'd 1-2 troop names against actual game strings before architecting the link layer.

## Lessons Learned

1. **Verify data contracts early**: Spot-check 5 samples from external sources before designing pipeline
2. **Red-team catches architectural bets**: Pre-commit review must include "does this assume hold?" pass
3. **Manual lookup tables beat speculative automation**: Smaller scope, verifiable, maintainable
4. **Portrait inference needs confidence**: Never guess general identity without explicitness flag; consumer handles risk

## Next Steps

- Crawl remaining ~38 troop manual entries (async, low priority)
- Monitor false-positive rate on portrait matching in production
- Document VN game name divergence in `docs/project-overview-pdr.md`

**Files modified**:
- `/Users/plateau/Project/CamNangTQCCL/pipeline/build_books_dict.py` — new manual map loader
- `/Users/plateau/Project/CamNangTQCCL/pipeline/books-han-viet-map.json` — lookup table
- `/Users/plateau/Project/CamNangTQCCL/data/books-dict.json` — seeded books
- `/Users/plateau/Project/CamNangTQCCL/worker/src/schema.ts` — book record shape
- `/Users/plateau/Project/CamNangTQCCL/worker/src/model.ts` — scoring + matching
- `/Users/plateau/Project/CamNangTQCCL/js/analyze.js` — portrait + books display
- `/Users/plateau/Project/CamNangTQCCL/js/app.js` — UI wiring
- `/Users/plateau/Project/CamNangTQCCL/css/styles.css` — books detail panel layout
