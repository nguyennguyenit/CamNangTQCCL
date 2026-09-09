---
title: "Phase 2: Team guide UI"
status: completed
phase: 2
priority: P1
effort: ""
dependencies: [1]
---

# Phase 2: Team guide UI

## Overview

Consume the [Phase 1 schema](./phase-01-start.md#architecture-owning-guide-contract) for compact roster summaries and expandable instructions within each card, outside the selected-build block. User selected roster-level guide/score ownership on 2026-09-09. Depends on reviewed real image examples; do not redefine the schema here.

## Requirements

- [x] Six optional groups, note-only guidance, warnings and ordered transition steps render faithfully.
- [x] One guide per three-hero roster; same-card guide and disclosure state survive build changes, with no neighboring card changes or empty badges.
- [x] Remove existing main Khai hoang season/source display while preserving internal metadata and Chạm Sứ source behavior.

## Related code and inventory

| Action | File | Owner / size |
|---|---|---|
| Modify | `js/render.js` | ~324 lines; `khaihoangTeamCard`, `showBuild`, root Khai hoang renderer |
| Modify | `css/styles.css` | ~777 lines; adjacent Khai hoang rules around 298–317 |
| Modify | `tests-e2e/khaihoang-options.spec.mjs` | ~125 lines; 7 current cases |
| Read | `docs/code-standards.md`, `playwright.config.mjs` | Safe DOM, keyboard controls, preview lifecycle |

No new runtime module, dependencies or deletions expected. Coordinate `js/render.js` edits sequentially with the season plan; no blocking dependency.

## Architecture

Use existing `el` text nodes for every imported string. Local helpers return null for absent groups. Create one `.kh-guide` from the parent `t.guide` in `khaihoangTeamCard(t)`, as a sibling outside `.kh-build`; create no block for genuinely empty content. `showBuild(build)` replaces only `.kh-build` and updates selected-build unit/tactics/commanders, never reads or renders a guide. Unknown selected unit renders no badge. Keep existing main roster separate from secondary split rosters in DOM selectors.

Summary shows overview, available rating categories and explicit minimum/recommended hột. Within every nonempty roster guide, show the compact note “Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp.” Render redRequirements.note even with no numeric threshold: both whole-team note-only and named-hero note-only entries are meaningful. Preserve “tướng trắng dùng được, càng đỏ càng tốt” without fabricating minimum 0. Use null checks so zero survives. Show raw rating values, not an assumed denominator, percent win rate, inferred tier or rating of the selected build. Preserve any conditional tactic/unit/stage wording in the guide.

Create one native `details` when any detailed content exists, including note-only split advice or warning-only defenders. A Vietnamese summary such as “Hướng dẫn đánh đất và chuyển hình” expands separate ordered land-4/5 rankings with warning, split-team note and teams, and transition routes with ordered steps. Omit genuinely empty headings. Retain city-level units, command costs and qualified timing exactly when supplied.

The guide disclosure starts collapsed on card creation. Switching default → variant → another variant → default preserves the same guide content, applicability note and open/closed state, while selected tactics/commanders update. Do not reconstruct the guide in `showBuild`. A team without `t.guide` stays guide-less on all variants; variant-only guide data never supplies an override or fallback. Preserve neighbors' text, selection and open state. Use distinct nested hero classes or scope primary tests to `.kh-build > .heroes`.

Preserve the existing `build.commanderBefore` / `build.commanderAfter` display. Consume Phase 1's independent stage expectations for root teams and variants: image 9 must show SP Chu Tuấn before level 20 and Gia Cát Khác after level 20, with each hero's researched unit and learned tactic slots. Image 7's verified later-stage build shows Trương Xuân Hoa after level 20 and omits unverified before-stage values. Scope stage assertions to the selected `.kh-build` and its primary hero rows; no commander inference from roster order or guide inheritance.

Remove root Khai hoang season banner, main-card period/region/source labels and links. Preserve internal metadata and meaningful variant selection. Use neutral tactic-based option labels from actual differences; no provenance in labels, titles or ARIA text. Resolve label collisions with evidenced build differences. Leave Chạm Sứ sources and other sections unchanged.

Audit existing build `context`/`note` and every `hero.note` prose too. Use the Phase 1 optional `displayLabel`/`displayNote` contract where original text mixes useful tactics with attribution; do not fall back to attribution-bearing text or globally strip strings with regex. Add real-data regressions for source/season appearing only in old note/context or hero.note (for example Kazten and CN/KR), with neutral tactical notes still visible. Update `khaihoangHeroRow` to honor hero-owned displayNote, including empty-string suppression; do not use truthy fallback that revives attribution.

## Implementation Steps

1. Read affected files. Identify deliberate contract changes: source-link expectations, source-based keyboard type-ahead and global transition-absence assertions. Scope old transition absence to Chạm Sứ/guide-less legacy contexts while adding positive new-guide assertions.
2. RED: add focused E2E cases using existing `routeKhaihoang` and independently reviewed image subsets. Add real-route cases using actual JSON and Phase 1's independent expectations for image 7/9 commander labels, stage units/tactic slots and explicit unknown-stage omissions; include default builds, not only variants. Synthetic zero/markup/empty fixtures are test-only boundary inputs, never published fake records. Require working setup before capturing behavioral failures. If an existing stage-rendering behavior already passes, record regression coverage rather than fabricate RED.
3. Inspect port with `lsof -nP -iTCP:4174 -sTCP:LISTEN`; run `npx playwright test tests-e2e/khaihoang-options.spec.mjs --project=astro`. Capture missing-guide/current-only assertion failures; build or browser setup failure is not RED.
4. GREEN: implement small local guide helpers at card scope outside the build replacement boundary. Keep build changes confined to existing unit/tactic/commander display. Remove scoped main metadata UI and update neutral option labels without changing source records or variant IDs.
5. Add adjacent wrapping and visible-focus CSS. Reuse `minmax(min(100%, 320px), 1fr)` / `min-width: 0` pattern when current 320px grid floor overflows. Avoid hiding or truncating instructions.
6. Run focused suite GREEN; inspect actual long content at 375px/1280px and 320px boundary. Refactor only real repeated code, rerun affected tests after changes.

## Todo

- [x] RED assertions capture intended guide and current-only behavior.
- [x] Roster summary/details and independent selected-build behavior implemented.
- [x] Focused E2E and viewport checks GREEN.

## Test matrix

| Case | RED signal | GREEN result |
|---|---|---|
| Six available groups | Guide absent | Exact literal expected summary and detailed content |
| Each missing/empty group; no guide | Empty/incorrect UI | No blank headings; existing roster works |
| Note-only split and warning-only defenders | Disclosure absent | Meaningful notes visible without fake team/list |
| Whole-team / named-hero note-only hột | Qualitative condition dropped | Exact literal note survives without numeric threshold |
| Zero and minimum/recommended-only | Value lost/conflated | Zero visible, faithful labels |
| Default → variant → another variant → default | Guide disappears, duplicates, changes or collapses | Exactly one unchanged roster guide and applicability note; disclosure state preserved while tactics/commanders change |
| Two distinct roster guides | Other roster's guide appears | Each card retains its own exact ratings, defender order and conditional instructions |
| Parent without guide; variant-only guide fixture | Variant invents or overrides roster guidance | No guide or applicability note rendered for that parent; malformed variant guide ignored |
| Actual image-9 root/build stage data | Commander missing or identical across stages; tactics on wrong hero/stage | Exact SP Chu Tuấn → Gia Cát Khác labels and independently expected stage units/tactic slots |
| Actual image-7 verified later-stage build | Wrong after-stage commander or unverified before-stage values appear | Trương Xuân Hoa after-stage label, exact researched units/tactics and absent unverified before-stage values |
| Open neighboring card | Neighbor state changes | Text, selection and disclosure unchanged |
| Two rosters' land-4/5 ordering | General ranking or another roster's order reused | Exact source-reviewed sequences for each parent guide |
| City-7 then city-8 and conditional 48h route | Flattened steps | Ordered milestones and conditions visible |
| 375/1280 keyboard controls | Missing focus/toggle | Enter/Space toggle details; selector changes right build |
| 320/375 long content | Horizontal overflow | Document/card fit, text and tags wrap |
| Markup string | Injection/element created | Literal text only, no injected event |
| Main season/source sentinel | Old metadata visible | No main banner/link/option provenance; Chạm Sứ links retained |
| Confirmed incomplete roster | Empty badge/placeholder | Three names and known guide; unknown fields omitted |
| Legacy array and absent/empty Chạm Sứ | Old behavior regresses | Original compatibility cases pass with scoped assertions |

Use independent expected literals, never derive expectations from the same runtime guide. Controlled fixtures may include two distinct parent-roster guides and multiple same-roster variants with different tactics. A variant-only guide fixture tests rejection of unsupported ownership; do not publish it or invent live variant scores.

## Success Criteria

- [x] Exact Phase 1 contract consumed, including negative split advice and ordered route steps.
- [x] Guide reads only the parent roster, remains unchanged across build switches, and never leaks across rosters; primary assertions exclude secondary split teams.
- [x] Real-route stage labels and primary hero rows match Phase 1's independent root/variant expectations, including deliberate omissions.
- [x] Main Khai hoang current-only presentation complete; internal metadata and Chạm Sứ unchanged.
- [x] Keyboard/mobile/desktop evidence and focused GREEN recorded.

## Risks and rollback

| Risk | Signal | Response |
|---|---|---|
| Shared renderer overlap | Concurrent hunk changes | Controller sequentially integrates and reruns affected tests |
| Secondary hero selector collision | Main count includes split heroes | Scope primary rows or give secondary rows distinct classes |
| Hidden source labels remain | Metadata sentinel in text/attributes | Inspect all main card/option display owners |
| Optional or long text breaks layout | Empty section/overflow | Fix conditional helper and owner wrapping without dropping content |

Rollback task-owned JS/CSS/assertion hunks only, preserving prior WIP. Preview uses port 4174; inspect unknown owner, never increment ports or kill user processes. Stop only processes started here.
