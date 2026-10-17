// Slug đóng băng của trang riêng từng mục Tra cứu (`/tra-cuu/<nhóm>/<slug>/`). Ledger do
// `pipeline/lookup_route_handles.py` gán một lần theo id; loader này chỉ kiểm đúng tập khoá = id của corpus
// build rồi đưa ra tra xuôi/ngược, không bao giờ suy slug từ tên.
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { LOOKUP_GROUP_SLUGS, lookupDerivedSlug } from '../../js/lookup-ids.js';

export const DEFAULT_LOOKUP_HANDLES_PATH = join(process.cwd(), 'pipeline/lookup-route-handles.json');

export type LookupRouteGroup = keyof typeof LOOKUP_GROUP_SLUGS;

const LEDGER_SCHEMA_VERSION = 1;
const LEDGER_KEYS = ['booksSha256', 'generationId', 'handles', 'handlesSha256', 'note', 'retired', 'schemaVersion'];
const SLUG_SHAPE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

export const lookupDetailPath = (group: LookupRouteGroup, slug: string) => `/tra-cuu/${LOOKUP_GROUP_SLUGS[group]}/${encodeURIComponent(slug)}/`;

const plainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Canonical JSON khớp `handles_digest` của Python: khoá sắp theo thứ tự code point, không khoảng trắng. */
function canonicalJson(value: unknown): string {
  if (plainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Exact key-set comparison that names the keys which are missing or no longer in the corpus. */
function exactKeySet(actual: string[], expected: string[], label: string) {
  const have = new Set(actual);
  const want = new Set(expected);
  const missing = expected.filter((key) => !have.has(key));
  const unknown = actual.filter((key) => !want.has(key));
  if (missing.length || unknown.length) {
    throw new Error(`${label}: missing ${JSON.stringify(missing.slice(0, 5))} (${missing.length}), unknown ${JSON.stringify(unknown.slice(0, 5))} (${unknown.length})`);
  }
}

/**
 * Kiểm ledger đã parse với id của corpus (`{nhóm: [id…]}`): schema, đúng 7 nhóm, đúng tập id, slug đúng dạng và
 * duy nhất trong nhóm, `handlesSha256` (phủ `handles` + `retired`) khớp (bắt sửa tay). `retired` (id đã rời corpus,
 * slug còn giữ chỗ) không tạo route nhưng slug của nó không được trùng slug đang dùng. `generationId`/`booksSha256`
 * (nếu truyền) phải khớp pin.
 */
export function parseLookupDetailLedger(
  raw: unknown,
  corpusIds: Record<string, string[]>,
  pins: { generationId?: string; booksSha256?: string } = {},
): LookupDetailRoutes {
  const label = 'lookup route ledger';
  if (!plainObject(raw)) throw new Error(`${label} must be an object`);
  exactKeySet(Object.keys(raw), LEDGER_KEYS, `${label} keys`);
  if (raw.schemaVersion !== LEDGER_SCHEMA_VERSION) throw new Error(`${label} schemaVersion must be ${LEDGER_SCHEMA_VERSION}`);
  if (pins.generationId !== undefined && raw.generationId !== pins.generationId) throw new Error(`${label} generationId does not match the lookup publication`);
  if (pins.booksSha256 !== undefined && raw.booksSha256 !== pins.booksSha256) throw new Error(`${label} booksSha256 does not match books-dict`);
  const { handles, retired } = raw;
  if (!plainObject(handles)) throw new Error(`${label} handles must be an object`);
  if (!plainObject(retired)) throw new Error(`${label} retired must be an object`);
  const groups = Object.keys(LOOKUP_GROUP_SLUGS) as LookupRouteGroup[];
  exactKeySet(Object.keys(handles), groups, `${label} groups`);
  exactKeySet(Object.keys(retired), groups, `${label} retired groups`);
  exactKeySet(Object.keys(corpusIds), groups, 'lookup corpus groups');
  const digest = createHash('sha256').update(canonicalJson({ handles, retired }), 'utf8').digest('hex');
  if (raw.handlesSha256 !== digest) throw new Error(`${label} handlesSha256 does not match handles and retired`);

  const entries: LookupDetailRoute[] = [];
  const byId = new Map<string, LookupDetailRoute>();
  for (const group of groups) {
    const groupHandles = handles[group];
    const groupRetired = retired[group];
    if (!plainObject(groupHandles)) throw new Error(`${label} ${group} must be an object`);
    if (!plainObject(groupRetired)) throw new Error(`${label} ${group} retired must be an object`);
    exactKeySet(Object.keys(groupHandles), corpusIds[group], `${label} ${group}`);
    const taken = new Map<string, string>();
    for (const [id, slug] of Object.entries(groupRetired)) {
      if (typeof slug !== 'string' || !SLUG_SHAPE.test(slug)) throw new Error(`${label} ${group} retired ${id}: slug ${JSON.stringify(slug)} is not a lowercase ASCII slug`);
      if (Object.hasOwn(groupHandles, id)) throw new Error(`${label} ${group}: ${id} is both live and retired`);
      taken.set(slug, id);
    }
    for (const id of corpusIds[group]) {
      const slug = groupHandles[id];
      if (typeof slug !== 'string' || !SLUG_SHAPE.test(slug)) throw new Error(`${label} ${group} ${id}: slug ${JSON.stringify(slug)} is not a lowercase ASCII slug`);
      const clash = taken.get(slug);
      if (clash) throw new Error(`${label} ${group}: slug ${slug} is shared by ${clash} and ${id}`);
      taken.set(slug, id);
      const entry = { id, group, slug, path: lookupDetailPath(group, slug) };
      byId.set(id, entry);
      entries.push(entry);
    }
  }
  return { entries, byId, exceptions: Object.fromEntries(entries.filter((entry) => entry.slug !== lookupDerivedSlug(entry.id)).map((entry) => [entry.id, entry.slug])) };
}

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
