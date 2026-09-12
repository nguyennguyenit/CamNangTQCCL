import { lookupProfile } from "./lookup-detail.js";

export const LOOKUP_GROUPS = Object.freeze(["heroes", "tactics", "equipment", "advisors", "troop-mods", "buildings"]);
const GROUP_BY_KIND = Object.freeze({
  hero: "heroes", tactic: "tactics", equipment: "equipment", "equipment-special": "equipment",
  advisor: "advisors", "troop-mod": "troop-mods", building: "buildings",
});
const ROUTE_ERRORS = Object.freeze({
  "duplicate-param": "Mỗi tham số tra cứu chỉ được xuất hiện một lần.",
  "unknown-param": "Tra cứu có tham số không được hỗ trợ.",
  "unknown-group": "Nhóm tra cứu không hợp lệ.",
  "id-kind-mismatch": "Mục tra cứu không thuộc nhóm đã chọn.",
  "unknown-id-kind": "Mã mục tra cứu không hợp lệ.",
});

function errorRoute(code) {
  return { section: "lookup", group: null, id: null, alias: null, error: code, messageVi: ROUTE_ERRORS[code] };
}

function groupForId(id) {
  if (typeof id !== "string") return null;
  const separator = id.indexOf(":");
  if (separator <= 0 || !/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/.test(id)) return null;
  return GROUP_BY_KIND[id.slice(0, separator)] ?? null;
}

export function parseLookupRoute(hash) {
  if (hash === "#heroes" || hash === "#tactics") {
    const alias = hash.slice(1);
    return { section: "lookup", group: alias, id: null, alias, error: null, messageVi: null };
  }
  if (hash !== "#lookup" && !hash?.startsWith("#lookup?")) return null;
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  for (const key of params.keys()) if (!['group', 'id'].includes(key)) return errorRoute("unknown-param");
  for (const key of ["group", "id"]) if (params.getAll(key).length > 1) return errorRoute("duplicate-param");
  let group = params.has("group") ? params.get("group") : null;
  const id = params.has("id") ? params.get("id") : null;
  if (group !== null && !LOOKUP_GROUPS.includes(group)) return errorRoute("unknown-group");
  const inferred = id !== null ? groupForId(id) : null;
  if (id !== null && inferred === null) return errorRoute("unknown-id-kind");
  if (group !== null && id !== null && group !== inferred) return errorRoute("id-kind-mismatch");
  if (group === null && inferred) group = inferred;
  return { section: "lookup", group, id, alias: null, error: null, messageVi: null };
}

export function formatLookupHash(route) {
  if (route?.alias === "heroes" || route?.alias === "tactics") return `#${route.alias}`;
  const params = new URLSearchParams();
  if (route?.group) params.set("group", route.group);
  if (route?.id) params.set("id", route.id);
  const query = params.toString();
  return query ? `#lookup?${query}` : "#lookup";
}

function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim();
}

function entry(group, record) {
  const nameVi = String(record.viet ?? record.nameVi ?? record.hanViet ?? "").trim();
  const aliases = [
    ...(Array.isArray(record.aliases) ? record.aliases : []),
    ...(Array.isArray(record.aliasesVi) ? record.aliasesVi : []),
    ...(Array.isArray(record.aliasesZh) ? record.aliasesZh : []),
    record.chinese,
  ].filter((value) => typeof value === "string" && value.length > 0);
  return { id: record.id, group, nameVi, aliases, record };
}

export function buildLookupCorpus({ heroes, tactics, catalog }) {
  const groups = {
    heroes: heroes.map((record) => entry("heroes", record)),
    tactics: tactics.map((record) => entry("tactics", record)),
    equipment: [...catalog.equipment, ...catalog.specials].map((record) => entry("equipment", record)),
    advisors: catalog.advisors.map((record) => entry("advisors", record)),
    "troop-mods": catalog.troopMods.map((record) => entry("troop-mods", record)),
    buildings: catalog.buildings.map((record) => entry("buildings", record)),
  };
  const byId = new Map();
  for (const rows of Object.values(groups)) for (const row of rows) byId.set(row.id, row);
  return { groups, byId, heroes, tactics, catalog };
}

export function searchLookupGroup(corpus, { group = null, query = "", page = 1, pageSize = 60 } = {}) {
  const source = group ? (corpus.groups[group] ?? []) : LOOKUP_GROUPS.flatMap((key) => corpus.groups[key]);
  const needle = normalized(query);
  const matches = needle
    ? source.filter((item) => [item.nameVi, ...item.aliases].some((value) => normalized(value).includes(needle)))
    : source;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const start = (safePage - 1) * pageSize;
  return { items: matches.slice(start, start + pageSize), total: matches.length, page: safePage, hasMore: start + pageSize < matches.length };
}

export function initUnifiedLookup(bundle, mount) {
  const corpus = buildLookupCorpus(bundle);
  let page = 1;
  let query = "";
  let route = parseLookupRoute(location.hash) ?? parseLookupRoute("#lookup");
  let opener = null;
  const labels = {
    heroes: "Tướng", tactics: "Chiến pháp", equipment: "Trang bị",
    advisors: "Quân sư", "troop-mods": "Cải tạo binh chủng", buildings: "Công trình",
  };
  const heading = document.createElement("h2");
  heading.textContent = "Tra cứu";
  const search = document.createElement("input");
  search.type = "search";
  search.className = "search lookup-search";
  search.setAttribute("aria-label", "Tìm trong Tra cứu");
  search.placeholder = "Tìm tên tiếng Việt hoặc tên chữ Hán";
  const chips = document.createElement("div");
  chips.className = "lookup-chips";
  const summary = document.createElement("p");
  summary.className = "lookup-summary";
  summary.dataset.lookupTotal = "0";
  const grid = document.createElement("div");
  grid.className = "lookup-grid";
  const feedback = document.createElement("div");
  feedback.className = "lookup-feedback";
  feedback.setAttribute("aria-live", "polite");
  const detailMount = document.createElement("div");
  detailMount.className = "lookup-detail-mount";
  mount.replaceChildren(heading, search, chips, summary, feedback, grid, detailMount);

  function setRoute(next, { push = true } = {}) {
    route = next;
    const url = new URL(location.href);
    url.hash = formatLookupHash(next);
    history[push ? "pushState" : "replaceState"](history.state, "", url);
    render();
  }
  function closeDialog({ restore = true } = {}) {
    const openerId = opener?.dataset.lookupId;
    detailMount.replaceChildren();
    if (route?.id) setRoute({ ...route, id: null }, { push: false });
    if (restore) {
      const restored = [...grid.querySelectorAll("[data-lookup-id]")].find((button) => button.dataset.lookupId === openerId);
      (restored ?? search).focus();
    }
  }
  function renderDialog(id) {
    const profile = lookupProfile(corpus, id);
    if (!profile) {
      feedback.textContent = "Mục tra cứu đang được cập nhật.";
      feedback.setAttribute("role", "alert");
      return;
    }
    const backdrop = document.createElement("div");
    backdrop.className = "lookup-backdrop";
    const dialog = document.createElement("article");
    dialog.className = "lookup-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.tabIndex = -1;
    const title = document.createElement("h3");
    title.id = "lookup-dialog-title";
    dialog.setAttribute("aria-labelledby", title.id);
    title.textContent = profile.titleVi;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "lookup-close";
    close.textContent = "Đóng";
    close.addEventListener("click", () => closeDialog());
    const body = document.createElement("div");
    body.className = "lookup-profile";
    for (const item of profile.fields) {
      const row = document.createElement("p");
      row.textContent = `${item.labelVi}: ${item.textVi}`;
      body.append(row);
    }
    if (profile.aptitudes.length) {
      const block = document.createElement("section");
      block.innerHTML = "<h4>Thích tính binh chủng</h4>";
      for (const item of profile.aptitudes) {
        const row = document.createElement("p");
        row.textContent = `${item.labelVi}: ${item.textVi}`;
        block.append(row);
      }
      body.append(block);
    }
    for (const section of profile.sections) {
      const block = document.createElement("section");
      const sectionTitle = document.createElement("h4");
      sectionTitle.textContent = section.titleVi;
      block.append(sectionTitle);
      for (const item of section.fields ?? []) {
        const row = document.createElement("p");
        row.textContent = `${item.labelVi}: ${item.textVi}`;
        block.append(row);
      }
      body.append(block);
    }
    for (const relation of profile.relations) {
      if (relation.resolved) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.lookupRelation = relation.targetId;
        button.textContent = `${relation.labelVi}: ${relation.titleVi}`;
        button.addEventListener("click", () => setRoute({ section: "lookup", group: relation.targetGroup, id: relation.targetId, alias: null, error: null }));
        body.append(button);
      } else {
        const row = document.createElement("p");
        row.textContent = `${relation.labelVi}: ${relation.statusVi}`;
        body.append(row);
      }
    }
    const costLabels = { wood: "Gỗ", iron: "Sắt", stone: "Đá", food: "Lương" };
    for (const child of profile.children) {
      const block = document.createElement("section");
      const sectionTitle = document.createElement("h4");
      sectionTitle.textContent = child.titleVi;
      block.append(sectionTitle);
      for (const item of child.items) {
        const linked = corpus.byId.get(item.id);
        if (linked) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = item.titleVi;
          button.addEventListener("click", () => setRoute({ section: "lookup", group: linked.group, id: linked.id, alias: null, error: null }));
          block.append(button);
          continue;
        }
        const row = document.createElement("p");
        const details = [
          item.titleVi ?? `Cấp ${item.level}`,
          item.tierVi,
          item.descriptionVi,
          item.convertsToVi,
          item.costs && Object.entries(item.costs).map(([key, value]) => `${costLabels[key] ?? key}: ${value}`).join(", "),
          item.durationVi,
          item.effectVi,
        ].filter((value) => value && value !== "Đang cập nhật");
        row.textContent = details.join(" · ");
        block.append(row);
      }
      body.append(block);
    }
    if (profile.conditions.length) {
      const block = document.createElement("section");
      block.innerHTML = "<h4>Điều kiện</h4>";
      for (const condition of profile.conditions) {
        const row = document.createElement("p");
        row.textContent = condition;
        block.append(row);
      }
      body.append(block);
    }
    if (profile.revisions.length) {
      const block = document.createElement("section");
      block.innerHTML = "<h4>Lịch sử cập nhật</h4>";
      for (const revision of profile.revisions) {
        const row = document.createElement("p");
        row.textContent = Object.entries(revision)
          .filter(([key, value]) => value && (key.endsWith("Vi") || ["date", "effectiveDate", "version"].includes(key)))
          .map(([, value]) => String(value))
          .join(" · ") || "Đã ghi nhận cập nhật";
        block.append(row);
      }
      body.append(block);
    }
    dialog.append(close, title, body);
    backdrop.append(dialog);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeDialog(); });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...dialog.querySelectorAll("button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")];
      if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    detailMount.replaceChildren(backdrop);
    queueMicrotask(() => close.focus());
  }
  function render() {
    mount.querySelector(".lookup-more")?.remove();
    route = parseLookupRoute(location.hash) ?? route;
    feedback.removeAttribute("role");
    feedback.textContent = "";
    detailMount.replaceChildren();
    chips.replaceChildren();
    for (const group of LOOKUP_GROUPS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fchip lookup-chip";
      button.dataset.group = group;
      button.textContent = labels[group];
      button.setAttribute("aria-pressed", String(route?.group === group));
      button.addEventListener("click", () => { page = 1; setRoute({ section: "lookup", group, id: null, alias: null, error: null }); });
      chips.append(button);
    }
    if (route?.error) {
      grid.replaceChildren();
      summary.dataset.lookupTotal = "0";
      summary.textContent = "";
      feedback.setAttribute("role", "alert");
      feedback.textContent = route.messageVi;
      return;
    }
    const group = route?.group ?? null;
    let result = searchLookupGroup(corpus, { group, query, page: 1 });
    const items = [...result.items];
    for (let current = 2; current <= page && items.length < result.total; current += 1) {
      items.push(...searchLookupGroup(corpus, { group, query, page: current }).items);
    }
    summary.dataset.lookupTotal = String(result.total);
    summary.textContent = `${result.total} kết quả`;
    grid.replaceChildren();
    if (!result.total) {
      feedback.setAttribute("role", "status");
      feedback.textContent = "Không có kết quả phù hợp.";
    }
    for (const item of items) {
      const card = document.createElement("article");
      card.className = "lookup-card";
      if (item.record.iconUrl) {
        const image = document.createElement("img");
        image.src = item.record.iconUrl;
        image.alt = "";
        image.loading = "lazy";
        card.append(image);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lookupId = item.id;
      button.textContent = item.nameVi;
      button.addEventListener("click", () => {
        opener = button;
        setRoute({ section: "lookup", group, id: item.id, alias: null, error: null });
      });
      card.append(button);
      grid.append(card);
    }
    if (items.length < result.total) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "lookup-more";
      more.textContent = "Xem thêm";
      more.addEventListener("click", () => { page += 1; render(); });
      grid.after(more);
    } else {
      mount.querySelector(".lookup-more")?.remove();
    }
    if (route?.id) renderDialog(route.id);
  }
  search.addEventListener("input", () => { query = search.value; page = 1; render(); });
  window.addEventListener("hashchange", () => { page = 1; render(); });
  window.addEventListener("popstate", () => { page = 1; render(); });
  render();
  return { corpus, render };
}
