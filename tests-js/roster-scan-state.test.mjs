import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  createInitialRosterScanState,
  lockedConstraints,
  removeItem,
  serializeRosterScanState,
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

test("lockedConstraints flattens locked team heroes and tactics", () => {
  const state = applyScanResult(createInitialRosterScanState(), "builtTeams", {
    teams: [{ teamName: "Team cũ", heroes: ["Trình Phổ"], tactics: ["An Ủi Quân Dân"] }],
  });

  assert.deepEqual(lockedConstraints(state), {
    heroes: ["Trình Phổ"],
    tactics: ["An Ủi Quân Dân"],
  });
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
