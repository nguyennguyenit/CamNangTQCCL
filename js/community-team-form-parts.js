// Mảnh DOM của form đăng đội (artboard DoiCongDongNewMoi): thẻ bước có số, nhóm chip binh chủng (component
// chip-chon-mot), ô chữ có bộ đếm ký tự, khối tình trạng 9 ô đọc AI, danh sách kiểm tra cột "Gửi để duyệt".
// Hàm thuần dựng DOM; trạng thái và sự kiện nằm ở js/community-team-form.js.

import { L, formatNumber } from './i18n.js';
import { troopLabel } from './community-team-data.js';
import { TROOPS } from './community-team-state.js';
import { el } from './render.js';
import { teamIcon } from './community-team-ui.js';

const CJK = /[㐀-鿿豈-﫿]/u;

/** Thẻ một bước: tiêu đề có số tròn (đổi màu khi xong), viên phụ bên phải, ghi chú, nội dung. */
export function stepCard(number, title, { pill = null, note = null, children = [] } = {}) {
  const id = `cm-team-step-${number}`;
  const badge = el('span', { class: 'cm-team-step', 'aria-hidden': 'true', dataset: { done: 'false' } }, String(number));
  const node = el('section', { class: 'cm-team-form-card', 'aria-labelledby': id }, [
    el('div', { class: 'cm-team-form-card-head' }, [
      el('h3', { id, class: 'cm-team-form-card-title' }, [badge, title]),
      pill,
    ]),
    note,
    ...children,
  ]);
  node.setDone = (done) => { badge.dataset.done = String(Boolean(done)); };
  return node;
}

/** Viên nhỏ xám (số ảnh, nguồn đọc AI). */
export function pill(children, hidden = false) {
  return el('span', { class: 'cm-team-pill', hidden: hidden ? '' : null }, children);
}

/** Nhóm chip chọn một binh chủng: radio thật (một tab stop, phím mũi tên), gửi được không cần JS. */
export function troopChips(name = 'cm-team-troop') {
  const inputs = TROOPS.map((value) => el('input', { type: 'radio', name, value }));
  const group = el('fieldset', { class: 'chip-chon-nhom cm-team-troops', id: 'cm-team-troop' }, [
    el('legend', { class: 'cm-team-fld-label' }, L('Binh chủng', '兵种')),
    el('div', { class: 'chip-chon-hang' }, inputs.map((input) => el('label', { class: 'chip-chon' }, [
      input,
      el('span', { class: 'chip-chon-mat' }, [
        el('i', { class: 'chip-chon-cham', 'aria-hidden': 'true', dataset: { troop: input.value } }),
        troopLabel(input.value),
      ]),
    ]))),
  ]);
  return {
    group,
    inputs,
    get value() {
      return inputs.find((input) => input.checked)?.value ?? '';
    },
    focus() {
      (inputs.find((input) => input.checked) ?? inputs[0]).focus();
    },
  };
}

/** Ô chữ (input/textarea) có nhãn, chú thích bên phải nhãn và bộ đếm "n / max" bên dưới. */
export function countedField({ id, label, hint = '', control, max, wide = false }) {
  const counter = el('p', { class: 'cm-team-counter', 'aria-hidden': 'true' });
  // Bộ đếm như artboard ("149 / 3000"): số ký tự không dấu tách nghìn để khớp giới hạn ghi ở chú thích.
  const paint = () => { counter.textContent = `${control.value.length} / ${max}`; };
  control.addEventListener('input', paint);
  paint();
  const node = el('div', { class: `cm-team-fld${wide ? ' cm-team-fld-wide' : ''}` }, [
    el('label', { class: 'cm-team-fld-label', for: id }, [label, hint ? el('span', {}, hint) : null]),
    control,
    counter,
  ]);
  node.paint = paint;
  return node;
}

/** Tên ô theo vị trí: "Tướng 3 · Chiến pháp 2". */
export function cellPlace(heroIndex, position) {
  const hero = L(`Tướng ${heroIndex + 1}`, `武将 ${heroIndex + 1}`);
  return position === 0 ? hero : `${hero} · ${L(`Chiến pháp ${position}`, `战法 ${position}`)}`;
}

/** Chữ AI đọc được (giữ chữ Hán trong `lang`), dùng cho dòng "đọc được …". */
export function rawText(raw) {
  const text = String(raw ?? '');
  return CJK.test(text) ? el('span', { lang: 'zh-Hant' }, text) : text;
}

const COUNT_KEYS = [
  ['sure', () => L('Khớp', '匹配')],
  ['unsure', () => L('Không chắc', '不确定')],
  ['unknown', () => L('Không rõ', '无法识别')],
  ['empty', () => L('Còn trống', '空白')],
];

/**
 * Khối tình trạng 9 ô: bốn ô đếm + (danh sách ô cần chọn | dòng "đủ 9/9"). `cells` là mảng
 * `{ state, raw, place, focus }` theo thứ tự ô; bấm một dòng cần chọn thì đưa focus tới ô đó.
 */
export function readSummary(cells) {
  const counts = { sure: 0, unsure: 0, unknown: 0, empty: 0 };
  for (const cell of cells) counts[Object.hasOwn(counts, cell.state) ? cell.state : 'empty'] += 1;
  const pending = cells.filter((cell) => cell.state === 'unsure' || (cell.state === 'unknown' && cell.raw));
  let side;
  if (pending.length) {
    side = el('div', { class: 'cm-team-pending' }, [
      el('h4', { class: 'cm-team-pending-title' }, L(`Cần bạn chọn ${pending.length} ô trước khi gửi`, `提交前还需确认 ${pending.length} 格`)),
      ...pending.slice(0, 3).map((cell) => {
        const button = el('button', { class: 'cm-team-jump', type: 'button' }, [
          el('span', { class: 'cm-team-jump-text' }, [
            el('span', { class: 'cm-team-jump-where' }, cell.place),
            el('span', { class: 'cm-team-jump-why' }, [
              cell.state === 'unsure' ? L('Không chắc · đọc được ', '不确定 · 识别为 ') : L('Không có trong danh sách · ', '列表中没有 · '),
              rawText(cell.raw),
            ]),
          ]),
          el('span', { class: 'cm-team-jump-go', 'aria-hidden': 'true' }, teamIcon('arrowDown')),
        ]);
        button.addEventListener('click', () => cell.focus());
        return button;
      }),
    ]);
  } else if (counts.sure === cells.length) {
    side = el('p', { class: 'cm-team-done' }, [teamIcon('checkCircle'), L('Đủ 9/9 ô: 3 tướng và 6 chiến pháp khớp danh sách.', '9/9 格已完成：3 名武将和 6 个战法均与列表匹配。')]);
  } else {
    side = el('p', { class: 'cm-team-pending-title' }, L(
      `Còn ${counts.empty + counts.unknown} ô trống: gõ hoặc chọn từ gợi ý.`,
      `还有 ${counts.empty + counts.unknown} 格未填：请输入或从提示中选择。`,
    ));
  }
  return el('div', { class: 'cm-team-read-summary' }, [
    el('ul', { class: 'cm-team-counts', 'aria-label': L('Tình trạng 9 ô', '9 格状态') }, COUNT_KEYS.map(([key, label]) => el('li', {
      class: 'cm-team-count',
      dataset: { state: key, zero: String(counts[key] === 0) },
    }, [
      el('strong', {}, formatNumber(counts[key])),
      el('span', {}, [el('i', { class: 'cm-team-count-dot', 'aria-hidden': 'true' }), label()]),
    ]))),
    side,
  ]);
}

/** Một dòng của danh sách kiểm tra trước khi gửi. */
export function checkItem(name, value, ok) {
  return el('li', {}, [
    el('span', { class: 'cm-team-check-ico', 'aria-hidden': 'true', dataset: { ok: String(ok) } }, teamIcon(ok ? 'check' : 'alert', 14)),
    el('span', { class: 'cm-team-check-text' }, [
      el('span', { class: 'cm-team-check-name' }, name),
      el('span', { class: 'cm-team-check-val', dataset: { ok: String(ok) } }, [
        el('span', { class: 'visually-hidden' }, ok ? L('Đạt: ', '已满足：') : L('Chưa đạt: ', '未满足：')),
        value,
      ]),
    ]),
  ]);
}
