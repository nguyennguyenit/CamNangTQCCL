# Review: Phase 04 MCP seasonal data/domain/handlers

Date: 2026-09-12
Reviewer: code-reviewer
Scope: read-only review of the MCP seasonal implementation. Code was not modified; this report is the only file written.

## Scope reviewed

Primary sources reviewed:

- `plans/260907-0233-season-team-lookup/phase-04-mcp-and-release-validation.md`
- `plans/260907-0233-season-team-lookup/reports/season-shared-contract.md`
- `mcp-worker/src/data/artifact-contracts.ts`
- `mcp-worker/src/data/filesystem-data-source.ts`
- `mcp-worker/src/data/static-assets-data-source.ts`
- `mcp-worker/src/data/public-snapshot-view.ts`
- `mcp-worker/src/domain/canonical-state.ts`
- `mcp-worker/src/domain/normalization-service.ts`
- `mcp-worker/src/domain/recommendation-service.ts`
- `mcp-worker/src/domain/season-domain-adapter.ts`
- `mcp-worker/src/domain/season-reference-projection.ts`
- `mcp-worker/src/research/research-contracts.ts`
- `mcp-worker/src/research/research-handlers.ts`
- `mcp-worker/src/mcp/format-result.ts`
- `mcp-worker/src/cli.ts`
- `mcp-worker/src/mcp/tool-definitions.ts`
- `mcp-worker/test/data/season-snapshot.test.ts`
- `mcp-worker/test/research/season-research.test.ts`
- `mcp-worker/test/research/season-bounds.test.ts`
- `mcp-worker/test/research/season-errors.test.ts`
- `mcp-worker/test/transport/season-tools-parity.test.ts`
- Related legacy/parity coverage in `mcp-worker/test/research/research-handlers.test.ts`, `mcp-worker/test/transport/all-tools-parity.test.ts`, and `mcp-worker/test/cli.integration.test.ts`.

Catalog-size overage was a known concurrent WIP at review start and is not counted as a finding. After the concurrent fix landed, the seasonal transport parity test passed locally.

## Overall assessment

PASS with no source-grounded open findings in the reviewed MCP seasonal slice.

The implementation is wired through the shared season projector and keeps the legacy no-context path separate. The seasonal path validates exact v2 artifacts, binds context into canonical confirmation and cursors, rejects invalid context/config/candidate limits with structured public errors, preserves scored-source linkage only for exact final selections, and uses schema-preserving coexist-reference truncation under the 64 KiB result cap.

Score: 9/10
Critical count: 0
High count: 0
Medium count: 0
Low count: 0

## Findings

No open findings.

Two issues that were visible during review were concurrently fixed before this report was finalized:

- Public view evidence pruning: `mcp-worker/src/data/public-snapshot-view.ts` now removes hidden proof rows unless a retained public record still references them (`evidenceIds`, `hiddenProofs`, `retainedProofs`, and filtered `season-evidence`). The focused Red test in `mcp-worker/test/research/season-bounds.test.ts` now passes.
- Reference text truncation signal: `mcp-worker/src/domain/season-reference-projection.ts` now reports `referenceTruncated` when raw/source text is clipped to 256 characters, and `mcp-worker/src/research/research-handlers.ts` propagates that into the public `truncated` flag for seasonal coexist output. The focused Red test now passes.

## Acceptance coverage checked

- Exact v1/v2 data contracts: `artifact-contracts.ts` defines six legacy names, five seasonal names, and v2 manifest selection; `filesystem-data-source.ts` rejects partial seasonal sidecars. `season-snapshot.test.ts` covers v1 fixture identity, exact v2 activation, partial rejection, and broken seasonal crossrefs.
- No-context compatibility: `research-contracts.ts` keeps `seasonContext` optional and existing tool names intact; `research-handlers.ts` rejects `configId`/holder/slot selectors without context. Legacy tests still cover the eight-tool no-context path and unchanged compatibility behavior.
- Shared projector before cap 500: `recommendation-service.ts` calls `seasonDomain.candidates(...)` before invoking the legacy engine and propagates `CANDIDATE_LIMIT_EXCEEDED` without creating a partial portfolio. `season-bounds.test.ts` covers 501 eligible configs and confirms search can page the full set.
- Confirmation and cursor binding: `canonical-state.ts` includes `seasonContext` in projection version/digest and confirmation binding checks; `research-handlers.ts` includes context and release in cursor identity. Season tests cover context digest separation, no-context binding rejection, semantic context ordering, and cursor context mismatch.
- Public Do Uy descendant exclusion: `public-snapshot-view.ts` filters private teams, dependent configs/evaluations/content links, and now exclusive evidence rows before revalidating the season model. `season-bounds.test.ts` verifies search/detail/recommend/provenance exclusion.
- Ambiguity payloads: `resolveTeamConfig` is surfaced through `research-handlers.ts` with `CONFIG_AMBIGUOUS`; `research-contracts.ts` constrains sorted max-20 choices and counts. Tests cover 2-config transport parity and 501-config max-20/omitted counts plus search paging.
- Source score linkage: `recommendation-service.ts` computes `sourceScore` only when a seasonal `configId` and exact final selection exist; replacement output returns `sourceScore: null`. Season tests cover exact detail score, recommend score, engine alternative nulling, and replacement nulling.
- Holder/slot replacement: `suggestReplacements` resolves the requested seasonal config and holder/slot selector instead of defaulting to the first config/slot. Season tests cover holder/slot replacement identity and ambiguity rejection.
- Nested coexist references: `season-reference-projection.ts` preserves required slot arrays and drops optional detail before removing whole references. `season-bounds.test.ts` covers the 5/25/75 source snapshot, schema validity after truncation, and the truncation flag for clipped text.
- Mandatory unknown blocked: seasonal candidate projection is shared with the UI/core path; tests cover unsupported/unknown mandatory requirement diagnostics and no bypass through `experimentalUntiered`.
- Eight MCP tools and transport/CLI propagation: `research-contracts.ts` declares the eight tool names; `tool-definitions.ts` publishes schemas for those tools; `format-result.ts` and `cli.ts` preserve structured `choices` and `limits`. `season-tools-parity.test.ts` passes for stdio, HTTP, and CLI.

## Validation run during review

```text
npm --prefix mcp-worker test -- test/data/season-snapshot.test.ts test/research/season-research.test.ts test/research/season-bounds.test.ts test/research/season-errors.test.ts
# Test Files 4 passed; Tests 23 passed

npm --prefix mcp-worker test -- test/transport/season-tools-parity.test.ts
# Test Files 1 passed; Tests 2 passed
```

## Residual risk

This was a bounded read-only review of the MCP data/domain/handler seasonal slice. I did not re-run the full 350-test suite locally; root reported the full Node/Python/control-plane check as passing after the concurrent fixes. I also did not review unfinished UI/MCP consumer work outside this slice, per task scope.

Status: DONE
Summary: Reviewed the seasonal MCP data/domain/handler implementation against Phase 04 and the shared contract. No open priority findings remain after verifying the concurrent public-evidence and truncation fixes.
Concerns/Blockers: None for this slice.
