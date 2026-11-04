# Translation draft — Đội chuẩn names (2026-11-03)

Worksheet for an independent reviewer. Source: `/tmp/dc-pack.json` (1640 records). Files edited: `pipeline/recommended-identity-map.json`, `pipeline/recommended-display-map.json`. All new entries are `reviewStatus: translation-reviewed` (display-only, no stableId, no dedup identity effect).

Team conventions applied: Hán-Việt per character for hero/nickname abbreviations (e.g. 恪→Khác, 諸葛→Gia Cát); unit/tactic words as in existing entries (弓 Cung, 騎 Kỵ, 槍 Thương, 盾 Thuẫn, 肉 Nhục, 核彈 Hạt Nhân, 神火 Thần Hỏa, 碰瓷 → postfix "cảm tử"); ASCII brackets; `共存版` → `(bản cùng tồn X)`; `X版` → `bản X`; author nicknames transliterated (大白 Đại Bạch, 孝公 Hiếu Công, 大恐龍 Đại Khủng Long, 阿焰 A Diễm, 詩人 Thi Nhân, 小幫手 Tiểu Bang Thủ, 秋石 Thu Thạch). Items marked ⚠ need a human decision.

## Counts

| kind | added | changed |
|---|---|---|
| team | 164 | 0 |
| hero | 3 | 1 (alias on existing entry) |
| tactic | 12 | 1 (桃園結義 bond→tactic) |
| book | 1 | 0 |
| statFocus translations | 60 | 0 |
| season | 0 | 1 (PK-S20) |

Measurement note: unique unresolved team titles were 164 (390 occurrences across records+details), not 195; no scoped team entries exist in the identity map (no `sourceConfigId` entries), so no “source title mismatch” can occur.

## Teams (raw → Vietnamese; evidence `translation-review:2026-11-03:doi-chuan-draft`)

| # | raw | Vietnamese | notes |
|---|---|---|---|
| 1 | 姜夏恪 | Khương Hạ Khác |  |
| 2 | 姜太蔡（平民開荒） | Khương Thái Thái (Bình Dân Khai Hoang) |  |
| 3 | 左太恪 | Tả Thái Khác |  |
| 4 | 法克馬 | Pháp Khắc Mã |  |
| 5 | 群弓開荒 | Quần Cung Khai Hoang |  |
| 6 | 菜刀隊（夏太黃） | Thái Đao Đội (Hạ Thái Hoàng) |  |
| 7 | SP朱儁核彈弓 | SP Chu Tuấn Hạt Nhân Cung |  |
| 8 | 袁術核彈弓 | Viên Thuật Hạt Nhân Cung |  |
| 9 | 挫銳香香吳騎 | Tỏa Nhuệ Hương Hương Ngô Kỵ |  |
| 10 | 碰瓷香香吳騎 | Hương Hương Ngô Kỵ cảm tử | 碰瓷 suffix “cảm tử” per existing 碰瓷吳騎 |
| 11 | SP諸葛新蜀智 | SP Gia Cát Tân Thục Trí |  |
| 12 | 五謀弓 | Ngũ Mưu Cung |  |
| 13 | 五謀騎 | Ngũ Mưu Kỵ |  |
| 14 | 內戰皇馬槍 | Nội Chiến Hoàng Mã Thương |  |
| 15 | 打地皇馬槍 | Đả Địa Hoàng Mã Thương |  |
| 16 | 法官盾 | Pháp Quan Thuẫn |  |
| 17 | 王異騎 | Vương Dị Kỵ |  |
| 18 | 老諸葛新蜀智 | Lão Gia Cát Tân Thục Trí |  |
| 19 | 臥薪嘗膽皇馬槍 | Ngọa Tân Thường Đảm Hoàng Mã Thương |  |
| 20 | 荀攸五謀騎 | Tuân Du Ngũ Mưu Kỵ |  |
| 21 | 通用皇馬槍 | Thông Dụng Hoàng Mã Thương |  |
| 22 | SP周瑜肉弓 | SP Chu Du Nhục Cung |  |
| 23 | SP荀彧神火弓 | SP Tuân Úc Thần Hỏa Cung |  |
| 24 | SP荀彧點火弓 | SP Tuân Úc Điểm Hỏa Cung |  |
| 25 | 乘勝長驅點火弓 | Thừa Thắng Trường Khu Điểm Hỏa Cung |  |
| 26 | 兗州三勢關 | Duyện Châu Tam Thế Quan |  |
| 27 | 叔侄盾 | Thúc Điệt Thuẫn |  |
| 28 | 圓夢弓 | Viên Mộng Cung |  |
| 29 | 撫輯軍民北伐盾 | Phủ Tập Quân Dân Bắc Phạt Thuẫn |  |
| 30 | 曹真飛熊軍 | Tào Chân Phi Hùng Quân |  |
| 31 | 武鋒北伐盾 | Võ Phong Bắc Phạt Thuẫn |  |
| 32 | 潛龍周瑜呂布 | Tiềm Long Chu Du Lữ Bố |  |
| 33 | 潛龍慷慨弓 | Tiềm Long Khảng Khái Cung |  |
| 34 | 潛龍貂 | Tiềm Long Điêu |  |
| 35 | 瑜亮弓 | Du Lượng Cung |  |
| 36 | 義心昭烈神火弓 | Nghĩa Tâm Chiêu Liệt Thần Hỏa Cung |  |
| 37 | 義心昭烈麒麟弓 | Nghĩa Tâm Chiêu Liệt Kỳ Lân Cung |  |
| 38 | 義心昭烈點火弓 | Nghĩa Tâm Chiêu Liệt Điểm Hỏa Cung |  |
| 39 | 老周瑜神火弓 | Lão Chu Du Thần Hỏa Cung |  |
| 40 | 老周瑜肉弓 | Lão Chu Du Nhục Cung |  |
| 41 | 老諸葛點火弓 | Lão Gia Cát Điểm Hỏa Cung |  |
| 42 | 臥薪嘗膽孫權吳騎 | Ngọa Tân Thường Đảm Tôn Quyền Ngô Kỵ |  |
| 43 | 荀攸五謀弓 | Tuân Du Ngũ Mưu Cung |  |
| 44 | 蓄勢太尉盾 | Súc Thế Thái Úy Thuẫn |  |
| 45 | 點火弓 | Điểm Hỏa Cung |  |
| 46 | 三勢張角法正 | Tam Thế Trương Giác Pháp Chính |  |
| 47 | 二袁（孝公共存版） | Nhị Viên (bản cùng tồn Hiếu Công) |  |
| 48 | 低配馬超 | Mã Siêu cấu hình thấp | 低配 = low-spec, rendered “cấu hình thấp” as suffix |
| 49 | 八門金鎖溫侯弓 | Bát Môn Kim Tỏa Ôn Hầu Cung |  |
| 50 | 劉司馬飛熊騎 | Lưu Tư Mã Phi Hùng Kỵ |  |
| 51 | 司馬郝昭太尉盾 | Tư Mã Hác Chiêu Thái Úy Thuẫn |  |
| 52 | 吳弓 | Ngô Cung |  |
| 53 | 周瑜嘟嘟（大白共存版） | Chu Du Đô Đốc (bản cùng tồn Đại Bạch) |  |
| 54 | 太白麒麟弓 | Thái Bạch Kỳ Lân Cung |  |
| 55 | 慷慨弓（孝公程普版） | Khảng Khái Cung (bản Hiếu Công, Trình Phổ) | 孝公 = author nickname; 程普版 = Trình Phổ variant |
| 56 | 抬棺弓 | Đài Quan Cung |  |
| 57 | 抵禦弓 | Đề Ngự Cung |  |
| 58 | 朱儁群弓 | Chu Tuấn Quần Cung |  |
| 59 | 核彈張曹操版 | Hạt Nhân Trương bản Tào Tháo |  |
| 60 | 武峰袁馬槍 | Vũ Phong Viên Mã Thương |  |
| 61 | 武峰貂馬槍 | Vũ Phong Điêu Mã Thương |  |
| 62 | 武鋒SP馬超槍 | Võ Phong SP Mã Siêu Thương |  |
| 63 | 武鋒龐德 | Võ Phong Bàng Đức |  |
| 64 | 法刀 | Pháp Đao |  |
| 65 | 法敦敦（孝公共存版） | Pháp Đôn Đôn (bản cùng tồn Hiếu Công) |  |
| 66 | 程昱五謀騎 | Trình Dục Ngũ Mưu Kỵ |  |
| 67 | 群弓（大白共存版） | Quần Cung (bản cùng tồn Đại Bạch) |  |
| 68 | 義心昭烈閉月弓 | Nghĩa Tâm Chiêu Liệt Bế Nguyệt Cung |  |
| 69 | 義心昭烈閉月盾 | Nghĩa Tâm Chiêu Liệt Bế Nguyệt Thuẫn |  |
| 70 | 義心蜀智 SP 諸葛版（大恐龍共存版） | Nghĩa Tâm Thục Trí bản SP Gia Cát (bản cùng tồn Đại Khủng Long) | SP 諸葛 inside name rendered “bản SP Gia Cát” |
| 71 | 義心蜀智（大恐龍共存版） | Nghĩa Tâm Thục Trí (bản cùng tồn Đại Khủng Long) |  |
| 72 | 臥薪嘗膽溫侯弓 | Ngọa Tân Thường Đảm Ôn Hầu Cung |  |
| 73 | 荀攸五謀（大恐龍共存版） | Tuân Du Ngũ Mưu (bản cùng tồn Đại Khủng Long) |  |
| 74 | 袁術爆發弓 | Viên Thuật Bạo Phát Cung |  |
| 75 | 賈太尉 | Giả Thái Úy |  |
| 76 | 關關張（大白共存版） | Quan Quan Trương (bản cùng tồn Đại Bạch) |  |
| 77 | SP關羽洞察槍 | SP Quan Vũ Động Sát Thương |  |
| 78 | 三勢張角飛熊騎 | Tam Thế Trương Giác Phi Hùng Kỵ |  |
| 79 | 太史慈鼠標弓 | Thái Sử Từ Thử Tiêu Cung |  |
| 80 | 奇門連環槍 | Kỳ Môn Liên Hoàn Thương |  |
| 81 | 孫權鼠標弓 | Tôn Quyền Thử Tiêu Cung |  |
| 82 | 張角飛熊 | Trương Giác Phi Hùng |  |
| 83 | 控制型溫侯弓 | Ôn Hầu Cung kiểu khống chế | 控制型 → “kiểu khống chế” suffix |
| 84 | 暴力騎 | Bạo Lực Kỵ |  |
| 85 | 潛龍象 | Tiềm Long Tượng |  |
| 86 | 關羽洞察槍 | Quan Vũ Động Sát Thương |  |
| 87 | 三勢呂呂夏黃 | Tam Thế Lữ Lữ Hạ Hoàng |  |
| 88 | 三勢呂呂太黃 | Tam Thế Lữ Lữ Thái Hoàng |  |
| 89 | 三勢呂郭周 | Tam Thế Lữ Quách Chu |  |
| 90 | 張角群弓 | Trương Giác Quần Cung |  |
| 91 | 張角骨頭盾 | Trương Giác Cốt Đầu Thuẫn |  |
| 92 | 虛弱盾劉魏張 | Hư Nhược Thuẫn Lưu Ngụy Trương |  |
| 93 | 虛弱盾劉魏關 | Hư Nhược Thuẫn Lưu Ngụy Quan |  |
| 94 | 鋒矢張角盾 | Phong Thỉ Trương Giác Thuẫn |  |
| 95 | 魏延洞察槍 | Ngụy Diên Động Sát Thương |  |
| 96 | 三勢弓 | Tam Thế Cung |  |
| 97 | 固傷弓 | Cố Thương Cung |  |
| 98 | 摩卡弓 | Ma Ca Cung |  |
| 99 | 武鋒呂妹 | Võ Phong Lữ Muội |  |
| 100 | 武鋒華雄 | Võ Phong Hoa Hùng |  |
| 101 | 降維弓 | Giáng Duy Cung |  |
| 102 | 馬法恪 | Mã Pháp Khác |  |
| 103 | 核彈袁術 | Hạt Nhân Viên Thuật |  |
| 104 | 核彈朱儁 | Hạt Nhân Chu Tuấn |  |
| 105 | 碰瓷呂（秋石天梯版） | Lữ cảm tử (bản thang xếp hạng Thu Thạch) | 碰瓷 → cảm tử; 天梯 = ladder |
| 106 | 馬岱法關盾（小幫手首發版） | Mã Đại Pháp Quan Thuẫn (bản đầu tiên của Tiểu Bang Thủ) |  |
| 107 | 五謀臣（阿焰共存版） | Ngũ Mưu Thần (bản cùng tồn A Diễm) |  |
| 108 | 拒馬弓（阿焰共存版） | Cự Mã Cung (bản cùng tồn A Diễm) |  |
| 109 | 皇馬槍（阿焰共存版） | Hoàng Mã Thương (bản cùng tồn A Diễm) |  |
| 110 | 皇馬弓（小幫手首發版） | Hoàng Mã Cung (bản đầu tiên của Tiểu Bang Thủ) |  |
| 111 | 內戰皇馬槍（小幫手首發版） | Nội Chiến Hoàng Mã Thương (bản đầu tiên của Tiểu Bang Thủ) |  |
| 112 | 劉備法關盾（小幫手首發版） | Lưu Bị Pháp Quan Thuẫn (bản đầu tiên của Tiểu Bang Thủ) |  |
| 113 | 五謀騎（小幫手首發版） | Ngũ Mưu Kỵ (bản đầu tiên của Tiểu Bang Thủ) |  |
| 114 | 潛龍陸遜 | Tiềm Long Lục Tốn |  |
| 115 | 劉備法官盾 | Lưu Bị Pháp Quan Thuẫn |  |
| 116 | 荀彧女王盾 | Tuân Úc Nữ Vương Thuẫn |  |
| 117 | 荀攸五謀 | Tuân Du Ngũ Mưu |  |
| 118 | 蜀智盾 | Thục Trí Thuẫn |  |
| 119 | 諸葛法官盾 | Gia Cát Pháp Quan Thuẫn |  |
| 120 | 馬岱法官盾 | Mã Đại Pháp Quan Thuẫn |  |
| 121 | 嘟統弓（小幫手首發版） | Đô Thống Cung (bản đầu tiên của Tiểu Bang Thủ) |  |
| 122 | 程普嘟嘟弓 | Trình Phổ Đô Đốc Cung |  |
| 123 | 荀彧太威盾 | Tuân Úc Thái Úy Thuẫn (Main correction) |  |
| 124 | 北伐盾（小幫手首發版） | Bắc Phạt Thuẫn (bản đầu tiên của Tiểu Bang Thủ) |  |
| 125 | 左呂槍（小幫手首發版） | Tả Lữ Thương (bản đầu tiên của Tiểu Bang Thủ) |  |
| 126 | 控制槍 | Khống Chế Thương |  |
| 127 | 閉月盾（小幫手首發版） | Bế Nguyệt Thuẫn (bản đầu tiên của Tiểu Bang Thủ) |  |
| 128 | 麒麟弓（小幫手首發版） | Kỳ Lân Cung (bản đầu tiên của Tiểu Bang Thủ) |  |
| 129 | 吳騎（詩人共存版） | Ngô Kỵ (bản cùng tồn Thi Nhân) |  |
| 130 | 太尉盾（詩人共存版） | Thái Úy Thuẫn (bản cùng tồn Thi Nhân) |  |
| 131 | 太尉盾（阿焰共存版） | Thái Úy Thuẫn (bản cùng tồn A Diễm) |  |
| 132 | 權騎 | Quyền Kỵ |  |
| 133 | 漢室弓（詩人共存版） | Hán Thất Cung (bản cùng tồn Thi Nhân) |  |
| 134 | 皇馬（詩人共存版） | Hoàng Mã (bản cùng tồn Thi Nhân) |  |
| 135 | 群弓（小幫手首發版） | Quần Cung (bản đầu tiên của Tiểu Bang Thủ) |  |
| 136 | 群弓（詩人共存版） | Quần Cung (bản cùng tồn Thi Nhân) |  |
| 137 | 荀攸五謀（詩人共存版） | Tuân Du Ngũ Mưu (bản cùng tồn Thi Nhân) |  |
| 138 | 關關張（小幫手首發版） | Quan Quan Trương (bản đầu tiên của Tiểu Bang Thủ) |  |
| 139 | 北伐槍（阿焰共存版） | Bắc Phạt Thương (bản cùng tồn A Diễm) |  |
| 140 | 甘寧漢弓 | Cam Ninh Hán Cung |  |
| 141 | 傳子弓 | Truyền Tử Cung |  |
| 142 | 桃園盾（阿焰共存版） | Đào Viên Thuẫn (bản cùng tồn A Diễm) |  |
| 143 | 武鋒關羽盾 | Võ Phong Quan Vũ Thuẫn |  |
| 144 | 神火弓（呂蒙版） | Thần Hỏa Cung (bản Lữ Mông) |  |
| 145 | 神火弓（程普版） | Thần Hỏa Cung (bản Trình Phổ) |  |
| 146 | 形一肉弓（程普版） | Hình Nhất Nhục Cung (bản Trình Phổ) |  |
| 147 | 新都督 | Tân Đô Đốc |  |
| 148 | 新都督（呂蒙版） | Tân Đô Đốc (bản Lữ Mông) |  |
| 149 | 新都督（程普版） | Tân Đô Đốc (bản Trình Phổ) |  |
| 150 | 曹真太尉盾 | Tào Chân Thái Úy Thuẫn |  |
| 151 | 老都督 | Lão Đô Đốc |  |
| 152 | 香囊蜀槍 | Hương Nang Thục Thương |  |
| 153 | 五雷閉月盾 | Ngũ Lôi Bế Nguyệt Thuẫn |  |
| 154 | 肉遼騎 | Nhục Liêu Kỵ |  |
| 155 | 陸遜吳槍（呂蒙版） | Lục Tốn Ngô Thương (bản Lữ Mông) |  |
| 156 | 陸遜吳槍（程普版） | Lục Tốn Ngô Thương (bản Trình Phổ) |  |
| 157 | 陸遜肉弓（程普版） | Lục Tốn Nhục Cung (bản Trình Phổ) |  |
| 158 | 骨盾 | Cốt Thuẫn |  |
| 159 | 蒙寵弓 | Mông Sủng Cung |  |
| 160 | 武鋒趙雲 | Võ Phong Triệu Vân |  |
| 161 | 嚇豹騎 | Hách Báo Kỵ |  |
| 162 | 太玄槍 | Thái Huyền Thương |  |
| 163 | 嚇狗騎 | Hách Cẩu Kỵ |  |
| 164 | 核彈張（曹操） | Hạt Nhân Trương (Tào Tháo) |  |

Author-nickname bracket tokens (reviewer please confirm transliteration vs. translation): 小幫手首發版 → “bản đầu tiên của Tiểu Bang Thủ” ⚠; 共存版 → “bản cùng tồn” (project term for coexist).

## Heroes

| raw | Vietnamese | evidenceRef |
|---|---|---|
| 龐德 | Bàng Đức | data/heroes-dict.json#41 (龐德 → Bàng Đức) |
| SP 劉曄 | SP Lưu Diệp | data/heroes-dict.json#176 (SP 劉曄 → SP Lưu Diệp) |
| 曹真 | Tào Chân | data/heroes-dict.json#236 (曹真 → Tào Chân) |
| 無雙星彩 | CO Vô Song Tinh Thái | alias added to existing entry `無雙 星彩` (evidence `user-confirmed:無雙 星彩=CO Vô Song Tinh Thái`); data/heroes-dict.json#124 gives “CO Tinh Thái” but docs/season-team-data.md keeps “Vô Song” for the three CO names ⚠ |

## Tactics

| raw | Vietnamese | evidenceRef |
|---|---|---|
| 止戈為武 | Chỉ Qua Vi Vũ | tactics.json#242 |
| 義心昭烈 | Nghĩa Tâm Chiêu Liệt | tactics.json#96 |
| 絕計折謀 | Tuyệt Kế Chiết Mưu | tactics.json#370 |
| 藏器待時 | Tàng Khí Đãi Thì | tactics.json#328 |
| 夢中弒臣 | Mộng Trung Thí Thần | tactics.json#94 |
| 丹陽兵 | Lính Đan Dương | tactics.json#251 |
| 眾望所歸 | Đích Đến Cuối Cùng | tactics.json#246 |
| 韜心惑敵 | Che Giấu Tâm Tư | tactics.json#337 |
| 禦敵屏障 | Ngự Địch Bình Chướng | tactics.json#216 |
| 橫掃 | Quét Sạch | tactics.json#271 |
| 濟貧好施 | Cách Hay Cứu Trợ | tactics.json#174 |
| 臨鋒決敵 | Lâm Phong Quyết Địch | tactics.json#214 |
| 桃園結義 | Kết Nghĩa Vườn Đào | CHANGED kind `bond`→`tactic`; evidenceRef now `tactics.json#252` (tactic:dao-vien-ket-nghia). `resolve_display_kind` now returns `tactic` (verified), so the 13 holder slots in 5 PK-S27 teams stop showing “Duyên phận” and render as normal tactic tags with Lookup links. |

Notes: 橫掃 is an exact dictionary entry (Quét Sạch, tactics.json#271) although the source note says it is ambiguous with 橫掃千軍; 丹陽兵 exact (#251). 眾望所歸/韜心惑敵/濟貧好施 use the dictionary `viet` field (not hanViet), per existing practice.

## Books

| raw | Vietnamese | evidenceRef |
|---|---|---|
| 兵行詭道 | Binh Hành Quỷ Đạo | books-dict.json#0 (sourceNames 兵行詭道) |

(`兵行詭道` is the traditional form of dictionary `兵行诡道`; 4 occurrences.)

## statFocus translations (added to `statFocus.translations`)

| raw | Vietnamese |
|---|---|
| 智 | Trí Lực |
| 武 | Võ Lực |
| 統 | Thống Soái |
| 30速+智 | Cộng 30 điểm Tốc Độ, còn lại Trí Lực |
| 加30速+智 | Cộng 30 điểm Tốc Độ, còn lại Trí Lực |
| +20速+武 | Cộng 20 điểm Tốc Độ, còn lại Võ Lực |
| 加20速+武 | Cộng 20 điểm Tốc Độ, còn lại Võ Lực |
| 一速武 | Tốc Độ cao nhất đội, còn lại Võ Lực |
| 一速+武 | Tốc Độ cao nhất đội, còn lại Võ Lực |
| 一速＋武 | Tốc Độ cao nhất đội, còn lại Võ Lực |
| 一速＋武力 | Tốc Độ cao nhất đội, còn lại Võ Lực |
| 一速+統 | Tốc Độ cao nhất đội, còn lại Thống Soái |
| 一速統 | Tốc Độ cao nhất đội, còn lại Thống Soái |
| 一速+智 | Tốc Độ cao nhất đội, còn lại Trí Lực |
| 一速＋智 | Tốc Độ cao nhất đội, còn lại Trí Lực |
| 一速智 | Tốc Độ cao nhất đội, còn lại Trí Lực |
| 二速+統 | Tốc Độ cao thứ hai đội, còn lại Thống Soái |
| 二速統 | Tốc Độ cao thứ hai đội, còn lại Thống Soái |
| 二速+武 | Tốc Độ cao thứ hai đội, còn lại Võ Lực |
| 二速智 | Tốc Độ cao thứ hai đội, còn lại Trí Lực |
| 速最高+統 | Tốc Độ cao nhất đội, còn lại Thống Soái |
| 速最高+智 | Tốc Độ cao nhất đội, còn lại Trí Lực |
| 速最高<br>其它加智 | Tốc Độ cao nhất đội, còn lại Trí Lực |
| 第1速+智 | Tốc Độ cao nhất đội, còn lại Trí Lực |
| 第1速+統 | Tốc Độ cao nhất đội, còn lại Thống Soái |
| 第1速+武 | Tốc Độ cao nhất đội, còn lại Võ Lực |
| 第2速+智 | Tốc Độ cao thứ hai đội, còn lại Trí Lực |
| 第2速+武 | Tốc Độ cao thứ hai đội, còn lại Võ Lực |
| 第3速+武 | Tốc Độ cao thứ ba đội, còn lại Võ Lực |
| 尾速+統 | Tốc Độ thấp nhất đội, còn lại Thống Soái |
| 尾速智 | Tốc Độ thấp nhất đội, còn lại Trí Lực |
| 速 | Tốc Độ |
| 速度 | Tốc Độ |
| 速智 | Tốc Độ và Trí Lực |
| 速＋智 | Tốc Độ và Trí Lực |
| 速度＋智力 | Tốc Độ và Trí Lực |
| 速統 | Tốc Độ và Thống Soái |
| 速度＋武力 | Tốc Độ và Võ Lực |
| 武力＋速度 | Võ Lực và Tốc Độ |
| 統率＋智力 | Thống Soái và Trí Lực |
| 統率、一速 | Thống Soái; Tốc Độ cao nhất đội |
| 武力、二速 | Võ Lực; Tốc Độ cao thứ hai đội |
| 武最高 | Võ Lực cao nhất đội |
| 全隊智力最高 | Trí Lực cao nhất đội |
| 智最低-統 | Trí Lực thấp nhất đội; Thống Soái |
| 統智各半 | Nửa Thống Soái, nửa Trí Lực |
| 統<br>智 | Thống Soái / Trí Lực |
| 174速+武 | Tốc Độ đạt 174, còn lại Võ Lực |
| 200速+武 | Tốc Độ đạt 200, còn lại Võ Lực |
| 161 速＋武 | Tốc Độ đạt 161, còn lại Võ Lực |
| 186 速＋武 | Tốc Độ đạt 186, còn lại Võ Lực |
| 2 速，其餘全武 | Tốc Độ cao thứ hai đội, còn lại Võ Lực |
| 1 速，其餘全武 | Tốc Độ cao nhất đội, còn lại Võ Lực |
| 20 級前一速統、20 級後一速智 | Trước cấp 20: Tốc Độ cao nhất đội, còn lại Thống Soái; sau cấp 20: Tốc Độ cao nhất đội, còn lại Trí Lực |
| 20 級前統、20 級後智 | Trước cấp 20: Thống Soái; sau cấp 20: Trí Lực |
| 20 級前統率、20 級後智力 | Trước cấp 20: Thống Soái; sau cấp 20: Trí Lực |
| 20 級前全統、20 級後智力 | Trước cấp 20: Toàn Thống Soái; sau cấp 20: Trí Lực |
| 20 級前統、20 級後智統對半 | Trước cấp 20: Thống Soái; sau cấp 20: nửa Trí Lực, nửa Thống Soái |
| 許攸 | Hứa Du |
| 武+E387 | Võ Lực +E387 |

⚠ `許攸` (hero name used as a stat value; added to `noteValues`, shown “Hứa Du” from heroes-dict.json#85) and `武+E387` (spreadsheet cell-reference artifact, kept literally as “Võ Lực +E387”) are source data defects; `智最低-統` meaning uncertain. Level-phase patterns use “Trước cấp 20: …; sau cấp 20: …”.

## Season

| id | change |
|---|---|
| pk-s20 | nameRaw 奇兵八陣 → 奇門八陣; displayNameVi “Kỳ Binh Bát Trận” → “Kỳ Môn Bát Trận” (no existing project name found; status stays `reference-translation`) |

PK-S27 漢焰長明 left as `reference-translation`: per docs/season-team-data.md `existing-project-name` means a name already in the project (season-registry), and the docs state tên mùa bổ sung is “not confirmation of an official name”; the official fanpage name already matches the displayed “Hán Diễm Trường Minh”, so no display change. Switching status would also need an evidenceRef other than the registry; left for the maintainer.

## Tactic slots added by user decision 2026-11-03 (user-confirmed)

User decided 2026-11-03: 10 display-only `tactic` entries, `translation-reviewed`, no stableId, evidenceRef `user-confirmed:2026-11-03:<raw>=<vi>`; the shorthands are transliterated literally and NOT linked to any dictionary tactic. Verified with `createLookupIdResolver.tactic(raw, vi)` over data/tactics.json: all 10 return null, so no Tra cứu link is created, and `createTacticDisplayName` leaves the names unchanged.

Placeholders: `—` (120 slot occurrences) and empty strings are source placeholders; existing builder yields no Vietnamese name and the renderer drops the slot (js/recommended-reference-render.js:41). Not mapped.

### 守望相助 → Thủ Vọng Tương Trợ (user-confirmed)
- occurrences: 24 slot rows (records+details), 12 unique (config, holder)
- source note(s): 「守望相助」是九州兵興新戰法，本站資料庫尚未收錄; 「守望相助」是九州兵興新戰法，本站資料庫尚未收錄；原表簡稱「守望」；曹操轉漢陣營; 「守望相助」是九州兵興新戰法，本站資料庫尚未收錄；大恐龍共存版另寫「文武」，對不到唯一戰法，待確認; 奇計良謀 要用九州兵興劇本戰法「治·奇計良謀」；「守望相助」是九州兵興新戰法，本站資料庫尚未收錄；裝備：弓寶; 義心昭烈 要用九州兵興劇本戰法「治·義心昭烈」；「守望相助」是九州兵興新戰法，本站資料庫尚未收錄；裝備：弓寶物; 義心昭烈 要用九州兵興劇本戰法「治·義心昭烈」；原表標「異化」；「守望相助」是九州兵興新戰法，本站資料庫尚未收錄
- best dictionary candidate: — (no dictionary match)
- Hán-Việt transliteration (pipeline.hanviet.transliterate): Thủ Vọng Tương Trợ
- teams:
  - s28-0617-shu-01 | 法官盾 | SP 法正
  - s28-0617-shu-02 | 老諸葛新蜀智 | SP 法正
  - s28-0617-shu-05 | SP諸葛新蜀智 | SP 諸葛亮
  - s28-0617-wei-31 | 曹仁太尉盾 | 滿寵
  - s28-0617-wu-01 | SP荀彧點火弓 | SP 周瑜
  - s28-0617-wu-05 | SP荀彧神火弓 | SP 荀彧
  - s28-bianzhong-taiwei | 女王盾 | 滿寵
  - s28-lp-dkl-yixin-shuzhi | 義心蜀智（大恐龍共存版） | 諸葛亮
  - s28-lp-dkl-yixin-shuzhi-sp | 義心蜀智 SP 諸葛版（大恐龍共存版） | SP 諸葛亮
  - s28-lp-xg-fa-dundun | 法敦敦（孝公共存版） | 曹操
  - s28-shishi-dudu-gong | 義心昭烈神火弓 | SP 呂蒙
  - s28-zanbi-qilin | 太白麒麟弓 | 姜維

### 鑑時審勢 → Giám Thời Thẩm Thế (user-confirmed)
- occurrences: 16 slot rows (records+details), 8 unique (config, holder)
- source note(s): 「鑑時審勢」是九州兵興新戰法，本站資料庫尚未收錄; 「鑑時審勢」是九州兵興新戰法，本站資料庫尚未收錄；原表寫「靈機一動/嬰城自守」二擇一
- best dictionary candidate: — (no dictionary match)
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '鑑' trong '鑑時審勢'
- teams:
  - s28-0617-wei-02 | 荀攸五謀騎 | SP 荀彧
  - s28-0617-wei-03 | 王異騎 | SP 荀彧
  - s28-0617-wei-04 | 五謀弓 | SP 荀彧
  - s28-0617-wei-05 | 荀攸五謀騎 | SP 荀彧
  - s28-0617-wei-07 | 荀攸五謀弓 | 荀攸
  - s28-fugui-qi | 五謀騎 | SP 荀彧
  - s28-lp-dkl-xunyou-wumou | 荀攸五謀（大恐龍共存版） | 賈詡
  - s28-wumou-chen | 程昱五謀騎 | SP 荀彧

### 衡軛陣 → Hành Ách Trận (user-confirmed)
- occurrences: 4 slot rows (records+details), 2 unique (config, holder)
- source note(s): 衡軛陣為本劇本新陣法，圖鑑暫無
- best dictionary candidate: — (no dictionary match; source calls it a new formation)
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '衡' trong '衡軛陣'
- teams:
  - s27-chengpu-dudu-gong | 程普嘟嘟弓 | 程普
  - s27-lp-biyue-dun | 閉月盾（小幫手首發版） | 左慈

### 板楯虎盾 → Bản Thuẫn Hổ Thuẫn (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「板楯虎盾」照原圖，本站資料庫查無此戰法，待確認
- best dictionary candidate: — (no dictionary match)
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '板' trong '板楯虎盾'
- teams:
  - s20-qun-06 | 五雷閉月盾 | 貂蟬

### 焚營 → Phần Doanh (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「焚營」為原表簡稱，圖鑑查無此名（最接近的是焚輜營壘），待確認
- best dictionary candidate: 焚輜營壘 → Thiêu Đốt Doanh Lũy (data/tactics.json, chinese 焚輜營壘); source itself says closest, unconfirmed
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '營' trong '焚營'
- teams:
  - s27-hedan-zhujun | 核彈朱儁 | 袁術

### 千里 → Thiên Lý (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「千里」為原表簡稱，待確認（圖鑑有千里走單騎、千里馳援、千里饋糧）
- best dictionary candidate: 千里走單騎 → Cưỡi Ngựa Nghìn Dặm (tactics.json#25); 千里馳援 → Thiên Lý Trì Viện (#343); 千里饋糧 per source note — ambiguous
- Hán-Việt transliteration (pipeline.hanviet.transliterate): Thiên Lý
- teams:
  - s27-lp-beifa-qiang | 北伐槍（阿焰共存版） | 關興

### 鬼神 → Quỷ Thần (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「鬼神」為原表簡稱，待確認（圖鑑有鬼神霆威、鬼神之女）
- best dictionary candidate: 鬼神霆威 → Quỷ Thần Đình Uy (tactics.json#120); 鬼神之女 → Quỷ Thần Chi Nữ (#322) — ambiguous
- Hán-Việt transliteration (pipeline.hanviet.transliterate): Quỷ Thần
- teams:
  - s27-chuanzi-gong | 傳子弓 | 孫權

### 錦帆 → Cẩm Phàm (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「錦帆」為原表簡稱，待確認（圖鑑有錦帆軍、錦帆百翎）
- best dictionary candidate: 錦帆軍 → Quân Cẩm Phàm (#117); 錦帆百翎 → Cẩm Phàm Bách Linh (#27) — ambiguous
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '錦' trong '錦帆'
- teams:
  - s27-chuanzi-gong | 傳子弓 | 孫尚香

### 陷陣 → Hãm Trận (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「陷陣」為原表簡稱，待確認（圖鑑有陷陣營、登鋒陷陣、陷陣突襲）
- best dictionary candidate: 陷陣營 → Hãm Trận Doanh (#53); 登鋒陷陣 → Đăng Phong Hãm Trận (#200); 陷陣突襲 → Tập Kích Trận Địa (#54) — ambiguous
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '陣' trong '陷陣'
- teams:
  - s27-lp-taoyuan-dun-ay | 桃園盾（阿焰共存版） | 劉備

### 絕道 → Tuyệt Đạo (user-confirmed)
- occurrences: 2 slot rows (records+details), 1 unique (config, holder)
- source note(s): 「絕道」為原表簡稱，待確認（圖鑑查無，可能是絕其汲道）
- best dictionary candidate: 絕其汲道 → Tuyệt Kỳ Cấp Đạo (data/tactics.json); source says "possibly 絕其汲道", unconfirmed
- Hán-Việt transliteration (pipeline.hanviet.transliterate): (missing chars) Ký tự ngoài bảng phiên âm: '絕' trong '絕道'
- teams:
  - s27-lp-taoyuan-dun-ay | 桃園盾（阿焰共存版） | 關羽

