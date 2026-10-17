---
phase: 3
title: "Nhật ký quản trị cho mọi thao tác ghi"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 3 — Nhật ký quản trị

<!-- Updated: Red Team 2026-10-17 - subject_user_id, điều kiện exists thay changes(), chỉ lọc theo action -->

## Mục tiêu
Mọi thao tác **ghi** của root/KDV sinh đúng một dòng `admin_audit` phản ánh kết quả thật (`ok` / `partial` / `failed`), kể cả khi có bước ngoài D1 (R2, KV, GitHub). Root đọc toàn bộ nhật ký qua API.

## File
- Tạo: `community-worker/src/audit.ts`, `community-worker/src/routes/audit.ts`, `community-worker/test/audit.test.ts`
- Sửa: `community-worker/src/app.ts`, `community-worker/src/routes/{ai,comments,feedback,posts,reports,scan}.ts`
- Dùng (đã thêm ở phase 1): `h.r2Error`, `h.kvError` trong `community-worker/test/fakes.ts`

## Thiết kế

### `src/audit.ts`
- `auditStmt(c, viewer, entry)` → `D1PreparedStatement` insert (`id = deps.newId()`, `created_at = deps.now()`), `actor_label = \`${name} <${maskEmail(email)}>\``, `meta = JSON.stringify(...)` object nhỏ đã chọn trường (không key/token/body).
- `auditIfStmt(c, viewer, entry, existsSql, binds)` → `insert into admin_audit (...) select ... where exists (<existsSql>)` — điều kiện kiểm **trạng thái mới** (vd `select 1 from battle_reports where id = ? and status = 'approved' and reviewed_at = ?`), không dùng `changes()` để không phụ thuộc thứ tự lệnh.
- `writeAudit(c, viewer, entry)` chạy riêng (khi không có batch D1).
- `entry = { action, targetType, targetId, targetLabel?, subjectUserId?, reason?, meta?, status }`. `subjectUserId` = chủ nội dung (report/comment/feedback/scan_sample) hoặc user đích; đọc kèm trong truy vấn tìm bản ghi sẵn có.

### Quy tắc theo loại thao tác
| Loại | Cách ghi |
|---|---|
| Chỉ D1 | `DB.batch([thayĐổi, auditIfStmt(status:'ok')])`; điều kiện cũ trả 404/409 giữ nguyên, khi đó không có dòng audit. |
| D1 rồi GitHub dispatch (`posts` update/delete/publish/unpublish) | Batch D1 + audit `ok`, `meta:{deploy:'pending'}`; sau `triggerDeploy` cập nhật đúng dòng đó: lỗi → `status:'partial'`, `meta.deploy:{ok:false,status}`; xong → `meta.deploy:'ok'`. Một dòng. |
| R2 rồi D1 (`scan` reject, `posts` upload) | R2 lỗi → `writeAudit(failed, meta:{step:'r2'})` rồi ném như cũ; R2 xong → batch D1 + audit `ok`. |
| KV (`ai` PUT) | `saveAiConfig` lỗi → `writeAudit(failed)` rồi ném; xong → `writeAudit(ok, meta:{providers:[id…], groups:[id…]})`. Không ghi endpoint/key. |

### Action
`report.approve`, `report.reject` (reason), `comment.delete` (chỉ khi người xoá là staff và không phải chủ), `feedback.status` (meta `{status}`), `scan_sample.approve`, `scan_sample.reject`, `post.create`, `post.update`, `post.delete`, `post.publish`, `post.unpublish`, `post.upload`, `ai.config.update`. Phase 4 thêm `user.ban`, `user.unban`, `user.role`, `user.delete.start`, `user.delete`.

### Đọc nhật ký
`GET /api/admin/audit?action=&cursor=` — `requireRoot`, mới nhất trước, `PAGE_SIZE`, cursor `(created_at,id)` bằng `decodeCursor`/`paginate` sẵn có. Trả `{items:[{id, actor:{id,role,label}, action, target:{type,id,label}, subjectUserId, reason, meta, status, createdAt}], nextCursor}`.

## TDD
### Trước (đỏ)
`test/audit.test.ts`:
1. Mọi handler ghi trong danh sách action, gọi bằng root và moderator (nếu được phép) → đúng 1 dòng mới, đúng `action/target/subject_user_id/actor_role/status`.
2. Thất bại: id không tồn tại → 0 dòng; `h.r2Error` khi scan reject → 1 dòng `failed`, mẫu giữ trạng thái; `h.kvError` khi PUT AI → 1 dòng `failed`; GitHub trả 500 khi publish → 1 dòng `partial`.
3. Không rò: dòng `ai.config.update` không chứa `apiKey`/endpoint; không `actor_label`/`target_label` nào chứa email đầy đủ.
4. Chủ comment tự xoá → 0 dòng; KDV xoá comment của user thường → 1 dòng có `subject_user_id` = tác giả.
5. `GET /api/admin/audit`: moderator 403, root 200, lọc `action`, phân trang qua 21+ dòng.

### Sau
Sửa từng route theo bảng; `npx vitest run` xanh.

## Kiểm tra
`cd community-worker && npx tsc --noEmit && npx vitest run`

## Rủi ro
Worker dừng giữa D1 và cập nhật deploy → dòng giữ `meta.deploy:'pending'` (kết quả thật chưa biết); UI hiển thị "chưa rõ kết quả deploy".

## Bảo mật
Chỉ root đọc toàn cục; không lưu secret/body thô; label đã che email.

## Ghi chú triển khai (đã làm)
- **Điều kiện `exists` chứng minh chính yêu cầu này**: kèm actor (`reviewed_by = actor`), mốc `reviewed_at`/`updated_at` của yêu cầu và điều kiện đủ quyền (KDV: `user_id <> actor`). Yêu cầu bị chặn trên mục tiêu đã ở trạng thái đích → 0 dòng; yêu cầu hợp lệ lặp lại → mỗi lần một dòng.
- **Lệch khỏi mẫu "ghi rồi audit" — XOÁ** (`comment.delete`, `post.delete`): dòng nhật ký `insert ... select ... where exists` đặt TRƯỚC câu `DELETE` trong cùng `DB.batch`, cùng điều kiện đủ quyền (sau DELETE, `not exists` không chứng minh được chính yêu cầu này đã xoá). Lỗi ghi nhật ký rollback cả batch.
- **Deploy**: một id nhật ký cho mỗi thao tác; batch D1 ghi `meta.deploy:'pending'`, sau `triggerDeploy` cập nhật đúng dòng đó (`ok` hoặc `partial` + `meta.deploy:{ok:false,status}`; cấu hình thiếu/mạng lỗi/non-2xx đều là lỗi). Sửa/xoá bài nháp không dispatch nên không có `pending`. Dispatch quyết theo trạng thái bài đọc trước khi ghi.
- **Ngữ nghĩa kết quả**: R2 xoá lỗi trước khi đổi D1 → `failed` (D1 không đổi); scan: ảnh đã xoá mà D1 lỗi/không đổi dòng → `partial`; upload: R2 ok, D1 lỗi, xoá bù ok → `failed`, xoá bù lỗi → `partial` (`meta.orphan`); AI: KV lỗi → `failed`; KV ok mà ghi nhật ký lỗi → lỗi nổi lên nguyên văn (không gán nhãn KV).
- **Giới hạn độ bền**: nếu D1 hỏng sau khi R2/KV đã thành công thì dòng nhật ký có thể không ghi được (chỉ log); không thể đảm bảo. Dòng `failed`/`partial` ghi bằng `writeAuditQuietly` để không che lỗi gốc.
- **Nhãn**: `sanitizeLabel` che chuỗi giống email trong tên/tiêu đề (`actor_label` dùng thêm `maskEmail`); meta AI chỉ id nhà cung cấp/nhóm.
