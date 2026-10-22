// Trang Đội của tôi (`/doi-cua-toi/`, `/zh/doi-cua-toi/`): bắt buộc đăng nhập; hộp → nhóm → đội. Dữ liệu là bản sao riêng của
// người dùng (js/my-teams-api.js trên `/api/roster`), không có chế độ offline. Mọi chữ người dùng nhập luôn là text node.
// Khách chỉ thấy lời mời đăng nhập và KHÔNG gọi `/api/roster`.

import { L, currentLocale } from "./i18n.js";
import { loadSession, signInPrompt, describeError, unavailableNotice } from "./community-api.js";
import { createTeamLexicon, loadTeamBooks, loadTeamDictionaries, recordLabel } from "./community-team-data.js";
import { createTeamEditor } from "./my-teams-editor.js";
import { createSourceLinker, loadSourceIndex } from "./my-teams-links.js";
import { duplicateWarnings, missingItems } from "./my-teams-model.js";
import { boxLabel, defaultGroupsOf, describeFailure, groupLabel, myTeamsApi, onMyTeamsChange, openDialog } from "./my-teams-ui.js";
import { bookRowId } from "./lookup-ids.js";
import { buildCatalog } from "./roster-picker.js";
import { el } from "./render.js";
import { setTeamRouteHandlesFromJSON } from "./team-detail-navigation.js";

const MAIN_BOX = "main";

async function loadNames(locale) {
  try {
    const [{ heroes, tactics }, books] = await Promise.all([loadTeamDictionaries(), loadTeamBooks()]);
    const lexicon = createTeamLexicon({ heroes, tactics, books }, locale);
    const bookIndex = new Map(books.map((book) => [bookRowId(book), book]));
    return {
      ready: true,
      names: {
        hero: (id) => lexicon.heroName(id),
        tactic: (id) => lexicon.tacticName(id),
        book: (id) => recordLabel(bookIndex.get(id), locale) || String(id),
      },
      catalog: buildCatalog({ heroesDict: heroes, tacticsDict: tactics, books }, "editor"),
    };
  } catch {
    return { ready: false, names: { hero: String, tactic: String, book: String }, catalog: [] };
  }
}

export async function initMyTeams(mount = document.getElementById("my-teams")) {
  if (!mount) return null;
  const locale = currentLocale();

  let user;
  try {
    user = await loadSession({ probe: true });
  } catch {
    mount.replaceChildren(unavailableNotice());
    return null;
  }
  if (!user) {
    mount.replaceChildren(signInPrompt(L("Đăng nhập để xem và sửa các đội bạn đã lưu. Đội được lưu theo tài khoản nên dùng được trên mọi máy.", "登录后即可查看并修改已保存的阵容。阵容按账号保存，可在任何设备上使用。")));
    return null;
  }

  // Bảng route đầy đủ {r, l, k} của trang (layout chỉ nhúng {l}): dựng link nguồn cho mọi họ đội.
  const routesText = document.getElementById("my-teams-routes")?.textContent ?? "";
  setTeamRouteHandlesFromJSON(routesText);
  let tables = {};
  try {
    tables = JSON.parse(routesText);
  } catch {
    tables = {};
  }
  const linker = createSourceLinker(tables);

  const view = { boxId: MAIN_BOX, editing: null, status: "" };
  let api;
  let lexicon;
  let sourceIndex = null;

  const status = el("p", { class: "mt-status", role: "status", "aria-live": "polite", hidden: "" });
  const errorBox = el("p", { class: "mt-alert", role: "alert", hidden: "" });
  const body = el("div", { class: "mt-body" });
  const say = (message) => {
    status.textContent = message;
    status.hidden = !message;
  };
  const fail = (result) => {
    errorBox.textContent = describeFailure(result);
    errorBox.hidden = false;
  };
  const clearMessages = () => {
    errorBox.hidden = true;
    errorBox.textContent = "";
    say("");
  };

  /** Chạy một thao tác `api.*`; thành công thì vẽ lại, thất bại thì nêu lý do bằng `role="alert"`. */
  async function run(operation, success) {
    clearMessages();
    const result = await operation();
    if (!result.ok) {
      fail(result);
      return result;
    }
    if (success) say(success(result));
    paint();
    return result;
  }

  /* ---------- Hộp thoại nhập tên / xác nhận ---------- */

  function promptDialog({ title, label, value = "", confirmLabel, submit }) {
    const input = el("input", { class: "ana-input mt-input", type: "text", id: "mt-prompt-input", autocomplete: "off" });
    input.value = value;
    const alert = el("p", { class: "mt-alert", role: "alert", hidden: "" });
    const confirm = el("button", { type: "submit", class: "ana-btn primary" }, confirmLabel);
    const cancel = el("button", { type: "button", class: "ana-btn" }, L("Hủy", "取消"));
    const form = el("form", { class: "mt-prompt", novalidate: "" }, [
      el("div", { class: "mt-field" }, [el("label", { for: "mt-prompt-input" }, label), input]),
      alert,
      el("div", { class: "mt-dialog-actions" }, [cancel, confirm]),
    ]);
    const { close } = openDialog({ title, body: form });
    cancel.addEventListener("click", close);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      confirm.disabled = true;
      const result = await submit(input.value);
      if (result.ok) {
        close();
        return;
      }
      alert.textContent = describeFailure(result);
      alert.hidden = false;
      confirm.disabled = false;
    });
    input.focus();
    input.select();
  }

  function confirmDialog({ title, message, confirmLabel, onConfirm }) {
    const alert = el("p", { class: "mt-alert", role: "alert", hidden: "" });
    const confirm = el("button", { type: "button", class: "ana-btn mt-danger" }, confirmLabel);
    const cancel = el("button", { type: "button", class: "ana-btn" }, L("Hủy", "取消"));
    const { close } = openDialog({
      title,
      body: el("div", { class: "mt-confirm" }, [el("p", {}, message), alert, el("div", { class: "mt-dialog-actions" }, [cancel, confirm])]),
    });
    cancel.addEventListener("click", close);
    confirm.addEventListener("click", async () => {
      confirm.disabled = true;
      const result = await onConfirm();
      if (result.ok) {
        close();
        return;
      }
      alert.textContent = describeFailure(result);
      alert.hidden = false;
      confirm.disabled = false;
    });
    cancel.focus();
  }

  /* ---------- Thẻ đội ---------- */

  const nameOf = (id, kind) => lexicon.names[kind](id);

  function heroCell(hero, missing) {
    const cell = el("td", { class: "mt-cell", dataset: { label: L("Tướng", "武将") } });
    if (hero.hero) cell.append(el("span", { class: "mt-name" }, nameOf(hero.hero, "hero")));
    else cell.append(el("span", { class: "mt-name mt-muted" }, hero.rawName ? L(`${hero.rawName} (chưa đối chiếu)`, `${hero.rawName}（未匹配）`) : "—"));
    if (hero.redStars) cell.append(el("span", { class: "mt-stars" }, ` ${hero.redStars}★`));
    if (missing) cell.append(el("span", { class: "mt-badge mt-badge-missing" }, L("chưa có trong kho", "库中没有")));
    if (hero.heroAlternatives.length) {
      cell.append(el("span", { class: "mt-alt" }, L(`hoặc ${hero.heroAlternatives.map((id) => nameOf(id, "hero")).join(", ")}`, `或 ${hero.heroAlternatives.map((id) => nameOf(id, "hero")).join("、")}`)));
    }
    return cell;
  }

  function tacticCell(team, heroIndex, slotIndex, missing) {
    const slot = team.heroes[heroIndex].tactics[slotIndex];
    const cell = el("td", { class: "mt-cell", dataset: { label: L(`Chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1}`) } });
    if (slot.primary) cell.append(el("span", { class: "mt-name" }, nameOf(slot.primary, "tactic")));
    else cell.append(el("span", { class: "mt-name mt-muted" }, slot.rawName ? L(`${slot.rawName} (chưa đối chiếu)`, `${slot.rawName}（未匹配）`) : "—"));
    if (missing) cell.append(el("span", { class: "mt-badge mt-badge-missing" }, L("chưa có trong kho", "库中没有")));
    const alternatives = [...slot.alternatives];
    if (alternatives.length) cell.append(el("span", { class: "mt-alt" }, L(`hoặc ${alternatives.map((id) => nameOf(id, "tactic")).join(", ")}`, `或 ${alternatives.map((id) => nameOf(id, "tactic")).join("、")}`)));
    const extra = team.userAlternatives.filter((item) => item.heroIndex === heroIndex && item.slotIndex === slotIndex);
    if (extra.length) cell.append(el("span", { class: "mt-alt" }, L(`bù: ${extra.map((item) => nameOf(item.tactic, "tactic")).join(", ")}`, `补：${extra.map((item) => nameOf(item.tactic, "tactic")).join("、")}`)));
    return cell;
  }

  function teamTable(team, owned) {
    // Hộp chưa có kho nào để đối chiếu thì không gắn nhãn "chưa có trong kho" cho mọi món (nhãn vô nghĩa và gây nhiễu).
    const missing = owned.size ? missingItems(team, owned) : [];
    const isMissing = (type, heroIndex, slotIndex) => missing.some((item) => item.type === type && item.heroIndex === heroIndex && (slotIndex === undefined || item.slotIndex === slotIndex));
    const rows = team.heroes.map((hero, index) => {
      const books = hero.books.map((id) => nameOf(id, "book"));
      const notes = [hero.troopNote, hero.statNote, hero.gearNote].filter(Boolean);
      return el("tr", { class: "mt-row" }, [
        heroCell(hero, isMissing("hero", index)),
        tacticCell(team, index, 0, isMissing("tactic", index, 0)),
        tacticCell(team, index, 1, isMissing("tactic", index, 1)),
        el("td", { class: "mt-cell", dataset: { label: L("Binh thư", "兵书") } }, [books.join(", ") || (hero.bookType ? "" : "—"), hero.bookType ? el("span", { class: "mt-alt" }, hero.bookType) : null]),
        el("td", { class: "mt-cell mt-cell-notes", dataset: { label: L("Ghi chú", "备注") } }, notes.join(" · ") || "—"),
      ]);
    });
    return el("table", { class: "mt-table" }, [
      el("thead", {}, [el("tr", {}, [L("Tướng", "武将"), L("Chiến pháp 1", "战法 1"), L("Chiến pháp 2", "战法 2"), L("Binh thư", "兵书"), L("Ghi chú", "备注")].map((text) => el("th", { scope: "col" }, text)))]),
      el("tbody", {}, rows),
    ]);
  }

  function teamCard(team, ctx) {
    const sourceHref = linker.href(team.source, locale);
    const indexed = sourceIndex?.[`${team.source.kind}:${team.source.key}`];
    const updated = Boolean(team.source.contentHash) && typeof indexed === "string" && indexed !== team.source.contentHash;
    const dups = ctx.warnings.filter((warning) => warning.a === team.id || warning.b === team.id);
    const replaced = team.replacesTeamId ? ctx.teams.find((other) => other.id === team.replacesTeamId) : null;

    const badges = [
      updated ? el("span", { class: "mt-badge mt-badge-updated" }, L("Bản gốc đã cập nhật", "原版已更新")) : null,
      ...dups.map((warning) => {
        const other = ctx.teams.find((candidate) => candidate.id === (warning.a === team.id ? warning.b : warning.a));
        const what = [...warning.heroes.map((id) => nameOf(id, "hero")), ...warning.tactics.map((id) => nameOf(id, "tactic"))].join(", ");
        return el("span", { class: "mt-badge mt-badge-dup" }, L(`Trùng với “${other?.name ?? "?"}”: ${what}`, `与“${other?.name ?? "?"}”重复：${what}`));
      }),
      replaced ? el("span", { class: "mt-badge" }, L(`Thay thế cho “${replaced.name}”`, `替换“${replaced.name}”`)) : null,
    ].filter(Boolean);

    const moveId = `mt-move-${team.id}`;
    const move = el("select", { class: "ana-input mt-move", id: moveId, "aria-label": L(`Chuyển nhóm cho ${team.name}`, `移动 ${team.name} 的分组`) },
      ctx.groups.map((group) => el("option", { value: group.id }, groupLabel(group))));
    move.value = ctx.groupOf(team).id;
    move.addEventListener("change", () => run(() => api.moveTeam(team.id, move.value), () => L("Đã chuyển nhóm.", "已移动分组。")).then((result) => { if (!result.ok) move.value = ctx.groupOf(team).id; }));

    const edit = el("button", { type: "button", class: "ana-btn", disabled: lexicon.ready ? null : "", onclick: () => openEditor(team) }, L("Sửa", "编辑"));
    const remove = el("button", {
      type: "button",
      class: "roster-ghost mt-delete",
      onclick: () => confirmDialog({
        title: L("Xóa đội?", "删除阵容？"),
        message: L(`Xóa “${team.name}” khỏi Đội của tôi? Việc này không hoàn tác được.`, `从“我的阵容”中删除“${team.name}”？此操作无法撤销。`),
        confirmLabel: L("Xóa đội", "删除阵容"),
        onConfirm: async () => {
          const result = await api.deleteTeam(team.id);
          if (result.ok) {
            say(L("Đã xóa đội.", "已删除阵容。"));
            paint();
          }
          return result;
        },
      }),
    }, L("Xóa", "删除"));

    return el("article", { class: "mt-team", dataset: { teamId: team.id } }, [
      el("header", { class: "mt-team-head" }, [
        el("h4", { class: "mt-team-name" }, team.name || L("(chưa đặt tên)", "（未命名）")),
        team.tierLabel ? el("span", { class: "mt-tier" }, team.tierLabel) : null,
        sourceHref
          ? el("a", { class: "mt-source-link", href: sourceHref }, L("Xem bản gốc", "查看原版"))
          : team.source.kind === "analyze" ? el("span", { class: "mt-source-note" }, L("Từ Soi đội", "来自阵容分析")) : null,
      ]),
      badges.length ? el("div", { class: "mt-badges" }, badges) : null,
      teamTable(team, ctx.owned),
      ...["general", "strengths", "goodAgainst", "avoid"].filter((key) => team.notes[key]).map((key) =>
        el("p", { class: "mt-note" }, [el("strong", {}, `${{ general: L("Ghi chú", "备注"), strengths: L("Điểm mạnh", "优点"), goodAgainst: L("Khắc chế", "克制"), avoid: L("Nên tránh", "避免") }[key]}: `), team.notes[key]])),
      el("footer", { class: "mt-team-actions" }, [edit, el("label", { class: "mt-move-label", for: moveId }, [el("span", {}, L("Nhóm", "分组")), move]), remove]),
    ]);
  }

  /* ---------- Danh sách ---------- */

  function paint() {
    if (view.editing) return;
    const snapshot = api.snapshot();
    const boxes = snapshot.boxes.length ? snapshot.boxes : [{ id: MAIN_BOX, name: "Hộp chính" }];
    if (!boxes.some((box) => box.id === view.boxId)) view.boxId = MAIN_BOX;
    const box = boxes.find((candidate) => candidate.id === view.boxId);
    const groups = snapshot.groups.filter((group) => group.boxId === view.boxId);
    const shownGroups = groups.length ? groups : defaultGroupsOf(view.boxId);
    const teams = snapshot.teams.filter((team) => team.boxId === view.boxId);
    const warnings = duplicateWarnings(teams);
    const owned = snapshot.owned.get(view.boxId) ?? new Set();
    const fallback = shownGroups.find((group) => group.id === `${view.boxId}~ghep-team`) ?? shownGroups[shownGroups.length - 1];
    const groupOf = (team) => shownGroups.find((group) => group.id === team.groupId) ?? fallback;
    const ctx = { teams, groups: shownGroups, warnings, owned, groupOf };

    const boxSelect = el("select", { class: "ana-input", id: "mt-box", "aria-label": L("Chọn hộp", "选择仓库") }, boxes.map((item) => el("option", { value: item.id }, boxLabel(item))));
    boxSelect.value = view.boxId;
    boxSelect.addEventListener("change", () => {
      view.boxId = boxSelect.value;
      paint();
    });

    const toolbar = el("div", { class: "mt-toolbar" }, [
      el("label", { class: "mt-box-label", for: "mt-box" }, L("Hộp", "仓库")),
      boxSelect,
      el("button", { type: "button", class: "ana-btn", dataset: { action: "create-box" }, onclick: () => promptDialog({
        title: L("Tạo hộp", "新建仓库"),
        label: L("Tên hộp", "仓库名称"),
        confirmLabel: L("Tạo hộp", "新建"),
        submit: async (name) => {
          const result = await api.createBox(name);
          if (result.ok) {
            view.boxId = result.boxId;
            say(L("Đã tạo hộp.", "已新建仓库。"));
            paint();
          }
          return result;
        },
      }) }, L("Tạo hộp", "新建仓库")),
      el("button", { type: "button", class: "ana-btn", dataset: { action: "rename-box" }, onclick: () => promptDialog({
        title: L("Đổi tên hộp", "重命名仓库"),
        label: L("Tên hộp", "仓库名称"),
        value: boxLabel(box),
        confirmLabel: L("Lưu tên", "保存名称"),
        submit: async (name) => {
          const result = await api.renameBox(box.id, name);
          if (result.ok) paint();
          return result;
        },
      }) }, L("Đổi tên hộp", "重命名")),
      box.id === MAIN_BOX ? null : el("button", { type: "button", class: "roster-ghost mt-delete", dataset: { action: "delete-box" }, onclick: () => confirmDialog({
        title: L("Xóa hộp?", "删除仓库？"),
        message: L(`Xóa hộp “${box.name}” sẽ mất ${teams.length} đội, các nhóm và kho của hộp này. Không hoàn tác được.`, `删除仓库“${box.name}”将同时失去 ${teams.length} 个阵容及该仓库的分组和库存，且无法撤销。`),
        confirmLabel: L("Xóa hộp", "删除仓库"),
        onConfirm: async () => {
          const result = await api.deleteBox(box.id);
          if (result.ok) {
            view.boxId = MAIN_BOX;
            say(L("Đã xóa hộp.", "已删除仓库。"));
            paint();
          }
          return result;
        },
      }) }, L("Xóa hộp", "删除仓库")),
    ]);

    const notices = [];
    if (!lexicon.ready) notices.push(el("p", { class: "mt-notice", role: "status" }, L("Chưa tải được danh mục tướng và chiến pháp: tên hiện tạm dưới dạng mã và chưa thể sửa đội.", "未能加载武将与战法图鉴：名称暂以编号显示，暂时无法编辑阵容。")));
    const skipped = snapshot.skipped.filter((item) => item.boxId === view.boxId);
    if (skipped.length) notices.push(el("p", { class: "mt-notice", role: "status", dataset: { skipped: String(skipped.length) } }, L(`${skipped.length} bản ghi đội bị hỏng nên không hiển thị; các đội khác không bị ảnh hưởng.`, `${skipped.length} 条阵容记录已损坏，未显示；其他阵容不受影响。`)));
    if (snapshot.rejected.length) notices.push(el("p", { class: "mt-alert", role: "alert" }, L(`${snapshot.rejected.length} thay đổi bị máy chủ từ chối: ${describeFailure({ code: snapshot.rejected[0].code })}`, `${snapshot.rejected.length} 项更改被服务器拒绝：${describeFailure({ code: snapshot.rejected[0].code })}`)));
    if (warnings.length) {
      notices.push(el("section", { class: "mt-dups", "aria-label": L("Cảnh báo trùng", "重复提醒") }, [
        el("p", { class: "mt-dups-title" }, L("Một số đội trùng tướng hoặc chiến pháp chính trong cùng hộp:", "同一仓库内部分阵容的武将或主战法重复：")),
        el("ul", {}, warnings.map((warning) => {
          const a = teams.find((team) => team.id === warning.a);
          const b = teams.find((team) => team.id === warning.b);
          const what = [...warning.heroes.map((id) => nameOf(id, "hero")), ...warning.tactics.map((id) => nameOf(id, "tactic"))].join(", ");
          return el("li", {}, L(`“${a?.name}” và “${b?.name}”: ${what}`, `“${a?.name}”与“${b?.name}”：${what}`));
        })),
      ]));
    }

    const sections = shownGroups.map((group) => {
      const own = teams.filter((team) => groupOf(team).id === group.id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      const isDefault = /~(?:khai-hoang|ghep-team)$/u.test(group.id);
      return el("section", { class: "mt-group", dataset: { groupId: group.id }, "aria-label": groupLabel(group) }, [
        el("header", { class: "mt-group-head" }, [
          el("h3", { class: "mt-group-name" }, `${groupLabel(group)} `),
          el("span", { class: "mt-count" }, `(${own.length})`),
          isDefault ? null : el("button", { type: "button", class: "roster-ghost", dataset: { action: "rename-group" }, onclick: () => promptDialog({
            title: L("Đổi tên nhóm", "重命名分组"),
            label: L("Tên nhóm", "分组名称"),
            value: group.name,
            confirmLabel: L("Lưu tên", "保存名称"),
            submit: async (name) => {
              const result = await api.renameGroup(group.id, name);
              if (result.ok) paint();
              return result;
            },
          }) }, L("Đổi tên", "重命名")),
          isDefault ? null : el("button", { type: "button", class: "roster-ghost mt-delete", dataset: { action: "delete-group" }, onclick: () => confirmDialog({
            title: L("Xóa nhóm?", "删除分组？"),
            message: L(`Xóa nhóm “${group.name}”? ${own.length} đội trong nhóm sẽ chuyển về Ghép Team.`, `删除分组“${group.name}”？组内 ${own.length} 个阵容将移至“组队”。`),
            confirmLabel: L("Xóa nhóm", "删除分组"),
            onConfirm: async () => {
              const result = await api.deleteGroup(group.id);
              if (result.ok) {
                say(L("Đã xóa nhóm.", "已删除分组。"));
                paint();
              }
              return result;
            },
          }) }, L("Xóa nhóm", "删除分组")),
        ]),
        own.length ? el("div", { class: "mt-teams" }, own.map((team) => teamCard(team, ctx))) : el("p", { class: "mt-empty" }, L("Chưa có đội trong nhóm này.", "此分组暂无阵容。")),
      ]);
    });

    const groupInput = el("input", { class: "ana-input mt-input", type: "text", id: "mt-new-group", autocomplete: "off" });
    const addGroup = el("form", { class: "mt-add-group", novalidate: "" }, [
      el("label", { for: "mt-new-group" }, L("Thêm nhóm", "添加分组")),
      groupInput,
      el("button", { type: "submit", class: "ana-btn" }, L("Thêm nhóm", "添加分组")),
    ]);
    addGroup.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = await run(() => api.createGroup(view.boxId, groupInput.value), () => L("Đã thêm nhóm.", "已添加分组。"));
      if (result.ok) groupInput.value = "";
    });

    const total = teams.length;
    body.replaceChildren(...[
      toolbar,
      ...notices,
      total === 0 ? el("p", { class: "mt-empty mt-empty-all" }, L("Hộp này chưa có đội. Bấm “Lưu vào đội của tôi” ở Đội chuẩn, Đội khác, Khai hoang, Gợi ý đội hoặc Soi đội để thêm.", "此仓库还没有阵容。在标准阵容、其他阵容、开荒、阵容推荐或阵容分析中点击“保存到我的阵容”即可添加。")) : null,
      ...sections,
      addGroup,
    ].filter(Boolean));
  }

  /* ---------- Trình soạn ---------- */

  function openEditor(team) {
    const snapshot = api.snapshot();
    const groups = snapshot.groups.filter((group) => group.boxId === team.boxId);
    view.editing = team.id;
    clearMessages();
    const leave = () => {
      view.editing = null;
      paint();
      body.querySelector(`[data-team-id="${CSS.escape(team.id)}"] .mt-team-actions button`)?.focus();
    };
    const form = createTeamEditor({
      team,
      teams: snapshot.teams.filter((other) => other.boxId === team.boxId),
      groups: groups.length ? groups : defaultGroupsOf(team.boxId),
      names: lexicon.names,
      catalog: lexicon.catalog,
      save: (candidate) => api.saveTeam(candidate, { boxId: team.boxId, groupId: candidate.groupId }),
      onSaved: () => {
        say(L("Đã lưu thay đổi.", "已保存更改。"));
        leave();
      },
      onCancel: leave,
      onKeepServer: () => {
        say(L("Đã giữ bản trên máy chủ.", "已保留服务器版本。"));
        leave();
      },
    });
    body.replaceChildren(form);
    form.querySelector("input")?.focus();
  }

  /* ---------- Khởi động ---------- */

  mount.replaceChildren(el("p", { class: "mt-loading", role: "status" }, L("Đang tải đội của bạn…", "正在加载你的阵容…")));
  try {
    api = await myTeamsApi();
    const [loaded, names, index] = await Promise.all([api.load(), loadNames(locale), loadSourceIndex()]);
    lexicon = names;
    sourceIndex = index;
    if (loaded.status === "guest" || loaded.status === "signed-out") {
      mount.replaceChildren(signInPrompt(L("Phiên đăng nhập đã hết. Hãy đăng nhập lại.", "登录已失效，请重新登录。")));
      return null;
    }
    // Hộp chính + hai nhóm mặc định luôn có trước khi vẽ (idempotent, cùng request với lần lưu đầu).
    await api.ensureBoxDefaults(MAIN_BOX);
  } catch (error) {
    mount.replaceChildren(el("p", { class: "mt-alert", role: "alert" }, describeError(error)));
    return null;
  }
  mount.replaceChildren(status, errorBox, body);
  paint();
  onMyTeamsChange(() => paint());
  return { paint };
}

initMyTeams();
