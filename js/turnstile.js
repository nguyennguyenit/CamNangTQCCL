// Cloudflare Turnstile nạp lười, dùng chung cho "Soi đội từ ảnh", "Gợi ý đội từ kho" và hộp thoại góp ý ở footer.
// Script chỉ được chèn lần đầu có widget cần vẽ; mọi nơi dùng chung một promise nên trang chỉ nạp một lần.

import { ANALYZE_CONFIG } from "./config.js";
import { L } from "./i18n.js";

let turnstileLoading = null;
export function loadTurnstile() {
  if (turnstileLoading) return turnstileLoading;
  turnstileLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = () => {
      // Lỗi đã bản địa hoá (cờ `localized`): describeAnalyzeError hiện nguyên câu này.
      const err = new Error(L("Không tải được Turnstile", "Turnstile 加载失败"));
      err.localized = true;
      reject(err);
    };
    document.head.append(s);
  });
  return turnstileLoading;
}

/** Câu báo khi widget Turnstile lỗi (mạng, domain không nằm trong danh sách site key, …). */
export const TURNSTILE_ERROR_MESSAGE = L("Xác thực chống bot không thành công. Tải lại trang rồi thử lại.", "人机验证未通过，请刷新页面后重试。");

/**
 * Nạp Turnstile rồi vẽ widget vào `box`. Lỗi của widget đi qua `error-callback`: bỏ token (`onExpire`),
 * báo câu theo ngôn ngữ trang (`onError`) và trả `true` để widget không ném `TurnstileError` ra trang.
 * Promise bị từ chối khi không tải được script.
 */
export async function renderTurnstileWidget(box, { onToken, onExpire, onError }) {
  const ts = await loadTurnstile();
  return ts.render(box, {
    sitekey: ANALYZE_CONFIG.turnstileSiteKey,
    callback: (tok) => onToken(tok),
    "expired-callback": () => onExpire(),
    "error-callback": () => {
      onExpire();
      onError(TURNSTILE_ERROR_MESSAGE);
      return true;
    },
  });
}
