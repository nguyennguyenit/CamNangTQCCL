import { test } from "node:test";
import assert from "node:assert/strict";
import { createMyTeamsApi } from "../js/my-teams-api.js";
import { fromRecommended } from "../js/my-teams-sources.js";
import { ids, recommendedById } from "./support/my-teams-fixtures.mjs";
import { createRosterServer, eventTarget, fakeLocks, fakeTimers } from "./support/roster-fake-server.mjs";

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const draftOf = (id) => fromRecommended(recommendedById("s27-han-hanshi-gong-1"), ids, { id }).draft;
const teamPosts = (server, id) =>
  server.calls.filter((call) => call.method === "POST").flatMap((call) => call.json.records).filter((record) => record.kind === "team" && record.id === id);

async function open({ beforePost } = {}) {
  const server = await createRosterServer({ userId: "u-alice" });
  let clock = NOW;
  const api = createMyTeamsApi({
    api: async (path, options) => {
      if (options?.method === "POST" && beforePost) await beforePost();
      return server.api(path, options);
    },
    loadSession: async () => ({ id: "u-alice", name: "Alice" }),
    signIn: async () => {},
    locks: fakeLocks(),
    timers: fakeTimers(),
    doc: eventTarget({ visibilityState: "visible" }),
    win: eventTarget(),
    now: () => (clock += 1),
  });
  await api.load();
  return { server, api };
}

test("H1. đội bị server từ chối: thử lại cùng bản nháp gửi lại và chỉ báo thành công khi server đã nhận", async () => {
  const { server, api } = await open();
  server.rejectNext("team", "team-h1", "cap");
  const first = await api.saveTeam(draftOf("team-h1"));
  assert.deepEqual({ ok: first.ok, rejected: first.rejected, code: first.code }, { ok: false, rejected: true, code: "cap" });
  assert.equal(server.live("team").length, 0);

  const retry = await api.saveTeam(draftOf("team-h1"));
  assert.equal(retry.ok, true);
  assert.equal(retry.outcome, "applied", "không phải already-applied giả");
  assert.equal(server.live("team").length, 1);
  assert.equal(teamPosts(server, "team-h1").length, 2, "bản đội được POST lại");
});

test("H1b. bị từ chối hai lần: lần thử lại báo rejected lần nữa, server vẫn không có đội", async () => {
  const { server, api } = await open();
  server.rejectNext("team", "team-h1b", "quota", 2);
  assert.equal((await api.saveTeam(draftOf("team-h1b"))).code, "quota");
  const retry = await api.saveTeam(draftOf("team-h1b"));
  assert.deepEqual({ ok: retry.ok, rejected: retry.rejected, code: retry.code }, { ok: false, rejected: true, code: "quota" });
  assert.equal(server.live("team").length, 0);
  assert.equal((await api.saveTeam(draftOf("team-h1b"))).ok, true, "server hết từ chối thì lần sau thành công");
  assert.equal(server.live("team").length, 1);
});

test("H1c. hộp main bị từ chối khi tạo: lần lưu sau dựng lại hộp main và đội", async () => {
  const { server, api } = await open();
  server.rejectNext("box", "main", "cap");
  const first = await api.saveTeam(draftOf("team-h1c"));
  assert.equal(first.ok, false);
  assert.equal(server.live("box").length, 0);

  const retry = await api.saveTeam(draftOf("team-h1c"));
  assert.equal(retry.ok, true);
  assert.deepEqual(server.live("box").map((row) => row.id), ["main"]);
  assert.equal(server.live("team").length, 1);
});

test("H1d. đổi tên hộp bị từ chối rồi thử lại cùng tên: gửi lại thật, không báo thành công giả", async () => {
  const { server, api } = await open();
  await api.ensureBoxDefaults("main");
  await api.sync.syncNow();
  server.rejectNext("box", "main", "quota");
  const first = await api.renameBox("main", "Hộp mới");
  assert.deepEqual({ ok: first.ok, code: first.code }, { ok: false, code: "quota" });
  assert.notEqual(server.live("box")[0].data.name, "Hộp mới");

  assert.equal((await api.renameBox("main", "Hộp mới")).ok, true);
  assert.equal(server.live("box")[0].data.name, "Hộp mới");
});

test("L3. xóa hộp bị server trả conflict (máy khác sửa hộp giữa lần kéo và lần đẩy): lần kéo sau lấy lại các đội con", async () => {
  let hook = async () => {};
  const { server, api } = await open({ beforePost: () => hook() });
  await api.ensureBoxDefaults("main");
  const box = await api.createBox("Hộp phụ");
  assert.equal((await api.saveTeam(draftOf("team-l3"), { boxId: box.boxId })).ok, true);

  hook = async () => {
    hook = async () => {};
    const stamp = server.rows.get(`box:${box.boxId}`).updatedAt + 1_000_000;
    const iso = new Date(stamp).toISOString();
    await server.seed({ kind: "box", id: box.boxId, updatedAt: stamp, deleted: false, data: { id: box.boxId, name: "Hộp phụ (máy khác)", updatedAt: iso, deletedAt: "" } });
  };
  const deleted = await api.deleteBox(box.boxId);
  assert.deepEqual({ ok: deleted.ok, code: deleted.code }, { ok: false, code: "conflict" });
  assert.equal(api.snapshot().boxes.some((item) => item.id === box.boxId), true, "hộp được khôi phục theo server");

  await api.sync.syncNow();
  assert.deepEqual(api.snapshot().teams.map((team) => team.id), ["team-l3"], "đội con được kéo lại, không mất vĩnh viễn");
});
