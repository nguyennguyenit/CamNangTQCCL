// Entry tối giản cho trang chi tiết: chỉ tải đúng payload đã pin, không khởi động app gốc.

import { el } from './render.js';
import {
  loadRecommendedDetailRecord,
  loadVerifiedLegacyTeam,
  loadVerifiedRecommendedManifest,
} from './recommended-reference-state.js';
import { legacyOriginalDetailContent, recommendedTeamDetailContent } from './recommended-reference-render.js';
import { safeReturnUrl } from './team-detail-navigation.js';

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
  const status = documentTarget.querySelector('#team-detail-status');
  const body = documentTarget.querySelector('#team-detail-body');
  const returnLink = documentTarget.querySelector('#team-return-link');
  upgradeReturnLink(returnLink);

  const {family, sourceConfigId, scopeKey, generationId, manifestSha256, legacyTeamId, legacyTeamsSha256} = root.dataset;
  const pin = {schemaVersion: 1, generationId, manifestSha256};
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

  async function loadRecommended() {
    const record = await loadRecommendedDetailRecord(pin, {scopeKey, sourceConfigId}, name => fetchBytes(`/data/recommended/${name}`));
    showContent(recommendedTeamDetailContent(record));
  }

  async function loadLegacy() {
    const team = await loadVerifiedLegacyTeam(legacyTeamId, legacyTeamsSha256, () => fetchBytes('/data/teams.json'));
    if (!requestedVariantPresent) {
      showContent(legacyOriginalDetailContent(team, {}));
      return;
    }
    const originalLink = el('a', {class: 'detail-link', href: `/teams/legacy/${encodeURIComponent(legacyTeamId)}/`}, 'Xem đội gốc');
    let admitted = null;
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
      showError('Biến thể này không có trong dữ liệu Team khác đã xác minh.', {actions: [originalLink]});
      return;
    }
    showContent(legacyOriginalDetailContent(admitted.legacyContent || team, {variant: admitted}));
  }

  async function load() {
    pending = true;
    showLoading();
    try {
      if (family === 'recommended') await loadRecommended();
      else await loadLegacy();
    } catch (error) {
      const verification = /xác minh|không khớp|hợp lệ|định danh|đúng một/i.test(error?.message || '');
      showError(verification ? VERIFY_MESSAGE : NETWORK_MESSAGE);
    } finally {
      pending = false;
    }
  }

  await load();
  return {reload: load};
}

initTeamDetail();
