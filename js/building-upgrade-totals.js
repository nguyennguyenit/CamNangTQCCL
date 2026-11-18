// Phép tính thuần của máy tính nâng cấp công trình (trang nhóm Tra cứu Công trình): cộng tài nguyên và thời gian
// theo khoảng cấp, gộp nhiều dòng, và đọc/ghi các dòng trên query của trang (`?nang=`). Không đọc DOM, không có chữ
// hiển thị: phần giao diện và chữ vi/zh ở `js/building-upgrade-calculator.js`.

/** Ba loại tài nguyên của cấp công trình, cùng thứ tự với cột bảng theo cấp (`COST_KEYS` của `js/lookup-master.js`). */
export const BUILDING_COST_KEYS = Object.freeze(["wood", "stone", "iron"]);

/** Khóa query của các dòng máy tính; lặp lại một lần cho mỗi dòng: `?nang=quan-dinh.5.20&nang=thang-kho.1.15`. */
export const UPGRADE_QUERY_KEY = "nang";

/** Số dòng tối đa đọc từ query (chặn URL quá dài làm trang dựng hàng trăm dòng). */
export const MAX_UPGRADE_ROWS = 41;

const BUILDING_PREFIX = "building:";
const UNIT_SECONDS = new Map([
  ["ngày", 86400], ["天", 86400], ["日", 86400],
  ["giờ", 3600], ["小時", 3600], ["小时", 3600], ["時", 3600], ["时", 3600],
  ["phút", 60], ["分鐘", 60], ["分钟", 60], ["分", 60],
  ["giây", 1], ["秒", 1],
]);
// Đơn vị dài đứng trước để "分鐘" không bị đọc thành "分" + chữ thừa.
const UNIT_PATTERN = [...UNIT_SECONDS.keys()].sort((a, b) => b.length - a.length).join("|");
const DURATION_TOKEN = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})`, "gu");

/**
 * Số giây của một thời lượng cấp công trình ("2 giờ", "1 giờ 20 phút", "30 giây", "4小時50分", "1天"); chuỗi rỗng,
 * thiếu hoặc có phần không đọc được trả `null` (thiếu dữ liệu, không coi là 0).
 */
export function parseDurationSeconds(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  let total = 0;
  let matched = 0;
  let rest = raw;
  for (const match of raw.matchAll(DURATION_TOKEN)) {
    total += Number(match[1].replace(",", ".")) * UNIT_SECONDS.get(match[2]);
    matched += 1;
    rest = rest.replace(match[0], "");
  }
  if (!matched || rest.trim()) return null;
  return Math.round(total);
}

/** Số giây xây một cấp: đọc `durationVi`, không đọc được thì `durationZh`; cả hai thiếu thì `null`. */
export function levelDurationSeconds(level) {
  return parseDurationSeconds(level?.durationVi) ?? parseDurationSeconds(level?.durationZh);
}

/** Giá trị số của một loại tài nguyên trong `costs` (ô rỗng/`null` là không có), cùng quy tắc với `buildingTotals`. */
function costValue(costs, key) {
  const value = costs?.[key];
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Cấp có dữ liệu tài nguyên khi `costs` có ít nhất một loại mang số. Loại để trống trong cấp có số (Thái Thạch Xứ không
 * tốn đá) là không cần loại đó; cấp mà cả ba loại đều trống (Quân Xá cấp 1–2) là thiếu dữ liệu.
 */
export function hasLevelCosts(level) {
  return BUILDING_COST_KEYS.some((key) => costValue(level?.costs, key) !== null);
}

/**
 * Tổng để nâng một công trình từ cấp `fromLevel` lên `toLevel` (cộng các cấp `fromLevel + 1` … `toLevel`):
 * `{costs: {wood, stone, iron}, seconds, levelCount, missingCostLevels, missingTimeLevels}`.
 * - `costs[key]` là `null` khi không cấp nào trong khoảng có số cho loại đó (như `buildingTotals`), nên khoảng 0 → cấp
 *   tối đa cho đúng `buildingTotals(levels)`.
 * - Cấp thiếu `costs`, thiếu thời gian hoặc không có trong dữ liệu được liệt kê theo số cấp và không cộng gì.
 * - `toLevel <= fromLevel` là khoảng rỗng (`levelCount` 0).
 */
export function sumLevelRange(levels, fromLevel, toLevel) {
  const byLevel = new Map((levels ?? []).map((level) => [Number(level?.level), level]));
  const sums = Object.fromEntries(BUILDING_COST_KEYS.map((key) => [key, null]));
  const missingCostLevels = [];
  const missingTimeLevels = [];
  let seconds = 0;
  let levelCount = 0;
  const from = Math.trunc(Number(fromLevel));
  const to = Math.trunc(Number(toLevel));
  if (Number.isFinite(from) && Number.isFinite(to)) {
    for (let number = Math.max(from, 0) + 1; number <= to; number += 1) {
      levelCount += 1;
      const level = byLevel.get(number);
      if (!level || !hasLevelCosts(level)) missingCostLevels.push(number);
      else {
        for (const key of BUILDING_COST_KEYS) {
          const value = costValue(level.costs, key);
          if (value !== null) sums[key] = (sums[key] ?? 0) + value;
        }
      }
      const duration = level ? levelDurationSeconds(level) : null;
      if (duration === null) missingTimeLevels.push(number);
      else seconds += duration;
    }
  }
  return { costs: sums, seconds, levelCount, missingCostLevels, missingTimeLevels };
}

/**
 * Gộp kết quả `sumLevelRange` của nhiều dòng: `{costs, seconds, levelCount, missingLevelCount}`; loại tài nguyên không
 * dòng nào có số thì `null`. `missingLevelCount` đếm số cấp thiếu tài nguyên hoặc thời gian (mỗi cấp tính một lần).
 */
export function combineRangeTotals(results) {
  const costs = Object.fromEntries(BUILDING_COST_KEYS.map((key) => [key, null]));
  let seconds = 0;
  let levelCount = 0;
  let missingLevelCount = 0;
  for (const result of results ?? []) {
    for (const key of BUILDING_COST_KEYS) {
      const value = result.costs?.[key];
      if (value !== null && value !== undefined) costs[key] = (costs[key] ?? 0) + value;
    }
    seconds += result.seconds ?? 0;
    levelCount += result.levelCount ?? 0;
    missingLevelCount += new Set([...(result.missingCostLevels ?? []), ...(result.missingTimeLevels ?? [])]).size;
  }
  return { costs, seconds, levelCount, missingLevelCount };
}

/** Tách số giây thành `{days, hours, minutes, seconds}` để hiện theo ngày/giờ/phút/giây. */
export function splitDuration(totalSeconds) {
  let rest = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const days = Math.floor(rest / 86400);
  rest -= days * 86400;
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  return { days, hours, minutes, seconds: rest - minutes * 60 };
}

/** Cấp tối đa của công trình: `maxLevel`, thiếu thì cấp lớn nhất trong `levels`, không có cấp nào thì 0. */
export function buildingMaxLevel(record) {
  const max = Number(record?.maxLevel);
  if (Number.isInteger(max) && max >= 0) return max;
  const levels = (record?.levels ?? []).map((level) => Number(level?.level)).filter(Number.isInteger);
  return levels.length ? Math.max(...levels) : 0;
}

/** Kẹp cấp nhập vào trong `[0, max]` (số nguyên); giá trị không phải số thành `fallback`. */
export function clampLevel(value, max, fallback = 0) {
  const number = Math.trunc(Number(value));
  if (value === "" || value === null || value === undefined || !Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, 0), max);
}

/** Phần định danh trên query của một công trình (`building:quan-dinh` → `quan-dinh`). */
export const buildingQueryHandle = (id) => String(id ?? "").startsWith(BUILDING_PREFIX) ? String(id).slice(BUILDING_PREFIX.length) : "";

/**
 * Các dòng đọc từ query (`?nang=<công trình>.<cấp hiện tại>.<cấp đích>`), theo thứ tự xuất hiện: `[{buildingId, from, to}]`.
 * Công trình không có trong `buildings` hoặc giá trị sai dạng bị bỏ; cấp được kẹp trong `[0, cấp tối đa]`.
 */
export function upgradeRowsFromQuery(search, buildings) {
  const byHandle = new Map((buildings ?? []).map((record) => [buildingQueryHandle(record?.id), record]));
  const rows = [];
  for (const value of new URLSearchParams(search ?? "").getAll(UPGRADE_QUERY_KEY)) {
    if (rows.length >= MAX_UPGRADE_ROWS) break;
    const match = /^([a-z0-9-]+)\.(\d{1,3})\.(\d{1,3})$/u.exec(value.trim());
    const record = match ? byHandle.get(match[1]) : null;
    if (!record) continue;
    const max = buildingMaxLevel(record);
    rows.push({ buildingId: record.id, from: clampLevel(match[2], max), to: clampLevel(match[3], max) });
  }
  return rows;
}

/** Query của trang sau khi thay các dòng máy tính (giữ mọi khóa khác như `?id=`); không còn dòng nào thì bỏ khóa. */
export function upgradeRowsSearch(search, rows) {
  const params = new URLSearchParams(search ?? "");
  params.delete(UPGRADE_QUERY_KEY);
  for (const row of rows ?? []) {
    const handle = buildingQueryHandle(row.buildingId);
    if (handle) params.append(UPGRADE_QUERY_KEY, `${handle}.${row.from}.${row.to}`);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
