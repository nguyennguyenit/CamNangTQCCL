import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LOCKED_TEAMS,
  MAX_TACTIC_OVERRIDES,
  ROSTER_SCAN_STORAGE_KEY,
  addCanonicalItem,
  applyScanResult,
  createInitialRosterScanState,
  clearRosterScanState,
  deserializeRosterScanState,
  removeItem,
  serializeRosterScanState,
  setTacticOverride,
  tacticOverrideBlocked,
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

test("at the cap a new substitute is refused and reported, nothing is dropped silently", () => {
  let state = createInitialRosterScanState();
  for (let i = 0; i < MAX_TACTIC_OVERRIDES; i++) {
    assert.equal(tacticOverrideBlocked(state, { teamId: `t${i}`, heroIndex: 0, slotIndex: 0 }), false);
    state = setTacticOverride(state, { teamId: `t${i}`, heroIndex: 0, slotIndex: 0, tactic: "CP" });
  }
  assert.equal(MAX_TACTIC_OVERRIDES, 20);
  // Món thứ 21 cho ô mới: bị chặn, báo được, và không có lựa chọn nào mất.
  const next = { teamId: "newest", heroIndex: 0, slotIndex: 0 };
  assert.equal(tacticOverrideBlocked(state, next), true);
  const after = setTacticOverride(state, { ...next, tactic: "CP" });
  assert.equal(after, state);
  const ids = serializeRosterScanState(after).tacticOverrides.map((o) => o.teamId);
  assert.equal(ids.length, 20);
  assert.equal(ids.includes("newest"), false);
  assert.equal(ids.includes("t0"), true);
  // Đổi món của ô đã có và bỏ món vẫn được khi đầy.
  assert.equal(tacticOverrideBlocked(state, { teamId: "t3", heroIndex: 0, slotIndex: 0 }), false);
  const changed = setTacticOverride(state, { teamId: "t3", heroIndex: 0, slotIndex: 0, tactic: "CP khác" });
  assert.equal(changed.tacticOverrides.length, 20);
  assert.equal(changed.tacticOverrides.find((o) => o.teamId === "t3").tactic, "CP khác");
  const freed = setTacticOverride(state, { teamId: "t0", heroIndex: 0, slotIndex: 0, tactic: null });
  assert.equal(tacticOverrideBlocked(freed, next), false);
  assert.equal(setTacticOverride(freed, { ...next, tactic: "CP" }).tacticOverrides.at(-1).teamId, "newest");
});

test("21 stored substitutes (tampered storage) keep the oldest 20 deterministically", () => {
  const tacticOverrides = Array.from({ length: 21 }, (_, i) => ({ teamId: `t${i}`, heroIndex: 0, slotIndex: 0, tactic: "CP" }));
  const ids = deserializeRosterScanState(JSON.stringify({ tacticOverrides })).tacticOverrides.map((o) => o.teamId);
  assert.equal(ids.length, 20);
  assert.equal(ids.at(-1), "t19");
});

test("the chosen season is remembered with the roster, and junk values are dropped", () => {
  const saved = JSON.stringify(serializeRosterScanState({ ...createInitialRosterScanState(), seasonId: "pk-s28" }));
  assert.equal(deserializeRosterScanState(saved).seasonId, "pk-s28");
  assert.equal(applyScanResult(deserializeRosterScanState(saved), "heroes", { heroes: [] }).seasonId, "pk-s28");
  for (const seasonId of ["", 42, "x".repeat(200), null]) {
    assert.equal(serializeRosterScanState({ seasonId }).seasonId, null);
  }
});

test("each successful read counts one image per type and keeps the latest read time; junk is dropped", () => {
  let state = applyScanResult(createInitialRosterScanState(), "heroes", { heroes: [{ name: "Mã Siêu" }] });
  state = applyScanResult(state, "heroes", { heroes: [] });
  const heroesReadAt = state.updatedAt;
  state = applyScanResult(state, "builtTeams", { teams: [] });
  const saved = deserializeRosterScanState(JSON.stringify(state));
  assert.equal(saved.scans.heroes.images, 2);
  assert.equal(saved.scans.heroes.at, heroesReadAt);
  assert.equal(saved.scans.builtTeams.at, state.updatedAt);
  assert.equal(saved.scans.builtTeams.images, 1);
  assert.equal(saved.scans.tactics, undefined);
  // Xoá chip không phải lượt đọc ảnh: số ảnh giữ nguyên.
  assert.equal(removeItem(saved, "heroes", "Mã Siêu").scans.heroes.images, 2);
  assert.deepEqual(clearRosterScanState().scans, {});
  const junk = serializeRosterScanState({ scans: {
    heroes: { images: 0, at: "2026-10-05T00:00:00.000Z" },
    tactics: { images: 2, at: "not a date" },
    builtTeams: { images: 1.5, at: "2026-10-05T00:00:00.000Z" },
    other: { images: 1, at: "2026-10-05T00:00:00.000Z" },
  } });
  assert.deepEqual(junk.scans, {});
});

test("18. lockedTeams tối đa MAX_LOCKED_TEAMS: bản cũ nhất bị loại và báo qua droppedLockedTeams", () => {
  assert.equal(MAX_LOCKED_TEAMS, 30);
  const teams = (from, to) => Array.from({ length: to - from }, (_, i) => ({ teamName: `Đội ${from + i}`, heroes: [`Tướng ${from + i}`], tactics: [`Chiến pháp ${from + i}`] }));
  let state = applyScanResult(createInitialRosterScanState(), "builtTeams", { teams: teams(0, 30) });
  assert.equal(state.lockedTeams.length, 30);
  assert.equal(state.droppedLockedTeams, 0);

  state = applyScanResult(state, "builtTeams", { teams: teams(30, 33) });
  assert.equal(state.lockedTeams.length, 30);
  assert.equal(state.droppedLockedTeams, 3);
  assert.deepEqual(state.lockedTeams.map((team) => team.teamName).slice(0, 2), ["Đội 3", "Đội 4"]);
  assert.equal(state.lockedTeams.at(-1).teamName, "Đội 32");

  // L8: trần chỉ áp khi THÊM; nạp/lưu dữ liệu đã có quá 30 (khách cũ, hộp cloud gộp nhiều máy) không cắt im lặng.
  const serialized = serializeRosterScanState({ ...state, lockedTeams: teams(0, 40) });
  assert.equal("droppedLockedTeams" in serialized, false);
  assert.equal(serialized.lockedTeams.length, 40);
  assert.equal(deserializeRosterScanState(JSON.stringify({ lockedTeams: teams(0, 40) })).lockedTeams.length, 40);
  const added = applyScanResult(serialized, "builtTeams", { teams: teams(40, 41) });
  assert.equal(added.lockedTeams.length, 30, "thêm đội thì áp trần");
  assert.equal(added.droppedLockedTeams, 11);
});
