---
phase: 2
title: "Gói skill research bốn file"
status: pending
priority: P2
effort: "4h"
dependencies: [1]
---

# Phase 2: Gói skill research bốn file

## Overview

Tạo skill project tự đủ hướng dẫn research ba nhánh theo thiết kế đã chốt. Sửa lỗi quan sát được ở baseline và giữ hành vi vốn đúng; không thêm logic runtime, script hoặc dịch vụ.

## Context

Đọc [brainstorm đầy đủ](../reports/brainstorm-260907-1714-project-research-skill.md), [source registry](../../docs/research-sources.md), [Phase 1](./phase-01-start.md) và [matrix](./reports/behavioral-case-matrix.md). Pattern metadata: [coexist openai.yaml](../../.agents/skills/tqccl-coexist-team-builder/agents/openai.yaml). Checklist dùng chung chỉ là [Logic Sanity Checklist](../../.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md#logic-sanity-checklist), không kế thừa Evidence Grading cũ.

## Requirements

- [ ] Trigger rõ ba nhánh: build team, chiến pháp/cơ chế, xác minh nguồn; research công nghệ/sản phẩm nằm ngoài intent.
- [ ] Mùa/server: chỉ định hiện tại → hội thoại đã chốt → chưa xác định; không hardcode Binh Diễn Xuân Thu, không suy server từ ngôn ngữ/mùa website. Chỉ hỏi khi thiếu thông tin làm đổi kết luận; tiếp tục việc độc lập.
- [ ] SGSDeck giữ chuẩn đối chiếu project, 233乐园 giữ vai trò nguồn build đã chọn. Thiếu mốc ghi “chưa có mốc SGSDeck đã xác minh”; không ép đội khác thành biến thể.
- [ ] Dùng đúng Đã đối chiếu / Phương án từ nguồn / Chưa xác minh theo từng nhận định; tách khỏi tier, score, Sách Giáo Khoa và tính phù hợp Global.
- [ ] Đọc dossier và đính chính trước, đối chiếu runtime hiện tại; runtime không là bằng chứng độc lập về cơ chế game.
- [ ] Research loop ghi báo cáo Markdown thật trong `plans/reports/` theo naming phiên, lưu ngày, claim cũ, evidence mới, phạm vi, kết luận thay và link; lượt tiếp theo tìm/đọc lại đính chính trước tổng hợp; không tự sửa skill/global memory. Engineer loop chỉ nhận thiếu quy tắc đã tái hiện và có quyền sửa.
- [ ] Tối đa 5 external calls/chủ đề đã chốt, kể cả calls con/raw calls trong orchestrator, search, mở trang, ảnh/video/browser. Local miễn ngân sách; loop không reset, không chia topic giả. Giới hạn thấp hơn của user thắng; tăng chỉ khi user chỉ định rõ.
- [ ] Media chỉ được gọi đã đọc khi thực sự đọc; hết budget dừng external research, báo thiếu, không tuyên bố đã kiểm tra toàn bộ.

## Architecture

SKILL điều phối phạm vi → dossier/current data → SGSDeck và nguồn phù hợp → đối chiếu → report → research loop. Hai reference tách quy tắc bằng chứng khỏi template. Registry sở hữu website/status; coexist sở hữu lựa chọn/khóa; checklist cơ chế được link theo đúng section. Không wrapper bắt buộc ak:research.

## Related Code Files và quy mô

| Thao tác | File | Quy mô mục tiêu | Test impact |
| --- | --- | --- | --- |
| Tạo | `.agents/skills/tqccl-research/SKILL.md` | 150–220 dòng | Discovery, nhánh, scope, loop, budget |
| Tạo | `.agents/skills/tqccl-research/agents/openai.yaml` | 5–10 dòng | YAML/interface/default prompt |
| Tạo | `.agents/skills/tqccl-research/references/evidence-and-region-rules.md` | 100–170 dòng | Provenance, media, variants, corrections |
| Tạo | `.agents/skills/tqccl-research/references/report-template.md` | 90–150 dòng | Output đủ evidence, bỏ mục không áp dụng |
| Ghi evidence | `reports/candidate-outputs.md`, `reports/candidate-results.md` | Theo output thật | So từng assertion với baseline |
| Sửa/xóa | Không ở phase này | 0 | Coexist handoff ở phase3 |

Đường reports tương đối thư mục plan. Số dòng là ước lượng dễ đọc, không tiêu chí cắt yêu cầu. Không thêm scripts, asset, manifest, validator hay file thứ năm trong package.

## Interface Checklist

- [ ] Frontmatter có `name: tqccl-research`, description đúng intent; openai.yaml có interface display_name, short_description, default_prompt gọi `$tqccl-research` theo pattern local.
- [ ] Từ SKILL tới registry: `../../../docs/research-sources.md`; tới checklist: `../tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md#logic-sanity-checklist`. Reference lùi thêm một cấp; resolve theo file chứa link.
- [ ] Không nhập Strong/Medium/Weak hoặc quy tắc hai ngôn ngữ là proven; đa ngôn ngữ khi hữu ích, vẫn cần độc lập và đúng phiên bản.
- [ ] Template có mục tiêu, phạm vi/cách xác định, kết luận trước, SGSDeck/missing baseline; cấu hình nguyên nguồn theo giai đoạn, chủ/phó, người mang, binh chủng, binh thư, điểm, tốc, mốc chuyển và điều kiện tài khoản.
- [ ] Bảng claim có status, URL, tác giả, ngày gốc/repost/access, khu vực/mùa/patch, thử nghiệm-live, AI/repost, vị trí bài/ảnh/frame/timestamp, phân biệt nguồn ngoài/user/agent inference.
- [ ] Có kết luận cũ còn hiệu lực/đã sửa/cần xác minh; lịch sử correction có ngày/link; budget dùng/tối đa; giới hạn và bước tiếp theo. Field nguồn không có để unknown.
- [ ] Nhánh xác minh nguồn được bỏ bảng build không áp dụng, vẫn giữ provenance/status/scope/access.
- [ ] Research chỉ answer/report; research và bổ sung bàn giao file dữ liệu/tests theo quyền đã cấp, không hỏi lại. Không chạy `python3 -m pipeline.build_json`, tự gán tier hoặc deploy.

## Dependency Map

Phase1 preflight đạt + baseline hợp lệ → package bốn file → controlled candidate outputs → Phase3 handoff/discovery. Registry/checklist/account notes là read-only dependencies; không lệ thuộc global skill hoặc plan runtime khác.

## Scenario Matrix

| Case | Assertion trên output |
| --- | --- |
| 01–08 | Không trộn build; missing baseline; CN không thành Global; đúng sau20; giữ tên gốc; media chưa đọc; repost không độc lập; AI không tự phủ định; lịch sử đúng vai trò |
| 10–17 | Đếm cả media/child; dừng budget; research-only không mutate; thứ tự mùa; tách research/engineer/bỏ sót/nguồn không đọc |
| 18 | Chu Thái đầu prompt không quyết định chủ; lý do default Kazten tách chuẩn SGSDeck chưa đối chiếu |
| 19 | Lục Tốn giữ cả build Kazten/Dengeki, chuyển người mang Tam Thế và cả bộ chiêu |
| 20 | Gia Cát Khác: đất5/chuẩn bị6/điện7 chuyển Trình Phổ; đọc runtime trước đề nghị thêm |
| 21 | SP Chu Tuấn: bảng00:10, sáu chiêu; chủ trước20 và cấp22 khác; video không theo tiến trình |
| 22 | Xuân Hoa–Lữ Bố: nguồn cấp32, pre20 do user; chưa biết chủ; không chuyển điểm8.0 |
| 23 | Ngụy Kỵ đọc correction/locks; không phục hồi Binh Vô/số liệu thiếu URL như claim đã chứng minh |
| 24 | Đối chiếu ID do-uy-ss18-0 hiện tại; không suy trước dấu `/` là main hoặc tier cũ là hiện tại |
| 25 | SP Mã Siêu: tên model là đầu mối nghi ngờ; roster không là full sáu chiêu |
| 26 | Binh Diễn Xuân Thu preview; liên chiến không là win rate; đúng patch/binh chủng/mẫu nếu biết |

Case09 cùng tồn giữ regression tại đây, integration đầy đủ ở phase3. Matrix giữ mọi assertion gốc.

## Tests Before — Red

- [ ] Xác nhận `reports/harness-preflight.md` đạt write enforcement/read isolation/trace và baseline đầy đủ; nếu chưa đạt thì dừng trước tạo bốn file, không tạo package “chưa kiểm chứng” để vượt thứ tự TDD.
- [ ] Đọc raw baseline Phase1, chọn từng failure thật làm mục tiêu sửa; giữ case pass làm controls.
- [ ] Kiểm tra inventory, YAML và links riêng; thiếu package không thay behavioral Red.
- [ ] Xác nhận harness khả dụng; fresh agent context none/phiên mới, tool access tương đương baseline và Green. Không đưa matrix/rubric/đáp án reviewer vào prompt test hoặc read/search visibility. Candidate không thấy outputs/results của baseline; CONTAMINATED phải chạy lại sau cách ly.

## Implementation — Green

- [ ] Viết SKILL theo flow, tải reference lúc cần, tự đủ phương pháp không đòi global skill.
- [ ] Viết metadata đúng pattern, prompt gọi đúng skill và suy scope từ yêu cầu/hội thoại.
- [ ] Viết evidence rules đủ chín dossier invariants; link registry và section checklist, không copy logic cùng tồn.
- [ ] Viết template chứa cấu hình, nhận định, đính chính và budget; mục tùy nhánh, unknown rõ.
- [ ] Chạy cùng26 input đã khóa trong phiên sạch với candidate skill, lưu outputs/traces và chấm cùng rubric. Input sai phải ghi lý do sửa, chạy lại cả baseline/candidate với input mới.

## Refactor

- [ ] Bỏ lặp giữa SKILL/reference nhưng giữ toàn exception và quyền đã chốt.
- [ ] Link checklist không kéo grading cũ hoặc gọi coexist workflow đệ quy.
- [ ] Sau refactor replay case chịu tác động và controls; output trước refactor không chứng minh candidate mới.

## Tests After

- [ ] Parse frontmatter/metadata bằng Node `yaml` hoặc `js-yaml` đã có; kiểm kiểu/key/name/default_prompt và review hợp đồng. Transitive dependency mất thì báo blocked hoặc chọn parser sẵn có, không thêm package.
- [ ] Traverse link tương đối, file và section anchor; package mới không hardcode đường người dùng.
- [ ] Case15 chạy hai lượt: agent lưu báo cáo thật qua capability chỉ cho ghi đúng report mới được cấp; phiên sạch sau tìm/đọc file đính chính (không cho đáp án trong prompt). Chấm tồn tại/nội dung file và trace dùng lại đúng nhánh; lượt2 chỉ thấy report lượt1 cùng nhánh, không được đọc report bên baseline/candidate còn lại. Controller chỉ chụp evidence, không tự viết thay rồi chấm pass. Nếu thiếu write allowlist hoặc persistence capability: gate này blocked.
- [ ] Chấm26 case với quote/tool event, không grep-only. Thiếu source/media đạt khi báo thiếu chính xác, không thành đã xác minh.
- [ ] Package đúng4 file; external calls có counter, report đủ unknown/limits.
- [ ] System quick_validate lỗi thiếu yaml vẫn là environment failure riêng; parser thay thế không nghĩa system validator đã pass.

## Success Criteria / Gates

- [ ] Đúng hợp đồng và structural checks; mọi Red mục tiêu Green bằng output thật, controls không regression.
- [ ] Baseline không có failure thì báo pass-through trung thực; không tạo Red/pass totals giả.
- [ ] Phase3 nhận candidate đã kiểm chứng; không dùng NOT_RUN/ENVIRONMENT_BLOCKED/CONTAMINATED để qua gate, chưa gọi implementation complete.

## Risks và rollback

Grading cũ lấn authority: output dùng Strong/Medium/Weak hoặc hai vùng là proven → giới hạn section, replay evidence cases. Instruction quá dài làm bỏ budget/correction → bỏ lặp, giữ invariants, replay. Rollback chỉ bốn file mới task sở hữu; giữ registry/runtime/global skill và WIP.


## Scope extension — 2026-09-08

User đã đồng ý bổ sung guard test cục bộ; xem [phạm vi và acceptance](./reports/local-guard-scope.md). Điều này chỉ thay lệnh cấm thêm runner đối với infrastructure test trong reports của plan; các gate enforcement/visibility/trace/baseline, gói skill bốn file và mọi giới hạn runtime/global/deploy giữ nguyên. Checkpoint ENVIRONMENT_BLOCKED trước đó là lịch sử; chỉ thay kết luận khi có evidence thực.
