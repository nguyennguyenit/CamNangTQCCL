import { describe, expect, it } from "vitest";

import { lookupProfilePath } from "../../../js/lookup-ids.js";
import { FilesystemDataSource } from "../../src/data/filesystem-data-source.js";
import type { CatalogEntityView } from "../../src/data/publication-projection.js";
import { realHandlers, realPublication } from "../fixtures/real-handlers.js";
import { repositoryDataRoot } from "../fixtures/publication-sources.js";
import { seasonalHandlers } from "../fixtures/season-handlers.js";

const handlers = realHandlers();

async function entities(): Promise<readonly CatalogEntityView[]> {
  return (await realPublication()).entities;
}

describe("tqccl_search", () => {
  it("finds an equipment record by its exact Vietnamese name", async () => {
    const result = await handlers.call("tqccl_search", { query: "Thanh Long Yển Nguyệt Đao" });
    const hit = result.items.find((item) => item.entityId === "equipment:thanh-long-yen-nguyet-dao");
    expect(hit).toMatchObject({ kind: "equipment", displayName: "Thanh Long Yển Nguyệt Đao", matchedTerm: "Thanh Long Yển Nguyệt Đao" });
    expect(hit?.pagePath).toBe(lookupProfilePath("equipment:thanh-long-yen-nguyet-dao"));
  });

  it("covers all eight kinds when browsing with an empty query", async () => {
    const seen = new Set<string>();
    const all = await entities();
    const publicKinds: Record<string, string> = { "equipment-special": "equipment", "troop-mod": "troopMod" };
    const expected = new Set(all.map((entity) => publicKinds[entity.kind] ?? entity.kind));
    expected.add("team");
    let cursor: string | undefined;
    let workflowVersion: string | undefined;
    for (let page = 0; page < 200; page += 1) {
      const result = await handlers.call("tqccl_search", {
        query: "",
        limit: 50,
        ...(cursor ? { cursor, expectedWorkflowVersion: workflowVersion } : {}),
      });
      for (const item of result.items) seen.add(item.kind);
      workflowVersion = result.workflowVersion;
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(expected);
    expect(expected.size).toBe(8);
  });

  it("filters by kind and matches Han and alias terms", async () => {
    const heroes = await handlers.call("tqccl_search", { query: "青龍偃月刀", kinds: ["equipment"] });
    expect(heroes.items.map((item) => item.entityId)).toContain("equipment:thanh-long-yen-nguyet-dao");
    expect(heroes.items.every((item) => item.kind === "equipment")).toBe(true);
  });

  it("locale zh only changes display and pagePath", async () => {
    const vi = await handlers.call("tqccl_search", { query: "Thanh Long Yển Nguyệt Đao", kinds: ["equipment"] });
    const zh = await handlers.call("tqccl_search", { query: "Thanh Long Yển Nguyệt Đao", kinds: ["equipment"], locale: "zh" });
    expect(zh.items.map((item) => item.entityId)).toEqual(vi.items.map((item) => item.entityId));
    expect(zh.items[0]?.pagePath).toBe(`/zh${vi.items[0]?.pagePath}`);
  });

  it("binds cursors to tool, filter, locale and workflow version", async () => {
    const first = await handlers.call("tqccl_search", { query: "", kinds: ["hero"], limit: 2 });
    expect(first.nextCursor).toBeDefined();
    const next = { query: "", kinds: ["hero"] as const, limit: 2, cursor: first.nextCursor, expectedWorkflowVersion: first.workflowVersion };
    const page = await handlers.call("tqccl_search", next);
    expect(page.items[0]?.entityId).not.toBe(first.items[0]?.entityId);
    await expect(handlers.call("tqccl_search", { ...next, query: "a" })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    await expect(handlers.call("tqccl_search", { ...next, kinds: ["tactic"] })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    await expect(handlers.call("tqccl_search", { ...next, locale: "zh" })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
    await expect(
      handlers.call("tqccl_get_entity", { entityId: "equipment:thanh-long-yen-nguyet-dao", section: "specials", cursor: first.nextCursor, expectedWorkflowVersion: first.workflowVersion }),
    ).rejects.toMatchObject({ code: "CURSOR_INVALID" });
  });

  it("requires expectedWorkflowVersion with a cursor and honors it when sent", async () => {
    const first = await handlers.call("tqccl_search", { query: "", kinds: ["hero"], limit: 1 });
    await expect(handlers.call("tqccl_search", { query: "", kinds: ["hero"], limit: 1, cursor: first.nextCursor })).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: ["expectedWorkflowVersion"] });
    await expect(
      handlers.call("tqccl_search", { query: "", kinds: ["hero"], limit: 1, cursor: first.nextCursor, expectedWorkflowVersion: "workflow:stale" }),
    ).rejects.toMatchObject({ code: "WORKFLOW_VERSION_CHANGED", retryable: true });
    await expect(handlers.call("tqccl_search", { query: "", kinds: ["hero"], expectedWorkflowVersion: "workflow:stale" })).rejects.toMatchObject({ code: "WORKFLOW_VERSION_CHANGED" });
    await expect(handlers.call("tqccl_search", { query: "", kinds: ["hero"], cursor: "!!", expectedWorkflowVersion: first.workflowVersion })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
  });

  it("rejects unknown kinds and unknown keys with field names only", async () => {
    await expect(handlers.call("tqccl_search", { query: "a", kinds: ["nope"] } as never)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(handlers.call("tqccl_search", { query: "a", extra: 1 } as never)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("tqccl_get_entity", () => {
  it("returns the Tra cứu profile for one record of each of the seven groups", async () => {
    const all = await entities();
    const groups = [...new Set(all.map((entity) => entity.group))];
    expect(groups).toHaveLength(7);
    for (const group of groups) {
      const entity = all.find((candidate) => candidate.group === group)!;
      const result = await handlers.call("tqccl_get_entity", { entityId: entity.id });
      expect(result.entity).toMatchObject({ entityId: entity.id, group, nameVi: entity.nameVi, nameZh: entity.nameZh, hanViet: entity.hanViet, aliases: entity.aliases });
      expect(result.entity.pagePath).toBe(entity.pagePath.vi);
      const nested = new Set(Object.keys(result.omittedCounts ?? {}).map((name) => ({ specials: "specialIds" })[name] ?? name));
      for (const [key, value] of Object.entries(entity.profile)) {
        if (nested.has(key)) expect(result.profile).not.toHaveProperty(key);
        else expect(result.profile?.[key]).toEqual(value);
      }
      const zh = await handlers.call("tqccl_get_entity", { entityId: entity.id, locale: "zh" });
      expect(zh.entity.pagePath).toBe(entity.pagePath.zh);
      expect(zh.entity.pagePath.startsWith("/zh/tra-cuu/")).toBe(true);
    }
  });

  it("pages nested levels, options and specials and reports omittedCounts", async () => {
    const all = await entities();
    for (const [section, kind, key] of [["levels", "building", "levels"], ["options", "troop-mod", "options"], ["specials", "equipment", "specialIds"]] as const) {
      const entity = all.find((candidate) => candidate.kind === kind && Array.isArray(candidate.profile[key]) && (candidate.profile[key] as unknown[]).length > 1)!;
      const total = (entity.profile[key] as unknown[]).length;
      const overview = await handlers.call("tqccl_get_entity", { entityId: entity.id });
      expect(overview.omittedCounts?.[section]).toBe(total);
      expect(overview.sections).toContainEqual({ name: section, total });
      const collected: unknown[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await handlers.call("tqccl_get_entity", {
          entityId: entity.id,
          section,
          limit: 1,
          ...(cursor ? { cursor, expectedWorkflowVersion: overview.workflowVersion } : {}),
        });
        expect(page.total).toBe(total);
        collected.push(...page.items!);
        cursor = page.nextCursor;
        pages += 1;
      } while (cursor);
      expect(pages).toBe(total);
      expect(collected).toHaveLength(total);
    }
  });

  it("resolves specials into equipment-special entities", async () => {
    const page = await handlers.call("tqccl_get_entity", { entityId: "equipment:thanh-long-yen-nguyet-dao", section: "specials" });
    expect(page.items!.map((item) => item.entityId)).toEqual(["equipment-special:long-tuong", "equipment-special:vo-thanh"]);
    expect(page.items![0]?.pagePath).toBe(lookupProfilePath("equipment-special:long-tuong"));
  });

  it("rejects a section the entity does not have and unknown ids", async () => {
    await expect(handlers.call("tqccl_get_entity", { entityId: "hero:40y-lu-bo", section: "levels" })).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: ["section"] });
    await expect(handlers.call("tqccl_get_entity", { entityId: "hero:khong-ton-tai" })).rejects.toMatchObject({ code: "ENTITY_NOT_FOUND", retryable: false });
  });
});

describe("capability on snapshots without publication", () => {
  it("returns CAPABILITY_UNAVAILABLE instead of empty results", async () => {
    const h = await seasonalHandlers();
    await expect(h.call("tqccl_search", { query: "" })).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE", retryable: false });
    await expect(h.call("tqccl_get_entity", { entityId: "hero:anh" })).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
  });
});
