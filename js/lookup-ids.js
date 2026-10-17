// Mã hồ sơ và đường dẫn Tra cứu (`/tra-cuu/<nhóm>/?id=…`) dùng chung cho trang Tra cứu, trang mục lục và các
// trang liên kết vào đó. Slug mã khớp hàm `_slug` của pipeline định danh: chiến pháp đã có `id` trong dữ liệu,
// binh thư dựng mã từ tên Việt. Mọi href Tra cứu đi qua module này, không tự nối chuỗi ở nơi khác.

/** Slug ASCII của tên Việt: bỏ dấu, `đ` → `d`, cụm ký tự khác chữ/số thành một `-`. */
export function lookupSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Mã hồ sơ binh thư `book:<slug tên Việt>`; bản ghi không có tên Việt thì không có hồ sơ. */
export function bookLookupId(record) {
  const slug = lookupSlug(record?.viet ?? record?.hanViet);
  return slug ? `book:${slug}` : null;
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;
/** Tiền tố cải tạo chiến pháp của nguồn (`精・鋒矢陣`, `拓濟世救貧`) và bản dịch (`Tinh · Phong Thi Trận`). */
const RAW_MODIFIED = /^[精轉转拓]\s*[·・]?\s*/u;
const VI_MODIFIED = /^(?:Tinh|Chuyển|Thác)\s*·\s*/u;

const nameList = (value) => (Array.isArray(value) ? value : []).filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim());

/**
 * Tên chữ Hán nguồn của từng binh thư, lấy từ bảng danh tính đã duyệt (`pipeline/recommended-identity-map.json`,
 * mục `kind: "book"`), khớp theo tên Việt với `books-dict`. `aliases`: tên Hán của mục để tìm kiếm. `formerNames`:
 * tên nguồn của mục chỉ có chữ Hán (không kèm tên Việt nào) — tức tên cũ / biến thể đã xác nhận là cùng binh thư.
 * Tên mà `books-dict` đã nhận là tên nguồn hiện hành (`chinese`, `sourceNames`) không lặp lại ở đây; tên trong
 * `excludedSourceNames` (binh thư khác bị dịch nhầm sang tên Việt) không gắn vào hồ sơ nào.
 * Trả `{[bookId]: {aliases, formerNames}}`.
 */
export function bookSourceAliases(books, identityEntries) {
  const byVi = new Map();
  const excluded = new Set();
  for (const row of Array.isArray(books) ? books : []) {
    const id = bookLookupId(row);
    for (const name of nameList(row?.excludedSourceNames)) excluded.add(name);
    if (id) byVi.set(lookupSlug(row.viet ?? row.hanViet), {id, own: new Set([...nameList([row.chinese]), ...nameList(row.sourceNames)])});
  }
  const result = {};
  for (const item of Array.isArray(identityEntries) ? identityEntries : []) {
    if (item?.kind !== "book") continue;
    const names = nameList(item.aliases);
    const han = names.filter((name) => CJK.test(name));
    const book = [item.displayNameVi, ...names.filter((name) => !CJK.test(name))]
      .map((name) => byVi.get(lookupSlug(name)))
      .find(Boolean);
    if (!book) continue;
    const renamed = han.length === names.length;
    for (const name of han) {
      if (book.own.has(name) || excluded.has(name)) continue;
      const slot = (result[book.id] ??= {aliases: [], formerNames: []});
      if (!slot.aliases.includes(name)) slot.aliases.push(name);
      if (renamed && !slot.formerNames.includes(name)) slot.formerNames.push(name);
    }
  }
  return result;
}

/**
 * Bảng mã chiến pháp đã gộp → mã còn sống: hàng nào có `lookup.formerIds` chứa mã đó. Mã còn là hàng sống thì không
 * bao giờ bị coi là đã gộp.
 * @returns {Map<string, string>}
 */
export function createFormerTacticIdIndex(tactics) {
  const rows = Array.isArray(tactics) ? tactics : [];
  const live = new Set(rows.map((row) => row?.id));
  const former = new Map();
  for (const row of rows) {
    const ids = row?.lookup?.formerIds;
    if (typeof row?.id !== "string" || !Array.isArray(ids)) continue;
    for (const id of ids) if (typeof id === "string" && !live.has(id) && !former.has(id)) former.set(id, row.id);
  }
  return former;
}

/**
 * Bộ tra tên chiến pháp → mã `tactic:` theo danh mục (`{id, viet, hanViet, aliases[]}`): tên Việt hiển thị có thể đã
 * đổi nên slug của `viet` không còn bằng mã. Xét lần lượt các tầng `viet` → `hanViet` → alias; tầng đầu tiên có ứng
 * viên quyết định (tên hiển thị hiện hành thắng tên Hán-Việt cũ trùng chữ). Trong tầng đó chọn hàng có
 * `id === "tactic:" + slug(tên)` (cặp mã trùng tên client), nếu không thì hàng đầu tiên theo thứ tự danh mục.
 * Không có ứng viên thì trả `null` để nơi gọi dùng đường dự phòng của mình.
 * @returns {(name: unknown) => string | null}
 */
export function createTacticNameIndex(tactics) {
  const former = createFormerTacticIdIndex(tactics);
  const tiers = [new Map(), new Map(), new Map()];
  const add = (map, name, id) => {
    const slug = typeof name === "string" ? lookupSlug(name) : "";
    if (!slug) return;
    if (!map.has(slug)) map.set(slug, []);
    if (!map.get(slug).includes(id)) map.get(slug).push(id);
  };
  for (const row of Array.isArray(tactics) ? tactics : []) {
    if (typeof row?.id !== "string" || !row.id.startsWith("tactic:")) continue;
    add(tiers[0], row.viet, row.id);
    add(tiers[1], row.hanViet, row.id);
    for (const alias of Array.isArray(row.aliases) ? row.aliases : []) add(tiers[2], alias, row.id);
  }
  return (name) => {
    const slug = typeof name === "string" ? lookupSlug(name) : "";
    if (!slug) return null;
    const own = `tactic:${slug}`;
    const ids = tiers.map((map) => map.get(slug)).find((list) => list?.length);
    if (!ids) return former.get(own) ?? null;
    return ids.includes(own) ? own : ids[0];
  };
}

/** Như `createTacticNameIndex`, nhưng tên không có trong danh mục dùng `tactic:<slug tên>` (kể cả khi danh mục rỗng). */
export function createTacticIdResolver(tactics) {
  const index = createTacticNameIndex(tactics);
  const former = createFormerTacticIdIndex(tactics);
  return (name) => {
    const id = index(name) ?? `tactic:${lookupSlug(name)}`;
    return former.get(id) ?? id;
  };
}

/**
 * Bộ tra mã hồ sơ Tra cứu từ tên chiến pháp / binh thư của dữ liệu đội. Chiến pháp: ưu tiên tên chữ Hán nguồn
 * (`chinese` + `aliases`), rồi tới slug tên Việt. Binh thư: ô có tên Hán nguồn chỉ khớp theo `chinese` +
 * `sourceNames` (bản dịch tên Việt của ô có thể lệch hoặc nhầm sang binh thư khác); ô chỉ có tên Việt mới tra
 * theo slug. Tên không có hồ sơ trả `null` để nơi gọi giữ dạng chữ.
 */
export function createLookupIdResolver({ tactics = [], books = [] } = {}) {
  const tacticByName = new Map();
  const tacticIds = new Set();
  const tacticByVi = createTacticNameIndex(tactics);
  const formerTactic = createFormerTacticIdIndex(tactics);
  for (const row of Array.isArray(tactics) ? tactics : []) {
    if (typeof row?.id !== "string" || !row.id.startsWith("tactic:")) continue;
    tacticIds.add(row.id);
    for (const name of [row.chinese, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
      if (typeof name === "string" && name.trim() && !tacticByName.has(name.trim())) tacticByName.set(name.trim(), row.id);
    }
  }
  const bookByName = new Map();
  const bookIds = new Set();
  for (const row of Array.isArray(books) ? books : []) {
    const id = bookLookupId(row);
    if (!id) continue;
    bookIds.add(id);
    for (const name of [...nameList([row.chinese]), ...nameList(row.sourceNames)]) if (!bookByName.has(name)) bookByName.set(name, id);
  }
  const hasRaw = (raw) => typeof raw === "string" && CJK.test(raw);
  const byRaw = (index, raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value || !CJK.test(value)) return null;
    return index.get(value) ?? index.get(value.replace(RAW_MODIFIED, "")) ?? null;
  };
  const byVi = (ids, prefix, vi) => {
    const slug = lookupSlug(typeof vi === "string" ? vi.replace(VI_MODIFIED, "") : "");
    return slug && ids.has(`${prefix}:${slug}`) ? `${prefix}:${slug}` : null;
  };
  const byTacticVi = (vi) => {
    const name = typeof vi === "string" ? vi.replace(VI_MODIFIED, "") : "";
    const id = tacticByVi(name) ?? byVi(tacticIds, "tactic", vi);
    return id === null ? null : formerTactic.get(id) ?? id;
  };
  return {
    tactic: (raw, vi) => byRaw(tacticByName, raw) ?? byTacticVi(vi),
    book: (raw, vi) => (hasRaw(raw) ? byRaw(bookByName, raw) : byVi(bookIds, "book", vi)),
  };
}

/**
 * Tên chiến pháp hiển thị trên bản Việt = `viet` hiện hành của danh mục. Tên lưu trong dữ liệu đội/Khai hoang/Cùng Tồn
 * (Việt cũ hoặc chữ Hán nguồn) được tra bằng `createLookupIdResolver` (chữ Hán trước, rồi tên Việt/Hán-Việt/alias);
 * tiền tố cải tạo (`Tinh · `) giữ nguyên, ô nhiều lựa chọn `A/B` tra từng phần. Không tra được thì trả nguyên chuỗi lưu.
 * Chỉ dựng chỉ mục một lần cho mỗi danh mục.
 * @returns {(stored: unknown, raw?: unknown) => string}
 */
export function createTacticDisplayName(tactics) {
  const viById = new Map();
  for (const row of Array.isArray(tactics) ? tactics : []) {
    if (typeof row?.id === "string" && row.id.startsWith("tactic:") && typeof row.viet === "string" && row.viet.trim()) viById.set(row.id, row.viet.trim());
  }
  const resolver = createLookupIdResolver({ tactics });
  const MODIFIED_KEEP = /^((?:Tinh|Chuyển|Thác)\s*[·・]\s*)/u;
  const single = (text, raw) => {
    const id = resolver.tactic(raw, text);
    const viet = id ? viById.get(id) : null;
    if (!viet) return null;
    const prefix = typeof text === "string" ? text.match(MODIFIED_KEEP)?.[1] ?? "" : "";
    return prefix + viet;
  };
  return (stored, raw = null) => {
    if (typeof stored !== "string") return typeof raw === "string" && raw.trim() ? (single("", raw) ?? stored) : stored;
    const text = stored.trim();
    if (!text) return stored;
    const whole = single(text, raw);
    if (whole !== null) return whole;
    if (!text.includes("/")) return stored;
    const parts = text.split(/(\s*\/\s*)/u);
    return parts.map((part, index) => (index % 2 || !part.trim() ? part : (single(part.trim(), null) ?? part))).join("");
  };
}

/** Đường dẫn (bản Việt) của từng nhóm Tra cứu: `/tra-cuu/<slug>/`. Thứ tự là thứ tự công bố. */
export const LOOKUP_GROUP_SLUGS = Object.freeze({
  heroes: "tuong",
  tactics: "chien-phap",
  equipment: "trang-bi",
  advisors: "quan-su",
  "troop-mods": "cai-tao-binh-chung",
  buildings: "cong-trinh",
  books: "binh-thu",
});

const GROUP_BY_KIND = Object.freeze({
  hero: "heroes", tactic: "tactics", equipment: "equipment", "equipment-special": "equipment",
  advisor: "advisors", "troop-mod": "troop-mods", building: "buildings", book: "books",
});

/** Nhóm Tra cứu của một mã hồ sơ canonical (`hero:…`, `equipment-special:…`); mã sai dạng trả `null`. */
export function groupForId(id) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(id)) return null;
  return GROUP_BY_KIND[id.slice(0, id.indexOf(":"))] ?? null;
}

/** Đường dẫn trang nhóm (chưa gắn tiền tố ngôn ngữ); nhóm lạ trả `null`. */
export function lookupGroupPath(group) {
  return Object.hasOwn(LOOKUP_GROUP_SLUGS, group) ? `/tra-cuu/${LOOKUP_GROUP_SLUGS[group]}/` : null;
}

/** Đường dẫn hồ sơ Tra cứu (chưa gắn tiền tố ngôn ngữ) trên trang của đúng nhóm; mã sai dạng trả `null`. */
export function lookupProfilePath(id) {
  const path = lookupGroupPath(groupForId(id));
  return path ? `${path}?${new URLSearchParams({ id })}` : null;
}

/**
 * Đích chuyển tiếp của trang mục lục `/tra-cuu/` cho link cũ `?group=<nhóm>&id=<mã>` (hoặc chỉ `?id=`):
 * trang nhóm (kèm hồ sơ khi mã hợp lệ và thuộc nhóm), khóa khác của query đi tiếp. Không có `group`/`id`
 * thì trả `null` (ở lại mục lục); giá trị lặp/lạ/lệch nhóm trả mục lục đã bỏ hai khóa đó.
 * Tự đủ (không đóng gói biến ngoài) để trang mục lục nhúng `toString()` vào script inline chạy trước khi vẽ.
 */
export function lookupHubTarget(href, slugs, kinds) {
  const url = new URL(href);
  const params = url.searchParams;
  if (!params.has("group") && !params.has("id")) return null;
  const groups = params.getAll("group");
  const ids = params.getAll("id");
  params.delete("group");
  params.delete("id");
  const prefix = url.pathname.startsWith("/zh/") ? "/zh" : "";
  const rest = params.toString();
  const hub = `${prefix}/tra-cuu/${rest ? `?${rest}` : ""}${url.hash}`;
  if (groups.length > 1 || ids.length > 1) return hub;
  const id = ids[0] ?? null;
  const idMatch = id !== null && /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(id) ? id.slice(0, id.indexOf(":")) : null;
  const idGroup = idMatch !== null && Object.hasOwn(kinds, idMatch) ? kinds[idMatch] : null;
  const group = groups[0] ?? idGroup;
  if (group === null || !Object.hasOwn(slugs, group) || (id !== null && idGroup !== group)) return hub;
  if (id !== null) params.set("id", id);
  const query = params.toString();
  return `${prefix}/tra-cuu/${slugs[group]}/${query ? `?${query}` : ""}${url.hash}`;
}

/** Bảng tra `lookupHubTarget` cần (truyền tường minh để bản nhúng inline tự đủ). */
export const LOOKUP_HUB_TABLES = Object.freeze({ slugs: LOOKUP_GROUP_SLUGS, kinds: GROUP_BY_KIND });
