// Google Analytics 4 ở chế độ "advanced" của Consent Mode v2: script inline đặt NGAY SAU cầu chuyển domain ở <head> của
// mọi trang (trừ trang quản trị, layout không phát script này cho chúng). Thứ tự bắt buộc: dựng `dataLayer`/`gtag` → khai
// consent MẶC ĐỊNH từ chối (analytics_storage và ba quyền quảng cáo) → áp lựa chọn đã lưu nếu là "granted" → `js` +
// `config` (không tự gửi page_view) → `page_view` gửi tường minh với URL chụp ngay tại <head> → nạp gtag.js bất đồng bộ.
// Tag đã nạp ngay cả khi chưa đồng ý nhưng chỉ gửi ping không cookie; Đồng ý/Từ chối sau đó đi qua js/analytics.js
// (`setConsent`, `gtag('consent', 'update', …)`).
// Id đo, host cho phép và khóa lưu lựa chọn lấy từ js/config.js và js/analytics.js (một nguồn). Host ngoài danh sách
// (localhost, *.pages.dev, www.tqccl.com, bản build test) không dựng gì; `/quan-tri/` ở mọi locale cũng không (phòng
// thủ lớp hai: layout đã không phát script cho trang quản trị).
// Hai hàm dưới được nhúng nguyên thân vào script inline (xem ANALYTICS_LOADER_SCRIPT), nên phải tự đủ: không tham chiếu
// biến ngoài thân hàm, không import, cú pháp ES5 như cầu chuyển domain.
import { ANALYTICS_CONFIG } from '../../js/config.js';
import { CONSENT_STORAGE_KEY, CONSENT_TTL_MS, CONSENT_VERSION, parseStoredConsent } from '../../js/analytics.js';
import { SITE_LOCALES, localePath } from '../../js/i18n.js';

export interface AnalyticsLoaderConfig {
  measurementId: string;
  hosts: readonly string[];
  /** Tiền tố đường dẫn trang quản trị của từng locale (`/quan-tri/`, `/zh/quan-tri/`, …). */
  adminPaths: readonly string[];
  storageKey: string;
  ttlMs: number;
  version: number;
}

export interface AnalyticsLoaderWindow {
  location: { hostname: string; pathname: string; href: string };
  readonly localStorage: { getItem(key: string): string | null };
  document: {
    head: { appendChild(node: unknown): unknown };
    createElement(tag: string): { async: boolean; src: string };
  };
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

/**
 * Phần có tác dụng phụ: dựng gtag, consent và nạp gtag.js. Lỗi bất ngờ do script bao ngoài nuốt, không chặn trang.
 * Google tag chỉ nhận đối tượng `arguments` trong dataLayer (không nhận mảng thường) nên `gtag` phải là `function` thường.
 * Chỉ `analytics_storage` được cấp khi có lựa chọn "granted" còn hạn; ba quyền quảng cáo luôn từ chối (site không chạy quảng
 * cáo) và Google Signals tắt. `config` mang `send_page_view: false` và `page_view` đầu tiên do chính script này gửi với
 * `page_location` là URL tại <head>: js/app.js gỡ `utm_*`/`gclid`/… khỏi URL ngay khi khởi động, trước khi gtag.js (tải bất
 * đồng bộ, lại còn chờ `wait_for_update`) kịp đọc `location`. Không có chú thích trong thân hàm: cả thân được nhúng vào HTML
 * của mọi trang.
 */
export function runAnalyticsLoader(
  win: AnalyticsLoaderWindow,
  parseConsent: typeof parseStoredConsent,
  config: AnalyticsLoaderConfig,
): void {
  var location = win.location;
  var i;
  if (config.hosts.indexOf(location.hostname) === -1) return;
  for (i = 0; i < config.adminPaths.length; i += 1) {
    var prefix = config.adminPaths[i];
    if (location.pathname === prefix.slice(0, -1) || location.pathname.indexOf(prefix) === 0) return;
  }

  var layer: unknown[] = (win.dataLayer = win.dataLayer || []);
  var gtag: (...args: unknown[]) => void = function () {
    layer.push(arguments);
  };
  win.gtag = gtag;

  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  var stored: string | null = null;
  try {
    stored = win.localStorage.getItem(config.storageKey);
  } catch (error) {
    stored = null;
  }
  if (parseConsent(stored, Date.now(), config.ttlMs, config.version) === 'granted') {
    gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  gtag('js', new Date());
  gtag('config', config.measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  gtag('event', 'page_view', { page_location: location.href.split('#')[0] });

  var script = win.document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(config.measurementId);
  win.document.head.appendChild(script);
}

export const ANALYTICS_LOADER_CONFIG: AnalyticsLoaderConfig = {
  measurementId: ANALYTICS_CONFIG.measurementId,
  hosts: ANALYTICS_CONFIG.hosts,
  adminPaths: SITE_LOCALES.map((locale) => localePath('/quan-tri/', locale)),
  storageKey: CONSENT_STORAGE_KEY,
  ttlMs: CONSENT_TTL_MS,
  version: CONSENT_VERSION,
};

/** Script inline đặt sau cầu chuyển domain ở <head> của mọi trang không phải quản trị; lỗi bất ngờ không được chặn trang. */
export const ANALYTICS_LOADER_SCRIPT = `(function(){try{(${runAnalyticsLoader.toString()})(window,${parseStoredConsent.toString()},${JSON.stringify(ANALYTICS_LOADER_CONFIG)});}catch(error){}})();`;
