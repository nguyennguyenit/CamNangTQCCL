import { sourceLabel as legacySourceLabel } from "./render.js";
// Section "Soi đội từ ảnh" (Phase 4): upload/paste ảnh -> nén client -> Turnstile
// (lazy-load) -> gọi Worker -> map 3 trục (analyze-map) -> render + đối chiếu team.
// Turnstile script chỉ nạp khi mở trang này.

import { el, icon, svgNode } from "./render.js";
import { heroPortrait } from "./hero-portrait.js";
import { ANALYZE_CONFIG, isAnalyzeConfigured } from "./config.js";
import { mapTeamRead, findSimilarTeams } from "./analyze-map.js";
import { L, currentLocale } from "./i18n.js";
import { createRawNameResolver, localName } from "./website-display.js";
import { renderTurnstileWidget, TURNSTILE_ERROR_MESSAGE } from "./turnstile.js";

// `<html lang>` cố định theo trang nên các hằng dịch lúc nạp module vẫn đúng ngôn ngữ.
const DISCLAIMER = L(
  "Ảnh được gửi tới Alibaba Cloud DashScope để phân tích (không lưu lại). " +
  "Tránh ảnh lộ tên tài khoản; nên crop chỉ phần đội hình.",
  "图片将发送至阿里云 DashScope 进行分析（不会保存）。请避免截图中出现账号名称，建议只裁剪阵容部分。",
);

/* ---------- Thông điệp lỗi (không để lọt văn bản upstream) ---------- */
// Mọi câu lỗi hiển thị cho người dùng đều lấy từ các bảng dưới đây. Văn bản lạ
// từ Worker/model (tiếng Trung, tiếng Anh, stack trace…) luôn bị thay bằng câu
// chung, không bao giờ render nguyên văn.
export const ANALYZE_GENERIC_ERROR = L("Không thể phân tích ảnh. Vui lòng thử lại.", "无法分析图片，请重试。");
export const ANALYZE_ACTION_ERROR = L("Không thể hoàn tất thao tác. Vui lòng thử lại.", "无法完成操作，请重试。");
const AI_SERVICE_ERROR = L("Dịch vụ AI đang gặp sự cố. Thử lại sau ít phút.", "AI 服务出现故障，请几分钟后再试。");
const INVALID_REQUEST_ERROR = L("Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.", "请求无效，请刷新页面后重试。");
const IMAGE_TOO_LARGE_ERROR = L("Ảnh quá lớn. Hãy crop hoặc giảm kích thước rồi thử lại.", "图片过大，请裁剪或缩小尺寸后重试。");
const IMAGE_TYPE_ERROR = L("Chỉ nhận ảnh PNG, JPEG hoặc WebP.", "仅支持 PNG、JPEG 或 WebP 图片。");
const SERVICE_NOT_FOUND_ERROR = L("Không tìm thấy dịch vụ soi ảnh. Thử lại sau.", "未找到识图服务，请稍后再试。");
const TOO_MANY_TRIES_ERROR = L("Bạn thử quá nhiều lần. Đợi một lát rồi thử lại.", "尝试次数过多，请稍等片刻后重试。");


const STATUS_ERRORS = {
  400: INVALID_REQUEST_ERROR,
  403: L("Xác thực chống bot chưa hợp lệ. Xác thực lại rồi thử.", "人机验证无效，请重新验证后再试。"),
  404: SERVICE_NOT_FOUND_ERROR,
  413: IMAGE_TOO_LARGE_ERROR,
  415: IMAGE_TYPE_ERROR,
  422: L("Không đọc được đội từ ảnh. Thử ảnh rõ hơn.", "无法从图片中识别队伍，请换一张更清晰的图片。"),
  429: L("Hết lượt soi hôm nay. Thử lại sau.", "今日识图次数已用完，请稍后再试。"),
  500: ANALYZE_GENERIC_ERROR,
  502: AI_SERVICE_ERROR,
  503: L("Tính năng soi ảnh đang tạm nghỉ. Thử lại sau.", "识图功能暂停服务，请稍后再试。"),
};

// Chuỗi lỗi ĐÃ BIẾT (Worker hiện tại + upstream DashScope) -> câu cố định theo ngôn ngữ
// trang. Khóa là chuỗi đã chuẩn hóa (trim + lowercase).
const UPSTREAM_ERRORS = new Map(Object.entries({
  "thiếu ảnh": L("Chưa có ảnh để soi. Chọn ảnh rồi thử lại.", "尚未选择图片，请选择图片后重试。"),
  "ảnh quá lớn": IMAGE_TOO_LARGE_ERROR,
  "base64 không hợp lệ": L("Ảnh gửi lên bị lỗi. Chọn lại ảnh rồi thử.", "上传的图片有误，请重新选择图片再试。"),
  "ảnh quá nhỏ / hỏng": L("Ảnh quá nhỏ hoặc bị hỏng. Chọn ảnh khác.", "图片过小或已损坏，请换一张图片。"),
  "chỉ nhận ảnh png/jpeg/webp": IMAGE_TYPE_ERROR,
  "body json không hợp lệ": INVALID_REQUEST_ERROR,
  "mode không hợp lệ": INVALID_REQUEST_ERROR,
  "origin không được phép": L("Trang chưa được phép gọi dịch vụ soi ảnh.", "本页面无权调用识图服务。"),
  "not found": SERVICE_NOT_FOUND_ERROR,
  "tính năng đang tắt": L("Tính năng soi ảnh đang tạm tắt. Thử lại sau.", "识图功能已暂时关闭，请稍后再试。"),
  "đã đạt giới hạn tháng, tạm dừng": L("Đã hết lượt soi của tháng này. Thử lại sau.", "本月识图次数已用完，请稍后再试。"),
  "hết lượt hôm nay": L("Hết lượt soi hôm nay. Thử lại vào ngày mai.", "今日识图次数已用完，请明天再试。"),
  "bạn thử quá nhiều lần, đợi chút": TOO_MANY_TRIES_ERROR,
  "thiếu xác thực chống bot": L("Cần xác thực chống bot trước khi soi ảnh.", "识图前需先完成人机验证。"),
  "dịch vụ ai tạm lỗi, thử lại sau": AI_SERVICE_ERROR,
  "dịch vụ ai đang quá tải, thử lại sau": L("Dịch vụ AI đang quá tải. Đợi vài phút rồi thử lại.", "AI 服务繁忙，请几分钟后再试。"),
  "dịch vụ soi ảnh chưa được cấu hình": L("Dịch vụ soi ảnh chưa sẵn sàng. Thử lại sau.", "识图服务尚未就绪，请稍后再试。"),
  "lỗi xác thực, thử lại": L("Xác thực chống bot lỗi. Thử lại.", "人机验证出错，请重试。"),
  "xác thực chống bot thất bại": L("Xác thực chống bot thất bại. Thử lại.", "人机验证失败，请重试。"),
  "lỗi xử lý, thử lại sau": ANALYZE_GENERIC_ERROR,
  "lỗi xử lý": ANALYZE_GENERIC_ERROR,
  // Upstream tiếng Trung / tiếng Anh đã gặp: gộp về câu chung, không render gốc.
  "服务器内部错误": ANALYZE_GENERIC_ERROR,
  "internal server error": ANALYZE_GENERIC_ERROR,
  "请求过于频繁": TOO_MANY_TRIES_ERROR,
  "too many requests": TOO_MANY_TRIES_ERROR,
}));

function normalizeUpstreamError(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Đổi lỗi Worker (status + message thô) thành câu cố định trong danh sách, theo ngôn ngữ trang. */
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

/** Câu an toàn (theo ngôn ngữ trang) cho bất kỳ lỗi nào trước khi đưa lên UI. */
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
      reject(localizedError(L("Không đọc được ảnh", "无法读取图片")));
    };
    img.src = url;
  });
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

/**
 * Tên hiển thị của một ô đã map: bản Việt dùng tên Việt canonical; bản zh dùng chữ Hán đọc được
 * từ ảnh (đúng như trong game); ô trống giữ nhãn "chưa rõ" đã dịch.
 */
function shownName(item) {
  if (currentLocale() !== "zh") return item.viet;
  return (item.cn || "").trim() || item.viet;
}

function heroResultCard(m) {
  const flag = m.hero.sure
    ? null
    : el("span", { class: "ana-flag", title: L("Độ tin thấp, kiểm tra lại", "置信度低，请核对") }, [alertIcon(), L("kiểm tra", "待核对")]);
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
      el("span", { class: `ana-tac${t.sure ? "" : " unsure"}`, title: t.sure ? "" : L("Không chắc", "不确定") }, shownName(t)),
    ),
  );
  // Binh thư (dòng vàng) — hiển thị, không tính điểm so khớp.
  const books = (m.books && m.books.length)
    ? el("div", { class: "ana-books" },
        m.books.map((b) =>
          el("span", { class: `ana-book${b.sure ? "" : " unsure"}`, title: b.sure ? "" : L("Không chắc", "不确定") }, shownName(b)),
        ),
      )
    : null;
  return el("div", { class: "ana-hero" }, [
    el("div", { class: "ana-hero-head" }, [
      portrait,
      el("span", { class: "ana-hero-name" }, shownName(m.hero)),
      m.statFocus ? el("span", { class: "ana-stat" }, currentLocale() === "zh" ? m.statFocusCn || m.statFocus : m.statFocus) : null,
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
function similarTeamRow(s, onOpen, resolveRaw) {
  const team = s.team || {};
  // Tên đội trong dữ liệu chỉ có bản Việt: bản zh gọi đội bằng tên chữ Hán của các tướng trong đội.
  const zhName = currentLocale() === "zh" && team.heroes?.length
    ? team.heroes.map((hero) => localName(hero?.name, resolveRaw)).filter(Boolean).join(" · ")
    : "";
  // Nhãn nguồn tách các đội trùng tên (22 tên dùng chung cho 48/166 đội).
  const sourceLabel = team.source ? legacySourceLabel(team.source) : "";
  const label = L(`${s.heroHit}/${s.total} tướng`, `${s.heroHit}/${s.total} 名武将`)
    + (s.tacticHit ? L(` · ${s.tacticHit} chiến pháp`, ` · ${s.tacticHit} 个战法`) : "")
    + (sourceLabel ? ` · ${sourceLabel}` : "");
  const btn = el("button", { class: "ana-team-link", type: "button" }, zhName || team.name || team.id || "team");
  if (onOpen) btn.addEventListener("click", () => onOpen(team));
  return el("li", { class: "ana-team-row", dataset: team.id ? { teamId: team.id } : {} }, [
    btn,
    el("span", { class: `ana-team-hits${s.heroHit === s.total ? " full" : ""}` }, label),
  ]);
}

function renderResults(readBox, similarBox, result, deps) {
  readBox.replaceChildren();
  similarBox.replaceChildren();
  // Thông báo lỗi do dòng trạng thái của công cụ hiện (một lần), không lặp lại trong thẻ kết quả.
  if (!result || !Array.isArray(result.heroes) || result.heroes.length === 0) return false;
  const mapped = mapTeamRead(result.heroes, deps);
  readBox.append(el("div", { class: "ana-heroes" }, mapped.map(heroResultCard)));

  const similar = findSimilarTeams(mapped, deps.teams, { minHeroes: 2 });
  const resolveRaw = currentLocale() === "zh" ? createRawNameResolver(deps.heroesDict) : null;
  if (similar.length) {
    similarBox.append(el("ol", { class: "ana-teams" }, similar.map((s) => similarTeamRow(s, deps.onOpenTeam, resolveRaw))));
  } else {
    similarBox.append(el("p", { class: "ana-note" }, L("Không tìm thấy đội có sẵn nào có mức độ tương đồng đủ cao (≥2 tướng trùng)."
      , "未找到相似度足够高的现有队伍（需至少 2 名武将相同）。")));
  }
  return true;
}

/* ---------- Khởi tạo section ---------- */
export function initAnalyze(deps, mount) {
  if (!isAnalyzeConfigured()) {
    mount.replaceChildren(
      el("div", { class: "ana-setup" }, [
        el("p", {}, L("Tính năng soi đội chưa được cấu hình.", "“截图识阵”功能尚未配置。")),
        el("p", { class: "ana-note" }, L("Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js.", "需部署 Worker（worker/），并在 js/config.js 中填写 workerUrl 与 turnstileSiteKey。")),
      ]),
    );
    return;
  }

  let generation = 0;
  const state = { imageDataUrl: null, fileName: '', token: null, busy: false, done: false };
  const drop = el("button", { type: "button", class: "ana-drop" }, [
    cameraIcon(),
    el("span", { class: "ana-drop-title" }, L("Kéo thả ảnh, dán (Ctrl+V) hoặc bấm để chọn", "拖放图片、粘贴（Ctrl+V）或点击选择")),
    el("span", { class: "ana-drop-note" }, L("PNG, JPEG hoặc WebP · nên crop chỉ phần đội hình", "PNG、JPEG 或 WebP · 建议只裁剪阵容部分")),
  ]);
  const fileInput = el("input", { type: "file", accept: "image/*", class: "ana-file" });
  const preview = el("img", { class: "ana-preview", alt: L("Ảnh đã chọn", "已选图片") });
  const fileName = el("span", { class: "ana-file-name" });
  const fileRow = el("div", { class: "ana-file-row", hidden: "" }, [
    el("span", { class: "ana-thumb" }, [preview]),
    el("div", { class: "ana-file-info" }, [
      fileName,
      el("span", { class: "rt-sub" }, L("Đã nén · sẵn sàng gửi", "已压缩 · 可发送")),
      el("button", { class: "tool-text-action", type: "button", onclick: () => fileInput.click() }, L("Chọn ảnh khác", "换一张图片")),
    ]),
  ]);
  const tsBox = el("div", { class: "ana-turnstile" });
  const analyzeBtn = el("button", { class: "ana-btn primary ana-run", type: "button", disabled: "" }, L("Soi đội", "识别阵容"));
  const status = el("p", { class: "ana-status", role: "status" });
  const heroBox = el("div", { class: "ana-read-body" });
  const similarBox = el("div", { class: "ana-similar-body" });
  const similarCard = el("section", { class: "ana-card ana-similar", hidden: "" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, L("3 · Đội có sẵn tương tự", "3 · 相似的现有队伍")),
      el("span", { class: "rt-sub" }, L("Theo số tướng và chiến pháp trùng", "按相同武将与战法数量排序")),
    ]),
    similarBox,
  ]);

  const steps = [
    { label: L("Nén ảnh", "压缩图片"), done: () => Boolean(state.imageDataUrl) },
    { label: L("Xác thực chống bot", "人机验证"), done: () => Boolean(state.token) },
    { label: L("Soi đội và đối chiếu", "识别阵容并比对"), doneLabel: L("Đã đọc xong — kiểm tra lại kết quả đã đọc", "识别完成——请核对识别结果"), done: () => state.done },
  ].map((step) => {
    const mark = checkIcon();
    const labelNode = el("span", {}, step.label);
    // Dấu ✓ nằm trong span bọc: `hidden` chỉ có tác dụng trên phần tử HTML, không trên chính SVG.
    const markWrap = el("span", { class: "ana-step-mark", "aria-hidden": "true" }, [mark]);
    const node = el("li", { class: "ana-step" }, [markWrap, labelNode]);
    return { ...step, node, markWrap, labelNode };
  });
  const stepList = el("ol", { class: "ana-steps", "aria-label": L("Trạng thái", "状态") }, steps.map((step) => step.node));

  // Thẻ "2 · Đội đọc được" ẩn tới khi có kết quả như thẻ 3; lỗi/tiến trình vẫn báo qua dòng `role=status` ở thẻ 1.
  const readCard = el("section", { class: "ana-card ana-read", hidden: "" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, L("2 · Đội đọc được", "2 · 识别出的队伍")),
      el("span", { class: "rt-sub" }, L("Tên Việt chuẩn · icon chỉ để đối chiếu", "原版中文名 · 头像仅供比对")),
    ]),
    heroBox,
  ]);

  const pickCard = el("section", { class: "ana-card ana-pick" }, [
    el("h2", { class: "ana-card-title" }, L("1 · Chọn ảnh", "1 · 选择图片")),
    el("p", { class: "tool-notice" }, [
      el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
      el("span", { class: "ana-disclaimer-text" }, DISCLAIMER),
    ]),
    drop,
    fileInput,
    fileRow,
    tsBox,
    analyzeBtn,
    status,
    stepList,
  ]);

  const head = el("header", { class: "tool-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, L("Công cụ · Beta", "工具 · Beta")),
      el("h1", { class: "reference-title", tabindex: "-1" }, L("Soi đội từ ảnh", "截图识阵")),
      el("p", { class: "reference-lead" }, L("Chụp màn hình đội hình, AI đọc tên tướng và chiến pháp, rồi đối chiếu với các đội trong cẩm nang.", "截取阵容画面，AI 识别武将与战法名称，再与攻略中的队伍进行比对。")),
    ]),
  ]);

  function setStatus(msg, kind = "") {
    status.className = `ana-status ${kind}`.trim();
    status.textContent = msg || "";
  }

  /** Trạng thái công cụ vẽ tại chỗ: nút chạy, hàng ảnh đã chọn và danh sách bước. */
  function paint() {
    analyzeBtn.disabled = !(state.imageDataUrl && state.token && !state.busy);
    fileRow.hidden = !state.imageDataUrl;
    drop.classList.toggle("chosen", Boolean(state.imageDataUrl));
    for (const step of steps) {
      const done = step.done();
      step.node.dataset.state = done ? "done" : "pending";
      step.markWrap.hidden = !done;
      step.labelNode.textContent = done && step.doneLabel ? step.doneLabel : step.label;
    }
  }

  /** Vẽ kết quả đã đọc: `false` khi phản hồi không hợp lệ. */
  function applyResult(result) {
    const ok = renderResults(heroBox, similarBox, result, deps);
    readCard.hidden = !ok;
    similarCard.hidden = !ok;
    state.done = ok;
    paint();
    return ok;
  }

  function clearResults() {
    heroBox.replaceChildren();
    similarBox.replaceChildren();
    readCard.hidden = true;
    similarCard.hidden = true;
    state.done = false;
    paint();
  }

  async function pickFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const started = ++generation;
    clearResults();
    setStatus(L("Đang nén ảnh…", "正在压缩图片…"));
    try {
      const compressed = await compressImage(file);
      if (started !== generation) return;
      state.imageDataUrl = compressed;
      state.fileName = file.name || L("ảnh đã chọn", "已选图片");
      preview.src = state.imageDataUrl;
      fileName.textContent = state.fileName;
      setStatus("");
    } catch (e) {
      setStatus(describeAnalyzeError(e), "err");
    }
    paint();
  }

  // Turnstile render (lazy khi mở section).
  let turnstileRendered = false;
  async function ensureTurnstile() {
    if (turnstileRendered) return;
    turnstileRendered = true;
    try {
      await renderTurnstileWidget(tsBox, {
        onToken: (tok) => {
          state.token = tok;
          paint();
        },
        onExpire: () => {
          state.token = null;
          paint();
        },
        onError: (message) => setStatus(message, "err"),
      });
    } catch (e) {
      setStatus(describeAnalyzeError(e, TURNSTILE_ERROR_MESSAGE), "err");
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
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) pickFile(item.getAsFile());
  });

  analyzeBtn.addEventListener("click", async () => {
    if (state.busy || !state.imageDataUrl || !state.token) return;
    const started = generation;
    state.busy = true;
    paint();
    setStatus(L("Đang soi đội…", "正在识别阵容…"));
    try {
      const result = await callWorker(state.imageDataUrl, state.token);
      if (started !== generation) return;
      if (!applyResult(result)) {
        setStatus(L("Phản hồi không hợp lệ, thử lại.", "返回结果无效，请重试。"), "err");
        return;
      }
      setStatus("");
    } catch (e) {
      if (started !== generation) return;
      setStatus(describeAnalyzeError(e, ANALYZE_ACTION_ERROR), "err");
    } finally {
      // Luôn mở khoá, kể cả khi người dùng đã chọn ảnh khác: token Turnstile dùng 1 lần -> reset,
      // yêu cầu xác thực lại. Lượt cũ chỉ bị bỏ kết quả/trạng thái ở trên, không được kẹt nút.
      state.token = null;
      state.busy = false;
      if (turnstileRendered && window.turnstile) window.turnstile.reset(tsBox);
      paint();
    }
  });

  mount.replaceChildren(
    head,
    el("div", { class: "ana-layout" }, [
      pickCard,
      el("div", { class: "ana-col" }, [readCard, similarCard]),
    ]),
  );
  paint();
  ensureTurnstile();
}
