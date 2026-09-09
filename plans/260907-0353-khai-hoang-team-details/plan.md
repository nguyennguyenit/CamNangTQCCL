---
title: "Khai hoang team details"
description: "Bổ sung sáu nhóm hướng dẫn khai hoang từ 11 ảnh, với kiểm thử trước thay đổi."
status: completed
priority: P1
effort: ""
tags: [frontend, feature, data]
branch: main
blockedBy: []
blocks: []
created: 2026-09-07
---

# Khai hoang team details

## Overview

Six optional guide groups now belong to each matching three-hero opening roster: overview, ratings, hột requirements, ordered land-4/5 defenders, split teams and transitions. Summaries stay compact; detailed instructions expand inside each card and persist across tactic-build switches. See [implementation validation](./reports/implementation-validation.md).

## Goals

| # | Goal | Priority |
|---|------|----------|
| 1 | Faithfully cover all 11 supplied images on their resolved three-hero rosters | P1 |
| 2 | Current-only Khai hoang display, with no season or source presentation | P1 |
| 3 | Preserve variants, global mines, Chạm Sứ and unrelated WIP | P1 |

## Accepted boundaries

Remove existing Khai hoang season banner, period/region/source display and source-based variant labels. Keep internal metadata and meaningful variants with neutral tactic-based labels. Do not change Chạm Sứ sources. User selected “Theo bộ ba tướng” on 2026-09-09: exactly one guide at `teams[].guide`, shared explicitly by same-roster variants, with no `variant.guide`. Main tactics, units and commanders remain build-specific. Show a compact note that the guide/score is for the roster and has not been rated separately for each tactic build; preserve all conditional instructions.

No backend, season machinery, scoring engine, pipeline rebuild, commit or deploy. Shared `js/render.js` work with the older season plan must integrate sequentially; no hard dependency between plans.

## Evidence and pending inputs

- [Accepted brainstorm](../reports/brainstorm-260907-0347-khai-hoang-team-details.md), [data research](../reports/research-260907-0352-khai-hoang-data.md), [UI research](../reports/research-260907-0352-khai-hoang-ui.md).
- [Image intake: all scores and defender orders](./reports/image-intake.md); full overview/split/transition transcription still required.
- [Cross-plan reconciliation](./reports/cross-plan-scan.md).
- Image 2 roster confirmed by user on 2026-09-07: Quan Ngân Bình · Nhạc Tiến · Thái Văn Cơ. Additional image labels Trình Phổ as a later-stage replacement; do not substitute the opening roster.
- User selected research for images 7/9 on 2026-09-07. [Tactic evidence](../reports/research-260907-1421-khai-hoang-missing-tactics.md): image 7 has six learned tactics at level 32; image 9 has three learned tactics before level 20 and six at level 22 (full video 00:10, Gia Cát Khác becomes leader). Image 7 now also has two user-proposed pre-20 options (personal assessment, not battle-verified); leader positions and the Tam Thế activation rationale still need verification. Image 9 post-awakening build is resolved; independent confirmation remains a research gap, not a pending roster-only-card choice. Do not claim complete current main builds or fix the final team count.
- Guide/score ownership resolved: three-hero roster, with the note “Đánh giá chung cho bộ ba tướng; chưa chấm riêng từng bộ chiến pháp.” Different third heroes require different teams; tactic/commander evidence is separate from guide ownership.
- Continue full transcription and unresolved build research; resolve all 11 image dispositions before delivery completion. No further ownership-choice gate remains.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Data curation and guide contract](./phase-01-start.md) | Complete |
| 2 | [Roster guide and build UI](./phase-02-team-guide-ui.md) | Complete |
| 3 | [Integration and documentation](./phase-03-integration-and-docs.md) | Complete |

Execute 1 → 2 → 3. Phase 1 owns the schema; phases 2/3 consume it.

## Success Criteria

- [x] All 11 images have reviewed ownership and supported fields in the transcription ledger.
- [x] Six groups render faithfully; zero survives, unknown data is omitted and note-only groups remain visible.
- [x] One roster guide with applicability note outside `.kh-build`; content and disclosure state persist across build switches while tactics/commanders change, with no cross-roster leakage or neighboring card changes.
- [x] No season/provenance on Khai hoang main UI; internal metadata and Chạm Sứ source behavior retained.
- [x] Keyboard and disclosure behavior at 375px/1280px, plus 320px overflow edge, verified.
- [x] Independent expected values, RED/GREEN regression evidence and supported Node 22 delivery gates pass.
- [x] Exact commander/unit/tactic expectations cover task-owned default builds and variants, including image 9's stage-specific leader change and unverified-stage omissions for image 7.
- [x] Strict canonical reference checks cover new/changed fields; unchanged legacy alias/compound fields remain equal to their pre-edit values.
- [x] Canonical/dist parity and scoped docs verified; unrelated WIP preserved.

<!-- slug: khai-hoang-team-details -->

## Red Team Review and Validation

The 2026-09-07 review had three reviewers and 3 unique Medium findings. Hero-note provenance and qualitative hột handling were corrected; the ownership question raised then was resolved by the user's roster-level choice on 2026-09-09. [Findings, 30 source checks and interview](reports/plan-validation.md).

The 2026-09-07 validation recorded a CLI format pass and whole-plan sweep; neither is implementation evidence. All implementation tasks remain pending. No suitable live task surface was found in that validation; durable phase checklists are the handoff.

### Audit corrections — 2026-09-09

User authorized applying the [audit's three accepted findings](reports/audit-260909-0146-khai-hoang-team-details.md): 2 Medium and 1 Low. Phase 1 pins exact root/variant stage expectations and limits canonical validation to new/changed fields. Phases 2/3 consume those expectations on the actual route and retain unchanged legacy data. Phase 3 distinguishes resolved image-9 stage tactics/commanders from remaining image-7 and source questions. The later roster-guide decision preserves all three corrections; implementation remains pending.

### Whole-Plan Consistency Sweep — 2026-09-09

Re-read index and all three phases after the audit corrections and subsequent roster-guide decision. Checked parent-team schema ownership, persistent guide placement/state, separate build expectations, scoped canonical validation and evidence status across requirements, steps, test matrices and success criteria. No unresolved ownership contradiction remains. Pending source/transcription inputs and all implementation phases remain explicit. See the [roster decision update](reports/plan-validation.md#roster-guide-decision--2026-09-09) for validation and the superseded historical decision log.
