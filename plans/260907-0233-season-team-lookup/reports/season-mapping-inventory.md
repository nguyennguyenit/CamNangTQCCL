# Season mapping inventory

Date: 2026-09-12. Source: the accepted plan and [pinned source research](coexist-source-research.md), checked offline. No new network research or implied ruleset review.

| Corpus/source | Source region and label | Scenario attribution | Ruleset | Evidence/review |
|---|---|---|---|---|
| Google Sheets, gid `190730430` | VN source; no asserted upstream season label/number (`sourceSeason:null`) | `binh-dien-xuan-thu`, label **Binh Diễn Xuân Thu** | Unknown; no ruleset records | User-confirmed scenario recorded 2026-09-07; reviewed attribution only |
| Same pinned CSV | 94 CSV records, 220 physical lines, 10 columns, 5 groups, 25 teams, 75 hero positions | Observation itself grants no scope | Unknown | `coexist-binh-dien-source-snapshot`, reviewed source observation; exact SHA-256 below |
| Existing `data/coexist.json` | Legacy source; 5 groups/25 teams; labels can overlap new sheet | Unknown, null in future links | Unknown | Preserved byte-for-byte; not added as an invented scenario |
| Existing `data/teams.json` / `data/team-tier.json` | Source identifiers are editorial sources, not VN release seasons | No verified mapping entered | Unknown | Classification belongs to phase 2; old IDs/rankings remain intact |
| Khai hoang | Latest-maintained guides | Outside seasonal scope | Not applicable | Explicit user decision; unchanged |

Source URL: https://docs.google.com/spreadsheets/d/1lQEXti0U2Dcu977Np_pkuX1TJ3-x40qMX2Ze1i227Vw/edit?gid=190730430#gid=190730430

Pinned snapshot: `../research/coexist-binh-dien-xuan-thu.csv`; SHA-256 `838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb`, verified in this run. The attribution record ID is `coexist-binh-dien-scenario-confirmation`; it explicitly states that confirmation comes from the user, while the CSV does not establish ruleset applicability.

## Review boundary

The registry has one reviewed scenario with empty aliases and rulesets. Its one reviewed source mapping has null rulesetId and null sourceSeason. A source label, matching season number, crawl date or a reopened scenario never generates ruleset applicability. No legacy/source-name merge occurs. Scenario-only reference browsing is the controller's accepted implementation choice under delegated discretion; it must preserve the unknown-rules label and exclude gameplay applicability.

The source-observation proof retains the CSV checksum without publishing the CSV. Team payload and exact 5/25/75 import are phase 2 responsibilities; phase 1 does not duplicate or flatten source teams.

## Unresolved questions

Actual balance/ruleset version, source aliases and mappings for other regions, annotated hero/tactic identities, coupled alternatives, C-suffix meaning and unit-tactic effect ownership still need source/domain review before executable or scored configurations are promoted. See the source research for physical-row evidence and preservation constraints.
