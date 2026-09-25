// Ô chân dung dùng chung cho Tra cứu, hồ sơ và Soi đội (Phase 7).
//
// CDN ảnh chặn hotlink theo Referer nên mọi ảnh phải `referrerpolicy="no-referrer"`; 92/112 URL trong
// `data/heroes-dict.json` còn ở dạng `http://` trong khi site chạy HTTPS (mixed content) nên scheme được
// nâng lên `https:` lúc render. Ảnh lỗi hoặc thiếu `iconUrl` → ô nền `--accent-soft` với chữ Hán đầu tên
// (`--font-cjk`, `lang="zh-Hant"`, `aria-hidden`) — không để lại ảnh vỡ hay ô trống.

import { el } from "./render.js";
import { validateHttpSourceUrl } from "./recommended-reference-state.js";

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

/** URL chân dung hợp lệ (http/https tuyệt đối) và luôn dùng `https:` để không bị chặn mixed content. */
export function portraitUrl(raw) {
  const href = validateHttpSourceUrl(raw);
  return href ? href.replace(/^http:/iu, "https:") : null;
}

/** Ký tự Hán đầu tiên của tên chữ Hán; không có thì lấy chữ đầu tên Việt (ô dự phòng không bao giờ rỗng). */
export function portraitChar(chinese, nameVi = "") {
  const source = typeof chinese === "string" ? chinese : "";
  for (const character of source) if (CJK.test(character)) return character;
  const fallback = String(nameVi ?? "").trim();
  return fallback ? [...fallback][0] : "?";
}

/** Ô chữ Hán dự phòng: tên tướng đã có ở chỗ khác nên phần này ẩn khỏi cây trợ năng. */
export function portraitFallback({ chinese, nameVi } = {}) {
  return el("span", { class: "hero-portrait-han" }, [
    el("span", { lang: "zh-Hant", "aria-hidden": "true" }, portraitChar(chinese, nameVi)),
  ]);
}

/**
 * Ô chân dung: ảnh khi có URL hợp lệ, chữ Hán khi thiếu ảnh hoặc ảnh lỗi.
 * `className` là class kích thước của nơi dùng; `alt` mặc định là tên hiển thị.
 * `fallbackOnError: false` giữ hành vi cũ của Soi đội (gãy ảnh thì bỏ ảnh, không thêm ô chữ).
 */
export function heroPortrait({ chinese, nameVi, iconUrl, className = "", alt, fallbackOnError = true } = {}) {
  const box = el("span", { class: `hero-portrait${className ? ` ${className}` : ""}` });
  const href = portraitUrl(iconUrl);
  // Chữ Hán nằm dưới ảnh: CDN treo (không lỗi, không tải xong) vẫn thấy ô chữ thay vì ô trống.
  if (fallbackOnError) box.append(portraitFallback({ chinese, nameVi }));
  if (!href) return box;
  const image = el("img", {
    src: href,
    alt: alt ?? String(nameVi ?? "").trim(),
    loading: "lazy",
    decoding: "async",
    referrerpolicy: "no-referrer",
  });
  image.addEventListener("load", () => box.classList.add("hero-portrait-loaded"));
  image.addEventListener("error", () => image.remove());
  box.append(image);
  return box;
}
