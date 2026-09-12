---
phase: 3
title: "Liên kết danh tính và query local"
status: completed
priority: P2
dependencies: [2]
---
# Liên kết danh tính và query local

## Requirements
- Khớp chắc chắn với tên Việt hiện có; không fuzzy auto-merge.
- Phồn/giản dùng mapping reviewed, giữ SP/CO/40Y và biến thể/sao. Không đồng nhất chỉ vì cùng tên sau phiên âm.
- nameVi chưa chắc giữ null; phiên âm có nhãn transliteration, không giả là tên game.
- identity=matched|ambiguous|unmapped khác vnAvailability=unverified|verified|unavailable.
- Matched identity vẫn giữ thông số/source-season Đài Loan riêng.
- `canonicalRef` tuân contract [phase 1](phase-01-import-and-validate.md): null hoặc `{kind,id}` có đúng kind/namespace, resolve tới đúng record canonical hiện có. Không dùng source ID/tên hiển thị làm ref; nhóm chưa có canonical owner và identity ambiguous/unmapped giữ null. Link tới thực thể liên quan không thay ref của chính record.
- Read-only query bằng tên gốc hoặc tên Việt đã mapping, kết quả JSON có provenance/coverage.

## Files
Create pipeline/sgsdeck_identity.py, pipeline/sgsdeck-name-map.json, pipeline/query_sgsdeck_catalog.py, tests/test_sgsdeck_identity.py, tests/test_query_sgsdeck_catalog.py.
Read data/heroes-dict.json, data/tactics.json, pipeline/aliases.json, js/hero-identity.js, mcp-worker/src/data/entity-identity.ts; không phát minh canonical identity thứ hai.
Update source catalog/manifest; không thay runtime dictionaries.

## Steps

### TDD — Red → Green → Refactor

- [x] Red: viết/chạy identity/query tests trước code: thường/SP/CO/40Y không merge, ambiguity không auto-match, matched không suy VN availability, orphan ref, query Việt/Hán, input sai và manifest mismatch.
- [x] Red canonicalRef: từ chối missing field, chuỗi thay object, kind không hỗ trợ hoặc sai category, namespace sai, `sgsdeck:*`/display name giả ID, ID không tồn tại và ref trỏ nhầm variant dù ID có tồn tại. Chấp nhận null cho nhóm chưa có owner/identity chưa rõ. So kết quả mapping Python với ID từ `canonicalHeroId`/`canonicalDictionaryId` trên mẫu canonical thật (dùng trường `viet`), không chỉ so với một slug function Python thứ hai; case 40Y chưa có đối ứng phải giữ null.
- [x] Green: triển khai mapping/loader/query theo từng hành vi; query offline trên snapshot đã validate.
- [x] Refactor: chạy lại identity/query và source/build tests; ghi bằng chứng vào báo cáo validation của plan.

### Triển khai theo từng lát cắt
1. Đo exact matching với normalization kiểm chứng; phân loại duplicate/ambiguous và variant.
2. Xuất matched/unmapped/conflicting report. Override có evidence/reason; validate canonicalRef theo phase 1 và đối chiếu helper hiện có trước promote. Mapping/rebuild dùng cache offline theo phase 2; đổi override là thay input có chủ ý, ghi hash để kiểm deterministic bằng cùng bộ input.
3. Resolve generals↔tactics↔advisors và tactics↔troop-mods. Link source IDs đầy đủ, unknown refs không bị drop.
4. Query CLI group/name, giới hạn output rõ; input invalid lỗi rõ. Loader offline verify schema+manifest và canonicalRef trước trả; query/validate không cần raw cache và không gọi network.
5. Bàn giao candidate thực thể mới cho phase curate plan mùa; chưa đủ evidence VN thì giữ reference, không thành recommender candidate.

## Success / validation
- [x] Query Việt/Hán trỏ cùng source identity nếu mapped.
- [x] Không nhập nhằng tướng thường/SP/CO/40Y; unmapped/ambiguity thấy được.
- [x] Report từng nhóm số mới/trùng/khác biệt và field coverage.
- [x] Tests collision, orphan ref, thiếu translation, manifest mismatch, no-network query đạt.
- [x] canonicalRef đúng shape/kind/namespace, tồn tại và đúng variant; parity với helper identity hiện có đạt. Query/validate từ normalized catalog khi không có raw cache vẫn đạt.

## Progress 2026-09-12

Full snapshot có 79 canonical ref bằng exact Chinese equality: 39 general và 40 tactic. Mọi ref validate đúng shape/kind/namespace/existence/variant và parity với helper hiện có; không fuzzy auto-merge. Equipment special nối được 57/90 parent, 33 giữ unlinked. Query Hán/Việt, manifest mismatch, no-network và clean-clone normalized validation đều đạt.

## Risk / rollback
Mapping sai → bỏ override có lỗi và rebuild source catalog, giữ dictionaries Việt. Đổi source slug phải giữ upstream ID hoặc alias migration reviewed, không nối theo vị trí.
