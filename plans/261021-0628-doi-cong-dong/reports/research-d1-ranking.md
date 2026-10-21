# Research: D1 CHECK-constraint migration & ranking formulas (Đội cộng đồng)

Researched 2026-10-21. Scope: `community-worker/` (D1 + Wrangler 4.141.0 installed). VERIFIED = read in repo/docs or reproduced locally; INFERENCE = reasoned, not observed.

## TL;DR
1. **Skip the rebuild.** The only CHECK this feature could touch is `uploads.kind in ('report','post')`. Team images should go through `kind='report'`, which already means "user-owned image, purged when the account is deleted". Store the attached keys in a new child table. If a separate `'team'` kind is required, the 12-step rebuild is safe here: `uploads` is a leaf table, so nothing cascades, and each migration file is atomic. It is still one more way for the migration to go wrong, and it adds code changes.
2. **Ranking:** use stored counters kept up to date by triggers. Two STORED generated integer columns, `points` and `hot_rank`, compute the ranking values. Hot uses the Reddit formula with τ = 2 days. Top sorts by `points`. New sorts by `created_at`. All three paginate with a cursor of (integer key, id), so the existing `encodeCursor`/`decodeCursor` code works unchanged. Do not use HN gravity, because its value depends on `now`. Do not use Wilson as the main sort.

## Q1 — Changing a CHECK constraint under D1

### Facts
- VERIFIED: no column CHECK constrains `battle_reports.page_key` or `comments.page_key` (`migrations/0002_community.sql:4-11,30-46`). The key format is only enforced in app code by `PAGE_KEY_RE` (`src/validate.ts:5,16-20`). So the `/doi-cong-dong/<id>/` namespace needs a regex change and **no migration**.
- VERIFIED: the only CHECK that matters is `uploads.kind check (kind in ('report','post'))` (`0002_community.sql:20`). Things attached to `uploads`: the autoindex from `object_key ... unique` (`:21`), `uploads_status_created_idx` (`:27`), `uploads_user_idx` (`0006_user_admin.sql:32`), and the trigger `uploads_block_blocked_user` (`0006_user_admin.sql:44-50`). No table has a `references uploads` (grep over `migrations/` finds only `references "user"`).
- VERIFIED: how `kind='report'` is used today. Pending staging happens in `src/routes/reports.ts:108-113`. Attaching moves the file to a permanent key and sets `status='attached'` (`:178-189`). The cron deletes pending rows older than 24 h regardless of kind (`src/cleanup.ts:22`). Account purge collects every `kind='report'` key (`src/routes/users.ts:367`). Posts are reassigned to the admin instead of being purged (`users.ts:473`).
- VERIFIED: D1 always enforces foreign keys. A query or migration "cannot change this", because "D1 runs every query inside an implicit transaction". The supported workaround is `PRAGMA defer_foreign_keys = on`, which defers checks until the transaction ends. https://developers.cloudflare.com/d1/sql-api/foreign-keys/ . SQLite also documents that toggling `foreign_keys` inside a transaction "simply has no effect". https://www.sqlite.org/foreignkeys.html
- VERIFIED: `defer_foreign_keys = ON` **does not stop `ON DELETE CASCADE`** (D1 SQL statements, PRAGMA section). https://developers.cloudflare.com/d1/sql-api/sql-statements/ . `DROP TABLE` runs an implicit DELETE that fires FK actions but no triggers. Triggers and indexes on the dropped table are removed with it. https://www.sqlite.org/lang_droptable.html . This means rebuilding a **parent** table such as `"user"` in D1 would cascade-delete its children. Rebuilding `uploads`, which is a leaf, is safe.
- VERIFIED: the correct order is create `new_X` → copy → drop `X` → rename `new_X` to `X` → recreate indexes and triggers. The reverse order ("rename old first") can corrupt references in triggers, views and FKs. https://www.sqlite.org/lang_altertable.html §8. The shortcut via `writable_schema` is not in D1's PRAGMA list (INFERENCE: not supported; it is absent from https://developers.cloudflare.com/d1/sql-api/sql-statements/).
- VERIFIED (wrangler source): `migrations apply` joins the file text and `INSERT INTO d1_migrations` into one string (`node_modules/wrangler/wrangler-dist/cli.js:231877-231889`). Remote apply sends that string as **one** `/query` call (`cli.js:230729-230736`). Local apply runs it as one `db.batch` (`cli.js:230590-230593`). The docs say: "If applying a migration results in an error, this migration will be rolled back, and the previous successful migration will remain applied." https://developers.cloudflare.com/workers/wrangler/commands/d1/#d1-migrations-apply . Do **not** put `BEGIN`/`COMMIT` in the file, because D1 errors with "cannot start a transaction within a transaction". https://developers.cloudflare.com/d1/best-practices/import-export-data/
- VERIFIED: Time Travel is always on. It restores to any minute within 30 days on the paid plan or 7 days on the free plan. Restore is **destructive**: it overwrites the whole database, including user writes made after the bookmark. It returns an undo bookmark. https://developers.cloudflare.com/d1/reference/time-travel/
- VERIFIED: the test harness runs migrations on `node:sqlite` with SQLite **3.53.4** (`test/fakes.ts:50-54`; checked locally with `node -e`). D1's SQLite version was not checked. INFERENCE: it may be older, so do not depend on newer ALTER syntax such as 3.53's `ALTER COLUMN`.

### Options (ranked)
| # | Option | Risk | Code touched | Notes |
|---|---|---|---|---|
| 1 | **Reuse `kind='report'` for team image staging and attachment, and store `object_key`s in a new `community_team_images(team_id → teams ON DELETE CASCADE, idx, object_key)` table** | None (no change to existing tables) | 0 lines in cleanup or purge | Purge (`users.ts:367`) and the 24 h cron (`cleanup.ts:22`) already cover these images. Downside: the name `'report'` is less precise. Add a comment in the migration. |
| 2 | 12-step rebuild of `uploads` with `kind in ('report','post','team')` | Low (leaf table, atomic file) | Rebuild SQL plus `users.ts:367` (add `'team'`) and every attach/select query | You must recreate both indexes **and** the blocked-user trigger. Forgetting the trigger silently lets banned users upload again. |
| 3 | Rebuild `uploads` with `kind` as plain text and no CHECK | Same as 2 | Same as 2 | Needs the same rebuild and loses DB-level validation. No benefit. |

If you choose option 2, use this outline as one migration file without BEGIN/COMMIT. `defer_foreign_keys` is optional here because no child tables exist, but it is harmless:
```sql
PRAGMA defer_foreign_keys = on;
create table uploads_new ( /* exact 0002 columns */ kind text not null check (kind in ('report','post','team')), ... );
insert into uploads_new (id,user_id,kind,object_key,content_type,size,status,created_at)
  select id,user_id,kind,object_key,content_type,size,status,created_at from uploads;
drop table uploads;
alter table uploads_new rename to uploads;
create index uploads_status_created_idx on uploads (status, created_at);
create index uploads_user_idx on uploads (user_id);
create trigger uploads_block_blocked_user before insert on uploads begin /* copy 0006:44-50 verbatim */ end;
```
Rollback: run `npx wrangler d1 time-travel info tqccl-community` **before** applying and save the bookmark. A failed migration file rolls back by itself, so you only need to restore if the result is wrong. The migration is additive and the old Worker still works with it, which keeps the rule "migration → Worker → push main".

## Q2 — Ranking Hot / New / Top

### Sources
- Reddit `hot` (official source): `sign(s)*log10(max(|s|,1)) + (t − 1134028003)/45000`. Here s = ups − downs, and 10× the score counts as 12.5 h of freshness. Reddit also has `confidence` (Wilson lower bound, z = 1.28). https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx
- Hacker News: `(votes−1)^0.8 / (age_h+2)^1.8 × penalties`. The value depends on the current time, so HN re-ranks stories only now and then. https://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html
- Wilson lower bound (Evan Miller, includes a SQL version). It fits like/dislike ratios, but an item with 0 votes scores 0. https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
- Keyset (seek) pagination over `(key, id)`. https://use-the-index-luke.com/no-offset
- D1 supports SQLite math functions (`log10`, `pow`, `sqrt`). https://developers.cloudflare.com/d1/sql-api/sql-statements/ . Generated columns are supported, but `ALTER ADD COLUMN` only allows VIRTUAL; STORED is fine in `CREATE TABLE`. https://developers.cloudflare.com/d1/reference/generated-columns/

### Trade-offs
| Formula | Depends on `now`? | Stored + indexable | Stable cursor | Fit for 10²–10³ items, few votes |
|---|---|---|---|---|
| **Reddit hot** | No (ordering is fixed over time) | Yes | Yes | **Best.** A single formula, easy to tune with τ |
| HN gravity | Yes | No (needs periodic recompute) | No (positions shift between pages) | Poor on D1, which has no cron-friendly re-rank |
| Wilson LB | No | Yes | Yes | Weak: ignores evidence, and a team with 0 votes always scores 0. Users cannot reconcile it with the displayed ▲▼ |
| Net `points` (Top) | No | Yes | Yes | Good. Shown to users as a number |

### Recommendation
- `points = up_votes − down_votes + 2 × evidence_count`. `evidence_count` counts distinct non-author users with at least one approved `win` report. The weight 2 is because evidence passes moderation and is harder to farm. It is a tunable constant.
- **Hot**: `hot_rank = round(sign(points)·log10(max(|points|,1))·1e6 + created_at_ms/172.8)`. τ = 172 800 s = 2 days, so 10× points equals 2 days of freshness. That is slower than Reddit's 12.5 h, which suits a low-traffic, season-long pool. The result is an integer around 1.04e10, safe for `Number.isSafeInteger` (`src/http.ts:49-53`). **Verified locally** on SQLite 3.53.4 as a STORED generated column, with `explain query plan` showing `SCAN t USING INDEX` for `order by hot_rank desc, id desc`.
- **Top**: `top_rank = points * 10000000000 + created_at_ms/1000` (STORED). Ties go to the newer team. It stays a safe integer while |points| < 900 000.
- **New**: `created_at desc, id desc`, exactly like the existing lists (`src/routes/reports.ts:51-52`).
- Cursor: all three sorts use `[key, id]` and reuse `encodeCursor`/`decodeCursor` (`src/http.ts:33-62`). `paginate()` is typed to `created_at` (`http.ts:65-75`), so it needs a variant that takes the key field. Seek predicate: `(k < ? or (k = ? and id < ?)) order by k desc, id desc limit ?` (same shape as `reports.ts:51`). INFERENCE: a vote between page loads can move a team across the cursor boundary, so the client should de-duplicate by id. That is acceptable at this scale.
- Counters: keep `up_votes`, `down_votes` and `evidence_count` on the team row with **triggers**, following the repo's existing trigger pattern (`0006_user_admin.sql:36-66`). Do not do read-modify-write in route code. Vote triggers on `after insert/update/delete on team_votes` adjust ±1. The evidence trigger, on `after insert/update of status/delete on battle_reports when page_key like '/doi-cong-dong/%'`, **recounts** with `count(distinct user_id)` via `battle_reports_page_status_idx` (`0002:48`). VERIFIED locally: an `after delete` trigger fires on rows removed by `ON DELETE CASCADE`. So deleting an account (FK cascade at `0002:34`) keeps counters correct with no extra code. INFERENCE: D1 behaves the same.
- Why not compute at query time: every list request would read all teams, votes and reports in the season. At about 10⁴ rows per request, the free plan's 5 M rows read per day (https://developers.cloudflare.com/d1/platform/pricing/) runs out after a few hundred page views. With stored keys and an index, each request reads roughly one page of rows.

## Implications for the plan
- **Migration `0007_community_teams.sql`** (new): create `community_teams` (with `season`, `status`, counters, generated `points`/`hot_rank`/`top_rank`), `community_team_votes(team_id, user_id, value check (value in (-1,1)), primary key(team_id,user_id))` with `ON DELETE CASCADE` on both FKs, and `community_team_images`. Add the vote and evidence triggers, a blocked-user `before insert` trigger copied from `0006:44-50` for the new user-content tables, and indexes `(season, status, hot_rank desc, id desc)`, `(season, status, top_rank desc, id desc)`, `(season, status, created_at desc, id desc)`. **Do not rebuild `uploads`** (option 1).
- `src/validate.ts:5`: extend `PAGE_KEY_RE` to accept `doi-cong-dong/<uuid>`. No DB change is needed for comments or battle reports.
- `src/http.ts`: add a generic key-based `paginate` that reuses the existing cursor codec.
- Team image flow: copy `reports.ts:96-189` (stage in `pending/`, attach, delete R2 on D1 failure). Author-initiated delete must remove the R2 objects, the `uploads` rows and the team (the cascade handles images, votes and comments only if they are FK-linked; comments use `page_key`, so delete them explicitly).
- Tests: add a counter-consistency test that compares stored counters against a recount after votes, report approve/reject and user deletion.
- Risks: SQLite 3.53.4 in tests vs. an unknown D1 version (generated columns need ≥ 3.31; INFERENCE: D1 is newer). The evidence trigger's `page_key` string join can break if the team-id format changes. A forgotten blocked-user trigger is a silent security regression.

## Unresolved questions
- Exact D1 SQLite version: run `npx wrangler d1 execute tqccl-community --remote --command "select sqlite_version()"` (read-only, not run here).
- Workers plan (free or paid) decides how much the rows-read budget matters.
- Should votes from banned users still count? The stored counters include them. Excluding them would require recounting on ban/unban.
- Final constants τ = 2 days and evidence weight 2 are product decisions. Both are single constants in one migration.
