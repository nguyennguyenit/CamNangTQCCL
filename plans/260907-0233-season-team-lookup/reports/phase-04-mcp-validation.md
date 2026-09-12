# MCP seasonal contract validation

Date: 2026-09-12. Scope: the accepted phase-04 MCP consumer, exact artifact union, confirmation/cursor context, bounded output, and workflow identity. Release packaging changes and their tests were owned by the controller; see `review-season-release.md` and its release logs. No commit, deployment, paid fetch, or corpus rebuild was performed.

## Delivered contracts

- `ARTIFACT_NAMES` remains the six-name legacy alias. `SEASON_ARTIFACT_NAMES`, `V2_ARTIFACT_NAMES`, and `artifactNamesForVersion()` select exactly six or eleven artifacts. `DataManifestV1 | DataManifestV2` preserves the v1 identity algorithm. Filesystem selection is none/all/partial-error; the static manifest version is authoritative. Full raw hash/count/cross-reference/season validation precedes activation. Source-owned groups above ten teams are rejected at MCP activation.
- One public snapshot view removes Đô Úy teams, configs, evaluations, linked references, and exclusively associated evidence before indexing/projecting. Shared evidence remains when visible records still reference it. Public output retains the original raw release identity.
- Eight tool names and four search kinds remain. Discovery advertises `manifestVersion`, `capabilities`, and reviewed `seasonRegistry`. Every other seasonal input requires a complete reviewed scenario/ruleset pair. No-context inner outputs retain the legacy path; discovery schemas must be refreshed for the accepted output migration.
- Canonical state carries the explicit pair. Seasonal normalization uses `projection:v2-season` and its own digest domain; legacy `projection:v1` bytes/domain remain unchanged. Confirmation rejects request/state context differences, stale data/workflow, and edited canonical state. Field insertion order does not change pair equality. Cursors bind query, kinds, pair, workflow, and full release identity.
- Config search uses the shared `teamSearchBlob` and includes configured hero/tactic alternatives. It exposes config IDs and can page all 501 test configs. Detail and replacements refuse ambiguous/mismatched configs; holder/slot selection remains explicit when needed. Detail exposes the fixture's 132.5 source score. Engine selection changes and replacements do not inherit that score.
- Shared candidate projection precedes engine execution and any legacy slicing. Unsupported mandatory conditions stay excluded even in experimental mode, with bounded config-specific diagnostics. Candidate 501 returns a non-retryable limit error; it never returns a partial portfolio.
- Seasonal references preserve IDs, classification, source, summaries, literal multiline/raw content, three hero positions, two tactic slots and three book slots. The five-group/25-team/75-position fixture survives projection. Byte fitting removes optional detail before whole groups, keeps valid surviving schemas, and reports omitted groups and any raw-text truncation. Legacy reference projection is unchanged.
- Error schemas require `choices` only for `CONFIG_AMBIGUOUS` and `limits` only for `CANDIDATE_LIMIT_EXCEEDED`. Counts, unique code-point ordering, ID bounds, and exact omissions remain runtime-validated. One strict error object plus permissive branch constraints avoids the disjoint-strict-intersection trap. The exported JSON schema preserves required payloads and wrong-code rejection; the SDK root remains object-shaped.

## Red → Green evidence

The following counts refer to the actual named commands executed in the worker. Initial Red runs inherited Node 24.14.0; the final package gate detected that shell mismatch at `test:node-min`. All final verification below was rerun with the explicit Node 24.20.0 PATH. The later audit Red runs used that explicit PATH as well. No missing-import or no-test-file run is counted as behavioral Red.

| Command, relative to `mcp-worker/` | Actual Red | Green evidence |
|---|---|---|
| `npm test -- test/data/season-snapshot.test.ts` | 3 failures: 11-name inventory refused, filesystem produced v1, broken seasonal cross-reference not activated correctly | Initial 3 passed; with legacy artifact tests, 12 passed. Later valid 11-team source group was accepted (1 failure); validator fix yields final 4 passed. |
| `npm test -- test/research/season-research.test.ts` | Initial 5 failures: digest equality, discovery rejection, context search/detail/normalization gaps | 5 passed after context implementation. Two added recommendation/replacement failures then passed with the shared projector. Final 10 passed, including later assertion Reds for dropped requirement diagnostics and hero/tactic search. |
| `npm test -- test/research/season-errors.test.ts` | Missing structured `choices` failed before serializer implementation | Initial 1 passed. A later context-field-order test failed before semantic comparison; final 3 passed, including exported JSON-schema inspection. |
| `npm test -- test/research/season-bounds.test.ts` | Malformed nested slots and unordered choices were accepted (2 assertion failures) | 4 passed after strict schemas. A spy attempt on a frozen adapter failed during setup and is not counted as behavioral Red. Added 5/25/75 regression passed. Later two assertion Reds exposed retained private evidence and unreported text truncation; final 6 passed. |
| Official SDK transport and catalog suites | Full suite exposed the Zod refined-object `.partial()` incompatibility, then the enlarged catalog's HTTP `RESULT_TOO_LARGE` regression | Plain outer objects plus strict nested schemas fixed SDK discovery. Concise descriptions/error factoring fixed catalog size. All eight tools, ambiguity, scenario-only rejection, and 501 limits pass through stdio/HTTP; CLI preserves choices/limits. |
| `npm test -- test/mcp/registry.contract.test.ts` | Existing agent-facing-description checks caught missing descriptions; new full-catalog `<88000` regression failed at 88,202 and 88,018 bytes | Final 16 passed. AJV compiles every advertised input/output and rejects missing/wrong/both/extra error payloads and retryable=true for the limit error. |

The transport, score-alternative, five-group snapshot, and some release-inventory tests were added as regression coverage after the corresponding behavior existed; no separate test-first Red is claimed for each of those cases. Refactoring kept legacy branches and the shared resolver/engine authoritative.

## Final verified gate

Every final command prepends:

```sh
export PATH=/Users/plateau/.nvm/versions/node/v24.20.0/bin:$PATH
```

`npm run check` passed on Node **24.20.0**, including:

- **351 tests / 43 files**, with coverage statements **91.08%**, branches **85.30%**, functions **95.90%**, lines **91.75%**; existing thresholds were retained.
- Workflow identity check and local-secret check.
- Main and Worker typechecks, TypeScript build, exact Node-pin smoke test, and artifact-only control-plane verification.

Evidence: `phase-04-mcp-check.log`. The log supersedes the earlier 24.14.0 attempt, which passed functional checks but failed the exact Node-pin smoke check.

The complete UTF-8 JSON-RPC discovery response is **87,842 bytes** on the pinned runtime, down from the initially measured **118,200 bytes**. The HTTP cap remains **98,304 bytes**, leaving **10,462 bytes (10.64%)** headroom; a regression enforces `<88,000` for the measured catalog. The per-tool result cap remains **65,536 bytes**. No listing override, blanket unrepresentable-schema fallback, or cap increase was used.

Workflow build is frozen at:

```text
build:sha256b64:ybUy68D9Sj9XSxdr4Uxf8YDBJz6D7GKM9u8Zp8Z9Th8
```

`workflow-source-manifest.json` now includes the shared season resolver and the public-view/season-adapter/reference-projection modules. The generator and current-workflow check passed.

All nine protected corpus hashes still equal `execution-baseline.json`. The legacy fixture manifest SHA-256 remains `9b0e1ff2d341ce0e386905e5d329849087a6eeee5ac51f808e227c0f50221826`; its generated manifest equality test passes. No root corpus or shared fixtures/modules were rewritten by this MCP slice.

## Remaining closure

The controller confirmed the UI browser process stopped before the Workerd command began. `npm run test:worker` passed on Node 24.20.0: **2 Workerd transport tests + 1 production performance test**, exit 0. Evidence: `phase-04-workerd.log`. SDK package sourcemap warnings were non-fatal; no test, cap, or performance threshold was relaxed. A process check found no owned Vitest, Workerd, or stdio child still running. The integrated final tester received explicit resource clearance.

The independent MCP review reports **PASS, 9/10, zero critical findings** (`review-season-mcp.md`). MCP code/workflow and this slice's scoped verification are complete. Repository-wide/UI closure and controller-owned release packaging are recorded in the final validation report. The actual local release-assets attempt remains blocked by **SOURCE_NOT_CLEAN** in the pre-existing/shared dirty checkout (`worker-assets-local-attempt.log`); test-fixture packaging passes do not mean that real clean-source release gate passed. No commit, deployment, or bypass of that gate is authorized or claimed.
