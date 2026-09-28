// Dữ liệu hiển thị của hồ sơ chiến pháp (artboard LookupTacticProfile), hàm thuần không DOM: phiên bản hiệu
// ứng, số in đậm "cấp 1 → cấp tối đa", nhãn nguồn/binh chủng và khối "Trong cẩm nang" tính từ
// `tactic-summaries.json` (ID) + corpus Tra cứu (tên theo ngôn ngữ). DOM ở `js/lookup-tactic-profile.js`.

import { effectVersions, lookupDisplayName } from "./lookup-detail.js";
import { currentLocale, normalizeLocale, pick } from "./i18n.js";
import { barPercent } from "./unified-lookup.js";

const isZh = (locale) => normalizeLocale(locale) === "zh";

/** Giá trị theo cấp trong chữ hiệu ứng: "20→40", "5%→10%", "0.5 → 1.25%". */
const LEVEL_RANGE = /\d+(?:\.\d+)?%?\s*→\s*\d+(?:\.\d+)?%?/gu;

/** Tách một đoạn hiệu ứng thành các mẩu chữ; mẩu `strong` là giá trị cấp 1 → cấp tối đa. */
export function tacticEffectSegments(text) {
  const source = String(text ?? "");
  const segments = [];
  let at = 0;
  for (const match of source.matchAll(LEVEL_RANGE)) {
    if (match.index > at) segments.push({ text: source.slice(at, match.index), strong: false });
    segments.push({ text: match[0].replace(/\s*→\s*/u, "→"), strong: true });
    at = match.index + match[0].length;
  }
  if (at < source.length) segments.push({ text: source.slice(at), strong: false });
  return segments;
}

/**
 * Các phiên bản hiệu ứng, bản hiện hành trước: `[{ label, paragraphs }]`. Bản Việt dùng `lookup.revisions`
 * (nhãn đã duyệt, có ngày); thiếu thì tách `effectViet`. Bản zh tách chữ Hán nguồn `effect` (nhãn nguồn).
 * Chỉ một phiên bản không nhãn ⇒ `label` là `null` (không cần nút chọn).
 */
export function tacticEffectVersions(record, locale = currentLocale()) {
  const revisions = Array.isArray(record?.lookup?.revisions) ? record.lookup.revisions : [];
  if (!isZh(locale) && revisions.length && revisions.every((item) => typeof item?.textVi === "string" && item.textVi.trim())) {
    const ordered = [...revisions.filter((item) => item.isCurrent), ...revisions.filter((item) => !item.isCurrent)];
    return ordered.map((item) => ({
      label: revisions.length === 1 && !item.effectiveDate ? null
        : item.isCurrent ? ["Bản hiện hành", item.effectiveDate].filter(Boolean).join(" · ") : String(item.labelVi ?? ""),
      paragraphs: item.textVi.split(/\n+/u).map((part) => part.trim()).filter(Boolean),
    }));
  }
  return effectVersions(isZh(locale) ? record?.effect : record?.effectViet)
    .map((block) => ({ label: block.labelVi, paragraphs: block.paragraphs }));
}

const SOURCE_LABELS = {
  INHERITANCE: ["Truyền thừa", "传承"], INNATE: ["Tự mang", "自带"], EVENT: ["Sự kiện", "事件"],
  "Tự mang": ["Tự mang", "自带"], "Sự kiện": ["Sự kiện", "事件"], "Bổ sung sau": ["Bổ sung sau", "后续补充"],
};
/** Nhãn nguồn chiến pháp (enum hoặc chữ đã Việt hoá); giá trị lạ trả `null`. */
export function tacticSourceLabel(value, locale = currentLocale()) {
  const pair = SOURCE_LABELS[String(value ?? "")];
  return pair ? pick(locale, ...pair) : null;
}

const TROOPS = [
  ["Kỵ binh", "骑兵", ["Kỵ binh", "Kỵ"]], ["Khiên binh", "盾兵", ["Khiên binh", "Khiên"]],
  ["Cung binh", "弓兵", ["Cung binh", "Cung"]], ["Thương binh", "枪兵", ["Thương binh", "Thương"]],
  ["Khí giới", "器械", ["Khí giới"]],
];
/** Binh chủng hợp của chiến pháp theo thứ tự chuẩn; đủ năm loại ⇒ `all`. Giá trị lạ bị bỏ. */
export function tacticTroopFit(values, locale = currentLocale()) {
  const list = Array.isArray(values) ? values.map((value) => String(value).trim()) : [];
  const troops = TROOPS.filter(([, , names]) => names.some((name) => list.includes(name)));
  if (!troops.length) return null;
  const all = troops.length === TROOPS.length;
  return {
    all,
    labels: troops.map(([vi, zh]) => pick(locale, vi, zh)),
    text: all ? pick(locale, "Mọi binh chủng", "全兵种") : troops.map(([vi, zh]) => pick(locale, vi, zh)).join(", "),
  };
}

const POSITIONS = [["Chủ tướng", "主将"], ["Phó tướng 1", "副将 1"], ["Phó tướng 2", "副将 2"]];

/**
 * Khối "Trong cẩm nang" của một chiến pháp. Thanh là tỷ lệ trên tổng số đội có chiến pháp (hai họ), vị trí giữ
 * thứ tự Chủ tướng → Phó tướng 2 như artboard. Tên tướng/chiến pháp lấy từ corpus theo ngôn ngữ; ID không có
 * trong corpus (payload hồ sơ chưa tải) bị bỏ, không in mã.
 */
export function tacticCamNangView(summary, corpus, locale = currentLocale()) {
  if (!summary) return null;
  const total = summary.standard.teams + summary.other.teams;
  const name = (id) => {
    const entry = corpus?.byId?.get(id);
    return entry ? lookupDisplayName(entry.record, entry.nameVi, locale) : null;
  };
  const positions = POSITIONS.map((label, index) => {
    const count = summary.standard.positions[index] + summary.other.positions[index];
    return { label: pick(locale, ...label), count, percent: barPercent(count, total) };
  });
  const carriers = summary.carriers
    .map((item) => ({ id: item.id, name: name(item.id), teams: item.teams, percent: barPercent(item.teams, total) }))
    .filter((item) => item.name);
  const companions = summary.companions
    .map((item) => ({ id: item.id, name: name(item.id), teams: item.teams }))
    .filter((item) => item.name);
  const representative = summary.representative.map((team) => {
    const carrier = team.heroId ? name(team.heroId) : null;
    return {
      ...team,
      carrier,
      meta: [carrier ? pick(locale, `${carrier} mang`, `${carrier} 携带`) : null, team.seasonLabel || null].filter(Boolean).join(" · "),
    };
  });
  return { standard: summary.standard.teams, other: summary.other.teams, positions, carriers, companions, representative };
}
