// Chiến báo thực chiến trên trang chi tiết đội: bảng số liệu tin cậy (số trận, tỉ lệ thắng, đối thủ
// thường gặp — tính trên mọi ngôn ngữ), danh sách chiến báo đã duyệt cùng `lang` với trang, và luồng gửi:
// chọn ảnh → AI đọc ảnh → người dùng sửa/xác nhận → gửi → "đang chờ duyệt".

import { L, formatNumber, localePath } from './i18n.js';
import { el } from './render.js';
import {
  api,
  avatar,
  describeError,
  displayName,
  downscaleImage,
  formatPercent,
  langTag,
  liveStatus,
  resultLabel,
  signInPrompt,
  splitNames,
  timeNode,
} from './community-api.js';

const RESULTS = ['win', 'loss', 'draw'];
const NOTE_MAX_LENGTH = 500;

function heroLine(names) {
  const list = Array.isArray(names) ? names.filter((name) => typeof name === 'string' && name.trim()) : [];
  return list.length ? list.join(' · ') : '—';
}

/**
 * Tóm tắt một chiến báo: kết quả, đội ta vs đối thủ, ghi chú. Dùng chung cho trang đội, hub và quản trị;
 * `caption` (quản trị) là dòng chú thích đặt cạnh nhãn kết quả.
 */
export function reportSummary(report, { caption = null } = {}) {
  const result = RESULTS.includes(report?.result) ? report.result : null;
  const pill = el('span', { class: 'cm-result', dataset: { result: result || 'unknown' } }, resultLabel(result));
  return el('div', { class: 'cm-report-summary' }, [
    caption ? el('div', { class: 'cm-report-verdict' }, [pill, el('span', { class: 'cm-report-caption' }, caption)]) : pill,
    el('dl', { class: 'cm-report-sides' }, [
      el('div', {}, [el('dt', {}, L('Đội ta', '我方')), el('dd', {}, heroLine(report?.allyHeroes))]),
      el('div', {}, [el('dt', {}, L('Đối thủ', '对手')), el('dd', {}, heroLine(report?.enemyHeroes))]),
    ]),
    report?.note ? el('p', { class: 'cm-report-note' }, String(report.note)) : null,
  ]);
}

function statsPanel(stats) {
  const total = Number(stats?.total) || 0;
  if (!total) {
    return el('p', { class: 'scope-note cm-empty' }, L(
      'Chưa có chiến báo nào được duyệt cho đội này.',
      '该阵容暂无已审核的战报。',
    ));
  }
  const wins = Number(stats.wins) || 0;
  const losses = Number(stats.losses) || 0;
  const draws = Number(stats.draws) || 0;
  const opponents = Array.isArray(stats.topOpponents) ? stats.topOpponents.slice(0, 5) : [];
  const fact = (label, value, detail) => el('div', { class: 'cm-stat' }, [
    el('dt', { class: 'cm-stat-label' }, label),
    el('dd', { class: 'cm-stat-value' }, value),
    detail ? el('dd', { class: 'cm-stat-detail' }, detail) : null,
  ]);
  return el('div', { class: 'cm-stats' }, [
    el('dl', { class: 'cm-stat-grid' }, [
      fact(L('Số trận', '场次'), formatNumber(total)),
      fact(
        L('Tỉ lệ thắng', '胜率'),
        formatPercent(wins / total),
        L(
          `${formatNumber(wins)} thắng · ${formatNumber(losses)} thua · ${formatNumber(draws)} hoà`,
          `${formatNumber(wins)} 胜 · ${formatNumber(losses)} 负 · ${formatNumber(draws)} 平`,
        ),
      ),
    ]),
    opponents.length
      ? el('div', { class: 'cm-opponents' }, [
          el('h3', { class: 'cm-subtitle' }, L('Đối thủ thường gặp', '常见对手')),
          el('ol', { class: 'cm-opponent-list' }, opponents.map((opponent) => {
            const count = Number(opponent?.count) || 0;
            const opponentWins = Number(opponent?.wins) || 0;
            return el('li', { class: 'cm-opponent' }, [
              el('span', { class: 'cm-opponent-heroes' }, heroLine(opponent?.heroes)),
              el('span', { class: 'cm-opponent-count' }, L(
                `${formatNumber(count)} trận · thắng ${formatNumber(opponentWins)}`,
                `${formatNumber(count)} 场 · 胜 ${formatNumber(opponentWins)}`,
              )),
            ]);
          })),
        ])
      : null,
  ]);
}

function reportItem(report, { tagged = false } = {}) {
  const imageUrl = typeof report.imageUrl === 'string' && report.imageUrl.startsWith('/api/') ? report.imageUrl : null;
  return el('li', { class: 'cm-report' }, [
    reportSummary(report),
    imageUrl
      ? el('a', { class: 'cm-report-image-link', href: imageUrl, target: '_blank', rel: 'noopener' }, [
          el('img', { class: 'cm-report-image', src: imageUrl, alt: L('Ảnh kết quả trận', '战斗结果截图'), loading: 'lazy', decoding: 'async' }),
          el('span', { class: 'visually-hidden' }, L('(mở tab mới)', '（在新标签页打开）')),
        ])
      : null,
    el('p', { class: 'cm-report-meta' }, [
      avatar(report.author),
      el('span', {}, displayName(report.author)),
      tagged ? langTag(report.lang) : null,
      timeNode(report.createdAt),
    ]),
  ]);
}

/** Luồng gửi chiến báo cho người đã đăng nhập. */
function submitFlow({ pageKey, lang }) {
  const titleId = 'cm-report-submit-title';
  const status = liveStatus();
  const body = el('div', { class: 'cm-report-flow' });
  const wrapper = el('div', { class: 'cm-report-submit', role: 'group', 'aria-labelledby': titleId }, [
    el('h3', { id: titleId, class: 'cm-subtitle' }, L('Gửi chiến báo của bạn', '提交你的战报')),
    body,
    status,
  ]);

  const focusHeading = (node) => {
    node.tabIndex = -1;
    node.focus();
  };

  function startStep() {
    status.set('');
    const openButton = el('button', { class: 'ana-btn primary', type: 'button' }, L('Gửi chiến báo', '提交战报'));
    openButton.addEventListener('click', pickStep);
    body.replaceChildren(
      el('p', { class: 'scope-note' }, L(
        'Chụp màn hình kết quả trận có dùng đội này. AI sẽ đọc đội hình, bạn kiểm tra lại rồi gửi để quản trị viên duyệt.',
        '上传使用该阵容的战斗结果截图。AI 会识别双方阵容，你核对后提交，由管理员审核。',
      )),
      openButton,
    );
  }

  function pickStep() {
    const inputId = 'cm-report-file';
    const input = el('input', { id: inputId, class: 'cm-file', type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-describedby': 'cm-report-file-note' });
    const cancel = el('button', { class: 'ana-btn', type: 'button' }, L('Huỷ', '取消'));
    cancel.addEventListener('click', () => {
      startStep();
      body.querySelector('button')?.focus();
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) analyze(file);
    });
    body.replaceChildren(
      el('label', { class: 'cm-label', for: inputId }, L('Chọn ảnh kết quả trận', '选择战斗结果截图')),
      input,
      el('p', { id: 'cm-report-file-note', class: 'scope-note' }, L(
        'Ảnh được thu nhỏ trước khi tải lên và gửi tới dịch vụ AI để đọc đội hình. Nên cắt bỏ tên tài khoản.',
        '图片会先压缩再上传，并发送给 AI 服务识别阵容。建议裁掉账号名称。',
      )),
      el('div', { class: 'cm-form-row' }, [cancel]),
    );
    input.focus();
  }

  async function analyze(file) {
    if (!/^image\//.test(file.type)) {
      status.set(L('Hãy chọn một tệp ảnh.', '请选择图片文件。'), 'error');
      return;
    }
    body.setAttribute('aria-busy', 'true');
    status.set(L('Đang phân tích ảnh…', '正在识别图片…'));
    try {
      const blob = await downscaleImage(file);
      const form = new FormData();
      form.append('image', blob, 'report.jpg');
      const result = await api('/api/reports/analyze', { method: 'POST', form });
      if (!result?.uploadId) throw new Error('missing uploadId');
      status.set(L('Đã đọc xong ảnh. Hãy kiểm tra và sửa nếu cần.', '识别完成，请核对并按需修改。'));
      confirmStep(result.uploadId, result.analysis || {}, blob);
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      body.removeAttribute('aria-busy');
    }
  }

  function confirmStep(uploadId, analysis, blob) {
    const previewUrl = URL.createObjectURL(blob);
    const resultSelect = el('select', { id: 'cm-report-result', class: 'cm-select', required: '' }, [
      el('option', { value: '' }, L('Chọn kết quả', '选择结果')),
      ...RESULTS.map((value) => el('option', { value }, resultLabel(value))),
    ]);
    resultSelect.value = RESULTS.includes(analysis.result) ? analysis.result : '';
    const allyInput = el('input', { id: 'cm-report-ally', class: 'cm-input', type: 'text', required: '', 'aria-describedby': 'cm-report-names-hint' });
    allyInput.value = (analysis.ally?.heroes || []).join(', ');
    const enemyInput = el('input', { id: 'cm-report-enemy', class: 'cm-input', type: 'text', 'aria-describedby': 'cm-report-names-hint' });
    enemyInput.value = (analysis.enemy?.heroes || []).join(', ');
    const noteInput = el('textarea', { id: 'cm-report-note', class: 'cm-textarea', rows: '2', maxlength: String(NOTE_MAX_LENGTH) });
    noteInput.value = typeof analysis.notes === 'string' ? analysis.notes.slice(0, NOTE_MAX_LENGTH) : '';
    const submit = el('button', { class: 'ana-btn primary', type: 'submit' }, L('Gửi để duyệt', '提交审核'));
    const cancel = el('button', { class: 'ana-btn', type: 'button' }, L('Huỷ', '取消'));
    const field = (id, label, control) => el('div', { class: 'cm-field' }, [el('label', { class: 'cm-label', for: id }, label), control]);
    const heading = el('p', { class: 'cm-step-title' }, L('Xác nhận chiến báo', '确认战报'));
    const form = el('form', { class: 'cm-report-form', novalidate: '' }, [
      heading,
      el('img', { class: 'cm-report-preview', src: previewUrl, alt: L('Ảnh bạn đã chọn', '你选择的图片') }),
      field('cm-report-result', L('Kết quả', '结果'), resultSelect),
      field('cm-report-ally', L('Tướng phe ta', '我方武将'), allyInput),
      field('cm-report-enemy', L('Tướng đối thủ (nếu thấy)', '对手武将（如可见）'), enemyInput),
      el('p', { id: 'cm-report-names-hint', class: 'scope-note' }, L('Ngăn tên tướng bằng dấu phẩy.', '武将名之间用逗号分隔。')),
      field('cm-report-note', L('Ghi chú (không bắt buộc)', '备注（可选）'), noteInput),
      el('div', { class: 'cm-form-row' }, [cancel, submit]),
    ]);
    const release = () => URL.revokeObjectURL(previewUrl);
    cancel.addEventListener('click', () => {
      release();
      startStep();
      body.querySelector('button')?.focus();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = resultSelect.value;
      const allyHeroes = splitNames(allyInput.value);
      const enemyHeroes = splitNames(enemyInput.value);
      const invalid = !RESULTS.includes(result) ? resultSelect : !allyHeroes.length ? allyInput : null;
      if (invalid) {
        status.set(L('Hãy chọn kết quả và nhập tướng phe ta.', '请选择结果并填写我方武将。'), 'error');
        invalid.setAttribute('aria-invalid', 'true');
        invalid.focus();
        return;
      }
      for (const control of [resultSelect, allyInput]) control.removeAttribute('aria-invalid');
      submit.disabled = true;
      status.set(L('Đang gửi…', '正在提交…'));
      try {
        const note = noteInput.value.trim();
        await api('/api/reports', {
          method: 'POST',
          json: { page: pageKey, lang, uploadId, result, allyHeroes, enemyHeroes, ...(note ? { note } : {}) },
        });
        release();
        pendingStep();
      } catch (error) {
        submit.disabled = false;
        status.set(describeError(error), 'error');
      }
    });
    body.replaceChildren(form);
    focusHeading(heading);
  }

  function pendingStep() {
    const heading = el('p', { class: 'cm-step-title cm-pending' }, L('Đã gửi — đang chờ duyệt', '已提交，等待审核'));
    const another = el('button', { class: 'ana-btn', type: 'button' }, L('Gửi chiến báo khác', '再提交一份'));
    another.addEventListener('click', pickStep);
    body.replaceChildren(
      heading,
      el('p', { class: 'scope-note' }, L(
        'Chiến báo sẽ hiện ở đây và được tính vào thống kê sau khi quản trị viên duyệt.',
        '战报经管理员审核通过后会显示在此处并计入统计。',
      )),
      el('div', { class: 'cm-form-row' }, [
        el('a', { class: 'ana-btn', href: localePath('/chien-bao/') }, L('Xem chiến báo của tôi', '查看我的战报')),
        another,
      ]),
    );
    status.set(L('Đã gửi chiến báo, đang chờ duyệt.', '战报已提交，等待审核。'));
    focusHeading(heading);
  }

  startStep();
  return wrapper;
}

/**
 * Khối "Chiến báo thực chiến": số liệu + danh sách đã duyệt + luồng gửi.
 * `sharedPool` (đội cộng đồng): không lọc theo `lang`, mỗi chiến báo kèm nhãn `[VI]`/`[ZH]`.
 * `archived` (mùa đã đóng): thay luồng gửi bằng ghi chú lưu trữ.
 */
export function mountReports(container, { pageKey, lang, user, sharedPool = false, archived = false }) {
  const titleId = 'cm-reports-title';
  const statsBox = el('div', { class: 'cm-stats-box' });
  const list = el('ol', { class: 'cm-report-list', 'aria-label': L('Chiến báo đã duyệt', '已审核战报') });
  const status = liveStatus();
  const moreButton = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Xem thêm chiến báo', '查看更多战报'));
  let cursor = null;

  const loadList = async () => {
    const params = new URLSearchParams({ page: pageKey, lang });
    if (cursor) params.set('cursor', cursor);
    const body = await api(`/api/reports?${params}`);
    for (const report of Array.isArray(body?.items) ? body.items : []) {
      if (sharedPool || report?.lang === lang) list.append(reportItem(report, { tagged: sharedPool }));
    }
    list.hidden = list.childElementCount === 0;
    cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
    moreButton.hidden = !cursor;
  };

  const load = async () => {
    const [stats] = await Promise.all([api(`/api/reports/stats?${new URLSearchParams({ page: pageKey })}`), loadList()]);
    statsBox.replaceChildren(statsPanel(stats));
  };

  moreButton.addEventListener('click', async () => {
    moreButton.disabled = true;
    const before = list.childElementCount;
    try {
      await loadList();
      const first = list.children[before];
      if (first) {
        first.tabIndex = -1;
        first.focus();
      }
    } catch (error) {
      status.set(describeError(error), 'error');
    } finally {
      moreButton.disabled = false;
    }
  });

  const section = el('section', { class: 'cm-block cm-reports', 'aria-labelledby': titleId }, [
    el('h2', { id: titleId, class: 'cm-title' }, L('Chiến báo thực chiến', '实战战报')),
    el('p', { class: 'scope-note' }, L(
      'Kết quả trận thật do người chơi gửi, đã được quản trị viên duyệt.',
      '由玩家提交、经管理员审核的真实战斗结果。',
    )),
    statsBox,
    list,
    moreButton,
    status,
    archived
      ? el('p', { class: 'scope-note cm-archived' }, L('Mùa đã lưu trữ — không nhận chiến báo mới.', '赛季已归档，不再接受新战报。'))
      : user ? submitFlow({ pageKey, lang }) : signInPrompt(L('Đăng nhập để gửi chiến báo của bạn.', '登录后即可提交你的战报。')),
  ]);
  list.hidden = true;
  container.append(section);
  return { section, load };
}
