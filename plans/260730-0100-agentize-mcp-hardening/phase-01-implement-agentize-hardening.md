---
phase: 1
title: "Implement Agentize hardening"
status: completed
dependencies: []
---

# Phase 1: Implement Agentize hardening

## Context Links

- [Plan](./plan.md)
- [Verification findings](../reports/agentize-260730-0006-mcp-cli-verification.md)

## Requirements

- Preserve `RESEARCH_CONTRACTS` as single public schema authority.
- Preserve eight read-only tool names and semantic results.
- Preserve fixed redaction boundary and exact workflow identity generation.
- Coverage config must exclude generated code, transport adapters and release scripts only when they are outside core ownership.

## Files

- Modify: `mcp-worker/src/research/research-contracts.ts`
- Modify: `mcp-worker/src/mcp/tool-definitions.ts`
- Modify: `mcp-worker/src/mcp/format-result.ts`
- Modify: relevant MCP/transport tests
- Modify: `mcp-worker/package.json`, lockfile, Vitest coverage config
- Modify: workflow identity generated artifact and relevant docs

## TDD Steps

- [x] Add failing catalog tests for descriptions.
- [x] Implement schema/tool descriptions.
- [x] Add failing error recovery/redaction tests.
- [x] Implement safe message and next action mapping.
- [x] Add coverage provider/config/script and enforce thresholds.
- [x] Regenerate workflow identity.
- [x] Run focused tests, full MCP/workerd/repository gates.
- [x] Independent review and final plan sync.

## Validation

- Official MCP Client contract tests: `9/9`, including malformed input and SDK-level error redaction.
- MCP suite: `216/216`; Workerd: `2/2`.
- Coverage: statements `89.08%`, branches `81.84%`, functions `95.37%`, lines `89.56%`.
- Typecheck, Worker typecheck, build, workflow identity, repository release gate, Wrangler dry-run and dependency audit passed.
- Independent re-review: no findings or blockers.
- No npm publish, live deploy, Cloudflare call or R2 mutation was performed.

## Risks and Rollback

- Schema metadata changes workflow identity; staging release must use the regenerated build ID.
- Public error shapes are additive; exact parity tests protect all transports.
- Coverage include/exclude drift could create false confidence; config must name core directories explicitly.
- Rollback by reverting this focused implementation commit before any live release.
