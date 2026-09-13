---
phase: 1
title: "Baseline và hợp đồng tình huống"
status: pending
priority: P2
effort: "2h"
dependencies: []
---

# Phase 1: Baseline và hợp đồng tình huống

## Overview

Khóa phạm vi đã chốt thành 26 case có đầu vào, ngữ cảnh và tiêu chí chấm; thu output baseline thật trước khi thêm hướng dẫn. Phase này không tạo skill hay sửa behavior hiện có.

## Context

- [Brainstorm đầy đủ, gồm chín hồ sơ bổ sung](../reports/brainstorm-260907-1714-project-research-skill.md).
- [Nguồn canonical](../../docs/research-sources.md), [chuẩn project](../../docs/code-standards.md).
- [Coexist workflow](../../.agents/skills/tqccl-coexist-team-builder/SKILL.md), [checklist cơ chế](../../.agents/skills/tqccl-coexist-team-builder/references/multi-source-research-and-logic-checks.md#logic-sanity-checklist), [ghi chú tài khoản](../../.agents/skills/tqccl-coexist-team-builder/references/chat-context-team-notes.md).
- [Ma trận đầy đủ](./reports/behavioral-case-matrix.md), [cross-plan scan](./reports/cross-plan-scan.md).

## Requirements

- [x] Bao phủ 17 tình huống gốc và 9 dòng dossier bổ sung; mỗi assertion gắn đầu ra quan sát được và nguồn kiểm chứng.
- [x] Tách historical replay, hypothetical contract input được khai báo và live evidence; không tạo nguồn game giả, mock browser, synthetic chiến báo hay câu trả lời mẫu để tính pass.
- [x] Giữ nguyên prompt/ngữ cảnh/nguồn local đã capture khi so baseline và candidate; cung cấp rubric cho reviewer, không cung cấp đáp án/rubric cho agent được test.
- [x] Chụp trạng thái WIP và inventory trước test; đọc runtime hiện tại bằng parser khi case cần tồn tại ID/variant, không suy từ báo cáo cũ.
- [x] Không hỏi lại quyết định brainstorm, không cài dependency, không gọi paid API/fallback.

## Architecture

Input case + context có provenance → agent baseline trong phiên mới với skill hiện có → output nguyên văn + tool trace → reviewer so rubric → phân loại failed/passed/not-run/environment-blocked/contaminated. Sau phase 2 dùng cùng tập input để quan sát thay đổi. Các case vốn đúng là regression controls; không cố làm chúng thất bại.

Harness phải có capability read-only hoặc chặn side effect ở cấp công cụ trước khi dispatch; prompt “không sửa” và snapshot sau chạy không thay cho ranh giới này. Mặc định agent test chỉ đọc nguồn, trả answer hoặc proposed handoff; controller lưu outputs vào reports. Riêng case15 persistence dùng capability chỉ cho phép ghi đúng file báo cáo mới do test sở hữu trong `plans/reports/`, từ chối overwrite file có sẵn và mọi đường khác; controller không viết thay agent. Nếu không có write allowlist này thì case15 persistence blocked, không hạ thành chat-only pass. Ghi cả attempted write/delegation để chấm, không coi thao tác bị chặn là agent đã tuân thủ. Baseline/candidate dùng cùng ranh giới; nếu không quan sát được attempt mà ngăn được side effect thì case liên quan ENVIRONMENT_BLOCKED, không chạy trên WIP thật.

Baseline phải thực hiện yêu cầu research bằng năng lực hiện có, không chỉ gọi tên skill chưa tồn tại. Missing-file là kiểm tra inventory riêng, không chứng minh lỗi hành vi.

## Preflight bắt buộc trước baseline

- [x] Ghi `reports/harness-preflight.md`: tên capability và phiên bản, lệnh/config thực dùng (không secret), quyền shell/connector/delegation, cách giới hạn read/search/write, nơi capture attempted actions. Không suy quyền từ persona hoặc fresh context.
- [x] Kiểm tra enforcement bằng file probe vô hại do task sở hữu: đọc nguồn cho phép được; search/read artifact chấm điểm bị loại; write ngoài allowlist và overwrite report bị từ chối; tạo đúng report mới được; attempted action quan sát được. Không thử ghi lên runtime/WIP thật. Probe là kiểm tra quyền filesystem, không phải fake game source hay behavioral Red.
- [x] Chốt visibility manifest từng case trước baseline: các dossier/correction thật, registry, runtime snapshot và instruction nền cần thiết có đường dẫn/hash. Loại plan, matrix, rubric, reviewer notes, outputs/results và artifacts lượt khác khỏi mọi đường read/search; không đưa ancestor/global instructions chứa đáp án vào context.
- [x] Case15 dùng hai nhánh tách biệt. Lượt1 baseline và candidate cùng nguồn đầu vào; lượt2 mỗi bên chỉ thêm report do lượt1 cùng bên tạo. Mapping đường dẫn và quyền tương đương, hash/trace ghi rõ lineage; report baseline không xuất hiện khi candidate search. Dossier lịch sử thật vẫn là input hợp lệ, không loại chỉ vì có đính chính.
- [x] Kiểm tra toàn bộ tool surface: sandbox shell không mặc nhiên chặn connector hoặc subagent có quyền rộng hơn. Capability không chứng minh được write guard, visibility và trace thì ENVIRONMENT_BLOCKED; chỉ tiếp tục hoàn thiện input/report kế hoạch, không tạo package ở Phase2.

Evidence audit 2026-09-08: `collaboration.spawn_agent` hiện không có tham số giới hạn sandbox/read roots. `codex exec --help` có `--sandbox read-only|workspace-write`, `-C`, `--json`, `--ephemeral`; đây chỉ là ứng viên để khảo sát, không chứng minh single-file allowlist, read isolation hoặc chặn connector. Chưa có harness nào được xác minh đáp ứng toàn bộ gate. Không tự thêm runner, cài package hoặc sửa global config để lấp chỗ thiếu trong scope này.

## Related Code Files và quy mô

| Loại | File/phạm vi | Quy mô dự kiến | Test impact |
| --- | --- | --- | --- |
| Tạo/cập nhật report | `reports/behavioral-case-matrix.md` | 26 case gốc và subcases bắt buộc | Hợp đồng chấm output |
| Tạo evidence preflight | `reports/harness-preflight.md` và file probe vô hại dưới reports của task | Capability/config/trace và visibility manifest | Chặn baseline/Phase2 khi không đạt |
| Tạo bằng chứng thực thi | `reports/baseline-outputs.md`, `reports/baseline-results.md` | Theo output thật; tách file khi khó đọc | Baseline từng assertion và môi trường |
| Đọc | Chín nhóm dossier được link trong brainstorm | Đọc cả đính chính liên quan | Phân biệt lịch sử với hiện trạng |
| Đọc | `data/teams.json`, `data/team-tier.json`, `data/khaihoang.json` | Không sửa | ID/variant hiện tại chỉ là dữ liệu repo |
| Đọc | `package.json`, skill/ref hiện có | Không sửa | Chọn narrow checks, không full app suite |
| Tạo report persistence có guard | `plans/reports/research-{session}-research-loop-regression.md` (chọn tên mới không đụng file có sẵn) | Một report đúng naming phiên, được allowlist riêng | Case15 hai lượt, baseline/candidate mỗi bên dùng report riêng |
| Sửa/xóa runtime | Không | 0 | Không đổi contract ứng dụng |

Đường dẫn `reports/...` trong phase tương đối thư mục kế hoạch; riêng report persistence dùng `plans/reports/` từ repo root; artifact test không thuộc gói bốn file skill.

## Interface Checklist

- [x] Case có ID, prompt nguyên văn, ngữ cảnh mùa/server/tài khoản, input thật/giả định công khai, provenance, assertion và forbidden inference.
- [x] Capture có thời điểm, skill version hoặc diff/hash, model/harness nếu có, tool trace và ngân sách từng chủ đề.
- [x] Dossier có kết luận cũ, đính chính, snapshot runtime đọc hiện tại và giới hạn live.
- [x] Status từng assertion có evidence quote/location; thiếu quan sát là not-run hoặc blocked, không fail game knowledge tùy tiện.

## Dependency Map

Brainstorm + source registry + current local data → matrix → baseline artifact → Phase 2. Không có blocking dependency từ plan khác. Harness chưa đạt preflight chặn baseline và Phase2; vẫn được đọc nguồn/hoàn thiện plan. Không xem ENVIRONMENT_BLOCKED là đã hoàn tất baseline.

## Scenario Matrix

| Nhóm | Case | Baseline cần quan sát |
| --- | --- | --- |
| Chuẩn và nguồn | 01–08 | Hai build nguyên vẹn, thiếu mốc, Global/CN, sau 20, ánh xạ, media, independence, 233/lịch sử |
| Quyền và loop | 09–17 | Khóa cùng tồn, ngân sách, read-only, mùa, research/engineer/execution failure |
| Dossier thực | 18–26 | Chủ tướng, chuyển toàn build, runtime hiện tại, video, score, đính chính Ngụy Kỵ, ID rút, tên model, preview metrics |

Chi tiết prompt/assertion nằm trong matrix; không bỏ case vì baseline đã pass hoặc khó đọc media.

## Tests Before — Red

- [x] Chỉ chạy sau khi preflight đã đạt cả enforcement và visibility; khóa prompt, nguồn, rubric và manifest trước baseline.
- [x] Chạy 26 input bằng harness agent sẵn có hoặc phiên mới, cách ly ngữ cảnh từng case; dùng output thật và tool log. Test agent không nhận đáp án dự kiến.
- [x] Với dữ liệu historical replay, cho agent biết đang đọc hồ sơ lịch sử và chỉ dùng file thật; không viết fixture giả mạo là bài web.
- [x] Ghi mọi assertion fail có trích output/trace và lý do; chỉ gọi Red khi lỗi phản ánh hợp đồng cần sửa. Giữ assertions đã đạt làm control.
- [x] Nếu mọi case đều đạt baseline, ghi kết quả đó trung thực: nhu cầu còn lại là đóng gói, khám phá và handoff; không bịa một Red. Chứng minh lỗi package qua kiểm tra cấu trúc riêng.
- [x] `quick_validate.py` từng lỗi `ModuleNotFoundError: yaml` là environment failure, không là Red; không cài PyYAML, không sửa validator.

## Implementation — Green

- [x] Ghi quan sát baseline theo rubric đã khóa. Nếu phải sửa rubric/nguồn/counterexample, lưu phiên bản và lý do, chạy lại baseline cùng candidate bằng hợp đồng mới; không sửa oracle để biến fail thành pass.
- [x] Xác định assertions fail thuộc thiếu hướng dẫn, bỏ sót thực thi, nguồn không đọc được hay ngữ cảnh tài khoản; không quy mọi fail thành sửa skill.
- [x] Khóa tập input và ngữ cảnh trước Phase 2. Ghi rõ chỉ các instruction candidate thay đổi trong vòng so sánh.
- [x] Chọn ba smoke live đề xuất: build team, chiến pháp/cơ chế, xác minh nguồn; mỗi chủ đề tối đa 5 calls. Controller ghi lựa chọn live; default đề xuất có thể áp dụng khi optional preference không có phản hồi, không thêm approval gate.

## Refactor

- [x] Gộp rubric trùng nhưng giữ đủ 26 case và từng assertion; không gộp mất điều kiện/timestamp/variant.
- [x] Giữ lời giải/reviewer notes ngoài test input, dùng link đến dossier thay vì copy thành authority mới.

## Tests After

- [x] Traverse đủ 26 case và link dossier; mọi assertion có cách thu output, không có pass theo grep-only.
- [x] Rà cặp baseline/candidate setup: prompt, context, local inputs khớp; live network drift ghi riêng và không xem như controlled Red→Green.
- [x] Xác nhận artifact baseline chưa đưa game claim historical thành live và không có thay đổi ngoài report scope.

## Success Criteria / Gates

- [x] Matrix đủ 26, baseline đã quan sát hoặc từng gap được khai báo, không có false pass.
- [x] Chỉ đi tiếp Phase2 khi preflight đạt và baseline hợp lệ đủ case/subcase, không còn lượt ENVIRONMENT_BLOCKED/CONTAMINATED. Có FAIL hành vi thật là đầu vào TDD hợp lệ; thiếu trace hoặc đọc đáp án không phải Red.
- [x] Tất cả việc triển khai còn unchecked cho tới có bằng chứng; trạng thái phase qua CLI đúng contract đang cài.

## Risks và rollback

Rủi ro hồi ức cũ trái runtime: signal là ID/variant đã đổi → dùng parser hiện tại, ghi đính chính; không đổi game data. Rủi ro đọc đáp án: signal context/read/search trace chứa rubric, output khác lượt hoặc report case15 sai nhánh → CONTAMINATED, sửa visibility rồi chạy lại cặp baseline/candidate; fresh session đơn thuần không đủ. Rủi ro website thay đổi: giữ replay và live riêng. Rollback chỉ gỡ artifact mới do task tạo; không reset Git hoặc xóa WIP của người khác.


## Scope extension — 2026-09-08

User đã đồng ý bổ sung guard test cục bộ; xem [phạm vi và acceptance](./reports/local-guard-scope.md). Điều này chỉ thay lệnh cấm thêm runner đối với infrastructure test trong reports của plan; các gate enforcement/visibility/trace/baseline, gói skill bốn file và mọi giới hạn runtime/global/deploy giữ nguyên. Checkpoint ENVIRONMENT_BLOCKED trước đó là lịch sử; chỉ thay kết luận khi có evidence thực.
