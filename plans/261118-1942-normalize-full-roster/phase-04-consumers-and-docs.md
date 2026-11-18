---
phase: 4
title: "Consumer, tài liệu, rollout"
status: pending
priority: P1
effort: "5h"
dependencies: [3]
---

# Phase 4: Consumer, tài liệu, rollout
<!-- Updated: Red Team 2026-11-19 - stdin thay file tạm, E2E trước merge trên state copy, rollback, Dewee, đủ consumer -->

## Goal
Consumer và tài liệu theo hợp đồng mới; tqccl-auto tư vấn kho đầy đủ; rollout/rollback có chủ.

## Files to Create / Modify
CamNangTQCCL:
- `docs/mcp-research-server.md:17,31,99` (hình dạng gọn, trần mới, 40 000 ký tự, HTTP lỗi khi vượt).
- `docs/goclaw-mcp-skill-handoff.md:39` (131072 → 98304), `:45-50`, `:75-78` (breaking change output schema normalize; refresh `tools/list`; CLI `--input -`/`--input-file`).
- `.agents/skills/tqccl-coexist-team-builder/SKILL.md:20,34`.
- `docs/project-changelog.md` (mục mới đầu file: hợp đồng normalize, `displayName` optional ở recommend, `WORKFLOW_BUILD_ID` đổi → normalize + confirm lại).
- Kiểm `agent-knowledge/rules/coexist.jsonl:26`, `agent-knowledge/workflows.json:105-141`; sửa nếu nêu field đã bỏ, rồi `npm run check:knowledge-bundle`.

tqccl-auto (repo riêng, commit riêng):
- `tqkh/advise.py`: `call()` truyền payload qua stdin (`run([... "--input", "-"], input=text, ...)`, không file tạm); bỏ `MAX_CMDLINE`; `MAX_OBSERVATIONS` = trần N; kiểm thêm byte UTF-8 ≤ trần byte → `roster_too_large` (tính cả observation đội khoá, `advise.py:155-157,182,194-196`); `CLI_USAGE` từ CLI cũ → lỗi `camnang_outdated` có hướng dẫn checkout; bỏ `_strip_state`; đọc observations gọn và unresolved; tên hiển thị lấy từ `observedText` qua `observationId` (state không còn tên).
- `tests/test_logic_advise.py:39,56,107,139-146` cập nhật; thêm test stdin payload tiếng Việt 50 KB và test `camnang_outdated`.
- Cả hai bản skill `tu-van-team`: `tqccl-auto/skill/tu-van-team/SKILL.md:31,55` và `~/.omp/agent/skills/tu-van-team/SKILL.md:31,43-48,55` (trần mới, CLI ví dụ).

## Tasks & Steps
1. Cập nhật tài liệu/skill CamNangTQCCL.
2. Cập nhật tqccl-auto + test.
3. **E2E trước khi mở PR, trên nhánh feature, state copy:** copy `tqccl-auto/state/<account>` sang thư mục tạm, chạy `advise --state <tmp>`: bỏ exclude, nạp đủ chiến pháp từ `research/full-roster-sample.json`, `normalize` → user xác nhận → `confirm` → `recommend --full-box`. State thật không bị sửa. Nếu user chưa xác nhận được: dừng ở `normalize` (đo kích thước, unresolved), ghi rõ trong PR là chưa chạy `recommend` thật.
4. PR description: breaking change cho MCP consumer, thứ tự merge/rollback.

## Rollout / Rollback
- Merge vào `main` tự deploy MCP (`mcp-release.yml`). Trước merge: hẹn khung giờ với chủ Dewee; sau deploy: reconnect Dewee, refresh `tools/list`, smoke normalize + recommend.
- Release này **không** dùng `rehearse_rollback` (so catalog bản trước sẽ fail ở `rollback-prior:catalog`, `verify-release.ts:185-188`).
- Rollback: revert tqccl-auto trước, rồi CamNangTQCCL; client phải refresh `tools/list` lại; binding mất hiệu lực lần hai (ghi changelog).
- tqccl-auto chạy CLI từ working tree `../CamNangTQCCL`: checkout nhánh cũ → `camnang_outdated` rõ ràng thay vì `CLI_USAGE` mơ hồ.

## Regression Gate
- CamNangTQCCL: `cd mcp-worker && npm run test:coverage && npm run check:repository`.
- tqccl-auto: test suite repo đó.

## Success Criteria
- `check:repository` xanh; tqccl-auto test xanh; E2E bước 3 chạy đủ kho không cắt tay (hoặc ghi rõ phần chưa chạy); không còn tài liệu ghi 131072; state thật của account không đổi.

## Risk Assessment
- Dewee không refresh kịp → normalize lỗi validate output. Phản ứng: refresh ngay; nếu không được trong khung giờ → rollback theo thứ tự trên.
