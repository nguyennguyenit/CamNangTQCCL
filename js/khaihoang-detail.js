// Entry trang chi tiết Khai hoang. Thân trang (build mặc định, điểm, hướng dẫn) do build dựng sẵn; client nhận lại
// DOM đó và gắn chọn phiên bản. Dữ liệu đã pin chỉ được tải, băm và đối chiếu khi thật sự cần: URL xin cấu hình
// khác mặc định (`?variant=`) hoặc người đọc bấm chọn một phiên bản. Không khởi động app gốc và không ghi ngược
// trạng thái danh sách.

import { el, bindKhaihoangConfigRow, khaihoangBuildContent, khaihoangDetailTrees } from './render.js';
import { detailPanelActions, isNetworkError } from './detail-actions.js';
import { detailBadges } from './recommended-reference-render.js';
import { setTacticDisplayName, setZhNameResolver } from './recommended-reference-state.js';
import { khaiHoangDetailVariantUrl, returnHrefFor } from './team-detail-navigation.js';
import { createByteLoader, loadRawNameResolver, loadTacticDisplayName, loadWebsiteDisplay, localizeData } from './website-display.js';
import { L } from './i18n.js';
import { treeToDom } from './view-tree.js';

const KHAIHOANG_SOURCE = 'data/khaihoang.json';
const SOURCE_HASH = /^[0-9a-f]{64}$/;
const LOADING_MESSAGE = L('Đang tải chi tiết…', '正在加载详情…');
const NETWORK_MESSAGE = L('Không tải được chi tiết khai hoang. Hãy kiểm tra kết nối rồi thử lại.', '无法加载开荒详情。请检查网络连接后重试。');
const VERIFY_MESSAGE = L('Không thể xác minh dữ liệu khai hoang. Hãy tải lại trang hoặc quay lại danh sách.', '无法验证开荒数据。请刷新页面或返回列表。');
const MISSING_PIN_MESSAGE = L('Trang chi tiết thiếu mã kiểm tra dữ liệu khai hoang.', '详情页缺少开荒数据的校验码。');
const CHANGED_SOURCE_MESSAGE = L('Dữ liệu khai hoang đã thay đổi so với bản đã phát hành.', '开荒数据与已发布版本不一致。');
const MISSING_TEAM_MESSAGE = L('Không tìm thấy đúng một đội khai hoang với mã này.', '未找到与此编号唯一对应的开荒阵容。');
const VERIFY_FAILURES = new Set([MISSING_PIN_MESSAGE, CHANGED_SOURCE_MESSAGE, MISSING_TEAM_MESSAGE]);

const decoder = new TextDecoder();
const sha256Hex = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map((value) => value.toString(16).padStart(2, '0')).join('');

/**
 * Trang chi tiết một đội khai hoang: phiên bản đang chọn (đội hình + ghi chú), rồi điểm và hướng dẫn của team.
 * Chạm Sứ và quân thủ mỏ là tham khảo chung của cả mục nên chỉ nằm ở trang danh sách. Chỉ khối build bị dựng
 * lại khi đổi phiên bản, nên các khối còn lại không mất focus hay vị trí đọc.
 */
export async function initKhaiHoangDetail({ documentTarget = document } = {}) {
  const root = documentTarget.querySelector('#team-detail-root');
  if (!root) return null;
  const body = documentTarget.querySelector('#team-detail-body');
  const returnLink = documentTarget.querySelector('#team-return-link');
  if (!body) return null;
  // Trạng thái chờ/lỗi chỉ tồn tại khi client thật sự phải tải: build không phát phần tử này.
  const statusNode = () => {
    let node = documentTarget.querySelector('#team-detail-status');
    if (!node) {
      node = el('div', {id: 'team-detail-status', class: 'detail-state', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'});
      body.before(node);
    }
    return node;
  };

  const teamId = root.dataset.khaihoangTeamId || '';
  const pinnedSha = (root.dataset.khaihoangSha256 || '').replace(/^sha256:/, '');
  const badges = documentTarget.querySelector('#team-detail-badges');
  const panel = documentTarget.querySelector('#team-detail-panel');
  const panelActions = documentTarget.querySelector('#team-detail-actions');
  let loadBytes = createByteLoader();
  const from = new URL(location.href).searchParams.get('from');
  if (returnLink) returnLink.href = returnHrefFor('khaihoang', {from});

  let pending = false;
  let team = null;
  let mount = null;

  /** Đầu trang chi tiết: huy hiệu loại binh của build đang chọn + nút sao chép link. */
  const paintHeader = (build) => {
    if (badges) {
      const nodes = detailBadges({unitType: build?.unitType ? [build.unitType] : []}, null);
      badges.replaceChildren(...nodes.map((node) => treeToDom(node)));
      badges.hidden = !nodes.length;
    }
    if (panelActions && !panelActions.childElementCount) panelActions.replaceChildren(detailPanelActions());
    if (panel) panel.hidden = false;
  };

  const requestedVariant = () => new URL(location.href).searchParams.get('variant') || '';
  const variantFor = (variantId) =>
    (variantId ? (team?.variants || []).find((variant) => variant.id === variantId) : null) || null;

  const showLoading = () => {
    const status = statusNode();
    root.setAttribute('aria-busy', 'true');
    body.hidden = true;
    status.hidden = false;
    status.replaceChildren(LOADING_MESSAGE);
  };
  const showContent = () => {
    const status = documentTarget.querySelector('#team-detail-status');
    body.hidden = false;
    body.removeAttribute('data-prerendered');
    if (status) {
      status.hidden = true;
      status.replaceChildren();
    }
    root.setAttribute('aria-busy', 'false');
  };
  const showError = (message, {actions = [], retryable = true} = {}) => {
    const status = statusNode();
    root.setAttribute('aria-busy', 'false');
    // Lỗi xác minh/tải: không để lại nội dung dựng sẵn trong DOM, chỉ còn thông báo.
    body.hidden = true;
    body.replaceChildren();
    if (badges) { badges.replaceChildren(); badges.hidden = true; }
    status.hidden = false;
    const retry = retryable ? el('button', {id: 'team-detail-retry', class: 'detail-action', type: 'button'}, L('Thử lại', '重试')) : null;
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
    }, L('Xem cấu hình mặc định', '查看默认配置'));
    showError(L(`Cấu hình “${variantId}” không thuộc đội này.`, `配置“${variantId}”不属于此阵容。`), {actions: [link], retryable: false});
  };

  const applyVariant = (variantId) => {
    const build = variantFor(variantId) || team;
    mount.content.replaceChildren(...khaihoangBuildContent(build).map((tree) => treeToDom(tree)));
    paintHeader(build);
    for (const chip of mount.chips) chip.setAttribute('aria-pressed', String((chip.dataset.variant || '') === variantId));
  };

  /** Đổi cấu hình chỉ thay query `variant` của chính trang, giữ nguyên `from` và phần còn lại. */
  const selectVariant = async (variantId) => {
    history.replaceState(history.state, '', khaiHoangDetailVariantUrl(location.href, variantId));
    // Thân dựng sẵn chính là cấu hình mặc định: chọn lại "Mặc định" khi chưa tải gì không cần dữ liệu (và không được
    // xoá thân đang hiển thị nếu tải lỗi). Lần chọn một cấu hình khác mới tải và xác minh nguồn đã pin.
    if (!team && !variantId) return;
    if (!team) {
      try { await ensureTeam(); } catch (error) { reportVariantFailure(error); return; }
    }
    // Trong lúc chờ tải, người đọc có thể đã bấm chip khác: dựng theo URL hiện tại, không theo lần bấm cũ.
    applyVariant(requestedVariant());
    showContent();
  };
  /**
   * Chọn phiên bản bằng cùng nhóm chip của thẻ danh sách; loại binh của build chỉ hiện một lần ở đầu trang
   * (`#team-detail-badges`), khối build không lặp lại huy hiệu đó.
   */
  const buildView = () => {
    // Cây dựng ở render.js (cùng cây dùng cho HTML dựng sẵn); ở đây chỉ đổi sang DOM rồi gắn chọn phiên bản.
    // Điểm và hướng dẫn thuộc team, nằm ngoài subtree build: đổi phiên bản không dựng lại.
    const nodes = khaihoangDetailTrees(team).map((tree) => treeToDom(tree));
    body.replaceChildren(...nodes);
    const chips = bindKhaihoangConfigRow(body, selectVariant);
    return {chips, content: body.querySelector('.kh-build')};
  };
  const ensureMount = () => (mount ??= buildView());

  /** Tải, băm và bản địa hoá nguồn đã pin, rồi đặt `team`; lỗi ném lên cho nơi gọi báo. */
  async function fetchTeam() {
    // Mỗi lần thử là một lượt mới: bỏ cache byte cũ để "Thử lại" thật sự tải lại.
    loadBytes = createByteLoader();
    const websitePin = JSON.parse(documentTarget.querySelector('#website-display-publication')?.textContent || 'null');
    const recommendedPin = JSON.parse(documentTarget.querySelector('#recommended-publication')?.textContent || 'null');
    // Pin riêng của trang được kiểm trước: sai nguồn thì báo đúng lý do, không tải tiếp.
    const bytes = await loadBytes(KHAIHOANG_SOURCE);
    if (!SOURCE_HASH.test(pinnedSha)) throw new Error(MISSING_PIN_MESSAGE);
    if (await sha256Hex(bytes) !== pinnedSha) throw new Error(CHANGED_SOURCE_MESSAGE);
    const publication = await loadWebsiteDisplay(websitePin, loadBytes, recommendedPin, {paths: [KHAIHOANG_SOURCE]});
    const source = JSON.parse(decoder.decode(bytes));
    const data = localizeData(publication, KHAIHOANG_SOURCE, source);
    // Bản Trung: tên Hán-Việt của build tra ngược về chữ Hán; từ điển lỗi chỉ làm tên lùi về Hán-Việt.
    const rawNames = await loadRawNameResolver(loadBytes).catch(() => null);
    if (rawNames) setZhNameResolver(rawNames);
    setTacticDisplayName(await loadTacticDisplayName(loadBytes).catch(() => null));
    const matches = (Array.isArray(data) ? [] : (data.teams || [])).filter((item) => item?.id === teamId);
    if (matches.length !== 1) throw new Error(MISSING_TEAM_MESSAGE);
    team = matches[0];
  }

  let teamLoad = null;
  /** Một lượt tải dùng chung cho nhiều lần bấm liên tiếp. */
  const ensureTeam = () => (teamLoad ??= fetchTeam().finally(() => { teamLoad = null; }));

  const failureMessage = (error) => (isNetworkError(error)
    ? NETWORK_MESSAGE
    : VERIFY_FAILURES.has(error?.message) ? error.message : VERIFY_MESSAGE);
  const reportLoadFailure = (error) => showError(failureMessage(error));

  /**
   * Bấm chip mà tải lỗi: thân dựng sẵn (cấu hình mặc định, đã phát cùng bản build) vẫn đúng nên giữ nguyên; URL quay về
   * mặc định cho khớp nội dung đang hiện, chỉ báo lỗi ở dòng trạng thái. Bấm lại chip là thử lại.
   */
  const reportVariantFailure = (error) => {
    history.replaceState(history.state, '', khaiHoangDetailVariantUrl(location.href, ''));
    const status = statusNode();
    status.hidden = false;
    status.replaceChildren(el('p', {class: 'error', role: 'alert'}, failureMessage(error)));
  };

  /** Dựng toàn bộ thân từ nguồn đã pin (URL xin cấu hình khác mặc định, hoặc "Thử lại" sau lỗi). */
  async function load() {
    pending = true;
    team = null;
    mount = null;
    showLoading();
    try {
      await fetchTeam();
      const requested = requestedVariant();
      if (requested && !variantFor(requested)) {
        showUnknownVariant(requested);
        return;
      }
      ensureMount();
      applyVariant(requested);
      showContent();
    } catch (error) {
      reportLoadFailure(error);
    } finally {
      pending = false;
    }
  }

  /** Thân, điểm và hướng dẫn đã có trong HTML ở cấu hình mặc định: chỉ gắn chọn phiên bản và nút sao chép liên kết. */
  function adoptPrerendered() {
    mount = {chips: bindKhaihoangConfigRow(body, selectVariant), content: body.querySelector('.kh-build')};
    if (panelActions) panelActions.replaceChildren(detailPanelActions());
    if (panel) panel.hidden = false;
    showContent();
  }

  // Back/Forward sau khi đổi cấu hình phải khớp lại select và build đang hiển thị.
  window.addEventListener('popstate', () => {
    if (pending) return;
    const requested = requestedVariant();
    // Chưa tải dữ liệu nghĩa là DOM dựng sẵn (mặc định) còn nguyên: chỉ cần tải khi URL xin cấu hình khác.
    if (!team) {
      if (requested) load();
      return;
    }
    if (requested && !variantFor(requested)) { showUnknownVariant(requested); return; }
    ensureMount();
    applyVariant(requested);
    showContent();
  });

  if (requestedVariant()) await load();
  else adoptPrerendered();
  return {reload: load};
}

initKhaiHoangDetail();
