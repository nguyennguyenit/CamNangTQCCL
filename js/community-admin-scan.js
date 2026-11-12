// Khu "Soi đội" (#soi-doi) của /quan-tri/ — artboard AdminAnalyze (+ Mobile):
// (a) thẻ "Tỷ lệ sửa / không rõ (ẩn danh)" theo màn hình × phe (bảng desktop, thẻ số trên mobile);
// (b) "Ảnh người dùng gửi": lọc trạng thái bằng nhóm nút chọn một, thẻ mẫu (ảnh gốc, tác giả, Màn/Phe, Duyệt/Từ chối
//     hoặc Tải fixture) và bảng đối chiếu theo thứ tự ô — AI chép chữ Hán · người dùng xác nhận.
// Server chỉ lưu id (`hero:…`, `tactic:…`, `book:…`) cho đội xác nhận; tên hiển thị tra qua từ điển dùng chung của
// Đội cộng đồng (js/community-team-data.js — heroes-dict, tactics, books-dict). Id không tra được vẫn hiện id kèm nhãn
// "chưa tra được" để không mất thông tin. Module không có hiệu ứng khi nạp: chỉ community-admin.js gọi `openScanPanel`
// (import vòng an toàn, hàm dùng chung chỉ được gọi lúc chạy).

import { L, currentLocale } from './i18n.js';
import { el } from './render.js';
import { api, avatar, describeError, displayName, timeNode } from './community-api.js';
import { draftFromRead } from './analyze-map.js';
import { createTeamLexicon, loadTeamBooks, loadTeamDictionaries, recordLabel } from './community-team-data.js';
import { adminIconStatus, button, emptyNote, formField, glyph, pagedList, selectInput } from './community-admin.js';

const SCAN_SCREEN_LABEL = {
  battleReport: L('Chiến báo', '战报'),
  teamDetail: L('Chi tiết đội', '队伍详情'),
  other: L('Khác', '其他'),
};
const SCAN_SIDE_LABEL = { left: L('Trái (ta)', '左（我方）'), right: L('Phải (đối thủ)', '右（对手）') };
export const SCAN_STATUS_LABEL = {
  pending: L('Chờ duyệt', '待审核'),
  approved: L('Đã duyệt', '已通过'),
  rejected: L('Đã từ chối', '已拒绝'),
};

/* ---------- Tỷ lệ sửa / không rõ ---------- */

/** Phần trăm một chữ số thập phân theo locale (vi: `6,8%`, zh: `6.8%`); không có ô nào thì `—`. */
function percent(part, whole) {
  if (!(whole > 0)) return '—';
  return new Intl.NumberFormat(currentLocale() === 'zh' ? 'zh-CN' : 'vi-VN', {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
  }).format(Number(part) / Number(whole));
}

const count = (value) => new Intl.NumberFormat(currentLocale() === 'zh' ? 'zh-CN' : 'vi-VN').format(Number(value) || 0);

/**
 * Bảng tỷ lệ: một DOM cho cả hai bề rộng. Desktop là bảng 5 cột (số căn phải); ≤680px mỗi dòng thành một thẻ
 * "Màn · Phe" + 3 ô số có nhãn (`data-label`, CSS hiện nhãn).
 */
function scanStatsTable(rows) {
  const heads = [L('Màn hình', '界面'), L('Phe', '阵营'), L('Số lượt', '次数'), L('% ô sửa', '修改占比'), L('% ô không rõ', '不确定占比')];
  const numeric = (label, value, extra = '') => el('td', { class: `adm-scan-num${extra}`, 'data-label': label }, value);
  return el('div', { class: 'adm-scan-stats-wrap' }, el('table', { class: 'adm-scan-stats' }, [
    el('thead', {}, el('tr', {}, heads.map((text, index) => el('th', { scope: 'col', class: index > 1 ? 'adm-scan-num' : null }, text)))),
    el('tbody', {}, rows.map((row) => el('tr', {}, [
      el('td', { class: 'adm-scan-stat-screen' }, SCAN_SCREEN_LABEL[row.screen] || String(row.screen)),
      el('td', { class: 'adm-scan-stat-side' }, SCAN_SIDE_LABEL[row.side] || String(row.side)),
      numeric(heads[2], count(row.events)),
      numeric(heads[3], percent(row.edited, row.read), ' is-strong'),
      numeric(heads[4], percent(row.unclear, row.read)),
    ]))),
  ]));
}

/* ---------- Bảng đối chiếu AI đọc · người dùng xác nhận ---------- */

const list = (value) => (Array.isArray(value) ? value : []);

/**
 * Ô xác nhận "đã sửa" theo đúng quy tắc đếm `edited` của `readStats` (cột "% ô sửa"): ô AI có chép (không trống)
 * mà id cuối khác id AI đưa chắc ban đầu — ô AI đọc không chắc / không rõ được người dùng điền cũng tính.
 * @param {{state: string, id: string|null}|undefined} initialCell ô ban đầu của `draftFromRead`
 * @param {string|null|undefined} finalId id người dùng xác nhận (null = để trống)
 */
export function scanCellEdited(initialCell, finalId) {
  if (!initialCell || initialCell.state === 'empty') return false;
  const initialId = initialCell.state === 'sure' ? initialCell.id : null;
  return initialId !== (finalId || null);
}

/**
 * Bộ tra tên cho đội xác nhận: `{ label, record }` theo locale (vi tên game Việt, zh chữ Hán gốc, lùi về tên Việt).
 * `lexicon` null (từ điển không tải được) hoặc id lạ → `record` null, `label` là id thô.
 */
export function scanNameResolver(lexicon, locale = currentLocale()) {
  const records = {
    hero: (id) => lexicon?.heroRecord(id) ?? null,
    tactic: (id) => lexicon?.tacticRecord(id) ?? null,
    book: (id) => lexicon?.indexes.books.byId.get(id) ?? null,
  };
  return (kind, id) => {
    const record = records[kind](id);
    const label = record ? recordLabel(record, locale) : '';
    return label ? { label, record } : { label: String(id), record: null };
  };
}

function aiChip(text, { hero = false } = {}) {
  return el('li', { class: hero ? 'adm-scan-chip is-hero' : 'adm-scan-chip', lang: 'zh' }, String(text));
}

const editedFlag = (edited) => (edited ? [' ', el('span', { class: 'adm-scan-flag' }, L('đã sửa', '已修改'))] : []);

/** Ô xác nhận: tên Việt, "Để trống" (null), hoặc id thô + nhãn "chưa tra được" khi từ điển không có id. */
function confirmedChip(resolve, kind, id, edited, { hero = false } = {}) {
  if (id == null) {
    return el('li', { class: 'adm-scan-chip is-blank' }, [L('Để trống', '留空'), ...editedFlag(edited)]);
  }
  const { label, record } = resolve(kind, id);
  const classes = ['adm-scan-chip'];
  if (hero) classes.push('is-hero');
  if (!record) {
    classes.push('is-unresolved');
    return el('li', {
      class: classes.join(' '),
      title: L('Không tra được tên của id này trong dữ liệu.', '数据中查不到此 ID 的名称。'),
      dataset: { id: String(id) },
    }, [
      el('code', { class: 'adm-scan-chip-id' }, String(id)),
      // Khoảng trắng giữa id và nhãn chỉ cho chữ đọc ra (flex bỏ qua nút chữ chỉ có khoảng trắng).
      ' ',
      el('span', { class: 'adm-scan-flag' }, [glyph('warning', 14), L('chưa tra được', '未能识别')]),
    ]);
  }
  if (edited) classes.push('is-edited');
  return el('li', { class: classes.join(' '), dataset: { id: String(id) } }, [label, ...editedFlag(edited)]);
}

function chipList(items) {
  return items.length ? el('ul', { class: 'adm-scan-chips' }, items) : el('span', { class: 'adm-scan-none' }, '—');
}

/**
 * Ô AI đọc của một tướng đúng như người dùng thấy ở Soi đội: ô tướng, chiến pháp A/B (đã bỏ dòng tự mang, binh thư
 * xếp nhầm được trả về hàng chiến pháp — `draftFromRead`), binh thư nếu AI có chép. Thiếu từ điển (`initial` null)
 * thì hiện nguyên các dòng AI chép.
 */
function aiChips(read, member) {
  if (member) {
    const cells = [member.hero, ...member.tactics, member.book].filter((cell) => cell.state !== 'empty');
    return cells.map((cell) => aiChip(cell.raw || '—', { hero: cell === member.hero }));
  }
  if (!read) return [];
  return [read.nameCn, ...list(read.tacticsCn), ...list(read.booksCn)].map((text, index) => aiChip(text, { hero: index === 0 }));
}

/**
 * Bảng so theo thứ tự ô (tướng, 2 chiến pháp, binh thư khi có). Desktop: bảng 3 cột có số thứ tự son serif;
 * ≤680px: mỗi tướng một khối "Tướng N" với nhãn "AI đọc" / "Người dùng xác nhận" (`data-label`).
 * @param lexicon bộ tra của `createTeamLexicon` hoặc null (từ điển không tải được: hiện id, không gắn "đã sửa")
 */
export function scanCompareTable(sample, lexicon) {
  const resolve = scanNameResolver(lexicon);
  const ai = list(sample.aiRead?.heroes);
  const initial = lexicon ? draftFromRead(sample.aiRead, lexicon.indexes) : null;
  const confirmed = list(sample.confirmed?.heroes);
  const aiLabel = L('AI đọc', 'AI 识别');
  const userLabel = L('Người dùng xác nhận', '用户确认');
  return el('div', { class: 'adm-scan-compare' }, el('table', {}, [
    el('caption', {}, [
      el('span', { class: 'adm-scan-caption-wide' }, L(
        'So theo thứ tự ô: AI chép chữ in trong ảnh (chữ Hán) · đội người dùng xác nhận ở Soi đội.',
        '按格子顺序对照：AI 抄录图中印刷文字（汉字）· 用户在识阵中确认的队伍。',
      )),
      el('span', { class: 'adm-scan-caption-narrow' }, L('AI đọc · người dùng xác nhận', 'AI 识别 · 用户确认')),
    ]),
    el('thead', {}, el('tr', {}, [
      el('th', { scope: 'col' }, el('span', { class: 'visually-hidden' }, L('Tướng', '武将'))),
      el('th', { scope: 'col' }, aiLabel),
      el('th', { scope: 'col' }, userLabel),
    ])),
    el('tbody', {}, confirmed.map((entry, index) => {
      const member = initial?.heroes[index] ?? null;
      const tactics = list(entry?.tactics);
      const edited = (cell, id) => Boolean(member) && scanCellEdited(cell, id);
      // Binh thư: hiện khi người dùng chọn, hoặc khi AI có chép mà người dùng bỏ trống (để thấy ô bị xoá).
      const showBook = Boolean(entry?.book) || (member != null && member.book.state !== 'empty');
      const userChips = [
        confirmedChip(resolve, 'hero', entry?.hero ?? null, edited(member?.hero, entry?.hero), { hero: true }),
        ...[0, 1].map((slot) => confirmedChip(resolve, 'tactic', tactics[slot] ?? null, edited(member?.tactics[slot], tactics[slot]))),
        showBook ? confirmedChip(resolve, 'book', entry?.book ?? null, edited(member?.book, entry?.book)) : null,
      ].filter(Boolean);
      return el('tr', {}, [
        el('th', { scope: 'row' }, [el('span', { class: 'adm-scan-row-word' }, `${L('Tướng', '武将')} `), String(index + 1)]),
        el('td', { 'data-label': aiLabel }, chipList(aiChips(ai[index], member))),
        el('td', { 'data-label': userLabel }, chipList(userChips)),
      ]);
    })),
  ]));
}

/* ---------- Thẻ mẫu ---------- */

/** Ô ảnh mở ảnh gốc ở tab mới, nhãn "Ảnh gốc" ở góc; ảnh đã xoá (mẫu bị từ chối) thì ô trống nét đứt. */
function sampleImage(sample) {
  if (!sample.hasImage) {
    return el('div', { class: 'adm-scan-image is-gone' }, [glyph('image', 28), el('span', {}, L('Ảnh đã bị xoá.', '图片已删除。'))]);
  }
  const href = `/api/admin/scan-samples/${encodeURIComponent(sample.id)}/image`;
  return el('a', { class: 'adm-scan-image', href, target: '_blank', rel: 'noopener' }, [
    el('img', { src: href, alt: L('Ảnh soi đội người dùng gửi (mở ảnh gốc ở tab mới)', '用户提交的识阵截图（在新标签页打开原图）'), loading: 'lazy' }),
    el('span', { class: 'adm-scan-image-open', 'aria-hidden': 'true' }, [glyph('external', 14), L('Ảnh gốc', '原图')]),
  ]);
}

async function downloadFixture(sample) {
  const fixture = await api(`/api/admin/scan-samples/${encodeURIComponent(sample.id)}/fixture`);
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(fixture, null, 2)}\n`], { type: 'application/json' }));
  const link = el('a', { href: url, download: `${sample.id}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function scanSampleItem(sample, { status, lexicon, onChange }) {
  const id = encodeURIComponent(sample.id);
  const actions = el('div', { class: 'adm-scan-actions' });
  const buttons = el('div', { class: 'adm-actions' });
  const setBusy = (busy) => buttons.querySelectorAll('button').forEach((node) => { node.disabled = busy; });
  const act = async (action, message) => {
    setBusy(true);
    try {
      await api(`/api/admin/scan-samples/${id}/${action}`, { method: 'POST', json: {} });
      status.set(message);
      onChange(item);
    } catch (error) {
      setBusy(false);
      status.set(describeError(error), 'error');
    }
  };
  if (sample.status === 'pending') {
    const approve = button(L('Duyệt', '通过'), { variant: 'primary', iconName: 'check' });
    const reject = button(L('Từ chối', '拒绝'));
    approve.addEventListener('click', () => act('approve', L('Đã duyệt mẫu.', '样本已通过。')));
    reject.addEventListener('click', () => act('reject', L('Đã từ chối mẫu và xoá ảnh.', '样本已拒绝并删除图片。')));
    buttons.append(approve, reject);
    actions.append(buttons, el('p', { class: 'adm-hint' }, L(
      'Duyệt khi ảnh rõ và đội xác nhận đúng với ảnh. Từ chối sẽ xoá ảnh khỏi máy chủ, không hoàn tác.',
      '图片清晰且确认的队伍与图片一致时再通过。拒绝会从服务器删除图片，无法撤销。',
    )));
  } else if (sample.status === 'approved') {
    const download = button(L('Tải fixture', '下载 fixture'), { variant: 'primary', iconName: 'download' });
    download.addEventListener('click', async () => {
      download.disabled = true;
      try {
        await downloadFixture(sample);
        status.set(L('Đã tải fixture.', '已下载 fixture。'));
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        download.disabled = false;
      }
    });
    buttons.append(download);
    actions.append(buttons, el('p', { class: 'adm-hint' }, [
      L('Nhớ tải ảnh, che tên tài khoản, đặt vào ', '记得下载图片，遮住账号名，放入 '),
      el('code', {}, 'worker/eval/images/'),
      L('.', '。'),
    ]));
  } else {
    actions.append(el('p', { class: 'adm-hint' }, L(
      'Mẫu đã từ chối: ảnh đã xoá nên không duyệt lại được.',
      '样本已拒绝：图片已删除，无法再次审核。',
    )));
  }
  const item = el('li', { class: 'adm-scan-sample', dataset: { sampleId: String(sample.id), status: String(sample.status) } }, [
    sampleImage(sample),
    el('p', { class: 'adm-meta adm-scan-meta' }, [
      el('span', { class: 'cm-badge', dataset: { status: sample.status } }, SCAN_STATUS_LABEL[sample.status] || String(sample.status)),
      avatar(sample.author),
      el('span', { class: 'adm-author' }, displayName(sample.author)),
      timeNode(sample.createdAt),
    ]),
    el('p', { class: 'adm-scan-tags' }, [
      el('span', { class: 'cm-badge' }, `${L('Màn', '界面')}: ${SCAN_SCREEN_LABEL[sample.screen] || String(sample.screen)}`),
      el('span', { class: 'cm-badge' }, `${L('Phe', '阵营')}: ${SCAN_SIDE_LABEL[sample.side] || String(sample.side)}`),
    ]),
    scanCompareTable(sample, lexicon),
    actions,
  ]);
  return item;
}

/* ---------- Bộ lọc trạng thái: nhóm nút chọn một ---------- */

function statusFilter(onPick) {
  const labelId = 'cm-scan-status-label';
  let value = 'pending';
  const buttons = Object.entries(SCAN_STATUS_LABEL).map(([key, text]) => {
    const node = el('button', { class: 'adm-seg-option', type: 'button', 'aria-pressed': String(key === value), dataset: { value: key } }, text);
    node.addEventListener('click', () => {
      if (key === value) return;
      value = key;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === node));
      onPick(key);
    });
    return node;
  });
  return {
    node: el('div', { class: 'adm-field adm-scan-filter' }, [
      el('span', { id: labelId, class: 'adm-label' }, L('Trạng thái', '状态')),
      el('div', { class: 'adm-seg', role: 'group', 'aria-labelledby': labelId }, buttons),
    ]),
    get value() {
      return value;
    },
  };
}

/* ---------- Khu ---------- */

/** Từ điển tên dùng chung cho cả khu; lỗi tải trả `null` (bảng hiện id thô + nhãn chưa tra được). */
function loadLexicon() {
  return Promise.all([loadTeamDictionaries(), loadTeamBooks()])
    .then(([{ heroes, tactics }, books]) => createTeamLexicon({ heroes, tactics, books }))
    .catch(() => null);
}

export function openScanPanel(panel, { head, counts }) {
  // Hai dòng trạng thái: lỗi tải bảng tỷ lệ báo trong thẻ tỷ lệ, thao tác mẫu báo trong khối "Ảnh người dùng gửi".
  const statsStatus = adminIconStatus();
  const status = adminIconStatus();
  const lexiconReady = loadLexicon();
  let lexicon = null;
  // Thiếu từ điển là tình trạng của cả khu: báo một lần ở dòng riêng, không đè thông báo Duyệt / Từ chối.
  const dictNote = el('p', { class: 'cm-notice', hidden: '' }, L(
    'Không tải được từ điển tên — bảng đối chiếu đang hiện id và không gắn nhãn "đã sửa".',
    '未能加载名称词典——对照表显示的是 ID，且不标记“已修改”。',
  ));

  // (a) Tỷ lệ theo màn hình × phe.
  const daysSelect = selectInput('cm-scan-days', [
    ['7', L('7 ngày', '7 天')],
    ['30', L('30 ngày', '30 天')],
    ['90', L('90 ngày', '90 天')],
  ], '30');
  const statsBox = el('div', { class: 'adm-scan-stats-box' });
  let statsGeneration = 0;
  const loadStats = async () => {
    const current = ++statsGeneration;
    const body = await api(`/api/admin/scan-stats?days=${encodeURIComponent(daysSelect.value)}`);
    if (current !== statsGeneration) return;
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    statsBox.replaceChildren(rows.length
      ? scanStatsTable(rows)
      : el('p', { class: 'adm-empty' }, L('Chưa có lượt đối chiếu nào trong khoảng này.', '该时间段内还没有对照记录。')));
  };
  const reloadStats = () => {
    statsStatus.set('');
    return loadStats().catch((error) => statsStatus.set(describeError(error), 'error'));
  };
  daysSelect.addEventListener('change', reloadStats);
  const statsTitleId = 'adm-scan-stats-title';
  const statsCard = el('section', { class: 'adm-scan-card', 'aria-labelledby': statsTitleId }, [
    el('div', { class: 'adm-scan-head' }, [
      el('div', { class: 'adm-scan-heading' }, [
        el('h3', { id: statsTitleId, class: 'adm-subtitle' }, L('Tỷ lệ sửa / không rõ (ẩn danh)', '修改 / 不确定占比（匿名）')),
        el('p', { class: 'adm-hint' }, L(
          'Đếm lần Đối chiếu đầu tiên của mỗi lượt đọc từ ảnh: chỉ số ô, không ảnh, không tên.',
          '统计每次读图后的第一次对照：只记格子数，不存图片、不存名字。',
        )),
      ]),
      el('div', { class: 'adm-scan-days' }, formField('cm-scan-days', L('Khoảng thời gian', '时间范围'), daysSelect)),
    ]),
    statsStatus,
    statsBox,
  ]);

  // (b) Mẫu theo trạng thái; duyệt/từ chối xong thì mẫu rời danh sách trạng thái đang xem.
  const list = el('ol', { class: 'adm-scan-samples', 'aria-labelledby': 'adm-scan-samples-title' });
  const empty = emptyNote(L('Không có mẫu nào.', '没有样本。'));
  const pending = el('p', { class: 'adm-scan-pending', hidden: '' });
  counts.subscribe((values) => {
    const value = Number(values?.scanPending) || 0;
    pending.textContent = L(`${value} ảnh chờ duyệt`, `${value} 张截图待审核`);
    pending.hidden = false;
  });
  let filter = null;
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: async (cursor) => {
      const params = new URLSearchParams({ status: filter.value });
      if (cursor) params.set('cursor', cursor);
      const [body, loaded] = await Promise.all([api(`/api/admin/scan-samples?${params}`), lexiconReady]);
      lexicon = loaded;
      dictNote.hidden = Boolean(loaded);
      return body;
    },
    render: (sample) => scanSampleItem(sample, {
      status,
      lexicon,
      onChange: (item) => {
        paged.remove(item);
        counts.refresh();
      },
    }),
  });
  filter = statusFilter(() => paged.reload(panel));

  const samples = el('section', { class: 'adm-scan-block', 'aria-labelledby': 'adm-scan-samples-title' }, [
    el('div', { class: 'adm-scan-head' }, [
      el('div', { class: 'adm-scan-heading' }, [
        el('h3', { id: 'adm-scan-samples-title', class: 'adm-subtitle' }, L('Ảnh người dùng gửi', '用户提交的截图')),
        el('p', { class: 'adm-hint' }, L(
          'Người dùng bấm Gửi ảnh này sau khi đã xác nhận đội. Duyệt xong, tải fixture để thêm vào bộ ảnh chuẩn chấm AI.',
          '用户确认队伍后点击“提交这张图”。通过后下载 fixture，加入用于给 AI 评分的基准图集。',
        )),
        pending,
      ]),
      filter.node,
    ]),
    el('p', { class: 'adm-scan-legend' }, [
      el('span', {}, [el('span', { class: 'adm-scan-swatch is-edited', 'aria-hidden': 'true' }), L('đã sửa: khác ô AI đọc, tính vào % ô sửa', '已修改：与 AI 识别的格子不同，计入修改占比')]),
      el('span', {}, [el('span', { class: 'adm-scan-swatch is-blank', 'aria-hidden': 'true' }), L('Để trống: người dùng cố ý bỏ ô', '留空：用户有意不填此格')]),
    ]),
    dictNote,
    status,
    list,
    empty,
    paged.more,
  ]);

  panel.append(statsCard, samples);
  reloadStats();
  paged.reload(panel);
}
