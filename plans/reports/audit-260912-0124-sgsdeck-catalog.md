---
type: audit
date: 2026-09-12
plan: ../260907-0228-sgsdeck-catalog/plan.md
status: completed
---

# Audit plan SGSDeck catalog

## Summary

Trạng thái sau yêu cầu bổ sung của người dùng: cả hai finding đã được đưa vào index và phase 1–4; xem mục “Áp dụng sau audit” bên dưới. Findings và kết quả audit ban đầu được giữ làm lịch sử, không còn là hai việc sửa plan đang mở.

Không có finding Critical/High mới. Giữ 2 finding Medium về độ cụ thể của contract/test; cần chốt trước phase 2–3, không chặn khảo sát phase 1. Đây là audit kế hoạch, chưa phải bằng chứng implementation đạt acceptance.

Đọc index, toàn bộ 4 phase, review cũ, contract plan mùa và code/test hiện tại. Ba reviewer độc lập kiểm security, failure modes và assumptions; controller đối chiếu và phân xử. Không sửa plan/code/data hoặc trạng thái phase. Chỉ tạo báo cáo này; giữ WIP có sẵn trên branch `main`.

## Findings

### Medium — Chốt kiểu canonicalRef và test tương thích liên plan

- Vị trí: `plans/260907-0228-sgsdeck-catalog/phase-01-import-and-validate.md:30`, `phase-03-canonical-links.md:27`.
- Catalog ghi `canonicalRef?`, trong khi `plans/260907-0233-season-team-lookup/phase-01-start.md:19` đã dùng `null|{kind,id}`. Phase 3 yêu cầu không tạo hệ identity thứ hai nhưng chưa nêu test bảo đảm mapping Python trả đúng ID do consumer hiện có dùng.
- Bằng chứng code: `mcp-worker/src/data/entity-identity.ts:15` sinh ID dictionary với namespace; `js/hero-identity.js:39` dựng canonical hero identity. Dictionary hiện có không cung cấp canonical owner cho cả sáu nhóm mới.
- Kịch bản lỗi: catalog dùng source ID hoặc display name làm `canonicalRef.id`, hoặc trả chuỗi thay object; query catalog vẫn chạy nhưng evidence của plan mùa không resolve được identity đúng. Sai namespace có thể qua test chỉ kiểm tên/variant.
- Đề nghị: phase 1 ghi rõ `canonicalRef:null|{kind,id}`, tập kind được hỗ trợ, owner namespace và quy tắc tồn tại trong canonical corpus. Nhóm chưa có canonical owner giữ null; không tự bổ sung loại entity vào public contracts. Phase 3 thêm Red cases cho shape sai, source ID giả canonical, namespace sai, ID không tồn tại và parity với identity helper hiện tại.
- Phân xử: Accept như điểm cần làm rõ. Không đồng ý coi là blocker của toàn plan: phase 1 đã giao việc thống nhất metadata và là nơi phù hợp để chốt contract.

### Medium — Thêm negative case cho rebuild offline khi thiếu cache

- Vị trí: `plans/260907-0228-sgsdeck-catalog/phase-02-source-import.md:37`, `:46`, `:49`; `phase-03-canonical-links.md:42`.
- Plan có same-cache byte parity và query no-network, nhưng chưa ghi test cho rebuild khi cache/export thiếu hoặc không đầy đủ. Request/resume và offline rebuild đang thuộc cùng importer workflow.
- Bằng chứng code: pattern sẵn có `pipeline/build_dict.py:95` đọc cache nếu có, nhưng `:101` tự crawl khi cache vắng. Đây là hành vi legacy thực; không phải khẳng định importer SGSDeck chưa tồn tại có lỗi này.
- Kịch bản lỗi: implementer làm theo pattern đó; rebuild chạy xanh khi cache đủ nhưng khi một phần cache mất sẽ gọi live source, trộn dữ liệu mới vào lần rebuild được hiểu là offline.
- Đề nghị: tách nghĩa chế độ fetch/update với offline rebuild; offline thiếu/corrupt cache phải lỗi rõ, không gọi network và không thay snapshot được chấp nhận. Thêm Red test cho missing/partial cache và chứng minh output cũ giữ nguyên.
- Phân xử: Accept phạm vi negative test/no-network. Reject phần mở rộng thành yêu cầu clean-clone rebuild toàn bộ nguồn: `phase-04-validation-and-handoff.md:37` chỉ hứa clone query offline; phase 2 nói rebuild **từ cache**, đồng thời chủ động ignore cache. Không yêu cầu commit raw source hoặc thay quyết định reuse để giải quyết finding.

## Concern không nâng thành finding bắt buộc

Reviewer security đề nghị giới hạn bytes response/decompression/field lengths. Nguồn là input bên ngoài; legacy `pipeline/crawl_tactics.py:59` dùng read toàn bộ response, nên cap bytes hợp lý khi triển khai fetcher. Tuy nhiên chưa có importer SGSDeck hoặc bằng chứng response quá lớn; local CLI không phải public service. Không coi đây là Medium blocker, không áp trần record cứng trái inventory thay đổi. Có thể chọn cap bytes sau khi phase 1 đo mẫu, kèm oversized-response test.

Tổng phân xử: 3 đề xuất reviewer → 2 Accept sau thu hẹp, 1 không nhận làm finding bắt buộc. Không đảo quyết định người dùng.

## Verified boundaries và TDD

| Hạng mục | Bằng chứng / kết luận |
|---|---|
| TDD | Index yêu cầu Red → Green → Refactor; phase 2/3 có lát cắt tests-first, phase 4 audit evidence. Phase 1 chỉ khảo sát, không tạo Red giả. |
| Source-tree guard | `src/lib/root-static-artifacts.ts:41` so exact entries; thêm `data/sgsdeck/` hiện chưa được hỗ trợ. Phase 2 đã giao sửa đúng owner và giữ public manifest. Không báo lại thành finding chưa xử lý. |
| Public consumers | `staticPathsFor` được gọi bởi 3 endpoint JS/CSS/data; `readPublicArtifact` chỉ đọc basename allowlisted. `scripts/verify-astro-dist.mjs:36` kiểm exact output inventory và byte parity. |
| Snapshot | Phase 2 đã yêu cầu staged validation, backup/rollback và loader từ chối snapshot không đủ/hash sai. Không áp thêm yêu cầu zero-downtime hoặc nhiều writer. |
| Canonical data | Plan cấm chạy `pipeline.build_json`/`build_dict.build()`; dữ liệu TW không ghi đè dictionary VN. |
| Scope | Sáu catalog không tự có Recommended/team/tier; phần đó do plan mùa sở hữu. Mapping thực thể mới chỉ là dependency cục bộ. |
| State | Cả 4 phase pending. Importer, identity/query modules, 4 test modules, `data/sgsdeck/` và `docs/sgsdeck-catalog.md` đều chưa tồn tại. |

## Validation thực chạy

Environment: macOS, Node `v24.20.0`, branch `main`, working tree có WIP trước audit.

```text
ak plan validate plans/260907-0228-sgsdeck-catalog --json
→ valid: true, errors: null

node --experimental-strip-types --test --test-name-pattern='manifest|artifact reader|artifact tree' tests-js/astro-dist-contract.test.mjs
→ 4 tests passed, 0 failed
```

Đã kiểm relative Markdown links trong 5 file plan: không có broken link. Đã đọc toàn plan để đối chiếu metadata, TDD, private boundary, snapshot và handoff; chưa áp dụng đề xuất nên chưa có consistency sweep sau sửa. Kiểu `canonicalRef` cần cụ thể hóa như finding trên.

`ak plan validate` chỉ kiểm cấu trúc. Bốn test là baseline hiện có, không phải Red/Green của SGSDeck. Không chạy full build/import/Python suite vì không triển khai code; không fetch bulk hoặc publish.

## Nguồn kiểm lại

Ngày audit kiểm được nội dung các trang [generals](https://sgsdeck.com/generals), [tactics](https://sgsdeck.com/tactics), [advisors](https://sgsdeck.com/advisors), [buildings](https://sgsdeck.com/buildings). Công cụ web báo Internal Error với [equipment](https://sgsdeck.com/equipment) và [troop-mods](https://sgsdeck.com/troop-mods); fallback GET trực tiếp trả HTTP 200 và title đúng cho cả hai. Đây chỉ là kiểm entrypoint, không xác nhận đủ tabs/details/pagination hoặc refresh count 805.

[Điều khoản nguồn](https://sgsdeck.com/terms) vẫn hiển thị cập nhật 2026-08-20, quy định về dữ liệu cấu trúc và cấm bulk/mirror phục vụ thương mại khi chưa được phép. Plan đã có bước xác định phương thức reuse; audit không bổ sung kết luận pháp lý hoặc coi truy cập công khai là quyền bulk. Coverage và phương thức reuse vẫn cần evidence ở phase 1.

## Recommendations

1. Cụ thể hóa canonicalRef và bổ sung negative offline-rebuild test vào phase 1–3; giữ nguyên scope sáu nhóm, TDD và public boundary.
2. Sau chỉnh sửa, đọc lại index và cả 4 phase, đối chiếu với plan mùa; kiểm cấu trúc lại.
3. Khi triển khai được yêu cầu, giữ phase 1 inventory/reuse trước bulk; thực hiện private-boundary Red/Green trước thêm catalog runtime.

## Áp dụng sau audit — 2026-09-12

Người dùng chốt “bổ sung đi” sau khuyến nghị. Đã sửa index và cả 4 phase của plan SGSDeck:

- Phase 1: canonicalRef bắt buộc null hoặc `{kind,id}`; generals→hero, tactics→tactic, ID từ record canonical Việt theo helper hiện có. Nhóm chưa có owner/variant chưa có đối ứng giữ null; quan hệ tới entity khác không thay danh tính record.
- Phase 3: Red cases sai shape/kind/namespace, source ID giả canonical, ID không tồn tại, nhầm variant và parity helper; loader kiểm ref và query/validate không cần raw cache.
- Phase 2: fetch/update riêng với rebuild offline; missing/partial/corrupt cache gây lỗi không mạng và giữ nguyên snapshot+manifest. Parity khóa cùng các input; không yêu cầu commit raw source.
- Phase 4/index: đồng bộ acceptance, hướng dẫn lệnh, clean-clone query/validate và nghiệm thu TDD của hai thay đổi.

Whole-plan sweep: đọc lại 5 file, đối chiếu ref với plan mùa và helper code, không còn mâu thuẫn trong hai delta. Đã phân biệt raw cache với dictionaries canonical được query/validate dùng để kiểm ref. Check relative links, trailing whitespace, optional-ref cũ và status của 5 file: 0 lỗi; `ak plan validate ... --json`: valid, errors null.

Không sửa code/data hoặc public contracts; không chạy lại 4 baseline tests vì chỉ đổi kế hoạch. Chưa có Red/Green mới và tất cả phase vẫn pending. Giữ nguyên nội dung audit cũ, scope sáu nhóm, private boundary và WIP ngoài plan.

## Unresolved Questions

Không có câu hỏi sản phẩm cần người dùng trả lời cho kết luận audit. Các điểm canonical kind/namespace, cache input và field coverage giải quyết được từ code/source trong phase 1. Quyền/export chỉ cần hỏi riêng nếu khảo sát thực tế cho thấy bắt buộc.
