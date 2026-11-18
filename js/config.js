// Cấu hình tính năng "Soi đội từ ảnh" (Phase 4). Giá trị PUBLIC (không phải secret).
// Đổi sau khi deploy Worker (Phase 3) + tạo Turnstile.

export const ANALYZE_CONFIG = {
  // URL Worker đã deploy.
  workerUrl: "https://tqccl-vision-proxy.nguyennlt-ncc.workers.dev/analyze",
  // Turnstile site-key (public). Lấy ở Cloudflare dashboard → Turnstile.
  turnstileSiteKey: "0x4AAAAAADpP8U-ML4ZICKkv",
  // Nén ảnh client trước khi gửi (giảm token + qua giới hạn size Worker).
  maxImageDim: 1600, // cạnh dài tối đa (px)
  jpegQuality: 0.82,
};

/** Đã cấu hình thật chưa (để UI báo nếu còn placeholder). */
export function isAnalyzeConfigured() {
  return (
    !ANALYZE_CONFIG.workerUrl.includes("REPLACE_ME") &&
    !ANALYZE_CONFIG.turnstileSiteKey.includes("REPLACE_ME")
  );
}

// Google Analytics 4 (giá trị PUBLIC, không phải secret; id đo là một nguồn cho script <head> của layout và js/analytics.js).
// `hosts`: chỉ domain chính gửi số liệu; localhost, *.pages.dev, www.tqccl.com (chuyển hướng về domain chính) và bản
// build test không nạp GA. Trang quản trị `/quan-tri/` không bao giờ nạp GA ở mọi host.
export const ANALYTICS_CONFIG = {
  measurementId: "G-0K23EKM76G",
  hosts: ["tqccl.com"],
};
