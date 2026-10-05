// Trang nhóm Tra cứu `/tra-cuu/<slug>/` (artboard Lookup/LookupTactics/LookupMobile và 4 nhóm catalog): gắn vào khung do
// build dựng sẵn (ô tìm, dòng trạng thái, lưới mục đầu), rồi sở hữu tìm kiếm, "Xem thêm", hồ sơ theo `?id=`,
// lịch sử và focus. Payload hồ sơ cần thêm (quan hệ sang nhóm khác) tải lười ở lần mở hồ sơ đầu tiên.
// Tướng, chiến pháp và binh thư mở hồ sơ bằng hộp thoại; Trang bị, Quân sư, Cải tạo binh chủng và Công trình là
// danh sách + panel chi tiết (`js/lookup-master.js`), chi tiết hiện cạnh danh sách (desktop) hoặc thành màn riêng (mobile).

import { el } from "./render.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { lookupProfilePath } from "./lookup-ids.js";
import { treeToDom } from "./view-tree.js";
import { activatePortraits } from "./hero-portrait.js";
import { createHeroSummaryLoader } from "./hero-summaries.js";
import { createTacticSummaryLoader } from "./tactic-summaries.js";
import { isNativeNavigationClick } from "./team-detail-navigation.js";
import { createProfileRenderer } from "./lookup-profile.js";
import { isMasterGroup, masterDefaultId, masterDetailTree, masterFilterMatches, masterTargetFor } from "./lookup-master.js";
import {
  buildLookupCorpus,
  lookupMoreTrees,
  lookupOrderNote,
  lookupPageSize,
  lookupResultTrees,
  lookupSummaryTrees,
  lookupTableRowTree,
  parseLookupQuery,
  searchLookupGroup,
} from "./unified-lookup.js";

const required = (mount, selector) => {
  const node = mount.querySelector(selector);
  if (!node) throw new Error(`Khung Tra cứu thiếu ${selector}`);
  return node;
};

/**
 * - `docs`: payload đã tải lúc vào trang (`{heroes?, tactics?, catalog?, books?, bookAliases?}`).
 * - `loadProfileDocs()`: payload hồ sơ cần thêm (promise có cache; lỗi thì hồ sơ vẫn mở, quan hệ để trạng thái chờ).
 * - `summary`: tùy chọn của `createHeroSummaryLoader` (trang Tướng) hoặc `createTacticSummaryLoader` (trang Chiến pháp).
 * - `loadRawNames()`: bộ tra tên Hán cho khối "Trong cẩm nang" bản zh (`null` ở bản Việt).
 */
export function initLookupPage({ group, mount, docs, loadProfileDocs = async () => ({}), summary = null, loadRawNames = async () => null }) {
  const search = required(mount, ".lookup-search-input");
  const summaryLine = required(mount, ".lookup-summary");
  const orderNote = required(mount, ".lookup-order-note");
  const feedback = required(mount, ".lookup-feedback");
  const grid = required(mount, ".lookup-grid");
  const more = required(mount, ".lookup-more-row");
  const detailMount = required(mount, ".lookup-detail-mount");
  const master = isMasterGroup(group);
  const panel = master ? required(mount, "[data-lookup-panel]") : null;
  const filtersBar = master ? required(mount, ".lookup-filters") : null;
  const pageSize = lookupPageSize(group);
  let profileDocs = null;
  let profileReady = false;
  // Đã thử tải payload hồ sơ (thành công hay lỗi): danh sách/chi tiết catalog chờ tới lúc này để có tên tướng.
  let profileSettled = false;
  let corpus = buildLookupCorpus(docs);
  const summaries = !summary ? null : group === "tactics" ? createTacticSummaryLoader(summary) : createHeroSummaryLoader(summary);
  let query = search.value;
  let page = 1;
  let route = parseLookupQuery(location.search, group);
  let opener = null;
  let dialogToken = 0;
  // Đóng hồ sơ bằng history.go(): lượt render của popstate kế tiếp phải trả focus về thẻ đã mở.
  let restoreAfterPop = false;
  // Bốn nhóm catalog: bộ lọc chip đang chọn (`{khóa: giá trị}`), mục đang tô trong danh sách và màn chi tiết đang mở (mobile).
  let filters = {};
  let listSelectedId = null;
  let detailWasOpen = false;
  let rendered = false;
  const filterFn = master ? (item) => masterFilterMatches(group, item.record ?? {}, filters) : null;

  /** Payload hồ sơ: tải một lần, dựng lại corpus khi về tới; lỗi tải không chặn mở hồ sơ. */
  function ensureProfileDocs() {
    if (!profileDocs) {
      profileDocs = Promise.resolve()
        .then(() => loadProfileDocs())
        .then((extra) => { corpus = buildLookupCorpus({ ...docs, ...extra }); profileReady = true; })
        .catch((error) => { profileDocs = null; console.error(error); })
        .finally(() => { profileSettled = true; });
    }
    return profileDocs;
  }

  const renderProfile = createProfileRenderer({
    group,
    openInPage: (id) => setRoute(id),
    onClose: () => closeDialog(),
    summaries,
    rawNames: loadRawNames,
  });

  /**
   * Số bước lịch sử hồ sơ đã push trong phiên (hồ sơ → hồ sơ liên quan → …) ghi ở `history.state`;
   * 0 khi hồ sơ mở bằng deep link hoặc không có hồ sơ.
   */
  function dialogDepth() {
    const depth = history.state?.lookupDialogDepth;
    return route?.id && Number.isSafeInteger(depth) && depth > 0 ? depth : 0;
  }

  /** `history.state` hiện có, thay đúng khóa `lookupDialogDepth` (0 = bỏ khóa), giữ khóa của nơi khác. */
  function stateWithDepth(depth) {
    const { lookupDialogDepth, ...rest } = history.state && typeof history.state === "object" ? history.state : {};
    if (depth > 0) return { ...rest, lookupDialogDepth: depth };
    return Object.keys(rest).length ? rest : null;
  }

  /** Hồ sơ là query của trang: giữ mọi khóa khác, chỉ thay `id`. */
  function setRoute(id, { push = true } = {}) {
    const state = push ? stateWithDepth(id ? dialogDepth() + 1 : 0) : history.state;
    const url = new URL(location.href);
    url.searchParams.delete("id");
    if (id) url.searchParams.set("id", id);
    history[push ? "pushState" : "replaceState"](state, "", url);
    render();
  }

  function clearDialog() {
    dialogToken += 1;
    detailMount.replaceChildren();
    document.documentElement.classList.remove("lookup-dialog-open");
  }

  /**
   * Hồ sơ mở bằng push trong phiên: đóng là lùi đúng số bước đã push, để một lần Back sau đó về trạng thái
   * trước khi mở. Hồ sơ mở bằng deep link: bỏ `id` tại chỗ bằng replaceState.
   */
  function closeDialog() {
    const depth = dialogDepth();
    clearDialog();
    if (depth > 0) {
      restoreAfterPop = true;
      history.go(-depth);
      return;
    }
    if (route?.id) setRoute(null, { push: false });
    else render();
    restoreOpenerFocus();
  }
  function showDialog(id) {
    clearDialog();
    const token = dialogToken;
    const isCurrent = () => token === dialogToken;
    const pending = !profileReady;
    if (pending) {
      feedback.removeAttribute("role");
      feedback.textContent = L("Đang tải hồ sơ…", "正在加载详情…");
    }
    ensureProfileDocs().then(() => {
      if (!isCurrent()) return;
      if (pending) feedback.textContent = "";
      const built = renderProfile(corpus, id, isCurrent);
      if (!built) {
        feedback.textContent = L("Mục tra cứu đang được cập nhật.", "该条目正在更新。");
        feedback.setAttribute("role", "alert");
        return;
      }
      const { dialog, close } = built;
      const backdrop = el("div", { class: "lookup-backdrop" }, [dialog]);
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
      activatePortraits(dialog);
      detailMount.replaceChildren(backdrop);
      document.documentElement.classList.add("lookup-dialog-open");
      queueMicrotask(() => close.focus());
    });
  }

  /** Link hồ sơ trong các nút vừa dựng (thẻ, hàng danh sách hoặc tên trong bảng chiến pháp): click thường mở hồ sơ tại chỗ, click có phím bổ trợ để trình duyệt mở tab mới. */
  function wire(nodes) {
    for (const node of nodes) {
      activatePortraits(node);
      const links = [...(node.matches?.("[data-lookup-id]") ? [node] : []), ...(node.querySelectorAll?.("[data-lookup-id]") ?? [])];
      for (const link of links) {
        link.addEventListener("click", (event) => {
          if (!isNativeNavigationClick(event)) return;
          event.preventDefault();
          opener = link;
          setRoute(link.dataset.lookupId);
        });
      }
    }
    return nodes;
  }

  function renderMore(shownCount, total) {
    const nodes = lookupMoreTrees(shownCount, total, undefined, pageSize).map((tree) => treeToDom(tree));
    nodes.find((node) => node.classList.contains("lookup-more"))?.addEventListener("click", appendNextPage);
    more.replaceChildren(...nodes);
  }

  function appendNextPage() {
    page += 1;
    const { items, total } = searchLookupGroup(corpus, { group, query, page, filter: filterFn });
    const nodes = group === "tactics"
      ? items.map((item) => treeToDom(lookupTableRowTree(item)))
      : lookupResultTrees(group, items, undefined, { selectedId: listSelectedId, byId: corpus.byId }).map((tree) => treeToDom(tree));
    (grid.querySelector(".lookup-table tbody") ?? grid).append(...wire(nodes));
    renderMore(grid.querySelectorAll("[data-lookup-id]").length, total);
    const first = nodes[0];
    (first?.matches?.("[data-lookup-id]") ? first : first?.querySelector("[data-lookup-id]"))?.focus();
  }

  /** Trả focus về thẻ/nút đã mở hồ sơ (hoặc ô tìm) sau khi hộp thoại biến mất. */
  function restoreOpenerFocus() {
    const openerId = opener?.dataset.lookupId;
    const restored = [...grid.querySelectorAll("[data-lookup-id]")].find((button) => button.dataset.lookupId === openerId);
    (restored ?? search).focus();
  }

  /** Chip lọc đồng bộ với bộ lọc đang chọn (số đếm không đổi theo ô tìm nên không dựng lại chip). */
  function syncFilters() {
    for (const chip of filtersBar.querySelectorAll("button[data-facet]")) {
      chip.setAttribute("aria-pressed", String((filters[chip.dataset.facet] ?? "") === chip.dataset.value));
    }
  }

  /** Panel chi tiết của bốn nhóm catalog: mục đang mở, hoặc mục đầu của danh sách khi chưa mở mục nào. */
  function paintPanel(target) {
    if (!target) {
      panel.replaceChildren();
      return;
    }
    const node = treeToDom(masterDetailTree(group, target.item, corpus, currentLocale(), { targetId: target.targetId }));
    activatePortraits(node);
    panel.replaceChildren(node);
    panel.querySelector(".is-target")?.scrollIntoView?.({ block: "nearest" });
  }

  /** Dựng lại danh sách + panel của bốn nhóm catalog theo ô tìm, bộ lọc và `?id=`. */
  function renderMaster(hadDetail) {
    const result = searchLookupGroup(corpus, { group, query, page: 1, filter: filterFn });
    const items = [...result.items];
    for (let current = 2; current <= page && items.length < result.total; current += 1) {
      items.push(...searchLookupGroup(corpus, { group, query, page: current, filter: filterFn }).items);
    }
    const target = route.id ? masterTargetFor(corpus, route.id) : null;
    listSelectedId = target ? target.item.id : masterDefaultId(group, items);
    const shown = target ?? (listSelectedId ? masterTargetFor(corpus, listSelectedId) : null);
    syncFilters();
    summaryLine.dataset.lookupTotal = String(result.total);
    summaryLine.replaceChildren(...lookupSummaryTrees(group, result.total, undefined, filters).map((tree) => treeToDom(tree)));
    orderNote.hidden = true;
    grid.replaceChildren(...wire(lookupResultTrees(group, items, undefined, { selectedId: listSelectedId, byId: corpus.byId }).map((tree) => treeToDom(tree))));
    if (!result.total) {
      feedback.setAttribute("role", "status");
      feedback.textContent = L("Không có kết quả phù hợp.", "没有符合条件的结果。");
    }
    renderMore(items.length, result.total);
    if (route.id && !target) {
      feedback.textContent = L("Mục tra cứu đang được cập nhật.", "该条目正在更新。");
      feedback.setAttribute("role", "alert");
    }
    paintPanel(shown);
    // Mobile: chi tiết là màn riêng; mở thì về đầu trang và đưa focus vào nút quay lại, đóng thì trả focus về mục đã bấm.
    const open = Boolean(target);
    mount.dataset.lookupDetailOpen = String(open);
    if (open && !detailWasOpen && rendered) {
      const back = panel.querySelector("[data-lookup-back]");
      if (back && back.offsetParent !== null) {
        window.scrollTo(0, 0);
        back.focus();
      }
    } else if (!open && (detailWasOpen || hadDetail)) {
      restoreOpenerFocus();
    }
    detailWasOpen = open;
    rendered = true;
  }

  function render() {
    // Danh sách và chi tiết catalog cần tên tướng (payload hồ sơ): chờ tải xong rồi dựng, trong lúc đó HTML dựng sẵn vẫn hiện.
    if (master && !profileSettled) {
      ensureProfileDocs().then(() => render());
      return;
    }
    const hadDialog = detailMount.querySelector(".lookup-dialog") !== null || restoreAfterPop;
    restoreAfterPop = false;
    route = parseLookupQuery(location.search, group);
    if (route.otherGroup) {
      location.replace(localePath(lookupProfilePath(route.id)));
      return;
    }
    feedback.removeAttribute("role");
    feedback.textContent = "";
    clearDialog();
    if (route.error) {
      grid.replaceChildren();
      more.replaceChildren();
      panel?.replaceChildren();
      summaryLine.dataset.lookupTotal = "0";
      summaryLine.textContent = "";
      feedback.setAttribute("role", "alert");
      feedback.textContent = route.messageVi;
      orderNote.hidden = true;
      return;
    }
    if (master) {
      renderMaster(hadDialog);
      return;
    }
    const result = searchLookupGroup(corpus, { group, query, page: 1 });
    const items = [...result.items];
    for (let current = 2; current <= page && items.length < result.total; current += 1) {
      items.push(...searchLookupGroup(corpus, { group, query, page: current }).items);
    }
    summaryLine.dataset.lookupTotal = String(result.total);
    summaryLine.replaceChildren(...lookupSummaryTrees(group, result.total).map((tree) => treeToDom(tree)));
    const order = result.total ? lookupOrderNote(query) : null;
    orderNote.hidden = !order;
    if (order) orderNote.textContent = order;
    grid.replaceChildren(...wire(lookupResultTrees(group, items).map((tree) => treeToDom(tree))));
    if (!result.total) {
      feedback.setAttribute("role", "status");
      feedback.textContent = L("Không có kết quả phù hợp.", "没有符合条件的结果。");
    }
    renderMore(items.length, result.total);
    if (route.id) showDialog(route.id);
    else if (hadDialog) restoreOpenerFocus();
  }

  // Tải trước payload hồ sơ khi người dùng nhắm tới một mục (rê chuột/focus), để hồ sơ đầu tiên mở ngay.
  const prefetch = (event) => { if (event.target.closest?.("[data-lookup-id]")) ensureProfileDocs(); };
  grid.addEventListener("pointerover", prefetch);
  grid.addEventListener("focusin", prefetch);
  search.addEventListener("input", () => { query = search.value; page = 1; render(); });
  // Back/Forward giữ số lượt "Xem thêm" đã mở (đóng/mở hồ sơ không đổi lưới).
  window.addEventListener("popstate", render);
  if (master) {
    // Chip lọc: bấm chip đang bật thì tắt (về "Tất cả"); "Tất cả" (giá trị rỗng) bỏ lọc của khía cạnh đó.
    filtersBar.addEventListener("click", (event) => {
      const chip = event.target.closest?.("button[data-facet]");
      if (!chip) return;
      const { facet, value } = chip.dataset;
      filters = { ...filters, [facet]: value && filters[facet] !== value ? value : "" };
      page = 1;
      render();
    });
    // Panel chi tiết: đổi phiên bản hiệu quả (cải tạo binh chủng) và nút quay lại danh sách (màn chi tiết mobile).
    panel.addEventListener("click", (event) => {
      const tab = event.target.closest?.("[data-effect-tab]");
      if (tab) {
        const section = tab.closest(".lookup-detail-section");
        for (const other of section.querySelectorAll("[data-effect-tab]")) other.setAttribute("aria-pressed", String(other === tab));
        for (const body of section.querySelectorAll("[data-effect-panel]")) body.hidden = body.dataset.effectPanel !== tab.dataset.effectTab;
        return;
      }
      const back = event.target.closest?.("[data-lookup-back]");
      if (back && isNativeNavigationClick(event)) {
        event.preventDefault();
        closeDialog();
      }
    });
  }
  render();
  return { render };
}
