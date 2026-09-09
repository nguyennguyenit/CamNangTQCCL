# Cross-plan scan

Date: 2026-09-07. Status: verified by plan/source inspection.

## Relationships

- `260907-0233-season-team-lookup`: previously included Khai hoang in seasonal content links/UI. User explicitly superseded that decision. Updated index and all four execution phases to exclude Khai hoang from season filtering. Content-link kind/dataset now coexist only. No hard dependency; both plans must integrate edits to js/render.js sequentially. New plan owns main Khai hoang display and guide data; seasonal plan owns other scope controls and tests that scope changes leave Khai hoang unchanged. Both indexes link this boundary; blockedBy/blocks stay empty because file overlap is not an output dependency.
- `260907-0228-sgsdeck-catalog`: independent catalog/entity work. Existing dictionaries contain new roster heroes. No import dependency; don't mutate this plan.
- `260626-1600-cap-nhat-data-tuong-tier-ui`: historical pending index despite implemented UI. No replay or status repair; not prerequisite.
- `260906-1431-khaihoang-source-options`: local completed record; current JSON/render reuse its variants but latest/no-source display supersedes main-card presentation only. No reopen.
- `260907-0236-cham-su-khai-hoang`: completed prerequisite behavior already in source. Preserve independent chamSuTeams, never restore legacy transforms.

## Safety and validation

Only plan files updated. Runtime untouched. Existing docs/deployment.md and old tier-plan WIP preserved. Static search found no remaining active kind/dataset khaihoang seasonal union, no four-group scope or shared-selection derivation for khaihoangTable. Historical source descriptions and text “khai hoang” inside Cùng Tồn notes remain legitimate, not seasonal control of the Khai hoang section.

## Unresolved

None for dependencies. Gameplay transcription gaps are tracked in the new plan.
