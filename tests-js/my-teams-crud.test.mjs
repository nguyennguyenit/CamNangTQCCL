import { test } from "node:test";
import assert from "node:assert/strict";
import { createMyTeamsApi } from "../js/my-teams-api.js";
import { fromRecommended } from "../js/my-teams-sources.js";
import { ids, recommendedById } from "./support/my-teams-fixtures.mjs";
import { createRosterServer, eventTarget, fakeLocks, fakeTimers } from "./support/roster-fake-server.mjs";

const NOW = Date.UTC(2026, 9, 21, 8, 0, 0);
const draftOf = (id) => fromRecommended(recommendedById("s27-han-hanshi-gong-1"), ids, { id }).draft;

async function open() {
  const server = await createRosterServer({ userId: "u-alice" });
  let clock = NOW;
  const api = createMyTeamsApi({
    api: server.api,
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

test("hộp: tạo gửi kèm hai nhóm mặc định, đổi tên, xóa; hộp main không xóa được", async () => {
  const { server, api } = await open();
  const created = await api.createBox("  Hộp phụ  ");
  assert.equal(created.ok, true);
  assert.match(created.boxId, /^box-[a-z0-9]+$/u);
  assert.deepEqual(server.live("group").filter((row) => row.boxId === created.boxId).map((row) => row.id).sort(), [`${created.boxId}~ghep-team`, `${created.boxId}~khai-hoang`]);
  assert.equal(server.live("box").find((row) => row.id === created.boxId).data.name, "Hộp phụ");

  assert.deepEqual((await api.renameBox(created.boxId, "Hộp B")).ok, true);
  assert.equal(server.live("box").find((row) => row.id === created.boxId).data.name, "Hộp B");
  assert.equal((await api.createBox("   ")).code, "validation", "tên trống bị chặn, không gọi mạng thêm");

  assert.deepEqual(await api.deleteBox("main"), { ok: false, rejected: true, code: "default_protected" });
  assert.equal((await api.deleteBox(created.boxId)).ok, true);
  assert.equal(server.live("box").some((row) => row.id === created.boxId), false);
  assert.equal(api.snapshot().boxes.some((box) => box.id === created.boxId), false);
});

test("nhóm: thêm nối đuôi, đổi tên, nhóm mặc định không xóa/đổi tên; xóa nhóm chuyển đội về Ghép Team", async () => {
  const { server, api } = await open();
  await api.ensureBoxDefaults("main");
  const group = await api.createGroup("main", "Đội công thành");
  assert.equal(group.ok, true);
  assert.match(group.groupId, /^grp-[a-z0-9]+$/u);
  assert.equal(server.live("group").find((row) => row.id === group.groupId).data.order, 2);
  assert.equal((await api.renameGroup(group.groupId, "Công thành")).ok, true);
  assert.equal((await api.renameGroup("main~ghep-team", "Khác")).code, "default_protected");
  assert.equal((await api.deleteGroup("main~khai-hoang")).code, "default_protected");

  const saved = await api.saveTeam(draftOf("team-in-group"), { boxId: "main", groupId: group.groupId });
  assert.equal(saved.ok, true);
  assert.equal((await api.deleteGroup(group.groupId)).ok, true);
  assert.equal(server.live("group").some((row) => row.id === group.groupId), false);
  assert.equal(server.live("team")[0].data.groupId, "main~ghep-team", "đội về Ghép Team cả trên server lẫn trong bộ nhớ đệm");
  assert.equal(api.snapshot().teams[0].groupId, "main~ghep-team");
});

test("đội: chuyển nhóm cùng hộp, xóa; nhóm không tồn tại bị từ chối", async () => {
  const { server, api } = await open();
  await api.saveTeam(draftOf("team-a"), { boxId: "main" });
  assert.equal(server.live("team")[0].data.groupId, "main~ghep-team");
  assert.equal((await api.moveTeam("team-a", "main~khai-hoang")).ok, true);
  assert.equal(server.live("team")[0].data.groupId, "main~khai-hoang");
  assert.equal((await api.moveTeam("team-a", "grp-khong-co")).code, "group_missing");
  assert.equal((await api.moveTeam("team-khong-co", "main~khai-hoang")).code, "not_found");
  assert.equal((await api.deleteTeam("team-a")).ok, true);
  assert.equal(server.live("team").length, 0);
  assert.equal(api.snapshot().teams.length, 0);
  assert.equal((await api.deleteTeam("team-a")).code, "not_found");
});

test("xóa nhóm có đội: mọi bản ghi trong lần đẩy đều applied (server chuyển đội trước, bản đội của client mới hơn mốc xóa)", async () => {
  const { server, api } = await open();
  await api.ensureBoxDefaults("main");
  const group = await api.createGroup("main", "Nhóm tạm");
  await api.saveTeam(draftOf("team-x"), { boxId: "main", groupId: group.groupId });
  await api.saveTeam(draftOf("team-y"), { boxId: "main", groupId: group.groupId });
  const before = server.calls.length;
  const deleted = await api.deleteGroup(group.groupId);
  assert.deepEqual(deleted, { ok: true });
  const posts = server.calls.slice(before).filter((call) => call.method === "POST");
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].json.records.map((record) => record.kind), ["group", "team", "team"], "nhóm xóa đi trước đội");
  assert.deepEqual(api.snapshot().rejected, []);
  assert.deepEqual(server.live("team").map((row) => row.data.groupId), ["main~ghep-team", "main~ghep-team"]);
  assert.deepEqual(api.snapshot().teams.map((team) => team.groupId), ["main~ghep-team", "main~ghep-team"]);
});

test("máy chủ giả đúng hợp đồng: đội vào nhóm đã xóa → group_missing; đội của hộp đã xóa → box_missing", async () => {
  const { server, api } = await open();
  await api.ensureBoxDefaults("main");
  const group = await api.createGroup("main", "Nhóm tạm");
  await api.deleteGroup(group.groupId);
  assert.equal((await api.saveTeam(draftOf("team-z"), { boxId: "main", groupId: group.groupId })).code, "group_missing");

  const box = await api.createBox("Hộp phụ");
  assert.equal((await api.saveTeam(draftOf("team-w"), { boxId: box.boxId })).ok, true);
  const sent = server.calls.filter((call) => call.method === "POST").flatMap((call) => call.json.records).find((record) => record.kind === "team" && record.id === "team-w");
  const boxRow = server.rows.get(`box:${box.boxId}`);
  const stamp = boxRow.updatedAt + 10;
  const iso = new Date(stamp).toISOString();
  await server.seed({ kind: "box", id: box.boxId, updatedAt: stamp, deleted: true, data: { id: box.boxId, updatedAt: iso, deletedAt: iso, boxId: box.boxId } });
  server.rows.delete("team:team-w");
  const replay = await server.api("/api/roster", { method: "POST", json: { expectedUserId: "u-alice", records: [sent] } });
  assert.deepEqual([replay.results[0].outcome, replay.results[0].code], ["rejected", "box_missing"]);
});

test("L6. hộp bị xóa từ máy khác ngay trước lần lưu: saveTeam không báo thành công (đội đã bị dọn khỏi bộ nhớ đệm)", async () => {
  const { server, api } = await open();
  await api.ensureBoxDefaults("main");
  const box = await api.createBox("Hộp phụ");
  const stamp = server.rows.get(`box:${box.boxId}`).updatedAt + 1_000;
  const iso = new Date(stamp).toISOString();
  await server.seed({ kind: "box", id: box.boxId, updatedAt: stamp, deleted: true, data: { id: box.boxId, updatedAt: iso, deletedAt: iso, boxId: box.boxId } });
  const result = await api.saveTeam(draftOf("team-l6"), { boxId: box.boxId });
  assert.equal(result.ok, false);
  assert.equal(result.code, "box_missing");
  assert.equal(server.live("team").length, 0);
});

test("L7. hộp thoại lưu (kinds box,group) chỉ kéo hộp + nhóm, vẫn lưu được đội", async () => {
  const server = await createRosterServer({ userId: "u-alice" });
  const { SAVE_DIALOG_KINDS } = await import("../js/my-teams-api.js");
  const api = createMyTeamsApi({
    api: server.api,
    kinds: SAVE_DIALOG_KINDS,
    loadSession: async () => ({ id: "u-alice", name: "Alice" }),
    signIn: async () => {},
    locks: fakeLocks(),
    timers: fakeTimers(),
    doc: eventTarget({ visibilityState: "visible" }),
    win: eventTarget(),
    now: () => NOW,
  });
  await api.load();
  assert.match(server.calls.find((call) => call.method === "GET").path, /kinds=box(%2C|,)group$/u);
  assert.equal((await api.saveTeam(draftOf("team-l7"), { boxId: "main" })).ok, true);
  assert.equal(server.live("team").length, 1);
});
