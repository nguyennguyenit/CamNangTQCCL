// Cấu hình tính năng "Soi đội từ ảnh" (Phase 4). Giá trị PUBLIC (không phải secret).
// Đổi sau khi deploy Worker (Phase 3) + tạo Turnstile.

export const ANALYZE_CONFIG = {
  // URL Worker đã deploy, vd https://tqccl-vision-proxy.<account>.workers.dev/analyze
  workerUrl: "https://REPLACE_ME.workers.dev/analyze",
  // Turnstile site-key (public). Lấy ở Cloudflare dashboard → Turnstile.
  turnstileSiteKey: "REPLACE_ME",
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
