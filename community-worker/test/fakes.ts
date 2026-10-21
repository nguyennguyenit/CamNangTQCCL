// Fake D1 (node:sqlite chạy migration thật) + fake R2 trong bộ nhớ + dựng app test.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from "node:sqlite";
import { createApp } from "../src/app";
import { type SessionUserRow } from "../src/auth";
import type { Env } from "../src/env";
import { AI_CONFIG_KEY, AI_GROUPS, encryptConfig, type AiConfig, type AiGroupConfig, type AiGroupId, type AiProvider } from "../../shared/ai-config";

// Vite (vitest 2) bỏ tiền tố "node:" của node:sqlite khi phân giải import -> nạp bằng require.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = DatabaseSyncType;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

class FakeStatement {
  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
    readonly params: SQLInputValue[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new FakeStatement(this.db, this.sql, values.map((v) => (v === undefined ? null : (v as SQLInputValue))));
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }
  async all<T>() {
    const res = this.runSync();
    // Dialect D1 của Better Auth đọc meta.changes/last_row_id cả khi gọi qua all().
    return { results: res.results as T[], success: true, meta: res.meta };
  }
  async run() {
    return this.runSync();
  }
  /**
   * Chạy đồng bộ (không nhường lượt) để batch() nguyên tử như D1 thật. Câu trả cột (select, PRAGMA, `returning`)
   * trả results; meta.changes lấy từ changes() của SQLite chỉ khi câu đó thực sự ghi (select thuần -> 0).
   */
  runSync() {
    const stmt = this.db.prepare(this.sql);
    if (stmt.columns().length > 0) {
      const rows = stmt.all(...this.params) as Record<string, unknown>[];
      const written = /^\s*(?:with\b[\s\S]*?)?(?:insert|update|delete|replace)\b/iu.test(this.sql);
      const changes = written ? (this.db.prepare("select changes() as n").get() as { n: number }).n : 0;
      return { results: rows.map((r) => ({ ...r })), success: true, meta: { changes: Number(changes), last_row_id: 0 } };
    }
    const res = stmt.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(res.changes), last_row_id: Number(res.lastInsertRowid) } };
  }
}

export function createFakeD1(): { d1: D1Database; sqlite: DatabaseSync; beforeBatch: (() => void)[] } {
  const sqlite = new DatabaseSync(":memory:");
  // Hàng đợi hook chạy đồng bộ ngay trước batch kế tiếp (dựng race giữa lúc đọc và lúc ghi).
  const beforeBatch: (() => void)[] = [];
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8"));
  }
  const d1 = {
    prepare: (sql: string) => new FakeStatement(sqlite, sql),
    async batch(stmts: FakeStatement[]) {
      beforeBatch.shift()?.();
      // Không có await giữa begin và commit: hai batch() song song không lồng transaction (D1 chạy batch tuần tự, nguyên tử).
      sqlite.exec("begin");
      try {
        const out = stmts.map((s) => s.runSync());
        sqlite.exec("commit");
        return out;
      } catch (e) {
        sqlite.exec("rollback");
        throw e;
      }
    },
    exec: (sql: string) => sqlite.exec(sql),
  };
  // Fake chỉ cài phần API D1 mà mã nguồn dùng.
  return { d1: d1 as unknown as D1Database, sqlite, beforeBatch };
}

interface StoredObject {
  bytes: Uint8Array;
  contentType?: string;
  uploaded: Date;
}

export function createFakeR2(clock: () => number) {
  const objects = new Map<string, StoredObject>();
  const bucket = {
    async put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }) {
      const bytes = value instanceof Uint8Array ? value.slice() : new Uint8Array(value);
      objects.set(key, { bytes, contentType: opts?.httpMetadata?.contentType, uploaded: new Date(clock()) });
    },
    async get(key: string) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        body: new Blob([obj.bytes]).stream(),
        httpMetadata: { contentType: obj.contentType },
        httpEtag: `"${key}"`,
        arrayBuffer: async () => obj.bytes.slice().buffer,
      };
    },
    async delete(keys: string | string[]) {
      for (const k of Array.isArray(keys) ? keys : [keys]) objects.delete(k);
    },
    async list(opts: { prefix?: string }) {
      const list = [...objects.entries()]
        .filter(([k]) => k.startsWith(opts.prefix ?? ""))
        .map(([key, o]) => ({ key, uploaded: o.uploaded }));
      return { objects: list, truncated: false };
    },
  };
  return { bucket: bucket as unknown as R2Bucket, objects };
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "user" | "moderator";
}

/** Mỗi user được seed kèm một session có token = khoá của bản ghi này (header `x-test-user`). */
export const USERS: Record<string, TestUser> = {
  alice: { id: "u-alice", name: "Alice", email: "alice@example.com", image: null, role: "user" },
  bob: { id: "u-bob", name: "Bob", email: "bob@example.com", image: "https://img.test/bob.png", role: "user" },
  admin: { id: "u-admin", name: "Admin", email: "Admin@Example.com", image: null, role: "user" },
  moderator: { id: "u-moderator", name: "Moderator", email: "mod@example.com", image: null, role: "moderator" },
};

const SEED_ISO = "2026-01-01T00:00:00.000Z";

/**
 * Góc nhìn "túi trường" cho JSON phản hồi trong test: gộp mọi khoá các endpoint trả về
 * để truy cập trực tiếp; giá trị thật được kiểm bằng expect.
 */
export interface ApiJson {
  error: { code: string; message: string };
  items: ApiJson[];
  nextCursor: string | null;
  id: string;
  uploadId: string;
  url: string;
  body: string;
  status: string;
  canDelete: boolean;
  analysis: ApiJson;
  post: ApiJson;
  deploy: ApiJson | null;
  user: ApiJson;
  role: string;
  email: string;
  kind: string;
  title: string;
  page: string | null;
  lang: string;
  author: ApiJson | null;
  providers: ApiJson[];
  configured: boolean;
  keyLast4: string;
  label: string;
  endpoint: string;
  modelId: string;
  enabled: boolean;
}

export const ORIGIN = "https://tqccl.com";

/** Secret + cấu hình mặc định của harness (bản ghi `ai:config` được seed sẵn: mọi nhóm dùng TEST_PROVIDER). */
export const AI_SECRET = "ai-config-secret-for-tests";
export const TEST_PROVIDER: AiProvider = {
  id: "deepseek",
  label: "DeepSeek",
  preset: "deepseek",
  endpoint: "https://api.deepseek.com/chat/completions",
  apiKey: "test-key",
  enabled: true,
  extraModels: [],
};
export const TEST_GROUP: AiGroupConfig = {
  chain: [{ providerId: "deepseek", modelId: "deepseek-flash", effort: "off" }],
  timeoutMs: 45_000,
  budgetMs: 45_000,
};
export const TEST_CONFIG: AiConfig = {
  providers: [TEST_PROVIDER],
  groups: Object.fromEntries(AI_GROUPS.map((id) => [id, TEST_GROUP])) as Record<AiGroupId, AiGroupConfig>,
};
const TEST_CONFIG_BLOB = await encryptConfig(TEST_CONFIG, AI_SECRET);

export interface Harness {
  env: Env;
  sqlite: DatabaseSync;
  objects: Map<string, StoredObject>;
  clock: { now: number };
  fetchCalls: { url: string; init?: RequestInit }[];
  /** Nội dung KV AI_KV (fake); seed sẵn `ai:config` = TEST_CONFIG. */
  aiStore: Map<string, string>;
  /** Thư đã gửi qua binding FEEDBACK_MAIL (fake). */
  mails: EmailMessageBuilder[];
  /** Đặt lỗi để lần gửi thư sau ném ra; null = gửi bình thường. */
  mailError: Error | null;
  /** Đặt lỗi để put/delete của R2 fake ném ra; null = bình thường. */
  r2Error: Error | null;
  /** Đặt lỗi để put của KV fake ném ra; null = bình thường. */
  kvError: Error | null;
  /** Chỉ lần gọi thứ `nth` (1-based, đếm từ lúc đặt) của `put`/`delete` R2 ném lỗi; các lần khác bình thường. */
  failR2On(plan: { op: "put" | "delete"; nth: number }): void;
  /** Chạy `fn` (đồng bộ, vd SQL) ngay trước `DB.batch` kế tiếp, một lần. */
  beforeNextBatch(fn: () => void): void;
  /** Chạy `fn` (đồng bộ) ngay sau khi `getUser` của request kế tiếp đọc xong user, một lần (khoá user "giữa chừng"). */
  afterNextGetUser(fn: () => void): void;
  setFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void;
  request(path: string, opts?: { method?: string; as?: string; json?: unknown; body?: BodyInit; headers?: Record<string, string> }): Promise<Response>;
  /** Chờ mọi việc nền `waitUntil` của các request đã gửi. */
  settle(): Promise<void>;
}

export function createHarness(envOverrides: Partial<Env> = {}): Harness {
  const clock = { now: Date.UTC(2026, 8, 27, 10, 0, 0) };
  const { d1, sqlite, beforeBatch } = createFakeD1();
  const { bucket: rawBucket, objects } = createFakeR2(() => clock.now);
  const errors = { r2: null as Error | null, kv: null as Error | null };
  let r2Plan: { op: "put" | "delete"; nth: number; seen: number } | null = null;
  const afterGetUser: (() => void)[] = [];
  // Bọc put/delete để h.r2Error có hiệu lực; get/list giữ nguyên.
  const bucket = new Proxy(rawBucket, {
    get(target, prop) {
      const value = Reflect.get(target, prop) as unknown;
      if ((prop === "put" || prop === "delete") && typeof value === "function") {
        return (...args: unknown[]) => {
          if (errors.r2) return Promise.reject(errors.r2);
          if (r2Plan && r2Plan.op === prop && ++r2Plan.seen === r2Plan.nth) {
            return Promise.reject(new Error(`r2 ${String(prop)} #${r2Plan.nth} failed`));
          }
          return (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        };
      }
      return value;
    },
  });
  for (const [token, u] of Object.entries(USERS)) {
    sqlite
      .prepare('insert into "user" (id, name, email, emailVerified, image, createdAt, updatedAt, role) values (?, ?, ?, 1, ?, ?, ?, ?)')
      .run(u.id, u.name, u.email, u.image, SEED_ISO, SEED_ISO, u.role);
    sqlite
      .prepare('insert into session (id, expiresAt, token, createdAt, updatedAt, userId) values (?, ?, ?, ?, ?, ?)')
      .run(`s-${token}`, "2099-01-01T00:00:00.000Z", token, SEED_ISO, SEED_ISO, u.id);
  }
  const fetchCalls: Harness["fetchCalls"] = [];
  let fetchHandler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response("ok");
  let seq = 0;
  const app = createApp({
    // Đọc session -> user từ DB như Better Auth: khoá/xoá session/đổi vai trò có hiệu lực ngay ở request kế tiếp.
    getUser: async (env, headers) => {
      const token = headers.get("x-test-user");
      if (!token) return null;
      const row = await env.DB.prepare('select u.* from session s join "user" u on u.id = s."userId" where s.token = ?')
        .bind(token)
        .first<SessionUserRow>();
      afterGetUser.shift()?.();
      return row;
    },
    authHandler: async () => new Response("auth"),
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      fetchCalls.push({ url, init });
      return fetchHandler(url, init);
    }) as typeof fetch,
    now: () => clock.now,
    newId: () => `id-${String(++seq).padStart(4, "0")}`,
  });
  const mails: EmailMessageBuilder[] = [];
  const aiStore = new Map<string, string>([[AI_CONFIG_KEY, TEST_CONFIG_BLOB]]);
  // Fake chỉ cài get/put mà mã nguồn dùng.
  const aiKv = {
    get: async (key: string) => aiStore.get(key) ?? null,
    put: async (key: string, value: string) => {
      if (errors.kv) throw errors.kv;
      aiStore.set(key, value);
    },
  } as unknown as KVNamespace;
  const waiting: Promise<unknown>[] = [];
  const executionCtx = {
    waitUntil: (promise: Promise<unknown>) => void waiting.push(promise),
    passThroughOnException: () => {},
    props: {},
  } as unknown as ExecutionContext;
  const harness: Harness = {
    env: undefined as unknown as Env,
    sqlite,
    objects,
    clock,
    fetchCalls,
    aiStore,
    mails,
    mailError: null,
    get r2Error() {
      return errors.r2;
    },
    set r2Error(value) {
      errors.r2 = value;
    },
    get kvError() {
      return errors.kv;
    },
    set kvError(value) {
      errors.kv = value;
    },
    failR2On(plan) {
      r2Plan = { ...plan, seen: 0 };
    },
    beforeNextBatch(fn) {
      beforeBatch.push(fn);
    },
    afterNextGetUser(fn) {
      afterGetUser.push(fn);
    },
    setFetch(handler) {
      fetchHandler = handler;
    },
    async request(path, opts = {}) {
      const headers: Record<string, string> = { origin: ORIGIN, ...opts.headers };
      if (opts.as) headers["x-test-user"] = opts.as;
      let body = opts.body;
      if (opts.json !== undefined) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(opts.json);
      }
      return app.request(path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body }, harness.env, executionCtx);
    },
    async settle() {
      while (waiting.length) await Promise.allSettled(waiting.splice(0));
    },
  };
  const mail = {
    async send(message: EmailMessageBuilder) {
      if (harness.mailError) throw harness.mailError;
      mails.push(message);
      return { messageId: `mail-${mails.length}` };
    },
  } as unknown as SendEmail;
  harness.env = {
    DB: d1,
    MEDIA: bucket,
    FEEDBACK_MAIL: mail,
    AI_KV: aiKv,
    SITE_ORIGIN: ORIGIN,
    ADMIN_EMAILS: "admin@example.com, other@example.com",
    FEEDBACK_FROM: "gopy@tqccl.com",
    FEEDBACK_TO: "owner@example.com",
    AI_CONFIG_SECRET: AI_SECRET,
    GITHUB_DISPATCH_TOKEN: "gh-test-token",
    GITHUB_REPOSITORY: "owner/repo",
    BETTER_AUTH_SECRET: "auth-secret-for-tests-0123456789abcdef",
    TURNSTILE_SECRET: "ts-secret",
    IP_HASH_SECRET: "ip-secret",
    ...envOverrides,
  };
  return harness;
}

export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);

export function imageForm(bytes: Uint8Array, type: string, field = "image"): FormData {
  const form = new FormData();
  form.append(field, new File([bytes], "shot.png", { type }));
  return form;
}

/** Seed mùa của Đội cộng đồng (closedAt null = mùa mở). */
export function seedSeason(h: Harness, id: string, closedAt: number | null = null, openedAt = 1): void {
  h.sqlite
    .prepare("insert into community_seasons (id, label_vi, label_zh, opened_at, closed_at) values (?, ?, ?, ?, ?)")
    .run(id, `Mùa ${id}`, `赛季${id}`, openedAt, closedAt);
}

export interface SeedTeam {
  id: string;
  author?: string;
  season?: string;
  status?: "pending" | "approved" | "rejected";
  title?: string;
  heroes?: [string, string, string];
  createdAt?: number;
  /** Ghi thẳng bộ đếm (bỏ qua vote thật) để dựng thứ tự xếp hạng. */
  upVotes?: number;
  downVotes?: number;
  /** Số ảnh (R2 `community-teams/<id>/<i>.png` + dòng community_team_images). */
  images?: number;
  rejectReason?: string | null;
}

/** Seed một đội (mặc định approved, tác giả alice, mùa s1, 1 ảnh) kèm ảnh R2. */
export async function seedTeam(h: Harness, t: SeedTeam): Promise<void> {
  const heroes = t.heroes ?? ["hero:a", "hero:b", "hero:c"];
  h.sqlite
    .prepare(
      `insert into community_teams (id, author_id, season_id, status, title, hero_1, hero_2, hero_3, hero_key, tactics, troop, playstyle, text_lang, reject_reason, created_at, up_votes, down_votes)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ky', 'Lối chơi thử nghiệm', 'vi', ?, ?, ?, ?)`,
    )
    .run(
      t.id,
      t.author ?? "u-alice",
      t.season ?? "s1",
      t.status ?? "approved",
      t.title ?? `Đội ${t.id}`,
      ...heroes,
      [...heroes].sort().join(","),
      JSON.stringify([["tactic:1", "tactic:2"], ["tactic:3", "tactic:4"], ["tactic:5", "tactic:6"]]),
      t.rejectReason ?? null,
      t.createdAt ?? h.clock.now,
      t.upVotes ?? 0,
      t.downVotes ?? 0,
    );
  for (let i = 0; i < (t.images ?? 1); i++) {
    const key = `community-teams/${t.id}/${i}.png`;
    await h.env.MEDIA.put(key, PNG_BYTES, { httpMetadata: { contentType: "image/png" } });
    h.sqlite
      .prepare("insert into community_team_images (team_id, position, object_key, content_type) values (?, ?, ?, 'image/png')")
      .run(t.id, i, key);
  }
}
