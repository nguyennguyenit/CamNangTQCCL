# Audit Plan: Goi y doi tu kho

Ngay: 2026-07-10

## Summary

Plan du de sang cook, nhung can patch 5 diem truoc implement de tranh doc sai acceptance:

- core hero definition
- tactic alternative source
- existing `/analyze` baseline
- localStorage privacy
- full-box candidate pool

## Findings

### 1. "Core hero" chua gan voi data hien tai

`teams.json` khong co field core/substitute. MVP nen coi ca 3 tuong trong team record la bat buoc. Thieu bat ky tuong nao thi team khong vao main 5.

Patch: them invariant vao plan/phase 2.

### 2. Alternative tactic can explicit source

`teams.json` hien khong co tactic slash trong tactics list. Do do MVP khong nen tu invent alternative. `variant` chi xuat hien khi candidate/fixture/rule co alternatives explicit.

Patch: phase 2 phai noi ro no implicit alternatives.

### 3. Existing `/analyze` can regression without integration baseline

Worker phase co test schema/model, nhung can them route-level baseline neu co test harness. It nhat phai assert payload khong `mode` van call model voi `analyzeTeamImage`.

Patch: phase 3 add route/default baseline.

### 4. localStorage privacy needs exact key/data

Plan noi khong luu image/base64, nhung chua bat key/shape. Cook de luu nham base64.

Patch: phase 4 specify key and forbidden fields.

### 5. Full-box candidate pool cannot be tier-only

Plan noi bounded search, nhung chua include red-star/preset/diversity pool rule tu red-team addendum.

Patch: phase 2 add pool composition and diagnostics.

## Patched Decisions

- MVP engine source: `teams.json` + `team-tier.json`; no `coexist.json` engine parsing.
- All 3 heroes of a team are required in MVP.
- No implicit tactic alternative from string similarity/type.
- Store scan state under one localStorage key and strip image data before persist.
- Worker route default mode baseline is mandatory.

## Unresolved Questions

None.
