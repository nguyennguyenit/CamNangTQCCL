# Failure-mode and contract review

2026-09-07. Plan only; read/rg inspection. No runtime edits, tests, lint, typecheck, builds or processes started.

## Material findings

1. **RESOLVED during review — Hero notes were an uncovered provenance display owner.** Phase 1 (`phase-01-start.md:48`) introduces only build-owned `displayNote`; Phase 2 (`phase-02-team-guide-ui.md:39-41`) removes main provenance using that contract. However `js/render.js:215` independently renders each `h.note`, and `data/khaihoang.json:341` contains “Cộng Trí Lực theo bản Kazten” followed by useful tactic instructions. Cleaning the build note/context still exposes a named source on the main card. **Fix:** explicitly audit hero notes and define neutral hero-owned presentation text while retaining original internal notes; add a regression whose only provenance sentinel is in a hero note. Preserve the tactical remainder rather than dropping the whole note or globally stripping strings.

   Resolution verified: current Phase 1:52 and Phase 2:45 explicitly cover hero-owned display notes, empty-string suppression, retained tactical content and real-data hero-note sentinels. No remaining finding here. Earlier line references above describe the pre-fix plan.

2. **P2 — Note-only hột requirements lack an explicit renderer/test obligation.** Phase 1 (`phase-01-start.md:43`) permits `{note}` and `{hero,note}` requirements without numeric bounds. The intake (`reports/image-intake.md:25`) supplies qualitative “white heroes usable, more red is better” guidance for ten images and two heroes in image 8. Phase 2 summary wording (`phase-02-team-guide-ui.md:37`) calls out only explicit minimum/recommended values; its matrix (`phase-02-team-guide-ui.md:68-69`) covers note-only splits/defenders and numeric requirements, but never note-only red requirements. There is no existing requirement renderer to inherit: current build contents are enumerated in `js/render.js:239-247`. A helper filtering entries by numeric values could pass the stated numeric boundary cases while dropping a source-backed group on most images. **Fix:** explicitly require rendering `redRequirements.note`, including whole-team note-only and named-hero note-only entries, and add independent literal E2E assertions for both with no invented numeric threshold.

## Verified boundaries; no additional finding

- Exact-build ownership and no fallback are explicit in Phase 1:46 and Phase 2:31,37,66. Legacy selector collision and source-based keyboard tests are already addressed in Phase 2:37,45; current affected assertions are `tests-e2e/khaihoang-options.spec.mjs:14,24-38,54-57,94`.
- RED setup errors are correctly excluded, and integration permits already-passing regression coverage rather than fabricated RED (Phase 3:38).
- Node requirement and preview command match `package.json` and `playwright.config.mjs`. Sequential execution, owned-process cleanup, and scoped rollback are already explicit.
- Browser runtime consumer is `js/app.js:80,94` → `js/render.js:295`. The extra `mcp-worker/scripts/build-worker-assets.ts:293-297` reference allowlists the JSON filename; no additional guide renderer was found there.
- Chạm Sứ shares the source helper (`js/render.js:257-278`); the plan explicitly preserves that independent call and its regression checks.

Unresolved inputs remain the plan's stated image 2 identity, image 7/9 representation decision, and complete transcription. These are already blocked from final completion, not new findings.

Status: DONE
Summary: Hero-note provenance gap was fixed during review. One remaining gap: explicit note-only hột rendering coverage. Other requested failure boundaries are already explicitly handled.

## Final narrow re-verification

Both findings are resolved in the plan. Phase 2:39 now explicitly renders `redRequirements.note` without requiring numeric thresholds for both whole-team and named-hero entries, preserves the qualitative source wording, and prohibits fabricating minimum 0. Phase 2:71 adds the corresponding literal-note test-matrix case. This addresses the remaining P2 finding. Read-only verification only; no implementation or tests executed.

Status: DONE
Summary: No remaining findings from this review.
