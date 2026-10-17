import { describe, expect, it } from "vitest";

import { lookupProfilePath } from "../../../js/lookup-ids.js";
import { localePath } from "../../../js/i18n.js";
import { buildPublicationReadModel, type PublicationMeta } from "../../src/data/publication-projection.js";
import { handleGetEntity } from "../../src/research/catalog-handlers.js";
import type { ToolContext } from "../../src/research/tool-context.js";

const RETIRED = "tactic:nhanh-chan-tranh-dat";
const SURVIVOR = "tactic:si-tranh-tien-pho";
const OTHER = "tactic:khac";

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

const tactic = (id: string, nameVi: string, formerIds: string[]) => ({
  id, kind: "tactic", group: "tactics", nameVi, nameZh: null, hanViet: null, aliases: [],
  profile: { lookup: { formerIds } },
});
const route = (id: string) => {
  const vi = lookupProfilePath(id)!;
  return { id, kind: "entity", vi, zh: localePath(vi, "zh") };
};

function model(input = [tactic(SURVIVOR, "Sĩ Tranh Tiên Phô", [RETIRED]), tactic(OTHER, "Khác", [])]) {
  const rows = [...input].sort((left, right) => (left.id < right.id ? -1 : 1));
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
      routes: rows.map((row) => route(row.id)),
    },
    { schemaVersion: 1, shards: { "catalog-entities": 1, "reference-team-details": 1 }, upstream },
  );
}

describe("retired tactic ids (lookup.formerIds)", () => {
  it("getEntity resolves a retired id to the survivor; live ids are never shadowed", () => {
    const pub = model();
    expect(pub.getEntity(RETIRED)?.id).toBe(SURVIVOR);
    expect(pub.getEntity(SURVIVOR)?.id).toBe(SURVIVOR);
    expect(pub.getEntity("tactic:khong-co")).toBeUndefined();
    // A retired id that is still a live row stays its own entity.
    const live = model([tactic(SURVIVOR, "Sĩ Tranh Tiên Phô", [RETIRED]), tactic(RETIRED, "Nhánh Chân Tranh Đất", [])]);
    expect(live.getEntity(RETIRED)?.id).toBe(RETIRED);
  });

  it("tqccl_get_entity returns the survivor profile for a retired id", async () => {
    const pub = model();
    const ctx = {
      publication: () => pub,
      workflowVersion: "workflow:test",
      ensureExpectedWorkflow: () => undefined,
      requireExpectedWorkflow: () => undefined,
      commonResult: () => ({}),
    } as unknown as ToolContext;
    const result = await handleGetEntity(ctx, { entityId: RETIRED });
    expect(result.entity.entityId).toBe(SURVIVOR);
    expect(result.entity.pagePath).toBe(lookupProfilePath(SURVIVOR));
    expect("profile" in result).toBe(true);
    const lookup = "profile" in result ? result.profile?.lookup : undefined;
    expect(lookup && typeof lookup === "object" && "formerIds" in lookup ? lookup.formerIds : undefined).toEqual([RETIRED]);
  });

  it("search matches the retired id slug and returns only the survivor", () => {
    const hit = model().searchCatalog("nhanh-chan-tranh-dat");
    expect(hit.items.map((item) => item.entity.id)).toEqual([SURVIVOR]);
  });
});
