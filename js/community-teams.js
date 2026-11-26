// Trang Đội cộng đồng (`/doi-cong-dong/`, `/zh/doi-cong-dong/`): bốn chế độ đọc từ `location.search` —
// danh sách (mặc định), chi tiết `?id=`, đăng `?new=1`, của tôi `?mine=1` — theo artboard "Thiết kế mới"
// DoiCongDongMoi / DoiCongDongDetailMoi / DoiCongDongNewMoi / DoiCongDongMineMoi. Văn bản người dùng luôn là text node.
// Hàm thuần nằm ở js/community-team-state.js, thẻ ở js/community-team-cards.js, khung chi tiết ở
// js/community-team-detail.js, form đăng ở js/community-team-form.js, tên tướng/CP ở js/community-team-data.js.

import { cellFromInput } from './analyze-map.js';
import { L, currentLocale, formatNumber, localePath } from './i18n.js';
import { api, describeError, liveStatus, loadSession, signInPrompt, unavailableNotice } from './community-api.js';
import { mountComments } from './community-comments.js';
import { mountReports } from './community-reports.js';
import { listTeamCard, mineTally, mineTeamCard, statusBadge } from './community-team-cards.js';
import { createTeamLexicon, datalistOptions, heroNameResolver, loadTeamBooks, loadTeamDictionaries, seasonLabel, tacticName } from './community-team-data.js';
import { detailLayout, similarCard } from './community-team-detail.js';
import { mountTeamForm } from './community-team-form.js';
import { mergePage, modeFromSearch, staticTeamPath } from './community-team-state.js';
import { teamIcon } from './community-team-ui.js';
import { activatePortraits, heroPortrait } from './hero-portrait.js';
import { confirmInPage } from './inline-confirm.js';
import { lookupItemPath } from './lookup-ids.js';
import { el } from './render.js';

const SORTS = [
  ['hot', () => L('Hot', '热门', '人気'), () => L('Hot: điểm cao và còn mới lên trước', '热门：分数高且较新的在前', '人気：スコアが高く新しいものが先頭')],
  ['new', () => L('Mới', '最新', '新着'), () => L('Mới: đội vừa được duyệt lên trước', '最新：刚通过审核的在前', '新着：承認されたばかりの編成が先頭')],
  ['top', () => L('Top', '最高分', '最高スコア'), () => L('Top: điểm cao nhất lên trước', '最高分：分数最高的在前', '最高スコア：スコアが最も高いものが先頭')],
];

export function initCommunityTeams(mount = document.getElementById('community-teams')) {
  if (!mount) return null;
  const locale = currentLocale();
  // Trang tĩnh `/doi-cong-dong/<id>/`: mount mang `data-team-id`; nội dung đã dựng sẵn, JS chỉ gắn phần sống (vote, bình luận…).
  const staticId = mount.dataset.teamId ?? null;
  const isStatic = modeFromSearch('', staticId).mode === 'static';
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
  /** Bộ tra tên cho thẻ: nút dựng ngay (id thô / ô trống), thay bằng tên + chân dung khi từ điển về. */
  const names = {
    hero(id, className = 'cm-team-hero-name') {
      const node = el('span', { class: className, dataset: { heroId: id } }, lexicon ? lexicon.heroName(id) : String(id));
      if (!lexicon) whenLexicon((value) => { node.textContent = value.heroName(id); });
      return node;
    },
    portrait(id, className) {
      const make = (value) => {
        const record = value?.heroRecord(id) ?? null;
        return record
          ? heroPortrait({ chinese: record.chinese, nameVi: record.viet, iconUrl: record.iconUrl, className, alt: '' })
          : el('span', { class: `hero-portrait ${className}`, 'aria-hidden': 'true' });
      };
      const node = make(lexicon);
      if (!lexicon) whenLexicon((value) => { if (node.isConnected) node.replaceWith(make(value)); });
      return node;
    },
    tactic(id) {
      const node = el('span', { class: 'cm-team-tactic', dataset: { tacticId: id } }, tacticName(lexicon, id));
      if (!lexicon) whenLexicon((value) => { node.textContent = tacticName(value, id); });
      return node;
    },
    /**
     * Phần tử dẫn sang trang riêng Tra cứu như trang tĩnh: `build(href)` dựng `<a>` khi từ điển có mục (chiến pháp đổi
     * id được dẫn về id hiện hành) và mục có trang riêng, `build(null)` dựng bản không link; dựng lại khi từ điển về.
     */
    lookup(kind, id, build) {
      const hrefOf = (value) => {
        const record = kind === 'hero' ? value?.heroRecord(id) : value?.tacticRecord(id);
        const path = record ? lookupItemPath(String(record.id ?? id)) : null;
        return path ? localePath(path) : null;
      };
      const node = build(hrefOf(lexicon));
      if (!lexicon) whenLexicon((value) => {
        const href = hrefOf(value);
        if (href && node.parentNode) node.replaceWith(build(href));
      });
      return node;
    },
  };

  /* ---------- Mùa (một lần cho cả trang; lỗi thì lần sau hỏi lại) ---------- */
  // `current` = mùa hiện hành của Đội chuẩn (không nhất thiết là mùa đầu danh mục); `seasons` theo thứ tự catalog.
  let seasonsPromise = null;
  const getSeasons = () => {
    seasonsPromise ??= api('/api/community-seasons').then((body) => ({
      current: typeof body?.current === 'string' && body.current ? body.current : null,
      seasons: Array.isArray(body?.seasons) ? body.seasons : [],
    })).catch((error) => {
      seasonsPromise = null;
      throw error;
    });
    return seasonsPromise;
  };

  /* ---------- Điều hướng ---------- */
  const hrefFor = (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return localePath('/doi-cong-dong/') + (query ? `?${query}` : '');
  };
  const go = (params = {}, { message = '' } = {}) => {
    // Trang tĩnh không có SPA để dựng lại: mọi điều hướng là tải trang mới.
    if (isStatic) {
      location.assign(hrefFor(params));
      return;
    }
    history.pushState(null, '', hrefFor(params));
    flash = message;
    render();
  };
  /** Click thường trên link nội bộ đi qua SPA (`go`), giữ mở tab mới / phím bổ trợ như link thường. */
  const routeClicks = (anchor, params) => {
    anchor.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(params);
    });
    return anchor;
  };
  const link = (params, children, className = 'cm-link', href = hrefFor(params)) => routeClicks(el('a', { class: className, href }, children), params);
  // Đội đã duyệt có URL tĩnh công khai; click thường vẫn đi qua `?id=` (SPA kiểm HEAD rồi chuyển) để cửa sổ "đã duyệt,
  // build chưa xong" không rơi vào 404. Đội chưa duyệt (Của tôi) giữ `?id=`.
  const isApprovedItem = (team) => !team.status || team.status === 'approved';
  const teamLink = (team, children, className = 'cm-link') =>
    link({ id: team.id }, children, className, isApprovedItem(team) ? staticTeamPath(team.id, locale) : hrefFor({ id: team.id }));

  /* ---------- Đầu trang (khung tĩnh của CommunityTeamsHub.astro) ---------- */
  const head = document.getElementById('cm-team-head');
  const headNav = document.getElementById('cm-team-head-nav');
  const kicker = document.getElementById('cm-team-kicker');
  let headNote = null;
  const tabs = (active) => el('nav', { class: 'cm-team-tabs', 'aria-label': L('Đội cộng đồng', '社区阵容', 'コミュニティ編成') }, [
    ['list', {}, L('Danh sách', '列表', '一覧')],
    ['new', { new: '1' }, L('Đăng đội', '发布阵容', '編成を投稿')],
    ['mine', { mine: '1' }, L('Đội của tôi', '我的阵容', 'マイ編成')],
  ].map(([mode, params, label]) => {
    const anchor = link(params, label, 'cm-team-tab');
    if (mode === active) anchor.setAttribute('aria-current', 'page');
    return anchor;
  }));
  /** Danh sách: nút "Đội của tôi" + "Đăng đội" và dòng công thức điểm; Đăng/Của tôi: tab; chi tiết `?id=`: ẩn đầu trang. */
  function paintHead(mode) {
    if (!head) return;
    head.hidden = mode === 'detail';
    if (kicker) kicker.textContent = L('Cộng đồng', '社区', 'コミュニティ');
    headNote?.remove();
    headNote = null;
    if (mode === 'list') {
      headNav?.replaceChildren(el('nav', { class: 'cm-team-actions', 'aria-label': L('Đội cộng đồng', '社区阵容', 'コミュニティ編成') }, [
        link({ mine: '1' }, [teamIcon('list'), L('Đội của tôi', '我的阵容', 'マイ編成')], 'cm-team-btn cm-team-action-mine'),
        link({ new: '1' }, [teamIcon('plus'), L('Đăng đội', '发布阵容', '編成を投稿')], 'cm-team-btn cm-team-btn-primary cm-team-action-new'),
      ]));
      headNote = el('p', { class: 'cm-team-head-note' }, [
        teamIcon('info'),
        el('span', {}, L(
          'Điểm = bình chọn lên − bình chọn xuống + 2 × số người thắng (người chơi khác gửi chiến báo thắng đã duyệt).',
          '分数 = 赞成票 − 反对票 + 2 × 获胜人数（其他玩家提交并已通过审核的胜利战报）。', 'スコア = 賛成票 − 反対票 + 2 × 勝利者数（他のプレイヤーが投稿し承認された勝利戦報）。',
        )),
      ]);
      head.append(headNote);
    } else if (mode === 'new' || mode === 'mine') {
      headNav?.replaceChildren(tabs(mode));
    } else {
      headNav?.replaceChildren();
    }
  }

  /* ---------- Mảnh dùng chung ---------- */
  const heading = (text) => el('h2', { class: 'cm-team-view-title cm-team-heading', tabindex: '-1' }, text);
  const viewHead = (title, sub, action = null) => el('div', { class: 'cm-team-view-head' }, [
    el('div', { class: 'cm-team-view-head-text' }, [heading(title), el('p', { class: 'cm-team-view-sub' }, sub)]),
    action,
  ]);
  const card = (title, children, className = '') => el('section', { class: `cm-team-side-card ${className}`.trim() }, [
    el('h2', { class: 'cm-team-side-title' }, title),
    ...children,
  ]);

  /* ---------- Danh sách ---------- */
  async function listView(view, isCurrent) {
    const { current, seasons } = await getSeasons();
    if (!isCurrent()) return;
    paintHead('list');
    // Mặc định lọc mùa hiện hành; catalog không có mùa đó (không nên xảy ra) thì xem tất cả.
    const state = { season: seasons.some((item) => item.id === current) ? current : 'all', sort: 'hot', heroes: [], items: [], cursor: null, seq: 0 };

    const seasonSelect = el('select', { id: 'cm-team-season', class: 'cm-team-season-select' }, [
      ...seasons.map((season) => el('option', { value: season.id }, `${seasonLabel(season, locale)}${current === season.id ? L(' (hiện hành)', '（当前）', '（現在）') : ''}`)),
      el('option', { value: 'all' }, L('Tất cả mùa', '全部赛季', '全シーズン')),
    ]);
    seasonSelect.value = state.season;
    const seasonField = el('label', { class: 'cm-team-season-field' }, [
      el('span', { class: 'cm-team-caps' }, L('Mùa', '赛季', 'シーズン')),
      seasonSelect,
      teamIcon('chevronDown'),
    ]);

    const sortButtons = SORTS.map(([value, label]) => {
      const button = el('button', { class: 'cm-team-segment-btn', type: 'button', 'aria-pressed': 'false', dataset: { sort: value } }, label());
      button.addEventListener('click', () => {
        if (state.sort === value) return;
        state.sort = value;
        paintSort();
        load(true);
      });
      return button;
    });
    const paintSort = () => {
      for (const button of sortButtons) button.setAttribute('aria-pressed', String(button.dataset.sort === state.sort));
      paintSummary();
    };
    const sortGroup = el('div', { class: 'cm-team-sort' }, [
      el('span', { id: 'cm-team-sort-label', class: 'cm-team-caps' }, L('Sắp xếp', '排序', '並べ替え')),
      el('div', { class: 'cm-team-segment', role: 'group', 'aria-labelledby': 'cm-team-sort-label' }, sortButtons),
    ]);

    const listId = 'cm-team-hero-options';
    const datalist = el('datalist', { id: listId });
    const heroInputs = [0, 1, 2].map((index) => el('input', {
      class: 'cm-team-filter-input cm-team-filter-hero',
      type: 'text',
      list: listId,
      autocomplete: 'off',
      placeholder: L(`Tướng ${index + 1}`, `武将 ${index + 1}`, `武将 ${index + 1}`),
    }));
    // Mobile gập ô lọc sau nút "Lọc theo tướng"; desktop luôn mở (CSS ẩn nút).
    const filterBox = el('div', { class: 'cm-team-filter' });
    const filterToggle = el('button', { class: 'cm-team-filter-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'cm-team-filter-heroes' }, [
      teamIcon('filter'),
      el('span', { class: 'cm-team-filter-toggle-label' }, L('Lọc theo tướng', '按武将筛选', '武将で絞り込み')),
      el('span', { class: 'cm-team-filter-toggle-hint' }, L('tối đa 3', '最多 3 名', '最大3名')),
      teamIcon('chevronDown'),
    ]);
    filterToggle.addEventListener('click', () => {
      const opened = filterBox.dataset.open !== 'true';
      filterBox.dataset.open = String(opened);
      filterToggle.setAttribute('aria-expanded', String(opened));
    });
    filterBox.append(filterToggle, el('fieldset', { id: 'cm-team-filter-heroes', class: 'cm-team-filter-heroes' }, [
      el('legend', { class: 'cm-team-caps' }, L('Lọc theo tướng · tối đa 3', '按武将筛选 · 最多 3 名', '武将で絞り込み · 最大3名')),
      el('div', { class: 'cm-team-filter-inputs' }, heroInputs.map((input, index) => el('label', { class: 'cm-team-filter-field' }, [
        el('span', { class: 'visually-hidden' }, L(`Lọc theo tướng ${index + 1}`, `按武将 ${index + 1} 筛选`, `武将 ${index + 1} で絞り込み`)),
        teamIcon('search'),
        input,
      ]))),
      datalist,
    ]));

    const summary = el('p', { class: 'cm-team-list-summary', role: 'status' });
    const paintSummary = () => {
      const season = seasons.find((item) => item.id === state.season);
      const sort = SORTS.find(([value]) => value === state.sort);
      summary.replaceChildren(
        el('strong', {}, season ? seasonLabel(season, locale) : L('Tất cả mùa', '全部赛季', '全シーズン')),
        ` · ${sort[2]()}`,
      );
    };
    paintSort();

    const status = liveStatus();
    const grid = el('ol', { class: 'cm-team-grid', 'aria-label': L('Danh sách đội', '阵容列表', '編成一覧') });
    const empty = el('p', { class: 'scope-note cm-empty', hidden: '' });
    const more = el('button', { class: 'cm-team-btn cm-more', type: 'button' }, L('Xem thêm', '查看更多', 'もっと見る'));
    const moreBox = el('div', { class: 'cm-team-more', hidden: '' }, [
      more,
      el('p', { class: 'cm-team-more-note' }, L('Mỗi lượt hiện 20 đội; bấm để nối thêm, đội đã hiện giữ nguyên.', '每次显示 20 个阵容；点击可继续加载，已显示的保持不变。', '一度に20編成を表示します。クリックで続きを読み込み、表示済みの編成はそのままです。')),
    ]);

    whenLexicon((value) => {
      datalist.replaceChildren(...datalistOptions(value.heroLabels, locale).map((label) => el('option', { value: label })));
    });
    getLexicon().catch(() => {});

    const renderItems = (focusFrom = null) => {
      grid.replaceChildren(...state.items.map((team) => listTeamCard(team, {
        names,
        locale,
        titleLink: teamLink,
        headingTag: 'h2',
        showSeason: state.season === 'all',
      })));
      empty.hidden = state.items.length > 0;
      moreBox.hidden = !state.cursor;
      if (focusFrom !== null) {
        const target = grid.children[focusFrom];
        if (target) {
          target.tabIndex = -1;
          target.focus();
        }
      }
    };
    empty.textContent = L('Chưa có đội nào phù hợp.', '暂无符合条件的阵容。', '条件に合う編成はまだありません。');

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

    seasonSelect.addEventListener('change', () => {
      state.season = seasonSelect.value;
      paintSummary();
      load(true);
    });
    const applyHeroFilter = async () => {
      let lex = lexicon;
      if (!lex) {
        try {
          lex = await getLexicon();
        } catch {
          status.set(L('Chưa tải được danh sách tướng. Hãy thử lại.', '尚未加载武将列表，请重试。', '武将リストを読み込めませんでした。もう一度お試しください。'), 'error');
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

    view.append(
      el('section', { class: 'cm-team-toolbar', 'aria-label': L('Chọn mùa, sắp xếp và lọc', '选择赛季、排序和筛选', 'シーズン・並べ替え・絞り込み') }, [seasonField, sortGroup, filterBox]),
      el('div', { class: 'cm-team-list-meta' }, [
        summary,
        el('p', { class: 'cm-team-list-hint' }, L(
          'Gõ tên rồi chọn từ gợi ý; đội phải có đủ các tướng đã nhập. Tên không khớp được đánh dấu đỏ.',
          '输入名称后从提示中选择；阵容须包含所有已填武将。无法匹配的名称会标红。', '名前を入力して候補から選択してください。入力した武将をすべて含む編成のみ表示されます。一致しない名前は赤で表示されます。',
        )),
      ]),
      status,
      grid,
      empty,
      moreBox,
    );
    await load(true);
  }

  /* ---------- Chi tiết ---------- */
  /** Đội approved có trang tĩnh (HEAD 200) → thay URL `?id=` bằng URL tĩnh; HEAD lỗi/404 hoặc đội chưa duyệt → ở lại. */
  async function redirectToStatic(team, isCurrent) {
    if (team.status !== 'approved') return false;
    const target = staticTeamPath(team.id, locale);
    try {
      const response = await fetch(target, { method: 'HEAD', cache: 'no-store' });
      if (!response.ok || !isCurrent()) return false;
    } catch {
      return false;
    }
    location.replace(target);
    return true;
  }

  /** Nút "Xoá đội" của chủ đội: hỏi lại bằng hộp xác nhận trong trang, xoá xong về "Đội của tôi". */
  function ownerDeleteButton(team) {
    const button = el('button', { class: 'cm-team-btn cm-team-btn-text cm-team-btn-danger cm-team-delete', type: 'button' }, [teamIcon('trash'), L('Xoá đội', '删除阵容', '編成を削除')]);
    button.addEventListener('click', async () => {
      const done = await confirmInPage({
        title: L(`Xoá đội “${team.title}”?`, `删除阵容“${team.title}”？`, `編成「${team.title}」を削除しますか？`),
        message: L('Ảnh và dữ liệu đi kèm cũng bị xoá. Không hoàn tác được.', '附带的图片和数据也会被删除，且无法恢复。', '付随する画像とデータも削除されます。元に戻せません。'),
        confirmLabel: L('Xoá đội', '删除阵容', '編成を削除'),
        onConfirm: async () => {
          try {
            await api(`/api/community-teams/${encodeURIComponent(team.id)}`, { method: 'DELETE' });
          } catch (error) {
            return describeError(error);
          }
          return true;
        },
      });
      if (done) go({ mine: '1' }, { message: L('Đã xoá đội.', '阵容已删除。', '編成を削除しました。') });
    });
    return button;
  }

  /** Bảng "Điểm cộng đồng": điểm, hai nút bình chọn, số người thắng, ghi chú khoá phiếu, lời mời đăng nhập. */
  function scorePanel(team, { isOwner, status }) {
    let myVote = Number(team.myVote) || 0;
    const counts = { up: team.upVotes, down: team.downVotes, points: team.points };
    const upButton = el('button', { class: 'cm-team-vote', type: 'button', 'aria-pressed': 'false', dataset: { vote: 'up' } });
    const downButton = el('button', { class: 'cm-team-vote', type: 'button', 'aria-pressed': 'false', dataset: { vote: 'down' } });
    const pointsNode = el('span', { class: 'cm-team-points' });
    const guestSlot = el('div', { class: 'cm-team-guest' });
    const voteLocked = isOwner;
    const paintVote = () => {
      upButton.replaceChildren(teamIcon('chevronUp'), formatNumber(counts.up));
      downButton.replaceChildren(teamIcon('chevronDown'), formatNumber(counts.down));
      upButton.setAttribute('aria-pressed', String(myVote === 1));
      downButton.setAttribute('aria-pressed', String(myVote === -1));
      upButton.setAttribute('aria-label', L(`Bình chọn lên (${counts.up})`, `赞成（${counts.up}）`, `賛成（${counts.up}）`));
      downButton.setAttribute('aria-label', L(`Bình chọn xuống (${counts.down})`, `反对（${counts.down}）`, `反対（${counts.down}）`));
      pointsNode.textContent = formatNumber(counts.points);
    };
    paintVote();
    upButton.disabled = voteLocked;
    downButton.disabled = voteLocked;
    const castVote = async (value) => {
      if (!user) {
        guestSlot.replaceChildren(signInPrompt(L('Đăng nhập để bình chọn.', '登录后即可投票。', 'ログインすると投票できます。')));
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
        status.set(L('Đã cập nhật bình chọn.', '投票已更新。', '投票を更新しました。'), 'ok');
      } catch (error) {
        status.set(describeError(error), 'error');
      } finally {
        upButton.disabled = voteLocked;
        downButton.disabled = voteLocked;
      }
    };
    upButton.addEventListener('click', () => castVote(1));
    downButton.addEventListener('click', () => castVote(-1));
    const voteNote = isOwner ? L('Bạn không thể bình chọn cho đội của mình.', '不能给自己的阵容投票。', '自分の編成には投票できません。') : '';
    const winners = Number(team.evidenceCount) || 0;
    return el('section', { class: 'cm-team-score', 'aria-labelledby': 'cm-team-score-title' }, [
      el('div', { class: 'cm-team-score-head' }, [
        el('h2', { id: 'cm-team-score-title', class: 'cm-team-caps' }, L('Điểm cộng đồng', '社区分数', 'コミュニティスコア')),
        el('span', { class: 'cm-team-score-formula' }, L('lên − xuống + 2 × người thắng', '赞成 − 反对 + 2 × 获胜人数', '賛成 − 反対 + 2 × 勝利者数')),
      ]),
      el('p', { class: 'cm-team-score-value' }, [pointsNode, el('span', { class: 'cm-team-score-unit' }, L('điểm', '分', 'pt'))]),
      el('div', { class: 'cm-team-vote-bar' }, [upButton, downButton]),
      el('p', { class: 'cm-team-winners' }, [
        teamIcon('trophy'),
        el('span', {}, [
          el('strong', {}, L(`${formatNumber(winners)} người thắng`, `${formatNumber(winners)} 人获胜`, `${formatNumber(winners)} 人が勝利`)),
          L(' · người chơi khác gửi chiến báo thắng đã duyệt', ' · 其他玩家提交并已通过审核的胜利战报', ' · 他のプレイヤーが投稿し承認された勝利戦報'),
        ]),
      ]),
      voteNote ? el('p', { class: 'scope-note cm-team-vote-note' }, voteNote) : null,
      guestSlot,
      status,
      isOwner ? el('p', { class: 'cm-team-owner' }, ownerDeleteButton(team)) : null,
    ]);
  }

  /** Bảng bên phải của đội chưa duyệt (chủ đội / quản trị xem): trạng thái + nút xoá. */
  function statePanel(team, { isOwner, status }) {
    return el('section', { class: 'cm-team-score cm-team-state', 'aria-label': L('Trạng thái duyệt', '审核状态', '審査状況') }, [
      statusBadge(team.status),
      el('p', { class: 'cm-team-state-text' }, team.status === 'rejected'
        ? L('Đội không hiện công khai. Bạn có thể xoá đội này rồi đăng lại.', '阵容不会公开显示。你可以删除后重新发布。', '編成は公開されません。削除してから再投稿できます。')
        : L('Cho tới khi được duyệt, chỉ bạn và quản trị viên xem được đội này.', '审核通过前，只有你和管理员可以看到此阵容。', '承認されるまで、この編成は自分と管理者のみが閲覧できます。')),
      status,
      isOwner ? el('p', { class: 'cm-team-owner' }, ownerDeleteButton(team)) : null,
    ]);
  }

  /**
   * Phần sống của đội: bảng điểm (hoặc trạng thái) vào `side`, đội tương tự vào `aside`, chiến báo + bình luận vào
   * `after`. Cùng pageKey `/doi-cong-dong/<id>/` + `sharedPool` cho cả hai ngôn ngữ và cả hai chế độ.
   */
  async function detailLive({ team, side, aside, after, heroLabels, isCurrent }) {
    const isOwner = Boolean(user?.id) && team.author?.id === user.id;
    const approved = team.status === 'approved';
    const status = liveStatus();
    if (side) {
      side.replaceChildren(approved ? scorePanel(team, { isOwner, status }) : statePanel(team, { isOwner, status }));
      side.hidden = false;
    }

    if (approved && team.heroKey && aside) {
      const similar = similarCard({ teamLink, locale });
      aside.append(similar);
      api(`/api/community-teams?${new URLSearchParams({ heroes: team.heroKey, season: 'all' })}`).then((body) => {
        if (!isCurrent()) return;
        const others = (Array.isArray(body?.items) ? body.items : []).filter((item) => item.id !== team.id).slice(0, 5);
        if (others.length) similar.fill(others, heroLabels());
      }).catch(() => {});
    }

    if (approved) {
      const widgets = el('div', { class: 'cm-team-widgets' });
      after.append(widgets);
      const pageKey = `/doi-cong-dong/${team.id}/`;
      try {
        // Tên tướng chiến báo theo từ điển (tên Việt / chữ Hán theo trang); từ điển chỉ nạp khi có chiến báo để hiện.
        const heroNames = () => getLexicon().then((value) => heroNameResolver(value, { preferIds: team.heroes }));
        const reports = mountReports(widgets, { pageKey, lang: locale, user, sharedPool: true, heroNames });
        const comments = mountComments(widgets, { pageKey, lang: locale, user, sharedPool: true, count: team.commentCount });
        await Promise.all([reports.load(), comments.load()]);
      } catch {
        widgets.replaceChildren(unavailableNotice());
      }
    }
  }

  /** Khung SPA đầy đủ (đội chưa duyệt, hoặc đã duyệt mà trang tĩnh chưa có) dựng vào `view`. */
  async function spaDetail(view, team, isCurrent) {
    view.classList.add('cm-team-detail-page');
    const layout = detailLayout(team, { names, locale, backHref: hrefFor({}) });
    // Trang tĩnh đã có link "Về danh sách" ngoài khung bị ẩn: bỏ link của khung SPA để chỉ còn một.
    if (isStatic) layout.nodes.shift();
    else routeClicks(layout.nodes[0].querySelector('a'), {});
    if (team.status === 'pending') {
      layout.notice.append(el('p', { class: 'cm-notice', role: 'note' }, L('Đội đang chờ duyệt; chỉ bạn và quản trị viên xem được.', '阵容正在等待审核；仅你和管理员可见。', '編成は審査待ちです。自分と管理者のみ閲覧できます。')));
    } else if (team.status === 'rejected') {
      layout.notice.append(el('p', { class: 'cm-reject-reason' }, [el('strong', {}, L('Lý do từ chối: ', '拒绝原因：', '却下理由：')), String(team.rejectReason || '—')]));
    }
    view.append(...layout.nodes);
    await detailLive({
      team,
      side: layout.side,
      aside: layout.aside,
      after: layout.after,
      heroLabels: () => team.heroes.map((id) => (lexicon ? lexicon.heroName(id) : '')),
      isCurrent,
    });
  }

  /** `?id=`: dựng chi tiết trong SPA, trừ khi đội đã có trang tĩnh (khi đó chuyển sang URL tĩnh). */
  async function detailView(view, isCurrent, id) {
    const team = await api(`/api/community-teams/${encodeURIComponent(id)}`);
    if (!isCurrent()) return;
    if (await redirectToStatic(team, isCurrent) || !isCurrent()) return;
    paintHead('detail');
    await spaDetail(view, team, isCurrent);
  }

  /** Trang tĩnh `/doi-cong-dong/<id>/`: HTML đã có nội dung; chỉ gắn phần sống. API không còn công khai đội → ẩn khung tĩnh. */
  async function staticView(view, isCurrent, id) {
    const staticArticle = document.querySelector('[data-team-static]');
    let team;
    try {
      team = await api(`/api/community-teams/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error?.status === 404) staticArticle?.setAttribute('hidden', '');
      throw error;
    }
    if (!isCurrent()) return;
    // Ô chân dung dựng lúc build: gắn xử lý ảnh lỗi → ô chữ Hán.
    if (staticArticle) activatePortraits(staticArticle);
    if (team.status !== 'approved') {
      // Đổi trạng thái sau lúc build (chủ đội/quản trị xem): khung tĩnh đã lỗi thời → dựng chi tiết đầy đủ kèm thông báo trạng thái.
      staticArticle?.setAttribute('hidden', '');
      mount.classList.add('cm-team-detail-full');
      getLexicon().catch(() => {});
      await spaDetail(view, team, isCurrent);
      return;
    }
    // HTML tĩnh cũ (build trước khung mới) không có ô gắn: bảng điểm và đội tương tự rơi về khung sống `view`.
    const side = staticArticle?.querySelector('[data-cm-team-side]') ?? view.appendChild(el('div', { class: 'cm-team-detail-side' }));
    await detailLive({
      team,
      side,
      aside: staticArticle?.querySelector('.cm-team-detail-aside') ?? view,
      after: view,
      heroLabels: () => [...(staticArticle?.querySelectorAll('.cm-team-hero-card-name') ?? [])].map((node) => node.textContent.trim()),
      isCurrent,
    });
  }

  /* ---------- Của tôi ---------- */
  async function mineView(view, isCurrent) {
    paintHead('mine');
    view.append(viewHead(
      L('Đội của tôi', '我的阵容', 'マイ編成'),
      L('Các đội bạn đã đăng, mới nhất trước.', '你发布过的阵容，最新的在前。', '投稿した編成を新しい順に表示します。'),
      link({ new: '1' }, [teamIcon('plus'), L('Đăng đội mới', '发布新阵容', '新しい編成を投稿')], 'cm-team-btn cm-team-btn-primary'),
    ));
    if (!user) {
      view.append(signInPrompt(L('Đăng nhập để xem các đội bạn đã đăng.', '登录后即可查看你发布的阵容。', 'ログインすると投稿した編成を確認できます。')));
      return;
    }
    const status = liveStatus();
    const list = el('ol', { class: 'cm-team-mine-list', 'aria-label': L('Đội của tôi', '我的阵容', 'マイ編成') });
    const empty = el('p', { class: 'scope-note cm-empty', hidden: '' }, L('Bạn chưa đăng đội nào.', '你还没有发布阵容。', '投稿した編成はまだありません。'));
    const more = el('button', { class: 'cm-team-btn cm-more', type: 'button', hidden: '' }, L('Xem thêm', '查看更多', 'もっと見る'));
    const tallySlot = el('div', { class: 'cm-team-tally-slot' });
    let cursor = null;
    let items = [];

    const paintTally = () => tallySlot.replaceChildren(mineTally(items));
    const forget = (team, cardNode) => {
      // Nút mở hộp nằm trong thẻ bị gỡ: đưa focus sang tên thẻ kế tiếp (hoặc trước đó), hết thẻ thì về h2.
      const neighbour = cardNode.nextElementSibling ?? cardNode.previousElementSibling;
      items = items.filter((item) => item.id !== team.id);
      cardNode.remove();
      empty.hidden = items.length > 0;
      paintTally();
      status.set(L('Đã xoá đội.', '阵容已删除。', '編成を削除しました。'), 'ok');
      (neighbour?.querySelector('.cm-team-card-title') ?? view.querySelector('.cm-team-view-title'))?.focus();
    };
    const remove = (team) => api(`/api/community-teams/${encodeURIComponent(team.id)}`, { method: 'DELETE' });

    const mineCard = (team) => {
      const deleting = team.deleting === true;
      const button = el('button', { class: 'cm-team-btn cm-team-btn-text cm-team-btn-danger cm-team-delete', type: 'button' }, [
        teamIcon('trash'),
        deleting ? L('Thử xoá tiếp', '继续删除', '削除を続ける') : L('Xoá', '删除', '削除'),
      ]);
      const node = mineTeamCard(team, { names, locale, titleLink: teamLink, newHref: hrefFor({ new: '1' }), removeButton: button });
      button.addEventListener('click', async () => {
        if (deleting) {
          // Xoá dở: người dùng đã xác nhận ở lượt trước, bấm là chạy tiếp.
          button.disabled = true;
          try {
            await remove(team);
            forget(team, node);
          } catch (error) {
            button.disabled = false;
            status.set(describeError(error), 'error');
          }
          return;
        }
        const done = await confirmInPage({
          title: L(`Xoá đội “${team.title}”?`, `删除阵容“${team.title}”？`, `編成「${team.title}」を削除しますか？`),
          message: L('Ảnh và dữ liệu đi kèm cũng bị xoá. Không hoàn tác được.', '附带的图片和数据也会被删除，且无法恢复。', '付随する画像とデータも削除されます。元に戻せません。'),
          confirmLabel: L('Xoá đội', '删除阵容', '編成を削除'),
          onConfirm: async () => {
            try {
              await remove(team);
            } catch (error) {
              return describeError(error);
            }
            return true;
          },
        });
        if (done) forget(team, node);
      });
      return node;
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
      paintTally();
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

    const flow = el('ol', { class: 'cm-team-flow' }, [
      [L('Gửi đội', '提交阵容', '編成を送信'), L('Ảnh, đội hình và lối chơi. Gửi xong không sửa được.', '图片、阵容和打法。提交后不可修改。', '画像、編成、プレイスタイル。送信後は編集できません。')],
      [L('Chờ duyệt', '等待审核', '審査待ち'), L('Chỉ bạn và quản trị viên xem được đội.', '只有你和管理员可以查看。', '自分と管理者のみ閲覧できます。')],
      [L('Đã duyệt hoặc bị từ chối', '通过或未通过', '承認または却下'), L(
        'Đội đã duyệt hiện ở Danh sách, nhận bình chọn, bình luận và chiến báo. Đội bị từ chối kèm lý do và chỉ bạn thấy.',
        '通过的阵容显示在列表中，可接受投票、评论和战报。未通过的阵容附带原因，仅你可见。', '承認された編成は一覧に表示され、投票・コメント・戦報を受け付けます。却下された編成は理由が付き、自分のみ閲覧できます。',
      )],
    ].map(([title, text], index) => el('li', {}, [
      el('span', { class: 'cm-team-flow-num', 'aria-hidden': 'true' }, String(index + 1)),
      el('span', { class: 'cm-team-flow-text' }, [el('strong', {}, title), text]),
    ])));
    view.append(el('div', { class: 'cm-team-split cm-team-mine' }, [
      el('div', { class: 'cm-team-split-main' }, [status, list, empty, more]),
      el('div', { class: 'cm-team-split-aside' }, [
        card(L('Tình trạng', '状态', '状況'), [tallySlot], 'cm-team-tally-card'),
        card(L('Đội đi qua duyệt thế nào', '阵容审核流程', '編成の審査の流れ'), [
          flow,
          el('p', { class: 'cm-team-fine' }, [
            L(
              'Xoá đội sẽ xoá cả ảnh và dữ liệu đi kèm. Đội đã có chiến báo được duyệt của người khác thì cần liên hệ quản trị để gỡ. ',
              '删除阵容会同时删除图片和相关数据。已有他人通过审核的战报的阵容，需要联系管理员移除。', '編成を削除すると、画像と関連データも削除されます。他のプレイヤーの承認済み戦報が付いた編成は、管理者への連絡が必要です。',
            ),
            el('a', { class: 'cm-team-lead-link', href: localePath('/quy-tac-cong-dong/') }, L('Quy tắc cộng đồng', '社区规则', 'コミュニティルール')),
          ]),
        ], 'cm-team-flow-card'),
      ]),
    ]));
    await load();
  }

  /* ---------- Đăng ---------- */
  async function newView(view, isCurrent) {
    paintHead('new');
    view.append(viewHead(
      L('Đăng đội mới', '发布新阵容', '新しい編成を投稿'),
      L(
        'Tải ảnh, để AI điền nháp rồi xác nhận từng ô. AI đọc ảnh chỉ là nháp; đội chỉ gửi khi đủ 3 tướng và 6 chiến pháp khớp danh sách.',
        '上传图片，让 AI 填写草稿后逐项确认。AI 识别仅为草稿；只有 3 名武将和 6 个战法都与列表匹配时才能提交。', '画像をアップロードすると AI が下書きを入力します。各マスを確認してください。AI の読み取りはあくまで下書きで、武将3名と戦法6つがすべてリストと一致した場合のみ送信できます。',
      ),
    ));
    if (!user) {
      view.append(signInPrompt(L('Đăng nhập để đăng đội.', '登录后即可发布阵容。', 'ログインすると編成を投稿できます。')));
      return;
    }
    // Danh mục mùa lỗi: báo đúng nguyên nhân, không dựng form (không có mùa để chọn).
    let catalog;
    try {
      catalog = await getSeasons();
    } catch (error) {
      if (!isCurrent()) return;
      view.append(el('p', { class: 'cm-notice', role: 'note' }, describeError(error)));
      return;
    }
    if (!isCurrent()) return;
    mountTeamForm(view, {
      seasons: catalog.seasons,
      current: catalog.current,
      locale,
      user,
      getLexicon: getFormLexicon,
      teamHref: (teamId) => hrefFor({ id: teamId }),
      onSubmitted: () => go({ mine: '1' }, {
        message: L('Đã gửi đội, đang chờ quản trị viên duyệt.', '阵容已提交，等待管理员审核。', '編成を送信しました。管理者の審査をお待ちください。'),
      }),
    });
  }

  /* ---------- Bộ điều phối ---------- */
  async function render() {
    const token = ++renderToken;
    const isCurrent = () => token === renderToken;
    const { mode, id } = modeFromSearch(location.search, staticId);
    const view = el('div', { class: 'cm-team-view', dataset: { mode } });
    const message = flash;
    flash = '';
    mount.replaceChildren(view);
    if (message) view.append(el('p', { class: 'cm-notice cm-team-flash', role: 'status' }, [teamIcon('checkCircle'), message]));
    mount.setAttribute('aria-busy', 'true');
    try {
      if (mode === 'static') await staticView(view, isCurrent, id);
      else if (mode === 'detail') await detailView(view, isCurrent, id);
      else if (mode === 'mine') await mineView(view, isCurrent);
      else if (mode === 'new') await newView(view, isCurrent);
      else await listView(view, isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      view.append(error?.status === 404 ? el('p', { class: 'cm-notice', role: 'note' }, describeError(error)) : unavailableNotice());
    } finally {
      if (isCurrent()) {
        mount.removeAttribute('aria-busy');
        // Danh sách không có h2 riêng: tiêu đề là h1 tĩnh của trang (CommunityTeamsHub.astro).
        if (!first) (view.querySelector('.cm-team-heading') ?? document.getElementById('cm-team-title'))?.focus?.();
        first = false;
      }
    }
  }

  // Trang tĩnh không điều hướng trong trang và không cần từ điển tên (nội dung đã dựng sẵn lúc build).
  if (!isStatic) {
    window.addEventListener('popstate', render);
    getLexicon().catch(() => {});
  }
  loadSession({ probe: true }).catch(() => null).then((value) => {
    user = value || null;
    return render();
  });
  return { render };
}

initCommunityTeams();
