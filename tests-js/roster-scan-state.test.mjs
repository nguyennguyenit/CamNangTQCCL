import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  createInitialRosterScanState,
  clearRosterScanState,
  deserializeRosterScanState,
  removeItem,
  serializeRosterScanState,
  setTacticOverride,
} from "../js/roster-scan-state.js";

test("storage key is stable", () => {
  assert.equal(ROSTER_SCAN_STORAGE_KEY, "tqccl.rosterRecommend.scanState.v1");
});

test("applyScanResult merges heroes tactics and built teams", () => {
  let state = { ...createInitialRosterScanState(), confirmed: true };
  state = applyScanResult(state, "heroes", { heroes: [{ name: "Mã Siêu", confidence: "high", redStars: 3 }] });
  state = applyScanResult(state, "tactics", { tactics: [{ name: "Đương Phong Thôi Quyết", confidence: "high" }] });
  state = applyScanResult(state, "builtTeams", {
    teams: [{ teamName: "Team cũ", heroes: ["Trình Phổ"], tactics: ["An Ủi Quân Dân"] }],
  });

  assert.deepEqual(state.ownedHeroes.map((h) => h.name), ["Mã Siêu"]);
  assert.deepEqual(state.ownedTactics.map((t) => t.name), ["Đương Phong Thôi Quyết"]);
  assert.equal(state.lockedTeams[0].teamName, "Team cũ");
  assert.equal(state.confirmed, false);
});

test("remove and add canonical items", () => {
  let state = applyScanResult(createInitialRosterScanState(), "heroes", { heroes: [{ name: "Mã Siêu" }] });
  state = addCanonicalItem(state, "heroes", "SP Quách Gia");
  state = removeItem(state, "heroes", "Mã Siêu");

  assert.deepEqual(state.ownedHeroes.map((h) => h.name), ["SP Quách Gia"]);
});

test("serialize strips image and token fields", () => {
  const state = {
    ...createInitialRosterScanState(),
    image: "blob",
    imageDataUrl: "data:image/png;base64,abc",
    base64: "abc",
    turnstileToken: "secret-token",
    ownedHeroes: [
      {
        name: "Mã Siêu",
        imageDataUrl: "data:image/png;base64,def",
        screenshotPath: "/tmp/private.png",
        imageBytes: [1, 2, 3],
        apiToken: "private-api-token",
      },
    ],
  };
  const serialized = serializeRosterScanState(state);
  const text = JSON.stringify(serialized);

  assert.equal(text.includes("base64"), false);
  assert.equal(text.includes("data:image"), false);
  assert.equal(text.includes("secret-token"), false);
  assert.equal(text.includes("/tmp/private.png"), false);
  assert.equal(text.includes("private-api-token"), false);
  assert.equal(text.includes("imageBytes"), false);
  assert.deepEqual(serialized.ownedHeroes, [{ name: "Mã Siêu" }]);
});

test("dedupe theo canonical ID giữ mọi evidence ordinal và numeric max", () => {
  let state = createInitialRosterScanState();
  state = applyScanResult(state, "heroes", {
    heroes: [
      {
        name: "SP Mã Siêu",
        canonicalId: "hero:sp-ma-sieu",
        redStars: 2,
        level: 45,
        evidence: [{ imageOrdinal: 1, sourceScope: "priorConfirmedNote" }],
      },
      {
        name: "SP Mã Siêu",
        canonicalId: "hero:sp-ma-sieu",
        redStars: 4,
        level: 50,
        evidence: [{ imageOrdinal: 3, sourceScope: "currentTurnImage" }],
      },
    ],
  });

  assert.equal(state.ownedHeroes.length, 1);
  assert.equal(state.ownedHeroes[0].redStars, 4);
  assert.equal(state.ownedHeroes[0].level, 50);
  assert.deepEqual(
    state.ownedHeroes[0].evidence.map(({ imageOrdinal }) => imageOrdinal),
    [1, 3],
  );
  assert.equal(state.confirmed, false);
});

test("base và SP cùng family không bị dedupe thành một hero", () => {
  const state = applyScanResult(createInitialRosterScanState(), "heroes", {
    heroes: [
      { name: "Mã Siêu", canonicalId: "hero:ma-sieu", familyId: "hero-family:ma-sieu" },
      { name: "SP Mã Siêu", canonicalId: "hero:sp-ma-sieu", familyId: "hero-family:ma-sieu" },
    ],
  });

  assert.deepEqual(
    state.ownedHeroes.map(({ canonicalId }) => canonicalId),
    ["hero:ma-sieu", "hero:sp-ma-sieu"],
  );
});

test("serialize loại secret lồng trong evidence nhưng giữ provenance an toàn", () => {
  const serialized = serializeRosterScanState({
    ...createInitialRosterScanState(),
    ownedHeroes: [
      {
        name: "Mã Siêu",
        canonicalId: "hero:ma-sieu",
        evidence: [
          {
            imageOrdinal: 1,
            sourceScope: "currentTurnImage",
            token: "khong-duoc-giu",
          },
        ],
      },
    ],
  });
  const text = JSON.stringify(serialized);

  assert.equal(text.includes("khong-duoc-giu"), false);
  assert.equal(serialized.ownedHeroes[0].evidence[0].sourceScope, "currentTurnImage");
});

test("đọc lại cùng ảnh đội đã xây không nhân đôi đội khóa (thứ tự tướng/chiến pháp không quan trọng)", () => {
  const scan = { teams: [{ teamName: "Đội Thục", heroes: ["Lưu Bị", "Quan Vũ"], tactics: ["Nhân Đức", "Uy Chấn"] }] };
  let state = applyScanResult(createInitialRosterScanState(), "builtTeams", scan);
  state = applyScanResult(state, "builtTeams", scan);
  assert.equal(state.lockedTeams.length, 1);
  state = applyScanResult(state, "builtTeams", { teams: [{ teamName: "Đội Thục (đọc lại)", heroes: ["Quan Vũ", "Lưu Bị"], tactics: ["Uy Chấn", "Nhân Đức"] }] });
  assert.equal(state.lockedTeams.length, 1);
  assert.equal(serializeRosterScanState({ lockedTeams: [...scan.teams, ...scan.teams] }).lockedTeams.length, 1);
});

test("chosen substitutes persist per slot, survive scans and are cleared with the roster", () => {
  let state = createInitialRosterScanState();
  state = setTacticOverride(state, { teamId: "cfg-1", heroIndex: 0, slotIndex: 1, tactic: "CP A" });
  state = setTacticOverride(state, { teamId: "cfg-1", heroIndex: 0, slotIndex: 1, tactic: "CP B" });
  state = setTacticOverride(state, { teamId: "cfg-2", heroIndex: 2, slotIndex: 0, tactic: "CP C" });
  assert.deepEqual(state.tacticOverrides, [
    { teamId: "cfg-1", heroIndex: 0, slotIndex: 1, tactic: "CP B" },
    { teamId: "cfg-2", heroIndex: 2, slotIndex: 0, tactic: "CP C" },
  ]);
  const saved = JSON.stringify(serializeRosterScanState(state));
  state = applyScanResult(deserializeRosterScanState(saved), "tactics", { tactics: [{ name: "CP D" }] });
  assert.equal(state.tacticOverrides.length, 2);
  state = setTacticOverride(state, { teamId: "cfg-2", heroIndex: 2, slotIndex: 0, tactic: null });
  assert.deepEqual(state.tacticOverrides.map((o) => o.teamId), ["cfg-1"]);
  assert.deepEqual(clearRosterScanState().tacticOverrides, []);
});

test("malformed stored substitutes are dropped, extra keys stripped", () => {
  const stored = {
    tacticOverrides: [
      { teamId: "ok", heroIndex: 1, slotIndex: 0, tactic: "CP", image: "data:..." },
      { teamId: "", heroIndex: 0, slotIndex: 0, tactic: "CP" },
      { teamId: "bad-index", heroIndex: -1, slotIndex: 0, tactic: "CP" },
      { teamId: "bad-slot", heroIndex: 0, slotIndex: 1.5, tactic: "CP" },
      { teamId: "no-tactic", heroIndex: 0, slotIndex: 0, tactic: "" },
      "junk",
    ],
  };
  const { tacticOverrides } = deserializeRosterScanState(JSON.stringify(stored));
  assert.deepEqual(tacticOverrides, [{ teamId: "ok", heroIndex: 1, slotIndex: 0, tactic: "CP" }]);
});

test("at the cap the oldest substitute is dropped so the newest choice always sticks", () => {
  let state = createInitialRosterScanState();
  for (let i = 0; i < 20; i++) state = setTacticOverride(state, { teamId: `t${i}`, heroIndex: 0, slotIndex: 0, tactic: "CP" });
  state = setTacticOverride(state, { teamId: "newest", heroIndex: 0, slotIndex: 0, tactic: "CP" });
  const ids = serializeRosterScanState(state).tacticOverrides.map((o) => o.teamId);
  assert.equal(ids.length, 20);
  assert.equal(ids.at(-1), "newest");
  assert.equal(ids.includes("t0"), false);
});

test("the chosen season is remembered with the roster, and junk values are dropped", () => {
  const saved = JSON.stringify(serializeRosterScanState({ ...createInitialRosterScanState(), seasonId: "pk-s28" }));
  assert.equal(deserializeRosterScanState(saved).seasonId, "pk-s28");
  assert.equal(applyScanResult(deserializeRosterScanState(saved), "heroes", { heroes: [] }).seasonId, "pk-s28");
  for (const seasonId of ["", 42, "x".repeat(200), null]) {
    assert.equal(serializeRosterScanState({ seasonId }).seasonId, null);
  }
});
