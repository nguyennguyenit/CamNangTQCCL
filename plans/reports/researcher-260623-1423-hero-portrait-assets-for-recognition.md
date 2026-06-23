# Research Report: Hero Portrait Assets For Recognition

---
type: research
created: 2026-06-23 14:23 Asia/Ho_Chi_Minh
topic: hero portrait/icon availability for screenshot hero recognition
---

## Executive Summary

Có. Nguồn Lingxi hiện trả đủ ảnh tướng cho 112/112 tướng trong `武将库`: `PCicon`, `移动icon`, `PC立绘`, `移动立绘`; một số có thêm `组合内图`.

Repo hiện chỉ giữ `iconUrl` trong `data/heroes-dict.json`. Cache raw local đã có full-body portrait URLs, và live API kiểm tra lại vẫn trả đủ field. Vì vậy có thể build portrait-recognition dictionary mà không cần tự scrape HTML/headless.

Khuyến nghị: dùng `PCicon` 150x150 trước cho matching ổn định, fallback `PC立绘` 350x500 khi screenshot là artwork lớn. Không hotlink runtime nếu cần tốc độ; nên build offline asset index hoặc embedding/hash cache.

## Research Methodology

- Sources consulted: 6
- Date range: local crawl cache 2020-2022 asset URLs, live API checked 2026-06-23
- Search terms used: `sgzzlb lingxigames 武将库`, `galaxias-api getQueryDataInfoByPriId`, `三国志战略版 武将 立绘`
- Gemini CLI: unavailable for skill flow because local `timeout` command missing; used local repo + live API + Web/API verification.

## Key Findings

### 1. Existing Repo Data

`data/heroes-dict.json` has 112 heroes and all 112 have `iconUrl`.

Sample:

```text
SP荀彧 -> https://cloud.lingxigames.com/2022/12/6/784754556276502534.png
曹操 -> http://image.aligames.com/s/y9s/g/2020/5/15/445977754491435012.png
SP郭嘉 -> https://cloud.lingxigames.com/2022/12/6/784809234725007369.png
```

### 2. Raw Cache Has Full Portraits

`pipeline/raw_crawl_cache.json` has for each 112 heroes:

| Field | Count | Meaning |
|---|---:|---|
| `PCicon` | 112 | square icon |
| `移动icon` | 112 | mobile icon, same size/content in samples |
| `PC立绘` | 112 | full-body artwork |
| `移动立绘` | 112 | mobile full-body artwork |
| `组合内图` | 5 | combo image, sparse |

Sample Cao Cao:

```text
PCicon: http://image.aligames.com/s/y9s/g/2020/5/15/445977754491435012.png
PC立绘: http://image.aligames.com/s/y9s/g/2020/5/22/448543141301073928.png
```

Downloaded sample dimensions:

```text
PCicon: 150 x 150 PNG
PC立绘: 350 x 500 PNG
```

### 3. Live API Still Returns Portrait Fields

Live endpoint checked:

```text
POST https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json
api: /api/l/owresource/getQueryDataInfoListByCategory
tbId: 350659087930767364
gameId: 10000100
```

Result on 2026-06-23:

```text
totalCount 112
first 曹操
PCicon ...445977754491435012.png
移动icon ...445977866951969795.png
PC立绘 ...448543141301073928.png
移动立绘 ...448543365994133512.png
组合内图 ...357899401976363008.png
```

This matches `pipeline/crawl_tactics.py`, which already has `TB_HEROES = "350659087930767364"` and detail endpoint `getQueryDataInfoByPriId`.

## Comparative Analysis

| Approach | Accuracy | Cost | Risk | Recommendation |
|---|---:|---:|---:|---|
| OCR printed name | High if name visible | Low | fails when name hidden | Keep |
| Vision LLM guesses portrait | Medium | Medium | hallucination | Do not trust alone |
| Icon template/embedding matching | High for cropped icon/card portraits | Low-medium | crop quality | Best first step |
| Full-body portrait matching | Medium-high | Medium | screenshot crop/background differs | Fallback |
| Infer from tactics/team | Medium | Low | shared tactics cause false positives | Use as tie-break only |

## Implementation Recommendations

### Quick Start

1. Extend `parse_hero_detail()` to keep:
   - `iconUrl`
   - `portraitUrl`
   - optional `mobileIconUrl`, `mobilePortraitUrl`
2. Rebuild `data/heroes-dict.json`.
3. Build offline reference assets:
   - download icon/portrait to cache ignored by git, or
   - compute pHash/embedding and commit only small JSON descriptors.
4. Screenshot analyzer:
   - crop each hero column portrait zone
   - compare against reference icons/portraits
   - return top 3 candidates + confidence
5. UI:
   - auto select if confidence high
   - otherwise show `Chưa rõ` + candidates

### Minimal Data Shape

```json
{
  "chinese": "曹操",
  "viet": "Tào Tháo",
  "iconUrl": "...445977754491435012.png",
  "portraitUrl": "...448543141301073928.png"
}
```

### Recognition Strategy

```text
OCR name visible?
  yes -> dictionary match
  no  -> crop portrait -> icon/portrait match -> top candidates
                   -> tactics/team tie-break
```

Use confidence gates:

```text
>= 0.88: auto accept
0.72-0.88: show candidates
< 0.72: Chưa rõ
```

## Security / Legal / Ops Considerations

- CDN URLs are public but not a documented stable API contract. Cache breakage possible.
- Do not commit downloaded PNGs unless license/product decision accepts that.
- Safer: store source URLs + generated hashes/embeddings, cache images at build/runtime.
- Respect rate limits: build offline, avoid downloading all images per user request.
- Do not send user screenshots to extra third-party services beyond existing Vision Worker unless disclosed.

## Resources & References

- Local crawler: `pipeline/crawl_tactics.py`
- Local dict: `data/heroes-dict.json`
- Local raw cache: `pipeline/raw_crawl_cache.json`
- Official station: https://sgzzlb.lingxigames.com/station/
- Mobile station: https://sgzzlb.lingxigames.com/m/station/
- Live data endpoint: https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json
- Asset CDNs observed: `image.aligames.com`, `cloud.lingxigames.com`

## Next Actions

1. Add `portraitUrl` fields to `heroes-dict`.
2. Build small script to validate/download 112 icons + 112 portraits to ignored cache.
3. Prototype crop+match on 5 screenshots, including user-provided image.
4. Decide algorithm after prototype:
   - simple pHash/template if enough
   - CLIP/image embedding if pHash fails on cropped portraits

## Unresolved Questions

- Can we store downloaded hero PNGs in repo, or only generated hashes/embeddings?
- Need recognition only for screenshots from guide images like user sample, or also live in-game formation screens?
- Confidence threshold acceptable for auto-fill vs candidate display?
