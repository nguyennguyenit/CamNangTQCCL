# Cùng Tồn theo mùa — kiểm chứng và bàn giao kế hoạch

Ngày: 2026-09-07. Chế độ `--deep --tdd`. Đây là kiểm chứng kế hoạch; không có implementation mới.

## Kết quả

Mở rộng kế hoạch mùa hiện có, giữ 4 phase và các yêu cầu đã chốt về SGSDeck/engine/MCP. Hai researcher đã khảo sát source và integration; planner cập nhật index/phase 1–2, controller hoàn tất phase 3–4 và quan hệ catalog. Ba reviewer kiểm input/security, assumptions và failure modes.

| Finding | Evidence | Disposition | Phase |
|---|---|---|---|
| High: shared 180-node projection có thể tạo null phá nested schema trước trần bytes | research-handlers.ts:108–113,584–591; báo cáo failure | Accept; projector v2 theo schema, whole-record truncation; reviewer xác nhận | 4 |
| Medium: đủ hero/tactic nhưng chưa rõ mandatory advisor/S vẫn có thể build-now | team-recommend-engine.js:245–253,351–372; domain/contracts.ts:96–119 | Accept; unknown/unmet/unsupported conditions không executable, giữ reference/diagnostic | 2,3,4 |

Không có security finding đủ chứng cứ trong phần nhập source. Không mở rộng inventory khả năng người chơi hoặc scoring mới để xử lý Medium; giữ no-context parity. Không thay quyết định user nên xử lý như làm rõ invariant trong phạm vi kế hoạch đã yêu cầu.

## Validation interview

Câu hỏi tùy chọn: “Khi đã biết kịch bản Binh Diễn Xuân Thu nhưng chưa xác minh phiên bản luật, bạn muốn Cùng Tồn hiển thị thế nào?”

Options: “Cho xem theo kịch bản, ghi rõ chưa xác minh phiên bản luật (khuyến nghị)” hoặc “Chỉ hiển thị khi đã xác minh đủ phiên bản luật”. Chưa có câu trả lời tại thời điểm ghi. Đã chờ và thông báo tiếp tục bằng giả định thiết kế thứ nhất; không coi im lặng là phê duyệt. Tên kịch bản và chọn theo mùa dùng quyết định trực tiếp của user trong hội thoại, không hỏi lại. Không tạo thêm câu hỏi chỉ để đủ quota.

## Whole-plan consistency sweep

Đọc lại plan.md và tất cả phase-01 đến phase-04 sau sửa. Kiểm các deltas:

- New source payload chỉ trong source-owned-coexist union của content-links; legacy locator kiểm corpus cũ riêng; giữ 5 sidecar/11 MCP artifact/12 private files gồm manifest.
- Binh Diễn Xuân Thu được user xác nhận scenario; ruleset null không wildcard. Bộ cũ unknown, không overwrite.
- Một selection shared; scenario-only web-local; MCP vẫn exact-pair, không có input referenceScope mới hoặc bypass confirmation.
- URL scenario-only restore giữ nguyên; unique ruleset auto-select chỉ thao tác scenario mới trên UI. Chuyển scope invalidate confirmation/result, giữ inventory.
- Applicable không đồng nghĩa ready; unknown mandatory conditions không executable.
- Bounded v2 output không đi lại qua generic node clamp gây null; summary-only/omitted count/truncation có schema, legacy nguyên hành vi.
- Source points/tiers/candidateKey và các quyết định audit trước giữ nguyên.

Unresolved contradictions: 0 sau các làm rõ trên. Ruleset thực, scope bộ cũ và identity chưa match là khoảng trống dữ liệu đã có cách biểu đạt, không tự điền.

## Bằng chứng kiểm tra

- 40 existing owner paths có thật, 0 thiếu: coexist-owner-verification.md.
- Source snapshot SHA-256: 838c9b639d42aef67d270a8813edd13bf0b364efaa85ae80e1fa8efda9b829bb; 94 CSV records/10 cột/5 nhóm/25 đội/75 hero positions.
- Researcher chạy narrow legacy `python3 -m unittest tests.test_parse_secondary.TestCoexist -v`: 1 passed. Không có tests feature mới hoặc build mới trong phiên planning.
- CLI `ak plan validate` kiểm format; final link/snapshot/state checks được controller kiểm riêng. CLI không chứng minh acceptance runtime.
- Active plan đã pin bằng `ak plan use`. Hook script `.claude/scripts/set-active-plan.cjs` không tồn tại; không chạy/sửa script. Không có task-management surface phù hợp, dùng checklist plan.
- Một shell write bị hook đọc nhầm nội dung tài liệu thành đường dẫn bị ignore; chuyển sang apply_patch ghi đúng file plan, không sửa ignore config. Một patch chưa khớp anchor đã được đọc lại và áp lại; không bỏ qua lỗi.

CLI journal resolve nhầm project root về /Users/plateau; file vừa tạo đã chuyển ngay vào plans/journals của repo và đọc kiểm lại. Không sửa CLI/skill/config. Final checks: 0 link thiếu, snapshot hash khớp, CLI format valid, 4 phase/0 hoàn thành.

Plan 260907-0353-khai-hoang-team-details xuất hiện trong lúc làm nhưng index còn scaffold/TBD, chưa đủ bằng chứng để gán quan hệ chặn. Trước implementation phải scout lại plan đó và các shared render owners; không chỉnh scaffold do phiên khác đang sở hữu.

## Bàn giao

Khi user chọn triển khai: `/ak:cook /Users/plateau/Project/CamNangTQCCL/plans/260907-0233-season-team-lookup/plan.md --tdd`. Đây là toàn bộ plan mùa đã mở rộng, không một tác vụ chỉ thay JSON. Giữ WIP khác, đọc lại source/status trước sửa. Không commit/deploy trong quyền lập kế hoạch.

## Còn mở

Ruleset cụ thể, scope bộ cũ, canonical identity/coupled options và ownership một số effect chưa có evidence. Giữ nguyên văn để tra cứu; chỉ chặn promotion hoặc gameplay phụ thuộc dữ kiện đó. Lựa chọn UX scenario-only đang là giả định đề xuất, user có thể đổi trước implementation.
