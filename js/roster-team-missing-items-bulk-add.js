// Nút "Tôi có tất cả món thiếu của đội này" ở mục Thiếu món (Gợi ý đội): gom các món thẻ đội đang liệt kê, thêm vào
// kho một lần và ghi lại đúng các món vừa thêm để Hoàn tác. Hàm thuần, không DOM; nơi gọi tự lưu (kho local / hộp cloud).

import { addCanonicalItem, removeItem } from "./roster-scan-state.js";

const ownedKey = (type) => (type === "tactics" ? "ownedTactics" : "ownedHeroes");
const hasName = (value) => typeof value === "string" && value.trim() !== "";

/**
 * Các món còn thiếu của một đội ở mục Thiếu món: ĐÚNG các món thẻ đội đang liệt kê, theo tên lưu mà nút "Tôi có…"
 * từng món dùng. Đội thiếu tướng: phương án đầu của mỗi ô tướng thiếu (`missingHeroSlotNames[i][0]`); engine dừng ở
 * tướng nên chiến pháp chưa được xét, không thêm hộ món người dùng chưa thấy. Đội thiếu chiến pháp: các ô
 * `missingTacticSlots`.
 * @returns {Array<{type: "heroes"|"tactics", name: string}>} không trùng, theo thứ tự ô
 */
export function teamMissingItems(entry) {
  const items = [];
  const push = (type, name) => {
    if (!hasName(name) || items.some((item) => item.type === type && item.name === name)) return;
    items.push({ type, name });
  };
  if (entry?.status === "missing-hero") {
    for (const names of entry.missingHeroSlotNames || []) push("heroes", names?.[0]);
  } else {
    for (const slot of entry?.missingTacticSlots || []) push("tactics", slot?.tactic);
  }
  return items;
}

/**
 * Thêm các món vào kho. `added` chỉ gồm món trước đó chưa có tên trong kho: Hoàn tác gỡ đúng các món này,
 * không đụng món người dùng đã có từ trước.
 * @returns {{state: object, added: Array<{type, name}>}}
 */
export function addMissingItems(state, items) {
  let next = state;
  const added = [];
  for (const item of items || []) {
    if (!hasName(item?.name) || (item.type !== "heroes" && item.type !== "tactics")) continue;
    const before = next?.[ownedKey(item.type)] || [];
    if (before.some((entry) => entry.name === item.name)) continue;
    next = addCanonicalItem(next, item.type, item.name);
    added.push({ type: item.type, name: item.name });
  }
  return { state: next, added };
}

/** Hoàn tác `addMissingItems`: gỡ đúng các món đã thêm (món khác của kho giữ nguyên). */
export function undoAddedItems(state, added) {
  let next = state;
  for (const item of added || []) next = removeItem(next, item.type, item.name);
  return next;
}
