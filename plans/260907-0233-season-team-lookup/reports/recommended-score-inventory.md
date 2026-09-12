# Recommended source evidence — 2026-09-12

Bounded public acquisition: [selected list](https://sgsdeck.com/recommended) plus its 25 discovered detail URLs. No account, private endpoint, paid fetch, or access restriction bypass. Raw source cache is `/tmp/tqccl-season-recommended-cache`; source evidence owner is `pipeline/sgsdeck-recommended-evidence.json`, outside the public artifact allowlist. Six-catalog helper/allowlist unchanged.

| Scope | Expected | Extracted details | Missing details | Unmapped VN applicability | Errors |
|---|---:|---:|---:|---:|---:|
| TW/source `og-兵演春秋`, 交戰 | 25 | 25 | 0 | 25 | 0 |

Observed source scores are 98, 105 and 113; copied numerically without normalization/clamping. Two source book slots remain empty after padding ordered slots; not invented. Holder names, two tactics, three books, stat focus and source notes retained. Streaming fields are inserted at their original holder placeholders; all 75 stat-focus fields are retained and unit tags exist for 24/25 records. List/detail source URL, title, score, season and available hero order must match. Each detail carries original snapshot hash, fetchedAt and TW provenance; canonicalRef null/reviewStatus pending. No evidence establishes a reviewed VN ruleset or exact canonical scored selection, so **zero public configuration scores promoted**.

The list advertises 29 upstream scopes; `recommended-scope-inventory.json` records them exactly. Only selected `og-兵演春秋` scope collected; 28 others explicitly not collected. This is not complete upstream-season coverage or a mapping to VN seasons. Source season labels are upstream metadata only.

## Validation

Tests written before source adapter validation. Initial real rendered-page parser gave 9 tests /14 failed assertions or subtests, zero import errors; list extraction and null score already passed, negative boundaries and detail score failed. See `recommended-red.log`. After validators and header selection: `python3 -m unittest tests.test_sgsdeck_recommended -v` **9 passed**. Cases include actual 25-card fixture, score113, exact holder/books, missing score null, duplicates, count/parser/login drift, partial detail, canonical URL, unsafe URL, list/detail mismatch and checksum-failure preservation/offline parity. Fixtures retain actual rendered streaming chunks with source provenance; scripts/layout/decorative SVG removed.

Full source candidate: `python3 -m pipeline.sgsdeck_recommended --cache /tmp/tqccl-season-recommended-cache --output /tmp/tqccl-recommended-candidate.json` passed 25/25. Then offline same cache promoted normalized source evidence. Module performs no network; fetch research was separate, sequential, bounded to4MiB/response,20-second timeout,250ms pacing and allowlisted redirects. Source failure stops acquisition; output builder validates full candidate before atomic single-file replacement.

Review regressions: deferred holder fields/missing chunk produced two real assertion failures before correction (`recommended-stream-red.log`); incomplete selected-scope publication produced one real failure (`recommended-completeness-red.log`). Both corrected; final focused suite **12 passed**, production cache rebuilt with all 25 details. Pure joining may describe a partial research inventory, but canonical publication rejects any missing detail. The positive offline-publication test uses a controlled one-card scope retaining its pinned source card verbatim.

## Remaining data gaps

VN ruleset applicability, complete canonical configuration/selection identity, and review of source alternatives/conditions. Remaining upstream scopes not collected. These facts prevent promotion of source scores to executable VN configurations; source research does not manufacture them.

User authorization clarified on 2026-09-12: storage and website display explicitly include Recommended configurations and scores. The optional authorization question is closed; see [execution decision](execution-decisions.md). The remaining gaps above concern data evidence, not pending user permission.
