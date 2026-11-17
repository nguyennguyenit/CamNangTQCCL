// Bí danh tên theo locale cho bộ khớp tên (Soi đội đọc ảnh client Nhật, bộ chấm eval của Worker): nối tên Nhật của
// `data/lookup-ja.json` vào `aliases` của từng bản ghi từ điển để `createEntityIndex` (js/analyze-map.js) khớp được tên in
// trong ảnh mà không phải sửa bộ khớp. Hàm thuần, không đụng bản ghi gốc.

/**
 * Bản sao từng bản ghi của `dict` với `aliases` nối thêm tên Nhật `jaEntries[id].name` (và tên viết tách tiền tố như "SP 法正"
 * khi tên Nhật viết liền), bỏ trùng, giữ thứ tự (bí danh cũ trước). Bản ghi không có mục ja vẫn được sao, `aliases` giữ nguyên.
 * `jaEntries` là `entries` của `data/lookup-ja.json` (hoặc cả tài liệu, khi đó lấy `entries`).
 * @template {{id?: string, aliases?: unknown}} T
 * @param {readonly T[]} dict
 * @param {Record<string, {name?: unknown}> | {entries: Record<string, {name?: unknown}>} | null | undefined} jaEntries
 * @returns {T[]}
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
    const aliases = [];
    for (const value of [...own, name, spaced]) if (value && !aliases.includes(value)) aliases.push(value);
    return { ...record, aliases };
  });
}
