// Khu "AI" (#ai) của /quan-tri/ — artboard AdminAIFeatures (+ Mobile). Một bản ghi `ai:config`, nút Lưu (đầu khu và
// thanh cuối) ghi cả hai phần cùng lúc:
// - Nhà cung cấp: endpoint + API key dùng chung; model = catalog của mẫu (server trả `presets`) + model tự thêm.
// - Tính năng: bốn nhóm, mỗi nhóm một chuỗi failover (nhà cung cấp, model, effort) kèm timeout mỗi lượt và
//   trần tổng thời gian. Mắt xích trên lỗi (sai key, hết tiền, quá tải, máy chủ lỗi) thì chuyển mắt xích kế.
//   Đầu phần có 4 thẻ tóm tắt (desktop); mỗi nhóm một thẻ — ≤680px thẻ nhóm thu gọn được (nút `aria-expanded`).
// Trạng thái "Chạy được / Báo lỗi" suy từ chính cấu hình đang sửa: nhóm chạy được khi còn ít nhất một mắt xích hợp lệ
// dùng nhà cung cấp đang bật. Server không bao giờ trả key — chỉ 4 ký tự cuối; ô key để trống khi sửa = giữ key cũ.
// Module không có hiệu ứng khi nạp: chỉ community-admin.js gọi `openAiPanel` (import vòng an toàn).

import { L } from './i18n.js';
import { el } from './render.js';
import { api, describeError } from './community-api.js';
import { adminIconStatus, button, formField, glyph, selectInput, textInput } from './community-admin.js';

const AI_MAX_PROVIDERS = 10;
const AI_MAX_EXTRA_MODELS = 20;
const AI_MAX_CHAIN = 10;
/** Giới hạn (giây) khớp shared/ai-config.ts: timeout mỗi lượt 5–120, trần tổng timeout–180. */
const AI_MIN_TIMEOUT_S = 5;
const AI_MAX_TIMEOUT_S = 120;
const AI_MAX_BUDGET_S = 180;
/** Cùng mốc với CSS khu quản trị: dưới mốc này thẻ nhóm thu gọn được và chuỗi xếp dọc. */
const NARROW_QUERY = '(max-width: 680px)';

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function effortLabel(level) {
  switch (level) {
    case 'off': return L('Tắt suy luận', '关闭思考');
    case 'none': return L('Không suy luận', '不推理');
    case 'low': return L('Thấp', '低');
    case 'medium': return L('Vừa', '中');
    case 'high': return L('Cao', '高');
    case 'max': return L('Tối đa', '最高');
    case 'default': return L('Mặc định của model', '模型默认');
    default: return level;
  }
}

function effortStyleLabel(style) {
  if (style === 'deepseek') return 'DeepSeek (thinking + reasoning_effort)';
  if (style === 'openai') return 'OpenAI (reasoning_effort)';
  return L('Không có tham số suy luận', '无推理参数');
}

const iconButton = (action, iconName, label) =>
  el('button', { class: 'ana-btn adm-icon-btn', type: 'button', dataset: { action }, 'aria-label': label }, glyph(iconName));

const seconds = (ms) => String(Math.round(ms / 1000));

export function openAiPanel(panel, { actions }) {
  const status = adminIconStatus();
  const GROUPS = [
    { id: 'teamScan', label: L('Soi đội từ ảnh', '看图识阵') },
    { id: 'rosterRecommend', label: L('Gợi ý đội (quét tướng, chiến pháp, đội đã build)', '阵容推荐（扫描武将、战法、已配队伍）') },
    { id: 'explainSubstitute', label: L('Giải thích món bù', '替代战法说明') },
    { id: 'battleReport', label: L('Đọc ảnh chiến báo', '识别战报图片') },
  ];
  const narrow = window.matchMedia(NARROW_QUERY);
  const warning = el('p', { class: 'cm-notice', hidden: '' }, L(
    'Chưa tính năng nào có mắt xích chạy được — mọi tính năng AI đang tạm dừng.',
    '没有任何功能有可用的链节——所有 AI 功能已暂停。',
  ));
  const list = el('ol', { class: 'adm-ai-providers', 'aria-labelledby': 'cm-ai-providers-title' });
  const editorSlot = el('div', { class: 'adm-editor-slot' });
  const summaryList = el('ul', { class: 'adm-ai-summary', 'aria-label': L('Tình trạng từng tính năng', '各功能状态') });
  const groupsNode = el('div', { class: 'adm-groups' });
  // Chưa tải được cấu hình thì không cho Thêm/Lưu (tránh ghi đè cấu hình thật bằng cấu hình rỗng).
  const addButton = button(L('Thêm nhà cung cấp', '添加服务商'), { iconName: 'plus', disabled: '' });
  const saveButtons = [0, 1].map(() => button(L('Lưu', '保存'), { variant: 'primary', disabled: '' }));
  const setSaveDisabled = (disabled) => saveButtons.forEach((node) => { node.disabled = disabled; });
  // Dữ liệu server (catalog mẫu, mức effort theo kiểu, nhóm cần ảnh) + bản đang sửa, giữ trong bộ nhớ tới lần Lưu.
  let presets = [];
  let effortLevels = {};
  let needsVision = {};
  // Mỗi nhà cung cấp: dữ liệu server (keyLast4) + `apiKey` vừa gõ.
  let items = [];
  let groups = {};
  // Nhà cung cấp đang mở khung sửa (thẻ được viền son).
  let editingId = null;
  // Nhóm đang mở ở bề rộng hẹp (thẻ thu gọn); mặc định mở nhóm đầu như artboard.
  const expanded = new Set([GROUPS[0].id]);
  // Dòng tóm tắt "N mắt xích · … trần X s" đang hiện, cập nhật tại chỗ khi gõ timeout/trần (không vẽ lại ô đang gõ).
  const summaryTexts = new Map();

  const markDirty = (extra = '') => status.set(`${extra}${L('Có thay đổi chưa lưu — bấm Lưu để áp dụng.', '有未保存的更改——点击“保存”后生效。')}`, 'warn');
  const modelsOf = (item) => [...(presets.find((p) => p.id === item.preset)?.models ?? []), ...item.extraModels];
  const eligibleModels = (item, groupId) => modelsOf(item).filter((m) => !needsVision[groupId] || m.vision);
  /** Mắt xích trỏ tới model/effort còn hợp lệ cho nhóm (nhà cung cấp tắt vẫn hợp lệ, chỉ không chạy). */
  const linkModel = (link, groupId) => {
    const item = items.find((p) => p.id === link.providerId);
    const model = item && eligibleModels(item, groupId).find((m) => m.modelId === link.modelId);
    return model && model.efforts.includes(link.effort) ? { item, model } : null;
  };
  const groupRuns = (groupId) => groups[groupId].chain.some((link) => linkModel(link, groupId)?.item.enabled);

  /** Dòng tóm tắt của nhóm: thẻ tóm tắt desktop bỏ timeout, đầu thẻ thu gọn (mobile) có đủ. */
  const describeGroup = (groupId, { withTimeout = false } = {}) => {
    const { chain, timeoutMs, budgetMs } = groups[groupId];
    const links = L(`${chain.length} mắt xích`, `${chain.length} 个链节`);
    const timeout = withTimeout ? ` · ${L('timeout', '超时')} ${seconds(timeoutMs)} s` : '';
    return `${links}${timeout} · ${L('trần', '总时限')} ${seconds(budgetMs)} s`;
  };
  const refreshSummaries = (groupId) => {
    for (const [node, withTimeout] of summaryTexts.get(groupId) ?? []) node.textContent = describeGroup(groupId, { withTimeout });
  };
  const addSummaryText = (groupId, node, withTimeout) => {
    if (!summaryTexts.has(groupId)) summaryTexts.set(groupId, []);
    summaryTexts.get(groupId).push([node, withTimeout]);
    node.textContent = describeGroup(groupId, { withTimeout });
    return node;
  };

  /** Sau khi sửa/xoá nhà cung cấp: bỏ mắt xích không còn model, đưa effort không còn hợp lệ về mức đầu. Trả số mắt xích bị bỏ. */
  const pruneLinks = () => {
    let dropped = 0;
    for (const { id } of GROUPS) {
      groups[id].chain = groups[id].chain.filter((link) => {
        const item = items.find((p) => p.id === link.providerId);
        const model = item && eligibleModels(item, id).find((m) => m.modelId === link.modelId);
        if (!model) {
          dropped += 1;
          return false;
        }
        if (!model.efforts.includes(link.effort)) link.effort = model.efforts[0];
        return true;
      });
    }
    return dropped;
  };
  const droppedNote = (count) => (count ? L(`Đã bỏ ${count} mắt xích không còn model. `, `已移除 ${count} 个失去模型的链节。`) : '');

  /* ---------- Nhà cung cấp ---------- */

  const paintProviders = (focusSelector) => {
    const last = items.length - 1;
    list.replaceChildren(...items.map((item, index) => {
      const up = iconButton('up', 'up', L(`Đưa ${item.label} lên trên`, `上移 ${item.label}`));
      const down = iconButton('down', 'down', L(`Đưa ${item.label} xuống dưới`, `下移 ${item.label}`));
      up.disabled = index === 0;
      down.disabled = index === last;
      const toggle = button(item.enabled ? L('Tắt', '停用') : L('Bật', '启用'), { compact: true, dataset: { action: 'toggle' } });
      const edit = button(L('Sửa', '编辑'), { compact: true, dataset: { action: 'edit' } });
      const remove = button(L('Xoá', '删除'), { variant: 'adm-btn-danger', compact: true, dataset: { action: 'remove' } });
      const move = (to) => {
        [items[index], items[to]] = [items[to], items[index]];
        markDirty();
        paint(`[data-index="${to}"] [data-action="${to < index ? 'up' : 'down'}"]:not(:disabled), [data-index="${to}"] [data-action="edit"]`);
      };
      up.addEventListener('click', () => move(index - 1));
      down.addEventListener('click', () => move(index + 1));
      toggle.addEventListener('click', () => {
        item.enabled = !item.enabled;
        markDirty();
        paint(`[data-index="${index}"] [data-action="toggle"]`);
      });
      edit.addEventListener('click', () => openEditor(index));
      remove.addEventListener('click', () => {
        items.splice(index, 1);
        markDirty(droppedNote(pruneLinks()));
        paint(items.length ? `[data-index="${Math.min(index, items.length - 1)}"] [data-action="edit"]` : null);
        if (!items.length) addButton.focus();
      });
      const key = item.apiKey ? L('Key mới (chưa lưu)', '新密钥（未保存）') : `${L('Key', '密钥')} ••••${item.keyLast4 || ''}`;
      const presetLabel = presets.find((p) => p.id === item.preset)?.label ?? L('Tùy chỉnh', '自定义');
      const facts = [presetLabel, L(`${modelsOf(item).length} model`, `${modelsOf(item).length} 个模型`), key].join(' · ');
      const row = el('li', { class: 'adm-ai-provider', dataset: { index: String(index), enabled: String(item.enabled) } }, [
        el('div', { class: 'adm-ai-provider-info' }, [
          el('span', { class: 'adm-ai-rank', 'aria-hidden': 'true' }, String(index + 1)),
          el('div', { class: 'adm-ai-provider-body' }, [
            el('p', { class: 'adm-ai-provider-line' }, [
              el('span', { class: 'adm-ai-provider-name' }, [el('span', { class: 'visually-hidden' }, `${index + 1}. `), item.label]),
              el('span', { class: 'cm-badge', dataset: { status: item.enabled ? 'approved' : '' } }, item.enabled ? L('Đang bật', '已启用') : L('Đang tắt', '已停用')),
              el('span', { class: 'adm-ai-provider-facts' }, facts),
            ]),
            el('code', { class: 'adm-endpoint' }, item.endpoint),
          ]),
        ]),
        el('div', { class: 'adm-row-actions' }, [up, down, toggle, edit, remove]),
      ]);
      if (item.id === editingId) row.dataset.editing = '';
      return row;
    }));
    addButton.disabled = items.length >= AI_MAX_PROVIDERS;
    if (focusSelector) list.querySelector(focusSelector)?.focus();
  };

  /* ---------- Tính năng ---------- */

  function linkRow(groupId, link, index) {
    const chain = groups[groupId].chain;
    const prefix = `cm-ai-${groupId}-${index}`;
    const focusOf = (field) => `[data-group="${groupId}"] [data-link="${index}"] [data-field="${field}"]`;
    const item = items.find((p) => p.id === link.providerId);
    const models = item ? eligibleModels(item, groupId) : [];
    const model = models.find((m) => m.modelId === link.modelId);
    // Chỉ liệt kê nhà cung cấp có model hợp nhóm (giữ mục đang chọn để không mất lựa chọn cũ).
    const providerSelect = selectInput(
      `${prefix}-provider`,
      items
        .filter((p) => p.id === link.providerId || eligibleModels(p, groupId).length)
        .map((p) => [p.id, p.enabled ? p.label : `${p.label} (${L('đang tắt', '已停用')})`]),
      link.providerId,
      { dataset: { field: 'provider' } },
    );
    const modelSelect = selectInput(`${prefix}-model`, models.map((m) => [m.modelId, m.modelId]), link.modelId, { class: 'cm-select adm-mono', dataset: { field: 'model' } });
    const effortSelect = selectInput(`${prefix}-effort`, (model?.efforts ?? []).map((e) => [e, effortLabel(e)]), link.effort, { dataset: { field: 'effort' } });
    providerSelect.addEventListener('change', () => {
      const first = eligibleModels(items.find((p) => p.id === providerSelect.value), groupId)[0];
      Object.assign(link, { providerId: providerSelect.value, modelId: first?.modelId ?? '', effort: first?.efforts[0] ?? '' });
      markDirty();
      paintGroups(focusOf('provider'));
    });
    modelSelect.addEventListener('change', () => {
      const next = models.find((m) => m.modelId === modelSelect.value);
      link.modelId = next.modelId;
      if (!next.efforts.includes(link.effort)) link.effort = next.efforts[0];
      markDirty();
      paintGroups(focusOf('model'));
    });
    effortSelect.addEventListener('change', () => {
      link.effort = effortSelect.value;
      markDirty();
    });
    const up = iconButton('up', 'up', L(`Đưa mắt xích ${index + 1} lên trên`, `上移第 ${index + 1} 环`));
    const down = iconButton('down', 'down', L(`Đưa mắt xích ${index + 1} xuống dưới`, `下移第 ${index + 1} 环`));
    const remove = button(L('Bỏ', '移除'), {
      variant: 'adm-btn-danger', compact: true, dataset: { action: 'remove' }, 'aria-label': L(`Bỏ mắt xích ${index + 1}`, `移除第 ${index + 1} 环`),
    });
    up.disabled = index === 0;
    down.disabled = index === chain.length - 1;
    const move = (to) => {
      [chain[index], chain[to]] = [chain[to], chain[index]];
      markDirty();
      const row = `[data-group="${groupId}"] [data-link="${to}"]`;
      paintGroups();
      (groupsNode.querySelector(`${row} [data-action="${to < index ? 'up' : 'down'}"]:not(:disabled)`)
        ?? groupsNode.querySelector(`${row} [data-field="provider"]`))?.focus();
    };
    up.addEventListener('click', () => move(index - 1));
    down.addEventListener('click', () => move(index + 1));
    remove.addEventListener('click', () => {
      chain.splice(index, 1);
      markDirty();
      paintGroups(chain.length ? `[data-group="${groupId}"] [data-link="${Math.min(index, chain.length - 1)}"] [data-field="provider"]` : `[data-group="${groupId}"] [data-action="add-link"]`);
    });
    // Nhãn ô: desktop ẩn (đầu cột thay), mobile hiện phần chính; phần "của mắt xích N" luôn chỉ cho trình đọc màn hình.
    const field = (id, text, control) => el('div', { class: 'adm-field' }, [
      el('label', { class: 'adm-label adm-ai-link-label', for: id }, [text, el('span', { class: 'visually-hidden' }, ` ${L(`của mắt xích ${index + 1}`, `（第 ${index + 1} 环）`)}`)]),
      control,
    ]);
    const disabledProvider = item && !item.enabled;
    return el('li', { class: 'adm-ai-link', dataset: { link: String(index) } }, [
      el('div', { class: 'adm-ai-link-row' }, [
        el('div', { class: 'adm-ai-link-head' }, [
          el('span', { class: 'adm-ai-link-index', 'aria-hidden': 'true' }, String(index + 1)),
          el('span', { class: 'adm-ai-link-name', 'aria-hidden': 'true' }, L(`Mắt xích ${index + 1}`, `第 ${index + 1} 环`)),
        ]),
        field(`${prefix}-provider`, L('Nhà cung cấp', '服务商'), providerSelect),
        field(`${prefix}-model`, L('Model', '模型'), modelSelect),
        field(`${prefix}-effort`, L('Effort', '推理强度'), effortSelect),
        el('div', { class: 'adm-row-actions adm-ai-link-actions' }, [up, down, remove]),
      ]),
      disabledProvider
        ? el('p', { class: 'adm-ai-link-warning' }, [glyph('warning', 14), L(
          'Nhà cung cấp đang tắt: mắt xích này bị bỏ qua khi chạy.',
          '服务商已停用：运行时将跳过此链节。',
        )])
        : null,
    ]);
  }

  /** Dòng nối giữa hai mắt xích (chỉ để nhìn; thứ tự đã nằm trong danh sách có số). */
  const connector = (next) => el('li', { class: 'adm-ai-connector', 'aria-hidden': 'true' }, [
    glyph('arrowDown', 14),
    L(`Lỗi hoặc hết timeout thì thử mắt xích ${next}`, `出错或超时则尝试第 ${next} 环`),
  ]);

  const visionNote = (id) => (needsVision[id]
    ? el('span', { class: 'adm-ai-vision' }, [glyph('image', 14), L('Chỉ model nhận ảnh', '仅支持图片的模型')])
    : el('span', { class: 'adm-ai-vision' }, L('Chỉ gửi văn bản', '仅发送文本')));

  const runBadge = (runs, { short = false } = {}) => el('span', { class: 'cm-badge', dataset: { status: runs ? 'approved' : 'rejected' } }, runs
    ? L('Chạy được', '可运行')
    : short ? L('Báo lỗi', '报错') : L('Chưa cấu hình — tính năng báo lỗi', '未配置——功能将报错'));

  function groupSection({ id, label }) {
    const group = groups[id];
    const titleId = `cm-ai-group-${id}-title`;
    const bodyId = `cm-ai-group-${id}-body`;
    const runs = groupRuns(id);
    const collapsible = narrow.matches;
    const open = !collapsible || expanded.has(id);
    const timeout = textInput(`cm-ai-${id}-timeout`, seconds(group.timeoutMs), {
      type: 'number', inputmode: 'numeric', min: String(AI_MIN_TIMEOUT_S), max: String(AI_MAX_TIMEOUT_S), step: '1', dataset: { field: 'timeout' },
    });
    const budget = textInput(`cm-ai-${id}-budget`, seconds(group.budgetMs), {
      type: 'number', inputmode: 'numeric', min: String(AI_MIN_TIMEOUT_S), max: String(AI_MAX_BUDGET_S), step: '1', dataset: { field: 'budget' },
    });
    timeout.addEventListener('input', () => {
      group.timeoutMs = Number(timeout.value) * 1000;
      timeout.removeAttribute('aria-invalid');
      refreshSummaries(id);
      markDirty();
    });
    budget.addEventListener('input', () => {
      group.budgetMs = Number(budget.value) * 1000;
      budget.removeAttribute('aria-invalid');
      refreshSummaries(id);
      markDirty();
    });
    const firstChoice = () => {
      // Ưu tiên nhà cung cấp đang bật có model hợp nhóm.
      const ordered = [...items.filter((p) => p.enabled), ...items.filter((p) => !p.enabled)];
      for (const item of ordered) {
        const model = eligibleModels(item, id)[0];
        if (model) return { providerId: item.id, modelId: model.modelId, effort: model.efforts[0] };
      }
      return null;
    };
    const add = button(L('Thêm mắt xích', '添加链节'), { iconName: 'plus', compact: true, dataset: { action: 'add-link' } });
    add.disabled = group.chain.length >= AI_MAX_CHAIN || !firstChoice();
    add.addEventListener('click', () => {
      group.chain.push(firstChoice());
      markDirty();
      paintGroups(`[data-group="${id}"] [data-link="${group.chain.length - 1}"] [data-field="provider"]`);
    });
    const copy = button(L('Áp cho mọi nhóm', '应用到所有功能'), { variant: 'adm-btn-link', compact: true, dataset: { action: 'copy' } });
    copy.addEventListener('click', () => {
      let dropped = 0;
      for (const other of GROUPS) {
        if (other.id === id) continue;
        const chain = group.chain.filter((link) => linkModel(link, other.id)).map((link) => ({ ...link }));
        dropped += group.chain.length - chain.length;
        groups[other.id] = { chain, timeoutMs: group.timeoutMs, budgetMs: group.budgetMs };
      }
      const skipped = dropped ? L(`Bỏ ${dropped} mắt xích không hợp lệ ở nhóm đích (vd model không nhận ảnh). `, `跳过 ${dropped} 个在目标功能中无效的链节（如模型不支持图片）。`) : '';
      markDirty(`${L('Đã áp chuỗi này cho mọi nhóm. ', '已将此链应用到所有功能。')}${skipped}`);
      paintGroups(`[data-group="${id}"] [data-action="copy"]`);
    });

    // Đầu thẻ: desktop là tiêu đề + badge + ghi chú ảnh; mobile là nút thu gọn chứa thêm dòng tóm tắt.
    const head = collapsible
      ? el('h4', { id: titleId, class: 'adm-ai-group-title' }, el('button', {
        class: 'adm-ai-group-toggle', type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyId, dataset: { action: 'toggle-group' },
      }, [
        el('span', { class: 'adm-ai-group-toggle-text' }, [
          el('span', { class: 'adm-ai-group-name' }, label),
          el('span', { class: 'adm-ai-group-state' }, [runBadge(runs), addSummaryText(id, el('span', { class: 'adm-ai-group-summary' }), true)]),
          visionNote(id),
        ]),
        el('span', { class: 'adm-ai-group-chevron', 'aria-hidden': 'true' }, glyph(open ? 'chevronUp' : 'chevronDown', 18)),
      ]))
      : el('div', { class: 'adm-ai-group-head' }, [
        el('h4', { id: titleId, class: 'adm-ai-group-title', tabindex: '-1' }, label),
        runBadge(runs),
        visionNote(id),
      ]);
    head.querySelector('[data-action="toggle-group"]')?.addEventListener('click', () => {
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      paintGroups(`[data-group="${id}"] [data-action="toggle-group"]`);
    });

    const links = [];
    group.chain.forEach((link, index) => {
      if (index > 0) links.push(connector(index + 1));
      links.push(linkRow(id, link, index));
    });
    const body = el('div', { id: bodyId, class: 'adm-ai-group-body', hidden: open ? null : '' }, [
      group.chain.length && !collapsible
        ? el('div', { class: 'adm-ai-chain-head', 'aria-hidden': 'true' }, [
          el('span', {}),
          el('span', {}, L('Nhà cung cấp', '服务商')),
          el('span', {}, L('Model', '模型')),
          el('span', {}, L('Effort', '推理强度')),
          el('span', {}),
        ])
        : null,
      group.chain.length ? el('ol', { class: 'adm-ai-chain', 'aria-label': L(`Chuỗi của ${label}`, `${label} 的调用链`) }, links) : null,
      el('div', { class: 'adm-ai-group-foot' }, [
        el('div', { class: 'adm-ai-timing' }, [
          el('div', { class: 'adm-ai-timing-fields' }, [
            formField(`cm-ai-${id}-timeout`, L('Timeout mỗi lượt (giây)', '单次超时（秒）'), timeout),
            formField(`cm-ai-${id}-budget`, L('Trần tổng (giây)', '总时限（秒）'), budget),
          ]),
          el('p', { class: 'adm-hint' }, L(
            `Mỗi lượt ${AI_MIN_TIMEOUT_S}–${AI_MAX_TIMEOUT_S} giây; trần tổng không nhỏ hơn timeout, tối đa ${AI_MAX_BUDGET_S}.`,
            `单次 ${AI_MIN_TIMEOUT_S}–${AI_MAX_TIMEOUT_S} 秒；总时限不小于单次超时，最多 ${AI_MAX_BUDGET_S}。`,
          )),
        ]),
        el('div', { class: 'adm-actions' }, [add, copy]),
      ]),
    ]);
    return el('section', {
      id: `cm-ai-group-${id}`, class: 'adm-ai-group', dataset: { group: id, runs: String(runs) }, 'aria-labelledby': titleId,
    }, [head, body]);
  }

  /**
   * Thẻ tóm tắt là nút (không phải link): bấm thì cuộn tới thẻ nhóm và đưa focus vào tiêu đề. Không dùng hash vì hash
   * dành cho khu quản trị — mở link `#cm-ai-group-…` ở tab mới sẽ rơi về khu đầu.
   */
  function summaryCard({ id, label }) {
    const runs = groupRuns(id);
    const card = el('button', {
      class: 'adm-ai-summary-card', type: 'button', 'aria-controls': `cm-ai-group-${id}`, dataset: { runs: String(runs) },
    }, [
      el('span', { class: 'adm-ai-summary-name' }, label),
      el('span', { class: 'adm-ai-summary-state' }, [runBadge(runs, { short: true }), addSummaryText(id, el('span', {}), false)]),
    ]);
    card.addEventListener('click', () => {
      const title = groupsNode.querySelector(`#cm-ai-group-${id}-title`);
      title?.scrollIntoView({ block: 'start' });
      title?.focus();
    });
    return el('li', {}, card);
  }

  const paintGroups = (focusSelector) => {
    summaryTexts.clear();
    summaryList.replaceChildren(...GROUPS.map(summaryCard));
    summaryList.hidden = narrow.matches;
    groupsNode.replaceChildren(...GROUPS.map(groupSection));
    warning.hidden = GROUPS.some(({ id }) => groupRuns(id));
    if (focusSelector) groupsNode.querySelector(focusSelector)?.focus();
  };

  const paint = (focusSelector) => {
    paintProviders(focusSelector);
    paintGroups();
  };

  const load = (body) => {
    presets = Array.isArray(body?.presets) ? body.presets : [];
    effortLevels = body?.effortLevels ?? {};
    needsVision = body?.groupNeedsVision ?? {};
    items = (Array.isArray(body?.providers) ? body.providers : []).map((p) => ({
      id: String(p.id),
      label: String(p.label ?? ''),
      preset: String(p.preset ?? ''),
      endpoint: String(p.endpoint ?? ''),
      enabled: p.enabled === true,
      extraModels: Array.isArray(p.extraModels) ? p.extraModels.map((m) => ({ ...m, efforts: [...m.efforts] })) : [],
      keyLast4: typeof p.keyLast4 === 'string' ? p.keyLast4 : '',
      apiKey: '',
    }));
    groups = Object.fromEntries(GROUPS.map(({ id }) => {
      const g = body?.groups?.[id];
      return [id, {
        chain: Array.isArray(g?.chain) ? g.chain.map((link) => ({ ...link })) : [],
        timeoutMs: g?.timeoutMs ?? 45_000,
        budgetMs: g?.budgetMs ?? 45_000,
      }];
    }));
    setSaveDisabled(false);
    paint();
  };

  /* ---------- Khung sửa nhà cung cấp ---------- */

  function extraModelRow(extras, model, index, repaint) {
    const prefix = `cm-ai-extra-${index}`;
    const modelId = textInput(`${prefix}-id`, model.modelId, { mono: true, maxlength: '120', spellcheck: 'false' });
    modelId.addEventListener('input', () => {
      model.modelId = modelId.value.trim();
    });
    const vision = el('input', { id: `${prefix}-vision`, type: 'checkbox' });
    vision.checked = model.vision;
    vision.addEventListener('change', () => {
      model.vision = vision.checked;
    });
    const style = selectInput(`${prefix}-style`, Object.keys(effortLevels).map((s) => [s, effortStyleLabel(s)]), model.effortStyle);
    style.addEventListener('change', () => {
      model.effortStyle = style.value;
      model.efforts = [...effortLevels[style.value]];
      repaint(`#${prefix}-style`);
    });
    const efforts = (effortLevels[model.effortStyle] ?? []).map((level) => {
      const box = el('input', { id: `${prefix}-effort-${level}`, type: 'checkbox' });
      box.checked = model.efforts.includes(level);
      box.addEventListener('change', () => {
        model.efforts = effortLevels[model.effortStyle].filter((l) => (l === level ? box.checked : model.efforts.includes(l)));
      });
      return el('label', { class: 'adm-check', for: box.id }, [box, effortLabel(level)]);
    });
    const remove = button(L('Bỏ', '移除'), { variant: 'adm-btn-danger', compact: true, 'aria-label': L(`Bỏ model ${index + 1}`, `移除模型 ${index + 1}`) });
    remove.addEventListener('click', () => {
      extras.splice(index, 1);
      repaint(extras.length ? `#cm-ai-extra-${Math.min(index, extras.length - 1)}-id` : '#cm-ai-extra-add');
    });
    return el('li', { class: 'adm-model-row' }, [
      formField(`${prefix}-id`, L('Model id', '模型 ID'), modelId),
      formField(`${prefix}-style`, L('Kiểu tham số suy luận', '推理参数类型'), style),
      el('fieldset', { class: 'adm-efforts' }, [el('legend', { class: 'adm-label' }, L('Mức effort nhận được', '支持的推理强度')), ...efforts]),
      el('label', { class: 'adm-check', for: vision.id }, [vision, L('Nhận ảnh', '支持图片')]),
      el('div', { class: 'adm-row-actions' }, [remove]),
    ]);
  }

  function openEditor(index) {
    const current = index == null ? null : items[index];
    const initialPreset = current ? presets.find((p) => p.id === current.preset) : presets[0];
    const presetSelect = selectInput(
      'cm-ai-preset',
      [...presets.map((p) => [p.id, p.label]), ['', L('Tùy chỉnh', '自定义')]],
      initialPreset ? initialPreset.id : '',
    );
    const label = textInput('cm-ai-label', current ? current.label : initialPreset?.label, { maxlength: '80', required: '' });
    const endpoint = textInput('cm-ai-endpoint', current ? current.endpoint : initialPreset?.endpoint, {
      mono: true, type: 'url', inputmode: 'url', maxlength: '500', required: '', spellcheck: 'false',
    });
    const apiKey = textInput('cm-ai-key', '', {
      type: 'password', autocomplete: 'new-password', maxlength: '500', spellcheck: 'false',
      placeholder: current ? L(`Để trống để giữ key cũ (••••${current.keyLast4 || ''})`, `留空则保留原密钥（••••${current.keyLast4 || ''}）`) : '',
    });
    const enabled = el('input', { id: 'cm-ai-enabled', type: 'checkbox' });
    enabled.checked = current ? current.enabled : true;
    const catalogTitle = el('h4', { id: 'cm-ai-catalog-title', class: 'adm-label' }, L('Model sẵn có', '内置模型'));
    const catalog = el('ul', { class: 'adm-catalog', 'aria-labelledby': 'cm-ai-catalog-title' });
    const paintPreset = () => {
      const preset = presets.find((p) => p.id === presetSelect.value);
      endpoint.readOnly = Boolean(preset);
      catalogTitle.hidden = !preset;
      catalog.replaceChildren(...(preset?.models ?? []).map((m) => el('li', {}, [
        el('code', {}, m.modelId),
        ` · ${m.vision ? L('nhận ảnh', '支持图片') : L('chỉ văn bản', '仅文本')} · ${m.efforts.map(effortLabel).join(', ')}`,
      ])));
    };
    presetSelect.addEventListener('change', () => {
      const preset = presets.find((p) => p.id === presetSelect.value);
      if (preset) {
        endpoint.value = preset.endpoint;
        // Chỉ thay nhãn khi đang để trống hoặc còn là nhãn của mẫu khác.
        if (!label.value.trim() || presets.some((p) => p.label === label.value.trim())) label.value = preset.label;
      }
      paintPreset();
    });
    paintPreset();

    const extras = current ? current.extraModels.map((m) => ({ ...m, efforts: [...m.efforts] })) : [];
    const extrasList = el('ul', { class: 'adm-chain', 'aria-labelledby': 'cm-ai-extra-title' });
    const addExtra = button(L('Thêm model', '添加模型'), { iconName: 'plus', compact: true, id: 'cm-ai-extra-add' });
    const paintExtras = (focusSelector) => {
      extrasList.replaceChildren(...extras.map((model, i) => extraModelRow(extras, model, i, paintExtras)));
      addExtra.disabled = extras.length >= AI_MAX_EXTRA_MODELS;
      if (focusSelector) form.querySelector(focusSelector)?.focus();
    };
    addExtra.addEventListener('click', () => {
      const style = Object.keys(effortLevels)[0];
      extras.push({ modelId: '', vision: false, effortStyle: style, efforts: [...effortLevels[style]] });
      paintExtras(`#cm-ai-extra-${extras.length - 1}-id`);
    });

    const keyHint = current
      ? L(`Đang lưu key ••••${current.keyLast4 || ''}. Để trống = giữ key cũ (đổi endpoint thì phải nhập lại).`, `已保存密钥 ••••${current.keyLast4 || ''}。留空则保留原密钥（更换 endpoint 时须重新填写）。`)
      : L('Bắt buộc với nhà cung cấp mới.', '新服务商必须填写。');
    const done = button(L('Xong', '完成'), { variant: 'primary', type: 'submit' });
    const cancel = button(L('Huỷ', '取消'));
    const form = el('form', { class: 'adm-card adm-editor', novalidate: '' }, [
      el('h4', { class: 'adm-editor-title' }, current ? L('Sửa nhà cung cấp', '编辑服务商') : L('Nhà cung cấp mới', '新服务商')),
      el('div', { class: 'adm-grid-2' }, [
        formField('cm-ai-preset', L('Endpoint mẫu', '接口模板'), presetSelect),
        formField('cm-ai-label', L('Nhãn', '名称'), label),
      ]),
      formField('cm-ai-endpoint', L('Endpoint', 'Endpoint'), endpoint),
      formField('cm-ai-key', L('API key', 'API 密钥'), apiKey, keyHint),
      el('label', { class: 'adm-check', for: 'cm-ai-enabled' }, [enabled, L('Bật nhà cung cấp này', '启用此服务商')]),
      catalogTitle,
      catalog,
      el('h4', { id: 'cm-ai-extra-title', class: 'adm-label' }, L('Model tự thêm', '自定义模型')),
      el('p', { class: 'adm-hint' }, L(
        'Model id theo tài liệu nhà cung cấp (API Chat Completions OpenAI-compatible). Đánh dấu Nhận ảnh chỉ khi model đọc được ảnh.',
        '按服务商文档填写模型 ID（兼容 OpenAI Chat Completions 接口）。仅在模型能识别图片时勾选“支持图片”。',
      )),
      extrasList,
      el('div', { class: 'adm-actions' }, [addExtra]),
      el('div', { class: 'adm-actions' }, [done, cancel]),
    ]);
    paintExtras();
    const close = (focusSelector) => {
      editorSlot.replaceChildren();
      editingId = null;
      paintProviders();
      if (focusSelector) list.querySelector(focusSelector)?.focus();
      else addButton.focus();
    };
    cancel.addEventListener('click', () => close(index == null ? null : `[data-index="${index}"] [data-action="edit"]`));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const preset = presets.find((p) => p.id === presetSelect.value);
      const data = { label: label.value.trim(), endpoint: endpoint.value.trim(), apiKey: apiKey.value.trim() };
      for (const node of form.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
      const seen = new Set((preset?.models ?? []).map((m) => m.modelId));
      const badExtra = extras.findIndex((m) => !m.modelId || seen.has(m.modelId) || !m.efforts.length || !seen.add(m.modelId));
      const extraProblem = badExtra < 0 ? null
        : !extras[badExtra].modelId ? [form.querySelector(`#cm-ai-extra-${badExtra}-id`), L('Hãy nhập model id.', '请填写模型 ID。')]
          : !extras[badExtra].efforts.length ? [form.querySelector(`#cm-ai-extra-${badExtra}-style`), L('Model cần ít nhất một mức effort.', '模型至少需要一个推理强度。')]
            : [form.querySelector(`#cm-ai-extra-${badExtra}-id`), L('Model id bị trùng.', '模型 ID 重复。')];
      const [invalid, message] = !data.label ? [label, L('Hãy nhập nhãn.', '请填写名称。')]
        : !isHttpsUrl(data.endpoint) ? [endpoint, L('Endpoint phải là URL https hợp lệ.', 'Endpoint 必须是有效的 https URL。')]
          : !current && !data.apiKey ? [apiKey, L('Nhà cung cấp mới cần API key.', '新服务商需要 API 密钥。')]
            : current && data.endpoint !== current.endpoint && !data.apiKey && !current.apiKey
              ? [apiKey, L('Đổi endpoint thì phải nhập lại API key.', '更换 endpoint 时须重新填写 API 密钥。')]
              : extraProblem ?? [null, ''];
      if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        status.set(message, 'error');
        invalid.focus();
        return;
      }
      const entry = {
        id: current ? current.id : crypto.randomUUID(),
        label: data.label,
        preset: preset ? preset.id : '',
        endpoint: data.endpoint,
        enabled: enabled.checked,
        extraModels: extras,
        keyLast4: current ? current.keyLast4 : '',
        // Để trống khi sửa = giữ key cũ (hoặc key mới gõ trước đó mà chưa lưu).
        apiKey: data.apiKey || (current ? current.apiKey : ''),
      };
      // Tìm theo id (danh sách có thể đã đổi thứ tự hoặc bị xoá mục trong lúc khung sửa đang mở).
      const position = current ? items.findIndex((p) => p.id === current.id) : items.length;
      if (position < 0) {
        close(null);
        status.set(L('Nhà cung cấp này đã bị xoá khi đang sửa — thay đổi không được áp dụng.', '该服务商在编辑时已被删除——更改未应用。'), 'error');
        return;
      }
      items[position] = entry;
      markDirty(droppedNote(pruneLinks()));
      paint();
      close(`[data-index="${position}"] [data-action="edit"]`);
    });
    editorSlot.replaceChildren(form);
    editingId = current ? current.id : null;
    paintProviders();
    label.focus();
  }

  /* ---------- Lưu ---------- */

  /** Kiểm trước khi gửi (server kiểm lại): khoảng thời gian và mắt xích hợp lệ. Trả [nhóm, ô lỗi, thông điệp] hoặc null. */
  const groupProblem = () => {
    for (const { id, label } of GROUPS) {
      const { chain, timeoutMs, budgetMs } = groups[id];
      const timeoutS = timeoutMs / 1000;
      const budgetS = budgetMs / 1000;
      if (!Number.isInteger(timeoutS) || timeoutS < AI_MIN_TIMEOUT_S || timeoutS > AI_MAX_TIMEOUT_S) {
        return [id, `#cm-ai-${id}-timeout`, L(`${label}: timeout mỗi lượt phải là số giây nguyên từ ${AI_MIN_TIMEOUT_S} đến ${AI_MAX_TIMEOUT_S}.`, `${label}：单次超时须为 ${AI_MIN_TIMEOUT_S}–${AI_MAX_TIMEOUT_S} 的整数秒。`)];
      }
      if (!Number.isInteger(budgetS) || budgetS < timeoutS || budgetS > AI_MAX_BUDGET_S) {
        return [id, `#cm-ai-${id}-budget`, L(`${label}: trần tổng phải là số giây nguyên, không nhỏ hơn timeout mỗi lượt và không quá ${AI_MAX_BUDGET_S}.`, `${label}：总时限须为整数秒，不小于单次超时且不超过 ${AI_MAX_BUDGET_S}。`)];
      }
      const bad = chain.findIndex((link) => !linkModel(link, id));
      if (bad >= 0) {
        return [id, `#cm-ai-${id}-${bad}-model`, L(`${label}: mắt xích ${bad + 1} chưa chọn model hợp lệ.`, `${label}：第 ${bad + 1} 环未选择有效模型。`)];
      }
    }
    return null;
  };

  const save = async () => {
    // Khung sửa nhà cung cấp còn mở: bấm Lưu sẽ bỏ mất thay đổi chưa bấm Xong.
    if (editorSlot.firstChild) {
      status.set(L('Hãy bấm Xong hoặc Huỷ ở khung sửa nhà cung cấp trước khi Lưu.', '请先在服务商编辑框中点击“完成”或“取消”，再保存。'), 'error');
      editorSlot.querySelector('button[type="submit"]')?.focus();
      return;
    }
    for (const node of groupsNode.querySelectorAll('[aria-invalid]')) node.removeAttribute('aria-invalid');
    const problem = groupProblem();
    if (problem) {
      const [groupId, selector, message] = problem;
      // Ô lỗi nằm trong thẻ nhóm đang thu gọn (mobile): mở thẻ trước khi đưa focus vào.
      if (narrow.matches && !expanded.has(groupId)) {
        expanded.add(groupId);
        paintGroups();
      }
      const node = groupsNode.querySelector(selector);
      node?.setAttribute('aria-invalid', 'true');
      status.set(message, 'error');
      node?.focus();
      return;
    }
    setSaveDisabled(true);
    status.set(L('Đang lưu…', '正在保存…'), 'info');
    try {
      const body = await api('/api/admin/ai/config', {
        method: 'PUT',
        json: {
          providers: items.map(({ id, label, preset, endpoint, enabled, apiKey, extraModels }) => ({ id, label, preset, endpoint, enabled, apiKey, extraModels })),
          groups,
        },
      });
      editorSlot.replaceChildren();
      editingId = null;
      load(body);
      status.set(L('Đã lưu. Có hiệu lực trong khoảng 1 phút.', '已保存，约 1 分钟内生效。'));
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      setSaveDisabled(false);
    }
  };

  addButton.addEventListener('click', () => openEditor(null));
  for (const node of saveButtons) node.addEventListener('click', save);
  // Đổi qua lại mốc hẹp (xoay máy, kéo cửa sổ): vẽ lại phần Tính năng theo đúng chế độ (thẻ thu gọn hay thẻ mở + đầu
  // cột) rồi trả focus về đúng ô/nút đang dùng — theo id, hoặc nhóm + mắt xích + `data-action`; phần tử không còn ở
  // chế độ mới (nút thu gọn, thẻ tóm tắt) thì về đầu thẻ nhóm. Sang chế độ hẹp thì mở sẵn nhóm đang có focus.
  narrow.addEventListener('change', () => {
    if (!Object.keys(groups).length) return;
    const active = document.activeElement;
    const inFeatures = Boolean(active) && (groupsNode.contains(active) || summaryList.contains(active));
    if (!inFeatures) {
      paintGroups();
      return;
    }
    const groupId = active.closest('[data-group]')?.dataset.group
      ?? active.getAttribute('aria-controls')?.replace(/^cm-ai-group-/, '');
    const link = active.closest('[data-link]')?.dataset.link;
    const action = active.dataset.action;
    const selector = active.id && !active.id.endsWith('-title') && groupsNode.contains(active) ? `#${CSS.escape(active.id)}`
      : action && groupId ? `[data-group="${groupId}"]${link ? ` [data-link="${link}"]` : ''} [data-action="${action}"]`
        : null;
    if (groupId && narrow.matches) expanded.add(groupId);
    paintGroups();
    const target = (selector && groupsNode.querySelector(selector))
      ?? groupsNode.querySelector(`[data-group="${groupId}"] [data-action="toggle-group"]`)
      ?? groupsNode.querySelector(`#cm-ai-group-${groupId}-title`);
    target?.focus();
  });

  actions.append(saveButtons[0]);
  panel.append(
    status,
    warning,
    el('section', { class: 'adm-ai-block', 'aria-labelledby': 'cm-ai-providers-title' }, [
      el('div', { class: 'adm-ai-block-head' }, [
        el('div', { class: 'adm-ai-block-heading' }, [
          el('h3', { id: 'cm-ai-providers-title', class: 'adm-subtitle' }, L('Nhà cung cấp', '服务商')),
          el('p', { class: 'adm-hint' }, L(
            'Endpoint và API key dùng chung cho mọi tính năng. Key chỉ hiện 4 ký tự cuối; thứ tự ở đây chỉ để sắp xếp, chuỗi chạy nằm ở phần Tính năng.',
            'Endpoint 和 API 密钥供所有功能共用。密钥只显示最后 4 位；此处顺序仅用于排列，实际调用链在“功能”部分。',
          )),
        ]),
        addButton,
      ]),
      list,
      editorSlot,
    ]),
    el('section', { class: 'adm-ai-block adm-ai-features', 'aria-labelledby': 'cm-ai-groups-title' }, [
      el('div', { class: 'adm-ai-block-heading' }, [
        el('h3', { id: 'cm-ai-groups-title', class: 'adm-subtitle' }, L('Tính năng', '功能')),
        el('p', { class: 'adm-hint' }, L(
          'Mỗi tính năng có chuỗi riêng: gọi mắt xích 1 trước; mắt xích lỗi (sai key, hết tiền, quá tải, máy chủ lỗi) hoặc hết timeout thì chuyển mắt xích kế, tới khi hết trần tổng.',
          '每个功能有自己的调用链：先调用第 1 环；某环出错（密钥错误、余额不足、过载、服务器错误）或超时则切换到下一环，直到用完总时限。',
        )),
      ]),
      summaryList,
      groupsNode,
    ]),
    el('div', { class: 'adm-ai-savebar' }, [
      el('p', {}, L(
        'Lưu ghi cả nhà cung cấp lẫn chuỗi của 4 tính năng; có hiệu lực trong khoảng 1 phút.',
        '“保存”会同时写入服务商和 4 个功能的调用链，约 1 分钟内生效。',
      )),
      saveButtons[1],
    ]),
  );
  panel.setAttribute('aria-busy', 'true');
  api('/api/admin/ai/config')
    .then(load)
    .catch((error) => status.set(describeError(error), 'error'))
    .finally(() => panel.removeAttribute('aria-busy'));
}
