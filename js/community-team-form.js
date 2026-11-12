// Form đăng đội cộng đồng (artboard DoiCongDongNewMoi): ba bước — 1 Ảnh đội hình (1–3 ảnh, tải lên trước,
// "Đọc bằng AI" từng ảnh), 2 Tướng và chiến pháp (9 ô + khối tình trạng đọc AI như Soi đội), 3 Thông tin đội
// (tiêu đề, chip binh chủng, lối chơi, phân tích thêm) — và cột "Gửi để duyệt" (mùa, tên đăng, danh sách kiểm tra).
// AI chỉ là nháp: ô `unsure` phải được chọn gợi ý hoặc sửa tay trước khi gửi.
// Không import từ community-teams.js (entry tự chạy); bước điều hướng sau khi gửi do `onSubmitted` lo.

import { cellFromInput, draftFromRead, emptyDraft, normalizeTeamRead, sureCell } from './analyze-map.js';
import { L, formatNumber } from './i18n.js';
import { api, avatar, describeError, displayName, downscaleImage, liveStatus, unavailableNotice } from './community-api.js';
import { TeamFormError, pickSide, similarNotice, teamPayloadFromDraft } from './community-team-state.js';
import { datalistOptions, seasonLabel, troopLabel } from './community-team-data.js';
import { cellPlace, checkItem, countedField, pill, rawText, readSummary, stepCard, troopChips } from './community-team-form-parts.js';
import { teamIcon } from './community-team-ui.js';
import { heroPortrait } from './hero-portrait.js';
import { el } from './render.js';

const MAX_IMAGES = 3;
const TITLE_MAX = 80;
const PLAYSTYLE_MAX = 3000;
const PLAYSTYLE_MIN = 10;
const OPTIONAL_MAX = 2000;
const OPTIONAL_FIELDS = [
  ['strengths', () => L('Điểm mạnh', '优点'), () => L('Đội mạnh ở điểm nào', '阵容的优势')],
  ['weaknesses', () => L('Điểm yếu', '缺点'), () => L('Đội gặp khó ở tình huống nào', '阵容在什么情况下吃力')],
  ['counters', () => L('Khắc chế', '克制'), () => L('Đội hoặc lối chơi mà đội này đánh tốt', '本阵容擅长对付的阵容或打法')],
  ['counteredBy', () => L('Bị khắc chế bởi', '被克制于'), () => L('Đội hoặc lối chơi nên tránh', '应避开的阵容或打法')],
  ['substitutes', () => L('Thay thế', '替补'), () => L('Tướng hoặc chiến pháp đổi được khi thiếu', '缺少时可替换的武将或战法')],
];
const FACTION_ZH = { 'Ngụy': '魏', 'Thục': '蜀', 'Ngô': '吴', 'Quần': '群', 'Hán': '汉' };
const FACTION_CODE = { 'Ngụy': 'nguy', 'Thục': 'thuc', 'Ngô': 'ngo', 'Quần': 'quan', 'Hán': 'han' };

const FIELD_CODES = new Set(['invalid_title', 'invalid_troop', 'invalid_text', 'invalid_uploads', 'invalid_heroes', 'invalid_tactics']);

function unknownMessage(text) {
  return L(
    `Không tìm thấy “${text}” trong danh sách: hãy chọn một mục gợi ý hoặc sửa lại tên.`,
    `列表中找不到“${text}”：请选择建议项或修改名称。`,
  );
}

function formMessage(code) {
  switch (code) {
    case 'invalid_heroes':
      return L('Cần đúng 3 tướng khác nhau, chọn từ danh sách.', '需要三名不同的武将，请从列表中选择。');
    case 'invalid_tactics':
      return L('Cần đủ 6 chiến pháp khác nhau (2 cho mỗi tướng), chọn từ danh sách.', '需要六个互不相同的战法（每名武将两个），请从列表中选择。');
    case 'invalid_title':
      return L('Hãy nhập tiêu đề (tối đa 80 ký tự).', '请填写标题（最多 80 个字符）。');
    case 'invalid_troop':
      return L('Hãy chọn binh chủng.', '请选择兵种。');
    case 'invalid_text':
      return L('Lối chơi cần ít nhất 10 ký tự; các mục khác tối đa 2000 ký tự.', '打法至少需要 10 个字符；其他项最多 2000 个字符。');
    case 'invalid_uploads':
      return L('Cần tải lên 1–3 ảnh trước khi gửi.', '提交前需要上传 1–3 张图片。');
    case 'unconfirmed':
      return L('Còn ô chưa chắc chắn: hãy chọn gợi ý hoặc sửa lại tên.', '仍有不确定的格子：请选择建议项或修改名称。');
    default:
      return L('Dữ liệu chưa hợp lệ. Hãy kiểm tra lại.', '内容无效，请检查后重试。');
  }
}

/**
 * Gắn form vào `container`. `getLexicon()` trả bộ tra tên (từ điển tướng/CP/binh thư); `onSubmitted()` chạy sau khi
 * server nhận đội (201, chờ duyệt). `user` là người đang đăng (hiện "Đăng với tên …").
 */
export function mountTeamForm(container, { season, locale, user, getLexicon, teamHref, onSubmitted }) {
  const root = el('div', { class: 'cm-team-form-root' });
  container.append(root);
  const boot = el('p', { class: 'scope-note' }, L('Đang tải danh sách tướng và chiến pháp…', '正在加载武将和战法列表…'));
  root.append(boot);
  getLexicon().then(
    (lexicon) => build(root, lexicon),
    () => {
      const retry = el('button', { class: 'cm-team-btn', type: 'button' }, L('Thử lại', '重试'));
      retry.addEventListener('click', () => {
        root.replaceChildren(boot);
        getLexicon().then((lexicon) => build(root, lexicon), () => root.replaceChildren(unavailableNotice(), retry));
      });
      root.replaceChildren(unavailableNotice(), retry);
    },
  );

  function build(host, lexicon) {
    const status = liveStatus('cm-status cm-team-submit-status');
    const draft = emptyDraft();
    let readFrom = null; // vị trí ảnh đã điền nháp gần nhất

    /* ----- Bước 2: ô tướng / chiến pháp ----- */
    const heroListId = 'cm-team-form-heroes';
    const tacticListId = 'cm-team-form-tactics';
    const datalists = [
      el('datalist', { id: heroListId }, datalistOptions(lexicon.heroLabels, locale).map((label) => el('option', { value: label }))),
      el('datalist', { id: tacticListId }, datalistOptions(lexicon.tacticLabels, locale).map((label) => el('option', { value: label }))),
    ];
    const labelOf = (kind, id) => (kind === 'hero' ? lexicon.heroName(id) : lexicon.tacticName(id));

    const slots = []; // { kind, heroIndex, position, input, wrap, … }
    const members = []; // { node, portrait, eyebrow, name, tally }
    let similarSeq = 0;
    const similarBox = el('div', { class: 'cm-team-similar-warning', role: 'status', hidden: '' });

    function paint(slot) {
      const cell = slot.get();
      // Ô "không rõ" do AI tạo (trống hoặc 未知) để trống cho người dùng điền; chữ người dùng gõ mà không tra được
      // thì giữ nguyên để họ sửa, không xoá lặng lẽ.
      const aiBlank = cell.state === 'unknown' && (cell.raw === '' || cell.raw === '未知');
      slot.input.value = cell.state === 'sure' ? labelOf(slot.kind, cell.id) : aiBlank ? '' : cell.raw;
      slot.wrap.dataset.state = cell.state;
      const flagged = cell.state === 'unsure' || (cell.state === 'unknown' && !aiBlank);
      if (flagged) slot.input.setAttribute('aria-invalid', 'true');
      else slot.input.removeAttribute('aria-invalid');
      slot.synced = slot.input.value;
      slot.flag.hidden = cell.state !== 'unsure';
      slot.ok.hidden = cell.state !== 'sure';
      // Dòng "AI đọc được …" + gợi ý gần nhất chỉ cho ô không chắc.
      const candidates = cell.state === 'unsure' ? cell.candidates : [];
      slot.raw.hidden = !candidates.length;
      slot.raw.replaceChildren(L('AI đọc được: ', 'AI 识别为：'), rawText(cell.raw), L(', chưa có trong danh sách', '，列表中没有'));
      slot.fix.hidden = !candidates.length;
      slot.candidates.replaceChildren(...candidates.map((id) => {
        const button = el('button', { class: 'cm-team-candidate', type: 'button' }, labelOf(slot.kind, id));
        button.addEventListener('click', () => {
          slot.set(sureCell(id, labelOf(slot.kind, id)));
          paint(slot);
          afterCellChange(slot);
          slot.input.focus();
        });
        return button;
      }));
      slot.input.setAttribute('aria-describedby', candidates.length ? `${slot.input.id}-raw ${slot.input.id}-fix` : '');
      if (!candidates.length) slot.input.removeAttribute('aria-describedby');
    }

    function paintMember(heroIndex) {
      const member = members[heroIndex];
      const heroCell = draft.heroes[heroIndex].hero;
      const record = heroCell.state === 'sure' ? lexicon.heroRecord(heroCell.id) : null;
      const faction = record?.faction ?? '';
      member.portrait.replaceChildren(record
        ? heroPortrait({ chinese: record.chinese, nameVi: record.viet, iconUrl: record.iconUrl, className: 'cm-team-member-img', alt: '' })
        : el('span', { class: 'cm-team-member-blank' }));
      member.portrait.dataset.faction = FACTION_CODE[faction] ?? '';
      const factionText = faction ? (locale === 'zh' ? FACTION_ZH[faction] ?? faction : faction) : '';
      member.eyebrow.textContent = factionText ? `${L(`Tướng ${heroIndex + 1}`, `武将 ${heroIndex + 1}`)} · ${factionText}` : L(`Tướng ${heroIndex + 1}`, `武将 ${heroIndex + 1}`);
      member.name.textContent = record ? lexicon.heroName(heroCell.id) : L('Chưa chọn tướng', '尚未选择武将');
      const cells = [heroCell, ...draft.heroes[heroIndex].tactics];
      const sure = cells.filter((cell) => cell.state === 'sure').length;
      const flagged = cells.filter((cell) => cell.state === 'unsure' || (cell.state === 'unknown' && cell.raw)).length;
      member.node.dataset.state = flagged ? 'unsure' : 'ok';
      member.tally.dataset.state = flagged ? 'unsure' : 'ok';
      member.tally.textContent = flagged
        ? L(`${flagged} ô cần chọn`, `${flagged} 格待确认`)
        : L(`${sure}/3 ổn`, `${sure}/3 已确认`);
    }

    function paintSummary() {
      summarySlot.replaceChildren(readSummary(slots.map((slot) => ({
        state: slot.get().state,
        raw: slot.get().raw,
        place: cellPlace(slot.heroIndex, slot.position),
        focus: () => slot.input.focus(),
      }))));
      const allSure = slots.every((slot) => slot.get().state === 'sure');
      rosterCard.setDone(allSure);
      readPill.hidden = readFrom === null;
      readPill.replaceChildren(teamIcon('scan', 14), L(`Đọc từ ảnh ${(readFrom ?? 0) + 1}`, `识别自图片 ${(readFrom ?? 0) + 1}`));
      paintChecklist();
    }

    function sync(slot) {
      if (slot.input.value === slot.synced) return;
      const index = slot.kind === 'hero' ? lexicon.indexes.heroes : lexicon.indexes.tactics;
      const labels = slot.kind === 'hero' ? lexicon.heroLabels : lexicon.tacticLabels;
      slot.set(cellFromInput(slot.input.value, index, labels));
      paint(slot);
      afterCellChange(slot);
    }

    function afterCellChange(slot) {
      paintMember(slot.heroIndex);
      paintSummary();
      if (slot.kind === 'hero') checkSimilar();
    }

    async function checkSimilar() {
      const ids = draft.heroes.map((member) => (member.hero.state === 'sure' ? member.hero.id : null));
      const seq = ++similarSeq;
      if (ids.some((id) => !id) || new Set(ids).size !== 3) {
        similarBox.hidden = true;
        return;
      }
      try {
        const body = await api(`/api/community-teams?${new URLSearchParams({ heroes: [...ids].sort().join(','), season: 'all' })}`);
        if (seq !== similarSeq) return;
        const items = Array.isArray(body?.items) ? body.items : [];
        const notice = similarNotice(items.length, Boolean(body?.nextCursor), locale);
        if (!notice) {
          similarBox.hidden = true;
          return;
        }
        similarBox.replaceChildren(
          teamIcon('users', 20),
          el('div', { class: 'cm-team-similar-body' }, [
            el('p', { class: 'cm-team-similar-title' }, notice.title),
            el('p', { class: 'cm-team-similar-text' }, notice.text),
            el('ul', {}, items.slice(0, 3).map((item) => el('li', {}, [
              el('a', { class: 'cm-team-similar-open', href: teamHref(item.id), target: '_blank', rel: 'noopener' }, [
                item.title,
                teamIcon('external', 14),
                el('span', { class: 'visually-hidden' }, L('(mở tab mới)', '（在新标签页打开）')),
              ]),
              el('span', {}, [displayName(item.author), item.season ? seasonLabel(item.season, locale) : null, troopLabel(item.troop)].filter(Boolean).join(' · ')),
            ]))),
          ]),
        );
        similarBox.hidden = false;
      } catch {
        if (seq === similarSeq) similarBox.hidden = true;
      }
    }

    const memberGrid = el('div', { class: 'cm-team-members' });
    for (let heroIndex = 0; heroIndex < 3; heroIndex += 1) {
      const portrait = el('span', { class: 'cm-team-member-portrait' });
      const eyebrow = el('span', { class: 'cm-team-caps' });
      const name = el('span', { class: 'cm-team-member-name' });
      const tally = el('span', { class: 'cm-team-member-tally' });
      const cellsBox = el('div', { class: 'cm-team-member-cells' });
      const node = el('fieldset', { class: 'cm-team-member cm-team-form-hero', dataset: { state: 'ok' } }, [
        el('legend', { class: 'visually-hidden' }, L(`Tướng ${heroIndex + 1}`, `武将 ${heroIndex + 1}`)),
        el('div', { class: 'cm-team-member-head' }, [portrait, el('span', { class: 'cm-team-member-id' }, [eyebrow, name]), tally]),
        cellsBox,
      ]);
      members.push({ node, portrait, eyebrow, name, tally });
      const cellDefs = [
        { kind: 'hero', label: L('Tướng', '武将'), get: () => draft.heroes[heroIndex].hero, set: (cell) => { draft.heroes[heroIndex].hero = cell; } },
        ...[0, 1].map((tacticIndex) => ({
          kind: 'tactic',
          label: L(`Chiến pháp ${tacticIndex + 1}`, `战法 ${tacticIndex + 1}`),
          get: () => draft.heroes[heroIndex].tactics[tacticIndex],
          set: (cell) => { draft.heroes[heroIndex].tactics[tacticIndex] = cell; },
        })),
      ];
      for (const [position, def] of cellDefs.entries()) {
        const id = `cm-team-cell-${heroIndex}-${position}`;
        const input = el('input', {
          id,
          class: 'cm-team-input cm-team-cell-input',
          type: 'text',
          list: def.kind === 'hero' ? heroListId : tacticListId,
          autocomplete: 'off',
          spellcheck: 'false',
          'data-cell': `${heroIndex}-${position}`,
        });
        const flag = el('span', { class: 'cm-team-flag', hidden: '' }, [teamIcon('alert', 13), L('Không chắc', '不确定')]);
        const ok = el('span', { class: 'cm-team-ok', 'aria-hidden': 'true', hidden: '' }, teamIcon('check', 14));
        const raw = el('span', { id: `${id}-raw`, class: 'cm-team-raw', hidden: '' });
        const fix = el('span', { id: `${id}-fix`, class: 'cm-team-caps', hidden: '' }, L('Gợi ý gần nhất', '最接近的建议'));
        const candidates = el('div', { class: 'cm-team-candidates' });
        const wrap = el('div', { class: 'cm-team-cell', dataset: { state: 'empty' } }, [
          el('div', { class: 'cm-team-cell-head' }, [el('label', { class: 'cm-team-caps', for: id }, def.label), flag]),
          el('span', { class: 'cm-team-cell-field' }, [input, ok]),
          raw,
          fix,
          candidates,
        ]);
        const slot = { ...def, heroIndex, position, input, flag, ok, raw, fix, candidates, wrap, synced: '' };
        input.addEventListener('change', () => sync(slot));
        slots.push(slot);
        cellsBox.append(wrap);
      }
      memberGrid.append(node);
    }

    function applyDraft(next) {
      next.heroes.forEach((member, heroIndex) => {
        draft.heroes[heroIndex].hero = member.hero;
        draft.heroes[heroIndex].tactics = member.tactics;
      });
      for (const slot of slots) paint(slot);
      for (let heroIndex = 0; heroIndex < 3; heroIndex += 1) paintMember(heroIndex);
      paintSummary();
      checkSimilar();
    }

    /* ----- Bước 1: ảnh ----- */
    const imagePill = pill('');
    const imageSlots = Array.from({ length: MAX_IMAGES }, (_, index) => {
      const state = { index, uploadId: null, previewUrl: null, normalized: null, choice: null, busy: false };
      const inputId = `cm-team-image-${index}`;
      const file = el('input', { id: inputId, class: 'cm-team-file visually-hidden', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      const slotStatus = liveStatus('cm-status cm-team-slot-status');
      const preview = el('img', { class: 'cm-team-preview', alt: L(`Ảnh ${index + 1} bạn đã chọn`, `你选择的图片 ${index + 1}`) });
      const thumb = el('span', { class: 'cm-team-slot-thumb', hidden: '' }, preview);
      const drop = el('label', { class: 'cm-team-drop', for: inputId }, [
        teamIcon('upload', 20),
        el('span', { class: 'cm-team-drop-text' }, [
          el('span', { class: 'cm-team-drop-title' }, L(`Chọn ảnh ${index + 1}`, `选择图片 ${index + 1}`)),
          el('span', { class: 'cm-team-drop-hint' }, index === 0 ? L('Bắt buộc · JPG, PNG hoặc WebP', '必填 · JPG、PNG 或 WebP') : L('Tuỳ chọn · JPG, PNG hoặc WebP', '可选 · JPG、PNG 或 WebP')),
        ]),
      ]);
      const readButton = el('button', { class: 'cm-team-btn cm-team-btn-dark', type: 'button', hidden: '' }, [teamIcon('scan'), L('Đọc bằng AI', '用 AI 识别')]);
      const change = el('label', { class: 'cm-team-btn cm-team-btn-text', for: inputId, hidden: '' }, L('Đổi ảnh', '更换图片'));
      const chooser = el('div', { class: 'cm-team-sides', role: 'radiogroup', hidden: '', 'aria-label': L('Chọn phe cần đọc', '选择要识别的一方') });
      const hint = el('p', { class: 'cm-team-slot-hint' }, index === 0
        ? L('Ảnh kết quả trận hoặc bảng đội hình có đủ 3 tướng.', '包含三名武将的战斗结果或阵容图。')
        : L('Thêm ảnh khác góc, ví dụ bảng chiến pháp hoặc binh thư.', '可添加其他角度，例如战法或兵书界面。'));
      const box = el('li', { class: 'cm-team-image-slot', dataset: { filled: 'false' } }, [
        drop,
        thumb,
        el('div', { class: 'cm-team-slot-body' }, [
          el('p', { class: 'cm-team-slot-label' }, [L(`Ảnh ${index + 1}`, `图片 ${index + 1}`), el('span', {}, index === 0 ? L('bắt buộc', '必填') : L('tuỳ chọn', '可选'))]),
          hint,
          slotStatus,
          chooser,
          el('div', { class: 'cm-team-slot-actions' }, [readButton, change]),
        ]),
        file,
      ]);
      Object.assign(state, { file, slotStatus, preview, thumb, drop, readButton, change, chooser, hint, box });
      return state;
    });
    const paintImages = () => {
      const count = imageSlots.filter((slot) => slot.uploadId).length;
      imagePill.textContent = L(`${count}/3 ảnh`, `${count}/3 张`);
      imageCard.setDone(count > 0);
      paintChecklist();
    };
    const okStatus = (slot, message) => {
      slot.slotStatus.replaceChildren(teamIcon('check', 14), message);
      slot.slotStatus.dataset.kind = 'ok';
      slot.slotStatus.hidden = false;
    };

    async function applyRead(slot) {
      const side = pickSide(slot.normalized, slot.choice);
      if (side === null) {
        slot.chooser.replaceChildren(
          el('p', { class: 'scope-note' }, L('Ảnh có hai phe. Chọn phe là đội của bạn:', '图片中有两方，请选择你的阵容：')),
          ...['left', 'right'].map((value) => {
            const id = `cm-team-side-${slot.index}-${value}`;
            const radio = el('input', { id, type: 'radio', name: `cm-team-side-${slot.index}`, value });
            radio.addEventListener('change', () => {
              slot.choice = value;
              applyRead(slot);
            });
            return el('label', { class: 'cm-team-side', for: id }, [radio, value === 'left' ? L('Phe trái', '左侧') : L('Phe phải', '右侧')]);
          }),
        );
        slot.chooser.hidden = false;
        slot.slotStatus.set(L('Hãy chọn phe cần đọc.', '请选择要识别的一方。'));
        return;
      }
      slot.chooser.hidden = true;
      if (!side.heroes.length) {
        slot.slotStatus.set(L('AI không đọc được đội hình trong ảnh này. Bạn có thể nhập tay.', 'AI 无法识别此图片中的阵容，请手动填写。'), 'error');
        return;
      }
      readFrom = slot.index;
      applyDraft(draftFromRead({ heroes: side.heroes }, lexicon.indexes));
      okStatus(slot, L('AI đã điền nháp vào mục 2. Hãy kiểm tra từng ô, ô tô đỏ cần xác nhận.', 'AI 已填入第 2 步草稿。请逐项核对，标红的格子需要确认。'));
      slot.readButton.replaceChildren(teamIcon('refresh'), L('Đọc lại', '重新识别'));
      slot.readButton.classList.remove('cm-team-btn-dark');
    }

    for (const slot of imageSlots) {
      slot.file.addEventListener('change', async () => {
        const file = slot.file.files?.[0];
        if (!file) return;
        if (!/^image\//u.test(file.type)) {
          slot.slotStatus.set(L('Hãy chọn một tệp ảnh.', '请选择图片文件。'), 'error');
          return;
        }
        slot.uploadId = null;
        slot.normalized = null;
        slot.choice = null;
        slot.chooser.hidden = true;
        slot.readButton.hidden = true;
        slot.slotStatus.set(L('Đang tải ảnh lên…', '正在上传图片…'));
        paintImages();
        try {
          const blob = await downscaleImage(file);
          const form = new FormData();
          form.append('image', blob, 'team.jpg');
          const result = await api('/api/community-teams/uploads', { method: 'POST', form });
          if (!result?.uploadId) throw new Error('missing uploadId');
          if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
          slot.previewUrl = URL.createObjectURL(blob);
          slot.preview.src = slot.previewUrl;
          slot.thumb.hidden = false;
          slot.drop.hidden = true;
          slot.change.hidden = false;
          slot.hint.hidden = true;
          slot.box.dataset.filled = 'true';
          slot.uploadId = result.uploadId;
          slot.readButton.hidden = false;
          slot.readButton.classList.add('cm-team-btn-dark');
          slot.readButton.replaceChildren(teamIcon('scan'), L('Đọc bằng AI', '用 AI 识别'));
          slot.slotStatus.set(readFrom !== null && readFrom !== slot.index
            ? L('Đã tải lên. Đọc ảnh này sẽ thay nháp ở mục 2.', '已上传。识别此图片会替换第 2 步的草稿。')
            : L('Đã tải ảnh lên. Bạn có thể bấm "Đọc bằng AI" hoặc nhập tay.', '图片已上传。可点击“用 AI 识别”，也可手动填写。'));
        } catch (error) {
          slot.slotStatus.set(describeError(error), 'error');
        } finally {
          paintImages();
        }
      });
      slot.readButton.addEventListener('click', async () => {
        if (!slot.uploadId || slot.busy) return;
        slot.busy = true;
        slot.readButton.disabled = true;
        slot.choice = null;
        slot.slotStatus.set(L('AI đang đọc ảnh…', 'AI 正在识别图片…'));
        try {
          const body = await api(`/api/community-teams/uploads/${encodeURIComponent(slot.uploadId)}/analyze`, { method: 'POST' });
          slot.normalized = normalizeTeamRead(body?.read);
          await applyRead(slot);
        } catch (error) {
          slot.slotStatus.set(describeError(error), 'error');
        } finally {
          slot.busy = false;
          slot.readButton.disabled = !slot.uploadId;
        }
      });
    }

    /* ----- Bước 3: thông tin đội ----- */
    const troop = troopChips();
    const titleInput = el('input', { id: 'cm-team-title-input', class: 'cm-team-input', type: 'text', maxlength: String(TITLE_MAX) });
    const playstyleInput = el('textarea', { id: 'cm-team-playstyle', class: 'cm-team-textarea cm-team-textarea-tall', rows: '4', maxlength: String(PLAYSTYLE_MAX) });
    const optional = OPTIONAL_FIELDS.map(([key, label, placeholder]) => {
      const textarea = el('textarea', { id: `cm-team-${key}`, class: 'cm-team-textarea', rows: '3', maxlength: String(OPTIONAL_MAX), placeholder: placeholder() });
      return { key, textarea, node: countedField({ id: `cm-team-${key}`, label: label(), control: textarea, max: OPTIONAL_MAX }) };
    });
    const extraToggle = el('button', { class: 'cm-team-extra-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'cm-team-extra-fields' }, [
      el('span', { class: 'cm-team-extra-toggle-label' }, L('Phân tích thêm', '补充分析')),
      el('span', { class: 'cm-team-extra-toggle-hint' }, L('không bắt buộc · 5 mục', '可选 · 5 项')),
      teamIcon('chevronDown'),
    ]);
    const extra = el('div', { class: 'cm-team-extra' }, [
      el('div', { class: 'cm-team-subhead' }, [
        el('h4', {}, L('Phân tích thêm', '补充分析')),
        el('p', { class: 'cm-team-form-note' }, L('Không bắt buộc, tối đa 2000 ký tự mỗi mục. Hiện trong phần phân tích của trang đội.', '可选，每项最多 2000 个字符，会显示在阵容页的分析部分。')),
      ]),
      extraToggle,
      el('div', { id: 'cm-team-extra-fields', class: 'cm-team-fields cm-team-extra-fields' }, optional.map((entry) => entry.node)),
    ]);
    extraToggle.addEventListener('click', () => {
      const opened = extra.dataset.open !== 'true';
      extra.dataset.open = String(opened);
      extraToggle.setAttribute('aria-expanded', String(opened));
    });

    /* ----- Cột gửi ----- */
    const checklist = el('ul', { class: 'cm-team-check', 'aria-label': L('Kiểm tra trước khi gửi', '提交前检查') });
    function paintChecklist() {
      const images = imageSlots.filter((slot) => slot.uploadId).length;
      const heroes = draft.heroes.map((member) => member.hero).filter((cell) => cell.state === 'sure');
      const heroIds = new Set(heroes.map((cell) => cell.id));
      const tactics = draft.heroes.flatMap((member) => member.tactics);
      const sureTactics = tactics.filter((cell) => cell.state === 'sure');
      const tacticIds = new Set(sureTactics.map((cell) => cell.id));
      const unsureTactics = tactics.filter((cell) => cell.state === 'unsure').length;
      const title = titleInput.value.trim().length;
      const playstyle = playstyleInput.value.trim().length;
      const troopValue = troop.value;
      const heroesOk = heroes.length === 3 && heroIds.size === 3;
      const tacticsOk = sureTactics.length === 6 && tacticIds.size === 6;
      checklist.replaceChildren(
        checkItem(L('Ảnh đội hình', '阵容图片'), L(`${images} ảnh · cần 1–3 ảnh`, `${images} 张 · 需要 1–3 张`), images > 0),
        checkItem(L('Tướng', '武将'), heroIds.size < heroes.length ? L(`${heroes.length}/3 · có tướng trùng`, `${heroes.length}/3 · 有重复`) : L(`${heroes.length}/3 · không trùng`, `${heroes.length}/3 · 无重复`), heroesOk),
        checkItem(L('Chiến pháp', '战法'), unsureTactics
          ? L(`${sureTactics.length}/6 · còn ${unsureTactics} ô Không chắc`, `${sureTactics.length}/6 · 还有 ${unsureTactics} 格不确定`)
          : L(`${sureTactics.length}/6 · không trùng`, `${sureTactics.length}/6 · 无重复`), tacticsOk),
        checkItem(L('Tiêu đề', '标题'), L(`${formatNumber(title)} / ${TITLE_MAX} ký tự`, `${formatNumber(title)} / ${TITLE_MAX} 字`), title > 0 && title <= TITLE_MAX),
        checkItem(L('Binh chủng', '兵种'), troopValue ? troopLabel(troopValue) : L('Chưa chọn', '未选择'), Boolean(troopValue)),
        checkItem(L('Lối chơi', '打法'), L(`${formatNumber(playstyle)} ký tự`, `${formatNumber(playstyle)} 字`), playstyle >= PLAYSTYLE_MIN),
      );
      infoCard.setDone(title > 0 && Boolean(troopValue) && playstyle >= PLAYSTYLE_MIN);
    }
    titleInput.addEventListener('input', () => paintChecklist());
    playstyleInput.addEventListener('input', () => paintChecklist());
    for (const input of troop.inputs) input.addEventListener('change', () => paintChecklist());

    const submit = el('button', { class: 'cm-team-btn cm-team-btn-primary cm-team-btn-block', type: 'submit' }, [teamIcon('send'), L('Gửi để duyệt', '提交审核')]);

    /* ----- Lắp ráp ----- */
    const imageCard = stepCard(1, L('Ảnh đội hình', '阵容图片'), {
      pill: imagePill,
      note: el('p', { class: 'cm-team-form-note' }, [
        L('Chọn 1–3 ảnh; ảnh được thu nhỏ trước khi tải lên. ', '选择 1–3 张图片；上传前会先压缩。'),
        el('strong', {}, L('Đọc bằng AI', '用 AI 识别')),
        L(
          ' gửi ảnh tới dịch vụ AI để điền nháp, bạn vẫn kiểm tra từng ô. Ảnh hiện công khai cùng đội khi được duyệt, nên cắt bỏ tên tài khoản.',
          '会把图片发送给 AI 服务以填写草稿，你仍需逐项核对。审核通过后图片会随阵容公开，建议裁掉账号名称。',
        ),
      ]),
      children: [el('ul', { class: 'cm-team-slots', 'aria-label': L('Ảnh đội hình', '阵容图片') }, imageSlots.map((slot) => slot.box))],
    });
    const readPill = pill('', true);
    const summarySlot = el('div', { class: 'cm-team-summary-slot' });
    const rosterCard = stepCard(2, L('Tướng và chiến pháp', '武将与战法'), {
      pill: readPill,
      note: el('p', { class: 'cm-team-form-note' }, L(
        'Gõ hoặc chọn từ danh sách gợi ý; không đọc bằng AI vẫn điền tay được. Mỗi tướng 2 chiến pháp, 6 chiến pháp không trùng nhau.',
        '输入或从提示列表中选择；不用 AI 识别也可以手动填写。每名武将两个战法，六个战法不能重复。',
      )),
      children: [summarySlot, memberGrid, similarBox],
    });
    const infoCard = stepCard(3, L('Thông tin đội', '阵容信息'), {
      children: [el('div', { class: 'cm-team-fields' }, [
        countedField({ id: 'cm-team-title-input', label: L('Tiêu đề', '标题'), hint: L('bắt buộc', '必填'), control: titleInput, max: TITLE_MAX, wide: true }),
        el('div', { class: 'cm-team-fld cm-team-fld-wide' }, troop.group),
        countedField({
          id: 'cm-team-playstyle',
          label: L('Lối chơi', '打法'),
          hint: L('bắt buộc · tối thiểu 10 ký tự', '必填 · 至少 10 个字符'),
          control: playstyleInput,
          max: PLAYSTYLE_MAX,
          wide: true,
        }),
      ]), extra],
    });

    const author = user ?? null;
    const sendCard = el('section', { class: 'cm-team-form-card cm-team-send', 'aria-labelledby': 'cm-team-send-title' }, [
      el('h3', { id: 'cm-team-send-title', class: 'cm-team-side-title' }, L('Gửi để duyệt', '提交审核')),
      el('div', { class: 'cm-team-send-season' }, [
        el('span', { class: 'cm-team-send-season-text' }, [
          el('span', { class: 'cm-team-caps' }, L('Mùa đang mở', '进行中的赛季')),
          el('span', { class: 'cm-team-send-season-name' }, seasonLabel(season, locale)),
        ]),
        author
          ? el('span', { class: 'cm-team-send-author' }, [avatar(author), el('span', {}, [L('Đăng với tên ', '发布名称 '), el('strong', {}, displayName(author))])])
          : null,
      ]),
      checklist,
      el('p', { class: 'cm-team-fine' }, L(
        'Sau khi gửi, đội không sửa được. Đội chỉ hiện với bạn và quản trị viên cho tới khi được duyệt.',
        '提交后无法修改。审核通过前，阵容只对你和管理员可见。',
      )),
      submit,
      status,
    ]);

    const form = el('form', { class: 'cm-team-form', novalidate: '' }, [
      el('div', { class: 'cm-team-split cm-team-form-layout' }, [
        el('div', { class: 'cm-team-split-main' }, [imageCard, rosterCard, infoCard]),
        el('aside', { class: 'cm-team-split-aside cm-team-send-aside', 'aria-label': L('Gửi đội', '提交阵容') }, [sendCard]),
      ]),
    ]);

    /** Thông báo của mã lỗi trường (từ form hoặc server) và đưa focus về đúng ô. */
    function showFieldError(code) {
      status.set(formMessage(code), 'error');
      const target = {
        invalid_heroes: slots.find((slot) => slot.kind === 'hero' && slot.get().state !== 'sure')?.input
          ?? slots.find((slot) => slot.kind === 'hero')?.input,
        invalid_tactics: slots.find((slot) => slot.kind === 'tactic' && slot.get().state !== 'sure')?.input
          ?? slots.find((slot) => slot.kind === 'tactic')?.input,
        invalid_title: titleInput,
        invalid_troop: troop,
        invalid_text: playstyleInput,
        invalid_uploads: imageSlots[0].file,
      }[code];
      target?.focus();
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      for (const slot of slots) sync(slot);
      const unknown = slots.find((slot) => slot.get().state === 'unknown' && slot.input.value.trim());
      if (unknown) {
        status.set(unknownMessage(unknown.input.value.trim()), 'error');
        unknown.input.focus();
        return;
      }
      const unsure = slots.find((slot) => slot.get().state === 'unsure');
      if (unsure) {
        status.set(formMessage('unconfirmed'), 'error');
        unsure.input.focus();
        return;
      }
      let payload;
      try {
        payload = teamPayloadFromDraft(draft, {
          title: titleInput.value,
          troop: troop.value,
          playstyle: playstyleInput.value,
          ...Object.fromEntries(optional.map((entry) => [entry.key, entry.textarea.value])),
          lang: locale,
          uploadIds: imageSlots.map((slot) => slot.uploadId).filter(Boolean),
        });
      } catch (error) {
        if (!(error instanceof TeamFormError)) throw error;
        showFieldError(error.code);
        return;
      }
      submit.disabled = true;
      status.set(L('Đang gửi…', '正在提交…'));
      try {
        await api('/api/community-teams', { method: 'POST', json: payload });
        onSubmitted();
      } catch (error) {
        submit.disabled = false;
        if (FIELD_CODES.has(error?.code)) showFieldError(error.code);
        else status.set(describeError(error), 'error');
      }
    });

    for (let heroIndex = 0; heroIndex < 3; heroIndex += 1) paintMember(heroIndex);
    paintImages();
    paintSummary();
    host.replaceChildren(form, ...datalists);
  }
}
