// Đổi chữ Hán phồn thể / giản thể sang tự dạng Nhật (shinjitai) theo bảng `data/ja-kanji-variants.json`, cùng quy tắc với
// `pipeline/shinjitai.py`: chỉ đổi từng ký tự có trong bảng, ký tự khác (Latin, số, khoảng trắng, chữ Hán không có trong bảng)
// giữ nguyên. Đây là phép đổi mặt chữ, không phải dịch: tên riêng bản Nhật gọi khác nghĩa nằm trong `data/lookup-ja.json`.
// Hàm thuần, không tự tải bảng: trang ja nạp bảng qua bộ nạp byte đã kiểm hash (`js/lookup-data.js`), build đọc từ đĩa.

/** Lỗi bảng ký tự sai dạng: không đổi chữ theo bảng hỏng. */
export class ShinjitaiTableError extends Error {}

/**
 * Bảng `{ký tự nguồn: ký tự Nhật}` đã kiểm từ tài liệu `ja-kanji-variants.json` (đối tượng đã parse): mỗi khóa/giá trị đúng
 * một ký tự (code point), không tự ánh xạ, không nối tiếp (đích không phải khóa). Bảng trả về bị đông cứng.
 * @param {unknown} document
 * @returns {Readonly<Record<string, string>>}
 */
export function parseKanjiVariants(document) {
  const table = document && typeof document === "object" && !Array.isArray(document) ? document.map : null;
  if (!table || typeof table !== "object" || Array.isArray(table) || !Object.keys(table).length) {
    throw new ShinjitaiTableError("ja-kanji-variants: thiếu `map`");
  }
  const single = (value) => typeof value === "string" && [...value].length === 1;
  for (const [source, target] of Object.entries(table)) {
    if (!single(source) || !single(target)) throw new ShinjitaiTableError(`ja-kanji-variants: mục ${source} -> ${String(target)} không phải cặp một ký tự`);
    if (source === target) throw new ShinjitaiTableError(`ja-kanji-variants: mục ${source} tự ánh xạ`);
    if (Object.hasOwn(table, target)) throw new ShinjitaiTableError(`ja-kanji-variants: mục ${source} -> ${target} nối tiếp sang mục khác`);
  }
  return Object.freeze({ ...table });
}

/**
 * Đổi từng ký tự của `text` theo `table` (kết quả của `parseKanjiVariants`).
 * @param {string} text
 * @param {Readonly<Record<string, string>>} table
 */
export function toShinjitai(text, table) {
  if (typeof text !== "string") throw new TypeError("toShinjitai nhận chuỗi");
  if (!table || typeof table !== "object") throw new TypeError("toShinjitai cần bảng ký tự");
  let out = "";
  for (const char of text) out += Object.hasOwn(table, char) ? table[char] : char;
  return out;
}

/** Hàm đổi gắn sẵn bảng: `(text) => toShinjitai(text, table)`. */
export function createShinjitai(table) {
  const checked = parseKanjiVariants({ map: table });
  return (text) => toShinjitai(text, checked);
}
