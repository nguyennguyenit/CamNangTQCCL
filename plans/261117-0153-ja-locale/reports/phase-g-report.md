# Phase G: `community-worker` nhận `lang = ja`

Ngày 2026-11-17. Branch `feat/ja-locale-g-community` (tách từ `feat/ja-locale`). Trạng thái: xong ở local. Chưa áp migration lên production, chưa deploy.

## Kết quả

- `LANGS = ["vi", "zh", "ja"]` trong `community-worker/src/validate.ts`. `parseLang` và thông báo lỗi dẫn xuất từ danh sách này. Các route bình luận, chiến báo, bài viết (gồm `GET /api/posts/ja/:slug`), góp ý, ảnh soi đội và đội cộng đồng nhận `ja`. Ngôn ngữ khác vẫn trả 400 `invalid_lang`.
- Ngoài `parseLang` không có chỗ nào khác rẽ nhánh theo vi/zh. Hai comment "kho chung vi/zh" đổi thành "mọi ngôn ngữ". Nhãn mùa (`label_vi`/`label_zh`) giữ nguyên như plan: bản ja lấy nhãn từ danh mục mùa phía site.
- Migration mới `community-worker/migrations/0015_lang_ja.sql` và rollback viết tay `community-worker/rollback/0015_restore_lang_vi_zh.sql`.
- Tài liệu: `docs/community-worker.md` có thêm mục "Bản tiếng Nhật (`lang = ja`)", gồm thứ tự deploy, sao lưu và rollback.

## Bảng đã dựng lại

| Bảng | Lý do | Cột đổi |
|---|---|---|
| `comments` (0002) | CHECK lang | `lang in ('vi','zh','ja')` |
| `battle_reports` (0002) | CHECK lang | như trên |
| `posts` (0002) | CHECK lang | như trên |
| `feedback` (0003) | CHECK lang | như trên |
| `scan_samples` (0005) | CHECK lang | như trên |
| `community_teams` (0008) | CHECK text_lang | `text_lang in ('vi','zh','ja')` |
| `community_team_images` (0008) | bảng con FK `on delete cascade` tới `community_teams` | không đổi |
| `community_team_votes` (0008) | bảng con FK `on delete cascade` tới `community_teams` | không đổi |

Vì sao phải dựng lại cả hai bảng con: D1 luôn bật khoá ngoại, và `DROP TABLE` chạy ngầm `DELETE FROM`. Nếu xoá `community_teams` cũ trong khi bảng con còn trỏ vào nó, `ON DELETE CASCADE` sẽ xoá sạch ảnh và vote. `PRAGMA defer_foreign_keys` chỉ hoãn việc kiểm ràng buộc, không chặn CASCADE. Đã chứng minh bằng một repro `node:sqlite`: dựng lại kiểu đơn giản, kể cả khi có `defer_foreign_keys`, làm bảng con còn 0 dòng. Cách làm trong migration: tạo bảng cha mới, rồi bảng con mới trỏ vào cha mới. Sau đó xoá bảng con cũ, rồi xoá bảng cha cũ (lúc này không còn ai trỏ vào nên không có CASCADE). Cuối cùng RENAME; lệnh này tự viết lại khoá ngoại của bảng con sang tên cũ.

Các phần khác được giữ:
- Toàn bộ cột, đúng thứ tự, kể cả ba cột sinh `points`, `hot_rank`, `top_rank`. Cột sinh không được chép mà SQLite tự tính lại.
- 22 index, đúng tên và định nghĩa, gồm cả `feedback_user_idx` và `scan_samples_user_idx` từ 0006.
- 9 trigger, dựng lại nguyên văn sau khi chép dữ liệu nên bộ đếm vote và evidence không bị đếm lại.
- Các khoá ngoại tới `user`, tới `community_seasons`, và FK `set null` của `feedback`/`scan_samples`.

Không có bảng nào khác tham chiếu tới 5 bảng còn lại.

Trigger được gỡ bằng `drop trigger` không kèm `if exists`. Nếu production lệch khỏi `migrations/` (vd đã chạy `rollback/0009` mà chưa chạy `0010`), cả file dừng và D1 không đổi gì. Có test cho trường hợp này, và đã thử trên D1 cục bộ.

## Kiểm chứng

- `(cd community-worker && npm test && npm run typecheck)`: 31 file, 686 test pass; `tsc --noEmit` sạch.
- `test/lang-ja-migration.test.ts` (8 test). Test seed dữ liệu vi/zh vào mọi bảng bị dựng lại, các bảng con và vài bảng không liên quan. Migration chạy trong một transaction, khoá ngoại bật. Các điểm được kiểm:
  - Toàn bộ dữ liệu của **mọi** bảng giống hệt trước/sau, kể cả bộ đếm và cột sinh.
  - `sqlite_master` sau migration bằng đúng bản trước với 6 CHECK được thay; không còn sót tên `*_new`.
  - `foreign_key_check` rỗng; `integrity_check` trả ok.
  - Insert `ja` được ở cả 6 cột; `ko` bị CHECK từ chối; unique `(lang, slug)`/`(lang, translation_key)` vẫn đúng.
  - Cascade khi xoá đội hoặc user, trigger đếm vote và evidence, trigger chặn tài khoản bị khoá đều vẫn chạy.
  - Schema lệch thì migration dừng và DB không đổi.
  - Rollback khi chưa có dòng `ja` đưa schema và dữ liệu về đúng như trước migration. Còn dòng `ja` thì rollback từ chối và DB không đổi.
- Test route TDD (viết đỏ trước): thêm ca `ja` và `ko` cho `validate`, `comments`, `posts`, `reports`, `feedback`, `scan`, `teams`.
- D1 cục bộ (wrangler 4, `--local --persist-to` thư mục tạm, không dùng `--remote`):
  - Áp 0001–0014, seed, áp 0015: dữ liệu trước/sau trùng khớp, insert `ja` được, insert `ko` bị từ chối, `foreign_key_check` rỗng.
  - Khi thiếu trigger thì 0015 lỗi và DB giữ nguyên (11 − 3 = 8 trigger, không sót bảng `_new`, `d1_migrations` không ghi 0015).
  - Rollback khi có dòng `ja` thì lỗi CHECK và DB giữ nguyên.
  - `d1 export --local` sau 0015 cho ra file dump bỏ cột sinh và nạp lại được vào DB trống.

## Lệnh deploy cho chủ repo

Thứ tự: **sao lưu → migration → Worker → merge site có `/ja/`**. Chi tiết nằm ở `docs/community-worker.md`, mục "Thứ tự deploy".

```bash
cd community-worker
# 1. Kiểm (chỉ đọc)
npx wrangler d1 migrations list tqccl-community --remote          # chỉ còn 0015_lang_ja.sql
npx wrangler d1 execute tqccl-community --remote --command "select name from sqlite_master where type = 'trigger' order by name"   # đủ 11
npx wrangler d1 execute tqccl-community --remote --command "select (select count(*) from comments) comments, (select count(*) from battle_reports) reports, (select count(*) from posts) posts, (select count(*) from feedback) feedback, (select count(*) from scan_samples) scans, (select count(*) from community_teams) teams, (select count(*) from community_team_images) images, (select count(*) from community_team_votes) votes"
# 2. Sao lưu (file dump có dữ liệu cá nhân: lưu ngoài repo)
npx wrangler d1 time-travel info tqccl-community
npx wrangler d1 export tqccl-community --remote --output ~/tqccl-backups/tqccl-community-pre-0015.sql
# 3. Migration
npm run db:migrate:remote
# 4. Kiểm lại: chạy lại câu đếm ở bước 1, và
npx wrangler d1 execute tqccl-community --remote --command "select name from sqlite_master where type = 'table' and sql like '%''ja''%' order by name"   # đủ 6 bảng
# 5. Worker
npm run deploy
# 6. Merge PR site có /ja/ vào main
```

Rollback: revert site → `npx wrangler rollback` → schema nên để nguyên (CHECK rộng hơn vô hại với Worker cũ). Chỉ khi thật cần mới chạy `rollback/0015_restore_lang_vi_zh.sql` bằng `--file`, hoặc `wrangler d1 time-travel restore --bookmark=<bookmark>`.

## Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Mất dữ liệu khi dựng lại bảng (CASCADE) | Thấp sau khi sửa | Dựng lại cả bảng con; test so toàn bộ dữ liệu; đã thử trên D1 cục bộ; bookmark Time Travel cộng với file export |
| Production lệch schema làm migration dừng | Thấp | Fail-fast có chủ đích, không đổi gì; bước 1 kiểm đủ 11 trigger |
| `d1 export` khoá DB trong lúc xuất; bảng lớn làm migration chậm | Thấp (dữ liệu cộng đồng còn nhỏ) | Chạy lúc ít người dùng; mọi `INSERT … SELECT` là chép thẳng, không join |
| Deploy sai thứ tự (Worker hoặc site trước migration) | Trung bình | Runbook trong docs; Worker mới trên schema cũ chỉ lỗi khi có người gửi `ja` |
| Kiểm chứng chỉ chạy trên `node:sqlite` và engine D1 cục bộ, chưa chạy trên D1 production | Còn lại | Bước kiểm trước/sau trong runbook; D1 chạy mỗi query trong một transaction ngầm |

Thay đổi thuộc nhóm rủi ro cao (schema D1) theo `AGENTS.md`, nên đề xuất review Astra → Fable trong PR.

## Câu hỏi chưa giải

- Phase H có chép runbook này sang `docs/deployment-guide.md` không, hay chỉ trỏ link tới `docs/community-worker.md`?
