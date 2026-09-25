// Entry trang chi tiết Khai hoang: chỉ đọc nguồn đã pin rồi hiển thị build + hướng dẫn.
// Không khởi động app gốc và không ghi ngược trạng thái danh sách.

import { applyKhaihoangUnit, el, khaihoangBuildContent, khaihoangGuide } from './render.js';
import { detailPanelActions } from './detail-actions.js';
import { detailBadges } from './recommended-reference-render.js';
import { validateHttpSourceUrl } from './recommended-reference-state.js';
import { khaiHoangDetailVariantUrl, returnHrefFor } from './team-detail-navigation.js';
import { loadWebsiteDisplay, localizeData } from './website-display.js';

const KHAIHOANG_SOURCE = 'data/khaihoang.json';
const SOURCE_HASH = /^[0-9a-f]{64}$/;
const LOADING_MESSAGE = 'Đang tải chi tiết…';
const NETWORK_MESSAGE = 'Không tải được chi tiết khai hoang. Hãy kiểm tra kết nối rồi thử lại.';
const VERIFY_MESSAGE = 'Không thể xác minh dữ liệu khai hoang. Hãy tải lại trang hoặc quay lại danh sách.';
const MISSING_PIN_MESSAGE = 'Trang chi tiết thiếu mã kiểm tra nguồn dữ liệu khai hoang.';
const CHANGED_SOURCE_MESSAGE = 'Nguồn dữ liệu khai hoang đã thay đổi so với bản đã phát hành.';
const MISSING_TEAM_MESSAGE = 'Không tìm thấy đúng một đội khai hoang với mã này.';
const VERIFY_FAILURES = new Set([MISSING_PIN_MESSAGE, CHANGED_SOURCE_MESSAGE, MISSING_TEAM_MESSAGE]);

const decoder = new TextDecoder();
const asBytes = (value) => (value instanceof Uint8Array ? value : new Uint8Array(value));
const sha256Hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map((value) => value.toString(16).padStart(2, '0')).join('');
// Lỗi mạng/HTTP của chính module này kết thúc bằng mã trạng thái.
const isNetworkError = (error) => /Failed to fetch|NetworkError|load failed|: \d{3}$/i.test(error?.message || '');

/** Bộ nạp byte dùng chung cho publication và nguồn dữ liệu, mỗi đường dẫn gọi mạng một lần. */
function byteLoader() {
  const requests = new Map();
  return (path) => {
    const target = path === 'website-display.json' ? '/data/website-display.json' : `/${path}`;
    if (!requests.has(target)) {
      const request = fetch(target).then((response) => {
        if (!response.ok) throw new Error(`${target}: ${response.status}`);
        return response.arrayBuffer();
      });
      requests.set(target, request);
      // Lần tải lỗi không được giữ lại, nếu không nút "Thử lại" sẽ lặp lại đúng lỗi cũ.
      request.catch(() => requests.delete(target));
    }
    return requests.get(target);
  };
}

/**
 * Trang chi tiết một đội khai hoang: build đang chọn + hướng dẫn của team.
 * Selector và hướng dẫn nằm ngoài subtree build để đổi cấu hình không mất focus hoặc đóng mục.
 */
export async function initKhaiHoangDetail({ documentTarget = document } = {}) {
  const root = documentTarget.querySelector('#team-detail-root');
  if (!root) return null;
  const status = documentTarget.querySelector('#team-detail-status');
  const body = documentTarget.querySelector('#team-detail-body');
  const returnLink = documentTarget.querySelector('#team-return-link');
  if (!status || !body) return null;

  const teamId = root.dataset.khaihoangTeamId || '';
  const pinnedSha = (root.dataset.khaihoangSha256 || '').replace(/^sha256:/, '');
  const badges = documentTarget.querySelector('#team-detail-badges');
  const panel = documentTarget.querySelector('#team-detail-panel');
  const panelActions = documentTarget.querySelector('#team-detail-actions');
  let loadBytes = byteLoader();
  const from = new URL(location.href).searchParams.get('from');
  if (returnLink) returnLink.href = returnHrefFor('khaihoang', {from});

  let pending = false;
  let team = null;
  let mount = null;

  /** Nguồn của build đang chọn: chỉ link đã qua kiểm scheme `http(s)`, nhãn lấy từ dữ liệu. */
  const buildSources = (build) => (build?.sources || [])
    .map((source) => ({href: validateHttpSourceUrl(source.url), label: source.label}))
    .filter((source) => source.href);

  /** Đầu trang chi tiết: huy hiệu loại binh của build đang chọn + hành động (nguồn, sao chép link). */
  const paintHeader = (build) => {
    if (badges) {
      const nodes = detailBadges({unitType: build?.unitType ? [build.unitType] : []}, null);
      badges.replaceChildren(...nodes);
      badges.hidden = !nodes.length;
    }
    if (panelActions) panelActions.replaceChildren(detailPanelActions({sources: buildSources(build)}));
    if (panel) panel.hidden = false;
  };

  const requestedVariant = () => new URL(location.href).searchParams.get('variant') || '';
  const variantFor = (variantId) =>
    (variantId ? (team?.variants || []).find((variant) => variant.id === variantId) : null) || null;

  const showLoading = () => {
    root.setAttribute('aria-busy', 'true');
    body.hidden = true;
    status.hidden = false;
    status.replaceChildren(LOADING_MESSAGE);
  };
  const showContent = () => {
    body.hidden = false;
    status.hidden = true;
    status.replaceChildren();
    root.setAttribute('aria-busy', 'false');
  };
  const showError = (message, {actions = [], retryable = true} = {}) => {
    root.setAttribute('aria-busy', 'false');
    body.hidden = true;
    status.hidden = false;
    const retry = retryable ? el('button', {id: 'team-detail-retry', class: 'detail-action', type: 'button'}, 'Thử lại') : null;
    retry?.addEventListener('click', () => { if (!pending) load(); });
    status.replaceChildren(el('div', {class: 'error', role: 'alert'}, [
      el('p', {}, message),
      el('div', {class: 'detail-actions'}, [retry, ...actions].filter(Boolean)),
    ]));
  };

  /** Cấu hình lạ: nói rõ và mở đường về build mặc định, không hiển thị build khác dưới tên đó. */
  const showUnknownVariant = (variantId) => {
    const link = el('a', {
      id: 'team-detail-default-variant', class: 'detail-link',
      href: khaiHoangDetailVariantUrl(location.href, ''),
    }, 'Xem cấu hình mặc định');
    showError(`Cấu hình “${variantId}” không thuộc đội này.`, {actions: [link], retryable: false});
  };

  const applyVariant = (variantId) => {
    const build = variantFor(variantId) || team;
    applyKhaihoangUnit(mount.unit, build);
    mount.content.replaceChildren(...khaihoangBuildContent(build, true));
    paintHeader(build);
    if (mount.select) mount.select.value = variantId;
  };

  /** Đổi cấu hình chỉ thay query `variant` của chính trang, giữ nguyên `from` và phần còn lại. */
  const selectVariant = (variantId) => {
    history.replaceState(history.state, '', khaiHoangDetailVariantUrl(location.href, variantId));
    applyVariant(variantId);
  };

  const buildView = () => {
    const variants = team.variants || [];
    const select = variants.length ? el('select', {
      class: 'kh-variant-select', 'aria-label': `Cấu hình ${team.title}`,
      onchange: (event) => selectVariant(event.target.value),
    }, [
      el('option', {value: ''}, 'Cấu hình mặc định'),
      ...variants.map((variant, index) => el('option', {value: variant.id}, variant.displayLabel || `Cấu hình ${index + 1}`)),
    ]) : null;
    const unit = el('span', {class: 'badge unit'});
    applyKhaihoangUnit(unit, team);
    const content = el('div', {class: 'kh-build', 'aria-live': 'polite'});
    const build = el('div', {class: 'kh-detail-build'}, [
      el('div', {class: 'kh-detail-build-head'}, [unit]),
      select ? el('label', {class: 'kh-variant-control'}, ['Chọn cấu hình', select]) : null,
      content,
    ].filter(Boolean));
    // Hướng dẫn thuộc team và nằm ngoài subtree build: đổi cấu hình không dựng lại phần này.
    body.replaceChildren(...[build, khaihoangGuide(team.guide)].filter(Boolean));
    return {unit, select, content};
  };
  const ensureMount = () => (mount ??= buildView());

  async function load() {
    pending = true;
    // Mỗi lần thử là một lượt mới: bỏ cache byte và view cũ để "Thử lại" thật sự tải lại.
    loadBytes = byteLoader();
    team = null;
    mount = null;
    showLoading();
    try {
      const websitePin = JSON.parse(documentTarget.querySelector('#website-display-publication')?.textContent || 'null');
      const recommendedPin = JSON.parse(documentTarget.querySelector('#recommended-publication')?.textContent || 'null');
      // Pin riêng của trang được kiểm trước: sai nguồn thì báo đúng lý do, không tải tiếp.
      const bytes = asBytes(await loadBytes(KHAIHOANG_SOURCE));
      if (!SOURCE_HASH.test(pinnedSha)) throw new Error(MISSING_PIN_MESSAGE);
      if (await sha256Hex(bytes) !== pinnedSha) throw new Error(CHANGED_SOURCE_MESSAGE);
      const publication = await loadWebsiteDisplay(websitePin, loadBytes, recommendedPin);
      const source = JSON.parse(decoder.decode(bytes));
      const data = localizeData(publication, KHAIHOANG_SOURCE, source);
      const matches = (Array.isArray(data) ? [] : (data.teams || [])).filter((item) => item?.id === teamId);
      if (matches.length !== 1) throw new Error(MISSING_TEAM_MESSAGE);
      team = matches[0];
      const requested = requestedVariant();
      if (requested && !variantFor(requested)) {
        showUnknownVariant(requested);
        return;
      }
      ensureMount();
      applyVariant(requested);
      showContent();
    } catch (error) {
      if (isNetworkError(error)) showError(NETWORK_MESSAGE);
      else showError(VERIFY_FAILURES.has(error?.message) ? error.message : VERIFY_MESSAGE);
    } finally {
      pending = false;
    }
  }

  // Back/Forward sau khi đổi cấu hình phải khớp lại select và build đang hiển thị.
  window.addEventListener('popstate', () => {
    if (pending || !team) return;
    const requested = requestedVariant();
    if (requested && !variantFor(requested)) { showUnknownVariant(requested); return; }
    ensureMount();
    applyVariant(requested);
    showContent();
  });

  await load();
  return {reload: load};
}

initKhaiHoangDetail();
