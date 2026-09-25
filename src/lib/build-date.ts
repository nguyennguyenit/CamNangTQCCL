/**
 * Ngày build dùng cho chip "Dữ liệu cập nhật" ở footer (quyết định plan #8: ngày cập nhật = ngày build,
 * giờ Việt Nam). Giá trị chỉ tính một lần cho cả lần build nên mọi trang ra cùng một ngày.
 */
const BUILD_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** `dd/mm/yyyy` theo giờ Việt Nam; tách khỏi phần memo để test được mốc ngày cụ thể. */
export function formatBuildDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUILD_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** Memo ở cấp module: mọi trang trong cùng lần build dùng chung một mốc. */
let memoized: string | null = null;

export function buildDateVi(): string {
  if (memoized === null) memoized = formatBuildDate(new Date());
  return memoized;
}
