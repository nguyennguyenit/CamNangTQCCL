---
phase: 4
title: "Kiểm thử và bàn giao catalog"
status: completed
priority: P2
dependencies: [3]
---
# Kiểm thử và bàn giao catalog

## Requirements
Review độc lập về coverage, identities, region, provenance và public boundary. Không gọi catalog đầy đủ chỉ vì đủ file. Report field cơ chế/chi tiết còn thiếu. Local catalog không đồng nghĩa web/MCP đã publish.

## Files
Modify README.md (link/commands), docs/sgsdeck-catalog.md (schema/query/update/rollback), phase files và index khi có bằng chứng hoàn thành.
Create reports/import-validation.md trong plan này. Không sửa docs/deployment.md WIP.

## Steps

### TDD — nghiệm thu

- [x] Kiểm bằng chứng Red/Green/Refactor của phase 2–3, gồm private source-tree boundary và parser/identity/query; phase cuối không thay thế tests-first ở các phase trước.
- [x] Lỗi mới từ review phải có regression test thất bại trước sửa, rồi chạy focused test và suite bị ảnh hưởng.
- [x] Không cố làm test đang xanh thất bại để tạo bằng chứng TDD giả; giữ các gate tổng hợp bên dưới.

### Kiểm chứng tổng hợp
1. Focused source/build/identity/query tests → python3 -m unittest discover -s tests.
2. npm run test:contracts; npm run check; npm run build; npm run test:dist; npm run verify với catalog thực nằm trong data/sgsdeck/. Kiểm tập route/read vẫn chỉ public manifest, không có catalog/manifest nguồn trong dist; test temp root bao phủ có/không catalog, entry lạ và symlink không hợp lệ. Chỉ thêm E2E/Worker checks nếu contract đó bị chạm.
3. So checksum canonical dữ liệu Việt/public manifest trước-sau; source catalog không tự thành recommendation pool.
4. Rebuild offline parity với cùng bộ input/cache/hash; chạy lại failure injection thiếu/hỏng cache để chứng minh không gọi mạng, lỗi rõ và giữ nguyên sáu output + manifest. Kiểm query/validate khi bỏ raw cache khỏi môi trường test nhưng giữ normalized catalog và canonical dictionaries. Kiểm inventory, không account/cookie/token/prose ngoài scope.
5. Reviewer kiểm acceptance; báo count/hash/coverage/mapping/limitations với nguồn và ngày thật.
6. Bàn giao cho plan mùa: facts và mapping theo `canonicalRef:null|{kind,id}`; kiểm shape, namespace, tồn tại, đúng variant và parity helper theo phase 1/3. Không có team/tier mới từ sáu URL.

## Success
- [x] Tests/review pass; unresolved data có nhãn chặn cách dùng sai.
- [x] Commands trong README/help thực thi được, links hợp lệ.
- [x] Đếm đúng record cha/options/levels và source version.
- [x] Clone repo query/validate được offline bằng normalized catalog + manifest, không cần raw cache; rebuild offline cần cache/export đủ và lỗi rõ nếu thiếu/hỏng. README/help phân biệt fetch/update với rebuild offline; không gọi crawler khi build site.
- [x] Có bằng chứng TDD canonicalRef và offline-cache failure; mọi ref non-null resolve đúng canonical identity, nhóm chưa có owner giữ null.
- [x] Build chấp nhận private catalog, không publish nó; `PUBLIC_ARTIFACTS`, exact dist allowlist và bytes dữ liệu Việt giữ nguyên. Guard entry lạ/symlink vẫn đạt.

## Progress 2026-09-12

Catalog thực đã chạy lại sau hậu kiểm: snapshot validate, 805 parent + 708 child, 114 upstream equipment ID, deterministic byte parity và 79 canonical refs. Focused 37/37, Python 126/126, Node 145/145, Astro 0 diagnostics, build Green, dist 10/10 và verifier 36 files/33 raw assets. Reviewer rerun GO.

Giới hạn bàn giao: 33/90 special unlinked; 26 general list-only theo thiết kế upstream; 79 canonical ref chỉ từ exact Chinese equality. Catalog vẫn private, không có UI/MCP/team/tier mới và không deploy/commit trong task này.

## Risk / rollback
Nếu muốn thêm public UI/API sáu danh mục phải xác định scope riêng, không âm thầm tăng phạm vi importer. Rollback snapshot/scoped docs, giữ WIP; nếu rollback validator về contract cũ, gỡ/di chuyển `data/sgsdeck/` trước hoặc cùng rollback để build không bị source-set mismatch. Không commit/deploy ở task hiện tại.
