---
phase: 5
title: "Publish GoClaw consumer handoff guide"
status: completed
priority: P2
effort: 1d
dependencies: [4]
---

# Phase 5: Publish GoClaw consumer handoff guide

## Context Links

- [Plan](./plan.md)
- [Transport phase](./phase-04-add-stdio-and-streamable-http-transports.md)
- [Historical GoClaw research](./research/researcher-goclaw-dewee.md)

## Overview

Publish exactly one non-executable Markdown guide that lets a future GoClaw owner build a skill against the stable MCP contract. This repository does not implement, package, install, configure, deploy, or test that skill or any GoClaw/Dewee environment.

## Requirements

- Functional:
  - Create only `docs/goclaw-mcp-skill-handoff.md` for future skill integration.
  - Document the exact eight already-prefixed `tqccl_*` tool names and their intended call order.
  - State that remote HTTP currently requires an explicitly injected managed-client pre-shared bearer header and does not implement MCP OAuth discovery; a future consumer must prove custom-header support or own a separate OAuth gateway.
  - Explain structured-observation input, normalization, review, caller-owned human confirmation, `ConfirmationBinding`, and workflow restart behavior.
  - Require future consumers to treat raw/source structured fields as untrusted data, never concatenate them into system/developer prompts, and rely only on MCP fixed-template text for human-readable fallback.
  - Link to MCP-owned schemas, generated catalog/contract tests, endpoint/auth documentation, and typed error definitions instead of duplicating those contracts.
  - State that raw images, base64, URLs, paths, media IDs, channel/user credentials, and provider secrets never enter MCP.
  - Clearly assign skill creation, `read_image`, prompt/orchestration, registration, grants, prefix configuration, retries, channels, and media retention to the future GoClaw owner.
- Non-functional:
  - No `.agents/skills/` changes, skill ZIP, GoClaw config, DB/API mutation, channel canary, provider setup, or Dewee work.
  - No secrets, live hostnames, tokens, tenant IDs, fabricated GoClaw commands, or unverified configuration fields.
  - The guide is concise, platform-handoff documentation—not an executable runbook owned by this repository.

## Ownership Boundary

```text
This repository
  MCP endpoint + auth contract + exact tool catalog + schemas + errors
  CLI/stdio/HTTP parity + versioning + release/rollback
  one future-consumer guide

Future GoClaw owner
  skill files + prompts + read_image + image-to-observation conversion
  user confirmation UX + MCP registration + credentials + grants
  retry/reconnect behavior + channels + retention + rollout/rollback
```

The guide may recommend that the future skill omit an additional prefix because MCP already exports `tqccl_*`, but it must tell the implementer to verify this against the actual GoClaw version at that future time.

## Related Files

| Action | Path | Purpose |
|---|---|---|
| Create | `/Users/plateau/Project/CamNangTQCCL/docs/goclaw-mcp-skill-handoff.md` | The only GoClaw-related implementation artifact: future skill contract and ownership handoff. |
| Modify/Delete | None under `.agents/skills/`, GoClaw, Dewee, channel, or media configuration | Preserve strict consumer boundary. |

## Required Guide Outline

1. Purpose and ownership boundary.
2. MCP endpoint/transports and managed-client pre-shared authentication contract, including the explicit non-OAuth interoperability boundary.
3. Exact eight tool names:
   - `tqccl_get_data_version`
   - `tqccl_normalize_entities`
   - `tqccl_search`
   - `tqccl_get_team`
   - `tqccl_match_team`
   - `tqccl_recommend_team`
   - `tqccl_recommend_coexist`
   - `tqccl_suggest_replacements`
4. Recommended consumer flow:
   - obtain workflow version;
   - convert images externally into ordered structured observations;
   - normalize through MCP;
   - render conflicts and canonical state;
   - obtain and record user confirmation outside MCP;
   - echo the exact binding and workflow version into recommendation calls;
   - restart on `WORKFLOW_VERSION_CHANGED` or `CONFIRMATION_REQUIRED`.
5. Raw-media prohibition and privacy boundary.
6. Error, pagination, truncation, provenance, and retry expectations.
7. Future GoClaw implementation checklist explicitly marked outside this repo.
8. Links to authoritative MCP contracts and tests.

## Implementation Steps

1. Freeze the Phase 4 tool catalog, schemas, transport paths, auth behavior, and error names.
2. Create `docs/goclaw-mcp-skill-handoff.md` using the required outline.
3. Link to authoritative source/contracts; remove copied schema blocks that could drift.
4. Search the repository implementation diff to prove there are no `.agents/skills/`, GoClaw/Dewee config, grant, channel, or media changes.
5. Verify every tool name and workflow field against the Phase 3/4 contract tests.
6. Verify the guide states that raw/source labels, observations, and corpus prose are untrusted even when present in `structuredContent`.
7. Run a Markdown link and secret-pattern check.

## Validation

- [x] Exactly one GoClaw-related implementation document is created.
- [x] The guide lists exactly the eight MCP-owned names with no obsolete alias.
- [x] The guide never claims MCP processes images or proves the human action.
- [x] The guide never describes the pre-shared bearer as OAuth, and tells future consumers to verify explicit custom-header support.
- [x] The guide marks all skill/GoClaw work as future external ownership.
- [x] The guide forbids prompt concatenation of untrusted structured fields and does not copy a raw-text fallback example.
- [x] No skill source, package, fixture, portability test, GoClaw configuration, or staging artifact is created.
- [x] Links resolve and no secret/live-environment value appears.

## Success Criteria

- [x] A future GoClaw implementer can discover the MCP contract and required orchestration without reading plan history.
- [x] This repository remains independently complete and releasable as MCP without GoClaw.
- [x] Removal or absence of GoClaw has no effect on MCP build, tests, deployment, or release acceptance.

## Completion Validation — 2026-07-28

- Tester: **7/7** kiểm thử tập trung PASS; catalog **8/8** tên chính xác; Markdown link **10/10** resolve; secret scan và `git diff --check` sạch.
- Reviewer ban đầu nêu một lỗi **Medium**: mô tả pagination áp dụng quá rộng. Guide đã giới hạn cursor pagination cho `tqccl_search`; `truncated: true` ở tool khác không được hiểu là có trang kế tiếp. Reviewer cuối: **PASS**.
- Diff triển khai chỉ tạo đúng [`docs/goclaw-mcp-skill-handoff.md`](../../docs/goclaw-mcp-skill-handoff.md); không có skill source/package, `.agents/skills/`, GoClaw/Dewee config, grant, channel, media hoặc staging artifact.
- Báo cáo: [Phase 5 completion](./reports/phase-05-completion-260728.md) và [PM progress](./reports/pm-260728-2303-phase-05-progress.md).

## Risks and Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Guide drifts from schemas | Link to authoritative contracts; verify exact names in Phase 4 tests. | Correct or remove the guide; MCP behavior is unaffected. |
| Guide is mistaken for owned integration | Put ownership boundary first and repeat it in checklist. | Mark guide deprecated without changing MCP. |
| Consumer-specific config becomes stale | Avoid executable GoClaw commands and require future version verification. | Remove stale advisory paragraph. |

## Next Steps

Phase 6 releases and operates MCP directly from Phase 4 and may proceed in parallel with this guide. Future skill implementation starts under a separate GoClaw-owned plan; this guide never gates MCP build, deployment, verification, rollback, or release.
