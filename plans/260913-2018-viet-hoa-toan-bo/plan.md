---
title: "Việt hóa toàn bộ website, giữ nguyên nguồn và gameplay"
description: "Offline reviewed translations, coherent display publication, all eight sections and standalone routes, strict build gate."
status: completed
priority: P1
effort: ""
branch: main
tags: [localization, vietnamese, hard, advice, yagni, tdd]
blockedBy: []
blocks: []
created: 2026-09-13
---

# Việt hóa toàn bộ website

## Outcome đã khóa

Tất cả nội dung mặc định do website sở hữu hiển thị tiếng Việt, dùng glossary thống nhất; raw/search/gameplay/identity giữ nguyên. Nguồn, bản dịch, glossary hoặc UI mới chưa review phải chặn release.

- Nguồn: [brainstorm đã chốt](../reports/brainstorm-260914-0236-viet-hoa-toan-bo.md).
- Phạm vi: đủ 8 tab, cả hai standalone team route families, mọi build/owner và loading/empty/error/modal/a11y states; bao gồm Analyze, Recruit, Roster.
- Chỉ giữ external source link hiện có; không raw disclosure, runtime translation, admin UI hay i18n framework.
- AI draft + AI độc lập kiểm từng item; chỉ semantic ambiguity chưa giải quyết hỏi người dùng.
- 11 ô **Đồng Lòng Hợp Sức** đã hoàn tất; giữ `translation-reviewed`, không đổi stable identity. Current baseline: `fb8b3871d76792ffa812ded103ee0c52f83ab3607fd294085e33d088422bfb8e`.

## Decision và dependency

[Hợp đồng kỹ thuật và grounded inventory](reports/contracts.md) là authority chung cho C1–C6. Reuse strict Lookup ledger; Recommended tiếp tục generation hiện có; thêm đúng một non-Recommended display sidecar tại existing static publication boundary. Raw models không nhận translated copies.

Nguồn Recommended được capture từ verified cache sang normalized private input portable; CI không phụ thuộc sibling worktree hay live crawl. Review receipt là bằng chứng của lượt kiểm thật, không phải ledger schema thứ hai.

## Phases

1. [Contract, inventory và nguồn offline](phase-01-start.md) — P1-A…P1-C, không dependency.
2. [Dịch, kiểm độc lập và candidate publication](phase-02-reviewed-publication.md) — P2-A…P2-D, phụ thuộc phase 1 GO.
3. [Cutover mọi consumer và khóa release gate](phase-03-consumer-cutover-release.md) — P3-A…P3-E, phụ thuộc phase 2 GO.

Ba phase là ba gate dependency, không giảm requested scope thành MVP. Multi-file blast radius cần thiết vì có hai static entrypoints, nhiều independent renderers và một release boundary; không migration Worker API, engine, identity hay source DTO.

## Verification contract

Mỗi phase có Tests Before → Refactor → Tests After, task Goal/Targets/Steps/Success/Verify và literal Failure Protocol. Expected RED chỉ đạt khi đúng behavioral assertion đỏ; import/setup failure không tính. Sau mỗi phase phải có Kongming GO; Verify không đạt thì STOP và chuyển full failure evidence cho Kongming, không tự improvise.

Done của **implementation**: exact full-site inventory covered; missing/stale/unreviewed/unresolved/unknown = 0; fresh independent receipts; raw/gameplay parity; VI+Chinese search; lookup privacy; same HTML/data/Recommended pins; browser desktop/mobile + static/dynamic/no-JS gates xanh. Không lấy no-Han regex hoặc screenshot mẫu làm chứng cứ đủ site.

## Red Team Review

Bốn lens + Kongming đã review; 4 unique findings (1 High, 3 Medium) đã xử lý, không còn mandatory blocker. Kongming checkpoint cuối: **GO cho planning readiness**. [Adjudication và evidence](reports/verification.md); không coi review plan là implementation proof.

## Validation Log

CLI validation pass (`valid:true`); 3 phases / 12 tasks / 0 implementation done. Literal Failure Protocol, task/TDD fields, command syntax, links và whole-plan consistency đã kiểm. Status giữ pending; runtime tasks chờ cook, không tự triển khai.

## Handoff

Plan đã sẵn sàng để chuyển sang cook:

```text
/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260913-2018-viet-hoa-toan-bo/plan.md --advice --yagni
```

TDD là execution contract trong cả ba phase; không thêm flag cook không được runtime hỗ trợ. Không `--auto`, không tự cook/commit/push/deploy. Plan files là source of truth; live tasks chỉ là projection có dependency 1 → 2 → 3.

<!-- slug: viet-hoa-toan-bo -->
