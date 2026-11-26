// Google Analytics 4 + Consent Mode v2, chế độ "advanced": gtag nạp ngay từ đầu, mọi quyền mặc định là TỪ CHỐI (chỉ gửi
// ping không cookie) cho tới khi người dùng bấm Đồng ý ở thanh đồng ý (js/consent-banner.js).
//   - Thiết lập (dataLayer, gtag, consent mặc định, áp lựa chọn đã lưu, nạp gtag.js) chạy ở script inline thứ hai của <head>
//     (SiteLayout phát): mã ở src/lib/analytics-loader.ts, id đo và danh sách host lấy từ js/config.js.
//   - Module này là phần chạy trong trang: `track()` gửi sự kiện tuỳ chỉnh; `getConsent()`/`setConsent()` đọc/ghi lựa chọn.
// Trang không bật GA (host ngoài `ANALYTICS_CONFIG.hosts`, trang quản trị) thì `track`/`setConsent` là no-op. Import được
// trong Node (test, build): không chạm window/document/localStorage ở top level, mọi hàm nhận cửa sổ tường minh.

import { ANALYTICS_CONFIG } from './config.js';
import { stripLocale } from './i18n.js';

/** Khóa localStorage của lựa chọn đồng ý: JSON `{v, choice: 'granted' | 'denied', at: <ms>}`. */
export const CONSENT_STORAGE_KEY = 'analyticsConsent';
/** Phiên bản định dạng lựa chọn đã lưu; đổi định dạng thì tăng số này để hỏi lại. */
export const CONSENT_VERSION = 1;
/** Lựa chọn hết hạn sau 12 tháng (365 ngày) và thanh đồng ý hỏi lại. */
export const CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Một tham số sự kiện dài hơn mức này bị cắt (giới hạn giá trị tham số của GA4 là 100 ký tự). */
const PARAM_VALUE_MAX = 100;

/** Cửa sổ của trang; ngoài trình duyệt (Node test, build) là `null`. */
const pageWindow = () => (typeof window === 'undefined' ? null : window);

/**
 * Trang quản trị ở mọi ngôn ngữ (`/quan-tri/`, `/zh/quan-tri/`, …): không bao giờ nạp GA.
 * @param {string | null | undefined} pathname
 */
export function isAdminPath(pathname) {
  const path = stripLocale(pathname);
  return path === '/quan-tri' || path.startsWith('/quan-tri/');
}

/**
 * Host được gửi số liệu (domain chính). localhost, *.pages.dev, www.tqccl.com và bản build test thì không.
 * @param {string | null | undefined} hostname
 */
export function isAnalyticsHost(hostname) {
  return ANALYTICS_CONFIG.hosts.includes(String(hostname));
}

/**
 * Trang này có bật GA không: đúng host, không phải trang quản trị và script `<head>` đã dựng `gtag`.
 * @param {any} [win] cửa sổ trang (mặc định `window`)
 */
export function isAnalyticsEnabled(win = pageWindow()) {
  const location = win?.location;
  if (!location) return false;
  return isAnalyticsHost(location.hostname) && !isAdminPath(location.pathname) && typeof win.gtag === 'function';
}

/**
 * Lựa chọn đã lưu còn hiệu lực: `'granted'`, `'denied'`, hoặc `null` (chưa chọn, hỏng, khác phiên bản, quá hạn).
 * Hàm này được nhúng NGUYÊN THÂN vào script inline của <head> (src/lib/analytics-loader.ts) nên phải tự đủ: không tham
 * chiếu biến ngoài thân hàm (mọi hằng nhận qua tham số) và dùng cú pháp ES5 như các script inline khác.
 * @param {string | null | undefined} raw giá trị localStorage
 * @param {number} now
 * @param {number} ttlMs
 * @param {number} version
 * @returns {'granted' | 'denied' | null}
 */
export function parseStoredConsent(raw, now, ttlMs, version) {
  try {
    var value = JSON.parse(String(raw));
    if (!value || value.v !== version || typeof value.at !== 'number') return null;
    if (value.choice !== 'granted' && value.choice !== 'denied') return null;
    return now - value.at <= ttlMs ? value.choice : null;
  } catch (error) {
    return null;
  }
}

/**
 * Lựa chọn đồng ý đang có hiệu lực của trình duyệt này; `null` khi chưa chọn, đã hết hạn hoặc storage bị chặn.
 * @param {any} [win]
 * @param {number} [now]
 */
export function getConsent(win = pageWindow(), now = Date.now()) {
  try {
    return parseStoredConsent(win.localStorage.getItem(CONSENT_STORAGE_KEY), now, CONSENT_TTL_MS, CONSENT_VERSION);
  } catch {
    return null;
  }
}

/** Mọi cookie của GA4 (`_ga`, `_ga_<id>`). */
const GA_COOKIE = /^_ga(?:_|$)/;

/**
 * Xoá cookie `_ga*` của domain: GA4 đặt chúng ở domain mức cao nhất cho phép (`tqccl.com`) nên thử mọi hậu tố của host
 * (có và không có dấu chấm đầu) cùng bản chỉ-host. Gọi sau khi người dùng rút lại đồng ý.
 * @param {any} [win]
 */
export function deleteAnalyticsCookies(win = pageWindow()) {
  try {
    const doc = win.document;
    const labels = String(win.location.hostname).split('.');
    const domains = [''];
    for (let at = 0; at < labels.length - 1; at += 1) {
      const domain = labels.slice(at).join('.');
      domains.push(`;domain=${domain}`, `;domain=.${domain}`);
    }
    for (const entry of String(doc.cookie).split(';')) {
      const name = entry.split('=')[0].trim();
      if (!GA_COOKIE.test(name)) continue;
      for (const domain of domains) doc.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/${domain}`;
    }
  } catch {
    // Cookie bị chặn hoặc không có document: không còn gì để xoá.
  }
}

/**
 * Ghi lựa chọn đồng ý và báo Consent Mode (`analytics_storage` thôi; quảng cáo luôn từ chối). Rút lại đồng ý thì xoá luôn
 * cookie `_ga*`. Trang không bật GA thì không làm gì và trả `false`. Storage bị chặn vẫn áp lựa chọn cho lần xem này.
 * @param {'granted' | 'denied'} choice
 * @param {any} [win]
 * @param {number} [now]
 * @returns {boolean} đã áp dụng lựa chọn
 */
export function setConsent(choice, win = pageWindow(), now = Date.now()) {
  if ((choice !== 'granted' && choice !== 'denied') || !isAnalyticsEnabled(win)) return false;
  try {
    win.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, choice, at: now }));
  } catch {
    // Không ghi được (storage chặn/đầy): lựa chọn chỉ có hiệu lực tới khi đóng trang.
  }
  applyConsent(choice, win);
  return true;
}

/**
 * Báo `gtag('consent', 'update', …)` theo `choice` (không ghi storage); `'denied'` xoá cookie `_ga*`. Dùng khi tab khác
 * đổi lựa chọn.
 * @param {'granted' | 'denied'} choice
 * @param {any} [win]
 */
export function applyConsent(choice, win = pageWindow()) {
  try {
    win.gtag('consent', 'update', { analytics_storage: choice });
    if (choice === 'denied') deleteAnalyticsCookies(win);
  } catch {
    // Analytics không được làm hỏng trang.
  }
}

/**
 * Chỉ giữ tham số hợp lệ cho GA4: khóa là chuỗi, giá trị là chuỗi (cắt 100 ký tự), số hữu hạn hoặc boolean.
 * @param {Record<string, unknown>} params
 */
export function sanitizeParams(params) {
  /** @type {Record<string, string | number | boolean>} */
  const clean = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string') clean[key] = value.slice(0, PARAM_VALUE_MAX);
    else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === 'boolean') clean[key] = value;
  }
  return clean;
}

/**
 * Sự kiện mang chữ do người dùng gõ. Khi từ chối hoặc chưa chọn, Consent Mode vẫn để gtag gửi tín hiệu không cookie kèm
 * tham số của MỌI sự kiện, nên loại sự kiện này bị chặn từ đây (không gửi gì) cho tới khi có lựa chọn "granted".
 */
const CONSENT_ONLY_EVENTS = Object.freeze(['search']);

/**
 * Gửi một sự kiện tuỳ chỉnh tới GA4. Người gọi không kiểm đồng ý: Consent Mode quyết định gtag gửi gì, riêng sự kiện nằm
 * trong `CONSENT_ONLY_EVENTS` (`search`, chữ tự do) thì chính hàm này bỏ khi chưa có lựa chọn "granted" còn hạn. Trang không
 * bật GA (host ngoài `ANALYTICS_CONFIG.hosts`, trang quản trị, chưa có gtag) thì không làm gì; không bao giờ ném lỗi. Tham số
 * chỉ mang id công khai/enum, không email, tên, tài khoản, nội dung kho, ảnh hay chữ tự do (ngoại lệ duy nhất: từ khóa Tra
 * cứu đã debounce của `search`, chỉ khi đã đồng ý).
 * @param {string} name
 * @param {Record<string, string | number | boolean>} [params]
 */
export function track(name, params = {}) {
  try {
    const win = pageWindow();
    if (typeof name !== 'string' || !name || !isAnalyticsEnabled(win)) return;
    if (CONSENT_ONLY_EVENTS.includes(name) && getConsent(win) !== 'granted') return;
    win.gtag('event', name, sanitizeParams(params));
  } catch {
    // Analytics không được làm hỏng tính năng đang chạy.
  }
}
