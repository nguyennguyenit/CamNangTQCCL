// Entry tối giản cho trang chi tiết, không khởi động app gốc. Thân trang do build dựng sẵn (`#team-detail-body[data-prerendered]`):
// client chỉ nhận lại và gắn nút sao chép liên kết. Chỉ khi URL xin biến thể của đội gốc (`?variant=`, cần đối chiếu
// `other-teams.json` đã pin lúc chạy) thì tải payload đã pin, xác minh rồi thay thân như cũ.

import { el } from './render.js';
import { detailPanelActions, isNetworkError } from './detail-actions.js';
import {
  loadVerifiedLegacyTeams,
  loadVerifiedRecommendedManifest,
  setTacticDisplayName,
  setZhNameResolver,
} from './recommended-reference-state.js';
import { detailBadges, legacyOriginalDetailContent } from './recommended-reference-render.js';
import { safeReturnUrl, setTeamRouteHandlesFromJSON, teamDetailPath } from './team-detail-navigation.js';
import { createByteLoader, loadRawNameResolver, loadWebsiteDisplay, localizeData, readTacticDisplayTable } from './website-display.js';
import { L } from './i18n.js';
import { setLookupRouteHandlesFromJSON } from './lookup-ids.js';
import { treeToDom } from './view-tree.js';

const TEAMS_SOURCE = 'data/teams.json';
const VERIFY_MESSAGE = L('Không thể xác minh dữ liệu đội hình. Hãy tải lại trang hoặc quay lại danh sách.', '无法验证阵容数据。请刷新页面或返回列表。');
const NETWORK_MESSAGE = L('Không tải được chi tiết đội hình. Hãy kiểm tra kết nối rồi thử lại.', '无法加载阵容详情。请检查网络连接后重试。');

async function fetchBytes(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.arrayBuffer();
}

function upgradeReturnLink(link) {
  if (!link) return;
  const from = new URL(location.href).searchParams.get('from');
  const target = safeReturnUrl(from);
  if (target) link.href = target;
}

export async function initTeamDetail({documentTarget = document} = {}) {
  const root = documentTarget.querySelector('#team-detail-root');
  if (!root) return null;
  // Trang chi tiết chỉ nhúng bảng legacy route handle; phải đăng ký trước lần dựng link đội gốc.
  setTeamRouteHandlesFromJSON(documentTarget.querySelector('#team-route-handles')?.textContent);
  setLookupRouteHandlesFromJSON(documentTarget.querySelector('#lookup-route-handles')?.textContent);
  setTacticDisplayName(readTacticDisplayTable(documentTarget));
  const body = documentTarget.querySelector('#team-detail-body');
  // Trạng thái chờ/lỗi chỉ tồn tại khi client thật sự phải tải: build không phát phần tử này.
  const statusNode = () => {
    let node = documentTarget.querySelector('#team-detail-status');
    if (!node) {
      node = el('div', {id: 'team-detail-status', class: 'detail-state', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'});
      body.before(node);
    }
    return node;
  };
  const returnLink = documentTarget.querySelector('#team-return-link');
  const badges = documentTarget.querySelector('#team-detail-badges');
  const panel = documentTarget.querySelector('#team-detail-panel');
  const panelActions = documentTarget.querySelector('#team-detail-actions');
  upgradeReturnLink(returnLink);

  /** Đầu trang: huy hiệu phe/loại binh có dữ liệu (bỏ hẳn phần thiếu) và nút sao chép liên kết; không có link nguồn ngoài. */
  const paintHeader = (record, labels) => {
    if (badges) {
      const nodes = detailBadges(record, labels);
      badges.replaceChildren(...nodes.map(node => treeToDom(node)));
      badges.hidden = !nodes.length;
    }
    if (panelActions) panelActions.replaceChildren(detailPanelActions());
    if (panel) panel.hidden = false;
  };

  const {family, generationId, manifestSha256, legacyTeamId, legacyTeamsSha256} = root.dataset;
  const pin = {schemaVersion: 1, generationId, manifestSha256};
  const websitePin = JSON.parse(documentTarget.querySelector('#website-display-publication')?.textContent || 'null');
  let websiteDisplay;
  const variantParams = new URL(location.href).searchParams;
  const requestedVariantPresent = variantParams.has('variant');
  const requestedVariant = variantParams.get('variant');
  let pending = false;
  // Mỗi lượt tải có bộ nạp riêng: publication và bộ kiểm đội gốc đọc chung một request `teams.json`,
  // còn "Thử lại" tải lại byte thật.
  let loadBytes = createByteLoader();

  const showLoading = () => {
    const status = statusNode();
    root.setAttribute('aria-busy', 'true');
    body.hidden = true;
    status.hidden = false;
    status.replaceChildren(L('Đang tải chi tiết…', '正在加载详情…'));
  };
  const showError = (message, {actions = []} = {}) => {
    const status = statusNode();
    root.setAttribute('aria-busy', 'false');
    // Lỗi xác minh/tải: không để lại nội dung dựng sẵn trong DOM, chỉ còn thông báo.
    body.hidden = true;
    body.replaceChildren();
    if (badges) { badges.replaceChildren(); badges.hidden = true; }
    status.hidden = false;
    const retry = el('button', {id: 'team-detail-retry', class: 'detail-action', type: 'button'}, L('Thử lại', '重试'));
    retry.addEventListener('click', () => { if (!pending) load(); });
    status.replaceChildren(el('div', {class: 'error', role: 'alert'}, [
      el('p', {}, message),
      el('div', {class: 'detail-actions'}, [retry, ...actions]),
    ]));
  };
  // `trees`: mảng cây view của builder (recommended-reference-render.js), đổi sang DOM tại đây.
  const showContent = (trees) => {
    body.replaceChildren(...trees.map(tree => treeToDom(tree)));
    body.hidden = false;
    body.removeAttribute('data-prerendered');
    const status = documentTarget.querySelector('#team-detail-status');
    if (status) {
      status.hidden = true;
      status.replaceChildren();
    }
    root.setAttribute('aria-busy', 'false');
  };

  /** Thân và huy hiệu đã có trong HTML: chỉ hiện panel và gắn nút sao chép liên kết, không tải gì, không dựng lại. */
  function adoptPrerendered() {
    body.removeAttribute('data-prerendered');
    if (panelActions) panelActions.replaceChildren(detailPanelActions());
    if (panel) panel.hidden = false;
    root.setAttribute('aria-busy', 'false');
  }

  async function localizedLegacyTeams() {
    const teams = await loadVerifiedLegacyTeams(legacyTeamsSha256, () => loadBytes(TEAMS_SOURCE));
    return localizeData(websiteDisplay, TEAMS_SOURCE, teams);
  }

  async function loadLegacy() {
    const teams = await localizedLegacyTeams();
    const matches = teams.filter(candidate => candidate.id === legacyTeamId);
    if (matches.length !== 1) throw new Error(L('Không tìm thấy đúng một đội gốc với mã này.', '未找到与此编号唯一对应的原始阵容。'));
    const team = matches[0];
    const originalLink = el('a', {class: 'detail-link', href: teamDetailPath({legacyTeamId})}, L('Xem đội gốc', '查看原始阵容'));
    let admitted;
    try {
      const {load} = await loadVerifiedRecommendedManifest(pin, name => fetchBytes(`/data/recommended/${name}`));
      const other = await load('other-teams.json');
      admitted = (other.records || []).find(row => row.legacyTeamId === legacyTeamId && row.legacyVariantId === requestedVariant) || null;
    } catch {
      // Không xác minh được biến thể thì báo rõ, không hiển thị đội gốc như thể là biến thể.
      showError(L('Không xác minh được biến thể được yêu cầu.', '无法验证所请求的变体。'), {actions: [originalLink]});
      return;
    }
    if (!admitted) {
      showError(L('Biến thể này không có trong dữ liệu đội khác đã xác minh.', '已验证的其他阵容数据中没有此变体。'), {actions: [originalLink]});
      return;
    }
    const content = {...(admitted.legacyContent || team), notes: team.notes};
    paintHeader(content, null);
    showContent(legacyOriginalDetailContent(content, {variant: admitted}));
  }

  async function load() {
    pending = true;
    loadBytes = createByteLoader();
    showLoading();
    try {
      websiteDisplay ??= await loadWebsiteDisplay(websitePin, loadBytes, pin, {paths: [TEAMS_SOURCE]});
      // Bản Trung: tên tướng/chiến pháp/binh thư của đội gốc tra ngược về chữ Hán trước khi dựng nội dung;
      // từ điển lỗi chỉ làm tên lùi về Hán-Việt, không chặn trang.
      const rawNames = await loadRawNameResolver(loadBytes).catch(() => null);
      if (rawNames) setZhNameResolver(rawNames);
      await loadLegacy();
    } catch (error) {
      // Chỉ lỗi tải mạng/HTTP mới gợi ý kiểm tra kết nối; byte lệch pin hay dữ liệu sai là lỗi xác minh.
      showError(isNetworkError(error) ? NETWORK_MESSAGE : VERIFY_MESSAGE);
    } finally {
      pending = false;
    }
  }

  // Đội chuẩn và đội gốc ở trạng thái mặc định: thân đã dựng sẵn, chỉ gắn tương tác (Khai hoang có entry riêng).
  // Biến thể đội gốc phụ thuộc `other-teams.json` đã pin nên chỉ biết được lúc chạy: tải, xác minh rồi thay thân.
  if (family === 'legacy' && requestedVariantPresent) await load();
  else adoptPrerendered();
  return {reload: load};
}

initTeamDetail();
