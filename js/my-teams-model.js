// Mô hình "Đội của tôi" (thuần, không DOM/mạng): chuẩn hóa, kiểm, cảnh báo trùng, dấu thiếu món. Hợp đồng dữ liệu:
// docs/roster-sync.md § "Mô hình đội" và § "Giới hạn chữ tự do". Server kiểm lại bằng community-worker/src/roster-schema.ts,
// nên mọi trần ở đây trùng với bản đó; validateTeam KHÔNG sửa dữ liệu (vượt trần = lỗi theo trường, không cắt im lặng).

const encoder = new TextEncoder();

export const SOURCE_KINDS = ["recommended", "legacy", "khaihoang", "analyze", "roster-recommend"];
export const SLOT_STATES = ["ok", "source-empty", "unresolved"];
export const TEAM_LIMITS = Object.freeze({
  maxHeroes: 3,
  tacticSlots: 2,
  maxAlternatives: 3,
  maxBooks: 3,
  maxUserAlternatives: 6,
  totalBytes: 16 * 1024,
  name: 180,
  tierLabel: 48,
  rawName: 80,
  bookType: 120,
  slotNote: 360,
  notesField: 2000,
  groupId: 128,
  idRef: 64,
  seasonId: 64,
  replacesTeamId: 64,
  sourceKey: 128,
});

const TEAM_ID_RE = /^team-[a-z0-9][a-z0-9-]*$/u;
const RECORD_ID_RE = /^[a-z0-9][a-z0-9~:-]*$/u;
const HERO_REF_RE = /^hero:[a-z0-9][a-z0-9-]*$/u;
const TACTIC_REF_RE = /^tactic:[a-z0-9][a-z0-9-]*$/u;
const BOOK_REF_RE = /^book:[a-z0-9][a-z0-9-]*$/u;
const SOURCE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u;
const CONTENT_HASH_RE = /^[0-9a-f]{16}$/u;
// C0/C1 trừ \n (0A) và \t (09), như server.
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;
const CONTROL_ALL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/gu;

const NOTE_KEYS = ["general", "strengths", "goodAgainst", "avoid"];

const isObj = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Byte UTF-8 của chuỗi SAU JSON escape, không tính hai dấu ngoặc kép (`"` và `\` = 2 B, chữ Hán = 3 B). */
export function escapedBytes(text) {
  return encoder.encode(JSON.stringify(String(text))).byteLength - 2;
}

/** Bỏ ký tự điều khiển khi nhập (trừ xuống dòng và tab). */
export const stripControl = (text) => String(text).replace(CONTROL_ALL_RE, "");

/* ---------- Chuẩn hóa ---------- */

const text = (value) => (typeof value === "string" ? stripControl(value) : "");
const nullableText = (value) => (typeof value === "string" ? stripControl(value) : null);
const refs = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string").map(stripControl) : []);

function normalizeSlot(value) {
  if (!isObj(value)) return null;
  const primary = typeof value.primary === "string" ? stripControl(value.primary) : null;
  return { primary, alternatives: refs(value.alternatives), rawName: text(value.rawName) };
}

function normalizeHero(value) {
  if (!isObj(value) || !SLOT_STATES.includes(value.slotState)) return null;
  if (!Array.isArray(value.tactics) || value.tactics.length !== TEAM_LIMITS.tacticSlots) return null;
  const tactics = value.tactics.map(normalizeSlot);
  if (tactics.includes(null)) return null;
  return {
    hero: typeof value.hero === "string" ? stripControl(value.hero) : null,
    slotState: value.slotState,
    rawName: text(value.rawName),
    heroAlternatives: refs(value.heroAlternatives),
    redStars: Number.isInteger(value.redStars) ? value.redStars : null,
    tactics,
    books: refs(value.books),
    bookType: text(value.bookType),
    troopNote: text(value.troopNote),
    statNote: text(value.statNote),
    gearNote: text(value.gearNote),
  };
}

/**
 * Chuẩn hóa một đội (nháp hoặc `data` từ server) về đúng dạng và thứ tự khóa của hợp đồng. Bản ghi hỏng (sai hình dạng,
 * không phải đối tượng) trả `null`, không ném, để một bản ghi xấu không làm vỡ trang. Không cắt chữ: vượt trần là việc
 * của `validateTeam`. Trường định danh `boxId/groupId/updatedAt/deletedAt` chỉ có mặt khi đầu vào có.
 */
export function normalizeTeam(input) {
  if (!isObj(input) || typeof input.id !== "string" || !input.id) return null;
  if (!Array.isArray(input.heroes) || input.heroes.length < 1 || input.heroes.length > TEAM_LIMITS.maxHeroes) return null;
  const heroes = input.heroes.map(normalizeHero);
  if (heroes.includes(null)) return null;
  const source = input.source;
  if (!isObj(source) || !SOURCE_KINDS.includes(source.kind) || typeof source.key !== "string" || !source.key) return null;
  const notes = isObj(input.notes) ? input.notes : {};
  const userAlternatives = (Array.isArray(input.userAlternatives) ? input.userAlternatives : [])
    .filter((item) => isObj(item) && Number.isInteger(item.heroIndex) && Number.isInteger(item.slotIndex) && typeof item.tactic === "string")
    .map((item) => ({ heroIndex: item.heroIndex, slotIndex: item.slotIndex, tactic: stripControl(item.tactic) }));
  const out = { id: input.id };
  if (typeof input.boxId === "string") out.boxId = input.boxId;
  if (typeof input.groupId === "string") out.groupId = input.groupId;
  Object.assign(out, {
    name: text(input.name),
    seasonId: nullableText(input.seasonId),
    tierLabel: text(input.tierLabel),
    replacesTeamId: nullableText(input.replacesTeamId),
    heroes,
    notes: Object.fromEntries(NOTE_KEYS.map((key) => [key, text(notes[key])])),
    userAlternatives,
    source: { kind: source.kind, key: stripControl(source.key), contentHash: text(source.contentHash) },
  });
  if (typeof input.updatedAt === "string") out.updatedAt = input.updatedAt;
  if (typeof input.deletedAt === "string") out.deletedAt = input.deletedAt;
  return out;
}

/* ---------- Kiểm ---------- */

/**
 * Kiểm đội đã chuẩn hóa theo hợp đồng. Trả `{ok, errors: [{field, code}]}`; `code` ∈ `required | count | pattern |
 * enum | control | bytes`. Trường `total` là tổng byte của `data` khi lưu (trần 16 KiB).
 */
export function validateTeam(team) {
  const errors = [];
  const fail = (field, code) => errors.push({ field, code });
  const checkText = (value, field, max) => {
    if (typeof value !== "string") return fail(field, "required");
    if (CONTROL_RE.test(value)) return fail(field, "control");
    if (escapedBytes(value) > max) fail(field, "bytes");
  };
  const checkRef = (value, field, re, { nullable = false } = {}) => {
    if (value === null && nullable) return;
    if (typeof value !== "string" || !re.test(value) || escapedBytes(value) > TEAM_LIMITS.idRef) fail(field, "pattern");
  };
  const checkRefs = (list, field, re, max) => {
    if (!Array.isArray(list)) return fail(field, "required");
    if (list.length > max) fail(field, "count");
    list.forEach((item, index) => checkRef(item, `${field}[${index}]`, re));
  };

  if (!isObj(team)) return { ok: false, errors: [{ field: "team", code: "required" }] };
  if (typeof team.id !== "string" || !TEAM_ID_RE.test(team.id) || escapedBytes(team.id) > TEAM_LIMITS.idRef) fail("id", "pattern");
  checkText(team.name, "name", TEAM_LIMITS.name);
  checkText(team.tierLabel, "tierLabel", TEAM_LIMITS.tierLabel);
  if (team.seasonId !== null) checkText(team.seasonId, "seasonId", TEAM_LIMITS.seasonId);
  if (team.replacesTeamId !== null) checkText(team.replacesTeamId, "replacesTeamId", TEAM_LIMITS.replacesTeamId);
  if (team.groupId !== undefined) {
    if (typeof team.groupId !== "string" || !RECORD_ID_RE.test(team.groupId) || escapedBytes(team.groupId) > TEAM_LIMITS.groupId) fail("groupId", "pattern");
  }

  if (!Array.isArray(team.heroes) || team.heroes.length < 1 || team.heroes.length > TEAM_LIMITS.maxHeroes) {
    fail("heroes", "count");
  } else {
    team.heroes.forEach((hero, index) => {
      const at = `heroes[${index}]`;
      if (!isObj(hero)) return fail(at, "required");
      if (!SLOT_STATES.includes(hero.slotState)) fail(`${at}.slotState`, "enum");
      if (hero.hero !== null && hero.hero !== undefined) checkRef(hero.hero, `${at}.hero`, HERO_REF_RE);
      if (hero.slotState === "ok" && !hero.hero) fail(`${at}.hero`, "required");
      checkText(hero.rawName, `${at}.rawName`, TEAM_LIMITS.rawName);
      checkRefs(hero.heroAlternatives, `${at}.heroAlternatives`, HERO_REF_RE, TEAM_LIMITS.maxAlternatives);
      checkRefs(hero.books, `${at}.books`, BOOK_REF_RE, TEAM_LIMITS.maxBooks);
      checkText(hero.bookType, `${at}.bookType`, TEAM_LIMITS.bookType);
      for (const key of ["troopNote", "statNote", "gearNote"]) checkText(hero[key], `${at}.${key}`, TEAM_LIMITS.slotNote);
      if (hero.redStars !== null && hero.redStars !== undefined && !(Number.isInteger(hero.redStars) && hero.redStars >= 0 && hero.redStars <= 5)) {
        fail(`${at}.redStars`, "enum");
      }
      if (!Array.isArray(hero.tactics) || hero.tactics.length !== TEAM_LIMITS.tacticSlots) {
        fail(`${at}.tactics`, "count");
      } else {
        hero.tactics.forEach((slot, slotIndex) => {
          const slotAt = `${at}.tactics[${slotIndex}]`;
          if (!isObj(slot)) return fail(slotAt, "required");
          checkRef(slot.primary ?? null, `${slotAt}.primary`, TACTIC_REF_RE, { nullable: true });
          checkRefs(slot.alternatives, `${slotAt}.alternatives`, TACTIC_REF_RE, TEAM_LIMITS.maxAlternatives);
          checkText(slot.rawName, `${slotAt}.rawName`, TEAM_LIMITS.rawName);
        });
      }
    });
  }

  if (!isObj(team.notes)) {
    fail("notes", "required");
  } else {
    for (const key of NOTE_KEYS) checkText(team.notes[key], `notes.${key}`, TEAM_LIMITS.notesField);
  }
  if (!Array.isArray(team.userAlternatives) || team.userAlternatives.length > TEAM_LIMITS.maxUserAlternatives) {
    fail("userAlternatives", "count");
  } else {
    team.userAlternatives.forEach((item, index) => {
      const at = `userAlternatives[${index}]`;
      if (!isObj(item)) return fail(at, "required");
      if (!(Number.isInteger(item.heroIndex) && item.heroIndex >= 0 && item.heroIndex <= 2)) fail(`${at}.heroIndex`, "enum");
      if (!(Number.isInteger(item.slotIndex) && item.slotIndex >= 0 && item.slotIndex <= 1)) fail(`${at}.slotIndex`, "enum");
      checkRef(item.tactic, `${at}.tactic`, TACTIC_REF_RE);
    });
  }
  if (!isObj(team.source) || !SOURCE_KINDS.includes(team.source.kind)) {
    fail("source.kind", "enum");
  } else {
    if (typeof team.source.key !== "string" || !SOURCE_KEY_RE.test(team.source.key) || escapedBytes(team.source.key) > TEAM_LIMITS.sourceKey) fail("source.key", "pattern");
    const hash = team.source.contentHash ?? "";
    if (hash !== "" && !CONTENT_HASH_RE.test(hash)) fail("source.contentHash", "pattern");
  }

  // Tổng byte của `data` khi lưu. Phần định danh server thêm (hộp, nhóm, dấu thời gian) tính theo trần của chúng khi
  // đội nháp chưa có; đội đã có thì dùng đúng giá trị. Với mọi trần trường ở trên, tổng này luôn dưới 16 KiB.
  if (errors.length === 0) {
    const { id, boxId, groupId, updatedAt, deletedAt, ...body } = team;
    const data = {
      id,
      boxId: boxId ?? "box-".padEnd(TEAM_LIMITS.idRef, "x"),
      groupId: groupId ?? "".padEnd(TEAM_LIMITS.groupId, "x"),
      ...body,
      updatedAt: updatedAt ?? "2026-10-21T08:00:00.000Z",
      deletedAt: deletedAt ?? "",
    };
    if (encoder.encode(JSON.stringify(data)).byteLength > TEAM_LIMITS.totalBytes) fail("total", "bytes");
  }
  return { ok: errors.length === 0, errors };
}

/* ---------- Cảnh báo trùng ---------- */

const isDeleted = (team) => team?.deleted === true || (typeof team?.deletedAt === "string" && team.deletedAt !== "");

const heroIdsOf = (team) => (team.heroes || []).map((hero) => hero?.hero).filter((id) => typeof id === "string");
const primaryTacticsOf = (team) =>
  (team.heroes || []).flatMap((hero) => (hero?.tactics || []).map((slot) => slot?.primary)).filter((id) => typeof id === "string");

/**
 * Cặp đội cùng hộp chung `hero` hoặc `primary` (phương án thay không tính, ô trống/chưa đối chiếu không có ID nên không
 * tạo trùng). Bỏ cặp mà một đội thay đội kia (`replacesTeamId`), đội đã xóa và đội khác hộp.
 * @returns {{boxId: string|null, a: string, b: string, heroes: string[], tactics: string[]}[]}
 */
export function duplicateWarnings(teams) {
  const live = (teams || []).filter((team) => isObj(team) && !isDeleted(team));
  const warnings = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if ((a.boxId ?? null) !== (b.boxId ?? null)) continue;
      if (a.replacesTeamId === b.id || b.replacesTeamId === a.id) continue;
      const bHeroes = new Set(heroIdsOf(b));
      const bTactics = new Set(primaryTacticsOf(b));
      const heroes = [...new Set(heroIdsOf(a).filter((id) => bHeroes.has(id)))];
      const tactics = [...new Set(primaryTacticsOf(a).filter((id) => bTactics.has(id)))];
      if (heroes.length || tactics.length) warnings.push({ boxId: a.boxId ?? null, a: a.id, b: b.id, heroes, tactics });
    }
  }
  return warnings;
}

/* ---------- Dấu thiếu món ---------- */

/**
 * Tướng và chiến pháp `primary` của đội không có trong kho (theo ID canonical). Ô `source-empty`/`unresolved` và phương
 * án thay không có vai trò: phương án thay có trong kho không xóa dấu thiếu của món chính.
 * @param owned `Set` hoặc mảng ID `hero:…`/`tactic:…` của kho hộp
 * @returns {({type: "hero", id: string, heroIndex: number} | {type: "tactic", id: string, heroIndex: number, slotIndex: number})[]}
 */
export function missingItems(team, owned) {
  const have = owned instanceof Set ? owned : new Set(owned || []);
  const missing = [];
  (team?.heroes || []).forEach((hero, heroIndex) => {
    if (hero?.slotState === "ok" && typeof hero.hero === "string" && !have.has(hero.hero)) {
      missing.push({ type: "hero", id: hero.hero, heroIndex });
    }
    (hero?.tactics || []).forEach((slot, slotIndex) => {
      if (typeof slot?.primary === "string" && !have.has(slot.primary)) {
        missing.push({ type: "tactic", id: slot.primary, heroIndex, slotIndex });
      }
    });
  });
  return missing;
}
