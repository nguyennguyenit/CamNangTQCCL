---
title: "Bộ tra cứu thống nhất"
description: "Tra cứu tiếng Việt thống nhất sáu nhóm; giữ ID cũ, ưu tiên SGSDeck, TDD trước tích hợp."
status: completed
priority: P1
effort: "8–13 ngày công, gồm review danh tính và Việt hóa corpus"
tags: [data, lookup, vietnamese, tdd]
created: 2026-09-12
---

# Bộ tra cứu thống nhất

## Outcome và quyết định đã chốt

Một mục **Tra cứu** cho tướng, chiến pháp, trang bị/đặc kỹ, kỹ năng quân sư,
cải tạo binh chủng, công trình/cấp nâng cấp; một hồ sơ cho mỗi danh tính/biến thể.
Giữ ID và tên Việt hiện có; xác minh danh tính trước ghép; giá trị SGSDeck có
nghĩa thắng theo trường, thiếu/placeholder dùng dữ liệu cũ, thiếu cả hai hiện
“Đang cập nhật”. Việt hóa nội dung có được; nguồn và chứng cứ chỉ giữ nội bộ.

Authority: [brainstorm đã chốt](../reports/brainstorm-260912-1203-unified-lookup.md).
[Đối chiếu](../reports/analysis-260912-1142-unified-lookup.md) và
[JSON](../reports/analysis-260912-1142-unified-lookup.json) chỉ là evidence;
`unreviewed-preserve-local` đã bị quyết định SGSDeck-priority thay thế.
Không hỏi lại nguồn ưu tiên hoặc yêu cầu người dùng tự review tiếng Trung.

## Kiến trúc chọn để thực hiện

`baseline bất biến + snapshot SGSDeck bất biến + review mới + bản dịch`
→ một mô hình hợp nhất → hai dictionary dạng mảng tương thích + một catalog
bổ sung + manifest hash công khai; ledger/review nằm trong `pipeline/`.
Builder offline, không đọc output của chính nó làm input, không recrawl.
Nguồn SGSDeck cũ validate bằng baseline qua tham số hiện có; registry mới
không viết ngược mapping/snapshot nguồn. Schema chi tiết ở Phase 1–2.

Phase 2 chỉ tạo candidate riêng. Phase 3 bắt đầu từ baseline đã tích hợp
`feat/season-team-lookup` release-gated (commit `623aa053d7a045ea8ea45389c19bcc508ce8aca5`
hoặc descendant đã xác minh), cập nhật loader/allowlist trên đúng router/publication
đó, kiểm canary, rồi promote bốn file bằng shared writer lock/journal/backup.
Browser, Astro, Worker và MCP CLI/stdio dùng đúng verified bytes; Astro build pin
một publication snapshot xuyên HTML + routes + dist verifier. Đây là promotion
có phục hồi, không phải atomic nhiều file. Phase 4 chứng nhận consumer/build;
rollback kiểm WIP, Recommended bridge và dependent season refs trước, khôi phục
cả activation code checkpoint.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Danh tính và baseline](./phase-01-start.md) | Completed |
| 2 | [Hợp nhất và Việt hóa](./phase-02-merge-and-vietnamese-content.md) | Completed |
| 3 | [Giao diện và tích hợp generation](./phase-03-unified-lookup-interface.md) | Completed |
| 4 | [Tương thích và bàn giao](./phase-04-compatibility-and-handoff.md) | Completed |

Thứ tự: **1 → 2 → 3 → 4**. TDD trong từng phase: ghi assertion Red đúng
nguyên nhân trước implementation, rồi Green và kiểm lại sau Refactor.

## Dependency và giới hạn sở hữu

- [SGSDeck catalog](../260907-0228-sgsdeck-catalog/plan.md) đã có prerequisite snapshot;
  không mở lại importer hoặc sửa acceptance lịch sử.
- [Plan mùa](../260907-0233-season-team-lookup/plan.md) đã hoàn thành phần cơ chế.
  [Team chuẩn / Team khác](../260912-0950-recommended-season-browser/plan.md) đã
  hoàn thành trên worktree/branch riêng và là baseline bắt buộc trước shared UI/
  publication edits. Corpus cũ chạy độc lập; cấu hình cần entity mới đợi mapping
  và generation đã chứng nhận tương ứng. Serialize dictionary, identity, `app.js`,
  public manifest, Recommended scoped publication và worker inventory với owner
  mùa trước mỗi edit/promotion; không triển khai trên main cũ rồi merge mù.
- Không thêm Recommended, đội/tier/điểm, bộ chọn mùa, bốn MCP kinds hoặc tools.
  Nhãn nguồn/điểm đội thuộc plan mùa; source-hidden chỉ áp dụng catalog.
- Không commit/deploy/crawl trong lượt lập plan. Bảo toàn dirty main và mọi WIP,
  đặc biệt `pipeline/build_season_data.py` và dữ liệu mùa đang thay đổi.

## Acceptance criteria

- [ ] Kiểm kê 100% baseline/source/children; mỗi record matched/new/unresolved có chứng cứ.
- [ ] Giữ 112 tên/ID tướng và 240 tên/ID chiến pháp cũ; base/SP/CO/40Y không nhập nhầm.
- [ ] Cả 11 khác biệt ra đúng trường/ID, kể cả Hạ Hầu Đôn Khiên S; 0/false hợp lệ còn nguyên.
- [ ] Nội dung có được ở sáu nhóm được Việt hóa/review; bản dịch stale chặn promotion.
- [ ] Đủ 90 đặc kỹ, 192 lựa chọn, 426 cấp theo snapshot; quan hệ thiếu giữ null có trạng thái.
- [ ] Một search/nav/profile, `#heroes`/`#tactics` tương thích, mobile/keyboard hoạt động.
- [ ] Catalog không public provenance; browser/Astro/Worker/MCP từ chối bundle trộn; local readers từ chối giao dịch dở dang.
- [ ] Soi đội, kho, tracker, đội cũ, MCP và build/check đạt; không suy availability/tier từ catalog.
- [ ] Có Red → Green → Refactor thực chạy từng phase, rollback/rebuild tái lập được.
- [ ] Combined publication giữ nguyên Team chuẩn/Team khác selector, scoped bytes,
  source attribution và history/legacy aliases; lookup + season hashes cùng một
  build snapshot.

## Evidence và trạng thái kiểm chứng

[Controller scout](reports/controller-scout.md), [data research](reports/research-data.md),
[consumer research](reports/research-consumers.md), [compatibility validation](reports/compatibility-validation.md)
và [certified handoff](reports/lookup-handoff.md) giữ evidence.

Generation `lookup:de73c4ca235de9b4ba6dbc5679573a3bab623a93ea6b061f0d30ad5f12c101e8`
đã accepted local. Final gates: Python 283 passed/12 skipped; Node 261 passed;
Astro check/build/dist/verify/dev Green; E2E 102 passed; MCP 373 passed cùng
typecheck/build/control-plane; Worker suites 2 + 1 passed. Không deploy/release.

<!-- slug: unified-lookup -->

## Red Team Review — 2026-09-12

Ba reviewers: security, assumptions, failure modes. 14 observations được gộp
thành 11 findings (5 High, 6 Medium), nhận và sửa cả 11; không đảo quyết định
người dùng. Các reviewer đã đọc lại và xác nhận đóng ở mức plan contract.
[Adjudication và evidence](reports/plan-validation.md) ghi owners và test cases.

## Validation Log

Standard tier: 40/40 current-code claims verified, 10/phase. [Quyết định đã chốt](reports/decision-validation.md)
được kế thừa, không giả lập interview/approval mới. Đây là kiểm chứng plan,
không phải kết quả thực thi các test TDD tương lai. Tất cả phase vẫn pending.

### Whole-Plan Consistency Sweep — 2026-09-12

Đã đọc lại index và đủ bốn phase tại thời điểm đó; đồng bộ 11 review deltas,
paths, schema, workflow closure và dependency mùa. CLI format validation đạt;
40 Markdown links và command test targets đều có đích hiện có hoặc được khai báo
create. Kết luận này đã bị audit 2026-09-13 supersede sau khi Team chuẩn/Team khác
hoàn thành trên worktree riêng.

## Coordination with completed Team chuẩn / Team khác — 2026-09-13

[Team chuẩn / Team khác](../260912-0950-recommended-season-browser/plan.md) owns
source-season browsing, team-card/detail presentation, reviewed source/local
`pipeline/recommended-identity-map.json`, scoped publication and hero+tactic
duplicate checking. Unified lookup owns six catalogs and canonical reviewed entity
display/identity. Before Phase 3 touches shared paths, integrate/rebase onto the
completed release-gated branch and pin the reviewed commit; `serialize` alone is
not an integration baseline.

Preserve its `team-chuan` default, `team-pk`/`meta-cu` aliases, surface history,
source attribution, `recommended-publication` HTML pin, scoped routes and exact
dist inventory. Catalog promotion must classify the Recommended bridge impact:
retain immutable old evidence when identity/display/faction inputs are unchanged,
or have its owner re-review affected mappings and rebuild dedup/generation. The
team bridge may consume verified catalog mappings as evidence but must not mutate
canonical dictionaries or import unverified dirty-main code.

## Audit Review — 2026-09-13

<!-- Updated: Audit Session 2 - nine evidence-backed findings accepted -->

Disposition ban đầu: **revise before cook**. Ba hostile reviewers rechecked bốn
phases và current code plus completed Team browser worktree. Accepted:

- High: integrate the completed router/scoped-publication baseline explicitly.
- High: distinguish raw lookup roots from packaged MCP release roots.
- High: pin dictionary bytes across Astro HTML, routes and season validation.
- High: fence pre-guard legacy dictionary writers already running.
- High: protect private review files before Phase 1 materializes them.
- High: build Phase 2 output from one captured verified raw input set.
- Medium: close season-publisher versus lookup-rollback TOCTOU.
- Medium: create durable activation recovery state before shared code mutation.
- Medium: invalidate or historically bind the Recommended identity bridge.

Rejected: descriptor-relative mutation hardening against a hostile local actor;
cooperative ownership, no-follow checks and conflict-stop remain the supported
filesystem threat boundary. Phase files carry every accepted delta.

### Whole-Plan Consistency Sweep — 2026-09-13

- Files reread: `plan.md` và đủ bốn `phase-*.md`.
- Decision deltas checked: 9 accepted, 1 rejected.
- Reconciled stale references: old Team PK fallback, root-only publication,
  raw-only MCP ingress, per-read generation checks, late privacy gate, pathname
  reread, season rollback race, pre-journal activation and bridge evidence.
- Duplicate contracts reconciled: route aliases/history, catalog-only source hiding,
  Recommended source attribution/pin, season hash ingress and MCP inventories.
- Unresolved contradictions: **0**.
- `ak plan validate plans/260912-0607-unified-lookup --json`: valid, no errors.

Audit disposition after propagation: **proceed eligible**. Runtime feature tests,
translation review, candidate generation and promotion remain future execution
gates; structural validation is not implementation proof.
