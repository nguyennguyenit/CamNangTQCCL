# Implementation review — Chạm Sứ

Date: 2026-09-07. Mode: accepted plan, `--tdd --auto`. Scope: parser/payload, curated JSON, renderer/styles, source fixtures, focused tests and owning architecture documentation. No code mutations or build/E2E runs by reviewer.

## Decision

**PASS — 9.5/10. No unresolved code findings.** One low documentation issue was reported to controller and corrected before this final review: the architecture document now identifies the actual `khaihoangTable` export. Final broad gates remain owned by the tester; this review does not substitute for their results.

## Acceptance and evidence

- Independent parsing: `parse_cham_su_teams` detects the right header, uses right-side blank rows to delimit groups and never consults main-team boundaries. Merged alternatives are read only from origin cells and stored once at group scope. The fixture perturbation removes left-side continuation while retaining the complete right table.
- Source reconciliation: reviewer directly parsed the checked-in CSV fixture and compared all eight runtime hero/tactic pairs: exact equality. Fixture equals I–K records 19–44 of the original saved CSV, including header/separators. Reviewer also compared parser output for the full historical HTML with the HTML fixture: exact equality, six groups. The deliberate Tôn Thượng Hương/Lăng Thống tactic change and two CSV-only pairs agree with the reconciliation report.
- Preservation: reviewer independently loaded `khaihoang-baseline.json`, removed only baseline `teams[].transforms` and current `chamSuTeams`, and compared complete objects: equal. All 15 main teams, variants/options, five mines, season and season note remain unchanged. Fifteen teams had the former field; seven contained nonempty erroneous attachments.
- JSON shape and identity: independent groups use stable hero-derived IDs, two source heroes, the source note and Google Sheet provenance. Runtime alternatives occur once. No third hero, unit type, commander, tier or inferred mechanics were introduced.
- UI: new cards sit between main teams and mines; `.cham-su-card` cannot enter existing `.kh-card` option selectors. The only main-card rendering removal is the erroneous transforms attachment. Original option E2E assertions remain intact. New tests cover desktop/mobile, block ordering, content/provenance, missing/empty groups and legacy mines arrays.
- Safe DOM and responsive styling: renderer uses existing text-node `el`, tactic chips and HTTPS-filtering source helper with `noopener noreferrer`. Card CSS follows existing panels and allows wrapping. UI report records seven passing E2E cases and visual inspection at 375px; reviewer did not rerun the tester-owned browser process.
- Pure helper / clean clone boundary: `build_khaihoang_payload(html_path)` only calls the three relevant parsers and returns their results. It does not invoke full builder, read team/coexist inputs or write data. Required `TestChamSu` cases use the repository fixture without source-presence skips and assert deterministic payload and unique group IDs.
- TDD: parser report records the preimplementation transforms assertion failure, then nine focused passing tests. UI report records the missing-heading failure before rendering changes, followed by seven passing cases. Migration red/green and final combined gates are controller/tester evidence responsibilities.
- Compatibility/docs: deliberate removal of `teams[].transforms`, additive independent field, known browser owner, HTML/CSV divergence and curated rebuild limitations are documented. No speculative consumer compatibility layer is required by the observed source.

## Limits and unresolved questions

No unresolved implementation questions. Broader validation completion and migration red/green consolidation must be recorded by controller/tester before final delivery. No commit, deployment or full JSON builder authorization is implied.

Status: DONE
Summary: Source, parser, curated preservation and UI contract review passed; the sole low documentation symbol mismatch was corrected and reread.
