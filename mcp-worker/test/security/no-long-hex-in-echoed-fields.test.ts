import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import type { DataSource } from "../../src/data/data-source.js";
import {
  RESEARCH_TOOL_NAMES,
  type ResearchToolName,
} from "../../src/research/research-contracts.js";
import { createResearchHandlers } from "../../src/research/research-handlers.js";

/**
 * Bộ lọc bí mật của client MCP che mọi chuỗi hex >= 64 ký tự. Bất kỳ giá trị nào
 * client phải gửi lại cho server mà mang chuỗi như vậy sẽ về tay ta ở dạng đã bị
 * che, và mọi tool ràng theo nó hỏng vĩnh viễn.
 *
 * Test này khoá invariant đó cho toàn bộ 8 tool.
 */
const LONG_HEX_RUN = /[a-fA-F0-9]{64,}/u;

/**
 * Hai trường duy nhất được phép giữ hex đầy đủ: chúng là digest toàn vẹn, chỉ
 * xuất ra và không tool nào yêu cầu client gửi lại. Thêm tên vào đây đồng nghĩa
 * với khẳng định "không ai echo trường này" — hãy kiểm tra trước khi thêm.
 */
const OUTPUT_ONLY_HEX_FIELDS = new Set(["releaseId", "sha256"]);

const fixtureRoot = fileURLToPath(
  new URL("../fixtures/release-snapshot", import.meta.url),
);

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
  const normalized = await handlers.call("tqccl_normalize_entities", {
    observations: [
      {
        observationId: "hero",
        entityKind: "hero",
        canonicalId: "hero:tuong-a",
        familyId: "hero-family:tuong-a",
        displayName: "Tướng A",
        evidence: { sourceScope: "currentTurnImage", batchId: "fixture" },
      },
      {
        observationId: "tactic",
        entityKind: "tactic",
        canonicalId: "tactic:chien-phap-a",
        displayName: "Chiến Pháp A",
        evidence: { sourceScope: "currentTurnImage", batchId: "fixture" },
      },
    ],
  });

  const confirmed = {
    expectedWorkflowVersion: normalized.workflowVersion,
    canonicalState: normalized.canonicalState,
    confirmationBinding: normalized.confirmationBinding,
  };
  const requests: Record<ResearchToolName, unknown> = {
    tqccl_get_data_version: {},
    tqccl_normalize_entities: { observations: [] },
    tqccl_search: { query: "Tướng" },
    tqccl_get_team: {
      teamId: "team-a",
      expectedWorkflowVersion: normalized.workflowVersion,
    },
    tqccl_match_team: {
      expectedWorkflowVersion: normalized.workflowVersion,
      heroes: [{ canonicalId: "hero:tuong-a", tacticIds: [] }],
      minHeroes: 1,
    },
    tqccl_recommend_team: confirmed,
    tqccl_recommend_coexist: confirmed,
    tqccl_suggest_replacements: {
      ...confirmed,
      teamId: "team-a",
      tacticName: "Chiến Pháp A",
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
    const version = results.tqccl_get_data_version as { releaseId: string };

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
