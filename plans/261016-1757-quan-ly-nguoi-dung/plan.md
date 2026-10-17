---
title: "Quản trị người dùng: kiểm duyệt viên, khoá, xoá tài khoản, nhật ký quản trị"
description: "Thêm cấp kiểm duyệt viên cấp qua UI, khu Người dùng (xem, khoá có hạn kèm lý do, xoá dữ liệu) và nhật ký mọi thao tác quản trị cho community-worker và /quan-tri/."
status: completed
priority: P1
effort: 7d
branch: main
tags: [feature, backend, frontend, database, auth, security]
blockedBy: []
blocks: []
created: 2026-10-16
---

# Quản trị người dùng

Chế độ: `--hard` (tái dùng nghiên cứu đã làm ở bước advise và hai vòng kiểm chứng; bằng chứng: [reports/xac-minh-truoc-plan.md](./reports/xac-minh-truoc-plan.md)). Phạm vi: HOLD. Thực thi: `ak:cook --tdd`.

## Outcome đã khóa (advise 2026-10-16, đã xác nhận)

- Hai cấp quyền: **root** chỉ từ `ADMIN_EMAILS`; **kiểm duyệt viên (KDV)** do root cấp/thu trên UI.
- KDV dùng: Chiến báo, Bình luận, Góp ý, Soi đội, khoá/mở user thường. Không dùng: AI, Bài viết, xoá user, cấp quyền, nhật ký toàn cục; không khoá được KDV khác hay root.
- Khu Người dùng: tìm tên/email, lọc vai trò/trạng thái, 20/trang; mỗi dòng: ảnh, tên, email, ngày đăng ký, lần hoạt động cuối, vai trò, trạng thái khoá, số bình luận/chiến báo/góp ý/mẫu soi đội; chi tiết: nội dung + nhật ký của user.
- KDV thấy email bị che (`ng***@gmail.com`), kể cả ở Góp ý. Che ở server.
- Khoá 1/7/30 ngày/vĩnh viễn, lý do bắt buộc; huỷ mọi phiên; không đăng nhập lại đến khi hết hạn/mở; người bị khoá thấy thông báo kèm lý do; bình luận/chiến báo (cả thống kê, ảnh) ẩn khỏi công khai; mở khoá/hết hạn thì hiện lại.
- Xoá (chỉ root): gõ lại email; xoá user + dữ liệu + ảnh R2; góp ý giữ lại ẩn danh.
- Nhật ký **mọi thao tác quản trị** (ai, hành động, đối tượng, lý do, thời điểm, kết quả); root xem toàn bộ.
- UI tiếng Việt + tiếng Trung.

## Không làm

Người dùng tự xoá tài khoản; giữ nội dung ẩn danh sau khi xoá; biểu đồ tăng trưởng; chế độ read-only; impersonate; plugin `admin` của Better Auth; ghi nhật ký thao tác chỉ đọc.

## Ràng buộc

- Root chỉ từ `ADMIN_EMAILS`; không cấp root qua UI.
- Better Auth 1.7.6 trên D1; không sửa migration đã áp dụng (`0001`–`0005`).
- Cột thời gian Better Auth là chuỗi ISO; cột ứng dụng mới dùng epoch ms (`integer`), giống các bảng hiện có.
- Không lưu secret, API key, body request thô trong nhật ký.
- Không commit, không deploy, không chạy lệnh `--remote` (chưa được cho phép).
- Text UI song ngữ qua `L()`/`pick()`; lỗi API dạng `{error:{code,message}}`, UI dịch theo `code`.

## Phase

| # | Nội dung | Trạng thái |
|---|---|---|
| 1 | [Schema và chặn tài khoản bị khoá](./phase-01-schema-chan-khoa.md) | pending |
| 2 | [Phân quyền root/KDV và che email](./phase-02-phan-quyen-kdv.md) | pending |
| 3 | [Nhật ký quản trị cho mọi thao tác ghi](./phase-03-nhat-ky-quan-tri.md) | pending |
| 4 | [API người dùng: danh sách, khoá, quyền, xoá; ẩn nội dung](./phase-04-api-nguoi-dung-khoa-xoa.md) | pending |
| 5 | [Giao diện quản trị và thông báo bị khoá](./phase-05-giao-dien-quan-tri.md) | pending |
| 6 | [Docs, changelog, kiểm tra toàn bộ](./phase-06-docs-kiem-tra.md) | pending |

Phụ thuộc: 1 → 2 → 3 → 4 → 5 → 6 (tuần tự; cùng sửa `context.ts`, các route và test harness).

## Xong khi

- [ ] `requireAdmin` và `isAdmin` không còn trong `community-worker/src`, `community-worker/test`, `js/`, `tests-e2e/`; mỗi endpoint admin có test 403 cho KDV ở khu cấm, 200 ở khu được phép, chạy qua guard thật (harness đọc DB).
- [ ] Migration `0006` áp được trên fake D1 và D1 cục bộ; test Better Auth thật (dialect D1) chứng minh: user bị khoá không tạo được session (kể cả race), session cũ không dùng được, OAuth trả `ACCOUNT_BANNED` + token, `GET /api/ban-notice` trả lý do.
- [ ] Test chứng minh comment/chiến báo/thống kê/ảnh của user bị khoá không có trong API công khai, vẫn có ở API admin, và hiện lại khi hết hạn; KDV không dò được email, không đè khoá của root.
- [ ] Test xoá user: 409 khi đang khoá; bảng con và object R2 báo cáo/soi đội biến mất; ảnh bài viết còn và chuyển cho root; `posts.author_id`, `feedback.user_id`/`email` NULL; thử lại sau lỗi R2 hoàn tất được.
- [ ] Mỗi endpoint ghi của quản trị sinh đúng một dòng `admin_audit` (xoá: dòng bắt đầu + dòng kết thúc), có `subject_user_id`, không chứa secret hay email đầy đủ.
- [ ] UI vi/zh: khu Người dùng, Nhật ký (root), ẩn khu theo vai trò, hộp thoại khoá/xoá, thông báo bị khoá lấy từ server; smoke bằng `wrangler pages dev` với session seed.
- [ ] `docs/community-worker.md`, `docs/system-architecture.md`, `docs/project-changelog.md` cập nhật; `community-worker/rollback/0007_drop_user_block_triggers.sql` có; `npx tsc --noEmit`, `npx vitest run` (community-worker), `npm run test:node`, `npm run build`, `npm run verify`, `npm run test:dist`, `npm run test:e2e` xanh.

## Dừng và hỏi chỉ khi

- Trigger hoặc migration cần thử trên D1 remote (cần tạo/ghi tài nguyên Cloudflare).
- Lỗi không giải thích được ở luồng Better Auth thật.
- Cần thay đổi ngoài `community-worker/`, `js/community-*.js`, `src/components/community/`, `css/styles.css`, `tests-e2e/community.spec.mjs`, `docs/`.

## Red Team Review

### Session — 2026-10-17
**Findings:** 15 sau khi gộp 37 phát hiện thô của 4 reviewer (15 accepted, 0 rejected)
**Severity breakdown:** 2 Critical, 9 High, 4 Medium

| # | Finding | Severity | Disposition | Applied To |
|---|---|---|---|---|
| 1 | Harness thay `getSessionUser` bằng `USERS` tĩnh, test khoá/quyền không chạy code thật | Critical | Accept | Phase 1, 2, 4 |
| 2 | KDV dò email qua `like`; `mailto:` với email che | Critical | Accept | Phase 2, 4, 5 |
| 3 | Xoá user xoá ảnh bài viết (`uploads.kind='post'`) | High | Accept | Phase 4 |
| 4 | Ảnh `reports/*` mồ côi khi trigger huỷ batch | High | Accept | Phase 1 |
| 5 | Lọc trong `listReports` dùng chung làm trống hàng chờ admin | High | Accept | Phase 4 |
| 6 | Wrapper callback biến mọi 500 thành "bị khoá" | High | Accept (bỏ wrapper) | Phase 1, 5 |
| 7 | Thông báo khoá giả mạo qua URL | Medium | Accept (token HMAC + `/api/ban-notice`) | Phase 1, 5 |
| 8 | KDV tự duyệt nội dung của mình | High | Accept → đảo lại ở Validation Session 2 (cho phép) | Phase 2 |
| 9 | KDV đè khoá của root, xoá comment của staff, kiểm đích ngoài SQL | Medium | Accept | Phase 1, 2, 4 |
| 10 | Thứ tự rollout, Pages tự build từ `main`, schema check, rollback | High | Accept | Phase 6 |
| 11 | Đồng hồ trigger ≠ đồng hồ harness | High | Accept | Phase 1 |
| 12 | Test trên dialect `node:sqlite`; `changes()` phụ thuộc thứ tự | Medium | Accept | Phase 1, 3 |
| 13 | Cursor ISO không khớp `decodeCursor` | Medium | Accept | Phase 4 |
| 14 | Audit không tra được nội dung của user; bề mặt không dùng | High | Accept | Phase 1, 3 |
| 15 | Thừa phạm vi (cron, rate_limits, trigger 6 bảng), thiếu index/consumer/docs, smoke thiếu điều kiện | High | Accept | Phase 1, 2, 5, 6 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-01 … phase-06, reports/xac-minh-truoc-plan.md
- Decision deltas checked: 15
- Reconciled stale references: 9 (wrapper/`auth_error`, `changes()`, `user_has_posts`, cron session, `rate_limits`, `postsDraft`, `banned_at`, lọc actor/target, `BLOCKED_SQL` → `visibleUserSql`)
- Unresolved contradictions: 0

## Validation Log

### Session 1 — 2026-10-17
Verification: bỏ qua bước tự kiểm (red team đã fact-check ~98 claim: 92 verified, 4 failed → đã sửa trong Finding 3, 4, 1, 13; 2 partial → đã sửa hook không phụ thuộc `ctx`, ghi thư mục chạy `db:migrate:remote`). `changes()` đã chạy thử trên D1 cục bộ nhưng vẫn thay bằng `exists` (Finding 12).

| Câu hỏi | Quyết định | Áp vào |
|---|---|---|
| Xoá tài khoản đang bị khoá? | Chặn: 409 `user_banned`, phải mở khoá trước | Phase 4, 5 |
| Xoá cựu admin có bài viết? | `posts.author_id = null`, giữ `author_name`; ảnh bài viết giữ, chuyển cho root | Phase 4 |
| Kiểm chứng đăng nhập Google thật? | Không; Better Auth thật + Google giả lập, e2e mock, smoke `wrangler pages dev` với session seed | Phase 5 |

### Whole-Plan Consistency Sweep
- Files reread: plan.md, phase-04, phase-05
- Decision deltas checked: 3
- Reconciled stale references: 2 (nút Xoá ẩn khi đang khoá; bước chạy thật đổi sang session seed)
- Unresolved contradictions: 0

### Session 2 — 2026-10-17
| Câu hỏi | Quyết định | Áp vào |
|---|---|---|
| KDV tự duyệt chiến báo/mẫu soi đội của mình? | Cho phép (người dùng chốt, đảo Finding 8); bỏ `self_review`. Nhật ký vẫn ghi `subject_user_id` = chính KDV | Phase 2, 3, 6 |
