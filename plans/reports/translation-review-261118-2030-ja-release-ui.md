# Duyệt độc lập bản ja chuỗi UI mới — release/261118

Ngày 18/11/2026. Người duyệt: subagent độc lập (không phải người dịch). Phạm vi: dòng `+` có kana trong
`git diff 005e2b12` của 9 file được giao. Số dòng là số dòng trong file hiện tại của worktree.

Nguồn đối chiếu: `pipeline/ja-glossary.json`; chuỗi ja trên main (`005e2b12`) cùng file/màn; dữ liệu ja sẵn có
`data/lookup-ja.json`, `pipeline/ja-translations.json`.

Ngoài phạm vi: `js/roster-list-badges.js:245` (`不足 2 点まで`) là dòng `+` nhưng chuỗi ja giống hệt main (chỉ thêm
tham số đếm), nên không tính.

## Bằng chứng cho các điểm cần lưu ý

- **強化 cho nâng cấp công trình (升级)**: nên đổi. (a) Glossary dùng `強化` cho **增益** (Tăng ích, loại hiệu ứng
  chiến pháp, `js/lookup-detail.js:103`); dùng lại cho nâng cấp công trình thì cùng một chữ mang hai nghĩa trên cùng
  site. (b) Dữ liệu ja đã có của repo dịch đúng cụm 升级时间降低 thành `城内施設のレベルアップ時間が15% → 30%短縮`
  (`data/lookup-ja.json`, `pipeline/ja-translations.json`). Calculator ghi `強化時間短縮`, tức cùng hiệu ứng mà hai chỗ
  gọi khác nhau. (c) Bài hướng dẫn tiếng Nhật về 三國志 真戦 (電撃オンライン) nói về việc nâng công trình bằng
  "レベル2…レベル3まで上げる", không gọi là 強化. Màn hình施設 trong game Nhật thì chưa xác minh được (xem câu hỏi).
  Đề xuất: `レベルアップ`.
- **失効 cho thu hồi token**: nên đổi thành `無効化`. 失効 nghĩa gốc là "hết hiệu lực/hết hạn", nên ở danh sách token,
  trạng thái `失効済み` (đã thu hồi) dễ lẫn với `期限切れ` (đã hết hạn) nằm ngay cạnh. Web Nhật thường dùng
  `無効化` cho thao tác revoke. Không chọn `取り消し` vì màn này đã dùng `取り消しました` cho Hoàn tác.
- **照合 cho đối chiếu**: OK. Main đã dùng 照合 cho 对照/核对 (`community-admin-scan.js`, `lookup-detail.js`:
  `未照合`).
- **固有戦法 cho chiến pháp tự mang**: OK. Trùng với `lookup-detail.js:615` (`固有戦法`) và
  `lookup-tactic-view.js` (`INNATE` = `固有`).
- **Hộp kho**: main dùng `在庫ボックス` (`roster-recommend-ui.js:225`, nhãn ô chọn hộp trên cùng màn). Chuỗi mới
  dùng `ボックス` trơn, nên đề xuất thêm `在庫`.
- **API トークン**: main viết `APIキー` liền (`community-admin-ai.js`), và menu mới cũng viết `ツール用APIトークン`.
  Tiêu đề hộp thoại có dấu cách thì lệch, nên đề xuất viết liền.
- **耗时**: `js/lookup-master.js:783` dịch là `所要時間`. Các câu mới trong calculator dùng `時間`, nên đề xuất
  `所要時間` ở những câu cần sửa vì lý do khác.

## Bảng duyệt

### js/building-upgrade-calculator.js

| file:dòng | vi | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| building-upgrade-calculator.js:61 | Thiếu dữ liệu cấp ${list}: tài nguyên và thời gian | `Lv ${list} のデータがありません：資源と時間` | SỬA | `Lv ${list} の資源・所要時間データがありません` | Đặt "：" sau câu đã kết thúc bằng ません nghe như dịch máy. Gộp thành một mệnh đề cho tự nhiên. 耗时 = 所要時間 theo lookup-master |
| building-upgrade-calculator.js:62 | Thiếu dữ liệu cấp ${list}: tài nguyên | `Lv ${list} のデータがありません：資源` | SỬA | `Lv ${list} の資源データがありません` | Như dòng 61 |
| building-upgrade-calculator.js:63 | Thiếu dữ liệu cấp ${list}: thời gian | `Lv ${list} のデータがありません：時間` | SỬA | `Lv ${list} の所要時間データがありません` | Như dòng 61 |
| building-upgrade-calculator.js:81 | Tính tài nguyên nâng cấp | `強化資源の計算` | SỬA | `レベルアップ資源の計算` | Không dùng 強化 (trùng 增益 trong glossary). Dữ liệu ja gọi 升级 công trình là レベルアップ |
| building-upgrade-calculator.js:85 | Cộng gỗ, đá, sắt và thời gian cần để nâng cấp nhiều công trình | `複数の施設の強化に必要な木材・石材・鉄鉱と時間を合計します` | SỬA | `複数の施設のレベルアップに必要な木材・石材・鉄鉱と所要時間を合計します` | Lý do giống dòng 81. 木材/石材/鉄鉱 đúng COST_LABELS |
| building-upgrade-calculator.js:132 | Cấp hiện tại | `現在のレベル` | OK | | |
| building-upgrade-calculator.js:133 | Cấp đích | `目標レベル` | OK | | |
| building-upgrade-calculator.js:139 | Bỏ dòng ${name} | `${name}の行を削除` | OK | | aria-label, đúng nghĩa |
| building-upgrade-calculator.js:148 | Cấp đích cần lớn hơn cấp hiện tại. | `目標レベルは現在のレベルより高くしてください。` | OK | | |
| building-upgrade-calculator.js:176 | Tổng chưa gồm ${n} cấp thiếu dữ liệu. | `データのない ${n} レベル分は合計に含まれていません。` | OK | | Giữ đủ biến và ý |
| building-upgrade-calculator.js:180 | Thời gian là tổng thời gian nâng lần lượt từng cấp, chưa trừ hiệu quả giảm thời gian nâng cấp. | `時間は1レベルずつ強化した場合の合計で、強化時間短縮の効果は差し引いていません。` | SỬA | `所要時間は1レベルずつ上げた場合の合計で、レベルアップ時間短縮の効果は差し引いていません。` | 強化時間短縮 lệch với dữ liệu ja của chính hiệu ứng này (`レベルアップ時間…短縮`). Dùng "上げた" để tránh lặp "レベル…レベルアップ" |
| building-upgrade-calculator.js:193 | Chưa có công trình nào. Bấm “Thêm công trình” để bắt đầu. | `施設がまだありません。「施設を追加」を押して始めてください。` | OK | | Chữ trong 「」 khớp nhãn nút ở dòng 195 |
| building-upgrade-calculator.js:195 | + Thêm công trình | `+ 施設を追加` | OK | | |

### js/community-api.js

| file:dòng | vi | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| community-api.js:98 | Đã đủ 10 token còn hiệu lực. Hãy thu hồi bớt token cũ rồi tạo lại. | `有効なトークンが上限の10個に達しています。古いトークンを失効させてから作成し直してください。` | SỬA | `有効なトークンが上限の10個に達しています。古いトークンを無効化してから作成し直してください。` | 失効 → 無効化 (xem phần bằng chứng) |

### js/recruit-tokens.js

| file:dòng | vi | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| recruit-tokens.js:29 | Đã thu hồi ${date} | `${date} に失効済み` | SỬA | `${date} に無効化済み` | Đứng cạnh `期限切れ`; 失効済み đọc như "đã hết hạn" |
| recruit-tokens.js:30 | Hết hạn ${date} | `${date} に期限切れ` | OK | | |
| recruit-tokens.js:61 | Đã sao chép token. | `トークンをコピーしました。` | OK | | |
| recruit-tokens.js:64 | Không sao chép được, hãy chọn và sao chép thủ công. | `コピーできませんでした。手動で選択してコピーしてください。` | OK | | |
| recruit-tokens.js:67 | Sao chép | `コピー` | OK | | |
| recruit-tokens.js:69 | Token mới | `新しいトークン` | OK | | |
| recruit-tokens.js:74 | Sao chép ngay: token chỉ hiện một lần. Lưu vào nơi an toàn (vd. trình quản lý mật khẩu), không dán lên chat hay repo. | `今すぐコピーしてください。トークンは一度しか表示されません。安全な場所（パスワードマネージャーなど）に保存し、チャットやリポジトリに貼り付けないでください。` | OK | | Đủ ý, ngoặc toàn khổ |
| recruit-tokens.js:83 | Tạo token | `トークンを作成` | OK | | |
| recruit-tokens.js:85 | Token đã tạo | `作成済みのトークン` | OK | | |
| recruit-tokens.js:89 | Chưa có token nào. | `トークンはまだありません。` | OK | | |
| recruit-tokens.js:97 | Thu hồi token ${name} | `トークン ${name} を失効` | SỬA | `トークン ${name} を無効化` | Thống nhất 無効化 |
| recruit-tokens.js:124 | Xác nhận thu hồi | `失効を確定` | SỬA | `無効化を確定` | Thống nhất 無効化 |
| recruit-tokens.js:130 | Đã thu hồi token ${name}. | `トークン ${name} を失効させました。` | SỬA | `トークン ${name} を無効化しました。` | Thống nhất 無効化 |
| recruit-tokens.js:141 | Công cụ tự động | `自動化ツール` | OK | | |
| recruit-tokens.js:142 | Token API | `API トークン` | SỬA | `APIトークン` | Viết liền như `ツール用APIトークン` (recruit-tracker.js:760) và `APIキー` trên main |
| recruit-tokens.js:144 | Đóng | `閉じる` | OK | | |
| recruit-tokens.js:149 | Cho công cụ tự động ghi lượt quay gói Danh tướng PK vào Theo dõi chiêu mộ của bạn qua `POST /api/recruit/pulls`. Token chỉ có quyền ghi lượt quay. | `自動化ツールが POST /api/recruit/pulls 経由で PK名将登用の回数をあなたの登用記録に書き込めるようにします。トークンには登用回数を書き込む権限しかありません。` | OK | | PK名将登用 và 登用記録 đúng glossary; giữ nguyên mã endpoint |
| recruit-tokens.js:169 | Đã tạo token. | `トークンを作成しました。` | OK | | |
| recruit-tokens.js:180 | Đang tải… | `読み込み中…` | OK | | |

### js/recruit-tracker.js, js/recommended-reference-render.js, SectionPage.astro

| file:dòng | vi | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| recruit-tracker.js:760 | Token API cho công cụ | `ツール用APIトークン` | OK | | |
| recommended-reference-render.js:569 | Thẻ Kỳ Lược | `奇略カード` | OK | | Đúng glossary (奇略, thẻ là 奇略カード) |
| SectionPage.astro:115 | Đội chuẩn của các mùa khác, mỗi mùa một trang. | `ほかのシーズンのおすすめ編成を、シーズンごとに1ページで掲載しています。` | OK | | おすすめ編成 đúng glossary |

### js/roster-pasted-name-list-panel.js

| file:dòng | vi | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| roster-pasted-name-list-panel.js:36 | Dán danh sách tên | `名前リストを貼り付け` | OK | | |
| roster-pasted-name-list-panel.js:50 | Danh sách tên | `名前リスト` | OK | | |
| roster-pasted-name-list-panel.js:54 | Chép từ game, Zalo hoặc Excel: mỗi tên một dòng, hoặc ngăn bằng dấu phẩy, dấu chấm phẩy. Nhận tên Việt, Hán-Việt hoặc chữ Hán. Chưa ghi vào kho cho tới khi bạn xác nhận. | `ゲーム、Zalo、Excel からコピーできます。1行に1つの名前、またはカンマ・セミコロン区切りで入力してください。ベトナム語名、漢越音、漢字に対応しています。確認するまで在庫には書き込みません。` | SỬA | `ゲーム・Zalo・Excel からコピーして貼り付けられます。1行に1つの名前、またはカンマ・セミコロン区切りで入力してください。ベトナム語名、漢越音、漢字に対応しています。確認するまで在庫には書き込みません。` | "からコピーできます" chỉ nói "có thể sao chép từ…" mà thiếu ý dán vào ô này. Phần còn lại đúng |
| roster-pasted-name-list-panel.js:96 | Hủy | `キャンセル` | OK | | |
| roster-pasted-name-list-panel.js:99 | Thêm ${count} món vào kho | `${count} 件を在庫に追加` | OK | | |
| roster-pasted-name-list-panel.js:113 | · từ “${typed}” | ` ·「${typed.join("」「")}」から` | OK | | Dùng 「」 kiểu Nhật |
| roster-pasted-name-list-panel.js:114 | · đã có trong kho | ` · 在庫にあり` | OK | | |
| roster-pasted-name-list-panel.js:122 | Mỗi tên dưới đây khớp nhiều món. Chọn đúng món hoặc để “Bỏ qua”. | `以下の名前はそれぞれ複数の項目に一致します。正しい項目を選ぶか、「スキップ」のままにしてください。` | OK | | 「スキップ」 khớp option ở dòng 126 |
| roster-pasted-name-list-panel.js:126 | Bỏ qua | `スキップ` | OK | | |
| roster-pasted-name-list-panel.js:143 | Không nhận ra | `認識できない名前` | OK | | |
| roster-pasted-name-list-panel.js:147 | Không thêm vào kho. Sửa chính tả rồi đối chiếu lại, hoặc tìm trong danh mục bên dưới. | `在庫には追加しません。綴りを直して再照合するか、下の一覧から検索してください。` | OK | | 照合 khớp main |
| roster-pasted-name-list-panel.js:156 | Chiến pháp tự mang đi theo tướng, không cần thêm vào kho. | `固有戦法は武将と一緒に得られるため、在庫に追加する必要はありません。` | OK | | 固有戦法 khớp lookup-detail.js:615 |
| roster-pasted-name-list-panel.js:159 | từ “${text}” | `「${text}」から` | OK | | |
| roster-pasted-name-list-panel.js:174 | Đã thêm ${n} món vào kho. ${m} tên không nhận ra vẫn còn trong ô để sửa. | `${n} 件を在庫に追加しました。認識できなかった ${m} 件の名前は修正できるよう入力欄に残しています。` | OK | | |
| roster-pasted-name-list-panel.js:175 | Đã thêm ${n} món vào kho. | `${n} 件を在庫に追加しました。` | OK | | |
| roster-pasted-name-list-panel.js:191 | ${a} khớp · ${b} cần chọn · ${c} không nhận ra | `一致 ${a} 件 · 要選択 ${b} 件 · 認識できない名前 ${c} 件` | OK | | Giữ đủ 3 biến |
| roster-pasted-name-list-panel.js:193 | Chỉ đối chiếu ${n} tên đầu, bỏ ${m} tên còn lại. | `最初の ${n} 件の名前だけを照合し、残りの ${m} 件は無視しました。` | OK | | |
| roster-pasted-name-list-panel.js:206 | Chưa có tên nào để đối chiếu. | `照合する名前がまだありません。` | OK | | |

### js/roster-recommend-ui.js

| file:dòng | vi | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| roster-recommend-ui.js:939 | Đã gỡ ${n} món vừa thêm. | `追加したばかりの ${n} 件を取り消しました。` | OK | | |
| roster-recommend-ui.js:941 | Hoàn tác | `元に戻す` | OK | | Khớp recruit-tracker.js trên main |
| roster-recommend-ui.js:944 | Đã thêm ${n} món của đội ${label} vào hộp “${box}”. | `${label} に不足していた ${n} 件をボックス「${box}」に追加しました。` | SỬA | `${label} に不足していた ${n} 件を在庫ボックス「${box}」に追加しました。` | Nhãn ô chọn hộp trên cùng màn là `在庫ボックス` (dòng 225, main) |
| roster-recommend-ui.js:945 | Đã thêm ${n} món của đội ${label} vào kho. | `${label} に不足していた ${n} 件を在庫に追加しました。` | OK | | |
| roster-recommend-ui.js:1307 | Tôi có tất cả món thiếu của đội này: ${label}, ${n} món | `この編成に不足しているものはすべて持っている：${label}、${n} 件` | OK | | aria-label chứa nguyên nhãn hiển thị (WCAG 2.5.3) |
| roster-recommend-ui.js:1312 | Tôi có tất cả món thiếu của đội này | `この編成に不足しているものはすべて持っている` | OK | | Cùng kiểu nút `この武将を持っている` trên main (dòng 1168) |

## Tổng kết

- Tổng số chuỗi đã duyệt: **60**
- OK: **46**
- Cần sửa: **14**. Gồm calculator 6 (bỏ 強化 ở 3 chuỗi, sửa câu thiếu dữ liệu ở 3 chuỗi), thu hồi token 5
  (失効→無効化), `APIトークン` 1, `在庫ボックス` 1, câu hướng dẫn dán 1.
- Không có chữ Việt hay giản thể lẫn trong ja. Mọi biến `${...}` và mã endpoint đều được giữ nguyên.

## Câu hỏi chưa giải quyết

1. Chưa xác minh được nút nâng cấp công trình trong UI game 三國志 真戦 bản Nhật là `レベルアップ`, `強化` hay
   `アップグレード`. Đề xuất `レベルアップ` dựa trên dữ liệu ja sẵn có của repo và bài 電撃オンライン. Nếu có ảnh
   chụp màn hình施設 của bản Nhật thì nên chốt lại, sau đó thêm mục 升级 (施設) vào `ja-glossary.json`.
2. Chuỗi chỉ có kanji nằm ngoài phạm vi kana nên chưa tính: tile `時間` (building-upgrade-calculator.js:171),
   `固有戦法` (roster-pasted-name-list-panel.js:155), `無期限` và `有効期限 ${date}` (recruit-tokens.js:31-32).
   Nếu đổi sang `所要時間` thì tile ở dòng 171 cũng nên đổi theo.
3. Đơn vị đếm "món" trên main đang lẫn `点` (roster-list-badges) và `件` (roster-recommend-ui). Chuỗi mới dùng `件`.
   Có nên thống nhất về một chữ không?

Nguồn web: [電撃オンライン — 三國志真戦日記#04](https://dengekionline.com/articles/81266/)

## Bổ sung: 5 bản dịch dữ liệu Tra cứu (ja-translations.json)

Người duyệt độc lập, 18/11/2026. Đối chiếu `pipeline/ja-glossary.json` và các bản dịch có sẵn trong file:
攜帶者 → `装備者` (đa số, 1 chỗ `携帯者`), 友軍群體 → `友軍群体`, 統御/统御 → `コスト`, 疊加 → `重複`,
陣營 → `陣営`, 賽季 → `シーズン`. 內政廳, 漢室, 群雄並起, 輔佐漢室 chưa xuất hiện ở `src` nào khác.
Chữ Hán của ghi chú phe được dịch từ bản Việt ("Sảnh Chính › Hán Thất › Phò Tá Hán Thất" / "… › Quần Hùng Tịnh Khởi").

| khóa | src | ja hiện tại | KL | ja đề xuất | lý do |
|---|---|---|---|---|---|
| 059153a86f87 | 我軍武將統御各不相同時，敵軍普通攻擊有70%機率選擇我軍兵力最高的單體；且我軍武將造成傷害後，有60%機率（受攜帶者最高屬性影響）使友軍群體（2人）造成傷害提升2.5%→5%，受到傷害後有60%機率（受攜帶者最高屬性影響）使友軍群體（2人）受到傷害降低2.5%→5%（每種效果皆可疊加，最多4次，持續3回合） | 自軍武将のコストがすべて異なる時、敵軍の通常攻撃は70%の確率で自軍の兵力が最も高い単体を選択する；さらに自軍武将がダメージを与えた後、60%の確率（装備者の最高属性の影響を受ける）で友軍群体（2人）の与ダメージが2.5%→5%上昇し、ダメージを受けた後、60%の確率（装備者の最高属性の影響を受ける）で友軍群体（2人）の被ダメージが2.5%→5%低下する（各効果は重複可、最大4回、3ターン持続） | OK | | Đủ số 70%/60%/2.5%→5%/4/3 và `→`. 統御→コスト, 造成傷害→与ダメージ, 受到傷害→被ダメージ, 回合→ターン, 機率→確率, 疊加→重複, 攜帶者→装備者 đều khớp glossary và bản có sẵn. Dấu `；` giống các mô tả khác trong file. |
| 0f9fc51142ce | 自2026年11月4日更新起為漢陣營，此前為群雄陣營。每賽季可在內政廳 › 漢室 › 群雄並起轉回群雄陣營（最多 3 名武將；重新設定需消耗 50K「Châu」並等待 1 小時）。 | 2026年11月4日のアップデート以降は漢陣営、それ以前は群雄陣営。シーズンごとに内政庁 › 漢室 › 群雄並起で群雄陣営に戻せる（最大3名の武将；再設定には50K「Châu」の消費と1時間の待機が必要）。 | OK | | Đúng nghĩa, giữ ngày, 3, 50K, 1 giờ, `›` và tên menu 群雄並起 nguyên văn. 陣營→陣営, 賽季→シーズン khớp bản có sẵn. |
| 329585760a3e | 自2026年11月4日更新起為漢陣營，此前為魏陣營。 | 2026年11月4日のアップデート以降は漢陣営、それ以前は魏陣営。 | OK | | Cùng mẫu câu với 0f9fc51142ce. |
| ac3044c71d0f | 自2026年11月4日更新起為漢陣營，此前為群雄陣營。 | 2026年11月4日のアップデート以降は漢陣営、それ以前は群雄陣営。 | OK | | Cùng mẫu câu với 0f9fc51142ce. |
| d5b312ae6946 | 自2026年11月4日更新起，每賽季可在內政廳 › 漢室 › 輔佐漢室轉為漢陣營（最多 3 名武將；重新設定需消耗 50K「Châu」並等待 1 小時）。 | 2026年11月4日のアップデート以降、シーズンごとに内政庁 › 漢室 › 漢室補佐で漢陣営に転換できる（最大3名の武将；再設定には50K「Châu」の消費と1時間の待機が必要）。 | SỬA | 2026年11月4日のアップデート以降、シーズンごとに内政庁 › 漢室 › 輔佐漢室で漢陣営に転換できる（最大3名の武将；再設定には50K「Châu」の消費と1時間の待機が必要）。 | Tên menu bị đảo thành `漢室補佐`, trong khi chuỗi anh em 0f9fc51142ce giữ nguyên `群雄並起`. Chưa có nguồn Nhật xác nhận tên `漢室補佐`, nên giữ đúng chữ của `src` là `輔佐漢室` (cũng khớp thứ tự "Phò Tá Hán Thất"). 輔佐 là chữ dùng được trong tiếng Nhật. Phần còn lại giữ nguyên. |

Kết quả: **OK 4 / SỬA 1**.

Câu hỏi chưa giải quyết:

1. Tên menu chính thức trong bản Nhật của 內政廳 / 輔佐漢室 / 群雄並起 (mùa 漢焔不滅) chưa xác minh được. Trang
   sangokushi-shinsen.com/season/ không ghi tên các menu này. Khi có ảnh chụp màn hình bản Nhật thì nên chốt và thêm vào
   `ja-glossary.json` (liên quan #87).
2. Sau khi sửa d5b312ae6946, cần chạy lại pipeline để `data/lookup-ja.json` (hiện vẫn chứa `漢室補佐`) nhận bản mới.
