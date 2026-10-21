// Form đăng đội cộng đồng: 1–3 ảnh (tải lên trước), "Đọc bằng AI" điền nháp 3 tướng + 6 chiến pháp, người dùng
// kiểm tra/sửa rồi gửi. AI chỉ là nháp: ô `unsure` phải được chọn gợi ý hoặc sửa tay trước khi gửi.
// Không import từ community-teams.js (entry tự chạy); bước điều hướng sau khi gửi do `onSubmitted` lo.

import {
  cellFromInput,
  draftFromRead,
  emptyDraft,
  normalizeTeamRead,
  sureCell,
} from './analyze-map.js';
import { L } from './i18n.js';
import {
  api,
  describeError,
  downscaleImage,
  liveStatus,
  unavailableNotice,
} from './community-api.js';
import { TROOPS, TeamFormError, pickSide, similarWarning, teamPayloadFromDraft } from './community-team-state.js';
import { datalistOptions, heroBadge, seasonLabel, troopLabel } from './community-team-data.js';
import { el } from './render.js';

const MAX_IMAGES = 3;
const OPTIONAL_FIELDS = [
  ['strengths', () => L('Điểm mạnh', '优点')],
  ['weaknesses', () => L('Điểm yếu', '缺点')],
  ['counters', () => L('Khắc chế', '克制')],
  ['counteredBy', () => L('Bị khắc chế bởi', '被克制于')],
  ['substitutes', () => L('Thay thế', '替补')],
];

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
 * Gắn form vào `container`. `getLexicon()` trả bộ tra tên (từ điển tướng/CP); `onSubmitted()` chạy sau khi
 * server nhận đội (201, chờ duyệt).
 */
export function mountTeamForm(container, { season, locale, getLexicon, teamHref, onSubmitted }) {
  const root = el('div', { class: 'cm-team-form-root' });
  container.append(root);
  const boot = el('p', { class: 'scope-note' }, L('Đang tải danh sách tướng và chiến pháp…', '正在加载武将和战法列表…'));
  root.append(boot);
  getLexicon().then(
    (lexicon) => build(root, lexicon),
    () => {
      const retry = el('button', { class: 'ana-btn', type: 'button' }, L('Thử lại', '重试'));
      retry.addEventListener('click', () => {
        root.replaceChildren(boot);
        getLexicon().then((lexicon) => build(root, lexicon), () => root.replaceChildren(unavailableNotice(), retry));
      });
      root.replaceChildren(unavailableNotice(), retry);
    },
  );

  function build(host, lexicon) {
    const status = liveStatus();
    const draft = emptyDraft();
    const field = (id, label, control, hint = null) => el('div', { class: 'cm-field' }, [
      el('label', { class: 'cm-label', for: id }, label),
      control,
      hint,
    ]);

    /* ----- Ô tướng / chiến pháp ----- */
    const heroListId = 'cm-team-form-heroes';
    const tacticListId = 'cm-team-form-tactics';
    const datalists = [
      el('datalist', { id: heroListId }, datalistOptions(lexicon.heroLabels, locale).map((label) => el('option', { value: label }))),
      el('datalist', { id: tacticListId }, datalistOptions(lexicon.tacticLabels, locale).map((label) => el('option', { value: label }))),
    ];

    const slots = []; // {kind, input, candidates, preview, get, set}
    let similarSeq = 0;
    const similarBox = el('div', { class: 'cm-team-similar-warning', role: 'status', hidden: '' });

    const labelOf = (kind, id) => (kind === 'hero' ? lexicon.heroName(id) : lexicon.tacticName(id));

    function paint(slot) {
      const cell = slot.get();
      // Ô "không rõ" do AI tạo (trống hoặc 未知) để trống cho người dùng điền; chữ người dùng gõ mà không tra được
      // thì giữ nguyên để họ sửa, không xoá lặng lẽ.
      const aiBlank = cell.state === 'unknown' && (cell.raw === '' || cell.raw === '未知');
      slot.input.value = cell.state === 'sure'
        ? labelOf(slot.kind, cell.id)
        : aiBlank ? '' : cell.raw;
      slot.wrap.dataset.state = cell.state;
      if (cell.state === 'unsure' || (cell.state === 'unknown' && !aiBlank)) slot.input.setAttribute('aria-invalid', 'true');
      else slot.input.removeAttribute('aria-invalid');
      slot.synced = slot.input.value;
      slot.candidates.replaceChildren(...(cell.state === 'unsure' ? cell.candidates : []).map((id) => {
        const button = el('button', { class: 'cm-text-btn cm-team-candidate', type: 'button' }, labelOf(slot.kind, id));
        button.addEventListener('click', () => {
          slot.set(sureCell(id, labelOf(slot.kind, id)));
          paint(slot);
          afterCellChange(slot);
          slot.input.focus();
        });
        return button;
      }));
      if (slot.preview) {
        slot.preview.replaceChildren(...(cell.state === 'sure' ? [heroBadge(lexicon, cell.id)] : []));
      }
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
        const count = items.length;
        const text = similarWarning(count, locale);
        if (!text) {
          similarBox.hidden = true;
          return;
        }
        similarBox.replaceChildren(
          el('p', {}, body?.nextCursor ? text.replace(String(count), `${count}+`) : text),
          el('ul', {}, items.slice(0, 3).map((item) => el('li', {}, el('a', {
            class: 'cm-link',
            href: teamHref(item.id),
            target: '_blank',
            rel: 'noopener',
          }, item.title)))),
        );
        similarBox.hidden = false;
      } catch {
        if (seq === similarSeq) similarBox.hidden = true;
      }
    }

    const teamGrid = el('div', { class: 'cm-team-form-grid' });
    for (let heroIndex = 0; heroIndex < 3; heroIndex += 1) {
      const row = el('fieldset', { class: 'cm-team-form-hero' }, [
        el('legend', { class: 'cm-label' }, L(`Tướng ${heroIndex + 1}`, `武将 ${heroIndex + 1}`)),
      ]);
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
          class: 'cm-input cm-team-cell-input',
          type: 'text',
          list: def.kind === 'hero' ? heroListId : tacticListId,
          autocomplete: 'off',
          'data-cell': `${heroIndex}-${position}`,
        });
        const candidates = el('span', { class: 'cm-team-candidates' });
        const preview = def.kind === 'hero' ? el('span', { class: 'cm-team-hero-preview' }) : null;
        const wrap = el('div', { class: 'cm-field cm-team-cell', dataset: { state: 'empty' } }, [
          el('label', { class: 'cm-label', for: id }, def.label),
          input,
          preview,
          candidates,
        ]);
        const slot = { ...def, input, candidates, preview, wrap, synced: '' };
        input.addEventListener('change', () => sync(slot));
        slots.push(slot);
        row.append(wrap);
      }
      teamGrid.append(row);
    }

    function applyDraft(next) {
      next.heroes.forEach((member, heroIndex) => {
        draft.heroes[heroIndex].hero = member.hero;
        draft.heroes[heroIndex].tactics = member.tactics;
      });
      for (const slot of slots) paint(slot);
      checkSimilar();
    }

    /* ----- Ảnh ----- */
    const imageSlots = Array.from({ length: MAX_IMAGES }, (_, index) => {
      const state = { index, uploadId: null, previewUrl: null, normalized: null, choice: null, busy: false };
      const inputId = `cm-team-image-${index}`;
      const file = el('input', { id: inputId, class: 'cm-file', type: 'file', accept: 'image/jpeg,image/png,image/webp' });
      const slotStatus = liveStatus();
      const preview = el('img', { class: 'cm-team-preview', alt: L(`Ảnh ${index + 1} bạn đã chọn`, `你选择的图片 ${index + 1}`), hidden: '' });
      const readButton = el('button', { class: 'ana-btn', type: 'button', disabled: '' }, L('Đọc bằng AI', '用 AI 识别'));
      const chooser = el('div', { class: 'cm-team-sides', role: 'radiogroup', hidden: '', 'aria-label': L('Chọn phe cần đọc', '选择要识别的一方') });
      const box = el('div', { class: 'cm-team-image-slot' }, [
        field(inputId, L(`Ảnh ${index + 1}${index === 0 ? ' (bắt buộc)' : ' (tuỳ chọn)'}`, `图片 ${index + 1}${index === 0 ? '（必填）' : '（可选）'}`), file),
        preview,
        el('div', { class: 'cm-form-row' }, [readButton]),
        chooser,
        slotStatus,
      ]);
      Object.assign(state, { file, slotStatus, preview, readButton, chooser, box });
      return state;
    });

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
      applyDraft(draftFromRead({ heroes: side.heroes }, lexicon.indexes));
      slot.slotStatus.set(L('AI đã điền nháp. Hãy kiểm tra từng ô, ô tô vàng cần xác nhận.', 'AI 已填写草稿，请逐项核对，标黄的格子需要确认。'));
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
        slot.readButton.disabled = true;
        slot.slotStatus.set(L('Đang tải ảnh lên…', '正在上传图片…'));
        try {
          const blob = await downscaleImage(file);
          const form = new FormData();
          form.append('image', blob, 'team.jpg');
          const result = await api('/api/community-teams/uploads', { method: 'POST', form });
          if (!result?.uploadId) throw new Error('missing uploadId');
          if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
          slot.previewUrl = URL.createObjectURL(blob);
          slot.preview.src = slot.previewUrl;
          slot.preview.hidden = false;
          slot.uploadId = result.uploadId;
          slot.readButton.disabled = false;
          slot.slotStatus.set(L('Đã tải ảnh lên. Bạn có thể bấm "Đọc bằng AI" hoặc nhập tay.', '图片已上传。可点击“用 AI 识别”，也可手动填写。'));
        } catch (error) {
          slot.slotStatus.set(describeError(error), 'error');
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

    /* ----- Ô văn bản ----- */
    const troopSelect = el('select', { id: 'cm-team-troop', class: 'cm-select' }, [
      el('option', { value: '' }, L('Chọn binh chủng', '选择兵种')),
      ...TROOPS.map((value) => el('option', { value }, troopLabel(value))),
    ]);
    const titleInput = el('input', { id: 'cm-team-title-input', class: 'cm-input', type: 'text', maxlength: '80' });
    const playstyleInput = el('textarea', { id: 'cm-team-playstyle', class: 'cm-textarea', rows: '5', maxlength: '3000' });
    const optional = OPTIONAL_FIELDS.map(([key, label]) => {
      const textarea = el('textarea', { id: `cm-team-${key}`, class: 'cm-textarea', rows: '3', maxlength: '2000' });
      return { key, textarea, node: field(`cm-team-${key}`, L(`${label()} (không bắt buộc)`, `${label()}（可选）`), textarea) };
    });
    const submit = el('button', { class: 'ana-btn primary', type: 'submit' }, L('Gửi để duyệt', '提交审核'));
    const form = el('form', { class: 'cm-team-form', novalidate: '' }, [
      el('p', { class: 'scope-note' }, L(
        `Đội sẽ được đăng cho mùa đang mở: ${seasonLabel(season, locale)}. Sau khi gửi không sửa được và cần quản trị viên duyệt.`,
        `阵容将发布到进行中的赛季：${seasonLabel(season, locale)}。提交后不可修改，需管理员审核。`,
      )),
      el('fieldset', { class: 'cm-team-images-fieldset' }, [
        el('legend', { class: 'cm-title' }, L('Ảnh đội hình', '阵容图片')),
        el('p', { class: 'scope-note' }, L(
          'Ảnh được thu nhỏ trước khi tải lên; "Đọc bằng AI" gửi ảnh tới dịch vụ AI để điền nháp. Nên cắt bỏ tên tài khoản.',
          '图片会先压缩再上传；“用 AI 识别”会把图片发送给 AI 服务以填写草稿。建议裁掉账号名称。',
        )),
        ...imageSlots.map((slot) => slot.box),
      ]),
      el('fieldset', { class: 'cm-team-roster-fieldset' }, [
        el('legend', { class: 'cm-title' }, L('Tướng và chiến pháp', '武将与战法')),
        el('p', { class: 'scope-note' }, L('Chọn từ danh sách gợi ý. Mỗi tướng 2 chiến pháp, không trùng nhau.', '请从提示列表中选择。每名武将两个战法，且不能重复。')),
        teamGrid,
        similarBox,
      ]),
      field('cm-team-title-input', L('Tiêu đề', '标题'), titleInput),
      field('cm-team-troop', L('Binh chủng', '兵种'), troopSelect),
      field('cm-team-playstyle', L('Lối chơi', '打法'), playstyleInput),
      ...optional.map((entry) => entry.node),
      el('div', { class: 'cm-form-row' }, [submit]),
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
        invalid_troop: troopSelect,
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
          troop: troopSelect.value,
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

    host.replaceChildren(form, status, ...datalists);
  }
}
