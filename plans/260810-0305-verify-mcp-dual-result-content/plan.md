---
title: "Verify MCP content and structuredContent integration"
description: "Strengthen existing transport integration coverage for the TQCCL MCP result envelope."
status: completed
priority: P1
effort: small
branch: main
tags: [mcp, integration-test, transport]
created: 2026-08-10
---

# Verify MCP content and structuredContent integration

## Outcome

Prove that the official MCP client receives both `content` and
`structuredContent` from TQCCL over stdio and Streamable HTTP.

## Constraints and non-goals

- Change only this repository.
- Do not change production result formatting or public schemas.
- Do not add a dewee dependency, fixture, mock bridge, deployment, or live call.
- Do not claim this test verifies dewee behavior.

## Phase

| # | Phase | Status |
|---|---|---|
| 1 | [Strengthen transport result-envelope coverage](./phase-01-strengthen-result-envelope-coverage.md) | Completed |

## Acceptance criteria

- Success results expose the fixed text fallback and complete structured payload through both transports.
- Error results expose sanitized text plus the complete structured error envelope through both transports.
- Untrusted request data is absent from both result forms.
- Focused transport tests, typecheck, and the relevant repository gates pass.
- No production contract or documentation changes.

## Dependencies

- Existing official-client transport harness in `mcp-worker/test/transport/`.
