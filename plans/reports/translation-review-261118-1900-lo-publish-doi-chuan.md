# Duyệt bản dịch vi ↔ zh: lô publish /doi-chuan/ + token API

Phạm vi: `git diff origin/main HEAD -- js/recruit-tokens.js js/recruit-tracker.js js/community-api.js src/components/pages/SectionPage.astro js/team-filter-section.js js/roster-list-badges.js js/app.js`.

Không có chuỗi hiển thị mới/đổi trong `js/app.js` (chỉ đổi comment), `js/team-filter-section.js` (chỉ comment + logic), `js/roster-list-badges.js` (nhãn nút "Ráp được"/"Thiếu tối đa 2" giữ nguyên, chỉ chuyển cách gắn số đội). Không có cặp nào thiếu bản zh. Mọi `${...}` khớp giữa vi và zh.

Đối chiếu thuật ngữ đang dùng trên site: trang tracker zh = `招募记录` (`js/recruit-tracker.js:1016`, `Landing.astro:101`, `PrivacyPage.astro:176`); gói = `PK名将招募` / `PK 名将招募` (`recruit-tracker-store.js:107`, `recruit-tracker.js:903`); Đội chuẩn = `推荐阵容` (`app.js`); "Sao chép" = `复制` (`detail-actions.js`).

## Danh sách cặp

| # | file:line | vi | zh | Kết luận |
|---|---|---|---|---|
| 1 | js/recruit-tracker.js:746 | Token API cho công cụ | 工具用 API 令牌 | ĐẠT |
| 2 | js/community-api.js:98 | Đã đủ 10 token còn hiệu lực. Hãy thu hồi bớt token cũ rồi tạo lại. | 有效令牌已达 10 个上限，请先撤销旧令牌再创建。 | ĐẠT |
| 3 | src/components/pages/SectionPage.astro:102 | Đội chuẩn của các mùa khác, mỗi mùa một trang. | 其他赛季的推荐阵容，每个赛季一页。 | ĐẠT |
| 4 | js/recruit-tokens.js:11 | 30 ngày | 30 天 | ĐẠT |
| 5 | js/recruit-tokens.js:12 | 90 ngày | 90 天 | ĐẠT |
| 6 | js/recruit-tokens.js:13 | 365 ngày | 365 天 | ĐẠT |
| 7 | js/recruit-tokens.js:14, :31 | Không hạn | 永不过期 | ĐẠT |
| 8 | js/recruit-tokens.js:29 | Đã thu hồi ${formatDate(item.revokedAt)} | 已于 ${formatDate(item.revokedAt)} 撤销 | ĐẠT |
| 9 | js/recruit-tokens.js:30 | Hết hạn ${formatDate(item.expiresAt)} | 已于 ${formatDate(item.expiresAt)} 过期 | ĐẠT |
| 10 | js/recruit-tokens.js:32 | Hạn đến ${formatDate(item.expiresAt)} | 有效期至 ${formatDate(item.expiresAt)} | ĐẠT |
| 11 | js/recruit-tokens.js:39 | Chưa dùng | 尚未使用 | ĐẠT |
| 12 | js/recruit-tokens.js:39 | Dùng lần cuối ${formatDate(item.lastUsedAt)} | 最后使用 ${formatDate(item.lastUsedAt)} | ĐẠT (gợi ý không bắt buộc: `最后使用于 ${…}` đọc tự nhiên hơn) |
| 13 | js/recruit-tokens.js:61 | Đã sao chép token. | 已复制令牌。 | ĐẠT |
| 14 | js/recruit-tokens.js:64 | Không sao chép được, hãy chọn và sao chép thủ công. | 无法复制，请手动选择并复制。 | ĐẠT (gợi ý: code đã `select()` sẵn ô token, có thể theo mẫu `detail-actions.js:10`: "Không sao chép tự động được. Token đã được chọn sẵn để bạn tự sao chép." / "无法自动复制。令牌已为你选中，请手动复制。") |
| 15 | js/recruit-tokens.js:67 | Sao chép | 复制 | ĐẠT |
| 16 | js/recruit-tokens.js:69 | Token mới | 新令牌 | ĐẠT |
| 17 | js/recruit-tokens.js:72–73 | Sao chép ngay: token chỉ hiện một lần. Lưu vào nơi an toàn (vd. ak-vault), không dán lên chat hay repo. | 请立即复制：令牌只显示一次。请保存到安全位置（如 ak-vault），不要贴到聊天或代码库。 | SỬA |
| 18 | js/recruit-tokens.js:82 | Tạo token | 创建令牌 | ĐẠT |
| 19 | js/recruit-tokens.js:84 (aria-label) | Token đã tạo | 已创建的令牌 | ĐẠT |
| 20 | js/recruit-tokens.js:88 | Chưa có token nào. | 还没有令牌。 | ĐẠT |
| 21 | js/recruit-tokens.js:96 (aria-label) | Thu hồi token ${row.name} | 撤销令牌 ${row.name} | ĐẠT |
| 22 | js/recruit-tokens.js:98 | Thu hồi | 撤销 | ĐẠT (ghi chú: cùng tracker, `Hoàn tác` cũng là `撤销` ở `recruit-tracker.js:437`; khác ngữ cảnh — toast vs hộp thoại token — nên chấp nhận được, `撤销` là từ chuẩn cho revoke token) |
| 23 | js/recruit-tokens.js:123 | Xác nhận thu hồi | 确认撤销 | ĐẠT |
| 24 | js/recruit-tokens.js:129 | Đã thu hồi token ${row.name}. | 已撤销令牌 ${row.name}。 | ĐẠT |
| 25 | js/recruit-tokens.js:140 | Công cụ tự động | 自动化工具 | ĐẠT |
| 26 | js/recruit-tokens.js:141 | Token API | API 令牌 | ĐẠT |
| 27 | js/recruit-tokens.js:143 (aria-label) | Đóng | 关闭 | ĐẠT |
| 28 | js/recruit-tokens.js:146–147 | Cho công cụ tự động ghi lượt quay gói Danh tướng PK vào tracker của bạn qua `POST /api/recruit/pulls`. Token chỉ có quyền ghi lượt quay. | 允许自动化工具通过 `POST /api/recruit/pulls` 将 PK名将招募 的抽卡记录写入你的追踪器。令牌仅有写入抽卡记录的权限。 | SỬA |
| 29 | js/recruit-tokens.js:151 | Tên | 名称 | ĐẠT |
| 30 | js/recruit-tokens.js:152 | Hạn dùng | 有效期 | ĐẠT |
| 31 | js/recruit-tokens.js:167 | Đã tạo token. | 已创建令牌。 | ĐẠT |
| 32 | js/recruit-tokens.js:178 | Đang tải… | 加载中… | ĐẠT (site thường dùng `正在加载…`, không bắt buộc đổi) |

## Chi tiết các cặp SỬA

### #17 — js/recruit-tokens.js:72–73 (ghi chú dưới ô token)

Lý do:
- `ak-vault` là tên công cụ nội bộ của người phát triển, không phải thứ người dùng site phổ thông có; ví dụ này khó hiểu ở cả hai bản.
- zh `贴到` là khẩu ngữ; trong UI chuẩn là `粘贴到`.

Đề xuất:
- vi: `Sao chép ngay: token chỉ hiện một lần. Lưu vào nơi an toàn (vd. trình quản lý mật khẩu), không dán lên chat hay repo.`
- zh: `请立即复制：令牌只显示一次。请保存到安全位置（如密码管理器），不要粘贴到聊天或代码库中。`

### #28 — js/recruit-tokens.js:146–147 (lead hộp thoại)

Lý do:
- vi dùng từ mượn "tracker", trong khi mọi chuỗi hiển thị vi khác gọi trang là "Theo dõi chiêu mộ" (PrivacyPage còn dùng "nhật ký Theo dõi chiêu mộ"); không có chuỗi vi hiển thị nào khác dùng "tracker".
- zh `追踪器` không khớp tên trang zh đang dùng là `招募记录`.
- zh `将 PK名将招募 的` có khoảng trắng quanh tên gói giữa chữ Hán, đọc như lỗi dàn trang; nên viết liền (`PK 名将招募的`, giống `recruit-tracker.js:903`).
- `抽卡记录` lặp hai lần cùng `招募记录` sẽ thành "记录…记录"; dùng `抽卡次数` cho sát vi "lượt quay" và tránh trùng.

Đề xuất:
- vi: `["Cho công cụ tự động ghi lượt quay gói Danh tướng PK vào Theo dõi chiêu mộ của bạn qua ", code, ". Token chỉ có quyền ghi lượt quay."]`
- zh: `["允许自动化工具通过 ", code, " 将 PK 名将招募的抽卡次数写入你的招募记录。令牌仅有写入抽卡次数的权限。"]`

(Comment trong code dùng "tracker" không ảnh hưởng, không cần đổi.)

## Verdict

**CẦN SỬA** — 2 cặp (#17, #28); 30 cặp còn lại ĐẠT. Lead "Các mùa khác" (`SectionPage.astro:102`, vi "các mùa khác" / zh `其他赛季`) ĐẠT, khớp tiêu đề khối.

Reviewer: independent-subagent
Thời điểm: 2026-11-18 18:34 (Asia/Saigon)

Câu hỏi chưa giải quyết: không.

## Vòng 2

Nguồn: `git diff -- js/recruit-tokens.js` (thay đổi chưa commit trên HEAD), đọc lại chuỗi trong file hiện tại.

| # | file:line | vi | zh | Kết luận |
|---|---|---|---|---|
| 17 | js/recruit-tokens.js:72–73 | Sao chép ngay: token chỉ hiện một lần. Lưu vào nơi an toàn (vd. trình quản lý mật khẩu), không dán lên chat hay repo. | 请立即复制：令牌只显示一次。请保存到安全位置（如密码管理器），不要粘贴到聊天或代码库中。 | ĐẠT |
| 28 | js/recruit-tokens.js:146–147 | Cho công cụ tự động ghi lượt quay gói Danh tướng PK vào Theo dõi chiêu mộ của bạn qua `POST /api/recruit/pulls`. Token chỉ có quyền ghi lượt quay. | 允许自动化工具通过 `POST /api/recruit/pulls` 将 PK 名将招募的抽卡次数写入你的招募记录。令牌仅有写入抽卡次数的权限。 | ĐẠT |

Ghi chú:
- #17: không còn `ak-vault`; "trình quản lý mật khẩu" ↔ 密码管理器 khớp nghĩa; 粘贴到…中 là cách viết chuẩn trong UI.
- #28: vi dùng tên trang "Theo dõi chiêu mộ" như các chuỗi vi khác; zh 招募记录 khớp tên trang zh (`recruit-tracker.js:1016`); tên gói viết liền theo `recruit-tracker.js:903`; 抽卡次数 ↔ "lượt quay" khớp nghĩa và không lặp 记录. Phần `code` và khoảng trắng hai bên giữ đúng ở cả hai bản.
- Diff vòng 2 chỉ đổi hai cặp này, không đụng chuỗi nào khác.

**Verdict vòng 2: ĐẠT** — cả 32 cặp trong phạm vi đều ĐẠT.

Reviewer: independent-subagent
Thời điểm: 2026-11-18 18:36 (Asia/Saigon)
