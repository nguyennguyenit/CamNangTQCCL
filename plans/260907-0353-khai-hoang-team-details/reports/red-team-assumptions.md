# Red-team assumptions and cross-plan review

Reviewed 2026-09-07. Plan documents only; no code changes or test/build execution. Read the accepted brainstorm, intake/cross-plan reports, finalized new index and three phases, old seasonal index and four phases; inspected actual JSON/render owners to verify concrete paths. Original 11 images were not available to this isolated reviewer, so this is not an independent visual/OCR verification of the intake numbers.

## Findings

### Medium: roster-only matching can present an unverified guide as exact-build advice

`phase-01-start.md:68` authorizes default guide attachment when the image omits main tactics, using the verified three-hero roster and an internal ledger limitation. This does not establish applicability to the existing default. The accepted brainstorm `../reports/brainstorm-260907-0347-khai-hoang-team-details.md:29` requires guidance to match the selected configuration. Phase 2 renders `build.guide` directly as that selected build's scores and land guidance.

Concrete counterexample: `data/khaihoang.json:998` explicitly distinguishes the same-roster Gia Cát Khác/Thái Sử Từ/Tả Từ default for land 5 from a Sĩ Biệt variant for land 6. Image 8 covers scores through land 7–8. Choosing the existing default solely because all three names match can attach those scores to a tactic setup that the image never established. Preventing fallback to other variants does not prove the default assignment.

Proposed fix: require documented applicability evidence before exact-build attachment. When the image establishes only a roster, keep its guidance under an explicitly qualified unknown-main-tactics presentation, or leave attachment unresolved until evidence establishes the build. Do not claim an exact match solely from absence of a contradiction. Preserve all-11 completion and continue independent records; do not manufacture tactics or drop images.

### Medium: neutral presentation contract misses source-bearing hero notes

`phase-01-start.md:48` defines only build-owned `displayLabel`/`displayNote`; `phase-02-team-guide-ui.md:41` consumes that contract for old context/note prose. Yet actual main-card hero rows render `h.note` directly at `js/render.js:215`. Source attribution already exists in `data/khaihoang.json:341,1177` (Kazten) and `:961` (CN/KR and season language). Changing build notes and removing source links therefore still leaves forbidden attribution visible inside normal main cards.

Proposed fix: explicitly include hero-owned neutral note presentation in the schema/data inventory and `khaihoangHeroRow` consumer contract. Preserve original internal notes and tactical qualifications. Add an actual-data regression proving these hero notes retain gameplay advice while removing attribution; do not rely solely on build-note/source-link sentinels or global regex stripping.

## Verified boundaries without findings

- Seasonal `phase-02-season-team-configurations.md:21-24,38` restricts links to coexist; `phase-03-season-lookup-interface.md:50` excludes main Khai hoang from projection; phase 4 explicitly rejects seasonal khaihoang kind/dataset. Index final boundary supersedes historical reports. No active reintroduction found.
- Image 2 remains unresolved and is not assigned to Thái Văn Cơ. Images 7/9 omission is expressly a proposal awaiting the actual response. Final count is derived, not fixed; all 11 dispositions remain a completion gate.
- Six optional groups include negative split advice, defender warnings, ordered transitions and zero/unknown semantics. Chạm Sứ and global mines stay separate.
- The older plan and new plan can implement independently with sequential shared-file integration; absence of blockedBy is consistent with that ownership boundary.

## Unresolved questions

Image 2 full roster; actual user response for 7/9 representation; full image transcription; evidence tying any tactic-omitted image to an exact existing default.

Status: DONE_WITH_CONCERNS
Summary: Two evidence-backed Medium contract gaps; seasonal exclusion and pending-input/all-11 boundaries otherwise hold.
