// Section "Soi đội từ ảnh": ảnh (nén client -> Turnstile lazy -> Worker chép chữ) hoặc nhập tay ->
// editor xác nhận từng ô (3 trạng thái) -> đối chiếu Đội chuẩn theo mùa + Đội khác, diff từng ô.
// Đội đã xác nhận đi vào link `?doi=`, lịch sử trên máy và thẻ PNG — chỉ ID canonical, không ảnh.
// Turnstile script chỉ nạp khi mở trang này.

import { FACTION_CODE, el, icon, svgNode } from "./render.js";
import { ANALYZE_CONFIG, isAnalyzeConfigured } from "./config.js";
import {
  cellFromInput,
  compareTeams,
  confirmedTeam,
  createEntityIndex,
  draftFromRead,
  draftFromTeam,
  draftReady,
  emptyCell,
  emptyDraft,
  normalizeTeamRead,
  readStats,
  referenceTeam,
  sureCell,
} from "./analyze-map.js";
import { createTacticIdResolver } from "./lookup-ids.js";
import {
  SEASON_QUERY_KEY,
  TEAM_QUERY_KEY,
  addHistoryEntry,
  decodeTeamParam,
  encodeTeamParam,
  readHistory,
  writeHistory,
} from "./analyze-state.js";
import { api, describeError, loadSession, signInPrompt } from "./community-api.js";
import { L, currentLocale, localePath } from "./i18n.js";
import { readRecommendedQuery, tacticDisplayName } from "./recommended-reference-state.js";
import { createRawNameResolver, localName } from "./website-display.js";
import { renderTurnstileWidget, TURNSTILE_ERROR_MESSAGE } from "./turnstile.js";

// `<html lang>` cố định theo trang nên các hằng dịch lúc nạp module vẫn đúng ngôn ngữ.
const DISCLAIMER = L(
  "Ảnh được gửi tới nhà cung cấp AI của site (DeepSeek hoặc OpenCode Zen) để phân tích. Site chỉ đếm ẩn danh số ô bạn phải sửa (không ảnh, không tên); " +
  "ảnh chỉ được lưu khi bạn tự bấm gửi. Tránh ảnh lộ tên tài khoản; nên crop chỉ phần đội hình.",
  "图片将发送至本站使用的 AI 服务商（DeepSeek 或 OpenCode Zen）进行分析。本站仅匿名统计您需要修改的格数（不含图片和名称）；只有您主动点击发送时才会保存图片。请避免截图中出现账号名称，建议只裁剪阵容部分。",
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

// Chuỗi lỗi ĐÃ BIẾT (Worker hiện tại + upstream model) -> câu cố định theo ngôn ngữ
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
  "không giải thích được": L("Chưa giải thích được lúc này. Thử lại sau.", "暂时无法给出解释，请稍后再试。"),
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

/** Trần độ dài lời giải thích (khớp Worker `MAX_EXPLANATION`). */
const MAX_EXPLANATION = 600;

export function validateWorkerResult(mode, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (mode === "explainSubstitute") {
    return isNonblankString(data.explanation) && data.explanation.trim().length <= MAX_EXPLANATION;
  }
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
  // Nhận cả dạng C1 `{screen, sides}` lẫn dạng cũ `{heroes}` (gỡ nhánh cũ sau khi Worker mới đã deploy).
  const read = normalizeTeamRead(data);
  return Boolean(read) && read.sides.every(side => side.heroes.every(isValidHeroRead));
}

function isValidHeroRead(hero) {
  return isNonblankString(hero.nameCn) &&
    isStringArray(hero.tacticsCn) &&
    isStringArray(hero.booksCn) &&
    typeof hero.statFocusCn === "string";
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
/** POST một body tới Worker; lỗi HTTP/JSON/sai shape theo `mode` -> Error đã bản địa hoá. */
async function postWorker(body) {
  const res = await fetch(ANALYZE_CONFIG.workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
  if (!validateWorkerResult(body.mode, data)) {
    throw localizedError(ANALYZE_GENERIC_ERROR, {status: res.status});
  }
  return data;
}

export function callWorker(imageDataUrl, token, mode = "analyzeTeamImage") {
  return postWorker({ image: imageDataUrl, turnstileToken: token, mode });
}

/**
 * "Vì sao?": Worker (mode chỉ văn bản `explainSubstitute`) giải thích vì sao `context.substitute`
 * thay được `context.missing` trên `context.hero`. Không gửi ảnh. Trả `{ explanation }`.
 */
export async function callWorkerExplain(context, token) {
  const data = await postWorker({ mode: "explainSubstitute", turnstileToken: token, context });
  return { explanation: data.explanation.trim() };
}

/* ---------- Icon ---------- */
const checkIcon = () => icon([svgNode("polyline", { points: "5 12 10 17 19 7" })], { size: 14, stroke: 2.2 });

const alertIcon = () => icon([
  svgNode("path", { d: "M12 3l10 18H2z" }),
  svgNode("line", { x1: 12, y1: 10, x2: 12, y2: 14 }),
  svgNode("line", { x1: 12, y1: 17.5, x2: 12, y2: 17.6 }),
], { size: 14, stroke: 2 });

const uploadIcon = () => icon([
  svgNode("path", { d: "M12 16V4" }),
  svgNode("path", { d: "M7 9l5-5 5 5" }),
  svgNode("path", { d: "M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" }),
], { size: 30, stroke: 1.8 });

const arrowDownIcon = () => icon([
  svgNode("path", { d: "M12 5v14" }),
  svgNode("path", { d: "M6 13l6 6 6-6" }),
], { size: 15, stroke: 2 });

const shieldIcon = () => icon([
  svgNode("path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }),
], { size: 16 });

/* ---------- Nhãn trạng thái ---------- */
const CELL_FLAGS = {
  unsure: L("Không chắc", "不确定"),
  unknown: L("Không rõ", "无法识别"),
};
const TACTIC_STATUS_TITLES = {
  match: L("Đúng", "一致"),
  wrong: L("Khác đội", "与阵容不同"),
  empty: L("Để trống", "留空"),
  unchecked: L("Không so (tướng thừa)", "未比对（多出的武将）"),
};
const BOOK_STATUS_LABELS = {
  match: L("Binh thư đúng", "兵书一致"),
  mismatch: L("Binh thư lệch", "兵书不同"),
  missing: L("Thiếu binh thư", "缺少兵书"),
};

/** Nhãn mùa trong ô chọn: bản zh dùng tên mùa nguồn, bản vi dùng mã + tên dịch. */
function seasonOptionText(option) {
  if (currentLocale() === "zh") {
    return [option.displayCode, option.nameRaw].filter(Boolean).join(" · ") || option.label || option.sourceSeasonId;
  }
  return option.displayCode && option.displayNameVi
    ? `${option.displayCode} · ${option.displayNameVi}`
    : option.displayNameVi || option.displayCode || option.sourceSeasonId;
}

/** localStorage có thể bị chặn (chế độ riêng tư): lịch sử chỉ là ghi nhớ. */
function localStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/* ---------- Xuất PNG (chỉ chữ + màu, không ảnh ngoài để canvas không bị taint) ---------- */

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  // Chữ Việt tách theo khoảng trắng; chữ Hán không có khoảng trắng nên tách theo ký tự khi quá dài.
  for (const word of String(text).split(/(\s+)/u)) {
    const next = line + word;
    if (ctx.measureText(next).width <= maxWidth || !line.trim()) {
      line = next;
      continue;
    }
    lines.push(line.trimEnd());
    line = word.trimStart();
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.flatMap((item) => {
    if (ctx.measureText(item).width <= maxWidth) return [item];
    const parts = [];
    let current = "";
    for (const char of item) {
      if (ctx.measureText(current + char).width > maxWidth && current) {
        parts.push(current);
        current = "";
      }
      current += char;
    }
    if (current) parts.push(current);
    return parts;
  });
}

/**
 * Vẽ thẻ kết quả lên canvas: tiêu đề, mùa, đội đã xác nhận và các đội khớp nhất kèm số khớp.
 * Màu lấy từ token CSS đang áp (theo theme), font từ token chữ.
 * @param {{title: string, subtitle: string, members: string[], groups: {title: string, rows: string[]}[], footer: string}} card
 */
export function drawResultCard(canvas, card) {
  const css = getComputedStyle(document.documentElement);
  const token = (name) => css.getPropertyValue(name).trim();
  const serif = token("--font-serif") || "serif";
  const sans = token("--font-sans") || "sans-serif";
  const width = 1080;
  const pad = 64;
  const inner = width - pad * 2;
  const measure = canvas.getContext("2d");
  const blocks = [];
  const add = (text, font, color, gap) => {
    measure.font = font;
    for (const line of wrapText(measure, text, inner)) blocks.push({ text: line, font, color, size: Number.parseInt(font.match(/(\d+)px/u)[1], 10), gap: 0 });
    if (blocks.length) blocks[blocks.length - 1].gap = gap;
  };
  add(card.title, `700 44px ${serif}`, token("--ink"), 8);
  add(card.subtitle, `400 24px ${sans}`, token("--muted"), 28);
  for (const member of card.members) add(member, `500 28px ${sans}`, token("--ink"), 12);
  for (const group of card.groups) {
    blocks[blocks.length - 1].gap = 32;
    add(group.title, `700 28px ${serif}`, token("--accent"), 14);
    for (const row of group.rows) add(row, `400 24px ${sans}`, token("--ink-2"), 10);
  }
  blocks[blocks.length - 1].gap = 36;
  add(card.footer, `400 20px ${sans}`, token("--muted"), 0);
  const height = pad * 2 + blocks.reduce((total, block) => total + Math.round(block.size * 1.3) + block.gap, 0);
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = token("--panel");
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = token("--accent");
  ctx.fillRect(0, 0, width, 12);
  ctx.textBaseline = "top";
  let y = pad;
  for (const block of blocks) {
    ctx.font = block.font;
    ctx.fillStyle = block.color;
    ctx.fillText(block.text, pad, y);
    y += Math.round(block.size * 1.3) + block.gap;
  }
  return canvas;
}

/* ---------- Khởi tạo section ---------- */

/**
 * @param deps {heroesDict, tacticsDict, booksDict, loadRecommended: () => Promise<model>,
 *   teamHref: (record) => string|null, onNavigate?: (event) => void}
 */
export function initAnalyze(deps, mount) {
  const configured = isAnalyzeConfigured();
  const zh = currentLocale() === "zh";
  const indexes = {
    heroes: createEntityIndex(deps.heroesDict, "hero"),
    tactics: createEntityIndex(deps.tacticsDict, "tactic"),
    books: createEntityIndex(deps.booksDict || [], "book"),
  };
  const INDEX_BY_KIND = { hero: indexes.heroes, tactic: indexes.tactics, book: indexes.books };
  const tacticIdOf = createTacticIdResolver(deps.tacticsDict);
  const resolveRaw = zh ? createRawNameResolver(deps.heroesDict, deps.tacticsDict, deps.booksDict || []) : null;

  /** Nhãn hiển thị của một mục từ điển: bản vi tên Việt chuẩn, bản zh chữ Hán gốc. */
  const recordLabel = (record) => (zh ? (record.chinese || "").trim() || record.viet : record.viet);
  /** Tên của một ID; ID ngoài từ điển (tên chỉ có trong đội tham chiếu) dùng tên nguồn. */
  const nameOf = (kind, id, fallbackVi = "", fallbackRaw = "") => {
    const record = id ? INDEX_BY_KIND[kind].byId.get(id) : null;
    if (record) return recordLabel(record);
    if (!zh) return kind === "tactic" ? tacticDisplayName(fallbackVi) : fallbackVi;
    return fallbackRaw || localName(fallbackVi, resolveRaw);
  };
  const hasId = (id) => {
    const kind = String(id).split(":")[0];
    return Boolean(INDEX_BY_KIND[kind]?.byId.has(id));
  };
  // Datalist mỗi loại: nhãn -> ID (nhãn trùng giữ mục đầu), sắp theo nhãn.
  const optionLabels = {};
  const datalists = Object.entries(INDEX_BY_KIND).map(([kind, index]) => {
    const labels = new Map();
    for (const [id, record] of index.byId) {
      const label = recordLabel(record);
      if (label && !labels.has(label)) labels.set(label, id);
    }
    optionLabels[kind] = labels;
    const sorted = [...labels.keys()].sort((a, b) => a.localeCompare(b, zh ? "zh" : "vi"));
    return el("datalist", { id: `ana-${kind}-options` }, sorted.map((label) => el("option", { value: label })));
  });

  // `generation` huỷ lượt nén ảnh/đọc Worker cũ; `compareGeneration` chỉ huỷ lượt đối chiếu cũ (đổi phe,
  // ảnh mới), để đổi phe khi đang chờ Worker không làm mất kết quả đọc.
  let generation = 0;
  let compareGeneration = 0;
  let draft = emptyDraft();
  let draftFromImage = false;
  let compared = null; // {team, season, standard, other} của lần đối chiếu đang hiện
  // Lượt đọc ảnh đang giữ: {id, screen, imageDataUrl, active, sides: Map<side, {heroes, initial, draft, statsSent, sampleSent}>}.
  // Mỗi phe giữ draft riêng đã sửa trong phiên; `initial` là bản AI đọc gốc để đo số ô phải sửa.
  let scan = null;
  let scanSeq = 0;
  let model = null;
  let historyEntries = readHistory(localStore());
  const state = { imageDataUrl: null, fileName: "", token: null, busy: false, done: false };

  /* ----- Thẻ 1: chọn ảnh ----- */
  const drop = el("button", { type: "button", class: "ana-drop" }, [
    el("span", { class: "ana-drop-icon", "aria-hidden": "true" }, [uploadIcon()]),
    el("span", { class: "ana-drop-text" }, [
      el("span", { class: "ana-drop-title" }, L("Kéo thả ảnh, dán (Ctrl+V) hoặc bấm để chọn", "拖放图片、粘贴（Ctrl+V）或点击选择")),
      el("span", { class: "ana-drop-note" }, L("PNG, JPEG hoặc WebP · nên crop chỉ phần đội hình", "PNG、JPEG 或 WebP · 建议只裁剪阵容部分")),
    ]),
  ]);
  // Hai loại ảnh Worker đọc được (sơ đồ ô tướng, không phải ảnh mẫu).
  const kindSlots = (groups) => el("span", { class: "ana-kind-slots", "aria-hidden": "true" },
    Array.from({ length: groups }, () => el("span", { class: "ana-kind-group" }, [el("span", {}), el("span", {}), el("span", {})])));
  const kinds = el("div", { class: "ana-kinds" }, [
    el("h3", { class: "ana-kinds-title" }, L("Ảnh đọc được", "可识别的截图")),
    el("ul", { class: "ana-kinds-list" }, [
      el("li", { class: "ana-kind" }, [kindSlots(1), el("span", { class: "ana-kind-text" }, [
        el("span", { class: "ana-kind-name" }, L("Màn đội hình", "阵容画面")),
        el("span", { class: "ana-kind-note" }, L("3 tướng của 1 đội — nạp thẳng vào bước Kiểm tra.", "一支队伍的 3 名武将——直接进入核对步骤。")),
      ])]),
      el("li", { class: "ana-kind" }, [kindSlots(2), el("span", { class: "ana-kind-text" }, [
        el("span", { class: "ana-kind-name" }, L("Màn chiến báo", "战报画面")),
        el("span", { class: "ana-kind-note" }, L("2 phe trong 1 ảnh — đọc cả hai, bạn chọn phe muốn soi.", "一张图包含双方——两方都会识别，由您选择要核对的一方。")),
      ])]),
    ]),
  ]);
  const howItWorks = el("ol", { class: "ana-how", "aria-label": L("Cách hoạt động", "工作方式") }, [
    [L("AI chỉ chép chữ trong ảnh", "AI 只抄录图中文字"), L("Tên tướng, chiến pháp, binh thư in trên màn hình; không đoán theo chân dung.", "抄录画面上印出的武将、战法、兵书名称；不根据头像猜测。")],
    [L("Bạn xác nhận từng ô", "由您逐格确认"), L("Ô chắc chắn tự điền; ô “Không chắc” có tối đa 3 gợi ý để chọn.", "确定的格自动填好；“不确定”的格最多给出 3 个建议供选择。")],
    [L("Đối chiếu trên máy", "在本机比对"), L("So với Đội chuẩn của mùa bạn chọn và Đội khác, chỉ ra ô lệch.", "与所选赛季的推荐阵容及其他阵容比对，标出不同的格。")],
  ].map(([title, note], index) => el("li", { class: "ana-how-step" }, [
    el("span", { class: "ana-how-num", "aria-hidden": "true" }, String(index + 1)),
    el("span", { class: "ana-how-text" }, [el("span", { class: "ana-how-title" }, title), el("span", { class: "ana-how-note" }, note)]),
  ])));
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
  const manualBtn = el("button", { class: "ana-btn ana-manual", type: "button" }, L("Nhập tay", "手动输入"));
  const status = el("p", { class: "ana-status", role: "status" });

  const steps = [
    { label: L("Nén ảnh", "压缩图片"), done: () => Boolean(state.imageDataUrl) },
    { label: L("Xác thực chống bot", "人机验证"), done: () => Boolean(state.token) },
    { label: L("Soi đội và đối chiếu", "识别阵容并比对"), doneLabel: L("Đã đọc xong — kiểm tra lại kết quả đã đọc", "识别完成——请核对识别结果"), done: () => state.done },
  ].map((step) => {
    const labelNode = el("span", {}, step.label);
    // Dấu ✓ nằm trong span bọc: `hidden` chỉ có tác dụng trên phần tử HTML, không trên chính SVG.
    const markWrap = el("span", { class: "ana-step-mark", "aria-hidden": "true" }, [checkIcon()]);
    const node = el("li", { class: "ana-step" }, [markWrap, labelNode]);
    return { ...step, node, markWrap, labelNode };
  });
  const stepList = el("ol", { class: "ana-steps", "aria-label": L("Trạng thái", "状态") }, steps.map((step) => step.node));

  const pickCard = el("section", { class: "ana-card ana-pick" }, [
    el("h2", { class: "ana-card-title" }, L("1 · Chọn ảnh", "1 · 选择图片")),
    ...(configured
      ? [
          drop,
          fileInput,
          fileRow,
          kinds,
          el("p", { class: "tool-notice" }, [
            el("span", { class: "tool-notice-icon", "aria-hidden": "true" }, [shieldIcon()]),
            el("span", { class: "ana-disclaimer-text" }, DISCLAIMER),
          ]),
          tsBox,
          el("div", { class: "ana-pick-actions" }, [analyzeBtn, manualBtn]),
          status,
          stepList,
          howItWorks,
        ]
      : [
          // Worker chưa cấu hình: chỉ tắt phần đọc ảnh; nhập tay, link chia sẻ và lịch sử vẫn dùng được.
          el("div", { class: "ana-setup" }, [
            el("p", {}, L("Tính năng soi đội chưa được cấu hình.", "“截图识阵”功能尚未配置。")),
            el("p", { class: "ana-note" }, L("Cần deploy Worker (worker/) + điền workerUrl & turnstileSiteKey trong js/config.js.", "需部署 Worker（worker/），并在 js/config.js 中填写 workerUrl 与 turnstileSiteKey。")),
          ]),
          el("div", { class: "ana-pick-actions" }, [manualBtn]),
          status,
        ]),
  ]);

  /* ----- Lịch sử trên máy ----- */
  const historyList = el("ol", { class: "ana-history-list" });
  const historyClear = el("button", { type: "button", class: "tool-text-action" }, L("Xoá lịch sử", "清除记录"));
  const historyCard = el("section", { class: "ana-card ana-history", hidden: "" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, L("Lịch sử trên máy", "本机记录")),
      historyClear,
    ]),
    el("p", { class: "ana-note" }, L("Tối đa 10 đội đã đối chiếu, chỉ lưu trên trình duyệt này; không lưu ảnh.", "最多保存 10 支已比对的阵容，仅存于本浏览器，不保存图片。")),
    historyList,
  ]);

  /* ----- Chọn phe (ảnh có 2 phe) ----- */
  const SIDE_LABELS = {
    left: L("Phe trái · ta", "左侧 · 我方"),
    right: L("Phe phải · đối thủ", "右侧 · 对手"),
  };
  const sideChooser = el("div", { class: "ana-side-options", role: "radiogroup", "aria-label": L("Chọn phe cần soi", "选择要识别的一方") });
  const sideRun = el("button", { type: "button", class: "ana-btn primary ana-side-run", disabled: "" }, L("Soi phe này", "识别这一方"));
  const sideCard = el("section", { class: "ana-card ana-side-pick", hidden: "" }, [
    el("h2", { class: "ana-card-title" }, L("2 · Chọn phe", "2 · 选择一方")),
    el("p", { class: "ana-note" }, L(
      "Ảnh có cả hai phe. Chọn phe muốn soi; có thể đổi sang phe kia sau mà không cần đọc lại ảnh.",
      "截图包含双方。请选择要识别的一方；之后可切换到另一方，无需重新读取图片。",
    )),
    sideChooser,
    sideRun,
  ]);
  let chosenSide = null;
  const sideSwitch = el("div", { class: "ana-side-switch", role: "group", "aria-label": L("Đổi phe", "切换一方"), hidden: "" });

  /* ----- Thẻ 2: editor xác nhận ----- */
  const editorGrid = el("div", { class: "ana-editor-grid" });
  const seasonSelect = el("select", { id: "ana-season", class: "ana-input", disabled: "" }, [
    el("option", { value: "" }, L("Đang tải mùa…", "正在加载赛季…")),
  ]);
  const compareBtn = el("button", { type: "button", class: "ana-btn primary ana-compare-run", disabled: "" }, L("Đối chiếu", "比对"));
  const readyNote = el("p", { class: "ana-note ana-ready-note", role: "status" });
  const resetBtn = el("button", { type: "button", class: "tool-text-action" }, L("Xoá hết", "全部清空"));
  // Tóm tắt lượt đọc: đếm ô theo trạng thái + nút tới từng ô còn phải xác nhận.
  const summaryCounts = el("ul", { class: "ana-summary-counts", "aria-label": L("Tình trạng các ô", "各格状态") });
  const summaryTodo = el("ul", { class: "ana-summary-todo" });
  const summaryTodoTitle = el("h3", { class: "ana-summary-title" });
  const summary = el("div", { class: "ana-summary", hidden: "" }, [
    summaryCounts,
    el("div", { class: "ana-summary-pending" }, [summaryTodoTitle, summaryTodo]),
  ]);
  const progressValue = el("span", { class: "ana-progress-value" });
  const progressBar = el("span", { class: "ana-progress-bar", role: "meter", "aria-valuemin": "0", "aria-valuemax": "12", "aria-labelledby": "ana-progress-label" },
    Array.from({ length: 12 }, () => el("span", { class: "ana-progress-seg" })));
  const progress = el("div", { class: "ana-progress" }, [
    el("span", { class: "ana-progress-head" }, [el("span", { id: "ana-progress-label", class: "ana-progress-label" }, L("Đã xác nhận", "已确认")), progressValue]),
    progressBar,
  ]);
  const editorCard = el("section", { class: "ana-card ana-editor", hidden: "" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, L("2 · Kiểm tra đội", "2 · 核对阵容")),
      resetBtn,
    ]),
    sideSwitch,
    el("p", { class: "ana-note" }, L(
      "Sửa mọi ô cho đúng game. Ô “Không chắc” chọn một gợi ý hoặc gõ lại; ô chiến pháp, binh thư có thể để trống.",
      "请将各格改为与游戏一致。“不确定”的格可点选建议或重新输入；战法、兵书格可留空。",
    )),
    summary,
    editorGrid,
    el("div", { class: "ana-editor-foot" }, [
      progress,
      el("label", { class: "ana-season", for: "ana-season" }, [L("Mùa đối chiếu", "比对赛季"), seasonSelect]),
      readyNote,
      compareBtn,
    ]),
    ...datalists,
  ]);

  /* ----- Gửi ảnh tự nguyện (chỉ khi người dùng bấm) ----- */
  const sampleConsent = el("input", { type: "checkbox", class: "ana-sample-check" });
  const sampleSend = el("button", { type: "button", class: "ana-btn ana-sample-send", disabled: "" }, L("Gửi ảnh này", "发送这张图片"));
  const sampleNote = el("p", { class: "ana-note ana-sample-note", role: "status" });
  const sampleLogin = el("div", { class: "ana-sample-login", hidden: "" });
  const sampleControls = el("div", { class: "ana-sample-controls" }, [
    el("label", { class: "ana-sample-consent" }, [
      sampleConsent,
      el("span", {}, L(
        "Tôi đồng ý gửi ảnh này cùng đội đã xác nhận cho quản trị viên để cải thiện AI đọc ảnh. Chỉ quản trị viên xem; nên che tên tài khoản trong ảnh trước khi gửi.",
        "我同意将这张图片及已确认的阵容发送给管理员，用于改进 AI 识图。仅管理员可见；发送前建议遮住图片中的账号名称。",
      )),
    ]),
    sampleSend,
  ]);
  const sampleBox = el("section", { class: "ana-sample", hidden: "" }, [
    el("h3", { class: "ana-group-title" }, L("Giúp AI đọc đúng hơn", "帮助 AI 读得更准")),
    el("p", { class: "ana-note" }, L(
      "Tuỳ chọn. Ảnh chỉ được lưu khi bạn bấm gửi và được quản trị viên duyệt trước khi dùng.",
      "可选。只有您点击发送才会保存图片，且需管理员审核后才会使用。",
    )),
    sampleLogin,
    sampleControls,
    sampleNote,
  ]);
  let sampleKey = "";
  let sampleUser; // undefined = chưa hỏi phiên; null = chưa đăng nhập
  let sampleAsked = false;
  let sampleBusy = false;

  /* ----- Thẻ 3: đối chiếu ----- */
  const compareBody = el("div", { class: "ana-compare-body" });
  const compareSub = el("span", { class: "rt-sub" });
  const shareBtn = el("button", { type: "button", class: "ana-btn ana-share" }, L("Chép link", "复制链接"));
  const pngBtn = el("button", { type: "button", class: "ana-btn ana-png" }, L("Tải ảnh PNG", "下载 PNG 图片"));
  const shareNote = el("p", { class: "ana-note ana-share-note", role: "status" });
  const compareCard = el("section", { class: "ana-card ana-compare", hidden: "" }, [
    el("header", { class: "ana-card-head" }, [
      el("h2", { class: "ana-card-title" }, L("3 · Đội có sẵn tương tự", "3 · 相似的现有队伍")),
      compareSub,
    ]),
    el("div", { class: "ana-compare-actions" }, [shareBtn, pngBtn]),
    shareNote,
    compareBody,
    sampleBox,
  ]);

  // Dải 3 bước của cả trang (khác `.ana-steps` là tiến độ đọc ảnh trong thẻ 1).
  const flowSteps = [L("Chọn ảnh", "选择图片"), L("Kiểm tra đội", "核对阵容"), L("Đối chiếu", "比对")].map((label, index) => {
    const mark = el("span", { class: "ana-flow-mark", "aria-hidden": "true" }, String(index + 1));
    return { node: el("li", { class: "ana-flow-step" }, [mark, el("span", { class: "ana-flow-label" }, label)]), mark, index };
  });
  const flow = el("ol", { class: "ana-flow", "aria-label": L("Các bước", "步骤") }, flowSteps.map((step) => step.node));
  const head = el("header", { class: "tool-head" }, [
    el("div", { class: "reference-head-text" }, [
      el("span", { class: "reference-kicker" }, L("Công cụ · Beta", "工具 · Beta")),
      el("h1", { class: "reference-title", tabindex: "-1" }, L("Soi đội từ ảnh", "截图识阵")),
      el("p", { class: "reference-lead" }, L(
        "Chụp màn hình đội hình hoặc nhập tay, kiểm tra từng ô rồi đối chiếu với Đội chuẩn theo mùa và Đội khác.",
        "截取阵容画面或手动输入，逐格核对后与当季推荐阵容及其他阵容比对。",
      )),
    ]),
    flow,
  ]);
  const layout = el("div", { class: "ana-layout", dataset: { stage: "pick" } });

  /** Bước hiện tại theo thẻ đang hiện: đã có kết quả → 3, đang sửa đội/chọn phe → 2, còn lại → 1. */
  function paintStage() {
    const current = !compareCard.hidden ? 2 : !editorCard.hidden || !sideCard.hidden ? 1 : 0;
    layout.dataset.stage = current === 0 ? "pick" : "work";
    for (const step of flowSteps) {
      const stateName = step.index < current ? "done" : step.index === current ? "current" : "todo";
      step.node.dataset.state = stateName;
      if (stateName === "current") step.node.setAttribute("aria-current", "step");
      else step.node.removeAttribute("aria-current");
      step.mark.replaceChildren(stateName === "done" ? checkIcon() : String(step.index + 1));
    }
  }
  const stageObserver = new MutationObserver(paintStage);
  for (const card of [sideCard, editorCard, compareCard]) stageObserver.observe(card, { attributes: true, attributeFilter: ["hidden"] });

  function setStatus(msg, kind = "") {
    status.className = `ana-status ${kind}`.trim();
    status.textContent = msg || "";
  }

  /** Trạng thái thẻ 1 vẽ tại chỗ: nút chạy, hàng ảnh đã chọn và danh sách bước. */
  function paintPick() {
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

  /* ----- Editor ----- */
  const memberTitle = (index) => L(`Tướng ${index + 1}`, `武将 ${index + 1}`);
  const FIELD_LABELS = {
    hero: L("Tướng", "武将"),
    tactic: [L("Chiến pháp A", "战法 A"), L("Chiến pháp B", "战法 B")],
    book: L("Binh thư", "兵书"),
  };
  let cellViews = [];

  function readCell(ref) {
    const member = draft.heroes[ref.heroIndex];
    return ref.kind === "tactic" ? member.tactics[ref.slotIndex] : member[ref.kind];
  }

  function writeCell(ref, cell) {
    const member = draft.heroes[ref.heroIndex];
    if (ref.kind === "tactic") member.tactics[ref.slotIndex] = cell;
    else member[ref.kind] = cell;
  }

  /** Chữ hiện trong ô: ID chắc -> nhãn; chữ đọc được chưa khớp -> nguyên văn (trừ `未知`). */
  function cellText(kind, cell) {
    if (cell.id) return nameOf(kind, cell.id);
    return cell.raw && cell.raw !== "未知" ? cell.raw : "";
  }

  function cellView(ref) {
    const kind = ref.kind;
    const label = kind === "tactic" ? FIELD_LABELS.tactic[ref.slotIndex] : FIELD_LABELS[kind];
    const input = el("input", {
      class: "ana-input ana-cell-input",
      type: "text",
      list: `ana-${kind}-options`,
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": `${memberTitle(ref.heroIndex)} · ${label}`,
    });
    const flag = el("span", { class: "ana-cell-flag", hidden: "" });
    const raw = el("span", { class: "ana-cell-raw", hidden: "" });
    const candidates = el("div", { class: "ana-candidates", hidden: "" });
    const clear = kind === "hero"
      ? null
      : el("button", { type: "button", class: "tool-text-action ana-cell-clear", hidden: "" }, L("Để trống", "留空"));
    const fixTitle = el("span", { class: "ana-cell-fix-title", hidden: "" }, L("Gợi ý gần nhất", "最接近的建议"));
    const node = el("div", { class: "ana-cell", dataset: { kind } }, [
      el("div", { class: "ana-cell-head" }, [el("span", { class: "ana-cell-label" }, label), flag]),
      el("div", { class: "ana-cell-field" }, [
        input,
        el("span", { class: "ana-cell-ok", "aria-hidden": "true" }, [checkIcon()]),
      ]),
      raw,
      fixTitle,
      el("div", { class: "ana-cell-fix" }, [candidates, clear]),
    ]);
    const view = { ref, node, input, label, paint };

    function paint() {
      const cell = readCell(ref);
      node.dataset.state = cell.state;
      const flagged = cell.state === "unsure" || cell.state === "unknown" || (kind === "hero" && cell.state === "empty");
      flag.hidden = !flagged;
      flag.replaceChildren(...(flagged ? [alertIcon(), cell.state === "empty" ? L("Chưa chọn", "未选择") : CELL_FLAGS[cell.state]] : []));
      input.setAttribute("aria-invalid", flagged ? "true" : "false");
      // Chữ Worker chép được giữ để đối chiếu với ảnh khi ô chưa khớp chắc.
      const showRaw = draftFromImage && cell.raw && cell.state !== "sure" && cell.state !== "empty";
      raw.hidden = !showRaw;
      raw.textContent = showRaw ? L(`Đọc được: ${cell.raw}`, `识别到：${cell.raw}`) : "";
      candidates.hidden = !cell.candidates.length;
      fixTitle.hidden = !cell.candidates.length;
      candidates.replaceChildren(...cell.candidates.map((id) =>
        el("button", {
          type: "button",
          class: "ana-candidate",
          onclick: () => {
            writeCell(ref, sureCell(id, cell.raw));
            input.value = nameOf(kind, id);
            paint();
            paintReady();
            input.focus();
          },
        }, nameOf(kind, id)),
      ));
      if (clear) clear.hidden = !(cell.state === "unsure" || cell.state === "unknown");
    }

    const update = (commit) => {
      const value = input.value.trim();
      // Đang gõ dở: chỉ cập nhật khi khớp đúng một nhãn hoặc xoá trống; `change` (rời ô) mới khớp mờ.
      if (!commit && value && !optionLabels[kind].has(value)) return;
      writeCell(ref, cellFromInput(value, INDEX_BY_KIND[kind], optionLabels[kind]));
      paint();
      paintReady();
    };
    input.addEventListener("input", () => update(false));
    input.addEventListener("change", () => update(true));
    clear?.addEventListener("click", () => {
      writeCell(ref, emptyCell());
      input.value = "";
      paint();
      paintReady();
      input.focus();
    });
    return view;
  }

  /** Dựng lại toàn bộ editor từ `draft` (ảnh mới, nhập tay, link, lịch sử). */
  function renderEditor() {
    cellViews = [];
    editorGrid.replaceChildren(...draft.heroes.map((member, heroIndex) => {
      const refs = [
        { heroIndex, kind: "hero" },
        ...member.tactics.map((_, slotIndex) => ({ heroIndex, kind: "tactic", slotIndex })),
        { heroIndex, kind: "book" },
      ];
      const views = refs.map(cellView);
      cellViews.push(...views);
      for (const view of views) {
        view.input.value = cellText(view.ref.kind, readCell(view.ref));
        view.paint();
      }
      return el("fieldset", { class: "ana-member" }, [
        el("legend", { class: "ana-member-title visually-hidden" }, memberTitle(heroIndex)),
        el("div", { class: "ana-member-head" }, [
          el("span", { class: "ana-member-seal", "aria-hidden": "true" }),
          el("span", { class: "ana-member-eyebrow", "aria-hidden": "true" }, memberTitle(heroIndex)),
          el("span", { class: "ana-member-name" }),
          el("span", { class: "ana-member-tally" }),
        ]),
        ...views.map((view) => view.node),
      ]);
    }));
    editorCard.hidden = false;
    paintReady();
  }

  const isPending = (view) => {
    const cell = readCell(view.ref);
    return view.ref.kind === "hero" ? cell.state !== "sure" : cell.state === "unsure" || cell.state === "unknown";
  };
  const pendingFlag = (cell) => (cell.state === "empty" ? L("Chưa chọn", "未选择") : CELL_FLAGS[cell.state]);

  /** Đầu thẻ mỗi tướng: ấn phe chữ Hán, tên đã chọn và số ô còn phải xác nhận. */
  function paintMembers() {
    for (const fieldset of editorGrid.children) {
      const heroIndex = [...editorGrid.children].indexOf(fieldset);
      const views = cellViews.filter((view) => view.ref.heroIndex === heroIndex);
      const heroCell = draft.heroes[heroIndex].hero;
      const record = heroCell.state === "sure" ? INDEX_BY_KIND.hero.byId.get(heroCell.id) : null;
      const pending = views.filter(isPending).length;
      const states = views.filter(isPending).map((view) => readCell(view.ref).state);
      // Tướng còn trống (nhập tay) chỉ là việc phải làm; ô AI đọc chưa khớp mới tô cờ.
      fieldset.dataset.state = !pending ? "ok" : states.includes("unknown") ? "unknown" : states.includes("unsure") ? "unsure" : "todo";
      const seal = fieldset.querySelector(".ana-member-seal");
      seal.dataset.faction = (record && FACTION_CODE[record.faction]) || "none";
      seal.textContent = record ? [...String(record.chinese || "").replace(/^SP\s*/u, "").trim()][0] || "?" : "?";
      seal.lang = "zh-Hant";
      const name = fieldset.querySelector(".ana-member-name");
      name.textContent = record ? recordLabel(record) : L("Chưa xác định", "未确定");
      name.dataset.empty = String(!record);
      fieldset.querySelector(".ana-member-tally").textContent = pending
        ? L(`${pending} ô cần xem`, `${pending} 格待确认`)
        : L(`${views.length}/${views.length} ổn`, `${views.length}/${views.length} 已确认`);
    }
  }

  /** Tóm tắt lượt đọc ảnh: đếm ô theo trạng thái và nút tới từng ô còn phải xác nhận. */
  function paintSummary() {
    summary.hidden = !draftFromImage;
    if (summary.hidden) return;
    const cells = cellViews.map((view) => ({ view, cell: readCell(view.ref) }));
    const count = (test) => cells.filter(test).length;
    const counts = [
      ["sure", L("Khớp", "一致"), count(({ cell }) => cell.state === "sure")],
      ["empty", L("Để trống", "留空"), count(({ view, cell }) => view.ref.kind !== "hero" && cell.state === "empty")],
      ["unsure", CELL_FLAGS.unsure, count(({ cell }) => cell.state === "unsure")],
      ["unknown", CELL_FLAGS.unknown, count(({ view, cell }) => cell.state === "unknown" || (view.ref.kind === "hero" && cell.state === "empty"))],
    ];
    summaryCounts.replaceChildren(...counts.map(([key, label, value]) =>
      el("li", { class: "ana-summary-count", dataset: { state: key } }, [el("strong", {}, String(value)), el("span", {}, label)])));
    const pending = cells.filter(({ view }) => isPending(view));
    summaryTodoTitle.textContent = pending.length
      ? L(`Cần bạn xác nhận ${pending.length} ô trước khi đối chiếu`, `比对前还需确认 ${pending.length} 格`)
      : L("Mọi ô đã xác nhận — có thể đối chiếu.", "所有格均已确认——可以比对。");
    summaryTodo.replaceChildren(...pending.map(({ view, cell }) => el("li", {}, [
      el("button", {
        type: "button",
        class: "ana-summary-jump",
        dataset: { state: cell.state === "unsure" ? "unsure" : "unknown" },
        onclick: () => {
          view.node.scrollIntoView({ block: "center", behavior: "smooth" });
          view.input.focus({ preventScroll: true });
        },
      }, [
        el("span", { class: "ana-summary-where" }, `${memberTitle(view.ref.heroIndex)} · ${view.label}`),
        el("span", { class: "ana-summary-why" }, [
          pendingFlag(cell),
          cell.raw && cell.raw !== "未知" ? L(` · đọc được ${cell.raw}`, ` · 识别到 ${cell.raw}`) : "",
        ]),
        el("span", { class: "ana-summary-go", "aria-hidden": "true" }, [arrowDownIcon()]),
      ]),
    ])));
  }

  /** Nút Đối chiếu khoá tới khi đủ 3 tướng và không còn ô "không chắc"/"không rõ". */
  function paintReady() {
    const ready = draftReady(draft);
    const pending = draft.heroes.reduce((total, member) =>
      total + (member.hero.state === "sure" ? 0 : 1) +
      [...member.tactics, member.book].filter((cell) => cell.state === "unsure" || cell.state === "unknown").length, 0);
    compareBtn.disabled = !ready;
    readyNote.textContent = ready
      ? ""
      : L(`Còn ${pending} ô cần xác nhận trước khi đối chiếu.`, `还有 ${pending} 格需确认后才能比对。`);
    const total = cellViews.length;
    const confirmed = total - pending;
    progressValue.textContent = `${confirmed}/${total}`;
    progressBar.setAttribute("aria-valuemax", String(total));
    progressBar.setAttribute("aria-valuenow", String(confirmed));
    progressBar.setAttribute("aria-valuetext", L(`${confirmed} trên ${total} ô`, `${total} 格中已确认 ${confirmed} 格`));
    [...progressBar.children].forEach((segment, index) => { segment.dataset.on = String(index < confirmed); });
    paintMembers();
    paintSummary();
  }

  /* ----- Mùa + dữ liệu Đội chuẩn ----- */
  let modelPending = null;
  function ensureModel() {
    if (model) return Promise.resolve(model);
    if (!modelPending) {
      modelPending = Promise.resolve()
        .then(() => deps.loadRecommended())
        .then((loaded) => {
          model = loaded;
          fillSeasons();
          return model;
        })
        .catch(() => {
          modelPending = null;
          seasonSelect.replaceChildren(el("option", { value: "" }, L("Không tải được mùa", "无法加载赛季")));
          return null;
        });
    }
    return modelPending;
  }

  function currentSeason() {
    if (!model) return null;
    return readRecommendedQuery(location.href, model.seasons || {}).season;
  }

  function fillSeasons() {
    const registry = model.seasons || {};
    const options = (registry.seasonOptions || []).filter((option) => option.sourceSeasonId);
    seasonSelect.replaceChildren(
      ...options.map((option) => el("option", { value: option.sourceSeasonId }, seasonOptionText(option))),
      el("option", { value: "all" }, L("Tất cả mùa", "全部赛季")),
    );
    const wanted = currentSeason();
    seasonSelect.value = [...seasonSelect.options].some((option) => option.value === wanted)
      ? wanted
      : registry.defaultSourceSeasonId || seasonSelect.options[0]?.value || "all";
    seasonSelect.disabled = false;
    // Nhãn mùa của lịch sử có sau khi registry nạp xong.
    renderHistory();
  }

  const seasonLabel = (season) => {
    if (season === "all") return L("Tất cả mùa", "全部赛季");
    const option = model?.seasons?.seasonOptions?.find((item) => item.sourceSeasonId === season);
    return option ? seasonOptionText(option) : season || "";
  };

  /** URL của trang mang đúng `season` + `doi` (không ảnh, không token). */
  function writeUrl(changes, push = false) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(changes)) {
      url.searchParams.delete(key);
      if (value) url.searchParams.set(key, value);
    }
    if (url.href === location.href) return;
    if (push) window.history.pushState(window.history.state, "", url);
    else window.history.replaceState(window.history.state, "", url);
  }

  /* ----- Kết quả đối chiếu ----- */
  const recordName = (record) => {
    const reference = referenceTeam(record);
    const heroNames = () => reference.slots.map((slot) => nameOf("hero", slot.alternatives[0]?.canonicalId, slot.name, slot.raw)).filter(Boolean).join(" · ");
    if (record.sourceConfigId) return zh ? record.nameZh || heroNames() : record.displayNameVi || heroNames();
    return zh ? heroNames() : record.name || heroNames();
  };

  const hitsText = (diff) => [
    L(`${diff.heroHit}/${diff.heroTotal} tướng`, `${diff.heroHit}/${diff.heroTotal} 名武将`),
    L(`${diff.tacticHit}/${diff.tacticTotal} chiến pháp`, `${diff.tacticHit}/${diff.tacticTotal} 个战法`),
    ...(diff.bookDiff ? [L(`${diff.bookDiff} binh thư lệch`, `${diff.bookDiff} 本兵书不同`)] : []),
  ].join(" · ");

  function diffList(diff) {
    const items = diff.heroes.map((hero) => {
      const tactics = hero.tactics.map((tactic) =>
        el("span", { class: "ana-diff-tac", dataset: { status: tactic.status }, title: TACTIC_STATUS_TITLES[tactic.status] },
          [tactic.status === "match" ? checkIcon() : null, tactic.id ? nameOf("tactic", tactic.id) : TACTIC_STATUS_TITLES.empty]));
      const missing = hero.missingTactics.length
        ? el("span", { class: "ana-diff-missing" }, L(
            `Đội dùng: ${hero.missingTactics.map((entry) => nameOf("tactic", entry.ids[0], entry.name, entry.raw)).join(", ")}`,
            `阵容使用：${hero.missingTactics.map((entry) => nameOf("tactic", entry.ids[0], entry.name, entry.raw)).join("、")}`,
          ))
        : null;
      const bookLabel = BOOK_STATUS_LABELS[hero.book.status];
      const book = bookLabel
        ? el("span", { class: "ana-diff-book", dataset: { status: hero.book.status } }, hero.book.status === "match"
            ? bookLabel
            : `${bookLabel}: ${nameOf("book", hero.book.expected.ids[0], hero.book.expected.name, hero.book.expected.raw)}`)
        : null;
      return el("li", { class: "ana-diff-hero", dataset: { status: hero.status } }, [
        el("span", { class: "ana-diff-name" }, [
          nameOf("hero", hero.hero),
          hero.status === "extra" ? el("span", { class: "ana-diff-extra" }, L(" · thừa", " · 多出")) : null,
        ]),
        el("span", { class: "ana-diff-tacs" }, tactics),
        missing,
        book,
      ]);
    });
    if (diff.missingHeroes.length) {
      items.push(el("li", { class: "ana-diff-hero", dataset: { status: "missing" } }, L(
        `Thiếu tướng: ${diff.missingHeroes.map((hero) => nameOf("hero", hero.id, hero.name, hero.raw)).join(", ")}`,
        `缺少武将：${diff.missingHeroes.map((hero) => nameOf("hero", hero.id, hero.name, hero.raw)).join("、")}`,
      )));
    }
    // Đầu cột cho mắt (đọc màn hình đã có nhãn trong từng ô qua `title`/chữ).
    const head = el("li", { class: "ana-diff-head", "aria-hidden": "true" }, [
      el("span", {}, FIELD_LABELS.hero), el("span", {}, FIELD_LABELS.tactic[0]), el("span", {}, FIELD_LABELS.tactic[1]), el("span", {}, FIELD_LABELS.book),
    ]);
    return el("ul", { class: "ana-diff" }, [head, ...items]);
  }

  function teamRow({ record, diff }) {
    const href = deps.teamHref?.(record) || null;
    const name = recordName(record);
    const link = href
      ? el("a", { class: "ana-team-link", href, onclick: (event) => deps.onNavigate?.(event) }, name)
      : el("span", { class: "ana-team-link" }, name);
    const full = diff.heroHit === diff.heroTotal && diff.tacticHit === diff.tacticTotal && !diff.bookDiff;
    return el("li", { class: "ana-team-row", dataset: { teamId: record.sourceConfigId || record.legacyTeamId || record.id || "", full: String(full) } }, [
      el("div", { class: "ana-team-head" }, [
        full ? el("span", { class: "ana-team-full" }, [checkIcon(), L("Khớp trọn", "完全一致")]) : null,
        link,
      ]),
      el("span", { class: `ana-team-hits${full ? " full" : ""}` }, hitsText(diff)),
      diffList(diff),
    ]);
  }

  function group(title, matches, empty, className) {
    return el("section", { class: `ana-group ${className}` }, [
      el("h3", { class: "ana-group-title" }, title),
      matches.length ? el("ol", { class: "ana-teams" }, matches.map(teamRow)) : el("p", { class: "ana-note" }, empty),
    ]);
  }

  /**
   * Đối chiếu đội đã xác nhận. `save` = người dùng bấm Đối chiếu (ghi lịch sử); mở link/lịch sử thì
   * chỉ dựng lại, không ghi thêm. Không bao giờ gọi Worker.
   */
  async function runCompare({ save = false, push = false } = {}) {
    const team = confirmedTeam(draft);
    if (!team) return;
    const started = ++compareGeneration;
    compareCard.hidden = false;
    shareNote.textContent = "";
    compareSub.textContent = "";
    compareBody.replaceChildren(el("p", { class: "ana-note" }, L("Đang tải dữ liệu đội…", "正在加载阵容数据…")));
    const loaded = await ensureModel();
    if (started !== compareGeneration) return;
    if (!loaded) {
      compared = null;
      compareBody.replaceChildren(el("p", { class: "error", role: "status" }, L(
        "Dữ liệu đội chuẩn hiện không khả dụng. Thử tải lại trang.", "推荐阵容数据暂不可用，请刷新页面重试。",
      )));
      return;
    }
    const season = seasonSelect.value || currentSeason() || "all";
    const doi = encodeTeamParam(team);
    writeUrl({ [SEASON_QUERY_KEY]: season, [TEAM_QUERY_KEY]: doi }, push);
    const standardRecords = (loaded.index?.records || []).filter((record) => season === "all" || record.sourceSeasonId === season);
    const standard = compareTeams(team, standardRecords, { minHeroes: 2, limit: 5, tacticIdOf });
    const other = compareTeams(team, loaded.other?.records || [], { minHeroes: 2, limit: 5, tacticIdOf });
    compared = { team, season, standard, other };
    compareSub.textContent = L("Theo số tướng rồi số chiến pháp khớp", "按相同武将数、再按相同战法数排序");
    compareBody.replaceChildren(
      group(L(`Đội chuẩn · ${seasonLabel(season)}`, `推荐阵容 · ${seasonLabel(season)}`), standard,
        L("Mùa này không có đội chuẩn nào trùng từ 2 tướng.", "本赛季没有至少 2 名武将相同的推荐阵容。"), "ana-group-standard"),
      group(L("Đội khác · tham khảo", "其他阵容 · 仅供参考"), other,
        L("Không tìm thấy đội có sẵn nào có mức độ tương đồng đủ cao (≥2 tướng trùng).", "未找到相似度足够高的现有队伍（需至少 2 名武将相同）。"), "ana-group-other"),
    );
    paintSample();
    if (save) {
      sendScanStats();
      historyEntries = addHistoryEntry(historyEntries, { doi, season, savedAt: new Date().toISOString() });
      writeHistory(localStore(), historyEntries);
      renderHistory();
    }
  }

  /* ----- Phe của ảnh đọc + tín hiệu lỗi ----- */
  const activeSide = () => (scan?.active ? scan.sides.get(scan.active) : null);

  function resetScan() {
    scan = null;
    chosenSide = null;
    sideCard.hidden = true;
    sideChooser.replaceChildren();
    paintSideSwitch();
    paintSample();
  }

  /** Tên tướng của phe để xem trước: khớp chắc dùng tên chuẩn, chưa khớp dùng chữ đọc được, 未知 hiện "?". */
  function sidePreviewText(entry) {
    return entry.initial.heroes
      .filter((member) => member.hero.state !== "empty")
      .map((member) => cellText("hero", member.hero) || "?")
      .join(" · ");
  }

  function paintSideChooser() {
    sideRun.disabled = !chosenSide;
    sideChooser.replaceChildren(...[...scan.sides].map(([side, entry]) => {
      const input = el("input", { type: "radio", name: "ana-side", value: side, class: "ana-side-radio" });
      input.checked = chosenSide === side;
      input.addEventListener("change", () => {
        chosenSide = side;
        sideRun.disabled = false;
      });
      return el("label", { class: "ana-side-option" }, [
        input,
        el("span", { class: "ana-side-text" }, [
          el("span", { class: "ana-side-name" }, SIDE_LABELS[side]),
          el("span", { class: "ana-side-heroes" }, sidePreviewText(entry)),
        ]),
      ]);
    }));
  }

  /** Nút đổi phe trong thẻ editor: chỉ khi ảnh có 2 phe và một phe đang nạp. */
  function paintSideSwitch() {
    const two = Boolean(scan && scan.active && scan.sides.size > 1);
    sideSwitch.hidden = !two;
    if (!two) {
      sideSwitch.replaceChildren();
      return;
    }
    sideSwitch.replaceChildren(...[...scan.sides.keys()].map((side) =>
      el("button", {
        type: "button",
        class: "ana-btn ana-side-tab",
        "aria-pressed": String(scan.active === side),
        onclick: () => switchSide(side),
      }, SIDE_LABELS[side])));
  }

  /** Nạp editor bằng phe `side` của lượt đọc: dùng lại kết quả đã đọc, mỗi phe giữ draft đã sửa. */
  function activateSide(side) {
    const entry = scan.sides.get(side);
    if (!entry) return;
    const previous = activeSide();
    if (previous) previous.draft = draft;
    scan.active = side;
    entry.draft ||= draftFromRead({ heroes: entry.heroes }, indexes);
    draft = entry.draft;
    draftFromImage = true;
    compared = null;
    compareGeneration += 1;
    compareCard.hidden = true;
    writeUrl({ [TEAM_QUERY_KEY]: null });
    sideCard.hidden = true;
    renderEditor();
    paintSideSwitch();
    paintSample();
    ensureModel();
  }

  function switchSide(side) {
    if (scan?.active === side) return;
    activateSide(side);
    cellViews[0]?.input.focus();
  }

  /** Đếm ẩn danh số ô phải sửa, 1 lần cho mỗi (lượt đọc, phe); lỗi bỏ qua lặng lẽ. */
  function sendScanStats() {
    const entry = activeSide();
    if (!entry || !draftFromImage || entry.statsSent) return;
    entry.statsSent = true;
    api("/api/scan-stats", {
      method: "POST",
      json: { screen: scan.screen, side: scan.active, ...readStats(entry.initial, draft) },
    }).catch(() => {});
  }

  /** Khối gửi ảnh tự nguyện: chỉ hiện khi có kết quả đối chiếu từ ảnh còn trong bộ nhớ. */
  function paintSample() {
    const entry = activeSide();
    const visible = Boolean(entry && draftFromImage && compared && scan.imageDataUrl);
    sampleBox.hidden = !visible;
    if (!visible) return;
    const key = `${scan.id}:${scan.active}`;
    if (key !== sampleKey) {
      sampleKey = key;
      sampleConsent.checked = false;
      sampleNote.textContent = "";
    }
    if (sampleUser === undefined && !sampleAsked) {
      sampleAsked = true;
      // Phiên không hỏi được (dịch vụ cộng đồng lỗi): vẫn hiện nút, lỗi gửi sẽ báo bằng câu chuẩn.
      loadSession({ probe: true }).then((user) => { sampleUser = user; paintSample(); }, () => { sampleUser = {}; paintSample(); });
    }
    const loggedOut = sampleUser === null;
    sampleLogin.hidden = !loggedOut;
    if (loggedOut && !sampleLogin.firstChild) {
      sampleLogin.replaceChildren(signInPrompt(L(
        "Đăng nhập để gửi ảnh cho quản trị viên.", "登录后才能向管理员发送图片。",
      )));
    }
    sampleControls.hidden = loggedOut || sampleUser === undefined;
    if (entry.sampleSent) sampleNote.textContent = L("Đã gửi, cảm ơn bạn.", "已发送，谢谢！");
    sampleConsent.disabled = entry.sampleSent || sampleBusy;
    sampleSend.disabled = !sampleConsent.checked || entry.sampleSent || sampleBusy;
  }

  sampleConsent.addEventListener("change", paintSample);
  sampleSend.addEventListener("click", async () => {
    const entry = activeSide();
    if (!entry || entry.sampleSent || sampleBusy || !sampleConsent.checked) return;
    const confirmed = confirmedTeam(draft);
    if (!confirmed) {
      sampleNote.textContent = L("Hãy xác nhận đủ đội trước khi gửi ảnh.", "请先确认完整阵容再发送图片。");
      return;
    }
    const current = scan;
    const side = current.active;
    sampleBusy = true;
    sampleNote.textContent = L("Đang gửi…", "正在发送…");
    paintSample();
    try {
      const image = await (await fetch(current.imageDataUrl)).blob();
      const form = new FormData();
      form.append("image", image, "scan");
      form.append("payload", JSON.stringify({
        screen: current.screen,
        side,
        lang: currentLocale(),
        aiRead: { heroes: entry.heroes },
        confirmed,
      }));
      await api("/api/scan-samples", { method: "POST", form });
      entry.sampleSent = true;
      if (scan === current && current.active === side) sampleNote.textContent = L("Đã gửi, cảm ơn bạn.", "已发送，谢谢！");
    } catch (error) {
      if (scan === current && current.active === side) sampleNote.textContent = describeError(error);
    } finally {
      sampleBusy = false;
      paintSample();
    }
  });

  sideRun.addEventListener("click", () => {
    if (scan && chosenSide) activateSide(chosenSide);
  });

  /* ----- Lịch sử ----- */
  function renderHistory() {
    historyCard.hidden = historyEntries.length === 0;
    const formatter = new Intl.DateTimeFormat(zh ? "zh-CN" : "vi-VN", { dateStyle: "short", timeStyle: "short" });
    historyList.replaceChildren(...historyEntries.map((entry) => {
      const team = decodeTeamParam(entry.doi, { hasId });
      if (!team) return null;
      const heroes = team.heroes.map((member) => nameOf("hero", member.hero)).join(" · ");
      return el("li", {}, [
        el("button", { type: "button", class: "ana-history-item", onclick: () => openTeam(team, entry.season, { push: true }) }, [
          el("span", { class: "ana-history-team" }, heroes),
          el("span", { class: "ana-history-meta" }, `${entry.season ? `${seasonLabel(entry.season)} · ` : ""}${formatter.format(new Date(entry.savedAt))}`),
        ]),
      ]);
    }));
  }

  historyClear.addEventListener("click", () => {
    historyEntries = [];
    writeHistory(localStore(), historyEntries);
    renderHistory();
  });

  /** Mở một đội đã xác nhận (link chia sẻ / lịch sử): dựng editor + diff, không gọi Worker. */
  async function openTeam(team, season, { push = false } = {}) {
    resetScan();
    draft = draftFromTeam(team);
    draftFromImage = false;
    renderEditor();
    await ensureModel();
    if (season && [...seasonSelect.options].some((option) => option.value === season)) seasonSelect.value = season;
    await runCompare({ push });
  }

  /** Đọc `?doi=` của URL hiện tại; link hỏng bị bỏ lặng lẽ (xoá khỏi URL, editor rỗng). */
  function applyUrlTeam() {
    const params = new URL(location.href).searchParams;
    if (!params.has(TEAM_QUERY_KEY)) return false;
    const team = decodeTeamParam(params.get(TEAM_QUERY_KEY), { hasId });
    if (!team) {
      writeUrl({ [TEAM_QUERY_KEY]: null });
      resetScan();
      draft = emptyDraft();
      draftFromImage = false;
      renderEditor();
      return false;
    }
    openTeam(team, params.get(SEASON_QUERY_KEY));
    return true;
  }

  /* ----- Chia sẻ + PNG ----- */
  shareBtn.addEventListener("click", async () => {
    if (!compared) return;
    const url = new URL(localePath("/soi-doi-tu-anh/"), location.origin);
    url.searchParams.set(SEASON_QUERY_KEY, compared.season);
    url.searchParams.set(TEAM_QUERY_KEY, encodeTeamParam(compared.team));
    try {
      await navigator.clipboard.writeText(url.href);
      shareNote.replaceChildren(L("Đã chép link. Link chỉ chứa đội đã xác nhận, không chứa ảnh.", "已复制链接。链接仅包含已确认的阵容，不含图片。"));
    } catch {
      // Clipboard bị chặn: hiện link để người dùng tự chép.
      const field = el("input", { class: "ana-input ana-share-url", type: "text", readonly: "", value: url.href, "aria-label": L("Link chia sẻ", "分享链接") });
      shareNote.replaceChildren(field);
      field.select();
    }
  });

  pngBtn.addEventListener("click", () => {
    if (!compared) return;
    const memberLine = (member, index) => {
      const tactics = member.tactics.map((id) => (id ? nameOf("tactic", id) : "—")).join(" · ");
      const book = member.book ? ` · ${nameOf("book", member.book)}` : "";
      return `${index + 1}. ${nameOf("hero", member.hero)} — ${tactics}${book}`;
    };
    const rows = (matches) => matches.slice(0, 3).map(({ record, diff }) => `${recordName(record)} — ${hitsText(diff)}`);
    const canvas = drawResultCard(document.createElement("canvas"), {
      title: L("Soi đội · Cẩm Nang TQCCL", "截图识阵 · 三国志战略版攻略手册"),
      subtitle: L(`Mùa đối chiếu: ${seasonLabel(compared.season)}`, `比对赛季：${seasonLabel(compared.season)}`),
      members: compared.team.heroes.map(memberLine),
      groups: [
        { title: L("Đội chuẩn gần nhất", "最接近的推荐阵容"), rows: rows(compared.standard) },
        { title: L("Đội khác · tham khảo", "其他阵容 · 仅供参考"), rows: rows(compared.other) },
      ].map((item) => (item.rows.length ? item : { ...item, rows: [L("Không có đội trùng từ 2 tướng.", "没有至少 2 名武将相同的阵容。")] })),
      footer: location.host,
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const href = URL.createObjectURL(blob);
      const link = el("a", { href, download: "soi-doi.png" });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 0);
    }, "image/png");
  });

  /* ----- Sự kiện editor ----- */
  compareBtn.addEventListener("click", () => runCompare({ save: true }));
  seasonSelect.addEventListener("change", () => {
    writeUrl({ [SEASON_QUERY_KEY]: seasonSelect.value });
    if (compared) runCompare();
  });
  resetBtn.addEventListener("click", () => {
    resetScan();
    draft = emptyDraft();
    draftFromImage = false;
    compared = null;
    compareCard.hidden = true;
    writeUrl({ [TEAM_QUERY_KEY]: null });
    renderEditor();
    cellViews[0]?.input.focus();
  });
  manualBtn.addEventListener("click", () => {
    // Ảnh và nhập tay dùng chung một editor: mở editor với dữ liệu đang có, không gọi Worker.
    if (editorCard.hidden) {
      resetScan();
      draft = emptyDraft();
      draftFromImage = false;
      renderEditor();
    } else if (scan) {
      resetScan();
    }
    ensureModel();
    (cellViews.find((view) => readCell(view.ref).state !== "sure") || cellViews[0])?.input.focus();
  });

  /**
   * Kết quả Worker -> lượt đọc. 1 phe: nạp editor như cũ (ô không chắc/không rõ phải được xác nhận trước
   * khi đối chiếu). 2 phe: chưa nạp editor, hiện khối chọn phe.
   */
  function applyResult(result) {
    const read = normalizeTeamRead(result);
    if (!read) return false;
    resetScan();
    scan = {
      id: ++scanSeq,
      screen: read.screen,
      imageDataUrl: state.imageDataUrl,
      active: null,
      sides: new Map(read.sides.map(({ side, heroes }) => [side, {
        heroes,
        initial: draftFromRead({ heroes }, indexes),
        draft: null,
        statsSent: false,
        sampleSent: false,
      }])),
    };
    compared = null;
    compareCard.hidden = true;
    writeUrl({ [TEAM_QUERY_KEY]: null });
    if (scan.sides.size === 1) {
      activateSide([...scan.sides.keys()][0]);
    } else {
      draft = emptyDraft();
      draftFromImage = true;
      editorCard.hidden = true;
      paintSideChooser();
      sideCard.hidden = false;
      ensureModel();
    }
    state.done = true;
    paintPick();
    return true;
  }

  function clearRead() {
    state.done = false;
    paintPick();
  }

  async function pickFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const started = ++generation;
    compareGeneration += 1;
    clearRead();
    resetScan();
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
    paintPick();
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
          paintPick();
        },
        onExpire: () => {
          state.token = null;
          paintPick();
        },
        onError: (message) => setStatus(message, "err"),
      });
    } catch (e) {
      setStatus(describeAnalyzeError(e, TURNSTILE_ERROR_MESSAGE), "err");
    }
  }

  if (configured) {
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
      // Dán chữ vào ô editor giữ hành vi mặc định; chỉ ảnh mới được đưa đi soi.
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
      if (item) pickFile(item.getAsFile());
    });

    analyzeBtn.addEventListener("click", async () => {
      if (state.busy || !state.imageDataUrl || !state.token) return;
      const started = generation;
      state.busy = true;
      paintPick();
      setStatus(L("Đang soi đội…", "正在识别阵容…"));
      // Ảnh khó khiến AI đọc lâu: sau 15 s báo rõ để người dùng không tưởng treo.
      const slowTimer = setTimeout(() => {
        if (started === generation) {
          setStatus(L(
            "AI đang đọc kỹ ảnh này, có thể mất thêm chút thời gian…",
            "AI 正在仔细阅读这张图片，可能需要多等一会儿…",
          ));
        }
      }, 15000);
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
        clearTimeout(slowTimer);
        state.token = null;
        state.busy = false;
        if (turnstileRendered && window.turnstile) window.turnstile.reset(tsBox);
        paintPick();
      }
    });
  }

  // Back/Forward giữa các đội đã mở (lịch sử, link): đội theo URL; URL không có đội thì giữ editor.
  window.addEventListener("popstate", () => {
    if (new URL(location.href).searchParams.has(TEAM_QUERY_KEY)) applyUrlTeam();
  });

  layout.replaceChildren(
    el("div", { class: "ana-col ana-col-pick" }, [pickCard, historyCard]),
    el("div", { class: "ana-col ana-col-result" }, [sideCard, editorCard, compareCard]),
  );
  mount.replaceChildren(head, layout);
  paintPick();
  paintStage();
  renderHistory();
  if (configured) ensureTurnstile();
  applyUrlTeam();
}
