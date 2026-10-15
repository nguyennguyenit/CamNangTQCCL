import { utf8Length } from "./tool-context.js";

/** Ngân sách an toàn dưới trần 40.000 ký tự và 42 KiB mỗi kết quả. */
export const PAGE_CHAR_BUDGET = 34_000;
export const PAGE_BYTE_BUDGET = 40_000;

export function withinBudget(value: unknown): boolean {
  return JSON.stringify(value).length <= PAGE_CHAR_BUDGET && utf8Length(value) <= PAGE_BYTE_BUDGET;
}

/**
 * Lấy tối đa `limit` phần tử từ `offset`, rồi bỏ bớt đuôi cho đến khi kết quả
 * `render(page)` vừa ngân sách. Phần bị bỏ không mất: `nextOffset` trỏ đúng chỗ.
 * Luôn giữ ít nhất một phần tử; nếu một phần tử đơn lẻ vẫn quá lớn thì
 * `enforceResultSize` ở dispatcher báo `RESULT_TOO_LARGE`.
 */
export function fitPage<T>(
  items: readonly T[],
  offset: number,
  limit: number,
  render: (page: T[]) => unknown,
): { page: T[]; nextOffset: number | null } {
  const page = items.slice(offset, offset + limit);
  while (page.length > 1 && !withinBudget(render(page))) page.pop();
  const next = offset + page.length;
  return { page, nextOffset: next < items.length ? next : null };
}
