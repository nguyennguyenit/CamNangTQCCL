// Dữ liệu tên cho trang Đội cộng đồng: nạp từ điển tướng/chiến pháp (đã xác minh sha256 qua manifest Tra cứu),
// nhãn theo locale, chỉ mục id và datalist. Server chỉ lưu id nên mọi tên hiển thị đi qua đây.

import { createEntityIndex } from './analyze-map.js';
import { L, currentLocale } from './i18n.js';
import { heroPortrait } from './hero-portrait.js';
import { createLookupPayloadLoader } from './lookup-data.js';
import { createTacticIdResolver } from './lookup-ids.js';
import { el } from './render.js';
import { createByteLoader } from './website-display.js';

let dictionaries = null;
let booksDictionary = null;

/** Từ điển tướng + chiến pháp; một lần tải cho cả trang, lỗi thì lần gọi sau tải lại. */
export function loadTeamDictionaries(loadBytes = createByteLoader()) {
  if (!dictionaries) {
    const loadPayload = createLookupPayloadLoader(loadBytes);
    const pending = Promise.all([loadPayload('heroes-dict.json'), loadPayload('tactics.json')])
      .then(([heroes, tactics]) => ({ heroes, tactics }));
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

/** Nhãn hiển thị của một mục từ điển: bản Việt tên Việt, bản Trung chữ Hán gốc (lùi về tên Việt khi thiếu). */
export function recordLabel(record, locale = currentLocale()) {
  if (!record) return '';
  return locale === 'zh' ? String(record.chinese || '').trim() || record.viet || '' : record.viet || '';
}

/**
 * Bộ tra tên theo id cho một locale. Id lạ (không có trong từ điển) hiện thô để không mất thông tin.
 * Chiến pháp đổi id (`formerIds`) được dẫn về id hiện hành qua `createTacticIdResolver`.
 */
export function createTeamLexicon({ heroes = [], tactics = [], books = [] } = {}, locale = currentLocale()) {
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
      const label = recordLabel(record, locale);
      if (label && !labels.has(label)) labels.set(label, id);
    }
    return labels;
  };
  return Object.freeze({
    locale,
    indexes,
    heroRecord,
    tacticRecord,
    heroName: (id) => recordLabel(heroRecord(id), locale) || String(id),
    tacticName: (id) => recordLabel(tacticRecord(id), locale) || String(id),
    heroLabels: labelsOf(indexes.heroes),
    tacticLabels: labelsOf(indexes.tactics),
  });
}

/** `<datalist>` nhãn → id đã sắp theo nhãn, dùng chung cho các ô nhập tướng/chiến pháp. */
export function datalistOptions(labels, locale = currentLocale()) {
  return [...labels.keys()].sort((a, b) => a.localeCompare(b, locale === 'zh' ? 'zh' : 'vi'));
}

/** Nhãn binh chủng theo locale. */
export function troopLabel(troop) {
  switch (troop) {
    case 'cung': return L('Cung', '弓');
    case 'khiGioi': return L('Khí giới', '器械');
    case 'ky': return L('Kỵ', '骑');
    case 'thuan': return L('Thuẫn', '盾');
    case 'thuong': return L('Thương', '枪');
    default: return String(troop ?? '');
  }
}

/** Nhãn mùa theo locale. */
export function seasonLabel(season, locale = currentLocale()) {
  if (!season) return '';
  return (locale === 'zh' ? season.labelZh : season.labelVi) || season.labelVi || season.labelZh || String(season.id ?? '');
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

/** Tên chiến pháp theo locale; `lexicon` null → id thô. */
export function tacticName(lexicon, id) {
  return lexicon ? lexicon.tacticName(id) : String(id);
}
