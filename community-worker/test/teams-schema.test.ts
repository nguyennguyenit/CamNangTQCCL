import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { createFakeD1 } from "./fakes";

const ROLLBACK_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "rollback");
const rollbackSql = (name: string) => readFileSync(join(ROLLBACK_DIR, name), "utf8");

let db: DatabaseSync;

const ISO = "2026-01-01T00:00:00.000Z";
const FUTURE = Date.now() + 86_400_000;

function user(id: string, bannedUntil: number | null = null) {
  db.prepare(
    `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", banned_until) values (?, ?, ?, 1, ?, ?, ?)`,
  ).run(id, id, `${id}@x.test`, ISO, ISO, bannedUntil);
}

function season(id: string, closedAt: number | null = null) {
  db.prepare(`insert into community_seasons (id, label_vi, label_zh, opened_at, closed_at) values (?, ?, ?, 1, ?)`).run(
    id,
    `Mùa ${id}`,
    `赛季${id}`,
    closedAt,
  );
}

function team(id: string, authorId = "author", createdAt = 1_000_000_000_000, seasonId = "s1") {
  db.prepare(
    `insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle, text_lang, created_at)
     values (?, ?, ?, 'approved', 't', 'hero:a', 'hero:b', 'hero:c', 'hero:a,hero:b,hero:c', '[]', 'cung', 'p', 'vi', ?)`,
  ).run(id, authorId, seasonId, createdAt);
}

function vote(teamId: string, userId: string, value: number) {
  db.prepare(`insert into community_team_votes (team_id, user_id, value, created_at) values (?, ?, ?, 1)`).run(
    teamId,
    userId,
    value,
  );
}

let reportSeq = 0;
function report(pageKey: string, userId: string, result = "win", status = "approved") {
  const id = `r${++reportSeq}`;
  db.prepare(
    `insert into battle_reports (id, page_key, lang, user_id, result, ally_heroes, enemy_heroes, status, created_at)
     values (?, ?, 'vi', ?, ?, '[]', '[]', ?, 1)`,
  ).run(id, pageKey, userId, result, status);
  return id;
}

const counters = (id: string) =>
  db.prepare(`select up_votes, down_votes, evidence_count, points from community_teams where id = ?`).get(id);
const evidence = (id: string): number => {
  const row = db.prepare(`select evidence_count e from community_teams where id = ?`).get(id) as { e: number }; // cột integer vừa chọn
  return row.e;
};

beforeEach(() => {
  db = createFakeD1().sqlite;
  reportSeq = 0;
  for (const id of ["author", "u1", "u2", "u3"]) user(id);
  season("s1");
  team("id-0001");
});

describe("community_seasons", () => {
  it("chỉ cho một mùa mở; đóng mùa cũ rồi mở mùa mới thì được", () => {
    expect(() => season("s2")).toThrow(/UNIQUE/i);
    db.prepare(`update community_seasons set closed_at = 5 where id = 's1'`).run();
    expect(() => season("s2")).not.toThrow();
    expect(db.prepare(`select id from community_seasons where closed_at is null`).all()).toEqual([{ id: "s2" }]);
  });

  it("nhiều mùa đã đóng cùng tồn tại", () => {
    db.prepare(`update community_seasons set closed_at = 5 where id = 's1'`).run();
    season("s2", 6);
    season("s3", 7);
    expect(db.prepare(`select count(*) n from community_seasons`).get()).toEqual({ n: 3 });
  });

  it("id mùa sai định dạng bị CHECK từ chối", () => {
    expect(() => season("-bad", 1)).toThrow(/CHECK/i);
    expect(() => season("Upper", 1)).toThrow(/CHECK/i);
    expect(() => season("a".repeat(41), 1)).toThrow(/CHECK/i);
  });
});

describe("bộ đếm vote", () => {
  it("insert/đổi giá trị/xoá khớp count(*)", () => {
    vote("id-0001", "u1", 1);
    vote("id-0001", "u2", 1);
    vote("id-0001", "u3", -1);
    expect(counters("id-0001")).toMatchObject({ up_votes: 2, down_votes: 1, points: 1 });
    db.prepare(`update community_team_votes set value = -1 where user_id = 'u1'`).run();
    expect(counters("id-0001")).toMatchObject({ up_votes: 1, down_votes: 2, points: -1 });
    db.prepare(`delete from community_team_votes where user_id = 'u3'`).run();
    expect(counters("id-0001")).toMatchObject({ up_votes: 1, down_votes: 1, points: 0 });
  });

  it("value ngoài {-1, 1} bị CHECK từ chối; một user một phiếu", () => {
    expect(() => vote("id-0001", "u1", 0)).toThrow(/CHECK/i);
    vote("id-0001", "u1", 1);
    expect(() => vote("id-0001", "u1", 1)).toThrow(/UNIQUE|PRIMARY/i);
  });

  it("xoá user thì vote cascade và bộ đếm giảm", () => {
    vote("id-0001", "u1", 1);
    vote("id-0001", "u2", -1);
    db.prepare(`delete from "user" where id = 'u1'`).run();
    expect(counters("id-0001")).toMatchObject({ up_votes: 0, down_votes: 1 });
    expect(db.prepare(`select count(*) n from community_team_votes`).get()).toEqual({ n: 1 });
  });
});

describe("evidence_count từ chiến báo", () => {
  const PAGE = "/doi-cong-dong/id-0001/";

  it("duyệt chiến báo thắng của user khác tác giả -> 1; cùng user hai chiến báo thắng -> vẫn 1", () => {
    report(PAGE, "u1");
    expect(evidence("id-0001")).toBe(1);
    report(PAGE, "u1");
    expect(evidence("id-0001")).toBe(1);
    report(PAGE, "u2");
    expect(evidence("id-0001")).toBe(2);
    expect(counters("id-0001")).toMatchObject({ evidence_count: 2, points: 4 });
  });

  it("chiến báo của tác giả không tính", () => {
    report(PAGE, "author");
    expect(evidence("id-0001")).toBe(0);
  });

  it("pending/rejected/loss/draw không tính; duyệt (update status) thì tính, từ chối/đổi kết quả thì giảm", () => {
    const pending = report(PAGE, "u1", "win", "pending");
    report(PAGE, "u2", "loss");
    report(PAGE, "u3", "draw");
    expect(evidence("id-0001")).toBe(0);
    db.prepare(`update battle_reports set status = 'approved' where id = ?`).run(pending);
    expect(evidence("id-0001")).toBe(1);
    db.prepare(`update battle_reports set result = 'loss' where id = ?`).run(pending);
    expect(evidence("id-0001")).toBe(0);
    db.prepare(`update battle_reports set result = 'win' where id = ?`).run(pending);
    expect(evidence("id-0001")).toBe(1);
    db.prepare(`update battle_reports set status = 'rejected' where id = ?`).run(pending);
    expect(evidence("id-0001")).toBe(0);
  });

  it("xoá chiến báo làm giảm; user còn chiến báo thắng khác thì vẫn 1", () => {
    const a = report(PAGE, "u1");
    const b = report(PAGE, "u1");
    db.prepare(`delete from battle_reports where id = ?`).run(a);
    expect(evidence("id-0001")).toBe(1);
    db.prepare(`delete from battle_reports where id = ?`).run(b);
    expect(evidence("id-0001")).toBe(0);
  });

  it("xoá user (cascade chiến báo) làm giảm", () => {
    report(PAGE, "u1");
    report(PAGE, "u2");
    db.prepare(`delete from "user" where id = 'u1'`).run();
    expect(evidence("id-0001")).toBe(1);
  });

  it("page_key đội chuẩn không đụng bảng đội; page đội không tồn tại không lỗi", () => {
    db.prepare(`update community_teams set up_votes = 7 where id = 'id-0001'`).run();
    report("/doi-chuan/s18-abc/", "u1");
    expect(counters("id-0001")).toMatchObject({ up_votes: 7, evidence_count: 0 });
    expect(() => report("/doi-cong-dong/id-9999/", "u1")).not.toThrow();
  });

  it("chỉ đếm cho đúng đội, không lẫn id có tiền tố chung", () => {
    team("id-00011");
    report("/doi-cong-dong/id-00011/", "u1");
    expect(evidence("id-0001")).toBe(0);
    expect(evidence("id-00011")).toBe(1);
  });
});

describe("cột sinh points / hot_rank / top_rank", () => {
  it("đúng công thức trên 3 dòng mẫu", () => {
    const T = 1_700_000_000_000;
    team("pos", "author", T);
    team("zero", "author", T);
    team("neg", "author", T);
    db.prepare(`update community_teams set up_votes = 12, down_votes = 3, evidence_count = 2 where id = 'pos'`).run(); // 13
    db.prepare(`update community_teams set up_votes = 1, down_votes = 4 where id = 'neg'`).run(); // -3
    const hot = (points: number) =>
      Math.round(Math.sign(points) * Math.log10(Math.max(Math.abs(points), 1)) * 1_000_000 + T / 172.8);
    const rows = db
      .prepare(`select id, points, hot_rank, top_rank from community_teams where id in ('pos','zero','neg') order by id`)
      .all() as { id: string; points: number; hot_rank: number; top_rank: number }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.pos.points).toBe(13);
    expect(byId.zero.points).toBe(0);
    expect(byId.neg.points).toBe(-3);
    expect(byId.pos.hot_rank).toBe(hot(13));
    expect(byId.zero.hot_rank).toBe(hot(0));
    expect(byId.neg.hot_rank).toBe(hot(-3));
    expect(byId.pos.top_rank).toBe(13 * 10_000_000_000 + Math.floor(T / 1000));
    expect(byId.neg.top_rank).toBe(-3 * 10_000_000_000 + Math.floor(T / 1000));
    expect(byId.pos.hot_rank).toBeGreaterThan(byId.zero.hot_rank);
    expect(byId.zero.hot_rank).toBeGreaterThan(byId.neg.hot_rank);
  });

  it("truy vấn xếp Hot/Top/Mới dùng đúng index", () => {
    const plan = (order: string) =>
      (
        db
          .prepare(
            `explain query plan select id from community_teams where season_id = ? and status = 'approved' order by ${order} limit 20`,
          )
          .all("s1") as { detail: string }[]
      )
        .map((r) => r.detail)
        .join("\n");
    expect(plan("hot_rank desc, id desc")).toContain("community_teams_season_hot_idx");
    expect(plan("top_rank desc, id desc")).toContain("community_teams_season_top_idx");
    expect(plan("created_at desc, id desc")).toContain("community_teams_season_new_idx");
  });
});

describe("ràng buộc đội", () => {
  it("user bị khoá (banned_until tương lai) không chèn được đội: account_blocked", () => {
    user("banned", FUTURE);
    expect(() => team("id-0002", "banned")).toThrow(/account_blocked/);
  });

  it("user đang xoá không chèn được đội; user hết hạn khoá thì được", () => {
    user("deleting");
    db.prepare(`update "user" set deleting_at = 1 where id = 'deleting'`).run();
    expect(() => team("id-0003", "deleting")).toThrow(/account_blocked/);
    user("expired", 1);
    expect(() => team("id-0004", "expired")).not.toThrow();
  });

  it("deleting_at mặc định null và không ảnh hưởng trigger đếm", () => {
    expect(db.prepare(`select deleting_at d from community_teams where id = 'id-0001'`).get()).toEqual({ d: null });
    db.prepare(`update community_teams set deleting_at = 5 where id = 'id-0001'`).run();
    vote("id-0001", "u1", 1);
    report("/doi-cong-dong/id-0001/", "u2");
    expect(counters("id-0001")).toMatchObject({ up_votes: 1, evidence_count: 1, points: 3 });
  });

  it("troop/status/text_lang ngoài tập cho phép bị CHECK từ chối", () => {
    expect(() => db.prepare(`update community_teams set troop = 'xe' where id = 'id-0001'`).run()).toThrow(/CHECK/i);
    expect(() => db.prepare(`update community_teams set status = 'x' where id = 'id-0001'`).run()).toThrow(/CHECK/i);
    expect(() => db.prepare(`update community_teams set text_lang = 'en' where id = 'id-0001'`).run()).toThrow(/CHECK/i);
  });

  it("xoá đội thì ảnh và vote cascade; object_key duy nhất; position 0..2", () => {
    vote("id-0001", "u1", 1);
    const img = (pos: number, key: string) =>
      db.prepare(`insert into community_team_images (team_id, position, object_key, content_type) values ('id-0001', ?, ?, 'image/png')`).run(pos, key);
    img(0, "teams/a");
    img(1, "teams/b");
    expect(() => img(2, "teams/a")).toThrow(/UNIQUE/i);
    expect(() => img(3, "teams/c")).toThrow(/CHECK/i);
    db.prepare(`delete from community_teams where id = 'id-0001'`).run();
    expect(db.prepare(`select count(*) n from community_team_images`).get()).toEqual({ n: 0 });
    expect(db.prepare(`select count(*) n from community_team_votes`).get()).toEqual({ n: 0 });
  });

  it("xoá tác giả thì đội cascade", () => {
    db.prepare(`delete from "user" where id = 'author'`).run();
    expect(db.prepare(`select count(*) n from community_teams`).get()).toEqual({ n: 0 });
  });
});

describe("rollback 0009 / 0010", () => {
  const PAGE = "/doi-cong-dong/id-0001/";

  it("0009 gỡ trigger evidence (bảng đội để nguyên); 0010 dựng lại và đếm lại evidence_count", () => {
    db.exec(rollbackSql("0009_drop_community_team_triggers.sql"));
    const names = (db.prepare(`select name from sqlite_master where type = 'trigger' and name like 'battle_reports_team_evidence_%'`).all()) as unknown[];
    expect(names).toHaveLength(0);
    // trigger vote và bảng đội vẫn còn
    vote("id-0001", "u1", 1);
    expect(counters("id-0001")).toMatchObject({ up_votes: 1 });

    report(PAGE, "u1");
    report(PAGE, "u2");
    report(PAGE, "author");
    expect(evidence("id-0001")).toBe(0);

    db.exec(rollbackSql("0010_restore_community_team_triggers.sql"));
    expect(evidence("id-0001")).toBe(2);
    report(PAGE, "u3");
    expect(evidence("id-0001")).toBe(3);
    db.prepare(`delete from battle_reports where user_id = 'u3'`).run();
    expect(evidence("id-0001")).toBe(2);
  });

  it("0009 chạy lặp được (if exists)", () => {
    db.exec(rollbackSql("0009_drop_community_team_triggers.sql"));
    expect(() => db.exec(rollbackSql("0009_drop_community_team_triggers.sql"))).not.toThrow();
  });
});
