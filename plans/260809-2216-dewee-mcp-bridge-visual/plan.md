---
title: Dewee MCP bridge fix visual
status: completed
priority: P1
effort: small
branch: main
tags: [showcase, mcp, debugging]
created: 2026-08-09
---

# Dewee MCP bridge fix visual

> Historical record from 2026-08-09. Results below were recorded during that run; local artifacts remain Git-ignored. See the [subsequent dewee-only rewrite report](../reports/orchestrate-260809-2310-dewee-html-opus/report.md) for the revised scope and final audit.

## Outcome

Create a self-contained local HTML explanation of the verified MCP data-loss chain, required fixes, tests, rollout, and repository boundary.

## Constraints

- Do not edit the dewee source or create/publish a dewee PR.
- Keep the HTML and screenshots under the already ignored `_site/` tree.
- Do not include credentials, tokens, private prompts, or raw trace payloads.
- Local-only: publishing disabled for this run.

## Preferences

- screenshots: true
- publishing: false
- languages: vi, en

## Checklist

- [x] Request analysis
- [x] Content
- [x] HTML
- [x] Local open/review
- [x] Capture attempted; skipped because the skill runtime lacks Puppeteer
- [x] Publish skipped (local-only)

## Acceptance criteria

- The page clearly separates confirmed root cause, secondary compatibility issue, and unrelated agent behavior.
- It shows the minimal dewee fix, TQCCL fallback improvement, tests, rollout, and no-PR boundary.
- The HTML works locally in light/dark/system themes and responsive viewports.
- `git check-ignore` proves all showcase artifacts are excluded.

## Validation result

- Desktop: 1440×1000, no horizontal overflow, hero fits viewport.
- Mobile: 375×812, no horizontal overflow, bilingual and theme controls work.
- Browser console: no page errors.
- Capture script: failed with `ERR_MODULE_NOT_FOUND` for `puppeteer`; remote fallback intentionally disabled for local-only scope.
