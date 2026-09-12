---
phase: 2
title: "Nhập sáu danh mục nguồn"
status: completed
priority: P2
dependencies: [1]
---
# Nhập sáu danh mục nguồn

## Requirements
Python stdlib importer có cache/checkpoint; site build không cần fetch. Dữ liệu mục tiêu khi source cung cấp:

| Nhóm | Fields |
|---|---|
| generals | Tên, variant, phe, sao, cost, stats/growth, thích tính, chiến pháp tự mang/truyền thừa, quân sư, mùa nguồn |
| tactics | Tên, phẩm chất, loại/nguồn, tỷ lệ, cooldown, max users, binh chủng, tướng truyền thừa, điều kiện đổi, cơ chế/phiên bản |
| equipment | Tên, slot, phẩm chất, stats/quan hệ khi có; khảo sát tab 90 đặc kỹ, lưu riêng child records |
| advisors | Kỹ năng quân sư, hệ, điểm, tướng liên quan, cơ chế, mùa nguồn |
| troop-mods | Chiến pháp gốc, 4 bậc lựa chọn, trait, chuyển binh chủng, tác dụng và điều kiện; kịch bản nguồn |
| buildings | Loại, max level, giới hạn thành chính, prerequisites, chi phí/thời gian/bonus từng cấp |

Baseline quan sát: 202/393/114/39/16/41 = 805 mục cấp cao; 192 mod options và 90 đặc kỹ đếm riêng. Kiểm live lại, không hardcode số này vĩnh viễn. Giữ unknown null; mất field quan trọng vốn có ở baseline phải báo parser regression.

### Chế độ nguồn và offline

- Fetch/update là chế độ gọi mạng được chọn rõ, tuân theo inventory/reuse và giới hạn nguồn; cache miss không tự chuyển một lệnh offline sang chế độ này.
- Rebuild offline chỉ đọc bộ cache/export đã chỉ định và đủ inventory/checksum. Thiếu toàn bộ cache, thiếu list/detail/category hoặc cache hỏng phải trả exit code khác 0, nêu đầu vào thiếu/hỏng, không gọi network và giữ nguyên cả dữ liệu lẫn manifest snapshot đã chấp nhận. Không vá cache bằng fetch hoặc trộn nguồn mới vào lần rebuild.
- Query/validate đọc normalized catalog + manifest và dictionaries canonical sẵn có trong repo để kiểm ref; clone repo không có raw cache vẫn dùng được hai thao tác này. Raw cache riêng tiếp tục gitignored; offline rebuild cần cache/export có sẵn, không hứa clean-clone rebuild nguồn và không yêu cầu commit raw source.
- Parity so cùng cache/export, phiên bản parser, mapping reviewed và canonical inputs: giữ fetchedAt từ cache và bytes output. Báo cáo ghi hash các input để phân biệt thay đổi mapping có chủ ý với lỗi nondeterminism.

## Files
Create pipeline/sgsdeck_source.py, pipeline/build_sgsdeck_catalog.py, data/sgsdeck/{generals,tactics,equipment,advisors,troop-mods,buildings}.json, data/sgsdeck/manifest.json, tests/test_sgsdeck_source.py, tests/test_build_sgsdeck_catalog.py.
Modify .gitignore cho cache riêng; không ignore normalized JSON. Python underscore theo convention sẵn có. Không gọi pipeline.build_json hoặc build_dict.build(), không sửa public manifest.
Modify src/lib/root-static-artifacts.ts và tests-js/astro-dist-contract.test.mjs cho phân loại private subtree. Update docs/sgsdeck-catalog.md về source-tree boundary. Read src/pages/data/[file].json.ts và scripts/verify-astro-dist.mjs; giữ public routes và exact dist allowlist hiện có.

## Steps

### TDD — Red → Green → Refactor

- [x] Red private boundary trước khi thêm catalog: trên temp root hợp lệ, thêm `data/sgsdeck/` phải vẫn sinh đúng tập public routes; hiện `staticPathsFor("data")` ném source-set mismatch. Có cases từ chối entry/file/directory lạ ở public roots, `data/sgsdeck` là file hoặc symlink và public artifact symlink; không bỏ guard để làm xanh.
- [x] Green private boundary: phân loại duy nhất `data/sgsdeck/` là thư mục private tùy chọn, phải là real directory nằm trong root; hoạt động cả khi chưa có catalog. So phần public còn lại với exact manifest như cũ, không tự bỏ qua mọi directory hoặc thêm catalog vào `PUBLIC_ARTIFACTS`. Contract test dùng cùng policy validator thay cho raw `readdir` equality, vẫn kiểm riêng route/read boundary.
- [x] Refactor private boundary: chạy focused `node --experimental-strip-types --test tests-js/astro-dist-contract.test.mjs` với dist baseline hợp lệ, rồi `npm run build`, `npm run test:dist`, `npm run verify` trên bản sao project tạm có private subtree thử nghiệm. Không cần đợi importer hoặc đưa fixture vào catalog runtime; phase 4 lặp gate với catalog thực. Chứng minh không có route đọc catalog và không có catalog trong dist; ghi Red/Green/Refactor riêng với parser.

- [x] Red: trước từng parser/build slice, viết/chạy test mẫu thật; bao phủ reorder giữ ID, field regression, count cha/con, snapshot thiếu/hash sai, fetch lỗi giữ output cũ và offline byte parity.
- [x] Red offline: cases cache vắng, thiếu list/detail/category, JSON hỏng hoặc checksum sai; chặn/quan sát mọi lời gọi network trong test, assert không có request, exit khác 0 và bytes sáu output + manifest cũ không đổi. Đây là failure injection trên fixture nguồn thật, không đưa placeholder vào runtime.
- [x] Green: triển khai hành vi tương ứng, chạy focused tests trước promote snapshot.
- [x] Refactor: chạy lại parser/build tests, kiểm corpus canonical không đổi và ghi bằng chứng vào báo cáo validation của plan.

### Triển khai theo từng lát cắt
Trước lát cắt importer, hoàn tất TDD private boundary ở trên. Catalog loader vẫn sở hữu schema/hash/reference validation của nội dung private; Astro không fetch, parse hay publish catalog.

1. Test parser với mẫu cấu trúc thật tối thiểu; fixture không chứa toàn bộ bundle hoặc thông tin account.
2. Parse HTML/JSON hydration bằng parser, không eval source scripts. Allowlist fields loại UI/account/editorial.
3. Tách đường fetch/update và rebuild offline theo contract trên; validate đầy đủ cache trước build offline. Chỉ đường fetch/update được thực hiện list → detail, URL allowlist host/path; cache checksum/fetchedAt, timeout, giới hạn request và resume. Chỉ bắt đầu bulk sau khi phase 1 ghi nhận phương thức reuse phù hợp. Dừng auth/rate-limit theo response, không circumvent. Nếu cần cấp phép/export, chỉ bước bulk chờ; metadata và plan mùa vẫn có thể tiến hành.
4. Reconcile toàn inventory gồm tướng nội chính, equipment đặc kỹ, số cấp từng building.
5. Validate toàn staged set: types, duplicate IDs, references, provenance, đơn vị và missing fields. Reference ngoài catalog ghi external/unresolved, không nối nhầm.
6. Manifest lưu hash/count/coverage. Promote bộ output có backup/rollback; loader verify manifest để không đọc trạng thái ghi dở. Rebuild offline giữ fetchedAt và bytes khi các input theo contract parity không đổi; không promote nếu cache/export thiếu hoặc hỏng.

## Success / validation
- [x] Đủ sáu nhóm, reconciliation expected/extracted/missing rõ.
- [x] ID không đổi khi reorder source; rebuild offline byte-identical.
- [x] Parse/network failure không phá previous output; incomplete snapshot không đọc được.
- [x] Rebuild offline thiếu/hỏng cache không có network request, lỗi rõ và giữ nguyên sáu output + manifest cũ; query/validate normalized snapshot không cần raw cache.
- [x] Focused tests parser/build đạt, spot-check full detail mỗi nhóm.
- [x] Có hoặc không có `data/sgsdeck/`, static paths/public reads chỉ dùng manifest; catalog không có public route hoặc output trong dist.
- [x] Private subtree hợp lệ không phá build; entry lạ và symlink không hợp lệ vẫn fail. `PUBLIC_ARTIFACTS` và exact dist allowlist không đổi.

## Progress 2026-09-12

Owner-authorized import hoàn tất: 805 parent + 708 child, gồm 176 general detail, 90 equipment special, 192 troop option và 426 building level. Snapshot validate, deterministic byte parity và atomic failure-preservation đạt; private source-tree không xuất hiện trong public routes/dist. Parser Flight dùng đủ 114 upstream equipment ID và resolve deferred `古錠刀` thành quality `橙`, slot `武器`.

## Risk / rollback
HTML drift hoặc source shrink bất thường → giữ snapshot cũ và báo URL/category. Không bịa để đạt count. Restore trọn snapshot, không dùng dictionaries canonical làm scratch. Nếu rollback phân loại private subtree, phải gỡ/di chuyển catalog khỏi `data/` trước hoặc cùng rollback để source-tree guard cũ không phá build; không mở public manifest để né lỗi.
