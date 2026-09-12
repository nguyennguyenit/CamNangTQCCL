---
title: SGSDeck technical slice stopped at reuse gate
date: 2026-09-12
summary: Hoàn thiện pipeline private và các gate kỹ thuật; chưa nhập bulk vì chưa xác minh quyền reuse/export.
---

# SGSDeck technical slice stopped at reuse gate

## What happened

Thực hiện plan SGSDeck theo TDD cho phần kỹ thuật có thể tách khỏi dữ liệu bulk. Bổ sung parser nguồn giới hạn allowlist, cache có checksum, offline deterministic builder, canonical mapping validation, local query/validate và phân loại `data/sgsdeck/` là private trong source-tree contract.

Các vòng debugger và Kongming tìm ra lỗi path traversal, manifest fail-open, variant/ref validation, HTML void element, atomic promotion và redirect follow. Từng lỗi được khóa bằng test. Builder hiện validate đầy đủ staging trước khi promote; redirect ra ngoài allowlist bị từ chối trước request tiếp theo.

## Decision

Kongming cho phép hoàn tất technical slice nhưng chặn bulk ingestion và catalog promotion vì chưa có căn cứ reuse/export cho sáu catalog SGSDeck. Không tạo `data/sgsdeck/`, không deploy và không commit.

## Verification

- Focused SGSDeck: 21/21
- Python discovery: 110/110
- Node: 145/145
- Private artifact contract: 7/7
- Astro check: 0 diagnostics
- Build: pass
- Dist contracts: 10/10
- Verify: 36 files, 33 raw assets
- Final review: 0 critical

## Next steps

Xác minh permission, license hoặc authorized export cho việc lưu và phân phối normalized structured data. Khi gate mở, fetch đúng manifest đã duyệt, reconcile coverage sáu nhóm, review mapping và nghiệm thu snapshot thật.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
