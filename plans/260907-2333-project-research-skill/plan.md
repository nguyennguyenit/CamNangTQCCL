---
title: "Project research skill cho CamNangTQCCL"
description: "Kế hoạch --deep --tdd cho skill tqccl-research và handoff cùng tồn đã chốt."
status: in-progress
priority: P2
effort: "8h"
tags: [skills, research, tdd]
created: 2026-09-07
branch: main
blockedBy: []
blocks: []
---

# Project research skill

## Overview

Triển khai đúng [brainstorm đã chốt](../reports/brainstorm-260907-1714-project-research-skill.md): research team, chiến pháp/cơ chế và xác minh nguồn; kế thừa mùa hội thoại, lưu bằng chứng/đính chính, giữ SGSDeck làm Sách Giáo Khoa và 233乐园 trong tập nguồn đã chọn.

Kế hoạch chỉ mô tả công việc; chưa tạo skill, chưa chạy behavioral Red/Green. Mọi hạng mục triển khai còn pending.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Gói skill tự đủ gồm đúng bốn file, không phụ thuộc bắt buộc ak:research | P2 |
| 2 | Research loop có bằng chứng, ngân sách và phạm vi; engineer loop có gate tái hiện | P2 |
| 3 | Handoff cùng tồn bảo toàn tier, kho, khóa và độ đỏ; kiểm chứng đủ 26 tình huống | P2 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Phase 1: Start](./phase-01-start.md) | Pending |

[Phase 2: Research skill package](./phase-02-research-skill-package.md) — pending; [Phase 3: Coexist integration and validation](./phase-03-coexist-integration-and-validation.md) — pending. Thứ tự thực thi **1 → 2 → 3**. Bảng scaffold do CLI sở hữu được giữ nguyên; cả ba file phase là phạm vi thực thi.

## Scope và dependencies

Đúng bốn file mới dưới `.agents/skills/tqccl-research/`: `SKILL.md`, `agents/openai.yaml`, `references/evidence-and-region-rules.md`, `references/report-template.md`; sửa nhỏ duy nhất điểm research handoff trong `.agents/skills/tqccl-coexist-team-builder/SKILL.md`.

Danh mục nguồn và checklist cơ chế hiện có là authority đọc; không sao chép danh mục, không nhập Strong/Medium/Weak. Không sửa runtime, scripts, tests ứng dụng, dependency, global skill/memory, Git, deploy hoặc thêm scheduler. Hồ sơ test nằm trong reports của kế hoạch; case15 tạo thêm một report mới có allowlist tại `plans/reports/` để kiểm chứng lưu và đọc lại thật.

Không phụ thuộc output các plan catalog/season/Khai Hoang đang mở; xem [cross-plan scan](./reports/cross-plan-scan.md). Research vẫn ghi mùa/khu vực dù UI Khai Hoang giữ latest-maintained.

## Success Criteria

- [ ] Đúng bốn file mới và một handoff nhỏ; đường dẫn tương đối resolve được, frontmatter/metadata đọc được.
- [ ] Ba nhánh, thứ tự mùa và đúng ba trạng thái theo từng nhận định hoạt động trên output thật.
- [ ] Đủ 26 case gốc và các subcase routing/account/budget/persistence bắt buộc, gồm 17 case gốc và 9 hồ sơ bổ sung; có baseline, output sau sửa, rubric và kết quả từng assertion.
- [ ] Giữ build nguyên nguồn, chủ tướng/giai đoạn/variant/điểm/patch; không biến lịch sử, suy luận hoặc runtime thành bằng chứng live.
- [ ] Ngân sách tối đa 5 external calls/chủ đề gồm calls con/media; hết ngân sách báo thiếu, không reset loop.
- [ ] Research-only không đổi skill/runtime; engineer loop tách nguyên nhân và quyền sửa; cùng tồn giữ khóa/tier/kho/độ đỏ.
- [ ] Cấu trúc, link, scope diff và behavioral regression đạt; không tính missing dependency/file hoặc grep là behavioral Red/Green.

## Validation và handoff

[Ma trận và rubric](./reports/behavioral-case-matrix.md) là hợp đồng đầu ra; [Phase 1](./phase-01-start.md) sở hữu capture baseline. Phương án đề xuất: replay local đủ 26 case, cộng ba smoke live đại diện ba nhánh; controller ghi lựa chọn mặc định khi áp dụng, chưa coi là user-confirmed. Replay luôn ghi lịch sử, không xác nhận website/meta hiện tại.

Không thêm runner hay cài package để lách validator thiếu PyYAML. Dùng parser sẵn có/manual traversal có evidence và harness agent sẵn có/fresh session. Preflight harness phải chứng minh enforcement, read/search isolation và trace trước baseline/Phase2; hiện chưa có capability đáp ứng được xác minh. Thiếu thì ENVIRONMENT_BLOCKED, không tạo package trước baseline.

Câu hỏi bắt buộc về thiết kế: không còn. Độ rộng live mặc định do controller ghi nhận khi áp dụng; không cần câu hỏi bắt buộc mới.

<!-- slug: project-research-skill -->

## Red Team Review

Ba reviewer, 5 findings Medium đã áp dụng; không đảo quyết định brainstorm. Xem [review và validation](./reports/plan-review-and-validation.md).

## Validation Log

30 source anchors đã đối chiếu; YAML/CLI format và link local đạt. Câu hỏi tùy chọn về độ rộng live chưa có trả lời; giữ default đề xuất, không coi là approval. Sweep ngày 7/9 là snapshot lịch sử; audit tiếp ngày 8/9 tìm2 gap về harness/visibility đã bổ sung. Xem [audit mới](./reports/audit-260908-0038-project-research-skill.md); behavioral tests chưa chạy và preflight môi trường chưa đạt.


## Execution checkpoint — 2026-09-08

Thực thi `--tdd --advise` dừng tại **ENVIRONMENT_BLOCKED** trước baseline/Phase2. Controller đã pin plan và xác nhận CLI validation `valid: true`; đó là kiểm tra cấu trúc plan, không phải behavioral pass. Sweep cả ba phase: **0/32, 0/37, 0/34** checkbox hoàn tất (**0/103; 0%**), cả ba phase giữ pending. Không checkbox/gate nào được đánh dấu từ metadata inspection.

[Preflight](./reports/harness-preflight.md) ghi Codex CLI 0.153.4 và Claude Code 2.1.263; chưa chứng minh quyền exclusive-create một report, chống overwrite, read/search isolation và trace toàn tool surface. Kongming và debugger thống nhất NO-GO; chưa chạy probe, baseline, candidate hoặc live smoke; chưa tạo package/handoff. Xem [progress và điều kiện tiếp tục](./reports/progress-260908-preflight.md). Cần harness đã kiểm chứng đạt toàn bộ gate, hoặc user mở scope rõ ràng cho local guard rồi kiểm chứng; không hạ thiết kế để đi tiếp.


## Scope extension — 2026-09-08

User đã đồng ý bổ sung guard test cục bộ; xem [phạm vi và acceptance](./reports/local-guard-scope.md). Điều này chỉ thay lệnh cấm thêm runner đối với infrastructure test trong reports của plan; các gate enforcement/visibility/trace/baseline, gói skill bốn file và mọi giới hạn runtime/global/deploy giữ nguyên. Checkpoint ENVIRONMENT_BLOCKED trước đó là lịch sử; chỉ thay kết luận khi có evidence thực.

## Execution checkpoint — 2026-09-12

Harness structured-output v2 đã qua TDD 18/18, empirical preflight PASS và review độc lập 9.6/10 với 0 critical. Baseline v2 dùng namespace/profile khóa riêng; case04 là OBSERVED và được chấm PASS control. Case10-handoff bị subscription quota trước dispatcher; CLI báo reset 05:40 Asia/Saigon. Hiện có 1 capture hợp lệ, 1 quota-blocked, 33 primary case chưa chạy và case15-second chưa chạy. Phase1 giữ pending, Phase2/3 NO-GO. Xem [checkpoint và lệnh resume](./reports/progress-260912-harness-v2-quota.md).

Update 12:10: canary 04, 10-handoff, 15 + 15-second và 01 đạt capture gates; batch tiếp đạt 02, 03, 05–09 rồi dừng tại 10-lower do quota, reset 16:30. Trạng thái là 11/35 primary OBSERVED, 1 blocked, 23 chưa chạy. Partial grading có 8 case PASS và 3 BEHAVIORAL_FAIL; đây là Red inventory, chưa mở Phase2. Xem [results](./reports/baseline-v2-results.md) và [resume list](./reports/baseline-v2-resume.json).
