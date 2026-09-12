# Review: season lookup plan and catalog boundary

Status: DONE_WITH_CONCERNS

Reviewed both plan indexes and the four season phases against `mcp-worker/src/data/artifact-contracts.ts` and `mcp-worker/src/research/research-contracts.ts`. No implementation was performed.

## Resolve before implementation

1. **Include replacement suggestions in the seasonal contract.** Phase 4 enumerates context on search/detail/match/normalize/recommend/coexist but omits `tqccl_suggest_replacements`. Its existing input extends the recommendation input and selects a team by `teamId`. A seasonal configuration with different holders or tactics must select replacements from that configuration, not the legacy team. Add context/config resolution, confirmation invalidation, and a test where the same team changes tactics between rulesets. Keep no-context behavior unchanged.

2. **Define the actual client compatibility boundary for manifest v2.** Current `versionOutputSchema` is strict, requires exactly six artifacts, and uses fixed enums. `tqccl_get_data_version` currently takes a strict empty request. An unchanged client with the old cached output schema cannot validate twelve artifacts or new capability fields merely because v1 snapshot fixtures still load. Choose an explicit opt-in v2 request/legacy response projection, or state that clients must refresh schemas/upgrade before consuming v2 and narrow the compatibility claim accordingly. Test the chosen boundary with old request and output schemas, separately from v1 release identity preservation.

## Scope and coherence

- Five sidecars have distinct owners: registry, evidence, configurations, evaluations, and links to existing content. They support the requested separate scenario/ruleset model without rewriting the existing corpus. No need for extra services or further artifact splitting.
- A versioned snapshot change is justified because the existing snapshot enforces an exact six-artifact set and array-only artifacts. Preserving v1 byte identities while explicitly adding v2 is appropriate.
- Khai hoang and Cùng Tồn search/detail kinds are new opt-in MCP capabilities; current search kinds are hero/tactic/team/book. Label these clearly as a proposed extension when presenting the plan. They are not already covered by the existing search API. Do not imply their implementation was authorized by asking for a plan.
- Both plans name `docs/sgsdeck-catalog.md` as shared source-metadata owner. Final contract should agree on optional/null `sourceSeason` and optional `label`; the catalog model permits missing upstream season metadata. This is a small schema consistency detail, not an architectural blocker.
- No dependency cycle: season registry and existing-team curation can proceed without catalog ingestion; publication using new source entities waits only for the required mappings and evidence.
- Catalog remains local-only. Season sidecars are the explicitly proposed public additions; source catalog files are not implicitly published.
- Legacy IDs/hash/state preservation and fail-closed scoped recommendations are addressed. The reviewed seasonal tier policy is explicitly a proposal; no-context best-tier behavior remains unchanged.
- Concurrent Chạm Sứ work is acknowledged with an instruction to read its new schema before implementation; this review did not edit that work.

## Additional acceptance detail

For browser mixed-version protection, specify how all five sidecars prove they belong to the same generated set (for example one shared generation digest). Cross-reference validity alone does not detect a mixed configuration/evaluation pair when IDs remain unchanged. No extra public artifact is necessary if the existing schema/version carrier holds that evidence.

Unresolved decisions: v2 client negotiation versus a declared schema refresh requirement. Other findings can be resolved directly in the plan without user discovery questions.
