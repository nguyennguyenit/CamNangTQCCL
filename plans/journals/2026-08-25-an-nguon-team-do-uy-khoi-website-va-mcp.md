---
title: Ẩn nguồn team Đô Úy khỏi website và MCP
date: 2026-08-24
summary: "Retire 48 team Đô Úy khỏi artifact công khai, đồng thời chặn snapshot cũ tại MCP boundary."
---

# Ẩn nguồn team Đô Úy khỏi website và MCP

## What happened

Nguồn mùa `do-uy` còn 48 team trong `data/teams.json`, 26 tier row, một tab website riêng và được Research MCP dùng chung với corpus public. Chỉ bỏ tab sẽ không đủ vì search, get, match và recommend vẫn có thể trả team mùa cũ.

## Decision

Loại `do-uy` khỏi artifact public và đường build, nhưng giữ `pipeline/do-uy-ss18-source.json` làm archive. Bỏ tab/module khỏi allowlist Astro. Thêm `publicTeamSnapshot()` ở request context MCP để snapshot cũ cũng bị lọc trước index và domain services. Regenerate `WORKFLOW_BUILD_ID` vì handler là semantic input.

## Verification

Artifact còn 166 team và 31 tier row, không có tier mồ côi. Root contract, website build, Python tests, toàn bộ 230 MCP tests, typecheck, focused stale-snapshot regression và workflow-build check đều qua. Reviewer không thấy runtime blocker.

## Next steps

Trước khi commit hoặc release, đồng bộ local `main` đang chậm `origin/main` 11 commit; review conflict ở MCP handler/tests, regenerate workflow identity và chạy lại MCP gates. Hai câu nhắc Đô Úy trong dữ liệu Cùng Tồn được giữ vì là mô tả chiến thuật, không phải record `source: do-uy`.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
