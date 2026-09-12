---
title: "Bổ sung cơ sở dữ liệu từ SGSDeck"
description: "Nhập sáu danh mục, chuẩn hóa danh tính và nguồn dữ liệu."
status: completed
priority: P2
branch: main
tags: [database, feature]
blockedBy: []
blocks: []
created: 2026-09-07
---
# Bổ sung danh mục SGSDeck

## Chế độ triển khai: `--tdd`

Bắt buộc **Red → Green → Refactor** theo từng hành vi, không dồn test đến phase cuối. Viết và chạy test thất bại đúng nguyên nhân trước code; lỗi môi trường không tính là Red. Sau implementation, chạy lại test rồi refactor và kiểm regression. Ghi lệnh, lý do Red và kết quả Green/Refactor vào `reports/import-validation.md`. Dùng mẫu nguồn thật tối thiểu cho parser; không đưa dữ liệu kiểm thử vào catalog runtime. Phase khảo sát chỉ chuẩn bị acceptance cases. Giữ yêu cầu `--tdd` khi bàn giao.

Trạng thái 2026-09-12: hậu kiểm remediation hoàn tất và reviewer GO. Snapshot private giữ 805 parent + 708 child, dùng 114 upstream equipment ID và đã vượt toàn bộ gate.

## Outcome

Bổ sung dữ liệu cấu trúc thực từ sáu URL người dùng cung cấp vào cơ sở dữ liệu project, có thể tra cứu local, kèm provenance và liên kết chắc chắn với từ điển Việt hiện có.

Sáu URL và URL điều khoản được lưu tại [inventory nguồn phase 1](phase-01-import-and-validate.md#url-nguồn). Đây là entry points; phase 1 xác minh thêm tab/detail/pagination trước bulk ingestion.

## Constraints / non-goals

- Astro + JS runtime, Python stdlib pipeline, JSON canonical. Không đổi public runtime/MCP contracts hoặc dữ liệu Việt hiện có bằng thông số Đài Loan chưa kiểm chứng.
- Giữ bản Đài Loan trong data/sgsdeck/; không tự ánh xạ số mùa sang Việt Nam, không crawl tài khoản hay dữ liệu riêng.
- Chỉ lấy thuộc tính/dữ kiện trò chơi; mô tả biên tập dài và hướng dẫn trỏ về nguồn, không mirror toàn trang/code/ảnh.
- Không làm UI mới, deploy hoặc commit. Giữ WIP deployment và báo cáo trước.

## Phases

| Phase | Deliverable | Dependency |
|---|---|---|
| 1 | [Contract nguồn và inventory](phase-01-import-and-validate.md) — completed | Không |
| 2 | [Importer và sáu bộ dữ liệu](phase-02-source-import.md) — completed | 1 |
| 3 | [Mapping và query local](phase-03-canonical-links.md) — completed | 2 |
| 4 | [Kiểm thử và bàn giao](phase-04-validation-and-handoff.md) — completed | 3 |

## Quan hệ với plan theo mùa

[Plan mùa](../260907-0233-season-team-lookup/plan.md) sở hữu scenario/ruleset, cấu hình đội, đánh giá, UI và MCP. Plan này sở hữu catalog nguồn và mapping thực thể; sáu URL không cung cấp danh sách đội mẫu/tier.

Không có dependency chặn toàn bộ hai plan: review chung metadata ở phase 1, sau đó plan mùa có thể dùng đội hiện có. Chỉ bước công bố một cấu hình dùng thực thể mới từ SGSDeck cần mapping/kiểm chứng tương ứng ở phase 3. Không cần chờ nhập hết catalog mới xây UI. Metadata dùng chung có một nơi mô tả, xem phase 1.

Bổ sung 2026-09-07: Cùng Tồn Binh Diễn Xuân Thu từ Google Sheet do phase 2 plan mùa sở hữu, lưu source-owned reference trong content-links. Không cần mapping SGSDeck để hiển thị nguyên văn nguồn; chỉ promote config dùng thực thể mới cần mapping reviewed. Không thêm importer sheet vào catalog hoặc dependency chặn toàn plan.

Trình tự đề xuất: contract hai plan → catalog + mapping → cấu hình mùa và UI/MCP → kiểm thử tổng hợp. Mỗi phần rollback riêng.

## Acceptance

- Đủ sáu nhóm generals, tactics, equipment, advisors, troop-mods, buildings, không danh sách giả/placeholder.
- ID ổn định, không trùng; nguồn, khu vực, thời gian, field coverage và mùa nguồn khi có được lưu.
- Tướng có thông số chi tiết công khai; công trình có bảng cấp nếu nguồn cung cấp; quân sư/cải tạo có quan hệ dữ liệu.
- Khớp canonical chỉ bằng bằng chứng tên chắc chắn; giữ variant SP/CO/40Y và ambiguity, không fuzzy auto-merge. `canonicalRef` bắt buộc là null hoặc `{kind,id}` theo phase 1; ref non-null phải đúng loại, namespace và thực thể trong corpus hiện có, khớp helper identity của project. Chưa có đối ứng/owner giữ null.
- CLI tra cứu JSON bằng tên gốc hoặc tên Việt đã khớp; query/validate normalized catalog không cần raw cache. Tách fetch/update khỏi rebuild offline: thiếu/hỏng cache phải lỗi rõ, không gọi mạng và giữ snapshot cũ. Rebuild byte-identical với cùng cache/export, parser, mapping và canonical inputs.
- Test parser, tính toàn vẹn dữ liệu, query, provenance; check/build và contract runtime không regression.
- `data/sgsdeck/` được phân loại private trong source-tree validator; build chấp nhận catalog nhưng public routes, `PUBLIC_ARTIFACTS` và allowlist `dist` không đổi. Entry lạ và symlink không hợp lệ vẫn bị từ chối.

## Inspection evidence

Đã đọc README.md, docs/code-standards.md, docs/system-architecture.md, pipeline/build_dict.py, pipeline/hanviet.py, src/lib/public-artifact-manifest.mjs và tests-js/runtime-asset-contract.test.mjs. Hai từ điển hiện có là mảng; bốn nhóm mới chưa có canonical owner nên ref giữ null. Public routes dùng allowlist; `src/lib/root-static-artifacts.ts` chỉ phân loại optional real directory `data/sgsdeck/` là private và vẫn từ chối entry/symlink lạ. Snapshot đã nhập đủ generals 202, tactics 393, equipment 114, advisors 39, troop-mods 16 và buildings 41; children gồm 90 equipment specials, 192 troop options và 426 building levels.

Importer đã lấy 176 general detail. Canonical mapping dùng equality chữ Hán chính xác: 39/202 general và 40/393 tactic, tổng 79 ref; không fuzzy auto-merge. Equipment dùng 114 upstream ID; Flight deferred fields khôi phục `古錠刀` thành quality `橙`, slot `武器`. Equipment special nối được 57/90, 33 giữ unlinked.

Plan [data tướng + tier cũ](../260626-1600-cap-nhat-data-tuong-tier-ui/plan.md) vẫn ghi pending nhưng module UI/tier đã tồn tại. Không chạy lại plan cũ; kiểm từng phần overlap theo source trước implementation.

## Giới hạn bàn giao

Hoàn tất catalog + query không có nghĩa website/MCP đã có giao diện cho sáu nhóm. Các cấu hình theo mùa được publish qua plan liên kết. UI từ điển mới cho equipment/advisors/troop-mods/buildings không thuộc yêu cầu nhập database hiện tại.

## Giới hạn dữ liệu đã biết

Kế hoạch kế tiếp: [tra cứu thống nhất `--deep --tdd`](../260912-0607-unified-lookup/plan.md) dùng snapshot private đã hoàn tất làm đầu vào cho hợp nhất, Việt hóa và UI sáu nhóm. Quyết định mới ưu tiên giá trị SGSDeck có nội dung, fallback dữ liệu cũ khi thiếu, được ghi trong [brainstorm đã chốt](../reports/brainstorm-260912-1203-unified-lookup.md). Đây là phạm vi kế tiếp; không mở lại importer hoặc đổi trạng thái completed của plan này.

- 114 equipment ID đã chuyển từ fallback tên sang upstream ID; schema record giữ nguyên.
- 33/90 equipment special chưa có parent link chắc chắn; giữ unlinked.
- 79 canonical ref chỉ dùng exact Chinese equality. Các record còn lại giữ unmapped/null; mapping không xác nhận stats hoặc khả năng dùng tại Việt Nam.
- Catalog là private local data, không tự xuất bản UI/MCP, không tạo team/tier và không suy mùa Đài Loan thành mùa Việt Nam.

## Final evidence 2026-09-12

Snapshot validate; deterministic byte parity. Hậu kiểm remediation đạt focused 37/37, Python 126/126, Node 145/145, Astro check 0 diagnostics, build Green, dist 10/10 và verify 36 files/33 raw assets. Reviewer rerun GO, không còn blocker.

## Audit 2026-09-07

[Audit liên plan](../reports/audit-260907-0310-season-catalog-plans.md): 1 High và 4 Medium đã bổ sung cách xử lý cùng acceptance TDD trong plan mùa. Các quyết định người dùng được giữ nguyên; implementation vẫn pending.

## Audit 2026-09-08

- High: `src/lib/root-static-artifacts.ts` so toàn bộ entries trong `data/` với public manifest; thêm `sgsdeck/` làm `staticPathsFor("data")` lỗi. Smoke trên thư mục tạm đã xác nhận baseline pass, thêm private subtree bị `Public artifact source set mismatch for data`. Phase 2 bổ sung owner validator/contract tests và TDD private boundary; phase 4 nghiệm thu build/nonpublication, không mở rộng public manifest.
- Low: bổ sung sáu URL nguồn và URL điều khoản vào phase 1; đã kiểm endpoint/title tương ứng ngày 2026-09-08, chưa kiểm lại toàn bộ coverage hoặc cấp quyền bulk.
- Tại thời điểm audit 2026-09-08, hai finding mới chỉ có cách xử lý trong kế hoạch. Implementation ngày 2026-09-12 đã sửa private boundary và có test Green; bulk catalog vẫn chưa được phép tạo.

## Audit 2026-09-12 — bổ sung đã chốt

[Báo cáo audit](../reports/audit-260912-0124-sgsdeck-catalog.md): người dùng yêu cầu bổ sung cả hai finding Medium vào plan.

- Phase 1/3 chốt canonicalRef, namespace/owner và membership đúng variant, kèm Red cases và parity với helper identity hiện có.
- Phase 2 phân biệt fetch/update và rebuild offline, thêm Red cases thiếu/hỏng cache không gọi mạng hoặc thay snapshot; phase 4 nghiệm thu query/validate không raw cache và parity theo cùng bộ input.
- Giữ scope sáu nhóm, `--tdd` và private/public boundary. Dòng này ghi quyết định audit trước implementation; trạng thái hiện tại được đồng bộ ở đầu plan và trong báo cáo validation.

### Whole-Plan Consistency Sweep

- Đã đọc lại index và cả bốn phase; kiểm hai delta canonicalRef và chế độ offline xuyên requirements, Red cases, steps, acceptance và rollback.
- Dạng ref khớp contract plan mùa; kind hero/tactic chỉ giới hạn mapping của sáu nhóm catalog, không đổi loại entity của plan mùa/MCP. Query/validate không raw cache vẫn dùng dictionaries canonical đã có để kiểm ref.
- Không còn mâu thuẫn trong hai delta; relative links hợp lệ, `ak plan validate` trả valid. Đây là kết luận của lượt audit kế hoạch; behavioral evidence mới nằm tại `reports/import-validation.md`.
- Final sync 2026-09-12 đã đối chiếu index, cả bốn phase, inventory, validation report, manifest, mapping và docs owner. 37/37 checkbox có bằng chứng; 4/4 phase hoàn tất. Các hạn chế source được giữ rõ và không bị biến thành dữ liệu suy đoán.
