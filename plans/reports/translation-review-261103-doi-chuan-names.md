# Translation review — Đội chuẩn names (2026-11-03)

Reviewer: NamesReview (independent; did not draft). Scope: every added/changed entry in `pipeline/recommended-identity-map.json` and `pipeline/recommended-display-map.json` (git diff vs HEAD) against `plans/reports/translation-draft-261103-doi-chuan-names.md`.

Mechanical checks passed: the 164 team table rows equal the 164 new JSON team entries exactly; no Han script in any new Vietnamese name; one alias per team; bracket presence matches the raw; no duplicate display names within the batch or against the 661 existing teams; all 10 user-confirmed tactic names spelled exactly as listed in the worksheet (守望相助 Thủ Vọng Tương Trợ, 鑑時審勢 Giám Thời Thẩm Thế, 衡軛陣 Hành Ách Trận, 板楯虎盾 Bản Thuẫn Hổ Thuẫn, 焚營 Phần Doanh, 千里 Thiên Lý, 鬼神 Quỷ Thần, 錦帆 Cẩm Phàm, 陷陣 Hãm Trận, 絕道 Tuyệt Đạo).

## Tally

| group | reviewed | accepted | rejected |
|---|---|---|---|
| teams | 164 | 158 | 6 |
| heroes (3 new + 無雙星彩 alias) | 4 | 4 | 0 |
| tactics (12 new + 桃園結義 kind change) | 13 | 13 | 0 |
| book | 1 | 1 | 0 |
| statFocus | 60 | 60 | 0 |
| season PK-S20 | 1 | 1 | 0 |
| user-confirmed tactics (spelling only) | 10 | 10 | 0 |
| **total** | **253** | **247** | **6** |

## Verdicts per group

### Teams — ACCEPT 158 / REJECT 6
Conventions confirmed against the existing 661 entries:
- Hán-Việt per character, unit words (Cung/Kỵ/Thương/Thuẫn), `SP`/`CO`/`40Y` prefixes, ASCII `( )`: consistent.
- Embedded tactic abbreviations are Hán-Việt in existing team names, not the tactics.json `viet` field (existing 太尉盾(陷陣眾志成城版) → "Chúng Chí Thành Thành", not "Toàn Quân Đồng Lòng"; 軍草皇馬（撫輯）→ "Phủ Tập"). So 臥薪嘗膽 → "Ngọa Tân Thường Đảm" and 撫輯軍民 → "Phủ Tập Quân Dân" follow convention (tactics.json viet would be "Nằm Gai Nếm Mật" / "An Ủi Quân Dân"); accepted.
- 嘟嘟 → Đô Đốc (existing 嘟嘟弓 → Đô Đốc Cung); 碰瓷 → "… cảm tử" suffix; 頂/低配 → "cấu hình …"; 肉弓 → Nhục Cung (existing 形一肉弓); 鼠標弓 → Thử Tiêu Cung; 權騎 → Quyền Kỵ (existing); 三勢呂… pattern; 骨頭盾 → Cốt Đầu Thuẫn; 洞察槍 → Động Sát Thương; 抵禦 → Đề Ngự; X版 → "(bản X)" all match precedent.
- 共存 → "cùng tồn" is the project UI term (js/team-filter-section.js "Cùng Tồn"; js/render.js "Cùng tồn N"); the lone existing "Cộng Tồn" (共存麒麟弓) is the outlier. 共存版 → "(bản cùng tồn X)" accepted.
- Author tags: 小幫手 is confirmed as an author handle by source notes ("小幫手 1/16 評 T0 114"), 首發版 = first-release recommendation ("首發推薦"); "(bản đầu tiên của Tiểu Bang Thủ)" accepted. 大白 Đại Bạch, 孝公 Hiếu Công, 大恐龍 Đại Khủng Long, 阿焰 A Diễm, 詩人 Thi Nhân, 秋石 Thu Thạch transliterations accepted (precedent: -by大米 → Đại Mễ). 秋石天梯版 → "bản thang xếp hạng Thu Thạch" accepted.
- Hero words: Gia Cát (incl. 諸葛恪 → Gia Cát Khác ⇒ 恪 = Khác), Chu Tuấn, Trình Phổ, Lữ Mông, Hác Chiêu, Mãn/Sủng, Giả (賈) all agree with heroes-dict.
- Non-blocking note (not rejected): 摩卡弓 → "Ma Ca Cung" is a literal per-character reading of a coffee-name pun ("Mocha"); the HV table has no entry for 卡. Maintainer may prefer "Mocha Cung"; no precedent either way.

Rejections (details in table): the four 核彈 + hero names that must follow the 5-of-6 existing "Hạt Nhân" precedent (核彈張, 核彈張角, 核彈張遼, 核彈張飛, 法正核彈 → all "Hạt Nhân"); 荀彧太威盾 (source typo, source text itself calls it 太尉盾); 慷慨弓（孝公程普版） (ambiguous bracket).
Note: 核彈弓 forms (#7 SP朱儁核彈弓, #8 袁術核彈弓) keep "Hạch Đạn Cung" — one existing precedent (張飛核彈弓（精·無當飛軍） → Trương Phi Hạch Đạn Cung); accepted but the existing project is already internally mixed. If the maintainer unifies on Hạt Nhân, change those two too.

### Heroes — ACCEPT 4
龐德 → Bàng Đức (heroes-dict#41), SP 劉曄 → SP Lưu Diệp (#176, variant SP), 曹真 → Tào Chân (#236) all verified. 無雙星彩 alias on the existing user-confirmed entry → "CO Vô Song Tinh Thái" accepted (consistent with the other two CO Vô Song entries and docs/season-team-data.md; heroes-dict#124 "CO Tinh Thái" intentionally not used).

### Tactics — ACCEPT 13
All 12 evidenceRef indices verified by lookup in data/tactics.json (chinese/aliases = raw, `viet` = Vietnamese): 止戈為武#242, 義心昭烈#96, 絕計折謀#370, 藏器待時#328, 夢中弒臣#94, 丹陽兵#251, 眾望所歸#246, 韜心惑敵#337, 禦敵屏障#216, 橫掃#271, 濟貧好施#174, 臨鋒決敵#214; all kind `tactic`. 桃園結義 → tactics.json#252 `tactic:dao-vien-ket-nghia`, "Kết Nghĩa Vườn Đào", kind bond→tactic: correct. Risk note (accepted): 橫掃 is an exact dictionary entry, but the source note for 甘寧漢弓 says the abbreviation may mean 橫掃千軍; mapping is global by raw string.

### Book — ACCEPT 1
兵行詭道 → Binh Hành Quỷ Đạo (books-dict#0, sourceNames contains 兵行詭道).

### statFocus — ACCEPT 60
Numbers (30/20/174/200/161/186), speed order (一/1→cao nhất, 二/2/第2→cao thứ hai, 第3→cao thứ ba, 尾→thấp nhất), 前/後 level phases ("Trước cấp 20 … sau cấp 20 …"), 各半/對半 (nửa/nửa, order of 智統 preserved), 全 (Toàn), 其餘/其它加 (còn lại) all preserved; phrasing matches existing entries (10速+智, 165速+武, 半武半統, 全智-尾速, 智最高). The three flagged by the drafter:
- `武+E387` — source defect, confirmed in pack (s20-hun-06 狗官槍, SP 關羽 副將1, note "程普的速度比SP關羽高1點"): E387 is a spreadsheet cell reference. Literal "Võ Lực +E387" is faithful; accepted, but will show a meaningless token to users — maintainer decision (alternative: translate as "Võ Lực" and drop the artifact).
- `許攸` — source defect (hero name in the stat cell, s28-0617-hun-25 孫權鼠標弓, 主將 許攸). Passes through as "Hứa Du" (heroes-dict#85); mirrors how S盾/S槍 are handled (translations + noteValues). Accepted.
- `智最低-統` — s28-0617-shu-01 法官盾, 馬岱 副將1 (note: Mã Đại's speed 1 point above Quan Vũ). Reading "Trí Lực thấp nhất đội; Thống Soái" is consistent with 智最高 → "Trí Lực cao nhất đội" and the "X-Y → X; Y" pattern of 全智-尾速. True intent is not recoverable from the source; accepted as the most consistent reading.

### Season — ACCEPT 1
PK-S20 奇門八陣 → "Kỳ Môn Bát Trận": per-character Hán-Việt, consistent with existing 八門 → Bát Môn and the source's own use of 奇門八陣 in team notes (香囊蜀槍, 太玄槍); status stays `reference-translation`. (nameRaw also changed from the older 奇兵八陣 — matches the fresh crawl.)

## Rejected / changed entries

| # | raw | current vi | proposed vi | reason |
|---|---|---|---|---|
| 59 | 核彈張曹操版 | Hạch Đạn Trương bản Tào Tháo | Hạt Nhân Trương bản Tào Tháo | Same stem as existing 核彈張 → "Hạt Nhân Trương", 核彈張角 → "Hạt Nhân Trương Giác", 核彈張遼, 核彈張飛, 法正核彈 → "Hạt Nhân" (5 of 6 existing 核彈 entries). |
| 103 | 核彈袁術 | Hạch Đạn Viên Thuật | Hạt Nhân Viên Thuật | Same 核彈+hero pattern as 核彈張飛/張遼/張角 → "Hạt Nhân …". |
| 104 | 核彈朱儁 | Hạch Đạn Chu Tuấn | Hạt Nhân Chu Tuấn | Same as above. |
| 164 | 核彈張（曹操） | Hạch Đạn Trương (Tào Tháo) | Hạt Nhân Trương (Tào Tháo) | Same stem as existing 核彈張 → "Hạt Nhân Trương". |
| 123 | 荀彧太威盾 | Tuân Úc Thái Uy Thuẫn | Tuân Úc Thái Úy Thuẫn | 太威 is a typo for 太尉 — source note describes it as "司馬懿、SP 荀彧、滿寵的太尉盾"; every other 太尉 team is "Thái Úy". "Thái Uy" is a meaningless name. (If the maintainer wants strict literal fidelity to the raw typo, keep; recommended change.) |
| 55 | 慷慨弓（孝公程普版） | Khảng Khái Cung (bản Hiếu Công, Trình Phổ) | Khảng Khái Cung (bản Trình Phổ của Hiếu Công) | 孝公 is the table author (孝公實驗室 共存第 1 隊), 程普 is the variant (甘寧/太史慈/程普 team). The comma reads as two variants; sibling entries use "(bản Trình Phổ)" and "(bản cùng tồn Hiếu Công)". |
