# Phase 1 — Crawl + dựng từ điển dữ liệu

## Context
- API đã verify: `POST https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json`, header Origin/Referer = sgzzlb.lingxigames.com, body `{"api":"/api/l/owresource/getQueryDataInfoListByCategory","params":{gameId,tbId,categoryIds,page,size}}`. 战法库 tbId=`350659307657771017`. Phân trang size=20.
- Spike artifact: `plans/reports/spike-hanviet-char-map.py.txt` (409 ký tự), `spike-zhanfa-174-hanviet-translit.tsv`.
- 174 = subset 1 category; phải lấy ĐỦ category + field nội dung (loại/chất/hiệu quả/适性/icon).

## Requirements
- Crawl toàn bộ chiến pháp: name(Hán), type, quality(S/A/B), effect, troopFit, source, icon URL.
- Bắt categoryIds đầy đủ (cột nội dung) qua 1 lần headless (CDP) — mở rộng `/tmp/cdp_spike.mjs`.
- Phiên Hán-Việt char-level (mở rộng char-map khi gặp ký tự mới; fail nếu thiếu → log để bổ sung).
- Auto-link sang tên Việt đang dùng (exact + fuzzy) → sinh `aliases.json` đề xuất; phần đa âm/variant review thủ công.
- Tải icon PNG về repo (`assets/tactics/`), không hotlink aligames.
- Output: `data/tactics.json` = list `{chinese, hanViet, viet, aliases[], type, quality, effect, troopFit[], icon, source}`.

## Files
- Tạo: `pipeline/crawl_tactics.py` (crawl + phân trang, stdlib + urllib), `pipeline/hanviet.py` (char-map + transliterate), `pipeline/link_tactics.py` (auto-link + report), `data/tactics.json`, `assets/tactics/*.png`.
- Sửa: `pipeline/aliases.json` (thêm map Hán→Việt phát hiện được).
- Tham chiếu: copy char-map từ artifact spike vào `pipeline/hanviet.py`.

## Steps
1. Mở rộng CDP spike: click 战法库 + click 1 chiến pháp → bắt categoryIds đầy đủ + endpoint detail `getQueryDataInfoByPriId`. Ghi lại tbId/categoryIds các field.
2. `crawl_tactics.py`: lặp page → gom items → map detail field. Sleep giữa request. Lưu JSON thô tiếng Trung.
3. `hanviet.py`: transliterate; nếu gặp ký tự ngoài char-map → ghi `missing_chars.txt`, bổ sung thủ công.
4. `link_tactics.py`: normalize (NFD + đ→d) + exact/fuzzy match vào tên Việt hiện có (facets.tactics) → in báo cáo matched/fuzzy/nomatch; sinh alias đề xuất.
5. Review thủ công phần đa âm (vũ/võ, ki/cơ, tồi/thôi) + variant.
6. Tải icon; viết `tactics.json` deterministic.

## Tests (TDD)
- `tests/test_hanviet.py`: transliterate cụm mẫu (暴戾无仁→bạo lệ vô nhân…), 0 ký tự thiếu trên tập crawl.
- `tests/test_link_tactics.py`: exact-match các cặp đã biết; normalize bỏ dấu đúng; fuzzy ngưỡng hợp lý.
- `tests/test_crawl_tactics.py`: parse response mẫu (fixture JSON đã lưu) → đúng số field; KHÔNG gọi mạng trong test (dùng fixture).

## Risks / Rollback
- API đổi/aligames chặn → snapshot JSON thô làm fixture; crawl offline, không vào runtime.
- Icon hotlink bản quyền → tải về, ghi nguồn; nếu rủi ro thì chỉ dùng tên, bỏ icon.
- Thiếu category → log totalCount mỗi category, đối chiếu kỳ vọng.
