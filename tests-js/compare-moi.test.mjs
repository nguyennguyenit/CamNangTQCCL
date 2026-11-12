// Công cụ so ảnh 28 artboard Thiết kế mới (scripts/design-canvas/compare-moi.mjs): phần không cần trình duyệt —
// tham số dòng lệnh, kiểm hình dạng cặp, nạp cặp theo nhóm, trạng thái mock — và khung chống xung đột giữa 4 nhóm
// (mỗi nhóm một file cặp, một khối CSS, một neo trong tokens.json).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GROUPS, loadPairs, pairProblems, parseArgs } from "../scripts/design-canvas/compare-moi.mjs";
import { MOCK_STATES, mockOptions } from "../scripts/design-canvas/moi-mock-states.mjs";

const root = new URL("../", import.meta.url);

test("parseArgs: mặc định preview, --only nhiều nhóm, --pair JSON lặp được", () => {
  const options = parseArgs(["--only", "quan-tri,doi-cua-toi", "--pair", '{"artboard":"A","path":"/","width":390,"ready":"main"}', "--pair", '{"artboard":"B","path":"/x/","width":1440,"ready":"main"}', "--base", "http://127.0.0.1:4331/"]);
  assert.equal(options.base, "http://127.0.0.1:4331");
  assert.deepEqual(options.only, ["quan-tri", "doi-cua-toi"]);
  assert.deepEqual(options.pairs.map((pair) => [pair.artboard, pair.group]), [["A", "lệnh"], ["B", "lệnh"]]);
  assert.match(options.out, /\.cache\/design-compare\/moi$/);
  assert.equal(parseArgs([]).base, "http://127.0.0.1:4321");
  assert.throws(() => parseArgs(["--only", "khac"]), /--only không hợp lệ/);
  assert.throws(() => parseArgs(["--pair", "{sai"]), /--pair không phải JSON/);
});

test("pairProblems: bắt buộc artboard, path, width, ready", () => {
  assert.deepEqual(pairProblems({ artboard: "DoiCongDongMoi", path: "/doi-cong-dong/", width: 1440, ready: ".cm-team-card", mock: "dang-nhap" }), []);
  const problems = pairProblems({ artboard: "X", path: "doi", width: 0 });
  assert.equal(problems.length, 3);
  assert.ok(problems.some((problem) => problem.includes("ready")));
});

test("loadPairs: mỗi file một nhóm, --only lọc theo tên file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "moi-pairs-"));
  try {
    await writeFile(join(dir, "doi-cong-dong.mjs"), 'export default [{ artboard: "DoiCongDongMoi", path: "/doi-cong-dong/", width: 1440, ready: "main" }];');
    await writeFile(join(dir, "quan-tri.mjs"), "export default [];");
    assert.deepEqual((await loadPairs({ dir })).map((pair) => pair.group), ["doi-cong-dong"]);
    assert.deepEqual(await loadPairs({ dir, only: ["quan-tri"] }), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mockOptions: 4 trạng thái, ghi đè nông, tên lạ báo lỗi", () => {
  assert.deepEqual(Object.keys(MOCK_STATES), ["khach", "dang-nhap", "quan-tri", "bi-khoa"]);
  assert.equal(mockOptions().user, null);
  assert.equal(mockOptions("dang-nhap").user.role, "user");
  assert.equal(mockOptions("dang-nhap").teams.mine.items.length, 3);
  assert.equal(mockOptions("quan-tri").user.role, "root");
  assert.ok(mockOptions("quan-tri").users.length > 0);
  const banned = mockOptions("bi-khoa");
  assert.equal(banned.user, null);
  assert.ok(Date.parse(banned.banNotice.body.until) > 0, "khoá có hạn: có ngày hết khoá");
  assert.equal(mockOptions({ state: "dang-nhap", comments: [] }).comments.length, 0);
  // Mỗi lần gọi trả bản mới: mock quản trị sửa mảng tại chỗ không rò sang cặp sau.
  assert.notEqual(mockOptions("quan-tri").users, mockOptions("quan-tri").users);
  assert.throws(() => mockOptions("khac"), /mock không hợp lệ/);
});

test("khung chống xung đột: 4 nhóm có file cặp riêng (mọi cặp hợp lệ), khối CSS riêng và neo tokens riêng", async () => {
  assert.deepEqual([...GROUPS].sort(), ["bai-viet-kho", "doi-cong-dong", "doi-cua-toi", "quan-tri"]);
  // File cặp bắt đầu rỗng ở nền; nhánh nhóm điền cặp của mình — mọi cặp phải đúng hình dạng và thuộc đúng nhóm.
  for (const group of GROUPS) {
    for (const pair of await loadPairs({ only: [group] })) {
      assert.equal(pair.group, group);
      assert.deepEqual(pairProblems(pair), [], `${group}.mjs: cặp ${pair.artboard} sai hình dạng`);
    }
  }

  const css = await readFile(new URL("css/styles.css", root), "utf8");
  const lines = css.split("\n");
  const at = (marker) => lines.indexOf(marker);
  const starts = GROUPS.map((group) => at(`/* moi:${group}:start */`));
  for (const [index, group] of GROUPS.entries()) {
    assert.ok(starts[index] >= 0, `thiếu mốc start của ${group}`);
    assert.ok(at(`/* moi:${group}:end */`) > starts[index], `mốc end của ${group} phải sau start`);
  }
  const sorted = [...starts].sort((a, b) => a - b);
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(sorted[index] - sorted[index - 1] > 100, "các khối CSS của nhóm cách nhau xa (không chung vùng diff)");
  }

  const readme = await readFile(new URL("docs/design/so-binh-phap/README.md", root), "utf8");
  const tokens = JSON.parse(await readFile(new URL("docs/design/so-binh-phap/tokens.json", root), "utf8"));
  const anchors = GROUPS.map((group) => {
    const line = readme.split("\n").find((row) => row.includes(`moi:${group}:start`));
    assert.ok(line, `README thiếu dòng tình trạng của ${group}`);
    const anchor = line.match(/neo `components\.([a-z0-9-]+)`/)?.[1];
    assert.ok(anchor && anchor in tokens.components, `neo tokens của ${group} phải là component có thật`);
    return anchor;
  });
  assert.equal(new Set(anchors).size, GROUPS.length, "mỗi nhóm một neo khác nhau");
  const order = Object.keys(tokens.components);
  const positions = anchors.map((anchor) => order.indexOf(anchor)).sort((a, b) => a - b);
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index] - positions[index - 1] >= 2, "hai neo không được liền nhau (chèn sau neo sẽ đụng nhau)");
  }
});
