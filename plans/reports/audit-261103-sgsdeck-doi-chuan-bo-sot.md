# Audit Team chuẩn SGSDeck: đội bị bỏ sót (2026-11-03)

- Topic: audit độ phủ Team chuẩn (SGSDeck `/recommended`) so với generation đang publish.
- Phạm vi: nguồn SGSDeck (TW). Không suy ra mùa/server VN.
- Mốc so sánh: generation `c6d9efee882d…` (pack `pipeline/localization-inputs/recommended.json`, capture 2026-09-14, 1366 đội) ↔ cache crawler `.cache/sgsdeck-recommended` (crawl 2026-11-03, inventory `sha256:cae5742af24a…`, 81/81 scope crawl xong, 1640 đội).
- Đây là quan sát cache/runtime dự án, không phải bằng chứng cơ chế game.

## Kết luận

Generation đang publish thiếu **323 cặp scope/đội** so với SGSDeck hiện tại (320 mã đội mới + 3 mã đổi scope), và còn chứa **49 đội** SGSDeck đã gỡ khỏi S28 (45 gỡ hẳn, 4 đổi mã/chuyển sang 開荒).

| Scope | Đang publish | SGSDeck 2026-11-03 | Thiếu | Đã gỡ trên nguồn |
| --- | --- | --- | --- | --- |
| pk-s28|開荒 | empty-category 0 | 15 | 15 | 0 |
| pk-s28|交戰 | complete 93 | 177 | 133 | 49 |
| pk-s27|交戰 | complete 76 | 115 | 39 | 0 |
| pk-s20|交戰 | uncollected-season 0 | 119 | 119 | 0 |
| pk-s19|交戰 | complete 84 | 88 | 4 | 0 |
| pk-s27|開荒 | empty-category 0 | 13 | 13 | 0 |

Các scope còn lại (og-兵演春秋, S1–S18, S22–S26) khớp đúng tập mã đội.

### Nguyên nhân

1. **Nguồn cập nhật sau capture 2026-09-14**: S28 (93→177 交戰, 開荒 0→15), S27 (76→115 交戰, 開荒 0→13), S20 奇門八陣 từ `uncollected` thành 119 đội (lúc capture tên mùa là 奇兵八陣).
2. **S19 sót ngay lúc capture**: generation ghi season option `advertisedCountRaw: 88` nhưng scope chỉ 84; builder không đối chiếu hai số này nên 4 đội (`s19-hedan-zhang-cao`, `s19-moka-gong`, `s19-fanji-dun`, `s19-xiagou-qi`, đều T2) không vào publication.

## Chặn khi cập nhật (parser drift)

Cache mới **không ingest được** bằng parser hiện tại (`pipeline/sgsdeck_recommended.py`), layout SGSDeck đã đổi:

- Điểm: detail không còn `span.font-mono`; điểm nằm ở `來源評分 <span class="tabular">N</span>` → `value` parse ra `null` cho 1609/1609 trang.
- List: `heroNames` rỗng, `factionRaw` null cho 1640/1640 thẻ (tier vẫn đọc được).
- 31 trang Khai hoang (pk-s26 14, pk-s28 9, pk-s27 8) không còn field `戰法 1/2` → `ValueError: Recommended detail slot structure changed`. Chiến pháp vẫn có trong JSON-LD FAQ của trang.
- 19 thẻ Khai hoang không có tier trên list (pk-s26 8, pk-s28 6, pk-s27 5).

## Danh sách đội thiếu

Phân loại so với toàn bộ publication (mọi mùa): `new-roster` = roster chưa từng có; `same-roster-diff-tactics` = cùng ba tướng, khác chiến pháp; `same-config-as-published` = trùng tướng+chiến pháp với đội của mùa khác (vẫn là đội mới của mùa này). `unparseable` = trang Khai hoang không parse được.

### pk-s28|交戰 (133)

- `s28-0617-shu-04` SP諸葛新蜀智 · T0 · new-roster
- `s28-0617-shu-05` SP諸葛新蜀智 · T0 · new-roster
- `s28-0617-wei-04` 五謀弓 · T0 · same-roster-diff-tactics
- `s28-0617-qun-04` 打地皇馬槍 · T0 · same-roster-diff-tactics
- `s28-0617-shu-03` 法官盾 · T0 · same-roster-diff-tactics
- `s28-0617-shu-01` 法官盾 · T0 · same-roster-diff-tactics
- `s28-0617-han-02` 漢室弓 · T0 · same-roster-diff-tactics
- `s28-0617-han-01` 漢室弓 · T0 · same-roster-diff-tactics
- `s28-0617-han-03` 漢室弓 · T0 · same-roster-diff-tactics
- `s28-0617-wei-03` 王異騎 · T0 · same-roster-diff-tactics
- `s28-0617-shu-02` 老諸葛新蜀智 · T0 · new-roster
- `s28-0617-wei-02` 荀攸五謀騎 · T0 · same-roster-diff-tactics
- `s28-0617-wu-12` SP周瑜肉弓 · T0.5 · new-roster
- `s28-0617-han-05` SP朱儁漢肉弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-han-04` SP盧植太師弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-05` SP荀彧神火弓 · T0.5 · new-roster
- `s28-0617-wu-01` SP荀彧點火弓 · T0.5 · new-roster
- `s28-0617-wu-03` 乘勝長驅點火弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-09` 兗州三勢關 · T0.5 · new-roster
- `s28-0617-shu-09` 北伐槍 · T0.5 · same-config-as-published
- `s28-0617-wei-10` 反擊盾 · T0.5 · same-roster-diff-tactics
- `s28-0617-shu-10` 叔侄盾 · T0.5 · new-roster
- `s28-0617-hun-02` 圓夢弓 · T0.5 · new-roster
- `s28-0617-hun-01` 圓夢弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-shu-08` 撫輯軍民北伐盾 · T0.5 · same-roster-diff-tactics
- `s28-0617-wei-08` 曹真飛熊軍 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-12` 渡江槍 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-03` 潛龍周瑜呂布 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-04` 潛龍慷慨弓 · T0.5 · new-roster
- `s28-0617-hun-06` 潛龍貂 · T0.5 · new-roster
- `s28-0617-hun-13` 狗官槍 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-08` 狗馬槍 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-15` 瑜亮弓 · T0.5 · new-roster
- `s28-0617-hun-11` 皇冠槍 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-09` 神火弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-10` 神火弓 · T0.5 · new-roster
- `s28-0617-wu-15` 神火弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-han-06` 美人連環弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-11` 老周瑜神火弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-14` 老周瑜肉弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-04` 老諸葛點火弓 · T0.5 · new-roster
- `s28-0617-wu-16` 臥薪嘗膽孫權吳騎 · T0.5 · same-roster-diff-tactics
- `s28-0617-wei-07` 荀攸五謀弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-wei-05` 荀攸五謀騎 · T0.5 · new-roster
- `s28-0617-hun-10` 超姬槍 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-07` 關馬槍 · T0.5 · same-roster-diff-tactics
- `s28-0617-wu-08` 點火弓 · T0.5 · same-roster-diff-tactics
- `s28-0617-hun-16` 三勢呂 · T1 · same-roster-diff-tactics
- `s28-0617-hun-22` 三勢張角法正 · T1 · new-roster
- `s28-lp-xg-eryuan` 二袁（孝公共存版） · T1 · new-roster
- `s28-0617-qun-16` 低配馬超 · T1 · new-roster
- `s28-0617-qun-12` 八門金鎖溫侯弓 · T1 · same-roster-diff-tactics
- `s28-0617-wei-19` 劉司馬飛熊騎 · T1 · new-roster
- `s28-0617-wei-16` 反擊盾 · T1 · new-roster
- `s28-0617-wei-13` 司馬郝昭太尉盾 · T1 · same-roster-diff-tactics
- `s28-0617-wu-26` 吳弓 · T1 · new-roster
- `s28-lp-dabai-zhouyu-dudu` 周瑜嘟嘟（大白共存版） · T1 · same-roster-diff-tactics
- `s28-0617-wu-20` 孫權吳槍 · T1 · new-roster
- `s28-0617-han-07` 張讓漢肉弓 · T1 · same-roster-diff-tactics
- `s28-0617-wei-18` 惇惇盾 · T1 · same-roster-diff-tactics
- `s28-0617-wu-18` 慷慨弓 · T1 · same-roster-diff-tactics
- `s28-lp-xg-kangkai-gong` 慷慨弓（孝公程普版） · T1 · same-roster-diff-tactics
- `s28-0617-wei-26` 抬棺弓 · T1 · new-roster
- `s28-0617-wu-25` 抵禦弓 · T1 · same-roster-diff-tactics
- `s28-0617-hun-17` 核彈張 · T1 · same-roster-diff-tactics
- `s28-0617-wei-12` 榮光槍 · T1 · same-roster-diff-tactics
- `s28-0617-qun-09` 武峰袁馬槍 · T1 · same-roster-diff-tactics
- `s28-0617-qun-08` 武峰貂馬槍 · T1 · new-roster
- `s28-0617-qun-15` 武鋒SP馬超槍 · T1 · new-roster
- `s28-0617-hun-21` 武鋒龐德 · T1 · new-roster
- `s28-0617-wu-19` 殺馬弓 · T1 · same-roster-diff-tactics
- `s28-lp-xg-fa-dundun` 法敦敦（孝公共存版） · T1 · new-roster
- `s28-0617-wei-25` 王佐騎 · T1 · same-roster-diff-tactics
- `s28-0617-hun-18` 瑜亮弓 · T1 · new-roster
- `s28-0617-hun-19` 瑜亮弓 · T1 · new-roster
- `s28-0617-wei-23` 紫金弓 · T1 · same-roster-diff-tactics
- `s28-0617-shu-13` 網紅槍 · T1 · same-roster-diff-tactics
- `s28-lp-dabai-qun-gong` 群弓（大白共存版） · T1 · same-roster-diff-tactics
- `s28-0617-qun-07` 義心昭烈閉月盾 · T1 · same-roster-diff-tactics
- `s28-lp-dkl-yixin-shuzhi-sp` 義心蜀智 SP 諸葛版（大恐龍共存版） · T1 · new-roster
- `s28-lp-dkl-yixin-shuzhi` 義心蜀智（大恐龍共存版） · T1 · new-roster
- `s28-lp-dkl-xunyou-wumou` 荀攸五謀（大恐龍共存版） · T1 · new-roster
- `s28-0617-qun-05` 袁術爆發弓 · T1 · new-roster
- `s28-0617-shu-14` 西風騎 · T1 · same-roster-diff-tactics
- `s28-0617-wei-21` 遼姬騎 · T1 · same-roster-diff-tactics
- `s28-lp-dabai-guanguanzhang` 關關張（大白共存版） · T1 · same-roster-diff-tactics
- `s28-0617-shu-19` SP關羽洞察槍 · T1.5 · same-config-as-published
- `s28-0617-hun-27` 三勢張角飛熊騎 · T1.5 · new-roster
- `s28-0617-wu-31` 吳騎 · T1.5 · new-roster
- `s28-0617-shu-15` 天水弓 · T1.5 · same-roster-diff-tactics
- `s28-0617-hun-24` 太史慈鼠標弓 · T1.5 · same-roster-diff-tactics
- `s28-0617-shu-20` 奇門連環槍 · T1.5 · same-roster-diff-tactics
- `s28-0617-hun-25` 孫權鼠標弓 · T1.5 · new-roster
- `s28-0617-qun-20` 張角飛熊 · T1.5 · same-roster-diff-tactics
- `s28-0617-qun-18` 控制型溫侯弓 · T1.5 · new-roster
- `s28-0617-wei-28` 旭輝弓 · T1.5 · same-roster-diff-tactics
- `s28-0617-qun-19` 暴力騎 · T1.5 · new-roster
- `s28-0617-wei-31` 曹仁太尉盾 · T1.5 · same-roster-diff-tactics
- `s28-0617-wei-29` 淵騎 · T1.5 · new-roster
- `s28-0617-wu-28` 虎臣弓 · T1.5 · same-roster-diff-tactics
- `s28-0617-wu-29` 虎臣騎 · T1.5 · same-roster-diff-tactics
- `s28-0617-shu-22` 蜀槍 · T1.5 · new-roster
- `s28-0617-shu-17` 蜀槍 · T1.5 · new-roster
- `s28-0617-shu-18` 蜀騎 · T1.5 · same-roster-diff-tactics
- `s28-0617-wei-27` 郝昭太尉盾 · T1.5 · same-roster-diff-tactics
- `s28-0617-shu-21` 關羽洞察槍 · T1.5 · same-roster-diff-tactics
- `s28-0617-wu-30` 陸遜肉弓 · T1.5 · same-roster-diff-tactics
- `s28-0617-shu-16` 龍虎盾 · T1.5 · same-roster-diff-tactics
- `s28-0617-shu-33` SP蜀智 · T2 · same-roster-diff-tactics
- `s28-0617-hun-30` 三勢呂呂夏黃 · T2 · same-roster-diff-tactics
- `s28-0617-hun-31` 三勢呂呂太黃 · T2 · same-roster-diff-tactics
- `s28-0617-hun-34` 三勢呂張周 · T2 · same-roster-diff-tactics
- `s28-0617-hun-35` 三勢呂郭周 · T2 · same-roster-diff-tactics
- `s28-0617-hun-32` 三勢張角魏延 · T2 · same-config-as-published
- `s28-0617-shu-34` 五虎槍 · T2 · same-config-as-published
- `s28-0617-wei-32` 司馬盾 · T2 · same-roster-diff-tactics
- `s28-0617-qun-23` 張角群弓 · T2 · same-roster-diff-tactics
- `s28-0617-qun-21` 張角骨頭盾 · T2 · same-roster-diff-tactics
- `s28-0617-wei-35` 爆頭騎 · T2 · same-roster-diff-tactics
- `s28-0617-wei-34` 爆頭騎 · T2 · same-roster-diff-tactics
- `s28-0617-shu-32` 綠帽騎 · T2 · same-roster-diff-tactics
- `s28-0617-shu-31` 虛弱盾劉魏關 · T2 · same-roster-diff-tactics
- `s28-0617-shu-28` 蜀騎 · T2 · same-roster-diff-tactics
- `s28-0617-hun-33` 關夏太 · T2 · same-roster-diff-tactics
- `s28-0617-wu-32` 陸太魯 · T2 · same-roster-diff-tactics
- `s28-0617-hun-29` 霸王弓 · T2 · same-roster-diff-tactics
- `s28-0617-hun-39` 三勢弓 · T2 · new-roster
- `s28-0617-hun-38` 固傷弓 · T2 · new-roster
- `s28-0617-hun-36` 固傷弓 · T2 · new-roster
- `s28-0617-qun-25` 摩卡弓 · T2 · new-roster
- `s28-0617-hun-40` 武鋒呂妹 · T2 · new-roster
- `s28-0617-qun-26` 武鋒華雄 · T2 · new-roster
- `s28-0617-hun-37` 降維弓 · T2 · new-roster

### pk-s28|開荒 (15)

- `s28-kh-sanshi-lu` 三勢陸 · T1 · unparseable(khai-hoang layout)
- `s28-kh-jiang-xia-ke` 姜夏恪 · T1 · unparseable(khai-hoang layout)
- `s28-kh-jiang-tai-cai` 姜太蔡（平民開荒） · T1 · unparseable(khai-hoang layout)
- `s28-kh-zuo-tai-ke` 左太恪 · T1 · unparseable(khai-hoang layout)
- `s28-kh-zhang-guan-cai` 張關蔡 · T1 · unparseable(khai-hoang layout)
- `s28-kh-fa-ke-ma` 法克馬 · T1 · unparseable(khai-hoang layout)
- `s28-kh-qun-gong` 群弓開荒 · T1 · unparseable(khai-hoang layout)
- `s28-kh-shu-qi` 蜀騎 · T1 · unparseable(khai-hoang layout)
- `s28-kh-xia-tai-huang` 菜刀隊（夏太黃） · T2 · unparseable(khai-hoang layout)
- `s28-0617-hun-14` SP朱儁核彈弓 · — · new-roster
- `s28-0617-hun-05` 袁術核彈弓 · — · new-roster
- `s28-wu-qi` 挫銳香香吳騎 · — · same-roster-diff-tactics
- `s28-huchen-qi` 碰瓷當鋒騎 · — · same-roster-diff-tactics
- `s28-0617-wu-21` 碰瓷香香吳騎 · — · same-config-as-published
- `s28-sanshi-lv` 碰瓷呂 · — · same-roster-diff-tactics

### pk-s27|交戰 (39)

- `s27-lp-madai-faguan-dun` 馬岱法關盾（小幫手首發版） · T0 · same-roster-diff-tactics
- `s27-lp-wumou-ay` 五謀臣（阿焰共存版） · T0 · same-roster-diff-tactics
- `s27-lp-juma-gong-ay` 拒馬弓（阿焰共存版） · T0 · same-roster-diff-tactics
- `s27-lp-huangma-qiang-ay` 皇馬槍（阿焰共存版） · T0 · same-roster-diff-tactics
- `s27-lp-huangma-gong-xbs` 皇馬弓（小幫手首發版） · T0 · same-roster-diff-tactics
- `s27-lp-huangma-qiang-xbs` 內戰皇馬槍（小幫手首發版） · T0 · same-config-as-published
- `s27-lp-liubei-faguan-dun` 劉備法關盾（小幫手首發版） · T0 · same-roster-diff-tactics
- `s27-lp-wumou-qi` 五謀騎（小幫手首發版） · T0 · same-config-as-published
- `s27-qianlong-diao` 潛龍貂 · T0 · same-roster-diff-tactics
- `s27-qianlong-luxun` 潛龍陸遜 · T0 · same-roster-diff-tactics
- `s27-ayan-liubei-faguan-dun` 劉備法官盾 · T0.5 · same-roster-diff-tactics
- `s27-ayan-xunyu-nvwang-dun` 荀彧女王盾 · T0.5 · new-roster
- `s27-ayan-xunyou-wumou` 荀攸五謀 · T0.5 · same-roster-diff-tactics
- `s27-ayan-shuzhi-dun` 蜀智盾 · T0.5 · new-roster
- `s27-ayan-zhuge-faguan-dun` 諸葛法官盾 · T0.5 · new-roster
- `s27-ayan-madai-faguan-dun` 馬岱法官盾 · T0.5 · same-roster-diff-tactics
- `s27-lp-dutong-gong` 嘟統弓（小幫手首發版） · T0.5 · same-roster-diff-tactics
- `s27-chengpu-dudu-gong` 程普嘟嘟弓 · T0.5 · new-roster
- `s27-xunyu-taiwei-dun` 荀彧太威盾 · T0.5 · same-roster-diff-tactics
- `s27-lp-beifa-dun` 北伐盾（小幫手首發版） · T0.5 · same-roster-diff-tactics
- `s27-lp-zuolv-qiang` 左呂槍（小幫手首發版） · T0.5 · same-roster-diff-tactics
- `s27-kongzhi-qiang` 控制槍 · T0.5 · same-roster-diff-tactics
- `s27-lp-biyue-dun` 閉月盾（小幫手首發版） · T0.5 · same-roster-diff-tactics
- `s27-lp-qilin-gong` 麒麟弓（小幫手首發版） · T0.5 · same-roster-diff-tactics
- `s27-lp-wu-qi-sr` 吳騎（詩人共存版） · T1 · same-roster-diff-tactics
- `s27-lp-taiwei-dun-sr` 太尉盾（詩人共存版） · T1 · same-roster-diff-tactics
- `s27-lp-taiwei-dun-ay` 太尉盾（阿焰共存版） · T1 · same-roster-diff-tactics
- `s27-quan-qi` 權騎 · T1 · same-config-as-published
- `s27-lp-hanshi-gong-sr` 漢室弓（詩人共存版） · T1 · same-roster-diff-tactics
- `s27-lp-huangma-qiang-sr` 皇馬（詩人共存版） · T1 · same-config-as-published
- `s27-lp-qun-gong-xbs` 群弓（小幫手首發版） · T1 · same-roster-diff-tactics
- `s27-lp-qun-gong-sr` 群弓（詩人共存版） · T1 · same-roster-diff-tactics
- `s27-lp-wumou-sr` 荀攸五謀（詩人共存版） · T1 · same-roster-diff-tactics
- `s27-wanghong-qiang` 網紅槍 · T1 · same-config-as-published
- `s27-lp-guanguanzhang` 關關張（小幫手首發版） · T1 · same-roster-diff-tactics
- `s27-lp-beifa-qiang` 北伐槍（阿焰共存版） · T1.5 · same-roster-diff-tactics
- `s27-han-gong-ayan` 甘寧漢弓 · T1.5 · new-roster
- `s27-chuanzi-gong` 傳子弓 · T2 · same-roster-diff-tactics
- `s27-lp-taoyuan-dun-ay` 桃園盾（阿焰共存版） · T2 · same-roster-diff-tactics

### pk-s27|開荒 (13)

- `s27-kh-sanshi-lu` 三勢陸 · T1 · unparseable(khai-hoang layout)
- `s27-kh-jiang-xia-ke` 姜夏恪 · T1 · unparseable(khai-hoang layout)
- `s27-kh-jiang-tai-cai` 姜太蔡（平民開荒） · T1 · unparseable(khai-hoang layout)
- `s27-kh-zhang-guan-cai` 張關蔡 · T1 · unparseable(khai-hoang layout)
- `s27-kh-qun-gong` 群弓開荒 · T1 · unparseable(khai-hoang layout)
- `s27-kh-shu-qi` 蜀騎 · T1 · unparseable(khai-hoang layout)
- `s27-kh-ma-fa-ke` 馬法恪 · T1 · unparseable(khai-hoang layout)
- `s27-kh-xia-tai-huang` 菜刀隊（夏太黃） · T2 · unparseable(khai-hoang layout)
- `s27-hedan-yuanshu` 核彈袁術 · — · new-roster
- `s27-hedan-zhujun` 核彈朱儁 · — · new-roster
- `s27-pengci-dangfeng-qi` 碰瓷當鋒騎 · — · same-roster-diff-tactics
- `s27-lp-sanshi-lv-pengci` 碰瓷呂（秋石天梯版） · — · same-roster-diff-tactics
- `s27-pengci-ma` 碰瓷馬 · — · same-roster-diff-tactics

### pk-s20|交戰 (119)

- `s20-qun-02` 朱儁群弓 · T0 · same-config-as-published
- `s20-hun-02` 狗馬槍 · T0 · same-roster-diff-tactics
- `s20-qun-01` 皇馬槍 · T0 · same-roster-diff-tactics
- `s20-wu-01` 神火弓 · T0 · same-roster-diff-tactics
- `s20-wu-02` 神火弓（呂蒙版） · T0 · same-roster-diff-tactics
- `s20-wu-03` 神火弓（程普版） · T0 · new-roster
- `s20-hun-01` 關馬槍 · T0 · same-roster-diff-tactics
- `s20-hun-07` 三勢張角法正 · T0.5 · new-roster
- `s20-qun-03` 低配馬超 · T0.5 · new-roster
- `s20-shu-03` 共存麒麟弓 · T0.5 · same-config-as-published
- `s20-wei-02` 司馬太尉盾 · T0.5 · same-config-as-published
- `s20-wei-06` 女王盾 · T0.5 · same-config-as-published
- `s20-wu-08` 形一肉弓 · T0.5 · same-roster-diff-tactics
- `s20-wu-09` 形一肉弓（程普版） · T0.5 · same-config-as-published
- `s20-wei-05` 惇惇盾 · T0.5 · same-roster-diff-tactics
- `s20-wu-04` 新都督 · T0.5 · same-roster-diff-tactics
- `s20-wu-05` 新都督（呂蒙版） · T0.5 · new-roster
- `s20-wu-06` 新都督（程普版） · T0.5 · same-roster-diff-tactics
- `s20-wei-03` 曹真太尉盾 · T0.5 · new-roster
- `s20-shu-04` 桃園盾 · T0.5 · same-roster-diff-tactics
- `s20-wei-01` 榮光槍 · T0.5 · same-config-as-published
- `s20-hun-05` 渡江槍 · T0.5 · same-config-as-published
- `s20-hun-06` 狗官槍 · T0.5 · same-config-as-published
- `s20-hun-04` 皇冠槍 · T0.5 · same-config-as-published
- `s20-shu-01` 等風熊 · T0.5 · same-config-as-published
- `s20-wu-07` 老都督 · T0.5 · same-roster-diff-tactics
- `s20-wei-04` 賈詡太尉盾 · T0.5 · same-roster-diff-tactics
- `s20-hun-03` 超姬槍 · T0.5 · same-config-as-published
- `s20-shu-02` 頂配麒麟弓 · T0.5 · same-roster-diff-tactics
- `s20-shu-05` 香囊蜀槍 · T0.5 · same-roster-diff-tactics
- `s20-shu-08` SP關羽洞察槍 · T1 · same-config-as-published
- `s20-hun-09` 三勢張角法正 · T1 · same-config-as-published
- `s20-hun-11` 三勢賈 · T1 · same-roster-diff-tactics
- `s20-qun-06` 五雷閉月盾 · T1 · same-roster-diff-tactics
- `s20-shu-09` 北伐槍 · T1 · same-config-as-published
- `s20-shu-12` 千里槍 · T1 · same-config-as-published
- `s20-wei-10` 單核富貴騎 · T1 · same-config-as-published
- `s20-hun-12` 天下騎 · T1 · same-roster-diff-tactics
- `s20-wei-18` 奸雄騎 · T1 · same-config-as-published
- `s20-wu-14` 孫權吳槍 · T1 · same-roster-diff-tactics
- `s20-wei-15` 山河盾 · T1 · same-config-as-published
- `s20-qun-04` 張角群弓 · T1 · same-roster-diff-tactics
- `s20-wei-19` 旭輝弓 · T1 · same-config-as-published
- `s20-wei-17` 淵騎 · T1 · same-config-as-published
- `s20-qun-05` 溫侯弓 · T1 · same-config-as-published
- `s20-shu-11` 父女槍 · T1 · same-config-as-published
- `s20-wei-13` 王佐騎 · T1 · same-config-as-published
- `s20-wei-14` 王佐騎 · T1 · same-config-as-published
- `s20-wei-12` 王異騎 · T1 · same-roster-diff-tactics
- `s20-wu-18` 碰瓷吳騎 · T1 · same-config-as-published
- `s20-wu-19` 碰瓷當鋒騎 · T1 · new-roster
- `s20-wu-17` 碰瓷當鋒騎 · T1 · same-config-as-published
- `s20-hun-08` 碰瓷馬 · T1 · same-roster-diff-tactics
- `s20-wei-08` 肉遼騎 · T1 · same-config-as-published
- `s20-wu-21` 虎臣弓 · T1 · same-roster-diff-tactics
- `s20-wu-20` 虎臣弓 · T1 · same-roster-diff-tactics
- `s20-wu-22` 虎臣騎 · T1 · same-config-as-published
- `s20-shu-06` 蜀槍 · T1 · new-roster
- `s20-shu-07` 蜀騎 · T1 · same-roster-diff-tactics
- `s20-wei-07` 遼姬騎 · T1 · same-roster-diff-tactics
- `s20-wei-16` 郝昭太尉盾 · T1 · same-roster-diff-tactics
- `s20-wu-13` 鋼鐵都督 · T1 · same-roster-diff-tactics
- `s20-shu-10` 關羽洞察槍 · T1 · same-config-as-published
- `s20-wu-10` 陸遜吳槍 · T1 · same-roster-diff-tactics
- `s20-wu-11` 陸遜吳槍（呂蒙版） · T1 · new-roster
- `s20-wu-12` 陸遜吳槍（程普版） · T1 · same-roster-diff-tactics
- `s20-wu-15` 陸遜肉弓 · T1 · same-config-as-published
- `s20-wu-16` 陸遜肉弓（程普版） · T1 · same-roster-diff-tactics
- `s20-wei-11` 雙核富貴騎 · T1 · same-roster-diff-tactics
- `s20-wei-09` 飛熊富貴騎 · T1 · same-config-as-published
- `s20-hun-13` 骨盾 · T1 · same-config-as-published
- `s20-hun-10` 鼠標弓 · T1 · same-config-as-published
- `s20-shu-20` SP蜀槍 · T1.5 · same-config-as-published
- `s20-hun-18` 三勢呂呂夏黃 · T1.5 · same-config-as-published
- `s20-hun-19` 三勢呂呂太黃 · T1.5 · same-config-as-published
- `s20-hun-20` 三勢張角魏延 · T1.5 · same-config-as-published
- `s20-qun-07` 五雷閉月弓 · T1.5 · same-roster-diff-tactics
- `s20-wei-20` 司馬盾 · T1.5 · same-roster-diff-tactics
- `s20-wu-25` 天王弓 · T1.5 · same-config-as-published
- `s20-wu-26` 形一弓 · T1.5 · same-config-as-published
- `s20-wei-22` 曹仁太尉盾 · T1.5 · same-config-as-published
- `s20-shu-19` 漢中盾 · T1.5 · same-config-as-published
- `s20-hun-16` 碰瓷呂 · T1.5 · same-config-as-published
- `s20-shu-14` 綠帽騎 · T1.5 · same-roster-diff-tactics
- `s20-wei-21` 荀攸五謀臣 · T1.5 · same-roster-diff-tactics
- `s20-wu-24` 草船弓 · T1.5 · same-config-as-published
- `s20-hun-15` 蒙寵弓 · T1.5 · new-roster
- `s20-shu-18` 虛弱盾劉魏張 · T1.5 · same-roster-diff-tactics
- `s20-shu-13` 虛弱盾劉魏關 · T1.5 · same-config-as-published
- `s20-shu-16` 蜀槍 · T1.5 · same-roster-diff-tactics
- `s20-shu-17` 蜀騎 · T1.5 · same-roster-diff-tactics
- `s20-hun-14` 詩詩盾 · T1.5 · same-config-as-published
- `s20-wu-23` 都督 · T1.5 · same-config-as-published
- `s20-qun-08` 鋒矢三仙盾 · T1.5 · same-config-as-published
- `s20-qun-09` 鋒矢張角盾 · T1.5 · same-roster-diff-tactics
- `s20-hun-17` 霸王弓 · T1.5 · same-roster-diff-tactics
- `s20-shu-15` 魏延洞察槍 · T1.5 · same-config-as-published
- `s20-shu-21` SP蜀智 · T2 · same-config-as-published
- `s20-hun-23` 三勢呂張周 · T2 · same-roster-diff-tactics
- `s20-shu-23` 五虎槍 · T2 · same-config-as-published
- `s20-wu-27` 君王弓 · T2 · same-config-as-published
- `s20-qun-10` 呂父女 · T2 · same-config-as-published
- `s20-wu-29` 孫權法弓 · T2 · same-config-as-published
- `s20-qun-11` 武鋒袁紹 · T2 · same-roster-diff-tactics
- `s20-hun-24` 武鋒趙雲 · T2 · same-roster-diff-tactics
- `s20-hun-22` 武鋒黃忠 · T2 · same-config-as-published
- `s20-wei-25` 爆頭騎 · T2 · same-config-as-published
- `s20-wei-24` 爆頭騎 · T2 · same-config-as-published
- `s20-hun-21` 關夏太 · T2 · same-roster-diff-tactics
- `s20-wu-28` 陸太魯 · T2 · same-config-as-published
- `s20-shu-24` 震懾槍 · T2 · same-roster-diff-tactics
- `s20-shu-22` 震懾蜀騎 · T2 · same-config-as-published
- `s20-wei-23` 魏法騎 · T2 · same-config-as-published
- `s20-wei-26` 反擊盾 · T2 · same-roster-diff-tactics
- `s20-wei-27` 嚇豹騎 · T2 · new-roster
- `s20-shu-25` 太玄槍 · T2 · same-roster-diff-tactics
- `s20-hun-25` 摩卡弓 · T2 · new-roster
- `s20-hun-26` 核彈張 · T2 · same-roster-diff-tactics
- `s20-hun-27` 核彈張 · T2 · same-roster-diff-tactics

### pk-s19|交戰 (4)

- `s19-fanji-dun` 反擊盾 · T2 · same-roster-diff-tactics
- `s19-xiagou-qi` 嚇狗騎 · T2 · new-roster
- `s19-moka-gong` 摩卡弓 · T2 · new-roster
- `s19-hedan-zhang-cao` 核彈張（曹操） · T2 · same-roster-diff-tactics

### Đã gỡ khỏi pk-s28 trên SGSDeck (còn trong publication)

`s28-bianzhong-feixiong`, `s28-buwei-tianxian`, `s28-caijun-qiang`, `s28-caochun-yuan-qi`, `s28-chashao-gong`, `s28-dingpei-shu-gong`, `s28-dongzhuo-fanji-dun`, `s28-fazheng-hedan`, `s28-feixiong-deng-feng-qi`, `s28-feixiong-sunquan-gong`, `s28-feixiong-weifa`, `s28-gouguan-qiang`, `s28-goutou-dun`, `s28-guanguanwei`, `s28-guojia-taiwei`, `s28-hedan-zhangjiao`, `s28-huangjin-dun`, `s28-huchen-qi`, `s28-jianxiong-qi`, `s28-manhong-liubei`, `s28-pengci-bubing`, `s28-qianlong-zhangjiao`, `s28-qun-qiang`, `s28-rongguang-qiang`, `s28-sanshi-fazheng`, `s28-sanshi-jia`, `s28-sanshi-lu`, `s28-sanshi-lv`, `s28-sanshi-wu-qi`, `s28-shenhuo-dun`, `s28-shu-han-dun`, `s28-shu-qi`, `s28-sunquan-fa-gong`, `s28-sunquan-wu-qiang`, `s28-weifa-dun`, `s28-wu-qi`, `s28-wufeng-taishi`, `s28-wufeng-zhen`, `s28-wutai-gong`, `s28-wutugu-huangma`, `s28-xianren-dun`, `s28-xin-zhouyu-dudu`, `s28-xin-zhouyu-laohuo-gong`, `s28-xingyi-taiwei`, `s28-xuruo-gong`, `s28-zhangjiao-qun-dun`, `s28-zhaoyun-wufeng`, `s28-zhenshe-qiang`, `s28-zhenying-neigui`

## SGSDeck status

- Exact roster/configuration inspected: có, theo cache 2026-11-03 (chỉ roster + chiến pháp; điểm chưa parse được).
- Điểm SGSDeck của 323 đội mới: chưa có (parser drift).

## Bước tiếp theo đề xuất

1. Sửa parser theo layout mới (điểm `來源評分`, list hero/faction, chiến pháp Khai hoang) + test fixture từ cache mới.
2. Chạy lại chuỗi `capture → dedup → build_recommended_reference → site_localization` theo `docs/season-team-data.md`; bổ sung bản dịch tên mới.
3. Builder/validator: dừng khi `seasonOptions[].advertisedCountRaw` ≠ tổng `observedCardCount` các scope của mùa (bắt lỗi kiểu S19).

## Ledger

| Allowance | limit | used | remaining |
| --- | --- | --- | --- |
| External sources | 5 | 0 | 5 |
| TQCCL MCP | 5 | 0 | 5 |
