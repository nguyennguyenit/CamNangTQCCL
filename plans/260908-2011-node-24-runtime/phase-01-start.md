---
title: "Phase 1: Start"
status: done
---

# Phase 1: Start

## Overview

Upgrade the local runtime and repository contract to Node 24.20.0.

## Requirements

- [x] Install/select Node 24.20.0 without removing Node 22.
- [x] Align root pin, root/MCP package and lock engines, README and deployment guide. Completed Khai hoang plans retain their historical Node 22 validation.

## Implementation Steps

1. Review scope; install official Node through nvm and select default; configure fish PATH if needed.
2. Set `.node-version` to 24.20.0 and engine ranges to `>=24.20.0 <25`; preserve dependency versions.
   Regenerate `mcp-worker/src/generated/workflow-build.ts` through `generate:workflow-build`: its fingerprint includes the changed pin/package/lock. This intentionally changes the build identity; the existing workflow-version protocol handles invalidation on a future deployment.
3. Run exact pin smoke, frontend build/types/tests/E2E, MCP checks, Python and Vision Worker checks.
4. Review diff and record evidence. Preserve historical reports and all unrelated changes.

Rollback: restore only this task's configuration edits and select retained Node 22. No deployment or system binary replacement.

## Todo

- [x] Runtime and configuration updated.
- [x] Verification and review complete.

## Success Criteria

New shells select 24.20.0; runtime contracts agree; verification and independent review are recorded with any limitations.

## Completion evidence

Completed 2026-09-09. [Runtime setup](reports/runtime-setup.md) and [review](reports/review.md) confirm zsh/fish Node 24.20.0, npm 11.19.0, retained Node 22, aligned metadata without dependency changes, and canonical workflow fingerprint freshness.

[Validation](reports/validation.md) records passing frontend build/check/verification, 143 Node tests (including 9 artifact checks), 26 E2E, 89 Python, 305 MCP, 53 Vision and 3 supplemental workerd tests, plus Worker typechecks and exact-pin smoke. The separate deployment dry-run remains unverified because production assets are absent and canonical generation requires a clean checkout. This is a release prerequisite outside the completed local runtime scope.

Rollback also requires updating/removing the explicit fish runtime selector; changing the nvm alias alone does not switch fish. Existing shells and agent processes need restart or explicit runtime selection.
