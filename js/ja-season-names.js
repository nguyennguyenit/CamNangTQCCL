// Tên mùa chính thức của server Nhật theo tên mùa nguồn (`nameRaw` của `seasons.json` trong generation Đội chuẩn).
// Nguồn quyết định là các thuật ngữ mùa có nguồn xác minh trong `pipeline/ja-glossary.json`; bảng này chỉ là bản chiếu để
// trình duyệt và bản dựng sẵn dùng chung (glossary không phát ra site). `tests-js/ja-season-names.test.mjs` giữ hai nơi khớp nhau.
// Ánh xạ theo tên mùa nguồn, không theo số mùa: server Nhật đi sau một mùa (VN PK-S27 = JP 漢焔不滅).
// Mùa chưa có tên Nhật đã xác minh không có mục ở đây: bản ja giữ tên nguồn (ghi trong docs/ja-gaps.md), không tự dịch.

export const JA_SEASON_NAMES = Object.freeze({
  "漢焰長明": "漢焔不滅",
});

/**
 * Tên mùa Nhật đã xác minh của một tên mùa nguồn; mùa chưa có tên Nhật thì `null`.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function jaSeasonName(raw) {
  const key = typeof raw === "string" ? raw.trim() : "";
  return key && Object.hasOwn(JA_SEASON_NAMES, key) ? JA_SEASON_NAMES[key] : null;
}

/**
 * Tên mùa nguồn cho bản đang xem (`locale`): bản ja đổi sang tên Nhật đã xác minh, mùa chưa có tên Nhật và các bản khác
 * giữ nguyên `raw`. Dùng ở mọi chỗ trình duyệt và trang dựng sẵn hiện tên mùa nguồn ngoài bộ tra tên ja.
 * @param {string | null | undefined} raw
 * @param {string} locale
 */
export function localSeasonName(raw, locale) {
  return (locale === "ja" ? jaSeasonName(raw) : null) ?? raw;
}

/**
 * Nhãn mùa dạng `<mã> · <tên mùa nguồn>` (catalog mùa của Đội cộng đồng, `labelZh`) hoặc tên mùa đứng riêng: tên Nhật đã xác
 * minh thay phần tên, giữ mã; mùa chưa có tên Nhật thì `null` để nơi gọi tự xử lý như trước.
 * @param {unknown} label
 * @returns {string | null}
 */
export function jaSeasonLabel(label) {
  if (typeof label !== "string") return null;
  const parts = label.match(/^(.+?) · (.+)$/su);
  const name = jaSeasonName(parts ? parts[2] : label);
  return name && parts ? `${parts[1]} · ${name}` : name;
}
