# Spike: Headless crawl 战法库 (lingxigames) — KẾT QUẢ

_2026-06-21 21:04 (+07). Mục tiêu: xác nhận có crawl được thư viện chiến pháp DB chính thức bằng headless không, và ước lượng công sức._

## Verdict: ✅ CRAWL ĐƯỢC — bằng curl thuần, không cần auth token

Đã chứng minh end-to-end: render headless → click tab 战法库 → bắt API → replay bằng `curl` → nhận JSON sạch. **174 chiến pháp** truy cập được.

## Cơ chế (đã verify)

1. Trang là SPA (`sgzzlb.lingxigames.com/station/`). Tab 战法库 nạp data qua **proxy API**:
   ```
   POST https://galaxias-api.lingxigames.com/ds/ajax/endpoint.json
   Headers: Origin + Referer = https://sgzzlb.lingxigames.com  (BẮT BUỘC, thiếu -> 404)
   Body:
   {"api":"/api/l/owresource/getQueryDataInfoListByCategory",
    "params":{"gameId":10000100,
              "tbId":"350659307657771017",          // id bảng 战法库
              "categoryIds":"352052655832446980,...", // id cột muốn lấy
              "page":0,"size":20}}
   ```
2. Response: `result.totalCount=174`, `result.items[]`, mỗi item:
   - `priVal` = tên chiến pháp (TIẾNG TRUNG: 燕人咆哮, 威震华夏, 一身是胆…)
   - `priRowId` = id dòng (dùng cho endpoint detail)
   - `details[]` = các cột {key,val} — tùy `categoryIds` truyền vào (icon, loại, chất, hiệu quả, thích tính…)
3. Phân trang `page/size` → lặp page=0..⌈174/size⌉ là lấy hết.
4. Không có token/chữ ký. Chỉ cần header Origin/Referer đúng.

## Cách lấy tham số (one-time, cần headless)
`tbId` + `categoryIds` không đoán được → bắt 1 lần bằng headless CDP:
- Script PoC: `/tmp/cdp_spike.mjs` (Node 24 native WebSocket+fetch, lái Chrome qua `--remote-debugging-port`, KHÔNG cần npm/Playwright).
- Đã bắt được: `战法库 tbId=350659307657771017`; `武将库 tbId=350659087930767364` (fire lúc landing).
- Sau khi có tbId/categoryIds → crawl full bằng curl/Python, không cần browser nữa.

## Còn thiếu (chưa làm trong spike)
- **Field đầy đủ**: bộ `categoryIds` bắt được chỉ trả icon+tên (list view). Loại/chất/hiệu quả/兵种适性 nằm ở cột khác (thêm categoryIds) hoặc endpoint detail `getQueryDataInfoByPriId` (theo `priRowId`). Cần 1 lần click vào 1 chiến pháp để bắt nốt cột/endpoint detail.
- **武将库** (tướng): cùng cơ chế, tbId đã có, chưa bắt categoryIds.

## Chi phí thật = dịch Hán→Việt (KHÔNG phải lấy data)
Data nguồn tiếng Trung. Site ta dùng tên Việt (vd "Thịnh Khí Linh Địch"). Phải map 174 战法 + ~vài trăm 武将 (Trung) ↔ tên Việt đang dùng (112 CP, 85 tướng).
- Hướng: Hán-Việt transliteration + fuzzy match (difflib) vào tập tên Việt đã có → review thủ công (giống `suggest_aliases.py`).
- Đây là phần tốn công nhất, rủi ro lệch tên.

## Kế hoạch nếu làm thật (ước lượng)
1. Hoàn thiện scraper (Python, stdlib + 1 lần headless lấy tbId/categoryIds đầy đủ cả 战法+武将+detail). ~0.5–1 ngày.
2. Crawl → JSON thô tiếng Trung (174 CP + ~N tướng, đủ field type/quality/effect/affinity/cost). ~vài giờ.
3. Map Hán→Việt bán tự động + review. ~1–2 ngày (phần nặng).
4. Tích hợp vào pipeline/site (tooltip CP, hoặc engine gợi ý). Riêng.

## Lưu ý pháp lý/kỹ thuật
- Crawl chạy OFFLINE lúc build-data, KHÔNG vào runtime site → không thêm dependency cho site (giữ zero-dep).
- API nội bộ, có thể đổi bất ngờ → snapshot data, không phụ thuộc live.
- Tôn trọng rate-limit (sleep giữa request), chỉ lấy data tham khảo.

## Unresolved questions
- Lấy full field cho 战法+武将 (cần bắt thêm categoryIds/detail endpoint) — làm tiếp spike phase 2?
- Mức độ chấp nhận công map Hán-Việt thủ công?
- Có cần cả 武将 (tướng) ngay không hay chỉ 战法 trước (cho tooltip)?
