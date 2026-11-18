# Phase C2b: chuỗi giao diện tiếng Nhật cho nhóm công cụ (báo cáo)

Ngày 2026-11-17. Branch `feat/ja-locale-c2b-tools`, tạo từ `origin/feat/ja-locale` (`4200dc9`). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-c2b`. `SITE_LOCALES` vẫn `['vi','zh']`.

## Kết quả

`I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs` không còn lỗi ở 13 file đã sửa (trước đó khoảng 600 lỗi trong nhóm này). Các lỗi còn lại của test này nằm ở file ngoài danh sách (ví dụ `js/my-teams-inline-picker.js`, 20 lời gọi), chỉ ghi nhận ở đây.

## Số lượng

Khoảng 600 lời gọi `L(` được thêm biến thể thứ ba, cộng các bảng theo locale.

| File | Lời gọi `L` | Bảng/hằng đổi |
|---|---|---|
| `js/analyze.js` | 149 | không |
| `js/roster-recommend-ui.js` | ~175 | `RULE_REASON_LABELS` thêm `ja`; `SCAN_TYPES[].unit` chuỗi -> `{vi, zh, ja}` (bỏ `unitZh`) |
| `js/recruit-tracker.js` | ~170 | `VALUE_CLASS_ZH` -> `VALUE_CLASS_LABELS {vi,zh,ja}` |
| `js/recruit-tracker-store.js` | 16 | `LEGACY_DAILY_SLOT_DEFS` `{key,label,labelZh}` -> `{key, labels:{vi,zh,ja}}` |
| `js/roster-picker.js` | 15 | 12 bản ghi `*_LABELS` thêm `ja`, `FACTIONS` tuple 3 phần tử |
| `js/roster-list-badges.js` | 36 | không |
| `js/feedback.js`, `inline-confirm.js`, `turnstile.js` | 4, 3, 2 | không |
| `js/roster-scan-map.js`, `roster-scan-state.js`, `team-recommend-engine.js`, `analyze-map.js` | 2, 1, 1, 1 | không |

Không đổi (không có chuỗi theo locale): `roster-list-coverage`, `roster-scan-writer`, `roster-cloud-store`, `roster-conflict-view`, `roster-coverage`, `roster-id-resolve`, `roster-season-candidates`, `roster-sync`, `analyze-state`. Các bảng Hán->Việt nội bộ (`STAT_MAP`, `UNIT_LABELS`) là dữ liệu khớp, không hiển thị theo locale.

## Hành vi

- `callWorker` gửi `locale: currentLocale()` (`"vi" | "zh" | "ja"`) cho mọi mode ảnh. `explainSubstitute` mang `locale: currentLocale()` trong `context`; hiệu ứng gửi là chữ Trung nguồn (`item.effect`) ở cả zh và ja, không có bản dịch máy.
- `initAnalyze` nhận thêm `deps.jaEntries` (là `entries` của `data/lookup-ja.json`). Khi locale là ja và có `jaEntries`, ba từ điển đi qua `withLocaleAliases(dict, jaEntries)` trước `createEntityIndex`. **Caller (`js/app.js:635`) chưa truyền `jaEntries`**; `app.js` không thuộc phần này, cần C2 phần còn lại hoặc C1 nạp `lookup-ja.json` rồi truyền vào.
- Intl và `localeCompare` ở `analyze.js`, `recruit-tracker.js` chọn theo ba locale (`vi-VN`/`zh-CN`/`ja-JP`).
- Biến cục bộ `const zh = !contentLocaleIsVietnamese(...)` giữ nguyên: nghĩa là "hiện chữ nguồn Hán", đúng cho ja. Chỉ chỗ chọn chuỗi UI/định dạng mới tách ba nhánh.
- Tên site ja trong tiêu đề thẻ PNG: 「三國志 真戦 攻略手帳」.

## Phụ thuộc và test

- `js/locale-name-aliases.js` do phần C3 tạo; chưa có trên branch này. `analyze.js` import `./locale-name-aliases.js` theo chữ ký `withLocaleAliases(dict, jaEntries)`. Để chạy test tôi dùng một stub cục bộ **không commit**; khi chưa có file thật, mọi test import `analyze.js` sẽ lỗi nạp module.
- Test mới `tests-js/analyze-worker-locale.test.mjs`: kiểm `locale` trong payload cho vi/zh và ja (ca ja chỉ chạy khi `ja` đã có trong `SITE_LOCALES`).
- `npm run test:node` (có stub): 32 fail so với 31 của baseline. 31 fail là test cần `dist` (chưa build, giống baseline). Fail thêm là `mọi lời gọi L()/pick() có đúng 2 biến thể`: test này đếm đúng `SITE_LOCALES.length` và sẽ xanh khi C1 nối `'ja'` ở commit cuối.
- `npm run check`: đỏ vì policy localization chưa ghim lại (hash nguồn 9 file đổi, 6 obligation dưới đây). Theo chỉ dẫn không sửa `pipeline/site_localization.py`, không ghim. Không chạy build.

## Obligation `ui:roster/*` đổi (cũ -> mới), trong `pipeline/site_localization.py`

Tất cả ở `js/roster-recommend-ui.js`:

| Entity | Cũ | Mới |
|---|---|---|
| `ui:roster/scan-count` | `${total} ${scan.unit} đã đọc` | `${total} ${scan.unit.vi} đã đọc` |
| `ui:roster/scan-pick-action` | `L("Chọn ảnh", "选择图片")` | `L("Chọn ảnh", "选择图片", "画像を選択")` |
| `ui:roster/flag-check` | `L("kiểm tra", "待核对")` | `L("kiểm tra", "待核对", "要確認")` |
| `ui:roster/result-tactics` | `L("Chiến pháp", "战法")` | `L("Chiến pháp", "战法", "戦法")` |
| `ui:roster/chip-count-truncated` | `${items.length} ${scan.unit} · hiện ${visible.length}` | `${items.length} ${scan.unit.vi} · hiện ${visible.length}` |
| `ui:roster/hero-row-label` | `L("Tướng", "武将")` | `L("Tướng", "武将", "武将")` |

## 15 mẫu dịch (vi | zh | ja)

1. Ráp được | 可组建 | 編成可能
2. Soi đội | 识别阵容 | 編成を解析
3. Binh thư lệch | 兵书不同 | 兵法書が相違
4. Thiếu chiến pháp | 缺少战法 | 戦法が不足
5. Đã đọc xong. Kiểm tra lại dữ liệu bên dưới. | 识别完成，请核对下方数据。 | 読み取りが完了しました。下のデータを確認してください。
6. Còn ${pending} ô cần xác nhận trước khi đối chiếu. | 还有 ${pending} 格需确认后才能比对。 | 比較するには、あと ${pending} マスの確認が必要です。
7. Thiếu ${n} món | 缺 ${n} 件 | ${n} 点不足
8. Xác thực chống bot không thành công. Tải lại trang rồi thử lại. | 人机验证未通过，请刷新页面后重试。 | ボット対策の認証に失敗しました。ページを再読み込みしてもう一度お試しください。
9. Cảm ơn bạn! Góp ý đã được gửi. | 感谢反馈！已成功提交。 | ご意見ありがとうございます。送信が完了しました。
10. Tìm tên Việt, Hán-Việt hoặc chữ Hán… | 搜索越南名、汉越音或汉字… | ベトナム語名・漢越音・漢字で検索…
11. Bảo hiểm 5★ / mốc bảo hiểm | 5★ 保底进度 | 5★ 天井の進捗
12. Gói hạn giờ / Đột xuất | 限时 / 临时卡包 | 期間限定 / 臨時パック
13. còn ${days} ngày | 剩 ${days} 天 | 残り ${days} 日
14. Xóa tài khoản "…" và dữ liệu chiêu mộ…? | 删除账号“…”及其招募数据？ | アカウント「…」とその招聘データを削除しますか？
15. Đội đã xây dựng | 已组建队伍 | 編成済みの部隊

## Thuật ngữ tự chọn ngoài glossary (cần đối chiếu với game Nhật)

部隊 (队伍), 編成 (阵容), ランク (梯度), 陣法戦法, 兵種戦法, 赤度優先, 差し替え (替换), 図鑑 (图鉴/Tra cứu), 天井 (保底), 招聘 và ガチャ/パック (招募/卡池/卡包), 推奨編成 (Đội chuẩn), その他の編成 (Đội khác). Tiêu đề tên màn hình game "PK 名将招募" đang dịch "PK 名将招聘の画面".

## Lưu ý cho phần khác

- `roster-picker.js` `label(item)` và `roster-conflict-view.js` `teamLabel` do bên gọi cung cấp; bên gọi cần cho ja hiện chữ Hán nguồn như zh.
- `analyze-map.js` `mapRead` trả cả `statFocus` (Việt) và `statFocusCn`; chỗ hiển thị ở file khác cần dùng `statFocusCn` cho ja.
- `relativeTime(x, "ja")` được gọi trong `roster-recommend-ui.js`; helper cùng file, dùng `Intl.RelativeTimeFormat`.
