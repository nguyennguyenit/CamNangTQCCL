# Debate: chuyển rule skill sang dataset + hai tool MCP

Ngày chạy: 2026-09-29 · Run `mcp-skill-redesign-1` / decision `rules-dataset` · 3 vòng.
Agent: `debate1` (proponent, role `@DEBATE1`) và `debate2` (skeptic, role `@DEBATE2`). Advisory; không sửa plan.

**Status: COMPLETE.** D1 gửi 3 tin tới D2; D2 gửi 4 tin tới D1 (1 coordination, r1, r2, ACK đóng). Hai bản Exchange record khớp; không cần sửa peer id.

## Câu hỏi

Có nên chuyển rule nghiệp vụ của các skill `tqccl-*` từ Markdown sang dataset canonical `agent-knowledge/`, phục vụ qua `tqccl_get_playbook` + `tqccl_search_rules` (tool surface lên 14) như plan đề xuất?

| Phương án | Nội dung |
|---|---|
| A (plan) | Dataset canonical + hai tool MCP; SKILL.md chỉ giữ entrypoint/routing |
| B | Giữ rule trong SKILL.md + `references/`, không thêm tool |
| C | Dataset canonical, adapter sinh file reference cho skill, không thêm tool |
| Giữ nguyên | Chỉ làm bốn tool dữ liệu |

Ràng buộc user đã chốt, không tranh luận: giữ 8 tool cũ (`plan.md:12`), không đổi SDK/thuật toán/policy bằng chứng/hạn mức research (`plan.md:16`), chọn mùa trước (`plan.md:13`), không mở dữ liệu private (`plan.md:15`).

Ngoài phạm vi: bốn tool đọc dữ liệu, snapshot v3, season resolution, Dewee auth, learning loop/storage (Phase 3), community/blog.

## Verdict

Không có đồng thuận chọn A ngay.

| Bên | Credence cuối |
|---|---|
| D1 | 65% → 60% → 52% cho A đầy đủ trong Phase 2; ~70% cho "lõi chung A/C ngay, hai tool khi có trigger" |
| D2 | 85% cho "B là baseline hiện tại; C nếu cần rule identity/version; A chỉ xét lại khi có consumer remote" |

D1 rút hai claim: prototype bảo toàn policy; C không phát hiện được version skew (manifest compatibility đối chiếu `get_data_version` hiện có — `mcp-worker/src/research/research-contracts.ts:417-425` — làm được).

## Diễn biến

- **r1.** D1 mở với 5 luận điểm: consumer chỉ dùng tool contract, Markdown drift, required rules độc lập top-k, Phase 3 cần identity, tool read-only. D2 (75→85%) phản bác: C phân phối được bằng artifact generated; drift mới là wording; prototype hạ correction-history thành guidance; remote MCP tính vào ledger 5 call.
- **r2.** D1 (65→60%) xác minh ba claim của D2 đều đúng, rút claim bảo toàn policy, đề xuất acceptance migration; nêu lợi thế A là guidance rollback nguyên tử cùng Worker. D2 (85%): compat manifest phát hiện skew không cần tool; mechanic research không bắt version call nên A tốn thêm lượt.
- **r3.** D1 (60→52%) chấp nhận compat manifest, reframe "A bao hàm C", phân loại phần còn lại là value/priority, đóng debate. D2 ACK: B baseline, C nếu cần identity; CLI chưa triển khai nên "chi phí biên nhỏ" chưa chứng minh.

## Đã xác lập

- [OBSERVED] MCP hiện có đúng 8 tool — `mcp-worker/src/cli.ts:17-26`, `docs/mcp-research-server.md:7-14`.
- [OBSERVED] Prototype: 10/10 deterministic tests đạt; `--limit 1` vẫn trả 5 required rules cho coexist; query vô nghĩa `abstained=true`, 0 guidance.
- [OBSERVED] **Lỗi prototype:** bước bắt buộc "đọc correction history trước tổng hợp" (`.agents/skills/tqccl-research/SKILL.md:40-43`) bị xếp `kind=guidance` (`prototype/rules.json:221-237`). Smoke:
  `python3 plans/260927-1727-mcp-skill-redesign/prototype/search-rules.py 'tôi muốn biết cơ chế' --workflow research --limit 1`
  → required gồm claim-status, exact-sgsdeck-anchor, no-region-from-language, shared-research-budget, source-is-data; `guidance=[]`; `abstained=true`; không có `research-correction-history`.
- [OBSERVED] Remote MCP tính vào ledger 5 external call/topic của research; đọc local/CLI miễn phí; skill coexist không có budget — `design.md:169`, `tqccl-research/SKILL.md:66-83`.
- [OBSERVED] Worker version đóng gói code+data, promotion/rollback nguyên tử — `docs/mcp-research-server.md:139`.
- [OBSERVED] Chưa có consumer remote; GoClaw là "tương lai", tự sở hữu skill, không dùng path local — `docs/goclaw-mcp-skill-handoff.md:5-9`, `design.md:176`.
- [OBSERVED] CLI playbook/search-rules và TS core chưa triển khai — `skill-mcp-learning-design.md` §11.
- [OBSERVED] Markdown hiện có wording lệch giữa hai skill về ngôn ngữ/region và patch chống drift viết tay; `coexist SKILL.md:22-23` hardcode `/Users/plateau`. Hai bên coi đây là rủi ro wording, chưa chứng minh drift runtime.
- [DERIVED] A bao hàm C: plan §6 "Một nguồn canonical, build adapters cho host khi cần", nên bootstrap Markdown dưới A cũng phải generated.
- [DERIVED] Chi phí của A ở research remote-only: +0..+2 external call/topic (playbook +1 hoặc 0 nếu thay version call; search_rules +1 tùy chọn); dùng CLI local: 0.

## Còn tranh cãi

| Vấn đề | Loại | Cách giải |
|---|---|---|
| Có cần rule identity/version ngay Phase 2, hay B đủ | factual/scope | User xác nhận Phase 3 có trong horizon → cần dataset; hoãn vô thời hạn → B đủ |
| Guidance phải đi cùng Worker release (freshness, promote tới remote) | value | User quyết; consumer remote cụ thể mà artifact không đáp ứng freshness → nghiêng A |
| A có cải thiện kết quả task so với B/C trong ngân sách hiện hành | factual | Consumer traces cùng case/model/runtime: pure-source research, MCP research, outage, rollback, hết budget |
| Chi phí biên của hai tool trên nền C | factual | Làm TS core + CLI trước, đo diff cho MCP registration/inventory |
| +1..+2 call/topic có chấp nhận được với hạn 5 call | value | User quyết; hoặc routing: playbook ≤1 call/topic, search_rules tùy chọn, ưu tiên CLI local |
| C là lựa chọn khi cần dataset, hay nền bắt buộc ngay | definitional | D2 chỉ chấp nhận vế đầu; chưa có bằng chứng loại B |

## Rủi ro nếu chọn A (theo D2)

- Nghĩa vụ bị phân loại thành guidance có thể biến mất dù selector đúng — smoke trên là ví dụ.
- Budget/privacy/authority rời khỏi bootstrap có thể không có sẵn trước call đầu hoặc khi server không truy cập được.
- Guidance remote tiêu ledger, còn ít lượt đọc evidence hơn; chưa có trace chứng minh lợi ích bù chi phí.
- Rollback server không tự rollback routing/bootstrap phía consumer.
- [BELIEF] Ranker, schema, versioning, error và release inventory trước khi có nhu cầu consumer có thể tốn bảo trì hơn lợi ích.

## Khuyến nghị (D1; D2 đồng ý phần lõi)

1. **Phase 2 bước 0 — lõi chung A/C:** dataset `agent-knowledge/` + TS core + CLI + adapter sinh bootstrap/references cho skill. Nghiệm thu migration bắt buộc:
   - ledger ánh xạ mọi MUST/never/always trong SKILL.md + references sang `ruleId` + `kind`, có owner review;
   - test mọi rule `kind=invariant` luôn nằm trong required, độc lập query, kể cả khi abstain;
   - sửa `research-correction-history` thành invariant;
   - không bỏ Markdown trước khi ledger đầy đủ.
2. **Hai tool MCP** chỉ đăng ký khi user xác nhận một trong hai: Phase 3 promote nhắm host remote trong horizon, hoặc có consumer remote đầu tiên đã pin (GoClaw/Dewee). Nếu không, hoãn và ghi trigger vào plan.
3. Nếu vẫn chốt A đầy đủ ngay: chấp nhận với điều kiện (1), thêm routing trong research SKILL.md — playbook ≤1 call/topic (thay version call), search_rules tùy chọn, ưu tiên CLI local.

**Điều làm đảo khuyến nghị:** consumer remote cần freshness runtime → chọn A ngay; Phase 3 bị cắt → chọn B, bỏ dataset. D2 sẽ chuyển sang A nếu trace consumer cho thấy artifact versioned không đáp ứng freshness/distribution và A đáp ứng mà không regress policy, chất lượng evidence hay ngân sách.

## Giả định

- Phase 3 nằm trong horizon triển khai (medium).
- GoClaw/Dewee là consumer remote dự kiến duy nhất (medium).
- `plan.md:18` ("Rule lớn ở dataset") không phải quyết định user đã chốt nên được đem ra tranh luận (high).
- Consumer owner có thể đóng gói generated references nếu chọn C (medium).
- Brief không nêu yêu cầu freshness zero-lag (high).

## Giới hạn

Chỉ smoke prototype retrieval và đọc source/contract. Không chạy full suite, consumer A/B hay runtime MCP. Điểm "Đã xác lập" do hai agent kiểm trong run; orchestrator chỉ kiểm lại trạng thái trao đổi.

## Đính chính sau debate (2026-10-05)

**Giả định "chưa có consumer remote" sai.** User xác nhận Dewee đang chạy. Brief của orchestrator đã đặt Dewee auth ngoài phạm vi nên hai agent không đọc `dewee-access-design.md`, trong khi:

- `dewee-access-design.md:79`: ba skill nghiệp vụ là gói portable cho Dewee, không tham chiếu đường dẫn máy dev hay cần shell Python để tra rule; MCP thực thi search dataset phía server.
- `dewee-access-design.md:15`: tiến trình `dewee` nghe loopback port 18790. "Remote" ở đây nghĩa là host không đọc file repo, chỉ gọi MCP qua HTTP — không nhất thiết khác máy.

Theo chính điều kiện đảo của D1 và D2 ("có consumer remote cần guidance mà artifact không đáp ứng"), khuyến nghị chuyển sang **A**, giữ nguyên các điều kiện an toàn của bước 1:

1. Dataset + TS core + CLI; ledger MUST → `ruleId`/`kind` có owner review; test invariant luôn trong required; sửa `research-correction-history` thành invariant; không bỏ Markdown trước khi ledger đủ.
2. Đăng ký `tqccl_get_playbook` + `tqccl_search_rules` cho Dewee.
3. Routing giữ hạn mức research: playbook ≤1 call/topic (thay version call), search_rules chỉ khi cần guidance.

Đã xác nhận (user, 2026-10-06): Dewee đang gọi MCP TQCCL thật. Khuyến nghị A ở trên áp dụng ngay, không còn là điều kiện chờ.
