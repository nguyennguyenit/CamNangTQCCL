# Phase C2a: chuỗi UI ja nhóm cộng đồng/quản trị (báo cáo)

Ngày 2026-11-17. Branch `feat/ja-locale-c2a-community` (từ `origin/feat/ja-locale` `4200dc9`). `SITE_LOCALES` vẫn `['vi','zh']`; không ghim localization, không build.

## Kết quả

Biến thể ja (vị trí thứ ba) đã thêm cho mọi lời gọi trong tập file sở hữu. `I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs` không còn dòng nào cho các file này. `npm run check`: 0 lỗi.

| Nhóm file | Lời gọi đã thêm ja |
|---|---|
| `js/community-admin.js` / `-dialogs.js` | ~117 / 16 |
| `js/community-admin-ai.js` / `-audit.js` | 105 / 71 |
| `js/community-admin-scan.js` / `-teams.js` / `-users.js` | 53 / 57 / 78 |
| `js/community-api.js` / `-auth.js` / `-comments.js` / `-hub.js` / `-reports.js` / `-team-cards.js` / `-team-data.js` | 53 / 19 / 14 / 7 / 41 / 25 / 7 |
| `js/community-team-ui.js` / `-detail.js` / `-form-parts.js` / `-state.js` / `-form.js` / `community-teams.js` | 13 / 42 / 15 / 1 / ~143 / ~120 |
| `src/lib/community-team-pages.ts` | 10 |
| `src/components/community/*.astro` (3) | 23 |
| `ReportsPage` / `CommunityTeamsPage` / `AdminPage` / `CommunityRulesPage` / `CommunityTeamPage` | 3 / 3 / 3 / 26 / 33 |

Tổng khoảng 1.100 lời gọi/biến thể (dịch bởi subagent sonnet theo file, soát lại thuật ngữ chéo file).

## Đổi dạng hằng/bảng

- `FACTION_ZH` (`community-team-form.js`) thành `FACTION_LABEL = {tên Việt: {zh, ja}}`; không có `*_JA` song song.
- `TEXT_LANGUAGE_NAME`, `WRITTEN_IN` thêm khoá `ja`. `WRITTEN_IN` ở `CommunityTeamPage.astro` khai `Record<SiteLocale | 'ja', string>` để typecheck xanh khi `SiteLocale` chưa có `ja` (sau khi bật ja, `| 'ja'` thừa nhưng vô hại).
- `community-api.js:436`, `community-admin-users.js:30`: `L/pick('vi-VN','zh-CN','ja-JP')`; có thể đổi sang `LOCALE_INTL` khi ja vào `i18n.js`.

## Obligation đổi

Không có. Không biểu thức nào trong `UI_LITERAL_OBLIGATIONS` thuộc file của phần này (18 obligation nằm ở `lookup-detail`, `roster-recommend-ui`, `team-filter-section`, `render`, `recommended-reference-render`, `lookup-profile`, `lookup-item-pages`).

## 15 mẫu dịch để soát (vi | zh | ja)

1. Đội cộng đồng | 社区阵容 | コミュニティ編成
2. Chiến báo thực chiến | 实战战报 | 実戦戦報
3. Đang chờ duyệt / Đã duyệt / Bị từ chối | 等待审核 / 已通过 / 未通过 | 承認待ち / 承認済み / 却下
4. Khoá tài khoản | 封禁账号 | アカウントを利用停止
5. Tự mở khoá lúc ${at} nếu khoá ngay bây giờ. | 如果现在封禁，将于 ${at} 自动解封。 | 今すぐ利用停止にすると、${at}に自動で解除されます。
6. Soi đội | 截图识阵 | 編成解析
7. Cấp quyền kiểm duyệt viên | 授予版主权限 | モデレーター権限を付与
8. Bị khắc chế bởi | 被克制于 | 不利な相手
9. Gửi để duyệt | 提交审核 | 審査に送信
10. Cần đúng 3 tướng khác nhau, chọn từ danh sách. | 需要三名不同的武将，请从列表中选择。 | 異なる武将3名をリストから選んでください。
11. Xoá đội “…”? | 删除阵容“…”？ | 編成「…」を削除しますか？
12. Bạn thao tác quá nhanh. Hãy thử lại sau ít phút. | 操作过于频繁，请几分钟后再试。 | 操作が多すぎます。数分後にもう一度お試しください。
13. Mắt xích ${n} | 第 ${n} 环 | 第${n}段
14. Chiến báo là kết quả trận thật do người chơi gửi… | 战报是玩家提交的真实战斗结果… | 戦報はプレイヤーが送信した実際の戦闘結果です。どの編成が実戦で強いかを知る手がかりになります。
15. Không xúc phạm, chửi bới, quấy rối… | 不得辱骂、骚扰或人身攻击任何玩家、同盟或服务器。 | 個人、同盟、サーバーに対する侮辱、中傷、嫌がらせ、攻撃をしないでください。

## Thuật ngữ tự chọn (glossary thiếu), nên soát ở H

- 封禁/khoá = 利用停止, mở khoá = 利用停止を解除; kiểm duyệt viên = モデレーター; quản trị viên = 管理者; vai trò = ロール.
- Soi đội = 編成解析 (đã thống nhất lại toàn nhóm); đội/阵容 = 編成; 战报 = 戦報; mùa = シーズン; binh chủng = 兵種; binh thư = 兵法書.
- Chuỗi failover: mắt xích = 段, chuỗi = 経路. effort = 推論強度.
- 克制 = 有利な相手, 被克制于 = 不利な相手 (nhãn trang đội cộng đồng).
- Tên site ja: 「三國志 真戦 攻略手帳」 (theo điều phối), dùng trong title/description các trang `ReportsPage`, `CommunityTeamsPage`, `AdminPage`, `CommunityRulesPage`, `community-team-pages.ts`. `src/lib/blog-seo.ts` (C1) cần `SITE_NAME.ja` cùng giá trị; `community-team-pages.ts` hiện viết literal vì `SITE_NAME.ja` chưa tồn tại, nên đổi sang `SITE_NAME.ja` khi C1 thêm.

## Chỗ cần chú ý khi tích hợp

- Dữ liệu chưa có trường ja nên biến thể ja dùng chữ Hán nguồn: `seasonLabel` (`season.labelZh`), tên tướng/chiến pháp/binh thư trong `community-team-data.js` `recordLabel` (dùng `chinese`, chưa qua `toShinjitai`/tên Nhật của C3), `L(kind.vi, kind.zh, kind.ja ?? kind.zh)` ở `community-admin.js:592,643` (`FEEDBACK_KINDS` ở `js/feedback-kinds.js`, ngoài quyền: cần thêm `ja`, gợi ý 機能要望 / 不具合報告 / 情報の誤り / その他).
- `community-admin-teams.js` ~356 dùng đường dẫn `/ja/doi-cong-dong/` (giả định `LOCALE_PREFIX.ja = '/ja'`).
- Các dòng ja >140 ký tự không ngắt.

## Kiểm

| Lệnh | Kết quả |
|---|---|
| arity `vi,zh,ja` (file của C2a) | sạch |
| `npm run check` | 0 lỗi |
| `npm run test:node` | 866/898; 32 đỏ đều ngoài phạm vi: 28 thiếu `dist/` (không build theo chỉ đạo), 1 preview thiếu `dist/`, 1 dev 500 vs 404 (nhiều khả năng cùng nguyên nhân build đỏ chưa đăng ký data ja), 1 manifest thiếu `lookup-ja.json`/`ja-kanji-variants.json` (C1), 1 arity chạy mặc định (đòi 2 biến thể vì chưa bật ja; hết khi C1 bật) |
