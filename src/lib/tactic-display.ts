/**
 * Bảng tên chiến pháp hiển thị của bản Việt: tên lưu trong dữ liệu đội (Việt cũ / Hán-Việt) → `viet` hiện hành của danh
 * mục Tra cứu. Tính một lần lúc build từ đúng các file đã pin của website-display publication, chỉ giữ tên thật sự đổi.
 * Bản dựng sẵn (SSR) và trình duyệt dùng cùng bảng: trang nhúng `#tactic-display-names` nên trình duyệt không phải tải
 * `data/tactics.json` chỉ để đổi tên, và DOM dựng lại khớp DOM dựng sẵn.
 */
import { createTacticDisplayName, createTacticDisplayTable } from '../../js/lookup-ids.js';
import { setTacticDisplayName } from '../../js/recommended-reference-state.js';
import { websiteDisplayPublicationSnapshot } from './root-static-artifacts.ts';

/** Nguồn có tên chiến pháp hiển thị ở trang đội/Khai hoang/Cùng Tồn và generation Đội chuẩn đang pin. */
const TEAM_SOURCES = ['teams.json', 'khaihoang.json', 'coexist.json'];
const MAX_NAME_LENGTH = 80;

let tablePromise: Promise<Record<string, string>> | undefined;

/** Bảng `{tên lưu: tên hiển thị}` (sắp theo khóa) và đăng ký bộ đổi tên cho builder dùng chung lúc build. */
export function tacticDisplayTable(): Promise<Record<string, string>> {
  tablePromise ??= (async () => {
    const snapshot = await websiteDisplayPublicationSnapshot();
    const parse = (bytes: Uint8Array) => JSON.parse(Buffer.from(bytes).toString('utf8'));
    const tacticsBytes = snapshot.publicFiles['tactics.json'];
    if (!tacticsBytes) throw new Error('Tactic display table needs tactics.json in the website display publication');
    const display = createTacticDisplayName(parse(tacticsBytes));
    const documents = [
      ...TEAM_SOURCES.map((name) => snapshot.publicFiles[name]).filter(Boolean).map(parse),
      ...Object.entries(snapshot.recommended.files).filter(([name]) => name.endsWith('.json')).map(([, bytes]) => parse(bytes)),
    ];
    const table = new Map<string, string>();
    const seen = new Set<string>();
    const visit = (value: unknown): void => {
      if (typeof value === 'string') {
        const text = value.trim();
        if (!text || text.length > MAX_NAME_LENGTH || seen.has(text)) return;
        seen.add(text);
        const shown = display(text);
        if (typeof shown === 'string' && shown !== text) table.set(text, shown);
      } else if (Array.isArray(value)) {
        value.forEach(visit);
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(visit);
      }
    };
    documents.forEach(visit);
    const sorted = Object.fromEntries([...table].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    setTacticDisplayName(createTacticDisplayTable(sorted));
    return sorted;
  })();
  return tablePromise;
}
