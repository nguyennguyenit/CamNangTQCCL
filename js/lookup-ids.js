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
 * Bộ tra mã hồ sơ Tra cứu từ tên chiến pháp / binh thư / tướng của dữ liệu đội. Chiến pháp: ưu tiên tên chữ Hán nguồn
 * (`chinese` + `aliases`), rồi tới slug tên Việt. Binh thư: ô có tên Hán nguồn chỉ khớp theo `chinese` +
 * `sourceNames` (bản dịch tên Việt của ô có thể lệch hoặc nhầm sang binh thư khác); ô chỉ có tên Việt mới tra
 * theo slug. Tướng: `chinese` rồi tên Việt chính xác. Tên không có hồ sơ trả `null` để nơi gọi giữ dạng chữ.
 */
export function createLookupIdResolver({ tactics = [], books = [], heroes = [] } = {}) {
  const tacticByName = new Map();
  const tacticIds = new Set();
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
  const heroByRaw = new Map();
  const heroByVi = new Map();
  for (const row of Array.isArray(heroes) ? heroes : []) {
    if (typeof row?.id !== "string" || !row.id.startsWith("hero:")) continue;
    for (const [index, name] of [[heroByRaw, row.chinese], [heroByVi, row.viet]]) {
      if (typeof name === "string" && name.trim() && !index.has(name.trim())) index.set(name.trim(), row.id);
    }
  }
  return {
    tactic: (raw, vi) => byRaw(tacticByName, raw) ?? byVi(tacticIds, "tactic", vi),
    book: (raw, vi) => (hasRaw(raw) ? byRaw(bookByName, raw) : byVi(bookIds, "book", vi)),
    /** Tướng theo tên nguồn chữ Hán, thiếu thì theo đúng tên Việt của kho tướng; không đoán theo tên gần giống. */
    hero: (raw, vi) => (typeof raw === "string" ? heroByRaw.get(raw.trim()) : null) ?? (typeof vi === "string" ? heroByVi.get(vi.trim()) : null) ?? null,
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

const ITEM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slug mặc định của trang riêng một mục: hậu tố sau `:` của mã (`hero:luu-bi` → `luu-bi`). Mã đặc kỹ trang bị
 * (`equipment-special:*`) nằm trong trang trang bị, không có trang riêng; mã sai dạng cũng không có.
 */
export function lookupDerivedSlug(id) {
  if (!groupForId(id) || id.startsWith("equipment-special:")) return null;
  const slug = id.slice(id.indexOf(":") + 1);
  return ITEM_SLUG.test(slug) ? slug : null;
}

/**
 * Ngoại lệ của quy tắc trên (`id → slug`, slug ledger đã cấp khác hậu tố mã, vd `-2` khi trùng tên); build nhúng
 * `#lookup-route-handles` và trình duyệt đăng ký lại. Hiện không có ngoại lệ nên bảng rỗng.
 */
let lookupRouteExceptions = new Map();

/**
 * Đăng ký bảng ngoại lệ `{id: slug}`; bảng sai dạng (mã không có trang riêng, slug sai dạng) bị từ chối nguyên khối và
 * không thay bảng hiện hành.
 */
export function setLookupRouteHandles(handles) {
  if (!handles || typeof handles !== "object" || Array.isArray(handles)) return false;
  const next = new Map();
  for (const [id, slug] of Object.entries(handles)) {
    if (!lookupDerivedSlug(id) || typeof slug !== "string" || !ITEM_SLUG.test(slug)) return false;
    next.set(id, slug);
  }
  lookupRouteExceptions = next;
  return true;
}

/** Như `setLookupRouteHandles` cho payload JSON nhúng trong trang; lỗi parse không đổi bảng hiện hành. */
export function setLookupRouteHandlesFromJSON(raw) {
  if (typeof raw !== "string" || !raw) return false;
  try {
    return setLookupRouteHandles(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** Đường dẫn trang riêng của một mục (`/tra-cuu/<nhóm>/<slug>/`, chưa gắn tiền tố ngôn ngữ); mã không có trang riêng trả `null`. */
export function lookupItemPath(id) {
  const slug = lookupRouteExceptions.get(id) ?? lookupDerivedSlug(id);
  return slug ? `${lookupGroupPath(groupForId(id))}${slug}/` : null;
}

/** Đường dẫn mở hồ sơ của một mục: trang riêng khi có, không thì hồ sơ `?id=` trên trang nhóm. */
export function lookupHref(id) {
  return lookupItemPath(id) ?? lookupProfilePath(id);
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
