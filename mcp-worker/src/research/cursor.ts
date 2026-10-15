import { stableStringify } from "../domain/contracts.js";
import { PUBLIC_ERRORS, ResearchHandlerError } from "./handler-error.js";

/**
 * Cursor gắn với tool + bộ lọc chuẩn hoá + locale + workflowVersion. Dùng lại
 * cursor ở tool/bộ lọc/locale khác → `CURSOR_INVALID`; ở workflowVersion khác →
 * `WORKFLOW_VERSION_CHANGED`.
 */
export interface CursorBinding {
  tool: string;
  locale: string;
  /** Bộ lọc đã chuẩn hoá và bỏ `limit`/`cursor`; phải tất định. */
  filter: unknown;
  workflowVersion: string;
}

interface CursorPayload {
  v: string;
  q: string;
  o: number;
}

async function identity(binding: CursorBinding): Promise<string> {
  const bytes = new TextEncoder().encode(
    stableStringify({ tool: binding.tool, locale: binding.locale, filter: binding.filter }),
  );
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  // 16 byte đầu, base64url: không tạo chuỗi hex dài mà client có thể che.
  let binary = "";
  for (const byte of digest.slice(0, 16)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "");
}

function cursorInvalid(): ResearchHandlerError {
  return new ResearchHandlerError("CURSOR_INVALID", PUBLIC_ERRORS.CURSOR_INVALID.message);
}

export async function encodeCursor(binding: CursorBinding, offset: number): Promise<string> {
  const payload: CursorPayload = { v: binding.workflowVersion, q: await identity(binding), o: offset };
  return btoa(JSON.stringify(payload));
}

/** Giải mã và kiểm ràng buộc; trả offset. */
export async function decodeCursor(cursor: string, binding: CursorBinding): Promise<number> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(atob(cursor)) as Record<string, unknown>;
  } catch {
    throw cursorInvalid();
  }
  if (
    typeof parsed !== "object" || parsed === null ||
    typeof parsed.v !== "string" ||
    typeof parsed.q !== "string" ||
    typeof parsed.o !== "number" ||
    !Number.isSafeInteger(parsed.o) ||
    parsed.o < 0
  ) {
    throw cursorInvalid();
  }
  if (parsed.v !== binding.workflowVersion) {
    throw new ResearchHandlerError("WORKFLOW_VERSION_CHANGED", PUBLIC_ERRORS.WORKFLOW_VERSION_CHANGED.message, true);
  }
  if (parsed.q !== (await identity(binding))) throw cursorInvalid();
  return parsed.o;
}
