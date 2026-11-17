import { describe, expect, it } from "vitest";

import { lookupHref } from "../../../js/lookup-ids.js";
import { projectCatalogEntities, projectEntityRoutes } from "../../src/data/publication-builder.js";
import { buildPublicationReadModel, type PublicationMeta } from "../../src/data/publication-projection.js";
import { handleGetEntity, handleSearch } from "../../src/research/catalog-handlers.js";
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

const QILUE_IDS = [
  "qilue-card:am-do-tran-thuong",
  "qilue-card:bat-vua-pha-doanh",
  "qilue-card:bo-tri-thap-dien",
  "qilue-strategy:cuong-cong",
  "qilue-strategy:muu-tinh",
];

/** Tra cứu tối thiểu: hai chiến pháp trùng tên/chữ Hán với Kỳ lược (allowlist va chạm) cộng catalog fixture. */
function bundle() {
  return withLookupIdentity({
    heroes: [],
    tactics: [
      { id: "tactic:cuong-cong", viet: "Cường Công", chinese: "強攻" },
      { id: "tactic:thap-dien-mai-phuc", viet: "Thập Diện Mai Phục", chinese: "十面埋伏" },
    ],
  });
}

function entities(catalog: JsonRecord = bundle().catalog) {
  const { heroes, tactics } = bundle();
  return projectCatalogEntities({ heroes, tactics, books: [], catalog });
}

function ids(records: readonly JsonRecord[]) {
  return records.map((record) => String(record.id));
}

function readModel() {
  const rows = entities();
  const routes = projectEntityRoutes(rows, lookupRouteLedgerFor(ids(rows), pins), pins);
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
      routes,
    },
    { schemaVersion: 1, shards: { "catalog-entities": 1, "reference-team-details": 1 }, upstream },
  );
}

function context(): ToolContext {
  const pub = readModel();
  return {
    snapshot: { artifacts: { teams: [] } },
    publication: () => pub,
    workflowVersion: "workflow:test",
    ensureExpectedWorkflow: () => undefined,
    requireExpectedWorkflow: () => undefined,
    commonResult: () => ({}),
  } as unknown as ToolContext;
}

describe("Kỳ lược trong publication", () => {
  it("phát entity nhóm qilue với đúng trường public của hợp đồng", () => {
    const rows = entities();
    const qilue = rows.filter((row) => row.group === "qilue");
    expect(ids(qilue).sort()).toEqual(QILUE_IDS);
    expect(qilue.filter((row) => row.kind === "qilue-strategy")).toHaveLength(2);
    expect(qilue.filter((row) => row.kind === "qilue-card")).toHaveLength(3);

    const card = rows.find((row) => row.id === "qilue-card:bo-tri-thap-dien")!;
    expect(card).toMatchObject({ kind: "qilue-card", nameVi: "Bố Trí Thập Diện", nameZh: "設伏十面", hanViet: null, aliases: ["設伏十面"] });
    expect(Object.keys(card.profile as JsonRecord).sort()).toEqual(
      ["conditions", "effectVi", "effectZh", "missingFields", "rarity", "strategyIds", "targetVi", "type", "zhSource"],
    );
    expect(card.profile).toMatchObject({ type: "muu", rarity: "common", targetVi: "Nhóm quân ta", strategyIds: ["qilue-strategy:muu-tinh"] });

    const strategy = rows.find((row) => row.id === "qilue-strategy:muu-tinh")!;
    expect(strategy).toMatchObject({ kind: "qilue-strategy", nameVi: "Mưu tính", nameZh: "謀算", aliases: ["Mưu Toán", "謀算"] });
    expect(Object.keys(strategy.profile as JsonRecord).sort()).toEqual(
      ["buffVi", "buffZh", "cardTypes", "conditions", "descriptionVi", "descriptionZh", "missingFields", "zhSource"],
    );
    // Thẻ Dũng dùng được ở mọi phương lược có `dung` trong cardTypes.
    expect(rows.find((row) => row.id === "qilue-card:bat-vua-pha-doanh")?.profile).toMatchObject({ strategyIds: ["qilue-strategy:cuong-cong"] });
  });

  it("bỏ trường ngoài allowlist và từ chối catalog thiếu khóa Kỳ lược", () => {
    const catalog = bundle().catalog;
    const cards = (catalog.qilueCards as JsonRecord[]).map((row) => ({ ...row, reviewerNote: "secret" }));
    expect(JSON.stringify(entities({ ...catalog, qilueCards: cards }))).not.toContain("secret");
    const { qilueCards: _cards, ...withoutCards } = catalog;
    expect(() => entities(withoutCards)).toThrow(/catalog\.qilueCards must be an array/u);
    const { qilueStrategies: _strategies, ...withoutStrategies } = catalog;
    expect(() => entities(withoutStrategies)).toThrow(/catalog\.qilueStrategies must be an array/u);
  });

  it("route trang riêng /tra-cuu/ky-luoc/<slug>/ lấy từ ledger", () => {
    const rows = entities();
    const routes = projectEntityRoutes(rows, lookupRouteLedgerFor(ids(rows), pins), pins);
    expect(routes.find((route) => route.id === "qilue-card:bo-tri-thap-dien")).toEqual({
      id: "qilue-card:bo-tri-thap-dien", kind: "entity", vi: "/tra-cuu/ky-luoc/bo-tri-thap-dien/", zh: "/zh/tra-cuu/ky-luoc/bo-tri-thap-dien/",
    });
    expect(routes.filter((route) => String(route.vi).startsWith("/tra-cuu/ky-luoc/"))).toHaveLength(QILUE_IDS.length);
  });

  it("ledger thiếu entity Kỳ lược thì publication dừng", () => {
    const rows = entities();
    const missing = lookupRouteLedgerFor(ids(rows), pins, (handles) => { delete handles.qilue!["qilue-card:bo-tri-thap-dien"]; });
    expect(() => projectEntityRoutes(rows, missing, pins)).toThrow(
      /lookup route ledger is not valid for this publication: lookup route ledger qilue: missing \["qilue-card:bo-tri-thap-dien"\]/u,
    );
    const noGroup = lookupRouteLedgerFor(ids(rows), pins, (handles) => { delete handles.qilue; });
    expect(() => projectEntityRoutes(rows, noGroup, pins)).toThrow(/lookup route ledger groups: missing \["qilue"\]/u);
    // Corpus thiếu entity mà ledger còn giữ: cũng dừng (không có route mồ côi).
    const fewer = rows.filter((row) => row.id !== "qilue-strategy:muu-tinh");
    expect(() => projectEntityRoutes(fewer, lookupRouteLedgerFor(ids(rows), pins), pins)).toThrow(/qilue: missing \[\] \(0\), unknown \["qilue-strategy:muu-tinh"\]/u);
  });
});

describe("tqccl_search và tqccl_get_entity với Kỳ lược", () => {
  it("Cường Công ra cả chiến pháp lẫn phương lược, phân biệt bằng kind", async () => {
    const result = await handleSearch(context(), { query: "Cường Công" });
    const hits = result.items.map((item) => [item.entityId, item.kind]);
    expect(hits).toContainEqual(["tactic:cuong-cong", "tactic"]);
    expect(hits).toContainEqual(["qilue-strategy:cuong-cong", "qilueStrategy"]);
    const han = await handleSearch(context(), { query: "強攻" });
    expect(han.items.map((item) => item.entityId).sort()).toEqual(["qilue-strategy:cuong-cong", "tactic:cuong-cong"]);
  });

  it("tìm thẻ theo tên Việt, chữ Hán trong row và lọc theo kind", async () => {
    const vi = await handleSearch(context(), { query: "Bố Trí Thập Diện" });
    expect(vi.items[0]).toMatchObject({
      entityId: "qilue-card:bo-tri-thap-dien", kind: "qilueCard", displayName: "Bố Trí Thập Diện", pagePath: lookupHref("qilue-card:bo-tri-thap-dien"),
    });
    const zh = await handleSearch(context(), { query: "設伏十面", locale: "zh" });
    expect(zh.items).toEqual([expect.objectContaining({ entityId: "qilue-card:bo-tri-thap-dien", displayName: "設伏十面", pagePath: "/zh/tra-cuu/ky-luoc/bo-tri-thap-dien/" })]);

    const cards = await handleSearch(context(), { query: "", kinds: ["qilueCard"] });
    expect(cards.items.map((item) => item.entityId)).toEqual(QILUE_IDS.filter((id) => id.startsWith("qilue-card:")));
    const strategies = await handleSearch(context(), { query: "Mưu Toán", kinds: ["qilueStrategy"] });
    expect(strategies.items.map((item) => item.entityId)).toEqual(["qilue-strategy:muu-tinh"]);
  });

  it("十面埋伏 không ra thẻ Kỳ lược (chỉ chiến pháp)", async () => {
    const result = await handleSearch(context(), { query: "十面埋伏" });
    expect(result.items.map((item) => item.entityId)).toEqual(["tactic:thap-dien-mai-phuc"]);
    const cardsOnly = await handleSearch(context(), { query: "十面埋伏", kinds: ["qilueCard"] });
    expect(cardsOnly.total).toBe(0);
  });

  it("tqccl_get_entity trả hồ sơ thẻ với trường public, nhóm qilue và tên phương lược", async () => {
    const result = await handleGetEntity(context(), { entityId: "qilue-card:bo-tri-thap-dien" });
    expect(result.entity).toMatchObject({
      entityId: "qilue-card:bo-tri-thap-dien", kind: "qilueCard", group: "qilue", nameZh: "設伏十面",
      pagePath: "/tra-cuu/ky-luoc/bo-tri-thap-dien/",
    });
    expect("profile" in result ? result.profile : undefined).toMatchObject({
      type: "muu", rarity: "common", targetVi: "Nhóm quân ta", effectVi: "Hiệp này tăng 10% sát thương Mưu Lược",
      strategyIds: ["qilue-strategy:muu-tinh"],
    });
    expect("refNames" in result ? result.refNames : undefined).toEqual({ "qilue-strategy:muu-tinh": "Mưu tính" });

    const strategy = await handleGetEntity(context(), { entityId: "qilue-strategy:cuong-cong", locale: "zh" });
    expect(strategy.entity).toMatchObject({ kind: "qilueStrategy", group: "qilue", displayName: "強攻", pagePath: "/zh/tra-cuu/ky-luoc/cuong-cong/" });
    expect("profile" in strategy ? strategy.profile : undefined).toMatchObject({ cardTypes: ["dung", "phu"] });
  });
});
