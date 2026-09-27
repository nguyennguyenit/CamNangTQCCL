// Mã hồ sơ Tra cứu (`/tra-cuu/?id=…`) dùng chung cho trang Tra cứu và các trang liên kết vào đó.
// Slug khớp hàm `_slug` của pipeline định danh: chiến pháp đã có `id` trong dữ liệu, binh thư dựng mã từ tên Việt.

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

/** Đường dẫn hồ sơ Tra cứu (chưa gắn tiền tố ngôn ngữ); mã hoá như `formatLookupQuery` của trang Tra cứu. */
export const lookupProfilePath = (id) => `/tra-cuu/?${new URLSearchParams({ id })}`;
