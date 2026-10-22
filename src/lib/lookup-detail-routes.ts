// Slug đóng băng của trang riêng từng mục Tra cứu (`/tra-cuu/<nhóm>/<slug>/`). Ledger do
// `pipeline/lookup_route_handles.py` gán một lần theo id; loader này chỉ kiểm đúng tập khoá = id của corpus
// build rồi đưa ra tra xuôi/ngược, không bao giờ suy slug từ tên.
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import type { LOOKUP_GROUP_SLUGS } from '../../js/lookup-ids.js';
import { lookupDetailPath, parseLookupDetailLedger } from '../../js/lookup-detail-ledger.js';

export const DEFAULT_LOOKUP_HANDLES_PATH = join(process.cwd(), 'pipeline/lookup-route-handles.json');

export type LookupRouteGroup = keyof typeof LOOKUP_GROUP_SLUGS;


export interface LookupDetailRoute {
  id: string;
  group: LookupRouteGroup;
  slug: string;
  /** Đường dẫn bản Việt, chưa gắn tiền tố ngôn ngữ. */
  path: string;
}

export interface LookupDetailRoutes {
  entries: LookupDetailRoute[];
  byId: Map<string, LookupDetailRoute>;
  /** Ledger khác quy tắc "slug = hậu tố mã" ở những mục này (`id → slug`); hiện rỗng. Đây là bảng trình duyệt cần. */
  exceptions: Record<string, string>;
}

// Phần parse thuần nằm ở `js/lookup-detail-ledger.js` để builder của mcp-worker dùng chung, không có parser thứ hai.
export { lookupDetailPath, parseLookupDetailLedger };

async function readRegularFile(path: string) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Lookup route ledger is not a regular file: ${path}`);
  return readFile(await realpath(path));
}

export interface LookupDetailRoutesOptions {
  /** Gốc dự án khác mặc định (verifier): ledger, publication và `books-dict` đều đọc từ đó. */
  rootDir?: string;
  manifest?: readonly unknown[];
  handlesPath?: string;
  /** Mặc định: id của `lookupBuildCorpus()` (publication của build). */
  corpusIds?: Record<string, string[]>;
  pins?: { generationId?: string; booksSha256?: string };
}

let defaultRoutes: Promise<LookupDetailRoutes> | undefined;

async function load({ rootDir, manifest, handlesPath = rootDir ? join(rootDir, 'pipeline/lookup-route-handles.json') : DEFAULT_LOOKUP_HANDLES_PATH, corpusIds, pins }: LookupDetailRoutesOptions) {
  const raw = JSON.parse((await readRegularFile(handlesPath)).toString('utf8'));
  if (corpusIds) return parseLookupDetailLedger(raw, corpusIds, pins);
  const [{ lookupBuildCorpus }, { lookupPublicationSnapshot, lookupBooksHash }] = await Promise.all([
    import('./lookup-pages.ts'),
    import('./root-static-artifacts.ts'),
  ]);
  const source = { rootDir, manifest } as Parameters<typeof lookupBooksHash>[0];
  const [corpus, snapshot, booksHash] = await Promise.all([
    lookupBuildCorpus(source as Parameters<typeof lookupBuildCorpus>[0]),
    lookupPublicationSnapshot(source),
    lookupBooksHash(source),
  ]);
  const ids = Object.fromEntries(Object.entries(corpus.groups).map(([group, rows]) => [group, rows.map((row) => row.id)]));
  return parseLookupDetailLedger(raw, ids, { generationId: snapshot.manifest.generationId, booksSha256: booksHash.replace(/^sha256:/, ''), ...pins });
}

/** Routes of every lookup item; the default (build corpus + frozen ledger) is memoized per build. */
export function lookupDetailRoutes(options: LookupDetailRoutesOptions = {}) {
  if (Object.keys(options).length) return load(options);
  defaultRoutes ??= load({});
  return defaultRoutes;
}
