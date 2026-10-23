import { describe, expect, it } from "vitest";

import { lookupHref } from "../../../js/lookup-ids.js";
import { localePath } from "../../../js/i18n.js";
import { projectCatalogEntities } from "../../src/data/publication-builder.js";
import { buildPublicationReadModel, type PublicationMeta } from "../../src/data/publication-projection.js";
import { handleGetEntity } from "../../src/research/catalog-handlers.js";
import type { ToolContext } from "../../src/research/tool-context.js";

const ID = "book:di-truc-bao-oan";
const hex = (digit: string) => digit.repeat(64);
const sha = (digit: string) => `sha256:${hex(digit)}` as const;
const pin = { schemaVersion: 1, generationId: hex("a"), manifestSha256: hex("b") } as const;
const upstream: PublicationMeta["upstream"] = {
  recommended: pin,
  lookup: { generationId: `lookup:${hex("c")}` },
  websiteDisplay: { generationId: `site-localization:${hex("d")}`, sha256: sha("e"), recommendedPin: pin },
  routeLedger: { generationId: hex("a"), sha256: sha("f") },
  sources: { "books-dict": sha("1"), "heroes-dict": sha("2"), khaihoang: sha("3"), "lookup-catalog": sha("4"), "lookup-manifest": sha("5"), tactics: sha("6"), teams: sha("7") },
};
const route = (id: string) => {
  const vi = lookupHref(id)!;
  return { id, kind: "entity", vi, zh: localePath(vi, "zh") };
};

// Binh thư đã đổi tên Việt: id cố định, tên cũ nằm trong `aliases`.
function model() {
  const rows = projectCatalogEntities({
    heroes: [],
    tactics: [],
    books: [{ id: ID, chinese: "以直报怨", viet: "Lấy Thẳng Báo Oán", aliases: ["Dĩ Trực Báo Oán"], sourceNames: ["以直報怨"], effect: "e", effectViet: "v", effectVersion: "2021-11" }],
    catalog: { equipment: [], specials: [], advisors: [], troopMods: [], buildings: [] },
  });
  return buildPublicationReadModel(
    {
      entityShards: [rows],
      registry: [{
        schemaVersion: 1, upstream,
        seasonOptions: [{ sourceSeasonId: "s1", label: "S1", nameRaw: "S1", displayNameVi: "S1", displayCode: "S1", sourceOrder: 1, status: "current", translationStatus: "ok" }],
        defaultSourceSeasonId: "s1", categories: [], scopes: [], displayLabels: {}, collections: [],
      }],
      teamIndex: [],
      detailShards: [],
      routes: rows.map((row) => route(row.id as string)),
    },
    { schemaVersion: 1, shards: { "catalog-entities": 1, "reference-team-details": 1 }, upstream },
  );
}

describe("frozen book ids in the publication", () => {
  it("keeps the published id after a rename and never mints book:<slug of the new name>", () => {
    const pub = model();
    expect(pub.getEntity(ID)?.id).toBe(ID);
    expect(pub.getEntity("book:lay-thang-bao-oan")).toBeUndefined();
  });

  it("tqccl_get_entity resolves the frozen id", async () => {
    const pub = model();
    const ctx = {
      publication: () => pub,
      workflowVersion: "workflow:test",
      ensureExpectedWorkflow: () => undefined,
      requireExpectedWorkflow: () => undefined,
      commonResult: () => ({}),
    } as unknown as ToolContext;
    const result = await handleGetEntity(ctx, { entityId: ID });
    expect(result.entity.entityId).toBe(ID);
    expect(result.entity.pagePath).toBe(lookupHref(ID));
  });

  it("tqccl_search finds the book by the old Vietnamese name (aliases), the new name and the source name", () => {
    const pub = model();
    for (const query of ["Dĩ Trực Báo Oán", "Lấy Thẳng Báo Oán", "以直報怨"]) {
      expect(pub.searchCatalog(query).items.map((item) => item.entity.id), query).toEqual([ID]);
    }
  });
});
