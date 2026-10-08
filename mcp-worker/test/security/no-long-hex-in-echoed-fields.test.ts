import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import type { DataSource } from "../../src/data/data-source.js";
import {
  RESEARCH_TOOL_NAMES,
  type ResearchToolName,
} from "../../src/research/research-contracts.js";
import { canonicalTacticId } from "../../../js/team-recommend-engine.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";

/**
 * Bộ lọc bí mật của client MCP che mọi chuỗi hex >= 64 ký tự. Bất kỳ giá trị nào
 * client phải gửi lại cho server mà mang chuỗi như vậy sẽ về tay ta ở dạng đã bị
 * che, và mọi tool ràng theo nó hỏng vĩnh viễn.
 *
 * Test này khoá invariant đó cho toàn bộ 7 tool.
 */
const LONG_HEX_RUN = /[a-fA-F0-9]{64,}/u;

/**
 * Hai trường duy nhất được phép giữ hex đầy đủ: chúng là digest toàn vẹn, chỉ
 * xuất ra và không tool nào yêu cầu client gửi lại. Thêm tên vào đây đồng nghĩa
 * với khẳng định "không ai echo trường này" — hãy kiểm tra trước khi thêm.
 */
const OUTPUT_ONLY_HEX_FIELDS = new Set(["releaseId", "sha256"]);

const fixtureRoot = fileURLToPath(new URL("../../../data", import.meta.url));

function fixtureSource(): DataSource {
  return new FilesystemDataSource({ dataRoot: fixtureRoot });
}

/** Bỏ các trường output-only khỏi bản sao, giữ nguyên phần còn lại. */
function withoutOutputOnlyHexFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutOutputOnlyHexFields);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !OUTPUT_ONLY_HEX_FIELDS.has(key))
      .map(([key, entry]) => [key, withoutOutputOnlyHexFields(entry)]),
  );
}

async function callEveryTool(): Promise<Record<ResearchToolName, unknown>> {
  const handlers = createResearchHandlers({ dataSource: fixtureSource() });
  const evidence = { sourceScope: "currentTurnImage" as const, batchId: "fixture" };
  const team = (await handlers.call("tqccl_find_teams", { collection: "recommended", limit: 1 })).items[0]!;
  const normalized = await handlers.call("tqccl_normalize_entities", {
    observations: [
      ...team.heroes.map((hero, index) => ({
        observationId: `hero-${index}`,
        entityKind: "hero" as const,
        canonicalId: hero.heroId as `hero:${string}`,
        displayName: hero.nameVi,
        evidence,
      })),
      ...team.heroes.flatMap((hero, index) =>
        hero.tactics.map((tactic, slot) => ({
          observationId: `tactic-${index}-${slot}`,
          entityKind: "tactic" as const,
          canonicalId: canonicalTacticId(tactic.vi ?? "") as `tactic:${string}`,
          displayName: tactic.vi ?? "",
          evidence,
        })),
      ),
    ],
  });
  const entity = (await handlers.call("tqccl_search", { query: "Thanh Long", kinds: ["equipment"], limit: 1 })).items[0]!;
  const requests: Record<ResearchToolName, unknown> = {
    tqccl_get_playbook: { intent: "lookup" },
    tqccl_normalize_entities: { observations: [] },
    tqccl_search: { query: "", limit: 2 },
    tqccl_get_entity: { entityId: entity.entityId },
    tqccl_find_teams: { collection: "other", limit: 2 },
    tqccl_get_team: { reference: team.reference, expectedWorkflowVersion: normalized.workflowVersion },
    tqccl_recommend_teams: {
      expectedWorkflowVersion: normalized.workflowVersion,
      canonicalState: normalized.canonicalState,
      confirmationBinding: normalized.confirmationBinding,
      sourceSeasonId: team.sourceSeasonId!,
    },
  };

  const call = handlers.call as (
    name: ResearchToolName,
    input: unknown,
  ) => Promise<unknown>;
  const results = {} as Record<ResearchToolName, unknown>;
  for (const name of RESEARCH_TOOL_NAMES) {
    results[name] = await call(name, requests[name]);
  }
  return results;
}

describe("no long hex run in client-echoed fields", () => {
  it("keeps every tool response free of 64+ hex runs outside output-only fields", async () => {
    const results = await callEveryTool();

    for (const name of RESEARCH_TOOL_NAMES) {
      const scrubbable = JSON.stringify(
        withoutOutputOnlyHexFields(results[name]),
      );
      expect(scrubbable, `${name} leaks a scrubbable hex run`).not.toMatch(
        LONG_HEX_RUN,
      );
    }
  });

  it("keeps the echoed workflow version and confirmation binding scrub-safe", async () => {
    const results = await callEveryTool();
    const normalized = results.tqccl_normalize_entities as {
      workflowVersion: string;
      confirmationBinding: {
        workflowVersion: string;
        normalizationDigest: string;
      };
    };

    for (const token of [
      normalized.workflowVersion,
      normalized.confirmationBinding.workflowVersion,
      normalized.confirmationBinding.normalizationDigest,
    ]) {
      expect(token).not.toMatch(LONG_HEX_RUN);
    }
    expect(normalized.confirmationBinding.normalizationDigest).toMatch(
      /^sha256b64:[A-Za-z0-9_-]{43}$/u,
    );
  });

  it("still emits releaseId as a full sha256 hex digest", async () => {
    const results = await callEveryTool();
    const version = results.tqccl_get_playbook as { releaseId: string };

    expect(version.releaseId).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it("would catch a regression: the exemption filter only drops named fields", () => {
    const planted = {
      releaseId: `sha256:${"a".repeat(64)}`,
      expectedWorkflowVersion: `workflow:sha256:${"b".repeat(64)}`,
      nested: [{ sha256: "c".repeat(64), normalizationDigest: "d".repeat(64) }],
    };

    const scrubbable = JSON.stringify(withoutOutputOnlyHexFields(planted));
    expect(scrubbable).toMatch(LONG_HEX_RUN);
    expect(scrubbable).toContain("b".repeat(64));
    expect(scrubbable).toContain("d".repeat(64));
    expect(scrubbable).not.toContain("a".repeat(64));
    expect(scrubbable).not.toContain("c".repeat(64));
  });
});
