// Số việc chờ của trang /quan-tri/ (badge trên điều hướng + dòng tổng ở khu Góp ý): một truy vấn đếm theo
// trạng thái, mỗi bảng dùng index (status, …) sẵn có.

import { Hono } from "hono";
import { requireAdmin, type AppEnv } from "../context";

interface CountsRow {
  reports_pending: number;
  posts_draft: number;
  feedback_new: number;
  feedback_done: number;
  scan_pending: number;
}

const COUNTS_SQL =
  "select " +
  "(select count(*) from battle_reports where status = 'pending') as reports_pending, " +
  "(select count(*) from posts where status = 'draft') as posts_draft, " +
  "(select count(*) from feedback where status = 'new') as feedback_new, " +
  "(select count(*) from feedback where status = 'done') as feedback_done, " +
  "(select count(*) from scan_samples where status = 'pending') as scan_pending";

export const admin = new Hono<AppEnv>();

admin.get("/api/admin/counts", async (c) => {
  await requireAdmin(c);
  const row = await c.env.DB.prepare(COUNTS_SQL).first<CountsRow>();
  return c.json({
    reportsPending: Number(row?.reports_pending ?? 0),
    postsDraft: Number(row?.posts_draft ?? 0),
    feedbackNew: Number(row?.feedback_new ?? 0),
    feedbackDone: Number(row?.feedback_done ?? 0),
    scanPending: Number(row?.scan_pending ?? 0),
  });
});
