---
phase: 1
title: "Strengthen transport result-envelope coverage"
status: completed
dependencies: []
---

# Phase 1: Strengthen transport result-envelope coverage

## Context

- [Plan](./plan.md)
- Existing parity test: `mcp-worker/test/transport/all-tools-parity.test.ts`
- Existing stdio smoke: `mcp-worker/test/transport/stdio.integration.test.ts`
- Result formatter: `mcp-worker/src/mcp/format-result.ts`

## Requirements

- Extend the existing real-client integration tests; do not create a fake dewee bridge.
- Assert `content` and `structuredContent` together for success and typed error paths.
- Preserve the fixed non-reflecting fallback security invariant.

## Files

- Modify: `mcp-worker/test/transport/all-tools-parity.test.ts`.
- Modify `mcp-worker/test/transport/stdio.integration.test.ts` only if it adds non-duplicative coverage.
- Production source and docs: unchanged.

## Implementation

- [x] Add explicit success-envelope assertions for all tools over stdio and HTTP.
- [x] Add structured typed-error parity assertions while retaining non-reflection checks.
- [x] Run the focused transport suite, then typecheck and broader gates required by the shared contract.
- [x] Review the diff for contract drift and misleading dewee claims.

## Validation

- [x] Focused parity test passes: 2/2.
- [x] Transport suite passes: 14/14.
- [x] Full `mcp-worker` package suite passes: 229/229.
- [x] Main and `mcp-worker` typechecks pass; build passes.
- [x] Review reports no findings; implementation uses official SDK paths and makes no dewee claim.

## Risks and rollback

- Risk: assertions duplicate formatter implementation too closely. Prefer observable protocol fields and stable public text.
- Risk: test name implies dewee coverage. Keep naming explicitly scoped to TQCCL transports.
- Rollback: revert the test-only diff and plan artifacts.
