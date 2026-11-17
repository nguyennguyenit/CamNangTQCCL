# Phase C2c: chuỗi UI ja cho đội của tôi, danh sách/chi tiết đội, component trang

Ngày 2026-11-17. Branch `feat/ja-locale-c2c-teams` (từ `feat/ja-locale` 4200dc9). Worktree `/Users/plateau/Project/CamNangTQCCL-ja-c2c`. `SITE_LOCALES` vẫn `['vi','zh']`.

## Kết quả

- `I18N_ARITY_LOCALES=vi,zh,ja node --test tests-js/i18n-call-arity.test.mjs`: không còn lỗi ở mọi file thuộc C2c. Lỗi còn lại ở file ngoài danh sách (C2a/C2b/C3/C1): `js/community-*.js`, `roster-*`, `recruit-tracker*`, `analyze*`, `lookup-*`, `unified-lookup`, `website-display`, `src/lib/blog-*`, `community-team-pages`, `structured-data`, `lookup-*-pages`, `js/feedback.js`, `js/inline-confirm.js`, `js/turnstile.js`, `js/team-recommend-engine.js`, `js/lookup-page.js`, `js/community-team-*`.
- `npm run test:node`: 865 pass, 33 fail. Cả 33 đều ngoài C2c:
  - 31 test cần `dist/` (`astro-dist-contract`, `seo-dist-contract`, `astro-dev-contract`): chưa build (build đang đỏ ở nhánh tích hợp).
  - `i18n-call-arity` chạy mặc định 2 locale: fail vì file đã có 3 biến thể (hết khi C1 bật `'ja'`).
  - `website-display` "requests every listed source": chỉ fail khi chạy song song, chạy riêng 14/14 pass (cả trước và sau thay đổi).
- `npm run check`: đỏ ở bước `site_localization check` vì (a) hash nguồn của 15 file đổi và (b) 8 obligation bên dưới. Cả hai chờ bước ghim lại và sửa `pipeline/site_localization.py` (ngoài sở hữu). `astro check`: chỉ còn 3 lỗi `landing-stats.ts` (bảng `Record<SiteLocale,…>` và `localeNumber` không nhận khoá `ja` tới khi `SiteLocale` có `ja`); tự hết khi C1 bật.

## Số lời gọi (xấp xỉ, theo báo cáo từng nhóm)

| Nhóm | File | Lời gọi/bảng |
|---|---|---|
| Đội của tôi (js) | `my-teams`, `-editor`, `-inline-picker`, `-save-button`, `-ui`, `-cards`, `-sections` | 193 + 72 |
| Hiển thị | `render.js` 104, `season-context` 6 bảng, `season-ui-state` 3, `detail-actions` 4 | 117 |
| Danh sách/chi tiết đội | `recommended-reference-render` ~75, `-state` 6 + bảng nhãn, `team-filter-section` 36 + 2 bảng, `team-detail` 8, `khaihoang-detail` 9, `app` 16 | ~150 |
| Trang chủ + trang đội (astro) | `Landing` ~77, `SectionPage` 21, `SeasonPage` 11, `RecommendedDetail` 11, `LegacyDetail` 5, `KhaiHoangDetail` 5, `MyTeamsPage` 17 | ~147 |
| Chính sách (astro) | `TermsPage` 36, `PrivacyPage` 52, `DisclaimerPage` 27, `PolicyPage` 3 | 118 |
| `src/lib` | `landing-stats` (3 + bảng `LANDING_COPY.ja`), `official-links` (8 mục), `season-pages` 1, `policy-pages` (4 trang × 2 trường) | ~25 |
| Tổng | | ~820 |

Hằng `*_ZH`: `LEGACY_LABEL_ZH` thành `LEGACY_LABEL = {zh, ja}` (`legacyLabelZh` giữ tên/chữ ký), `FACET_LABEL_ZH` thành `FACET_LABEL_HAN = {zh, ja}`. `VIEW_OPTIONS` thêm `labelJa`/`ariaJa`. `official-links` thêm `labelJa`/`descriptionJa`. Không có hằng `*_JA` song song. `modifiedTacticPrefix` giữ tuple 2 phần tử (test hiện có); `轉` thành `転` ở nơi dùng.

Tên site ja: 「三國志 真戦 攻略手帳」 (thống nhất theo điều phối), dùng ở Landing, mọi `<title>` trang và trang chính sách. Thuật ngữ nhất quán: 編成, おすすめ編成, その他の編成, 開拓, マイ編成, 倉庫.

## 15 mẫu dịch (zh -> ja)

1. 保存到我的阵容 -> マイ編成に保存
2. 放弃未保存的更改？ -> 未保存の変更を破棄しますか？
3. 武将 ${index + 1} 的兵书 -> 武将 ${index + 1} の兵法書
4. 删除仓库“${boxLabel(box)}”？ -> 倉庫「${boxLabel(box)}」を削除しますか？
5. 清除筛选 -> 絞り込みを解除
6. 配置“${variantId}”不属于此阵容。 -> 構成「${variantId}」はこの編成に属していません。
7. 无法加载数据。请刷新页面，如问题持续请联系管理员。 -> データを読み込めません。ページを再読み込みしてください。問題が続く場合は管理者にお問い合わせください。
8. 同一账号可同时使用的五支队伍，15 名武将互不重复。… -> 同一アカウントで同時に使える5つの編成です。武将15名は重複しません。…
9. 开荒综合评分（满分 10） -> 開拓総合評価点（10点満点）
10. 库中缺 ${n} 项 -> 倉庫に${n}点不足
11. 至少 ${n} 红 -> 赤${n}以上
12. 使用条款 -> 利用規約
13. 免责声明 -> 免責事項
14. 本站不出售道具、不代充值，也绝不会索要你的游戏账号密码。 -> 本サイトはアイテムの販売やチャージの代行を行わず、ゲームアカウントのパスワードをお尋ねすることも決してありません。
15. 按赛季、兵种、阵营筛选 -> シーズン・兵種・陣営で絞り込み

## Obligation đổi (cũ -> mới) cho `pipeline/site_localization.py` (`UI_LITERAL_OBLIGATIONS`, phần tử thứ 9)

| entityId | File | Cũ | Mới |
|---|---|---|---|
| `ui:khaihoang/guide-heading` | `js/render.js` | `t("h2", { class: "kh-guide-title" }, L("Hướng dẫn khai hoang", "开荒攻略"))` | `t("h2", { class: "kh-guide-title" }, L("Hướng dẫn khai hoang", "开荒攻略", "開拓攻略"))` |
| `ui:coexist/season-aria` | `js/team-filter-section.js` | `el('select', {'aria-label': L('Mùa', '赛季')})` | `el('select', {'aria-label': L('Mùa', '赛季', 'シーズン')})` |
| `ui:coexist/season-label` | `js/team-filter-section.js` | `el('span', {class: 'reference-season-label'}, L('Mùa', '赛季'))` | `el('span', {class: 'reference-season-label'}, L('Mùa', '赛季', 'シーズン'))` |
| `ui:recommended/season-label` | `js/team-filter-section.js` | `L('Mùa','赛季')` | `L('Mùa','赛季','シーズン')` |
| `ui:recommended/tactic-before-level-20` | `js/recommended-reference-render.js` | `L('Trước cấp 20','20级前')` | `L('Trước cấp 20','20级前','20レベル前')` |
| `ui:landing/stats-seasons` | `Landing.astro` | `t('mùa', '个赛季')` | `t('mùa', '个赛季', 'シーズン')` |
| `ui:landing/preview-card-books-missing` | `Landing.astro` | `t('Chưa ghi', '未注明')` | `t('Chưa ghi', '未注明', '記載なし')` |
| `ui:route-recommended/score-label` | `RecommendedDetail.astro` | `t('Điểm', '评分')` | `t('Điểm', '评分', 'スコア')` |

(Plan nói 18 obligation toàn C; phần C2c có 8, còn lại thuộc C2b/C3.) Hash nguồn của 15 file (`js/app.js`, `detail-actions`, `khaihoang-detail`, `recommended-reference-render`, `-state`, `render`, `team-detail`, `team-filter-section`, `Landing`, `KhaiHoangDetail`, `LegacyDetail`, `RecommendedDetail`, `SectionPage`, `landing-stats`, `official-links`) cần ghim lại ở bước H.

## Việc người ghép phải làm ngoài sở hữu C2c

- `src/layouts/SiteLayout.astro` (C1) dòng ~276-281: `pick(locale, page.label.vi, page.label.zh)` và `page.description.*` cần thêm `.ja` (`POLICY_PAGES` đã có `ja`).
- `CommunityRulesPage.astro` (quy tắc cộng đồng) thuộc nhóm cộng đồng (C2a), không sửa ở đây.
- Tên `/ja/` trong comment `policy-pages.ts` chưa có route cho tới khi C1 xong.

## Cần review (thuật ngữ ngoài glossary)

開拓 (开荒), 当たり屋 (碰瓷, yếu nhất), 編成 (阵容), 倉庫, 武将庫/武将図鑑 (hai cách gọi cho 武将库/图鉴 xuất hiện ở các nhóm khác nhau, cần thống nhất), スクショ編成診断 / 編成判定 (截图识阵, hai cách gọi), 絆 (缘分), 赤 (红), ステ振り / ポイント振り分け (加点), 苦手/有利 (怕/克制), シナリオ (剧本). `DisclaimerPage` mục dịch tên: bản ja nói dùng tên theo ghi tiếng Nhật trong game, là phát biểu mới cần chủ site xác nhận. `render.js` giữ `const zh = sourceText()` và `MODIFIED_PREFIX_ZH` (logic hiện chữ Hán nguồn): trên ja tên nguồn vẫn hiện chữ Hán/tiền tố `精/轉/拓`, theo rủi ro 1 của phase A.
