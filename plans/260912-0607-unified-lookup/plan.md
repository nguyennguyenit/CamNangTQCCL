---
title: "Bộ tra cứu thống nhất"
description: "Tra cứu tiếng Việt thống nhất sáu nhóm; giữ ID cũ, ưu tiên SGSDeck, TDD trước tích hợp."
status: pending
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

Phase 2 chỉ tạo candidate riêng. Phase 3 cập nhật loader/allowlist, kiểm canary,
rồi promote bốn file bằng shared writer lock/journal/backup; browser, Astro,
Worker và MCP CLI/stdio dùng đúng verified bytes. Đây là promotion có phục hồi,
không phải atomic nhiều file. Phase 4 chứng nhận consumer/build; rollback kiểm
WIP và dependent season refs trước, khôi phục cả activation code checkpoint.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Danh tính và baseline](./phase-01-start.md) | Pending |
| 2 | [Hợp nhất và Việt hóa](./phase-02-merge-and-vietnamese-content.md) | Pending |
| 3 | [Giao diện và tích hợp generation](./phase-03-unified-lookup-interface.md) | Pending |
| 4 | [Tương thích và bàn giao](./phase-04-compatibility-and-handoff.md) | Pending |

Thứ tự: **1 → 2 → 3 → 4**. TDD trong từng phase: ghi assertion Red đúng
nguyên nhân trước implementation, rồi Green và kiểm lại sau Refactor.

## Dependency và giới hạn sở hữu

- [SGSDeck catalog](../260907-0228-sgsdeck-catalog/plan.md) đã có prerequisite snapshot;
  không mở lại importer hoặc sửa acceptance lịch sử.
- [Plan mùa](../260907-0233-season-team-lookup/plan.md) đã hoàn thành phần cơ chế.
  Không block toàn plan: corpus cũ chạy độc lập; cấu hình cần entity mới đợi
  mapping và generation đã chứng nhận tương ứng. Serialize dictionary, identity, `app.js`, public manifest,
  worker inventory với owner mùa trước mỗi edit/promotion; không sửa plan đó.
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
- [ ] Không public provenance; browser/Astro/Worker/MCP từ chối bundle trộn; local readers từ chối giao dịch dở dang.
- [ ] Soi đội, kho, tracker, đội cũ, MCP và build/check đạt; không suy availability/tier từ catalog.
- [ ] Có Red → Green → Refactor thực chạy từng phase, rollback/rebuild tái lập được.

## Evidence và trạng thái kiểm chứng

[Controller scout](reports/controller-scout.md), [data research](reports/research-data.md),
[consumer research](reports/research-consumers.md). Node hiện 24.20.0.
Baseline hiện có: 13 Python + 26 JS narrow tests pass; snapshot validate pass.
Đây không phải bằng chứng feature mới; test mới/translation/review/promotion
vẫn chưa chạy. Tất cả phase pending (`todo` là trạng thái stub CLI).

Câu hỏi sản phẩm còn mở: không. Dependency kỹ thuật có owner/gate trong phase;
không giả định clean release hoặc quyền deploy từ structural plan validation.

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

### Whole-Plan Consistency Sweep

Đã đọc lại index và đủ bốn phase; đồng bộ 11 review deltas, paths, schema,
workflow closure và dependency mùa. Không còn mâu thuẫn chưa xử lý. CLI format
validation đạt; 40 Markdown links và command test targets đều có đích hiện có
hoặc được khai báo create. Trạng thái: pending, 0/4 phase hoàn thành.

## Coordination with team browsing — 2026-09-12

[Team chuẩn / Team khác](../260912-0950-recommended-season-browser/plan.md) owns source-season browsing, team-card/detail presentation and hero+tactic duplicate checking. This lookup plan remains owner of six catalogs and reviewed entity display/identity. Neither blocks the entire other plan; shared app/navigation/render/publication edits must be serialized. Team display fallback or source identity is not a new canonical catalog mapping. Source-hidden catalog policy does not remove team source attribution requested by the user.

The team plan now owns a bounded reviewed `pipeline/recommended-identity-map.json` bridge for source/local comparison. It may consume verified catalog mappings as evidence but must not mutate this plan's dictionaries or import unverified dirty-main code. Python-first Recommended acquisition and its immutable browse generation are separate from this catalog's offline builder/promotion.
