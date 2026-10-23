// Kiểm bản ghi /api/roster theo hợp đồng docs/roster-sync.md: kiểu, độ dài theo byte UTF-8 (chữ tự do đếm SAU JSON escape),
// regex id, quan hệ hộp–id. Bản hợp lệ được dựng lại theo thứ tự khóa cố định (so payload khi "already-applied" không phụ
// thuộc thứ tự khóa client gửi); khóa lạ bị từ chối chứ không bỏ âm thầm. Bản xóa chỉ giữ {id, updatedAt, deletedAt, boxId}.

export const ROSTER_KINDS = ["box", "owned", "season", "locked", "override", "group", "team"] as const;
export type RosterKind = (typeof ROSTER_KINDS)[number];

export type RejectCode = "bytes" | "schema" | "default_protected";

/** Trần byte của `JSON.stringify(data)` theo kind. */
export const DATA_MAX_BYTES: Record<RosterKind, number> = {
  box: 1024,
  owned: 1024,
  season: 1024,
  locked: 2048,
  override: 1024,
  group: 1024,
  team: 16_384,
};

export const SOURCE_KINDS = ["recommended", "legacy", "khaihoang", "analyze", "roster-recommend"] as const;
export const SLOT_STATES = ["ok", "source-empty", "unresolved"] as const;

const MAX_RECORD_ID = 256;
const MAX_ID = 64;
const encoder = new TextEncoder();

// `id` mọi kind (khóa chính). Id có tiền tố hộp nối nhiều thành phần nên trần riêng (MAX_RECORD_ID) rộng hơn MAX_ID.
const RECORD_ID_RE = /^[a-z0-9][a-z0-9~:-]*$/u;
const BOX_ID_RE = /^(?:main|box-[a-z0-9][a-z0-9-]*)$/u;
const TEAM_ID_RE = /^team-[a-z0-9][a-z0-9-]*$/u;
const GROUP_ID_RE = /^grp-[a-z0-9][a-z0-9-]*$/u;
const HERO_REF_RE = /^hero:[a-z0-9][a-z0-9-]*$/u;
const TACTIC_REF_RE = /^tactic:[a-z0-9][a-z0-9-]*$/u;
const BOOK_REF_RE = /^book:[a-z0-9][a-z0-9-]*$/u;
const LOCKED_KEY_RE = /^[0-9a-f]{16}$/u;
const SOURCE_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._~-]*$/u;
const CONTENT_HASH_RE = /^[0-9a-f]{16}$/u;
// C0/C1 trừ \n (0A) và \t (09).
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/u;

export const DEFAULT_GROUP_SUFFIXES = ["khai-hoang", "ghep-team"] as const;
export const defaultGroupId = (boxId: string, suffix: (typeof DEFAULT_GROUP_SUFFIXES)[number]) => `${boxId}~${suffix}`;

class Reject extends Error {
  constructor(
    readonly code: RejectCode,
    message: string,
  ) {
    super(message);
  }
}
const schema = (message: string) => new Reject("schema", message);
const tooBig = (message: string) => new Reject("bytes", message);

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => !!value && typeof value === "object" && !Array.isArray(value);

/** Byte UTF-8 của chuỗi sau JSON escape, không tính hai dấu ngoặc kép (`"` và `\` = 2 B, chữ Hán = 3 B). */
export function escapedBytes(text: string): number {
  return encoder.encode(JSON.stringify(text)).byteLength - 2;
}

/** `data` hợp lệ lồng tối đa vài tầng (đội: heroes[].tactics[]); sâu hơn là bản ghi sai, không đệ quy tới tràn ngăn xếp. */
const MAX_DEPTH = 8;

function noControlChars(value: unknown, at: string, depth = 0): void {
  if (depth > MAX_DEPTH) throw schema(`${at} lồng quá ${MAX_DEPTH} tầng`);
  if (typeof value === "string") {
    if (CONTROL_RE.test(value)) throw schema(`${at} chứa ký tự điều khiển`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => noControlChars(item, `${at}[${i}]`, depth + 1));
  } else if (isObj(value)) {
    for (const [key, nested] of Object.entries(value)) {
      if (CONTROL_RE.test(key)) throw schema(`${at} có khóa chứa ký tự điều khiển`);
      noControlChars(nested, `${at}.${key}`, depth + 1);
    }
  }
}

function exact(obj: Obj, allowed: readonly string[], at: string): void {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) throw schema(`${at}.${key} không thuộc hợp đồng`);
}

function str(value: unknown, at: string, maxBytes: number, opts: { min?: number } = {}): string {
  if (typeof value !== "string") throw schema(`${at} phải là chuỗi`);
  if (escapedBytes(value) > maxBytes) throw tooBig(`${at} quá ${maxBytes} byte`);
  if (opts.min && value.length < opts.min) throw schema(`${at} không được rỗng`);
  return value;
}

/** Chuỗi tùy chọn: vắng/null -> mặc định. */
function optStr(value: unknown, at: string, maxBytes: number, fallback: string | null): string | null {
  if (value === undefined || value === null) return fallback;
  return str(value, at, maxBytes);
}

function int(value: unknown, at: string, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    throw schema(`${at} phải là số nguyên ${min}–${max}`);
  }
  return value as number;
}

function ref(value: unknown, at: string, re: RegExp): string {
  if (typeof value !== "string" || !re.test(value)) throw schema(`${at} không đúng dạng id`);
  if (encoder.encode(value).byteLength > MAX_ID) throw tooBig(`${at} quá ${MAX_ID} byte`);
  return value;
}

function refList(value: unknown, at: string, re: RegExp, max: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) throw schema(`${at} phải là mảng ≤ ${max} phần tử`);
  return value.map((item, i) => ref(item, `${at}[${i}]`, re));
}

function boxIdOf(value: unknown, at: string): string {
  if (typeof value !== "string" || !BOX_ID_RE.test(value) || encoder.encode(value).byteLength > MAX_ID) {
    throw schema(`${at} không phải id hộp hợp lệ`);
  }
  return value;
}

/** Nhận diện bản ghi: kiểm id theo kind và quan hệ với `data.boxId`. Trả boxId (box: null) và groupId (team). */
function identity(kind: RosterKind, id: string, data: Obj): { boxId: string | null } {
  if (kind === "box") {
    if (!BOX_ID_RE.test(id) || encoder.encode(id).byteLength > MAX_ID) throw schema("id hộp phải là `main` hoặc `box-…`");
    return { boxId: null };
  }
  const boxId = boxIdOf(data.boxId, "data.boxId");
  const prefixed = (rest: string) => id.startsWith(`${boxId}~`) && id.length > boxId.length + 1 && rest.length > 0;
  switch (kind) {
    case "owned":
      if (!prefixed(id.slice(boxId.length + 1))) throw schema("id owned phải là `${boxId}~${item}`");
      break;
    case "season":
      if (id !== boxId) throw schema("id season phải bằng boxId");
      break;
    case "locked":
      if (!prefixed(id.slice(boxId.length + 1)) || !LOCKED_KEY_RE.test(id.slice(boxId.length + 1))) {
        throw schema("id locked phải là `${boxId}~<16 hex>`");
      }
      break;
    case "override":
      if (!prefixed(id.slice(boxId.length + 1))) throw schema("id override phải là `${boxId}~${sha256(teamId)[0..16]}~${heroIndex}~${slotIndex}`");
      break;
    case "group": {
      const isDefault = DEFAULT_GROUP_SUFFIXES.some((s) => id === defaultGroupId(boxId, s));
      if (!isDefault && !(GROUP_ID_RE.test(id) && encoder.encode(id).byteLength <= MAX_ID)) {
        throw schema("id nhóm phải là nhóm mặc định của hộp hoặc `grp-…`");
      }
      break;
    }
    case "team":
      if (!TEAM_ID_RE.test(id) || encoder.encode(id).byteLength > MAX_ID) throw schema("id đội phải là `team-…`");
      break;
  }
  return { boxId };
}

/** Nhóm/hộp mặc định không xóa được. */
function isProtected(kind: RosterKind, id: string, boxId: string | null): boolean {
  if (kind === "box") return id === "main";
  return kind === "group" && boxId !== null && DEFAULT_GROUP_SUFFIXES.some((s) => id === defaultGroupId(boxId, s));
}

function buildOwned(d: Obj, base: Obj, id: string, boxId: string): Obj {
  exact(d, ["id", "boxId", "item", "name", "type", "redStars", "updatedAt", "deletedAt"], "data");
  const item = ref(d.item, "data.item", /^(?:hero|tactic):[a-z0-9][a-z0-9-]*$/u);
  if (id !== `${boxId}~${item}`) throw schema("id owned phải là `${boxId}~${item}`");
  const out: Obj = { id, boxId, item, name: str(d.name, "data.name", 180, { min: 1 }), type: str(d.type, "data.type", 32, { min: 1 }) };
  if (d.redStars !== undefined) out.redStars = int(d.redStars, "data.redStars", 0, 5);
  return { ...out, ...base };
}

function buildLocked(d: Obj, base: Obj, id: string, boxId: string): Obj {
  exact(d, ["id", "boxId", "teamId", "configId", "seasonContext", "teamName", "heroes", "tactics", "updatedAt", "deletedAt"], "data");
  const names = (value: unknown, at: string, max: number) => {
    if (!Array.isArray(value) || value.length > max) throw schema(`${at} phải là mảng ≤ ${max} phần tử`);
    return value.map((v, i) => str(v, `${at}[${i}]`, 80, { min: 1 }));
  };
  const out: Obj = { id, boxId };
  if (d.teamId !== undefined) out.teamId = str(d.teamId, "data.teamId", 128, { min: 1 });
  if (d.configId !== undefined) out.configId = str(d.configId, "data.configId", 128, { min: 1 });
  if (d.seasonContext !== undefined) {
    if (!isObj(d.seasonContext)) throw schema("data.seasonContext phải là object");
    exact(d.seasonContext, ["scenarioId", "rulesetId"], "data.seasonContext");
    out.seasonContext = {
      scenarioId: str(d.seasonContext.scenarioId, "data.seasonContext.scenarioId", 128, { min: 1 }),
      rulesetId: str(d.seasonContext.rulesetId, "data.seasonContext.rulesetId", 128, { min: 1 }),
    };
  }
  out.teamName = str(d.teamName, "data.teamName", 180);
  out.heroes = names(d.heroes, "data.heroes", 3);
  out.tactics = names(d.tactics, "data.tactics", 6);
  return { ...out, ...base };
}

/** 16 hex đầu của SHA-256 (UTF-8) — cùng kiểu `lockedTeamKey`; id override không chứa teamId thô (teamId có thể là CJK). */
async function overrideTeamKey(teamId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(teamId)));
  return Array.from(digest.subarray(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildOverride(d: Obj, base: Obj, id: string, boxId: string): Promise<Obj> {
  exact(d, ["id", "boxId", "teamId", "heroIndex", "slotIndex", "tactic", "updatedAt", "deletedAt"], "data");
  const teamId = str(d.teamId, "data.teamId", 128, { min: 1 });
  const heroIndex = int(d.heroIndex, "data.heroIndex", 0, 9);
  const slotIndex = int(d.slotIndex, "data.slotIndex", 0, 9);
  if (id !== `${boxId}~${await overrideTeamKey(teamId)}~${heroIndex}~${slotIndex}`) {
    throw schema("id override không khớp sha256(teamId)/heroIndex/slotIndex");
  }
  return { id, boxId, teamId, heroIndex, slotIndex, tactic: str(d.tactic, "data.tactic", 80, { min: 1 }), ...base };
}

function buildTactic(value: unknown, at: string): Obj {
  if (!isObj(value)) throw schema(`${at} phải là object`);
  exact(value, ["primary", "alternatives", "rawName"], at);
  const primary = value.primary === null || value.primary === undefined ? null : ref(value.primary, `${at}.primary`, TACTIC_REF_RE);
  return {
    primary,
    alternatives: refList(value.alternatives, `${at}.alternatives`, TACTIC_REF_RE, 3),
    rawName: optStr(value.rawName, `${at}.rawName`, 80, "") as string,
  };
}

function buildHero(value: unknown, at: string): Obj {
  if (!isObj(value)) throw schema(`${at} phải là object`);
  exact(
    value,
    ["hero", "slotState", "rawName", "heroAlternatives", "redStars", "tactics", "books", "bookType", "troopNote", "statNote", "gearNote"],
    at,
  );
  const hero = value.hero === null || value.hero === undefined ? null : ref(value.hero, `${at}.hero`, HERO_REF_RE);
  if (!SLOT_STATES.includes(value.slotState as (typeof SLOT_STATES)[number])) throw schema(`${at}.slotState không hợp lệ`);
  if (value.slotState === "ok" && hero === null) throw schema(`${at}: ô "ok" phải có hero`);
  if (!Array.isArray(value.tactics) || value.tactics.length !== 2) throw schema(`${at}.tactics phải có đúng 2 ô`);
  return {
    hero,
    slotState: value.slotState,
    rawName: optStr(value.rawName, `${at}.rawName`, 80, "") as string,
    heroAlternatives: refList(value.heroAlternatives, `${at}.heroAlternatives`, HERO_REF_RE, 3),
    redStars: value.redStars === null || value.redStars === undefined ? null : int(value.redStars, `${at}.redStars`, 0, 5),
    tactics: value.tactics.map((t, i) => buildTactic(t, `${at}.tactics[${i}]`)),
    books: refList(value.books, `${at}.books`, BOOK_REF_RE, 3),
    bookType: optStr(value.bookType, `${at}.bookType`, 120, "") as string,
    troopNote: optStr(value.troopNote, `${at}.troopNote`, 360, "") as string,
    statNote: optStr(value.statNote, `${at}.statNote`, 360, "") as string,
    gearNote: optStr(value.gearNote, `${at}.gearNote`, 360, "") as string,
  };
}

function buildTeam(d: Obj, base: Obj, id: string, boxId: string): { out: Obj; groupId: string } {
  exact(
    d,
    ["id", "boxId", "groupId", "name", "seasonId", "tierLabel", "replacesTeamId", "heroes", "notes", "userAlternatives", "source", "updatedAt", "deletedAt"],
    "data",
  );
  const groupId = str(d.groupId, "data.groupId", 128, { min: 1 });
  if (!RECORD_ID_RE.test(groupId)) throw schema("data.groupId không đúng dạng id");
  if (!Array.isArray(d.heroes) || d.heroes.length < 1 || d.heroes.length > 3) throw schema("data.heroes phải có 1–3 phần tử");
  const notes = isObj(d.notes) ? d.notes : d.notes === undefined ? {} : null;
  if (!notes) throw schema("data.notes phải là object");
  exact(notes, ["general", "strengths", "goodAgainst", "avoid"], "data.notes");
  const userAlternatives = d.userAlternatives === undefined ? [] : d.userAlternatives;
  if (!Array.isArray(userAlternatives) || userAlternatives.length > 6) throw schema("data.userAlternatives phải là mảng ≤ 6 phần tử");
  if (!isObj(d.source)) throw schema("data.source phải là object");
  exact(d.source, ["kind", "key", "contentHash"], "data.source");
  if (!SOURCE_KINDS.includes(d.source.kind as (typeof SOURCE_KINDS)[number])) throw schema("data.source.kind không hợp lệ");
  const key = str(d.source.key, "data.source.key", 128, { min: 1 });
  if (!SOURCE_KEY_RE.test(key)) throw schema("data.source.key chứa ký tự ngoài dạng cho phép");
  const contentHash = str(d.source.contentHash ?? "", "data.source.contentHash", 16);
  if (contentHash !== "" && !CONTENT_HASH_RE.test(contentHash)) throw schema("data.source.contentHash phải là 16 hex hoặc rỗng");
  const out: Obj = {
    id,
    boxId,
    groupId,
    name: str(d.name, "data.name", 180),
    seasonId: optStr(d.seasonId, "data.seasonId", 64, null),
    tierLabel: optStr(d.tierLabel, "data.tierLabel", 48, "") as string,
    replacesTeamId: optStr(d.replacesTeamId, "data.replacesTeamId", 64, null),
    heroes: d.heroes.map((h, i) => buildHero(h, `data.heroes[${i}]`)),
    notes: {
      general: optStr(notes.general, "data.notes.general", 2000, "") as string,
      strengths: optStr(notes.strengths, "data.notes.strengths", 2000, "") as string,
      goodAgainst: optStr(notes.goodAgainst, "data.notes.goodAgainst", 2000, "") as string,
      avoid: optStr(notes.avoid, "data.notes.avoid", 2000, "") as string,
    },
    userAlternatives: userAlternatives.map((a: unknown, i) => {
      const at = `data.userAlternatives[${i}]`;
      if (!isObj(a)) throw schema(`${at} phải là object`);
      exact(a, ["heroIndex", "slotIndex", "tactic"], at);
      return {
        heroIndex: int(a.heroIndex, `${at}.heroIndex`, 0, 2),
        slotIndex: int(a.slotIndex, `${at}.slotIndex`, 0, 1),
        tactic: ref(a.tactic, `${at}.tactic`, TACTIC_REF_RE),
      };
    }),
    source: { kind: d.source.kind, key, contentHash },
    ...base,
  };
  return { out, groupId };
}

export interface ValidRecord {
  kind: RosterKind;
  id: string;
  /** null chỉ với kind = box. */
  boxId: string | null;
  /** Chỉ team sống: nhóm đích để kiểm nhóm sống trong câu ghi. */
  groupId: string | null;
  updatedAt: number;
  deleted: boolean;
  /** Payload chuẩn hóa đã stringify (bản xóa: bản thu gọn). */
  payload: string;
  /** Mốc ISO của bản ghi (dùng khi chuyển đội khỏi nhóm bị xóa). */
  updatedAtIso: string;
}

export type Validation =
  | { ok: true; record: ValidRecord }
  | { ok: false; kind: string | null; id: string | null; code: RejectCode; message: string };

/** Kiểm một phần tử của `records` (chưa kiểm clock_skew: cần `now`). Lỗi từng bản ghi không ném. */
export async function validateRecord(input: unknown): Promise<Validation> {
  const echo = isObj(input)
    ? { kind: typeof input.kind === "string" ? input.kind : null, id: typeof input.id === "string" ? input.id : null }
    : { kind: null, id: null };
  try {
    return { ok: true, record: await parse(input) };
  } catch (e) {
    if (e instanceof Reject) return { ok: false, ...echo, code: e.code, message: e.message };
    throw e;
  }
}

async function parse(input: unknown): Promise<ValidRecord> {
  if (!isObj(input)) throw schema("bản ghi phải là object");
  const { kind, id, updatedAt, deleted, data } = input;
  if (!ROSTER_KINDS.includes(kind as RosterKind)) throw schema("kind không hợp lệ");
  const k = kind as RosterKind;
  if (typeof id !== "string" || !RECORD_ID_RE.test(id) || encoder.encode(id).byteLength > MAX_RECORD_ID) {
    throw schema("id không đúng dạng ^[a-z0-9][a-z0-9~:-]*$ hoặc quá dài");
  }
  if (!Number.isSafeInteger(updatedAt) || (updatedAt as number) < 0) throw schema("updatedAt phải là số nguyên ms");
  const isDeleted = deleted === true || deleted === 1;
  if (!isDeleted && deleted !== false && deleted !== 0) throw schema("deleted phải là boolean");
  if (!isObj(data)) throw schema("data phải là object");
  noControlChars(data, "data");
  if (encoder.encode(JSON.stringify(data)).byteLength > DATA_MAX_BYTES[k]) throw tooBig(`data quá ${DATA_MAX_BYTES[k]} byte`);
  if (data.id !== id) throw schema("data.id khác id");
  if (typeof data.updatedAt !== "string" || Date.parse(data.updatedAt) !== updatedAt) throw schema("data.updatedAt khác updatedAt");
  if (typeof data.deletedAt !== "string" || data.deletedAt.length > 40) throw schema("data.deletedAt phải là chuỗi");
  if (isDeleted ? Number.isNaN(Date.parse(data.deletedAt)) : data.deletedAt !== "") {
    throw schema(isDeleted ? "bản xóa cần deletedAt là ISO" : "bản sống cần deletedAt rỗng");
  }
  const { boxId } = identity(k, id, data);
  const base = { updatedAt: data.updatedAt, deletedAt: data.deletedAt };
  if (isDeleted) {
    if (isProtected(k, id, boxId)) throw new Reject("default_protected", "Hộp/nhóm mặc định không xóa được");
    // Bản xóa thu gọn; hộp ghi boxId = chính id để mọi bản xóa cùng dạng.
    const payload = JSON.stringify({ id, ...base, boxId: boxId ?? id });
    return { kind: k, id, boxId, groupId: null, updatedAt: updatedAt as number, deleted: true, payload, updatedAtIso: data.updatedAt };
  }
  let out: Obj;
  let groupId: string | null = null;
  switch (k) {
    case "box":
      exact(data, ["id", "name", "updatedAt", "deletedAt"], "data");
      out = { id, name: str(data.name, "data.name", 180), ...base };
      break;
    case "owned":
      out = buildOwned(data, base, id, boxId as string);
      break;
    case "season":
      exact(data, ["id", "boxId", "seasonId", "updatedAt", "deletedAt"], "data");
      out = { id, boxId, seasonId: str(data.seasonId, "data.seasonId", 64, { min: 1 }), ...base };
      break;
    case "locked":
      out = buildLocked(data, base, id, boxId as string);
      break;
    case "override":
      out = await buildOverride(data, base, id, boxId as string);
      break;
    case "group":
      exact(data, ["id", "boxId", "name", "order", "updatedAt", "deletedAt"], "data");
      out = { id, boxId, name: str(data.name, "data.name", 180), order: int(data.order, "data.order", 0, 1_000_000), ...base };
      break;
    case "team": {
      const built = buildTeam(data, base, id, boxId as string);
      out = built.out;
      groupId = built.groupId;
      break;
    }
  }
  return { kind: k, id, boxId, groupId, updatedAt: updatedAt as number, deleted: false, payload: JSON.stringify(out), updatedAtIso: data.updatedAt };
}
