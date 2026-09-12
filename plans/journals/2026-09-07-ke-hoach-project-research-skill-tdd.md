---
title: Kế hoạch project research skill TDD
date: 2026-09-07
summary: "Lap plan deep TDD cho tqccl-research; 26 case goc va subcases, 5 findings da xu ly; chua trien khai."
---

# Kế hoạch project research skill TDD

## Context

Lập kế hoạch từ brainstorm đã chốt ngày 2026-09-07. Plan: `plans/260907-2333-project-research-skill/plan.md`.

## What happened

Hai researcher đối chiếu source owners và 26 tình huống. Planner viết ba phase. Ba reviewer đưa ra năm findings Medium; controller bổ sung routing tự nhiên, account override, guard cho test, persistence hai lượt và ledger budget qua handoff. Reviewer kiểm lại guard/persistence/budget không còn finding trong delta.

## Decisions

Giữ bốn file skill mới và handoff nhỏ trong coexist. Source registry và checklist cơ chế giữ owner cũ. TDD đòi output và tool trace thật; không dùng thiếu package/PyYAML làm behavioral Red. Local replay không xác nhận live game. Node YAML parser có sẵn; không cài thêm dependency. Không triển khai skill hoặc thay runtime/WIP.

## Next

Người dùng review kế hoạch. Khi triển khai: giữ --tdd, xác minh harness guard/discovery trước test; hoàn tất các case và subcases, ba smoke live theo default đề xuất nếu chưa có lựa chọn khác. Câu hỏi tùy chọn về độ rộng live chưa được trả lời, không ghi là approval.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
