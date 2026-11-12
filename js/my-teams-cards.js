// Thẻ đội của "Đội của tôi" (artboard DoiCuaToi `.dct-team`): tên + nguồn/mùa/hạng, link bản gốc, viên trạng thái
// (thiếu món / ráp được / bản gốc cập nhật / thay thế / trùng), bảng tướng như sheet (mobile xếp thẻ theo `data-label`),
// ghi chú, hàng thao tác Sửa · Nhóm · Xóa. Mọi chữ người dùng nhập luôn là text node (`el`).

import { L } from "./i18n.js";
import { missingItems } from "./my-teams-model.js";
import { mtIcon } from "./my-teams-icons.js";
import { groupLabel } from "./my-teams-ui.js";
import { el } from "./render.js";

/** Nhãn nguồn của đội trên dòng phụ dưới tên. */
export const kindLabel = (kind) => ({
  recommended: L("Đội chuẩn", "推荐阵容"),
  legacy: L("Đội khác", "其他阵容"),
  khaihoang: L("Khai hoang", "开荒"),
  analyze: L("Soi đội", "截图识阵"),
  "roster-recommend": L("Gợi ý đội", "武将库配队"),
})[kind] ?? "";

/** Id phần tử của thẻ đội (đích của link trong khối cảnh báo trùng). */
export const teamAnchor = (teamId) => `mt-team-${teamId}`;

const NOTE_LABELS = () => ({ general: L("Ghi chú", "备注"), strengths: L("Điểm mạnh", "优点"), goodAgainst: L("Khắc chế", "克制"), avoid: L("Nên tránh", "避免") });

function pill(kind, iconName, text, extra = {}) {
  const tag = extra.href ? "a" : "span";
  return el(tag, { class: `mt-badge mt-pill mt-pill-${kind}${extra.className ? ` ${extra.className}` : ""}`, href: extra.href ?? null }, [mtIcon(iconName, 13), text]);
}

const missTag = () => el("span", { class: "mt-badge-missing mt-miss" }, L("chưa có trong kho", "库中没有"));
const dash = () => el("span", { class: "mt-dash" }, "—");

/**
 * Bảng tướng của đội.
 * @param nameOf (id, "hero"|"tactic"|"book") → tên hiển thị
 * @param isMissing (type, heroIndex, slotIndex?) → món có thiếu trong kho của hộp không
 */
function teamTable(team, nameOf, isMissing) {
  const join = (list, kind) => list.map((id) => nameOf(id, kind)).join(L(", ", "、"));
  const unresolved = (raw) => (raw ? L(`${raw} (chưa đối chiếu)`, `${raw}（未匹配）`) : "—");
  const cell = (label, children, className = "") => el("td", { dataset: { label } }, [el("div", { class: `mt-cell${className}` }, children)]);

  const rows = team.heroes.map((hero, index) => {
    const heroParts = [
      hero.hero ? el("span", { class: "mt-name" }, nameOf(hero.hero, "hero")) : el("span", { class: "mt-name mt-muted" }, unresolved(hero.rawName)),
      Number.isInteger(hero.redStars) && hero.redStars > 0 ? el("span", { class: "mt-alt mt-stars" }, L(`${hero.redStars}★ đỏ`, `${hero.redStars}★ 红`)) : null,
      isMissing("hero", index) ? missTag() : null,
      hero.heroAlternatives.length ? el("span", { class: "mt-alt" }, L(`hoặc ${join(hero.heroAlternatives, "hero")}`, `或 ${join(hero.heroAlternatives, "hero")}`)) : null,
    ];
    const tactic = (slotIndex) => {
      const slot = hero.tactics[slotIndex];
      const extra = team.userAlternatives.filter((item) => item.heroIndex === index && item.slotIndex === slotIndex).map((item) => item.tactic);
      return cell(L(`Chiến pháp ${slotIndex + 1}`, `战法 ${slotIndex + 1}`), [
        slot.primary ? el("span", { class: "mt-name" }, nameOf(slot.primary, "tactic")) : el("span", { class: "mt-name mt-muted" }, unresolved(slot.rawName)),
        isMissing("tactic", index, slotIndex) ? missTag() : null,
        slot.alternatives.length ? el("span", { class: "mt-alt" }, L(`hoặc ${join(slot.alternatives, "tactic")}`, `或 ${join(slot.alternatives, "tactic")}`)) : null,
        extra.length ? el("span", { class: "mt-alt mt-bu" }, L(`bù: ${join(extra, "tactic")}`, `补：${join(extra, "tactic")}`)) : null,
      ]);
    };
    const books = hero.books.map((id) => nameOf(id, "book")).join(" · ");
    const notes = [hero.troopNote, hero.statNote, hero.gearNote].filter(Boolean).join(" · ");
    return el("tr", { class: "mt-row" }, [
      cell(L("Tướng", "武将"), heroParts),
      tactic(0),
      tactic(1),
      cell(L("Binh thư", "兵书"), [books || (hero.bookType ? null : dash()), hero.bookType ? el("span", { class: "mt-alt" }, hero.bookType) : null], " mt-books"),
      cell(L("Ghi chú", "备注"), [notes || dash()], " mt-notes"),
    ]);
  });
  const heads = [L("Tướng", "武将"), L("Chiến pháp 1", "战法 1"), L("Chiến pháp 2", "战法 2"), L("Binh thư", "兵书"), L("Ghi chú", "备注")];
  return el("div", { class: "mt-table-wrap" }, [
    el("table", { class: "mt-table" }, [
      el("thead", {}, [el("tr", {}, heads.map((text) => el("th", { scope: "col" }, text)))]),
      el("tbody", {}, rows),
    ]),
  ]);
}

/**
 * Một thẻ đội.
 * @param ctx {teams, groups, warnings, owned:Set, groupOf(team), saved:boolean}
 * @param deps {nameOf, sourceHref(team), updated(team), seasonLabel(id), onEdit, onMove(select), onDelete(button), editable}
 */
export function teamCard(team, ctx, deps) {
  const { nameOf } = deps;
  const hasStock = ctx.owned.size > 0;
  // Hộp chưa có kho thì không gắn nhãn "chưa có trong kho" cho mọi món (nhãn vô nghĩa và gây nhiễu).
  const missing = hasStock ? missingItems(team, ctx.owned) : [];
  // "Ráp được" chỉ khi đội đủ dữ liệu để đối chiếu: mọi tướng đã đối chiếu và mọi ô chiến pháp có món chính.
  const complete = team.heroes.length > 0 && team.heroes.every((hero) => hero.slotState === "ok" && hero.tactics.every((slot) => Boolean(slot.primary)));
  const isMissing = (type, heroIndex, slotIndex) => missing.some((item) => item.type === type && item.heroIndex === heroIndex && (slotIndex === undefined || item.slotIndex === slotIndex));
  const dups = ctx.warnings.filter((warning) => warning.a === team.id || warning.b === team.id);
  const replaced = team.replacesTeamId ? ctx.teams.find((other) => other.id === team.replacesTeamId) : null;
  const sourceHref = deps.sourceHref(team);
  const season = team.seasonId ? deps.seasonLabel(team.seasonId) : "";

  const metaParts = [
    el("span", { class: "mt-src" }, kindLabel(team.source.kind)),
    season || team.source.kind === "analyze" ? el("span", { "aria-hidden": "true" }, "·") : null,
    season ? el("span", {}, season) : team.source.kind === "analyze" ? el("span", {}, L("Đọc từ ảnh chiến báo", "从战报截图读取")) : null,
    team.tierLabel ? el("span", { class: "mt-tier" }, team.tierLabel) : null,
  ];

  const otherName = (warning) => ctx.teams.find((candidate) => candidate.id === (warning.a === team.id ? warning.b : warning.a))?.name ?? "?";
  const badges = [
    hasStock && missing.length ? pill("warn", "warn", L(`Thiếu ${missing.length} món trong kho`, `库中缺 ${missing.length} 项`), { className: "mt-badge-short" }) : null,
    hasStock && !missing.length && complete ? pill("good", "check", L("Ráp được", "可组成"), { className: "mt-badge-ready" }) : null,
    deps.updated(team) ? pill("warn", "refresh", L("Bản gốc đã cập nhật", "原版已更新"), { className: "mt-badge-updated" }) : null,
    replaced ? pill("neutral", "swap", L(`Thay thế cho “${replaced.name}”`, `替换“${replaced.name}”`), { className: "mt-badge-replaces" }) : null,
    dups.length === 1 ? pill("accent", "copy", L(`Trùng với “${otherName(dups[0])}”`, `与“${otherName(dups[0])}”重复`), { className: "mt-badge-dup", href: "#mt-dups" }) : null,
    dups.length > 1 ? pill("accent", "copy", L(`Trùng với ${dups.length} đội`, `与 ${dups.length} 个阵容重复`), { className: "mt-badge-dup", href: "#mt-dups" }) : null,
  ].filter(Boolean);

  const moveId = `mt-move-${team.id}`;
  const move = el("select", { class: "ana-input mt-move", id: moveId, "aria-label": L(`Chuyển nhóm cho ${team.name}`, `移动 ${team.name} 的分组`) },
    ctx.groups.map((group) => el("option", { value: group.id }, groupLabel(group))));
  move.value = ctx.groupOf(team).id;
  move.addEventListener("change", () => deps.onMove(team, move));

  const edit = el("button", { type: "button", class: "ana-btn mt-btn", disabled: deps.editable ? null : "", onclick: () => deps.onEdit(team) }, [mtIcon("pencil"), L("Sửa", "编辑")]);
  const remove = el("button", { type: "button", class: "ana-btn mt-btn mt-btn-ghost mt-delete", dataset: { action: "delete-team" } }, [mtIcon("trash"), L("Xóa", "删除")]);
  remove.addEventListener("click", () => deps.onDelete(team, remove));

  return el("article", { class: "mt-team", id: teamAnchor(team.id), dataset: { teamId: team.id } }, [
    el("header", { class: "mt-team-head" }, [
      el("div", { class: "mt-team-title" }, [
        el("h3", { class: "mt-team-name" }, team.name || L("(chưa đặt tên)", "（未命名）")),
        el("p", { class: "mt-team-meta" }, metaParts),
      ]),
      sourceHref
        ? el("a", { class: "mt-source-link", href: sourceHref }, [L("Xem bản gốc", "查看原版"), mtIcon("arrow", 15)])
        : team.source.kind === "analyze" ? el("span", { class: "mt-source-note" }, L("Từ Soi đội · không có bản gốc", "来自截图识阵 · 无原版")) : null,
    ]),
    badges.length ? el("div", { class: "mt-badges" }, badges) : null,
    // Câu báo cho trình đọc màn hình đi qua vùng `role=status` chung của trang; dòng này chỉ để nhìn.
    ctx.saved ? el("p", { class: "mt-saved" }, [mtIcon("check", 15), L("Đã lưu thay đổi.", "已保存更改。")]) : null,
    teamTable(team, nameOf, isMissing),
    ...["general", "strengths", "goodAgainst", "avoid"].filter((key) => team.notes[key]).map((key) =>
      el("p", { class: "mt-note" }, [el("strong", {}, `${NOTE_LABELS()[key]}: `), team.notes[key]])),
    el("footer", { class: "mt-team-actions" }, [edit, el("label", { class: "mt-move-label", for: moveId }, [el("span", {}, L("Nhóm", "分组")), move]), remove]),
  ]);
}
