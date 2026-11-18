// Dữ liệu tên cho trang Đội cộng đồng: nạp từ điển tướng/chiến pháp (đã xác minh sha256 qua manifest Tra cứu),
// nhãn theo locale, chỉ mục id và datalist. Server chỉ lưu id nên mọi tên hiển thị đi qua đây.

import { classifyName, createEntityIndex } from './analyze-map.js';
import { heroFamilyId } from './hero-identity.js';
import { L, currentLocale, normalizeLocale, pick } from './i18n.js';
import { heroPortrait } from './hero-portrait.js';
import { createLookupPayloadLoader } from './lookup-data.js';
import { createTacticIdResolver } from './lookup-ids.js';
import { el } from './render.js';
import { createByteLoader, loadRawNameResolver, localRawName, localRecordName, readLookupJaPin } from './website-display.js';

let dictionaries = null;
let booksDictionary = null;
/**
 * Bản ja: bộ tra tên Nhật (tên theo mã, tự dạng Nhật cho chữ Hán thô) nạp cùng từ điển ở trang có pin `#lookup-ja-pin`; bản
 * khác `null` (nhãn bản Trung là chữ Hán nguồn nguyên văn). Nhãn tướng/chiến pháp/mùa của mọi trang cộng đồng đọc qua đây.
 */
let localNames = null;

/** Từ điển tướng + chiến pháp; một lần tải cho cả trang, lỗi thì lần gọi sau tải lại. */
export function loadTeamDictionaries(loadBytes = createByteLoader()) {
  if (!dictionaries) {
    const loadPayload = createLookupPayloadLoader(loadBytes);
    // Lớp tên Nhật lỗi thì nhãn lùi về chữ Hán nguồn, trang vẫn chạy.
    const names = readLookupJaPin() ? loadRawNameResolver(loadBytes).catch((error) => { console.error(error); return null; }) : null;
    const pending = Promise.all([loadPayload('heroes-dict.json'), loadPayload('tactics.json'), names])
      .then(([heroes, tactics, resolver]) => {
        localNames = resolver;
        return { heroes, tactics };
      });
    dictionaries = pending;
    pending.catch(() => { if (dictionaries === pending) dictionaries = null; });
  }
  return dictionaries;
}

/**
 * Từ điển binh thư (`data/books-dict.json`, ngoài lookup manifest) qua cùng bộ nạp byte; chỉ form đăng đội cần
 * để `draftFromRead` phân biệt binh thư với chiến pháp trùng tên. Lỗi thì lần gọi sau tải lại.
 */
export function loadTeamBooks(loadBytes = createByteLoader()) {
  if (!booksDictionary) {
    const pending = loadBytes('data/books-dict.json').then((bytes) => {
      const books = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!Array.isArray(books)) throw new Error('books-dict không hợp lệ');
      return books;
    });
    booksDictionary = pending;
    pending.catch(() => { if (booksDictionary === pending) booksDictionary = null; });
  }
  return booksDictionary;
}

/**
 * Nhãn hiển thị của một mục từ điển: bản Việt tên Việt, bản Trung chữ Hán gốc, bản Nhật tên Nhật theo mã (sau khi
 * `loadTeamDictionaries` nạp xong; trước đó chữ Hán gốc). Thiếu chữ Hán thì lùi về tên Việt.
 */
export function recordLabel(record, locale = currentLocale(), names = localNames) {
  return localRecordName(record, names, locale);
}

/**
 * Bộ tra tên theo id cho một locale. Id lạ (không có trong từ điển) hiện thô để không mất thông tin.
 * Chiến pháp đổi id (`formerIds`) được dẫn về id hiện hành qua `createTacticIdResolver`.
 * @param {{heroes?: unknown[], tactics?: unknown[], books?: unknown[], names?: unknown}} [dictionaries] từ điển JSON đã parse;
 *   `names` là bộ tra tên của bản ja (lúc build: `lookupJaNameResolver()`), vắng thì dùng bộ đã nạp cùng `loadTeamDictionaries`.
 * @param {string} [locale]
 */
export function createTeamLexicon({ heroes = [], tactics = [], books = [], names = localNames } = {}, locale = currentLocale()) {
  const indexes = Object.freeze({
    heroes: createEntityIndex(heroes, 'hero'),
    tactics: createEntityIndex(tactics, 'tactic'),
    books: createEntityIndex(books, 'book'),
  });
  const tacticIdOf = createTacticIdResolver(tactics);
  const heroRecord = (id) => indexes.heroes.byId.get(id) ?? null;
  const tacticRecord = (id) => {
    const direct = indexes.tactics.byId.get(id);
    if (direct) return direct;
    const slug = String(id).replace(/^tactic:/u, '');
    return indexes.tactics.byId.get(tacticIdOf(slug)) ?? null;
  };
  const labelsOf = (index) => {
    const labels = new Map();
    for (const [id, record] of index.byId) {
      const label = recordLabel(record, locale, names);
      if (label && !labels.has(label)) labels.set(label, id);
    }
    return labels;
  };
  return Object.freeze({
    locale,
    indexes,
    heroRecord,
    tacticRecord,
    heroName: (id) => recordLabel(heroRecord(id), locale, names) || String(id),
    tacticName: (id) => recordLabel(tacticRecord(id), locale, names) || String(id),
    heroLabels: labelsOf(indexes.heroes),
    tacticLabels: labelsOf(indexes.tactics),
  });
}

/** `<datalist>` nhãn → id đã sắp theo nhãn, dùng chung cho các ô nhập tướng/chiến pháp. */
export function datalistOptions(labels, locale = currentLocale()) {
  const collation = normalizeLocale(locale);
  return [...labels.keys()].sort((a, b) => a.localeCompare(b, collation));
}

/** Nhãn binh chủng theo locale. */
export function troopLabel(troop) {
  switch (troop) {
    case 'cung': return L('Cung', '弓', '弓');
    case 'khiGioi': return L('Khí giới', '器械', '器械');
    case 'ky': return L('Kỵ', '骑', '騎');
    case 'thuan': return L('Thuẫn', '盾', '盾');
    case 'thuong': return L('Thương', '枪', '槍');
    default: return String(troop ?? '');
  }
}

/** Nhãn mùa theo locale. */
export function seasonLabel(season, locale = currentLocale()) {
  if (!season) return '';
  const source = typeof season.labelZh === 'string' && season.labelZh ? localRawName(season.labelZh, localNames, locale) : season.labelZh;
  return pick(locale, season.labelVi, season.labelZh, source) || season.labelVi || season.labelZh || String(season.id ?? '');
}

/** Ô tướng: chân dung + tên theo locale. `lexicon` null (từ điển chưa tải) → chỉ hiện id thô. */
export function heroBadge(lexicon, id) {
  const record = lexicon?.heroRecord(id) ?? null;
  return el('span', { class: 'cm-team-hero', dataset: { heroId: id } }, [
    record
      ? heroPortrait({ chinese: record.chinese, nameVi: record.viet, iconUrl: record.iconUrl, className: 'cm-team-portrait', alt: '' })
      : null,
    el('span', { class: 'cm-team-hero-name' }, lexicon ? lexicon.heroName(id) : String(id)),
  ]);
}

/** Gốc tướng (bỏ tiền tố SP/CO/40Y) của một id trong từ điển; id lạ → `null`. */
function familyOf(lexicon, id) {
  const viet = lexicon.heroRecord(id)?.viet;
  try {
    return viet ? heroFamilyId(viet) : null;
  } catch {
    return null;
  }
}

/**
 * Đổi tên tướng đã lưu dạng chữ (chiến báo: chữ Hán AI đọc hoặc chữ người gửi gõ) sang tên hiển thị theo locale
 * bằng chỉ mục từ điển có sẵn (`classifyName`: khớp chữ Hán/bí danh rồi so gần đúng). Chỉ đổi khi khớp chắc;
 * tên không tra được giữ nguyên chữ gốc.
 *
 * `preferIds` (tướng của đội, vd. `team.heroes`): ảnh chiến báo không phân biệt bản SP với bản thường (cùng chữ Hán),
 * nên tên phía "đội ta" (`side === 'ally'`) khớp bản thường mà đội có bản cùng gốc thì lấy id của đội.
 * Phía đối thủ giữ kết quả tra thẳng.
 */
export function heroNameResolver(lexicon, { preferIds = [] } = {}) {
  const cache = new Map();
  const preferred = new Map();
  if (lexicon) {
    for (const id of preferIds) {
      const family = familyOf(lexicon, id);
      if (family && !preferred.has(family)) preferred.set(family, id);
    }
  }
  return (raw, side = '') => {
    const text = String(raw ?? '').trim();
    if (!text || !lexicon) return text;
    const key = `${side === 'ally' ? 'ally' : 'other'}\u0000${text}`;
    if (!cache.has(key)) {
      const cell = classifyName(text, lexicon.indexes.heroes);
      let id = cell.state === 'sure' ? cell.id : null;
      if (id && side === 'ally') id = preferred.get(familyOf(lexicon, id)) ?? id;
      cache.set(key, id ? lexicon.heroName(id) : text);
    }
    return cache.get(key);
  };
}

/** Tên chiến pháp theo locale; `lexicon` null → id thô. */
export function tacticName(lexicon, id) {
  return lexicon ? lexicon.tacticName(id) : String(id);
}
