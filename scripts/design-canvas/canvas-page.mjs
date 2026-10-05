// Dựng trang artboard .dc.html từ DOM đã chụp của site: đổi link nội bộ sang artboard tương ứng, ảnh/font sang asset
// canvas (`/_blob/<id>`, tra theo nội dung file trong docs/design/so-binh-phap/project/_blob), gốc `.dc-body` cố định kích thước
// và DCLogic giữ trạng thái mở/đóng của mọi nút có aria-controls (menu thả cùng nhóm `nav_menu_*` loại trừ nhau).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REPO = new URL('../../', import.meta.url).pathname;
const BLOB_DIR = join(REPO, 'docs/design/so-binh-phap/project/_blob');

/** Bảng `/fonts/x.woff2`, `/logo.png`… → `/_blob/<id>` bằng cách so SHA-256 file của bản build với bản sao trong repo. */
export function assetMap(buildDir) {
  const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
  const byHash = new Map(readdirSync(BLOB_DIR).map((id) => [sha(join(BLOB_DIR, id)), `/_blob/${id}`]));
  const map = {};
  const files = [...readdirSync(join(buildDir, 'fonts')).map((f) => `/fonts/${f}`), '/logo.png', '/logo-cam-nang.svg'];
  for (const f of files) {
    try { const id = byHash.get(sha(join(buildDir, f))); if (id) map[f] = id; } catch { /* file không có trong build */ }
  }
  return map;
}

/** css/styles.css của bản build cho canvas: font trỏ về asset, `body[data-page-section]` → `.dc-body[data-page-section]`. */
export function canvasStylesheet(buildDir, assets) {
  let css = readFileSync(join(buildDir, 'css/styles.css'), 'utf8');
  for (const [from, to] of Object.entries(assets)) css = css.replaceAll(`url('${from}')`, `url('${to}')`);
  return '/* Stylesheet của site Cẩm Nang TQCCL (css/styles.css) cho artboard canvas: font trỏ về asset canvas, body[…] → .dc-body[…]. */\n'
    + css.replaceAll('body[data-page-section', '.dc-body[data-page-section');
}

const ROUTES = [
  [/^\/$/, 'Landing', 'LandingMobile'], [/^\/doi-chuan\/$/, 'Main', 'MobileList'], [/^\/doi-khac\/$/, 'DoiKhac', 'DoiKhacMobile'],
  [/^\/doi-chuan\/[^/]+\/$/, 'TeamDetail', 'TeamDetailMobile'], [/^\/doi-khac\/[^/]+\/$/, 'DoiKhacDetail', 'DoiKhacDetailMobile'],
  [/^\/cung-ton\/$/, 'Coexist', 'CoexistMobile'], [/^\/khai-hoang\/$/, 'Khaihoang', 'KhaihoangMobile'],
  [/^\/khai-hoang\/[^/]+\/$/, 'KhaihoangDetail', 'KhaihoangDetailMobile'], [/^\/chien-bao\/$/, 'ChienBao', 'ChienBaoMobile'],
  [/^\/bai-viet\/$/, 'BaiViet', 'BaiVietMobile'], [/^\/dieu-khoan-su-dung\/$/, 'Terms', 'TermsMobile'],
  [/^\/chinh-sach-bao-mat\/$/, 'Privacy', 'PrivacyMobile'], [/^\/quy-tac-cong-dong\/$/, 'CommunityRules', 'CommunityRulesMobile'],
  [/^\/mien-tru-trach-nhiem\/$/, 'Disclaimer', 'DisclaimerMobile'], [/^\/zh\/$/, 'LandingZh', 'LandingZhMobile'],
  [/^\/tra-cuu\/$/, 'LookupHub', 'LookupHubMobile'], [/^\/tra-cuu\/tuong\/$/, 'Lookup', 'LookupMobile'],
  [/^\/tra-cuu\/binh-thu\/$/, 'LookupBooks', 'LookupBooksMobile'], [/^\/tra-cuu\/chien-phap\/$/, 'LookupTactics', 'LookupMobile'],
  [/^\/tra-cuu\/trang-bi\/$/, 'LookupEquipment', 'LookupEquipmentMobile'], [/^\/tra-cuu\/quan-su\/$/, 'LookupAdvisors', 'LookupAdvisorsMobile'],
  [/^\/tra-cuu\/cai-tao-binh-chung\/$/, 'LookupTroops', 'LookupTroopsMobile'], [/^\/tra-cuu\/cong-trinh\/$/, 'LookupBuildings', 'LookupBuildingsMobile'],
  [/^\/theo-doi-chieu-mo\/$/, 'Recruit', 'RecruitMobile'], [/^\/soi-doi-tu-anh\/$/, 'Analyze', 'AnalyzeMobile'],
  [/^\/goi-y-doi-tu-kho\/$/, 'Roster', 'RosterMobile'], [/^\/quan-tri\/$/, 'AdminReports', 'AdminReportsMobile'],
];

export function mapHref(href, mobile) {
  if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return href;
  const [pathPart, query = ''] = href.split('#')[0].split('?');
  for (const [re, desk, mob] of ROUTES) {
    if (!re.test(pathPart)) continue;
    let target = mobile ? mob : desk;
    if ((target === 'Main' || target === 'MobileList') && query.includes('view=bang')) target = mobile ? 'MobileTable' : 'MainTable';
    return `${target}.dc.html`;
  }
  return '#';
}

export function rewrite(html, mobile, assets) {
  return html
    .replace(/href="([^"]*)"/g, (_, h) => `href="${mapHref(h.replaceAll('&amp;', '&'), mobile)}"`)
    .replace(/(<img[^>]*?\ssrc=")([^"]+)"/g, (_, pre, src) => `${pre}${assets[src] || src}"`);
}

/** Trang .dc.html hoàn chỉnh từ một bản chụp ({html, bodyAttrs, toggles}). */
export function renderPage({ title, width, height, capture, stylesheet, assets, lang = 'vi' }) {
  const mobile = width < 768;
  const keys = capture.toggles.map((t) => t.key);
  const init = capture.toggles.filter((t) => t.open).map((t) => t.key);
  const nav = keys.filter((k) => k.startsWith('nav_menu_'));
  const backdrop = nav.length ? '<sc-if value="{{navOpen}}" hint-placeholder-val="{{ false }}"><button type="button" aria-label="Đóng menu" onClick="{{closeNav}}" style="position: fixed; inset: 0; z-index: 40; border: none; padding: 0; background: transparent; cursor: default;"></button></sc-if>' : '';
  const attrs = capture.bodyAttrs.map(([n, v]) => ` ${n}="${v}"`).join('');
  const script = `class Component extends DCLogic {
  renderVals() {
    const KEYS = ${JSON.stringify(keys)};
    const NAV = ${JSON.stringify(nav)};
    const open = (this.state && this.state.open) || ${JSON.stringify(init)};
    const v = {
      navOpen: open.some((k) => NAV.includes(k)),
      closeNav: () => this.setState({ open: open.filter((k) => !NAV.includes(k)) }),
    };
    KEYS.forEach((k) => {
      const on = open.includes(k);
      v['open_' + k] = on;
      v['exp_' + k] = on ? 'true' : 'false';
      v['toggle_' + k] = () => this.setState({ open: on ? open.filter((x) => x !== k) : open.filter((x) => !(NAV.includes(k) && NAV.includes(x))).concat(k) });
    });
    return v;
  }
}`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="${stylesheet}">
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
</style>
</helmet>
<div class="dc-body"${attrs} style="width: ${width}px; height: ${height}px; box-sizing: border-box; display: flex; flex-direction: column; position: relative; overflow: hidden;">
${backdrop}
${rewrite(capture.html, mobile, assets)}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${width},"height":${height}}}'>
${script}
</script>
</body>
</html>
`;
}
