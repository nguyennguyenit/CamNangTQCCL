// Bộ chuyển nguồn → đội nháp của "Đội của tôi" (thuần, dùng chung lúc build và ở trình duyệt). Mỗi bộ chuyển theo bảng ghép
// trường ở docs/roster-sync.md § "Bảng ghép trường nguồn → đội" và trả `{draft, source, unresolved, defaultGroup}`:
//   - `draft` đúng mô hình đội (chưa có boxId/groupId/dấu thời gian); `draft.id` sinh MỘT lần (`opts.id` để giữ qua thử lại);
//   - `unresolved`: tên chưa đối chiếu được hoặc phương án thay bị bỏ vì vượt trần (không có gì mất âm thầm);
//   - `defaultGroup`: hậu tố nhóm mặc định (`khai-hoang` | `ghep-team`).
// `ids` là bộ tra của `createLookupIdResolver` (js/lookup-ids.js): `{hero, tactic, book}(raw, vi) → id | null`.
// Mã hash nguồn chỉ tính trên trường THÔ (tên gốc, phương án thay, cộng điểm, chủ tướng/binh chủng theo giai đoạn, ghi chú
// nguồn), không tính bản dịch Việt và chỉnh sửa của người dùng.

import { heroSlotAlternatives } from "./hero-identity.js";
import { escapedBytes, stripControl, TEAM_LIMITS } from "./my-teams-model.js";
import { sha256Hex16 } from "./roster-cloud-store.js";

const EMPTY_SLOTS = new Set(["", "—", "-"]);
const SOURCE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u;
/** Phần id của `source.key` còn chỗ cho `~biến-thể` (`source.key` ≤ 128 B). */
const KEY_PART_MAX = 60;
const SLASH = /\s*[/／]\s*/u;

/* ---------- Tiện ích ---------- */

/** JSON chuẩn hóa thứ tự khóa (đệ quy) để băm không phụ thuộc thứ tự khóa của nguồn. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** SHA-256 hex 16 ký tự trên JSON chuẩn hóa của các trường nguồn thô. */
export const sourceHash = (rawFields) => sha256Hex16(stable(rawFields));

/**
 * Phần id của `source.key`: id nguồn ASCII dùng nguyên; id có chữ Hán (67/1 366 cấu hình Đội chuẩn, vd. `yxms-005-孫尚香凌統`)
 * không khớp `^[A-Za-z0-9][A-Za-z0-9._~-]*$` của server nên đổi sang `h-<16 hex SHA-256 của id>`.
 */
export function sourceKeyPart(id) {
  const value = String(id ?? "");
  return SOURCE_KEY_RE.test(value) && escapedBytes(value) <= KEY_PART_MAX ? value : `h-${sha256Hex16(value)}`;
}

export const variantKey = (id, variantId) => (variantId ? `${sourceKeyPart(id)}~${variantId}` : sourceKeyPart(id));

/** `team-` + 16 hex ngẫu nhiên; gọi một lần lúc tạo nháp rồi giữ qua thử lại/tải lại. */
export function newTeamId(random = globalThis.crypto) {
  const bytes = random.getRandomValues(new Uint8Array(8));
  return `team-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

const clean = (value) => (typeof value === "string" ? stripControl(value).replace(/[ \t]+/gu, " ").trim() : "");
const lines = (items) => items.map(clean).filter(Boolean);
const joined = (items) => (Array.isArray(items) ? items.map(clean).filter(Boolean).join(" · ") : "");
const unique = (list) => [...new Set(list.filter(Boolean))];

const emptySlot = (rawName = "") => ({ primary: null, alternatives: [], rawName });
const emptyHero = (slotState, rawName = "") => ({
  hero: null,
  slotState,
  rawName,
  heroAlternatives: [],
  redStars: null,
  tactics: [emptySlot(), emptySlot()],
  books: [],
  bookType: "",
  troopNote: "",
  statNote: "",
  gearNote: "",
});

/** Ô chiến pháp từ danh sách tên (chính + phương án thay); tên không tra được → ô `rawName`, ghi vào `unresolved`. */
function tacticSlot(names, ids, unresolved, at, { raw = null } = {}) {
  const [first, ...rest] = names.map(clean).filter(Boolean);
  if (!first) return emptySlot();
  const idOf = (name, rawName) => ids.tactic(rawName ?? null, name);
  const primary = idOf(first, raw);
  if (!primary) {
    unresolved.push({ field: at, rawName: first, reason: "unresolved" });
    return emptySlot(first);
  }
  const alternatives = [];
  for (const name of rest) {
    const id = idOf(name, null);
    if (!id) unresolved.push({ field: `${at}.alternatives`, rawName: name, reason: "unresolved" });
    else if (id !== primary && !alternatives.includes(id)) alternatives.push(id);
  }
  return capAlternatives(primary, alternatives, unresolved, `${at}.alternatives`);
}

function capAlternatives(primary, alternatives, unresolved, at) {
  const kept = alternatives.slice(0, TEAM_LIMITS.maxAlternatives);
  for (const id of alternatives.slice(TEAM_LIMITS.maxAlternatives)) unresolved.push({ field: at, rawName: id, reason: "over-limit" });
  return { primary, alternatives: kept, rawName: "" };
}

/** Văn bản nối dòng cho `notes.general`. */
const block = (items) => lines(items).join("\n");

/** Đưa chữ vào trường có trần byte; vượt trần thì chuyển sang `notes.general` (không cắt im lặng). */
function fitOrMove(value, max, overflow) {
  const text = clean(value);
  if (!text || escapedBytes(text) <= max) return text;
  overflow.push(text);
  return "";
}

/* ---------- Đội chuẩn ---------- */

/** Trường THÔ của một cấu hình Đội chuẩn (không có bản dịch Việt). */
export function recommendedRawFields(record) {
  const holder = (item) => ({
    name: item?.nameRaw ?? "",
    state: item?.slotState ?? "",
    tactics: item?.tacticSlotsRaw ?? [],
    kinds: item?.tacticSlotKinds ?? [],
    books: item?.bookSlotsRaw ?? [],
    stat: item?.statFocusRaw ?? "",
    note: item?.notesRaw ?? "",
  });
  return {
    heroes: (record.heroes || []).map(holder),
    alternatives: (record.alternativeHoldersRaw || []).map(holder),
    notes: record.notesRaw ?? "",
    tier: record.tierRaw ?? "",
    counters: referenceCounters(record),
  };
}

export const recommendedSourceHash = (record) => sourceHash(recommendedRawFields(record));

/** Counters của nội dung đội gốc đã đối chiếu (`legacyReferences[].legacyContent.counters`), nếu có. */
function referenceCounters(record) {
  const contents = [record.legacyContent, ...(record.legacyReferences || []).map((reference) => reference?.legacyContent)].filter(Boolean);
  const good = [];
  const avoid = [];
  for (const content of contents) {
    for (const name of content.counters?.good || []) good.push(name);
    for (const name of content.counters?.avoid || []) avoid.push(name);
  }
  return { good: unique(good), avoid: unique(avoid) };
}

function recommendedHero(holder, ids, unresolved, index, overflow) {
  if (holder?.slotState === "source-empty") return emptyHero("source-empty");
  const at = `heroes[${index}]`;
  const rawName = clean(holder.nameRaw) || clean(holder.displayNameVi);
  // Nguồn viết "SP皇甫嵩" không dấu cách còn từ điển ghi "SP 皇甫嵩": thử cả hai dạng.
  const spaced = typeof holder.nameRaw === "string" ? holder.nameRaw.replace(/^(SP|CO|40Y)\s*/u, "$1 ") : null;
  const heroId = ids.hero(holder.nameRaw ?? null, holder.displayNameVi ?? null) ?? (spaced ? ids.hero(spaced, null) : null);
  if (!heroId) unresolved.push({ field: `${at}.hero`, rawName, reason: "unresolved" });
  const tactics = [0, 1].map((slot) => {
    const raw = holder.tacticSlotsRaw?.[slot];
    if (holder.tacticSlotKinds?.[slot] === "bond") return emptySlot();
    if (typeof raw !== "string" || EMPTY_SLOTS.has(raw.trim())) return emptySlot();
    const vi = holder.tacticSlotsVi?.[slot];
    const found = tacticSlot([typeof vi === "string" && vi.trim() ? vi : raw], ids, [], "", { raw });
    if (found.primary !== null) return found;
    unresolved.push({ field: `${at}.tactics[${slot}]`, rawName: clean(raw), reason: "unresolved" });
    return emptySlot(fitOrMove(raw, TEAM_LIMITS.rawName, overflow));
  });
  const books = [];
  const unresolvedBooks = [];
  for (let slot = 0; slot < 3; slot += 1) {
    const raw = holder.bookSlotsRaw?.[slot];
    const vi = holder.bookSlotsVi?.[slot];
    if (!clean(raw) && !clean(vi)) continue;
    const id = ids.book(raw ?? null, vi ?? null);
    if (id) books.push(id);
    else {
      unresolvedBooks.push(clean(raw) || clean(vi));
      unresolved.push({ field: `${at}.books[${slot}]`, rawName: clean(raw) || clean(vi), reason: "unresolved" });
    }
  }
  return {
    hero: heroId,
    slotState: heroId ? "ok" : "unresolved",
    rawName: heroId ? "" : fitOrMove(rawName, TEAM_LIMITS.rawName, overflow),
    heroAlternatives: [],
    redStars: null,
    tactics,
    books: books.slice(0, TEAM_LIMITS.maxBooks),
    bookType: fitOrMove(unresolvedBooks.join(" · "), TEAM_LIMITS.bookType, overflow),
    troopNote: "",
    statNote: fitOrMove(holder.statFocusVi || holder.statFocusRaw, TEAM_LIMITS.slotNote, overflow),
    gearNote: "",
  };
}

const holderLabel = (holder) => clean(holder?.displayNameVi) || clean(holder?.nameRaw);

/** Ghi chú đội gom theo chủ sở hữu (`displayNotes.blocks`); thiếu khối thì dùng `notesRaw`. */
function recommendedNotes(record) {
  const blocks = record.displayNotes?.blocks;
  const heroes = record.heroes || [];
  const general = [];
  if (Array.isArray(blocks)) {
    for (const item of blocks) {
      const value = clean(item?.textVi) || clean(item?.textRaw);
      if (!value) continue;
      const holder = item.owner === "primary" && Number.isInteger(item.holderIndex) ? heroes[item.holderIndex] : null;
      general.push(holder ? `${holderLabel(holder)}: ${value}` : item.owner === "alternative" ? null : value);
    }
  } else if (clean(record.notesRaw)) {
    general.push(record.notesRaw);
  }
  const alternatives = record.alternativeHoldersRaw || [];
  for (let start = 0; start < alternatives.length; start += 3) {
    general.push(`Cấu hình thay thế ${start / 3 + 1}: ${alternatives.slice(start, start + 3).map(holderLabel).filter(Boolean).join(" · ")}`);
  }
  return general;
}

/**
 * Một cấu hình Đội chuẩn → đội nháp. Ô bond bị bỏ (ô chiến pháp tương ứng để trống), ô `source-empty` giữ là ô trống, vị trí
 * ô giữ nguyên. Cấu hình thay thế của nguồn (`alternativeHoldersRaw`: cả bộ tướng khác) ghi thành chữ vào `notes.general`
 * vì nguồn không có phương án thay ở cấp tướng/chiến pháp.
 */
export function fromRecommended(record, ids, { id, seasonId, contentHash } = {}) {
  const unresolved = [];
  const overflow = [];
  const heroes = (record.heroes || []).slice(0, TEAM_LIMITS.maxHeroes).map((holder, index) => recommendedHero(holder, ids, unresolved, index, overflow));
  const counters = referenceCounters(record);
  const draft = {
    id: id ?? newTeamId(),
    name: clean(record.displayNameVi) || clean(record.nameZh) || clean(record.sourceConfigId),
    seasonId: clean(seasonId ?? record.sourceSeasonId) || null,
    tierLabel: clean(record.tierRaw),
    replacesTeamId: null,
    heroes,
    notes: {
      general: block([...recommendedNotes(record), ...overflow]),
      strengths: "",
      goodAgainst: joined(counters.good),
      avoid: joined(counters.avoid),
    },
    userAlternatives: [],
    source: { kind: "recommended", key: sourceKeyPart(record.sourceConfigId), contentHash: contentHash ?? recommendedSourceHash(record) },
  };
  return { draft, source: draft.source, unresolved, defaultGroup: "ghep-team" };
}

/* ---------- Đội khác ---------- */

/** Trường THÔ của nội dung một đội khác (đội gốc hoặc `legacyContent` của biến thể kèm `notes` của đội gốc). */
export function legacyRawFields(content) {
  return {
    heroes: (content.heroes || []).map((hero) => ({
      name: hero.name ?? "",
      alternatives: hero.alternatives ?? [],
      tactics: (hero.tactics || []).map((item) => ({ name: item.name ?? "", alternatives: item.alternatives ?? [] })),
      books: (hero.books || []).map((item) => ({ name: item.name ?? "", alternatives: item.alternatives ?? [] })),
      note: hero.note ?? "",
    })),
    notes: content.notes ?? "",
    counters: { good: content.counters?.good ?? [], avoid: content.counters?.avoid ?? [] },
  };
}

export const legacySourceHash = (content) => sourceHash(legacyRawFields(content));

/** Tên tướng "A / B" tách như js/hero-identity.js (`heroSlotAlternatives`); tên không phân tích được giữ nguyên một phần. */
function heroNames(hero) {
  try {
    return heroSlotAlternatives(hero).map((item) => item.displayName);
  } catch {
    const name = clean(hero?.name);
    return name ? [name] : [];
  }
}

function resolvedHero(names, ids, unresolved, at) {
  const [first, ...rest] = names;
  const primary = first ? ids.hero(null, first) : null;
  if (first && !primary) unresolved.push({ field: `${at}.hero`, rawName: first, reason: "unresolved" });
  const alternatives = [];
  for (const name of rest) {
    const id = ids.hero(null, name);
    if (!id) unresolved.push({ field: `${at}.heroAlternatives`, rawName: name, reason: "unresolved" });
    else if (id !== primary && !alternatives.includes(id)) alternatives.push(id);
  }
  const kept = alternatives.slice(0, TEAM_LIMITS.maxAlternatives);
  for (const id of alternatives.slice(TEAM_LIMITS.maxAlternatives)) unresolved.push({ field: `${at}.heroAlternatives`, rawName: id, reason: "over-limit" });
  return { primary, alternatives: kept, first };
}

/** Một ô chiến pháp của đội khác: tên "A/B" tách vào `alternatives` cùng `alternatives` của nguồn. */
function legacyTacticSlot(item, ids, unresolved, at) {
  const name = clean(item?.name);
  if (!name) return emptySlot();
  const names = [...name.split(SLASH), ...(item.alternatives || [])];
  return tacticSlot(names, ids, unresolved, at);
}

function legacyHero(hero, ids, unresolved, index, overflow) {
  const at = `heroes[${index}]`;
  const names = heroNames(hero);
  const { primary, alternatives, first } = resolvedHero(names, ids, unresolved, at);
  const books = [];
  const bookAlternatives = [];
  (hero.books || []).slice(0, TEAM_LIMITS.maxBooks).forEach((item, slot) => {
    const name = clean(item?.name);
    if (!name) return;
    const id = ids.book(null, name);
    if (id) books.push(id);
    else unresolved.push({ field: `${at}.books[${slot}]`, rawName: name, reason: "unresolved" });
    const others = lines(item.alternatives || []);
    if (others.length || !id) bookAlternatives.push(`${name}${others.length ? `: ${others.join(" / ")}` : ""}`);
  });
  return {
    hero: primary,
    slotState: primary ? "ok" : "unresolved",
    rawName: primary ? "" : fitOrMove(first, TEAM_LIMITS.rawName, overflow),
    heroAlternatives: alternatives,
    redStars: null,
    tactics: [0, 1].map((slot) => legacyTacticSlot(hero.tactics?.[slot], ids, unresolved, `${at}.tactics[${slot}]`)),
    books,
    bookType: fitOrMove(bookAlternatives.join("; "), TEAM_LIMITS.bookType, overflow),
    troopNote: "",
    statNote: "",
    gearNote: "",
  };
}

/**
 * Nội dung đội khác → đội nháp. `content` là ĐÚNG object trang đang hiện: đội gốc cho bản mặc định, `{...legacyContent,
 * notes: team.notes}` cho biến thể (như `js/team-detail.js` `loadLegacy`). Phương án thay binh thư vào `bookType` dạng chữ
 * (vượt 120 B thì sang `notes.general`).
 */
export function fromLegacy(content, ids, { legacyTeamId, legacyVariantId, id, contentHash } = {}) {
  const unresolved = [];
  const overflow = [];
  const sourceHeroes = (content.heroes || []).slice(0, TEAM_LIMITS.maxHeroes);
  const heroes = sourceHeroes.map((hero, index) => legacyHero(hero, ids, unresolved, index, overflow));
  const heroNotes = sourceHeroes.map((hero) => (clean(hero.note) ? `${clean(hero.name)}: ${clean(hero.note)}` : null));
  const draft = {
    id: id ?? newTeamId(),
    name: clean(content.nickname) || clean(content.name) || clean(legacyTeamId),
    seasonId: null,
    tierLabel: "",
    replacesTeamId: null,
    heroes,
    notes: {
      general: block([content.notes, ...heroNotes, ...overflow]),
      strengths: "",
      goodAgainst: joined(content.counters?.good),
      avoid: joined(content.counters?.avoid),
    },
    userAlternatives: [],
    source: { kind: "legacy", key: variantKey(legacyTeamId, legacyVariantId), contentHash: contentHash ?? legacySourceHash(content) },
  };
  return { draft, source: draft.source, unresolved, defaultGroup: "ghep-team" };
}

/* ---------- Khai hoang ---------- */

/** Trường THÔ của một build Khai hoang (đội mặc định hoặc một biến thể). */
export function khaiHoangRawFields(team, variant = null) {
  const build = variant ?? team;
  return {
    heroes: (build.heroes || []).map((hero) => ({
      name: hero.name ?? "",
      unitTypeBefore: hero.unitTypeBefore ?? "",
      tacticBefore: hero.tacticBefore ?? "",
      unitTypeAfter: hero.unitTypeAfter ?? "",
      tacticsAfter: hero.tacticsAfter ?? [],
      note: hero.note ?? "",
      buildNote: hero.buildNote ?? "",
    })),
    unitType: build.unitType ?? "",
    commanderBefore: build.commanderBefore ?? "",
    commanderAfter: build.commanderAfter ?? "",
    buildNote: build.buildNote ?? "",
    openingNote: build.openingNote ?? "",
    note: build.note ?? "",
  };
}

export const khaiHoangSourceHash = (team, variant = null) => sourceHash(khaiHoangRawFields(team, variant));

/** Chủ tướng sau cấp 20 đứng đầu (như `commanderFirst` ở js/render.js nhưng theo `commanderAfter`); thứ tự còn lại giữ nguyên. */
function commanderAfterFirst(build) {
  const heroes = build.heroes || [];
  const index = heroes.findIndex((hero) => hero.name === build.commanderAfter);
  return index > 0 ? [heroes[index], ...heroes.slice(0, index), ...heroes.slice(index + 1)] : heroes;
}

/** Ô chiến pháp "Sau": "A/B" tách vào `alternatives`. */
function khaiHoangHero(hero, ids, unresolved, index) {
  const at = `heroes[${index}]`;
  const name = clean(hero.name);
  const primary = name ? ids.hero(null, name) : null;
  if (name && !primary) unresolved.push({ field: `${at}.hero`, rawName: name, reason: "unresolved" });
  return {
    hero: primary,
    slotState: primary ? "ok" : "unresolved",
    rawName: primary ? "" : name,
    heroAlternatives: [],
    redStars: null,
    tactics: [0, 1].map((slot) => {
      const entry = clean(hero.tacticsAfter?.[slot]);
      return entry ? tacticSlot(entry.split(SLASH), ids, unresolved, `${at}.tactics[${slot}]`) : emptySlot();
    }),
    books: [],
    bookType: "",
    troopNote: clean(hero.unitTypeAfter),
    statNote: "",
    gearNote: "",
  };
}

/** Dữ liệu giai đoạn "Trước cấp 20" và ghi chú nguồn thành chữ có nhãn; không suy thêm khi nguồn không có. */
function khaiHoangNotes(build) {
  const before = (build.heroes || [])
    .filter((hero) => clean(hero.tacticBefore) || clean(hero.unitTypeBefore))
    .map((hero) => `${clean(hero.name)}: ${clean(hero.tacticBefore)}${clean(hero.unitTypeBefore) ? ` (${clean(hero.unitTypeBefore)})` : ""}`.trim());
  const heroNotes = (build.heroes || []).flatMap((hero) => [hero.note, hero.buildNote].filter((value) => clean(value)).map((value) => `${clean(hero.name)}: ${clean(value)}`));
  return unique(
    lines([
      before.length ? `Trước cấp 20: ${before.join("; ")}` : null,
      clean(build.commanderBefore) && clean(build.commanderBefore) !== clean(build.commanderAfter) ? `Chủ tướng trước cấp 20: ${clean(build.commanderBefore)}` : null,
      clean(build.buildNote) ? `Ghi chú build: ${clean(build.buildNote)}` : null,
      clean(build.openingNote) ? `Mở đất: ${clean(build.openingNote)}` : null,
      clean(build.note) ? `Ghi chú: ${clean(build.note)}` : null,
      ...heroNotes,
    ]),
  );
}

/**
 * Một build Khai hoang (`variant` thiếu = đội mặc định) → đội nháp. Ô có cấu trúc là build Sau cấp 20 (`tacticsAfter`,
 * `unitTypeAfter` → `troopNote`), tướng sắp theo chủ tướng sau cấp 20; build Trước cấp 20 và ghi chú nguồn vào `notes.general`
 * dạng chữ có nhãn. Nhóm mặc định: Khai hoang.
 */
export function fromKhaiHoang(team, variant, ids, { id, contentHash } = {}) {
  const build = variant ?? team;
  const unresolved = [];
  const ordered = commanderAfterFirst(build).slice(0, TEAM_LIMITS.maxHeroes);
  const heroes = ordered.map((hero, index) => khaiHoangHero(hero, ids, unresolved, index));
  const title = clean(team.title);
  const label = clean(variant?.displayLabel) || clean(variant?.label);
  const draft = {
    id: id ?? newTeamId(),
    name: variant && label ? `${title} · ${label}` : title,
    seasonId: null,
    tierLabel: "",
    replacesTeamId: null,
    heroes,
    notes: { general: block(khaiHoangNotes(build)), strengths: "", goodAgainst: "", avoid: "" },
    userAlternatives: [],
    source: { kind: "khaihoang", key: variantKey(team.id, variant?.id), contentHash: contentHash ?? khaiHoangSourceHash(team, variant) },
  };
  return { draft, source: draft.source, unresolved, defaultGroup: "khai-hoang" };
}

/* ---------- Soi đội ---------- */

/** Đội canonical của Soi đội (`{heroes:[{hero, tactics:[id|null ×2], book}]}`, js/analyze-state.js). Không hash, không link nguồn. */
export function fromAnalyze(canonicalTeam, { id, name = "" } = {}) {
  const heroes = (canonicalTeam?.heroes || []).slice(0, TEAM_LIMITS.maxHeroes).map((member) => ({
    ...emptyHero(member?.hero ? "ok" : "source-empty"),
    hero: member?.hero ?? null,
    tactics: [0, 1].map((slot) => ({ primary: member?.tactics?.[slot] ?? null, alternatives: [], rawName: "" })),
    books: member?.book ? [member.book] : [],
  }));
  const fingerprint = sha256Hex16(heroes.map((hero) => [hero.hero, ...hero.tactics.map((slot) => slot.primary), ...hero.books].join(",")).join("|"));
  const draft = {
    id: id ?? newTeamId(),
    name: clean(name),
    seasonId: null,
    tierLabel: "",
    replacesTeamId: null,
    heroes,
    notes: { general: "", strengths: "", goodAgainst: "", avoid: "" },
    userAlternatives: [],
    source: { kind: "analyze", key: `analyze-${fingerprint}`, contentHash: "" },
  };
  return { draft, source: draft.source, unresolved: [], defaultGroup: "ghep-team" };
}

/* ---------- Gợi ý đội ---------- */

/** Ô chiến pháp của engine (`slotIndex` sau khi bỏ ô trống/bond) → chỉ số ô của nguồn (js/roster-season-candidates.js `mapHero`). */
function engineSlotMap(holder) {
  const map = [];
  (holder?.tacticSlotsRaw || []).forEach((raw, slot) => {
    if (raw == null || EMPTY_SLOTS.has(String(raw).trim())) return;
    if (holder.tacticSlotKinds?.[slot] !== "tactic") return;
    map.push(slot);
  });
  return map;
}

/**
 * Entry của engine Gợi ý đội → đội nháp đúng như thẻ đang hiện. Nền là bản ghi đầy đủ (giữ binh thư và hash nguồn gốc);
 * `entry.heroAssignments`/`tacticSelections` được ÁP vào đúng ô nguồn; lựa chọn gốc khác lựa chọn đang hiện chuyển vào
 * `heroAlternatives`/`alternatives`; món bù người dùng chọn (`team.heroes[].tactics[].userAlternatives`) vào `userAlternatives`.
 * `entry.team.source === "season"` → Đội chuẩn tra theo `team.id` trong `seasonRecords`; `entry.source === "legacy"` → Đội khác.
 * Entry khác (đội khóa, không có bản ghi) trả `null`.
 */
export function fromRosterEntry(entry, seasonRecords, ids, { id } = {}) {
  const team = entry?.team;
  let base;
  let record = null;
  if (entry?.source === "legacy") {
    base = fromLegacy(team, ids, { legacyTeamId: team.id, id });
  } else if (team?.source === "season") {
    record = (seasonRecords || []).find((row) => row?.sourceConfigId === team.id);
    if (!record) return null;
    base = fromRecommended(record, ids, { id, seasonId: team.seasonId });
  } else {
    return null;
  }
  const { draft } = base;
  const userAlternatives = [];
  (entry.heroAssignments || []).forEach((assignment, heroIndex) => {
    const mine = draft.heroes[heroIndex];
    if (!mine) return;
    const chosenHero = ids.hero(null, assignment.displayName) ?? assignment.canonicalId;
    if (typeof chosenHero === "string" && chosenHero !== mine.hero) {
      mine.heroAlternatives = unique([mine.hero, ...mine.heroAlternatives].filter((item) => item !== chosenHero)).slice(0, TEAM_LIMITS.maxAlternatives);
      mine.hero = chosenHero;
      mine.slotState = "ok";
      mine.rawName = "";
    }
    const map = record ? engineSlotMap(record.heroes?.[heroIndex]) : [0, 1];
    for (const selection of entry.tacticSelections || []) {
      if (selection.holderId !== assignment.canonicalId || selection.unresolved) continue;
      const slotIndex = map[selection.slotIndex];
      const slot = mine.tactics[slotIndex];
      if (!slot) continue;
      const chosen = ids.tactic(null, selection.selectedTactic) ?? selection.selectedTacticId;
      if (typeof chosen !== "string" || chosen === slot.primary) continue;
      slot.alternatives = unique([slot.primary, ...slot.alternatives].filter((item) => item !== chosen)).slice(0, TEAM_LIMITS.maxAlternatives);
      slot.primary = chosen;
      slot.rawName = "";
    }
    // Món bù người dùng chọn (không tính vào hash): ghi theo ô nguồn.
    (team.heroes?.[heroIndex]?.tactics || []).forEach((slot, engineIndex) => {
      const sourceSlot = map[engineIndex];
      if (sourceSlot === undefined) return;
      for (const name of slot.userAlternatives || []) {
        const tactic = ids.tactic(null, name);
        if (tactic) userAlternatives.push({ heroIndex, slotIndex: sourceSlot, tactic });
      }
    });
  });
  draft.userAlternatives = userAlternatives.slice(0, TEAM_LIMITS.maxUserAlternatives);
  return base;
}
