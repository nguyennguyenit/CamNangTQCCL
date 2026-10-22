// Trang Đội cộng đồng (`/doi-cong-dong/`, `/zh/doi-cong-dong/`): bốn chế độ đọc từ `location.search` —
// danh sách (mặc định), chi tiết `?id=`, đăng `?new=1`, của tôi `?mine=1`. Văn bản người dùng luôn là text node.
// Hàm thuần nằm ở js/community-team-state.js, form đăng ở js/community-team-form.js, tên tướng/CP ở js/community-team-data.js.

import { cellFromInput } from './analyze-map.js';
import { L, currentLocale, formatNumber, localePath } from './i18n.js';
import {
  api,
  avatar,
  describeError,
  displayName,
  langTag,
  liveStatus,
  loadSession,
  signInPrompt,
  timeNode,
  unavailableNotice,
} from './community-api.js';
import { mountComments } from './community-comments.js';
import { mountReports } from './community-reports.js';
import {
  createTeamLexicon,
  heroBadge,
  datalistOptions,
  loadTeamBooks,
  loadTeamDictionaries,
  seasonLabel,
  tacticName,
  troopLabel,
} from './community-team-data.js';
import { mountTeamForm } from './community-team-form.js';
import { mergePage, modeFromSearch } from './community-team-state.js';
import { el } from './render.js';

const ANALYSIS_FIELDS = [
  ['playstyle', () => L('Lối chơi', '打法')],
  ['strengths', () => L('Điểm mạnh', '优点')],
  ['weaknesses', () => L('Điểm yếu', '缺点')],
  ['counters', () => L('Khắc chế', '克制')],
  ['counteredBy', () => L('Bị khắc chế bởi', '被克制于')],
  ['substitutes', () => L('Thay thế', '替补')],
];
const STATUS_LABELS = {
  pending: () => L('Đang chờ duyệt', '等待审核'),
  approved: () => L('Đã duyệt', '已通过'),
  rejected: () => L('Bị từ chối', '未通过'),
};
const SORTS = [
  ['hot', () => L('Hot', '热门')],
  ['new', () => L('Mới', '最新')],
  ['top', () => L('Top', '最高分')],
];

export function initCommunityTeams(mount = document.getElementById('community-teams')) {
  if (!mount) return null;
  const locale = currentLocale();
  let user = null;
  let renderToken = 0;
  let flash = '';
  let first = true;

  /* ---------- Từ điển tên (nạp nền; thẻ hiện id thô tới khi xong) ---------- */
  let lexicon = null;
  let lexiconPromise = null;
  const lexiconWaiters = [];
  const getLexicon = () => {
    lexiconPromise ??= loadTeamDictionaries()
      .then((dictionaries) => createTeamLexicon(dictionaries, locale))
      .then((value) => {
        lexicon = value;
        for (const callback of lexiconWaiters.splice(0)) callback(value);
        return value;
      })
      .catch((error) => {
        lexiconPromise = null;
        throw error;
      });
    return lexiconPromise;
  };
  // Chỉ form đăng đội cần binh thư (để phân biệt binh thư với chiến pháp trùng tên khi đọc ảnh).
  let formLexiconPromise = null;
  const getFormLexicon = () => {
    formLexiconPromise ??= Promise.all([loadTeamDictionaries(), loadTeamBooks()])
      .then(([dictionaries, books]) => createTeamLexicon({ ...dictionaries, books }, locale))
      .catch((error) => {
        formLexiconPromise = null;
        throw error;
      });
    return formLexiconPromise;
  };
  const whenLexicon = (callback) => {
    if (lexicon) callback(lexicon);
    else lexiconWaiters.push(callback);
  };
  const heroNode = (id) => {
    const node = heroBadge(lexicon, id);
    if (!lexicon) {
      whenLexicon((value) => {
        if (node.isConnected) node.replaceWith(heroBadge(value, id));
      });
    }
    return node;
  };
  const tacticNode = (id) => {
    const node = el('span', { class: 'cm-team-tactic', dataset: { tacticId: id } }, tacticName(lexicon, id));
    if (!lexicon) whenLexicon((value) => { node.textContent = tacticName(value, id); });
    return node;
  };

  /* ---------- Điều hướng ---------- */
  const hrefFor = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return localePath('/doi-cong-dong/') + (query ? `?${query}` : '');
  };
  const go = (params = {}, { message = '' } = {}) => {
    history.pushState(null, '', hrefFor(params));
    flash = message;
    render();
  };
  const link = (params, children, className = 'cm-link') => {
    const anchor = el('a', { class: className, href: hrefFor(params) }, children);
    anchor.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(params);
    });
    return anchor;
  };
  const nav = (active, { canPost = true } = {}) => el('nav', { class: 'cm-team-nav', 'aria-label': L('Đội cộng đồng', '社区阵容') }, [
    link({}, L('Danh sách', '列表'), `cm-team-tab${active === 'list' ? ' is-active' : ''}`),
    canPost ? link({ new: '1' }, L('Đăng đội', '发布阵容'), `cm-team-tab${active === 'new' ? ' is-active' : ''}`) : null,
    link({ mine: '1' }, L('Đội của tôi', '我的阵容'), `cm-team-tab${active === 'mine' ? ' is-active' : ''}`),
  ]);

  const teamHref = (id) => hrefFor({ id });
  const imageUrl = (id, position) => `/api/community-teams/${encodeURIComponent(id)}/images/${position}`;

  /* ---------- Mảnh dùng chung ---------- */
  const heading = (text) => el('h2', { class: 'cm-title cm-team-heading', tabindex: '-1' }, text);
  const statusBadge = (status) => {
    const key = Object.hasOwn(STATUS_LABELS, status) ? status : 'pending';
    return el('span', { class: 'cm-badge', dataset: { status: key } }, STATUS_LABELS[key]());
  };
  const stat = (symbol, value, label) => el('span', { class: 'cm-team-stat', title: label }, [
    el('span', { 'aria-hidden': 'true' }, `${symbol} ${formatNumber(value)}`),
    el('span', { class: 'visually-hidden' }, `${label}: ${formatNumber(value)}`),
  ]);

  function heroRow(team) {
    return el('div', { class: 'cm-team-heroes' }, team.heroes.map((id) => heroNode(id)));
  }

  function teamCard(team, { showSeason = false, extra = null } = {}) {
    const card = el('li', { class: 'cm-team-card', dataset: { teamId: team.id } });
    const title = link({ id: team.id }, team.title, 'cm-team-card-title');
    card.append(
      team.imageCount > 0
        ? el('img', { class: 'cm-team-thumb', src: imageUrl(team.id, 0), alt: '', loading: 'lazy', decoding: 'async' })
        : null,
      el('div', { class: 'cm-team-card-body' }, [
        el('h3', { class: 'cm-team-card-heading' }, title),
        heroRow(team),
        el('p', { class: 'cm-team-meta' }, [
          el('span', { class: 'cm-team-troop' }, troopLabel(team.troop)),
          showSeason && team.season ? el('span', { class: 'cm-team-season' }, seasonLabel(team.season, locale)) : null,
          langTag(team.textLang),
          extra,
        ]),
        el('p', { class: 'cm-team-stats' }, [
          stat('▲', team.upVotes, L('Bình chọn lên', '赞成票')),
          stat('▼', team.downVotes, L('Bình chọn xuống', '反对票')),
          stat('⚔', team.evidenceCount, L('Người thắng', '获胜玩家')),
          stat('💬', team.commentCount, L('Bình luận', '评论')),
        ]),
        el('p', { class: 'cm-team-author' }, [avatar(team.author), el('span', {}, displayName(team.author))]),
      ]),
    );
    return card;
  }

  /* ---------- Danh sách ---------- */
  async function listView(view, isCurrent) {
    const seasonsBody = await api('/api/community-seasons');
    if (!isCurrent()) return;
    const open = seasonsBody?.open ?? null;
    const seasons = Array.isArray(seasonsBody?.seasons) ? seasonsBody.seasons : [];
    const state = { season: open ? open.id : 'all', sort: 'hot', heroes: [], items: [], cursor: null, seq: 0 };

    const seasonSelect = el('select', { id: 'cm-team-season', class: 'cm-select' }, [
      ...seasons.map((season) => el('option', { value: season.id }, `${seasonLabel(season, locale)}${open?.id === season.id ? L(' (đang mở)', '（进行中）') : ''}`)),
      el('option', { value: 'all' }, L('Tất cả mùa', '全部赛季')),
    ]);
    seasonSelect.value = state.season;
    const sortSelect = el('select', { id: 'cm-team-sort', class: 'cm-select' }, SORTS.map(([value, label]) => el('option', { value }, label())));
    const listId = 'cm-team-hero-options';
    const datalist = el('datalist', { id: listId });
    const heroInputs = [0, 1, 2].map((index) => el('input', {
      class: 'cm-input cm-team-filter-hero',
      type: 'text',
      list: listId,
      autocomplete: 'off',
      'aria-label': L(`Lọc theo tướng ${index + 1}`, `按武将 ${index + 1} 筛选`),
      placeholder: L(`Tướng ${index + 1}`, `武将 ${index + 1}`),
    }));
    const status = liveStatus();
    const grid = el('ol', { class: 'cm-team-grid', 'aria-label': L('Danh sách đội', '阵容列表') });
    const empty = el('p', { class: 'scope-note cm-empty', hidden: '' });
    const more = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Xem thêm', '查看更多'));

    whenLexicon((value) => {
      datalist.replaceChildren(...datalistOptions(value.heroLabels, locale).map((label) => el('option', { value: label })));
    });
    getLexicon().catch(() => {});

    const renderItems = (focusFrom = null) => {
      grid.replaceChildren(...state.items.map((team) => teamCard(team, { showSeason: state.season === 'all' })));
      empty.hidden = state.items.length > 0;
      more.hidden = !state.cursor;
      if (focusFrom !== null) {
        const target = grid.children[focusFrom];
        if (target) {
          target.tabIndex = -1;
          target.focus();
        }
      }
    };
    empty.textContent = open || state.season === 'all'
      ? L('Chưa có đội nào phù hợp.', '暂无符合条件的阵容。')
      : L('Chưa có đội nào.', '暂无阵容。');

    async function load(reset) {
      const seq = ++state.seq;
      const params = new URLSearchParams({ season: state.season, sort: state.sort });
      if (state.heroes.length) params.set('heroes', state.heroes.join(','));
      if (!reset && state.cursor) params.set('cursor', state.cursor);
      grid.setAttribute('aria-busy', 'true');
      more.disabled = true;
      try {
        const body = await api(`/api/community-teams?${params}`);
        if (seq !== state.seq || !isCurrent()) return;
        const items = Array.isArray(body?.items) ? body.items : [];
        const before = state.items.length;
        state.items = reset ? mergePage([], items) : mergePage(state.items, items);
        state.cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
        status.set('');
        renderItems(reset ? null : before);
      } catch (error) {
        if (seq === state.seq && isCurrent()) status.set(describeError(error), 'error');
      } finally {
        if (seq === state.seq) {
          grid.removeAttribute('aria-busy');
          more.disabled = false;
        }
      }
    }

    seasonSelect.addEventListener('change', () => { state.season = seasonSelect.value; load(true); });
    sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; load(true); });
    const applyHeroFilter = async () => {
      let lex = lexicon;
      if (!lex) {
        try {
          lex = await getLexicon();
        } catch {
          status.set(L('Chưa tải được danh sách tướng. Hãy thử lại.', '尚未加载武将列表，请重试。'), 'error');
          return;
        }
      }
      const ids = [];
      for (const input of heroInputs) {
        const cell = cellFromInput(input.value, lex.indexes.heroes, lex.heroLabels);
        if (cell.state === 'sure' && !ids.includes(cell.id)) {
          ids.push(cell.id);
          input.removeAttribute('aria-invalid');
        } else if (input.value.trim()) {
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.removeAttribute('aria-invalid');
        }
      }
      state.heroes = ids;
      load(true);
    };
    for (const input of heroInputs) input.addEventListener('change', applyHeroFilter);
    more.addEventListener('click', () => load(false));

    const field = (id, label, control) => el('div', { class: 'cm-field' }, [el('label', { class: 'cm-label', for: id }, label), control]);
    view.append(
      nav('list', { canPost: Boolean(open) }),
      heading(L('Đội cộng đồng', '社区阵容')),
      open
        ? el('p', { class: 'scope-note' }, L(`Mùa đang mở: ${seasonLabel(open, locale)}.`, `进行中的赛季：${seasonLabel(open, locale)}。`))
        : el('p', { class: 'cm-notice', role: 'note' }, L('Chưa mở mùa. Hiện chưa nhận đội mới.', '赛季尚未开放，暂不接受新阵容。')),
      el('div', { class: 'cm-team-filters' }, [
        field('cm-team-season', L('Mùa', '赛季'), seasonSelect),
        field('cm-team-sort', L('Sắp xếp', '排序'), sortSelect),
        el('fieldset', { class: 'cm-team-filter-heroes' }, [
          el('legend', { class: 'cm-label' }, L('Lọc theo tướng (tối đa 3)', '按武将筛选（最多 3 名）')),
          ...heroInputs,
          datalist,
        ]),
      ]),
      status,
      grid,
      empty,
      more,
    );
    await load(true);
  }

  /* ---------- Chi tiết ---------- */
  async function detailView(view, isCurrent, id) {
    const team = await api(`/api/community-teams/${encodeURIComponent(id)}`);
    if (!isCurrent()) return;
    const isOwner = Boolean(user?.id) && team.author?.id === user.id;
    const approved = team.status === 'approved';
    const status = liveStatus();

    const images = Array.from({ length: Math.min(Number(team.imageCount) || 0, 3) }, (_, position) => el('a', {
      class: 'cm-team-image-link',
      href: imageUrl(team.id, position),
      target: '_blank',
      rel: 'noopener',
    }, [
      el('img', {
        class: 'cm-team-image',
        src: imageUrl(team.id, position),
        alt: L(`Ảnh ${position + 1} của đội`, `阵容图片 ${position + 1}`),
        loading: 'lazy',
        decoding: 'async',
      }),
      el('span', { class: 'visually-hidden' }, L('(mở tab mới)', '（在新标签页打开）')),
    ]));

    const tacticsRows = team.heroes.map((hero, index) => el('tr', {}, [
      el('th', { scope: 'row' }, heroNode(hero)),
      ...(team.tactics?.[index] || []).map((tactic) => el('td', {}, tacticNode(tactic))),
    ]));
    const table = el('table', { class: 'cm-team-table' }, [
      el('caption', { class: 'visually-hidden' }, L('Tướng và chiến pháp', '武将与战法')),
      el('thead', {}, el('tr', {}, [
        el('th', { scope: 'col' }, L('Tướng', '武将')),
        el('th', { scope: 'col' }, L('Chiến pháp 1', '战法 1')),
        el('th', { scope: 'col' }, L('Chiến pháp 2', '战法 2')),
      ])),
      el('tbody', {}, tacticsRows),
    ]);

    const analysis = el('dl', { class: 'cm-team-analysis' }, ANALYSIS_FIELDS.flatMap(([key, label]) => {
      const text = team.analysis?.[key];
      if (typeof text !== 'string' || !text.trim()) return [];
      return [el('div', { class: 'cm-team-analysis-item' }, [
        el('dt', {}, [label(), ' ', langTag(team.textLang)]),
        el('dd', { class: 'cm-team-text' }, text),
      ])];
    }));

    /* Bình chọn */
    let myVote = Number(team.myVote) || 0;
    const counts = { up: team.upVotes, down: team.downVotes, points: team.points };
    const upButton = el('button', { class: 'ana-btn cm-team-vote', type: 'button', 'aria-pressed': 'false', dataset: { vote: 'up' } });
    const downButton = el('button', { class: 'ana-btn cm-team-vote', type: 'button', 'aria-pressed': 'false', dataset: { vote: 'down' } });
    const pointsNode = el('span', { class: 'cm-team-points' });
    const guestSlot = el('div', { class: 'cm-team-guest' });
    const voteLocked = !team.seasonOpen || isOwner;
    const paintVote = () => {
      upButton.replaceChildren(`▲ ${formatNumber(counts.up)}`);
      downButton.replaceChildren(`▼ ${formatNumber(counts.down)}`);
      upButton.setAttribute('aria-pressed', String(myVote === 1));
      downButton.setAttribute('aria-pressed', String(myVote === -1));
      upButton.setAttribute('aria-label', L(`Bình chọn lên (${counts.up})`, `赞成（${counts.up}）`));
      downButton.setAttribute('aria-label', L(`Bình chọn xuống (${counts.down})`, `反对（${counts.down}）`));
      pointsNode.textContent = L(`${formatNumber(counts.points)} điểm`, `${formatNumber(counts.points)} 分`);
    };
    paintVote();
    upButton.disabled = voteLocked;
    downButton.disabled = voteLocked;
    const castVote = async (value) => {
      if (!user) {
        guestSlot.replaceChildren(signInPrompt(L('Đăng nhập để bình chọn.', '登录后即可投票。')));
        return;
      }
      const next = myVote === value ? 0 : value;
      upButton.disabled = true;
      downButton.disabled = true;
      try {
        const result = await api(`/api/community-teams/${encodeURIComponent(team.id)}/vote`, { method: 'PUT', json: { value: next } });
        counts.up = result.upVotes;
        counts.down = result.downVotes;
        counts.points = result.points;
        myVote = Number(result.myVote) || 0;
        paintVote();
        status.set(L('Đã cập nhật bình chọn.', '投票已更新。'));
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        upButton.disabled = voteLocked;
        downButton.disabled = voteLocked;
      }
    };
    upButton.addEventListener('click', () => castVote(1));
    downButton.addEventListener('click', () => castVote(-1));
    const voteNote = !team.seasonOpen
      ? L('Mùa đã đóng — không nhận bình chọn mới.', '赛季已结束，不再接受投票。')
      : isOwner ? L('Bạn không thể bình chọn cho đội của mình.', '不能给自己的阵容投票。') : '';

    /* Xoá */
    let deleteButton = null;
    if (isOwner) {
      deleteButton = el('button', { class: 'cm-text-btn cm-team-delete', type: 'button' }, L('Xoá đội', '删除阵容'));
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm(L('Xoá đội này? Ảnh và dữ liệu đi kèm cũng bị xoá.', '删除此阵容？附带的图片和数据也会被删除。'))) return;
        deleteButton.disabled = true;
        try {
          await api(`/api/community-teams/${encodeURIComponent(team.id)}`, { method: 'DELETE' });
          go({ mine: '1' }, { message: L('Đã xoá đội.', '阵容已删除。') });
        } catch (error) {
          deleteButton.disabled = false;
          status.set(describeError(error), 'error');
        }
      });
    }

    const similar = el('section', { class: 'cm-team-similar', hidden: '' }, [
      el('h3', { class: 'cm-subtitle' }, L('Đội tương tự (cùng 3 tướng)', '相同三名武将的阵容')),
    ]);
    const similarList = el('ul', { class: 'cm-team-similar-list' });
    similar.append(similarList);

    view.append(
      nav('detail'),
      el('p', {}, link({}, L('← Về danh sách', '← 返回列表'))),
      el('article', { class: 'cm-team-detail' }, [
        heading(team.title),
        el('p', { class: 'cm-team-meta' }, [
          team.status !== 'approved' ? statusBadge(team.status) : null,
          team.season ? el('span', { class: 'cm-team-season' }, seasonLabel(team.season, locale)) : null,
          el('span', { class: 'cm-team-troop' }, troopLabel(team.troop)),
          langTag(team.textLang),
          avatar(team.author),
          el('span', {}, displayName(team.author)),
          timeNode(team.createdAt),
        ]),
        team.status === 'pending'
          ? el('p', { class: 'cm-notice', role: 'note' }, L('Đội đang chờ duyệt; chỉ bạn và quản trị viên xem được.', '阵容正在等待审核；仅你和管理员可见。'))
          : null,
        team.status === 'rejected'
          ? el('p', { class: 'cm-reject-reason' }, [el('strong', {}, L('Lý do từ chối: ', '拒绝原因：')), String(team.rejectReason || '—')])
          : null,
        images.length ? el('div', { class: 'cm-team-images' }, images) : null,
        table,
        analysis,
        approved
          ? el('div', { class: 'cm-team-vote-bar' }, [
              upButton,
              downButton,
              pointsNode,
              stat('⚔', team.evidenceCount, L('Người thắng', '获胜玩家')),
              voteNote ? el('span', { class: 'scope-note cm-team-vote-note' }, voteNote) : null,
            ])
          : null,
        guestSlot,
        status,
        deleteButton ? el('p', {}, deleteButton) : null,
        similar,
      ]),
    );

    if (approved && team.heroKey) {
      api(`/api/community-teams?${new URLSearchParams({ heroes: team.heroKey, season: 'all' })}`).then((body) => {
        if (!isCurrent()) return;
        const others = (Array.isArray(body?.items) ? body.items : []).filter((item) => item.id !== team.id).slice(0, 5);
        if (!others.length) return;
        similarList.replaceChildren(...others.map((item) => el('li', {}, [
          link({ id: item.id }, item.title),
          ' ',
          el('span', { class: 'scope-note' }, `${seasonLabel(item.season, locale)} · ▲ ${formatNumber(item.upVotes)}`),
        ])));
        similar.hidden = false;
      }).catch(() => {});
    }

    if (approved) {
      const widgets = el('div', { class: 'cm-team-widgets' });
      view.append(widgets);
      const pageKey = `/doi-cong-dong/${team.id}/`;
      try {
        const reports = mountReports(widgets, { pageKey, lang: locale, user, sharedPool: true, archived: !team.seasonOpen });
        const comments = mountComments(widgets, { pageKey, lang: locale, user, sharedPool: true });
        await Promise.all([reports.load(), comments.load()]);
      } catch {
        widgets.replaceChildren(unavailableNotice());
      }
    }
  }

  /* ---------- Của tôi ---------- */
  async function mineView(view, isCurrent) {
    view.append(nav('mine'), heading(L('Đội của tôi', '我的阵容')));
    if (!user) {
      view.append(signInPrompt(L('Đăng nhập để xem các đội bạn đã đăng.', '登录后即可查看你发布的阵容。')));
      return;
    }
    const status = liveStatus();
    const list = el('ol', { class: 'cm-team-grid', 'aria-label': L('Đội của tôi', '我的阵容') });
    const empty = el('p', { class: 'scope-note cm-empty', hidden: '' }, L('Bạn chưa đăng đội nào.', '你还没有发布阵容。'));
    const more = el('button', { class: 'ana-btn cm-more', type: 'button', hidden: '' }, L('Xem thêm', '查看更多'));
    let cursor = null;
    let items = [];

    const mineCard = (team) => {
      const deleting = team.deleting === true;
      const remove = el('button', { class: 'cm-text-btn cm-team-delete', type: 'button' }, deleting ? L('Thử xoá tiếp', '继续删除') : L('Xoá', '删除'));
      const card = teamCard(team, {
        showSeason: true,
        extra: deleting
          ? el('span', { class: 'cm-badge', dataset: { status: 'pending' } }, L('Đang xoá dở', '删除未完成'))
          : statusBadge(team.status),
      });
      const body = card.querySelector('.cm-team-card-body');
      if (team.status === 'rejected' && team.rejectReason) {
        body.append(el('p', { class: 'cm-reject-reason' }, [el('strong', {}, L('Lý do: ', '原因：')), String(team.rejectReason)]));
      }
      body.append(el('p', {}, remove));
      remove.addEventListener('click', async () => {
        if (!deleting && !window.confirm(L('Xoá đội này?', '删除此阵容？'))) return;
        remove.disabled = true;
        try {
          await api(`/api/community-teams/${encodeURIComponent(team.id)}`, { method: 'DELETE' });
          items = items.filter((item) => item.id !== team.id);
          card.remove();
          empty.hidden = items.length > 0;
          status.set(L('Đã xoá đội.', '阵容已删除。'));
        } catch (error) {
          remove.disabled = false;
          status.set(describeError(error), 'error');
        }
      });
      return card;
    };

    async function load() {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      const body = await api(`/api/me/community-teams${params.size ? `?${params}` : ''}`);
      if (!isCurrent()) return;
      const fresh = Array.isArray(body?.items) ? body.items : [];
      const known = new Set(items.map((item) => item.id));
      items = mergePage(items, fresh);
      for (const team of fresh) if (!known.has(team.id)) list.append(mineCard(team));
      cursor = typeof body?.nextCursor === 'string' && body.nextCursor ? body.nextCursor : null;
      more.hidden = !cursor;
      empty.hidden = items.length > 0;
    }
    more.addEventListener('click', async () => {
      more.disabled = true;
      try {
        await load();
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        more.disabled = false;
      }
    });
    view.append(status, list, empty, more);
    await load();
  }

  /* ---------- Đăng ---------- */
  async function newView(view, isCurrent) {
    view.append(nav('new'), heading(L('Đăng đội mới', '发布新阵容')));
    if (!user) {
      view.append(signInPrompt(L('Đăng nhập để đăng đội.', '登录后即可发布阵容。')));
      return;
    }
    const seasonsBody = await api('/api/community-seasons');
    if (!isCurrent()) return;
    const open = seasonsBody?.open ?? null;
    if (!open) {
      view.append(el('p', { class: 'cm-notice', role: 'note' }, L('Chưa mở mùa. Hiện chưa nhận đội mới.', '赛季尚未开放，暂不接受新阵容。')));
      return;
    }
    mountTeamForm(view, {
      season: open,
      locale,
      getLexicon: getFormLexicon,
      teamHref: (teamId) => teamHref(teamId),
      onSubmitted: () => go({ mine: '1' }, {
        message: L('Đã gửi đội, đang chờ quản trị viên duyệt.', '阵容已提交，等待管理员审核。'),
      }),
    });
  }

  /* ---------- Bộ điều phối ---------- */
  async function render() {
    const token = ++renderToken;
    const isCurrent = () => token === renderToken;
    const { mode, id } = modeFromSearch(location.search);
    const view = el('div', { class: 'cm-team-view', dataset: { mode } });
    const message = flash;
    flash = '';
    mount.replaceChildren(view);
    if (message) view.append(el('p', { class: 'cm-notice', role: 'status' }, message));
    mount.setAttribute('aria-busy', 'true');
    try {
      if (mode === 'detail') await detailView(view, isCurrent, id);
      else if (mode === 'mine') await mineView(view, isCurrent);
      else if (mode === 'new') await newView(view, isCurrent);
      else await listView(view, isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      view.append(error?.status === 404 ? el('p', { class: 'cm-notice', role: 'note' }, describeError(error)) : unavailableNotice());
    } finally {
      if (isCurrent()) {
        mount.removeAttribute('aria-busy');
        if (!first) view.querySelector('.cm-team-heading')?.focus?.();
        first = false;
      }
    }
  }

  window.addEventListener('popstate', render);
  getLexicon().catch(() => {});
  loadSession({ probe: true }).catch(() => null).then((value) => {
    user = value || null;
    return render();
  });
  return { render };
}

initCommunityTeams();
