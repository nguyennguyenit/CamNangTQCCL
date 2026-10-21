// Đội cộng đồng: mùa, ảnh tạm + AI nháp, đăng (nguyên tử), danh sách/chi tiết/ảnh, vote, xoá, duyệt và mở mùa (admin).
// Quyền, mùa và hiển thị được kiểm trong chính câu ghi (insert … select … where exists), không chỉ ở bước đọc.

import { Hono } from "hono";
import { AiCallError, loadAiConfig, resolveRoute } from "../../../shared/ai-config";
import { callModel } from "../../../worker/src/model";
import { auditIfStmt, auditStmt } from "../audit";
import { toDataUri } from "../analyze";
import { currentUser, effectiveRole, PAGE_SIZE, requireRoot, requireStaff, requireUser, type AppEnv, type Ctx, type Viewer } from "../context";
import { adminEmails, isAdminEmail } from "../env";
import { ApiError, decodeCursor, iso, paginate, paginateByKey } from "../http";
import { maskEmail, visibleUserSql } from "../moderation";
import { consumeRateLimit } from "../ratelimit";
import {
  heroKey,
  parseHeroFilter,
  parseSeasonFilter,
  parseSeasonInput,
  parseTeamInput,
  parseTeamSort,
  parseVote,
  type TeamSort,
} from "../teams-validate";
import { communityTeamIdFromPage, IMAGE_TYPES, parseImageUpload, parseText, readJson } from "../validate";

export const TEAM_IMAGE_MAX_BYTES = 1_500_000;
const R2_DELETE_CHUNK = 100;
const PENDING_PREFIX = "pending/team-";

/** Đội hiển thị công khai: đã duyệt, chưa chốt xoá, tác giả không bị khoá/đang xoá (u = bảng user của tác giả; bind một `now`). */
export function teamVisibleSql(t: string, u: string): string {
  return `${t}.status = 'approved' and ${t}.deleting_at is null and ${visibleUserSql(u)}`;
}

/** Đoạn `exists` đội của trang cộng đồng còn hiển thị; bind `[teamId, now]`. */
export const communityTeamVisibleSql =
  `exists (select 1 from community_teams t join "user" u on u.id = t.author_id where t.id = ? and ${teamVisibleSql("t", "u")})`;

/** Như trên, thêm mùa của đội còn mở; bind `[teamId, now]`. */
export const communityTeamVisibleOpenSql =
  `exists (select 1 from community_teams t join "user" u on u.id = t.author_id join community_seasons s on s.id = t.season_id ` +
  `where t.id = ? and ${teamVisibleSql("t", "u")} and s.closed_at is null)`;

/** Chẩn đoán đội của trang cộng đồng: không thấy/không hiển thị -> missing; hiển thị nhưng mùa đóng -> closed. */
export async function diagnoseCommunityTeam(
  db: D1Database,
  id: string,
  now: number,
): Promise<{ state: "missing" | "closed" | "ok"; seasonId: string | null }> {
  const row = await db
    .prepare(
      `select t.season_id, s.closed_at, (${teamVisibleSql("t", "u")}) as visible from community_teams t ` +
        'join community_seasons s on s.id = t.season_id join "user" u on u.id = t.author_id where t.id = ?',
    )
    .bind(now, id)
    .first<{ season_id: string; closed_at: number | null; visible: number }>();
  if (!row || !row.visible) return { state: "missing", seasonId: null };
  return { state: row.closed_at === null ? "ok" : "closed", seasonId: row.season_id };
}

const pageKeyOf = (teamId: string) => `/doi-cong-dong/${teamId}/`;
const placeholders = (n: number) => Array.from({ length: n }, () => "?").join(", ");

interface TeamRow {
  id: string;
  author_id: string;
  season_id: string;
  status: "pending" | "approved" | "rejected";
  title: string;
  hero_1: string;
  hero_2: string;
  hero_3: string;
  hero_key: string;
  tactics: string;
  troop: string;
  playstyle: string;
  strengths: string | null;
  weaknesses: string | null;
  counters: string | null;
  countered_by: string | null;
  substitutes: string | null;
  text_lang: string;
  reject_reason: string | null;
  deleting_at: number | null;
  created_at: number;
  up_votes: number;
  down_votes: number;
  evidence_count: number;
  points: number;
  season_label_vi: string;
  season_label_zh: string;
  season_closed_at: number | null;
  author_name: string;
  author_image: string | null;
  author_visible: number;
  comment_count: number;
  image_count: number;
  sort_key?: number;
}

// Cột đầu tiên có `?` là điều kiện hiển thị tác giả: mọi truy vấn bind `now` trước các điều kiện where.
const TEAM_SELECT =
  "select t.id, t.author_id, t.season_id, t.status, t.title, t.hero_1, t.hero_2, t.hero_3, t.hero_key, t.tactics, t.troop, t.playstyle, " +
  "t.strengths, t.weaknesses, t.counters, t.countered_by, t.substitutes, t.text_lang, t.reject_reason, t.deleting_at, t.created_at, " +
  "t.up_votes, t.down_votes, t.evidence_count, t.points, s.label_vi as season_label_vi, s.label_zh as season_label_zh, " +
  's.closed_at as season_closed_at, u.name as author_name, u.image as author_image, (' +
  visibleUserSql("u") +
  ") as author_visible, " +
  "(select count(*) from comments where page_key = '/doi-cong-dong/' || t.id || '/') as comment_count, " +
  "(select count(*) from community_team_images i where i.team_id = t.id) as image_count";
const TEAM_FROM = ' from community_teams t join community_seasons s on s.id = t.season_id join "user" u on u.id = t.author_id';

function toItem(row: TeamRow) {
  const tactics: string[][] = JSON.parse(row.tactics);
  return {
    id: row.id,
    title: row.title,
    season: { id: row.season_id, labelVi: row.season_label_vi, labelZh: row.season_label_zh },
    heroes: [row.hero_1, row.hero_2, row.hero_3],
    tactics,
    troop: row.troop,
    author: { id: row.author_id, name: row.author_name, image: row.author_image },
    upVotes: row.up_votes,
    downVotes: row.down_votes,
    evidenceCount: row.evidence_count,
    points: row.points,
    commentCount: row.comment_count,
    imageCount: row.image_count,
    textLang: row.text_lang,
    createdAt: iso(row.created_at),
  };
}

function teamIdParam(c: Ctx): string {
  const id = communityTeamIdFromPage(pageKeyOf(c.req.param("id") ?? ""));
  if (!id) throw new ApiError(404, "not_found", "Không tìm thấy đội");
  return id;
}

async function openSeason(db: D1Database) {
  return db
    .prepare("select id, label_vi, label_zh, opened_at from community_seasons where closed_at is null")
    .first<{ id: string; label_vi: string; label_zh: string; opened_at: number }>();
}

/** Xoá khoá R2 theo lô; lỗi chỉ log (dọn tạm, không làm hỏng kết quả chính). */
async function removeQuietly(c: Ctx, keys: string[]): Promise<void> {
  if (!keys.length) return;
  try {
    await c.env.MEDIA.delete(keys);
  } catch (error) {
    console.error("team: R2 cleanup failed", keys, error);
  }
}

/** Chủ đội hoặc staff mới xem được đội chưa công khai. */
async function mayViewHidden(c: Ctx, authorId: string): Promise<boolean> {
  const user = await currentUser(c);
  return !!user && (user.id === authorId || effectiveRole(c.env, user) !== "user");
}

/** If-None-Match có khớp ETag không (danh sách, bỏ tiền tố yếu W/, hoặc *). */
function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const tag = part.trim().replace(/^W\//u, "");
    return tag === "*" || tag === etag;
  });
}

export const teams = new Hono<AppEnv>();

teams.get("/api/community-seasons", async (c) => {
  const { results } = await c.env.DB.prepare(
    "select id, label_vi, label_zh, opened_at, closed_at from community_seasons order by opened_at desc, id desc",
  ).all<{ id: string; label_vi: string; label_zh: string; opened_at: number; closed_at: number | null }>();
  const seasons = results.map((s) => ({
    id: s.id,
    labelVi: s.label_vi,
    labelZh: s.label_zh,
    openedAt: iso(s.opened_at),
    closedAt: iso(s.closed_at),
  }));
  const open = results.find((s) => s.closed_at === null);
  return c.json({
    open: open ? { id: open.id, labelVi: open.label_vi, labelZh: open.label_zh, openedAt: iso(open.opened_at) } : null,
    seasons,
  });
});

teams.post("/api/community-teams/uploads", async (c) => {
  const { user } = await requireUser(c);
  const image = await parseImageUpload(c.req.raw, "image", TEAM_IMAGE_MAX_BYTES);
  const { now, newId } = c.get("deps");
  const createdAt = now();
  await consumeRateLimit(c.env.DB, "team_upload", user.id, createdAt);

  const uploadId = newId();
  const key = `${PENDING_PREFIX}${uploadId}`;
  await c.env.MEDIA.put(key, image.bytes, { httpMetadata: { contentType: image.contentType }, customMetadata: { userId: user.id } });
  try {
    await c.env.DB.prepare(
      "insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, 'report', ?, ?, ?, 'pending', ?)",
    )
      .bind(uploadId, user.id, key, image.contentType, image.bytes.length, createdAt)
      .run();
  } catch (e) {
    await removeQuietly(c, [key]);
    throw e;
  }
  return c.json({ uploadId });
});

teams.post("/api/community-teams/uploads/:id/analyze", async (c) => {
  const { user } = await requireUser(c);
  if ((c.env.FEATURE_ENABLED ?? "true") === "false") {
    throw new ApiError(503, "feature_disabled", "Tính năng phân tích ảnh đang tạm tắt");
  }
  const route = resolveRoute(await loadAiConfig(c.env.AI_KV, c.env.AI_CONFIG_SECRET), "teamScan");
  if (!route.targets.length) throw new ApiError(503, "ai_not_configured", "Chưa cấu hình dịch vụ AI");

  const notFound = new ApiError(404, "not_found", "Không tìm thấy ảnh");
  const uploadId = c.req.param("id");
  const upload = await c.env.DB.prepare(
    "select object_key, content_type from uploads where id = ? and user_id = ? and kind = 'report' and status = 'pending' and object_key = ?",
  )
    .bind(uploadId, user.id, `${PENDING_PREFIX}${uploadId}`)
    .first<{ object_key: string; content_type: string }>();
  if (!upload) throw notFound;
  const object = await c.env.MEDIA.get(upload.object_key);
  if (!object) throw notFound;

  const { now, fetchImpl } = c.get("deps");
  const at = now();
  await consumeRateLimit(c.env.DB, "team_analyze", user.id, at);
  await consumeRateLimit(c.env.DB, "team_analyze_global", "site", at);

  const bytes = new Uint8Array(await object.arrayBuffer());
  try {
    const read = await callModel(toDataUri(bytes, upload.content_type), { route, fetchImpl }, "analyzeTeamImage");
    return c.json({ read });
  } catch (e) {
    // Upload luôn được giữ: người dùng thử lại hoặc tự nhập form.
    if (e instanceof AiCallError) throw new ApiError(e.status, e.code, e.message);
    const status = e instanceof Error && "status" in e ? e.status : undefined;
    if (status === 422) return c.json({ read: { screen: "other", sides: [] } });
    if (status === 502) throw new ApiError(502, "ai_unavailable", "Dịch vụ AI tạm lỗi, thử lại sau");
    throw e;
  }
});

teams.post("/api/community-teams", async (c) => {
  const { user } = await requireUser(c);
  const input = parseTeamInput(await readJson(c.req.raw));
  const { now, newId } = c.get("deps");
  const createdAt = now();
  const season = await openSeason(c.env.DB);
  if (!season) throw new ApiError(409, "season_not_open", "Hiện chưa có mùa đang mở");
  await consumeRateLimit(c.env.DB, "team_post", user.id, createdAt);

  const imageMissing = new ApiError(409, "image_missing", "Ảnh không tồn tại, đã dùng hoặc hết hạn");
  const ids = input.uploadIds;
  const ownedUpload = `id in (${placeholders(ids.length)}) and user_id = ? and kind = 'report' and status = 'pending' and object_key = '${PENDING_PREFIX}' || id`;
  // Preflight (chỉ để báo lỗi sớm; chốt an toàn là điều kiện trong batch bên dưới).
  const { results: found } = await c.env.DB.prepare(`select id, content_type from uploads where ${ownedUpload}`)
    .bind(...ids, user.id)
    .all<{ id: string; content_type: string }>();
  if (found.length !== ids.length) throw imageMissing;
  const typeById = new Map(found.map((u) => [u.id, u.content_type]));

  const teamId = newId();
  const copied: string[] = [];
  const images: { position: number; key: string; contentType: string }[] = [];
  try {
    for (const [position, uploadId] of ids.entries()) {
      const object = await c.env.MEDIA.get(`${PENDING_PREFIX}${uploadId}`);
      if (!object) throw imageMissing;
      const contentType = typeById.get(uploadId) ?? "application/octet-stream";
      const key = `community-teams/${teamId}/${position}.${IMAGE_TYPES[contentType] ?? "img"}`;
      await c.env.MEDIA.put(key, await object.arrayBuffer(), { httpMetadata: { contentType }, customMetadata: { userId: user.id } });
      copied.push(key);
      images.push({ position, key, contentType });
    }
  } catch (e) {
    await removeQuietly(c, copied);
    throw e;
  }

  const teamExists = "exists (select 1 from community_teams where id = ?)";
  let results: D1Result[];
  try {
    results = await c.env.DB.batch([
      c.env.DB.prepare(
        "insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle, " +
          "strengths, weaknesses, counters, countered_by, substitutes, text_lang, created_at) " +
          `select ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? where (select count(*) from uploads where ${ownedUpload}) = ? ` +
          "and exists (select 1 from community_seasons where id = ? and closed_at is null)",
      ).bind(
        teamId,
        user.id,
        season.id,
        input.title,
        ...input.heroes,
        heroKey(input.heroes),
        JSON.stringify(input.tactics),
        input.troop,
        input.playstyle,
        input.strengths,
        input.weaknesses,
        input.counters,
        input.counteredBy,
        input.substitutes,
        input.lang,
        createdAt,
        ...ids,
        user.id,
        ids.length,
        season.id,
      ),
      ...images.map((img) =>
        c.env.DB.prepare(
          `insert into community_team_images (team_id, position, object_key, content_type) select ?, ?, ?, ? where ${teamExists}`,
        ).bind(teamId, img.position, img.key, img.contentType, teamId),
      ),
      c.env.DB.prepare(`delete from uploads where id in (${placeholders(ids.length)}) and ${teamExists}`).bind(...ids, teamId),
    ]);
  } catch (e) {
    await removeQuietly(c, copied);
    throw e;
  }
  if (results[0].meta.changes === 0) {
    await removeQuietly(c, copied);
    const stillOpen = await c.env.DB.prepare("select 1 as ok from community_seasons where id = ? and closed_at is null").bind(season.id).first();
    throw stillOpen ? imageMissing : new ApiError(409, "season_not_open", "Mùa đã đóng");
  }
  await removeQuietly(c, ids.map((id) => `${PENDING_PREFIX}${id}`));
  return c.json({ id: teamId, status: "pending" }, 201);
});

const SORT_COLUMN: Record<TeamSort, string> = { hot: "t.hot_rank", top: "t.top_rank", new: "t.created_at" };

teams.get("/api/community-teams", async (c) => {
  const sort = parseTeamSort(c.req.query("sort"));
  const heroes = parseHeroFilter(c.req.query("heroes"));
  const seasonFilter = parseSeasonFilter(c.req.query("season"));
  const cursor = decodeCursor(c.req.query("cursor"));
  const now = c.get("deps").now();

  let seasonId = seasonFilter;
  if (seasonId === null) {
    const open = await openSeason(c.env.DB);
    if (!open) return c.json({ items: [], nextCursor: null });
    seasonId = open.id;
  }
  const where = [teamVisibleSql("t", "u")];
  const binds: unknown[] = [now];
  if (seasonId !== "all") {
    where.push("t.season_id = ?");
    binds.push(seasonId);
  }
  for (const hero of heroes) {
    where.push("(t.hero_1 = ? or t.hero_2 = ? or t.hero_3 = ?)");
    binds.push(hero, hero, hero);
  }
  const column = SORT_COLUMN[sort];
  if (cursor) {
    where.push(`(${column} < ? or (${column} = ? and t.id < ?))`);
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(
    `${TEAM_SELECT}, ${column} as sort_key${TEAM_FROM} where ${where.join(" and ")} order by ${column} desc, t.id desc limit ?`,
  )
    .bind(now, ...binds, PAGE_SIZE + 1)
    .all<TeamRow & { sort_key: number }>();
  const page = paginateByKey(results, PAGE_SIZE, "sort_key");
  return c.json({ items: page.rows.map(toItem), nextCursor: page.nextCursor });
});

teams.get("/api/me/community-teams", async (c) => {
  const { user } = await requireUser(c);
  const cursor = decodeCursor(c.req.query("cursor"));
  const now = c.get("deps").now();
  // Kể cả đội xoá dở (`deleting: true`) để chủ gọi lại DELETE sau 502 `delete_incomplete`.
  const where = ["t.author_id = ?"];
  const binds: unknown[] = [user.id];
  if (cursor) {
    where.push("(t.created_at < ? or (t.created_at = ? and t.id < ?))");
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(
    `${TEAM_SELECT}${TEAM_FROM} where ${where.join(" and ")} order by t.created_at desc, t.id desc limit ?`,
  )
    .bind(now, ...binds, PAGE_SIZE + 1)
    .all<TeamRow>();
  const page = paginate(results, PAGE_SIZE);
  return c.json({
    items: page.rows.map((row) => ({
      ...toItem(row),
      status: row.status,
      rejectReason: row.reject_reason,
      deleting: row.deleting_at !== null,
    })),
    nextCursor: page.nextCursor,
  });
});

teams.get("/api/community-teams/:id", async (c) => {
  const id = teamIdParam(c);
  const now = c.get("deps").now();
  const row = await c.env.DB.prepare(`${TEAM_SELECT}${TEAM_FROM} where t.id = ?`).bind(now, id).first<TeamRow>();
  const notFound = new ApiError(404, "not_found", "Không tìm thấy đội");
  if (!row || row.deleting_at !== null) throw notFound;
  const open = row.status === "approved" && row.author_visible === 1;
  const privileged = await mayViewHidden(c, row.author_id);
  if (!open && !privileged) throw notFound;
  const user = await currentUser(c);
  const vote = user
    ? await c.env.DB.prepare("select value from community_team_votes where team_id = ? and user_id = ?").bind(id, user.id).first<{ value: number }>()
    : null;
  return c.json({
    ...toItem(row),
    status: row.status,
    heroKey: row.hero_key,
    analysis: {
      playstyle: row.playstyle,
      strengths: row.strengths,
      weaknesses: row.weaknesses,
      counters: row.counters,
      counteredBy: row.countered_by,
      substitutes: row.substitutes,
    },
    myVote: vote?.value ?? 0,
    seasonOpen: row.season_closed_at === null,
    ...(privileged ? { rejectReason: row.reject_reason } : {}),
  });
});

teams.get("/api/community-teams/:id/images/:pos", async (c) => {
  const id = teamIdParam(c);
  const notFound = new ApiError(404, "not_found", "Không tìm thấy ảnh");
  if (!/^[0-2]$/u.test(c.req.param("pos") ?? "")) throw notFound;
  const row = await c.env.DB.prepare(
    `select t.author_id, t.status, t.deleting_at, (${visibleUserSql("u")}) as author_visible, i.object_key ` +
      'from community_teams t join "user" u on u.id = t.author_id join community_team_images i on i.team_id = t.id and i.position = ? where t.id = ?',
  )
    .bind(c.get("deps").now(), Number(c.req.param("pos")), id)
    .first<{ author_id: string; status: string; deleting_at: number | null; author_visible: number; object_key: string }>();
  if (!row || row.deleting_at !== null) throw notFound;
  // Phân quyền xong mới xét ETag: ETag cũ của khách không được dùng để dò ảnh đã bị ẩn.
  const open = row.status === "approved" && row.author_visible === 1;
  if (!open && !(await mayViewHidden(c, row.author_id))) throw notFound;
  const object = await c.env.MEDIA.get(row.object_key);
  if (!object) throw notFound;
  const headers = {
    "Cache-Control": open ? "public, no-cache" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
    ETag: object.httpEtag,
  };
  if (etagMatches(c.req.header("if-none-match"), object.httpEtag)) {
    await object.body.cancel();
    return new Response(null, { status: 304, headers });
  }
  return new Response(object.body, { headers: { ...headers, "Content-Type": object.httpMetadata?.contentType || "application/octet-stream" } });
});

// Đội còn nhận vote: hiển thị công khai + mùa mở (t, s, u đã join).
const VOTABLE_TEAM = `from community_teams t join community_seasons s on s.id = t.season_id join "user" u on u.id = t.author_id where t.id = ? and ${teamVisibleSql("t", "u")} and s.closed_at is null`;

teams.put("/api/community-teams/:id/vote", async (c) => {
  const { user } = await requireUser(c);
  const id = teamIdParam(c);
  const value = parseVote((await readJson(c.req.raw)).value);
  const { now } = c.get("deps");
  const at = now();
  await consumeRateLimit(c.env.DB, "team_vote", user.id, at);

  const res =
    value === 0
      ? await c.env.DB.prepare(
          `delete from community_team_votes where team_id = ? and user_id = ? and exists (select 1 ${VOTABLE_TEAM})`,
        )
          .bind(id, user.id, id, at)
          .run()
      : await c.env.DB.prepare(
          "insert into community_team_votes (team_id, user_id, value, created_at) " +
            `select ?, ?, ?, ? where exists (select 1 ${VOTABLE_TEAM} and t.author_id <> ?) ` +
            `and exists (select 1 from "user" v where v.id = ? and ${visibleUserSql("v")}) ` +
            "on conflict (team_id, user_id) do update set value = excluded.value",
        )
          .bind(id, user.id, value, at, id, at, user.id, user.id, at)
          .run();

  if (res.meta.changes === 0) {
    // Chẩn đoán vì sao không ghi được; bỏ phiếu khi chưa vote là thành công (không có gì để bỏ).
    const team = await c.env.DB.prepare(
      `select t.author_id, s.closed_at, (${teamVisibleSql("t", "u")}) as visible from community_teams t join community_seasons s on s.id = t.season_id join "user" u on u.id = t.author_id where t.id = ?`,
    )
      .bind(at, id)
      .first<{ author_id: string; closed_at: number | null; visible: number }>();
    if (!team || !team.visible) throw new ApiError(404, "not_found", "Không tìm thấy đội");
    if (team.author_id === user.id) throw new ApiError(403, "own_team", "Không thể vote đội của chính mình");
    if (team.closed_at !== null) throw new ApiError(409, "season_closed", "Mùa đã đóng, không thể vote");
    const voter = await c.env.DB.prepare(`select 1 as ok from "user" v where v.id = ? and ${visibleUserSql("v")}`).bind(user.id, at).first();
    if (!voter) throw new ApiError(401, "unauthorized", "Cần đăng nhập");
    if (value !== 0) throw new ApiError(409, "vote_conflict", "Không ghi được phiếu, thử lại");
  }

  const counts = await c.env.DB.prepare(
    "select t.up_votes, t.down_votes, t.points, coalesce((select value from community_team_votes where team_id = t.id and user_id = ?), 0) as my_vote from community_teams t where t.id = ?",
  )
    .bind(user.id, id)
    .first<{ up_votes: number; down_votes: number; points: number; my_vote: number }>();
  if (!counts) throw new ApiError(404, "not_found", "Không tìm thấy đội");
  return c.json({ upVotes: counts.up_votes, downVotes: counts.down_votes, points: counts.points, myVote: counts.my_vote });
});

interface DeleteTarget {
  author_id: string;
  title: string;
  deleting_at: number | null;
  author_role: string | null;
  author_email: string;
}

const DELETE_TARGET =
  'select t.author_id, t.title, t.deleting_at, u.role as author_role, u.email as author_email from community_teams t join "user" u on u.id = t.author_id where t.id = ?';

/** Staff được xoá đội của tác giả này không: root luôn; KDV chỉ khi tác giả không phải KDV/root. */
function staffMayDelete(c: Ctx, viewer: Viewer, target: DeleteTarget): boolean {
  if (viewer.role === "root") return true;
  return viewer.role === "moderator" && target.author_role !== "moderator" && !isAdminEmail(c.env, target.author_email);
}

teams.delete("/api/community-teams/:id", async (c) => {
  const viewer = await requireUser(c);
  const { user, role } = viewer;
  const id = teamIdParam(c);
  const page = pageKeyOf(id);
  const db = c.env.DB;
  const notFound = new ApiError(404, "not_found", "Không tìm thấy đội");
  const target = await db.prepare(DELETE_TARGET).bind(id).first<DeleteTarget>();
  if (!target) throw notFound;
  const owner = target.author_id === user.id;
  if (!owner && !staffMayDelete(c, viewer, target)) throw notFound;
  const byStaff = !owner;
  const rawBody: unknown = await c.req.json().catch(() => null);
  const rawReason = rawBody && typeof rawBody === "object" && "reason" in rawBody ? rawBody.reason : undefined;
  const reason = byStaff ? parseText(rawReason, "reason", 1, 500) : null;

  // Điều kiện quyền nằm trong SQL: đổi vai trò/đội có chiến báo duyệt giữa lúc đọc và ghi không làm xoá nhầm.
  const admins = [...adminEmails(c.env)];
  let perm: string;
  let permBinds: unknown[] = [];
  if (owner) {
    perm =
      "community_teams.author_id = ? and not exists (select 1 from battle_reports r where r.page_key = '/doi-cong-dong/' || community_teams.id || '/' " +
      "and r.status = 'approved' and r.user_id <> community_teams.author_id)";
    permBinds = [user.id];
  } else if (role === "root") {
    perm = "1 = 1";
  } else {
    const notRoot = admins.length ? ` and lower(trim(u.email)) not in (${placeholders(admins.length)})` : "";
    perm = `exists (select 1 from "user" u where u.id = community_teams.author_id and coalesce(u.role, 'user') <> 'moderator'${notRoot})`;
    permBinds = admins;
  }
  const condition = `id = ? and deleting_at is null and (${perm})`;

  const statements: D1PreparedStatement[] = [];
  if (byStaff) {
    const [commentRows, reportRows] = await Promise.all([
      db.prepare("select user_id, count(*) as n from comments where page_key = ? group by user_id").bind(page).all<{ user_id: string; n: number }>(),
      db.prepare("select user_id, count(*) as n from battle_reports where page_key = ? group by user_id").bind(page).all<{ user_id: string; n: number }>(),
    ]);
    const byAuthor: Record<string, { comments: number; reports: number }> = {};
    for (const r of commentRows.results) (byAuthor[r.user_id] ??= { comments: 0, reports: 0 }).comments = r.n;
    for (const r of reportRows.results) (byAuthor[r.user_id] ??= { comments: 0, reports: 0 }).reports = r.n;
    statements.push(
      auditIfStmt(
        c,
        viewer,
        { action: "team.delete", targetType: "team", targetId: id, targetLabel: target.title, subjectUserId: target.author_id, reason, meta: { byAuthor }, status: "ok" },
        `select 1 from community_teams where ${condition}`,
        [id, ...permBinds],
      ),
    );
  }
  statements.push(
    db.prepare(`update community_teams set deleting_at = ? where ${condition}`).bind(c.get("deps").now(), id, ...permBinds),
  );
  const committed = (await db.batch(statements)).at(-1);

  if (!committed || committed.meta.changes === 0) {
    // Không chốt được: đội đã chốt xoá từ lần gọi trước và người gọi còn quyền -> làm tiếp; còn lại giải thích.
    const fresh = await db.prepare(DELETE_TARGET).bind(id).first<DeleteTarget>();
    if (!fresh) throw notFound;
    const mayContinue = fresh.author_id === user.id || staffMayDelete(c, viewer, fresh);
    if (fresh.deleting_at === null || !mayContinue) {
      if (fresh.deleting_at === null && fresh.author_id === user.id) {
        throw new ApiError(409, "has_evidence", "Đội đã có chiến báo được duyệt của người khác, hãy nhờ quản trị viên gỡ");
      }
      throw notFound;
    }
  }

  // Từ đây đội đã ẩn khỏi mọi đọc/ghi công khai; R2 trước, D1 sau, lỗi -> gọi lại endpoint để làm tiếp.
  const [teamImages, reportImages] = await Promise.all([
    db.prepare("select object_key from community_team_images where team_id = ?").bind(id).all<{ object_key: string }>(),
    db.prepare("select image_key from battle_reports where page_key = ? and image_key is not null").bind(page).all<{ image_key: string }>(),
  ]);
  const known = new Set<string>();
  try {
    for (const group of [teamImages.results.map((r) => r.object_key), reportImages.results.map((r) => r.image_key)]) {
      for (let i = 0; i < group.length; i += R2_DELETE_CHUNK) {
        await c.env.MEDIA.delete(group.slice(i, i + R2_DELETE_CHUNK));
      }
      for (const key of group) known.add(key);
    }
  } catch (error) {
    console.error("team delete: R2 cleanup failed", id, error);
    throw new ApiError(502, "delete_incomplete", "Chưa xoá hết ảnh, thử lại để hoàn tất");
  }

  const committedTeam = "exists (select 1 from community_teams where id = ? and deleting_at is not null)";
  const final = await db.batch([
    db.prepare(`delete from comments where page_key = ? and ${committedTeam}`).bind(page, id),
    db
      .prepare(
        `delete from uploads where object_key in (select image_key from battle_reports where page_key = ? and image_key is not null) and ${committedTeam}`,
      )
      .bind(page, id),
    db.prepare(`delete from battle_reports where page_key = ? and ${committedTeam} returning image_key`).bind(page, id),
    db.prepare("delete from community_teams where id = ? and deleting_at is not null").bind(id),
  ]);
  const late = (final[2].results as { image_key: string | null }[]).flatMap((r) => (r.image_key && !known.has(r.image_key) ? [r.image_key] : []));
  await removeQuietly(c, late);
  return c.json({ ok: true });
});

const REVIEW_STATUSES = ["pending", "approved", "rejected", "deleting"] as const;

teams.get("/api/admin/community-teams", async (c) => {
  const viewer = await requireStaff(c);
  const status = c.req.query("status") ?? "pending";
  if (!REVIEW_STATUSES.some((s) => s === status)) {
    throw new ApiError(400, "invalid_status", "status phải là pending, approved, rejected hoặc deleting");
  }
  const cursor = decodeCursor(c.req.query("cursor"));
  // `deleting` = đội xoá dở (mọi trạng thái) để staff gọi lại DELETE; các lọc khác bỏ đội đang xoá.
  const where = status === "deleting" ? ["t.deleting_at is not null"] : ["t.status = ?", "t.deleting_at is null"];
  const binds: unknown[] = status === "deleting" ? [] : [status];
  if (cursor) {
    where.push("(t.created_at < ? or (t.created_at = ? and t.id < ?))");
    binds.push(cursor.t, cursor.t, cursor.id);
  }
  const { results } = await c.env.DB.prepare(
    `${TEAM_SELECT}, u.email as author_email${TEAM_FROM} where ${where.join(" and ")} order by t.created_at desc, t.id desc limit ?`,
  )
    .bind(c.get("deps").now(), ...binds, PAGE_SIZE + 1)
    .all<TeamRow & { author_email: string }>();
  const page = paginate(results, PAGE_SIZE);
  return c.json({
    items: page.rows.map((row) => {
      const item = toItem(row);
      const author =
        viewer.role === "root"
          ? { ...item.author, email: row.author_email }
          : { ...item.author, email: maskEmail(row.author_email), emailMasked: true };
      return { ...item, author, status: row.status, rejectReason: row.reject_reason, deleting: row.deleting_at !== null };
    }),
    nextCursor: page.nextCursor,
  });
});

interface ReviewTarget {
  author_id: string;
  title: string;
  status: string;
  reviewed_at: number | null;
}

/**
 * Chuyển pending -> approved/rejected. Audit đứng TRƯỚC câu update với cùng điều kiện `pending`, nên chỉ request
 * thực sự chuyển trạng thái mới ghi audit (kể cả hai request cùng người, cùng mili-giây).
 * Trả `true` nếu request này chốt trạng thái; `false` nếu đội đã `rejected` từ lần gọi trước (để làm tiếp việc xoá ảnh).
 */
async function reviewTeam(c: Ctx, viewer: Viewer, id: string, status: "approved" | "rejected", reason: string | null): Promise<boolean> {
  const db = c.env.DB;
  const notFound = new ApiError(404, "not_found", "Không tìm thấy đội");
  const target = await db
    .prepare("select author_id, title, status, reviewed_at from community_teams where id = ? and deleting_at is null")
    .bind(id)
    .first<ReviewTarget>();
  if (!target) throw notFound;
  const at = c.get("deps").now();
  const pending = "id = ? and status = 'pending' and deleting_at is null";
  const [, res] = await db.batch([
    auditIfStmt(
      c,
      viewer,
      {
        action: status === "approved" ? "team.approve" : "team.reject",
        targetType: "team",
        targetId: id,
        targetLabel: target.title,
        subjectUserId: target.author_id,
        reason,
        status: "ok",
      },
      `select 1 from community_teams where ${pending}`,
      [id],
    ),
    db
      .prepare(`update community_teams set status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? where ${pending}`)
      .bind(status, reason, viewer.user.id, at, id),
  ]);
  if (res.meta.changes) return true;

  const fresh = await db
    .prepare("select author_id, title, status, reviewed_at from community_teams where id = ? and deleting_at is null")
    .bind(id)
    .first<ReviewTarget>();
  if (!fresh) throw notFound;
  // Gọi lại sau lỗi R2: chỉ từ chối, và chỉ khi lần chốt trước ở mili-giây khác (hai request song song cùng mili-giây thì một bên thua).
  const retry = status === "rejected" && fresh.status === "rejected" && fresh.reviewed_at !== null && fresh.reviewed_at < at;
  if (!retry) throw new ApiError(409, "not_pending", "Đội đã được xử lý");
  const left = await db.prepare("select 1 as n from community_team_images where team_id = ? limit 1").bind(id).first();
  if (!left) throw new ApiError(409, "not_pending", "Đội đã được xử lý");
  return false;
}

teams.post("/api/admin/community-teams/:id/approve", async (c) => {
  const viewer = await requireStaff(c);
  const id = teamIdParam(c);
  await reviewTeam(c, viewer, id, "approved", null);
  return c.json({ id, status: "approved" });
});

teams.post("/api/admin/community-teams/:id/reject", async (c) => {
  const viewer = await requireStaff(c);
  const id = teamIdParam(c);
  const reason = parseText((await readJson(c.req.raw)).reason, "reason", 1, 500);
  const committed = await reviewTeam(c, viewer, id, "rejected", reason);

  // Đội bị từ chối không giữ ảnh: R2 trước, D1 sau; lỗi -> 502, gọi lại endpoint để hoàn tất (không ghi audit lần hai).
  const db = c.env.DB;
  const images = await db.prepare("select object_key from community_team_images where team_id = ?").bind(id).all<{ object_key: string }>();
  try {
    for (let i = 0; i < images.results.length; i += R2_DELETE_CHUNK) {
      await c.env.MEDIA.delete(images.results.slice(i, i + R2_DELETE_CHUNK).map((r) => r.object_key));
    }
  } catch (error) {
    console.error("team reject: R2 cleanup failed", id, error);
    throw new ApiError(502, "delete_incomplete", "Chưa xoá hết ảnh, thử lại để hoàn tất");
  }
  await db
    .prepare("delete from community_team_images where team_id = ? and exists (select 1 from community_teams where id = ? and status = 'rejected')")
    .bind(id, id)
    .run();
  // Gọi lại: trả lý do đã lưu ở lần chốt trước, không phải lý do của request này.
  const stored = committed
    ? reason
    : ((await db.prepare("select reject_reason from community_teams where id = ?").bind(id).first<{ reject_reason: string | null }>())?.reject_reason ??
      reason);
  return c.json({ id, status: "rejected", rejectReason: stored });
});

teams.post("/api/admin/community-seasons", async (c) => {
  const viewer = await requireRoot(c);
  const input = parseSeasonInput(await readJson(c.req.raw));
  const db = c.env.DB;
  const exists = new ApiError(409, "season_exists", "Mùa này đã tồn tại");
  if (await db.prepare("select 1 as n from community_seasons where id = ?").bind(input.id).first()) throw exists;
  const previous = (await db.prepare("select id from community_seasons where closed_at is null").first<{ id: string }>())?.id ?? null;
  const at = c.get("deps").now();
  try {
    // Chỉ đóng đúng mùa đã đọc (`previous`): nếu mùa khác chen vào, câu đóng không đổi gì, insert vướng unique index mùa mở
    // -> cả batch rollback -> 409 `season_conflict` (audit `previous` luôn đúng).
    await db.batch([
      db.prepare("update community_seasons set closed_at = ? where closed_at is null and id is ?").bind(at, previous),
      db
        .prepare("insert into community_seasons (id, label_vi, label_zh, opened_at, closed_at) values (?, ?, ?, ?, null)")
        .bind(input.id, input.labelVi, input.labelZh, at),
      auditStmt(c, viewer, { action: "season.open", targetType: "season", targetId: input.id, targetLabel: input.id, meta: { previous }, status: "ok" }),
    ]);
  } catch (error) {
    // Batch nguyên tử đã rollback; trùng id do race -> 409, mùa mở đã đổi -> 409 season_conflict, lỗi khác nổi lên.
    if (await db.prepare("select 1 as n from community_seasons where id = ?").bind(input.id).first()) throw exists;
    const now = (await db.prepare("select id from community_seasons where closed_at is null").first<{ id: string }>())?.id ?? null;
    if (now !== previous) throw new ApiError(409, "season_conflict", "Mùa đang mở vừa thay đổi, tải lại rồi thử lại");
    throw error;
  }
  return c.json({ ...input, openedAt: iso(at), closedAt: null, previous }, 201);
});
