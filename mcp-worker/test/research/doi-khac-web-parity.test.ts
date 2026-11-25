import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

// Cùng hàm dựng danh sách `/doi-khac/` của website (bản dựng sẵn và trình duyệt).
import { otherTeamListEntries } from "../../../js/other-team-groups.js";
import { createHash } from "node:crypto";
import { verifyOtherTeamGroups } from "../../src/data/publication-builder.js";
import { publicVariantId } from "../../src/research/team-handlers.js";
import { repositoryRoot } from "../fixtures/publication-sources.js";
import { realHandlers, realPublication } from "../fixtures/real-handlers.js";

type Rec = Record<string, any>;

const generationRoot = join(repositoryRoot, "src/data/recommended-reference");

/** `other-teams.json` của generation website đang pin (cùng bytes MCP dựng publication). */
async function webOtherTeams(): Promise<{ generationId: string; payload: Rec }> {
  const current = JSON.parse(await readFile(join(generationRoot, "current.json"), "utf8")) as { generationId: string };
  const payload = JSON.parse(await readFile(join(generationRoot, current.generationId, "other-teams.json"), "utf8")) as Rec;
  return { generationId: current.generationId, payload };
}

interface McpOtherItem {
  legacyTeamId: string;
  legacyVariantId: string;
  teamGroupId: string;
  optionCount: number;
  optionRank: number;
  pagePath: string | undefined;
}

/** Mọi mục `other` của `tqccl_find_teams` (đi hết cursor), kèm `optionRank` của biến thể trong artifact chi tiết. */
async function mcpOtherItems(): Promise<McpOtherItem[]> {
  const handlers = realHandlers();
  const pub = await realPublication();
  const items: McpOtherItem[] = [];
  let cursor: string | undefined;
  let expectedWorkflowVersion: string | undefined;
  do {
    const page = await handlers.call("tqccl_find_teams", {
      collection: "other",
      limit: 50,
      ...(cursor === undefined ? {} : { cursor, expectedWorkflowVersion }),
    });
    expectedWorkflowVersion = page.workflowVersion;
    for (const item of page.items) {
      const legacyTeamId = item.reference.legacyTeamId!;
      const detail = pub.getTeam(item.ref) as unknown as { variants: Rec[] };
      const variant = detail.variants.find((entry) => publicVariantId(entry.variantId) === item.reference.legacyVariantId)!;
      items.push({
        legacyTeamId,
        legacyVariantId: item.reference.legacyVariantId!,
        teamGroupId: item.teamGroupId!,
        optionCount: item.optionCount!,
        optionRank: variant.optionRank,
        pagePath: item.pagePath,
      });
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

describe("Đội khác: MCP trả đúng tập team và phương án của website", () => {
  let web: Awaited<ReturnType<typeof webOtherTeams>>;
  let entries: Rec[];
  let mcp: McpOtherItem[];

  beforeAll(async () => {
    web = await webOtherTeams();
    entries = otherTeamListEntries(web.payload, { season: "all", query: "", filters: {} }, {}) as Rec[];
    mcp = await mcpOtherItems();
  }, 120_000);

  it("cùng generation website đang pin", async () => {
    const pub = await realPublication();
    expect(pub.seasons.upstream.recommended.generationId).toBe(web.generationId);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("tập teamGroupId và phương án đủ dữ liệu của từng team trùng danh sách website", () => {
    const webTeams = new Map(entries.map((entry) => [entry.group.teamGroupId as string, (entry.completeRecords as Rec[]).map((row) => row.legacyTeamId as string).sort()]));
    const mcpTeams = new Map<string, string[]>();
    for (const item of mcp) mcpTeams.set(item.teamGroupId, [...(mcpTeams.get(item.teamGroupId) ?? []), item.legacyTeamId]);
    for (const ids of mcpTeams.values()) ids.sort();
    expect(new Map([...mcpTeams].sort(([a], [b]) => a.localeCompare(b)))).toEqual(new Map([...webTeams].sort(([a], [b]) => a.localeCompare(b))));
    // Mỗi đội gốc đúng một mục; không có phương án thiếu dữ liệu hay ngoài team.
    expect(new Set(mcp.map((item) => item.legacyTeamId)).size).toBe(mcp.length);
    expect(mcp.length).toBe(entries.reduce((total, entry) => total + entry.completeRecords.length, 0));
  });

  it("phương án đại diện (optionRank nhỏ nhất) và optionCount trùng website", () => {
    const webByGroup = new Map(entries.map((entry) => [entry.group.teamGroupId as string, entry]));
    const representative = new Map<string, McpOtherItem>();
    for (const item of mcp) {
      const known = representative.get(item.teamGroupId);
      if (known === undefined || item.optionRank < known.optionRank) representative.set(item.teamGroupId, item);
    }
    for (const [teamGroupId, item] of representative) {
      const entry = webByGroup.get(teamGroupId)!;
      expect(item.legacyTeamId, teamGroupId).toBe(entry.displayRecord.legacyTeamId);
      expect(item.legacyVariantId, teamGroupId).toBe(publicVariantId(entry.displayRecord.legacyVariantId));
    }
    // Thứ tự team theo optionRank của đại diện = thứ tự thẻ website.
    const mcpOrder = [...representative.values()].sort((a, b) => a.optionRank - b.optionRank).map((item) => item.teamGroupId);
    expect(mcpOrder).toEqual(entries.map((entry) => entry.group.teamGroupId));
    for (const item of mcp) expect(item.optionCount, item.legacyTeamId).toBe(webByGroup.get(item.teamGroupId)!.optionCount);
  });

  it("mỗi phương án giữ ref other:<legacyTeamId> và trang riêng, không ?variant=", async () => {
    const handlers = realHandlers();
    for (const item of mcp) {
      expect(item.pagePath, item.legacyTeamId).toMatch(/^\/doi-khac\/[^/?#]+\/$/u);
    }
    const sample = mcp[0]!;
    const detail = await handlers.call("tqccl_get_team", {
      reference: { collection: "other", legacyTeamId: sample.legacyTeamId, legacyVariantId: sample.legacyVariantId },
    });
    expect(detail.team).toMatchObject({ ref: `other:${sample.legacyTeamId}`, teamGroupId: sample.teamGroupId, optionCount: sample.optionCount, pagePath: sample.pagePath });
  });

  it("phương án admitted thiếu dữ liệu không có trong MCP", async () => {
    const incomplete = (web.payload.records as Rec[]).filter((row) => row.dataComplete === false);
    expect(incomplete.length).toBeGreaterThan(0);
    const pub = await realPublication();
    for (const row of incomplete) expect(pub.getTeam(`other:${row.legacyTeamId}`), row.legacyTeamId).toBeUndefined();
  });
});

describe("Đội khác: validator MCP kiểm cùng bất biến teamGroups với builder", () => {
  let payload: Rec;
  beforeAll(async () => {
    payload = (await webOtherTeams()).payload;
  });
  const clone = () => structuredClone(payload) as { records: Rec[]; teamGroups: Rec[] };
  const multi = (data: { teamGroups: Rec[] }) => data.teamGroups.find((group) => group.completeVariantIds.length >= 2 && group.memberVariantIds.length > group.completeVariantIds.length)!;

  it("nhận payload của generation đang pin", async () => {
    const data = clone();
    await expect(verifyOtherTeamGroups(data.records, data.teamGroups)).resolves.toBeUndefined();
  });

  it("từ chối teamGroupId không khớp khóa", async () => {
    const data = clone();
    data.records[0]!.teamGroupId = "g-0000000000000000";
    await expect(verifyOtherTeamGroups(data.records, data.teamGroups)).rejects.toThrow(/teamGroupId/u);
    const group = clone();
    group.teamGroups[0]!.teamGroupKey = `${group.teamGroups[0]!.teamGroupKey}x`;
    await expect(verifyOtherTeamGroups(group.records, group.teamGroups)).rejects.toThrow(/group id/u);
  });

  it("từ chối cờ dataComplete lệch holders", async () => {
    const data = clone();
    const row = data.records.find((entry) => entry.dataComplete === true)!;
    row.holders[0].bookSlotsRaw = ["", "", ""];
    await expect(verifyOtherTeamGroups(data.records, data.teamGroups)).rejects.toThrow(/dataComplete/u);
  });

  it("từ chối member lệch tập record, record ngoài group, record trùng", async () => {
    const missing = clone();
    multi(missing).memberVariantIds.pop();
    await expect(verifyOtherTeamGroups(missing.records, missing.teamGroups)).rejects.toThrow(/members/u);
    const orphan = clone();
    const dropped = orphan.teamGroups.pop()!;
    await expect(verifyOtherTeamGroups(orphan.records, orphan.teamGroups)).rejects.toThrow(/outside any group/u);
    expect(dropped.memberVariantIds.length).toBeGreaterThan(0);
    const twice = clone();
    twice.records.push(structuredClone(twice.records[0]!));
    await expect(verifyOtherTeamGroups(twice.records, twice.teamGroups)).rejects.toThrow(/twice/u);
  });

  it("từ chối group lặp và khóa team không khớp tướng + binh chủng thật", async () => {
    const duplicate = clone();
    duplicate.teamGroups.push(structuredClone(duplicate.teamGroups[0]!));
    await expect(verifyOtherTeamGroups(duplicate.records, duplicate.teamGroups)).rejects.toThrow(/group appears twice/u);
    const forged = clone();
    const record = forged.records[0]!;
    const key = `${record.teamGroupKey}x`;
    record.teamGroupKey = key;
    record.teamGroupId = `g-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
    await expect(verifyOtherTeamGroups(forged.records, forged.teamGroups)).rejects.toThrow(/teamGroupKey differs from holders/u);
  });

  it("từ chối khóa team null khi tướng không có identity, dù id khớp hash của chuỗi rỗng", async () => {
    const data = clone();
    const record = data.records[0]!;
    for (const holder of record.holders) holder.heroIdentityId = null;
    record.teamGroupKey = null;
    record.teamGroupId = `g-${createHash("sha256").update("").digest("hex").slice(0, 16)}`;
    await expect(verifyOtherTeamGroups(data.records, data.teamGroups)).rejects.toThrow(/teamGroupKey differs from holders/u);
  });

  it("từ chối member sai thứ tự optionRank", async () => {
    const data = clone();
    multi(data).memberVariantIds.reverse();
    await expect(verifyOtherTeamGroups(data.records, data.teamGroups)).rejects.toThrow(/optionRank/u);
  });

  it("từ chối completeVariantIds lệch cờ và đại diện không phải phương án đủ đầu tiên", async () => {
    const complete = clone();
    multi(complete).completeVariantIds.pop();
    await expect(verifyOtherTeamGroups(complete.records, complete.teamGroups)).rejects.toThrow(/complete set/u);
    const representative = clone();
    const group = multi(representative);
    group.representativeVariantId = group.completeVariantIds[1];
    await expect(verifyOtherTeamGroups(representative.records, representative.teamGroups)).rejects.toThrow(/representative/u);
  });
});
