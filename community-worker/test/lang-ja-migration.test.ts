// Migration 0015_lang_ja: dựng lại 6 bảng có CHECK lang/text_lang để nhận 'ja' trên DB đã có dữ liệu.
// Chạy như D1: khoá ngoại bật (node:sqlite mặc định bật), cả file trong một transaction. So toàn bộ dữ liệu và
// sqlite_master trước/sau: chỉ 6 CHECK được phép đổi. Rollback viết tay đưa schema về đúng như trước.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { createFakeD1 } from "./fakes";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION = readFileSync(join(ROOT, "migrations", "0015_lang_ja.sql"), "utf8");
const ROLLBACK = readFileSync(join(ROOT, "rollback", "0015_restore_lang_vi_zh.sql"), "utf8");
const ROLLBACK_0009 = readFileSync(join(ROOT, "rollback", "0009_drop_community_team_triggers.sql"), "utf8");

const OLD_CHECK = "in ('vi', 'zh')";
const NEW_CHECK = "in ('vi', 'zh', 'ja')";
const REBUILT = ["battle_reports", "comments", "community_team_images", "community_team_votes", "community_teams", "feedback", "posts", "scan_samples"];

let db: DatabaseSync;

/** Áp một file SQL nguyên tử như `wrangler d1 migrations apply` (lỗi -> không đổi gì). */
function applyAtomic(sql: string): void {
  db.exec("begin");
  try {
    db.exec(sql);
    db.exec("commit");
  } catch (e) {
    db.exec("rollback");
    throw e;
  }
}

/** SQL schema chuẩn hoá: bỏ comment, bỏ dấu nháy kép định danh (ALTER TABLE RENAME thêm vào), gộp khoảng trắng. */
const normalize = (sql: string | null) =>
  sql === null ? null : sql.replace(/--[^\n]*/gu, "").replace(/"/gu, "").replace(/\s+/gu, " ").trim().toLowerCase();

type SchemaRow = { type: string; name: string; tbl_name: string; sql: string | null };
function schema(): SchemaRow[] {
  const rows = db.prepare("select type, name, tbl_name, sql from sqlite_master order by type, name").all() as SchemaRow[];
  return rows.map((r) => ({ ...r, sql: normalize(r.sql) }));
}

/** Toàn bộ dữ liệu mọi bảng (kể cả cột sinh), mỗi bảng sắp theo JSON của dòng để so không phụ thuộc rowid. */
function snapshot(): Record<string, string[]> {
  const tables = db.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name").all() as { name: string }[];
  return Object.fromEntries(
    tables.map(({ name }) => [name, (db.prepare(`select * from "${name}"`).all() as object[]).map((r) => JSON.stringify(r)).sort()]),
  );
}

const count = (sql: string): number => (db.prepare(sql).get() as { n: number }).n;
const fkCheck = () => db.prepare("pragma foreign_key_check").all();

const ISO = "2026-01-01T00:00:00.000Z";
const PAST = 1_000;

/** Dữ liệu vi/zh phủ mọi bảng bị dựng lại, các bảng con tham chiếu chúng và vài bảng không liên quan. */
function seed(): void {
  const user = db.prepare(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", banned_until) values (?, ?, ?, 1, ?, ?, ?)`);
  user.run("u1", "Một", "u1@x.test", ISO, ISO, null);
  user.run("u2", "Hai", "u2@x.test", ISO, ISO, PAST); // từng bị khoá, đã hết hạn
  user.run("u3", "Ba", "u3@x.test", ISO, ISO, null);

  const comment = db.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, ?, ?, ?, ?, ?)");
  comment.run("c1", "/doi-chuan/s18-a/", "vi", "u1", "Đội mạnh", 10);
  comment.run("c2", "/doi-chuan/s18-a/", "zh", "u2", "阵容很强", 11);
  comment.run("c3", "/doi-cong-dong/t-vi/", "vi", "u3", "Hay", 12);

  const upload = db.prepare("insert into uploads (id, user_id, kind, object_key, content_type, size, status, created_at) values (?, ?, ?, ?, 'image/png', 9, ?, 1)");
  upload.run("up1", "u1", "report", "reports/r1.png", "attached");
  upload.run("up2", "u1", "post", "posts/p1.png", "pending");

  db.prepare("insert into community_seasons (id, label_vi, label_zh, opened_at) values ('s1', 'Mùa 1', '赛季1', 1)").run();
  const team = db.prepare(
    `insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle,
       strengths, weaknesses, counters, countered_by, substitutes, text_lang, reject_reason, reviewed_by, reviewed_at, deleting_at, created_at)
     values (?, ?, 's1', ?, ?, 'hero:a', 'hero:b', 'hero:c', 'hero:a,hero:b,hero:c', '[["tactic:1","tactic:2"]]', ?, 'p', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  team.run("t-vi", "u1", "approved", "Đội Ngụy", "ky", "mạnh", "yếu", "khắc", "bị khắc", "thay", "vi", null, "u3", 50, null, 1_700_000_000_000);
  team.run("t-zh", "u2", "rejected", "魏国队", "cung", null, null, null, null, null, "zh", "trùng", "u3", 60, null, 1_700_000_100_000);
  team.run("t-del", "u3", "pending", "Đang xoá", "thuan", null, null, null, null, null, "vi", null, null, null, 70, 1_700_000_200_000);

  const image = db.prepare("insert into community_team_images (team_id, position, object_key, content_type) values (?, ?, ?, 'image/webp')");
  image.run("t-vi", 0, "community-teams/t-vi/0.webp");
  image.run("t-vi", 1, "community-teams/t-vi/1.webp");
  image.run("t-zh", 0, "community-teams/t-zh/0.webp");

  // Trigger 0008 đếm lại up/down_votes và evidence_count lúc seed: snapshot sau migration phải giữ đúng các số này.
  const vote = db.prepare("insert into community_team_votes (team_id, user_id, value, created_at) values (?, ?, ?, 5)");
  vote.run("t-vi", "u2", 1);
  vote.run("t-vi", "u3", -1);
  vote.run("t-zh", "u1", 1);

  const report = db.prepare(
    `insert into battle_reports (id, page_key, lang, user_id, image_key, result, ally_heroes, enemy_heroes, note, season, status, reject_reason, reviewed_by, reviewed_at, created_at)
     values (?, ?, ?, ?, ?, ?, '["曹操"]', '["刘备"]', ?, 's1', ?, ?, ?, ?, ?)`,
  );
  report.run("r1", "/doi-cong-dong/t-vi/", "zh", "u2", "reports/r1.png", "win", "ghi chú", "approved", null, "u3", 20, 15);
  report.run("r2", "/doi-cong-dong/t-vi/", "vi", "u3", null, "win", null, "approved", null, "u1", 21, 16);
  report.run("r3", "/doi-chuan/s18-a/", "vi", "u1", null, "loss", null, "rejected", "mờ", "u3", 22, 17);
  report.run("r4", "/doi-chuan/s18-a/", "zh", "u2", null, "draw", null, "pending", null, null, null, 18);

  const post = db.prepare(
    `insert into posts (id, slug, lang, translation_key, title, description, body_markdown, faq, tags, cover_image, status, author_id, author_name, published_at, updated_at, created_at)
     values (?, ?, ?, ?, ?, 'mô tả', '# nội dung', '[]', '["s18"]', ?, ?, 'u1', 'Admin', ?, 30, 30)`,
  );
  post.run("p1", "huong-dan", "vi", "k1", "Hướng dẫn", "posts/p1.png", "published", 31);
  post.run("p2", "huong-dan", "zh", "k1", "攻略", null, "draft", null);
  post.run("p3", "rieng", "vi", null, "Riêng", null, "draft", null);

  const fb = db.prepare("insert into feedback (id, kind, title, body, email, page, lang, user_id, status, created_at) values (?, ?, ?, 'nội dung', ?, ?, ?, ?, ?, ?)");
  fb.run("f1", "bug", "Lỗi", "a@x.test", "/tra-cuu/", "vi", "u1", "new", 40);
  fb.run("f2", "wrong_info", "错误", null, "/zh/tra-cuu/", "zh", null, "done", 41);

  const scan = db.prepare(
    `insert into scan_samples (id, user_id, image_key, screen, side, lang, ai_read, confirmed, status, reviewed_by, reviewed_at, created_at)
     values (?, ?, ?, ?, ?, ?, '{"heroes":[]}', '{"heroes":[]}', ?, ?, ?, ?)`,
  );
  scan.run("s-vi", "u1", "scan/s-vi.png", "battleReport", "left", "vi", "approved", "u3", 51, 50);
  scan.run("s-zh", "u2", null, "teamDetail", "right", "zh", "rejected", null, null, 52);

  db.prepare("insert into recruit_records (user_id, kind, id, updated_at, rev, payload) values ('u1', 'account', 'a1', 1, 1, '{}')").run();
  db.prepare("insert into rate_limits (key, count, expires_at) values ('comment:u1:0', 2, 99)").run();
  db.prepare("insert into scan_stats (day, screen, side, events) values ('2026-11-17', 'battleReport', 'left', 3)").run();
}

beforeEach(() => {
  db = createFakeD1({ upTo: "0014" }).sqlite;
  seed();
});

describe("migration 0015_lang_ja", () => {
  it("giữ nguyên mọi dòng của mọi bảng, kể cả bộ đếm và cột sinh của community_teams", () => {
    const before = snapshot();
    expect(before.community_teams.some((r) => r.includes('"up_votes":1') && r.includes('"evidence_count":2'))).toBe(true);
    applyAtomic(MIGRATION);
    expect(snapshot()).toEqual(before);
    expect(fkCheck()).toEqual([]);
    expect(db.prepare("pragma integrity_check").get()).toEqual({ integrity_check: "ok" });
  });

  it("schema chỉ khác đúng 6 CHECK lang/text_lang: cột, ràng buộc, khoá ngoại, index, trigger giữ nguyên", () => {
    const before = schema();
    const withOldCheck = before.filter((r) => r.sql?.includes(OLD_CHECK));
    expect(withOldCheck.map((r) => r.name).sort()).toEqual(["battle_reports", "comments", "community_teams", "feedback", "posts", "scan_samples"]);
    expect(withOldCheck.reduce((n, r) => n + (r.sql?.split(OLD_CHECK).length ?? 1) - 1, 0)).toBe(6);

    applyAtomic(MIGRATION);
    const expected = before.map((r) => ({ ...r, sql: r.sql === null ? null : r.sql.replaceAll(OLD_CHECK, NEW_CHECK) }));
    expect(schema()).toEqual(expected);
    // Khoá ngoại của bảng con trỏ về bảng mang tên cũ (RENAME đã viết lại tham chiếu tới bảng *_new).
    for (const child of ["community_team_images", "community_team_votes"]) {
      const fks = db.prepare(`pragma foreign_key_list("${child}")`).all() as { table: string; on_delete: string }[];
      expect(fks.find((f) => f.table === "community_teams")).toMatchObject({ on_delete: "CASCADE" });
    }
    const leftover = new RegExp(`\\b(?:${REBUILT.join("|")})_new\\b`, "u");
    expect(schema().filter((r) => leftover.test(r.name) || leftover.test(r.sql ?? ""))).toEqual([]);
  });

  it("sau migration nhận 'ja' ở cả 6 cột, vẫn từ chối ngôn ngữ ngoài danh sách", () => {
    applyAtomic(MIGRATION);
    const inserts: [string, (lang: string, n: number) => void][] = [
      ["comments", (l, n) => db.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values (?, '/doi-chuan/s18-a/', ?, 'u1', 'コメント', 1)").run(`cj${n}`, l)],
      [
        "battle_reports",
        (l, n) =>
          db
            .prepare("insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values (?, '/doi-cong-dong/t-zh/', ?, 'u3', 'win', '[]', '[]', 'approved', 1)")
            .run(`rj${n}`, l),
      ],
      [
        "posts",
        (l, n) =>
          db
            .prepare("insert into posts (id, slug, lang, translation_key, title, description, body_markdown, faq, tags, status, author_name, updated_at, created_at) values (?, 'huong-dan', ?, 'k1', '攻略', 'd', 'b', '[]', '[]', 'draft', 'A', 1, 1)")
            .run(`pj${n}`, l),
      ],
      ["feedback", (l, n) => db.prepare("insert into feedback (id, kind, title, body, lang, status, created_at) values (?, 'other', 't', 'b', ?, 'new', 1)").run(`fj${n}`, l)],
      [
        "scan_samples",
        (l, n) =>
          db
            .prepare("insert into scan_samples (id, user_id, screen, side, lang, ai_read, confirmed, status, created_at) values (?, 'u1', 'other', 'left', ?, '{}', '{}', 'pending', 1)")
            .run(`sj${n}`, l),
      ],
      [
        "community_teams",
        (l, n) =>
          db
            .prepare(
              `insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle, text_lang, created_at)
               values (?, 'u1', 's1', 'pending', '魏', 'hero:a', 'hero:b', 'hero:c', 'hero:a,hero:b,hero:c', '[]', 'ky', 'p', ?, 1)`,
            )
            .run(`tj${n}`, l),
      ],
    ];
    for (const [table, insert] of inserts) {
      expect(() => insert("ja", 1), table).not.toThrow();
      expect(() => insert("ko", 2), table).toThrow(/CHECK constraint failed/u);
    }
    // Unique (lang, slug) và (lang, translation_key) vẫn theo từng ngôn ngữ.
    expect(() => inserts[2][1]("ja", 3)).toThrow(/UNIQUE constraint failed/u);
    // Chiến báo thắng đã duyệt bằng ja vẫn được trigger evidence đếm.
    expect(db.prepare("select evidence_count from community_teams where id = 't-zh'").get()).toEqual({ evidence_count: 1 });
  });

  it("khoá ngoại cascade, trigger đếm vote và chặn tài khoản khoá vẫn chạy trên bảng mới", () => {
    applyAtomic(MIGRATION);
    db.prepare("insert into community_team_votes (team_id, user_id, value, created_at) values ('t-vi', 'u1', 1, 9)").run();
    expect(db.prepare("select up_votes, down_votes from community_teams where id = 't-vi'").get()).toEqual({ up_votes: 2, down_votes: 1 });

    db.prepare("delete from community_teams where id = 't-vi'").run();
    expect(count("select count(*) n from community_team_images where team_id = 't-vi'")).toBe(0);
    expect(count("select count(*) n from community_team_votes where team_id = 't-vi'")).toBe(0);

    db.prepare("delete from \"user\" where id = 'u2'").run();
    for (const t of ["comments", "battle_reports", "scan_samples", "community_teams"]) {
      const col = t === "community_teams" ? "author_id" : "user_id";
      expect(count(`select count(*) n from ${t} where ${col} = 'u2'`), t).toBe(0);
    }
    expect(db.prepare("select user_id from feedback where id = 'f2'").get()).toEqual({ user_id: null });

    db.prepare("update \"user\" set banned_until = ? where id = 'u1'").run(Date.now() + 86_400_000);
    expect(() =>
      db.prepare("insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at) values ('rb', '/doi-chuan/s18-a/', 'ja', 'u1', 'win', '[]', '[]', 'pending', 1)").run(),
    ).toThrow(/account_blocked/u);
    expect(() =>
      db
        .prepare(
          `insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle, text_lang, created_at)
           values ('tb', 'u1', 's1', 'pending', 't', 'hero:a', 'hero:b', 'hero:c', 'hero:a,hero:b,hero:c', '[]', 'ky', 'p', 'ja', 1)`,
        )
        .run(),
    ).toThrow(/account_blocked/u);
    expect(fkCheck()).toEqual([]);
  });

  it("schema lệch (trigger evidence đã bị gỡ tay) -> dừng, không đổi gì", () => {
    db.exec(ROLLBACK_0009);
    const before = { schema: schema(), data: snapshot() };
    expect(() => applyAtomic(MIGRATION)).toThrow(/no such trigger/u);
    expect({ schema: schema(), data: snapshot() }).toEqual(before);
  });

  it("chạy được trên DB trống (D1 mới) cùng chuỗi migration đầy đủ", () => {
    const fresh = createFakeD1().sqlite;
    const names = (fresh.prepare("select name from sqlite_master where type = 'table' order by name").all() as { name: string }[]).map((r) => r.name);
    for (const t of REBUILT) expect(names).toContain(t);
    expect(fresh.prepare("pragma foreign_key_check").all()).toEqual([]);
  });
});

describe("rollback 0015_restore_lang_vi_zh", () => {
  it("khi chưa có dòng ja: schema và dữ liệu về đúng như trước migration", () => {
    const before = { schema: schema(), data: snapshot() };
    applyAtomic(MIGRATION);
    applyAtomic(ROLLBACK);
    expect({ schema: schema(), data: snapshot() }).toEqual(before);
    expect(fkCheck()).toEqual([]);
  });

  it("còn dòng ja -> từ chối (CHECK cũ), DB giữ nguyên trạng thái sau migration", () => {
    applyAtomic(MIGRATION);
    db.prepare("insert into comments (id, page_key, lang, user_id, body, created_at) values ('cj', '/doi-chuan/s18-a/', 'ja', 'u1', 'x', 1)").run();
    const before = { schema: schema(), data: snapshot() };
    expect(() => applyAtomic(ROLLBACK)).toThrow(/CHECK constraint failed/u);
    expect({ schema: schema(), data: snapshot() }).toEqual(before);
  });
});
