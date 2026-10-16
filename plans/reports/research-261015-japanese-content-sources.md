# Nguồn tiếng Nhật bổ trợ nội dung (三國志 真戦)

- Research date: 2026-10-15 (giờ máy, +07)
- Branch: source verification
- Topic lock: Nguồn tiếng Nhật bổ trợ nội dung nếu làm bản tiếng Nhật

## Objective

Đánh giá nguồn tiếng Nhật cho (1) tên tướng/chiến pháp tiếng Nhật, (2) nội dung
S26 / Binh Diễn Xuân Thu. Không nhập dữ liệu, không đổi tier.

## Previous Conclusion and Corrections

- [docs/research-sources.md](../../docs/research-sources.md) đã xếp Kazten, Shinsen Navi,
  Chousen, DailyGames vào nhóm research build; Hensei Kobo vào nhóm tham khảo sản phẩm.
- [research-260906-2333](research-260906-2333-team-builder-reference-sites.md): Kazten có
  nội dung S26 và cơ chế 兵演春秋; Chousen có bài S26 ngày 24/08 dựa trên server thử nghiệm.
- Current state: còn hiệu lực. Bổ sung: Kazten đã ra bài S26 live; Hensei Kobo đã cập
  nhật tướng/chiến pháp mới ngày 18/09/2026.

## Call Budget

| Topic | Allowance | Limit | Used | Remaining |
| --- | --- | ---: | ---: | ---: |
| Nguồn tiếng Nhật | External sources | 5 | 5 | 0 |

## Claim Evidence

| Claim | Status | URL | Notes |
| --- | --- | --- | --- |
| Kazten đăng "シーズン26最強テンプレ編成紹介" ngày 09/09/2026: 122 đội, T0/T0.5/T1, mỗi đội có 欲しい凸数, ポイント振り, 装備スキル, 使い方, 対策, 戦法解説, 代用戦法解説 | Đã đối chiếu | https://kazten.com/entry/2026/09/09/195242 | Đã đọc phần đầu (300/10015 dòng). Tên đội và chiến pháp dạng chữ (富貴騎, 法官盾, 神算鬼謀, 衆志成城, 刮目相待). Tier là đánh giá cá nhân, tác giả nói ưu tiên tiềm năng hơn môi trường. Đăng trước ngày JP mở 12/09. |
| Kazten có bài riêng cho kịch bản 兵演春秋 (08/09/2026), gồm đội dùng カスタム兵種戦法, 登用令, コピー戦法; phần đề xuất BDXT theo phe nằm trong video YouTube và ảnh | Phương án từ nguồn | https://kazten.com/entry/2026/09/08/200000 | Bài 08/09 chưa mở; nội dung phe chỉ là link video + ảnh. Bài ghi "兵演春秋シナリオをプレイする方は" → ở JP, BDXT là một kịch bản trong S26, song song với kịch bản PK khác. |
| Kazten gọi sự kiện chiến pháp mới S26 là 軍陣結集; tướng mới 40Y呂布 | Đã đối chiếu | như trên | Bản TW gọi là 魔軍結陣 (Paradaily) → tên khác giữa JP và TW. |
| Hensei Kobo (編成工房): app ghép đội tiếng Nhật, có 図鑑 tướng/chiến pháp kèm 武将詳細/戦法詳細; cập nhật "新武将と戦法を追加" 18/09/2026; 90 đội mẫu S23 để import | Đã đối chiếu | https://sgs.henseikobo.app/ | Đã đọc trang giới thiệu và lịch sử cập nhật. Catalog cần JavaScript/đăng nhập (có chế độ khách); điều khoản sử dụng dữ liệu chưa kiểm. Ghi "開発中". |
| Chousen (三国志真戦wiki) có loạt bài S26 兵演春秋, ví dụ #641 優秀編成８選 | Chưa xác minh | https://sangokushi-shinsen.info/, https://www.youtube.com/watch?v=wfJH8fvjo1w | Trang chủ không hiện nội dung với bộ đọc; chỉ snippet. |
| Shinsen Navi có 絆効果一覧 cập nhật tháng 6/2026 | Chưa xác minh | https://sangokushi-shinsen.com/bond | Snippet. |

## Comparison and Constraints

- Tên gọi khác giữa các bản: 軍陣結集 (JP) và 魔軍結陣 (TW) cho cùng sự kiện chiến pháp
  S26/BDXT. Không chuyển tên phồn thể sang tiếng Nhật bằng mặt chữ.
- JP đánh số mùa (S26) và có nhiều kịch bản trong cùng mùa; nội dung site phải
  ghi tên kịch bản.

## Conclusion

Tiếng Nhật có nguồn nội dung mạnh nhất ngoài tiếng Trung: bài dạng chữ, cập nhật
theo mùa, đã có S26/BDXT. Chưa tìm được cơ sở dữ liệu tên chính thức của
Qookka JP; Hensei Kobo và bài Kazten là nguồn tên cộng đồng tốt nhất.

## Limits and Unresolved Questions

- Chưa kiểm trang chính thức Qookka JP có 図鑑 hay không.
- Chưa đọc bài BDXT riêng của Kazten, chưa mở bài Chousen S26.
- Chưa kiểm điều khoản sử dụng của Kazten/Hensei Kobo.

## Final Validation

- [x] Scope and its provenance are explicit or unknown.
- [x] Prior reports and corrections were checked.
- [x] Every material claim has exactly one allowed status.
- [x] Topic, limit, used, and remaining are reported.
- [x] No unauthorized mutation, tier change, Git action, or deployment occurred.
