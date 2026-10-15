/**
 * Bộ file llms của site (bản Việt) từ MỘT hàm sinh: `/llms/doi-chuan.txt` (hoặc `/llms/doi-chuan/<mùa>.txt` khi quá lớn),
 * `/llms/doi-khac.txt`, `/llms/cung-ton.txt`, `/llms/khai-hoang.txt`, `/llms/tra-cuu/<nhóm>.txt` ×7 và
 * `/llms-full.txt` (= nối các file con theo thứ tự cố định). Nội dung mỗi mục là chữ thuần (`treeToText`) của đúng cây view
 * mà trang HTML của nó dựng từ, nên llms và trang không thể lệch nhau; mỗi mục mở bằng một dòng có URL trang riêng.
 * Route (`src/pages/llms/…`, `llms-full.txt.ts`), `llms.txt` và allowlist của `scripts/verify-astro-dist.mjs` đều lấy danh sách
 * file từ `llmsDocuments`.
 */
import { LOOKUP_GROUP_SLUGS, lookupSlug } from '../../js/lookup-ids.js';
import { lookupDisplayName } from '../../js/lookup-detail.js';
import { lookupGroupLabels } from '../../js/unified-lookup.js';
import { lookupBuildCorpus, type LookupGroup } from './lookup-pages.ts';
import { lookupDetailRoutes } from './lookup-detail-routes.ts';
import { lookupItemTree } from './lookup-item-pages.ts';
import { treeToText } from '../../js/view-tree.js';
import {
  khaiHoangDetailPaths,
  legacyDetailPaths,
  recommendedDetailPaths,
  recommendedDetailPlainText,
  recommendedSeasonOrder,
} from './team-detail-pages.ts';
import { coexistScenarioTexts, khaiHoangDetailText, legacyDetailText } from './team-ssr.ts';

/** Quá ngưỡng này thì `doi-chuan` tách theo mùa (byte UTF-8 của mọi mùa cộng lại). */
export const LLMS_SPLIT_BYTES = 300 * 1024;

const SITE_TITLE = 'Cẩm Nang Game Tam Quốc Chí - Chiến Lược';

export interface LlmsFile {
  /** Đường dẫn file trong dist, bắt đầu bằng `/` (vd `/llms/tra-cuu/tuong.txt`). */
  path: string;
  /** Tiêu đề trong `llms.txt` (dòng link tới file). */
  label: string;
  note: string;
  /** Mục của site mà file thuộc về (`doi-chuan`, `doi-khac`, `cung-ton`, `khai-hoang`, `tra-cuu`). */
  section: string;
  text: string;
}

export interface LlmsGroupPage {
  group: LookupGroup;
  label: string;
  /** Đường dẫn trang nhóm Tra cứu và file llms của nhóm. */
  pagePath: string;
  filePath: string;
  count: number;
}

export interface LlmsDocuments {
  /** Mọi file con theo thứ tự cố định; `/llms-full.txt` là nối `text` của chúng. */
  files: LlmsFile[];
  full: string;
  fullPath: string;
  groups: LlmsGroupPage[];
}

const escapeLabel = (label: string) => label.replace(/[[\]\\]/gu, (character) => `\\${character}`);

/** Một mục của file: dòng tiêu đề mang URL tuyệt đối của trang riêng, rồi chữ thuần của trang. */
function entry(label: string, url: string, text: string) {
  return `## [${escapeLabel(label)}](${url})\n\n${text}\n\n`;
}

function fileText(title: string, summary: string, entries: readonly string[]) {
  return `# ${title}\n\n> ${summary}\n\n${entries.join('')}`.trimEnd() + '\n';
}

const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

async function recommendedFiles(absolute: (path: string) => string): Promise<LlmsFile[]> {
  const [detailRows, seasonOrder] = await Promise.all([recommendedDetailPaths('vi'), recommendedSeasonOrder()]);
  const rank = (id: string | null) => { const at = id ? seasonOrder.indexOf(id) : -1; return at < 0 ? seasonOrder.length : at; };
  // Sort ổn định theo thứ tự registry mùa; trong mùa giữ thứ tự catalog.
  const rows = [...detailRows].sort((left, right) => rank(left.props.entry.sourceSeasonId) - rank(right.props.entry.sourceSeasonId));
  const bySeason = new Map<string, { label: string; entries: string[]; count: number }>();
  for (const { props } of rows) {
    const { entry: team } = props;
    const code = team.sourceSeasonCode ?? team.sourceSeasonId;
    if (!code) throw new Error(`Recommended team has no season: ${team.sourceConfigId}`);
    const season = bySeason.get(code) ?? { label: `${code} · ${team.sourceSeasonNameVi}`, entries: [], count: 0 };
    season.entries.push(entry(props.pageLabel, absolute(team.routePath), await recommendedDetailPlainText(team, props.lookupLinks, 'vi')));
    season.count += 1;
    bySeason.set(code, season);
  }
  const summary = (count: number) => `${count} đội chuẩn: tướng, chiến pháp, binh thư và ghi chú của từng đội, mỗi đội một mục có link trang chi tiết.`;
  const whole = fileText(`Đội chuẩn — ${SITE_TITLE}`, summary(rows.length), [...bySeason.values()].flatMap((season) => season.entries));
  if (bytes(whole) <= LLMS_SPLIT_BYTES) {
    return [{ path: '/llms/doi-chuan.txt', label: 'Đội chuẩn', note: summary(rows.length), section: 'doi-chuan', text: whole }];
  }
  const slugs = new Set<string>();
  return [...bySeason.entries()].map(([code, season]) => {
    const slug = lookupSlug(code);
    if (!slug || slugs.has(slug)) throw new Error(`Season ${code} has no unique llms file name`);
    slugs.add(slug);
    return {
      path: `/llms/doi-chuan/${slug}.txt`,
      label: `Đội chuẩn — ${season.label}`,
      note: summary(season.count),
      section: 'doi-chuan',
      text: fileText(`Đội chuẩn — ${season.label} — ${SITE_TITLE}`, summary(season.count), season.entries),
    };
  });
}

async function legacyFile(absolute: (path: string) => string): Promise<LlmsFile> {
  const rows = await legacyDetailPaths('vi');
  const entries: string[] = [];
  for (const { props } of rows) entries.push(entry(props.pageLabel, absolute(props.entry.routePath), await legacyDetailText(props.entry, 'vi')));
  const note = `${rows.length} đội do người chơi tổng hợp, nội dung gốc của từng đội, mỗi đội một mục có link trang chi tiết.`;
  return { path: '/llms/doi-khac.txt', label: 'Đội khác', note, section: 'doi-khac', text: fileText(`Đội khác — ${SITE_TITLE}`, note, entries) };
}

async function khaiHoangFile(absolute: (path: string) => string): Promise<LlmsFile> {
  const rows = await khaiHoangDetailPaths('vi');
  const entries: string[] = [];
  for (const { props } of rows) entries.push(entry(props.pageLabel, absolute(props.entry.routePath), await khaiHoangDetailText(props.entry, 'vi')));
  const note = `${rows.length} hướng dẫn khai hoang theo đội, mỗi đội một mục có link trang chi tiết.`;
  return { path: '/llms/khai-hoang.txt', label: 'Khai hoang', note, section: 'khai-hoang', text: fileText(`Khai hoang — ${SITE_TITLE}`, note, entries) };
}

/** Cùng Tồn không có trang riêng từng nhóm: mỗi mùa một mục, link là trang mục kèm tham số mùa mà trang đọc. */
async function coexistFile(absolute: (path: string) => string): Promise<LlmsFile> {
  const scenarios = await coexistScenarioTexts('vi');
  const entries = scenarios.map((scenario) => entry(scenario.label, `${absolute('/cung-ton/')}${scenario.query}`, scenario.groups.join('\n\n')));
  const note = 'các nhóm đội dùng cùng lúc không trùng tướng và chiến pháp, theo từng mùa; mỗi mùa một mục có link tới trang Cùng Tồn.';
  return { path: '/llms/cung-ton.txt', label: 'Cùng Tồn', note, section: 'cung-ton', text: fileText(`Cùng Tồn — ${SITE_TITLE}`, note, entries) };
}

async function lookupFiles(absolute: (path: string) => string): Promise<{ files: LlmsFile[]; groups: LlmsGroupPage[] }> {
  const [corpus, routes] = await Promise.all([lookupBuildCorpus(), lookupDetailRoutes()]);
  const labels = lookupGroupLabels('vi') as Record<LookupGroup, string>;
  const files: LlmsFile[] = [];
  const groups: LlmsGroupPage[] = [];
  for (const group of Object.keys(LOOKUP_GROUP_SLUGS) as LookupGroup[]) {
    const rows = corpus.groups[group] as Array<{ id: string; nameVi: string; record?: unknown }>;
    const entries: string[] = [];
    for (const row of rows) {
      const route = routes.byId.get(row.id);
      if (!route) throw new Error(`Lookup item has no frozen route: ${row.id}`);
      entries.push(entry(lookupDisplayName(row.record, row.nameVi, 'vi') as string, absolute(route.path), treeToText(await lookupItemTree(row.id, 'vi'))));
    }
    const label = labels[group];
    const slug = LOOKUP_GROUP_SLUGS[group];
    const note = `${rows.length} mục nhóm ${label.toLowerCase()} của Tra cứu, mỗi mục một hồ sơ có link trang riêng.`;
    const path = `/llms/tra-cuu/${slug}.txt`;
    files.push({ path, label: `Tra cứu — ${label}`, note, section: 'tra-cuu', text: fileText(`Tra cứu — ${label} — ${SITE_TITLE}`, note, entries) });
    groups.push({ group, label, pagePath: `/tra-cuu/${slug}/`, filePath: path, count: rows.length });
  }
  return { files, groups };
}

const cache = new Map<string, Promise<LlmsDocuments>>();

/** Toàn bộ file llms của site; một lần cho mỗi gốc `site` trong một tiến trình. */
export function llmsDocuments(site: URL | string): Promise<LlmsDocuments> {
  const origin = new URL(site).href;
  let pending = cache.get(origin);
  if (!pending) {
    const absolute = (path: string) => new URL(path, origin).href;
    pending = (async () => {
      const lookup = await lookupFiles(absolute);
      const files = [
        ...await recommendedFiles(absolute),
        await legacyFile(absolute),
        await coexistFile(absolute),
        await khaiHoangFile(absolute),
        ...lookup.files,
      ];
      return { files, full: files.map((file) => file.text).join(''), fullPath: '/llms-full.txt', groups: lookup.groups };
    })();
    cache.set(origin, pending);
  }
  return pending;
}

/** Đường dẫn mọi file llms (con + gộp) — allowlist của dist. */
export async function llmsOutputPaths(site: URL | string): Promise<string[]> {
  const docs = await llmsDocuments(site);
  return [...docs.files.map((file) => file.path), docs.fullPath];
}
