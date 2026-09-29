// Cầu chuyển domain: `https://tqccl.com` là domain chính; `tqccl.pages.dev` và `www.tqccl.com`
// vẫn phục vụ cùng bản build nhưng chuyển hẳn về domain chính. localStorage gắn theo origin, nên
// trước khi chuyển, host cũ đóng gói các khóa bền của app vào fragment `#tqccl-migrate=<JSON>`;
// host chính ghi lại những khóa nó CHƯA có (không đè dữ liệu mới hơn) rồi trả fragment gốc.
// Riêng tư: fragment không bao giờ nằm trong request HTTP (trình duyệt không gửi phần `#…`),
// nên dữ liệu tracker/kho không tới server Pages hay log nào; nó chỉ đi từ tab này sang tab đó.
// Hai hàm dưới được nhúng nguyên thân vào script inline đầu <head> (xem HOST_BRIDGE_SCRIPT), nên
// phải tự đủ: không tham chiếu biến ngoài thân hàm, không import.
import { STORAGE_KEY as RECRUIT_TRACKER_KEY } from '../../js/recruit-tracker-store.js';
import { ROSTER_SCAN_STORAGE_KEY } from '../../js/roster-scan-state.js';
import { TEAM_VIEW_STORAGE_KEY } from '../../js/team-view.js';
import { HISTORY_STORAGE_KEY as ANALYZE_HISTORY_KEY } from '../../js/analyze-state.js';

/**
 * Mọi khóa localStorage bền mà app ghi. `theme` do js/site-chrome.js và script theme của layout
 * dùng chung. Khóa sessionStorage (`tqccl:team-return:v1`) cố ý không mang theo.
 */
export const HOST_BRIDGE_KEYS: readonly string[] = Object.freeze([
  RECRUIT_TRACKER_KEY,
  ROSTER_SCAN_STORAGE_KEY,
  'theme',
  TEAM_VIEW_STORAGE_KEY,
  ANALYZE_HISTORY_KEY,
]);

export interface HostBridgeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HostBridgePage {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
  storage: HostBridgeStorage | null;
}

export type HostBridgePlan =
  | { action: 'none' }
  | { action: 'redirect'; url: string }
  | { action: 'rewrite'; writes: [string, string][]; url: string };

export interface HostBridgeWindow {
  readonly localStorage: HostBridgeStorage | null;
  location: { hostname: string; pathname: string; search: string; hash: string; replace(url: string): void };
  history: { replaceState(state: null, title: string, url: string): void };
}

/** Quyết định thuần: không đọc gì ngoài `page` (storage chỉ được đọc), không ghi gì. */
export function planHostBridge(page: HostBridgePage, keys: readonly string[]): HostBridgePlan {
  var PRIMARY_HOST = 'tqccl.com';
  var LEGACY_HOSTS = ['tqccl.pages.dev', 'www.tqccl.com'];
  var PREFIX = '#tqccl-migrate=';
  var path = page.pathname + page.search;
  var i;

  if (LEGACY_HOSTS.indexOf(page.hostname) !== -1) {
    var target = 'https://' + PRIMARY_HOST + path;
    var items: Record<string, string> = {};
    var found = false;
    try {
      for (i = 0; i < keys.length; i += 1) {
        var stored = (page.storage as HostBridgeStorage).getItem(keys[i]);
        if (typeof stored === 'string') {
          items[keys[i]] = stored;
          found = true;
        }
      }
    } catch (error) {
      // Storage bị chặn: vẫn chuyển, chỉ là không mang dữ liệu theo.
      found = false;
    }
    if (!found) return { action: 'redirect', url: target + page.hash };
    return { action: 'redirect', url: target + PREFIX + encodeURIComponent(JSON.stringify({ v: 1, hash: page.hash, items: items })) };
  }

  if (page.hostname !== PRIMARY_HOST || page.hash.indexOf(PREFIX) !== 0) return { action: 'none' };

  var stripped: HostBridgePlan = { action: 'rewrite', writes: [], url: path };
  var data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(page.hash.slice(PREFIX.length)));
  } catch (error) {
    return stripped;
  }
  if (!data || typeof data !== 'object') return stripped;
  var payload = data as { v?: unknown; hash?: unknown; items?: unknown };
  var hash = payload.hash;
  if (payload.v !== 1 || typeof hash !== 'string' || (hash !== '' && hash.charAt(0) !== '#') || hash.indexOf(PREFIX) === 0) return stripped;
  if (!payload.items || typeof payload.items !== 'object' || Array.isArray(payload.items)) return stripped;
  var incoming = payload.items as Record<string, unknown>;
  var names = Object.keys(incoming);
  var valid: [string, string][] = [];
  for (i = 0; i < names.length; i += 1) {
    var value = incoming[names[i]];
    if (keys.indexOf(names[i]) === -1 || typeof value !== 'string') return stripped;
    valid.push([names[i], value]);
  }

  var writes: [string, string][] = [];
  try {
    for (i = 0; i < valid.length; i += 1) {
      if ((page.storage as HostBridgeStorage).getItem(valid[i][0]) === null) writes.push(valid[i]);
    }
  } catch (error) {
    writes = [];
  }
  return { action: 'rewrite', writes: writes, url: path + hash };
}

/** Phần có tác dụng phụ: đọc `window`, chuyển trang hoặc ghi storage rồi thay URL trước mọi script khác. */
export function runHostBridge(win: HostBridgeWindow, plan: typeof planHostBridge, keys: readonly string[]): void {
  var storage: HostBridgeStorage | null = null;
  try {
    storage = win.localStorage;
  } catch (error) {
    storage = null;
  }
  var location = win.location;
  var result = plan({ hostname: location.hostname, pathname: location.pathname, search: location.search, hash: location.hash, storage: storage }, keys);
  if (result.action === 'redirect') {
    location.replace(result.url);
    return;
  }
  if (result.action !== 'rewrite') return;
  for (var i = 0; i < result.writes.length; i += 1) {
    try {
      (storage as HostBridgeStorage).setItem(result.writes[i][0], result.writes[i][1]);
    } catch (error) {
      // Hết quota/bị chặn: bỏ khóa này, không chặn các khóa còn lại hay việc dọn URL.
    }
  }
  win.history.replaceState(null, '', result.url);
}

/** Script inline đặt đầu <head> của mọi trang; lỗi bất ngờ không được chặn trang. */
export const HOST_BRIDGE_SCRIPT = `(function(){try{(${runHostBridge.toString()})(window,${planHostBridge.toString()},${JSON.stringify(HOST_BRIDGE_KEYS)});}catch(error){}})();`;
