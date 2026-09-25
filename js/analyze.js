import { projectSeasonCandidates } from "./season-context.js";
// Section "Soi đội từ ảnh" (Phase 4): upload/paste ảnh -> nén client -> Turnstile
// (lazy-load) -> gọi Worker -> map 3 trục (analyze-map) -> render + đối chiếu team.
// Giữ 3 section cũ offline: Turnstile script CHỈ nạp khi mở tab này.

import { el, icon, svgNode } from "./render.js";
import { heroPortrait } from "./hero-portrait.js";
import { ANALYZE_CONFIG, isAnalyzeConfigured } from "./config.js";
import { mapTeamRead, findSimilarTeams } from "./analyze-map.js";

const DISCLAIMER =
  "Ảnh được gửi tới Alibaba Cloud DashScope để phân tích (không lưu lại). " +
  "Tránh ảnh lộ tên tài khoản; nên crop chỉ phần đội hình.";

/* ---------- Thông điệp lỗi (không để lọt văn bản upstream) ---------- */
// Mọi câu lỗi hiển thị cho người dùng đều lấy từ các bảng dưới đây. Văn bản lạ
// từ Worker/model (tiếng Trung, tiếng Anh, stack trace…) luôn bị thay bằng câu
// chung, không bao giờ render nguyên văn.
export const ANALYZE_GENERIC_ERROR = "Không thể phân tích ảnh. Vui lòng thử lại.";
export const ANALYZE_ACTION_ERROR = "Không thể hoàn tất thao tác. Vui lòng thử lại.";


const STATUS_ERRORS = {
  400: "Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.",
  403: "Xác thực chống bot chưa hợp lệ. Xác thực lại rồi thử.",
  404: "Không tìm thấy dịch vụ soi ảnh. Thử lại sau.",
  413: "Ảnh quá lớn. Hãy crop hoặc giảm kích thước rồi thử lại.",
  415: "Chỉ nhận ảnh PNG, JPEG hoặc WebP.",
  422: "Không đọc được đội từ ảnh. Thử ảnh rõ hơn.",
  429: "Hết lượt soi hôm nay. Thử lại sau.",
  500: ANALYZE_GENERIC_ERROR,
  503: "Tính năng soi ảnh đang tạm nghỉ. Thử lại sau.",
};

// Chuỗi lỗi ĐÃ BIẾT (Worker hiện tại + upstream DashScope) -> câu tiếng Việt cố
// định. Khóa là chuỗi đã chuẩn hóa (trim + lowercase).
const UPSTREAM_ERRORS = new Map(Object.entries({
  "thiếu ảnh": "Chưa có ảnh để soi. Chọn ảnh rồi thử lại.",
  "ảnh quá lớn": "Ảnh quá lớn. Hãy crop hoặc giảm kích thước rồi thử lại.",
  "base64 không hợp lệ": "Ảnh gửi lên bị lỗi. Chọn lại ảnh rồi thử.",
  "ảnh quá nhỏ / hỏng": "Ảnh quá nhỏ hoặc bị hỏng. Chọn ảnh khác.",
  "chỉ nhận ảnh png/jpeg/webp": "Chỉ nhận ảnh PNG, JPEG hoặc WebP.",
  "body json không hợp lệ": "Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.",
  "mode không hợp lệ": "Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.",
  "origin không được phép": "Trang chưa được phép gọi dịch vụ soi ảnh.",
  "not found": "Không tìm thấy dịch vụ soi ảnh. Thử lại sau.",
  "tính năng đang tắt": "Tính năng soi ảnh đang tạm tắt. Thử lại sau.",
  "đã đạt giới hạn tháng, tạm dừng": "Đã hết lượt soi của tháng này. Thử lại sau.",
  "hết lượt hôm nay": "Hết lượt soi hôm nay. Thử lại vào ngày mai.",
  "bạn thử quá nhiều lần, đợi chút": "Bạn thử quá nhiều lần. Đợi một lát rồi thử lại.",
  "thiếu xác thực chống bot": "Cần xác thực chống bot trước khi soi ảnh.",
  "token xác thực đã dùng": "Phiên xác thực đã dùng. Xác thực lại rồi thử.",
  "lỗi xác thực, thử lại": "Xác thực chống bot lỗi. Thử lại.",
  "xác thực chống bot thất bại": "Xác thực chống bot thất bại. Thử lại.",
  "lỗi xử lý, thử lại sau": ANALYZE_GENERIC_ERROR,
  "lỗi xử lý": ANALYZE_GENERIC_ERROR,
  // Upstream tiếng Trung / tiếng Anh đã gặp: gộp về câu chung, không render gốc.
  "服务器内部错误": ANALYZE_GENERIC_ERROR,
  "internal server error": ANALYZE_GENERIC_ERROR,
  "请求过于频繁": "Bạn thử quá nhiều lần. Đợi một lát rồi thử lại.",
  "too many requests": "Bạn thử quá nhiều lần. Đợi một lát rồi thử lại.",
}));

function normalizeUpstreamError(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Đổi lỗi Worker (status + message thô) thành câu tiếng Việt trong danh sách. */
export function localizeWorkerError(rawError, status) {
  return (
    UPSTREAM_ERRORS.get(normalizeUpstreamError(rawError)) ||
    STATUS_ERRORS[status] ||
    ANALYZE_GENERIC_ERROR
  );
}

function localizedError(message, extra) {
  const err = new Error(message);
  err.localized = true;
  if (extra) Object.assign(err, extra);
  return err;
}

/** Câu tiếng Việt an toàn cho bất kỳ lỗi nào trước khi đưa lên UI. */
export function describeAnalyzeError(error, fallback = ANALYZE_GENERIC_ERROR) {
  return error?.localized && error.message ? error.message : fallback;
}
function isNonblankString(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonblankString);
}

export function validateWorkerResult(mode, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (mode === "scanHeroes") {
    return Array.isArray(data.heroes) && data.heroes.length > 0 && data.heroes.every(hero =>
      hero && typeof hero === "object" &&
      isNonblankString(hero.nameCn) &&
      (hero.level === undefined || Number.isFinite(hero.level)) &&
      (hero.redStars === undefined || Number.isFinite(hero.redStars))
    );
  }
  if (mode === "scanTactics") {
    return Array.isArray(data.tactics) && data.tactics.length > 0 && data.tactics.every(tactic =>
      isNonblankString(typeof tactic === "string" ? tactic : tactic?.nameCn)
    );
  }
  if (mode === "scanBuiltTeams") {
    return Array.isArray(data.teams) && data.teams.length > 0 && data.teams.every(team =>
      team && typeof team === "object" &&
      isNonblankString(team.teamName) &&
      isStringArray(team.heroesCn) &&
      isStringArray(team.tacticsCn) &&
      (team.heroesCn.length > 0 || team.tacticsCn.length > 0)
    );
  }
  if (mode !== "analyzeTeamImage") return false;
  return Array.isArray(data.heroes) && data.heroes.length > 0 && data.heroes.every(hero =>
    hero && typeof hero === "object" &&
    isNonblankString(hero.nameCn) &&
    isStringArray(hero.tacticsCn) &&
    isStringArray(hero.booksCn) &&
    typeof hero.statFocusCn === "string" &&
    (hero.nameFromPortrait === undefined || hero.nameFromPortrait === true)
  );
}


/* ---------- Nén ảnh client ---------- */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, ANALYZE_CONFIG.maxImageDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL("image/jpeg", ANALYZE_CONFIG.jpegQuality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh"));
    };
    img.src = url;
  });
}

/* ---------- Turnstile (lazy) ---------- */
let turnstileLoading = null;
export function loadTurnstile() {
  if (turnstileLoading) return turnstileLoading;
  turnstileLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => reject(new Error("Không tải được Turnstile"));
    document.head.append(s);
  });
  return turnstileLoading;
}

/* ---------- Gọi Worker ---------- */
export async function callWorker(imageDataUrl, token, mode = "analyzeTeamImage") {
  const res = await fetch(ANALYZE_CONFIG.workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUrl, turnstileToken: token, mode }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    if (res.ok) throw localizedError(ANALYZE_GENERIC_ERROR, {status: res.status});
  }
  if (!res.ok) {
    throw localizedError(localizeWorkerError(data?.error, res.status), { status: res.status });
  }
  if (!validateWorkerResult(mode, data)) {
    throw localizedError(ANALYZE_GENERIC_ERROR, {status: res.status});
  }
  return data;
}

/* ---------- Render kết quả ---------- */
const alertIcon = () => icon([
  svgNode("path", { d: "M12 3l10 18H2z" }),
  svgNode("line", { x1: 12, y1: 10, x2: 12, y2: 14 }),
  svgNode("line", { x1: 12, y1: 17.5, x2: 12, y2: 17.6 }),
], { size: 14, stroke: 2 });

const checkIcon = () => icon([svgNode("polyline", { points: "5 12 10 17 19 7" })], { size: 14, stroke: 2.2 });

const cameraIcon = () => icon([
  svgNode("path", { d: "M4 8h3l2-3h6l2 3h3v11H4z" }),
  svgNode("circle", { cx: 12, cy: 13, r: 3.5 }),
], { size: 28, stroke: 1.6 });

const shieldIcon = () => icon([
  svgNode("path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }),
], { size: 16 });

function heroResultCard(m) {
  const flag = m.hero.sure
    ? null
    : el("span", { class: "ana-flag", title: "Độ tin thấp, kiểm tra lại" }, [alertIcon(), "kiểm tra"]);
  // Icon official (hotlink) để mắt thường xác nhận; dùng helper chân dung chung (nâng https, no-referrer),
  // gãy/403 -> bỏ ảnh, không chặn text.
  const portrait = m.hero.icon
    ? heroPortrait({
        nameVi: m.hero.viet,
        iconUrl: m.hero.icon,
        className: "ana-hero-icon",
        fallbackOnError: false,
      })
    : null;
  const tactics = el("div", { class: "ana-tactics" },
    m.tactics.map((t) =>
      el("span", { class: `ana-tac${t.sure ? "" : " unsure"}`, title: t.sure ? "" : "Không chắc" }, t.viet),
    ),
  );
  // Binh thư (dòng vàng) — hiển thị, không tính điểm so khớp.
  const books = (m.books && m.books.length)
    ? el("div", { class: "ana-books" },
        m.books.map((b) =>
          el("span", { class: `ana-book${b.sure ? "" : " unsure"}`, title: b.sure ? "" : "Không chắc" }, b.viet),
        ),
      )
    : null;
  return el("div", { class: "ana-hero" }, [
    el("div", { class: "ana-hero-head" }, [
      portrait,
      el("span", { class: "ana-hero-name" }, m.hero.viet),
      m.statFocus ? el("span", { class: "ana-stat" }, m.statFocus) : null,
      flag,
    ]),
    tactics,
    books,
  ]);
}

/**
 * Hàng "đội tương tự": chỉ hiện trường có thật trong dữ liệu `findSimilarTeams` trả về — tên đội
 * (`team.name`, thiếu thì mã đội) và số khớp tướng/chiến pháp. Điểm, mùa và trạng thái khớp theo
 * artboard không có trong dữ liệu này nên giữ cách hiển thị cũ (xem báo cáo phase 9).
 */
function similarTeamRow(s, onOpen) {
  const team = s.team || {};
  const label = `${s.heroHit}/${s.total} tướng` + (s.tacticHit ? ` · ${s.tacticHit} chiến pháp` : "");
  const btn = el("button", { class: "ana-team-link", type: "button" }, team.name || team.id || "team");
  if (onOpen) btn.addEventListener("click", () => onOpen(team));
  return el("li", { class: "ana-team-row", dataset: team.id ? { teamId: team.id } : {} }, [
    btn,
    el("span", { class: `ana-team-hits${s.heroHit === s.total ? " full" : ""}` }, label),
  ]);
}

function renderResults(readBox, similarBox, result, deps) {
  readBox.replaceChildren();
  similarBox.replaceChildren();
  if (!result || !Array.isArray(result.heroes) || result.heroes.length === 0) {
    readBox.append(el("p", { class: "ana-status err" }, "Phản hồi không hợp lệ, thử lại."));
    return false;
  }
  const mapped = mapTeamRead(result.heroes, deps);
  readBox.append(el("div", { class: "ana-heroes" }, mapped.map(heroResultCard)));

  const similar = findSimilarTeams(mapped, deps.teams, { minHeroes: 2 });
  if (similar.length) {
    similarBox.append(el("ol", { class: "ana-teams" }, similar.map((s) => similarTeamRow(s, deps.onOpenTeam))));
  } else {
    similarBox.append(el("p", { class: "ana-note" }, "Không tìm thấy đội có sẵn nào có mức độ tương đồng đủ cao (≥2 tướng trùng)."));
  }
  return true;
}

/* ---------- Khởi tạo section ---------- */
export function initAnalyze(deps, mount) {
  if (!isAnalyzeConfigured()) {
    mount.replaceChildren(
      el("div", { class: "ana-setup" }, [
        el("p", {}, "Tính năng soi đội chưa được cấu hình."),
        el("p", { class: "ana-note" }, "Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js."),
      ]),
    );
    return;
  }

  let scope = null;
  let generation = 0;
  let showOutside = false;
  const gameplayAllowed = () => !scope || scope.browse?.kind === 'all-reference' || scope.browse?.kind === 'verified-pair';
  const scopeNotice = el('p',{class:'season-gameplay-notice',role:'status'});
  const outside = el('input',{type:'checkbox','aria-label':'Xem đội ngoài phạm vi để tham khảo',onChange:event=>{showOutside=event.target.checked;similarBox.replaceChildren();similarCard.hidden=!state.done;}});
  const state = { imageDataUrl: null, fileName: '', token: null, busy: false, done: false };
  const drop = el("button", { type: "button", class: "ana-drop" }, [
    cameraIcon(),
    el("span", { class: "ana-drop-title" }, "Kéo thả ảnh, dán (Ctrl+V) hoặc bấm để chọn"),
    el("span", { class: "ana-drop-note" }, "PNG, JPEG hoặc WebP · nên crop chỉ phần đội hình"),
  ]);
  const fileInput = el("input", { type: "file", accept: "image/*", class: "ana-file" });
  const preview = el("img", { class: "ana-preview", alt: "Ảnh đã chọn" });
  const fileName = el("span", { class: "ana-file-name" });
  const fileRow = el("div", { class: "ana-file-row", hidden: "" }, [
    el("span", { class: "ana-thumb" }, [preview]),
    el("div", { class: "ana-file-info" }, [
      fileName,
      el("span", { class: "rt-sub" }, "Đã nén · sẵn sàng gửi"),
      el("button", { class: "tool-text-action", type: "button", onclick: () => fileInput.click() }, "Chọn ảnh khác"),
    ]),
  ]);
  const tsBox = el("div", { class: "ana-turnstile" });
  const analyzeBtn = el("button", { class: "ana-btn primary ana-run", type: "button", disabled: "" }, "Soi đội");
  const status = el("p", { class: "ana-status", role: "status" });
  const heroBox = el("div", { class: "ana-read-body" });
  const similarBox = el("div", { class: "ana-similar-body" });
  const similarCard = el("section", { class: "ana-card ana-similar", hidden: "" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, "3 · Đội có sẵn tương tự"),
      el("span", { class: "rt-sub" }, "Theo số tướng và chiến pháp trùng"),
    ]),
    similarBox,
  ]);

  const steps = [
    { label: "Nén ảnh", done: () => Boolean(state.imageDataUrl) },
    { label: "Xác thực chống bot", done: () => Boolean(state.token) },
    { label: "Soi đội và đối chiếu", doneLabel: "Đã đọc xong — kiểm tra lại kết quả bên phải", done: () => state.done },
  ].map((step) => {
    const mark = checkIcon();
    const labelNode = el("span", {}, step.label);
    const node = el("li", { class: "ana-step" }, [el("span", { class: "ana-step-mark", "aria-hidden": "true" }, [mark]), labelNode]);
    return { ...step, node, mark, labelNode };
  });
  const stepList = el("ol", { class: "ana-steps", "aria-label": "Trạng thái" }, steps.map((step) => step.node));

  const readCard = el("section", { class: "ana-card ana-read" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, "2 · Đội đọc được"),
      el("span", { class: "rt-sub" }, "Tên Việt chuẩn · icon chỉ để đối chiếu"),
    ]),
    heroBox,
  ]);

  const pickCard = el("section", { class: "ana-card ana-pick" }, [
    el("h2", { class: "ana-card-title" }, "1 · Chọn ảnh"),
    el("p", { class: "tool-notice" }, [
      el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
      el("span", { class: "ana-disclaimer-text" }, DISCLAIMER),
    ]),
    drop,
    fileInput,
    fileRow,
    el("label", { class: "season-opt-in" }, [outside, "Xem đội ngoài phạm vi để tham khảo"]),
    tsBox,
    analyzeBtn,
    status,
    stepList,
  ]);

  const head = el("header", { class: "tool-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, "Công cụ · Beta"),
      el("h1", { class: "reference-title", tabindex: "-1" }, "Soi đội từ ảnh"),
      el("p", { class: "reference-lead" }, "Chụp màn hình đội hình, AI đọc tên tướng và chiến pháp, rồi đối chiếu với các đội trong cẩm nang."),
    ]),
  ]);

  function setStatus(msg, kind = "") {
    status.className = `ana-status ${kind}`.trim();
    status.textContent = msg || "";
  }

  /** Trạng thái công cụ vẽ tại chỗ: nút chạy, hàng ảnh đã chọn và danh sách bước. */
  function paint() {
    analyzeBtn.disabled = !(state.imageDataUrl && state.token && !state.busy && gameplayAllowed());
    fileRow.hidden = !state.imageDataUrl;
    drop.classList.toggle("chosen", Boolean(state.imageDataUrl));
    for (const step of steps) {
      const done = step.done();
      step.node.dataset.state = done ? "done" : "pending";
      step.mark.hidden = !done;
      step.labelNode.textContent = done && step.doneLabel ? step.doneLabel : step.label;
    }
  }

  function clearResults() {
    heroBox.replaceChildren();
    similarBox.replaceChildren();
    similarCard.hidden = true;
    state.done = false;
    paint();
  }

  async function pickFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const started = ++generation;
    clearResults();
    setStatus("Đang nén ảnh…");
    try {
      const compressed = await compressImage(file);
      if (started !== generation) return;
      state.imageDataUrl = compressed;
      state.fileName = file.name || "ảnh đã chọn";
      preview.src = state.imageDataUrl;
      fileName.textContent = state.fileName;
      setStatus("");
    } catch (e) {
      setStatus(e.message, "err");
    }
    paint();
  }

  // Turnstile render (lazy khi mở section).
  let turnstileRendered = false;
  async function ensureTurnstile() {
    if (turnstileRendered) return;
    turnstileRendered = true;
    try {
      const ts = await loadTurnstile();
      ts.render(tsBox, {
        sitekey: ANALYZE_CONFIG.turnstileSiteKey,
        callback: (tok) => {
          state.token = tok;
          paint();
        },
        "expired-callback": () => {
          state.token = null;
          paint();
        },
      });
    } catch (e) {
      setStatus(e.message, "err");
    }
  }

  // Events.
  drop.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => pickFile(e.target.files[0]));
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    pickFile(e.dataTransfer.files[0]);
  });
  document.addEventListener("paste", (e) => {
    if (!mount.classList.contains("active")) return; // chỉ nhận paste khi tab analyze đang mở

    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) pickFile(item.getAsFile());
  });

  analyzeBtn.addEventListener("click", async () => {
    if (state.busy || !gameplayAllowed() || !state.imageDataUrl || !state.token) return;
    const projected = scope?.browse?.kind === 'verified-pair' ? projectSeasonCandidates(scope.model,scope.browse.seasonContext,{mode:'all',experimentalUntiered:true}) : {ok:true,teams:deps.teams};
    if (!projected.ok) { clearResults();setStatus(projected.message,'err');return; }
    const started = generation;
    state.busy = true;
    paint();
    setStatus("Đang soi đội…");
    try {
      const result = await callWorker(state.imageDataUrl, state.token);
      if (started !== generation) return;
      const ok = renderResults(heroBox, similarBox, result, {...deps,teams:projected.teams});
      if (!ok) { setStatus("Phản hồi không hợp lệ, thử lại.", "err"); state.done = false; return; }
      similarCard.hidden = false;
      if (showOutside && scope?.browse?.kind === 'verified-pair') {
        const outsideTeams = deps.teams.filter(team=>!projected.teams.some(candidate=>candidate.id === team.id));
        const mapped = mapTeamRead(result.heroes,deps);
        const references = findSimilarTeams(mapped,outsideTeams,{minHeroes:2});
        similarBox.append(el('h3',{class:'ana-read-title'},'Ngoài phạm vi — chỉ tham khảo'),el('ol',{class:'ana-teams'},references.map(item=>el('li',{class:'ana-team-row'},[el('span',{class:'ana-note'},`${item.team.name || item.team.id} · ${item.heroHit} tướng trùng · Không áp dụng cho luật đang chọn`)]))));
      }
      state.done = true;
      setStatus("");
    } catch (e) {
      if (started !== generation) return;
      setStatus(describeAnalyzeError(e, ANALYZE_ACTION_ERROR), "err");
    } finally {
      if (started !== generation) return;
      // Turnstile token dùng 1 lần -> reset, yêu cầu xác thực lại.
      state.token = null;
      state.busy = false;
      if (turnstileRendered && window.turnstile) window.turnstile.reset(tsBox);
      paint();
    }
  });

  mount.replaceChildren(
    head,
    scopeNotice,
    el("div", { class: "ana-layout" }, [
      pickCard,
      el("div", { class: "ana-col" }, [readCard, similarCard]),
    ]),
  );
  paint();
  ensureTurnstile();
  return {
    setSeasonScope(next) {
      scope=next;generation++;
      state.busy=false;state.token=null;
      clearResults();setStatus('');
      scopeNotice.textContent=gameplayAllowed() ? (next.browse?.kind === 'verified-pair' ? 'Đối chiếu đội theo phiên bản luật đang chọn.' : 'Dữ liệu cũ — tham khảo, chưa xác định kịch bản.') : 'Chọn phiên bản luật đã xác minh để soi và đối chiếu đội.';
      paint();
    },
  };
}
