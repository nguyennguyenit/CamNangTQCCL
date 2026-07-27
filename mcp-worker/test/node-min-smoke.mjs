import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const rootPin = readFileSync(new URL("../../.node-version", import.meta.url), "utf8").trim();
const expected = `v${rootPin}`;
assert.equal(process.version, expected, `Expected exact root Node pin ${expected}`);

for (const relativePath of [".nvmrc", "mcp-worker/.node-version", "mcp-worker/.nvmrc"]) {
  assert.equal(
    existsSync(new URL(`../../${relativePath}`, import.meta.url)),
    false,
    `${relativePath} duplicates the root Node pin`,
  );
}

const rootPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);
const workerPackage = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const exactVersion = /^\d+\.\d+\.\d+$/u;
assert.doesNotMatch(
  workerPackage.engines.node,
  exactVersion,
  "mcp-worker engines.node must be a compatible range, not a second exact pin",
);

function supportsPinnedVersion(range, label) {
  const [major, minor, patch] = rootPin.split(".").map(Number);
  const minimum = range.match(/>=\s*(\d+)\.(\d+)\.(\d+)/u);
  const maximumMajor = range.match(/<\s*(\d+)/u);
  assert.ok(minimum && maximumMajor, `${label} must declare a bounded Node range`);
  const minimumTuple = minimum.slice(1).map(Number);
  const pinnedTuple = [major, minor, patch];
  const pinAtOrAboveMinimum = pinnedTuple.some(
    (part, index) =>
      part > minimumTuple[index] &&
      pinnedTuple.slice(0, index).every((value, prior) => value === minimumTuple[prior]),
  ) || pinnedTuple.every((part, index) => part === minimumTuple[index]);
  assert.ok(pinAtOrAboveMinimum, `${label} excludes the root Node pin ${rootPin}`);
  assert.ok(major < Number(maximumMajor[1]), `${label} excludes the root Node pin ${rootPin}`);
}

supportsPinnedVersion(rootPackage.engines.node, "root engines.node");
supportsPinnedVersion(workerPackage.engines.node, "mcp-worker engines.node");

const { legacyDomainAdapter } = await import(
  "../dist/mcp-worker/src/domain/legacy-domain-adapter.js"
);
assert.equal(legacyDomainAdapter.normalizeText("  SP Tuân Úc  "), "sp tuan uc");
