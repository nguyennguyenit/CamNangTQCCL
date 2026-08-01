---
title: "Thay R2 bằng Worker Static Assets"
description: "Đóng gói code và sáu data artifacts trong cùng một Cloudflare Worker version, loại bỏ R2 release pipeline."
status: in-progress
priority: P1
effort: "8d"
issue: null
branch: main
tags: [refactor, backend, infra, cloudflare, tdd]
blockedBy: []
blocks: [260723-2055-mcp-goclaw-image-team-research]
created: 2026-07-31
---

# Thay R2 bằng Worker Static Assets

## Overview

Thay hai R2 bindings, mutable pointer và pipeline CAS/lock/receipt bằng một private Worker Static Assets collection. Mỗi Worker version chứa trọn code, canonical manifest và sáu JSON nên deploy/rollback code + data là nguyên tử.

## Scope Contract

- **Mode:** Deep TDD, HOLD scope, bốn phase tuần tự.
- **In:** deterministic seven-file asset bundle; named `ASSETS` binding; `run_worker_first: true`; exact-version override/promote/rollback; serialized deployment controller; bỏ toàn bộ R2 runtime/release/control-plane code; CI/docs.
- **Giữ:** `DataSource`, filesystem CLI/stdio source, canonical manifest/validator, full `releaseId`, `workflowBuildId`, tám `tqccl_*` tools, HTTP/auth và GoClaw handoff contract.
- **Cadence:** Một reviewed code+data Worker release mỗi mùa, khoảng ba tháng; không thêm `seasonId`.
- **Out:** npm publish; đổi tool/schema; OAuth; GoClaw implementation; CMS/crawler; database/KV/D1; nonzero gradual traffic split; dormant R2 compatibility.

## Architecture

```text
six canonical JSON -> deterministic .worker-assets/ + manifest
 -> protected production approval -> Worker version upload
 -> prior 100% + candidate 0% -> authenticated version override
 -> one version at 100% -> production verify / whole-version rollback
Worker: ASSETS.fetch(fixed allowlist) -> validated immutable snapshot -> 8 tools
```

Worker luôn chạy trước assets. Public HTTP chỉ có `/healthz` và `/mcp`; mọi asset path trả `404`.

## Phases

| # | Phase | Status | Depends on |
|---|---|---|---|
| 1 | [Khóa asset contract và deterministic builder](./phase-01-lock-asset-contract-and-builder.md) | Completed | — |
| 2 | [Triển khai Static Assets DataSource và Worker wiring](./phase-02-implement-static-assets-data-source.md) | Completed | 1 |
| 3 | [Thay R2 release và control plane](./phase-03-replace-r2-release-and-control-plane.md) | Completed | 2 |
| 4 | [Tài liệu, full verification và đóng migration](./phase-04-document-verify-and-close-migration.md) | In progress | 3 |

## Cross-Plan Dependencies

- Plan này block và supersede phần R2 release/operations của Phase 6 trong `260723-2055-mcp-goclaw-image-team-research`.
- Plan cũ giữ nguyên kết quả Phases 1–5 và public MCP contract; chỉ đóng khi live Static Assets/rollback evidence đạt.

## Acceptance Criteria

- [x] Asset bundle có đúng manifest + sáu JSON, deterministic, validated và không chứa secret/file thừa.
- [x] Production Worker dùng `ASSETS`, `run_worker_first: true` và version metadata; không có R2 binding.
- [x] Filesystem/Static Assets parity và tám tools/GoClaw contract không đổi.
- [x] Public asset URLs luôn `404`; loader fail closed thành safe `DATA_UNAVAILABLE`.
- [ ] Candidate `0%` được verify trên production route bằng version override + authenticated version header trước khi promote duy nhất `100%`.
- [x] Protected environment approval xảy ra trước mọi Cloudflare upload/deployment mutation; production job chỉ chạy bằng manual dispatch trên exact `main` SHA.
- [x] Override failure phục hồi prior single-version deployment; cleanup cũng dùng expected-current guard và không ghi đè deployment khác.
- [x] Production releases được tuần tự hóa; rollback chỉ chạy nếu current version vẫn thuộc run đang xử lý.
- [ ] Rollback known-good Worker version phục hồi đồng thời code + data; bearer không bị rollback.
- [x] Không còn pointer/CAS/lock/receipt/AWS SDK/R2 credential hoặc npm publishing path.
- [x] Full Node `22.16.0`, Workerd, repository và docs gates pass.
- [ ] Authorized live Cloudflare, rollback và conditional R2 inventory gates pass.

## Empirical Gates

- Version override/private paths và exact authenticated runtime version metadata.
- Cold parse/validation/memory với corpus thật trên Cloudflare account mục tiêu.
- Deploy token/protected environment và edge rate rule live state.
- Inventory chứng minh R2 resource/key không tồn tại, hoặc revoke/retire có evidence nếu thực sự tồn tại; rollback rehearsal diễn ra trước resource retirement.

## Red Team Review

### Session — 2026-07-31

- **Findings:** 9 unique; 8 accepted, 1 rejected/redirected.
- **Accepted:** clean-checkout build order; production concurrency; drift-safe controller/rollback; authenticated version header; same-SHA evidence; no public preview bypass; R2 credential denylist/revocation; bounded streaming.
- **Rejected as stated:** Mở rộng `workflowBuildId` sang Worker/transport. Verified contract giữ semantic identity; deployment integrity dùng Worker version ID + release evidence riêng.
- Chi tiết và code evidence: [Red-team adjudication](./reports/red-team-adjudication.md).

## Validation Log

### Session 1 — 2026-07-31

- **Trigger:** Quyết định bỏ R2 sau khi đánh giá cadence theo mùa.
- **Questions answered from the preceding design discussion:** 5.
- **Confirmed:** Bỏ R2; code+data atomic; mùa ba tháng; không giữ compatibility layer; không npm publish.
- **Scope challenge:** Tái sử dụng builder/validator/DataSource; không thêm `seasonId`, CMS hoặc storage mới.
- **Open decisions:** Không có product decision; các mục còn lại là empirical release gates.
- **Verification:** Session 1 path scan `43/43` là historical và đã bị audit supersede; Session 2 sửa `8/8` implementation-readiness findings; [chi tiết](./reports/validation.md).
- **Whole-plan sweep:** 0 unresolved contradictions.

### Session 2 — 2026-07-31

- **Trigger:** Implementation-readiness audit sau deep-plan validation.
- **Findings applied:** 8/8 — approval ordering, failed-smoke cleanup, dirty-worktree build gate, CI rename consumer, root command, inverted residue scan, `DataSource.load()` contract, conditional R2 inventory/revocation.
- **Session 1 verification:** Superseded; structural validity did not prove command/runtime readiness.
- **Latest sweep:** Structural validation và command/contract consistency pass; 0 unresolved contradictions.

<!-- slug: thay-r2-bng-worker-static-assets -->
