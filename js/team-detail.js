// Entry tối giản cho trang chi tiết: chỉ tải đúng payload đã pin, không khởi động app gốc.

import { el } from './render.js';
import { detailPanelActions, isNetworkError } from './detail-actions.js';
import {
  loadRecommendedDetailView,
  loadVerifiedLegacyTeams,
  loadVerifiedRecommendedManifest,
  validateReferenceSourceUrl,
} from './recommended-reference-state.js';
import { detailBadges, legacyOriginalDetailContent, recommendedTeamDetailContent } from './recommended-reference-render.js';
import { safeReturnUrl, setTeamRouteHandlesFromJSON, teamDetailPath } from './team-detail-navigation.js';
import { loadWebsiteDisplay, localizeData } from './website-display.js';

const VERIFY_MESSAGE = 'Không thể xác minh dữ liệu đội hình. Hãy tải lại trang hoặc quay lại danh sách.';
const NETWORK_MESSAGE = 'Không tải được chi tiết đội hình. Hãy kiểm tra kết nối rồi thử lại.';

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
  const status = documentTarget.querySelector('#team-detail-status');
  const body = documentTarget.querySelector('#team-detail-body');
  const returnLink = documentTarget.querySelector('#team-return-link');
  const badges = documentTarget.querySelector('#team-detail-badges');
  const panel = documentTarget.querySelector('#team-detail-panel');
  const panelActions = documentTarget.querySelector('#team-detail-actions');
  upgradeReturnLink(returnLink);

  /** Đầu trang: huy hiệu phe/loại binh có dữ liệu (bỏ hẳn phần thiếu) và link nguồn đã kiểm scheme. */
  const paintHeader = (record, labels, sources) => {
    if (badges) {
      const nodes = detailBadges(record, labels);
      badges.replaceChildren(...nodes);
      badges.hidden = !nodes.length;
    }
    if (panelActions) panelActions.replaceChildren(detailPanelActions({sources}));
    if (panel) panel.hidden = false;
  };

  const {family, sourceConfigId, scopeKey, generationId, manifestSha256, legacyTeamId, legacyTeamsSha256} = root.dataset;
  const pin = {schemaVersion: 1, generationId, manifestSha256};
  const websitePin = JSON.parse(documentTarget.querySelector('#website-display-publication')?.textContent || 'null');
  let websiteDisplay;
  const variantParams = new URL(location.href).searchParams;
  const requestedVariantPresent = variantParams.has('variant');
  const requestedVariant = variantParams.get('variant');
  let pending = false;

  const showLoading = () => {
    root.setAttribute('aria-busy', 'true');
    body.hidden = true;
    status.hidden = false;
    status.replaceChildren('Đang tải chi tiết…');
  };
  const showError = (message, {actions = []} = {}) => {
    root.setAttribute('aria-busy', 'false');
    body.hidden = true;
    status.hidden = false;
    const retry = el('button', {id: 'team-detail-retry', class: 'detail-action', type: 'button'}, 'Thử lại');
    retry.addEventListener('click', () => { if (!pending) load(); });
    status.replaceChildren(el('div', {class: 'error', role: 'alert'}, [
      el('p', {}, message),
      el('div', {class: 'detail-actions'}, [retry, ...actions]),
    ]));
  };
  const showContent = (fragment) => {
    body.replaceChildren(fragment);
    body.hidden = false;
    status.hidden = true;
    status.replaceChildren();
    root.setAttribute('aria-busy', 'false');
  };

  async function localizedLegacyTeams() {
    const teams = await loadVerifiedLegacyTeams(legacyTeamsSha256, () => fetchBytes('/data/teams.json'));
    return localizeData(websiteDisplay, 'data/teams.json', teams);
  }

  async function loadRecommended() {
    const [{record, labels}, legacyTeams] = await Promise.all([
      loadRecommendedDetailView(pin, {scopeKey, sourceConfigId}, name => fetchBytes(`/data/recommended/${name}`)),
      localizedLegacyTeams(),
    ]);
    const source = validateReferenceSourceUrl('recommended', record, record.sourceUrl);
    paintHeader(record, labels, source ? [{href: source}] : []);
    showContent(recommendedTeamDetailContent(record, {legacyTeams, labels}));
  }

  async function loadLegacy() {
    const teams = await localizedLegacyTeams();
    const matches = teams.filter(candidate => candidate.id === legacyTeamId);
    if (matches.length !== 1) throw new Error('Không tìm thấy đúng một đội gốc với mã này.');
    const team = matches[0];
    if (!requestedVariantPresent) {
      paintHeader(team, null, []);
      showContent(legacyOriginalDetailContent(team));
      return;
    }
    const originalLink = el('a', {class: 'detail-link', href: teamDetailPath({legacyTeamId})}, 'Xem đội gốc');
    let admitted;
    try {
      const {load} = await loadVerifiedRecommendedManifest(pin, name => fetchBytes(`/data/recommended/${name}`));
      const other = await load('other-teams.json');
      admitted = (other.records || []).find(row => row.legacyTeamId === legacyTeamId && row.legacyVariantId === requestedVariant) || null;
    } catch {
      // Không xác minh được biến thể thì báo rõ, không hiển thị đội gốc như thể là biến thể.
      showError('Không xác minh được biến thể được yêu cầu.', {actions: [originalLink]});
      return;
    }
    if (!admitted) {
      showError('Biến thể này không có trong dữ liệu đội khác đã xác minh.', {actions: [originalLink]});
      return;
    }
    const content = {...(admitted.legacyContent || team), notes: team.notes};
    paintHeader(content, null, []);
    showContent(legacyOriginalDetailContent(content, {variant: admitted}));
  }

  async function load() {
    pending = true;
    showLoading();
    try {
      websiteDisplay ??= await loadWebsiteDisplay(
        websitePin,
        path => fetchBytes(path === 'website-display.json' ? '/data/website-display.json' : `/${path}`),
        pin,
      );
      if (family === 'recommended') await loadRecommended();
      else await loadLegacy();
    } catch (error) {
      // Chỉ lỗi tải mạng/HTTP mới gợi ý kiểm tra kết nối; byte lệch pin hay dữ liệu sai là lỗi xác minh.
      showError(isNetworkError(error) ? NETWORK_MESSAGE : VERIFY_MESSAGE);
    } finally {
      pending = false;
    }
  }

  await load();
  return {reload: load};
}

initTeamDetail();
