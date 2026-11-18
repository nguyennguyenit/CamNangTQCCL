// Khối "Dán danh sách tên" trong bảng chọn nhanh của kho (Gợi ý đội, policy `inventory` của `roster-picker.js`).
// Dán → Đối chiếu → xem lại bốn nhóm (khớp / cần chọn / không nhận ra / chiến pháp tự mang) → Thêm vào kho.
// Không ghi gì trước khi người dùng xác nhận; tên không nhận ra không bị đoán; tên mơ hồ mặc định "Bỏ qua".
// Khối chỉ phát `onAdd(items)`; nơi dùng tự ghi vào kho đang dùng (local với khách, hộp đang chọn khi đã đăng nhập).

import { el } from "./render.js";
import { L } from "./i18n.js";
import { buildPasteIndex, matchPastedNames, splitPastedNames } from "./roster-pasted-name-list-match.js";

const KIND_TAGS = { heroes: ["Tướng", "武将"], tactics: ["Chiến pháp", "战法"] };
const kindTag = (item) => L(...(KIND_TAGS[item.type] || [item.type, item.type]));
const MAX_INPUT_CHARS = 20000;

/**
 * @param {object} options
 * @param {string} options.uid tiền tố id duy nhất (theo bảng chọn chứa khối)
 * @param {object[]} options.catalog danh mục `buildCatalog(…, "inventory")`
 * @param {(item: object) => string} options.label tên hiển thị (bản zh là chữ Hán)
 * @param {() => Set<string>} options.selected ID các món đang có trong kho
 * @param {(items: object[]) => void} options.onAdd ghi các món đã xác nhận vào kho
 * @returns {{node: HTMLElement, setDisabled(value: boolean): void}}
 */
export function createPastedNameListPanel({ uid, catalog, label, selected, onAdd }) {
  const index = buildPasteIndex(catalog);
  const panelId = `${uid}-paste`;
  const hintId = `${uid}-paste-hint`;
  let disabled = false;
  /** Kết quả đối chiếu đang xem lại; `null` khi chưa đối chiếu hoặc chữ trong ô đã đổi sau lần đối chiếu. */
  let review = null;

  const toggle = el("button", {
    type: "button",
    class: "ana-btn roster-paste-toggle",
    "aria-expanded": "false",
    "aria-controls": panelId,
  }, L("Dán danh sách tên", "粘贴名称列表"));
  const input = el("textarea", {
    id: `${uid}-paste-input`,
    class: "ana-input roster-paste-input",
    rows: "5",
    maxlength: String(MAX_INPUT_CHARS),
    spellcheck: "false",
    autocomplete: "off",
    "aria-describedby": hintId,
  });
  const matchBtn = el("button", { type: "button", class: "ana-btn roster-paste-match" }, L("Đối chiếu", "核对"));
  const status = el("p", { class: "roster-paste-status", role: "status", tabindex: "-1", "aria-live": "polite" });
  const reviewSlot = el("div", { class: "roster-paste-review", role: "region", "aria-label": L("Kết quả đối chiếu", "核对结果"), hidden: "" });
  const panel = el("div", { class: "roster-paste-panel", id: panelId, hidden: "" }, [
    el("label", { class: "roster-field-label", for: `${uid}-paste-input` }, L("Danh sách tên", "名称列表")),
    el("p", { class: "roster-field-hint", id: hintId }, L(
      "Chép từ game, Zalo hoặc Excel: mỗi tên một dòng, hoặc ngăn bằng dấu phẩy, dấu chấm phẩy. Nhận tên Việt, Hán-Việt hoặc chữ Hán. Chưa ghi vào kho cho tới khi bạn xác nhận.",
      "可从游戏、Zalo 或 Excel 复制：每行一个名称，或用逗号、分号分隔。支持越南名、汉越音或汉字。确认之前不会写入库存。",
    )),
    input,
    el("div", { class: "roster-paste-bar" }, [matchBtn]),
    status,
    reviewSlot,
  ]);

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
    if (open) input.focus();
  });

  /** Món sẽ được thêm: món khớp + món đã chọn ở nhóm "cần chọn", bỏ món đã có trong kho, không trùng. */
  function pendingItems() {
    if (!review) return [];
    const owned = selected();
    const out = new Map();
    for (const { item } of review.result.matched) if (!owned.has(item.id)) out.set(item.id, item);
    for (const [position, choice] of review.choices) {
      const item = review.result.ambiguous[position].candidates.find((candidate) => candidate.id === choice);
      if (item && !owned.has(item.id)) out.set(item.id, item);
    }
    return [...out.values()];
  }

  const group = (kind, title, count, children) => el("section", { class: "roster-paste-group", dataset: { group: kind } }, [
    el("h4", { class: "roster-paste-group-title" }, `${title} · ${count}`),
    ...children,
  ]);

  function paintReview() {
    if (!review) {
      reviewSlot.hidden = true;
      reviewSlot.replaceChildren();
      return;
    }
    const { result, truncated } = review;
    const owned = selected();
    const addBtn = el("button", { type: "button", class: "ana-btn primary roster-paste-confirm" });
    const cancelBtn = el("button", { type: "button", class: "roster-ghost roster-paste-cancel" }, L("Hủy", "取消"));
    const paintCount = () => {
      const count = pendingItems().length;
      addBtn.textContent = L(`Thêm ${count} món vào kho`, `将 ${count} 项加入库存`);
      addBtn.disabled = disabled || count === 0;
    };

    const groups = [];
    if (result.matched.length) {
      groups.push(group("matched", L("Khớp", "已匹配"), result.matched.length, [
        el("ul", { class: "roster-paste-list" }, result.matched.map(({ item, inputs }) => {
          const shown = label(item);
          const typed = inputs.filter((text) => text !== shown && text !== item.name);
          return el("li", { class: "roster-paste-row", dataset: { pasteId: item.id } }, [
            el("span", { class: "roster-paste-name" }, shown),
            el("span", { class: "roster-paste-meta" }, [
              kindTag(item),
              typed.length ? L(` · từ “${typed.join("”, “")}”`, ` · 来自“${typed.join("”“")}”`) : "",
              owned.has(item.id) ? L(" · đã có trong kho", " · 已在库存中") : "",
            ].join("")),
          ]);
        })),
      ]));
    }
    if (result.ambiguous.length) {
      groups.push(group("ambiguous", L("Cần chọn", "需要选择"), result.ambiguous.length, [
        el("p", { class: "roster-field-hint" }, L("Mỗi tên dưới đây khớp nhiều món. Chọn đúng món hoặc để “Bỏ qua”.", "以下每个名称都匹配多个条目。请选择正确的一项，或保持“跳过”。")),
        el("ul", { class: "roster-paste-list" }, result.ambiguous.map(({ input: text, candidates }, position) => {
          const id = `${uid}-paste-choice-${position}`;
          const select = el("select", { class: "ana-input", id }, [
            el("option", { value: "" }, L("Bỏ qua", "跳过")),
            ...candidates.map((item) => el("option", { value: item.id }, `${label(item)} · ${kindTag(item)}`)),
          ]);
          select.value = review.choices.get(position) || "";
          select.addEventListener("change", () => {
            if (select.value) review.choices.set(position, select.value);
            else review.choices.delete(position);
            paintCount();
          });
          return el("li", { class: "roster-paste-row roster-paste-choice" }, [
            el("label", { class: "roster-paste-name", for: id }, `“${text}”`),
            select,
          ]);
        })),
      ]));
    }
    if (result.unrecognized.length) {
      groups.push(group("unrecognized", L("Không nhận ra", "无法识别"), result.unrecognized.length, [
        el("p", { class: "roster-field-hint" }, L(
          "Không thêm vào kho. Sửa chính tả rồi đối chiếu lại, hoặc tìm trong danh mục bên dưới.",
          "不会加入库存。请修正拼写后重新核对，或在下方图鉴中搜索。",
        )),
        el("ul", { class: "roster-paste-list" }, result.unrecognized.map((text) => el("li", { class: "roster-paste-row" }, [
          el("span", { class: "roster-paste-name" }, `“${text}”`),
        ]))),
      ]));
    }
    if (result.innate.length) {
      groups.push(group("innate", L("Chiến pháp tự mang", "自带战法"), result.innate.length, [
        el("p", { class: "roster-field-hint" }, L("Chiến pháp tự mang đi theo tướng, không cần thêm vào kho.", "自带战法随武将一起获得，无需单独加入库存。")),
        el("ul", { class: "roster-paste-list" }, result.innate.map(({ input: text, item }) => el("li", { class: "roster-paste-row" }, [
          el("span", { class: "roster-paste-name" }, label(item)),
          text !== label(item) && text !== item.name ? el("span", { class: "roster-paste-meta" }, L(`từ “${text}”`, `来自“${text}”`)) : null,
        ]))),
      ]));
    }

    addBtn.addEventListener("click", () => {
      const items = pendingItems();
      if (!items.length || disabled) return;
      const leftover = review.result.unrecognized;
      onAdd(items);
      review = null;
      paintReview();
      // Tên không nhận ra ở lại trong ô để sửa rồi đối chiếu lại; còn lại xoá khỏi ô.
      input.value = leftover.join("\n");
      status.textContent = leftover.length
        ? L(`Đã thêm ${items.length} món vào kho. ${leftover.length} tên không nhận ra vẫn còn trong ô để sửa.`, `已将 ${items.length} 项加入库存。${leftover.length} 个无法识别的名称仍保留在输入框中，可修改。`)
        : L(`Đã thêm ${items.length} món vào kho.`, `已将 ${items.length} 项加入库存。`);
      status.focus();
    });
    cancelBtn.addEventListener("click", () => {
      review = null;
      paintReview();
      status.textContent = "";
      input.focus();
    });

    paintCount();
    // `replaceChildren` đổi `null` thành chữ "null": lọc phần tử vắng trước khi truyền.
    reviewSlot.replaceChildren(...[
      el("p", { class: "roster-paste-summary" }, L(
        `${result.matched.length} khớp · ${result.ambiguous.length} cần chọn · ${result.unrecognized.length} không nhận ra`,
        `${result.matched.length} 项匹配 · ${result.ambiguous.length} 项需选择 · ${result.unrecognized.length} 项无法识别`,
      )),
      truncated ? el("p", { class: "roster-field-hint" }, L(`Chỉ đối chiếu ${review.names} tên đầu, bỏ ${truncated} tên còn lại.`, `仅核对前 ${review.names} 个名称，其余 ${truncated} 个已忽略。`)) : null,
      ...groups,
      el("div", { class: "roster-paste-bar" }, [addBtn, cancelBtn]),
    ].filter(Boolean));
    reviewSlot.hidden = false;
  }

  matchBtn.addEventListener("click", () => {
    if (disabled) return;
    const { names, truncated } = splitPastedNames(input.value);
    if (!names.length) {
      review = null;
      paintReview();
      status.textContent = L("Chưa có tên nào để đối chiếu.", "还没有可核对的名称。");
      input.focus();
      return;
    }
    review = { result: matchPastedNames(names, index), truncated, names: names.length, choices: new Map() };
    status.textContent = "";
    paintReview();
    reviewSlot.querySelector(".roster-paste-summary")?.setAttribute("tabindex", "-1");
    reviewSlot.querySelector(".roster-paste-summary")?.focus();
  });
  // Sửa chữ sau khi đối chiếu: kết quả cũ không còn đúng, phải đối chiếu lại trước khi thêm.
  input.addEventListener("input", () => {
    if (!review) return;
    review = null;
    paintReview();
  });

  const node = el("div", { class: "roster-paste" }, [toggle, panel]);
  return {
    node,
    setDisabled(value) {
      disabled = Boolean(value);
      input.disabled = disabled;
      matchBtn.disabled = disabled;
      if (review) paintReview();
    },
  };
}
