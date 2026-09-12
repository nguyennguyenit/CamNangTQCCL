---
title: "Audit mức sẵn sàng deep và TDD"
date: 2026-09-12
status: needs-revision
---

# Audit plan theo ak-plan --deep --tdd

## Kết luận

**Chưa đủ để gọi là plan hoàn chỉnh theo `--deep --tdd`.** Hướng sản phẩm và tiêu chí phân nhóm đã chốt; plan có các tình huống Red/Green hữu ích. Tuy nhiên còn thiếu hợp đồng triển khai, kiểm kê consumer và cấu trúc kiểm thử bắt buộc của deep/TDD. `ak plan validate` hiện pass nhưng chỉ xác nhận cấu trúc Markdown.

Đây là audit mức sẵn sàng của bản hiện có, không phải tuyên bố đã hoàn thành toàn bộ workflow tạo plan deep, red-team ba reviewer hoặc chạy các test tính năng chưa viết. Không thay đổi quyết định sản phẩm và không triển khai code trong lượt audit.

## Phạm vi và bằng chứng

- Plan và brainstorm đọc từ `/Users/plateau/Project/CamNangTQCCL`.
- Code đối chiếu từ worktree triển khai `/Users/plateau/Project/worktrees/CamNangTQCCL-season-team-lookup`, không giả định dirty main giống worktree.
- Chuẩn đối chiếu: `/Users/plateau/.agents/skills/ak-plan/references/workflow-modes.md:57-102` và `verification-roles.md`.
- Hai lượt nghiên cứu độc lập kiểm tra dữ liệu và UI; controller kiểm tra Phase 3, build/test contracts và tính đầy đủ theo skill. Role researcher cố định lỗi model không được tài khoản hỗ trợ; đã chuyển công việc sang agent mặc định, không thay code hay bỏ kiểm tra.

## Những phần đã có

- Một plan chính, ba phase có yêu cầu, bước thực hiện, rủi ro và rollback.
- Quyết định Team chuẩn/Team khác, đợt đầu dùng team có sẵn không trùng, nguồn thiếu được ghi thật.
- Dedup theo đúng biến thể tướng và chiến pháp gắn với từng tướng, không dựa riêng vào tên đội hoặc mùa.
- Duyệt mùa/Tier, thẻ có chiến pháp/binh thư, chi tiết đội, giữ ranh giới dữ liệu tham khảo và tính năng gameplay.

## Thiếu theo chuẩn deep/TDD

| Hạng mục | Bằng chứng | Phần cần bổ sung |
|---|---|---|
| Kiểm kê từng phase | Các phase có danh sách file, nhưng chưa có bảng inventory kèm hiện trạng, owner, consumer, test count | Bảng tạo/sửa/giữ, hàm/API cần bảo vệ, consumer thực tế và phụ thuộc từng phase |
| Ma trận test | Các mục TDD Gates là danh sách tình huống; chưa nối từng tình huống với fixture, file test, assertion và lệnh chạy | Ma trận đầu vào → kết quả mong đợi → test owner → lệnh → bằng chứng phải lưu |
| Thứ tự tests-first | Phase 1–2 liệt kê nhiều bước sửa parser/state/render trước, TDD tách ở cuối; Phase 3 mới gom lệnh kiểm thử | Đặt Tests Before → thay đổi được bảo vệ → Tests After → Regression Gate vào từng bước thực hiện; giữ invariant đã xanh là regression, không giả nhận Red |
| Gates đã thực hiện | `reports/decision-review.md` chỉ ghi tham vấn Kongming hẹp và structural validation | Hoàn tất review phản biện và kiểm chứng hợp đồng sau khi sửa plan; không gọi CLI format check là behavioral validation |

## Dữ liệu và UI: các hợp đồng cần chốt thêm

| Nhóm | Thiếu sót ảnh hưởng triển khai | Bằng chứng chi tiết |
|---|---|---|
| Thu thập nguồn | Chưa định nghĩa tập mùa/danh mục phải thu đủ, cách tiếp tục sau lỗi, ý nghĩa số đếm và giới hạn cache nhiều scope | [Audit dữ liệu](./audit-deep-data.md), mục 1 |
| Danh tính | Chưa có owner/định dạng ánh xạ tên Trung–Việt cho cả tướng và chiến pháp; bộ slug hiện có không thay được mapping đã xác minh | [Audit dữ liệu](./audit-deep-data.md), mục 2 |
| Biến thể đội cũ | Chưa định nghĩa cách lấy cấu hình đầy đủ từ các ô có nhiều lựa chọn mà không tự sinh tổ hợp | [Audit dữ liệu](./audit-deep-data.md), mục 3 |
| Thiếu dữ liệu nguồn | Chưa tách ô nguồn thực sự bỏ trống với lỗi trích xuất; điều này ảnh hưởng cả hiển thị và kết luận không trùng | [Audit dữ liệu](./audit-deep-data.md), mục 4 |
| Xuất bản đồng bộ | Ghi atomic từng file không đảm bảo Team chuẩn, Team khác, index và details cùng snapshot | [Audit dữ liệu](./audit-deep-data.md), mục 5 |
| Điều hướng | Chưa chốt nơi nhận thao tác Mở team từ Soi đội/Gợi ý đội khi team bị loại khỏi Team khác | [Audit UI](./audit-deep-ui.md), mục 1 |
| Trạng thái | Chưa định nghĩa quyền sở hữu query và thứ tự ưu tiên giữa alias, filter nguồn, config gameplay và detail tham khảo | [Audit UI](./audit-deep-ui.md), mục 3 |
| Mùa của Team khác | Chưa có projection mùa/danh mục và quy tắc hiển thị team chưa rõ mùa; không được suy mùa qua tương đồng đội | [Audit UI](./audit-deep-ui.md), mục 4 |

Các thiếu sót là việc kỹ thuật cần ghi vào plan, không cần hỏi lại người dùng về tên tab, quyền nguồn hoặc việc cho team có sẵn vào Team khác.

## Phase 3: thiếu sót đã kiểm chứng

### High — chưa liệt kê đầy đủ nơi kiểm tra dữ liệu xuất bản

Phase 3 yêu cầu scoped routes và exact public artifacts (`phase-03-validation-and-release.md:30`, `:36`, `:47-49`, `:73-82`), nhưng file inventory không có `scripts/verify-astro-dist.mjs`. Trong code, `verifyAstroDist` dựng danh sách output chỉ từ `${kind}/${sourceBasename}`, từ chối mọi file ngoài tập đó và đọc bytes nguồn ở cùng đường dẫn (`scripts/verify-astro-dist.mjs:26-60`). Route detail mới có thể build được nhưng bị verifier từ chối.

Cần chốt route/manifest/output cụ thể, liệt kê mọi reader/verifier/builder phải cập nhật, rồi test output thiếu/thừa/sai bytes. Không nới allowlist để bỏ qua lỗi.

### High — cam kết giữ toàn bộ test cũ chưa phân biệt hành vi đã được đổi

Plan yêu cầu thay tab và bỏ selector luật, nhưng chưa phân loại các test phải được cập nhật có chủ đích. Code hiện có `tests-js/runtime-asset-contract.test.mjs:103-124` bắt buộc đúng chín section với `team-pk`, `meta-cu` và fallback `team-pk`. `tests-e2e/season-lookup.spec.mjs:21-30` yêu cầu control mùa/luật trên tab cũ; `:55-82` mở config theo ruleset và so kho từ tab đó.

Cần bảng test giữ nguyên / chuyển sang consumer gameplay / viết lại theo alias mới, cùng đường mở đội chi tiết sau migration. Không chỉ xóa assertion để xanh, cũng không yêu cầu UI cũ và UI mới đồng thời trên cùng route.

### Medium — trình tự lệnh và môi trường kiểm thử chưa đủ tái lập

Phase 3 chạy `astro-dist-contract` tại `:63` trước build ở `:75`, nhưng test `tests-js/astro-dist-contract.test.mjs:327` kiểm `dist` có thật. `package.json:5-7` yêu cầu Node >=24.20.0 <25; `:15-19` có các lệnh test/verify cụ thể. `playwright.config.mjs:3,18-23` dùng port 4174 và tự build/start preview.

Cần ghi rõ baseline worktree, Node/Python sử dụng, test nào không cần dist, lúc nào build và `npm run verify`, lệnh MCP cụ thể, cùng kiểm tra port và dừng process do runner tạo. Không cần khởi động server hoặc chạy full suite chỉ để audit tài liệu.

## Kiểm tra đã làm trong lượt audit

- `ak plan validate plans/260912-0950-recommended-season-browser --json`: pass cấu trúc.
- Đếm định nghĩa test trong code: Python Recommended 14; Astro dist 10; runtime assets 6; seasonal E2E 23 khai báo (có vòng lặp sinh thêm case). Đây không phải số test đã chạy hoặc pass trong lượt audit.
- Agent dữ liệu đã chạy riêng `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_sgsdeck_recommended -v` ở worktree: 14 test pass. Không có Red mới, E2E hay full build được chạy trong lượt này.
- Xóa đúng một file và thư mục phác thảo cũ theo yêu cầu người dùng. Thư mục không còn; brainstorm đã bỏ link tới nó và các link còn lại đều tồn tại.
- Các phase vẫn pending; code/WIP không thay đổi.

## Bước sửa plan

Giữ nguyên brainstorm đã chốt. Bổ sung hợp đồng dữ liệu và đường xuất bản cụ thể trước, tiếp theo inventory consumer và test migration, cuối cùng ma trận TDD/lệnh/gates từng phase. Chỉ sau đó mới kết luận plan sẵn sàng cho cook. Không tạo plan thứ hai.
