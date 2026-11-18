// Đo ô tìm của Tra cứu (sự kiện GA4 `search`): không gửi theo từng phím, chỉ gửi khi người dùng ngừng gõ.

import { track } from './analytics.js';

/** Ngừng gõ tối thiểu bao lâu thì mới tính là một lượt tìm. */
export const SEARCH_DEBOUNCE_MS = 1000;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 50;

/** Từ khóa gửi đi: cắt khoảng trắng hai đầu, tối đa 50 ký tự (cắt xong cắt khoảng trắng cuối lần nữa). */
export const normalizeSearchTerm = (raw) => String(raw ?? '').trim().slice(0, SEARCH_MAX_LENGTH).trimEnd();

/**
 * Bộ gom lượt tìm của một nhóm Tra cứu. `input(raw)` gọi ở mỗi lần ô tìm đổi; `report('search', params)` chỉ chạy khi
 * từ khóa (đã chuẩn hóa) đủ dài, đứng yên đủ `delayMs` và khác từ khóa vừa báo liền trước. `setTimer`/`clearTimer`
 * tiêm được để test không phải chờ thật.
 */
export function createSearchTracker({
  group,
  report = track,
  delayMs = SEARCH_DEBOUNCE_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
} = {}) {
  let timer = null;
  let lastReported = '';
  return {
    input(raw) {
      if (timer !== null) clearTimer(timer);
      timer = null;
      const term = normalizeSearchTerm(raw);
      if (term.length < SEARCH_MIN_LENGTH) return;
      timer = setTimer(() => {
        timer = null;
        if (term === lastReported) return;
        lastReported = term;
        report('search', { search_term: term, lookup_group: group });
      }, delayMs);
    },
  };
}
