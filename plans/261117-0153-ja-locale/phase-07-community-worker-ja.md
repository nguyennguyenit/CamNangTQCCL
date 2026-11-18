# Phase G — `community-worker` nhận `lang = ja` (cần chủ repo chốt, Q1)

Branch: `feat/ja-locale-g-community-ja`. Phụ thuộc: quyết định Q1. Chạy song song với mọi phase (chỉ đụng `community-worker/**`). Effort 8h. Rủi ro: cao (schema D1/migration, `AGENTS.md` yêu cầu đề xuất review Astra → Fable). Không chạy migration remote, không deploy (ngoài phạm vi).

## Vì sao cần

Hợp đồng yêu cầu trang cộng đồng có bản `/ja/`. Client gửi `lang: currentLocale()` cho mọi thao tác ghi: bình luận và chiến báo (`js/community-teams.js:551-552`), đăng đội (`js/community-team-form.js:606`), góp ý (`js/feedback.js:85`), gửi ảnh soi đội (`js/analyze.js:1270`), bài viết từ quản trị (`js/community-admin.js:926`). Phía server, `parseLang` chỉ nhận `vi`/`zh` (`community-worker/src/validate.ts:15`, `:44-45`), và D1 có `CHECK (lang in ('vi','zh'))` ở `comments`, `battle_reports`, `posts` (`community-worker/migrations/0002_community.sql:7`, `:33`, `:56`), `feedback` (`0003_feedback.sql:10`), `scan_samples` (`0005_scan.sql:22`) và `community_teams.text_lang` (`0008_community_teams.sql:33`). Không có G, mọi thao tác ghi ở `/ja/` trả 400 và không tạo được bài blog ja để dán bản nháp của F.

## Phương án

- **G-A (đề xuất):** mở rộng sang `ja`. `LANGS` thành `["vi","zh","ja"]`, `parseLang` theo danh sách; migration `0015_lang_ja.sql` dựng lại sáu bảng với `CHECK (… in ('vi','zh','ja'))` theo mẫu SQLite (tạo bảng mới, chép dữ liệu, xoá bảng cũ, đổi tên, tạo lại index), có `PRAGMA defer_foreign_keys = on` vì `community_team_images`, `community_team_votes` tham chiếu `community_teams` (`0008_community_teams.sql:57-67`); rollback viết tay trong `community-worker/rollback/` theo tiền lệ `0013_restore_community_season_open.sql`. Nhãn mùa: `community_seasons` có `label_vi`, `label_zh`; bản ja hiển thị nhãn lấy từ danh mục mùa phía site (không thêm cột), chốt khi làm.
- **G-B (nếu chủ repo không duyệt G-A):** không đổi server; ở `/ja/` client ẩn các khối ghi cộng đồng và hiện câu "日本語版では投稿できません" (C2 thực hiện), danh sách đọc theo `lang` hiện có. Khi đó hạng mục "cộng đồng" của `/ja/` chỉ có phần đọc, và bản ja của F không dán được; ghi GitHub issue cho phần còn thiếu.

Phần dưới mô tả G-A.

## Sở hữu

`community-worker/src/validate.ts`, `community-worker/src/teams-validate.ts`, các route dùng `parseLang` (`community-worker/src/routes/{comments,posts,reports,feedback,scan}.ts`) nếu cần đổi kiểu, `community-worker/migrations/0015_lang_ja.sql` (mới), `community-worker/rollback/0015_restore_lang_vi_zh.sql` (mới), test trong `community-worker/test/` (`comments`, `posts`, `reports`, `feedback`, `scan`, `teams-validate`, `teams-schema`, migration mới), `docs/community-worker.md` giao cho H cập nhật.

## Bước (TDD)

1. Test đỏ: mỗi route nhận `lang = "ja"`; `ko` bị từ chối với `invalid_lang`; migration áp trên D1 giả (`node:sqlite` áp migration thật, như các test hiện có) giữ nguyên số hàng, index, unique `(lang, slug)`/`(lang, translation_key)` và FK; rollback từ chối khi còn hàng `ja` (hoặc xoá có chủ đích, chốt khi làm) rồi khôi phục CHECK cũ.
2. Viết migration + rollback; sửa validator.
3. `npm test`, `npm run typecheck` trong `community-worker/`.
4. Ghi runbook thứ tự release cho chủ repo (để H đưa vào `docs/deployment-guide.md`): bookmark Time Travel → migration → Worker → Pages. Worker mới chạy được trên schema cũ chỉ khi không ai gửi `ja`; Pages có `/ja/` phải lên **sau** migration và Worker.

## Cách kiểm

Unit + migration trên D1 giả; `.githooks/pre-push` chạy `npm test`/`typecheck` của `community-worker` (README, mục Pre-push hook).

## Rủi ro

| Rủi ro | Khả năng × Tác động | Giảm thiểu |
|---|---|---|
| Dựng lại bảng mất dữ liệu hoặc FK | Thấp × Rất cao | Test đếm hàng/FK trên D1 giả, bookmark Time Travel trước khi áp, rollback viết sẵn |
| Deploy Pages `/ja/` trước migration | Trung bình × Trung bình | Runbook thứ tự release; G-B làm phương án hạ cấp |
| Worker mới ghi `ja` trước migration | Thấp × Trung bình | Migration trước Worker trong runbook |

## Rollback

Code: revert merge. Production (do chủ repo, ngoài phạm vi): rollback Worker về version cũ, chạy `rollback/0015_restore_lang_vi_zh.sql` hoặc Time Travel về bookmark.

## Done khi

Test `community-worker` xanh với `ja`; migration + rollback có test; runbook release đã viết; review Astra → Fable được đề xuất trong PR.
