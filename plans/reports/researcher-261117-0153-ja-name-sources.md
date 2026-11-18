# Tên tiếng Nhật (三國志 真戦) cho chiến pháp, tướng, binh thư: nguồn và ngoại lệ

Ngày: 2026-11-17 · Dữ liệu: `plans/reports/ja-names-observed-261117.json` (718 dòng)

## Kết luận chính

- Chuyển chữ phồn thể sang shinjitai **không đủ cho chiến pháp**. Trong 336 chiến pháp đã khớp ID, chỉ 216 (64%) có tên Nhật trùng tên suy ra. Riêng chất S là 146/252 (58%). Bản Nhật đổi tên hẳn rất nhiều chiến pháp, ví dụ 橫掃千軍→千軍一掃, 士別三日→刮目相待, 所向披靡→万夫不当.
- Với tướng thì cách suy ra dùng được: 242/249 tên khớp (97%). Ngoại lệ ít và có thể liệt kê hết (mục 3).
- Binh thư (兵法書) chỉ khớp 37/66 (56%). Tên Nhật thường là thành ngữ khác, ví dụ 百戰→百戦錬磨, 救主→親衛.
- **Có trường hợp trùng mặt chữ nhưng khác chiến pháp:** tên Nhật 金城湯池 là chiến pháp tự mang của 曹仁 (CN 固若金湯), còn 金城湯池 của 郝昭 bên CN thì bản Nhật gọi là 湯池鉄城. Vì vậy không được auto-map chỉ dựa trên mặt chữ khi đã có bằng chứng từ quan hệ với tướng.
- Phạm vi: 336 ID chiến pháp (S 247/279, A 65/80, B 24/39), vượt mục tiêu 200. Thêm 249 ID tướng, 66 ID binh thư, 13 kỹ năng quân sư, 6 trang bị.

## 1. Cách làm

1. Crawl có giãn cách (0,7 giây mỗi trang, robots cho phép) 359 bài của 真戦ナビ, 291 bài của sanngokusinnsenn.com và 177 bài của kazten.com. Chỉ trích tên, không chép mô tả.
2. **Khớp trực tiếp**: gộp biến thể chữ (phồn, giản, shinjitai qua OpenCC `jp2t`+`t2s` và bảng bổ sung) rồi dò tên của repo (`tactics.json`, `heroes-dict.json`, `books-dict.json`, `lookup-catalog.json`) trong văn bản. Lấy đúng chuỗi như nguồn viết.
3. **Khớp qua tướng**: lấy cặp "Xの固有戦法 / 継承戦法 Y" và cột 固有/継承元/継承武将 trong bảng. Ánh xạ tướng X sang ID repo rồi tra `selfTacticCn`/`inheritTacticCn` và `lookup.acquiredFromVi` để ra ID chiến pháp. Đây là cách tìm được các tên đổi hẳn.
4. **Thủ công** (`evidence: manual`): chiến pháp sự kiện khớp theo tướng điều kiện đổi và hiệu ứng; binh thư khớp theo vị trí slot ở trang heihousyo-master và mô tả; thêm các ngoại lệ đã kiểm tra.
5. **Ảnh client của chủ repo** (`evidence: screenshot`): 12 tướng, 33 chiến pháp, 5 tên binh thư. 通常攻撃 là đòn đánh thường, không phải chiến pháp nên bỏ qua. 乗敵不廣 là lỗi đọc ảnh, sửa thành 乗敵不虞.
6. `derivedEqual` tính bằng OpenCC `s2t` rồi `t2jp` trên trường `chinese`, sau khi bỏ khoảng trắng (ví dụ "SP 法正" thành "SP法正"). Trường `diff` cho biết loại khác biệt: `glyph` là chỉ khác dạng chữ, `name` là khác tên.

Các trường thêm vào JSON ngoài schema được giao:

- `confidence`: high, medium hoặc low.
- `evidence`: struct, prose, rel-*, manual, screenshot.
- `derived`, `diff`, `note`.
- `baseId`: dùng cho tên có tiền tố. Những tên này để `id: null` vì repo không có ID riêng.

Với dòng lấy từ ảnh, `sourceUrl` là chuỗi `client-screenshot (...)`, không phải URL.

## 2. Thống kê

| kind | số dòng | số ID | derivedEqual | high / medium / low |
|---|---|---|---|---|
| tactic | 367 | 336 | 216 (64%) | 213 / 150 / 4 |
| hero | 251 | 249 | 242 (97%) | 214 / 36 / 1 |
| book | 81 | 66 | 37 (56%) | 30 / 51 / 0 |
| advisor | 13 | 13 | 13 | 2 / 11 / 0 |
| equipment | 6 | 6 | 6 | 0 / 6 / 0 |

Có 13 tên binh thư chưa khớp ID (gồm 6 tên trường phái) và 19 tên có tiền tố. Số `derivedEqual` bị lệch lên vì tên trùng thì dễ tìm hơn tên đổi. Tỷ lệ thực trên toàn bộ chiến pháp có thể còn thấp hơn.

## 3. Danh sách ngoại lệ (derivedEqual = false)

Ký hiệu: (m) là độ tin medium, còn lại là high. Chữ đứng trước tên cho biết loại: b là binh thư, h là tướng, t là chiến pháp.

**Tiền tố (19), id=null + baseId**

拓・刮目相待, 拓・刮骨療毒, 拓・太平道法, 拓・威謀必至, 拓・昏迷乱擾, 拓・草船借箭, 拓・蓄勢待発, 拓・速乗其利, 拓・鋒矢陣, 拓・鎮阨防拒; 転・刮骨療毒, 転・千軍一掃, 転・慰撫軍民, 転・昏迷乱擾, 転・暫避其鋒, 転・獅子奮迅, 転・神算鬼謀, 転・衆志成城, 転・非攻制勝.

- 転・ là bản đổi thuộc tính ảnh hưởng hoặc loại sát thương (軍備営, S26+).
- 拓・ là chiến pháp độc quyền của 統軍整備 (S21/S22, 兵演春秋).
- Có trường hợp tên trong tiền tố khác tên gốc bản Nhật: 拓・蓄勢待発 nhưng tên gốc là 伏機即動.

**Dùng の (4)**: 八門金鎖の陣 ← 八門金鎖陣 (m); 古の悪来 ← 古之惡來 (m); 乱世の奸雄 ← 亂世奸雄 (m); 国の柱石 ← 國之楨榦.

**Đảo trật tự (2)**: 四境震駭 ← 震駭四境 (m); 統監震軍 ← 監統震軍 (m).

**Chỉ khác dạng chữ (17)**, cần sửa bảng ký tự:

- Tướng: 楊脩 (suy ra 楊修); 麴義 (suy ra 麹義; 麹義 dùng nhiều hơn, cả hai đều có trong JSON); 陳羣 (suy ra 陳群).
- Chiến pháp: 百練成鋼 và 百錬成鋼 (cả hai đều có); 衆望所帰, 衆志成城 (眾→衆); 据水断橋 (據→据, không phải 拠); 折衝禦侮 (giữ 禦, không đổi thành 御); 挾勢弄権; 歛衆而撃; 夢中弑臣 (弒→弑); 潜龍陣 (giữ 龍, không đổi thành 竜); 精錬策数; 遡江揺櫓 (溯→遡); 自愈 và 自癒; 威武併昭 (並→併); 無當飛軍 (giữ 當).

**Khác một phần (61)**:

- Binh thư: 当機立断 ← 應機立斷 (m); 奇正剛柔 ← 奇正相生 (m); 三軍救助 ← 三軍之眾; 勝敵益強 ← 勝而益強 (m).
- Tướng: 諸葛瑾 ← 諸葛璟 (m); 馬雲騄 ← 馬雲祿 (m).
- Chiến pháp:
  - Sự kiện và binh chủng: 慰撫軍民 ← 撫輯軍民; 籠城自守 ← 嬰城自守; 白耳兵 ← 白毦兵; 整装雌伏 ← 整裝待發; 衆妙奇計 ← 眾動萬計; 剛勇無比 ← 剛勇無前; 解煩兵 ← 解煩衛; 狭勢弄権 ← 挾勢弄權; 血刃争奪 ← 血刃爭鋒; 臨鋒決闘 ← 臨鋒決敵; 摧鋒断刀 ← 摧鋒斷刃.
  - Các chiến pháp khác: 暴戻恣睢 ← 暴戾無仁; 錦嚢妙計 ← 錦囊妙計; 進軍撃営 ← 振軍擊營; 機転先決 ← 機鑑先識; 剛毅不屈 ← 剛烈不屈; 剛柔一体 ← 剛柔並濟; 掲棺決戦 ← 抬棺決戰; 短兵相見 ← 短兵相接; 黄天太平 ← 黃天泰平; 合軍集衆 ← 合軍聚眾; 勇壮飛燕 ← 輕勇飛燕; 驍健神脚 ← 驍健神行; 奇兵近道 ← 奇兵間道; 騎虎之勢 ← 騎虎難下; 臨戦先駆 ← 臨戰先登; 射石飲羽 ← 彎弓飲羽; 焰逐風飛/焔逐風飛; 累世立命 ← 累世立名; 南蛮巨魁 ← 南蠻渠魁; 五穀豊穣 ← 五穀豐登; 五雷轟天 ← 五雷轟頂; 偽書疑心 ← 偽書相間; 人徳載世 ← 仁德載世; 破陣砕堅 ← 破陣摧堅; 赴湯踏火 ← 赴湯蹈火; 能弁機敏 ← 才辯機捷; 雄図待時 ← 藏器待時; 疾風豪雨 ← 疾風驟雨; 済貧施恵 ← 濟貧好施; 深計遠略 ← 深謀遠慮; 機変制勝 ← 臨機制勝; 上兵破謀 ← 上兵伐謀; 先駆死士 ← 先登死士; 坐志怒襲 ← 挫志怒襲; 座守孤城 ← 坐守孤城; 沈砂決水 ← 沉沙決水; 鎮阨防拒 ← 鎮扼防拒; 瞋目大喝 ← 瞋目橫矛; 暴政劫掠 ← 縱兵劫掠; 智計破謀 ← 絕計折謀; 威謀必至 ← 威謀靡亢; 万矢斉射 ← 萬箭齊發; 文武両道 ← 文武雙全; 知者不惑 ← 處茲不惑.
  - Trừ 機転先決, 剛柔一体, 短兵相見, 深計遠略, 上兵破謀, 先駆死士 và 文武両道, các tên còn lại đều ở mức (m).

**Đổi tên hẳn (88)**:

- Binh thư, tất cả (m) trừ 練磨: 百戦錬磨←百戰, 守備采配←守而有道, 臨戦態勢←嚴陣以待, 機動防御←分而疾戰, 柔能制剛←剛柔, 親衛←救主, 救援馳参←馳援, 奇策勝利←出奇制勝, 時勢判断←審時度勢, 能鷹隠爪←示敵以弱, 鉄甲/鉄兜←鐵甲, 笑裏蔵刀←藏刀, 応変←合變, 不戦屈敵←無戰而勝, 死中求活←不勇則死, 一気呵成←一鼓作氣, 帰従←歸心, 練磨←錘煉, 反転攻勢←三里而還, 傷兵支援←援其必攻, 仙風←散仙, 先制←神機, 常勝←勝戰, 博愛主義←樂善好施, 精確←精準, 気分一新←神清氣凈, 鋭鋒回避←避其銳氣.
- Tướng: 蔡琰←蔡文姬; 張氏←張姬; 朱桓←朱恆; 40周年呂布 (biến thể của 40Y呂布).
- Chiến pháp:
  - Đã có bằng chứng từ ảnh client: 昏迷乱擾←奪魂挾魄, 刮目相待←士別三日, 杯中蛇影←杯蛇鬼車, 舞癒←離月 (SP貂蝉), 天意靖乱←承天靖世 (SP曹操), 玄虚深蔵←深藏若虛, 伏機即動←蓄勢待發.
  - Mức (m): 千軍一掃←橫掃千軍, 万夫不当←所向披靡, 意気衝天←盛氣凌敵, 一致百慮←先成其慮, 神算鬼謀←用武通神, 勇猛果断←勇者得前, 燎原之火←熯天熾地, 奇策妙計←運籌決算, 寡兵奮戦←以寡敵眾, 奮戦力闘←一力拒守, 鈍兵挫鋭←挫銳, 即断即決←定謀貴決, 才気煥発←鋒芒畢露, 至善極地←臻於至善, 暗中飛躍←暗潮洶湧, 専横略奪←暴斂四方, 天下大吉←魯莽, 名文雷震←落雷, 有智高才←出口成章, 恩徳衆心←恩厚得眾, 威武堂々←威風凜凜, 巻添←牽連, 金城湯池←固若金湯 (曹仁), 湯池鉄城←金城湯池 (郝昭), 雷鳴天下/雷名天下←威震華夏, 疾風二連←將行其疾, 遼来遼来←陷陣突襲, 縦横疾駆←槊血縱橫, 羞花閉月←閉月, 妍姿艶質←顧盼生姿, 鴆毒←鳩毒, 青嚢←青囊, 雨乞之術←興雲布雨, 籌策帷幕←校勝帷幄, 権謀術策←竭忠盡智, 機知頓才←沉斷機謀, 確乎不抜←持軍毅重, 銅臭政治←竊幸乘寵, 黄巾平定←鎮壓黃巾, 樊城水攻←水淹七軍, 精・ひらめき←精·靈機一動.
  - Sự kiện: 剣鋒破砕←當鋒摧決, 単騎千里←千里走單騎, 水路断截←絕其汲道, 戦況見極←知己知彼, 志操堅固←臨危救主, 投擲画戟←梳妝擲戟, 軍陣結集←麾軍結陣 (biến thể lỗi gõ 軍人結集).

**Chưa khớp ID (13, đều là binh thư)**:

- Tên trường phái: 作戦, 虚実, 軍形, 九変, 始計, 用間.
- Chưa xác định hoặc không có trong repo: 謀定後動, 励士, 兵馬倥偬, 身退志進, 千里急行, 仙姿, 譲渡.

## 4. Quy luật ngoại lệ, áp dụng cho bộ suy tên của site

1. **Tiền tố cố định**: 転・, 拓・ và 精・ (kèm dấu ・). Nên ghép theo dạng tiền tố + tên Nhật của chiến pháp gốc, không chuyển từ CN `轉·`/`精·`.
2. **之 → の** ở tên chiến pháp tự mang (古の悪来, 乱世の奸雄, 国の柱石, 八門金鎖の陣). Không áp dụng cho mọi 之: 雨乞之術, 燎原之火, 騎虎之勢, 長者之風 vẫn giữ 之. Phải dùng bảng, không dùng quy tắc chung.
3. **Đổi thành ngữ hoặc rút gọn** là nhóm lớn nhất. Không suy được, bắt buộc dùng bảng ID → tên Nhật.
4. **Kana**: rất hiếm. Chỉ có 精・ひらめき (site không chính thức) và 威武堂々 (dùng 々). Tên tướng kana như 許チョ hay 賈ク là thói quen của blog. Game dùng 許褚 và 賈詡, nên không thu các dạng kana đó.
5. **Bảng ký tự cần chỉnh so với OpenCC t2jp**:
   - Thêm 眾→衆, 溯→遡, 弒→弑, 據→据 (trong tên chiến pháp này).
   - Không đổi 禦→御, 龍→竜, 當→当 (riêng 無當飛軍).
   - Tên tướng có chữ riêng: 楊脩, 陳羣, 馬雲騄, 麹義.
6. **SP**: viết liền không có khoảng trắng (SP法正). Bản collab Musou là 無雙→無双 (無双小喬…). Bản 40 năm là 40Y呂布, có nơi viết 40周年呂布. Chưa thấy tiền tố 覚醒 trong tên tướng; 覚醒 chỉ là trạng thái.
7. Có **một bất nhất trong repo** đã phát hiện: `heroes-dict` ghi 朱儁 → 継承 千里馳援, trong khi `tactics.json` ghi 聲東擊西 lấy từ Chu Tuấn và 千里馳援 lấy từ Chu Hoàn. Nguồn Nhật xác nhận 朱儁 → 声東撃西 và 朱桓 → 千里馳援. Ngoài ra repo có 朱恆 và 諸葛璟, nhiều khả năng sai chữ (đúng là 朱桓, 諸葛瑾).

## 5. Nguồn và độ tin cậy

| Nguồn | Loại | Dùng cho | Ghi chú |
|---|---|---|---|
| 真戦ナビ sangokushi-shinsen.com | Blog fan, cập nhật đến 2026-11 | Nguồn chính (616 dòng): trang /s-sen /a-sen /b-sen /rush /command /incident /passive /heihousyo-master /kan, trang từng tướng | Footer "© 2021 三国志真戦攻略ブログ". Không có điều khoản riêng về trích dẫn; robots chỉ chặn wp-admin. Có lỗi gõ (狭勢弄権, 摧鋒断刀, 軍人結集, 投擲画戟 nhưng đọc là そしょう…) |
| sanngokusinnsenn.com | Blog fan (Cocoon) | Bảng 継承武将, bảng sự kiện kèm điều kiện đổi, bài S21–S27 | Hay dùng chữ phồn (挾, 傳, 氣) khác 真戦ナビ |
| kazten.com | Blog Hatena | Tướng mới S25–S27 (国の柱石 của SP盧植) | Đôi khi nhắc tên CN gốc (蔵器待時, 蓄勢待発). Những dòng chỉ có văn xuôi từ đây được để medium hoặc low |
| Ảnh client Nhật của chủ repo | Sơ cấp | 49 dòng, verified | Tin cậy cao nhất |

- Không dùng Hensei Kobo.
- Trang `china-update*` của 真戦ナビ bàn về bản CN, nên tên ở đó chỉ được tính trọng số thấp. Tên có chữ ngoài bảng JIS (ví dụ 不战蚀谋, 白马镇北) bị loại.
- Tên chiến pháp, tướng, binh thư là dữ kiện ngắn, thuộc quyền của Koei Tecmo/Qookka. Chỉ lưu tên và URL làm bằng chứng, không chép mô tả.

## 6. Hạn chế

- Không có nguồn chính thức (trang hoặc wiki của nhà phát hành) để xác nhận chính tả. Các cặp như 雷鳴天下 (11 lần) và 雷名天下 (8 lần), hay 狭/挟/挾勢弄権, chỉ có thể chốt bằng ảnh client.
- Mức medium chủ yếu đến từ một nguồn quan hệ với tướng. Ánh xạ này dựa vào `selfTacticCn`/`inheritTacticCn` của repo; ví dụ 朱儁 cho thấy dữ liệu đó có thể sai. Nên spot-check bằng client trước khi đánh `verified`.
- Binh thư khớp theo vị trí slot và mô tả blog, không đối chiếu số liệu hiệu ứng. Ba ánh xạ yếu nhất là 常勝←勝戰, 臨戦態勢←嚴陣以待 và 機動防御←分而疾戰.
- Trang bị (6) và kỹ năng quân sư (13) mới phủ sơ bộ. Chưa đào trang /skill (kỹ năng trang bị) và /gunshigi một cách có hệ thống.
- Còn khoảng 32 chiến pháp S, 15 chiến pháp A và phần lớn chiến pháp B/C chưa thấy tên Nhật. Chủ yếu là chiến pháp nội chính, bản collab Đài Loan (堅強之花, 鬼神之女…) hoặc chưa ra bản Nhật.
- YouTube không được khai thác; chỉ dùng văn bản blog.

## Câu hỏi chưa giải

1. Chính tả chính thức: 雷鳴天下 hay 雷名天下? 挟勢弄権, 狭勢弄権 hay 挾勢弄権? 気凌三軍 hay 氣凌三軍? 伝檄宣威 hay 傳檄宣威? 百錬成鋼 hay 百練成鋼? 焔逐風飛 hay 焰逐風飛? 麹義 hay 麴義?
2. Có giữ dòng `id:null` cho các tên có tiền tố 転・/拓・ không, hay cần tạo ID riêng trong repo?
3. 精・ひらめき có phải tên chính thức của 精·靈機一動 không (chỉ thấy ở một trang)?
4. 戦況見極←知己知彼 và 志操堅固←臨危救主 được suy từ điều kiện đổi sự kiện, chưa đối chiếu hiệu ứng. Cần kiểm tra trên client.
5. Repo có cần sửa 朱儁 継承 (千里馳援 → 聲東擊西) và tên 朱恆/諸葛璟 không? Việc này ngoài phạm vi; đề xuất tạo GitHub issue.
6. Bảy binh thư Nhật chưa khớp (謀定後動, 励士, 兵馬倥偬, 身退志進, 千里急行, 仙姿, 譲渡) có thể là binh thư mới mà repo chưa có.
