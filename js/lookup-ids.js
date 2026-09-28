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

/**
 * Tên chữ Hán nguồn của từng binh thư, lấy từ bảng danh tính đã duyệt (`pipeline/recommended-identity-map.json`,
 * mục `kind: "book"`), khớp theo tên Việt với `books-dict`. `aliases`: mọi tên Hán của mục (phồn thể, tên cũ) để
 * tìm kiếm. `formerNames`: tên nguồn của mục chỉ có chữ Hán (không kèm tên Việt nào) — tức tên cũ / biến thể mà
 * người dùng đã xác nhận là cùng binh thư đổi tên (`以退為進` → `以直报怨`). Trả `{[bookId]: {aliases, formerNames}}`.
 */
export function bookSourceAliases(books, identityEntries) {
  const byVi = new Map();
  for (const row of Array.isArray(books) ? books : []) {
    const id = bookLookupId(row);
    if (id) byVi.set(lookupSlug(row.viet ?? row.hanViet), {id, chinese: typeof row.chinese === "string" ? row.chinese.trim() : ""});
  }
  const result = {};
  for (const item of Array.isArray(identityEntries) ? identityEntries : []) {
    if (item?.kind !== "book") continue;
    const names = (Array.isArray(item.aliases) ? item.aliases : []).filter((name) => typeof name === "string" && name.trim()).map((name) => name.trim());
    const han = names.filter((name) => CJK.test(name));
    const book = [item.displayNameVi, ...names.filter((name) => !CJK.test(name))]
      .map((name) => byVi.get(lookupSlug(name)))
      .find(Boolean);
    if (!book) continue;
    const renamed = han.length === names.length;
    for (const name of han) {
      if (name === book.chinese) continue;
      const slot = (result[book.id] ??= {aliases: [], formerNames: []});
      if (!slot.aliases.includes(name)) slot.aliases.push(name);
      if (renamed && !slot.formerNames.includes(name)) slot.formerNames.push(name);
    }
  }
  return result;
}

/**
 * Bộ tra mã hồ sơ Tra cứu từ tên chiến pháp / binh thư của dữ liệu đội: ưu tiên tên chữ Hán nguồn
 * (`chinese` + `aliases`), rồi tới slug tên Việt. Tên không có hồ sơ trả `null` để nơi gọi giữ dạng chữ.
 */
export function createLookupIdResolver({ tactics = [], books = [] } = {}) {
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
    if (typeof row.chinese === "string" && row.chinese.trim()) bookByName.set(row.chinese.trim(), id);
  }
  const byRaw = (index, raw) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value || !CJK.test(value)) return null;
    return index.get(value) ?? index.get(value.replace(RAW_MODIFIED, "")) ?? null;
  };
  const byVi = (ids, prefix, vi) => {
    const slug = lookupSlug(typeof vi === "string" ? vi.replace(VI_MODIFIED, "") : "");
    return slug && ids.has(`${prefix}:${slug}`) ? `${prefix}:${slug}` : null;
  };
  return {
    tactic: (raw, vi) => byRaw(tacticByName, raw) ?? byVi(tacticIds, "tactic", vi),
    book: (raw, vi) => byVi(bookIds, "book", vi) ?? byRaw(bookByName, raw),
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
