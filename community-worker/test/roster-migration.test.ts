import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// Vite bỏ tiền tố "node:" của node:sqlite -> nạp bằng require (như fakes.ts).
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const apply = (db: InstanceType<typeof DatabaseSync>, file: string) => db.exec(readFileSync(join(DIR, file), "utf8"));
const PROD_BASE = ["0001_better_auth.sql", "0002_community.sql", "0003_feedback.sql", "0004_recruit.sql", "0005_scan.sql", "0006_user_admin.sql", "0008_community_teams.sql"];

describe("migration 0011_roster", () => {
  it("áp được trên DB đã có 0001-0006 và 0008 (trạng thái production), chỉ thêm bảng và ba index", () => {
    const db = new DatabaseSync(":memory:");
    for (const f of PROD_BASE) apply(db, f);
    const before = (db.prepare("select name from sqlite_master where type = 'table' order by name").all() as { name: string }[]).map((r) => r.name);
    apply(db, "0011_roster.sql");
    const after = (db.prepare("select name from sqlite_master where type = 'table' order by name").all() as { name: string }[]).map((r) => r.name);
    expect(after.filter((n) => !before.includes(n))).toEqual(["roster_records"]);
    expect(before.every((n) => after.includes(n))).toBe(true);
    const idx = (db.prepare("select name from sqlite_master where type = 'index' and tbl_name = 'roster_records' and name like 'roster_records_%' order by name").all() as { name: string }[]).map((r) => r.name);
    expect(idx).toEqual(["roster_records_user_box_idx", "roster_records_user_kind_live_idx", "roster_records_user_rev_idx"]);
  });
});
