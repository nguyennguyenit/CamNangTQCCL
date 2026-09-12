# Phase 1 validation — seasonal registry and evidence

Date: 2026-09-12. Scope: local implementation, `--auto --advice --tdd`; no deployment or commit. Plan status is controller-owned and not changed here.

## Summary

Delivered one reviewed scenario (`binh-dien-xuan-thu`), zero rulesets, and two evidence records. Only scenario attribution is reviewed. Source-season labels/numbers remain null because the inspected CSV does not establish them. All nine original public JSON files retain their exact baseline hashes.

## Red → Green → Refactor evidence

| Step | Command / action | Actual result |
|---|---|---|
| Red validator | `python3 -m unittest tests.test_build_season_data -v` | 19 tests; 36 failed assertions including subtests, zero import/runtime errors. Real copy/serialization/publish scaffold accepted invalid candidates; positive copy, parity and null-preservation cases passed. |
| Green validator | Same command after full schema and cross-reference validation | 19 passed. |
| Red routes | `node --experimental-strip-types --test --test-name-pattern='seasonal registry|season sidecars' tests-js/astro-dist-contract.test.mjs` | 2 tests: 1 failed because explicit seasonal route inventory was empty, 1 passed because undeclared sidecars reject the source tree. |
| Candidate validation | Loaded both real curated inputs; called `publish_season_data` twice into a `TemporaryDirectory`; compared complete filename/bytes maps | Both candidates valid, repeated bytes identical. No real data writes until this passed. |
| Green routes | Published exactly two sidecars and added their manifest entries, then same focused route command | 2 passed. |
| Refactor | Extracted pure `encode_payloads`; repeated Python suite and route suite | Python 19 passed; route tests 2 passed. |
| Runtime contract | `node --test tests-js/runtime-asset-contract.test.mjs` | 6 passed. |
| Checkpoint build | `npm run build` | Pass; two new data routes emitted. |
| Dist contract | `npm run test:dist` | 12 passed, including existing private SGSDeck boundary tests. |
| Dist verification | `npm run verify` | 38 files, 35 raw assets; exact byte parity. |
| Full Node regression | `npm run test:node` | 148 passed, zero failure/skip. Dev and preview subprocesses exited through test cleanup. |
| Full Python regression before phase 2 | `python3 -m unittest discover -s tests` | 145 passed. |
| Whitespace | `git diff --check` | Pass. |

Failure modes covered: duplicate scenario/evidence/ruleset IDs; bounded IDs including exact 128 accepted and 129/control/whitespace rejected; unknown/missing fields and schema versions; invalid provenance URLs/dates/source numbers; dangling evidence/scenario/ruleset refs; pending evidence cannot support reviewed records; scenario proof cannot support ruleset; reviewed ruleset requires reviewed scenario; reviewed mappings require matching source and exact applicable pair; pending/null preserved; equal upstream season numbers from different regions never merge/map; invalid candidate leaves all accepted outputs untouched; repeat publish and unrelated corpus parity.

## API and schema for the next phase

- `validate_registry(registry, evidence)` validates both arrays and returns `(scenario_by_id, evidence_by_id)`. It performs no I/O or normalization.
- `build_season_data(registry, evidence)` returns independent arrays keyed by `season-registry.json` and `season-evidence.json` after complete validation.
- `encode_payloads(payloads)` encodes the complete candidate set with sorted object keys, UTF-8, two-space indentation and final newline. Array order is curated order and remains untouched.
- `publish_season_data(registry, evidence, output_dir)` validates and serializes before touching the output directory; stages all bytes locally then replaces only those two filenames. This is atomic per file, not a transaction across files on OS failure/process termination. Validation/encoding failures preserve all prior outputs.
- CLI: `python3 -m pipeline.build_season_data --registry <input.json> --evidence <input.json> --output-dir <candidate-directory>`. Defaults read the two `pipeline/` files and write `data/`.
- Phase 2 can extend the pure build result with its three validated sidecars before the existing complete-set encoding/publication step. It must add corresponding explicit entries with the files. No absent sidecar or anticipated route was added here.

Top-level values are arrays for the planned MCP artifact contract; each scenario/evidence record has integer `schemaVersion: 1`. Nested records inherit it. IDs are 1–128 code points, trimmed, and reject Unicode category C characters. Ruleset IDs are unique within a scenario; the pair is the reference key. Registry fields follow phase 1 with required `evidenceRefs` at scenario level. No `current`, default-ruleset, release-date inference or legacy scenario is generated.

Evidence adds explicit `reviewStatus` and `claim: {kind, scenarioId, rulesetId}`. Current supported claim kinds:

| Kind | Scope | May authorize |
|---|---|---|
| `source-observation` | both IDs null | Source observation only |
| `scenario-attribution` | existing scenario, null ruleset | Reviewed scenario and matching scenario-only source mapping |
| `ruleset-applicability` | existing scenario/ruleset pair | Reviewed ruleset and matching exact source mapping |

All evidence references on a reviewed record must be reviewed, and at least one must support its exact claim. Source mappings also compare provider, source region, URL and sourceSeason against the supporting evidence. Dates record observation, not applicability. Canonical references are nullable; non-null values require reviewed evidence and bounded `{kind,id}`. Actual dictionary identity checks remain the identity owner's responsibility when future records use canonical references; both published records currently have null. `snapshotHash` is optional SHA-256 metadata and is pinned to the inspected CSV for the observation record. No arbitrary HTML or source cache enters outputs.

## Preservation

Compared again after publication and full Node verification against `execution-baseline.json`:

| File | SHA-256 | Result |
|---|---|---|
| `data/books-dict.json` | `c863effdb9be5fec035f0bee03350459ddd2d3d25981693a809b9a81a849579d` | unchanged |
| `data/coexist.json` | `100a07fa66dde885bd8e528443335540baebd09045c3a393cefc046f80eb7e57` | unchanged |
| `data/facets.json` | `b599a702ed3a3207a17a5b69741a9ad020147f3835a52d19550d075e85ad950c` | unchanged |
| `data/heroes-dict.json` | `8c99a159c144000897025b98590617bfd9735d543ac4d458821dbc3e11029813` | unchanged |
| `data/khaihoang.json` | `d2bd885cf1d1b247fd89a583255de68de3c5a54c804b3b88e8c04245c67567d9` | unchanged |
| `data/tactics-generic.json` | `0920eb8edbdd13f038f43856bd945031172f34667e9bbc4133d2a10fc18d2adf` | unchanged |
| `data/tactics.json` | `f0e9be17bd1f36e8aba1e1ad3217504c42395aca57efdb3b2a1a7ee967e29834` | unchanged |
| `data/team-tier.json` | `056c58b16ba195ee1491c053cfbb5ddd020bb7d89ea13a5554f38df42e1795ca` | unchanged |
| `data/teams.json` | `b937a6ee1d71fc4176eda0efb1e4e8a5c9bcf4ca4775d53a5a21b84b33f973ac` | unchanged |

Two new output hashes:

- `season-registry.json`: `23134abe0d306631f92d0ea2f74708ef72a55c2f114d3d1cdace0eba426d9ffc`
- `season-evidence.json`: `9812bbc52dee67bf0baf1949767f8d25976a46812d8fb771d03aba057a94edf0`

Pre-existing SGSDeck edits in `tests-js/astro-dist-contract.test.mjs` were retained; seasonal tests were inserted additively. No changes to `root-static-artifacts.ts`, old JSON, parser, source caches, UI or MCP. No `build_json` invocation. Evergreen contract documentation remains with the controller's integrated delivery scope.

## Unresolved questions

Verified VN rulesets, other scenario mappings and ruleset-applicable team/config/score evidence remain unknown. These unknowns do not block the delivered attribution-only registry; they must not be filled by inference. Runtime seasonal UI and MCP v2 are later phases.
