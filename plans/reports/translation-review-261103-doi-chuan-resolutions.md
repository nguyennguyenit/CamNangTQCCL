# Translation review resolutions — Đội chuẩn 2026-11-03

Input: `.cache/review/rejections.json` (255 items rejected by 37 independent reviewers). Output: `.cache/review/resolutions.json` (255 entries `{entityId, fieldPath, decision, textVi, reason}`).

## Rule table (applied uniformly; override individual reviewer opinions)

| # | Rule | Examples decided |
|---|---|---|
| 1 | Recommended/data notes: slot name on same team = `nameGlossary`; else identity map display (`build_display_mapping`/`resolve_*`); else tactics/heroes/books dict/lookup-catalog; else one consistent Hán-Việt form | SP 皇甫嵩 = SP Hoàng Phổ Tung; 熯天熾地 = Hãn Thiên Sí Địa (reviewer 'Lửa Cháy Ngùn Ngụt' rejected); 拓濟世救貧 = Thác · Cách Hay Cứu Trợ (user-confirmed); 嘟嘟弓 = Đô Đốc Cung (not 'Cung Đô Đô'); 洞察 = Động Sát; 號令 = Hiệu Linh |
| 2 | Lookup items follow Lookup dictionaries; text verbatim from the Global VN client capture is official (keep) and a ledger text that differs from the capture is fixed to the capture | troop-mod/option texts replaced wholesale by `lookup-client-tactics.json` `troopMods` (build `_apply_client_troop_mods`) → fixed to client wording (e.g. 'Chuyển.Cung', 'Cung Cong', 'Kế Tận'); `exchangeConditionVi`/`effectTypeVi` of client-captured tactics → client text. Ledger-translated revision histories (`effectViet`, `conflictsVi`, `acquiredFromVi`) are not client text → dictionary terms (Động sát, Kế cùng, Tước vũ khí, Kháng cự, Tan tác, Phản Loạn, thống suất, hút máu binh khí; heroes-dict names) |
| 3 | Abbreviation unique in the authority → full name; literal short form only if source marks it a shorthand or mapping ambiguous | 草船→Thuyền Cỏ Mượn Tên, 刮骨→Cắt Xương Trị Độc, 威謀→Uy Mưu Vô Địch, 盛氣→Thịnh Khí Linh Địch, 暫避→Tạm Lánh Sóng Gió, 藤甲/軍民→Lính Giáp Mây/An Ủi Quân Dân |
| 4 | Team names in prose = glossary/identity-map team title; paraphrase is a fix | Ngũ Hổ Thương, Nhục Cung, Thục Thuẫn, Đào Viên Thuẫn, Thái Úy Thuẫn, Thần Hỏa Thuẫn, Quần Cung, Đẳng Phong Hùng, Pháp Quan Thuẫn, Thiên Công Thuẫn |
| 5 | Remove added explanation / 'Lưu ý' / bracket comment not in source; fix wrong meaning/subject/number; variant prefixes `Trị · `, `Thác · `, `Chuyển · `, `Tinh · ` (client text excepted) | all '[nguồn bị lỗi…]', 'Lưu ý: …', 'cấu máu', '(miễn nhiễm …)' removals |
| 6 | Pure style/capitalisation where current is a valid project form → keep | see keep list |

## Counts

| domain | fix | keep | total |
|---|---|---|---|
| recommended | 161 | 9 | 170 |
| lookup | 80 | 2 | 82 |
| data | 3 | 0 | 3 |
| **total** | **244** | **11** | **255** |

## Decisions 'keep' (with reason)

- `recommended:s-5087770b809522eb7ac0bdeb95fb4fb77c751b046d30c908ed17bbffca91312b/yxms-001-賈詡太史慈死士` `displayNotes.blocks.p-1.textRaw` [recommended] (#21): Văn bản hiện tại đã đúng (không chứa 'cấu máu' như reviewer nêu); không cần sửa.
- `recommended:s-656d382a572c2f2ae5253747cf9ec9d9f70d1dc9b0eafa4de612fa388cea277a/s27-lp-taiwei-dun-sr` `displayNotes.blocks.p-1.textRaw` [recommended] (#49): 熯天熾地 = Hãn Thiên Sí Địa theo identity map (hiển thị trong ghi chú Recommended); bác đề xuất 'Lửa Cháy Ngùn Ngụt'.
- `recommended:s-656d382a572c2f2ae5253747cf9ec9d9f70d1dc9b0eafa4de612fa388cea277a/s27-lp-taiwei-dun-sr` `displayNotes.blocks.p-2.textRaw` [recommended] (#50): 熯天熾地 = Hãn Thiên Sí Địa theo identity map; bác đề xuất 'Lửa Cháy Ngùn Ngụt'.
- `recommended:s-b21fc616cf596a0cec9788fd858d5808c0f0bfb009129642837911a16e11a17d/s25-dongcha-qiang` `displayNotes.blocks.p-1.textRaw` [recommended] (#60): 洞察 = Động Sát là dạng thống nhất trong các ghi chú cùng loại (không có alias identity map; 'Quan Sát' là từ client Lookup, không áp dụng cho ghi chú Recommended).
- `recommended:s-bf1c362e813a99325ec75ef411b988bf08154904d48c6ea713e3cbb92f1fbbe1/s28-0617-hun-11` `displayNotes.blocks.p-1.textRaw` [recommended] (#68): SP 皇甫嵩 = SP Hoàng Phổ Tung theo identity map; bác đề xuất 'Hoàng Phủ Tung'.
- `recommended:s-bf1c362e813a99325ec75ef411b988bf08154904d48c6ea713e3cbb92f1fbbe1/s28-0617-hun-12` `displayNotes.blocks.p-1.textRaw` [recommended] (#69): SP 皇甫嵩 = SP Hoàng Phổ Tung theo identity map; bác đề xuất 'Hoàng Phủ Tung'.
- `recommended:s-bf1c362e813a99325ec75ef411b988bf08154904d48c6ea713e3cbb92f1fbbe1/s28-yuan-qi` `displayNotes.blocks.p-1.textRaw` [recommended] (#71): Nguồn viết 治軍臥薪嘗膽 (Trị Quân + chiến pháp), cùng dạng 'Trị Quân X' như các mục 68-70; không phải tiền tố biến thể 治·; mục p-2 là mục riêng.
- `recommended:s-cd197a9c1144a36694da6d3286981ab346a2d146670dfcbba1fedc382150b3f6/team-c981ox` `displayNotes.blocks.p-1.textRaw` [recommended] (#115): 號令 = Hiệu Linh theo lookup-catalog (draft consistency pass); 核彈張 đã là Hạt Nhân Trương trong p-1.
- `recommended:s-cd197a9c1144a36694da6d3286981ab346a2d146670dfcbba1fedc382150b3f6/team-fp79c` `displayNotes.blocks.p-4.textRaw` [recommended] (#121): 拓濟世救貧 = Thác · Cách Hay Cứu Trợ (identity map, user-confirmed); bác đề xuất 'Tế Thế Cứu Bần'.
- `troop-mod:cam-pham-quan` `suggestedBuildVi` [lookup] (#217): Nguồn 叛逃 = Phản Loạn (conflictsVi hiện hành); bác đề xuất 'đào ngũ'. Văn bản hiện tại là dạng dự án hợp lệ (suggestedBuild không có trong capture client).
- `troop-mod:giai-phien-ve` `appliesToVi` [lookup] (#219): Văn bản hiện tại đã đúng 'Hoàng Mã Thương, Hoàng Mã Kỵ' (reviewer nêu lỗi 'Thương Hoàng Mã' không có trong text).

## Lookup items changed (require Lookup re-promotion)

80 items:

- `advisor:minh-the-thu-ngu` `usageVi`
- `building-level:dan-cu:10` `effectVi`
- `building-level:dan-cu:20` `effectVi`
- `building-level:dien-vo-truong:1` `effectVi`
- `building-level:phat-moc-truong:10` `effectVi`
- `building-level:quan-vuong-dien:1` `effectVi`
- `building-level:tam-phong-dai:1` `effectVi`
- `equipment-special:dot-tien` `descriptionVi`
- `equipment-special:gian-hung` `descriptionVi`
- `equipment-special:huyen-dieu` `descriptionVi`
- `equipment-special:man-luc` `descriptionVi`
- `hero:co-lu-linh-y` `roleTagViet`
- `hero:gia-hu` `lookup.exclusiveTitleVi`
- `hero:hac-chieu` `lookup.usageVi`
- `hero:lo-tuc` `lookup.exclusiveTitleVi`
- `hero:truong-xuan-hoa` `lookup.usageVi`
- `tactic:bach-y-do-giang` `lookup.conflictsVi`
- `tactic:co-giam-tien-thuc` `effectViet`
- `tactic:ham-tran-dot-tap` `effectViet`
- `tactic:ho-gia-du-am` `effectViet`
- `tactic:ho-si` `effectViet`
- `tactic:hoa-si-nguyen-lieu` `lookup.exchangeConditionVi`
- `tactic:huy-binh-muu-thang` `lookup.conflictsVi`
- `tactic:huy-quan-ket-tran` `lookup.effectTypeVi`
- `tactic:kien-cuong-chi-hoa` `effectViet`
- `tactic:lo-mang` `effectViet`
- `tactic:mau-gianh-loi-the` `effectViet`
- `tactic:minh-sat-thu-hao` `lookup.acquiredFromVi`
- `tactic:nam-gai-nem-mat` `lookup.acquiredFromVi`
- `tactic:nhan-hanh-tran` `lookup.acquiredFromVi`
- `tactic:nhat-ky-duong-thien` `lookup.acquiredFromVi`
- `tactic:nhuc-than-thiet-bich` `effectViet`
- `tactic:pha-tran-thoi-kien` `lookup.acquiredFromVi`
- `tactic:phong-mang-tat-lo` `effectViet`
- `tactic:phu-menh-tu-lap` `effectViet`
- `tactic:si-tranh-tien-pho` `lookup.acquiredFromVi`
- `tactic:su-tu-phan-tan` `lookup.acquiredFromVi`
- `tactic:tai-bien-co-tiep` `effectViet`
- `tactic:thien-ha-vo-song` `lookup.acquiredFromVi`
- `tactic:thuy-hue-van-vat` `effectViet`
- `tactic:thuy-tam-van-vat` `effectViet`
- `tactic:yen-nhan-bao-hao` `effectViet`
- `troop-mod:bach-nhi-binh` `appliesToVi`
- `troop-mod:cam-pham-quan` `effectVi`
- `troop-mod:dai-kich-si` `appliesToVi`
- `troop-mod:ho-ve-quan` `effectVi`
- `troop-mod:thanh-chau-binh` `appliesToVi`
- `troop-mod:thanh-chau-binh` `suggestedBuildVi`
- `troop-mod:tien-dang-tu-si` `suggestedBuildVi`
- `troop-mod:vo-duong-phi-quan` `appliesToVi`
- `troop-mod:vo-duong-phi-quan` `suggestedBuildVi`
- `troop-option:bach-ma-nghia-tong:loan-cung-special` `nameVi`
- `troop-option:bach-ma-nghia-tong:tat-tri-special` `nameVi`
- `troop-option:bach-ma-nghia-tong:vo-cu-intermediate` `descriptionVi`
- `troop-option:bach-nhi-binh:chuyen-loan-cung-special-bow` `nameVi`
- `troop-option:bach-nhi-binh:tri-thuong-special` `nameVi`
- `troop-option:cam-pham-quan:cuu-ho-advanced` `descriptionVi`
- `troop-option:cam-pham-quan:dinh-khieu-advanced` `descriptionVi`
- `troop-option:cam-pham-quan:dung-vo-basic` `descriptionVi`
- `troop-option:cam-pham-quan:loan-cung-special` `nameVi`
- `troop-option:cam-pham-quan:muu-luoc-basic` `descriptionVi`
- `troop-option:cam-pham-quan:san-nguy-intermediate` `nameVi`
- `troop-option:cam-pham-quan:y-tri-basic` `descriptionVi`
- `troop-option:dai-kich-si:dao-qua-special` `descriptionVi`
- `troop-option:dai-kich-si:tri-thuong-special` `descriptionVi`
- `troop-option:dai-kich-si:tri-thuong-special` `nameVi`
- `troop-option:dan-duong-binh:cu-my-special` `descriptionVi`
- `troop-option:giai-phien-ve:chuyen-ky-thuat-special-cavalry` `nameVi`
- `troop-option:ham-tran-doanh:de-ngu-advanced` `descriptionVi`
- `troop-option:ho-ve-quan:dao-qua-intermediate` `descriptionVi`
- `troop-option:phi-hung-quan:chuyen-loan-cung-special-bow` `nameVi`
- `troop-option:phi-hung-quan:du-uy-advanced` `descriptionVi`
- `troop-option:tay-luong-thiet-ky:tat-trung-advanced` `descriptionVi`
- `troop-option:thanh-chau-binh:tri-thuong-special` `descriptionVi`
- `troop-option:tien-dang-tu-si:chuyen-cu-my-special-shield` `nameVi`
- `troop-option:tien-dang-tu-si:hao-doat-intermediate` `descriptionVi`
- `troop-option:tien-dang-tu-si:loan-cung-special` `descriptionVi`
- `troop-option:tien-dang-tu-si:loan-cung-special` `nameVi`
- `troop-option:vo-duong-phi-quan:chuyen-cu-my-special-shield` `nameVi`
- `troop-option:vo-duong-phi-quan:vi-dinh-advanced` `nameVi`

## Notes

- `clientCapture` fixes: troop-mod/option (#215 excepted: appliesToVi/suggestedBuildVi are not in the client capture and follow identity-map team names) and tactic `exchangeConditionVi` (#194) / `effectTypeVi` (#196) now equal the client capture text; the build assigns these fields from the capture anyway.
- Recommended items touched under rule 3/4 beyond the reviewer's exact proposal: 7, 16, 40, 51, 55, 119, 122, 126-131, 135, 167, 171 (abbreviation expansion / team title for the same source phrase).

# Round 2 — resolutions2 + proactive sweep

Input `.cache/review/rejections2.json` (208 items) → `.cache/review/resolutions2.json`; sweep over `.cache/review/site-current.json` (2694 texts) → `.cache/review/sweep.json` (changed items only, excluding items in resolutions2, Lookup untouched).

## Counts

| domain | fix | keep | total |
|---|---|---|---|
| recommended | 160 | 1 | 161 |
| lookup | 46 | 0 | 46 |
| data | 1 | 0 | 1 |
| **total** | **207** | **1** | **208** |

Sweep changes: **46** texts (rules below applied wherever the Chinese source contains the term and the text deviates).

## Definitive term table (rounds 1–2)

Recommended/data prose (rule 1/3/4). Abbreviation → full name, unless the source marks the short form itself as shorthand or the string is part of a longer team/option name (e.g. 八門蜀弓, 逢紀八門, 智八門, 當鋒騎, 【藤甲】/【眾志】 option brackets, truncated quotes ending “…”).

| source term | Vietnamese | notes |
|---|---|---|
| 藤甲(兵) | Lính Giáp Mây | not Đằng Giáp (Binh); team names keep identity-map form e.g. 藤甲太尉盾 = Đằng Giáp Thái Úy Thuẫn |
| 盛氣 | Thịnh Khí Linh Địch | 盛氣凌敵 |
| 威謀 | Uy Mưu Vô Địch | 威謀靡亢; not "Uy Mưu" |
| 當鋒 | Đương Phong Thôi Quyết | 當鋒摧決; 當鋒騎 is a team (Đương Phong Kỵ) |
| 折衝 | Đánh Bại Quân Địch | 折衝禦侮 |
| 草船(借箭) | Thuyền Cỏ Mượn Tên | not Thảo Thuyền (Tá Tiễn) |
| 剛勇 | Cương Dũng Vô Tiền | Lookup uses tactics.json: Vô Địch Can Trường |
| 忠勇 | Trung Dũng Nghĩa Liệt |  |
| 軍民 / 撫輯軍民 | An Ủi Quân Dân |  |
| 刮骨 | Cắt Xương Trị Độc | not Quát Cốt |
| 眾志(成城) | Toàn Quân Đồng Lòng | option bracket 【眾志】 = [Đồng Lòng] (client option name) |
| 竭力 | Dốc Sức Tính Kế |  |
| 非攻 | Không Đánh Mà Thắng | not Phi Công |
| 士別 | Sĩ Biệt Tam Nhật |  |
| 太平 | Thái Bình Đạo Pháp |  |
| 奪魂 | Đoạt Hồn Hiệp Phách |  |
| 暴戾 | Bạo Lệ Vô Nhân |  |
| 速乘 | Mau Giành Lợi Thế | not Tốc Thừa |
| 摧鋒 | Thôi Phong Đoạn Nhẫn | not when quote is truncated “…” |
| 暫避 | Tạm Lánh Sóng Gió |  |
| 熯天(熾地) | Hãn Thiên Sí Địa |  |
| 虎踞 | Hổ Cứ Ưng Dương |  |
| 萬軍 | Vạn Quân Đoạt Sư |  |
| 疾風(驟雨) | Gió Táp Mưa Sa |  |
| 八門 | Bát Môn Kim Tỏa Trận | 八門金鎖陣; exceptions: team 八門蜀弓/逢紀八門/智八門 |
| 兵無 | Binh Vô Thường Thế |  |
| 不虞 | Thừa Địch Bất Ngu |  |
| 絕道 | Tuyệt Đạo | identity-map alias, keep |
| 橫掃 | Quét Sạch | 橫掃千軍 = Hoành Tảo Thiên Quân |
| 踩踏 | Thải Đạp | equipment special (lookup-catalog), not Giẫm Đạp |
| 長健 / 長慮 | Trưởng Kiện / Trưởng Lự | lookup-catalog, not Trường |
| 武聖 | Võ Thánh |  |
| 號令 | Hiệu Linh | decided once: lookup-catalog (not Hiệu Lệnh) |
| 郊區 | khu ngoại ô | decided once; not "khu ít cạnh tranh" |
| 黑科技 | Đội hình dị | not "Đội hình độc lạ"/"Lối xây dựng khác thường" |
| 洞察 | Động Sát | Recommended notes; Lookup ledger: Động sát |
| 青州兵 | Lính Thanh Châu |  |
| 鋒矢陣 | Phong Thi Trận |  |
| 潛龍陣 | Tiềm Long Trận | team 潛龍陣 in identity map is Trận Tiềm Long; prose uses tactic form per glossary |
| 于吉 | Vũ Cát |  |
| 呂蒙/呂玲綺/呂布 | Lữ Mông / Lữ Linh Ỷ / Lữ Bố |  |
| 張苞 | Trương Bào |  |
| SP 皇甫嵩 | SP Hoàng Phổ Tung | identity map |
| SP 盧植 | SP Lư Thực (Recommended) / SP Lô Thực (Lookup) | two domains, two authorities |
| 核彈張 | Hạt Nhân Trương | not Hạch Đạn |
| 1速 | 1 tốc |  |
| 拓·/治·/轉·/精· | Thác · / Trị · / Chuyển · / Tinh ·  | spaced; 治軍X stays "Trị Quân X" |
| Team titles in prose | identity-map title, title word order | 群弓 Quần Cung, 蜀弓 Thục Cung, 蜀智 Thục Trí, 蜀槍 Thục Thương, 蜀盾 Thục Thuẫn, 太尉盾 Thái Úy Thuẫn, 五虎槍 Ngũ Hổ Thương, 肉弓 Nhục Cung, 桃園盾 Đào Viên Thuẫn, 皇馬槍 Hoàng Mã Thương, 虎臣弓 Hổ Thần Cung, 遼姬騎 Liêu Cơ Kỵ, 富貴騎 Phú Quý Kỵ, 吳槍 Ngô Thương, 吳騎 Ngô Kỵ, 星馬槍 Tinh Mã Thương, 關馬槍 Quan Mã Thương, 淵騎 Uyên Kỵ, 爆頭騎 Bạo Đầu Kỵ, 嘟嘟弓 Đô Đốc Cung; generated for every identity-map team whose alias occurs in the source (reversed forms "khiên X / cung X / thương X / kỵ X" → "X Thuẫn/Cung/Thương/Kỵ") |

Lookup (rule 2): tactic/hero/book names from data dictionaries (data/tactics.json: 剛勇無前 Vô Địch Can Trường, 鎮扼防拒 Trấn Ách Phòng Cụ, 據水斷橋 Dùng Nước Đẩy Cầu, 火熾原燎 Lửa Lan Khắp Chốn, 傾國傾城 Đẹp Động Lòng Người, 金丹秘術 Kim Đơn Mật Thuật, 休整 Nghỉ Ngơi, 虎衛軍 Quân Hổ Vệ; heroes-dict: 麋竺 My Trúc, 盧植 Lô Thực, 于吉 Vũ Cát); equipment names per lookup-catalog; status terms Động sát / Kế cùng / Tước vũ khí / Kháng cự / Tan tác / Phản Loạn / hút máu binh khí / thống suất / cấm trị liệu; troop-option/mod text = Global client capture wording.

## Rules decided newly in round 2

- 郊區 → "khu ngoại ô" (reviewer literal; paraphrase removed).
- 號令 → "Hiệu Linh" (lookup-catalog) everywhere; "Hiệu Lệnh" rejected.
- 1速 → "1 tốc" (project form), no paraphrase "tốc độ cao nhất đội".
- 嘟嘟弓 = Đô Đốc Cung (plain) vs SP 嘟嘟弓 = SP Cung Đô Đô (identity map).
- 絕道 = Tuyệt Đạo (identity-map alias) stays; 八門 expands except team names (八門蜀弓, 逢紀八門, 智八門).
- Option names in 【】 inside Recommended/Lookup builds follow the client option names (熟練 Thành Thạo, 眾志 Đồng Lòng, 窮追 Truy Đuổi, 藤甲 Giáp Mây).
- Equipment special 玉璽 = Ngọc Tỉ (client), 長健/長慮 = Trưởng Kiện/Trưởng Lự.
- Lookup: 神機莫測 inside the tactic’s own effect text also = Thần Cơ Khó Đoán.

## Round-2 keeps

- `recommended:s-b21fc616cf596a0cec9788fd858d5808c0f0bfb009129642837911a16e11a17d/s25-wenhou-gong` `displayNotes.blocks.p-1.textRaw` (#54): Văn bản hiện tại đã đúng 'Đội hình dị' (không cần sửa).

## Lookup items changed in round 2 (need re-promotion)

46 items:

- `building:cong-trinh-dinh` `summaryVi`
- `equipment-special:cung-than` `descriptionVi`
- `equipment-special:hanh-vu` `descriptionVi`
- `equipment-special:hoan-giap` `descriptionVi`
- `equipment-special:ky-mon` `descriptionVi`
- `equipment-special:linh-dong` `descriptionVi`
- `equipment-special:truong-lu` `descriptionVi`
- `equipment-special:vo-song` `descriptionVi`
- `equipment-special:vong-toc` `descriptionVi`
- `hero:co-dai-kieu` `roleTagViet`
- `hero:dien-vi` `lookup.usageVi`
- `hero:dieu-thuyen` `lookup.usageVi`
- `hero:dong-trac` `lookup.usageVi`
- `hero:ha-hau-don` `lookup.exclusiveTitleVi`
- `hero:ha-hau-don` `lookup.usageVi`
- `hero:ha-hau-uyen` `lookup.usageVi`
- `hero:ly-nho` `lookup.usageVi`
- `hero:man-sung` `lookup.exclusiveTitleVi`
- `hero:nhac-tien` `lookup.usageVi`
- `tactic:an-ui-quan-dan` `lookup.exchangeConditionVi`
- `tactic:anh-thanh-tu-thu` `effectViet`
- `tactic:bach-ky-kiep-doanh` `effectViet`
- `tactic:bach-y-do-giang` `effectViet`
- `tactic:cam-pham-bach-linh` `effectViet`
- `tactic:cho-doi-xuat-phat` `lookup.exchangeConditionVi`
- `tactic:loa-y-huyet-chien` `effectViet`
- `tactic:than-co-mac-trac` `effectViet`
- `tactic:thao-tam-hoac-dich` `effectViet`
- `tactic:thap-dien-mai-phuc` `effectViet`
- `tactic:thien-uy-khieu-tran` `effectViet`
- `tactic:toa-dieu-kinh-ngao` `effectViet`
- `troop-mod:bach-nhi-binh` `suggestedBuildVi`
- `troop-mod:dai-kich-si` `suggestedBuildVi`
- `troop-mod:dan-duong-binh` `suggestedBuildVi`
- `troop-mod:ham-tran-doanh` `appliesToVi`
- `troop-mod:ho-ve-quan` `appliesToVi`
- `troop-mod:ho-ve-quan` `suggestedBuildVi`
- `troop-option:bach-ma-nghia-tong:tap-vo-basic` `descriptionVi`
- `troop-option:dai-kich-si:kham-hu-intermediate` `descriptionVi`
- `troop-option:dan-duong-binh:chuyen-tri-thuong-special-spear` `nameVi`
- `troop-option:dang-giap-binh:chuyen-tuong-binh-special` `nameVi`
- `troop-option:dang-giap-binh:dang-giap-basic` `descriptionVi`
- `troop-option:dang-giap-binh:de-ngu-advanced` `descriptionVi`
- `troop-option:dang-giap-binh:kien-nhan-advanced` `descriptionVi`
- `troop-option:ho-ve-quan:dao-qua-intermediate` `nameVi`
- `troop-option:vo-duong-phi-quan:doat-hon-advanced` `descriptionVi`

# Round 3 — resolutions3 + Lookup troop sweep + Lookup term sweep

A) `.cache/review/rejections3.json` (164) → `resolutions3.json`: recommended fix 25 / keep 1; lookup fix 137 / keep 1.
B) Troop sweep (`lookup-troop-current.json`, 440 entries): 208 further entries changed (excluding those already in resolutions3); every option name/description and troop-mod effect equals the Global client capture text, `suggestedBuildVi` 【】 option names use client names, team names per identity map.
C) Lookup term sweep over all 3597 `lookup-translations.json` entries: 28 entries changed. Output `.cache/review/sweep3.json` (236 total).

## Keeps (round 3)

- `recommended:s-656d382a572c2f2ae5253747cf9ec9d9f70d1dc9b0eafa4de612fa388cea277a/s27-shanhe-dun` `displayNotes.blocks.p-1.textRaw` (#3): Nguồn viết 當鋒騎兵 (騎兵 = kỵ binh, không phải tên đội 當鋒騎); 'kỵ binh Đương Phong Thôi Quyết' là dạng đúng theo bảng thuật ngữ (當鋒 = Đương Phong Thôi Quyết).
- `tactic:co-giam-tien-thuc` `effectViet` (#33): Văn bản đã đủ: kết thúc đúng mệnh đề cuối của nguồn (xác suất 37.5%→75% đồng thời áp lên 1 đơn vị địch, mỗi người tối đa 1 lần mỗi lượt); reviewer thấy bị cắt do hiển thị rút gọn.

## Rules newly decided in round 3

- Client option alignment: ledger troop options are matched to the 12 client options of the same mod by meaning (numbers + keyword overlap, tier bonus, name similarity), not by SGSDeck name/tier; where the SGSDeck name disagrees with the client option that carries the same description (thanh-chau-binh 謀攻/回復), the description/name pair follows the client option (#117 deviates from the reviewer’s name-based pairing).
- Client wording is applied verbatim, including client numbers that differ from the SGSDeck source (e.g. 15% vs 25%) and client terms (Thống Soái, Chống Đỡ, Kế Tận).
- 休整 = "Nghỉ dưỡng" in Lookup ledger text (8 existing uses); client option wording "Nghỉ Ngơi" only inside client-captured text (supersedes round-2 #182 "Nghỉ Ngơi").
- 配 S盾 / 配 S槍 = "có binh chủng thuẫn/thương bậc S" (aptitude), not "trang bị S thuẫn".
- 當鋒騎兵 (kỵ binh carrying 當鋒) is not the team 當鋒騎 → "kỵ binh Đương Phong Thôi Quyết".
- 智八門 = "Trí Bát Môn" (team name, not expanded).
- Lookup term class sweep (only where the zh source contains the term): 于吉 Vũ Cát, 潘鳳 Phan Phụng, 張苞 Trương Bào, 呂X Lữ X, 呂玲綺 Lữ Linh Ỷ, 陳武 Trần Võ, 麋竺 My Trúc, 盧植 Lô Thực, 郭汜 Quách Tỷ, 統率/統帥 thống suất (thống lĩnh→thống suất only if source has no 統領), 計窮/技窮 Kế cùng, 倒戈 hút máu binh khí, 洞察 Động sát, 抵禦 Kháng cự (only "Kháng đỡ" corrected), 藤甲兵 Lính Giáp Mây, 青州兵 Lính Thanh Châu, 休整 Nghỉ dưỡng.

## Lookup items changed in round 3 (re-promotion needed)

All entries in resolutions3 with decision fix and all entries of sweep3.json.

# Round 4 — resolutions4 + client-capture tactic sweep

A) rejections4 (36) → resolutions4.json: fix 35 / keep 1 (all lookup except 11 recommended).
Client capture verified for #19–#21, #23–#28 (exact capture text applied). #22 keep: capture effectTypeVi for tactic:huy-quan-ket-tran is "Tăng ích".
B) sweep4.json: 404 entries set equal to the capture (effectTypeVi / exchangeConditionVi / targetViet of every Lookup tactic present in pipeline/lookup-client-tactics.json; capture null → ledger kept) + 1 office-title fixes (主政官 Quan Chủ Chính, 採石官 Quan khai thác đá, 馴馬官 Thuần mã quan). Total 405.
Rule: client-provided fields (effectTypeVi, exchangeConditionVi, targetVi) are copied verbatim; effectVi stays ledger-translated history (client effect replaces only the current revision at build).

- Keep: #22 (see above).


# Round 5 — resolutions5 + status-term / office-title sweep

A) rejections5 (15 lookup) → resolutions5.json: 15 fix (tactic:ho-ve-quan effectViet restored to a full translation; tranh-phan-doat-mieu 【Chờ xác minh】).
B) sweep5.json: 27 further Lookup ledger entries (non-troop): 計窮/技窮 → Kế cùng (Cạn kế/Kiệt kế/kỹ cùng), 抵禦 → Kháng cự (Chống đỡ/Kháng đỡ), office titles per lookup-catalog, 【待核實】 bracket form.
Office-title table (lookup-catalog building text, applied where the zh source has the title): 冶/治鐵官 Quan luyện sắt; 稅務官 Quan thuế vụ; 練兵使 Sứ giả luyện binh; 糧草官 Quan Lương Thảo; 木材官 Quan Gỗ; 尋訪使 Sứ giả tìm kiếm; 貿易官 Quan Thương Mại; 採石官 Quan khai thác đá; 鍛造官 quan rèn; 馴馬官 Quan huấn luyện ngựa (supersedes round-4 "Thuần mã quan"); 主政官 Quan Chủ Chính (client).
Meta-text scan of all 3597 Lookup entries: only tactic:ho-ve-quan and tactic:tranh-phan-doat-mieu contained non-translation text (both in resolutions5); other hits ("Lưu ý", "thay") are legitimate translations of 注 / 替.


# Round 8

resolutions8: 35 fix / 1 keep (#4 千里 = Thiên Lý per identity map). sweep8: 4 Recommended/site texts (一速 = 1 tốc, 尾速 = tốc độ cuối, 計窮/震懾 = Kế Cùng/Chấn Nhiếp) + 1 Lookup usageVi/exclusiveTitleVi tactic names per tactics.json viet (hero:tu-ma-y title 用武通神 = Dụng Võ Thần Thông).
