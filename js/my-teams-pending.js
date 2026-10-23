// Bản lưu dở của "Đội của tôi" qua đăng nhập OAuth (trang rời đi rồi quay lại): một đội nháp trong `sessionStorage`, hết hạn
// sau 30 phút, giữ nguyên `draft.id` để thử lại không sinh bản trùng. Chỉ xóa khi server xác nhận (`applied` /
// `already-applied`); mọi kết quả khác (lỗi, xung đột, chưa rõ) giữ lại để người dùng thử lại.

import { normalizeTeam } from "./my-teams-model.js";

export const PENDING_KEY = "tqccl:my-teams:pending-save";
export const PENDING_TTL_MS = 30 * 60 * 1000;

function defaultStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Cất đội nháp (thay mục cũ). Trả `false` khi storage vắng, đầy hoặc bị chặn; không ném. */
export function stashPendingSave(draft, { storage = defaultStorage(), now = Date.now } = {}) {
  try {
    if (!storage) return false;
    storage.setItem(PENDING_KEY, JSON.stringify({ draft, createdAt: now() }));
    return true;
  } catch {
    return false;
  }
}

/** Đội nháp đang chờ lưu, hoặc `null` khi không có, đã quá 30 phút hay dữ liệu hỏng (mục hỏng/hết hạn bị dọn). Không xóa mục còn hạn. */
export function peekPendingSave({ storage = defaultStorage(), now = Date.now } = {}) {
  try {
    const raw = storage?.getItem(PENDING_KEY);
    if (!raw) return null;
    let entry = null;
    try {
      entry = JSON.parse(raw);
    } catch {
      entry = null;
    }
    const draft = Number.isFinite(entry?.createdAt) && now() - entry.createdAt <= PENDING_TTL_MS ? normalizeTeam(entry.draft) : null;
    if (!draft) {
      clearPendingSave({ storage });
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearPendingSave({ storage = defaultStorage() } = {}) {
  try {
    storage?.removeItem(PENDING_KEY);
  } catch {
    // Storage bị chặn: không có gì để dọn.
  }
}

/**
 * Gọi với kết quả của `saveTeam`: chỉ `applied`/`already-applied` của ĐÚNG đội đang chờ (`result.team.id === draft.id`) mới
 * xóa bản lưu dở; lưu đội khác từ hộp thoại không được làm mất bản lưu dở đang chờ thử lại. Trả `true` khi đã xóa.
 */
export function completePendingSave(result, { storage = defaultStorage(), now = Date.now } = {}) {
  if (result?.ok !== true || (result.outcome !== "applied" && result.outcome !== "already-applied")) return false;
  if (peekPendingSave({ storage, now })?.id !== result.team?.id) return false;
  clearPendingSave({ storage });
  return true;
}

/** `draft.id` của bản lưu dở còn hạn có cùng nguồn (`kind:key`), hoặc `null`. Sau OAuth, lưu lại cùng nguồn dùng lại id này
 *  thay vì sinh id mới (bản lưu dở còn nguyên sẽ bị phát lại thành đội trùng). */
export function pendingIdForSource(sourceKey, opts = {}) {
  const draft = peekPendingSave(opts);
  return draft && `${draft.source?.kind}:${draft.source?.key}` === sourceKey ? draft.id : null;
}
