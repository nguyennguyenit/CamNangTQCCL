# Code Review Summary

Date: 2026-09-12
Reviewer: code-reviewer
Scope: read-only Stage 2 code-quality review of the season MCP/release slice for `f221c2f55b9f16d857e5785b7fcb7d25a19b705e..4eb7f19b2f97e78f3d336b8f32762f492c7bb2e0` in `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`.

## Scope

- Files reviewed: 33 changed MCP/release/public-artifact files under `mcp-worker/src`, `mcp-worker/scripts`, `mcp-worker/test`, `mcp-worker/workflow-source-manifest.json`, and `src/lib`.
- Focus: recent full delivery, with emphasis on MCP data contracts, research schemas/handlers, seasonal domain projection, release asset generation, release verifier behavior, public snapshot exclusion, cursor/context binding, truncation, and Worker result-size boundaries.
- Scout findings checked: cross-transport error/schema parity, cursor query binding, context/config/slot selection, no-context parity, structured truncation/provenance, source/secret exposure, and exact v1/v2 generation.
- Constraint observed: no source edits, no Git mutation, no push/merge/deploy. This file is the only report written.

## Overall Assessment

Verdict: PASS. I found no concrete priority bugs in the reviewed MCP/release slice.

The implementation keeps the legacy no-context path distinct, validates exact v1/v2 artifact inventories, projects seasonal data through the shared season adapter, binds season context into canonical confirmation and search cursors, preserves explicit config IDs, rejects ambiguous configs and over-500 candidate sets with structured public errors, filters hidden `do-uy` descendants before MCP exposure, and keeps seasonal coexist references schema-valid when truncating under the 64 KiB MCP result contract.

The apparent result-size constant mismatch is not a finding: `mcp-worker/src/research/research-handlers.ts` and `mcp-worker/src/domain/season-reference-projection.ts` enforce the 64 KiB tool-result/schema contract, while Worker runtime config `TQCCL_MCP_MAX_RESULT_BYTES=98304` is the outer transport envelope cap. The fresh tests and Wrangler dry-run exercised this split.

## Critical Issues

None.

## High Priority

None.

## Medium Priority

None.

## Low Priority

None.

## Edge Cases Checked

- Context validation: malformed or scenario-only `seasonContext` rejects before seasonal handlers execute.
- Cursor safety: search cursor identity includes query, kind set, release ID, workflow version, and season context.
- Config selection: seasonal detail/replacement refuses ambiguity instead of choosing the first config; choices are bounded and sorted.
- Candidate cap: candidate projection filters by scope and eligibility before the 500-config limit; over-limit errors carry `limits` without a partial portfolio.
- Public exclusion: hidden `do-uy` teams, dependent configs/evaluations/content links, and unretained evidence proofs are removed before public MCP indexing.
- Truncation: seasonal coexist projection drops optional nested details first, then whole references, while preserving required fields and `truncated`/`omittedReferences`.
- Source score integrity: SGSDeck `sourceScore` only survives exact config/context/selection; replacement and changed final selections return null.
- Release assets: v1 keeps six legacy artifacts plus manifest; v2 requires six legacy artifacts plus five season sidecars plus manifest, with exact inventory and evidence validation.
- Static-public boundary: public root artifacts allow only declared files and the narrow private `data/sgsdeck/` subtree exception; private descendants are not emitted.
- Secret exposure: tool errors use fixed public messages and field names only; release verifier failure paths do not echo bearer values or upstream private bodies.

## Positive Observations

The tests are not just happy-path snapshots. They include direct Red-style guards for public descendant pruning, cross-transport structured errors, 501 candidate overflow, 2/21 config ambiguity choices, v1/v2 asset inventories, private source exclusion, and schema validity after nested reference truncation. That materially lowers the risk of AI-shaped but behaviorally hollow coverage.

## Verification

Fresh commands run with the pinned runtime by prepending `/Users/plateau/.nvm/versions/node/v24.20.0/bin` to `PATH`:

```text
npm --prefix mcp-worker test -- test/data/season-snapshot.test.ts test/research/season-research.test.ts test/research/season-bounds.test.ts test/research/season-errors.test.ts test/transport/season-tools-parity.test.ts test/release/season-worker-assets.test.ts test/release/verify-release.test.ts
# 7 files passed; 51 tests passed

npm --prefix mcp-worker run typecheck
# pass

npm run verify
# Verified 43 dist files (40 raw assets)

npm --prefix mcp-worker run check
# pass; 43 MCP test files passed, 351 tests passed; coverage 91.08% statements, 85.3% branches, 95.9% functions, 91.75% lines

npm --prefix mcp-worker run check:repository
# pass; includes MCP check, Astro build, dist tests, 55 Playwright tests, 186 root Node tests, 151 Python tests with 12 skips, Vision Worker tests/typecheck, and Wrangler dry-run reading 12 Worker asset files
```

One intentionally discarded run of `npm --prefix mcp-worker run check` failed because child scripts resolved `node` as v24.14.0. The pinned-PATH rerun resolved `node` as v24.20.0 and passed; this matches the repository's known noninteractive shell requirement and is not classified as a code defect.

## Metrics

- Type coverage: `tsc --noEmit` and worker typecheck passed.
- Test coverage: MCP coverage summary reported 91.08% statements, 85.3% branches, 95.9% functions, and 91.75% lines.
- Linting issues: no lint-specific gate was present in the checked MCP scripts; syntax/type/build gates passed.
- Build validation: MCP build, Astro build, dist verification, and Wrangler dry-run passed.

## Unresolved Questions

None for this reviewed slice. Current zero reviewed VN configs/rules/evaluations and future-path fixture coverage are accepted scope, not findings.

Status: DONE
Summary: Read-only Stage 2 review completed for the season MCP/release slice. No concrete production bugs found; fresh pinned-Node checks and repository release gate passed.
Concerns/Blockers: None.
