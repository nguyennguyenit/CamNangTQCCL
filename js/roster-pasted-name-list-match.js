// Ô dán danh sách tên của bảng chọn nhanh (Gợi ý đội): tách chuỗi dán từ game, Zalo, Excel thành từng tên rồi đối
// chiếu với danh mục kho (`buildCatalog` của `roster-picker.js`). Hàm thuần, không DOM.
//
// Nguyên tắc: chỉ nhận tên KHỚP ĐÚNG một tên đã biết của món (tên Việt, Hán-Việt, chữ Hán giản/phồn, alias), so cùng
// bộ chuẩn hoá `normalizeText` mà ô tìm của bảng chọn và `match-dict.js` dùng. Không so gần đúng (Levenshtein): tên
// gõ sai nằm ở "không nhận ra", không bị đoán sang món khác. Tên khớp nhiều món nằm ở "cần chọn", không tự chọn.

import { normalizeText } from "./filters.js";

/** Trần số tên mỗi lần dán: danh sách kho đầy đủ ~700 món; quá trần thì phần dư bị bỏ và báo cho người dùng. */
export const MAX_PASTED_NAMES = 800;

const SEPARATORS = /[\r\n\t,;，；、]+/u;
// Ký hiệu đầu dòng khi chép danh sách: "1.", "2)", "-", "•", "*", "·".
const LIST_MARKER = /^(?:\d{1,3}[.)]|[-*•·+])\s+/u;
const INVISIBLE = /[​-‍⁠﻿]/gu;
const HAS_CJK = /[㐀-鿿豈-﫿]/u;

/** Bỏ khoảng trắng thừa; chuỗi có chữ Hán bỏ hẳn khoảng trắng ("SP 呂蒙" = "SP呂蒙"). */
const squash = (text) => (HAS_CJK.test(text) ? text.replace(/\s+/gu, "") : text.replace(/\s+/gu, " ").trim());

/** Khoá so khớp giữ dấu (chỉ hạ chữ thường): "Trương Bảo" khác "Trương Bào". */
const exactKey = (text) => squash(String(text || "").normalize("NFC").toLowerCase());
/** Khoá so khớp bỏ dấu, như ô tìm của bảng chọn: "truong bao" khớp cả "Trương Bảo" lẫn "Trương Bào". */
const foldedKey = (text) => squash(normalizeText(text));

/**
 * Tách chuỗi dán thành danh sách tên: ngăn theo dòng, tab (ô Excel), dấu phẩy, chấm phẩy (kể cả dấu Trung `，；、`);
 * bỏ ký hiệu đầu dòng, ký tự vô hình và tên rỗng; tên trùng (không phân biệt hoa thường, khoảng trắng) chỉ giữ lần đầu.
 * @returns {{names: string[], truncated: number}} `truncated` = số tên bị bỏ vì quá `MAX_PASTED_NAMES`.
 */
export function splitPastedNames(text, { max = MAX_PASTED_NAMES } = {}) {
  const seen = new Set();
  const names = [];
  for (const part of String(text || "").replace(INVISIBLE, "").split(SEPARATORS)) {
    const name = part.trim().replace(LIST_MARKER, "").trim();
    if (!name) continue;
    const key = exactKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return { names: names.slice(0, max), truncated: Math.max(0, names.length - max) };
}

const pushTo = (map, key, item) => {
  if (!key) return;
  const list = map.get(key);
  if (!list) map.set(key, [item]);
  else if (!list.includes(item)) list.push(item);
};

/**
 * Chỉ mục tên → món của danh mục. Mỗi món mang `names` (tên Việt, Hán-Việt, chữ Hán, alias); món không có `names`
 * thì dùng `name`. Binh thư không vào kho nên bị bỏ.
 */
export function buildPasteIndex(catalog) {
  const exact = new Map();
  const folded = new Map();
  for (const item of catalog || []) {
    if (item?.type !== "heroes" && item?.type !== "tactics") continue;
    const names = Array.isArray(item.names) && item.names.length ? item.names : [item.name];
    for (const name of names) {
      if (typeof name !== "string" || !name.trim()) continue;
      pushTo(exact, exactKey(name), item);
      pushTo(folded, foldedKey(name), item);
    }
  }
  return { exact, folded };
}

/** Chiến pháp tự mang (INNATE) có trong danh mục nhưng không bao giờ vào kho. */
const isInnate = (item) => item.type === "tactics" && item.source === "INNATE";

/**
 * Đối chiếu danh sách tên với danh mục kho.
 * - Khớp giữ dấu trước: đúng một món thì nhận; không có thì thử khớp bỏ dấu.
 * - Đúng một món (bỏ chiến pháp tự mang) → `matched`; nhiều món → `ambiguous` (người dùng chọn hoặc bỏ qua);
 *   không món nào → `unrecognized`; chỉ khớp chiến pháp tự mang → `innate`.
 * - Nhiều tên cùng trỏ một món (vd tên Việt và chữ Hán) gộp một dòng `matched` với đủ `inputs`.
 * @param {string[]} names kết quả `splitPastedNames(...).names`
 * @param {object[]|{exact: Map, folded: Map}} catalogOrIndex danh mục `buildCatalog(…, "inventory")` hoặc `buildPasteIndex`
 * @returns {{matched: Array<{item: object, inputs: string[]}>, ambiguous: Array<{input: string, candidates: object[]}>,
 *   unrecognized: string[], innate: Array<{input: string, item: object}>}}
 */
export function matchPastedNames(names, catalogOrIndex) {
  const index = Array.isArray(catalogOrIndex) ? buildPasteIndex(catalogOrIndex) : catalogOrIndex;
  const matched = [];
  const byItem = new Map();
  const ambiguous = [];
  const unrecognized = [];
  const innate = [];
  for (const input of names || []) {
    const hits = index.exact.get(exactKey(input)) || index.folded.get(foldedKey(input)) || [];
    const addable = hits.filter((item) => !isInnate(item));
    if (addable.length === 1) {
      const [item] = addable;
      const row = byItem.get(item);
      if (row) row.inputs.push(input);
      else {
        const next = { item, inputs: [input] };
        byItem.set(item, next);
        matched.push(next);
      }
    } else if (addable.length > 1) {
      ambiguous.push({ input, candidates: addable });
    } else if (hits.length) {
      innate.push({ input, item: hits[0] });
    } else {
      unrecognized.push(input);
    }
  }
  return { matched, ambiguous, unrecognized, innate };
}
