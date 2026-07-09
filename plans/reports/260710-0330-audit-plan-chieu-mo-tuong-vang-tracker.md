---
type: plan-audit-report
date: 2026-07-10
topic: chieu-mo-tuong-vang-tracker
plan: plans/260710-0330-chieu-mo-tuong-vang-tracker/plan.md
status: passed-after-patch
---

# Audit Plan: Theo dõi chiêu mộ tướng vàng

## Verdict

PASS AFTER PATCH. Plan is safe to implement with TDD.

## Checks

| Check | Result | Evidence |
|---|---|---|
| Brainstorm scope carried forward | Pass | Plan locks `Danh tướng PK`, limited banners, multi-account, localStorage, export/import |
| Deferred items excluded | Pass | Plan explicitly excludes `Tướng tài PK`, OCR, cloud sync, “chiêu mộ tiếp 2 lần”, `5+1 core pity` |
| Red-team High risks mitigated | Pass | Event-like `pullEvents` source of truth, import validation, free-text hero, local date guard |
| Repo architecture respected | Pass | Vanilla ES modules, `app.js` orchestration, module/test split |
| TDD order enforced | Pass after patch | Phase 2 is RED-first; Phase 3 patched to require UI/view-model RED test |
| Cross-plan conflicts | Pass | Pending hero/tier plan is read-only overlap; tracker does not modify pipeline hero data |

## Finding Patched

### A1 - UI phase treated tests as optional

Severity: Medium.

The first draft of Phase 3 allowed UI test to be optional. That violated the user-requested `--tdd` workflow and the TDD skill’s no-production-code-before-failing-test rule.

Patch applied:

- `phase-03-tdd-ui.md` now creates `tests-js/recruit-tracker-ui.test.mjs`.
- First implementation step requires a failing UI/view-model test.
- Success criteria require the UI/view-model test to fail before implementation and pass after implementation.

## Implementation Constraints

- Store tests must be written and observed failing before `js/recruit-tracker-store.js`.
- UI/view-model test must be written and observed failing before `js/recruit-tracker.js`.
- Import must validate in memory before writing to localStorage.
- Pity must be derived from `pullEvents` or recomputed after mutation.
- Daily slot date keys must use local date strings, not UTC.

## Unresolved Questions

None.
