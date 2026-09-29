// Fake D1 (node:sqlite chạy migration thật) + fake R2 trong bộ nhớ + dựng app test.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from "node:sqlite";
import { createApp } from "../src/app";
import type { SessionUser } from "../src/auth";
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
    const rows = this.db.prepare(this.sql).all(...this.params) as Record<string, unknown>[];
    return { results: rows.map((r) => ({ ...r })) as T[], success: true, meta: {} };
  }
  async run() {
    const res = this.db.prepare(this.sql).run(...this.params);
    return { results: [], success: true, meta: { changes: Number(res.changes) } };
  }
}

export function createFakeD1(): { d1: D1Database; sqlite: DatabaseSync } {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(`${MIGRATIONS_DIR}/${file}`, "utf8"));
  }
  const d1 = {
    prepare: (sql: string) => new FakeStatement(sqlite, sql),
    async batch(stmts: FakeStatement[]) {
      sqlite.exec("begin");
      try {
        const out = [];
        for (const s of stmts) out.push(await s.run());
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
  return { d1: d1 as unknown as D1Database, sqlite };
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

export const USERS: Record<string, SessionUser> = {
  alice: { id: "u-alice", name: "Alice", email: "alice@example.com", image: null },
  bob: { id: "u-bob", name: "Bob", email: "bob@example.com", image: "https://img.test/bob.png" },
  admin: { id: "u-admin", name: "Admin", email: "Admin@Example.com", image: null },
};

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
  isAdmin: boolean;
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
  setFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void;
  request(path: string, opts?: { method?: string; as?: keyof typeof USERS; json?: unknown; body?: BodyInit; headers?: Record<string, string> }): Promise<Response>;
  /** Chờ mọi việc nền `waitUntil` của các request đã gửi. */
  settle(): Promise<void>;
}

export function createHarness(envOverrides: Partial<Env> = {}): Harness {
  const clock = { now: Date.UTC(2026, 8, 27, 10, 0, 0) };
  const { d1, sqlite } = createFakeD1();
  const { bucket, objects } = createFakeR2(() => clock.now);
  for (const u of Object.values(USERS)) {
    sqlite
      .prepare('insert into "user" (id, name, email, emailVerified, image, createdAt, updatedAt) values (?, ?, ?, 1, ?, ?, ?)')
      .run(u.id, u.name, u.email, u.image, "2026-01-01", "2026-01-01");
  }
  const fetchCalls: Harness["fetchCalls"] = [];
  let fetchHandler: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response("ok");
  let seq = 0;
  const app = createApp({
    getUser: async (_env, headers) => USERS[headers.get("x-test-user") ?? ""] ?? null,
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
    put: async (key: string, value: string) => void aiStore.set(key, value),
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
