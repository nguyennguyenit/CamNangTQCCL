// Bí danh tên theo locale cho bộ khớp tên (Soi đội và đọc ảnh kho Gợi ý đội ở client Nhật, bộ chấm eval của Worker): nối tên
// Nhật của `data/lookup-ja.json` vào `aliases` của từng bản ghi từ điển để `createEntityIndex` (js/analyze-map.js) khớp được tên
// in trong ảnh mà không phải sửa bộ khớp. Hàm thuần, không đụng bản ghi gốc.

const compactName = (value) => (typeof value === "string" ? value.replace(/\s+/gu, "") : "");

/**
 * Bản sao từng bản ghi của `dict` với `aliases` nối thêm tên Nhật `jaEntries[id].name` (và tên viết tách tiền tố như "SP 法正"
 * khi tên Nhật viết liền), bỏ trùng, giữ thứ tự (bí danh cũ trước). Bản ghi có tên Nhật mang thêm `localeNames` (các dạng tên
 * Nhật vừa nối) để bảng tên chính xác ưu tiên chúng (`createExactNameIndex`). Bản ghi không có mục ja vẫn được sao, `aliases`
 * giữ nguyên.
 * `jaEntries` là `entries` của `data/lookup-ja.json` (hoặc cả tài liệu, khi đó lấy `entries`).
 * @template {{id?: string, aliases?: unknown}} T
 * @param {readonly T[]} dict
 * @param {Record<string, {name?: unknown}> | {entries: Record<string, {name?: unknown}>} | null | undefined} jaEntries
 * @returns {(T & {localeNames?: string[]})[]}
 */
export function withLocaleAliases(dict, jaEntries) {
  if (!Array.isArray(dict)) throw new TypeError("withLocaleAliases nhận mảng bản ghi từ điển");
  const entries = jaEntries && typeof jaEntries === "object" && jaEntries.entries && typeof jaEntries.entries === "object"
    ? jaEntries.entries
    : jaEntries ?? {};
  return dict.map((record) => {
    const own = Array.isArray(record?.aliases) ? record.aliases.filter((value) => typeof value === "string") : [];
    const entry = typeof record?.id === "string" && Object.hasOwn(entries, record.id) ? entries[record.id] : null;
    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    if (!name) return { ...record, aliases: [...own] };
    // Ảnh client có thể in tiền tố biến thể tách rời ("SP 法正") dù dữ liệu Nhật viết liền ("SP法正").
    const spaced = name.replace(/^(SP|CO|40Y)(?=\S)/u, "$1 ");
    const localeNames = name === spaced ? [name] : [name, spaced];
    const aliases = [];
    for (const value of [...own, ...localeNames]) if (value && !aliases.includes(value)) aliases.push(value);
    return { ...record, aliases, localeNames };
  });
}

/**
 * Bảng tên chính xác (bỏ khoảng trắng) → khóa bản ghi (`keyOf(record)`), hai tầng:
 * 1. tên Nhật (`localeNames` do `withLocaleAliases` gắn): ảnh client Nhật in tên Nhật, mà bản Nhật có thể gọi một mục bằng chữ
 *    Hán nguồn của mục khác (固若金湯 bản Nhật là 金城湯池, trùng chữ Hán nguồn của một chiến pháp khác), nên tên Nhật thắng;
 * 2. `chinese` + `aliases` (chữ Hán nguồn, giản thể…), cho mọi tên không phải tên Nhật của mục nào.
 * Một tên trỏ về hai khóa khác nhau trong cùng tầng thì không còn chắc: giá trị `null`. Từ điển không qua `withLocaleAliases`
 * (bản vi/zh) chỉ có tầng 2, đúng như bảng chữ Hán trước đây.
 * @template K
 * @param {readonly any[]} records
 * @param {(record: any) => K} keyOf
 * @returns {Map<string, K | null>}
 */
export function createExactNameIndex(records, keyOf) {
  const tier = (namesOf) => {
    const map = new Map();
    for (const record of records) {
      const key = keyOf(record);
      for (const name of namesOf(record)) {
        const compact = compactName(name);
        if (!compact) continue;
        map.set(compact, map.has(compact) && map.get(compact) !== key ? null : key);
      }
    }
    return map;
  };
  const exact = tier((record) => [record?.chinese, ...(Array.isArray(record?.aliases) ? record.aliases : [])]);
  for (const [name, key] of tier((record) => (Array.isArray(record?.localeNames) ? record.localeNames : []))) exact.set(name, key);
  return exact;
}
