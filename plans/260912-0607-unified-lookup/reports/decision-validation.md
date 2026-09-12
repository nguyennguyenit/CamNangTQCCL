# Decision validation — 2026-09-12

## Basis and boundary

This is the `--deep --tdd` planning validation, not implementation acceptance.
The accepted [brainstorm](../../reports/brainstorm-260912-1203-unified-lookup.md)
and current repository evidence provide the decisions below. No new user
interview was performed or implied. There are no remaining product questions
that require asking the user to repeat these decisions.

| Decision | Status | Implementation consequence |
|---|---|---|
| Six Vietnamese lookup groups in one experience | User accepted | All six groups, children, and detail states are required; no deferred translation tranche. |
| Hide source names, URLs and selectors in catalog UI | User accepted | Keep provenance in private inputs/reports; preserve existing team score policy. |
| Preserve existing Vietnamese names and canonical IDs | User accepted | Baseline parity tests and reviewed new identity registry before merging. |
| SGSDeck meaningful fields win conflicts | User accepted | All 11 known differences become output assertions; do not require separate regional approval. |
| Missing/placeholder source values fall back | User accepted | Field-specific presence rules preserve valid zero/false and real legacy content. |
| Agent reviews Chinese identity and translation | User accepted | Agent owns all 259 candidates, unmatched records and semantic review; user need not read Chinese. |
| Truly absent content displays “Đang cập nhật” | User accepted | Distinguish unavailable facts from untranslated available facts; no bulk placeholder shortcut. |
| Candidate merge is checked before UI integration | User accepted | Private staged output, validation, then bounded promotion and UI wiring. |
| Season/config/tier/score work has a separate owner | User accepted | Conditional identity dependency, serialize shared-file changes, no whole-plan blocking cycle. |
| Existing MCP compatibility | User accepted | Preserve existing tools/kinds and historical fixtures; no new catalog API. |

## Engineering choices

The frozen legacy baselines, offline merge builder, one supplemental catalog,
public generation manifest, and recoverable serialized promotion are technical
design choices within the accepted scope. They are not presented as separate
user approvals. Existing source importer ownership remains intact; the new
builder must never read its generated dictionaries as input.

## Evidence limits

- Baseline commands and results are recorded in [controller-scout.md](controller-scout.md).
- Those 13 Python and 26 Node passing tests do not prove the proposed merge/UI
  exists or satisfy future Red → Green → Refactor requirements.
- Structural plan validation, external fact checks and adversarial review will
  be recorded separately after the draft is finalized.
- All four implementation phases remain pending. Planning has not authorized
  deployment, publishing, commits, or replacing active runtime data.
