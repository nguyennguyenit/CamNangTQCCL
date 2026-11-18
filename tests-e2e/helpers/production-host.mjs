/**
 * Chạy trang như trên domain chính `https://tqccl.com` (nơi duy nhất bật GA4, xem `ANALYTICS_CONFIG.hosts` ở js/config.js)
 * mà không cần mạng ngoài: request của context tới host đó được route về server preview cục bộ (`baseURL`), nên trình duyệt
 * thấy `location.hostname === "tqccl.com"` và localStorage riêng theo origin. Cùng kỹ thuật với tests-e2e/host-bridge.spec.mjs.
 *
 * Không dùng `--host-resolver-rules=MAP tqccl.com 127.0.0.1`: Vite preview chặn `Host: tqccl.com` (allowedHosts rỗng → 403).
 *
 * GA: `https://www.googletagmanager.com/**` được thay bằng script rỗng (`gtag`/`dataLayer` do script inline của layout dựng,
 * test chỉ đọc `window.dataLayer`) và mọi request tới `google-analytics.com` bị chặn, nên không có gì rời khỏi máy.
 */
export const PRODUCTION_ORIGIN = 'https://tqccl.com';
export const GTM_HOST_PATTERN = 'https://www.googletagmanager.com/**';

/** Test kết thúc (hoặc trang điều hướng) khi request còn dở: response đã bị huỷ, không còn ai để trả lời. */
const TEARDOWN_ERROR = /disposed|has been closed|Target closed|already handled/iu;
/** Preview cục bộ đôi khi cắt kết nối khi 5 worker cùng tải: thử lại một lần thay vì để test chập chờn. */
const TRANSIENT_ERROR = /ECONNRESET|socket hang up/iu;

/** Route host sản xuất về `baseURL` và chặn mạng GA. Gọi trước `page.goto(`${PRODUCTION_ORIGIN}/…`)`. */
export async function routeProductionHost(context, baseURL, { gtagScript = '' } = {}) {
  await context.route(`${PRODUCTION_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const target = new URL(url.pathname + url.search, baseURL).href;
    try {
      let response;
      try {
        response = await route.fetch({ url: target });
      } catch (error) {
        if (!TRANSIENT_ERROR.test(String(error?.message))) throw error;
        response = await route.fetch({ url: target });
      }
      await route.fulfill({ response });
    } catch (error) {
      if (!TEARDOWN_ERROR.test(String(error?.message))) throw error;
    }
  });
  await context.route(GTM_HOST_PATTERN, (route) => route.fulfill({ contentType: 'text/javascript', body: gtagScript }));
  await context.route(/google-analytics\.com/u, (route) => route.abort());
}

/** Ghi sẵn lựa chọn đồng ý (`granted` | `denied`) vào localStorage trước mọi script của trang, nên thanh đồng ý không hiện. */
export async function seedConsent(context, choice, at = Date.now()) {
  await context.addInitScript(({ value, stamp }) => {
    try {
      localStorage.setItem('analyticsConsent', JSON.stringify({ v: 1, choice: value, at: stamp }));
    } catch {
      // storage chặn: không có gì để ghi
    }
  }, { value: choice, stamp: at });
}

/** Mọi lệnh đã vào `window.dataLayer`, mỗi lệnh là mảng `['consent', 'default', {…}]`, `['event', tên, tham số]`… theo thứ tự. */
export const dataLayerEntries = (page) =>
  page.evaluate(() => (window.dataLayer || []).map((entry) => Array.from(entry)));
