---
title: "Audit kế hoạch hướng dẫn team khai hoang"
date: 2026-09-09
scope: plan-audit
status: plan-corrections-applied
---

# Audit kế hoạch hướng dẫn team khai hoang

## Kết luận

Ba finding của audit (2 Medium, 1 Low) đã được sửa trong plan theo yêu cầu người dùng ngày 2026-09-09. Người dùng sau đó chốt guide/điểm theo bộ ba tướng; quyết định sở hữu không còn pending. Bản chép đầy đủ, bằng chứng cấu hình còn thiếu và kiểm chứng triển khai vẫn chưa hoàn tất. Không phát hiện lỗi thiết kế Critical/High mới sau đối chiếu.

Các finding và số dòng dưới đây ghi nhận trạng thái tại thời điểm audit, trước khi sửa plan. Lượt audit không sửa plan thực thi, runtime, test hay dữ liệu; lượt tiếp theo chỉ áp dụng sửa tài liệu kế hoạch. Không chạy build/test, không khởi động server, không commit/deploy.

Ba reviewer độc lập về dữ liệu/giả định, UI/an toàn và integration/failure modes. Sau gộp trùng: 7 đề nghị từ reviewer, nhận 3 (2 Medium, 1 Low), không nhận 4. Hai Medium được cả lượt review dữ liệu và integration phát hiện; controller kiểm tra lại với source và JSON.

## Bằng chứng hiện tại

- Branch `main`, HEAD `0a5780155d7aa3fcb1869b4f5bb11912ead3db2f`; có WIP từ trước, bao gồm cả thư mục plan chưa track.
- Đọc index, đủ ba phase, intake, validation log, brainstorm, research chiến pháp 7/9 và reconciliation với plan mùa.
- JSON hiện có 15 đội chính, 12 variants, 5 nhóm mỏ, 8 nhóm Chạm Sứ; chưa có `guide`.
- `image-transcription-ledger.md` và `tests-js/fixtures/khaihoang-guide-expectations.json` chưa tồn tại. Đây là deliverable Phase 1 đang pending, không phải lỗi triển khai.
- Shell hiện tại là Node `v24.14.0`; `package.json:6` yêu cầu `>=22.12.0 <23`. Chưa xác nhận runtime Node 22 phù hợp; không coi lệnh chạy trên Node 24 là delivery gate.
- 30/30 kiểm tra tĩnh về owner/symbol/config khớp source; 12/12 liên kết file local từ index/phases tồn tại. Đây không phải kết quả behavioral test hay xác minh lại media gốc.

## Findings đề nghị sửa

### 1. Medium — RED chưa khóa chính xác cấu hình theo giai đoạn của đội mới

**Vị trí:** `phase-01-start.md:74`, `:80-81`, `:95-100`; Phase 2/3 cần tiêu thụ kỳ vọng tương ứng.

**Bằng chứng:** `tests-js/khaihoang-data.test.mjs:19-22` chỉ đi vào vòng kiểm tra cấu hình qua `team.variants`. Các kiểm tra số ô chiến pháp, binh chủng và chủ tướng nằm tại `:31-51`; chủ tướng hiện chỉ được kiểm tra nếu có, và chỉ cần thuộc roster. Test mặc định tại `:8-15` chỉ khóa binh chủng của Khác–Bình–Tiến.

Research `plans/reports/research-260907-1421-khai-hoang-missing-tactics.md:36-54` ghi ảnh 9 có SP Chu Tuấn làm chủ trước cấp 20, Gia Cát Khác làm chủ tại cấp 22. Renderer đã hỗ trợ cả hai trường tại `js/render.js:243-244`; không cần phát minh API mới.

**Kịch bản lỗi:** thêm hai đội mới với đúng roster và guide, nhưng thiếu hoặc gắn cùng chủ tướng cho cả hai giai đoạn. Kiểm tra roster, guide, tên chiến pháp hợp lệ và các variant cũ vẫn có thể pass. Ngay cả kiểm tra “chủ tướng thuộc roster” cũng không bắt được việc chọn nhầm người trong ba tướng.

**Sửa nhỏ nhất:** thêm fixture độc lập và RED assertion cho `commanderBefore`, `commanderAfter`, binh chủng và từng ô chiến pháp trước/sau của các build mới hoặc được sửa, kể cả default. Khóa cụ thể ảnh 9: SP Chu Tuấn → Gia Cát Khác; ảnh 7: chủ tướng giai đoạn cấp 32 theo evidence, trường chưa xác minh phải vắng mặt. Thêm E2E real-route kiểm tra hai nhãn chủ tướng đúng người. Không biến đề xuất trước cấp 20 của người dùng thành dữ liệu thực chiến đã xác minh.

**Phân xử:** nhận ở mức Medium, giảm từ High do plan đã yêu cầu bảo toàn thay đổi chủ tướng; lỗ hổng nằm ở kỳ vọng kiểm thử chưa cụ thể, không phải thiếu hoàn toàn thiết kế.

### 2. Medium — Phạm vi kiểm tra tên canonical chưa tách khỏi dữ liệu legacy phải giữ nguyên

**Vị trí:** `phase-01-start.md:81-82`.

**Bằng chứng:** bước 4 yêu cầu validate canonical hero/tactic references; bước 5 đồng thời giữ nguyên main tactics và cấm quét sửa alias không liên quan. Baseline có `Tiềm Long Trận/Tam Thế Trận` tại `data/khaihoang.json:34`, `Giải Phiền Vệ/Thịnh Khí Linh Địch` tại `:1131`, cùng `Hoành Tào Thiên Quân` tại `:157-161`. Alias sửa tên nằm tại `pipeline/aliases.json:24`; tên canonical nằm tại `data/tactics.json:1007`.

Đối chiếu JSON trực tiếp cho thấy đúng ba chuỗi khác dictionary nói trên xuất hiện ở default builds, không có chuỗi ngoài dictionary trong variants. Kiểm tra hiện tại chỉ áp điều kiện lookup dictionary bên trong vòng variant (`tests-js/khaihoang-data.test.mjs:22-42`).

**Kịch bản lỗi:** mở validator thành “mọi tactic trong mọi đội phải bằng một entry dictionary” sẽ fail ngay trên baseline. Người thực hiện có thể sửa hàng loạt legacy chỉ để làm test xanh, trái ranh giới bảo toàn dữ liệu của plan.

**Sửa nhỏ nhất:** ghi rõ canonical validation áp dụng cho trường guide mới và trường chiến pháp mới/được sửa thuộc task. Với phần legacy giữ nguyên, so sánh snapshot hoặc ghi ngoại lệ có phạm vi cụ thể; không blanket-exempt dữ liệu mới và không tự chuẩn hóa toàn bộ default teams. Không cần thêm runtime validator hay rebuild pipeline.

**Phân xử:** nhận như điểm mơ hồ về phạm vi test; không khẳng định plan đã ra lệnh normalize toàn bộ.

### 3. Low — Câu hỏi còn mở của Phase 3 chưa phân biệt chiêu đã rõ với độ chắc của nguồn

**Vị trí:** `phase-03-integration-and-docs.md:113` còn ghi chung “Remaining 7/9 tactic evidence by stage”.

**Bằng chứng:** `phase-01-start.md:74` và research `plans/reports/research-260907-1421-khai-hoang-missing-tactics.md:44-56` đã ghi ảnh 9 đủ sáu chiêu tại cấp 22 cùng thay đổi chủ tướng. Research vẫn giữ giới hạn xác nhận độc lập/current tại `:60-74`.

**Kịch bản lỗi:** chỉ đọc phase tích hợp có thể hiểu ảnh 9 còn thiếu chiêu sau thức tỉnh, rồi research lại hoặc bỏ dữ liệu đã được ghi nhận. Đây là cách diễn đạt mơ hồ; Phase 3 có dẫn về Phase 1 nên không coi là mâu thuẫn kiến trúc nghiêm trọng.

**Sửa nhỏ nhất:** liệt kê đúng phần còn thiếu: ảnh 7 trước cấp 20 cần xác minh cơ chế/vị trí chủ tướng; applicability của guide/điểm; giới hạn nguồn độc lập/current; bản chép đủ overview/split/transitions. Ghi riêng chiêu và chủ tướng ảnh 9 đã được report xác nhận, chưa chứng minh điểm số hay tối ưu phổ quát.

## Các lo ngại không nhận thành lỗi mới

| Lo ngại | Phân xử và bằng chứng |
|---|---|
| Bắt buộc tách thêm `displayContext` vì có cả context/note | Không nhận: `phase-01-start.md:52` đã yêu cầu giữ useful tactical qualifications; một `displayNote` có thể giữ đủ hai ý. Không có yêu cầu giữ nguyên cấu trúc hai đoạn. |
| Plan quên dùng nhãn variant không có nguồn | Không nhận: owning contract `phase-01-start.md:52`, UI `phase-02-team-guide-ui.md:45-47` và sentinel test `:80` đã bao phủ. Code hiện vẫn dùng nhãn cũ là trạng thái trước triển khai. |
| Thiếu chính sách bỏ badge rỗng ở hàng tướng | Không nhận thành lỗi riêng: `phase-02-team-guide-ui.md:81` đã yêu cầu bỏ unknown fields. Khi viết fixture, nên có trường hợp biết chiêu nhưng chưa biết binh chủng; code hiện tạo badge tại `js/render.js:201-210`. |
| Phase 3 thiếu repository-wide gate nên không merge-ready | Không nhận trong phạm vi này: `phase-03-integration-and-docs.md:97` ghi rõ không commit/deploy, không có merge-ready claim. Chuẩn gate tại `docs/code-standards.md:89-109` vẫn áp dụng khi chuẩn bị merge; không cần biến audit feature thành công việc release. |
| Renderer chưa có chủ tướng theo giai đoạn | Không đúng: `js/render.js:243-244` đã có. Cần test dữ liệu đúng, không thêm module. |
| Buộc khôi phục source/mùa hoặc rebuild parser | Không đúng phạm vi: user đã chốt bỏ trình bày nguồn/mùa; source metadata giữ nội bộ. Plan cấm full rebuild và kiến trúc hiện tại cũng cảnh báo mất curated data tại `docs/system-architecture.md:71`. |

## Kiểm tra tĩnh và giới hạn

Mỗi phase có 10 claim được đối chiếu:

- Phase 1: `teams`, `variants`, `mines`, `chamSuTeams`, completeness test, no-transforms test, SP Chu Tuấn trong dictionary, Hoành Tảo trong tactics, builder owner, parser fixture 11 đội.
- Phase 2: card/hero/showBuild owners, `replaceChildren`, Chạm Sứ owner, safe text node helper, route fixture, transition-absence assertion cũ, CSS minmax có sẵn, hero note renderer.
- Phase 3: JSON load/mount trong `js/app.js:80-94`, artifact manifest, prerender endpoint, byte equality verifier, dist/runtime asset tests, engine range, preview reuse policy, kiến trúc Chạm Sứ.

Đã trace thêm consumer MCP: `mcp-worker/src/data/artifact-contracts.ts:4-11` không chứa Khai hoang; packaging chỉ đọc/ghi `ARTIFACT_NAMES` tại `mcp-worker/scripts/build-worker-assets.ts:221-252`. Không có bằng chứng buộc đổi MCP schema hoặc asset manifest cho feature này.

Tại thời điểm audit: đọc đủ bốn file thực thi và log cập nhật; chưa sửa phase. Điểm cần làm rõ khi đó nằm tại finding 3; alternative roster-level vẫn chỉ là đề xuất, chưa được chấp thuận. Không dùng kết quả audit này làm cook-ready hoặc bằng chứng RED/GREEN.

## Đề nghị tại thời điểm audit

1. Chốt quyền sở hữu guide/điểm theo roster hay exact build, rồi đồng bộ schema/UI/test ở cả ba phase.
2. Siết hai test contract trên và sửa ghi chú Phase 3.
3. Hoàn tất transcription ledger từ ảnh thực, xác nhận mapping và chuẩn bị Node 22 trước khi thực hiện RED/GREEN.

## Cập nhật áp dụng — 2026-09-09

Người dùng yêu cầu “Sửa plan đi”. Đã áp dụng cả ba finding vào index và ba phase: kỳ vọng chính xác cho cấu hình theo giai đoạn; phạm vi kiểm tra canonical và bảo toàn legacy; câu hỏi còn mở của Phase 3. [Validation log](plan-validation.md#audit-corrections--2026-09-09) ghi chi tiết và kết quả rà soát toàn plan.

Lượt sửa finding đã kiểm tra format CLI, đọc lại đủ index/phases và kiểm tra liên kết. Ba finding được xử lý ở mức tài liệu kế hoạch, chưa phải kiểm chứng triển khai; không đổi trạng thái hoàn thành của phase.

### Quyết định tiếp theo — 2026-09-09

Người dùng chốt “Theo bộ ba tướng”. Plan hiện lưu guide tại parent team, dùng chung giữa các cấu hình và giữ trạng thái mở/đóng khi đổi bộ chiêu; chiến pháp/chủ tướng vẫn theo cấu hình. [Cập nhật quyết định](plan-validation.md#roster-guide-decision--2026-09-09) thay thế trạng thái chờ chốt và giả định guide theo từng build trong các đoạn lịch sử ở trên. Không tự gắn điểm chung thành điểm đã kiểm chứng riêng cho từng bộ chiêu.

## Câu hỏi/đầu vào còn mở

- Chưa có bản chép đầy đủ 11 ảnh. Audit lần này đối chiếu báo cáo local, chưa đọc lại toàn bộ ảnh gốc hoặc xác minh lại nguồn web/video.
- Ảnh 7 trước cấp 20: vị trí chủ tướng/cơ chế của hai đề xuất cá nhân chưa được xác minh. Giới hạn nguồn độc lập/current cần được ghi rõ, không gọi bộ research là tối ưu hiện tại.
- Runtime Node 22 cho delivery chưa được xác nhận.
