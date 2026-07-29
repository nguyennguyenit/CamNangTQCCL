---
title: "Agentize verification — TQCCL MCP and CLI"
status: completed_with_findings
created: 2026-07-30
plan: ../260730-0006-agentize-verify-mcp-cli/plan.md
---

# Agentize verification — TQCCL MCP and CLI

## Summary

Verdict: **PASS cho accepted repository scope; NOT READY cho strict publishable Agentize package**.

- Core/CLI/MCP behavior, transport parity, auth, bounds, release gates: PASS.
- Agent-facing schema/error guidance: còn gap.
- npm packaging và coverage evidence: chưa đạt checklist strict Agentize.
- Không gọi Cloudflare/R2 live; không sửa implementation.

## Agentization Map

| Capability | Entry | Side effect | Auth | Agent | CLI |
|---|---|---|---|---:|---:|
| Đọc version/provenance | `tqccl_get_data_version` | Đọc snapshot | HTTP bearer | H | H |
| Chuẩn hóa observation | `tqccl_normalize_entities` | Không mutation | HTTP bearer | H | H |
| Tìm kiếm corpus | `tqccl_search` | Đọc snapshot | HTTP bearer | H | H |
| Đọc team | `tqccl_get_team` | Đọc snapshot | HTTP bearer | H | H |
| Match roster/team | `tqccl_match_team` | Không mutation | HTTP bearer | H | H |
| Recommend team | `tqccl_recommend_team` | Không mutation | HTTP bearer | H | H |
| Recommend coexist | `tqccl_recommend_coexist` | Không mutation | HTTP bearer | H | H |
| Suggest replacements | `tqccl_suggest_replacements` | Không mutation | HTTP bearer | H | H |

CLI dùng filesystem snapshot, không cần credential. HTTP dùng managed bearer; R2 chỉ được đọc qua narrow reader.

## Findings

### High — Public schema thiếu mô tả field

Đo trực tiếp từ JSON Schema draft-07 của tám tool:

- Mọi tool có description cấp tool.
- Tất cả property input/output kiểm được có `0` field description.
- Ví dụ: normalize input 25 field, recommend input 31–33 field, đều `0` description.

Impact: agent khó tự chọn tham số, hiểu binding/version và phục hồi lỗi mà không đọc docs ngoài protocol.

Recommendation: thêm `.describe(...)` vào schema authority, test catalog giữ descriptions, cập nhật workflow identity.

### Medium — MCP errors chưa actionable

`formatToolError` chỉ trả `{ code, retryable }` và text `TQCCL_ERROR:<code>`. Redaction tốt nhưng thiếu “vì sao” và “thử gì tiếp theo” theo Agentize.

Recommendation: thêm public safe `message` và optional `nextAction` theo code; không echo input/upstream.

### Medium — Chưa có coverage evidence

Không có `@vitest/coverage-v8`, `test:coverage` hoặc threshold. `212/212` test xanh nhưng không chứng minh core đạt line `>=80%` / branch `>=70%`.

Recommendation: thêm coverage provider + threshold cho `src/domain`, `src/research`, `src/data`; loại generated/adapter-only files hợp lý.

### Medium — Chưa publish-ready như Agentize CLI package

`package.json` đang `private: true`, không có `bin`, `files`, `publishConfig`, `prepublishOnly`. `--version` trả `CLI_USAGE`.

`npm pack --dry-run --json`:

- 236 entries.
- Unpacked 5,188,310 bytes.
- Bao gồm tests, TypeScript source, sourcemaps và `.wrangler-dist`.

Recommendation chỉ áp dụng nếu muốn publish: thêm executable bin, `--version`, files allowlist, provenance và pack-contract test.

## Verified Strengths

- Shared handler/contracts là một source of truth cho CLI, stdio và HTTP.
- Tám tool đều snake_case, read-only annotations chính xác, bounded output, pagination/truncation.
- Multi-call normalize → human confirmation → recommendation là boundary cần thiết, không phải endpoint mirroring thừa.
- CLI luôn xuất đúng một JSON document; usage/runtime errors redacted.
- stdio không ghi protocol noise ra stdout.
- HTTP bearer kiểm trước body/force-refresh/data source; rate và in-flight limits hoạt động.
- Stateless Streamable HTTP, no SSE, no Docker, no companion skill và single-package layout đều khớp quyết định scope gốc; không tính là defect.

## Verification

| Gate | Result |
|---|---|
| MCP Vitest | 212/212 PASS |
| Workerd | 2/2 PASS |
| Typecheck main + Worker | PASS |
| Build + workflow identity | PASS |
| Astro E2E | 14/14 PASS |
| Root JS | 133/133 PASS |
| Python fallback | 82/82 PASS |
| Vision Worker | 53/53 PASS |
| Wrangler dry-run | PASS, 1347.86 KiB / gzip 237.93 KiB |
| Dependency audit | 0 vulnerability |
| Local secret scan | PASS |

Lần chạy repository gate đầu dùng Node 24 ở child process và anti-drift từ chối đúng. Chạy lại với Node `22.16.0` truyền cho toàn process tree: PASS.

## Recommendations

1. P1: schema field descriptions + contract tests.
2. P1: safe actionable MCP error message/next action.
3. P2: coverage threshold.
4. P2 chỉ khi publish CLI: package/bin/files/version/provenance.

## Unresolved Questions

- Có triển khai ba gap agent-facing ngay trong plan MCP hiện tại không?
- CLI có cần trở thành npm package công khai không?
