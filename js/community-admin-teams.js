// Khu "Đội cộng đồng" của /quan-tri/ (#doi-cong-dong): hàng chờ duyệt (duyệt / từ chối kèm lý do), lọc trạng thái
// (chờ duyệt, đã duyệt, bị từ chối, xoá dở), gỡ đội đã duyệt, thử xoá tiếp đội xoá dở, và — chỉ root — khối "Mùa đang mở".
// Module không có hiệu ứng khi nạp: chỉ community-admin.js gọi `openTeamsPanel` (import vòng an toàn, các hàm dùng chung
// đã export và không dùng ở cấp module). Server mới là nơi kiểm quyền; ở đây chỉ ẩn nút và dịch lỗi theo `code`.
// Mọi văn bản người dùng (tiêu đề, phân tích, tên) là text node.

import { L, currentLocale } from './i18n.js';
import { el } from './render.js';
import { api, avatar, describeError, displayName, langTag, timeNode } from './community-api.js';
import {
  createTeamLexicon,
  heroBadge,
  loadTeamDictionaries,
  seasonLabel,
  tacticName,
  troopLabel,
} from './community-team-data.js';
import { adminStatus, button, emptyNote, formField, imageTile, pagedList, selectInput, textInput } from './community-admin.js';
import { actionDialog } from './community-admin-users.js';

const REASON_MAX = 500;
const ANALYSIS_FIELDS = [
  ['playstyle', () => L('Lối chơi', '打法')],
  ['strengths', () => L('Điểm mạnh', '优点')],
  ['weaknesses', () => L('Điểm yếu', '缺点')],
  ['counters', () => L('Khắc chế', '克制')],
  ['counteredBy', () => L('Bị khắc chế bởi', '被克制于')],
  ['substitutes', () => L('Thay thế', '替补')],
];

const teamUrl = (id) => `/api/community-teams/${encodeURIComponent(id)}`;

/** Lỗi gỡ đội: 404 với người gọi là KDV nghĩa là đội của KDV khác/root, ngoài quyền. */
function describeRemoveError(error) {
  return error?.status === 404 ? L('Bạn không đủ quyền gỡ đội này.', '你无权下架此阵容。') : describeError(error);
}

function statusBadge(team) {
  const badge = el('span', { class: 'cm-badge' });
  if (team.deleting) {
    badge.dataset.status = 'pending';
    badge.textContent = L('Đang xoá dở', '删除未完成');
  } else if (team.status === 'approved') {
    badge.dataset.status = 'approved';
    badge.textContent = L('Đã duyệt', '已通过');
  } else if (team.status === 'rejected') {
    badge.dataset.status = 'rejected';
    badge.textContent = L('Bị từ chối', '未通过');
  } else {
    badge.dataset.status = 'pending';
    badge.textContent = L('Chờ duyệt', '待审核');
  }
  return badge;
}

/** Nội dung mở rộng của một hàng: chiến pháp theo tướng, các phần phân tích, mọi ảnh. */
function detailNodes(team, detail, lexicon) {
  const nodes = [];
  const tactics = Array.isArray(detail.tactics) ? detail.tactics : team.tactics;
  const heroes = Array.isArray(detail.heroes) ? detail.heroes : team.heroes;
  nodes.push(el('ul', { class: 'adm-team-tactics' }, heroes.map((hero, index) => el('li', {}, [
    heroBadge(lexicon, hero),
    el('span', {}, ` ${(tactics[index] || []).map((id) => tacticName(lexicon, id)).join(' · ')}`),
  ]))));
  const analysis = detail.analysis || {};
  for (const [key, label] of ANALYSIS_FIELDS) {
    const text = String(analysis[key] ?? '').trim();
    if (!text) continue;
    nodes.push(el('p', { class: 'adm-body adm-team-field', lang: team.textLang === 'zh' ? 'zh-Hans' : 'vi' }, [
      el('strong', {}, `${label()}: `),
      text,
    ]));
  }
  const images = [];
  for (let index = 0; index < (Number(team.imageCount) || 0); index += 1) {
    images.push(imageTile(`${teamUrl(team.id)}/images/${index}`, L('Ảnh đội', '阵容截图')));
  }
  if (images.length) nodes.push(el('div', { class: 'adm-team-images' }, images));
  return nodes;
}

function teamItem(team, { lexicon, status, counts, paged, onChanged }) {
  const locale = currentLocale();
  const reasonId = `adm-team-reason-${team.id}`;
  const email = typeof team.author?.email === 'string' ? team.author.email : '';
  const thumb = team.imageCount > 0
    ? imageTile(`${teamUrl(team.id)}/images/0`, L('Ảnh đội', '阵容截图'))
    : null;

  const analysisBody = el('div', { class: 'adm-team-analysis' });
  const analysis = el('details', { class: 'adm-team-more' }, [
    el('summary', {}, L('Xem phân tích', '查看分析')),
    analysisBody,
  ]);
  let analysisLoaded = false;
  analysis.addEventListener('toggle', async () => {
    if (!analysis.open || analysisLoaded) return;
    analysisLoaded = true;
    analysisBody.setAttribute('aria-busy', 'true');
    try {
      const detail = await api(teamUrl(team.id));
      analysisBody.replaceChildren(...detailNodes(team, detail, lexicon));
    } catch (error) {
      analysisLoaded = false;
      analysisBody.replaceChildren(el('p', { class: 'adm-empty' }, describeError(error)));
    } finally {
      analysisBody.removeAttribute('aria-busy');
    }
  });

  const actions = el('div', { class: 'adm-actions' });
  const item = el('li', { class: 'adm-card adm-team adm-report', dataset: { teamId: String(team.id) } }, [
    thumb,
    el('div', { class: 'adm-report-main' }, [
      el('p', { class: 'adm-meta' }, [
        avatar(team.author),
        el('span', { class: 'adm-author' }, displayName(team.author)),
        email ? el('span', { class: 'adm-mail' }, email) : null,
        timeNode(team.createdAt),
        team.season ? el('span', { class: 'cm-team-season' }, seasonLabel(team.season, locale)) : null,
        statusBadge(team),
      ]),
      el('h3', { class: 'adm-team-title' }, String(team.title ?? '')),
      el('div', { class: 'adm-team-heroes' }, [
        ...team.heroes.map((id) => heroBadge(lexicon, id)),
        el('span', { class: 'cm-team-troop' }, troopLabel(team.troop)),
        langTag(team.textLang),
      ]),
      team.rejectReason ? el('p', { class: 'adm-body' }, L(`Lý do từ chối: ${team.rejectReason}`, `拒绝原因：${team.rejectReason}`)) : null,
      analysis,
      actions,
    ]),
  ]);

  /** Xong một thao tác thay đổi trạng thái: bỏ hàng khỏi danh sách đang lọc rồi đếm lại badge. */
  const finish = (message) => {
    status.set(message);
    paged.remove(item);
    counts.refresh();
    onChanged();
  };
  /** Trạng thái đội đã đổi từ nơi khác (hoặc không còn): báo, tải lại danh sách, đếm lại badge. */
  const staleReload = (message) => {
    status.set(message, 'error');
    counts.refresh();
    onChanged({ reload: true });
  };

  /** Form lý do (bắt buộc) thay cho hàng nút; lỗi giữ form để bấm lại cùng thao tác. */
  const askReason = ({ trigger, label, hint, confirmText, emptyMessage, prefill = '', run }) => {
    const reason = el('textarea', { id: reasonId, class: 'cm-textarea', rows: '3', maxlength: String(REASON_MAX), required: '' });
    reason.value = prefill;
    const confirm = button(confirmText, { variant: 'adm-btn-accent', type: 'submit' });
    const cancel = button(L('Huỷ', '取消'));
    const form = el('form', { class: 'adm-reject', novalidate: '' }, [
      formField(reasonId, label, reason, hint),
      el('div', { class: 'adm-actions' }, [confirm, cancel]),
    ]);
    cancel.addEventListener('click', () => {
      form.replaceWith(actions);
      trigger.focus();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = reason.value.trim();
      if (!text) {
        status.set(emptyMessage, 'error');
        reason.setAttribute('aria-invalid', 'true');
        reason.focus();
        return;
      }
      reason.removeAttribute('aria-invalid');
      confirm.disabled = true;
      try {
        await run(text);
      } catch {
        confirm.disabled = false;
      }
    });
    actions.replaceWith(form);
    reason.focus();
  };

  const removeRequest = (trigger, { retry }) => askReason({
    trigger,
    label: L('Lý do gỡ', '下架原因'),
    hint: L('Lý do được ghi vào nhật ký quản trị.', '该原因会写入管理日志。'),
    confirmText: L('Xác nhận gỡ', '确认下架'),
    emptyMessage: L('Hãy nhập lý do gỡ.', '请填写下架原因。'),
    prefill: retry ? String(team.rejectReason ?? '') : '',
    run: async (text) => {
      try {
        await api(teamUrl(team.id), { method: 'DELETE', json: { reason: text } });
      } catch (error) {
        status.set(describeRemoveError(error), 'error');
        if (error?.status === 404) {
          counts.refresh();
          onChanged({ reload: true });
        }
        throw error;
      }
      finish(L('Đã gỡ đội.', '阵容已下架。'));
    },
  });

  if (team.deleting) {
    const retry = button(L('Thử xoá tiếp', '继续删除'), { variant: 'adm-btn-danger' });
    retry.addEventListener('click', () => removeRequest(retry, { retry: true }));
    actions.append(retry);
  } else if (team.status === 'pending') {
    const approve = button(L('Duyệt', '通过'), { variant: 'primary', iconName: 'check' });
    const reject = button(L('Từ chối', '拒绝'));
    actions.append(approve, reject);
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      reject.disabled = true;
      try {
        await api(`/api/admin/community-teams/${encodeURIComponent(team.id)}/approve`, { method: 'POST', json: {} });
        finish(L('Đã duyệt đội.', '阵容已通过。'));
      } catch (error) {
        approve.disabled = false;
        reject.disabled = false;
        if (error?.code === 'not_pending') staleReload(L('Đội này không còn chờ duyệt. Danh sách đã được làm mới.', '该阵容已不在待审状态，列表已刷新。'));
        else status.set(describeError(error), 'error');
      }
    });
    reject.addEventListener('click', () => askReason({
      trigger: reject,
      label: L('Lý do từ chối', '拒绝原因'),
      hint: L('Người đăng xem được lý do này ở trang Đội của tôi.', '发布者可在“我的阵容”页面看到该原因。'),
      confirmText: L('Xác nhận từ chối', '确认拒绝'),
      emptyMessage: L('Hãy nhập lý do từ chối.', '请填写拒绝原因。'),
      run: async (text) => {
        try {
          await api(`/api/admin/community-teams/${encodeURIComponent(team.id)}/reject`, { method: 'POST', json: { reason: text } });
        } catch (error) {
          if (error?.code === 'not_pending') staleReload(L('Đội này không còn chờ duyệt. Danh sách đã được làm mới.', '该阵容已不在待审状态，列表已刷新。'));
          else status.set(describeError(error), 'error');
          throw error;
        }
        finish(L('Đã từ chối đội.', '阵容已拒绝。'));
      },
    }));
  } else if (team.status === 'approved') {
    const remove = button(L('Gỡ đội', '下架阵容'), { variant: 'adm-btn-danger' });
    remove.addEventListener('click', () => removeRequest(remove, { retry: false }));
    actions.append(remove);
  }
  if (!actions.childElementCount) actions.hidden = true;
  return item;
}

/* ---------- Mùa đang mở (root) ---------- */

function seasonBlock({ status }) {
  const current = el('p', { class: 'adm-body adm-season-current' }, L('Đang tải…', '加载中…'));
  let open = null;
  const paintCurrent = () => {
    if (!open) {
      current.textContent = L('Chưa mở mùa nào: hiện chưa nhận đội mới.', '尚未开启赛季：暂不接收新阵容。');
      return;
    }
    const opened = timeNode(open.openedAt);
    current.replaceChildren(
      el('strong', {}, String(open.id)),
      ` · ${open.labelVi} / ${open.labelZh}`,
      opened ? L(' · mở ngày ', ' · 开启于 ') : '',
      opened,
    );
  };
  api('/api/community-seasons').then((body) => {
    open = body?.open ?? null;
    paintCurrent();
  }).catch((error) => {
    current.textContent = describeError(error);
  });

  const id = textInput('adm-season-id', '', { mono: true, maxlength: '64', autocomplete: 'off', spellcheck: 'false' });
  const labelVi = textInput('adm-season-vi', '', { maxlength: '80', autocomplete: 'off' });
  const labelZh = textInput('adm-season-zh', '', { maxlength: '80', autocomplete: 'off', lang: 'zh-Hans' });
  const submit = button(L('Mở mùa mới…', '开启新赛季…'), { variant: 'adm-btn-accent', type: 'submit' });
  const form = el('form', { class: 'adm-season-form', novalidate: '' }, [
    formField('adm-season-id', L('Mã mùa', '赛季代码'), id, L('Chữ thường, số, dấu gạch ngang. Ví dụ s2.', '小写字母、数字、连字符，例如 s2。')),
    formField('adm-season-vi', L('Tên mùa (Việt)', '赛季名称（越南语）'), labelVi),
    formField('adm-season-zh', L('Tên mùa (Trung)', '赛季名称（中文）'), labelZh),
    el('div', { class: 'adm-actions' }, submit),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const body = { id: id.value.trim(), labelVi: labelVi.value.trim(), labelZh: labelZh.value.trim() };
    if (!body.id || !body.labelVi || !body.labelZh) {
      status.set(L('Hãy nhập đủ mã mùa và tên mùa ở cả hai ngôn ngữ.', '请填写赛季代码以及两种语言的赛季名称。'), 'error');
      return;
    }
    const previous = open ? seasonLabel(open, currentLocale()) : '';
    actionDialog({
      title: L('Mở mùa mới', '开启新赛季'),
      lead: previous
        ? L(`Mùa ${previous} sẽ bị lưu trữ: khoá bình chọn và chiến báo. Bình luận vẫn mở. Đội đăng từ lúc này thuộc mùa mới.`, `赛季“${previous}”将被归档：锁定投票和战报，评论仍可使用。此后发布的阵容归属新赛季。`)
        : L('Đội đăng từ lúc này thuộc mùa mới.', '此后发布的阵容归属新赛季。'),
      fields: [],
      submitLabel: L('Xác nhận mở mùa', '确认开启'),
      closeOnError: true,
      submit: async () => {
        let created;
        try {
          created = await api('/api/admin/community-seasons', { method: 'POST', json: body });
        } catch (error) {
          status.set(describeError(error), 'error');
          throw error;
        }
        open = created;
        paintCurrent();
        id.value = '';
        labelVi.value = '';
        labelZh.value = '';
        status.set(L('Đã mở mùa mới.', '已开启新赛季。'));
      },
      onClose: () => submit.focus(),
    });
  });
  return el('section', { class: 'adm-card adm-season', 'aria-labelledby': 'adm-season-title' }, [
    el('h3', { id: 'adm-season-title', class: 'adm-subtitle' }, L('Mùa đang mở', '进行中的赛季')),
    current,
    form,
  ]);
}

/* ---------- Khu ---------- */

export function openTeamsPanel(panel, { head, counts, viewer }) {
  const status = adminStatus();
  const filter = selectInput('adm-teams-status', [
    ['pending', L('Chờ duyệt', '待审核')],
    ['approved', L('Đã duyệt', '已通过')],
    ['rejected', L('Bị từ chối', '未通过')],
    ['deleting', L('Đang xoá dở', '删除未完成')],
  ], 'pending');
  const list = el('ol', { class: 'adm-list adm-list-roomy', 'aria-label': L('Đội cộng đồng', '社区阵容') });
  const empty = emptyNote(L('Không có đội nào ở trạng thái này.', '该状态下没有阵容。'));
  let lexicon = null;
  const lexiconReady = loadTeamDictionaries()
    .then((dictionaries) => { lexicon = createTeamLexicon(dictionaries); })
    .catch(() => {});
  const paged = pagedList({
    list,
    empty,
    status,
    fallbackFocus: head.querySelector('.adm-section-title'),
    fetchPage: async (cursor) => {
      const params = new URLSearchParams({ status: filter.value });
      if (cursor) params.set('cursor', cursor);
      const [body] = await Promise.all([api(`/api/admin/community-teams?${params}`), lexiconReady]);
      return body;
    },
    render: (team) => teamItem(team, { lexicon, status, counts, paged, onChanged }),
  });
  function onChanged({ reload = false } = {}) {
    if (reload) paged.reload(list);
  }
  filter.addEventListener('change', () => {
    status.set('');
    paged.reload(list);
  });
  panel.append(
    viewer?.role === 'root' ? seasonBlock({ status }) : null,
    el('div', { class: 'adm-filters' }, formField('adm-teams-status', L('Trạng thái', '状态'), filter)),
    status,
    list,
    empty,
    paged.more,
  );
  paged.reload(list);
}
