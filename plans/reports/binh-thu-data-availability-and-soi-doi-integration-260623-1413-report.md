# Research Report: Data binh thư & data tướng — có sẵn không + hướng hỗ trợ "Soi đội từ ảnh"

> Thực hiện: 2026-06-23 14:13 (Asia/Saigon). Loại: research nội bộ codebase + xác minh nguồn ngoài.

## Executive Summary

- **Data tướng: CÓ SẴN, đầy đủ.** `data/heroes-dict.json` = 112 tướng (chinese/hanViet/viet, faction, stars, cost, 6 chỉ số, selfTactic, iconUrl).
- **Data binh thư: KHÔNG có dạng dict.** Binh thư chỉ tồn tại 2 dạng: facet (`facets.json.books` = 74 tên Việt + count) và gắn theo tướng trong `teams.json` (`heroes[].books[]`, chỉ name). Không mô tả/hiệu ứng/Hán.
- **KHÔNG crawl được binh thư từ lingxi.** Reverse bundle `stationpc.js`: lingxi station chỉ có 4 thư viện — 武将库/战法库/战备库(trang bị)/兵种库(binh chủng đặc biệt). Không có 兵书库.
- **Soi đội hiện CỐ TÌNH bỏ binh thư** ở cả worker (prompt) và site (`analyze-map.js`). Muốn hỗ trợ phải sửa 4 chỗ + dựng `books-dict.json`.
- **Quyết định user (chốt):** scope = chỉ map Hán↔Việt; nguồn tên Hán = crawl wiki game; vai trò = chỉ hiển thị (không tính điểm so khớp).

## Key Findings

### 1. Data tướng (heroes)
- `data/heroes-dict.json`: list 112 record. Build từ lingxi 武将库 (`pipeline/crawl_tactics.py` `TB_HEROES=350659087930767364`).
- Facet `heroes` = 85 (số tướng xuất hiện trong 172 team) — khác 112 trong dict.

### 2. Data chiến pháp (để so sánh)
- `data/tactics.json`: 237 record (effect/target/troopFit/source...). Build từ 战法库 `TB_TACTICS=350659307657771017`.

### 3. Data binh thư (books) — thiếu
| Dạng tồn tại | Vị trí | Nội dung |
|---|---|---|
| Facet | `facets.json.books` | 74 tên Việt + count (Thế Phòng Thủ, Cầm Binh Khí, Tam Quân Chi Chúng, Rèn Luyện...) |
| Gắn theo tướng | `teams.json` `heroes[].books[]` | `{name, alternatives}` — không mô tả |
| Dict riêng | ❌ | Không có |

→ Thiếu hẳn ánh xạ **Hán → Việt canonical**, là thứ soi đội cần (vision đọc chữ Hán như `铁甲/防备`).

### 4. Lingxi không có nguồn binh thư
Reverse `https://cdn-cn.lingxigames.com/.../stationpc.9db2aee0.js`:
- 4 route menu: `wjk`(武将库), `zfk`(战法库), `zbk`(战备库, tbId `350659411548294145`, = trang bị 青龙偃月刀...), `bzk`(兵种库, tbId `553976671589912577`, = 12 binh chủng đặc biệt 象兵/虎豹骑...).
- **Không có 兵书库.** → binh thư phải lấy nguồn khác.

### 5. Code đang chặn binh thư (2 chỗ)
- `worker/src/model.ts` `VISION_PROMPT`: *"Không đưa binh thư... 三军之众/统军/锤炼 vào tacticsCn"*. Schema `worker/src/schema.ts` chỉ có `{nameCn, tacticsCn[], statFocusCn}` — không có field binh thư.
- `js/analyze-map.js` `NON_TACTIC_TERMS`: lọc bỏ binh thư khỏi tactics — nhưng đã chứa sẵn ~13 tên Hán binh thư (三军之众, 惜兵爱民, 统军, 锤炼, 久战, 铁甲, 防备, 奇正相生, 胜战, 执锐, 文韬, 分险, 蛮勇非勇) → tận dụng được làm seed.

### 6. Nguồn wiki để crawl tên Hán (đã verify sơ bộ)
- Tồn tại: 9game "兵书大全", gamersky "兵书系统解析", huijiwiki, zhihu/sohu — đều có tên Hán + hiệu ứng binh thư.
- **Rủi ro crawl:** 9game JS-render (curl chỉ ra ~31KB, thiếu phần lớn list); huijiwiki trả **403**. → cần chọn nguồn render server-side (thử baidu baike / gamersky / tieba) hoặc fallback bảng thủ công map về 74 tên facet.
- Hiệu ứng mẫu xác nhận tồn tại data: 三军之众=cấp cứu R2-4; 久战=+3% công tâm/đảo qua; 锤炼=-10% sát thương trạng thái; 统军=+20 thống.

## Implementation Recommendations (build plan tóm tắt)

Scope đã chốt: **books-dict.json `{chinese, hanViet, viet}` + hiển thị, không tính điểm.**

1. **Dựng `data/books-dict.json`** (~74 record):
   - Crawl 1 nguồn wiki render-được → gom tên Hán binh thư.
   - Convert Hán→Hán-Việt qua `pipeline/hanviet.py`; auto-link Hán-Việt → tên Việt facet qua `pipeline/link_tactics.py`; fuzzy/nomatch in report review thủ công → `tactic-name-overrides`-style cho books.
   - Module mới `pipeline/build_books_dict.py` (theo khuôn `build_dict.py`), tránh sửa file >200 LOC.
2. **Worker** (`schema.ts` + `model.ts`): thêm `booksCn: string[]` mỗi hero; sửa prompt cho phép đọc binh thư (dòng vàng) vào `booksCn` (KHÔNG vào `tacticsCn`). Cập nhật `validateResult` + test.
3. **Site map** (`js/analyze-map.js`): bỏ binh thư khỏi `NON_TACTIC_TERMS`; thêm `booksDict` vào `mapRead` → `books[]` canonical; `findSimilarTeams` GIỮ NGUYÊN (không tính điểm).
4. **UI** (`js/analyze.js` + render): hiển thị binh thư mỗi tướng ở "Đội đọc được".
5. **Test:** `tests-js/analyze-map.test.mjs`, worker test, + fixture binh thư.

## Resources & References

- Lingxi station bundle: `https://cdn-cn.lingxigames.com/wukongbuild/prism-sgzzlb/1.0.0/test/static/js/stationpc.9db2aee0.js`
- [9game 兵书大全](https://www.9game.cn/sgzzlb/3985868.html) (JS-render)
- [gamersky 兵书系统解析](https://www.gamersky.com/handbooksy/201912/1251327.shtml)
- [zhihu 兵书系统全面分析](https://zhuanlan.zhihu.com/p/403618446)

## Unresolved Questions

1. **Nguồn crawl cụ thể chưa chốt** — wiki render-được nào ổn định nhất (huijiwiki 403, 9game JS)? Cần thử baidu baike/gamersky lúc build; nếu đều chặn → fallback bảng thủ công.
2. **Phân biệt binh thư vs binh chủng trong ảnh** — vision có thể nhầm 兵种战法 (象兵...) với binh thư; cần prompt rõ + dict tách bạch.
3. **74 facet đã đủ phủ chưa** — wiki có thể liệt kê nhiều binh thư hơn 74 (tên không xuất hiện trong 172 team); chỉ cần map phần giao với facet hay dựng full?
