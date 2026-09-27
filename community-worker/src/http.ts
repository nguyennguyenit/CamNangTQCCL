// Lỗi API chuẩn `{error:{code,message}}` + con trỏ phân trang mờ (base64url).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export interface Cursor {
  t: number;
  id: string;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

export function encodeCursor(cursor: Cursor): string {
  return toBase64Url(JSON.stringify([cursor.t, cursor.id]));
}

/** Giải con trỏ; rỗng -> null; hỏng -> ApiError 400. */
export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null;
  try {
    if (raw.length > 200) throw new Error("long");
    const b64 = raw.replace(/-/gu, "+").replace(/_/gu, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const text = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const parsed: unknown = JSON.parse(text);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      Number.isSafeInteger(parsed[0]) &&
      typeof parsed[1] === "string" &&
      parsed[1].length <= 64
    ) {
      return { t: parsed[0], id: parsed[1] };
    }
  } catch {
    // rơi xuống lỗi chung bên dưới
  }
  throw new ApiError(400, "invalid_cursor", "Con trỏ phân trang không hợp lệ");
}

/**
 * Cắt trang: truy vấn lấy limit+1 dòng (mới nhất trước) -> items + nextCursor.
 * Hàng phải có created_at (ms) và id.
 */
export function paginate<T extends { created_at: number; id: string }>(
  rows: T[],
  limit: number,
): { rows: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { rows, nextCursor: null };
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return { rows: page, nextCursor: encodeCursor({ t: last.created_at, id: last.id }) };
}

export const iso = (ms: number | null | undefined): string | null =>
  ms == null ? null : new Date(ms).toISOString();
