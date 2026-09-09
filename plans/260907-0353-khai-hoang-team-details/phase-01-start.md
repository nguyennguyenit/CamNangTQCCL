---
title: "Phase 1: Start"
status: completed
phase: 1
priority: P1
effort: ""
dependencies: []
---

# Phase 1: Start

## Overview

Curate all 11 images into guides owned by their three-hero rosters, as selected by the user on 2026-09-09. This phase is the single schema owner; UI and integration consume the contract below. Read the brainstorm/research linked in `plan.md` and `reports/image-intake.md` before transcription.

## Requirements

- [x] Preserve every evidenced instruction; do not import personal owned/missing status or owned hột counts.
- [x] Resolve each guide's three-hero roster identity; keep same-roster variant invariants and preserve any tactic/stage conditions in the guidance.
- [x] Never run `python -m pipeline.build_json`: historical HTML rebuilding would overwrite curated variants/guides.

## File and test inventory

| Action | File | Observed responsibility/size |
|---|---|---|
| Modify | `data/khaihoang.json` | ~1,566 lines; currently 15 opening teams, 5 mine groups, 8 Chạm Sứ groups |
| Modify | `tests-js/khaihoang-data.test.mjs` | ~85 lines; 3 current tests for spear configuration, variants and Chạm Sứ isolation |
| Create | `tests-js/fixtures/khaihoang-guide-expectations.json` | Small independently reviewed expected image records |
| Create | `plans/260907-0353-khai-hoang-team-details/reports/image-transcription-ledger.md` | Full 11-image field ledger and final build mapping |
| Read | `data/heroes-dict.json`, `data/tactics.json`, `pipeline/aliases.json` | Vietnamese canonical names |
| Read | `tests/test_parse_secondary.py`, `docs/code-standards.md`, `docs/system-architecture.md` | Historical fixture boundaries and runtime ownership |

No deletions. Counts above describe current inventory, not final assertions. Historical parser fixture totals must not be changed to match curated runtime data.

## Architecture: owning guide contract

Optional `teams[].guide` belongs to the team's three-hero roster, independently of its default tactic fields. Store each guide once on the parent team; do not store, copy or override it on `variants[]`. Same-roster variants share the displayed guide explicitly. Omit unknown fields instead of supplying zero/placeholders. Empty objects/arrays are tolerated by rendering, but omitted from curated data.

| Field | Shape and meaning |
|---|---|
| `overview` | Optional characteristics/purpose string |
| `ratings` | Optional numeric `land4`, `land5`, `land6`, `land7to8`, `transition`, `overall`; preserve raw values including zero, no inferred denominator |
| `redRequirements` | Array of `{hero?, minimum?, recommended?, note?}`; hero omitted only for explicit whole-team guidance; numbers only when explicitly supported |
| `defenders` | `{land4?: [{hero, unitType?}], land5?: [{hero, unitType?}], warning?: string}`; source order means easiest → hardest |
| `splitTeams` | `{note?: string, teams?: [{heroes?: [{name, tactics?: string[]}], target, note?}]}`; source rows may retain a reviewed prose `note` when they combine alternatives/roles that cannot be represented without inventing structure. Each row has either `heroes` or a non-empty `note`; image 2 keeps its note-only “not recommended splitting”. |
| `transitions` | Array of `{target, note?, steps: [{trainHeroes?: string[], mainCityLevel?: number, commandCost?: number, timing?: string, note?: string}]}`; steps preserve order within each destination route |

Transition steps retain city-7 training, city-8 switching and conditional 48-hour instructions separately. Complex milestones remain faithful text in `timing`/`note`, not invented numeric triggers. Defender warnings never re-sort the supplied arrays; image 10 can retain Trần Kiểu second despite the general warning.

Keep existing source/season metadata outside the guide. No root `transforms`, guide provenance machinery, automatic score calculation or inventory state. The card reads `team.guide` once outside the selected-build replacement boundary; the variant selector never chooses a guide. Absence of `team.guide` means no guide for that roster, even if an invalid variant payload contains one.

When meaningful guide content exists, show the fixed compact note “Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp.” This note describes applicability, not provenance. Keep all evidenced tactic, unit, stage and timing qualifications in the relevant existing guide text fields; roster ownership does not make conditional guidance universally valid for every configuration. Main tactics, commanders, unit and tactical build notes remain build-owned. No new guide-scope enum or scoring engine is needed for this single accepted ownership model.

For old `context`/`note` prose or build labels containing season/source attribution, preserve original internal fields and curate optional build-owned `displayLabel` and `displayNote`, plus hero-owned `displayNote` for neutral public wording only where needed. These are presentation fields outside `guide`; no global regex stripping. Keep useful tactical qualifications in the curated public text. The hero row must prefer its reviewed `displayNote` when present (including an explicit empty string), otherwise retain only reviewed neutral legacy notes. Enumerate every existing hero note during curation; do not discard all notes.

## Mapping and evidence ledger

Each image needs actual session image identity, full three-hero roster and its parent team, six transcribed groups, qualifications and reviewed disposition. Track researched main builds, unknown tactics/unit and their stage evidence separately from the roster guide. Do not invent attachment file paths. Use intake scores/orders as independent test anchors; translate defender names against the existing mine catalog rather than requiring every NPC in the playable hero dictionary.

| Image | Expected roster / special handling |
|---|---|
| 1 | Lục Tốn · Tả Từ · Trương Xuân Hoa |
| 2 | Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ; user confirmed 2026-09-07, Trình Phổ is later-stage replacement |
| 3 | Gia Cát Khác · Quan Ngân Bình · Nhạc Tiến; retain spear configuration |
| 4 | Hạ Hầu Uyên · Thái Sử Từ · Hoàng Nguyệt Anh |
| 5 | Khương Duy · Hạ Hầu Uyên · Gia Cát Khác |
| 6 | Khương Duy · Hạ Hầu Uyên · Pháp Chính |
| 7 | Trương Xuân Hoa · Lữ Bố · Tả Từ; new roster |
| 8 | Gia Cát Khác · Thái Sử Từ · Tả Từ; Từ minimum 3 đỏ |
| 9 | SP Chu Tuấn · Hạ Hầu Uyên · Gia Cát Khác; new roster |
| 10 | Khương Duy · Quan Ngân Bình · Thái Văn Cơ |
| 11 | SP Viên Thiệu · Hạ Hầu Uyên · Trương Xuân Hoa |

User decision on 2026-09-09: “Theo bộ ba tướng”. Map each guide to the matching roster using the exact three canonical hero identities, independent of row order, selected tactics and commander position. Do not merge distinct heroes such as SP/non-SP versions. A different third hero requires a separate team; no cross-roster sharing. If multiple parent records match the same roster, review their identity before choosing an owner rather than silently taking the first. Missing main-tactic evidence does not block attaching a reviewed roster guide, but still prevents inventing a verified build. The guide score is not a separate rating of the default or any variant.

For 7/9, user chose research on 2026-09-07. Read [stage-specific tactic evidence](../reports/research-260907-1421-khai-hoang-missing-tactics.md): image 7 has six learned tactics at level 32, image 9 has three learned tactics before level 20 and six at level 22 (full video 00:10, Gia Cát Khác becomes leader); both observed with bows. Preserve the reported leader and deputies. User supplied two personal pre-20 options for image 7: Hoa/Thịnh Khí, Bố/Thôi Phong, Từ/Võ Phong; or Bố/Thôi Phong, Hoa/Tam Thế, Từ/Thịnh Khí. Keep both as personal proposals, not verified main builds. Do not infer leader positions from list order or confirm the Tam Thế activation rationale without checking its conditions. Image 9 post-awakening build is resolved from the full video; independent confirmation remains absent. Use the six exact tactics in the report and preserve the stage-specific leader change. The roster-guide decision does not discard this researched build data or select the superseded roster-only-card proposal. Image 2 identity and roster-level score ownership are confirmed. Final count is derived only after roster resolution.

## Build expectations and validation scope

The independent fixture must identify each reviewed default or variant build explicitly, match hero rows by canonical name, and record exact expected values or deliberate absence for `commanderBefore`, `commanderAfter`, `unitType`, `heroes[].unitTypeBefore`, `unitTypeAfter`, `tacticBefore` and `tacticsAfter`. Cover task-owned new or changed stage fields on root teams as well as variants; existing variant-only validation is insufficient. Assert the evidenced commander value, not merely that an optional commander belongs to the roster. Use the existing build fields; do not add guide-owned commander fields.

| Evidence | Required independent expectations |
|---|---|
| Image 9, before level 20 | `commanderBefore` is SP Chu Tuấn; all three heroes have `unitTypeBefore: "Cung"` and their exact single learned tactic from the research table. |
| Image 9, observed level 22 | `commanderAfter` is Gia Cát Khác; all three heroes have `unitTypeAfter: "Cung"` and their exact two learned tactics, in source slot order. Hạ Hầu Uyên and SP Chu Tuấn remain deputies. |
| Image 7, observed level 32 | `commanderAfter` is Trương Xuân Hoa; all three heroes have `unitTypeAfter: "Cung"` and the six learned tactics assigned exactly as researched. Lữ Bố and Tả Từ remain deputies. |
| Image 7, before level 20 | Keep both user proposals in the evidence ledger as personal assessments. In the verified level-32 build, assert absence of unverified before-stage commander/unit/tactic fields; do not backfill from that later stage or promote a proposal into verified data. Revise expectations only when new evidence resolves the stage. |

For both researched builds, the observed build unit is Cung. Transcribe tactic expectations independently from the linked research tables, never from runtime JSON; stage verification does not establish a tactic-specific score. Phase 2/3 consume these same reviewed build expectations separately from roster-guide expectations on the real route.

Strict canonical hero/tactic checks apply to newly structured guide references and new or changed build reference fields within this task. Preserve source-faithful prose split notes as text; do not parse alternatives into invented holders. Preserve unchanged legacy fields by exact pre-edit comparison, including fields on a build receiving a new guide. Baseline strings such as `Hoành Tào Thiên Quân`, `Tiềm Long Trận/Tam Thế Trận` and `Giải Phiền Vệ/Thịnh Khí Linh Địch` are not single exact tactic-dictionary entries; do not require global dictionary equality or normalize them to pass this feature's tests. Any test-only legacy exception must identify the existing build, hero, field and literal value; it cannot permit that value in newly curated fields. Retain existing variant checks without weakening them. No runtime validator, alternatives schema, alias sweep or pipeline rebuild is required.

## Implementation Steps

1. Read current affected files and `git status --short`; record scoped pre-edit payload snapshots for unrelated teams/mines/Chạm Sứ. Select supported Node 22 before verification; observed shell is Node 24.14.0, not compatible with `>=22.12.0 <23`.
2. Complete and review full image transcription. Build expected fixture independently from reviewed source facts, never by exporting runtime data. Example anchors: image 1 overall 6.96, image 8 ratings 9/10/10/8.5/8.5/9.2 and Từ minimum 3.
3. RED: add assertions for missing parent-team guide values, exact separate land-4/5 arrays, all resolved image-to-roster mappings, note-only split guidance, defender warnings and ordered city/48-hour steps. Validate that curated variants have no `guide` and preserve the exact same three heroes as their parent. Include the exact root/variant stage expectations above: image 9's SP Chu Tuấn → Gia Cát Khác commander change, image 7's verified after-stage commander, learned tactic slots, units and deliberate omissions. Run `node --test tests-js/khaihoang-data.test.mjs`. Require expected behavior assertion failures; missing imports/fixtures or incompatible tools are setup failures.
4. Validate optional shapes, finite numeric values including zero, minimum versus recommendation and absence of inventory-state fields. Apply strict canonical reference checks only to the task-owned new/changed fields defined above; compare preserved legacy fields with their pre-edit values. Preserve source ordering and qualifications.
5. GREEN: edit only mapped curated fields; add confirmed new rosters with honest omissions. Preserve variant IDs, main tactics and internal metadata. Use canonical `Hoành Tảo Thiên Quân` in new text; do not merge `Sĩ Tranh Tiên Phó` and `Nhanh Chân Tranh Đất` or sweep unrelated aliases.
6. Re-run focused tests, review JSON against ledger, refactor only real duplication and rerun if changed. Record RED/GREEN results.

## Todo

- [x] Full ledger reviewed and unresolved inputs explicitly tracked.
- [x] Independent expected records and focused data tests written before data changes.
- [x] Curated fields implemented and focused suite GREEN.

## Test matrix

| Behavior | RED signal | GREEN evidence |
|---|---|---|
| Correct image/roster mapping | Missing guide or wrong parent team | Independent exact values on the confirmed three-hero parent; build evidence kept separate |
| One roster guide across variants | Copied/overriding variant guide or different third hero accepted | Guide stored once at `teams[].guide`; variants have no guide and preserve the exact canonical roster |
| New/changed default and variant stage fields | Missing commander, wrong in-roster commander, wrong hero/tactic slot or invented stage | Exact researched commander/unit/tactic values; explicit absence for unverified image-7 before-stage fields |
| Canonical references within task scope | New unknown reference accepted or unchanged legacy rejected | New/changed references match dictionaries; preserved alias/compound fields equal pre-edit values; no blanket exemptions |
| Ordered defenders and warning | Missing sequence/warning | Separate exact arrays and unchanged general catalog |
| Red requirements | Minimum 3 absent or ownership copied | Correct named requirement and no personal state |
| Note-only split / multi-step transition | Lost negative advice or flattened steps | All qualified source text and ordered milestones preserved |
| Optional/zero values | Wrong validation | Valid absent fields and finite zero; invalid types rejected |
| Compatibility | Existing variant/Chạm Sứ tests fail | Original 3 checks remain, no root transforms, unrelated payloads preserved |

## Success Criteria

- [x] All 11 input dispositions resolved before final completion; no silently deferred image.
- [x] Phase 2 receives schema, real partial/complete examples and exact absence semantics.
- [x] One guide per resolved roster, no variant-owned guide or cross-roster sharing, no fake tactics/unit or inferred scores.
- [x] Root/variant stage expectations catch wrong or missing commanders and tactic assignments; canonical checks preserve unchanged legacy fields.
- [x] Focused data tests GREEN and unrelated JSON preserved.

## Risks and rollback

| Risk | Observable signal | Response |
|---|---|---|
| Wrong roster | Third hero differs / substitution unresolved | Stop that attachment and resolve identity; continue other records |
| Missing main build | Only split tactics visible | Use confirmed omission policy or obtain evidence; never copy split tactics |
| Lost milestone/warning | Ledger text has no schema field | Preserve ordered step text or group note within this owning contract |
| Curated data lost | Unexpected variant/mines/Chạm Sứ deletions | Restore only task-owned edits from pre-edit state; never reset all WIP |

Rollback removes only newly added task fields/teams/tests using recorded pre-edit state. No generated assets or production changes in this phase.
