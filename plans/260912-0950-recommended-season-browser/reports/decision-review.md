# Decision review

Date: 2026-09-12. Scope: planning and browser research, not completed UI delivery.

## Latest user decision

Initial Team khác intake uses existing local teams and concrete variants that do not duplicate Team chuẩn. New research or battle-report evidence is not required for this initial pass. Preserve known attribution; show `Nguồn chưa xác định` when missing. Future external additions require actual research or player battle-report attribution. SGSDeck player-sharing pages are not automatically Team chuẩn: that membership comes from Recommended.

## Kongming advice disposition

Accepted: separate dedup identity from source/full-build identity; exact hero variant plus tactics assigned to each hero; ignore hero display order and tactic slot order, books, stats, equipment, leader role and season for collection dedup. Preserve those details in full builds. Compare against the whole accepted Team chuẩn snapshot before UI filters. Preserve distinct supported options if another option duplicates; ambiguous identity is not proof of uniqueness. Recompute derived membership with source updates and preserve last-good data on incomplete acquisition.

Rejected as superseded: requiring new attributable research or battle reports for every existing local team's initial admission. The latest explicit user instruction permits this initial existing-data intake. This changes the provenance requirement, not the requirement to actually compare heroes and assigned tactics.

## Evidence and limits

- Live source observations and saved snapshots: [browser research](./browser-research.md).
- Observed 29 season options, not 29 fully captured datasets. Full acquisition/reconciliation and concrete admitted/duplicate/unresolved counts remain implementation work.
- New plan phases remain pending. No complete UI, all-season import or behavioral validation is claimed.
- Existing four-file parser/display spike remains uncommitted and isolated in `feat/season-team-lookup`; root WIP is preserved.
- Browser session check returned `No active sessions`; no task dev server was started.
- Plan structural validation does not establish implemented behavior. Kongming consultation is a bounded decision review, not a completed multi-reviewer implementation audit.
- Journal CLI project discovery returned exit 1; local journal is written directly under the owning repository's `plans/journals/` to avoid the known enclosing-project registry mismatch. AgentWiki publish skipped.

## Plan verification

All four plan files were reread after the planner handoff. Relative Markdown links resolve; all three phases remain pending. `ak plan validate plans/260912-0950-recommended-season-browser --json` passed structural validation. Behavioral gates remain planned work.
