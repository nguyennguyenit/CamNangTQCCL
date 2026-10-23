// Trình soạn đội của "Đội của tôi". Dựng một `<form>` từ đội đã chuẩn hóa; chọn tướng/chiến pháp/binh thư bằng
// `roster-picker` policy `editor` (đủ danh mục, có binh thư), ô chữ tự do có bộ đếm byte (cùng cách đếm với server:
// `escapedBytes`). Lưu lỗi hoặc bị từ chối: `role="alert"` nêu lý do, nội dung soạn giữ nguyên, nút đổi thành "Lưu lại".
// Xung đột: hiện bản đang có trên server cạnh bản đang soạn để người dùng chọn giữ bản nào (giữ bản soạn thì lưu lại với
// dấu thời gian mới: `saveTeam` đóng dấu Lamport lớn hơn bản server).

import { formatDateTime } from "./community-api.js";
import { L } from "./i18n.js";
import { escapedBytes, normalizeTeam, stripControl, TEAM_LIMITS, validateTeam } from "./my-teams-model.js";
import { describeFailure, groupLabel, openDialog } from "./my-teams-ui.js";
import { createPicker } from "./roster-picker.js";
import { el } from "./render.js";

let uid = 0;
const nextId = (prefix) => `${prefix}-${++uid}`;

const KIND_TITLES = {
  heroes: () => L("Chọn tướng", "选择武将"),
  tactics: () => L("Chọn chiến pháp", "选择战法"),
  books: () => L("Chọn binh thư", "选择兵书"),
};

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

/** Ô chữ có bộ đếm byte; vượt trần chỉ đổi màu + `aria-invalid` (không cắt chữ, việc chặn là của lần Lưu). */
function textField({ label, value, max, multiline = false, onInput }) {
  const id = nextId("mt-edit");
  const input = el(multiline ? "textarea" : "input", { class: "ana-input mt-input", id, rows: multiline ? "4" : null, type: multiline ? null : "text", "aria-describedby": `${id}-bytes` });
  input.value = value;
  const counter = el("span", { class: "mt-bytes", id: `${id}-bytes` });
  const paint = () => {
    const used = escapedBytes(input.value);
    counter.textContent = `${used} / ${max} B`;
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
  return el("div", { class: "mt-field" }, [el("label", { for: id }, label), input, counter]);
}

/**
 * @param team đội đã chuẩn hóa (có `id`, `boxId`, `groupId`)
 * @param teams các đội cùng hộp (chọn "Thay thế cho đội"), @param groups nhóm của hộp
 * @param names {hero, tactic, book}(id) → tên hiển thị
 * @param catalog kết quả `buildCatalog(…, "editor")`
 * @param save (draft) → kết quả `saveTeam`, @param onSaved (team) · onCancel · onKeepServer(serverTeam)
 */
export function createTeamEditor({ team, teams, groups, names, catalog, save, onSaved, onCancel, onKeepServer }) {
  const draft = structuredClone(team);
  const alert = el("p", { class: "mt-alert", role: "alert", hidden: "" });
  const conflictSlot = el("div", { class: "mt-conflict-slot" });
  const heroesSlot = el("div", { class: "mt-edit-heroes" });
  const saveButton = el("button", { type: "submit", class: "ana-btn primary" }, L("Lưu", "保存"));
  const cancelButton = el("button", { type: "button", class: "ana-btn" }, L("Hủy", "取消"));

  const showAlert = (message) => {
    alert.textContent = message;
    alert.hidden = !message;
  };

  /* ---------- Chọn món bằng roster-picker (policy editor) ---------- */

  /** Chọn một món: bấm hàng chọn rồi đóng; bấm lại món đang chọn thì bỏ chọn. */
  function chooseOne({ kind, current, onPick }) {
    const holder = {};
    const picker = createPicker({
      policy: "editor",
      kinds: [kind],
      catalog,
      title: KIND_TITLES[kind](),
      selected: () => new Set(current ? [current] : []),
      onToggle: (items, on) => {
        onPick(on ? items[0].id : null);
        holder.close?.();
      },
      label: (item) => names[{ heroes: "hero", tactics: "tactic", books: "book" }[item.type]](item.id),
    });
    holder.close = openDialog({ title: KIND_TITLES[kind](), body: picker.node, className: "mt-picker-dialog" }).close;
  }

  /** Chọn nhiều món (phương án thay, binh thư): hộp thoại ở lại, mỗi lần bấm bật/tắt một món, tối đa `max`. */
  function chooseMany({ kind, values, max, onChange }) {
    const status = el("p", { class: "mt-picker-limit", role: "status" });
    const picker = createPicker({
      policy: "editor",
      kinds: [kind],
      catalog,
      title: KIND_TITLES[kind](),
      selected: () => new Set(values),
      onToggle: (items, on) => {
        const item = items[0];
        if (on) {
          if (values.length >= max) {
            status.textContent = L(`Tối đa ${max} mục.`, `最多 ${max} 项。`);
            return;
          }
          values.push(item.id);
        } else {
          const at = values.indexOf(item.id);
          if (at >= 0) values.splice(at, 1);
        }
        status.textContent = "";
        onChange();
      },
      label: (item) => names[{ heroes: "hero", tactics: "tactic", books: "book" }[item.type]](item.id),
    });
    const done = el("button", { type: "button", class: "ana-btn primary" }, L("Xong", "完成"));
    const body = el("div", { class: "mt-picker-body" }, [picker.node, status, el("div", { class: "mt-dialog-actions" }, [done])]);
    const { close } = openDialog({ title: KIND_TITLES[kind](), body, className: "mt-picker-dialog" });
    done.addEventListener("click", close);
  }

  /** Hàng chip các món (có nút bỏ từng món + nút thêm). */
  function chips({ label, values, max, kind, nameOf, onChange }) {
    const row = el("div", { class: "mt-chips" }, [
      el("span", { class: "mt-chips-label" }, label),
      ...values.map((id) => el("span", { class: "mt-chip" }, [
        nameOf(id),
        el("button", {
          type: "button",
          class: "mt-chip-remove",
          "aria-label": L(`Bỏ ${nameOf(id)}`, `移除 ${nameOf(id)}`),
          onclick: () => {
            values.splice(values.indexOf(id), 1);
            onChange();
          },
        }, "×"),
      ])),
    ]);
    const add = el("button", {
      type: "button",
      class: "ana-btn mt-chip-add",
      disabled: values.length >= max ? "" : null,
      onclick: () => chooseMany({ kind, values, max, onChange }),
    }, L("+ Thêm", "+ 添加"));
    row.append(add);
    return row;
  }

  /** Ô một món (tướng hoặc một ô chiến pháp): tên đang chọn + Chọn/Đổi + Bỏ. */
  function slot({ label, kind, value, rawName, nameOf, onPick }) {
    const shown = value
      ? nameOf(value)
      : rawName
        ? L(`Chưa đối chiếu: ${rawName}`, `未匹配：${rawName}`)
        : L("(trống)", "（空）");
    return el("div", { class: "mt-slot" }, [
      el("span", { class: "mt-slot-label" }, label),
      el("span", { class: "mt-slot-value", dataset: { empty: String(!value) } }, shown),
      el("button", { type: "button", class: "ana-btn", onclick: () => chooseOne({ kind, current: value, onPick }) }, value ? L("Đổi", "更换") : L("Chọn", "选择")),
      value ? el("button", { type: "button", class: "roster-ghost", onclick: () => onPick(null) }, L("Bỏ", "清除")) : null,
    ]);
  }

  /* ---------- Từng tướng ---------- */

  function heroFieldset(hero, index) {
    const redId = nextId("mt-red");
    const redStars = el("select", { class: "ana-input", id: redId }, [
      el("option", { value: "" }, L("Không rõ", "未设置")),
      ...[0, 1, 2, 3, 4, 5].map((n) => el("option", { value: String(n) }, `${n}★`)),
    ]);
    redStars.value = hero.redStars === null ? "" : String(hero.redStars);
    redStars.addEventListener("change", () => {
      hero.redStars = redStars.value === "" ? null : Number(redStars.value);
    });

    const remove = draft.heroes.length > 1
      ? el("button", {
        type: "button",
        class: "roster-ghost",
        onclick: () => {
          draft.heroes.splice(index, 1);
          draft.userAlternatives = draft.userAlternatives
            .filter((item) => item.heroIndex !== index)
            .map((item) => (item.heroIndex > index ? { ...item, heroIndex: item.heroIndex - 1 } : item));
          paintHeroes();
        },
      }, L("Xóa tướng này", "删除此武将"))
      : null;

    return el("fieldset", { class: "mt-edit-hero", dataset: { heroIndex: String(index) } }, [
      el("legend", {}, L(`Tướng ${index + 1}`, `武将 ${index + 1}`)),
      slot({
        label: L("Tướng", "武将"),
        kind: "heroes",
        value: hero.hero,
        rawName: hero.slotState === "unresolved" ? hero.rawName : "",
        nameOf: names.hero,
        onPick: (id) => {
          hero.hero = id;
          hero.slotState = id ? "ok" : "source-empty";
          hero.rawName = "";
          paintHeroes();
        },
      }),
      chips({ label: L("Tướng thay thế", "替补武将"), values: hero.heroAlternatives, max: TEAM_LIMITS.maxAlternatives, kind: "heroes", nameOf: names.hero, onChange: paintHeroes }),
      el("div", { class: "mt-field mt-field-inline" }, [el("label", { for: redId }, L("Sao đỏ", "红星")), redStars]),
      ...hero.tactics.flatMap((tactic, slotIndex) => [
        slot({
          label: L(`Chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1}`),
          kind: "tactics",
          value: tactic.primary,
          rawName: tactic.rawName,
          nameOf: names.tactic,
          onPick: (id) => {
            tactic.primary = id;
            tactic.rawName = "";
            paintHeroes();
          },
        }),
        chips({ label: L(`Thay thế chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1} 替补`), values: tactic.alternatives, max: TEAM_LIMITS.maxAlternatives, kind: "tactics", nameOf: names.tactic, onChange: paintHeroes }),
      ]),
      chips({ label: L("Binh thư", "兵书"), values: hero.books, max: TEAM_LIMITS.maxBooks, kind: "books", nameOf: names.book, onChange: paintHeroes }),
      textField({ label: L("Loại binh thư (chữ)", "兵书类型（文字）"), value: hero.bookType, max: TEAM_LIMITS.bookType, onInput: (value) => (hero.bookType = value) }),
      textField({ label: L("Binh chủng / ghi chú", "兵种 / 备注"), value: hero.troopNote, max: TEAM_LIMITS.slotNote, onInput: (value) => (hero.troopNote = value) }),
      textField({ label: L("Cộng điểm", "加点"), value: hero.statNote, max: TEAM_LIMITS.slotNote, onInput: (value) => (hero.statNote = value) }),
      textField({ label: L("Trang bị", "装备"), value: hero.gearNote, max: TEAM_LIMITS.slotNote, onInput: (value) => (hero.gearNote = value) }),
      remove,
    ]);
  }

  function paintHeroes() {
    // `replaceChildren(null)` sẽ chèn chữ "null": chỉ truyền các nút thật.
    heroesSlot.replaceChildren(
      ...draft.heroes.map(heroFieldset),
      ...(draft.heroes.length < TEAM_LIMITS.maxHeroes
        ? [el("button", {
          type: "button",
          class: "ana-btn mt-add-hero",
          onclick: () => {
            draft.heroes.push(emptyHero());
            paintHeroes();
          },
        }, L("+ Thêm tướng", "+ 添加武将"))]
        : []),
    );
  }
  paintHeroes();

  /* ---------- Trường của đội ---------- */

  const groupId = nextId("mt-group");
  const groupSelect = el("select", { class: "ana-input", id: groupId }, groups.map((group) => el("option", { value: group.id }, groupLabel(group))));
  groupSelect.value = groups.some((group) => group.id === draft.groupId) ? draft.groupId : groups[0]?.id ?? "";
  groupSelect.addEventListener("change", () => (draft.groupId = groupSelect.value));
  draft.groupId = groupSelect.value || draft.groupId;

  const replaceId = nextId("mt-replace");
  const replaceSelect = el("select", { class: "ana-input", id: replaceId }, [
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
    saveButton.textContent = L("Lưu lại", "重新保存");
    showAlert(describeFailure(result));
    if (result.conflict) showConflict(result);
  }

  const form = el("form", { class: "mt-editor", novalidate: "", "aria-label": L("Sửa đội", "编辑阵容") }, [
    el("h3", { class: "mt-editor-title" }, L("Sửa đội", "编辑阵容")),
    textField({ label: L("Tên đội", "阵容名称"), value: draft.name, max: TEAM_LIMITS.name, onInput: (value) => (draft.name = value) }),
    textField({ label: L("Hạng", "评级"), value: draft.tierLabel, max: TEAM_LIMITS.tierLabel, onInput: (value) => (draft.tierLabel = value) }),
    textField({ label: L("Mùa", "赛季"), value: draft.seasonId ?? "", max: TEAM_LIMITS.seasonId, onInput: (value) => (draft.seasonId = value || null) }),
    el("div", { class: "mt-field" }, [el("label", { for: groupId }, L("Nhóm", "分组")), groupSelect]),
    el("div", { class: "mt-field" }, [el("label", { for: replaceId }, L("Thay thế cho đội", "替换的阵容")), replaceSelect]),
    heroesSlot,
    ...notesFields.map(([key, label]) => textField({ label, value: draft.notes[key], max: TEAM_LIMITS.notesField, multiline: true, onInput: (value) => (draft.notes[key] = value) })),
    alert,
    conflictSlot,
    el("div", { class: "mt-dialog-actions mt-editor-actions" }, [cancelButton, saveButton]),
  ]);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit();
  });
  cancelButton.addEventListener("click", () => onCancel());
  return form;
}
