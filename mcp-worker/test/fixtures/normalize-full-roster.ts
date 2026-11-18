import { readFileSync } from "node:fs";

import { heroFamilyId } from "../../../js/hero-identity.js";
import type { NormalizationResult } from "../../src/domain/normalization-service.js";
import { compactNormalizeResult, withHeroFamilies, withResolvedNames, type HeroObservationInput } from "../../src/research/research-handlers.js";
import { publicSnapshotView } from "../../src/data/public-snapshot-view.js";
import { buildSnapshotIndex, type SnapshotIndex } from "../../src/data/snapshot-index.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import type { DataSnapshot } from "../../src/data/artifact-contracts.js";
import { createWorkflowVersion } from "../../src/domain/canonical-state.js";
import { WORKFLOW_BUILD_ID } from "../../src/generated/workflow-build.js";
import { createToolContext, type ToolContext } from "../../src/research/tool-context.js";
import { repositoryDataRoot } from "./publication-sources.js";

/**
 * Harness phase 1 (#165): dựng kho thật 238 mục theo cách client gọi (gửi tên) và đo kích thước kết quả. Đường tra tên
 * và hình chiếu gọn dùng đúng hàm production (`withResolvedNames`, `withHeroFamilies`, `compactNormalizeResult`).
 */

export const EVIDENCE = { sourceScope: "currentTurnImage" as const, batchId: "roster-sweep-1" };

export interface RosterFixture {
  heroes: Array<{ canonicalId: string; redStars: number }>;
  tactics: string[];
}

export interface Observation {
  observationId: string;
  entityKind: "hero" | "tactic";
  observedText?: string;
  canonicalId?: string;
  familyId?: string;
  displayName?: string;
  redStars?: number;
  reviewRequired?: boolean;
  candidates?: string[];
  evidence: typeof EVIDENCE;
}

export function loadRosterFixture(): RosterFixture {
  return JSON.parse(readFileSync(new URL("./normalize-full-roster.json", import.meta.url), "utf8")) as RosterFixture;
}

export interface RosterEnv {
  ctx: ToolContext;
  snapshot: DataSnapshot;
  index: SnapshotIndex;
  names: Map<string, string>;
  kinds: Map<string, "hero" | "tactic">;
}

let cached: Promise<RosterEnv> | undefined;

/** Snapshot v3 thật của checkout, qua public view như `createResearchHandlers`. */
export function loadRosterEnv(): Promise<RosterEnv> {
  cached ??= (async () => {
    const snapshot = await publicSnapshotView(await new FilesystemDataSource({ dataRoot: repositoryDataRoot }).load());
    const index = buildSnapshotIndex(snapshot);
    const ctx = createToolContext(snapshot, index, createWorkflowVersion(snapshot.releaseId, WORKFLOW_BUILD_ID));
    const names = new Map<string, string>();
    const kinds = new Map<string, "hero" | "tactic">();
    for (const entry of index.searchEntries) {
      if (entry.kind !== "hero" && entry.kind !== "tactic") continue;
      names.set(entry.canonicalId, entry.displayName);
      kinds.set(entry.canonicalId, entry.kind);
    }
    return { ctx, snapshot, index, names, kinds };
  })();
  return cached;
}

/** Fixture id không còn trong snapshot → báo rõ id nào (catalog đổi, cập nhật fixture). */
export function assertFixtureInCatalog(env: RosterEnv, roster: RosterFixture): void {
  const missing = [...roster.heroes.map((hero) => hero.canonicalId), ...roster.tactics].filter((id) => !env.names.has(id));
  if (missing.length > 0) throw new Error(`Fixture canonicalId không còn trong snapshot: ${missing.join(", ")}`);
}

/** (a) chỉ `observedText` = tên catalog hiện tại; giống `_obs` của tqccl-auto khi chưa `pick`. */
export function buildNameObservations(env: RosterEnv, roster: RosterFixture): Observation[] {
  assertFixtureInCatalog(env, roster);
  return [
    ...roster.heroes.map((hero, i) => ({
      observationId: `h${i}`,
      entityKind: "hero" as const,
      observedText: env.names.get(hero.canonicalId)!,
      redStars: hero.redStars,
      evidence: EVIDENCE,
    })),
    ...roster.tactics.map((id, i) => ({
      observationId: `t${i}`,
      entityKind: "tactic" as const,
      observedText: env.names.get(id)!,
      evidence: EVIDENCE,
    })),
  ];
}

const HAN_VIET_UNKNOWN = [
  "Tào Mạnh Đức", "Quan Vân Trường", "Gia Cát Khổng Minh", "Triệu Tử Long", "Lưu Huyền Đức",
  "Tôn Trọng Mưu", "Chu Công Cẩn", "Lữ Phụng Tiên", "Mã Mạnh Khởi", "Hoàng Hán Thăng",
  "Trương Dực Đức", "Bàng Sĩ Nguyên", "Tư Mã Trọng Đạt", "Hạ Hầu Nguyên Nhượng", "Lục Bá Ngôn",
];

/** (b) = (a) + 10 tên gốc có bản SP/40Y/CO (mơ hồ) + 15 tên Hán-Việt không có trong catalog (không biết) = 25. */
export function buildAmbiguousExtras(env: RosterEnv): Observation[] {
  const byFamily = new Map<string, string[]>();
  for (const [id, name] of env.names) {
    if (env.kinds.get(id) !== "hero") continue;
    const family = heroFamilyId(name);
    byFamily.set(family, [...(byFamily.get(family) ?? []), id]);
  }
  const bases = [...byFamily.entries()]
    .filter(([family, ids]) => ids.length > 1 && ids.includes(`hero:${family.slice("hero-family:".length)}`))
    .map(([family]) => env.names.get(`hero:${family.slice("hero-family:".length)}`)!)
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 10);
  return [...bases, ...HAN_VIET_UNKNOWN].map((name, i) => ({
    observationId: `x${i}`,
    entityKind: "hero" as const,
    observedText: name,
    evidence: EVIDENCE,
  }));
}

export function buildMixedObservations(env: RosterEnv, roster: RosterFixture): Observation[] {
  return [...buildNameObservations(env, roster), ...buildAmbiguousExtras(env)];
}

/** (c) canonicalId + familyId suy như `withHeroFamilies`. */
export function buildIdObservations(env: RosterEnv, roster: RosterFixture): Observation[] {
  assertFixtureInCatalog(env, roster);
  return [
    ...roster.heroes.map((hero, i) => ({
      observationId: `h${i}`,
      entityKind: "hero" as const,
      canonicalId: hero.canonicalId,
      familyId: heroFamilyId(env.names.get(hero.canonicalId)!),
      displayName: env.names.get(hero.canonicalId)!,
      redStars: hero.redStars,
      evidence: EVIDENCE,
    })),
    ...roster.tactics.map((id, i) => ({
      observationId: `t${i}`,
      entityKind: "tactic" as const,
      canonicalId: id,
      displayName: env.names.get(id)!,
      evidence: EVIDENCE,
    })),
  ];
}

/** Đường handler trước `normalizeObservations`: chính `withResolvedNames` + `withHeroFamilies` của production. */
export function prepareForDomain(ctx: ToolContext, observations: readonly Observation[]): Observation[] {
  return withHeroFamilies(ctx, withResolvedNames(ctx, observations as readonly HeroObservationInput[])) as Observation[];
}

/**
 * Kết quả handler thật = `commonResult` + `compactNormalizeResult` (một nguồn với `handleNormalize`).
 * `resolvedIds` theo vị trí của `observations` đầu vào (null nếu client gửi sẵn canonicalId).
 */
export function projectCompact(ctx: ToolContext, normalized: NormalizationResult, observations: readonly Observation[]): Record<string, unknown> {
  const prepared = prepareForDomain(ctx, observations);
  const lookedUp = observations.map((observation) => observation.canonicalId === undefined);
  return {
    ...ctx.commonResult([
      { artifact: "canonical-state", recordId: normalized.confirmationBinding.normalizationDigest, trust: "untrusted" },
    ]),
    ...compactNormalizeResult(normalized, prepared as HeroObservationInput[], lookedUp),
  };
}

const encoder = new TextEncoder();

export function measure(value: unknown): { chars: number; bytes: number } {
  const text = JSON.stringify(value);
  return { chars: text.length, bytes: encoder.encode(text).byteLength };
}

/** Byte đầu vào tối đa: `1,07 × byte + 512 ≤ 65 536`. */
export const CANDIDATE_REQUEST_BYTE_CAP = Math.floor((65_536 - 512) / 1.07);

const MANGLES = [(name: string) => `${name}?`, (name: string) => name.slice(0, -1), (name: string) => name.slice(1)];

/**
 * Ca xấu nhất: tên catalog dài nhất (hero + tactic), biến đổi nhẹ để KHÔNG khớp đúng → `unknown` kèm gợi ý. Mỗi tên
 * thử lần lượt các biến đổi, lấy cái cho đủ 5 candidates (ưu tiên mục có đủ 5, rồi tên dài); thiếu thì lấy biến đổi
 * nhiều candidates nhất. Test báo `minCandidates` nếu ca xấu nhất không đủ 5 cho mọi mục.
 */
export function buildWorstCaseObservations(env: RosterEnv, count: number): Observation[] {
  const pub = env.ctx.publication();
  const scored = [...env.names.entries()].map(([id, name]) => {
    const kind = env.kinds.get(id)!;
    let best = { text: MANGLES[0]!(name), candidates: -1 };
    for (const mangle of MANGLES) {
      const text = mangle(name);
      const matches = pub.searchCatalog(text, { kinds: [kind], limit: 100 }).items.filter(({ entity }) => env.names.has(entity.id));
      if (matches.some(({ score }) => score === 3)) continue;
      const near = matches.length > 0 ? matches : pub.similarCatalog(text, { kinds: [kind], limit: 100 }).filter(({ entity }) => env.names.has(entity.id));
      const candidates = Math.min(5, new Set(near.map(({ entity }) => entity.id)).size);
      if (candidates > best.candidates) best = { text, candidates };
      if (candidates === 5) break;
    }
    return { id, kind, ...best };
  });
  scored.sort((left, right) => Number(right.candidates === 5) - Number(left.candidates === 5) || right.text.length - left.text.length || left.id.localeCompare(right.id));
  return scored.slice(0, count).map(({ kind, text }, i) => ({ observationId: `w${i}`, entityKind: kind, observedText: text, evidence: EVIDENCE }));
}
