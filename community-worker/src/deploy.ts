// Kích hoạt build lại site: repository_dispatch `site-publish` -> .github/workflows/pages-deploy.yml.
// Dùng cho bài viết blog và các thay đổi hiển thị của Đội cộng đồng (duyệt, xoá, khoá/mở khoá, xoá tài khoản).

import { settleDeploy } from "./audit";
import type { Ctx } from "./context";
import type { Env } from "./env";

export interface DeployResult {
  ok: boolean;
  status: number | null;
  error?: string;
}

// Pages `tqccl` là project direct upload (không có Deploy hook): gửi repository_dispatch để
// workflow .github/workflows/pages-deploy.yml build + deploy lại site từ main.
export const DEPLOY_EVENT_TYPE = "site-publish";

/** Gọi GitHub repository_dispatch; lỗi chỉ báo trong response, không rollback DB. */
export async function triggerDeploy(env: Env, fetchImpl: typeof fetch): Promise<DeployResult> {
  const repo = env.GITHUB_REPOSITORY?.trim();
  if (!env.GITHUB_DISPATCH_TOKEN || !repo || !/^[\w.-]+\/[\w.-]+$/u.test(repo)) {
    return { ok: false, status: null, error: "deploy_hook_not_configured" };
  }
  try {
    const resp = await fetchImpl(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        "Content-Type": "application/json",
        "User-Agent": "tqccl-community-worker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: DEPLOY_EVENT_TYPE }),
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok ? { ok: true, status: resp.status } : { ok: false, status: resp.status, error: "deploy_hook_failed" };
  } catch {
    return { ok: false, status: null, error: "deploy_hook_unreachable" };
  }
}

/** Thao tác có kích hoạt deploy: dòng nhật ký vào D1 cùng batch với `meta.deploy = 'pending'`, rồi cập nhật đúng dòng đó. */
export function deployMeta(meta: Record<string, unknown>, dispatch: boolean): Record<string, unknown> {
  return dispatch ? { ...meta, deploy: "pending" } : meta;
}

export async function settle(c: Ctx, auditId: string, meta: Record<string, unknown>, deploy: DeployResult): Promise<void> {
  try {
    await settleDeploy(c, auditId, meta, deploy);
  } catch (error) {
    // Thay đổi và deploy đã xong: không đổi phản hồi thành lỗi; dòng giữ `deploy: pending` (kết quả chưa rõ).
    console.error("admin_audit deploy settle failed", auditId, error);
  }
}
