# Khai hoang guide data: local inventory and schema recommendation

Date: 2026-09-07. Scope: plan-only, local evidence. No code/data changes, no external research. Accepted contract: `plans/reports/brainstorm-260907-0347-khai-hoang-team-details.md:7-28,40-74`.

## Phase 1 inventory

Runtime JSON contains 15 opening teams, 5 mine groups, and 8 independent Chạm Sứ groups. Opening teams have no stable IDs; match by full normalized three-hero roster plus actual build details, never array position or two shared heroes. Existing `variants[]` are alternative builds for the SAME roster; tests enforce roster equality (`tests-js/khaihoang-data.test.mjs:17-25`).

| Image | Existing title location in data/khaihoang.json | Action |
|---|---|---|
| 1 | 355 | Match Lục Tốn/Tả Từ/Trương Xuân Hoa; compare tactics before attaching guide |
| 2 | 875 is Bình/Tiến/Thái Văn Cơ | Unresolved: screenshot summary mentions replacement Trương Phi; not an exact roster match |
| 3 | 177 | Khác/Bình/Tiến; spear unit already protected by test |
| 4 | 455 | Uyên/Từ/Nguyệt Anh |
| 5 | 266 | Khương/Uyên/Khác |
| 6 | 665 | Khương/Uyên/Pháp Chính |
| 7 | No matching opening team | Add Trương Xuân Hoa/Lữ Bố/Tả Từ only with evidenced main build |
| 8 | 964 | Khác/Từ/Tả Từ; minimum 3 red on Từ recorded by accepted image inventory |
| 9 | No matching opening team | Add SP Chu Tuấn/Uyên/Khác only with evidenced main build |
| 10 | 836 | Khương/Bình/Thái Văn Cơ |
| 11 | 754 | SP Viên Thiệu/Uyên/Trương Xuân Hoa |

All 15 titles were enumerated from runtime JSON; neither new roster exists. Dictionary already contains the potentially new heroes: SP Chu Tuấn (`data/heroes-dict.json:64-89`), Lữ Bố (`724-749`), Trương Xuân Hoa (`1324-1349`), Trương Phi (`1564-1589`). Adding these teams does not inherently require dictionary additions.

## Minimal optional schema

Attach one optional `guide` object to the exact build object (`team.guide` or `variant.guide`). Six optional groups:

- `overview: string` — characteristics and intended use.
- `ratings: { land4?, land5?, land6?, land7to8?, transition?, overall? }` — numeric scores transcribed from images. Omit absent scores; do not substitute zero or infer a denominator. Establish the displayed scale during transcription before adding any hardcoded `/5` or `/10` label.
- `redRequirements: [{ hero, minimum?, recommended?, note? }]` — numbers only where explicitly stated; note can retain qualifications or whole-team guidance. Hero may be omitted only for a clearly whole-team requirement. Never copy personal owned red counts.
- `defenders: { land4?: [{ hero, unitType? }], land5?: [{ hero, unitType? }] }` — array order means easiest to hardest for THIS build. Use existing mine enemy naming shape; do not derive it by sorting global `mines`.
- `splitTeams: [{ heroes: [{ name, tactics?: string[] }], target: string, note?: string }]` — optional tactics retain only evidenced slots. These are subteams of the opening build, not `chamSuTeams` and not main build tactics.
- `transitions: [{ target: string, trainHeroes?: string[], mainCityLevel?: number, commandCost?: number, timing?: string, note?: string }]` — preserve ordered alternatives/stages as transcribed; target may retain a named destination build rather than inventing a full roster. Keep qualified milestones in notes when they cannot be represented faithfully as a single integer.

Do not add season/version/source requirements to this guide. Keep each group absent when unknown; omit empty UI sections. No root `transforms`: it previously conflated Chạm Sứ with transitions and is expressly prohibited by existing assertions (`tests-js/khaihoang-data.test.mjs:84`). A nested `guide.transitions` gives the real new behavior an unambiguous owner without weakening that regression.

Guide selection must use `build.guide` inside existing `showBuild(build)` (`js/render.js:236-249`); no fallback `build.guide || team.guide`, which would leak default guidance onto a different configuration. Existing switching replaces the whole content subtree and restores the default, so no new state store is needed. If identical guidance is later evidenced on two builds, attach it deliberately rather than inheriting by default.

## Image 2 and missing main builds

Image 2 cannot be resolved from the supplied text inventory. Default roster is explicitly Bình/Tiến/Thái Văn Cơ (`data/khaihoang.json:838-875`); existing `cn-thanh-chau` also retains Thái Văn Cơ (`878-924`). No local evidence proves whether Trương Phi is a selected substitution, an alternative portrait, or a transition destination. Controller must re-read the actual image and separate identity from personal ownership display before attachment. If it is a true alternate roster, existing same-roster `variants[]` cannot represent it without an intentional contract change; a separate canonical team is the smaller change. Do not weaken roster checks just to fit it.

Images 7/9 are confirmed absent by runtime roster inventory, but accepted report explicitly says main tactics remain incomplete (`brainstorm...:73-74`). No main build can be reconstructed safely from split teams, arbitrary teams.json matches, or another roster sharing two heroes. Phase 1 should create a field-by-field transcription ledger for all 11 images and mark main before/after tactic slots that the images do not establish. Missing evidence limits those fields, not the entire guide implementation. Do not hardcode final team count to 17 until image 2 identity is resolved.

## Compatibility and normalization

- Existing global mine list is a general catalog (`data/khaihoang.json:1207-1254`), rendered independently (`js/render.js:281-290`). Leave it intact and add per-build rankings separately.
- Existing source/season display is broader than the new guide: renderer emits period/region, sources and root season (`js/render.js:240,246,257-264,301-304`). Accepted report says no new season/source labels for guides; if controller interprets latest-only as removing these existing opening-card displays too, update their owning assertions deliberately rather than silently retaining them. Internal source metadata need not be deleted to suppress presentation. Chạm Sứ source display is a separate owner (`js/render.js:267-278`).
- Canonical new tactic spelling is `Hoành Tảo Thiên Quân` (`data/tactics.json:1022`); old `Hoành Tào` is a recognized alias (`pipeline/aliases.json:24`). Existing main builds contain that alias (`data/khaihoang.json:844`). Avoid unrelated global normalization churn.
- `Sĩ Tranh Tiên Phó` and `Nhanh Chân Tranh Đất` are separate dictionary entries (`data/tactics.json:2477,4349`); existing note explicitly says alias equivalence is unconfirmed (`data/khaihoang.json:915`). Do not merge them. Canonical `Hổ Báo Kỵ` is at `data/tactics.json:1254`.
- Do NOT run `python -m pipeline.build_json` for this import. `build_khaihoang_payload` only parses historical HTML (`pipeline/build_json.py:99-105`), and main overwrites runtime JSON (`:112-123`). It has no overlay/merge mechanism and would erase curated teams, variants and new guides. Keep curated JSON the editing surface; pipeline redesign is unnecessary for this task. Historical parser fixture intentionally has 11 teams and 6 Chạm Sứ groups (`tests/test_parse_secondary.py:113-122`), so those counts must not be updated to runtime totals.

## Test inventory and missing coverage

Executed `node --test tests-js/khaihoang-data.test.mjs`: 3/3 pass. No browser server started.

Existing checks:

- Node: Khác/Bình/Tiến spear phases (`:8-15`); variant IDs, same roster, phase completeness, tactic dictionary/type/troop fit, duplicate tactics and commanders (`:17-55`); exact independent Chạm Sứ groups and no root transforms (`:57-85`). Default main builds do not receive all variant checks.
- E2E `tests-e2e/khaihoang-options.spec.mjs:11-45`: every variant swaps only its card, expected tactics/source links, restores default; `:48-59`: 375px keyboard selection/overflow; `:84-124`: 1280/375 Chạm Sứ structure/order, absent/empty/legacy data.
- Python `tests/test_parse_secondary.py:21-49,55-122`: historical mine/roster shape, Chạm Sứ isolation/alternatives, boundary perturbation, absent tables, pure deterministic parser payload.

Required focused additions:

1. Validate optional guide shapes and numbers, preserving zero as actual data; canonical hero/tactic references; unique ranked defender identities where applicable; no owned/missing inventory state fields.
2. Assert actual image-derived scores, 4/5 defender order, and image 8 Từ minimum 3 using reviewed transcription expectations, not expectations computed from the same runtime JSON.
3. Validate new main builds independently: three known heroes, only evidence-backed phase tactics, no accidental copy from split-team tactics; phase incompleteness must be explicitly supported/rendered if unavoidable, never fabricated.
4. Render all six groups and each independently absent; zero scores visible; unknown values do not become generic recommendations.
5. Switch guide-bearing default to a guide-less variant and back: correct guide disappears/restores, neighbor unchanged. Include distinct guides on two variants if those data exist.
6. 375/1280px expandable details, keyboard toggle, mobile overflow. Ensure split/transition `.hero` or tactic elements do not break existing broad `card.locator('.hero')` assertions; scope main hero rows deliberately.
7. Existing E2E global absence of `Chuyển hình đề xuất` (`:94,123`) must become assertions scoped to Chạm Sứ/legacy contexts, not forbid legitimate new guides. If season/source UI is removed, update `:14,24,36-38` and keyboard type-ahead dependent on source label at `:54` intentionally.
8. Preserve unrelated teams, global mines and independent Chạm Sứ payloads; maintain legacy array compatibility (`js/render.js:295-299`).

## Unresolved questions

- Actual image 2 selected roster and build tactics.
- Evidenced main before/after tactics and unit types for images 7/9.
- Complete image transcription (rating scale, ties/qualifications, milestones); screenshot files were not provided to this delegated research context.
- Controller should settle whether latest-only/no-sources removes prior card metadata or solely governs the added guide; accepted report explicitly narrows no-new-label acceptance to the guide.

Status: DONE_WITH_CONCERNS
Summary: Local inventory, optional six-group schema, compatibility boundaries and focused test gaps are ready for phase planning.
Concerns: Image-only facts remain unresolved; do not infer missing main tactics or attach image 2 to the Thái Văn Cơ roster.

### Follow-up: honestly representing incomplete new teams

Main tactic incompleteness does not require blocking creation of a roster-only team. Existing `khaihoangHeroRow` always renders name and only renders Before when `tacticBefore` exists, After when `tacticsAfter` has entries (`js/render.js:197-215`). Thus new teams may honestly contain `heroes: [{ name }, ...]` plus the evidenced guide, omitting unknown tactics/phases; add a concise team note that main tactics are not established from the supplied image. Do not put placeholder tactics into arrays. If top-level unit type is unestablished, current unconditional badge (`js/render.js:221,237-238`) needs a small conditional-render adjustment to avoid an empty badge. Historical parser completeness assertions apply to fixture output, not new curated JSON. The same-roster variant test also does not require default team tactic completeness. Gate only attaching unverified tactic/identity facts, not the entire new team. This supersedes any interpretation above that new team creation itself must await a complete main build.
