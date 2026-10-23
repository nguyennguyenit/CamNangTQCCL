// Suy ID canonical của món kho local (`{name, confidence}`, không có `canonicalId`) để đồng bộ lên `/api/roster`.
// Cùng quy tắc với engine (`js/team-recommend-engine.js` canonicalOwnedHero/Tactic), nhưng SAU ĐÓ kiểm ID có trong
// từ điển: `canonicalHeroId` và `createTacticIdResolver` không kiểm từ điển (tên lạ vẫn ra `hero:<slug>`), còn tên chỉ
// có chữ Hán thì `canonicalHeroId` ném lỗi. Món không qua kiểm trả `null` ("chỉ có trên máy này", không được đẩy).

import { canonicalHeroId } from "./hero-identity.js";
import { createTacticIdResolver } from "./lookup-ids.js";

const displayName = (item) => (typeof item === "string" ? item : item?.name);
const dictById = (rows, prefix) =>
  new Map((Array.isArray(rows) ? rows : []).filter((row) => typeof row?.id === "string" && row.id.startsWith(prefix)).map((row) => [row.id, row]));

/** @param dicts {heroesDict, tacticsDict} (dữ liệu `heroes-dict`/`tactics`) */
export function createRosterIdResolver({ heroesDict, tacticsDict }) {
  const heroById = dictById(heroesDict, "hero:");
  const tacticById = dictById(tacticsDict, "tactic:");
  const tacticIdOf = createTacticIdResolver(tacticsDict);

  /** ID theo engine (chưa kiểm từ điển) hoặc `null` khi tên không suy được (vd. chỉ chữ Hán). */
  function engineId(type, item) {
    if (typeof item === "object" && typeof item?.canonicalId === "string" && item.canonicalId) return item.canonicalId;
    const name = displayName(item);
    if (typeof name !== "string" || !name.trim()) return null;
    try {
      return type === "tactics" ? tacticIdOf(name) : canonicalHeroId(name);
    } catch {
      return null;
    }
  }

  const rows = (type) => (type === "tactics" ? tacticById : heroById);

  return {
    /** `{id, name}` với tên Việt chuẩn của hàng từ điển, hoặc `null` khi ID không có trong từ điển. */
    item(type, item) {
      const id = engineId(type, item);
      const row = id ? rows(type).get(id) : null;
      const name = typeof row?.viet === "string" ? row.viet.trim() : "";
      return row && name ? { id, name } : null;
    },
    /**
     * ID luôn có giá trị, ổn định theo tên (kể cả ngoài từ điển) cho khóa đội khóa: `lockedTeamKey` phải giống nhau
     * giữa các máy dù từ điển lệch phiên bản. Tên không suy được dùng `raw:<tên>`.
     */
    looseId(type, name) {
      return engineId(type, name) ?? `raw:${String(displayName(name) ?? "").trim()}`;
    },
  };
}
