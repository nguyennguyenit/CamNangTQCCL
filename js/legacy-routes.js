// Bảng chuyển tiếp hash cũ của SPA sang đường dẫn mục mới. ESM thuần, không import: index.astro
// nhúng `resolveLegacyRoute.toString()` vào một script inline chặn trong <head>, nên thân hàm phải
// tự đủ (không tham chiếu biến/tham số ngoài). `js/team-detail-navigation.js` dùng cùng hàm này để
// chuẩn hóa `from` và snapshot quay lại có dạng URL gốc cũ.

/**
 * Trả về đích root-relative cùng origin cho một URL gốc, hoặc `null` khi URL phải ở lại `/`.
 * Không bao giờ dựng đích ngoài origin truyền vào; mọi đích đều thuộc 8 trang mục.
 * URL gốc bản Trung (`/zh/`) chuyển tới đúng trang mục bản Trung (giữ tiền tố `/zh`).
 */
export function resolveLegacyRoute(href, origin) {
  // Hash cũ giữ nguyên tại chỗ để trình duyệt tự cuộn tới anchor (Phase 3/4 mới đổi phần này).
  const ANCHOR_HASHES = ['nguon-du-lieu', 'tai-game', 'dau-trang'];
  // Nguồn cũ của hai alias Đội khác, đúng như `canonicalizeSectionHash` trước đây ghi.
  const ALIAS_SOURCE = { 'team-pk': 'team-intro', 'meta-cu': 'moi-phe' };
  const HASH_TARGETS = {
    'team-chuan': '/doi-chuan/',
    'team-khac': '/doi-khac/',
    'team-pk': '/doi-khac/',
    'meta-cu': '/doi-khac/',
    coexist: '/cung-ton/',
    khaihoang: '/khai-hoang/',
    'recruit-tracker': '/theo-doi-chieu-mo/',
    analyze: '/soi-doi-tu-anh/',
    'roster-recommend': '/goi-y-doi-tu-kho/',
  };
  // Alias tra cứu cũ `#heroes`/`#tactics` → `group` của trang Tra cứu.
  const LOOKUP_ALIAS_GROUP = { heroes: 'heroes', tactics: 'tactics' };
  // Khóa "root cũ" đóng băng tại đây: ROOT_QUERY_KEYS lúc cutover + ba khóa migrate tham chiếu.
  const ROOT_KEYS = [
    'season', 'category', 'q', 'faction', 'unit', 'score', 'tier', 'subcategory', 'source',
    'scenario', 'ruleset', 'sort', 'stars', 'config', 'khTeam', 'khVariant',
    'detail', 'legacyTeam', 'legacyVariant',
  ];
  const defaultOrigin = 'https://tqccl.invalid';
  const base = typeof origin === 'string' && origin ? origin : defaultOrigin;
  let baseUrl;
  let url;
  try {
    baseUrl = new URL(base);
    url = new URL(typeof href === 'string' && href ? href : '', baseUrl);
  } catch {
    return null;
  }
  if (url.origin !== baseUrl.origin) return null;
  // Tiền tố ngôn ngữ của trang nguồn; mục đích luôn cùng ngôn ngữ với trang gốc.
  const prefix = url.pathname === '/zh' || url.pathname.indexOf('/zh/') === 0 ? '/zh' : '';

  const rawHash = url.hash ? url.hash.slice(1) : '';
  const split = rawHash.indexOf('?');
  const name = split === -1 ? rawHash : rawHash.slice(0, split);

  // Không hash: chỉ query mang khóa root cũ mới suy ra mục mặc định cũ (Đội chuẩn).
  if (!name) {
    const carriesRootState = ROOT_KEYS.some((key) => url.searchParams.has(key));
    return carriesRootState ? `${prefix}/doi-chuan/${url.search}` : null;
  }
  if (ANCHOR_HASHES.indexOf(name) !== -1) return null;

  const params = new URLSearchParams(url.searchParams);
  // Bảng tra bằng own-property: hash không tin cậy không được khớp `constructor`/`__proto__`/…
  if (name === 'lookup' || Object.prototype.hasOwnProperty.call(LOOKUP_ALIAS_GROUP, name)) {
    const hashParams = new URLSearchParams(split === -1 ? '' : rawHash.slice(split + 1));
    // Hash là nguồn cụ thể hơn: bỏ giá trị `group`/`id` của query ngoài rồi mới gộp vào.
    params.delete('group');
    params.delete('id');
    if (Object.prototype.hasOwnProperty.call(LOOKUP_ALIAS_GROUP, name)) {
      params.set('group', LOOKUP_ALIAS_GROUP[name]);
    } else {
      for (const key of ['group', 'id']) {
        for (const value of hashParams.getAll(key)) params.append(key, value);
      }
    }
    const search = params.toString();
    return `${prefix}/tra-cuu/${search ? `?${search}` : ''}`;
  }
  if (!Object.prototype.hasOwnProperty.call(HASH_TARGETS, name)) return null;
  const target = HASH_TARGETS[name];
  if (Object.prototype.hasOwnProperty.call(ALIAS_SOURCE, name)) params.set('source', ALIAS_SOURCE[name]);
  const search = params.toString();
  return `${prefix}${target}${search ? `?${search}` : ''}`;
}
