# SGSDeck catalog plan review

Status: DONE

## Expanded plan re-review

Reviewed the updated index and all four phase files after the user changed scope to planning only. No implementation or import completion is asserted by these plans.

- All six categories are covered. The observed 805 top-level records, 192 troop-mod options, 90 equipment skills, and building levels are explicitly counted separately; counts are observations to reconcile, not permanent hardcoded targets.
- Earlier concerns below are addressed: per-group identity and variant rules, reorder tests, inventory reconciliation, complete staged validation, manifest-aware loading, failure preservation, and byte-identical cache rebuilds are present.
- Catalog remains local. The plan explicitly says no source JSON is present yet and no public UI/MCP publication follows automatically from import completion.
- Metadata ownership is assigned to `docs/sgsdeck-catalog.md`; source identity matching and Vietnamese availability are separate. Season source labels are not silently translated into Vietnamese season rules.
- Dependency is scoped to newly introduced entities at publication time. Existing teams and season UI work do not need the entire catalog import to finish.
- Reuse constraints are investigated before bulk ingestion; a concrete permission/export request is prepared only if necessary. No whole-plan approval dependency is introduced.

Small optional clarification: phase 2 step 3 can explicitly require the allowed reuse method recorded by phase 1. The existing phase dependency already supports this interpretation. If reuse remains unresolved, pause bulk ingestion while metadata and independent season work continue.

No concrete blockers or user questions remain for the source plan. Review the linked season plan separately when ready.

## Initial review history

Reviewed the plan, phase file, `src/lib/public-artifact-manifest.mjs`, and `pipeline/build_dict.py`. The source-region catalog boundary, local query scope, and explicit exclusion from the public artifact allowlist are appropriate. No architectural blocker found.

## Acceptance details to specify before implementation

1. Define identity per group: prefer source IDs or stable detail URLs; any fallback must include the source group and variant and must not use array position. Test IDs against reordered input and preserve SP/CO/40Y distinctions.
2. Reconcile extracted records against the source inventory and pagination when present. Six nonempty files alone do not prove completeness; equipment and buildings still lack observed counts in the plan. Record expected/extracted counts or explain why only observed coverage can be established.
3. Validate cross-record references, field types, source provenance, and the complete staged output set before replacing existing files. Ensure parse/validation failures preserve previous outputs. Check offline rebuild parity without injecting a new fetch timestamp.

## Verified boundaries

- `PUBLIC_ARTIFACTS` lists exact source basenames; adding `data/sgsdeck/` without changing the manifest does not add a runtime data route.
- `build_dict.build()` writes canonical `tactics.json` and `heroes-dict.json`. Reuse read-only name evidence where needed, but do not call its build driver for this importer.
- The plan already forbids editorial prose mirroring and canonical season inference. Implementation review should inspect representative parsed records to verify these claims.

Unresolved questions: none requiring user input; the implementation can settle these details from source evidence.
