import { describe, expect, it } from "vitest";
import { toJSONSchema, type z } from "zod";

import { localePath } from "../../../js/i18n.js";
import {
  projectCatalogEntities,
  projectEntityRoutes,
  projectRecommendedTeam,
  type RecommendedQilueCatalog,
} from "../../src/data/publication-builder.js";
import { buildPublicationReadModel, type PublicationMeta } from "../../src/data/publication-projection.js";
import { getTeamInputSchema, getTeamOutputSchema, handleGetTeam } from "../../src/research/team-handlers.js";
import type { ToolContext } from "../../src/research/tool-context.js";
import { lookupRouteLedgerFor, withLookupIdentity, type JsonRecord } from "../fixtures/lookup-roots.js";

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
const pins = { generationId: upstream.lookup.generationId, booksSha256: hex("9") };

const ORDERED = {
  strategyId: "qilue-strategy:muu-tinh",
  cardIds: ["qilue-card:bo-tri-thap-dien", "qilue-card:am-do-tran-thuong"],
  ordered: true,
  form: "official",
  hideNoteBlockId: "p-2",
};
const LIST = { strategyId: null, cardIds: ["qilue-card:bat-vua-pha-doanh", "qilue-card:bo-tri-thap-dien"], ordered: false, form: "list" };
const COPY = { ...ORDERED, form: "copy", copyFrom: ["s27-ordered"], hideNoteBlockId: "p-1" };

const TEAMS: Array<[string, JsonRecord | undefined]> = [
  ["s27-ordered", ORDERED],
  ["s27-list", LIST],
  ["s27-copy", COPY],
  ["s27-plain", undefined],
];

function entities() {
  const { heroes, tactics, catalog } = withLookupIdentity({ heroes: [], tactics: [] });
  return projectCatalogEntities({ heroes, tactics, books: [], catalog });
}

function qilueCatalog(rows = entities()): RecommendedQilueCatalog {
  return { entities: new Map(rows.map((row) => [String(row.id), row])), recommendedIds: new Set(TEAMS.map(([id]) => id)) };
}

const heroOf = () => null;
const resolver = { tactic: () => null, book: () => null };

function team(position: number, id: string, qilue: unknown, catalog = qilueCatalog()) {
  const detail: JsonRecord = {
    sourceConfigId: id,
    displayNameVi: `Đội ${id}`,
    nameZh: null,
    sourceSeasonCode: "PK-S27",
    heroes: [],
    displayNotes: { schemaVersion: 1, blocks: [{ id: "p-2", owner: "team", textVi: "Kỳ lược: …", textRaw: "奇略：…" }] },
    ...(qilue === undefined ? {} : { qilue }),
  };
  const index = { ...detail, sourceSeasonId: "s1", sourceCategoryId: "c1", sourceSeasonLabel: "S1", subcategoryRaw: null, tierOrder: 1 };
  return projectRecommendedTeam(position, index, detail, `pk-s27-${id}`, heroOf, resolver, catalog);
}

function context(): ToolContext {
  const rows = entities();
  const built = TEAMS.map(([id, qilue], position) => team(position, id, qilue));
  const routes = [
    ...projectEntityRoutes(rows, lookupRouteLedgerFor(rows.map((row) => String(row.id)), pins), pins),
    ...built.map((entry) => ({ id: entry.route.id, kind: "team", vi: entry.route.vi, zh: localePath(entry.route.vi, "zh") })),
  ];
  const byRef = (left: JsonRecord, right: JsonRecord) => String(left.ref).localeCompare(String(right.ref), "en");
  const pub = buildPublicationReadModel(
    {
      entityShards: [rows],
      registry: [{
        schemaVersion: 1, upstream,
        seasonOptions: [{ sourceSeasonId: "s1", label: "S1", nameRaw: "S1", displayNameVi: "S1", displayCode: "S1", sourceOrder: 1, status: "current", translationStatus: "ok" }],
        defaultSourceSeasonId: "s1", categories: [], scopes: [], displayLabels: {}, collections: [],
      }],
      teamIndex: built.map((entry) => entry.summary).sort(byRef),
      detailShards: [built.map((entry) => entry.detail).sort(byRef)],
      routes,
    },
    { schemaVersion: 1, shards: { "catalog-entities": 1, "reference-team-details": 1 }, upstream },
  );
  return {
    snapshot: { artifacts: { teams: [] } },
    publication: () => pub,
    workflowVersion: "workflow:test",
    ensureExpectedWorkflow: () => undefined,
    requireExpectedWorkflow: () => undefined,
    commonResult: () => ({}),
  } as unknown as ToolContext;
}

const reference = (sourceConfigId: string) => ({ collection: "recommended" as const, sourceConfigId });

/** Kết quả get_team theo đúng output schema của tool (handler trả union theo section). */
const getTeam = (ctx: ToolContext, input: unknown) =>
  handleGetTeam(ctx, input) as Promise<z.infer<typeof getTeamOutputSchema>>;

describe("kỳ lược trong record đội Recommended của publication", () => {
  it("record không mang qilue thô hay hideNoteBlockId; detail chỉ giữ mã đã kiểm", () => {
    for (const [position, [id, qilue]] of TEAMS.entries()) {
      const { detail, summary } = team(position, id, qilue);
      const record = detail.record as JsonRecord;
      expect(record).not.toHaveProperty("qilue");
      expect(JSON.stringify([detail, summary])).not.toMatch(/hideNoteBlockId|"form"/u);
      // Block ghi chú vẫn còn nguyên: chỉ trang web ẩn block trùng.
      expect((record.displayNotes as { blocks: unknown[] }).blocks).toHaveLength(1);
    }
    expect(team(0, "s27-ordered", ORDERED).detail.qilue).toEqual({
      strategyId: "qilue-strategy:muu-tinh",
      cardIds: ["qilue-card:bo-tri-thap-dien", "qilue-card:am-do-tran-thuong"],
      ordered: true,
    });
    expect(team(2, "s27-copy", COPY).detail.qilue).toMatchObject({ copyFrom: ["s27-ordered"] });
    expect(team(3, "s27-plain", undefined).detail).not.toHaveProperty("qilue");
  });

  it("mã kỳ lược không có trong catalog cùng publication thì publication dừng", () => {
    const bad = (qilue: JsonRecord) => () => team(0, "s27-ordered", { ...ORDERED, ...qilue });
    expect(bad({ cardIds: ["qilue-card:khong-co"] })).toThrow(/s27-ordered\.qilue.*qilue-card:khong-co/u);
    expect(bad({ strategyId: "qilue-strategy:khong-co" })).toThrow(/qilue-strategy:khong-co/u);
    // Đúng mã nhưng sai loại entity cũng dừng.
    expect(bad({ cardIds: ["qilue-strategy:muu-tinh"] })).toThrow(/qilue-strategy:muu-tinh/u);
    expect(bad({ strategyId: "qilue-card:bo-tri-thap-dien" })).toThrow(/qilue-card:bo-tri-thap-dien/u);
    expect(bad({ copyFrom: ["s27-khong-co"] })).toThrow(/s27-khong-co/u);
    expect(bad({ cardIds: Array(6).fill("qilue-card:bo-tri-thap-dien") })).toThrow(/cardIds/u);
    expect(bad({ ordered: "yes" })).toThrow(/ordered/u);
    expect(() => team(0, "s27-ordered", "qilue")).toThrow(/qilue must be an object/u);
  });
});

describe("tqccl_get_team section qilue", () => {
  it("dạng có thứ tự: phương lược có tên, thẻ có hiệp 2..6, loại và độ hiếm", async () => {
    const ctx = context();
    const overview = await getTeam(ctx, { reference: reference("s27-ordered") });
    expect(overview.sections).toContainEqual({ name: "qilue", total: 1 });
    expect(overview.team).not.toHaveProperty("qilue");
    const result = await getTeam(ctx, { reference: reference("s27-ordered"), section: "qilue" });
    expect(result.qilue).toEqual({
      strategy: { id: "qilue-strategy:muu-tinh", nameVi: "Mưu tính", nameZh: "謀算" },
      cards: [
        { round: 2, id: "qilue-card:bo-tri-thap-dien", nameVi: "Bố Trí Thập Diện", nameZh: "設伏十面", type: "muu", rarity: "common" },
        { round: 3, id: "qilue-card:am-do-tran-thuong", nameVi: "Ám Độ Trần Thương", nameZh: "暗度陳倉", type: "muu", rarity: "common" },
      ],
      ordered: true,
    });
    expect(result.build).toMatchObject({ ref: "recommended:s27-ordered" });
    expect(getTeamOutputSchema.shape.qilue.parse(result.qilue)).toEqual(result.qilue);
    expect(JSON.stringify(result)).not.toMatch(/hideNoteBlockId|"form"/u);
  });

  it("dạng danh sách: không có hiệp, phương lược null", async () => {
    const result = await getTeam(context(), { reference: reference("s27-list"), section: "qilue" });
    expect(result.qilue).toEqual({
      strategy: null,
      cards: [
        { id: "qilue-card:bat-vua-pha-doanh", nameVi: "Bắt Vua Phá Doanh", nameZh: "擒王破營", type: "dung", rarity: "rare" },
        { id: "qilue-card:bo-tri-thap-dien", nameVi: "Bố Trí Thập Diện", nameZh: "設伏十面", type: "muu", rarity: "common" },
      ],
      ordered: false,
    });
    expect(getTeamOutputSchema.shape.qilue.parse(result.qilue)).toEqual(result.qilue);
  });

  it("dạng chép: copyFrom là sourceConfigId đội nguồn, gọi được tqccl_get_team", async () => {
    const ctx = context();
    const result = await getTeam(ctx, { reference: reference("s27-copy"), section: "qilue" });
    expect(result.qilue).toMatchObject({ ordered: true, copyFrom: ["s27-ordered"] });
    expect(result.qilue?.cards.map((card) => card.round)).toEqual([2, 3]);
    const source = await getTeam(ctx, { reference: reference(result.qilue!.copyFrom![0]!) });
    expect(source.team?.ref).toBe("recommended:s27-ordered");
  });

  it("đội không có kỳ lược thì không có section; cursor bị từ chối", async () => {
    const ctx = context();
    const overview = await getTeam(ctx, { reference: reference("s27-plain") });
    expect(overview.sections?.map((entry) => entry.name)).not.toContain("qilue");
    await expect(getTeam(ctx, { reference: reference("s27-plain"), section: "qilue" })).rejects.toMatchObject({ code: "INVALID_REQUEST", fields: ["section"] });
    await expect(getTeam(ctx, { reference: reference("s27-ordered"), section: "qilue", cursor: "abc", expectedWorkflowVersion: "workflow:test" })).rejects.toMatchObject({ code: "CURSOR_INVALID" });
  });

  it("schema công bố section qilue ở input và output", () => {
    const input = toJSONSchema(getTeamInputSchema) as unknown as { properties: { section: { enum: string[] } } };
    expect(input.properties.section.enum).toContain("qilue");
    expect(Object.keys(getTeamOutputSchema.shape)).toContain("qilue");
  });
});
