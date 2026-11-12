// Trình soạn đội của "Đội của tôi" (artboard DoiCuaToi `.dct-editor`), mở tại chỗ thay cho thẻ đội. Dựng một `<form>`
// từ đội đã chuẩn hóa: hàng trường của đội (tên, hạng, mùa, nhóm, thay thế cho đội), mỗi tướng một khung hai cột
// (cấu trúc chọn từ danh mục bằng bảng chọn tại chỗ — js/my-teams-inline-picker.js — và chữ tự do), ghi chú của đội,
// dòng tóm tắt món chưa có trong kho. Ô chữ có bộ đếm byte (cùng cách đếm với server: `escapedBytes`).
// Lưu lỗi hoặc bị từ chối: `role="alert"` nêu lý do, nội dung soạn giữ nguyên, nút đổi thành "Lưu lại".
// Xung đột: hiện bản đang có trên server cạnh bản đang soạn để người dùng chọn giữ bản nào (giữ bản soạn thì lưu lại với
// dấu thời gian mới: `saveTeam` đóng dấu Lamport lớn hơn bản server).

import { formatDateTime } from "./community-api.js";
import { L } from "./i18n.js";
import { mtIcon } from "./my-teams-icons.js";
import { inlinePicker } from "./my-teams-inline-picker.js";
import { escapedBytes, missingItems, normalizeTeam, stripControl, TEAM_LIMITS, validateTeam } from "./my-teams-model.js";
import { describeFailure, groupLabel } from "./my-teams-ui.js";
import { el } from "./render.js";

let uid = 0;
const nextId = (prefix) => `${prefix}-${++uid}`;

const emptySlot = () => ({ primary: null, alternatives: [], rawName: "" });
const emptyHero = () => ({
  hero: null,
  slotState: "source-empty",
  rawName: "",
  heroAlternatives: [],
  redStars: null,
  tactics: [emptySlot(), emptySlot()],
  books: [],
  bookType: "",
  troopNote: "",
  statNote: "",
  gearNote: "",
});

const KIND_NAME = { heroes: "hero", tactics: "tactic", books: "book" };
/** Cùng mốc với bố cục mobile của trang (`@media (max-width: 820px)` trong khối CSS moi:doi-cua-toi). */
const COMPACT_QUERY = "(max-width: 820px)";

/** Ô chữ có bộ đếm byte; vượt trần chỉ đổi màu + `aria-invalid` (không cắt chữ, việc chặn là của lần Lưu). */
function textField({ label, value, max, rows = 0, placeholder = null, onInput, className = "" }) {
  const id = nextId("mt-edit");
  const input = el(rows ? "textarea" : "input", { class: "ana-input mt-input", id, rows: rows ? String(rows) : null, type: rows ? null : "text", placeholder, "aria-describedby": `${id}-bytes` });
  input.value = value;
  const counter = el("span", { class: "mt-bytes", id: `${id}-bytes` });
  const paint = () => {
    const used = escapedBytes(input.value);
    counter.textContent = L(`${used} / ${max} byte`, `${used} / ${max} 字节`);
    counter.dataset.over = String(used > max);
    input.setAttribute("aria-invalid", String(used > max));
  };
  input.addEventListener("input", () => {
    const clean = stripControl(input.value);
    if (clean !== input.value) input.value = clean;
    onInput(clean);
    paint();
  });
  paint();
  return el("div", { class: `mt-field${className}` }, [el("div", { class: "mt-field-top" }, [el("label", { for: id }, label), counter]), input]);
}

const selectField = (label, select, help = null, className = "") => el("div", { class: `mt-field${className}` }, [
  el("label", { for: select.id }, label),
  select,
  help ? el("span", { class: "mt-help" }, help) : null,
]);

/**
 * @param team đội đã chuẩn hóa (có `id`, `boxId`, `groupId`)
 * @param teams các đội cùng hộp (chọn "Thay thế cho đội"), @param groups nhóm của hộp
 * @param names {hero, tactic, book}(id) → tên hiển thị
 * @param catalog kết quả `buildCatalog(…, "editor")`
 * @param owned Set kho của hộp (rỗng = hộp chưa có kho, không gắn nhãn kho)
 * @param seasons [{id, label}] danh mục mùa của site
 * @param save (draft) → kết quả `saveTeam`, @param onSaved (team) · onCancel · onKeepServer(serverTeam)
 */
export function createTeamEditor({ team, teams, groups, names, catalog, owned = new Set(), seasons = [], save, onSaved, onCancel, onKeepServer }) {
  const draft = structuredClone(team);
  const alert = el("p", { class: "mt-alert", role: "alert", hidden: "" });
  const conflictSlot = el("div", { class: "mt-conflict-slot" });
  const heroesSlot = el("div", { class: "mt-edit-heroes" });
  const summary = el("p", { class: "mt-editor-sum", hidden: "" });
  const saveButton = el("button", { type: "submit", class: "ana-btn primary mt-btn mt-btn-primary" }, [mtIcon("check"), L("Lưu", "保存")]);
  const cancelButton = el("button", { type: "button", class: "ana-btn mt-btn" }, L("Hủy", "取消"));
  const nameOf = (kind) => names[KIND_NAME[kind]];
  /** Bảng chọn đang mở: `{key, picker}` (một bảng mỗi lần). */
  let open = null;
  // Mobile (DoiCuaToiMobile): mỗi tướng là một `<details>` thu gọn được, tướng 1 mở sẵn; desktop là `<fieldset>` mở hẳn.
  const compact = globalThis.matchMedia?.(COMPACT_QUERY) ?? null;
  const expanded = new Set([0]);
  /** Gỡ mọi listener ngoài form (matchMedia) khi trình soạn đóng: `dispose()` của kết quả. */
  const lifetime = new AbortController();
  const editorId = nextId("mt-editor");
  const pickerId = (key) => `${editorId}-picker-${key}`;

  const showAlert = (message) => {
    alert.textContent = message;
    alert.hidden = !message;
  };

  /* ---------- Bảng chọn tại chỗ ---------- */

  function togglePicker(key, options) {
    if (open?.key === key) {
      closePicker();
      return;
    }
    expanded.add(Number.parseInt(key, 10));
    open = {
      key,
      picker: inlinePicker({
        ...options,
        id: pickerId(key),
        catalog,
        owned,
        nameOf: nameOf(options.kind),
        onChange: () => {
          options.commit?.();
          paintHeroes();
        },
        onClose: closePicker,
      }),
    };
    paintHeroes();
    open.picker.focus();
  }

  function closePicker() {
    const key = open?.key;
    open = null;
    paintHeroes();
    if (key) heroesSlot.querySelector(`[data-picker-key="${key}"]`)?.focus();
  }

  const pickerFor = (key) => (open?.key === key ? open.picker.node : null);

  /** Hàng phương án (thay thế / binh thư): chip có nút bỏ + nút Thêm mở bảng chọn nhiều + đếm `n/max`. */
  function altsRow({ key, sub, emptyText, values, max, kind, label, addLabel }) {
    const nameFor = nameOf(kind);
    const add = el("button", { type: "button", class: "mt-chip-add", "aria-label": addLabel, "aria-expanded": String(open?.key === key), "aria-controls": open?.key === key ? pickerId(key) : null, dataset: { pickerKey: key }, onclick: () => togglePicker(key, { kind, values, max, label }) }, [mtIcon("plus", 14), L("Thêm", "添加")]);
    return [
      el("div", { class: "mt-slot-alts" }, [
        sub ? el("span", { class: "mt-slot-sub" }, sub) : null,
        !values.length && emptyText ? el("span", { class: "mt-slot-empty" }, emptyText) : null,
        ...values.map((id) => el("span", { class: "mt-chip" }, [
          nameFor(id),
          el("button", {
            type: "button",
            class: "mt-chip-x",
            "aria-label": L(`Bỏ ${nameFor(id)}`, `移除 ${nameFor(id)}`),
            onclick: () => {
              values.splice(values.indexOf(id), 1);
              // Bảng chọn của chính hàng này đang mở: cập nhật trạng thái chọn trong bảng.
              if (open?.key === key) open.picker.refresh();
              paintHeroes();
              heroesSlot.querySelector(`[data-picker-key="${key}"]`)?.focus();
            },
          }, [mtIcon("close", 13)]),
        ])),
        add,
        el("span", { class: "mt-slot-cap" }, `${values.length}/${max}`),
      ]),
      pickerFor(key),
    ];
  }

  /** Ô một món (tướng hoặc chiến pháp chính): tên + dấu kho + Đổi/Chọn + Bỏ, bảng chọn mở ngay dưới. */
  function slotLine({ key, label, kind, value, rawName, missing, onPick }) {
    const values = value ? [value] : [];
    const shown = value
      ? el("span", { class: "mt-slot-value" }, nameOf(kind)(value))
      : el("span", { class: "mt-slot-empty" }, rawName ? L(`Chưa đối chiếu: ${rawName}`, `未匹配：${rawName}`) : L("(trống)", "（空）"));
    const pick = el("button", {
      type: "button",
      class: "mt-mini",
      "aria-expanded": String(open?.key === key),
      "aria-controls": open?.key === key ? pickerId(key) : null,
      "aria-label": L(`${value ? "Đổi" : "Chọn"} ${label.toLowerCase()}`, `${value ? "更换" : "选择"}${label}`),
      dataset: { pickerKey: key },
      onclick: () => togglePicker(key, { kind, values, max: 1, single: true, label: L(`Chọn ${label.toLowerCase()}`, `选择${label}`), commit: () => onPick(values[0] ?? null) }),
    }, value ? L("Đổi", "更换") : L("Chọn", "选择"));
    return [
      el("div", { class: "mt-slot-line" }, [
        shown,
        missing ? el("span", { class: "mt-miss" }, L("chưa có trong kho", "库中没有")) : null,
        el("span", { class: "mt-slot-actions" }, [
          pick,
          value ? el("button", { type: "button", class: "mt-mini", "aria-label": L(`Bỏ ${label.toLowerCase()}`, `清除${label}`), onclick: () => {
            onPick(null);
            // Bảng chọn của ô này đang mở giữ mảng lựa chọn riêng: đóng bảng để không còn hiện món vừa bỏ.
            if (open?.key === key) open = null;
            paintHeroes();
          } }, L("Bỏ", "清除")) : null,
        ]),
      ]),
      pickerFor(key),
    ];
  }

  const slotRow = (label, children, labelFor = null) => el("div", { class: "mt-slot" }, [
    labelFor ? el("label", { class: "mt-slot-label", for: labelFor }, label) : el("span", { class: "mt-slot-label" }, label),
    el("div", { class: "mt-slot-main" }, children),
  ]);

  /* ---------- Từng tướng ---------- */

  function heroFieldset(hero, index, missing) {
    const mine = missing.filter((item) => item.heroIndex === index);
    const isMissing = (type, slotIndex) => mine.some((item) => item.type === type && (slotIndex === undefined || item.slotIndex === slotIndex));
    const redId = nextId("mt-red");
    const redStars = el("select", { class: "ana-input mt-select-narrow", id: redId }, [
      el("option", { value: "" }, L("Không rõ", "未设置")),
      ...[0, 1, 2, 3, 4, 5].map((n) => el("option", { value: String(n) }, `${n}★`)),
    ]);
    redStars.value = hero.redStars === null ? "" : String(hero.redStars);
    redStars.addEventListener("change", () => {
      hero.redStars = redStars.value === "" ? null : Number(redStars.value);
    });

    const remove = draft.heroes.length > 1
      ? el("div", { class: "mt-edit-hero-foot" }, [el("button", {
        type: "button",
        class: "ana-btn mt-btn mt-btn-ghost mt-btn-sm mt-delete",
        onclick: () => {
          draft.heroes.splice(index, 1);
          draft.userAlternatives = draft.userAlternatives
            .filter((item) => item.heroIndex !== index)
            .map((item) => (item.heroIndex > index ? { ...item, heroIndex: item.heroIndex - 1 } : item));
          open = null;
          expanded.clear();
          expanded.add(Math.max(0, index - 1));
          paintHeroes();
          heroesSlot.querySelector(".mt-edit-hero .mt-legend, .mt-edit-hero .mt-edit-hero-sum")?.focus();
        },
      }, [mtIcon("trash", 15), L("Xóa tướng này", "删除此武将")])])
      : null;

    const stockPill = owned.size
      ? el("span", { class: `mt-pill ${mine.length ? "mt-pill-warn" : "mt-pill-good"}` }, mine.length ? L(`${mine.length} món chưa có trong kho`, `${mine.length} 项库中没有`) : L("Đủ trong kho", "库中齐全"))
      : null;
    const heroName = hero.hero ? names.hero(hero.hero) : hero.rawName;

    const structure = el("div", { class: "mt-col" }, [
      el("p", { class: "mt-col-title" }, L("Cấu trúc · chọn từ danh mục", "结构 · 从图鉴选择")),
      slotRow(L("Tướng", "武将"), [
        ...slotLine({
          key: `${index}-hero`,
          label: L("Tướng", "武将"),
          kind: "heroes",
          value: hero.hero,
          rawName: hero.slotState === "unresolved" ? hero.rawName : "",
          missing: isMissing("hero"),
          onPick: (id) => {
            hero.hero = id;
            hero.slotState = id ? "ok" : "source-empty";
            hero.rawName = "";
          },
        }),
        ...altsRow({ key: `${index}-hero-alt`, sub: L("Tướng thay thế", "替补武将"), values: hero.heroAlternatives, max: TEAM_LIMITS.maxAlternatives, kind: "heroes", label: L(`Tướng thay thế cho tướng ${index + 1}`, `武将 ${index + 1} 的替补`), addLabel: L(`Thêm tướng thay thế cho tướng ${index + 1}`, `为武将 ${index + 1} 添加替补`) }),
      ]),
      slotRow(L("Sao đỏ", "红星"), [redStars], redId),
      ...hero.tactics.map((tactic, slotIndex) => slotRow(L(`Chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1}`), [
        ...slotLine({
          key: `${index}-t${slotIndex}`,
          label: L(`Chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1}`),
          kind: "tactics",
          value: tactic.primary,
          rawName: tactic.rawName,
          missing: isMissing("tactic", slotIndex),
          onPick: (id) => {
            tactic.primary = id;
            tactic.rawName = "";
          },
        }),
        ...altsRow({ key: `${index}-t${slotIndex}-alt`, sub: L("Thay thế", "替补"), values: tactic.alternatives, max: TEAM_LIMITS.maxAlternatives, kind: "tactics", label: L(`Thay thế cho chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1} 的替补`), addLabel: L(`Thêm thay thế cho chiến pháp ${slotIndex + 1}`, `为战法 ${slotIndex + 1} 添加替补`) }),
      ])),
      slotRow(L("Binh thư", "兵书"), [
        ...altsRow({ key: `${index}-books`, emptyText: L("Chưa chọn binh thư", "未选兵书"), values: hero.books, max: TEAM_LIMITS.maxBooks, kind: "books", label: L(`Binh thư của tướng ${index + 1}`, `武将 ${index + 1} 的兵书`), addLabel: L(`Thêm binh thư cho tướng ${index + 1}`, `为武将 ${index + 1} 添加兵书`) }),
      ]),
    ]);

    const free = el("div", { class: "mt-col mt-col-free" }, [
      el("p", { class: "mt-col-title" }, L("Chữ tự do", "自由文字")),
      textField({ label: L("Loại binh thư (chữ)", "兵书类型（文字）"), value: hero.bookType, max: TEAM_LIMITS.bookType, placeholder: L("Ví dụ: Võ Lược", "例如：武略"), onInput: (value) => (hero.bookType = value) }),
      textField({ label: L("Binh chủng / ghi chú", "兵种 / 备注"), value: hero.troopNote, max: TEAM_LIMITS.slotNote, rows: 2, onInput: (value) => (hero.troopNote = value) }),
      textField({ label: L("Cộng điểm", "加点"), value: hero.statNote, max: TEAM_LIMITS.slotNote, rows: 2, onInput: (value) => (hero.statNote = value) }),
      textField({ label: L("Trang bị", "装备"), value: hero.gearNote, max: TEAM_LIMITS.slotNote, rows: 2, onInput: (value) => (hero.gearNote = value) }),
    ]);

    const heading = () => [
      el("span", { class: "mt-legend-n" }, L(`Tướng ${index + 1}`, `武将 ${index + 1}`)),
      heroName ? el("span", { class: "mt-legend-name" }, heroName) : null,
      stockPill,
    ];
    const content = [el("div", { class: "mt-edit-hero-grid" }, [structure, free]), remove];
    if (compact?.matches) {
      const details = el("details", { class: "mt-edit-hero mt-edit-hero-compact", open: expanded.has(index) ? "" : null, dataset: { heroIndex: String(index) } }, [
        el("summary", { class: "mt-edit-hero-sum" }, [...heading(), el("span", { class: "mt-sum-chev" }, [mtIcon("chevron", 18)])]),
        el("fieldset", { class: "mt-fs" }, [el("legend", { class: "visually-hidden" }, L(`Tướng ${index + 1}`, `武将 ${index + 1}`)), ...content]),
      ]);
      details.addEventListener("toggle", () => (details.open ? expanded.add(index) : expanded.delete(index)));
      return details;
    }
    return el("fieldset", { class: "mt-edit-hero", dataset: { heroIndex: String(index) } }, [
      el("legend", { class: "mt-legend", tabindex: "-1" }, heading()),
      ...content,
    ]);
  }

  function paintSummary(missing) {
    if (!owned.size || !missing.length) {
      summary.hidden = true;
      summary.replaceChildren();
      return;
    }
    const list = missing.map((item) => names[item.type](item.id)).join(L(", ", "、"));
    summary.hidden = false;
    summary.replaceChildren(mtIcon("warn"), L(`${missing.length} món chưa có trong kho: ${list}. Vẫn lưu được.`, `${missing.length} 项库中没有：${list}。仍可保存。`));
  }

  function paintHeroes() {
    // Bảng chọn đang mở bị gỡ khỏi DOM khi vẽ lại: giữ focus ở đúng phần tử của nó sau khi gắn lại.
    const active = open && open.picker.node.contains(document.activeElement) ? document.activeElement : null;
    const missing = owned.size ? missingItems(draft, owned) : [];
    const full = draft.heroes.length >= TEAM_LIMITS.maxHeroes;
    heroesSlot.replaceChildren(
      ...draft.heroes.map((hero, index) => heroFieldset(hero, index, missing)),
      el("button", {
        type: "button",
        class: "ana-btn mt-btn mt-add-hero",
        disabled: full ? "" : null,
        onclick: () => {
          draft.heroes.push(emptyHero());
          expanded.add(draft.heroes.length - 1);
          paintHeroes();
        },
      }, [mtIcon("plus"), L("Thêm tướng", "添加武将"), full ? el("span", { class: "mt-help" }, L(` (đã đủ ${TEAM_LIMITS.maxHeroes})`, `（已满 ${TEAM_LIMITS.maxHeroes} 名）`)) : null]),
    );
    paintSummary(missing);
    if (active?.isConnected) active.focus();
  }
  paintHeroes();
  // Qua lại mốc mobile (xoay máy, đổi cỡ cửa sổ): dựng lại khung tướng theo kiểu của bề rộng mới.
  compact?.addEventListener?.("change", () => {
    if (heroesSlot.isConnected) paintHeroes();
  }, { signal: lifetime.signal });

  /* ---------- Trường của đội ---------- */

  const groupSelect = el("select", { class: "ana-input", id: nextId("mt-group") }, groups.map((group) => el("option", { value: group.id }, groupLabel(group))));
  groupSelect.value = groups.some((group) => group.id === draft.groupId) ? draft.groupId : groups[0]?.id ?? "";
  draft.groupId = groupSelect.value || draft.groupId;
  const kicker = el("span", { class: "mt-kicker" });
  const paintKicker = () => {
    const group = groups.find((item) => item.id === draft.groupId);
    kicker.textContent = group ? L(`Đang sửa · ${groupLabel(group)}`, `正在编辑 · ${groupLabel(group)}`) : L("Đang sửa", "正在编辑");
  };
  groupSelect.addEventListener("change", () => {
    draft.groupId = groupSelect.value;
    paintKicker();
  });
  paintKicker();

  // Mùa chọn từ danh mục của site; giá trị cũ không có trong danh mục vẫn giữ nguyên (không mất dữ liệu đã lưu).
  const seasonSelect = el("select", { class: "ana-input", id: nextId("mt-season") }, [
    el("option", { value: "" }, L("Không ghi mùa", "不注明赛季")),
    ...(draft.seasonId && !seasons.some((season) => season.id === draft.seasonId) ? [el("option", { value: draft.seasonId }, draft.seasonId)] : []),
    ...seasons.map((season) => el("option", { value: season.id }, season.label)),
  ]);
  seasonSelect.value = draft.seasonId ?? "";
  seasonSelect.addEventListener("change", () => (draft.seasonId = seasonSelect.value || null));

  const replaceSelect = el("select", { class: "ana-input", id: nextId("mt-replace") }, [
    el("option", { value: "" }, L("Không thay đội nào", "不替换任何阵容")),
    ...teams.filter((other) => other.id !== draft.id).map((other) => el("option", { value: other.id }, other.name || other.id)),
  ]);
  replaceSelect.value = draft.replacesTeamId && teams.some((other) => other.id === draft.replacesTeamId) ? draft.replacesTeamId : "";
  replaceSelect.addEventListener("change", () => (draft.replacesTeamId = replaceSelect.value || null));

  const notesFields = [
    ["general", L("Ghi chú chung", "综合备注")],
    ["strengths", L("Điểm mạnh", "优点")],
    ["goodAgainst", L("Khắc chế", "克制")],
    ["avoid", L("Nên tránh", "避免")],
  ];

  /* ---------- Xung đột ---------- */

  const heroLine = (value) => value.heroes.map((hero) => (hero.hero ? names.hero(hero.hero) : hero.rawName || "—")).join(" · ");

  function conflictColumn(title, value, extra) {
    return el("section", { class: "mt-conflict-col", "aria-label": title }, [
      el("h4", {}, title),
      el("p", { class: "mt-conflict-name" }, value.name || value.id),
      el("p", {}, heroLine(value)),
      value.tierLabel ? el("p", {}, value.tierLabel) : null,
      value.updatedAt ? el("p", { class: "mt-conflict-time" }, formatDateTime(value.updatedAt)) : null,
      extra,
    ]);
  }

  function showConflict(result) {
    const server = result.server;
    const mine = result.loser ?? draft;
    const keepServer = el("button", { type: "button", class: "ana-btn", disabled: server ? null : "" }, L("Giữ bản trên máy chủ", "保留服务器版本"));
    const keepMine = el("button", { type: "button", class: "ana-btn primary" }, L("Giữ bản của tôi", "保留我的版本"));
    keepServer.addEventListener("click", () => onKeepServer?.(server));
    keepMine.addEventListener("click", () => submit());
    conflictSlot.replaceChildren(el("div", { class: "mt-conflict", dataset: { conflict: "" } }, [
      server ? conflictColumn(L("Bản trên máy chủ", "服务器版本"), server) : el("p", {}, L("Máy chủ có bản mới hơn nhưng không gửi kèm nội dung.", "服务器有更新的版本，但未附带内容。")),
      conflictColumn(L("Bản đang soạn", "正在编辑的版本"), mine),
      el("div", { class: "mt-dialog-actions" }, [keepServer, keepMine]),
    ]));
  }

  /* ---------- Lưu ---------- */

  async function submit() {
    showAlert("");
    conflictSlot.replaceChildren();
    const candidate = normalizeTeam({ ...draft, name: draft.name });
    const checked = candidate ? validateTeam(candidate) : { ok: false, errors: [] };
    if (!candidate || !checked.ok) {
      showAlert(describeFailure({ code: candidate ? "validation" : "schema", errors: checked.errors }));
      return;
    }
    saveButton.disabled = true;
    let result;
    try {
      result = await save(candidate);
    } catch {
      result = { ok: false, pending: true, code: "network" };
    }
    saveButton.disabled = false;
    if (result.ok) {
      onSaved(result.team);
      return;
    }
    saveButton.replaceChildren(mtIcon("check"), L("Lưu lại", "重新保存"));
    showAlert(describeFailure(result));
    if (result.conflict) showConflict(result);
  }

  const form = el("form", { class: "mt-editor", novalidate: "", "aria-label": L("Sửa đội", "编辑阵容"), dataset: { teamId: draft.id } }, [
    el("header", { class: "mt-editor-head" }, [
      el("div", {}, [kicker, el("h3", { class: "mt-editor-title" }, L("Sửa đội", "编辑阵容"))]),
      el("p", { class: "mt-editor-note" }, [mtIcon("cloud"), L("Lưu lên tài khoản khi bấm Lưu. Bản đã lưu là bản sao riêng, nguồn đổi không ghi đè.", "点击保存后同步到账号。已保存的是你自己的副本，来源更新不会覆盖。")]),
    ]),
    el("div", { class: "mt-edit-fields" }, [
      textField({ label: L("Tên đội", "阵容名称"), value: draft.name, max: TEAM_LIMITS.name, onInput: (value) => (draft.name = value) }),
      textField({ label: L("Hạng", "评级"), value: draft.tierLabel, max: TEAM_LIMITS.tierLabel, placeholder: L("Ví dụ: T0", "例如：T0"), onInput: (value) => (draft.tierLabel = value) }),
      selectField(L("Mùa", "赛季"), seasonSelect),
      selectField(L("Nhóm", "分组"), groupSelect),
      selectField(L("Thay thế cho đội", "替换的阵容"), replaceSelect, L("Đội thay thế không bị tính trùng tướng với đội nó thay.", "替换阵容不会与被替换的阵容计为武将重复。")),
    ]),
    heroesSlot,
    el("div", { class: "mt-edit-notes" }, [
      el("p", { class: "mt-col-title" }, L("Ghi chú của đội · chữ tự do", "阵容备注 · 自由文字")),
      el("div", { class: "mt-edit-notes-grid" }, notesFields.map(([key, label]) => textField({ label, value: draft.notes[key], max: TEAM_LIMITS.notesField, rows: 3, onInput: (value) => (draft.notes[key] = value) }))),
    ]),
    alert,
    conflictSlot,
    el("footer", { class: "mt-editor-foot" }, [summary, el("div", { class: "mt-editor-actions" }, [cancelButton, saveButton])]),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  cancelButton.addEventListener("click", () => onCancel());
  // Bản chuẩn hóa ngay sau khi dựng xong (đã gán nhóm mặc định của ô chọn): so với bản đang soạn để biết có thay đổi
  // chưa lưu (đổi hộp / tạo hộp / mở đội khác / xóa hộp phải hỏi lại).
  const snapshotOf = () => JSON.stringify(normalizeTeam(structuredClone(draft)));
  const baseline = snapshotOf();
  return Object.assign(form, {
    isDirty: () => snapshotOf() !== baseline,
    dispose: () => lifetime.abort(),
  });
}
