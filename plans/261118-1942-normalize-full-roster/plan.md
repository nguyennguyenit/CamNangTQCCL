---
title: "Normalize nhận đủ kho thật (#165)"
description: "tqccl_normalize_entities chạy được kho thật (≥ 238 mục, gửi tên) mà không phải cắt tay, giữ nguyên thuật toán chuẩn hoá và digest."
status: in-progress
priority: P1
effort: 3d
issue: 165
branch: fix/165-normalize-full-roster
tags: [bugfix, api, mcp-worker, critical]
blockedBy: []
blocks: []
created: 2026-11-18
---

# Normalize nhận đủ kho thật (#165)

## Overview

`tqccl_normalize_entities` báo `RESULT_TOO_LARGE` từ khoảng 75 observation; trần đầu vào 100 mục / 16 KiB; CLI chỉ nhận JSON trên command line. Kho thật (93 tướng 5★ + 145 chiến pháp = 238 mục) phải cắt tay, mất đội và từng gây loại oan đội T0 (#164).

Hướng chốt ([#165](https://github.com/nguyennguyenit/CamNangTQCCL/issues/165#issuecomment-6989515671)), sửa sau red team:
1. Không đổi thuật toán chuẩn hoá, ưu tiên bằng chứng hay digest.
2. Thu gọn kết quả tại handler: state không còn tên/evidence, `unresolved` là nguồn duy nhất cho mục cần rà soát, observations chỉ `{observationId, canonicalId}`; `recommend` lấy tên từ catalog (sửa luôn #166).
3. Trần đầu vào chốt **từ số đo trên đường gửi tên** (ràng buộc 40 000 ký tự kết quả, 64 KiB body HTTP); CLI nhận `--input-file`/stdin đọc có giới hạn.
4. Giữ trần MCP; có ngân sách CPU cho normalize và recommend kho đầy đủ.

Scope: HOLD. Ngoài phạm vi: #164 (tên Hán-Việt), phân trang normalize, nâng `TQCCL_MCP_MAX_RESULT_BYTES`/`TQCCL_MCP_MAX_BODY_BYTES`. Nếu số đo cho trần < 238 mục: dừng, replan.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Đo trên đường gọi thật và chốt trần](./phase-01-baseline-size-harness.md) | Pending |
| 2 | [Thu gọn kết quả normalize](./phase-02-compact-output.md) | Pending |
| 3 | [Trần đầu vào, CLI file/stdin, ngân sách](./phase-03-input-limits-and-cli.md) | Pending |
| 4 | [Consumer, tài liệu, rollout](./phase-04-consumers-and-docs.md) | Pending |

## Success Criteria

- [ ] Kho 238 mục gửi bằng tên (và biến thể có 25 mục mơ hồ/không biết) chạy `normalize → recommend` qua handler, CLI `--input -` và HTTP production workerd; recommend trả tên catalog.
- [ ] Digest handler = digest domain cho cùng đầu vào; đổi sao đỏ/danh tính/`familyId`/đội khoá vẫn làm binding cũ hỏng.
- [ ] Không mất `unresolved`, `candidates`, cảnh báo, ưu tiên `manualCorrection` (`manual: true`), dấu untrusted.
- [ ] ≤ 300 mục (id ≤ 32 ký tự; schema nhận tới 64) với ≤ 60 mục chưa rõ (tỉ lệ tướng/chiến pháp như kho thật) lọt < 40 000 ký tự kết quả (đo 34 931; K tối đa 69); vượt → `RESULT_TOO_LARGE` có kiểu; `tools/list` < 90 KiB; ngân sách `normalizeMs`/`recommendMs` xanh. <!-- Updated: Code review 2026-11-19; CI 2026-11-20 -->
- [ ] `npm run test:coverage` và `npm run check:repository` xanh; tqccl-auto test xanh.

## Dependencies

- Consumer ngoài repo: tqccl-auto (`tqkh/advise.py`, 2 bản skill `tu-van-team`), commit riêng.
- Rollout: hẹn chủ Dewee trước merge (auto-deploy). Review rủi ro cao: Astra → Fable.

## Red Team Review

### Session — 2026-11-19
**Findings:** 15 (14 accepted, 1 rejected) · **Severity:** 2 Critical, 8 High, 5 Medium
Reviewers: Security Adversary, Assumption Destroyer, Failure Mode Analyst (`code-reviewer`). Báo cáo: `reports/` (agent://RedTeamSecurity, RedTeamAssumptions, RedTeamFailureModes).

| # | Finding | Severity | Disposition | Applied To |
|---|---------|----------|-------------|------------|
| 1 | Số đo dùng fixture canonicalId, tên rỗng, thiếu `entityKind`; đường gửi tên vượt 40 000 ký tự | Critical | Accept | P1, P2, P3 |
| 2 | Trần 300 mục / 60 KiB mâu thuẫn; ca xấu nhất không tới được bước đo output | Critical | Accept | P1, P3 |
| 3 | `unresolved` đã có `observedText` (claim sai), dữ liệu lặp, còn `evidence` | High | Accept | P2 |
| 4 | Không đo CPU normalize; budget workerd không có metric normalize | High | Accept | P1, P3 |
| 5 | Fixture thiếu `familyId`, digest literal phụ thuộc catalog | High | Accept | P1 |
| 6 | Test HTTP đặt ở `worker.integration` (Node, snapshot 1 tướng) | High | Accept | P3 |
| 7 | Auto-deploy làm vỡ Dewee đã cache output schema | High | Accept | P4 |
| 8 | Thiếu rollback; `rehearse_rollback` fail catalog | High | Accept | P4 |
| 9 | Thứ tự cross-repo phụ thuộc working tree; E2E chỉ sau deploy | High | Accept | P4 |
| 10 | Bỏ hết dấu untrusted / `confidence` | Medium | Accept (manual flag + provenance trust) | P2 |
| 11 | Body HTTP thô (escape ASCII, envelope) vượt 64 KiB dù < 60 KiB đo lại | Medium | Accept | P1, P3 |
| 12 | CLI đọc file/stdin chưa thiết kế (sync parse, FIFO, stdin treo) | Medium | Accept | P3 |
| 13 | File tạm trên Windows + rò dữ liệu kho → dùng stdin | Medium | Accept | P4 |
| 14 | `warnings` max 100 vỡ khi tăng trần; test security/schema chỉ chạy normalize rỗng; `it.fails` | Medium | Accept | P2, P3 |
| 15 | E2E sửa state thật; tên tài khoản trong research public | Medium | Accept (đã ẩn danh `research/full-roster-sample.json`; E2E dùng state copy) | P1, P4 |
| — | Bỏ hẳn bước E2E vì cần user xác nhận | Medium | Reject: E2E là bằng chứng chính; thay bằng đường lùi "dừng ở normalize, ghi rõ" | — |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01…04, research/size-measurement.md
- Decision deltas checked: 7 (trần từ số đo; state không tên; unresolved không evidence; observations tối thiểu; recommend tên catalog; stdin thay file tạm; E2E trên state copy trước merge)
- Reconciled stale references: 9 (300/60 KiB, "~310 mục", `entityKind` trong observations, claim unresolved, `worker.integration`, `it.fails`, digest literal, file tạm, tên tài khoản)
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-11-19
- Q1 Bỏ `displayName` khỏi `canonicalState` normalize, recommend lấy tên catalog: **user đồng ý** sau giải thích (canonicalId vẫn định danh; tên ở output recommend từ catalog, lúc rà soát client dùng `observedText` của mình). Gộp #166 vào PR này. Đã có trong phase 2 › Design, không cần sửa thêm.
- Q2 Rollout Dewee: **để sau**, chốt lúc mở PR (phase 4 › Rollout giữ nguyên làm mặc định).

### Session 2 — 2026-11-19
- Q3 Trần khi ca toàn tên sai chỉ cho N ≈ 131–174: **user chọn trần thực tế** 300 mục / 60 770 B, bảo đảm ≤ 50 mục chưa rõ, vượt → `RESULT_TOO_LARGE`. Bỏ thêm `observedText` khỏi `unresolved`. Propagated: phase-01 › Chốt trần, phase-02 › Design, phase-03 › Decisions + Tests Before #2, Success Criteria.
