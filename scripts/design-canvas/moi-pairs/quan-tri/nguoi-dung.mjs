// Cặp so ảnh khu nguoi-dung của nhóm Quản trị (gộp ở ../quan-tri.mjs): AdminAuditMoi (#nhat-ky), AdminUsersMoi
// (#nguoi-dung), AdminUserBanMoi (chi tiết người dùng + hộp thoại Khoá đang mở, chọn 7 ngày) — mỗi artboard 1440 + 390.
// Artboard vẽ "bây giờ" là 21:02 11/11/2026 (+07) và có nút "Tải thêm"; mock chung trả `nextCursor: null` và không
// cố định giờ, nên `setup` route danh sách/nhật ký/chi tiết/số đếm bằng dữ liệu giống artboard, cố định đồng hồ trình
// duyệt rồi tải lại trang (route và đồng hồ phải có trước khi khu gọi API và dựng nhóm ngày).
import { ADMIN, userRow } from '../../../../tests-e2e/helpers/community-mock.mjs';

/** "Bây giờ" của artboard: 21:02 ngày 11/11/2026 giờ Việt Nam. */
const NOW = new Date('2026-11-11T14:02:00.000Z');
const ago = (minutes) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const DAY = 24 * 60;

/** Số đếm trên điều hướng như artboard (7 chiến báo, 12 bản nháp, 5 góp ý, 4 ảnh soi đội, 2 đội). */
const COUNTS = { reportsPending: 7, postsDraft: 12, feedbackNew: 5, feedbackDone: 0, scanPending: 4, teamsPending: 2 };

const counts = (comments, reports, feedback, scanSamples) => ({ comments, reports, feedback, scanSamples });
/** 8 tài khoản của AdminUsersMoi; người cuối là chính người xem (root, id của ADMIN). */
const USERS = [
  userRow({ id: 'u11', name: 'Lạc Dương Khách', email: 'lacduongkhach@example.com', createdAt: '2026-11-10T03:00:00.000Z', lastSeenAt: null, counts: counts(0, 0, 0, 0) }),
  userRow({ id: 'u12', name: 'Hổ Lao Quan', email: 'holaoquan@example.com', createdAt: '2026-09-02T03:00:00.000Z', lastSeenAt: ago(4 * DAY), deleting: true, counts: counts(5, 3, 1, 0) }),
  userRow({ id: 'u13', name: 'Bạch Đế Thành', email: 'bachdethanh@example.com', createdAt: '2026-08-20T03:00:00.000Z', lastSeenAt: ago(180), ban: { until: '2026-11-18T13:40:00.000Z', reason: 'Spam quảng cáo bán tài khoản ở bình luận.', byRole: 'moderator' }, counts: counts(31, 0, 0, 0) }),
  userRow({ id: 'u14', name: 'Tào Mạnh Đức', email: 'taomanhduc@example.com', createdAt: '2026-08-14T03:00:00.000Z', lastSeenAt: ago(25), counts: counts(23, 1, 0, 0) }),
  userRow({ id: 'u15', name: 'Minh Khang', email: 'minhkhang@example.com', createdAt: '2026-08-09T03:00:00.000Z', lastSeenAt: ago(3 * DAY), ban: { until: null, reason: 'Lăng mạ người chơi khác nhiều lần sau khi đã được nhắc.', byRole: 'root' }, counts: counts(2, 0, 4, 0) }),
  userRow({ id: 'u16', name: 'Vân Trường', email: 'vantruong@example.com', createdAt: '2026-08-03T03:00:00.000Z', lastSeenAt: ago(120), counts: counts(14, 6, 2, 1) }),
  userRow({ id: 'u17', name: 'Tiểu Tướng Quân', email: 'tieutuongquan@example.com', role: 'moderator', createdAt: '2026-08-01T03:00:00.000Z', lastSeenAt: ago(10), counts: counts(41, 12, 3, 2) }),
  userRow({ id: ADMIN.id, name: 'Quản trị', email: 'quantri@example.com', role: 'root', createdAt: '2026-08-01T02:00:00.000Z', lastSeenAt: ago(0), counts: counts(8, 2, 0, 0) }),
];

const ROOT_ACTOR = { id: ADMIN.id, role: 'root', label: 'Quản trị <qu***@example.com>' };
const MOD_ACTOR = { id: 'u17', role: 'moderator', label: 'Tiểu Tướng Quân <ti***@example.com>' };
const entry = (id, at, actor, action, target, extra = {}) => ({
  id, actor, action, target, subjectUserId: null, reason: null, meta: null, status: 'ok', createdAt: at, ...extra,
});
/** 11 thao tác của AdminAuditMoi qua 3 ngày (giờ +07 trong chú thích). */
const AUDIT = [
  entry('a11', '2026-11-11T13:52:00.000Z', ROOT_ACTOR, 'post.update', { type: 'post', id: 'p1', label: 'Khai hoang đầu mùa PK-S27: thứ tự đánh đất' }, { meta: { deploy: 'pending' } }), // 20:52
  entry('a10', '2026-11-11T13:40:00.000Z', MOD_ACTOR, 'user.ban', { type: 'user', id: 'u20', label: 'ba***@example.com' }, { reason: 'Spam quảng cáo bán tài khoản ở bình luận.', meta: { duration: '7d' } }), // 20:40
  entry('a09', '2026-11-11T13:31:00.000Z', MOD_ACTOR, 'comment.delete', { type: 'comment', id: 'c9', label: '/doi-chuan/' }, { subjectUserId: 'u14' }), // 20:31
  entry('a08', '2026-11-11T12:05:00.000Z', ROOT_ACTOR, 'team.approve', { type: 'team', id: 't1', label: 'Phi Bình Vân' }), // 19:05
  entry('a07', '2026-11-11T11:12:00.000Z', ROOT_ACTOR, 'ai.config.update', { type: 'ai_config', id: null, label: null }, { status: 'failed' }), // 18:12
  entry('a06', '2026-11-10T15:15:00.000Z', MOD_ACTOR, 'report.reject', { type: 'report', id: 'r9', label: '/doi-khac/' }, { reason: 'Ảnh bị cắt mất đội hình đối thủ.' }), // 22:15
  entry('a05', '2026-11-10T09:02:00.000Z', ROOT_ACTOR, 'user.delete', { type: 'user', id: 'u21', label: 'ho***@example.com' }, { status: 'partial' }), // 16:02
  entry('a04', '2026-11-10T09:00:00.000Z', ROOT_ACTOR, 'user.delete.start', { type: 'user', id: 'u21', label: 'ho***@example.com' }), // 16:00
  entry('a03', '2026-11-10T02:30:00.000Z', ROOT_ACTOR, 'season.open', { type: 'season', id: 'PK-S27', label: 'PK-S27' }), // 09:30
  entry('a02', '2026-11-08T07:02:00.000Z', ROOT_ACTOR, 'user.role', { type: 'user', id: 'u17', label: 'ti***@example.com' }, { meta: { from: 'user', to: 'moderator' } }), // 14:02
  entry('a01', '2026-11-08T03:20:00.000Z', ROOT_ACTOR, 'user.ban', { type: 'user', id: 'u15', label: 'mi***@example.com' }, { reason: 'Lăng mạ người chơi khác nhiều lần sau khi đã được nhắc.', meta: { duration: 'permanent' } }), // 10:20
];

const SPAM = 'Bán tài khoản full tướng 5 sao giá rẻ, ai cần nhắn mình qua Zalo để xem tài khoản.';
/** Chi tiết Tào Mạnh Đức như AdminUserBanMoi: 4 bình luận, 1 chiến báo, 1 dòng nhật ký. */
const DETAIL = {
  comments: [
    { id: 'c1', page: '/doi-chuan/', lang: 'vi', body: SPAM, createdAt: '2026-11-11T13:48:00.000Z' },
    { id: 'c2', page: '/khai-hoang/', lang: 'vi', body: SPAM, createdAt: '2026-11-11T13:47:00.000Z' },
    { id: 'c3', page: '/doi-khac/', lang: 'vi', body: SPAM, createdAt: '2026-11-11T13:45:00.000Z' },
    { id: 'c4', page: '/doi-chuan/', lang: 'vi', body: 'Thiếu Pháp Chính thì đội này thay bằng tướng nào được ạ?', createdAt: '2026-11-09T08:10:00.000Z' },
  ],
  reports: [{ id: 'r1', page: '/doi-chuan/', lang: 'vi', result: 'win', status: 'approved', rejectReason: null, imageUrl: null, createdAt: '2026-11-02T08:20:00.000Z' }],
  audit: AUDIT.filter((item) => item.subjectUserId === 'u14'),
};

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/** Route dữ liệu artboard + cố định đồng hồ, tải lại trang và chờ `ready`. */
const prepare = (ready) => async (page) => {
  await page.clock.setFixedTime(NOW);
  await page.route((url) => url.pathname === '/api/admin/counts', (route) => json(route, COUNTS));
  await page.route((url) => url.pathname === '/api/admin/users', (route) => {
    const url = new URL(route.request().url());
    return json(route, url.searchParams.get('cursor') ? { items: [], nextCursor: null } : { items: USERS, nextCursor: 'c2' });
  });
  await page.route((url) => /^\/api\/admin\/users\/[^/]+$/.test(url.pathname), (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    return json(route, { user: USERS.find((user) => user.id === id) ?? USERS[3], ...DETAIL });
  });
  await page.route((url) => url.pathname === '/api/admin/audit', (route) => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action');
    const items = AUDIT.filter((item) => !action || item.action === action);
    return json(route, url.searchParams.get('cursor') ? { items: [], nextCursor: null } : { items, nextCursor: 'c2' });
  });
  await page.reload();
  await page.waitForSelector(ready);
};

/** Chi tiết Tào Mạnh Đức → "Khoá…" → chọn 7 ngày + điền lý do như artboard. */
const openBan = async (page) => {
  await prepare('.adm-user-list .adm-user')(page);
  await page.locator('.adm-user-open', { hasText: 'Tào Mạnh Đức' }).click();
  await page.waitForSelector('.adm-user-stats');
  await page.getByRole('button', { name: 'Khoá…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Khoá tài khoản' });
  await dialog.getByRole('radio', { name: '7 ngày' }).check();
  await dialog.getByLabel('Lý do').fill('Spam quảng cáo bán tài khoản ở bình luận Đội chuẩn, Khai hoang và Đội khác.');
};

const MOCK = { state: 'quan-tri' };
const pairs = [];
for (const width of [1440, 390]) {
  const suffix = width === 390 ? 'Mobile' : '';
  pairs.push(
    { artboard: `AdminAuditMoi${suffix}`, path: '/quan-tri/#nhat-ky', width, ready: '#adm-panel-audit .adm-audit-day', mock: MOCK, setup: prepare('#adm-panel-audit .adm-audit-day') },
    { artboard: `AdminUsersMoi${suffix}`, path: '/quan-tri/#nguoi-dung', width, ready: '.adm-user-list .adm-user', mock: MOCK, setup: prepare('.adm-user-list .adm-user') },
    { artboard: `AdminUserBanMoi${suffix}`, path: '/quan-tri/#nguoi-dung', width, ready: '.adm-user-list .adm-user', mock: MOCK, setup: openBan },
  );
}

export default pairs;
