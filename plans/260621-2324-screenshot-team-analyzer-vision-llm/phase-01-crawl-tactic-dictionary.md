# Phase 1 — Crawl + dựng từ điển dữ liệu

## Context
- API đã verify: `POST https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json`, header Origin/Referer = sgzzlb.lingxigames.com, body `{"api":"/api/l/owresource/getQueryDataInfoListByCategory","params":{gameId,tbId,categoryIds,page,size}}`. 战法库 tbId=`350659307657771017`. Phân trang size=20.
- Spike artifact: `plans/reports/spike-hanviet-char-map.py.txt` (409 ký tự), `spike-zhanfa-174-hanviet-translit.tsv`.
- 174 = subset 1 category; phải lấy ĐỦ category + field nội dung (loại/chất/hiệu quả/适性/icon).

## Requirements
- Crawl **chiến pháp** (战法库, tbId=`350659307657771017`): name(Hán), type, quality(S/A/B), effect, troopFit, source, iconUrl.
- **[C1] Crawl TƯỚNG** (武将库, tbId=`350659087930767364` — đã bắt được lúc landing): name(Hán), faction, iconUrl → `data/heroes-dict.json {chinese, hanViet, viet}`. CẦN cho Phase 4 map `nameCn`.
- **[C1] Bảng chất tướng** (`statFocusCn`): map cứng 智力→Trí, 武力→Lực/Võ, 统率→Thống, 速度→Tốc, 防御→Phòng, 全X→"Toàn X". Nhỏ, viết tay trong `pipeline/hanviet.py`.
- Bắt categoryIds đầy đủ (cột nội dung) qua 1 lần headless (CDP) — mở rộng `/tmp/cdp_spike.mjs` cho cả 战法库 + 武将库.
- Phiên Hán-Việt char-level (mở rộng char-map khi gặp ký tự mới; **fail loud** nếu thiếu → ghi `missing_chars.txt`, KHÔNG ship thiếu).
- Auto-link sang tên Việt đang dùng (exact + fuzzy) → sinh đề xuất alias; phần đa âm/variant review thủ công.
- **[M4] Review thủ công ghi vào `pipeline/aliases.json` (override deterministic)** → re-crawl áp lại, không làm lại.
- **[C3] Icon: CHỈ lưu `iconUrl` (không tải/commit redistribute).** MVP hiển thị text-only; hotlink icon optional sau, gated pháp lý. KHÔNG commit PNG aligames lên Pages public.
- Output: `data/tactics.json` = `{chinese, hanViet, viet, aliases[], type, quality, effect, troopFit[], iconUrl, source}`; `data/heroes-dict.json`.

## Files
- Tạo: `pipeline/crawl_tactics.py` (crawl chiến pháp+tướng, stdlib urllib), `pipeline/hanviet.py` (char-map + transliterate + map chất tướng), `pipeline/link_tactics.py` (auto-link + report), `data/tactics.json`, `data/heroes-dict.json`.
- Sửa: `pipeline/aliases.json` (map Hán→Việt + override review).
- Tham chiếu: copy char-map từ artifact spike (`plans/reports/spike-hanviet-char-map.py.txt`) vào `pipeline/hanviet.py`.
- KHÔNG tạo `assets/tactics/` (C3 — không redistribute icon).

## Steps
1. Mở rộng CDP spike: click 战法库 + 武将库 + click 1 mục → bắt categoryIds đầy đủ + endpoint detail `getQueryDataInfoByPriId`. Ghi lại tbId/categoryIds.
2. `crawl_tactics.py` + crawl tướng: lặp page → gom items → map detail. **[H3]** retry/backoff khi 404/timeout; lưu raw JSON từng page làm checkpoint+fixture; **fail loud nếu `len(items) != totalCount`** mỗi category (chống thiếu âm thầm).
3. `hanviet.py`: transliterate chiến pháp + tướng; ký tự ngoài char-map → `missing_chars.txt` + dừng (không ship thiếu).
4. `link_tactics.py`: normalize (NFD + đ→d) + exact/fuzzy vào facets.tactics + heroes → báo cáo matched/fuzzy/nomatch; sinh alias đề xuất.
5. Review thủ công đa âm (vũ/võ, ki/cơ, tồi/thôi) + variant → **ghi vào `aliases.json`** (deterministic).
6. Viết `tactics.json` + `heroes-dict.json` deterministic (chỉ iconUrl, KHÔNG tải PNG).

## Tests (TDD)
- `tests/test_hanviet.py`: transliterate cụm mẫu (暴戾无仁→bạo lệ vô nhân…), 0 ký tự thiếu trên tập crawl.
- `tests/test_link_tactics.py`: exact-match các cặp đã biết; normalize bỏ dấu đúng; fuzzy ngưỡng hợp lý.
- `tests/test_crawl_tactics.py`: parse response mẫu (fixture JSON đã lưu) → đúng số field; KHÔNG gọi mạng trong test (dùng fixture).

## Risks / Rollback
- API đổi/aligames chặn → snapshot JSON thô làm fixture; crawl offline, không vào runtime.
- Icon hotlink bản quyền → tải về, ghi nguồn; nếu rủi ro thì chỉ dùng tên, bỏ icon.
- Thiếu category → log totalCount mỗi category, đối chiếu kỳ vọng.
