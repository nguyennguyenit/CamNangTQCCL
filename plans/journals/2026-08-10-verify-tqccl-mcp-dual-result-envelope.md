---
title: Verify TQCCL MCP dual result envelope
date: 2026-08-10
summary: Added transport integration coverage for content plus structuredContent without coupling TQCCL to dewee.
---

# Verify TQCCL MCP dual result envelope

## What happened

A dewee bridge trace showed that TQCCL returned valid `structuredContent`, but the consumer discarded it. The repositories have separate ownership: TQCCL owns the MCP result contract; dewee owns conversion into model context.

## Change

Strengthened `mcp-worker/test/transport/all-tools-parity.test.ts` using the official MCP client. All eight tools now prove that both stdio and Streamable HTTP deliver the fixed `content` fallback plus complete `structuredContent`. Invalid-input cases also prove sanitized text, the typed structured error envelope, and absence of hostile request data.

No production formatter, schema, documentation, dewee dependency, deployment, or live service changed.

## Verification

- Focused parity: 2/2
- Transport suite: 14/14
- Full package: 229/229
- Main and Worker typechecks: passed
- Build: passed
- Independent review: no findings

## Decision

Keep TQCCL transport coverage local and deterministic. Test and repair dewee's bridge separately in the dewee repository; do not add a fake bridge or consumer dependency here.

## Next steps

Implement the `Content` plus `StructuredContent` conversion and its own regression tests in dewee when working in that repository.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
