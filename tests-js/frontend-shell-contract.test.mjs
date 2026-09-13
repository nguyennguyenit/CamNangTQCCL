import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  FRONTEND_SECTIONS,
  assertFrontendShellContract,
} from "./frontend-shell-contract-assertions.mjs";

const shellPath = new URL("../src/pages/index.astro", import.meta.url);
const legacyShellPath = new URL("../index.html", import.meta.url);

async function astroShell() {
  return readFile(shellPath, "utf8");
}

function attributeValues(html, attribute) {
  return [...html.matchAll(new RegExp(`${attribute}=["']([^"']+)["']`, "g"))]
    .map((match) => match[1]);
}

test("Astro shell preserves metadata and browser entry assets", async () => {
  const html = await astroShell();

  assertFrontendShellContract(html, {
    stylesheetPattern: /<link[^>]+rel=["']stylesheet["'][^>]+href=["']\/css\/styles\.css["']/,
    scriptPattern: /<script[^>]+type=["']module["'][^>]+src=["']\/js\/app\.js["'][^>]*><\/script>/,
  });
});

test("Astro shell has one tab and mount for every supported section", async () => {
  const html = await astroShell();
  const tabSections = attributeValues(html, "data-section");
  const ids = new Set(attributeValues(html, "id"));

  assert.deepEqual(tabSections, FRONTEND_SECTIONS);
  assert.equal(new Set(tabSections).size, FRONTEND_SECTIONS.length);
  for (const section of FRONTEND_SECTIONS) {
    assert.ok(ids.has(`section-${section}`), `missing mount for ${section}`);
  }
  assert.match(html, /class=["']nav-tab active["'][^>]+data-section=["']team-chuan["']/);
  assert.match(html, /id=["']section-team-chuan["'][^>]+class=["']section active["']/);
});

test("Astro shell retains navigation and theme accessibility hooks", async () => {
  const html = await astroShell();

  assert.match(html, /id=["']section-menu-toggle["']/);
  assert.match(html, /aria-controls=["']section-menu-items["']/);
  assert.match(html, /aria-expanded=["']false["']/);
  assert.match(html, /id=["']section-menu-items["']/);
  assert.match(html, /id=["']theme-toggle["']/);
});

test("root legacy HTML entry no longer exists", async () => {
  await assert.rejects(readFile(legacyShellPath), { code: "ENOENT" });
});
