// Section "Soi đội từ ảnh" (Phase 4): upload/paste ảnh -> nén client -> Turnstile
// (lazy-load) -> gọi Worker -> map 3 trục (analyze-map) -> render + đối chiếu team.
// Giữ 3 section cũ offline: Turnstile script CHỈ nạp khi mở tab này.

import { el } from "./render.js";
import { ANALYZE_CONFIG, isAnalyzeConfigured } from "./config.js";
import { mapTeamRead, findSimilarTeams } from "./analyze-map.js";

const DISCLAIMER =
  "Ảnh được gửi tới Alibaba Cloud DashScope để phân tích (không lưu lại). " +
  "Tránh ảnh lộ tên tài khoản; nên crop chỉ phần đội hình.";

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
    /* ignore */
  }
  if (!res.ok) {
    const msg = data?.error || (res.status === 429 ? "Hết lượt, thử lại sau" : "Lỗi máy chủ");
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------- Render kết quả ---------- */
function heroResultCard(m) {
  const flag = m.hero.sure ? null : el("span", { class: "ana-flag", title: "Độ tin thấp, kiểm tra lại" }, "⚠ kiểm tra");
  // Icon official (hotlink) để mắt thường xác nhận; gãy/403 -> ẩn, không chặn text.
  const icon = m.hero.icon
    ? el("img", {
        class: "ana-hero-icon",
        src: m.hero.icon,
        alt: m.hero.viet,
        loading: "lazy",
        referrerpolicy: "no-referrer", // tránh CDN chặn hotlink theo Referer
        onerror: (e) => e.target.remove(),
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
      icon,
      el("span", { class: "ana-hero-name" }, m.hero.viet),
      m.statFocus ? el("span", { class: "ana-stat" }, m.statFocus) : null,
      flag,
    ]),
    tactics,
    books,
  ]);
}

function similarTeamRow(s, onOpen) {
  const label = `${s.heroHit}/${s.total} tướng` + (s.tacticHit ? ` · ${s.tacticHit} chiến pháp` : "");
  const btn = el("button", { class: "ana-team-link", type: "button" }, `${s.team.id || "team"} (${label})`);
  if (onOpen) btn.addEventListener("click", () => onOpen(s.team));
  return el("li", {}, btn);
}

function renderResults(box, result, deps) {
  box.replaceChildren();
  if (!result || !Array.isArray(result.heroes) || result.heroes.length === 0) {
    box.append(el("p", { class: "ana-status err" }, "Phản hồi không hợp lệ, thử lại."));
    return;
  }
  const mapped = mapTeamRead(result.heroes, deps);
  box.append(el("h3", { class: "ana-rh" }, "Đội đọc được"));
  box.append(el("div", { class: "ana-heroes" }, mapped.map(heroResultCard)));

  const similar = findSimilarTeams(mapped, deps.teams, { minHeroes: 2 });
  if (similar.length) {
    box.append(el("h3", { class: "ana-rh" }, "Team có sẵn giống"));
    box.append(el("ul", { class: "ana-teams" }, similar.map((s) => similarTeamRow(s, deps.onOpenTeam))));
  } else {
    box.append(el("p", { class: "ana-note" }, "Không tìm thấy team có sẵn đủ giống (≥2 tướng trùng)."));
  }
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

  const state = { imageDataUrl: null, token: null, busy: false };
  const drop = el("div", { class: "ana-drop" }, "📷 Kéo-thả ảnh, dán (Ctrl+V), hoặc bấm chọn");
  const fileInput = el("input", { type: "file", accept: "image/*", class: "ana-file" });
  const preview = el("img", { class: "ana-preview", alt: "Ảnh đã chọn" });
  const tsBox = el("div", { class: "ana-turnstile" });
  const analyzeBtn = el("button", { class: "ana-btn", type: "button", disabled: "" }, "Soi đội");
  const status = el("p", { class: "ana-status" });
  const results = el("div", { class: "ana-results" });

  function setStatus(msg, kind = "") {
    status.className = `ana-status ${kind}`;
    status.textContent = msg || "";
  }
  function refreshBtn() {
    analyzeBtn.disabled = !(state.imageDataUrl && state.token && !state.busy);
  }

  async function pickFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setStatus("Đang nén ảnh…");
    try {
      state.imageDataUrl = await compressImage(file);
      preview.src = state.imageDataUrl;
      preview.classList.add("on");
      setStatus("");
    } catch (e) {
      setStatus(e.message, "err");
    }
    refreshBtn();
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
          refreshBtn();
        },
        "expired-callback": () => {
          state.token = null;
          refreshBtn();
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
    if (state.busy) return;
    state.busy = true;
    refreshBtn();
    setStatus("Đang soi đội…");
    try {
      const result = await callWorker(state.imageDataUrl, state.token);
      renderResults(results, result, deps);
      setStatus("");
    } catch (e) {
      const m = e.status === 429 ? "Hết lượt hôm nay, thử lại sau." : e.status === 422 ? "Không đọc được đội từ ảnh, thử ảnh rõ hơn." : e.message;
      setStatus(m, "err");
    } finally {
      // Turnstile token dùng 1 lần -> reset, yêu cầu xác thực lại.
      state.token = null;
      state.busy = false;
      if (turnstileRendered && window.turnstile) window.turnstile.reset(tsBox);
      refreshBtn();
    }
  });

  mount.replaceChildren(
    el("p", { class: "ana-disclaimer" }, DISCLAIMER),
    drop,
    fileInput,
    preview,
    tsBox,
    analyzeBtn,
    status,
    results,
  );
  ensureTurnstile();
}
