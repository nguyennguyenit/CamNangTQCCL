// Kiểm scheme dùng chung cho mọi URL nguồn lấy từ dữ liệu (quyết định #14). Không phụ thuộc module nào để trang chỉ cần
// chân dung (trang riêng Tra cứu) không kéo theo mùa, bộ lọc, dữ liệu đội.

/**
 * Chỉ nhận `http(s)` tuyệt đối, không userinfo, không ký tự điều khiển; fragment được giữ (link Google Sheets có `#gid=…`).
 * URL hỏng trả `null` để caller không dựng link — không ném lỗi ra ngoài.
 */
export function validateHttpSourceUrl(raw) {
  if (typeof raw !== 'string' || /[\u0000-\u001f]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
