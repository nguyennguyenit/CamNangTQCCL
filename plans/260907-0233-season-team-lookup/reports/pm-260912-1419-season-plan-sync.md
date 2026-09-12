# Season plan sync — 2026-09-12

## Summary

Full four-phase reconciliation; phases 1–3 complete, phase 4 implementation delivered with release gate open. Root remains in-progress, current phase 4. CLI status: **3/4 phases complete, 59/60 tasks checked, 98%**. Phase counts:13/13,15/15,16/16,15/16. The only pending phase checkbox is real release packaging/verification/repository closure.

`ak plan update CamNangTQCCL/260906-1933 --status in-progress --current-phase 4` exited0. Explicit phase paths were used for `ak plan check` on phases1–3; phase4 was reconciled individually. `ak plan validate` valid; direct local-link check covered78links without missing targets. These are structural checks, not behavioral Green.

Journal: [local chronological record](../../journals/2026-09-12-season-lookup-implementation-and-release-gate.md). `ak journal create` without project flag in explicit repository cwd exited0; CLI selected enclosing registry `plateau`. `--project CamNangTQCCL` was rejected (project not found). The same CLI-created file was relocated without overwrite into this repository's `plans/journals/`; no registry change or duplicate. AgentWiki publish skipped; no social/Git publication.

The user subsequently answered YES to the optional rights question, including Recommended on the website. Authorization is closed; exact config/context/selection proof still controls promotion. Controller records the authoritative update in execution-decisions.md.

Final structural check after relocation/authorization update: **86 local Markdown links valid**, zero missing; journal validate `ok:true`, plan validate `valid:true`; plan status unchanged59/60 and3/4. Parent journal path no longer exists. No test suites were rerun during documentation finalization.

## Authority and scope

Kongming final-advisory.md authorizes individual evidence-backed checkbox reconciliation where all-or-nothing CLI cannot represent the open release gate. Live CLI check toggles only checkboxes; phase update rejects status, so phase YAML and table use the authorized documentation exception. Explicit plan ID CamNangTQCCL/260906-1933 is used; no current-plan pointer changes.

TDD chronology remains qualified: 11 initial resolver cases and documented consumer/regression cases are not claimed as pre-code Red. Release review receives a narrow erratum correcting its false absent-plan claim. No new tests, implementation edits, Git actions or publishing.

## Prior index snapshot — historical, superseded

The exact pre-reconciliation index below preserves decisions and cross-plan links. Its pending/proposed/unimplemented claims are historical and superseded by the current plan and final-advisory.md.

```markdown
---
title: "Tra cứu đội hình theo mùa và kịch bản"
description: "Tra cứu đội theo kịch bản và phiên bản luật đã xác minh"
status: in-progress
priority: P1
effort: ""
tags: [frontend, database, api]
branch: main
blockedBy: []
blocks: []
created: 2026-09-07
---

# Tra cứu đội hình theo mùa và kịch bản

## Chế độ triển khai: `--deep --tdd`

Bắt buộc **Red → Green → Refactor** theo từng hành vi, không dồn test đến phase cuối. Viết và chạy test thất bại đúng nguyên nhân trước code; lỗi môi trường không tính là Red. Sau implementation, chạy lại test rồi refactor và kiểm regression. Ghi lệnh, lý do Red và kết quả Green/Refactor vào `reports/validation.md`. Không nới schema hoặc sửa expectation chỉ để xanh. Giữ yêu cầu `--tdd` khi bàn giao; tất cả phase vẫn pending.

## Overview

Người chơi chọn kịch bản tại Việt Nam, kể cả kịch bản cũ mở lại, rồi xem cấu hình và đánh giá đội đúng phiên bản luật. Mùa số của nguồn không tự trở thành mùa VN. Đây chỉ là kế hoạch: chưa sửa runtime, nhập dữ liệu hoặc deploy.

Phạm vi: Team PK, Meta phe cũ, Cùng Tồn, soi đội, gợi ý từ kho và Research MCP. Giữ ID đội, hash section và input no-context cũ; client kiểm schema output nghiêm ngặt cần refresh contract v2. Không thêm backend, không suy đoán tier/lịch phát hành.

Hiện `app.js` chia tab theo nguồn; `meta-cu.js` gọi mọi đội nguồn cũ là meta cũ. `render.js` và engine chọn tier tốt nhất giữa nguồn. Kế hoạch đề xuất thay chính sách **ở chế độ có kịch bản** bằng đánh giá mặc định đã review đúng cấu hình/ruleset, giữ đầy đủ phân rã nguồn. Việc hỏi kế hoạch chưa phải duyệt thực thi thay đổi policy; nhánh legacy không context giữ hành vi cũ và mang nghĩa tham khảo, không nhãn hiện hành.

## Cùng Tồn dùng chung bộ chọn

Người dùng xác nhận sheet `gid=190730430` thuộc **Binh Diễn Xuân Thu** và giữ bộ cũ chưa biết mùa. Giữ nguyên bytes `data/coexist.json`; payload nguồn mới nằm trong sidecar content-links đã dự kiến trong kế hoạch. Mặc định thiết kế **PROPOSED, chưa được người dùng xác nhận**: scenario-only cho xem tham khảo có nhãn chưa xác minh luật; chỉ pair reviewed tạo `seasonContext` cho engine. Không selector riêng hoặc fallback ngầm.

Chi tiết: [contract](reports/coexist-planning-contract.md), [nguồn/snapshot](reports/coexist-source-research.md), [integration/baseline](reports/coexist-integration-research.md), [40 owner paths](reports/coexist-owner-verification.md). Acceptance: 5 nhóm/25 đội/75 vị trí mới, raw options/điều kiện/cải tạo đầy đủ, bộ cũ tách unknown, URL/UI/MCP cùng scope/ID; không tự promote canonical/tier/điểm. Bốn phase có inventory, dependency, interface checklist và test matrix `--deep`.

## Goals

Hướng UX người dùng chọn ngày 2026-09-07: tham khảo [SGSDeck Recommended](https://sgsdeck.com/recommended). Luồng chính: chọn kịch bản/ruleset → lọc đội → danh sách nhóm theo tier → cấu hình chi tiết → đối chiếu kho hiện có. Phase 3 sở hữu chi tiết và acceptance TDD. Dùng dữ liệu/định danh Việt đã xác minh; dùng điểm số SGSDeck thay sao đánh giá đội theo quyết định người dùng; điểm có nguồn và đúng cấu hình/mùa, không tự suy tier Việt từ điểm.

| # | Goal | Priority |
|---|------|----------|
| 1 | Kịch bản độc lập phiên bản luật; chơi lại không bị coi là hết hiệu lực | P1 |
| 2 | Cấu hình/tier có bằng chứng đúng scope; unknown chỉ tham khảo | P1 |
| 3 | UI và MCP dùng chung ngữ cảnh, migration contract được ghi rõ | P1 |

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | [Registry và phiên bản luật](./phase-01-start.md) | Pending |
| 2 | [Cấu hình và đánh giá đội](./phase-02-season-team-configurations.md) | Pending |
| 3 | [Tra cứu trên giao diện](./phase-03-season-lookup-interface.md) | Pending |
| 4 | [MCP và kiểm chứng](./phase-04-mcp-and-release-validation.md) | Pending |

Thứ tự: 1 → 2 → 3 → 4. Phần contract MCP được review từ phase 1; publication chỉ sau khi UI/MCP kiểm chứng cùng dữ liệu. Bảng trên chuẩn hóa lại danh sách link do CLI scaffold chưa cập nhật đủ bốn dòng; không đánh dấu phase nào hoàn thành.

Checkpoint local: phase 1 tạo hai sidecar cùng entry manifest; phase 2 thêm ba sidecar/resolver cùng entry tương ứng; phase 3 nối UI và hash activation. Mỗi checkpoint tạo public source phải qua build/dist/regression, không đợi phase 3 mới sửa inventory. Đây là khai báo route local, không phải deployment.

## Success Criteria

- [ ] Chọn lại kịch bản cũ và ruleset được; không chọn mùa số lớn nhất mặc định.
- [ ] Cùng team ID có cấu hình/tier khác nhau mà không ghi đè bản cũ; xung đột tier chưa review không tự lấy tier tốt nhất lịch sử.
- [ ] Ba nhóm nội dung theo mùa (Team PK, Meta phe cũ, Cùng Tồn), match và recommend phản ánh cùng scope; đổi scope vô hiệu kết quả/xác nhận liên quan.
- [ ] Hash cũ, scan state cũ, ID cũ, MCP input no-context và parser fixture release v1 giữ hành vi cũ; output schema v2 có kiểm chứng migration client.
- [ ] Public manifest, snapshot/schema v2, workflow bindings và cursor đồng bộ; build/test local đạt, không deploy.
- [ ] Ambiguity config có choices bounded tới CLI/stdio/HTTP; UI/MCP cùng từ chối trên 500 config executable sau lọc scope, không silent slice.

## Phụ thuộc

[Catalog SGSDeck](../260907-0228-sgsdeck-catalog/plan.md) sở hữu nhập sáu nhóm nội dung và identity map nguồn; kế hoạch này sở hữu scenario registry/ruleset, cấu hình/đánh giá đội và UI/MCP. Phase 1 và phân loại đội hiện có ở phase 2 chạy độc lập. Sau khi catalog có record/identity reviewed, phase 2 bổ sung evidence; không đợi toàn bộ catalog, không tạo phụ thuộc vòng. Catalog không mặc nhiên cung cấp cấu hình đội theo mùa hoặc tier. Sheet reference do phase 2 plan này sở hữu và không chờ catalog; chỉ config dùng thực thể mới cần mapping reviewed tương ứng.

Metadata dùng chung: `provenance={provider,region,sourceUrl,fetchedAt,sourceUpdatedAt?}`, `sourceSeason={label?,number?,scenarioName?}|null`, `canonicalRef` nullable và chỉ có khi identity ổn định đã review. Nhãn upstream giữ nguyên; ánh xạ VN được kiểm chứng riêng.

Schema metadata nguồn hiện do `docs/sgsdeck-catalog.md` sở hữu. Catalog đã có private snapshot/helper trong workspace; helper sáu category không nhận Recommended. [Đối chiếu danh mục thống nhất](../reports/analysis-260912-1142-unified-lookup.md) ghi 112/112 tướng và 226/240 chiến pháp có cặp tên, nhưng chỉ 79 reviewed links; 259 ứng viên và 11 khác biệt chưa được promote. Phần hợp nhất sáu danh mục là scope riêng, không phải blocker toàn plan mùa; giữ owner dictionary/identity và tránh sửa song song cùng `app.js`, `render.js`, manifest.

[Tách Chạm Sứ](../260907-0236-cham-su-khai-hoang/plan.md) đã completed theo planning contract, cùng chạm dữ liệu/render Khai hoang: phase 2–3 phải đọc schema và diff mới trước triển khai, giữ `chamSuTeams` riêng và không khôi phục liên kết chuyển hình sai.

## Câu hỏi thực chứng còn mở

Liên kết triển khai 2026-09-12: [plan tra cứu thống nhất `--deep --tdd`](../260912-0607-unified-lookup/plan.md) sở hữu hợp nhất sáu danh mục, Việt hóa và UI danh mục. Không có blocker toàn plan giữa hai công việc; chỉ công bố cấu hình dùng thực thể mới cần identity đã review trong generation lookup đã chứng nhận. Lookup rollback phải kiểm refs mùa hiện tại trước khi bỏ ID; nếu orphan thì phối hợp owner rollback dependency hoặc fix forward, không tự revert season files. Serialize các chỉnh sửa chung ở `js/app.js`, identity helpers, public manifest và Worker packaging; đọc diff hiện hành trước khi sửa. Quyết định SGSDeck ưu tiên ở danh mục không thay policy mùa/tier/điểm của plan này.

Danh sách kịch bản VN/tên alias; ruleset đang áp khi mở lại; khác biệt cơ chế và tướng/chiến pháp theo vùng; đội/Cùng Tồn nào có bằng chứng phù hợp; nguồn đủ để review tier mặc định. Phase 1–2 lập inventory có dẫn chứng, giữ unknown thay vì tự điền. Người dùng đã xác nhận VN có thể chơi lại kịch bản cũ, không hỏi lại quyết định đó.

<!-- slug: season-team-lookup -->

## Quyết định hiển thị điểm — 2026-09-07

Bỏ badge và bộ lọc sao đánh giá đội; hiển thị “Điểm SGSDeck”. Giữ tier riêng. Không đổi sao/phẩm chất của tướng. Phase 2 bổ sung evidence điểm từ Recommended (ngoài sáu danh mục catalog); phase 3 thay UI và phase 4 đồng bộ contract MCP. Thiếu điểm phù hợp hiển thị “Chưa có điểm SGSDeck”, không quy đổi từ sao hoặc lấy điểm của biến thể khác.

## Audit 2026-09-07

[Audit liên plan](../reports/audit-260907-0310-season-catalog-plans.md): 1 High và 4 Medium đã bổ sung cách xử lý cùng acceptance TDD trong plan mùa. Các quyết định người dùng được giữ nguyên; implementation vẫn pending.

## Red Team Review — bổ sung Cùng Tồn 2026-09-07

Ba góc review: [security](reports/coexist-red-team-security.md), [assumptions](reports/coexist-red-team-assumptions.md), [failure modes](reports/coexist-red-team-failure.md). Hai finding có chứng cứ: 1 High về budget node của projection MCP, 1 Medium về điều kiện dùng đội. Đã bổ sung vào phase 2–4: projection v2 giữ schema khi truncate; điều kiện unknown không thành build-now. Không đảo quyết định người dùng; code chưa triển khai. Reviewer failure đã xác nhận High được xử lý ở mức kế hoạch.

## Validation Log — 2026-09-07

- 40 owner paths kiểm chứng hiện có, không thiếu; xem [verification](reports/coexist-owner-verification.md). CLI format validation đạt; không thay cho behavioral tests.
- Câu hỏi tùy chọn đã gửi: biết Binh Diễn Xuân Thu nhưng chưa rõ luật thì cho xem tham khảo hay chờ đủ luật? Chưa có trả lời. Dùng phương án đề xuất cho xem với nhãn rõ; không ghi thành user approval. Hai quyết định đã xác nhận trước đó (tên kịch bản, selector chung) không hỏi lại.
- URL scenario-only giữ nguyên khi restore; auto-select ruleset duy nhất chỉ khi chọn scenario mới trên UI. Scenario-only vô hiệu confirmation cũ, giữ kho, không gọi gameplay/MCP bằng legacy ngầm.
- Whole-plan consistency sweep: đọc lại index + cả 4 phase; đối chiếu union target, inventory 5/11/12, attribution/applicability/readiness, legacy parity, URL/binding và điểm SGSDeck. Kết quả ghi tại [handoff](reports/coexist-plan-validation.md); mọi phase còn pending/todo.

## Điều chỉnh Khai hoang — 2026-09-07

Người dùng chốt Khai hoang dùng hướng dẫn mới nhất, không chia mùa, không hiển thị nguồn. [Plan hướng dẫn Khai hoang](../260907-0353-khai-hoang-team-details/plan.md) sở hữu nội dung/card section này. Hai plan không chặn nhau; khi cùng sửa js/render.js phải đối chiếu diff và không sửa song song cùng file. Reports cũ là lịch sử, không mở lại phạm vi mùa cho Khai hoang. Test tích hợp: đổi scope không đổi danh sách/hướng dẫn Khai hoang.

## Red Team Review — sửa kế hoạch 2026-09-12

Người dùng yêu cầu “fix plan” sau [audit](reports/audit-260912-1144-season-team-lookup.md) và bổ sung session `01a093e5-69d8-7213-83bd-0f1f1ee79195`. Ba Medium được xử lý ở mức kế hoạch: error choices/limits xuyên serializers ở phase 4; shared cap 500 sau scope/eligibility ở phase 2–4; manifest đi cùng file public ngay phase 1–2. Mỗi sửa đổi có owner, Red cases, legacy parity và checkpoint validation. Code/tests tính năng chưa triển khai; không đánh dấu phase hoàn thành.

Người dùng xác nhận lúc 12:47 ngày 2026-09-12: **giữ nhãn “Điểm SGSDeck” cho đội; chỉ ẩn nguồn ở danh mục thống nhất**. Giữ source controls/links của phần đội theo thiết kế hiện hành, giá trị điểm và provenance MCP. Danh mục thống nhất giữ nguồn nội bộ; [brainstorm đã chốt](../reports/brainstorm-260912-1203-unified-lookup.md) sở hữu policy hợp nhất danh mục. Câu hỏi phạm vi UI nguồn/điểm đã đóng; Khai hoang vẫn theo quyết định riêng không hiển thị nguồn.

### Whole-Plan Consistency Sweep

- Đọc lại `plan.md` và cả bốn `phase-*.md`; kiểm ba technical deltas cùng dependency catalog/tra cứu thống nhất.
- Đã đồng bộ owners, error payload/limits, Red cases, checkpoint build/manifest và rollback. Không còn mâu thuẫn kỹ thuật thuộc ba findings; phạm vi UI nguồn/điểm đã được người dùng chốt lúc 12:47 và đồng bộ với phase 3.
- `ak plan validate --json`: valid; link targets không thiếu. `ak plan status --json`: pending, 0/4 phase, 0/46 tasks. Đây là kiểm chứng kế hoạch, không phải kết quả season tests.
- 35 Node + 63 MCP tests đã pass ở lượt audit trước; lần sửa plan không chạy lại code tests hoặc đánh dấu Green. Không khởi chạy cook/deploy.

```
