---
title: "Deep/TDD plan review and decision validation"
date: 2026-09-12
status: complete
---

# Kiểm chứng plan Team chuẩn và Team khác

## Phạm vi

Lượt này chốt brainstorm và hoàn thiện plan hiện có, không thực hiện crawler hay UI. Code evidence đọc từ `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`; plan/reports ở repository chính. Bản [audit ban đầu](./audit-deep-tdd.md) là đánh giá trước khi sửa, không phải trạng thái của bản cuối.

## Quyết định kế thừa và delta

- Hai tab Team chuẩn/Team khác, lọc mùa, Tier, thẻ có chiến pháp và binh thư, chi tiết; giữ style/bộ lọc phù hợp, bỏ luật/điểm/sort UI.
- Initial Team khác lấy existing explicit nonduplicates, không cần chiến báo mới; source gap ghi thật. External additions về sau phải có research/battle-report attribution.
- Python HTTP là acquisition chính; browser verification/fallback. Probe S28 hai trang xác minh khả thi, không tuyên bố đã có toàn corpus.
- P1 owns source/local reviewed identity bridge; không chờ toàn unified lookup hoặc sửa canonical dictionaries của plan đó.
- Frozen complete inventory → deterministic generation → single current selection. P2 public selected-generation only; previous local generation để rollback/rebuild; stale HTML được báo reload, không trộn bytes.
- Original/gameplay details độc lập với admitted list; state ownership và legacy alias precedence được định nghĩa trong P2.
- Phase matrices ghi Tests Before, Refactor, Tests After và Regression Gate; baseline xanh không bị gắn nhãn Red mới.

Không có câu hỏi sản phẩm còn mở; quyết định mới nhất của người dùng là căn cứ, không giả lập interview hay xin lại quyền đã cấp. Các chi tiết kỹ thuật được chốt trong phạm vi hoàn thiện plan đã được yêu cầu.

## Nghiên cứu và kiểm chứng đã có

Hai lượt audit dữ liệu/UI và controller Phase 3 được dùng làm per-phase scout. Các phase đã thêm file inventories, actual test counts, interface/caller checklists, dependency maps và test matrices. Đếm header tests đã sửa từ 4 regex matches thành 3 actual tests (một match là RegExp.test).

14 source parser tests pass trong audit trước; probe Python GET hai trang HTTP 200 parse được 93 list rows và detail 3/6/9. Không có crawler mới, source-wide capture, Red mới, E2E feature hoặc release attestation trong lượt lập plan.

## Review phản biện

Ba lượt review hoàn thành: [data](./red-team-data.md), [UI/source integrity](./red-team-ui.md), [integration/recovery](./red-team-validation.md). Mỗi reviewer kiểm 10 claims bằng file/line evidence. Tổng 30 mục: 28 xác minh được phần current-code; một mục baseline pass không được reviewer chạy lại (14 tests đã pass trong audit trước); một mục là output tương lai, đúng trạng thái pending. Mục verifier vừa có phần current-root đã xác minh vừa có scoped routes chưa triển khai. Không đổi pending thành verified chỉ vì plan đã mô tả.

### Adjudication

| Finding | Quyết định và sửa trong plan |
|---|---|
| Data High: browser fallback thiếu owner nhập cache | Nhận. P1 crawler sở hữu `record_rendered_page` và `--import-rendered-page`, dùng chung kiểm URL/hash/scope/parity, có ca lỗi và runbook. |
| Data High: thiếu nguồn bằng chứng mapping | Nhận. P1 liệt kê bốn dictionary/alias inputs chỉ đọc, hash descriptor và review từng alias; ca 40Y/base, phồn/giản thể và Chinese unresolved. |
| Data Medium: đếm local rows/alternatives gây hiểu sai | Nhận. P1 báo riêng primary/explicit variant/duplicate/pending alternative/pending identity, số row và số configuration; không sinh tổ hợp. |
| UI High: liên kết nguồn thiếu kiểm authority | Nhận phần Recommended authority và URL an toàn, thêm owner/callers/C2/C4. Không nhận yêu cầu provider allowlist mới cho mọi Team khác: nguồn local hiện có và external attribution có thể ngoài SGSDeck; không có quyết định sản phẩm yêu cầu đăng ký provider. Credential-free HTTP(S), nhãn nguồn thật và host rõ ràng giải quyết đúng phạm vi. |
| UI Medium: legacy config trỏ server 4321 | Nhận. P2 sở hữu config cũ và chuyển thành re-export root config 4174; evidence ghi effective config/baseURL/owner. Không tạo runner thứ hai. |
| Validation Medium: repository gate thiếu port preflight | Nhận phương án procedural cụ thể. P3 kiểm listener/PID/cwd ngay trước direct E2E và trước `check:repository`; không khẳng định script đã có guard. |
| Validation Medium: CLI repository gate giấu lỗi trước child | Không mở rộng sửa MCP CLI trong plan browser. Reviewer chứng minh generic catch hiện có; lỗi vẫn fail closed, không cho false green. P3 yêu cầu giữ exit/output và ghi nguyên nhân chưa xác định khi thiếu bằng chứng. Không in environment values hoặc tự suy đoán lỗi. |

Tổng 7 findings: 3 High và 4 Medium, không Critical. Sáu vấn đề được xử lý bằng hợp đồng thực thi cụ thể (URL chỉ nhận phần phù hợp phạm vi); một cải thiện diagnostic ngoài phạm vi được ghi rõ, không coi là đã sửa code. Không đảo quyết định người dùng. Các báo cáo giữ nguyên kết luận tại thời điểm review; bảng này ghi cách xử lý sau review.

### Whole-plan consistency sweep

- P1 là owner acquisition/import → mapping/explicit variants → generation; P2 sở hữu publication routes/state/render/caller migration; P3 xác minh và docs. Không tạo plan mới hoặc đổi phase sang complete.
- `current.json`, generation ID, safe scope keys, manifest hashes, selected-generation-only public policy và stale-page unavailable thống nhất cả ba phase. Previous generation được giữ local cho rollback.
- Registry ghi `defaultSourceSeasonId` và quy tắc fallback có căn cứ; Team khác all/unknown/known giữ nguồn mùa rõ ràng, không tự gán VN sang TW.
- URL validation không thêm gate nguồn research mới cho existing-local. Original/config details vẫn độc lập với admitted list; sửa một assertion alias cũ để không đòi hiển thị duplicate trong Team khác.
- Root runner 4174, check trước build-dependent tests, test migration và broad release prerequisites thống nhất. MCP counts ghi direct `it` riêng với `it.each`, không xem số declaration là runtime cases.
- Brainstorm, plan index, ba phase và coordination note unified lookup cùng giữ Python primary/browser fallback và bounded identity ownership.

## Tooling và giới hạn

- Một số lệnh ghi Markdown bị hook hiểu nhầm các cụm có dấu slash như đường dẫn thư mục bị bỏ qua; ghi đúng file bằng patch đã thành công, không sửa `.ckignore` hay quyền truy cập.
- Runtime giới hạn số agent thread; dùng lại reviewer còn tồn tại cho lượt failure-mode thay vì tạo thêm. Không bỏ lượt review.
- Không có dedicated task-management surface phù hợp trong tool inventory; phase checklists và dependencies trong plan là trạng thái bền vững.
- Journal CLI project discovery đã lỗi ở lượt trước; cập nhật journal hiện có đúng repository bằng file edit. AgentWiki publish skipped.

## Kết quả cuối

Kiểm tra cuối ngày 2026-09-12: `ak plan validate <plan-path> --json` trả `valid: true`, exit 0; bảy tài liệu chính không có link tương đối hỏng hoặc trailing whitespace; `git diff --check` trên phạm vi tài liệu pass. Ba phase pending, plan trùng đã xóa vẫn không tồn tại. Worktree code vẫn chỉ có đúng bốn đường dẫn spike trước lượt này, không phát sinh thay đổi triển khai.

Brainstorm và deep/TDD execution plan đã chốt, sẵn sàng bắt đầu Phase 1. Không còn câu hỏi sản phẩm cần trả lời trước cook. Corpus/mapping counts, behavioral Reds, feature E2E và release packaging là bằng chứng phải thu khi triển khai; chưa được tuyên bố hoàn thành trong lượt này. Các phase vẫn pending. Structural validation chỉ kiểm định dạng; kết luận readiness dựa thêm trên review/adjudication và consistency sweep ở trên.
