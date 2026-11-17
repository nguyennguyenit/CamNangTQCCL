// Khu "Đội cộng đồng" của /quan-tri/ (#doi-cong-dong), theo artboard AdminTeamsMoi: dòng tổng số đội chờ duyệt dưới
// tiêu đề khu, nhóm nút chọn trạng thái (chờ duyệt, đã duyệt,
// bị từ chối, xoá dở), thẻ đội (ảnh, chip tướng có chân dung, phân tích mở/đóng), duyệt / từ chối kèm lý do, gỡ đội
// đã duyệt, thử xoá tiếp đội xoá dở.
// Module không có hiệu ứng khi nạp: chỉ community-admin.js gọi `openTeamsPanel` (import vòng an toàn, các hàm dùng chung
// đã export và không dùng ở cấp module). Server mới là nơi kiểm quyền; ở đây chỉ ẩn nút và dịch lỗi theo `code`.
// Mọi văn bản người dùng (tiêu đề, phân tích, tên) là text node.

import { L, currentLocale, htmlLang, isSiteLocale } from './i18n.js';
import { el, icon, svgNode, variantNameNodes } from './render.js';
import { api, avatar, describeError, displayName, timeNode } from './community-api.js';
import { createTeamLexicon, loadTeamDictionaries, seasonLabel, tacticName, troopLabel } from './community-team-data.js';
import { textLanguageName } from './community-team-ui.js';
import { heroPortrait } from './hero-portrait.js';
import { treeToDom } from './view-tree.js';
import { adminStatus, button, emptyNote, formField, glyph, imageTile, pagedList } from './community-admin.js';

const REASON_MAX = 500;
const ANALYSIS_FIELDS = [
  ['playstyle', () => L('Lối chơi', '打法', '戦い方')],
  ['strengths', () => L('Điểm mạnh', '优点', '長所')],
  ['weaknesses', () => L('Điểm yếu', '缺点', '短所')],
  ['counters', () => L('Khắc chế', '克制', '有利な相手')],
  ['counteredBy', () => L('Bị khắc chế bởi', '被克制于', '不利な相手')],
  ['substitutes', () => L('Thay thế', '替补', '代替')],
];
/** Bộ lọc trạng thái: giá trị gửi API `status=`, nhãn nút, nhãn danh sách (đọc màn hình). */
const STATUS_FILTERS = [
  ['pending', () => L('Chờ duyệt', '待审核', '承認待ち'), () => L('Đội chờ duyệt', '待审核阵容', '承認待ちの編成')],
  ['approved', () => L('Đã duyệt', '已通过', '承認済み'), () => L('Đội đã duyệt', '已通过阵容', '承認済みの編成')],
  ['rejected', () => L('Bị từ chối', '未通过', '却下'), () => L('Đội bị từ chối', '未通过阵容', '却下された編成')],
  ['deleting', () => L('Đang xoá dở', '删除未完成', '削除途中'), () => L('Đội đang xoá dở', '删除未完成的阵容', '削除が途中の編成')],
];

const teamUrl = (id) => `/api/community-teams/${encodeURIComponent(id)}`;

/* Icon nét riêng của khu (artboard AdminTeamsMoi); icon dùng chung lấy từ `glyph` của community-admin.js. */
const strokeIcon = (paths, size = 16) => icon(paths.map((d) => svgNode('path', { d })), { size });
const chevronDown = () => strokeIcon(['M6 9l6 6 6-6']);
const chevronUp = () => strokeIcon(['M6 15l6-6 6 6']);
const trashIcon = () => strokeIcon(['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 13h10l1-13']);

/** Nút có icon riêng của khu đứng trước chữ (`button` của khung chỉ nhận icon trong bộ `glyph`). */
function iconButton(text, iconNode, options) {
  const node = button(text, options);
  node.prepend(iconNode);
  return node;
}

/** Lỗi gỡ đội: 404 với người gọi là KDV nghĩa là đội của KDV khác/root, ngoài quyền. */
function describeRemoveError(error) {
  return error?.status === 404 ? L('Bạn không đủ quyền gỡ đội này.', '你无权下架此阵容。', 'この編成を取り下げる権限がありません。') : describeError(error);
}

function statusBadge(team) {
  const badge = el('span', { class: 'cm-badge' });
  if (team.deleting) {
    badge.dataset.status = 'pending';
    badge.textContent = L('Đang xoá dở', '删除未完成', '削除途中');
  } else if (team.status === 'approved') {
    badge.dataset.status = 'approved';
    badge.textContent = L('Đã duyệt', '已通过', '承認済み');
  } else if (team.status === 'rejected') {
    badge.dataset.status = 'rejected';
    badge.textContent = L('Bị từ chối', '未通过', '却下');
  } else {
    badge.dataset.status = 'pending';
    badge.textContent = L('Chờ duyệt', '待审核', '承認待ち');
  }
  return badge;
}

/** Tên tướng (tiền tố SP/CO/40Y thành nhãn `.pre`) kèm chân dung; từ điển chưa nạp được thì hiện id thô. */
function heroIdentity(lexicon, id, className) {
  const record = lexicon?.heroRecord(id) ?? null;
  return [
    record ? heroPortrait({ chinese: record.chinese, nameVi: record.viet, iconUrl: record.iconUrl, className, alt: '' }) : null,
    el('span', { class: 'adm-team-hero-name' }, variantNameNodes(lexicon ? lexicon.heroName(id) : String(id)).map((node) => treeToDom(node))),
  ];
}

/** Ô ảnh đầu của đội: mở ảnh gốc ở tab mới, nhãn số ảnh ở góc dưới. */
function teamThumb(team, imageCount) {
  const tile = imageTile(`${teamUrl(team.id)}/images/0`, L('Ảnh đội', '阵容截图', '編成のスクリーンショット'));
  tile.classList.add('adm-team-thumb');
  tile.append(el('span', { class: 'adm-team-thumb-count' }, [glyph('image', 14), L(`${imageCount} ảnh`, `${imageCount} 张图`, `${imageCount}枚`)]));
  return tile;
}

/** Ghi chú số ảnh trong vùng phân tích; ảnh thứ 2 trở đi hiện ở đây (ảnh đầu đã ở thẻ). */
function imagesNote(imageCount) {
  if (imageCount <= 0) return L('Đội chưa có ảnh.', '该阵容没有截图。', 'この編成にはスクリーンショットがありません。');
  if (imageCount === 1) return L('Đội có 1 ảnh (đã hiện ở thẻ).', '该阵容有 1 张图（已显示在卡片上）。', 'この編成には画像が1枚あります（カードに表示済み）。');
  return L(
    `Đội có ${imageCount} ảnh: ảnh 1 đã hiện ở thẻ, ảnh 2–${imageCount} ở dưới.`,
    `该阵容有 ${imageCount} 张图：第 1 张已显示在卡片上，第 2–${imageCount} 张在下方。`,
    `この編成には画像が${imageCount}枚あります。1枚目はカードに表示済み、2〜${imageCount}枚目は下に表示しています。`,
  );
}

/** Nội dung vùng phân tích: bảng tướng × chiến pháp, các mục phân tích của tác giả, ghi chú và ảnh còn lại. */
function analysisNodes(team, detail, lexicon, imageCount) {
  const tactics = Array.isArray(detail.tactics) ? detail.tactics : team.tactics;
  const heroes = Array.isArray(detail.heroes) ? detail.heroes : team.heroes;
  const nodes = [el('div', { class: 'adm-team-block' }, [
    el('h4', { class: 'adm-team-block-title' }, L('Chiến pháp theo tướng', '各武将战法', '武将別の戦法')),
    el('ul', { class: 'adm-team-tactics' }, heroes.map((hero, index) => el('li', {}, [
      el('span', { class: 'adm-team-tactics-hero' }, heroIdentity(lexicon, hero, 'adm-team-portrait-sm')),
      el('span', { class: 'adm-team-tactics-names' }, (tactics[index] || []).map((id) => tacticName(lexicon, id)).join(' · ')),
    ]))),
  ])];
  const analysis = detail.analysis || {};
  const rows = ANALYSIS_FIELDS.flatMap(([key, label]) => {
    const text = String(analysis[key] ?? '').trim();
    return text ? [el('dt', {}, label()), el('dd', {}, text)] : [];
  });
  if (rows.length) {
    nodes.push(el('div', { class: 'adm-team-block' }, [
      el('h4', { class: 'adm-team-block-title' }, L('Phân tích của tác giả', '作者分析', '投稿者の分析')),
      el('dl', { class: 'adm-team-fields', lang: htmlLang(team.textLang) }, rows),
    ]));
  }
  nodes.push(el('p', { class: 'adm-hint' }, imagesNote(imageCount)));
  const extra = [];
  for (let index = 1; index < imageCount; index += 1) {
    extra.push(imageTile(`${teamUrl(team.id)}/images/${index}`, L(`Ảnh đội ${index + 1}`, `阵容截图 ${index + 1}`, `編成のスクリーンショット ${index + 1}`)));
  }
  if (extra.length) nodes.push(el('div', { class: 'adm-team-images' }, extra));
  return nodes;
}

/** Nút "Xem phân tích / Ẩn phân tích" + vùng phân tích; chi tiết đội chỉ tải ở lần mở đầu (lỗi thì lần sau tải lại). */
function analysisToggle(team, lexicon, imageCount) {
  const regionId = `adm-team-analysis-${team.id}`;
  const region = el('div', { id: regionId, class: 'adm-team-analysis', hidden: '' });
  const toggle = button('', { variant: 'adm-team-toggle', 'aria-expanded': 'false', 'aria-controls': regionId });
  const paint = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.replaceChildren(open ? chevronUp() : chevronDown(), open ? L('Ẩn phân tích', '收起分析', '分析を閉じる') : L('Xem phân tích', '查看分析', '分析を見る'));
    region.hidden = !open;
  };
  paint(false);
  let loaded = false;
  toggle.addEventListener('click', async () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    paint(open);
    if (!open || loaded) return;
    loaded = true;
    region.setAttribute('aria-busy', 'true');
    region.replaceChildren(el('p', { class: 'adm-hint' }, L('Đang tải…', '加载中…', '読み込み中…')));
    try {
      const detail = await api(teamUrl(team.id));
      region.replaceChildren(...analysisNodes(team, detail ?? {}, lexicon, imageCount));
    } catch (error) {
      loaded = false;
      region.replaceChildren(el('p', { class: 'adm-empty' }, describeError(error)));
    } finally {
      region.removeAttribute('aria-busy');
    }
  });
  return [toggle, region];
}

/** Ghi chú theo trạng thái dưới hàng tướng: lý do từ chối, hoặc đội xoá dở (lý do gỡ lần trước được điền sẵn). */
function stateNote(team) {
  const reason = String(team.rejectReason ?? '').trim();
  if (team.deleting) {
    return el('p', { class: 'adm-team-note', dataset: { tone: 'warn' } }, reason
      ? L(
        `Lần gỡ trước chưa xong (còn ảnh hoặc dữ liệu chưa xoá). Thử xoá tiếp sẽ hỏi lại lý do, lý do cũ được điền sẵn: “${reason}”`,
        `上次下架未完成（仍有截图或数据未删除）。继续删除时会再次询问原因，并预填旧原因：“${reason}”`,
        `前回の取り下げは完了していません（スクリーンショットまたはデータが未削除です）。削除を続けると理由を再度確認し、前回の理由を入力済みにします：「${reason}」`,
      )
      : L(
        'Lần gỡ trước chưa xong (còn ảnh hoặc dữ liệu chưa xoá). Thử xoá tiếp sẽ hỏi lại lý do.',
        '上次下架未完成（仍有截图或数据未删除）。继续删除时会再次询问原因。',
        '前回の取り下げは完了していません（スクリーンショットまたはデータが未削除です）。削除を続けると理由を再度確認します。',
      ));
  }
  if (team.status === 'rejected' && reason) {
    return el('p', { class: 'adm-team-note', dataset: { tone: 'avoid' } }, [el('strong', {}, L('Lý do từ chối:', '拒绝原因：', '却下理由：')), ` ${reason}`]);
  }
  return null;
}

function teamItem(team, { lexicon, status, counts, paged, onChanged }) {
  const locale = currentLocale();
  const reasonId = `adm-team-reason-${team.id}`;
  const email = typeof team.author?.email === 'string' ? team.author.email : '';
  const imageCount = Math.max(0, Number(team.imageCount) || 0);
  const heroes = Array.isArray(team.heroes) ? team.heroes : [];
  const [toggle, region] = analysisToggle(team, lexicon, imageCount);

  const actions = el('div', { class: 'adm-actions' });
  const main = el('div', { class: 'adm-report-main' }, [
    el('p', { class: 'adm-meta' }, [
      avatar(team.author),
      el('span', { class: 'adm-author' }, displayName(team.author)),
      email ? el('span', { class: 'adm-team-mail' }, email) : null,
      timeNode(team.createdAt),
      team.season ? el('span', { class: 'cm-badge adm-team-season' }, seasonLabel(team.season, locale)) : null,
      statusBadge(team),
    ]),
    el('h3', { class: 'adm-team-title' }, String(team.title ?? '')),
    el('div', { class: 'adm-team-heroes' }, [
      el('ul', { class: 'adm-team-hero-list', 'aria-label': L('Ba tướng của đội', '阵容三名武将', '編成の武将3名') }, heroes.map((id) => el('li', {
        class: 'adm-team-hero',
        dataset: { heroId: id },
      }, heroIdentity(lexicon, id, 'adm-team-portrait')))),
      el('span', { class: 'adm-team-chips' }, [
        el('span', { class: 'adm-team-chip' }, troopLabel(team.troop)),
        isSiteLocale(team.textLang)
          ? el('span', { class: 'adm-team-chip', title: L('Ngôn ngữ phần phân tích', '分析内容的语言', '分析内容の言語') }, textLanguageName(team.textLang))
          : null,
      ]),
    ]),
    stateNote(team),
    toggle,
    region,
    actions,
  ]);
  const item = el('li', { class: 'adm-card adm-team adm-report', dataset: { teamId: String(team.id) } }, [
    imageCount > 0 ? teamThumb(team, imageCount) : null,
    main,
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
    const cancel = button(L('Huỷ', '取消', 'キャンセル'));
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
    label: L('Lý do gỡ', '下架原因', '取り下げ理由'),
    hint: L(`Lý do được ghi vào nhật ký quản trị. Tối đa ${REASON_MAX} ký tự.`, `该原因会写入管理日志。最多 ${REASON_MAX} 个字符。`, `この理由は管理ログに記録されます。最大${REASON_MAX}文字です。`),
    confirmText: L('Xác nhận gỡ', '确认下架', '取り下げを確定'),
    emptyMessage: L('Hãy nhập lý do gỡ.', '请填写下架原因。', '取り下げ理由を入力してください。'),
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
      finish(L('Đã gỡ đội.', '阵容已下架。', '編成を取り下げました。'));
    },
  });

  if (team.deleting) {
    const retry = iconButton(L('Thử xoá tiếp', '继续删除', '削除を続行'), trashIcon(), { variant: 'adm-btn-danger' });
    retry.addEventListener('click', () => removeRequest(retry, { retry: true }));
    actions.append(retry);
  } else if (team.status === 'pending') {
    const approve = button(L('Duyệt', '通过', '承認'), { variant: 'primary', iconName: 'check' });
    const reject = button(L('Từ chối', '拒绝', '却下'));
    actions.append(approve, reject);
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      reject.disabled = true;
      try {
        await api(`/api/admin/community-teams/${encodeURIComponent(team.id)}/approve`, { method: 'POST', json: {} });
        finish(L('Đã duyệt đội.', '阵容已通过。', '編成を承認しました。'));
      } catch (error) {
        approve.disabled = false;
        reject.disabled = false;
        if (error?.code === 'not_pending') staleReload(L('Đội này không còn chờ duyệt. Danh sách đã được làm mới.', '该阵容已不在待审状态，列表已刷新。', 'この編成は承認待ちではなくなりました。一覧を更新しました。'));
        else status.set(describeError(error), 'error');
      }
    });
    reject.addEventListener('click', () => askReason({
      trigger: reject,
      label: L('Lý do từ chối', '拒绝原因', '却下理由'),
      hint: L(
        `Người đăng xem được lý do này ở trang Đội của tôi. Tối đa ${REASON_MAX} ký tự.`,
        `发布者可在“我的阵容”页面看到该原因。最多 ${REASON_MAX} 个字符。`,
        `投稿者は「マイ編成」ページでこの理由を確認できます。最大${REASON_MAX}文字です。`,
      ),
      confirmText: L('Xác nhận từ chối', '确认拒绝', '却下を確定'),
      emptyMessage: L('Hãy nhập lý do từ chối.', '请填写拒绝原因。', '却下理由を入力してください。'),
      run: async (text) => {
        try {
          await api(`/api/admin/community-teams/${encodeURIComponent(team.id)}/reject`, { method: 'POST', json: { reason: text } });
        } catch (error) {
          if (error?.code === 'not_pending') staleReload(L('Đội này không còn chờ duyệt. Danh sách đã được làm mới.', '该阵容已不在待审状态，列表已刷新。', 'この編成は承認待ちではなくなりました。一覧を更新しました。'));
          else status.set(describeError(error), 'error');
          throw error;
        }
        finish(L('Đã từ chối đội.', '阵容已拒绝。', '編成を却下しました。'));
      },
    }));
  } else if (team.status === 'approved') {
    const remove = iconButton(L('Gỡ đội', '下架阵容', '編成を取り下げ'), trashIcon(), { variant: 'adm-btn-danger' });
    remove.addEventListener('click', () => removeRequest(remove, { retry: false }));
    actions.append(remove);
    main.append(el('p', { class: 'adm-hint' }, L(
      'Gỡ đội cần nhập lý do; lý do được ghi vào nhật ký quản trị.',
      '下架阵容需填写原因；该原因会写入管理日志。',
      '編成の取り下げには理由の入力が必要です。理由は管理ログに記録されます。',
    )));
  }
  if (!actions.childElementCount) actions.hidden = true;
  return item;
}

/* ---------- Khu ---------- */

/** Dòng tổng dưới tiêu đề khu: số đội chờ duyệt lấy từ `GET /api/admin/counts` (`teamsPending`). */
function pendingSummary(counts) {
  const node = el('p', { class: 'adm-team-summary', hidden: '' });
  counts.subscribe((values) => {
    const pending = Math.max(0, Number(values?.teamsPending) || 0);
    node.textContent = L(
      `${pending} đội chờ duyệt · đội chỉ hiện ở /doi-cong-dong/ sau khi được duyệt`,
      `${pending} 个阵容待审核 · 阵容通过审核后才会显示在 /zh/doi-cong-dong/`,
      `承認待ちの編成：${pending}件 · 編成は承認後に /ja/doi-cong-dong/ に表示されます`,
    );
    node.hidden = false;
  });
  return node;
}

/** Nhóm nút chọn một trạng thái (aria-pressed, như artboard); `onChange(value)` khi đổi lựa chọn. */
function statusFilter(initial, onChange) {
  let value = initial;
  const buttons = STATUS_FILTERS.map(([key, label]) => {
    const node = el('button', { type: 'button', class: 'adm-team-filter-btn', 'aria-pressed': String(key === value), dataset: { status: key } }, label());
    node.addEventListener('click', () => {
      if (key === value) return;
      value = key;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === node));
      onChange(value);
    });
    return node;
  });
  const node = el('div', { class: 'adm-team-filter' }, [
    el('span', { id: 'adm-teams-status-label', class: 'adm-label' }, L('Trạng thái', '状态', '状態')),
    el('div', { class: 'adm-team-filter-group', role: 'group', 'aria-labelledby': 'adm-teams-status-label' }, buttons),
  ]);
  return { node, get value() { return value; } };
}

const listLabel = (value) => (STATUS_FILTERS.find(([key]) => key === value) ?? STATUS_FILTERS[0])[2]();

export function openTeamsPanel(panel, { head, counts }) {
  head.querySelector('.adm-section-heading')?.append(pendingSummary(counts));
  const status = adminStatus();
  const list = el('ol', { class: 'adm-list adm-list-roomy', 'aria-label': listLabel('pending') });
  const empty = emptyNote(L('Không có đội nào ở trạng thái này.', '该状态下没有阵容。', 'この状態の編成はありません。'));
  const filter = statusFilter('pending', (value) => {
    status.set('');
    list.setAttribute('aria-label', listLabel(value));
    paged.reload(list);
  });
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
  paged.more.classList.add('adm-team-more');
  panel.append(
    filter.node,
    status,
    list,
    empty,
    paged.more,
  );
  paged.reload(list);
}
