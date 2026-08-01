---
title: "Phase 1: Khóa asset contract và deterministic builder"
status: completed
---

# Phase 1: Khóa asset contract và deterministic builder

## Overview

- **Ưu tiên:** P1
- **Phụ thuộc:** Không
- **Mục tiêu:** Viết test trước để chuyển canonical release builder sang asset directory phẳng, gồm đúng `manifest.json` và sáu JSON.
- **Không làm:** Chưa đổi Worker runtime, chưa xóa R2.

## Context Links

- [Cloudflare Static Assets research](./research/cloudflare-static-assets.md)
- [R2 impact map](./research/r2-impact-map.md)
- `mcp-worker/src/data/artifact-contracts.ts`
- `mcp-worker/scripts/build-data-release.ts`

## Requirements

- Output duy nhất: `mcp-worker/.worker-assets/`.
- Exact allowlist: `manifest.json`, `teams.json`, `team-tier.json`, `coexist.json`, `heroes-dict.json`, `tactics.json`, `books-dict.json`.
- Không symlink, file thừa, path traversal, stale output hoặc secret.
- Cùng input bytes tạo cùng manifest bytes, `releaseId` và asset inventory digest.
- Build evidence bind `{ commitSha, sourceTree, manifestSha256, releaseId, workflowBuildId, assetInventoryDigest }` từ cùng checkout.
- Giữ full `releaseId`; không thêm `seasonId`.

## File Inventory

| Action | File | Rough size | Test impact |
|---|---|---:|---|
| Rename/modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/scripts/build-data-release.ts` → `build-worker-assets.ts` | 300 LOC | Builder contract |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/data/artifact-contracts.ts` | 300 LOC | Remove pointer-only type; retain manifest |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package.json` | small | Rename build command |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/package-lock.json` | generated | Script/package consistency |
| Modify | `/Users/plateau/Project/CamNangTQCCL/.gitignore` | small | Ignore `mcp-worker/.worker-assets/` |
| Modify | `/Users/plateau/Project/CamNangTQCCL/.github/workflows/mcp-worker.yml` | small | Rename builder consumer in same phase |
| Create | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/src/release/worker-release-evidence.ts` | small | Validate same-SHA evidence |
| Rename/modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/release/build-data-release.test.ts` → `build-worker-assets.test.ts` | 300 LOC | Tests first |
| Modify | `/Users/plateau/Project/CamNangTQCCL/mcp-worker/test/data/artifact-contracts.test.ts` | existing | Freeze identity/allowlist |

Generated `.worker-assets/` is build output, not committed source.

## Tests Before

1. Freeze current six-input manifest identity and filesystem semantic result.
2. Add failing builder tests for exact seven-file output, deterministic bytes and clean-tree provenance.
3. Add failing cases: missing/extra file, symlink, invalid JSON, oversize, dirty tree and stale output.

## Refactor

1. Extract the minimal allowlist/output writer from the current release builder.
2. Write to a temporary sibling directory; validate all bytes; atomically replace `.worker-assets/`.
3. Remove release-prefix/pointer assumptions while retaining canonical manifest validation.
4. Emit and validate release evidence bound to exact commit/tree and output digests; artifact filename alone is not evidence.
5. Rename npm script to `build:worker-assets`; update the CI build/artifact step in the same phase so no intermediate commit calls the removed command; keep package private.

## Tests After

- Rebuild twice and compare all seven files byte-for-byte.
- Verify `releaseId` is unchanged for unchanged six source artifacts.
- Verify output contains no raw crawl cache, fixture, metadata receipt or secret.
- Verify workflow/package contract references only the new builder command.

## Test Scenario Matrix

| Priority | Scenario | Expected |
|---|---|---|
| Critical | Same six inputs built twice | Identical bytes/digests |
| Critical | Missing, extra or changed artifact | Build fails closed |
| High | Symlink/path traversal/stale file | Rejected; no partial output |
| High | Dirty local source | Manual build fails with actionable error |
| High | Phase 1 CI after script rename | Workflow invokes `build:worker-assets`, not removed command |
| Medium | Quarterly data diff | New `releaseId`, unchanged public schema |

## Function / Interface Checklist

- [x] Canonical artifact allowlist has one owner.
- [x] `DataManifest` and `validateDataSnapshot` remain compatible.
- [x] `ReleasePointer` and pointer-only errors are not used by the new builder.
- [x] Builder returns evidence needed by later upload: commit/source tree, `releaseId`, workflow identity and inventory digest.
- [x] Evidence parser rejects missing, ambiguous or mismatched commit/tree/asset identities.

## Dependency Map

```text
canonical data + workflow build -> build-worker-assets -> .worker-assets
Phase 1 -> Phase 2 runtime binding
Phase 1 -> Phase 3 release workflow
```

## Regression Gate

```bash
cd mcp-worker
npm run test -- test/data/artifact-contracts.test.ts test/release/build-worker-assets.test.ts
npm run typecheck
```

Direct CLI build remains a clean-checkout integration gate in Phase 3. Phase 1 tests exercise the builder with injected clean/dirty source fixtures; they do not require an uncommitted Cook worktree to appear clean.

## Todo

- [x] Viết characterization và failing tests trước.
- [x] Chuyển builder sang exact static asset output.
- [x] Chạy test hẹp, typecheck và deterministic rebuild.
- [x] Cập nhật CI consumer cùng lúc rename command.
- [x] Không sửa/xóa R2 runtime trong phase này.

## Success Criteria

- [x] Bảy-file asset bundle deterministic và fail-closed.
- [x] Full `releaseId`/workflow identity không bị đổi nghĩa.
- [x] R2 production path vẫn còn nguyên để rollback code trong lúc migration.

## Risks and Rollback

- **Risk:** Builder xóa nhầm output. **Mitigation:** chỉ atomic-replace exact `.worker-assets/`.
- **Risk:** Source/artifact mismatch. **Mitigation:** clean-tree + byte/hash/count validation.
- **Rollback:** Revert builder/test rename; runtime production chưa thay đổi.

## Security Considerations

- Asset directory là public-upload input: exact allowlist, no symlink, no secrets.
- Không tin filename, MIME hoặc ETag thay cho canonical SHA-256.
