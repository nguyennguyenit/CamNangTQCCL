// TDD js/lookup-data.js — cổng dữ liệu duy nhất cho bundle tra cứu hợp nhất.
// validateLookupBundle(manifest, rawFiles) và loadLookupBundle(fetchFn) đều async
// (WebCrypto); mọi bundle lệch byte / lệch generation / lệch ID phải bị từ chối
// trọn vẹn, không nhận một phần.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateLookupBundle, loadLookupBundle } from "../js/lookup-data.js";

const MANIFEST_NAME = "lookup-manifest.json";
const PAYLOAD_NAMES = ["heroes-dict.json", "lookup-catalog.json", "tactics.json"];
const encoder = new TextEncoder();

const encode = (value) => encoder.encode(JSON.stringify(value));
const sha256 = (u8) => createHash("sha256").update(u8).digest("hex");

/** generationId = "lookup:" + sha256(canonical_json_bytes(files)) — pipeline/build_unified_lookup.py. */
function manifestFor(rawFiles, overrides = {}) {
  const files = {};
  for (const name of Object.keys(rawFiles).sort()) files[name] = sha256(rawFiles[name]);
  const generationId = "lookup:" + createHash("sha256").update(JSON.stringify(files) + "\n").digest("hex");
  return { schemaVersion: 1, generationId, files, ...overrides };
}

function heroesDoc(over = []) {
  return [
    {
      id: "hero:luu-bi", chinese: "劉備", viet: "Lưu Bị", hanViet: "Lưu Bị", faction: "Thục", stars: 5, cost: "7",
      aliases: ["劉備", "刘备"], stats: { luc: "71", tri: "81", thong: "79", toc: "62", chinh: "92", mi: "95" },
      troopApt: { ky: "S", thuan: "S", cung: "A", thuong: "A", khiGioi: "B" },
      selfTacticCn: "仁德載世", inheritTacticCn: "", roleTag: "support", roleTagViet: "Phụ trợ",
      iconUrl: null, isSP: false, linkScore: null, pending: false,
      lookup: {
        selfTacticId: "tactic:nhan-duc", inheritTacticId: null, advisorId: "advisor:an-phuc-binh-tam",
        variant: "base", categoryVi: "Quân sự", exclusiveTitleVi: null,
        conditions: [], flags: { isCollectible: false, isDynamicOpen: false, isMusou: false, isCO: false, isSp: false },
        growth: { luc: 0.98, tri: 1.71, thong: null, toc: null, chinh: null, mi: null },
        otherAptitudes: { infantry: null, navy: null },
        civil: { roleVi: null, bonusVi: null, specialtyVi: null, tacticBonusVi: null },
        civilInnatePoints: null, collectibleBonusVi: null, redRulesVi: null,
        revisions: [], missingFields: [],
      },
    },
    ...over,
  ];
}

function tacticsDoc(over = []) {
  return [
    {
      id: "tactic:nhan-duc", chinese: "仁德載世", viet: "Nhân Đức Tải Thế", hanViet: "Nhân Đức Tải Thế",
      aliases: [], type: "Bị động", quality: "S", effect: "戰鬥中", effectViet: "Trong trận đấu",
      target: "友軍", targetViet: "Quân ta", troopFit: [], source: null, sourceHeroCn: null,
      iconUrl: null, linkScore: null, pending: false,
      lookup: {
        activationRate: 1, cooldown: null, maxUsers: 1, pointCost: null,
        effectTypeVi: null, exchangeConditionVi: null, acquiredFromVi: [], conflictsVi: null,
        conditions: [], revisions: [], inheritedFromIds: [], missingFields: [],
      },
    },
    ...over,
  ];
}

function catalogDoc(over = {}) {
  return {
    schemaVersion: 1,
    equipment: [{ id: "equipment:y-thien-kiem", nameVi: "Ỷ Thiên Kiếm", slotVi: "Vũ khí", qualityVi: "Cam", aliasesVi: [], aliasesZh: ["倚天劍"], conditions: [], missingFields: [] }],
    specials: [
      { id: "equipment-special:gian-hung", nameVi: "Gian Hùng", equipmentId: "equipment:y-thien-kiem", exclusiveHeroId: "hero:luu-bi", slotVi: "Vũ khí", tierVi: "T0", descriptionVi: "Mô tả", acquisitionVi: ["Rèn"], aliasesVi: [], aliasesZh: ["奸雄"], conditions: [], missingFields: [] },
      { id: "equipment-special:mo-coi", nameVi: "Mồ Côi", equipmentId: null, exclusiveHeroId: null, slotVi: "Vũ khí", tierVi: "T1", descriptionVi: "Chưa rõ trang bị cha", acquisitionVi: [], aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [] },
    ],
    advisors: [{ id: "advisor:an-phuc-binh-tam", nameVi: "An Phủ Bình Tâm", elementVi: "Phong", heroIds: ["hero:luu-bi"], effectVi: "Hiệu ứng", tacticPoints: 3, usageVi: "Dùng", aliasesVi: [], aliasesZh: ["恩服兵心"], conditions: [], missingFields: [] }],
    troopMods: [{
      id: "troop-mod:dan-duong-binh", nameVi: "Đan Dương Binh", appliesToVi: "Thuẫn binh", effectVi: "Hiệu ứng",
      options: [{ id: "troop-option:dan-duong-binh:a", nameVi: "Xoay", convertsToVi: "Thương binh", descriptionVi: "Mô tả", tierVi: "Đặc biệt" }],
      revisions: [{ effectiveDate: "2024-08-28", isCurrent: true, labelVi: "Bản hiện hành", textVi: "Nội dung" }],
      suggestedBuildVi: "Gợi ý", troopLimitVi: [], aliasesVi: [], aliasesZh: ["丹陽兵"], conditions: [], missingFields: [],
    }],
    buildings: [{
      id: "building:bat-tran-do", nameVi: "Bát Trận Đồ", summaryVi: "Tóm tắt", mainCityOnly: false, maxLevel: 1,
      levels: [{ id: "building-level:bat-tran-do:1", level: 1, effectVi: "Hiệu ứng", durationVi: "2 giờ", costs: { wood: 32000, stone: 32000, iron: 16000 } }],
      aliasesVi: [], aliasesZh: ["八陣圖"], conditions: [], missingFields: [],
    }],
    ...over,
  };
}

/** Bundle mặc định: hợp lệ, mọi ID chéo giải được. */
function bundleFixture({ heroes = heroesDoc(), tactics = tacticsDoc(), catalog = catalogDoc() } = {}) {
  const rawFiles = {
    "heroes-dict.json": encode(heroes),
    "tactics.json": encode(tactics),
    "lookup-catalog.json": encode(catalog),
  };
  return { manifest: manifestFor(rawFiles), rawFiles };
}

function withRaw(name, value) {
  const base = bundleFixture();
  const rawFiles = { ...base.rawFiles, [name]: encode(value) };
  return { manifest: manifestFor(rawFiles), rawFiles };
}

test("bundle mạch lạc trả đúng dữ liệu đã parse và đúng bytes đã xác minh", async () => {
  const { manifest, rawFiles } = bundleFixture();
  const bundle = await validateLookupBundle(manifest, rawFiles);

  assert.deepEqual(bundle.heroes.map((h) => h.id), ["hero:luu-bi"]);
  assert.deepEqual(bundle.tactics.map((t) => t.id), ["tactic:nhan-duc"]);
  assert.deepEqual(bundle.catalog.advisors.map((a) => a.id), ["advisor:an-phuc-binh-tam"]);
  assert.deepEqual(bundle.manifest, manifest);
  assert.deepEqual(Object.keys(bundle.rawFiles).sort(), PAYLOAD_NAMES);
  for (const name of PAYLOAD_NAMES) {
    assert.equal(bundle.rawFiles[name], rawFiles[name], `${name} phải là đúng bytes đã verify, không copy`);
  }
});

test("bundle trả về đóng băng để consumer không mutate bytes dùng chung", async () => {
  const { manifest, rawFiles } = bundleFixture();
  const bundle = await validateLookupBundle(manifest, rawFiles);

  assert.equal(Object.isFrozen(bundle), true);
  assert.equal(Object.isFrozen(bundle.rawFiles), true);
  assert.equal(Object.isFrozen(bundle.manifest), true);
  assert.throws(() => { bundle.heroes = []; }, TypeError);
  assert.throws(() => { bundle.rawFiles["tactics.json"] = new Uint8Array(); }, TypeError);
});

test("hash tính trên raw bytes, không parse rồi stringify lại", async () => {
  const prettyHeroes = encoder.encode(JSON.stringify(heroesDoc(), null, 2));
  const rawFiles = { ...bundleFixture().rawFiles, "heroes-dict.json": prettyHeroes };
  const honest = manifestFor(rawFiles);
  const bundle = await validateLookupBundle(honest, rawFiles);
  assert.equal(bundle.rawFiles["heroes-dict.json"], prettyHeroes);

  const restringified = {
    ...honest,
    files: { ...honest.files, "heroes-dict.json": sha256(encode(heroesDoc())) },
  };
  restringified.generationId = "lookup:" + createHash("sha256")
    .update(JSON.stringify(Object.fromEntries(Object.keys(restringified.files).sort().map((k) => [k, restringified.files[k]]))) + "\n")
    .digest("hex");
  await assert.rejects(validateLookupBundle(restringified, rawFiles), /heroes-dict\.json/);
});

test("một byte lệch ở bất kỳ payload nào cũng bị từ chối theo tên file", async () => {
  for (const name of PAYLOAD_NAMES) {
    const { manifest, rawFiles } = bundleFixture();
    const tampered = Uint8Array.from(rawFiles[name]);
    tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0x01;
    await assert.rejects(
      validateLookupBundle(manifest, { ...rawFiles, [name]: tampered }),
      new RegExp(name.replace(".", "\\.")),
      `${name} lệch byte phải bị từ chối`,
    );
  }
});

test("manifest phải đúng schema chính xác", async () => {
  const { rawFiles } = bundleFixture();
  const valid = manifestFor(rawFiles);

  await assert.rejects(validateLookupBundle({ ...valid, schemaVersion: 2 }, rawFiles), /schemaVersion/);
  await assert.rejects(validateLookupBundle({ ...valid, schemaVersion: "1" }, rawFiles), /schemaVersion/);
  await assert.rejects(validateLookupBundle({ ...valid, extra: 1 }, rawFiles), /manifest/);
  const withoutGeneration = { schemaVersion: valid.schemaVersion, files: valid.files };
  await assert.rejects(validateLookupBundle(withoutGeneration, rawFiles), /generationId/);
  await assert.rejects(validateLookupBundle(null, rawFiles), /manifest/);
});

test("manifest.files phải đúng ba basename và đúng hex sha-256", async () => {
  const { rawFiles } = bundleFixture();
  const valid = manifestFor(rawFiles);

  const extra = { ...valid, files: { ...valid.files, "generation.json": sha256(encode({})) } };
  await assert.rejects(validateLookupBundle(extra, rawFiles), /generation\.json|files/);

  const missing = { ...valid, files: { ...valid.files } };
  delete missing.files["lookup-catalog.json"];
  await assert.rejects(validateLookupBundle(missing, rawFiles), /lookup-catalog\.json|files/);

  const notHex = { ...valid, files: { ...valid.files, "tactics.json": "sha256:" + valid.files["tactics.json"] } };
  await assert.rejects(validateLookupBundle(notHex, rawFiles), /tactics\.json/);

  const upper = { ...valid, files: { ...valid.files, "tactics.json": valid.files["tactics.json"].toUpperCase() } };
  await assert.rejects(validateLookupBundle(upper, rawFiles), /tactics\.json/);
});

test("generationId phải suy ra từ đúng bộ digest", async () => {
  const { rawFiles } = bundleFixture();
  const valid = manifestFor(rawFiles);

  await assert.rejects(
    validateLookupBundle({ ...valid, generationId: "lookup:" + "0".repeat(64) }, rawFiles),
    /generationId/,
  );
  await assert.rejects(
    validateLookupBundle({ ...valid, generationId: valid.generationId.slice("lookup:".length) }, rawFiles),
    /generationId/,
  );
});

test("rawFiles phải đúng ba basename và là Uint8Array", async () => {
  const { manifest, rawFiles } = bundleFixture();

  const missing = { ...rawFiles };
  delete missing["tactics.json"];
  await assert.rejects(validateLookupBundle(manifest, missing), /tactics\.json/);

  await assert.rejects(
    validateLookupBundle(manifest, { ...rawFiles, "generation.json": encode({}) }),
    /generation\.json/,
  );
  await assert.rejects(
    validateLookupBundle(manifest, { ...rawFiles, "tactics.json": JSON.stringify(tacticsDoc()) }),
    /tactics\.json/,
  );
});

test("bundle trộn hai generation bị từ chối dù digest tự nhất quán", async () => {
  // Generation B đổi ID chiến pháp; hero của generation A trỏ tactic:nhan-duc.
  const generationB = tacticsDoc().map((t) => ({ ...t, id: "tactic:nhan-duc-v2" }));
  const mixed = withRaw("tactics.json", generationB);
  await assert.rejects(validateLookupBundle(mixed.manifest, mixed.rawFiles), /tactic:nhan-duc/);

  // Manifest của generation B kèm bytes generation A -> lệch digest, không nhận một phần.
  const other = withRaw("lookup-catalog.json", catalogDoc({ advisors: [] }));
  const baseline = bundleFixture();
  await assert.rejects(validateLookupBundle(other.manifest, baseline.rawFiles), /lookup-catalog\.json/);
});

test("payload sai kiểu JSON bị từ chối", async () => {
  const heroesNotArray = withRaw("heroes-dict.json", { heroes: heroesDoc() });
  await assert.rejects(validateLookupBundle(heroesNotArray.manifest, heroesNotArray.rawFiles), /heroes-dict\.json/);

  const emptyTactics = withRaw("tactics.json", []);
  await assert.rejects(validateLookupBundle(emptyTactics.manifest, emptyTactics.rawFiles), /tactics\.json/);

  const brokenBytes = { ...bundleFixture().rawFiles, "lookup-catalog.json": encoder.encode("{not json") };
  await assert.rejects(validateLookupBundle(manifestFor(brokenBytes), brokenBytes), /lookup-catalog\.json/);
});

test("ID bản ghi phải đúng tiền tố và duy nhất", async () => {
  const noId = withRaw("heroes-dict.json", heroesDoc().map(({ id, ...rest }) => rest));
  await assert.rejects(validateLookupBundle(noId.manifest, noId.rawFiles), /id/);

  const wrongKind = withRaw("heroes-dict.json", heroesDoc().map((h) => ({ ...h, id: "tactic:luu-bi" })));
  await assert.rejects(validateLookupBundle(wrongKind.manifest, wrongKind.rawFiles), /hero:|tactic:luu-bi/);

  const duplicated = withRaw("tactics.json", [...tacticsDoc(), ...tacticsDoc()]);
  await assert.rejects(validateLookupBundle(duplicated.manifest, duplicated.rawFiles), /tactic:nhan-duc/);

  const duplicatedAcrossGroups = withRaw("lookup-catalog.json", catalogDoc({
    advisors: [
      { id: "advisor:an-phuc-binh-tam", nameVi: "A", elementVi: "Phong", heroIds: [], effectVi: "", tacticPoints: 1, usageVi: "", aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [] },
      { id: "advisor:an-phuc-binh-tam", nameVi: "B", elementVi: "Phong", heroIds: [], effectVi: "", tacticPoints: 1, usageVi: "", aliasesVi: [], aliasesZh: [], conditions: [], missingFields: [] },
    ],
  }));
  await assert.rejects(validateLookupBundle(duplicatedAcrossGroups.manifest, duplicatedAcrossGroups.rawFiles), /advisor:an-phuc-binh-tam/);
});

test("catalog phải đủ sáu khóa nhóm, không thừa không thiếu", async () => {
  const missingGroup = catalogDoc();
  delete missingGroup.buildings;
  const missing = withRaw("lookup-catalog.json", missingGroup);
  await assert.rejects(validateLookupBundle(missing.manifest, missing.rawFiles), /buildings/);

  const extraGroup = withRaw("lookup-catalog.json", catalogDoc({ books: [] }));
  await assert.rejects(validateLookupBundle(extraGroup.manifest, extraGroup.rawFiles), /books|lookup-catalog\.json/);

  const wrongSchema = withRaw("lookup-catalog.json", catalogDoc({ schemaVersion: 2 }));
  await assert.rejects(validateLookupBundle(wrongSchema.manifest, wrongSchema.rawFiles), /schemaVersion/);
});

test("tham chiếu chéo treo bị từ chối; parent rỗng hợp lệ vẫn được nhận", async () => {
  const danglingSelfTactic = withRaw("heroes-dict.json", heroesDoc().map((h) => ({
    ...h, lookup: { ...h.lookup, selfTacticId: "tactic:khong-ton-tai" },
  })));
  await assert.rejects(validateLookupBundle(danglingSelfTactic.manifest, danglingSelfTactic.rawFiles), /tactic:khong-ton-tai/);

  const danglingAdvisor = withRaw("heroes-dict.json", heroesDoc().map((h) => ({
    ...h, lookup: { ...h.lookup, advisorId: "advisor:khong-ton-tai" },
  })));
  await assert.rejects(validateLookupBundle(danglingAdvisor.manifest, danglingAdvisor.rawFiles), /advisor:khong-ton-tai/);

  const danglingAdvisorHero = withRaw("lookup-catalog.json", catalogDoc({
    advisors: catalogDoc().advisors.map((a) => ({ ...a, heroIds: ["hero:khong-ton-tai"] })),
  }));
  await assert.rejects(validateLookupBundle(danglingAdvisorHero.manifest, danglingAdvisorHero.rawFiles), /hero:khong-ton-tai/);

  const danglingParent = withRaw("lookup-catalog.json", catalogDoc({
    specials: catalogDoc().specials.map((s) => ({ ...s, equipmentId: s.equipmentId && "equipment:khong-ton-tai" })),
  }));
  await assert.rejects(validateLookupBundle(danglingParent.manifest, danglingParent.rawFiles), /equipment:khong-ton-tai/);

  const danglingExclusive = withRaw("lookup-catalog.json", catalogDoc({
    specials: catalogDoc().specials.map((s) => ({ ...s, exclusiveHeroId: s.exclusiveHeroId && "hero:khong-ton-tai" })),
  }));
  await assert.rejects(validateLookupBundle(danglingExclusive.manifest, danglingExclusive.rawFiles), /hero:khong-ton-tai/);

  // Trang bị đặc biệt chưa biết trang bị cha (equipmentId null) là dữ liệu hợp lệ.
  const orphansOnly = withRaw("lookup-catalog.json", catalogDoc({
    specials: catalogDoc().specials.map((s) => ({ ...s, equipmentId: null, exclusiveHeroId: null })),
  }));
  const accepted = await validateLookupBundle(orphansOnly.manifest, orphansOnly.rawFiles);
  assert.equal(accepted.catalog.specials.length, 2);
});

test("con của troop mod và building phải là mảng có ID/level dùng được", async () => {
  const noOptions = withRaw("lookup-catalog.json", catalogDoc({
    troopMods: catalogDoc().troopMods.map(({ options, ...rest }) => rest),
  }));
  await assert.rejects(validateLookupBundle(noOptions.manifest, noOptions.rawFiles), /options|troop-mod:dan-duong-binh/);

  const badLevel = withRaw("lookup-catalog.json", catalogDoc({
    buildings: catalogDoc().buildings.map((b) => ({ ...b, levels: b.levels.map((l) => ({ ...l, level: "1" })) })),
  }));
  await assert.rejects(validateLookupBundle(badLevel.manifest, badLevel.rawFiles), /level|building:bat-tran-do/);
});

test("nested DTO sai shape bị từ chối trước khi tới profile renderer", async () => {
  const malformedHero = heroesDoc().map((hero) => ({
    ...hero,
    lookup: { ...hero.lookup, revisions: { length: 1 } },
  }));
  const heroBundle = withRaw("heroes-dict.json", malformedHero);
  await assert.rejects(validateLookupBundle(heroBundle.manifest, heroBundle.rawFiles), /revisions|hero:luu-bi/);

  const malformedTactic = tacticsDoc().map((tactic) => ({
    ...tactic,
    lookup: { ...tactic.lookup, activationRate: {} },
  }));
  const tacticBundle = withRaw("tactics.json", malformedTactic);
  await assert.rejects(validateLookupBundle(tacticBundle.manifest, tacticBundle.rawFiles), /activationRate|tactic:nhan-duc/);

  const malformedCatalog = catalogDoc({
    buildings: catalogDoc().buildings.map((building) => ({
      ...building,
      levels: building.levels.map((level) => ({ ...level, costs: { wood: "32000", stone: 32000, iron: 16000 } })),
    })),
  });
  const catalogBundle = withRaw("lookup-catalog.json", malformedCatalog);
  await assert.rejects(validateLookupBundle(catalogBundle.manifest, catalogBundle.rawFiles), /costs|building:bat-tran-do/);
});

function fetchFnFor(source = bundleFixture()) {
  const calls = [];
  const payloads = {
    [MANIFEST_NAME]: encode(source.manifest),
    ...source.rawFiles,
  };
  const fetchFn = async (name) => {
    calls.push(name);
    if (!(name in payloads)) throw new Error(`./data/${name}: 404`);
    return payloads[name];
  };
  return { fetchFn, calls, source, payloads };
}

test("loadLookupBundle yêu cầu đúng manifest + ba payload, mỗi tên đúng một lần", async () => {
  const { fetchFn, calls, source } = fetchFnFor();
  const bundle = await loadLookupBundle(fetchFn);

  assert.deepEqual([...calls].sort(), [MANIFEST_NAME, ...PAYLOAD_NAMES].sort());
  assert.equal(calls.length, new Set(calls).size, "không được tải trùng một file");
  assert.deepEqual(bundle.manifest, source.manifest);
  assert.deepEqual(bundle.heroes.map((h) => h.id), ["hero:luu-bi"]);
});

test("loadLookupBundle giữ nguyên bytes của fetchFn để season dùng chung", async () => {
  const { fetchFn, payloads } = fetchFnFor();
  const bundle = await loadLookupBundle(fetchFn);
  for (const name of PAYLOAD_NAMES) {
    assert.equal(bundle.rawFiles[name], payloads[name], `${name} phải là chính bytes đã tải`);
  }
});

test("hai lần gọi đồng thời dùng chung một request cache", async () => {
  const { fetchFn, calls } = fetchFnFor();
  const [first, second] = await Promise.all([loadLookupBundle(fetchFn), loadLookupBundle(fetchFn)]);

  assert.equal(first, second, "cùng fetchFn phải trả cùng bundle đã verify");
  assert.deepEqual([...calls].sort(), [MANIFEST_NAME, ...PAYLOAD_NAMES].sort());
});

test("lỗi tải được đẩy nguyên vẹn cho caller, không nuốt và không trả bundle một phần", async () => {
  const failure = new Error("./data/tactics.json: 503 sentinel");
  const { payloads } = fetchFnFor();
  let attempts = 0;
  const fetchFn = async (name) => {
    if (name === "tactics.json") { attempts += 1; throw failure; }
    return payloads[name];
  };

  const caught = await loadLookupBundle(fetchFn).then(() => null, (err) => err);
  assert.equal(caught, failure);
  assert.equal(attempts >= 1, true);

  // Lần thất bại không được cache thành công/hỏng vĩnh viễn: gọi lại phải thử lại.
  await assert.rejects(loadLookupBundle(fetchFn), /sentinel/);
  assert.equal(attempts >= 2, true);
});

test("manifest hỏng hoặc payload lệch làm loadLookupBundle fail, không fallback dữ liệu cũ", async () => {
  const { payloads } = fetchFnFor();
  const manifestMissing = async (name) => {
    if (name === MANIFEST_NAME) throw new Error("./data/lookup-manifest.json: 404");
    return payloads[name];
  };
  await assert.rejects(loadLookupBundle(manifestMissing), /lookup-manifest\.json/);

  const drifted = async (name) => {
    if (name === "heroes-dict.json") return encode(heroesDoc([{ ...heroesDoc()[0], id: "hero:khac" }]));
    return payloads[name];
  };
  await assert.rejects(loadLookupBundle(drifted), /heroes-dict\.json/);
});
