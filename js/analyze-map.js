// Logic thuần Soi đội (testable, 0-dep): map chữ Hán Worker chép từ ảnh -> ID canonical
// (tướng / chiến pháp / binh thư), phân loại 3 trạng thái cho editor xác nhận, rồi diff
// từng ô với đội tham chiếu (Đội chuẩn theo mùa, Đội khác).
// Chống hallucination: mọi tên qua matchDict; dưới ngưỡng -> "không chắc" kèm ứng viên.

import { normalizeText } from "./filters.js";
import { canonicalHeroId, normalizeHeroSlot } from "./hero-identity.js";
import { matchDict, searchDict } from "./match-dict.js";
import { toVietHanViet } from "./hanviet.js";
import { L } from "./i18n.js";
import { bookRowId } from "./lookup-ids.js";

// Chất tướng Hán -> Việt.
const STAT_MAP = {
  "智力": "Trí", "武力": "Lực", "统率": "Thống", "速度": "Tốc",
  "政治": "Chính", "魅力": "Mị", "防御": "Phòng", "攻击": "Công",
};

// Binh thư Hán: KHÔNG phải chiến pháp. Giữ làm guard phòng thủ — nếu model lỡ
// nhét binh thư vào tacticsCn thì vẫn lọc khỏi tactics. Binh thư thật map riêng
// qua booksCn -> booksDict (xem mapRead).
const NON_TACTIC_TERMS = new Set([
  "三军之众", "惜兵爱民", "统军", "锤炼", "久战", "铁甲", "防备",
  "奇正相生", "胜战", "执锐", "文韬", "分险", "蛮勇非勇",
]);
// Chữ Worker trả cho ô không đọc được (tên tướng hoặc một ô chiến pháp).
const UNKNOWN_TERMS = new Set(["未知", "不详", ""]);

/** Số tướng của một đội và số ô chiến pháp tự chọn của mỗi tướng (A/B). */
export const TEAM_SIZE = 3;
export const TACTIC_SLOT_COUNT = 2;

/** Chất tướng Hán -> Việt. '全智力' -> 'Toàn Trí'; '智力' -> 'Trí'. */
export function statFocusVn(cn) {
  let s = (cn || "").trim();
  if (!s) return "";
  let prefix = "";
  if (s.startsWith("全")) {
    prefix = "Toàn ";
    s = s.slice(1);
  }
  return (prefix + (STAT_MAP[s] || s)).trim();
}

function slugOf(name) {
  return normalizeText(name).replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
}

/** Mã chiến pháp của một tên; `idOf` (tên → mã theo danh mục) cần khi tên hiển thị đã khác tên gốc. */
function canonicalTacticId(name, idOf = null) {
  return idOf ? idOf(name) : `tactic:${slugOf(name)}`;
}

/**
 * ID canonical của một tên Việt theo loại: `hero:` (theo hero-identity, giữ tiền tố SP/CO/40Y),
 * `tactic:`, `book:`. Tên rỗng/không tạo được slug -> `null`. Chiến pháp có `idOf` (tên → mã theo danh mục,
 * `createTacticIdResolver`) thì dùng mã của danh mục thay vì slug tên. Binh thư KHÔNG BAO GIỜ suy mã từ slug tên:
 * cần `idOf` (`createBookNameIndex`, tên → `row.id` cố định), không có thì `null`.
 * @param {"hero"|"tactic"|"book"} kind
 */
export function entityId(kind, name, idOf = null) {
  if (typeof name !== "string" || !name.trim()) return null;
  if (kind === "hero") {
    try {
      return canonicalHeroId(name);
    } catch {
      return null;
    }
  }
  if (kind === "tactic" && idOf) return idOf(name) || null;
  if (kind === "book") return idOf ? idOf(name) || null : null;
  const slug = slugOf(name);
  return slug ? `${kind}:${slug}` : null;
}

/** ID canonical của một bản ghi từ điển: chiến pháp và binh thư dùng `id` của bản ghi (tên Việt có thể đã đổi), còn lại suy từ tên Việt. */
function recordEntityId(kind, record) {
  if (kind === "book") return bookRowId(record);
  if (kind === "tactic" && typeof record?.id === "string" && record.id.startsWith("tactic:") && typeof record.viet === "string" && record.viet.trim()) return record.id;
  return entityId(kind, record?.viet);
}

/**
 * Map 1 ô tên Hán -> {cn, viet, matched, confidence, sure}.
 * - matched: có khớp dict không (matched -> viet là canonical Việt; unmatched -> phiên Hán-Việt).
 * - sure: matched & confidence không thấp (sure=false -> UI gắn cờ "kiểm tra").
 */
function mapName(cn, dict, { unknownLabel = null, kind = "tactic" } = {}) {
  const raw = (cn || "").trim();
  if (unknownLabel && UNKNOWN_TERMS.has(raw)) {
    return {
      cn: raw,
      viet: unknownLabel,
      icon: "",
      matched: false,
      confidence: "low",
      sure: false,
      reviewRequired: true,
      canonicalId: null,
    };
  }
  const m = matchDict(cn, dict);
  const viet = m.matched ? m.record.viet : toVietHanViet(cn);
  return {
    cn,
    // matched -> tên Việt canonical; unmatched -> PHIÊN Hán-Việt (vd 周劭->Chu Thiệu)
    // thay vì giữ chữ Hán hoặc ép match sai. Vẫn gắn cờ sure=false để biết chưa chắc.
    viet,
    icon: m.matched ? (m.record.iconUrl || "") : "", // icon official để mắt thường xác nhận
    matched: m.matched,
    confidence: m.confidence,
    sure: m.matched && !m.reviewRequired,
    score: m.score,
    secondScore: m.secondScore,
    margin: m.margin,
    ambiguous: m.ambiguous,
    reviewRequired: m.reviewRequired,
    canonicalId:
      m.matched && kind === "hero"
        ? canonicalHeroId(viet)
        : m.matched && kind === "book"
          ? recordEntityId("book", m.record)
          : m.matched
            ? recordEntityId("tactic", { ...m.record, viet }) ?? canonicalTacticId(viet)
            : null,
  };
}

/**
 * Map 1 hero đọc được -> {hero, tactics[], books[], statFocus} đã canonical (MCP `tqccl_find_teams` với `heroes`
 * dùng qua `findSimilarTeams`). Ô `未知` không phải tên nên bị bỏ khỏi tactics/books.
 * @param read {nameCn, tacticsCn[], booksCn[], statFocusCn}
 * @param dicts {heroesDict, tacticsDict, booksDict}
 */
export function mapRead(read, { heroesDict, tacticsDict, booksDict = [] }) {
  const named = (value) => !UNKNOWN_TERMS.has((value || "").trim());
  const tactics = (read.tacticsCn || [])
    .filter((t) => named(t) && !NON_TACTIC_TERMS.has((t || "").trim()))
    .map((t) => mapName(t, tacticsDict, { kind: "tactic" }));
  const books = (read.booksCn || []).filter(named).map((b) => mapName(b, booksDict, { kind: "book" }));
  const hero = mapName(read.nameCn || "", heroesDict, {
    unknownLabel: L("Chưa rõ", "未知"),
    kind: "hero",
  });
  return {
    hero,
    tactics,
    books,
    statFocus: statFocusVn(read.statFocusCn || ""),
    // Bản zh hiển thị nguyên văn chất tướng chữ Hán đọc được.
    statFocusCn: (read.statFocusCn || "").trim(),
  };
}

/** Map cả đội. */
export function mapTeamRead(heroes, dicts) {
  return (heroes || []).map((h) => mapRead(h, dicts));
}

/* ---------- Khớp 3 trạng thái cho editor ---------- */

const compactCjk = (value) => (typeof value === "string" ? value.replace(/\s+/gu, "") : "");

/**
 * Chỉ mục một từ điển (heroesDict/tacticsDict/booksDict) theo ID canonical, kèm bảng chữ Hán
 * chính xác (`chinese` + `aliases`, bỏ khoảng trắng) để tên Giản thể in trong ảnh khớp chắc ngay
 * dù `chinese` của từ điển là Phồn thể.
 * @param {"hero"|"tactic"|"book"} kind
 */
export function createEntityIndex(dict, kind) {
  const records = (Array.isArray(dict) ? dict : []).filter((record) => recordEntityId(kind, record));
  const byId = new Map();
  const exact = new Map();
  for (const record of records) {
    const id = recordEntityId(kind, record);
    if (!byId.has(id)) byId.set(id, record);
    for (const name of [record.chinese, ...(record.aliases || [])]) {
      const key = compactCjk(name);
      if (!key) continue;
      // Một chữ Hán trỏ về hai ID khác nhau thì không còn "chắc": đánh dấu mơ hồ.
      exact.set(key, exact.has(key) && exact.get(key) !== id ? null : id);
    }
  }
  return Object.freeze({ kind, records, byId, exact });
}

/**
 * Phân loại một ô tên: `sure` (khớp chắc) | `unsure` (kèm vài ứng viên gần nhất) | `unknown`
 * (không rõ: `未知`, rỗng hoặc không có ứng viên nào).
 * @returns {{state: "sure"|"unsure"|"unknown", raw: string, id: string|null, candidates: string[]}}
 */
export function classifyName(raw, index, { candidateLimit = 3 } = {}) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (UNKNOWN_TERMS.has(text)) return { state: "unknown", raw: text, id: null, candidates: [] };
  const exactId = index.exact.get(compactCjk(text));
  if (exactId) return { state: "sure", raw: text, id: exactId, candidates: [] };
  const m = matchDict(text, index.records);
  if (m.matched && !m.reviewRequired) {
    return { state: "sure", raw: text, id: recordEntityId(index.kind, m.record), candidates: [] };
  }
  const candidates = [];
  const push = (record) => {
    const id = record ? recordEntityId(index.kind, record) : null;
    if (id && !candidates.includes(id) && candidates.length < candidateLimit) candidates.push(id);
  };
  if (m.matched) push(m.record);
  if (m.ambiguous) push(m.secondRecord);
  for (const { record } of searchDict(text, index.records, { limit: candidateLimit })) push(record);
  return candidates.length
    ? { state: "unsure", raw: text, id: null, candidates }
    : { state: "unknown", raw: text, id: null, candidates: [] };
}

/** Ô trống có chủ đích (chiến pháp/binh thư được phép; tướng thì chưa đủ). */
export function emptyCell() {
  return { state: "empty", raw: "", id: null, candidates: [] };
}

/** Ô đã chọn chắc một ID (chọn từ danh sách, ứng viên, link chia sẻ). */
export function sureCell(id, raw = "") {
  return id ? { state: "sure", raw, id, candidates: [] } : emptyCell();
}

/** Editor rỗng: 3 tướng × (2 chiến pháp + binh thư). */
export function emptyDraft() {
  return {
    heroes: Array.from({ length: TEAM_SIZE }, () => ({
      hero: emptyCell(),
      tactics: Array.from({ length: TACTIC_SLOT_COUNT }, emptyCell),
      book: emptyCell(),
    })),
  };
}

/** Số dòng chiến pháp tối đa Worker chép dưới một tướng: tự mang + 2 ô tự chọn. */
const TACTIC_ROW_LIMIT = 3;

/**
 * Dòng chiến pháp Worker chép (tự mang + đã học, theo thứ tự in) -> đúng các ô A/B đã học.
 * Bỏ dòng tự mang bằng dữ liệu tướng (`selfTacticCn` trong từ điển), không nhờ AI phân loại; tướng
 * chưa rõ mà đủ 3 dòng thì bỏ dòng đầu, vì game luôn in chiến pháp tự mang đầu tiên.
 */
function learnedTacticRows(rows, heroCell, indexes) {
  const selfTacticRaw = heroCell.id ? indexes.heroes.byId.get(heroCell.id)?.selfTacticCn : null;
  const selfTacticId = selfTacticRaw ? classifyName(selfTacticRaw, indexes.tactics).id : null;
  const selfAt = selfTacticId ? rows.findIndex((raw) => classifyName(raw, indexes.tactics).id === selfTacticId) : -1;
  if (selfAt !== -1) return rows.filter((_, index) => index !== selfAt);
  return rows.length > TACTIC_SLOT_COUNT ? rows.slice(1) : rows;
}

/**
 * Kết quả Worker (`analyzeTeamImage`) -> editor. Chiến pháp giữ đúng thứ tự in sau khi bỏ dòng tự
 * mang; thiếu dòng hoặc `未知` là "không rõ" và phải được người dùng sửa hoặc xoá trống. Binh thư lấy
 * binh thư chính (phần tử đầu); chữ AI xếp vào binh thư mà thực ra là tên chiến pháp (màn chiến báo
 * không in binh thư) được trả về hàng chiến pháp.
 * @param indexes {heroes, tactics, books} từ `createEntityIndex`
 */
export function draftFromRead(result, indexes) {
  const draft = emptyDraft();
  (result?.heroes || []).slice(0, TEAM_SIZE).forEach((read, heroIndex) => {
    const slot = draft.heroes[heroIndex];
    slot.hero = classifyName(read?.nameCn, indexes.heroes);
    const rows = (Array.isArray(read?.tacticsCn) ? read.tacticsCn : [])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .slice(0, TACTIC_ROW_LIMIT);
    const bookRaw = (read?.booksCn || []).find((value) => typeof value === "string" && value.trim())?.trim() || "";
    const bookIsTactic = Boolean(bookRaw)
      && classifyName(bookRaw, indexes.books).state !== "sure"
      && classifyName(bookRaw, indexes.tactics).state === "sure";
    if (bookIsTactic && rows.length < TACTIC_ROW_LIMIT) rows.push(bookRaw);
    const learned = learnedTacticRows(rows, slot.hero, indexes);
    slot.tactics = slot.tactics.map((_, index) => {
      const raw = learned[index] || "未知";
      // Binh thư lọt vào ô chiến pháp không bao giờ là chiến pháp: coi như không rõ.
      return NON_TACTIC_TERMS.has(raw)
        ? { state: "unknown", raw, id: null, candidates: [] }
        : classifyName(raw, indexes.tactics);
    });
    slot.book = bookRaw && !bookIsTactic ? classifyName(bookRaw, indexes.books) : emptyCell();
  });
  return draft;
}

/**
 * Kết quả Worker `analyzeTeamImage` -> `{screen, sides:[{side, heroes}]}` (left trước right); hỏng -> null.
 * Nhận cả dạng cũ `{heroes}` (Pages có thể deploy trước Worker) thành 1 phe `left`, screen "other".
 * Nhánh dạng cũ gỡ đi sau khi Worker mới đã deploy.
 */
export function normalizeTeamRead(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const isHeroList = (value) => Array.isArray(value) && value.every((hero) => hero && typeof hero === "object" && !Array.isArray(hero));
  if (!Array.isArray(data.sides)) {
    return isHeroList(data.heroes) && data.heroes.length
      ? { screen: "other", sides: [{ side: "left", heroes: data.heroes }] }
      : null;
  }
  const screen = ["battleReport", "teamDetail"].includes(data.screen) ? data.screen : "other";
  const taken = new Set();
  const sides = [];
  for (const [index, entry] of data.sides.slice(0, 2).entries()) {
    if (!entry || typeof entry !== "object" || !isHeroList(entry.heroes)) return null;
    const side = entry.side === "left" || entry.side === "right" ? entry.side : index === 0 ? "left" : "right";
    if (taken.has(side) || !entry.heroes.length) continue;
    taken.add(side);
    sides.push({ side, heroes: entry.heroes });
  }
  if (!sides.length) return null;
  return { screen, sides: sides.sort((a, b) => (a.side === "left" ? -1 : 1) - (b.side === "left" ? -1 : 1)) };
}

/** 12 ô của một editor theo thứ tự cố định: mỗi tướng = tướng, chiến pháp A/B, binh thư. */
const draftCells = (draft) => (draft?.heroes || []).flatMap((member) => [member.hero, ...member.tactics, member.book]);

/**
 * Tín hiệu lỗi ẩn danh của một lượt đọc (chỉ số đếm, không tên/ảnh): so draft ban đầu từ AI với draft
 * lúc bấm Đối chiếu, chỉ trên ô AI có chép (ô trống ban đầu người dùng tự điền — ô tướng thiếu, binh thư
 * màn chiến báo — không phải lỗi đọc). read = ô AI có chép; unclear = trong đó ô không chắc/không rõ;
 * edited = trong đó ô mà ID cuối khác ID AI đưa chắc ban đầu. Luôn có unclear ≤ read, edited ≤ read.
 */
export function readStats(initialDraft, finalDraft) {
  const after = draftCells(finalDraft);
  let read = 0;
  let edited = 0;
  let unclear = 0;
  draftCells(initialDraft).forEach((cell, index) => {
    if (cell.state === "empty") return;
    read += 1;
    if (cell.state === "unsure" || cell.state === "unknown") unclear += 1;
    const initialId = cell.state === "sure" ? cell.id : null;
    if (initialId !== (after[index]?.id || null)) edited += 1;
  });
  return { read, edited, unclear };
}

/** Đội đã xác nhận (chỉ ID canonical) -> editor toàn ô chắc/trống. */
export function draftFromTeam(team) {
  const draft = emptyDraft();
  (team?.heroes || []).slice(0, TEAM_SIZE).forEach((member, heroIndex) => {
    draft.heroes[heroIndex] = {
      hero: sureCell(member.hero),
      tactics: Array.from({ length: TACTIC_SLOT_COUNT }, (_, index) => sureCell(member.tactics?.[index] || null)),
      book: sureCell(member.book || null),
    };
  });
  return draft;
}

/**
 * Chữ người dùng gõ/chọn trong một ô -> trạng thái ô. Nhãn đúng một mục của datalist là chắc;
 * chữ tự do đi qua cùng bộ khớp như chữ Worker chép.
 * @param labels {Map<string,string>} nhãn hiển thị -> ID
 */
export function cellFromInput(text, index, labels) {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return emptyCell();
  const labeled = labels?.get(value);
  if (labeled) return sureCell(labeled, value);
  return classifyName(value, index);
}

/** Đủ điều kiện đối chiếu: 3 tướng chắc; chiến pháp/binh thư chắc hoặc để trống có chủ đích. */
export function draftReady(draft) {
  return (draft?.heroes || []).length === TEAM_SIZE && draft.heroes.every((member) =>
    member.hero.state === "sure" &&
    [...member.tactics, member.book].every((cell) => cell.state === "sure" || cell.state === "empty"),
  );
}

/** Editor đủ điều kiện -> đội canonical `{heroes:[{hero, tactics:[id|null ×2], book}]}`; chưa đủ -> null. */
export function confirmedTeam(draft) {
  if (!draftReady(draft)) return null;
  return {
    heroes: draft.heroes.map((member) => ({
      hero: member.hero.id,
      tactics: member.tactics.map((cell) => cell.id),
      book: member.book.id,
    })),
  };
}

/* ---------- Đội tham chiếu + diff từng ô ---------- */

function safeHeroSlot(value) {
  try {
    return normalizeHeroSlot(value);
  } catch {
    return { slotId: null, alternatives: [] };
  }
}

function nameEntry(kind, name, alternatives = [], raw = "", idOf = null) {
  const names = [name, ...alternatives].filter((value) => typeof value === "string" && value.trim());
  const ids = names.map((value) => entityId(kind, value, idOf)).filter(Boolean);
  if (ids.length) return { ids, name, raw: typeof raw === "string" ? raw : "" };
  // Tên binh thư không tra được id (không có trong từ điển) vẫn là ô đội ghi: ô tồn tại nhưng không id nào khớp,
  // để đối chiếu báo lệch thay vì coi như đội không ghi binh thư.
  return kind === "book" && names.length ? { ids: [], name, raw: typeof raw === "string" ? raw : "" } : null;
}

const referenceCache = new WeakMap();

/**
 * Chuẩn hoá một đội tham chiếu về cùng dạng ô: bản ghi Đội chuẩn (`heroes[].displayNameVi`,
 * `tacticSlotsVi`, `bookSlotsVi`), Đội khác (`legacyContent.heroes`) hoặc đội gốc (`heroes[].name`).
 * Chiến pháp/binh thư mang `alternatives` được tính là cùng một ô.
 */
export function referenceTeam(record, tacticIdOf = null, bookIdOf = null) {
  if (record && typeof record === "object") {
    const cached = referenceCache.get(record);
    if (cached?.tacticIdOf === tacticIdOf && cached?.bookIdOf === bookIdOf) return cached.team;
  }
  const heroes = Array.isArray(record?.legacyContent?.heroes) ? record.legacyContent.heroes : record?.heroes || [];
  const slots = heroes.map((hero) => {
    if (typeof hero?.displayNameVi === "string" && Array.isArray(hero.tacticSlotsVi)) {
      const slot = safeHeroSlot(hero.displayNameVi);
      return {
        alternatives: slot.alternatives,
        name: hero.displayNameVi,
        raw: hero.nameRaw || "",
        tactics: hero.tacticSlotsVi
          .map((name, index) => nameEntry("tactic", name, [], hero.tacticSlotsRaw?.[index], tacticIdOf))
          .filter(Boolean),
        book: nameEntry("book", hero.bookSlotsVi?.[0], [], hero.bookSlotsRaw?.[0], bookIdOf),
      };
    }
    const slot = safeHeroSlot(hero);
    const book = hero?.books?.[0];
    return {
      alternatives: slot.alternatives,
      name: slot.alternatives[0]?.displayName || hero?.name || "",
      raw: "",
      tactics: (hero?.tactics || [])
        .map((tactic) => nameEntry("tactic", tactic?.name, tactic?.alternatives || [], "", tacticIdOf))
        .filter(Boolean),
      book: book ? nameEntry("book", book.name, book.alternatives || [], "", bookIdOf) : null,
    };
  });
  const team = { slots };
  if (record && typeof record === "object") referenceCache.set(record, { tacticIdOf, bookIdOf, team });
  return team;
}

/**
 * Ghép tướng đọc được vào ô tướng của đội tham chiếu: tối đa số tướng khớp; hoà thì lấy cách ghép
 * có điểm `pairScore(heroIndex, slotIndex)` cao hơn (diff dùng số chiến pháp khớp). Trả
 * `[{readHeroId, heroIndex, slotIndex}]`.
 */
function matchReadHeroesToSlots(readHeroes, slots, pairScore = () => 0) {
  const heroes = [...readHeroes];
  let best = [];
  let bestScore = -1;
  function visit(heroIndex, usedSlots, matches, score) {
    if (heroIndex >= heroes.length) {
      if (matches.length > best.length || (matches.length === best.length && score > bestScore)) {
        best = matches;
        bestScore = score;
      }
      return;
    }
    visit(heroIndex + 1, usedSlots, matches, score);
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
      if (usedSlots.has(slotIndex)) continue;
      if (
        !slots[slotIndex].alternatives.some(
          ({ canonicalId }) => canonicalId === heroes[heroIndex],
        )
      ) {
        continue;
      }
      visit(
        heroIndex + 1,
        new Set([...usedSlots, slotIndex]),
        [
          ...matches,
          { readHeroId: heroes[heroIndex], heroIndex, slotIndex },
        ],
        score + pairScore(heroIndex, slotIndex),
      );
    }
  }
  visit(0, new Set(), [], 0);
  return best;
}

const tacticHitsFor = (tactics, slot) =>
  tactics.filter((id) => id && slot.tactics.some((entry) => entry.ids.includes(id))).length;

/**
 * Diff từng ô giữa đội đã xác nhận và một đội tham chiếu.
 * - heroes[i].status: `match` (tướng có trong đội) | `extra` (thừa, đội không có).
 * - heroes[i].tactics[j].status: `match` | `wrong` (tướng khớp nhưng đội không dùng) | `empty` |
 *   `unchecked` (tướng thừa nên không so).
 * - heroes[i].missingTactics: chiến pháp đội dùng cho tướng đó mà người dùng không có.
 * - heroes[i].book.status: `match` | `mismatch` | `missing` (đội có, người dùng để trống) | `none`
 *   (đội không ghi binh thư) | `unchecked`.
 * - missingHeroes: ô tướng của đội không ai khớp.
 */
export function diffTeam(team, record, tacticIdOf = null, bookIdOf = null) {
  const reference = referenceTeam(record, tacticIdOf, bookIdOf);
  const members = team?.heroes || [];
  const matches = matchReadHeroesToSlots(
    members.map((member) => member.hero),
    reference.slots,
    (heroIndex, slotIndex) => tacticHitsFor(members[heroIndex].tactics || [], reference.slots[slotIndex]),
  );
  let tacticHit = 0;
  let bookDiff = 0;
  const heroes = members.map((member, heroIndex) => {
    const match = matches.find((item) => item.heroIndex === heroIndex);
    const tactics = member.tactics || [];
    if (!match) {
      return {
        hero: member.hero,
        status: "extra",
        tactics: tactics.map((id) => ({ id, status: id ? "unchecked" : "empty" })),
        missingTactics: [],
        book: { id: member.book || null, status: "unchecked", expected: null },
      };
    }
    const slot = reference.slots[match.slotIndex];
    const cells = tactics.map((id) => {
      if (!id) return { id: null, status: "empty" };
      const hit = slot.tactics.some((entry) => entry.ids.includes(id));
      if (hit) tacticHit++;
      return { id, status: hit ? "match" : "wrong" };
    });
    const missingTactics = slot.tactics.filter((entry) => !tactics.some((id) => id && entry.ids.includes(id)));
    const book = !slot.book
      ? { id: member.book || null, status: "none", expected: null }
      : !member.book
        ? { id: null, status: "missing", expected: slot.book }
        : { id: member.book, status: slot.book.ids.includes(member.book) ? "match" : "mismatch", expected: slot.book };
    if (book.status === "missing" || book.status === "mismatch") bookDiff++;
    return { hero: member.hero, status: "match", slotIndex: match.slotIndex, tactics: cells, missingTactics, book };
  });
  const missingHeroes = reference.slots
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .filter(({ slotIndex }) => !matches.some((item) => item.slotIndex === slotIndex))
    .map(({ slot }) => ({ id: slot.alternatives[0]?.canonicalId || null, name: slot.name, raw: slot.raw }));
  return {
    heroHit: matches.length,
    heroTotal: reference.slots.length,
    tacticHit,
    tacticTotal: reference.slots.reduce((total, slot) => total + slot.tactics.length, 0),
    bookDiff,
    heroes,
    missingHeroes,
  };
}

/**
 * Đối chiếu đội đã xác nhận với danh sách đội tham chiếu: giữ đội có ≥ `minHeroes` tướng khớp,
 * xếp theo số tướng khớp rồi số chiến pháp khớp; hoà giữ thứ tự nguồn (thứ tự tier của danh sách).
 * @returns {{record: object, diff: ReturnType<typeof diffTeam>}[]}
 */
export function compareTeams(team, records, { minHeroes = 2, limit = 5, tacticIdOf = null, bookIdOf = null } = {}) {
  return (records || [])
    .map((record, order) => ({ record, order, diff: diffTeam(team, record, tacticIdOf, bookIdOf) }))
    .filter(({ diff }) => diff.heroHit >= minHeroes)
    .sort((a, b) => b.diff.heroHit - a.diff.heroHit || b.diff.tacticHit - a.diff.tacticHit || a.order - b.order)
    .slice(0, limit)
    .map(({ record, diff }) => ({ record, diff }));
}

/** Tên tướng (normalize) của 1 team trong teams.json. */
function teamHeroSlots(team) {
  return (team.heroes || []).map(normalizeHeroSlot);
}

/**
 * Đối chiếu đội đọc được với kho đội (MCP `tqccl_find_teams` với `heroes`). Đếm số tướng trùng (canonical, đã
 * normalize); tie-break theo số chiến pháp trùng. Trả top `limit` team đạt ngưỡng.
 * @param mapped kết quả mapTeamRead
 */
export function findSimilarTeams(mapped, teams, { minHeroes = 2, limit = 5, tacticIdOf = null } = {}) {
  // [M1] Mẫu số là số tướng nhận diện được (matched) — tên Hán không khớp không vào mẫu số.
  const recognized = new Set(
    mapped
      .filter((item) => item.hero.matched && item.hero.canonicalId)
      .map((item) => item.hero.canonicalId),
  );
  // Chỉ tướng chắc chắn mới được tính khớp: khớp mơ hồ (`sure: false`) cần người dùng kiểm lại, nên
  // vẫn nằm trong mẫu số nhưng không tạo điểm khớp. Bản ghi canonical đã xác nhận (MCP
  // `tqccl_find_teams` với `heroes`) không mang cờ `sure` và được coi là chắc chắn.
  const identified = mapped.filter(
    (item) =>
      item.hero.matched &&
      item.hero.sure !== false &&
      item.hero.canonicalId &&
      item.hero.reviewRequired !== true,
  );
  const readHeroes = new Set(identified.map((item) => item.hero.canonicalId));
  const readTacticsByHolder = new Set(
    identified.flatMap((item) =>
      item.tactics
        .filter(
          (tactic) =>
            tactic.matched &&
            tactic.canonicalId &&
            tactic.reviewRequired !== true,
        )
        .map((tactic) => `${item.hero.canonicalId}|${tactic.canonicalId}`),
    ),
  );
  if (readHeroes.size === 0) return [];

  const scored = [];
  for (const team of teams) {
    const slots = teamHeroSlots(team);
    const heroMatches = matchReadHeroesToSlots(readHeroes, slots);
    const heroHit = heroMatches.length;
    if (heroHit < minHeroes) continue;

    const tTacticsByHolder = new Set(
      (team.heroes || []).flatMap((hero, index) =>
        (hero.tactics || []).flatMap((tactic) => {
          const holder = heroMatches.find(({ slotIndex }) => slotIndex === index);
          if (!holder) return [];
          return [tactic.name, ...(tactic.alternatives || [])].map(
            (name) => `${holder.readHeroId}|${canonicalTacticId(name, tacticIdOf)}`,
          );
        }),
      ),
    );
    let tacticHit = 0;
    for (const tactic of readTacticsByHolder) {
      if (tTacticsByHolder.has(tactic)) tacticHit++;
    }

    scored.push({ team, heroHit, tacticHit, total: recognized.size });
  }
  scored.sort(
    (a, b) =>
      b.heroHit - a.heroHit ||
      b.tacticHit - a.tacticHit ||
      String(a.team.id || "").localeCompare(String(b.team.id || "")),
  );
  return scored.slice(0, limit);
}
