# Security / fact and consumer contract review

Scope: static curated guide data, exact-build consumption, literal DOM text, privacy of screenshot inventory, and current-only main-card presentation. Read-only inspection; no test, lint, type or build commands executed. Plan was changing during review; findings refer to the observed revision containing build-owned `displayLabel`/`displayNote`.

## Findings

1. **P2 — Neutral wording contract misses hero-owned attribution.** `phase-01-start.md:48` defines only build-owned presentation fields; `phase-02-team-guide-ui.md:41` relies on that contract to remove attribution from existing prose. However, `js/render.js:215` independently renders `h.note`, and `data/khaihoang.json:341` contains the public hero note “Cộng Trí Lực theo bản Kazten.” Removing the banner, sources, variant labels and build notes still leaves a named source on the default Lục Tốn card, contrary to the accepted no-source presentation. Extend the owning contract to hero notes (for example, an optional hero-owned `displayNote` with explicit empty suppression), preserve original metadata, and explicitly require a hero-note-only source sentinel regression. Retain the tactical advice after curating neutral wording. Do not globally strip the word “nguồn”: `data/khaihoang.json:330` uses it for damage role, not attribution.

## Unresolved questions

None for this finding. Image 2 roster and image 7/9 representation remain explicitly pending in the plan; this review does not resolve the source images.

Status: DONE
Summary: One concrete main-card provenance leak remains outside the proposed build-owned display contract.
Concerns/Blockers: Controller should reconcile this report with concurrent plan edits before implementation.
